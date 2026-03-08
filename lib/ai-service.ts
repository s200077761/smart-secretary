import { AIResponse, ChatMessage, CodeMode } from "./types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = "https://s200077761-smart-secretary-api.hf.space";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "gemini-2.0-flash";
const SETTINGS_KEY = "smart_secretary_settings";

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

async function getApiKeys(): Promise<{ geminiKey?: string }> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return { geminiKey: settings.geminiKey || "" };
    }
  } catch {}
  return {};
}

async function callGemini(
  message: string,
  systemPrompt?: string,
  apiKey?: string
): Promise<AIResponse> {
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: message });

  const response = await fetch(GEMINI_BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: GEMINI_MODEL, messages, max_tokens: 2048, temperature: 0.7 }),
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
  const { geminiKey } = await getApiKeys();

  if (geminiKey) {
    try {
      return await callGemini(message, systemPrompt, geminiKey);
    } catch (error) {
      console.error("Gemini error:", error);
      return {
        content: "",
        error: error instanceof Error ? error.message : "حدث خطأ في الاتصال",
      };
    }
  }

  try {
    return await callBackend(message, systemPrompt);
  } catch (error) {
    console.error("Backend error:", error);
    return {
      content: "",
      error: "أضف مفتاح Google Gemini API في الإعدادات للمتابعة (مجاني من aistudio.google.com)",
    };
  }
}

export async function sendChatMessage(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return callAI(lastUser?.content ?? "", systemPrompt || SECRETARY_SYSTEM_PROMPT);
}

export async function executeAgentTask(
  agentPrompt: string,
  userInput: string
): Promise<AIResponse> {
  return callAI(userInput, agentPrompt);
}

export async function generateSearchSummary(
  query: string,
  searchResults: string
): Promise<AIResponse> {
  const systemPrompt = `أنت مساعد ذكي يلخص نتائج البحث. قدّم ملخصاً مختصراً ومفيداً. أجب بنفس لغة الاستعلام.`;
  return callAI(`الاستعلام: ${query}\n\nنتائج البحث:\n${searchResults}\n\nقدّم ملخصاً:`, systemPrompt);
}

export async function processCode(
  mode: CodeMode,
  input: string,
  language: string
): Promise<AIResponse> {
  const prompts: Record<CodeMode, string> = {
    generate: `أنت مبرمج خبير. اكتب كود ${language} نظيفاً بناءً على الوصف.`,
    review: `أنت مراجع كود. راجع كود ${language} وقدّم: 1) المشاكل 2) التحسينات 3) أفضل الممارسات.`,
    explain: `أنت مبرمج ومعلم. اشرح كود ${language} بالتفصيل.`,
  };
  return callAI(input, prompts[mode]);
}
