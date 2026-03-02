"""Main API router — aggregates all sub-routers."""

from fastapi import APIRouter
from app.api import chat, agents
from app.api import webhooks

router = APIRouter()
router.include_router(chat.router)
router.include_router(agents.router)
router.include_router(webhooks.router)
