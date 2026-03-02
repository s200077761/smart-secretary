import { AIResponse, ChatMessage, CodeMode } from "./types";

const BACKEND_URL = "https://s200077761-smart-secretary-api.hf.space";

// Default system prompt for the secretary
export const SECRETARY_SYSTEM_PROMPT = `أنت "السكرتير الذكي"، مساعد ذكي باللغة العربية.
مهمتك هي مساعدة المستخدم في مختلف المهام بطريقة احترافية وودية.

قدراتك:
- الإجابة على الأسئلة وتقديم المعلومات
- المساعدة في كتابة النصوص والرسائل
- تنظيم الأفكار والمهام
- تقديم النصائح والاقتراحات
- المساعدة في البحث والتحليل

أسلوبك:
- استخدم اللغة العربية الفصحى السهلة
- كن موجزاً ومفيداً
- قدم إجابات منظمة وواضحة
- كن ودوداً ومحترفاً

You are "The Smart Secretary", an intelligent Arabic-language assistant.
Always respond in Arabic unless the user writes in English.`;

async function callBackend(message: string, systemPrompt?: string): Promise<AIResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/chat/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        agent_system_prompt: systemPrompt || null,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `API error ${response.status}`);
    }

    const data = await response.json();
    return { content: data.content || "" };
  } catch (error) {
    console.error("Backend API error:", error);
    return {
      content: "",
      error: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
    };
  }
}

// Chat completion
export async function sendChatMessage(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return callBackend(lastUser?.content ?? "", systemPrompt || SECRETARY_SYSTEM_PROMPT);
}

// Agent task execution
export async function executeAgentTask(
  agentPrompt: string,
  userInput: string
): Promise<AIResponse> {
  return callBackend(userInput, agentPrompt);
}

// Web search with AI summary
export async function generateSearchSummary(
  query: string,
  searchResults: string
): Promise<AIResponse> {
  const systemPrompt = `أنت مساعد ذكي يلخص نتائج البحث.
قدّم ملخصاً مختصراً ومفيداً للنتائج المعطاة. أجب بنفس لغة الاستعلام.`;

  return callBackend(
    `الاستعلام: ${query}\n\nنتائج البحث:\n${searchResults}\n\nقدّم ملخصاً مفيداً:`,
    systemPrompt
  );
}

// Code generation/review/explanation
export async function processCode(
  mode: CodeMode,
  input: string,
  language: string
): Promise<AIResponse> {
  const prompts: Record<CodeMode, string> = {
    generate: `أنت مبرمج خبير. اكتب كود ${language} نظيفاً وموثقاً بناءً على وصف المستخدم. اكتب الكود فقط بدون شرح إضافي.`,
    review: `أنت مراجع كود خبير. راجع كود ${language} التالي وقدّم: 1) المشاكل الموجودة 2) اقتراحات التحسين 3) أفضل الممارسات.`,
    explain: `أنت مبرمج ومعلم خبير. اشرح كود ${language} التالي بالتفصيل: ما يفعله، كيف يعمل، المفاهيم المستخدمة.`,
  };

  return callBackend(input, prompts[mode]);
}
