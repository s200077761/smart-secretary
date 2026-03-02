"""
WhatsApp bot — Meta Business API webhook handler.

Also supports Twilio sandbox as a fallback.
"""

import logging
import httpx

from langchain.schema import HumanMessage, SystemMessage

from app.llm import get_llm
from app.agents.manus_agent import run_manus_agent, ManusTaskState

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = (
    "أنت السكرتير الذكي، مساعد شخصي يتحدث العربية. "
    "كن موجزاً في إجاباتك لأنك تتحدث عبر واتساب. "
    "استخدم إيموجي مناسبة لتوضيح الرسائل."
)

AGENT_TRIGGER = "/agent "  # Users can type /agent <task> in WhatsApp


async def _ai_reply(text: str) -> str:
    llm = get_llm(temperature=0.7)
    messages = [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=text)]
    response = await llm.ainvoke(messages)
    return str(response.content)


async def _send_meta(to: str, message: str) -> None:
    """Send a message via Meta WhatsApp Business API."""
    if not settings.WHATSAPP_TOKEN or not settings.WHATSAPP_PHONE_NUMBER_ID:
        logger.warning("WhatsApp credentials not configured.")
        return

    url = (
        f"https://graph.facebook.com/v21.0"
        f"/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    )
    # Split long messages (WhatsApp limit ~4096 chars)
    chunks = [message[i:i+4000] for i in range(0, len(message), 4000)]

    async with httpx.AsyncClient(timeout=30) as client:
        for chunk in chunks:
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


async def _send_twilio(to: str, message: str) -> None:
    """Send a message via Twilio WhatsApp sandbox."""
    if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_WHATSAPP_NUMBER):
        return
    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    async with httpx.AsyncClient(timeout=30) as client:
        await client.post(
            url,
            auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
            data={
                "From": f"whatsapp:{settings.TWILIO_WHATSAPP_NUMBER}",
                "To": f"whatsapp:{to}",
                "Body": message,
            },
        )


async def _send(to: str, message: str) -> None:
    """Try Meta API first, fall back to Twilio."""
    try:
        await _send_meta(to, message)
    except Exception as exc:
        logger.warning("Meta API failed (%s), trying Twilio...", exc)
        await _send_twilio(to, message)


async def handle_incoming(body: dict) -> None:
    """Parse and respond to a WhatsApp webhook event."""
    try:
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        if not messages:
            return

        msg = messages[0]
        from_number: str = msg.get("from", "")
        text: str = msg.get("text", {}).get("body", "").strip()

        if not text:
            return

        # /agent command
        if text.lower().startswith(AGENT_TRIGGER):
            task = text[len(AGENT_TRIGGER):]
            await _send(from_number, "⏳ جاري تشغيل الوكيل المستقل، يرجى الانتظار...")

            parts: list[str] = []

            async def on_update(state: ManusTaskState) -> None:
                pass  # silent, send only at completion

            state = await run_manus_agent(task, on_update)
            reply = state.final_result or state.error or "❌ لم تكتمل المهمة"
            if state.reflection_note:
                reply += f"\n\n📊 {state.reflection_note}"
            await _send(from_number, reply)
        else:
            reply = await _ai_reply(text)
            await _send(from_number, reply)

    except Exception as exc:
        logger.exception("WhatsApp handler error: %s", exc)
