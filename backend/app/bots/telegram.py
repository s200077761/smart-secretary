"""
Telegram Bot — webhook inline-response mode.

Telegram supports returning a Bot API method directly in the HTTP response body.
This avoids any outbound connection from the server to api.telegram.org.

Reference: https://core.telegram.org/bots/api#making-requests-when-getting-updates
"""

import logging

from langchain.schema import HumanMessage, SystemMessage

from app.config import settings
from app.llm import get_llm
from app.agents.manus_agent import run_manus_agent

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "أنت السكرتير الذكي، مساعد شخصي يتحدث العربية حصراً. "
    "كن مفيداً وموجزاً. لا تستخدم الإنجليزية إلا إذا طُلب منك ذلك صراحةً."
)


def _reply(chat_id: int, text: str, reply_to: int | None = None) -> dict:
    """Build an inline sendMessage response for Telegram."""
    payload = {
        "method": "sendMessage",
        "chat_id": chat_id,
        "text": text[:4096],
        "parse_mode": "Markdown",
    }
    if reply_to:
        payload["reply_to_message_id"] = reply_to
    return payload


async def setup(webhook_url: str | None = None) -> None:
    """Nothing to initialize — inline response mode needs no network calls."""
    if not settings.TELEGRAM_TOKEN:
        logger.info("No TELEGRAM_TOKEN — Telegram bot disabled.")
        return
    logger.info("Telegram bot ready (inline-response mode).")


async def handle_update(body: dict) -> dict | None:
    """
    Process a Telegram webhook update.
    Returns a Bot API method dict to be sent as the HTTP response body,
    or None if no reply is needed.
    """
    if not settings.TELEGRAM_TOKEN:
        return None

    message = body.get("message") or body.get("edited_message")
    if not message:
        return None

    chat_id: int = message["chat"]["id"]
    message_id: int = message["message_id"]
    text: str = message.get("text", "").strip()

    if not text:
        return None

    # ── /start ────────────────────────────────────────────────────────────────
    if text == "/start":
        return _reply(
            chat_id,
            "👋 *مرحباً بك في السكرتير الذكي!*\n\n"
            "أنا مساعدك الشخصي المدعوم بالذكاء الاصطناعي.\n\n"
            "📌 *الأوامر المتاحة:*\n"
            "• أرسل أي سؤال أو طلب مباشرةً\n"
            "• /agent `<المهمة>` — تشغيل الوكيل المستقل\n"
            "• /help — عرض المساعدة",
            reply_to=message_id,
        )

    # ── /help ─────────────────────────────────────────────────────────────────
    if text == "/help":
        return _reply(
            chat_id,
            "*الأوامر المتاحة:*\n\n"
            "/start — بدء المحادثة\n"
            "/agent `<مهمة>` — تشغيل وكيل مستقل\n"
            "/help — عرض هذه الرسالة",
            reply_to=message_id,
        )

    # ── /agent ────────────────────────────────────────────────────────────────
    if text.startswith("/agent"):
        task = text[6:].strip()
        if not task:
            return _reply(chat_id, "❌ يرجى ذكر المهمة:\n`/agent <المهمة>`", reply_to=message_id)
        try:
            state = await run_manus_agent(task, None)
            result = state.final_result or "لم أتمكن من إتمام المهمة."
            reflection = state.reflection_note or ""
            reply_text = f"✅ *اكتملت المهمة*\n\n{result}"
            if reflection:
                reply_text += f"\n\n📊 *التقييم:* {reflection}"
            return _reply(chat_id, reply_text, reply_to=message_id)
        except Exception as exc:
            logger.exception("Agent error: %s", exc)
            return _reply(chat_id, f"❌ حدث خطأ: {exc}", reply_to=message_id)

    # ── Unknown command ───────────────────────────────────────────────────────
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
        return _reply(chat_id, str(response.content), reply_to=message_id)
    except Exception as exc:
        logger.exception("Chat error: %s", exc)
        return _reply(chat_id, f"❌ حدث خطأ: {exc}", reply_to=message_id)
