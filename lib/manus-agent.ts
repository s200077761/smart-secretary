/**
 * Manus Agent - Autonomous multi-step task execution
 *
 * Inspired by Manus AI, this agent:
 * 1. Receives a high-level task from the user
 * 2. Plans it into concrete sub-steps using LLM
 * 3. Executes each step sequentially, feeding prior results as context
 * 4. Synthesises a final comprehensive answer
 */

import { ManusStep, ManusTaskState } from "./types";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

type StateUpdater = (state: ManusTaskState) => void;

// ---------------------------------------------------------------------------
// Low-level Gemini call
// ---------------------------------------------------------------------------
async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error("مفتاح Gemini API غير متوفر.");
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
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
// Step 1: Planning
// ---------------------------------------------------------------------------
const PLANNER_PROMPT = `أنت مساعد ذكي خبير في تخطيط المهام المعقدة.
مهمتك: تحليل الطلب الوارد وإنشاء خطة خطوات واضحة ومحددة لتنفيذه.

القواعد:
- قسّم المهمة إلى 3-6 خطوات قابلة للتنفيذ
- كل خطوة يجب أن تكون مستقلة وواضحة
- أجب فقط بكائن JSON صالح بالشكل التالي، بدون أي نص إضافي:
{
  "steps": [
    { "id": 1, "title": "عنوان الخطوة", "description": "وصف تفصيلي لما يجب فعله" },
    ...
  ]
}`;

async function planTask(userTask: string): Promise<ManusStep[]> {
  const raw = await callGemini(PLANNER_PROMPT, `المهمة: ${userTask}`);

  // Extract JSON even if the model wraps it in markdown fences
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("فشل في تحليل خطة المهمة.");

  const parsed = JSON.parse(jsonMatch[0]) as { steps: { id: number; title: string; description: string }[] };

  return parsed.steps.map((s) => ({
    id: s.id,
    title: s.title,
    description: s.description,
    status: "pending" as const,
  }));
}

// ---------------------------------------------------------------------------
// Step 2: Execute a single step
// ---------------------------------------------------------------------------
const EXECUTOR_PROMPT = `أنت مساعد ذكي متخصص في تنفيذ المهام.
ستُعطى مهمة رئيسية، خطوة محددة لتنفيذها، ونتائج الخطوات السابقة كسياق.
قم بتنفيذ الخطوة المطلوبة بدقة وأعطِ نتيجة واضحة ومفيدة.
أجب بالعربية بشكل منظم ومفصّل.`;

async function executeStep(
  userTask: string,
  step: ManusStep,
  previousResults: { title: string; result: string }[],
): Promise<string> {
  const contextStr =
    previousResults.length > 0
      ? `\n\nنتائج الخطوات السابقة:\n${previousResults.map((r) => `- ${r.title}: ${r.result}`).join("\n")}`
      : "";

  const message = `المهمة الرئيسية: ${userTask}

الخطوة الحالية (${step.id}): ${step.title}
الوصف: ${step.description}${contextStr}

نفّذ هذه الخطوة الآن:`;

  return callGemini(EXECUTOR_PROMPT, message);
}

// ---------------------------------------------------------------------------
// Step 3: Synthesise final answer
// ---------------------------------------------------------------------------
const SYNTHESISER_PROMPT = `أنت مساعد ذكي متخصص في تلخيص وتجميع النتائج.
بناءً على المهمة الأصلية ونتائج جميع الخطوات، قدّم إجابة نهائية شاملة ومنظمة.
استخدم العناوين والنقاط لتنظيم الإجابة. أجب بالعربية.`;

async function synthesise(
  userTask: string,
  steps: ManusStep[],
): Promise<string> {
  const stepsStr = steps
    .map((s) => `**${s.title}**\n${s.result ?? ""}`)
    .join("\n\n");

  const message = `المهمة الأصلية: ${userTask}\n\nنتائج الخطوات:\n\n${stepsStr}\n\nقدّم الملخص النهائي الشامل:`;

  return callGemini(SYNTHESISER_PROMPT, message);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the full Manus autonomous agent pipeline.
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
    // --- Planning phase ---
    const steps = await planTask(userTask);
    state = { ...state, steps, status: "executing", currentStepIndex: 0 };
    onUpdate({ ...state });

    // --- Execution phase ---
    const updatedSteps = [...steps];
    const previousResults: { title: string; result: string }[] = [];

    for (let i = 0; i < updatedSteps.length; i++) {
      // Mark current step as running
      updatedSteps[i] = { ...updatedSteps[i], status: "running" };
      state = { ...state, steps: [...updatedSteps], currentStepIndex: i };
      onUpdate({ ...state });

      try {
        const result = await executeStep(userTask, updatedSteps[i], previousResults);
        updatedSteps[i] = { ...updatedSteps[i], status: "completed", result };
        previousResults.push({ title: updatedSteps[i].title, result });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "خطأ غير معروف";
        updatedSteps[i] = { ...updatedSteps[i], status: "failed", result: errorMsg };
        // Continue with remaining steps even if one fails
        previousResults.push({ title: updatedSteps[i].title, result: `فشل: ${errorMsg}` });
      }

      state = { ...state, steps: [...updatedSteps] };
      onUpdate({ ...state });
    }

    // --- Synthesis phase ---
    const finalResult = await synthesise(userTask, updatedSteps);
    state = { ...state, status: "completed", finalResult, steps: updatedSteps };
    onUpdate({ ...state });

    return state;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "حدث خطأ غير متوقع";
    state = { ...state, status: "failed", error: errorMsg };
    onUpdate({ ...state });
    return state;
  }
}
