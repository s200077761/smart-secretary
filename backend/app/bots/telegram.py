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

SYSTEM_PROMPT = (
    "أنت السكرتير الذكي، مساعد شخصي يتحدث العربية حصراً. "
    "كن مفيداً وموجزاً. لا تستخدم الإنجليزية إلا إذا طُلب منك ذلك."
)

IRIS_PROMPT = (
    "أنت خبير في تحليل قزحية العين. حلل هذه الصورة بدقة وأعطِ:\n"
    "1. لون القزحية وتدرجاته\n"
    "2. الأنماط والخطوط المميزة\n"
    "3. حجم البؤبؤ وشكله\n"
    "4. أي مميزات أو ملاحظات خاصة\n"
    "5. تقييم الحالة العامة للعين\n\n"
    "قدّم التحليل باللغة العربية."
)


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


async def _analyze_iris(image_bytes: bytes) -> str:
    """Use vision LLM to analyze iris image."""
    b64 = base64.b64encode(image_bytes).decode()
    llm = get_vision_llm()
    msg = HumanMessage(content=[
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        {"type": "text", "text": IRIS_PROMPT},
    ])
    response = await llm.ainvoke([msg])
    return str(response.content)


async def _process_iris_bg(chat_id: int, file_id: str, caption: str) -> None:
    """Background task: download photo, analyze iris, send result."""
    try:
        image_bytes = await _download_photo(file_id)
        analysis = await _analyze_iris(image_bytes)
        prefix = f"ملاحظة: {caption}\n\n" if caption else ""
        await _send_message(chat_id, f"تحليل قزحية العين:\n\n{prefix}{analysis}")
    except Exception as exc:
        logger.exception("Iris analysis error: %s", exc)
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

    # ── Photo: iris analysis (background task) ────────────────────────────────
    if "photo" in message:
        photos = message["photo"]
        file_id = photos[-1]["file_id"]  # largest available size
        caption = message.get("caption", "").strip()
        # Start background processing, reply immediately to avoid webhook timeout
        asyncio.create_task(_process_iris_bg(chat_id, file_id, caption))
        return _reply(chat_id, "جارٍ تحليل صورة القزحية... سيصلك الرد خلال لحظات.")

    # ── Text commands ─────────────────────────────────────────────────────────
    text: str = message.get("text", "").strip()
    if not text:
        return _reply(chat_id, "أرسل صورة قزحية العين أو اكتب رسالتك.")

    if text in ("/start", "/start@ZizomBot"):
        return _reply(
            chat_id,
            "مرحباً بك في السكرتير الذكي!\n\n"
            "أنا مساعدك الشخصي المدعوم بالذكاء الاصطناعي.\n\n"
            "الأوامر المتاحة:\n"
            "- أرسل صورة قزحية عين لتحليلها\n"
            "- أرسل أي سؤال مباشرةً\n"
            "- /agent <المهمة> لتشغيل الوكيل\n"
            "- /help لعرض المساعدة",
        )

    if text in ("/help", "/help@ZizomBot"):
        return _reply(
            chat_id,
            "الأوامر:\n"
            "/start - بدء المحادثة\n"
            "/agent <مهمة> - وكيل مستقل\n"
            "/help - هذه الرسالة\n\n"
            "يمكنك أيضاً إرسال صورة قزحية العين لتحليلها.",
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
