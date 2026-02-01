import { AIResponse, ChatMessage, CodeMode } from "./types";

// Use the existing GEMINI_API_KEY from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.EXPO_PUBLIC_GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface GeminiMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

interface GeminiRequest {
  contents: GeminiMessage[];
  systemInstruction?: { parts: { text: string }[] };
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

async function callGemini(request: GeminiRequest): Promise<AIResponse> {
  // Check if API key is available
  if (!GEMINI_API_KEY) {
    return {
      content: "",
      error: "مفتاح API غير متوفر. يرجى التحقق من إعدادات التطبيق.",
    };
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "API request failed");
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    return { content };
  } catch (error) {
    console.error("Gemini API error:", error);
    return { 
      content: "", 
      error: error instanceof Error ? error.message : "حدث خطأ غير متوقع" 
    };
  }
}

// Chat completion
export async function sendChatMessage(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  const geminiMessages: GeminiMessage[] = messages.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const request: GeminiRequest = {
    contents: geminiMessages,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  };

  if (systemPrompt) {
    request.systemInstruction = {
      parts: [{ text: systemPrompt }],
    };
  }

  return callGemini(request);
}

// Agent task execution
export async function executeAgentTask(
  agentPrompt: string,
  userInput: string
): Promise<AIResponse> {
  const request: GeminiRequest = {
    contents: [
      {
        role: "user",
        parts: [{ text: userInput }],
      },
    ],
    systemInstruction: {
      parts: [{ text: agentPrompt }],
    },
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 4096,
    },
  };

  return callGemini(request);
}

// Web search with AI summary
export async function generateSearchSummary(
  query: string,
  searchResults: string
): Promise<AIResponse> {
  const systemPrompt = `You are a helpful AI assistant that summarizes search results.
Given a search query and search results, provide a concise and informative summary.
Focus on the most relevant information and present it clearly.
Respond in the same language as the query.`;

  const request: GeminiRequest = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Query: ${query}\n\nSearch Results:\n${searchResults}\n\nPlease provide a helpful summary of these results.`,
          },
        ],
      },
    ],
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  };

  return callGemini(request);
}

// Code generation/review/explanation
export async function processCode(
  mode: CodeMode,
  input: string,
  language: string
): Promise<AIResponse> {
  const prompts: Record<CodeMode, string> = {
    generate: `You are an expert programmer. Generate clean, well-documented ${language} code based on the user's description.
Include comments explaining the code. Only output the code, no explanations before or after.`,
    review: `You are an expert code reviewer. Review the following ${language} code and provide:
1. Issues found (bugs, security vulnerabilities, performance problems)
2. Suggestions for improvement
3. Best practices that could be applied
Be specific and constructive.`,
    explain: `You are an expert programmer and teacher. Explain the following ${language} code in detail:
1. What the code does overall
2. How each part works
3. Any important concepts or patterns used
Use clear, simple language suitable for learners.`,
  };

  const request: GeminiRequest = {
    contents: [
      {
        role: "user",
        parts: [{ text: input }],
      },
    ],
    systemInstruction: {
      parts: [{ text: prompts[mode] }],
    },
    generationConfig: {
      temperature: mode === "generate" ? 0.7 : 0.3,
      maxOutputTokens: 4096,
    },
  };

  return callGemini(request);
}

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
Your task is to help users with various tasks in a professional and friendly manner.
Always respond in Arabic unless the user writes in English.`;
