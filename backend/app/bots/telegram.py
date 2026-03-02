"""Telegram Bot — webhook inline-response mode (simplified, no Markdown)."""

import asyncio
import base64
import logging

import httpx
from langchain.schema import HumanMessage, SystemMessage

from app.config import settings
from app.llm import get_llm, get_vision_llm
from app.agents.manus_agent import run_manus_agent

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

IRIS_PROMPT = """أنت خبير في علم القزحية (Iridology). حلل قزحية العين في الصورة وفق خريطة القزحية الطبية وأعطِ:
1. لون القزحية: وصف اللون الأساسي وأي تدرجات أو بقع
2. مناطق القزحية: حدد المناطق المرئية وما تمثله (الأعضاء المرتبطة بها)
3. الألياف والخطوط: كثافتها واتجاهها وما تدل عليه
4. العلامات والبقع: أي تغيرات لونية أو علامات مميزة
5. حجم البؤبؤ: هل هو طبيعي أم متسع أم ضيق
6. الملاحظات الصحية العامة: ما قد تدل عليه صحة القزحية

قدّم التحليل بالعربية بشكل منظم."""

PALM_PROMPT = """أنت خبير في قراءة الكف وعلوم الأدرمة (Dermatoglyphics) والتحليل الصحي لراحة اليد. حلل الكف في الصورة وأعطِ:
1. خط الحياة (Life Line): مساره وعمقه وطوله وما يدل عليه صحياً
2. خط القلب (Heart Line): وصفه وارتباطاته بصحة القلب والجهاز الدوري
3. خط العقل/الرأس (Head Line): ما يشير إليه من حالة الجهاز العصبي والتفكير
4. خط المصير (Fate Line): إن وُجد، وصفه وملاحظاته
5. الجبال (Mounts): تحليل البروزات عند قاعدة الأصابع
6. لون الكف ونسيجه: ما قد يدل عليه صحياً (شحوب، احمرار، جفاف، إلخ)
7. الأصابع: شكلها وأي ملاحظات مميزة

قدّم التحليل بالعربية بشكل منظم."""

FACE_PROMPT = """أنت خبير في خرائط الوجه الصحية (Face Mapping) وفق الطب الصيني التقليدي والطب التكاملي. حلل ملامح الوجه في الصورة وأعطِ:
1. الجبهة: ما تدل عليه حالة البشرة هنا (الجهاز الهضمي، الكبد، المثانة)
2. منطقة الحاجبين وما بينهما: الارتباط بالكبد والطحال
3. الأنف: المنطقة المحيطة به وارتباطها بالقلب والجهاز الدوري
4. الخدان: ما قد يدل عليه لونهما وحالتهما (الرئتان، الجهاز التنفسي)
5. منطقة الفم والذقن: ارتباطها بالجهاز الهضمي والهرمونات
6. لون البشرة العام: شحوب، احمرار، اصفرار، وما تعنيه
7. أي ملاحظات عامة عن ملامح الوجه وصحتها

قدّم التحليل بالعربية بشكل منظم."""

AUTO_PROMPT = """أنت خبير في التحليل الصحي البصري. انظر إلى هذه الصورة وحدد:
- إذا كانت صورة عين/قزحية: حللها وفق علم القزحية (Iridology)
- إذا كانت صورة كف/يد: حللها وفق قراءة الكف والأدرمة
- إذا كانت صورة وجه: حللها وفق خرائط الوجه الصحية
- غير ذلك: صف ما تراه وقدّم أي ملاحظات مفيدة

قدّم التحليل بالعربية بشكل منظم."""

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
    """Detect analysis type from photo caption."""
    for atype, info in ANALYSIS_TYPES.items():
        for kw in info["keywords"]:
            if kw in caption:
                return atype
    return "auto"


def _reply(chat_id: int, text: str) -> dict:
    """Inline sendMessage response — no Markdown, no reply_to."""
    return {
        "method": "sendMessage",
        "chat_id": chat_id,
        "text": text[:4096],
    }


async def _send_message(chat_id: int, text: str) -> None:
    """Send a message directly via Telegram API (for background tasks)."""
    token = settings.TELEGRAM_TOKEN
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            await client.post(
                f"https://api.telegram.org/bot{token}/sendMessage",
                json={"chat_id": chat_id, "text": text[:4096]},
            )
        except Exception as exc:
            logger.exception("_send_message failed: %s", exc)


async def _download_photo(file_id: str) -> bytes:
    """Download photo bytes from Telegram."""
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
    """Run vision LLM analysis on image bytes."""
    b64 = base64.b64encode(image_bytes).decode()
    llm = get_vision_llm()
    msg = HumanMessage(content=[
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        {"type": "text", "text": prompt},
    ])
    response = await llm.ainvoke([msg])
    return str(response.content)


async def _process_photo_bg(chat_id: int, file_id: str, caption: str) -> None:
    """Background task: download photo, detect type, analyze, send result."""
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
    except Exception as exc:
        logger.exception("Photo analysis error: %s", exc)
        await _send_message(chat_id, f"تعذّر تحليل الصورة: {exc}")


async def setup(webhook_url: str | None = None) -> None:
    if not settings.TELEGRAM_TOKEN:
        logger.info("No TELEGRAM_TOKEN — Telegram bot disabled.")
        return
    logger.info("Telegram bot ready (inline-response mode).")


async def handle_update(body: dict) -> dict | None:
    if not settings.TELEGRAM_TOKEN:
        return None

    message = body.get("message") or body.get("edited_message")
    if not message:
        return None

    chat_id: int = message["chat"]["id"]

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
        asyncio.create_task(_process_photo_bg(chat_id, file_id, caption))
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
        return _reply(
            chat_id,
            "مرحباً بك في السكرتير الذكي!\n\n"
            "التحليل الطبي البصري المتاح:\n\n"
            "1. قزحية العين\n"
            "   أرسل صورة + اكتب 'قزحية' في التعليق\n\n"
            "2. تحليل الكف\n"
            "   أرسل صورة + اكتب 'كف' في التعليق\n\n"
            "3. خرائط الوجه\n"
            "   أرسل صورة + اكتب 'وجه' في التعليق\n\n"
            "أو أرسل الصورة بدون تعليق للتحليل التلقائي.\n\n"
            "يمكنك أيضاً كتابة أي سؤال مباشرة.",
        )

    if text in ("/help", "/help@ZizomBot"):
        return _reply(
            chat_id,
            "الأوامر:\n"
            "/start - بدء المحادثة والتعليمات\n"
            "/agent <مهمة> - وكيل مستقل\n"
            "/help - هذه الرسالة\n\n"
            "التحليل الطبي:\n"
            "- صورة + 'قزحية' = تحليل القزحية\n"
            "- صورة + 'كف' = تحليل الكف\n"
            "- صورة + 'وجه' = خرائط الوجه",
        )

    if text.startswith("/agent"):
        task = text[6:].strip()
        if not task:
            return _reply(chat_id, "يرجى ذكر المهمة: /agent <المهمة>")
        try:
            state = await run_manus_agent(task, None)
            result = state.final_result or "لم أتمكن من إتمام المهمة."
            return _reply(chat_id, f"اكتملت المهمة:\n\n{result}")
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
        return _reply(chat_id, str(response.content))
    except Exception as exc:
        logger.exception("Chat error: %s", exc)
        return _reply(chat_id, f"حدث خطأ: {exc}")
