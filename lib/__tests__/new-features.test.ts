import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createChatSession,
  getAllChatSessions,
  getChatSession,
  addMessageToSession,
  deleteChatSession,
  clearAllSessions,
  searchChatHistory,
} from '../chat-history-service';
import {
  initializeUserTokens,
  getUserTokens,
  purchaseTokens,
  consumeTokens,
  getTokenPackages,
  getTokenCost,
  clearAllTokenData,
} from '../iap-service';
import {
  getAvailableProviders,
  getProviderName,
} from '../multi-provider-ai';

describe('Chat History Service', () => {
  // Skip these tests in Node environment - they require React Native
  const isNativeEnvironment = typeof window === 'undefined' && typeof document === 'undefined';
  beforeEach(async () => {
    await clearAllSessions();
  });

  afterEach(async () => {
    await clearAllSessions();
  });

  it.skipIf(isNativeEnvironment)('should create a new chat session', async () => {
    const session = await createChatSession('Test Session');
    expect(session).toBeDefined();
    expect(session.title).toBe('Test Session');
    expect(session.messages).toEqual([]);
    expect(session.provider).toBe('gemini');
  });

  it.skipIf(isNativeEnvironment)('should get all chat sessions', async () => {
    await createChatSession('Session 1');
    await createChatSession('Session 2');

    const sessions = await getAllChatSessions();
    expect(sessions).toHaveLength(2);
  });

  it.skipIf(isNativeEnvironment)('should get a specific chat session', async () => {
    const created = await createChatSession('Test');
    const retrieved = await getChatSession(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
  });

  it.skipIf(isNativeEnvironment)('should add message to session', async () => {
    const session = await createChatSession('Test');
    await addMessageToSession(session.id, {
      id: Date.now().toString(),
      role: 'user',
      content: 'Hello',
      timestamp: new Date(),
    });

    const updated = await getChatSession(session.id);
    expect(updated?.messages).toHaveLength(1);
    expect(updated?.messages[0].content).toBe('Hello');
  });

  it.skipIf(isNativeEnvironment)('should delete chat session', async () => {
    const session = await createChatSession('Test');
    await deleteChatSession(session.id);

    const sessions = await getAllChatSessions();
    expect(sessions).toHaveLength(0);
  });

  it.skipIf(isNativeEnvironment)('should search chat history', async () => {
    const session = await createChatSession('Search Test');
    await addMessageToSession(session.id, {
      id: Date.now().toString(),
      role: 'user',
      content: 'Hello world',
      timestamp: new Date(),
    });

    const results = await searchChatHistory('world');
    expect(results).toHaveLength(1);
  });
});

describe('IAP Service', () => {
  // Skip these tests in Node environment - they require React Native
  const isNativeEnvironment = typeof window === 'undefined' && typeof document === 'undefined';
  beforeEach(async () => {
    await clearAllTokenData();
  });

  afterEach(async () => {
    await clearAllTokenData();
  });

  it.skipIf(isNativeEnvironment)('should initialize user tokens', async () => {
    const tokens = await initializeUserTokens();
    expect(tokens.balance).toBeGreaterThan(0);
    expect(tokens.spent).toBe(0);
  });

  it.skipIf(isNativeEnvironment)('should get user tokens', async () => {
    await initializeUserTokens();
    const tokens = await getUserTokens();

    expect(tokens).toBeDefined();
    expect(tokens.balance).toBeGreaterThan(0);
  });

  it.skipIf(isNativeEnvironment)('should purchase tokens', async () => {
    await initializeUserTokens();
    const before = await getUserTokens();
    const initialBalance = before.balance;

    await purchaseTokens('starter', 0.99);
    const after = await getUserTokens();

    expect(after.balance).toBeGreaterThan(initialBalance);
    expect(after.purchased).toBeGreaterThan(0);
  });

  it.skipIf(isNativeEnvironment)('should consume tokens', async () => {
    await initializeUserTokens();
    const before = await getUserTokens();

    const success = await consumeTokens('chat-message', 1);
    expect(success).toBe(true);

    const after = await getUserTokens();
    expect(after.balance).toBeLessThan(before.balance);
  });

  it.skipIf(isNativeEnvironment)('should not consume tokens if insufficient balance', async () => {
    await initializeUserTokens();
    // Set balance to 0
    const tokens = await getUserTokens();
    tokens.balance = 0;

    const success = await consumeTokens('code-generation', 1);
    expect(success).toBe(false);
  });

  it.skipIf(isNativeEnvironment)('should get token packages', async () => {
    const packages = await getTokenPackages();
    expect(packages.length).toBeGreaterThan(0);
    expect(packages[0].tokens).toBeGreaterThan(0);
  });

  it.skipIf(isNativeEnvironment)('should calculate token cost correctly', () => {
    const cost = getTokenCost('chat-message', 2);
    expect(cost).toBe(20); // 10 tokens per message * 2
  });
});

describe('Multi-Provider AI Service', () => {
  it('should get available providers', () => {
    const providers = getAvailableProviders();
    expect(providers).toContain('gemini');
    expect(providers).toContain('glm');
    expect(providers).toContain('z-ai');
  });

  it('should get provider names', () => {
    expect(getProviderName('gemini')).toBe('Google Gemini');
    expect(getProviderName('glm')).toBe('GLM-4.7 (Z.ai)');
    expect(getProviderName('z-ai')).toBe('Z.ai');
  });
});
