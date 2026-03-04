"""Phone authentication via Twilio Verify (OTP)."""

import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException

from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


def _client() -> tuple[Client, str]:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(status_code=503, detail="Twilio credentials not configured")
    if not settings.TWILIO_VERIFY_SERVICE_SID:
        raise HTTPException(status_code=503, detail="Twilio Verify Service SID not configured")
    return Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN), settings.TWILIO_VERIFY_SERVICE_SID


class SendOTPRequest(BaseModel):
    phone: str          # E.164 format, e.g. +966510275782
    channel: str = "sms"   # sms | whatsapp | call


class VerifyOTPRequest(BaseModel):
    phone: str
    code: str


@router.post("/send-otp")
async def send_otp(req: SendOTPRequest) -> dict:
    """Send a verification code to the given phone number."""
    client, service_sid = _client()

    def _send():
        return client.verify.v2.services(service_sid).verifications.create(
            to=req.phone,
            channel=req.channel,
        )

    try:
        verification = await asyncio.to_thread(_send)
    except TwilioRestException as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"status": verification.status, "sid": verification.sid, "phone": req.phone}


@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest) -> dict:
    """Check the OTP code entered by the user."""
    client, service_sid = _client()

    def _check():
        return client.verify.v2.services(service_sid).verification_checks.create(
            to=req.phone,
            code=req.code,
        )

    try:
        check = await asyncio.to_thread(_check)
    except TwilioRestException as e:
        raise HTTPException(status_code=400, detail=str(e))

    if check.status != "approved":
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    return {"verified": True, "phone": req.phone}
