"""Webhook routes for Telegram, WhatsApp, and Discord."""

from fastapi import APIRouter, BackgroundTasks, Form, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from app.bots import telegram as tg_bot, whatsapp as wa_bot
from app.bots import discord as dc_bot

router = APIRouter(prefix="/webhook", tags=["webhooks"])


# ── WhatsApp ──────────────────────────────────────────────────────────────────

@router.get("/whatsapp")
async def verify_whatsapp(request: Request) -> Response:
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
    body = await request.json()
    await wa_bot.handle_incoming(body)
    return {"status": "ok"}


# ── Twilio WhatsApp ───────────────────────────────────────────────────────────

@router.post("/twilio")
async def twilio_incoming(request: Request) -> Response:
    """Receive Twilio WhatsApp sandbox webhook (application/x-www-form-urlencoded)."""
    form = await request.form()
    await wa_bot.handle_twilio_incoming(dict(form))
    # Twilio expects an empty TwiML response
    return Response(content="<Response/>", media_type="application/xml")


# ── Telegram ──────────────────────────────────────────────────────────────────

@router.post("/telegram")
async def telegram_incoming(request: Request, background_tasks: BackgroundTasks) -> Response:
    """
    Receive Telegram webhook update.
    Returns a Bot API method inline (Telegram executes it server-side).
    """
    body = await request.json()
    result = await tg_bot.handle_update(body, background_tasks)
    if result:
        return JSONResponse(content=result)
    return JSONResponse(content={"status": "ok"})


# ── Discord ───────────────────────────────────────────────────────────────────

@router.post("/discord")
async def discord_incoming(request: Request) -> Response:
    """
    Receive Discord Interactions webhook.

    Discord requires:
    1. Ed25519 signature verification (X-Signature-Ed25519 + X-Signature-Timestamp)
    2. Respond to PING with PONG within 3 seconds
    3. Respond to APPLICATION_COMMAND with a valid response
    """
    signature = request.headers.get("X-Signature-Ed25519", "")
    timestamp = request.headers.get("X-Signature-Timestamp", "")
    body_bytes = await request.body()

    if not dc_bot.verify_signature(body_bytes, signature, timestamp):
        raise HTTPException(status_code=401, detail="Invalid Discord signature")

    body = await request.json()
    result = await dc_bot.handle_interaction(body)
    return JSONResponse(content=result)
