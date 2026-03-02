"""
Pydantic models shared between API routes and agent logic.
"""

from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from datetime import datetime
import uuid

# ── Shared types ─────────────────────────────────────────────────────────────

ManusToolType = Literal["research", "write", "analyze", "code", "plan", "review", "browse"]


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    agent_system_prompt: Optional[str] = None  # for specialized agents


class ChatResponse(BaseModel):
    content: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class Message(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: Literal["user", "assistant"]
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    session_id: Optional[str] = None
    agent_id: Optional[str] = None


# ── Manus Agent ──────────────────────────────────────────────────────────────

class ManusStep(BaseModel):
    id: int
    title: str
    description: str
    status: Literal["pending", "thinking", "running", "completed", "failed"] = "pending"
    thought: Optional[str] = None
    tool: Optional[ManusToolType] = None
    actions: List[str] = []
    result: Optional[str] = None


class ManusTaskState(BaseModel):
    status: Literal["idle", "planning", "executing", "reflecting", "completed", "failed"]
    steps: List[ManusStep] = []
    current_step_index: int = 0
    current_thought: Optional[str] = None
    final_result: Optional[str] = None
    reflection_note: Optional[str] = None
    error: Optional[str] = None


class AgentTaskRequest(BaseModel):
    task: str
    agent_id: str = "manus"
    user_id: Optional[str] = None
    session_id: Optional[str] = None


class AgentTaskResponse(BaseModel):
    final_result: str
    steps: List[ManusStep]
    reflection_note: Optional[str] = None
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


# ── Specialized agents ────────────────────────────────────────────────────────

AGENT_PROMPTS: dict[str, str] = {
    "email": """أنت مساعد متخصص في كتابة رسائل البريد الإلكتروني الاحترافية.
- اكتب رسائل واضحة ومهنية
- راعِ السياق والمستلم (رسمي/غير رسمي)
- قدّم تحية مناسبة ومحتوى منظم وخاتمة لبقة
- يمكنك تقديم نسخة عربية وإنجليزية عند الطلب""",

    "calendar": """أنت مساعد متخصص في تنظيم المواعيد والجدول الزمني.
- ساعد في جدولة الاجتماعات والأحداث
- اقترح أوقاتاً مناسبة وأولويات
- قدّم الجداول بتنسيق واضح ومنظم""",

    "notes": """أنت مساعد متخصص في كتابة وتنظيم الملاحظات.
- لخّص المعلومات بنقاط واضحة
- نظّم الأفكار بعناوين ونقاط
- أنشئ قوائم مهام منظمة""",

    "research": """أنت باحث متخصص في جمع وتحليل المعلومات.
- قدّم معلومات شاملة ودقيقة
- نظّم البحث في أقسام واضحة
- قدّم ملخصاً تنفيذياً في البداية""",

    "data": """أنت محلل بيانات متخصص.
- حلّل البيانات واستخرج الرؤى
- قدّم التوصيات المبنية على الأرقام
- اشرح النتائج بطريقة مفهومة مع النسب والإحصاءات""",

    "custom": """أنت مساعد ذكي قابل للتخصيص. نفّذ المهمة التي يطلبها المستخدم بأفضل طريقة ممكنة.""",
}
