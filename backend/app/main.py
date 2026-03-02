"""
Smart Secretary — FastAPI application entry point.

Startup sequence:
  1. Initialize Firebase Admin SDK
  2. Mount all API routers
  3. Start Telegram bot (polling or webhook)
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import firebase_admin
from firebase_admin import credentials
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.router import router as api_router
from app.bots import telegram as tg_bot

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting Smart Secretary API...")

    # Firebase
    if settings.FIREBASE_CREDENTIALS_PATH and not firebase_admin._apps:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})
        logger.info("Firebase initialized.")

    # Telegram
    webhook_url = settings.SERVER_URL if settings.SERVER_URL else None
    await tg_bot.setup(webhook_url)

    yield  # ── App running ──────────────────────────────────────────────────

    # ── Shutdown ─────────────────────────────────────────────────────────────
    logger.info("Shutting down Smart Secretary API...")


app = FastAPI(
    title="السكرتير الذكي API",
    description=(
        "AI-powered personal assistant API. "
        "Supports Arabic/English chat, autonomous agents, Telegram & WhatsApp."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins in dev; restrict in production via env
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/", tags=["health"])
async def root() -> dict:
    return {"app": "السكرتير الذكي", "version": "2.0.0", "status": "running"}


@app.get("/health", tags=["health"])
async def health() -> dict:
    return {"status": "healthy"}
