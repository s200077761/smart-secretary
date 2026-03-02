"""Webhook routes for Telegram and WhatsApp."""

from fastapi import APIRouter, Request, Response, HTTPException
from app.bots import telegram as tg_bot, whatsapp as wa_bot

router = APIRouter(prefix="/webhook", tags=["webhooks"])


# ── WhatsApp ──────────────────────────────────────────────────────────────────

@router.get("/whatsapp")
async def verify_whatsapp(request: Request) -> Response:
    """Meta sends a GET to verify the webhook endpoint."""
    from app.config import settings
    params = dict(request.query_params)
    if (
        params.get("hub.mode") == "subscribe"
        and params.get("hub.verify_token") == settings.WHATSAPP_VERIFY_TOKEN
    ):
        return Response(content=params.get("hub.challenge", ""), media_type="text/plain")
    raise HTTPException(status_code=403, detail="WhatsApp verification failed")


@router.post("/whatsapp")
async def whatsapp_incoming(request: Request) -> dict:
    """Receive and handle incoming WhatsApp messages."""
    body = await request.json()
    await wa_bot.handle_incoming(body)
    return {"status": "ok"}


# ── Telegram ──────────────────────────────────────────────────────────────────

@router.post("/telegram")
async def telegram_incoming(request: Request) -> dict:
    """Receive Telegram webhook updates."""
    body = await request.json()
    await tg_bot.handle_update(body)
    return {"status": "ok"}
