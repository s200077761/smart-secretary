"""Shared LLM factory — HuggingFace Inference API (OpenAI-compatible)."""

from langchain_openai import ChatOpenAI
from app.config import settings

HF_BASE_URL = "https://router.huggingface.co/v1/"


def get_llm(temperature: float = 0.7) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.HF_MODEL,
        api_key=settings.HF_TOKEN,
        base_url=HF_BASE_URL,
        temperature=temperature,
        max_tokens=2048,
    )


def get_vision_llm(temperature: float = 0.3) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.VISION_MODEL,
        api_key=settings.HF_TOKEN,
        base_url=HF_BASE_URL,
        temperature=temperature,
        max_tokens=1024,
    )
