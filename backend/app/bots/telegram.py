"""
Telegram Bot — python-telegram-bot v21 (async).

Supports:
  /start  — welcome message
  /help   — command list
  /agent <task>  — run the Manus autonomous agent
  Any text  — direct AI chat reply
"""

import logging
from typing import Any

from telegram import Update, Bot
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
from langchain.schema import HumanMessage, SystemMessage

from app.llm import get_llm
from app.agents.manus_agent import run_manus_agent, ManusTaskState

logger = logging.getLogger(__name__)

# Shared application instance (set during startup)
_app: Any = None


# ── Handlers ──────────────────────────────────────────────────────────────────

async def _start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "👋 *مرحباً بك في السكرتير الذكي!*\n\n"
        "أنا مساعدك الشخصي المدعوم بالذكاء الاصطناعي.\n\n"
        "📌 *الأوامر المتاحة:*\n"
        "• أرسل أي سؤال أو طلب مباشرةً\n"
        "• /agent `<المهمة>` — تشغيل الوكيل المستقل\n"
        "• /help — عرض المساعدة"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


async def _help(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = (
        "*الأوامر المتاحة:*\n\n"
        "/start — بدء المحادثة\n"
        "/agent `<مهمة>` — تشغيل وكيل مانوس المستقل\n"
        "/help — عرض هذه الرسالة"
    )
    await update.message.reply_text(text, parse_mode="Markdown")


async def _agent_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not context.args:
        await update.message.reply_text("❌ يرجى ذكر المهمة بعد /agent\nمثال: `/agent حلّل سوق التطبيقات الذكية`", parse_mode="Markdown")
        return

    task = " ".join(context.args)
    status_msg = await update.message.reply_text("⏳ *جاري تشغيل الوكيل...* يرجى الانتظار.", parse_mode="Markdown")

    _STATUS_LABELS = {
        "planning": "📋 جاري التخطيط...",
        "executing": "⚙️ جاري التنفيذ...",
        "reflecting": "🔍 جاري مراجعة النتائج...",
        "completed": "✅ اكتملت المهمة!",
        "failed": "❌ فشل التنفيذ",
    }

    async def on_update(state: ManusTaskState) -> None:
        label = _STATUS_LABELS.get(state.status, "...")
        if state.status == "executing" and state.steps:
            done = sum(1 for s in state.steps if s.status in ("completed", "failed"))
            label = f"⚙️ تنفيذ الخطوة {state.current_step_index + 1}/{len(state.steps)}"
        try:
            await status_msg.edit_text(label, parse_mode="Markdown")
        except Exception:
            pass

    try:
        state = await run_manus_agent(task, on_update)

        if state.status == "failed":
            await status_msg.edit_text(f"❌ *فشل التنفيذ:*\n{state.error}", parse_mode="Markdown")
            return

        # Telegram max message length is 4096 chars
        result = state.final_result or ""
        reflection = state.reflection_note or ""

        reply = f"✅ *اكتملت المهمة*\n\n{result}"
        if reflection:
            reply += f"\n\n📊 *التقييم:* {reflection}"

        # Split if too long
        if len(reply) > 4000:
            chunks = [reply[i:i+4000] for i in range(0, len(reply), 4000)]
            await status_msg.edit_text(chunks[0], parse_mode="Markdown")
            for chunk in chunks[1:]:
                await update.message.reply_text(chunk, parse_mode="Markdown")
        else:
            await status_msg.edit_text(reply, parse_mode="Markdown")

    except Exception as exc:
        logger.exception("Telegram agent error: %s", exc)
        await status_msg.edit_text(f"❌ حدث خطأ غير متوقع: {exc}")


async def _handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Plain text → AI chat reply."""
    user_text = update.message.text or ""
    if not user_text:
        return

    try:
        llm = get_llm(temperature=0.7)
        messages = [
            SystemMessage(content="أنت السكرتير الذكي، مساعد شخصي يتحدث العربية. كن مفيداً وموجزاً."),
            HumanMessage(content=user_text),
        ]
        response = await llm.ainvoke(messages)
        await update.message.reply_text(str(response.content))
    except Exception as exc:
        logger.exception("Telegram chat error: %s", exc)
        await update.message.reply_text(f"❌ حدث خطأ: {exc}")


# ── Lifecycle ─────────────────────────────────────────────────────────────────

async def setup(webhook_url: str | None = None) -> None:
    """Build and start the Telegram bot application."""
    global _app
    if not settings.TELEGRAM_TOKEN:
        logger.info("No TELEGRAM_TOKEN — bot disabled.")
        return

    _app = ApplicationBuilder().token(settings.TELEGRAM_TOKEN).build()
    _app.add_handler(CommandHandler("start", _start))
    _app.add_handler(CommandHandler("help", _help))
    _app.add_handler(CommandHandler("agent", _agent_command))
    _app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, _handle_message))

    await _app.initialize()

    if webhook_url:
        url = f"{webhook_url}/api/webhook/telegram"
        await _app.bot.set_webhook(url=url)
        logger.info("Telegram webhook set → %s", url)
    else:
        await _app.start()
        await _app.updater.start_polling()
        logger.info("Telegram bot polling started.")


async def handle_update(body: dict) -> None:
    """Process a single webhook update (called by the /webhook/telegram route)."""
    if _app is None:
        return
    update = Update.de_json(body, _app.bot)
    await _app.process_update(update)
