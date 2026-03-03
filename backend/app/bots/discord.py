"""
Discord Bot — Interactions webhook handler (OpenClaw-style messaging integration).

Uses Discord's Interactions API (webhook-based), no persistent gateway connection needed.
Verifies Ed25519 signatures as required by Discord.

Supported slash commands:
  /chat <message>   — Chat with the AI secretary
  /agent <task>     — Run the Manus autonomous agent
  /help             — Show available commands
"""

import hashlib
import hmac
import json
import logging

import httpx
from langchain.schema import HumanMessage, SystemMessage

from app.config import settings
from app.llm import get_llm
from app.agents.manus_agent import run_manus_agent

logger = logging.getLogger(__name__)

# Discord Interaction types
INTERACTION_PING = 1
INTERACTION_APPLICATION_COMMAND = 2

# Discord Interaction response types
RESPONSE_PONG = 1
RESPONSE_CHANNEL_MESSAGE = 4
RESPONSE_DEFERRED_CHANNEL_MESSAGE = 5

_SYSTEM_PROMPT = (
    "أنت السكرتير الذكي، مساعد شخصي ذكي يتحدث العربية. "
    "كن موجزاً ومفيداً. تحدث بأسلوب مناسب للدردشة عبر Discord."
)


def verify_signature(body: bytes, signature: str, timestamp: str) -> bool:
    """
    Verify Discord Ed25519 webhook signature.
    Returns True if valid, False otherwise.
    """
    public_key = settings.DISCORD_PUBLIC_KEY
    if not public_key:
        logger.warning("DISCORD_PUBLIC_KEY not set — skipping signature verification.")
        return True

    try:
        from nacl.signing import VerifyKey
        from nacl.exceptions import BadSignatureError

        verify_key = VerifyKey(bytes.fromhex(public_key))
        message = (timestamp + body.decode("utf-8")).encode()
        verify_key.verify(message, bytes.fromhex(signature))
        return True
    except ImportError:
        logger.error("PyNaCl not installed. Run: pip install PyNaCl")
        return False
    except Exception:
        return False


async def handle_interaction(body: dict) -> dict:
    """
    Process a Discord interaction and return the response payload.
    """
    interaction_type = body.get("type")

    # PING — Discord health check
    if interaction_type == INTERACTION_PING:
        return {"type": RESPONSE_PONG}

    # Slash commands
    if interaction_type == INTERACTION_APPLICATION_COMMAND:
        return await _handle_command(body)

    return {"type": RESPONSE_CHANNEL_MESSAGE, "data": {"content": "نوع تفاعل غير معروف."}}


async def _handle_command(body: dict) -> dict:
    """Route slash commands to their handlers."""
    data = body.get("data", {})
    command_name = data.get("name", "")
    options = {opt["name"]: opt.get("value", "") for opt in data.get("options", [])}

    if command_name == "help":
        return _help_response()
    elif command_name == "chat":
        message = options.get("message", "")
        return await _chat_response(message)
    elif command_name == "agent":
        task = options.get("task", "")
        return _deferred_agent_response(body, task)
    else:
        return {
            "type": RESPONSE_CHANNEL_MESSAGE,
            "data": {"content": f"أمر غير معروف: `/{command_name}`"},
        }


def _help_response() -> dict:
    content = (
        "**السكرتير الذكي — الأوامر المتاحة:**\n\n"
        "`/chat <رسالة>` — تحدث مع المساعد الذكي\n"
        "`/agent <مهمة>` — شغّل وكيل مانوس للمهام المعقدة\n"
        "`/help` — عرض هذه الرسالة\n\n"
        "*مدعوم بتقنية OpenClaw-style AI assistant*"
    )
    return {"type": RESPONSE_CHANNEL_MESSAGE, "data": {"content": content}}


async def _chat_response(message: str) -> dict:
    if not message.strip():
        return {"type": RESPONSE_CHANNEL_MESSAGE, "data": {"content": "يرجى كتابة رسالة."}}
    try:
        llm = get_llm(temperature=0.7)
        messages = [SystemMessage(content=_SYSTEM_PROMPT), HumanMessage(content=message)]
        response = await llm.ainvoke(messages)
        reply = str(response.content)[:2000]
        return {"type": RESPONSE_CHANNEL_MESSAGE, "data": {"content": reply}}
    except Exception as exc:
        logger.exception("Discord chat error: %s", exc)
        return {"type": RESPONSE_CHANNEL_MESSAGE, "data": {"content": f"حدث خطأ: {exc}"}}


def _deferred_agent_response(body: dict, task: str) -> dict:
    """
    Return a deferred response for /agent command (agent runs in background).
    The actual result is sent via follow-up webhook.
    """
    if not task.strip():
        return {"type": RESPONSE_CHANNEL_MESSAGE, "data": {"content": "يرجى تحديد المهمة."}}

    # Schedule background agent execution
    import asyncio
    token = body.get("token", "")
    application_id = body.get("application_id", settings.DISCORD_APPLICATION_ID or "")
    asyncio.create_task(_run_agent_and_followup(task, token, application_id))

    return {
        "type": RESPONSE_DEFERRED_CHANNEL_MESSAGE,
        "data": {"content": "⏳ جاري تشغيل الوكيل المستقل..."},
    }


async def _run_agent_and_followup(task: str, interaction_token: str, application_id: str) -> None:
    """Run the Manus agent and send the result as a Discord follow-up message."""
    try:
        state = await run_manus_agent(task, None)
        result = state.final_result or "لم أتمكن من إتمام المهمة."
        if state.reflection_note:
            result += f"\n\n📊 {state.reflection_note}"
        content = f"✅ **اكتملت المهمة:**\n\n{result}"[:2000]
    except Exception as exc:
        logger.exception("Discord agent error: %s", exc)
        content = f"❌ حدث خطأ أثناء تشغيل الوكيل: {exc}"

    await _send_followup(interaction_token, application_id, content)


async def _send_followup(token: str, application_id: str, content: str) -> None:
    """Send a Discord follow-up message to an interaction."""
    if not token or not application_id:
        return
    url = f"https://discord.com/api/v10/webhooks/{application_id}/{token}"
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            await client.post(url, json={"content": content})
        except Exception as exc:
            logger.exception("Discord follow-up failed: %s", exc)


async def register_commands() -> None:
    """
    Register slash commands with Discord API.
    Call this once during startup if DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID are set.
    """
    if not settings.DISCORD_BOT_TOKEN or not settings.DISCORD_APPLICATION_ID:
        logger.info("Discord credentials not set — skipping command registration.")
        return

    commands = [
        {
            "name": "help",
            "description": "عرض المساعدة والأوامر المتاحة",
        },
        {
            "name": "chat",
            "description": "تحدث مع السكرتير الذكي",
            "options": [
                {
                    "name": "message",
                    "description": "رسالتك للمساعد",
                    "type": 3,  # STRING
                    "required": True,
                }
            ],
        },
        {
            "name": "agent",
            "description": "شغّل وكيل مانوس لتنفيذ مهمة معقدة",
            "options": [
                {
                    "name": "task",
                    "description": "وصف المهمة المطلوبة",
                    "type": 3,  # STRING
                    "required": True,
                }
            ],
        },
    ]

    url = (
        f"https://discord.com/api/v10/applications/{settings.DISCORD_APPLICATION_ID}/commands"
    )
    async with httpx.AsyncClient(timeout=30) as client:
        for cmd in commands:
            try:
                r = await client.post(
                    url,
                    headers={
                        "Authorization": f"Bot {settings.DISCORD_BOT_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    json=cmd,
                )
                if r.status_code in (200, 201):
                    logger.info("Discord command registered: /%s", cmd["name"])
                else:
                    logger.error("Failed to register /%s: %s", cmd["name"], r.text)
            except Exception as exc:
                logger.exception("Error registering Discord command /%s: %s", cmd["name"], exc)

    logger.info("Discord bot ready (application_id=%s).", settings.DISCORD_APPLICATION_ID)
