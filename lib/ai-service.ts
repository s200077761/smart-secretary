import { AIResponse, ChatMessage, CodeMode } from "./types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = "https://s200077761-smart-secretary-api.hf.space";
const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_MODEL = "Qwen/Qwen2.5-7B-Instruct";
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_MODEL = "glm-4-flash";
const DEFAULT_ZHIPU_KEY = "26ee4b1ad4194c549920514b419eeaf9.T4NlDRbZ1ygimqTf";
const SETTINGS_KEY = "smart_secretary_settings";

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

async function getTokens(): Promise<{ zhipuToken?: string; hfToken?: string }> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return { zhipuToken: settings.zhipuToken || DEFAULT_ZHIPU_KEY, hfToken: settings.hfToken || "" };
    }
  } catch {}
  return { zhipuToken: DEFAULT_ZHIPU_KEY };
}

async function callZhipu(
  message: string,
  systemPrompt?: string,
  apiKey?: string
): Promise<AIResponse> {
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: message });

  const response = await fetch(ZHIPU_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: ZHIPU_MODEL, messages, max_tokens: 2048, temperature: 0.7 }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content || "" };
}

async function callHFDirect(
  message: string,
  systemPrompt?: string,
  hfToken?: string
): Promise<AIResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (hfToken) headers["Authorization"] = `Bearer ${hfToken}`;

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: message });

  const response = await fetch(HF_ROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: HF_MODEL, messages, max_tokens: 2048, temperature: 0.7 }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `API error ${response.status}`);
  }

  const data = await response.json();
  return { content: data.choices?.[0]?.message?.content || "" };
}

async function callBackend(message: string, systemPrompt?: string): Promise<AIResponse> {
  const response = await fetch(`${BACKEND_URL}/api/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, agent_system_prompt: systemPrompt || null }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `API error ${response.status}`);
  }

  const data = await response.json();
  return { content: data.content || "" };
}

async function callAI(message: string, systemPrompt?: string): Promise<AIResponse> {
  const { zhipuToken, hfToken } = await getTokens();

  // Priority 1: ZhipuAI (z.ai)
  if (zhipuToken) {
    try {
      return await callZhipu(message, systemPrompt, zhipuToken);
    } catch (error) {
      console.error("ZhipuAI error:", error);
      return {
        content: "",
        error: error instanceof Error ? error.message : "حدث خطأ في الاتصال بـ ZhipuAI",
      };
    }
  }

  // Priority 2: HuggingFace direct
  if (hfToken) {
    try {
      return await callHFDirect(message, systemPrompt, hfToken);
    } catch (error) {
      console.error("HF direct API error:", error);
      return {
        content: "",
        error: error instanceof Error ? error.message : "حدث خطأ في الاتصال",
      };
    }
  }

  // Priority 3: Backend fallback
  try {
    return await callBackend(message, systemPrompt);
  } catch (error) {
    console.error("Backend API error:", error);
    return {
      content: "",
      error: "الخادم غير متاح. أضف مفتاح ZhipuAI أو HuggingFace في الإعدادات.",
    };
  }
}

// Chat completion
export async function sendChatMessage(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return callAI(lastUser?.content ?? "", systemPrompt || SECRETARY_SYSTEM_PROMPT);
}

// Agent task execution
export async function executeAgentTask(
  agentPrompt: string,
  userInput: string
): Promise<AIResponse> {
  return callAI(userInput, agentPrompt);
}

// Web search with AI summary
export async function generateSearchSummary(
  query: string,
  searchResults: string
): Promise<AIResponse> {
  const systemPrompt = `أنت مساعد ذكي يلخص نتائج البحث.
قدّم ملخصاً مختصراً ومفيداً للنتائج المعطاة. أجب بنفس لغة الاستعلام.`;

  return callAI(
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

  return callAI(input, prompts[mode]);
}
