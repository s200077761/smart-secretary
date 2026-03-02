/**
 * Manus Agent - Autonomous multi-step task execution
 *
 * Inspired by Manus AI, this agent:
 * 1. Receives a high-level task from the user
 * 2. Plans it into concrete sub-steps using LLM
 * 3. For each step: thinks → selects a tool → executes → records actions
 * 4. Reflects on the overall result quality
 * 5. Synthesises a final comprehensive answer
 */

import { ManusStep, ManusTaskState, ManusToolType } from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

type StateUpdater = (state: ManusTaskState) => void;

// ---------------------------------------------------------------------------
// Low-level Gemini call
// ---------------------------------------------------------------------------
async function callGemini(systemPrompt: string, userMessage: string, temperature = 0.4): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("مفتاح Gemini API غير متوفر.");
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature, maxOutputTokens: 4096 },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Gemini API request failed");
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ---------------------------------------------------------------------------
// Tool keyword mapping
// ---------------------------------------------------------------------------
function detectTool(title: string, description: string): ManusToolType {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes("بحث") || text.includes("search") || text.includes("جمع معلومات")) return "research";
  if (text.includes("كود") || text.includes("برمج") || text.includes("code") || text.includes("script")) return "code";
  if (text.includes("تحليل") || text.includes("بيانات") || text.includes("analyz") || text.includes("data")) return "analyze";
  if (text.includes("اكتب") || text.includes("كتابة") || text.includes("وثيقة") || text.includes("تقرير")) return "write";
  if (text.includes("تصفح") || text.includes("موقع") || text.includes("browse") || text.includes("web")) return "browse";
  if (text.includes("مراجعة") || text.includes("تحقق") || text.includes("review") || text.includes("check")) return "review";
  return "plan";
}

// ---------------------------------------------------------------------------
// Phase 1: Planning
// ---------------------------------------------------------------------------
const PLANNER_PROMPT = `أنت وكيل ذكاء اصطناعي مستقل متخصص في تخطيط المهام المعقدة على غرار Manus AI.
مهمتك: تحليل الطلب وإنشاء خطة تفصيلية.

القواعد:
- قسّم المهمة إلى 3-6 خطوات قابلة للتنفيذ والقياس
- كل خطوة يجب أن تكون واضحة ومستقلة
- أجب فقط بكائن JSON صالح بالشكل التالي بدون أي نص إضافي:
{
  "steps": [
    { "id": 1, "title": "عنوان الخطوة", "description": "وصف تفصيلي لما يجب فعله في هذه الخطوة" },
    ...
  ]
}`;

async function planTask(userTask: string): Promise<ManusStep[]> {
  const raw = await callGemini(PLANNER_PROMPT, `المهمة: ${userTask}`, 0.3);

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("فشل في تحليل خطة المهمة.");

  const parsed = JSON.parse(jsonMatch[0]) as { steps: { id: number; title: string; description: string }[] };

  return parsed.steps.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    status: "pending" as const,
    tool: detectTool(s.title, s.description),
  }));
}

// ---------------------------------------------------------------------------
// Phase 2a: Think before each step
// ---------------------------------------------------------------------------
const THINKER_PROMPT = `أنت وكيل ذكاء اصطناعي تفكر بصوت عالٍ قبل تنفيذ كل خطوة.
اكتب تفكيرك الداخلي بوضوح: ما الذي تخطط لفعله؟ ما التحديات المحتملة؟ كيف ستتعامل معها؟
أجب بفقرة واحدة مختصرة بالعربية (2-4 جمل فقط).`;

async function thinkBeforeStep(
  userTask: string,
  step: ManusStep,
  previousResults: { title: string; result: string }[],
): Promise<string> {
  const contextStr =
    previousResults.length > 0
      ? `\nما تم إنجازه حتى الآن:\n${previousResults.map((r) => `- ${r.title}`).join("\n")}`
      : "";

  const message = `المهمة الكلية: ${userTask}
الخطوة المطلوبة: ${step.title} - ${step.description}${contextStr}

ما الذي أفكر فيه قبل تنفيذ هذه الخطوة:`;

  return callGemini(THINKER_PROMPT, message, 0.6);
}

// ---------------------------------------------------------------------------
// Phase 2b: Execute a single step with sub-actions
// ---------------------------------------------------------------------------
const EXECUTOR_PROMPT = `أنت وكيل ذكاء اصطناعي مستقل ينفذ المهام بدقة.
ستُعطى مهمة رئيسية، خطوة محددة، وتفكيرك المسبق ونتائج الخطوات السابقة.

قم بتنفيذ الخطوة المطلوبة وأعطِ:
1. قائمة الإجراءات المتخذة (actions) كمصفوفة من 2-4 نقاط
2. النتيجة الكاملة التفصيلية

أجب فقط بكائن JSON بالشكل التالي:
{
  "actions": ["الإجراء الأول", "الإجراء الثاني", "..."],
  "result": "النتيجة التفصيلية الكاملة هنا"
}`;

async function executeStep(
  userTask: string,
  step: ManusStep,
  thought: string,
  previousResults: { title: string; result: string }[],
): Promise<{ result: string; actions: string[] }> {
  const contextStr =
    previousResults.length > 0
      ? `\n\nنتائج الخطوات السابقة:\n${previousResults.map((r) => `- ${r.title}: ${r.result.slice(0, 200)}...`).join("\n")}`
      : "";

  const message = `المهمة الرئيسية: ${userTask}

الخطوة الحالية (${step.id}): ${step.title}
الوصف: ${step.description}
تفكيري المسبق: ${thought}${contextStr}

نفّذ هذه الخطوة الآن:`;

  const raw = await callGemini(EXECUTOR_PROMPT, message, 0.4);

  // Try to extract JSON, fall back to plain text
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { actions: string[]; result: string };
      return {
        result: parsed.result || raw,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    } catch {
      // JSON parse failed, fall through
    }
  }

  return { result: raw, actions: [] };
}

// ---------------------------------------------------------------------------
// Phase 3: Reflect on overall execution quality
// ---------------------------------------------------------------------------
const REFLECTOR_PROMPT = `أنت وكيل ذكاء اصطناعي يراجع ويقيّم جودة العمل المنجز.
بعد مراجعة جميع الخطوات المنفذة، قدّم تقييماً مختصراً (2-3 جمل):
- هل تم تحقيق الهدف الرئيسي؟
- ما أبرز النتائج؟
- أي ملاحظات للتحسين إن وجدت؟
أجب بالعربية بشكل مباشر ومختصر.`;

async function reflect(userTask: string, steps: ManusStep[]): Promise<string> {
  const completedSteps = steps.filter((s) => s.status === "completed");
  const summary = completedSteps
    .map((s) => `${s.title}: ${(s.result ?? "").slice(0, 200)}`)
    .join("\n\n");

  const message = `المهمة الأصلية: ${userTask}

ملخص ما تم إنجازه:
${summary}

تقييمي للعمل المنجز:`;

  return callGemini(REFLECTOR_PROMPT, message, 0.5);
}

// ---------------------------------------------------------------------------
// Phase 4: Synthesise final answer
// ---------------------------------------------------------------------------
const SYNTHESISER_PROMPT = `أنت وكيل ذكاء اصطناعي متخصص في تجميع النتائج وتقديم إجابات شاملة.
بناءً على المهمة الأصلية ونتائج جميع الخطوات، قدّم إجابة نهائية شاملة ومنظمة.
استخدم العناوين والنقاط والتنسيق المناسب. أجب بالعربية.`;

async function synthesise(userTask: string, steps: ManusStep[]): Promise<string> {
  const stepsStr = steps
    .filter((s) => s.status === "completed")
    .map((s) => `**${s.title}**\n${s.result ?? ""}`)
    .join("\n\n");

  const message = `المهمة الأصلية: ${userTask}\n\nنتائج الخطوات:\n\n${stepsStr}\n\nقدّم الملخص النهائي الشامل:`;

  return callGemini(SYNTHESISER_PROMPT, message, 0.4);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the full Manus-style autonomous agent pipeline:
 * Plan → (Think → Execute) × N → Reflect → Synthesise
 *
 * @param userTask   The high-level task from the user.
 * @param onUpdate   Callback invoked after every state change so the UI can react.
 * @returns          The final ManusTaskState when execution completes.
 */
export async function runManusAgent(
  userTask: string,
  onUpdate: StateUpdater,
): Promise<ManusTaskState> {
  let state: ManusTaskState = {
    status: "planning",
    steps: [],
    currentStepIndex: 0,
  };
  onUpdate({ ...state });

  try {
    // -----------------------------------------------------------------------
    // Planning phase
    // -----------------------------------------------------------------------
    const steps = await planTask(userTask);
    state = { ...state, steps, status: "executing", currentStepIndex: 0 };
    onUpdate({ ...state });

    // -----------------------------------------------------------------------
    // Execution phase: think → execute for each step
    // -----------------------------------------------------------------------
    const updatedSteps = [...steps];
    const previousResults: { title: string; result: string }[] = [];

    for (let i = 0; i < updatedSteps.length; i++) {
      // --- Thinking sub-phase ---
      updatedSteps[i] = { ...updatedSteps[i], status: "thinking" };
      state = {
        ...state,
        steps: [...updatedSteps],
        currentStepIndex: i,
        currentThought: "جاري التفكير في الخطوة...",
      };
      onUpdate({ ...state });

      let thought = "";
      try {
        thought = await thinkBeforeStep(userTask, updatedSteps[i], previousResults);
        updatedSteps[i] = { ...updatedSteps[i], thought };
        state = { ...state, steps: [...updatedSteps], currentThought: thought };
        onUpdate({ ...state });
      } catch {
        thought = "سأبدأ تنفيذ هذه الخطوة مباشرةً.";
        updatedSteps[i] = { ...updatedSteps[i], thought };
      }

      // --- Execution sub-phase ---
      updatedSteps[i] = { ...updatedSteps[i], status: "running" };
      state = { ...state, steps: [...updatedSteps], currentThought: undefined };
      onUpdate({ ...state });

      try {
        const { result, actions } = await executeStep(userTask, updatedSteps[i], thought, previousResults);
        updatedSteps[i] = { ...updatedSteps[i], status: "completed", result, actions };
        previousResults.push({ title: updatedSteps[i].title, result });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "خطأ غير معروف";
        updatedSteps[i] = {
          ...updatedSteps[i],
          status: "failed",
          result: errorMsg,
          actions: ["فشل تنفيذ الخطوة"],
        };
        previousResults.push({ title: updatedSteps[i].title, result: `فشل: ${errorMsg}` });
      }

      state = { ...state, steps: [...updatedSteps] };
      onUpdate({ ...state });
    }

    // -----------------------------------------------------------------------
    // Reflection phase
    // -----------------------------------------------------------------------
    state = { ...state, status: "reflecting", steps: updatedSteps };
    onUpdate({ ...state });

    let reflectionNote = "";
    try {
      reflectionNote = await reflect(userTask, updatedSteps);
    } catch {
      reflectionNote = "تم إنجاز جميع الخطوات بنجاح.";
    }

    // -----------------------------------------------------------------------
    // Synthesis phase
    // -----------------------------------------------------------------------
    const finalResult = await synthesise(userTask, updatedSteps);
    state = {
      ...state,
      status: "completed",
      finalResult,
      reflectionNote,
      steps: updatedSteps,
    };
    onUpdate({ ...state });

    return state;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
    state = { ...state, status: "failed", error: errorMsg };
    onUpdate({ ...state });
    return state;
  }
}
