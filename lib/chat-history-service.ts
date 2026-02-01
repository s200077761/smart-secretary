import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from './types';

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  provider: string; // 'gemini', 'glm', 'z-ai'
}

const CHAT_SESSIONS_KEY = 'chat_sessions';
const CURRENT_SESSION_KEY = 'current_session_id';

/**
 * Create a new chat session
 */
export async function createChatSession(
  title: string = 'جديد',
  provider: string = 'gemini'
): Promise<ChatSession> {
  const session: ChatSession = {
    id: Date.now().toString(),
    title,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    provider,
  };

  try {
    const sessions = await getAllChatSessions();
    sessions.push(session);
    await AsyncStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    await AsyncStorage.setItem(CURRENT_SESSION_KEY, session.id);
  } catch (error) {
    console.error('Failed to create chat session:', error);
  }

  return session;
}

/**
 * Get all chat sessions
 */
export async function getAllChatSessions(): Promise<ChatSession[]> {
  try {
    const data = await AsyncStorage.getItem(CHAT_SESSIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Failed to get chat sessions:', error);
    return [];
  }
}

/**
 * Get a specific chat session
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const sessions = await getAllChatSessions();
    return sessions.find((s) => s.id === sessionId) || null;
  } catch (error) {
    console.error('Failed to get chat session:', error);
    return null;
  }
}

/**
 * Add message to chat session
 */
export async function addMessageToSession(
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  try {
    const sessions = await getAllChatSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (session) {
      session.messages.push(message);
      session.updatedAt = Date.now();
      await AsyncStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }
  } catch (error) {
    console.error('Failed to add message to session:', error);
  }
}

/**
 * Update chat session title
 */
export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  try {
    const sessions = await getAllChatSessions();
    const session = sessions.find((s) => s.id === sessionId);

    if (session) {
      session.title = title;
      session.updatedAt = Date.now();
      await AsyncStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
    }
  } catch (error) {
    console.error('Failed to update session title:', error);
  }
}

/**
 * Delete chat session
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  try {
    const sessions = await getAllChatSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    await AsyncStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(filtered));

    // If deleted session was current, switch to first available
    const currentId = await AsyncStorage.getItem(CURRENT_SESSION_KEY);
    if (currentId === sessionId) {
      if (filtered.length > 0) {
        await AsyncStorage.setItem(CURRENT_SESSION_KEY, filtered[0].id);
      } else {
        await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
      }
    }
  } catch (error) {
    console.error('Failed to delete chat session:', error);
  }
}

/**
 * Clear all chat sessions
 */
export async function clearAllSessions(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAT_SESSIONS_KEY);
    await AsyncStorage.removeItem(CURRENT_SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear sessions:', error);
  }
}

/**
 * Get current session ID
 */
export async function getCurrentSessionId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CURRENT_SESSION_KEY);
  } catch (error) {
    console.error('Failed to get current session ID:', error);
    return null;
  }
}

/**
 * Set current session ID
 */
export async function setCurrentSessionId(sessionId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CURRENT_SESSION_KEY, sessionId);
  } catch (error) {
    console.error('Failed to set current session ID:', error);
  }
}

/**
 * Export chat session as JSON
 */
export async function exportChatSession(sessionId: string): Promise<string> {
  try {
    const session = await getChatSession(sessionId);
    if (!session) throw new Error('Session not found');

    return JSON.stringify(session, null, 2);
  } catch (error) {
    console.error('Failed to export chat session:', error);
    throw error;
  }
}

/**
 * Search in chat history
 */
export async function searchChatHistory(query: string): Promise<ChatSession[]> {
  try {
    const sessions = await getAllChatSessions();
    const lowerQuery = query.toLowerCase();

    return sessions.filter((session) => {
      // Search in session title
      if (session.title.toLowerCase().includes(lowerQuery)) {
        return true;
      }

      // Search in messages
      return session.messages.some((msg) =>
        msg.content.toLowerCase().includes(lowerQuery)
      );
    });
  } catch (error) {
    console.error('Failed to search chat history:', error);
    return [];
  }
}
