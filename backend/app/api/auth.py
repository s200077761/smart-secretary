"""Phone authentication via Twilio Verify (OTP)."""

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

_VERIFY_BASE = "https://verify.twilio.com/v2/Services"


def _twilio_auth() -> tuple[str, str]:
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        raise HTTPException(status_code=503, detail="Twilio credentials not configured")
    if not settings.TWILIO_VERIFY_SERVICE_SID:
        raise HTTPException(status_code=503, detail="Twilio Verify Service SID not configured")
    return settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN


class SendOTPRequest(BaseModel):
    phone: str        # E.164 format, e.g. +966510275782
    channel: str = "sms"   # sms | whatsapp | call


class VerifyOTPRequest(BaseModel):
    phone: str
    code: str


@router.post("/send-otp")
async def send_otp(req: SendOTPRequest) -> dict:
    """Send a verification code to the given phone number."""
    sid, token = _twilio_auth()
    url = f"{_VERIFY_BASE}/{settings.TWILIO_VERIFY_SERVICE_SID}/Verifications"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url,
            auth=(sid, token),
            data={"To": req.phone, "Channel": req.channel},
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(status_code=resp.status_code, detail=resp.text)

    data = resp.json()
    return {"status": data.get("status"), "phone": req.phone, "channel": req.channel}


@router.post("/verify-otp")
async def verify_otp(req: VerifyOTPRequest) -> dict:
    """Check the OTP code entered by the user."""
    sid, token = _twilio_auth()
    url = f"{_VERIFY_BASE}/{settings.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            url,
            auth=(sid, token),
            data={"To": req.phone, "Code": req.code},
        )

    data = resp.json()
    verified = data.get("status") == "approved"

    if not verified:
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    return {"verified": True, "phone": req.phone}
