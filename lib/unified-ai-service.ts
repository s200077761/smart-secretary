import { AIResponse, ChatMessage } from './types';
import { sendMessageWithProvider, sendMessageWithFallback, AIProvider } from './multi-provider-ai';
import { getProviderSettings, getPrimaryProviderWithValidation, getProviderApiKey } from './provider-settings';
import { consumeTokens } from './iap-service';

/**
 * Send chat message using configured providers
 */
export async function sendChatMessageWithProvider(
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  try {
    // Check token balance
    const hasTokens = await consumeTokens('chat-message', 1);
    if (!hasTokens) {
      return {
        content: '',
        error: 'رصيدك من الرموز غير كافي. يرجى شراء المزيد من الرموز.',
      };
    }

    const settings = await getProviderSettings();
    const primaryProvider = await getPrimaryProviderWithValidation();
    const primaryKey = await getProviderApiKey(primaryProvider);

    if (!primaryKey) {
      return {
        content: '',
        error: `مفتاح API غير متوفر للمزود: ${primaryProvider}`,
      };
    }

    // If fallback is enabled, use it
    if (settings.enableFallback && settings.fallbackProvider !== primaryProvider) {
      const fallbackKey = await getProviderApiKey(settings.fallbackProvider);
      if (fallbackKey) {
        return sendMessageWithFallback(
          primaryProvider,
          primaryKey,
          settings.fallbackProvider,
          fallbackKey,
          messages,
          systemPrompt
        );
      }
    }

    // Use primary provider only
    return sendMessageWithProvider(primaryProvider, primaryKey, messages, systemPrompt);
  } catch (error) {
    console.error('Error sending chat message:', error);
    return {
      content: '',
      error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
    };
  }
}

/**
 * Execute agent task using configured providers
 */
export async function executeAgentTaskWithProvider(
  agentPrompt: string,
  userInput: string
): Promise<AIResponse> {
  try {
    // Check token balance
    const hasTokens = await consumeTokens('agent-task', 1);
    if (!hasTokens) {
      return {
        content: '',
        error: 'رصيدك من الرموز غير كافي. يرجى شراء المزيد من الرموز.',
      };
    }

    const settings = await getProviderSettings();
    const primaryProvider = await getPrimaryProviderWithValidation();
    const primaryKey = await getProviderApiKey(primaryProvider);

    if (!primaryKey) {
      return {
        content: '',
        error: `مفتاح API غير متوفر للمزود: ${primaryProvider}`,
      };
    }

    const messages: ChatMessage[] = [
      {
        id: Date.now().toString(),
        role: 'user',
        content: userInput,
        timestamp: new Date(),
      },
    ];

    if (settings.enableFallback && settings.fallbackProvider !== primaryProvider) {
      const fallbackKey = await getProviderApiKey(settings.fallbackProvider);
      if (fallbackKey) {
        return sendMessageWithFallback(
          primaryProvider,
          primaryKey,
          settings.fallbackProvider,
          fallbackKey,
          messages,
          agentPrompt
        );
      }
    }

    return sendMessageWithProvider(primaryProvider, primaryKey, messages, agentPrompt);
  } catch (error) {
    console.error('Error executing agent task:', error);
    return {
      content: '',
      error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
    };
  }
}

/**
 * Generate search summary using configured providers
 */
export async function generateSearchSummaryWithProvider(
  query: string,
  searchResults: string
): Promise<AIResponse> {
  try {
    // Check token balance
    const hasTokens = await consumeTokens('web-search', 1);
    if (!hasTokens) {
      return {
        content: '',
        error: 'رصيدك من الرموز غير كافي. يرجى شراء المزيد من الرموز.',
      };
    }

    const systemPrompt = `You are a helpful AI assistant that summarizes search results.
Given a search query and search results, provide a concise and informative summary.
Focus on the most relevant information and present it clearly.
Respond in the same language as the query.`;

    const messages: ChatMessage[] = [
      {
        id: Date.now().toString(),
        role: 'user',
        content: `Query: ${query}\n\nSearch Results:\n${searchResults}\n\nPlease provide a helpful summary of these results.`,
        timestamp: new Date(),
      },
    ];

    const settings = await getProviderSettings();
    const primaryProvider = await getPrimaryProviderWithValidation();
    const primaryKey = await getProviderApiKey(primaryProvider);

    if (!primaryKey) {
      return {
        content: '',
        error: `مفتاح API غير متوفر للمزود: ${primaryProvider}`,
      };
    }

    if (settings.enableFallback && settings.fallbackProvider !== primaryProvider) {
      const fallbackKey = await getProviderApiKey(settings.fallbackProvider);
      if (fallbackKey) {
        return sendMessageWithFallback(
          primaryProvider,
          primaryKey,
          settings.fallbackProvider,
          fallbackKey,
          messages,
          systemPrompt
        );
      }
    }

    return sendMessageWithProvider(primaryProvider, primaryKey, messages, systemPrompt);
  } catch (error) {
    console.error('Error generating search summary:', error);
    return {
      content: '',
      error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
    };
  }
}

/**
 * Process code using configured providers
 */
export async function processCodeWithProvider(
  mode: 'generate' | 'review' | 'explain',
  input: string,
  language: string
): Promise<AIResponse> {
  try {
    // Check token balance based on mode
    const tokenCosts = {
      generate: 'code-generation',
      review: 'code-review',
      explain: 'code-explanation',
    } as const;

    const hasTokens = await consumeTokens(tokenCosts[mode] as any, 1);
    if (!hasTokens) {
      return {
        content: '',
        error: 'رصيدك من الرموز غير كافي. يرجى شراء المزيد من الرموز.',
      };
    }

    const prompts: Record<string, string> = {
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

    const messages: ChatMessage[] = [
      {
        id: Date.now().toString(),
        role: 'user',
        content: input,
        timestamp: new Date(),
      },
    ];

    const settings = await getProviderSettings();
    const primaryProvider = await getPrimaryProviderWithValidation();
    const primaryKey = await getProviderApiKey(primaryProvider);

    if (!primaryKey) {
      return {
        content: '',
        error: `مفتاح API غير متوفر للمزود: ${primaryProvider}`,
      };
    }

    if (settings.enableFallback && settings.fallbackProvider !== primaryProvider) {
      const fallbackKey = await getProviderApiKey(settings.fallbackProvider);
      if (fallbackKey) {
        return sendMessageWithFallback(
          primaryProvider,
          primaryKey,
          settings.fallbackProvider,
          fallbackKey,
          messages,
          prompts[mode]
        );
      }
    }

    return sendMessageWithProvider(primaryProvider, primaryKey, messages, prompts[mode]);
  } catch (error) {
    console.error('Error processing code:', error);
    return {
      content: '',
      error: error instanceof Error ? error.message : 'حدث خطأ غير متوقع',
    };
  }
}
