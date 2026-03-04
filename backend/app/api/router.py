"""Main API router — aggregates all sub-routers."""

from fastapi import APIRouter
from app.api import chat, agents, skills, auth
from app.api import webhooks

router = APIRouter()
router.include_router(chat.router)
router.include_router(agents.router)
router.include_router(webhooks.router)
router.include_router(skills.router)
router.include_router(auth.router)
