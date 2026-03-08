import { AIResponse, ChatMessage, CodeMode } from "./types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL = "https://s200077761-smart-secretary-api.hf.space";
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

const DEFAULT_GEMINI_KEY = "AIzaSyA4HhADKfJESaZUWFmBrPX_JXtTXwAM_Xw";

async function getApiKeys(): Promise<{ geminiKey: string }> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return { geminiKey: settings.geminiKey || DEFAULT_GEMINI_KEY };
    }
  } catch {}
  return { geminiKey: DEFAULT_GEMINI_KEY };
}

async function callGeminiDirect(
  message: string,
  systemPrompt?: string,
  apiKey?: string
): Promise<AIResponse> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: message }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return { content: text };
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
  try {
    return await callGeminiDirect(message, systemPrompt, geminiKey);
  } catch (error) {
    console.error("Gemini error:", error);
    return {
      content: "",
      error: error instanceof Error ? error.message : "حدث خطأ في الاتصال بـ Gemini",
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
