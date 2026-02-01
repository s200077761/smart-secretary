import { AIResponse, ChatMessage } from "./types";

export type AIProvider = 'gemini' | 'glm' | 'z-ai';

export interface ProviderConfig {
  provider: AIProvider;
  apiKey: string;
  apiUrl?: string;
  model?: string;
}

interface ProviderResponse {
  content: string;
  provider: AIProvider;
  tokensUsed?: number;
}

// Provider configurations
const PROVIDER_CONFIGS: Record<AIProvider, Partial<ProviderConfig>> = {
  gemini: {
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    model: 'gemini-2.5-flash',
  },
  glm: {
    apiUrl: 'https://api.z.ai/v1/chat/completions',
    model: 'GLM-4.7',
  },
  'z-ai': {
    apiUrl: 'https://chat.z.ai/api/chat',
    model: 'z-ai-latest',
  },
};

/**
 * Call Gemini API
 */
async function callGemini(
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ProviderResponse> {
  try {
    const geminiMessages = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }));

    const request: any = {
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

    const response = await fetch(
      `${PROVIDER_CONFIGS.gemini.apiUrl}?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Gemini API error');
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
      content,
      provider: 'gemini',
      tokensUsed: 0,
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

/**
 * Call GLM-4.7 API (Z.ai)
 */
async function callGLM(
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ProviderResponse> {
  try {
    const glmMessages = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    if (systemPrompt) {
      glmMessages.unshift({
        role: 'system',
        content: systemPrompt,
      });
    }

    const response = await fetch(PROVIDER_CONFIGS.glm.apiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: PROVIDER_CONFIGS.glm.model,
        messages: glmMessages,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'GLM API error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      provider: 'glm',
      tokensUsed: data.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error('GLM API error:', error);
    throw error;
  }
}

/**
 * Call Z.ai API
 */
async function callZAI(
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ProviderResponse> {
  try {
    const zaiMessages = messages.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }));

    const response = await fetch(PROVIDER_CONFIGS['z-ai'].apiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: zaiMessages,
        system: systemPrompt,
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Z.ai API error');
    }

    const data = await response.json();
    const content = data.message?.content || data.content || '';

    return {
      content,
      provider: 'z-ai',
      tokensUsed: 0,
    };
  } catch (error) {
    console.error('Z.ai API error:', error);
    throw error;
  }
}

/**
 * Send message using specified provider
 */
export async function sendMessageWithProvider(
  provider: AIProvider,
  apiKey: string,
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  try {
    let result: ProviderResponse;

    switch (provider) {
      case 'gemini':
        result = await callGemini(apiKey, messages, systemPrompt);
        break;
      case 'glm':
        result = await callGLM(apiKey, messages, systemPrompt);
        break;
      case 'z-ai':
        result = await callZAI(apiKey, messages, systemPrompt);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    return {
      content: result.content,
      provider: result.provider,
    };
  } catch (error) {
    console.error(`Error with ${provider} provider:`, error);
    return {
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      provider,
    };
  }
}

/**
 * Send message with fallback provider support
 */
export async function sendMessageWithFallback(
  primaryProvider: AIProvider,
  primaryKey: string,
  fallbackProvider: AIProvider,
  fallbackKey: string,
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  try {
    // Try primary provider first
    const result = await sendMessageWithProvider(
      primaryProvider,
      primaryKey,
      messages,
      systemPrompt
    );

    if (result.content) {
      return result;
    }

    // Fall back to secondary provider
    console.log(`Primary provider (${primaryProvider}) failed, trying fallback (${fallbackProvider})`);
    return sendMessageWithProvider(
      fallbackProvider,
      fallbackKey,
      messages,
      systemPrompt
    );
  } catch (error) {
    console.error('All providers failed:', error);
    return {
      content: '',
      error: 'جميع المزودين غير متاحين حالياً',
    };
  }
}

/**
 * Get available providers
 */
export function getAvailableProviders(): AIProvider[] {
  return ['gemini', 'glm', 'z-ai'];
}

/**
 * Get provider display name
 */
export function getProviderName(provider: AIProvider): string {
  const names: Record<AIProvider, string> = {
    gemini: 'Google Gemini',
    glm: 'GLM-4.7 (Z.ai)',
    'z-ai': 'Z.ai',
  };
  return names[provider] || provider;
}
