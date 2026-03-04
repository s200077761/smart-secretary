"""
WhatsApp bot — Meta Business API webhook handler.

Features:
  - Text chat with the AI secretary (Arabic)
  - /start — welcome message with instructions
  - /help  — list of available commands
  - /agent <task> — run the Manus autonomous agent
  - /clear — clear conversation history
  - Image analysis: iris, palm, face (same as Telegram bot)
  - Admin monitoring: all conversations forwarded to ADMIN_WHATSAPP_NUMBER if set
  - In-memory per-user conversation history (last 10 messages)
  - Fallback to Twilio WhatsApp sandbox
"""

import asyncio
import base64
import logging
from collections import defaultdict, deque

import httpx
from langchain.schema import HumanMessage, SystemMessage, AIMessage

from app.config import settings
from app.llm import get_llm, get_vision_llm
from app.agents.manus_agent import run_manus_agent, ManusTaskState
from app.medical_knowledge import (
    IRIDOLOGY_KNOWLEDGE,
    PALMISTRY_KNOWLEDGE,
    FACE_MAPPING_KNOWLEDGE,
)

logger = logging.getLogger(__name__)

# ── System prompts ────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = (
    "أنت السكرتير الذكي، مساعد شخصي يتحدث العربية. "
    "كن موجزاً في إجاباتك لأنك تتحدث عبر واتساب. "
    "استخدم إيموجي مناسبة لتوضيح الرسائل. "
    "لا تستخدم الإنجليزية إلا إذا طُلب منك ذلك صراحةً."
)

DISCLAIMER = (
    "\n\n⚠️ تنبيه: هذا التحليل للاسترشاد فقط وليس تشخيصاً طبياً. "
    "استشر طبيباً مختصاً لأي حالة صحية."
)

AGENT_TRIGGER = "/agent "

# ── Medical vision prompts (mirrored from Telegram bot) ──────────────────────

IRIS_PROMPT = f"""أنت خبير في علم القزحية (Iridology). استخدم قاعدة المعرفة التالية لتحليل الصورة:

{IRIDOLOGY_KNOWLEDGE}

بناءً على الخريطة أعلاه، حلل قزحية العين في الصورة وأعطِ:
1. لون القزحية وما يدل عليه صحياً
2. مناطق القزحية والأعضاء المرتبطة بها
3. الألياف والخطوط ودلالاتها
4. العلامات والبقع ومعناها
5. حجم البؤبؤ وشكله
6. الملاحظات الصحية العامة

قدّم التحليل بالعربية بشكل واضح ومنظم (200-300 كلمة)."""

PALM_PROMPT = f"""أنت خبير في قراءة الكف والتحليل الصحي لراحة اليد. استخدم قاعدة المعرفة التالية:

{PALMISTRY_KNOWLEDGE}

بناءً على المعرفة أعلاه، حلل الكف في الصورة وأعطِ:
1. خط الحياة ودلالاته الصحية
2. خط القلب وارتباطاته
3. خط العقل/الرأس
4. خط المصير إن وُجد
5. الجبال ودلالاتها الصحية
6. لون الكف ونسيجه
7. الملاحظات الصحية العامة

قدّم التحليل بالعربية بشكل واضح ومنظم (200-300 كلمة)."""

FACE_PROMPT = f"""أنت خبير في خرائط الوجه الصحية (Face Mapping). استخدم قاعدة المعرفة التالية:

{FACE_MAPPING_KNOWLEDGE}

بناءً على الخريطة أعلاه، حلل ملامح الوجه في الصورة وأعطِ:
1. الجبهة وارتباطاتها الصحية
2. منطقة الحاجبين وما بينهما
3. الأنف والمحيط
4. الخدان ولونهما
5. منطقة العيون والهالات
6. الفم والذقن والفك
7. لون البشرة العام

قدّم التحليل بالعربية بشكل واضح ومنظم (200-300 كلمة)."""

AUTO_PROMPT = """أنت خبير في التحليل الصحي البصري.
حدد نوع الصورة تلقائياً ثم حللها:

• عين/قزحية → حلّل: اللون والمناطق الساعاتية والألياف والبقع والبؤبؤ
• كف/يد → حلّل: خطوط الحياة والقلب والعقل والمصير، الجبال، لون الجلد
• وجه → حلّل: مناطق الجبهة والأنف والخدين والعينين والذقن
• غير ذلك → صف ما تراه وقدّم ملاحظات مفيدة

قدّم التحليل بالعربية بشكل واضح ومنظم (150-250 كلمة)."""

ANALYSIS_TYPES = {
    "iris": {
        "keywords": ["قزحية", "عين", "iris", "eye"],
        "prompt": IRIS_PROMPT,
        "title": "تحليل القزحية (Iridology)",
        "wait_msg": "🔍 جارٍ تحليل قزحية العين... سيصلك الرد خلال لحظات.",
    },
    "palm": {
        "keywords": ["كف", "يد", "راحة", "palm", "hand"],
        "prompt": PALM_PROMPT,
        "title": "تحليل الكف الصحي",
        "wait_msg": "🖐️ جارٍ تحليل الكف... سيصلك الرد خلال لحظات.",
    },
    "face": {
        "keywords": ["وجه", "خد", "face"],
        "prompt": FACE_PROMPT,
        "title": "خرائط الوجه الصحية",
        "wait_msg": "😊 جارٍ تحليل الوجه... سيصلك الرد خلال لحظات.",
    },
}

# ── Per-user conversation history (in-memory, last 10 turns) ─────────────────

_history: dict[str, deque] = defaultdict(lambda: deque(maxlen=10))


def _detect_analysis_type(caption: str) -> str:
    caption_lower = caption.lower()
    for atype, info in ANALYSIS_TYPES.items():
        for kw in info["keywords"]:
            if kw in caption_lower:
                return atype
    return "auto"


# ── Meta WhatsApp API helpers ─────────────────────────────────────────────────

async def _send_meta(to: str, message: str) -> None:
    """Send a message via Meta WhatsApp Business API."""
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.warning("WhatsApp Meta credentials not configured.")
        return

    url = (
        f"https://graph.facebook.com/v21.0"
        f"/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    chunks = [message[i:i + 4000] for i in range(0, len(message), 4000)]

    async with httpx.AsyncClient(timeout=30) as client:
        for chunk in chunks:
            try:
                await client.post(
                    url,
                    headers={
                        "Authorization": f"Bearer {settings.WHATSAPP_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "messaging_product": "whatsapp",
                        "to": to,
                        "type": "text",
                        "text": {"body": chunk},
                    },
                )
            except Exception as exc:
                logger.exception("Meta send error: %s", exc)


async def _download_media_meta(media_id: str) -> bytes:
    """Download media (image) from Meta using media_id."""
    if not settings.WHATSAPP_TOKEN:
        raise RuntimeError("WHATSAPP_TOKEN not configured")

    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: get media URL
        r = await client.get(
            f"https://graph.facebook.com/v21.0/{media_id}",
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
        )
        r.raise_for_status()
        media_url = r.json().get("url")
        if not media_url:
            raise RuntimeError(f"No URL returned for media_id={media_id}")

        # Step 2: download the file
        r2 = await client.get(
            media_url,
            headers={"Authorization": f"Bearer {settings.WHATSAPP_TOKEN}"},
        )
        r2.raise_for_status()
        return r2.content


async def _analyze_image(image_bytes: bytes, prompt: str) -> str:
    """Run vision LLM on image bytes."""
    b64 = base64.b64encode(image_bytes).decode()
    llm = get_vision_llm()
    msg = HumanMessage(content=[
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        {"type": "text", "text": prompt},
    ])
    response = await llm.ainvoke([msg])
    return str(response.content)


# ── Twilio fallback helpers ───────────────────────────────────────────────────

async def _send_twilio(to: str, message: str) -> None:
    """Send a message via Twilio WhatsApp sandbox."""
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_WHATSAPP_NUMBER):
        return
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    chunks = [message[i:i + 4000] for i in range(0, len(message), 4000)]
    async with httpx.AsyncClient(timeout=30) as client:
        for chunk in chunks:
            try:
                await client.post(
                    url,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    data={
                        "From": f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}",
                        "To": f"whatsapp:{to}",
                        "Body": chunk,
                    },
                )
            except Exception as exc:
                logger.exception("Twilio send error: %s", exc)


async def _send(to: str, message: str) -> None:
    """Send via Meta API if configured, otherwise fall back to Twilio."""
    if settings.WHATSAPP_TOKEN and settings.WHATSAPP_PHONE_NUMBER_ID:
        await _send_meta(to, message)
    elif settings.TWILIO_ACCOUNT_SID:
        await _send_twilio(to, message)
    else:
        logger.warning("No WhatsApp provider configured — cannot send to %s", to)


# ── Admin monitoring ──────────────────────────────────────────────────────────

async def _notify_admin(from_number: str, incoming: str, outgoing: str) -> None:
    """Forward conversation to admin WhatsApp number (ADMIN_WHATSAPP_NUMBER env var)."""
    admin = getattr(settings, "ADMIN_WHATSAPP_NUMBER", None)
    if not admin:
        return
    text = (
        f"👤 المستخدم: {from_number}\n"
        f"{'─' * 30}\n"
        f"📩 أرسل:\n{incoming}\n\n"
        f"🤖 رد البوت:\n{outgoing}\n"
        f"{'─' * 30}"
    )
    await _send(admin, text)


async def _notify_admin_image(from_number: str, analysis_title: str, analysis: str) -> None:
    admin = getattr(settings, "ADMIN_WHATSAPP_NUMBER", None)
    if not admin:
        return
    text = (
        f"👤 المستخدم: {from_number}\n"
        f"{'─' * 30}\n"
        f"🖼️ أرسل صورة — {analysis_title}\n\n"
        f"🤖 التحليل:\n{analysis}\n"
        f"{'─' * 30}"
    )
    await _send(admin, text)


# ── AI reply with conversation history ───────────────────────────────────────

async def _ai_reply(from_number: str, text: str) -> str:
    """Generate AI reply maintaining per-user conversation history."""
    history = _history[from_number]
    llm = get_llm(temperature=0.7)

    messages = [SystemMessage(content=_SYSTEM_PROMPT)]
    for entry in history:
        if entry["role"] == "user":
            messages.append(HumanMessage(content=entry["content"]))
        else:
            messages.append(AIMessage(content=entry["content"]))
    messages.append(HumanMessage(content=text))

    response = await llm.ainvoke(messages)
    reply = str(response.content)

    history.append({"role": "user", "content": text})
    history.append({"role": "assistant", "content": reply})

    return reply


# ── Image processing ──────────────────────────────────────────────────────────

async def _process_image_bg(from_number: str, media_id: str, caption: str) -> None:
    """Download and analyze a WhatsApp image (Meta API) in the background."""
    try:
        atype = _detect_analysis_type(caption)
        if atype == "auto":
            prompt = AUTO_PROMPT
            title = "التحليل الصحي البصري التلقائي"
        else:
            info = ANALYSIS_TYPES[atype]
            prompt = info["prompt"]
            title = info["title"]

        image_bytes = await _download_media_meta(media_id)
        analysis = await _analyze_image(image_bytes, prompt)

        note = f"ملاحظتك: {caption}\n\n" if caption else ""
        result = f"📊 {title}:\n\n{note}{analysis}{DISCLAIMER}"
        await _send(from_number, result)
        await _notify_admin_image(from_number, title, analysis)

    except Exception as exc:
        logger.exception("Image analysis error for %s: %s", from_number, exc)
        await _send(from_number, f"❌ تعذّر تحليل الصورة: {exc}")


async def _process_twilio_image_bg(from_number: str, media_url: str, caption: str) -> None:
    """Download Twilio image and run medical vision analysis."""
    try:
        atype = _detect_analysis_type(caption)
        if atype == "auto":
            prompt = AUTO_PROMPT
            title = "التحليل الصحي البصري التلقائي"
        else:
            info = ANALYSIS_TYPES[atype]
            prompt = info["prompt"]
            title = info["title"]

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(
                media_url,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            )
            r.raise_for_status()
            image_bytes = r.content

        analysis = await _analyze_image(image_bytes, prompt)
        note = f"ملاحظتك: {caption}\n\n" if caption else ""
        result = f"📊 {title}:\n\n{note}{analysis}{DISCLAIMER}"
        await _send_twilio(from_number, result)

    except Exception as exc:
        logger.exception("Twilio image analysis error for %s: %s", from_number, exc)
        await _send_twilio(from_number, f"❌ تعذّر تحليل الصورة: {exc}")


# ── Welcome / help messages ───────────────────────────────────────────────────

def _start_message() -> str:
    return (
        "👋 مرحباً بك في *السكرتير الذكي*!\n\n"
        "أنا مساعدك الشخصي الذكي. يمكنني:\n\n"
        "💬 *الدردشة* — اكتب أي سؤال مباشرة\n"
        "🤖 */agent <مهمة>* — وكيل مستقل للمهام المعقدة\n"
        "🗑️ */clear* — مسح سجل المحادثة\n\n"
        "🔬 *التحليل الطبي البصري:*\n"
        "  • أرسل صورة + اكتب *قزحية* ← تحليل القزحية\n"
        "  • أرسل صورة + اكتب *كف* ← تحليل الكف\n"
        "  • أرسل صورة + اكتب *وجه* ← خرائط الوجه\n"
        "  • أرسل صورة بدون تعليق ← تحليل تلقائي\n\n"
        "اكتب */help* لعرض الأوامر.\n\n"
        "كيف يمكنني مساعدتك؟ 😊"
    )


def _help_message() -> str:
    return (
        "📋 *الأوامر المتاحة:*\n\n"
        "*/start* — رسالة الترحيب والتعليمات\n"
        "*/help* — هذه الرسالة\n"
        "*/agent <مهمة>* — تشغيل وكيل مستقل\n"
        "*/clear* — مسح سجل المحادثة\n\n"
        "📸 *التحليل الطبي البصري:*\n"
        "أرسل صورة مع تعليق يحدد النوع:\n"
        "• *قزحية* ← تحليل قزحية العين\n"
        "• *كف* ← تحليل الكف الصحي\n"
        "• *وجه* ← خرائط الوجه الصحية\n"
        "• (بدون تعليق) ← تحليل تلقائي\n\n"
        "💬 أو اكتب أي سؤال مباشرة للدردشة!"
    )


# ── Main incoming message handler (Meta API) ─────────────────────────────────

async def handle_incoming(body: dict) -> None:
    """Parse and respond to a Meta WhatsApp Business API webhook event."""
    try:
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        if not messages:
            return

        msg = messages[0]
        from_number: str = msg.get("from", "")
        msg_type: str = msg.get("type", "text")

        if not from_number:
            return

        # ── Image message ─────────────────────────────────────────────────────
        if msg_type == "image":
            image_data = msg.get("image", {})
            media_id: str = image_data.get("id", "")
            caption: str = (image_data.get("caption") or "").strip()
            if not media_id:
                return
            atype = _detect_analysis_type(caption)
            wait_msg = (
                ANALYSIS_TYPES[atype]["wait_msg"]
                if atype != "auto"
                else "🔍 جارٍ تحليل الصورة... سيصلك الرد خلال لحظات."
            )
            await _send(from_number, wait_msg)
            asyncio.create_task(_process_image_bg(from_number, media_id, caption))
            return

        # ── Audio / voice ─────────────────────────────────────────────────────
        if msg_type in ("audio", "voice"):
            await _send(from_number, "🎵 عذراً، لا أستطيع معالجة الرسائل الصوتية حالياً. يرجى الكتابة.")
            return

        # ── Document ──────────────────────────────────────────────────────────
        if msg_type == "document":
            await _send(from_number, "📄 عذراً، لا أستطيع معالجة الملفات حالياً. يرجى كتابة سؤالك.")
            return

        # ── Sticker / other ───────────────────────────────────────────────────
        if msg_type == "sticker":
            await _send(from_number, "😊 اكتب رسالتك وسأساعدك!")
            return

        if msg_type != "text":
            return

        # ── Text message ──────────────────────────────────────────────────────
        text: str = (msg.get("text", {}).get("body") or "").strip()
        if not text:
            return

        if text in ("/start", "start", "مرحبا", "مرحباً", "هلا"):
            reply = _start_message()
            await _send(from_number, reply)
            await _notify_admin(from_number, text, reply)
            return

        if text in ("/help", "help", "مساعدة"):
            reply = _help_message()
            await _send(from_number, reply)
            return

        if text in ("/clear", "clear", "مسح"):
            _history[from_number].clear()
            reply = "✅ تم مسح سجل المحادثة."
            await _send(from_number, reply)
            return

        if text.lower().startswith(AGENT_TRIGGER):
            task = text[len(AGENT_TRIGGER):]
            if not task.strip():
                await _send(from_number, "⚠️ يرجى تحديد المهمة: /agent <المهمة>")
                return
            await _send(from_number, "⏳ جارٍ تشغيل الوكيل المستقل، يرجى الانتظار...")

            async def on_update(state: ManusTaskState) -> None:
                pass  # silent — send only at completion

            state = await run_manus_agent(task, on_update)
            reply = state.final_result or state.error or "❌ لم تكتمل المهمة"
            if state.reflection_note:
                reply += f"\n\n📊 {state.reflection_note}"
            await _send(from_number, reply)
            await _notify_admin(from_number, text, reply)
            return

        if text.startswith("/"):
            await _send(from_number, "❓ أمر غير معروف. اكتب */help* لعرض الأوامر المتاحة.")
            return

        # Plain text — AI chat with history
        reply = await _ai_reply(from_number, text)
        await _send(from_number, reply)
        await _notify_admin(from_number, text, reply)

    except Exception as exc:
        logger.exception("WhatsApp handler error: %s", exc)


# ── Twilio incoming handler ───────────────────────────────────────────────────

async def handle_twilio_incoming(form: dict) -> None:
    """Parse and respond to a Twilio WhatsApp webhook (form-encoded)."""
    try:
        from_number: str = form.get("From", "").replace("whatsapp:", "")
        text: str = (form.get("Body") or "").strip()

        if not from_number:
            return

        # Image via Twilio (NumMedia > 0)
        num_media = int(form.get("NumMedia", "0"))
        if num_media > 0:
            media_url = form.get("MediaUrl0", "")
            caption = text
            if media_url:
                atype = _detect_analysis_type(caption)
                wait_msg = (
                    ANALYSIS_TYPES[atype]["wait_msg"]
                    if atype != "auto"
                    else "🔍 جارٍ تحليل الصورة... سيصلك الرد خلال لحظات."
                )
                await _send_twilio(from_number, wait_msg)
                asyncio.create_task(_process_twilio_image_bg(from_number, media_url, caption))
                return

        if not text:
            return

        if text in ("/start", "start", "مرحبا", "مرحباً", "هلا"):
            await _send_twilio(from_number, _start_message())
            return

        if text in ("/help", "help", "مساعدة"):
            await _send_twilio(from_number, _help_message())
            return

        if text in ("/clear", "clear", "مسح"):
            _history[from_number].clear()
            await _send_twilio(from_number, "✅ تم مسح سجل المحادثة.")
            return

        if text.lower().startswith(AGENT_TRIGGER):
            task = text[len(AGENT_TRIGGER):]
            if not task.strip():
                await _send_twilio(from_number, "⚠️ يرجى تحديد المهمة: /agent <المهمة>")
                return
            await _send_twilio(from_number, "⏳ جارٍ تشغيل الوكيل المستقل، يرجى الانتظار...")
            state = await run_manus_agent(task, None)
            reply = state.final_result or state.error or "❌ لم تكتمل المهمة"
            if state.reflection_note:
                reply += f"\n\n📊 {state.reflection_note}"
            await _send_twilio(from_number, reply)
            return

        if text.startswith("/"):
            await _send_twilio(from_number, "❓ أمر غير معروف. اكتب /help لعرض الأوامر المتاحة.")
            return

        # Plain text — AI chat with history
        reply = await _ai_reply(from_number, text)
        await _send_twilio(from_number, reply)

    except Exception as exc:
        logger.exception("Twilio handler error: %s", exc)
