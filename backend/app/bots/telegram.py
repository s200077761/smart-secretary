"""Telegram Bot — webhook inline-response mode (simplified, no Markdown)."""

import logging
from langchain.schema import HumanMessage, SystemMessage
from app.config import settings
from app.llm import get_llm
from app.agents.manus_agent import run_manus_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "أنت السكرتير الذكي، مساعد شخصي يتحدث العربية حصراً. "
    "كن مفيداً وموجزاً. لا تستخدم الإنجليزية إلا إذا طُلب منك ذلك."
)


def _reply(chat_id: int, text: str) -> dict:
    """Inline sendMessage response — no Markdown, no reply_to."""
    return {
        "method": "sendMessage",
        "chat_id": chat_id,
        "text": text[:4096],
    }


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
    text: str = message.get("text", "").strip()

    if not text:
        return None

    if text in ("/start", "/start@ZizomBot"):
        return _reply(
            chat_id,
            "مرحباً بك في السكرتير الذكي!\n\n"
            "أنا مساعدك الشخصي المدعوم بالذكاء الاصطناعي.\n\n"
            "الأوامر المتاحة:\n"
            "- أرسل أي سؤال مباشرةً\n"
            "- /agent <المهمة> لتشغيل الوكيل\n"
            "- /help لعرض المساعدة",
        )

    if text in ("/help", "/help@ZizomBot"):
        return _reply(
            chat_id,
            "الأوامر:\n/start - بدء المحادثة\n/agent <مهمة> - وكيل مستقل\n/help - هذه الرسالة",
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

    # Plain text chat
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
