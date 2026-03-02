"""
Manus Agent — Python/LangChain implementation.

Pipeline: Plan → (Think → Execute) × N → Reflect → Synthesize
"""

import json
import re
from typing import Callable, Awaitable

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage

from app.config import settings
from app.models.schemas import ManusStep, ManusTaskState, ManusToolType

StateUpdater = Callable[[ManusTaskState], Awaitable[None] | None]

# ── Tool detection ────────────────────────────────────────────────────────────

def _detect_tool(title: str, description: str) -> ManusToolType:
    text = f"{title} {description}".lower()
    if any(k in text for k in ["بحث", "search", "جمع معلومات", "معلومات"]):
        return "research"
    if any(k in text for k in ["كود", "برمج", "code", "script", "خوارزمية"]):
        return "code"
    if any(k in text for k in ["تحليل", "بيانات", "analyze", "data", "إحصاء"]):
        return "analyze"
    if any(k in text for k in ["اكتب", "كتابة", "تقرير", "وثيقة", "مقال"]):
        return "write"
    if any(k in text for k in ["تصفح", "موقع", "browse", "web", "url"]):
        return "browse"
    if any(k in text for k in ["مراجعة", "تحقق", "review", "check", "قيّم"]):
        return "review"
    return "plan"


# ── LLM factory ──────────────────────────────────────────────────────────────

def _make_llm(temperature: float = 0.4) -> ChatGoogleGenerativeAI:
    return ChatGoogleGenerativeAI(
        model=settings.GEMINI_MODEL,
        google_api_key=settings.GEMINI_API_KEY,
        temperature=temperature,
        max_output_tokens=4096,
    )


async def _call(system: str, human: str, temperature: float = 0.4) -> str:
    llm = _make_llm(temperature)
    messages = [SystemMessage(content=system), HumanMessage(content=human)]
    response = await llm.ainvoke(messages)
    return str(response.content)


# ── Phase 1: Planning ─────────────────────────────────────────────────────────

_PLANNER_SYSTEM = """أنت وكيل ذكاء اصطناعي مستقل متخصص في تخطيط المهام المعقدة.
قسّم المهمة إلى 3-6 خطوات واضحة قابلة للتنفيذ.
أجب فقط بكائن JSON صالح بدون أي نص إضافي:
{
  "steps": [
    {"id": 1, "title": "عنوان الخطوة", "description": "وصف تفصيلي لما يجب فعله"},
    ...
  ]
}"""


async def _plan(task: str) -> list[ManusStep]:
    raw = await _call(_PLANNER_SYSTEM, f"المهمة: {task}", 0.3)
    match = re.search(r"\{[\s\S]*\}", raw)
    if not match:
        raise ValueError("فشل في تحليل خطة المهمة")
    data = json.loads(match.group())
    return [
        ManusStep(
            id=s["id"],
            title=s["title"],
            description=s["description"],
            tool=_detect_tool(s["title"], s["description"]),
        )
        for s in data["steps"]
    ]


# ── Phase 2a: Think ───────────────────────────────────────────────────────────

_THINKER_SYSTEM = """أنت وكيل ذكاء اصطناعي تفكر بصوت عالٍ قبل تنفيذ كل خطوة.
اكتب تفكيرك الداخلي: ماذا ستفعل؟ ما التحديات المحتملة؟ كيف ستتعامل معها؟
أجب بفقرة واحدة مختصرة بالعربية (2-4 جمل فقط)."""


async def _think(task: str, step: ManusStep, previous: list[dict]) -> str:
    ctx = "\n".join(f"- {r['title']}" for r in previous) if previous else "لا يوجد سياق سابق"
    human = (
        f"المهمة الكلية: {task}\n"
        f"الخطوة المطلوبة: {step.title} — {step.description}\n"
        f"تم إنجازه حتى الآن:\n{ctx}\n\n"
        f"تفكيري قبل التنفيذ:"
    )
    return await _call(_THINKER_SYSTEM, human, 0.6)


# ── Phase 2b: Execute ─────────────────────────────────────────────────────────

_EXECUTOR_SYSTEM = """أنت وكيل ذكاء اصطناعي مستقل ينفذ الخطوات بدقة.
أجب فقط بكائن JSON صالح:
{
  "actions": ["الإجراء الأول", "الإجراء الثاني", "..."],
  "result": "النتيجة الكاملة التفصيلية هنا"
}"""


async def _execute(
    task: str,
    step: ManusStep,
    thought: str,
    previous: list[dict],
) -> dict:
    ctx = (
        "\n".join(f"- {r['title']}: {r['result'][:200]}..." for r in previous)
        if previous
        else "لا يوجد سياق سابق"
    )
    human = (
        f"المهمة الرئيسية: {task}\n\n"
        f"الخطوة الحالية ({step.id}): {step.title}\n"
        f"الوصف: {step.description}\n"
        f"تفكيري المسبق: {thought}\n\n"
        f"نتائج الخطوات السابقة:\n{ctx}\n\n"
        f"نفّذ هذه الخطوة الآن:"
    )
    raw = await _call(_EXECUTOR_SYSTEM, human, 0.4)

    match = re.search(r"\{[\s\S]*\}", raw)
    if match:
        try:
            data = json.loads(match.group())
            return {
                "actions": data.get("actions", []),
                "result": data.get("result", raw),
            }
        except json.JSONDecodeError:
            pass
    return {"actions": [], "result": raw}


# ── Phase 3: Reflect ──────────────────────────────────────────────────────────

_REFLECTOR_SYSTEM = """أنت وكيل ذكاء اصطناعي يقيّم جودة العمل المنجز.
بعد مراجعة الخطوات المنفذة، قدّم تقييماً مختصراً (2-3 جمل):
- هل تحقق الهدف الرئيسي؟
- ما أبرز النتائج؟
- أي ملاحظات للتحسين؟
أجب بالعربية مباشرة."""


async def _reflect(task: str, steps: list[ManusStep]) -> str:
    summary = "\n".join(
        f"{s.title}: {(s.result or '')[:200]}"
        for s in steps
        if s.status == "completed"
    )
    human = f"المهمة الأصلية: {task}\n\nما تم إنجازه:\n{summary}\n\nتقييمي:"
    return await _call(_REFLECTOR_SYSTEM, human, 0.5)


# ── Phase 4: Synthesize ───────────────────────────────────────────────────────

_SYNTHESIZER_SYSTEM = """أنت وكيل ذكاء اصطناعي متخصص في تجميع النتائج.
قدّم إجابة نهائية شاملة ومنظمة بالعربية، مع عناوين ونقاط وتنسيق واضح."""


async def _synthesize(task: str, steps: list[ManusStep]) -> str:
    parts = "\n\n".join(
        f"**{s.title}**\n{s.result}"
        for s in steps
        if s.status == "completed"
    )
    human = f"المهمة الأصلية: {task}\n\nنتائج الخطوات:\n\n{parts}\n\nالملخص النهائي الشامل:"
    return await _call(_SYNTHESIZER_SYSTEM, human, 0.4)


# ── Public API ────────────────────────────────────────────────────────────────

async def run_manus_agent(
    task: str,
    on_update: StateUpdater,
) -> ManusTaskState:
    """
    Run the full Manus-style autonomous agent pipeline.

    Plan → (Think → Execute) × N → Reflect → Synthesize

    Args:
        task: High-level goal from the user.
        on_update: Async or sync callback called after every state change.

    Returns:
        Final ManusTaskState.
    """

    async def _emit(state: ManusTaskState) -> None:
        result = on_update(state)
        if hasattr(result, "__await__"):
            await result  # type: ignore[union-attr]

    state = ManusTaskState(status="planning", steps=[], current_step_index=0)
    await _emit(state)

    try:
        # ── Planning ──────────────────────────────────────────────────────────
        steps = await _plan(task)
        state = state.model_copy(
            update={"steps": steps, "status": "executing", "current_step_index": 0}
        )
        await _emit(state)

        updated_steps = list(steps)
        previous_results: list[dict] = []

        for i in range(len(updated_steps)):
            # Think ────────────────────────────────────────────────────────────
            updated_steps[i] = updated_steps[i].model_copy(
                update={"status": "thinking"}
            )
            state = state.model_copy(
                update={
                    "steps": list(updated_steps),
                    "current_step_index": i,
                    "current_thought": "جاري التفكير في الخطوة...",
                }
            )
            await _emit(state)

            try:
                thought = await _think(task, updated_steps[i], previous_results)
            except Exception:
                thought = "سأبدأ تنفيذ هذه الخطوة مباشرةً."

            updated_steps[i] = updated_steps[i].model_copy(
                update={"thought": thought}
            )
            state = state.model_copy(
                update={"steps": list(updated_steps), "current_thought": thought}
            )
            await _emit(state)

            # Execute ──────────────────────────────────────────────────────────
            updated_steps[i] = updated_steps[i].model_copy(
                update={"status": "running"}
            )
            state = state.model_copy(
                update={"steps": list(updated_steps), "current_thought": None}
            )
            await _emit(state)

            try:
                result_data = await _execute(
                    task, updated_steps[i], thought, previous_results
                )
                updated_steps[i] = updated_steps[i].model_copy(
                    update={
                        "status": "completed",
                        "result": result_data["result"],
                        "actions": result_data["actions"],
                    }
                )
                previous_results.append(
                    {"title": updated_steps[i].title, "result": result_data["result"]}
                )
            except Exception as exc:
                err_msg = str(exc)
                updated_steps[i] = updated_steps[i].model_copy(
                    update={
                        "status": "failed",
                        "result": err_msg,
                        "actions": ["فشل تنفيذ الخطوة"],
                    }
                )
                previous_results.append(
                    {"title": updated_steps[i].title, "result": f"فشل: {err_msg}"}
                )

            state = state.model_copy(update={"steps": list(updated_steps)})
            await _emit(state)

        # ── Reflection ────────────────────────────────────────────────────────
        state = state.model_copy(update={"status": "reflecting"})
        await _emit(state)

        try:
            reflection = await _reflect(task, updated_steps)
        except Exception:
            reflection = "تم إنجاز جميع الخطوات بنجاح."

        # ── Synthesis ─────────────────────────────────────────────────────────
        final = await _synthesize(task, updated_steps)

        state = state.model_copy(
            update={
                "status": "completed",
                "final_result": final,
                "reflection_note": reflection,
                "steps": updated_steps,
            }
        )
        await _emit(state)
        return state

    except Exception as exc:
        err_msg = str(exc)
        state = state.model_copy(update={"status": "failed", "error": err_msg})
        await _emit(state)
        return state
