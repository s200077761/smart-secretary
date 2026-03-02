"""Shared LLM factory — ZhipuAI (z.ai) via OpenAI-compatible API."""

from langchain_openai import ChatOpenAI
from app.config import settings

ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/"


def get_llm(temperature: float = 0.7) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.ZHIPU_MODEL,
        api_key=settings.ZHIPU_API_KEY,
        base_url=ZHIPU_BASE_URL,
        temperature=temperature,
        max_tokens=4096,
    )
