"""Telegram Bot — webhook inline-response mode with admin monitoring."""

import asyncio
import base64
import logging

import httpx
from langchain.schema import HumanMessage, SystemMessage

from app.config import settings
from app.llm import get_llm, get_vision_llm
from app.agents.manus_agent import run_manus_agent
from app.medical_knowledge import (
    IRIDOLOGY_KNOWLEDGE,
    PALMISTRY_KNOWLEDGE,
    FACE_MAPPING_KNOWLEDGE,
)

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "\n\n⚠️ تنبيه: هذا التحليل للاسترشاد فقط وليس تشخيصاً طبياً. "
    "استشر طبيباً مختصاً لأي حالة صحية."
)

SYSTEM_PROMPT = (
    "أنت السكرتير الذكي، مساعد شخصي يتحدث العربية حصراً. "
    "كن مفيداً وموجزاً. لا تستخدم الإنجليزية إلا إذا طُلب منك ذلك."
)

# ── Analysis prompts ──────────────────────────────────────────────────────────

IRIS_PROMPT = f"""أنت خبير في علم القزحية (Iridology). استخدم قاعدة المعرفة التالية لتحليل الصورة:

{IRIDOLOGY_KNOWLEDGE}

بناءً على الخريطة أعلاه، حلل قزحية العين في الصورة وأعطِ:
1. لون القزحية: وصف اللون الأساسي وما يدل عليه صحياً
2. مناطق القزحية: حدد المناطق المرئية والأعضاء المرتبطة بها
3. الألياف والخطوط: كثافتها واتجاهها ودلالاتها
4. العلامات والبقع: أي تغيرات لونية أو علامات مميزة ومعناها
5. حجم البؤبؤ وشكله: هل هو طبيعي أم متسع أم ضيق
6. الملاحظات الصحية: ما تدل عليه القزحية من حالة صحية عامة

قدّم التحليل بالعربية بشكل منظم ومفصّل."""

PALM_PROMPT = f"""أنت خبير في قراءة الكف والتحليل الصحي لراحة اليد. استخدم قاعدة المعرفة التالية:

{PALMISTRY_KNOWLEDGE}

بناءً على المعرفة أعلاه، حلل الكف في الصورة وأعطِ:
1. خط الحياة: مساره وعمقه وحالته وما يدل عليه صحياً
2. خط القلب: وصفه وارتباطاته بصحة القلب والجهاز الدوري
3. خط العقل/الرأس: ما يشير إليه من حالة الجهاز العصبي
4. خط المصير: إن وُجد، وصفه وملاحظاته
5. الجبال: تحليل البروزات ودلالتها الصحية
6. لون الكف ونسيجه: ما يدل عليه صحياً
7. الملاحظات الصحية العامة للكف

قدّم التحليل بالعربية بشكل منظم ومفصّل."""

FACE_PROMPT = f"""أنت خبير في خرائط الوجه الصحية (Face Mapping). استخدم قاعدة المعرفة التالية:

{FACE_MAPPING_KNOWLEDGE}

بناءً على الخريطة أعلاه، حلل ملامح الوجه في الصورة وأعطِ:
1. الجبهة: حالة البشرة والمناطق المرتبطة بها
2. منطقة الحاجبين وما بينهما: الارتباطات الصحية
3. الأنف والمحيط: دلالاته على القلب والجهاز الدوري
4. الخدان: لونهما وحالتهما والأعضاء المرتبطة
5. منطقة العيون: الهالات والانتفاخات ودلالاتها
6. الفم والذقن والفك: ما يدل عليه من حالة هرمونية وهضمية
7. لون البشرة العام وما يعنيه

قدّم التحليل بالعربية بشكل منظم ومفصّل."""

AUTO_PROMPT = f"""أنت خبير في التحليل الصحي البصري. لديك قواعد المعرفة التالية:

=== علم القزحية ===
{IRIDOLOGY_KNOWLEDGE}

=== تحليل الكف ===
{PALMISTRY_KNOWLEDGE}

=== خرائط الوجه ===
{FACE_MAPPING_KNOWLEDGE}

انظر إلى هذه الصورة وحدد نوعها ثم حللها:
- صورة عين/قزحية: حللها وفق علم القزحية
- صورة كف/يد: حللها وفق تحليل الكف
- صورة وجه: حللها وفق خرائط الوجه
- غير ذلك: صف ما تراه وقدّم ملاحظات مفيدة

قدّم التحليل بالعربية بشكل منظم ومفصّل."""

ANALYSIS_TYPES = {
    "iris": {
        "keywords": ["قزحية", "عين", "iris", "eye"],
        "prompt": IRIS_PROMPT,
        "title": "تحليل القزحية (Iridology)",
        "wait_msg": "جارٍ تحليل قزحية العين... سيصلك الرد خلال لحظات.",
    },
    "palm": {
        "keywords": ["كف", "يد", "راحة", "palm", "hand"],
        "prompt": PALM_PROMPT,
        "title": "تحليل الكف الصحي",
        "wait_msg": "جارٍ تحليل الكف... سيصلك الرد خلال لحظات.",
    },
    "face": {
        "keywords": ["وجه", "خد", "face"],
        "prompt": FACE_PROMPT,
        "title": "خرائط الوجه الصحية",
        "wait_msg": "جارٍ تحليل الوجه... سيصلك الرد خلال لحظات.",
    },
}


def _detect_type(caption: str) -> str:
    for atype, info in ANALYSIS_TYPES.items():
        for kw in info["keywords"]:
            if kw in caption:
                return atype
    return "auto"


def _user_label(message: dict) -> str:
    """Build a readable label for a Telegram user."""
    user = message.get("from", {})
    name = " ".join(filter(None, [user.get("first_name", ""), user.get("last_name", "")]))
    username = f" (@{user['username']})" if user.get("username") else ""
    chat_id = message["chat"]["id"]
    return f"{name}{username} | ID: {chat_id}"


def _reply(chat_id: int, text: str) -> dict:
    return {
        "method": "sendMessage",
        "chat_id": chat_id,
        "text": text[:4096],
    }


async def _send_message(chat_id: int, text: str) -> None:
    token = settings.TELEGRAM_TOKEN
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text[:4096]},
            )
        except Exception as exc:
            logger.exception("_send_message failed: %s", exc)


async def _notify_admin(user_label: str, incoming: str, outgoing: str) -> None:
    """Forward conversation to admin chat."""
    admin_id = settings.ADMIN_CHAT_ID
    if not admin_id:
        return
    text = (
        f"👤 المستخدم: {user_label}\n"
        f"{'─' * 30}\n"
        f"📩 أرسل:\n{incoming}\n\n"
        f"🤖 رد البوت:\n{outgoing}\n"
        f"{'─' * 30}\n"
        f"للرد: /reply {user_label.split('ID: ')[-1]} نص الرد هنا"
    )
    await _send_message(admin_id, text)


async def _notify_admin_photo(user_label: str, analysis_title: str, analysis: str) -> None:
    """Notify admin of photo analysis result."""
    admin_id = settings.ADMIN_CHAT_ID
    if not admin_id:
        return
    chat_id = user_label.split("ID: ")[-1]
    text = (
        f"👤 المستخدم: {user_label}\n"
        f"{'─' * 30}\n"
        f"🖼️ أرسل صورة — {analysis_title}\n\n"
        f"🤖 التحليل:\n{analysis}\n"
        f"{'─' * 30}\n"
        f"للتصحيح: /reply {chat_id} تصحيحك هنا"
    )
    await _send_message(admin_id, text)


async def _download_photo(file_id: str) -> bytes:
    token = settings.TELEGRAM_TOKEN
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(
            f"https://api.telegram.org/bot{token}/getFile",
            params={"file_id": file_id},
        )
        r.raise_for_status()
        file_path = r.json()["result"]["file_path"]
        r2 = await client.get(
            f"https://api.telegram.org/file/bot{token}/{file_path}"
        )
        r2.raise_for_status()
        return r2.content


async def _analyze_image(image_bytes: bytes, prompt: str) -> str:
    b64 = base64.b64encode(image_bytes).decode()
    llm = get_vision_llm()
    msg = HumanMessage(content=[
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        {"type": "text", "text": prompt},
    ])
    response = await llm.ainvoke([msg])
    return str(response.content)


async def _process_photo_bg(chat_id: int, file_id: str, caption: str, user_label: str) -> None:
    try:
        atype = _detect_type(caption)
        if atype == "auto":
            prompt = AUTO_PROMPT
            title = "التحليل الصحي البصري"
        else:
            info = ANALYSIS_TYPES[atype]
            prompt = info["prompt"]
            title = info["title"]

        image_bytes = await _download_photo(file_id)
        analysis = await _analyze_image(image_bytes, prompt)

        note = f"ملاحظتك: {caption}\n\n" if caption else ""
        result = f"{title}:\n\n{note}{analysis}{DISCLAIMER}"
        await _send_message(chat_id, result)

        # Notify admin
        await _notify_admin_photo(user_label, title, analysis)

    except Exception as exc:
        logger.exception("Photo analysis error: %s", exc)
        error_msg = f"تعذّر تحليل الصورة: {exc}"
        await _send_message(chat_id, error_msg)
        if settings.ADMIN_CHAT_ID:
            await _send_message(
                settings.ADMIN_CHAT_ID,
                f"❌ خطأ في تحليل صورة\nالمستخدم: {user_label}\nالخطأ: {exc}"
            )


async def setup(webhook_url: str | None = None) -> None:
    if not settings.TELEGRAM_TOKEN:
        logger.info("No TELEGRAM_TOKEN — Telegram bot disabled.")
        return

    token = settings.TELEGRAM_TOKEN

    if webhook_url:
        full_webhook = f"{webhook_url.rstrip('/')}/api/webhook/telegram"
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                r = await client.post(
                    f"https://api.telegram.org/bot{token}/setWebhook",
                    json={"url": full_webhook, "drop_pending_updates": True},
                )
                data = r.json()
                if data.get("ok"):
                    logger.info("Telegram webhook registered: %s", full_webhook)
                else:
                    logger.error("Telegram setWebhook failed: %s", data)
            except Exception as exc:
                logger.exception("setWebhook error: %s", exc)
    else:
        # Delete any existing webhook (polling mode fallback)
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                await client.post(
                    f"https://api.telegram.org/bot{token}/deleteWebhook",
                    json={"drop_pending_updates": True},
                )
                logger.info("Telegram webhook removed (no SERVER_URL set).")
            except Exception as exc:
                logger.exception("deleteWebhook error: %s", exc)

    if settings.ADMIN_CHAT_ID:
        logger.info("Admin monitoring enabled for chat_id=%s", settings.ADMIN_CHAT_ID)
    logger.info("Telegram bot ready.")


async def handle_update(body: dict) -> dict | None:
    if not settings.TELEGRAM_TOKEN:
        return None

    message = body.get("message") or body.get("edited_message")
    if not message:
        return None

    chat_id: int = message["chat"]["id"]
    user_label = _user_label(message)
    is_admin = settings.ADMIN_CHAT_ID and chat_id == settings.ADMIN_CHAT_ID

    # ── Admin commands ────────────────────────────────────────────────────────
    if is_admin:
        text = message.get("text", "").strip()

        # /reply <chat_id> <message>
        if text.startswith("/reply"):
            parts = text.split(None, 2)
            if len(parts) < 3:
                return _reply(chat_id, "الاستخدام: /reply <chat_id> <الرسالة>")
            try:
                target_id = int(parts[1])
                correction = parts[2]
                await _send_message(target_id, f"✏️ تصحيح من المشرف:\n\n{correction}")
                return _reply(chat_id, f"تم إرسال التصحيح للمستخدم {target_id}.")
            except ValueError:
                return _reply(chat_id, "خطأ: chat_id يجب أن يكون رقماً.")

        # /broadcast <message>
        if text.startswith("/broadcast"):
            return _reply(chat_id, "ميزة البث غير متاحة حالياً (تحتاج قاعدة بيانات).")

        # /myid — for admin too
        if text in ("/myid",):
            return _reply(chat_id, f"معرّفك (Chat ID): {chat_id}\nأنت مسجّل كمشرف.")

        # /status
        if text in ("/status",):
            return _reply(
                chat_id,
                f"حالة البوت:\n"
                f"- النموذج: {settings.HF_MODEL}\n"
                f"- نموذج الرؤية: {settings.VISION_MODEL}\n"
                f"- وضع المشرف: مفعّل\n"
                f"- معرّفك: {chat_id}"
            )

    # ── /myid for any user ────────────────────────────────────────────────────
    text_raw = message.get("text", "").strip()
    if text_raw in ("/myid",):
        return _reply(chat_id, f"معرّفك (Chat ID): {chat_id}")

    # ── Photo: medical vision analysis (background task) ─────────────────────
    if "photo" in message:
        photos = message["photo"]
        file_id = photos[-1]["file_id"]
        caption = message.get("caption", "").strip()
        atype = _detect_type(caption)
        wait_msg = (
            ANALYSIS_TYPES[atype]["wait_msg"]
            if atype != "auto"
            else "جارٍ تحليل الصورة... سيصلك الرد خلال لحظات."
        )
        asyncio.create_task(_process_photo_bg(chat_id, file_id, caption, user_label))
        return _reply(chat_id, wait_msg)

    # ── Text commands ─────────────────────────────────────────────────────────
    text: str = message.get("text", "").strip()
    if not text:
        return _reply(
            chat_id,
            "أرسل صورة مع تحديد نوع التحليل في التعليق:\n"
            "- قزحية ← تحليل القزحية\n"
            "- كف ← تحليل الكف\n"
            "- وجه ← خرائط الوجه\n"
            "(بدون تعليق: تحليل تلقائي)",
        )

    if text in ("/start", "/start@ZizomBot"):
        resp = (
            "مرحباً بك في السكرتير الذكي!\n\n"
            "التحليل الطبي البصري المتاح:\n\n"
            "1. قزحية العين\n"
            "   أرسل صورة + اكتب 'قزحية' في التعليق\n\n"
            "2. تحليل الكف\n"
            "   أرسل صورة + اكتب 'كف' في التعليق\n\n"
            "3. خرائط الوجه\n"
            "   أرسل صورة + اكتب 'وجه' في التعليق\n\n"
            "أو أرسل الصورة بدون تعليق للتحليل التلقائي.\n\n"
            "يمكنك أيضاً كتابة أي سؤال مباشرة."
        )
        asyncio.create_task(_notify_admin(user_label, "/start", resp))
        return _reply(chat_id, resp)

    if text in ("/help", "/help@ZizomBot"):
        resp = (
            "الأوامر:\n"
            "/start - بدء المحادثة والتعليمات\n"
            "/myid - اعرف معرّفك\n"
            "/agent <مهمة> - وكيل مستقل\n"
            "/help - هذه الرسالة\n\n"
            "التحليل الطبي:\n"
            "- صورة + 'قزحية' = تحليل القزحية\n"
            "- صورة + 'كف' = تحليل الكف\n"
            "- صورة + 'وجه' = خرائط الوجه"
        )
        return _reply(chat_id, resp)

    if text.startswith("/agent"):
        task = text[6:].strip()
        if not task:
            return _reply(chat_id, "يرجى ذكر المهمة: /agent <المهمة>")
        try:
            state = await run_manus_agent(task, None)
            result = state.final_result or "لم أتمكن من إتمام المهمة."
            resp = f"اكتملت المهمة:\n\n{result}"
            asyncio.create_task(_notify_admin(user_label, f"/agent {task}", resp))
            return _reply(chat_id, resp)
        except Exception as exc:
            logger.exception("Agent error: %s", exc)
            return _reply(chat_id, f"حدث خطأ: {exc}")

    if text.startswith("/"):
        return None

    # ── Plain text chat ───────────────────────────────────────────────────────
    try:
        llm = get_llm(temperature=0.7)
        messages = [
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=text),
        ]
        response = await llm.ainvoke(messages)
        resp = str(response.content)
        asyncio.create_task(_notify_admin(user_label, text, resp))
        return _reply(chat_id, resp)
    except Exception as exc:
        logger.exception("Chat error: %s", exc)
        return _reply(chat_id, f"حدث خطأ: {exc}")
