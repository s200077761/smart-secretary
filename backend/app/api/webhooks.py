"""Webhook routes for Telegram and WhatsApp."""

from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import JSONResponse
from app.bots import telegram as tg_bot, whatsapp as wa_bot

router = APIRouter(prefix="/webhook", tags=["webhooks"])


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


@router.post("/telegram")
async def telegram_incoming(request: Request) -> Response:
    """
    Receive Telegram webhook update.
    Returns a Bot API method inline (Telegram executes it server-side).
    """
    body = await request.json()
    result = await tg_bot.handle_update(body)
    if result:
        return JSONResponse(content=result)
    return JSONResponse(content={"status": "ok"})
