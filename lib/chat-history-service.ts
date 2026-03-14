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

/** Lightweight metadata stored in the index — no messages array. */
interface SessionMetadata {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  provider: string;
}

// Keys -----------------------------------------------------------------------
/** Legacy key kept for one-time migration only. */
const LEGACY_SESSIONS_KEY = 'chat_sessions';
/** New index: array of SessionMetadata (no message payloads). */
const CHAT_SESSIONS_INDEX_KEY = 'chat_sessions_index';
/** Per-session data: full ChatSession including messages. */
const SESSION_DATA_PREFIX = 'chat_session_data_';
const MIGRATION_FLAG_KEY = 'chat_sessions_v2_migrated';
const CURRENT_SESSION_KEY = 'current_session_id';

// In-memory cache for the index so repeated operations within the same JS
// runtime don't hit AsyncStorage more than once.
let indexCache: SessionMetadata[] | null = null;

// Helpers --------------------------------------------------------------------

/** Migrate once from the old flat JSON array to per-session storage. */
async function migrateIfNeeded(): Promise<void> {
  try {
    const migrated = await AsyncStorage.getItem(MIGRATION_FLAG_KEY);
    if (migrated) return;

    const oldData = await AsyncStorage.getItem(LEGACY_SESSIONS_KEY);
    if (oldData) {
      const oldSessions: ChatSession[] = JSON.parse(oldData);
      // Only migrate when the old format has a messages field.
      if (oldSessions.length > 0 && Array.isArray(oldSessions[0]?.messages)) {
        const setItems: [string, string][] = [];
        const index: SessionMetadata[] = [];
        for (const session of oldSessions) {
          setItems.push([SESSION_DATA_PREFIX + session.id, JSON.stringify(session)]);
          index.push({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            provider: session.provider,
          });
        }
        await AsyncStorage.multiSet(setItems);
        await AsyncStorage.setItem(CHAT_SESSIONS_INDEX_KEY, JSON.stringify(index));
      }
    }

    await AsyncStorage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch (error) {
    console.error('Chat session migration failed:', error);
  }
}

/** Read the in-memory index, loading from storage on first access. */
async function getIndex(): Promise<SessionMetadata[]> {
  if (indexCache !== null) return indexCache;
  await migrateIfNeeded();
  try {
    const data = await AsyncStorage.getItem(CHAT_SESSIONS_INDEX_KEY);
    const parsed: SessionMetadata[] = data ? JSON.parse(data) : [];
    indexCache = parsed;
    return parsed;
  } catch (error) {
    console.error('Failed to read session index:', error);
    indexCache = [];
    return indexCache;
  }
}

/** Persist the index and update the in-memory cache. */
async function saveIndex(index: SessionMetadata[]): Promise<void> {
  await AsyncStorage.setItem(CHAT_SESSIONS_INDEX_KEY, JSON.stringify(index));
  indexCache = index;
}

// Public API -----------------------------------------------------------------

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
    const index = await getIndex();
    const newEntry: SessionMetadata = { id: session.id, title, createdAt: session.createdAt, updatedAt: session.updatedAt, provider };
    const updatedIndex = [...index, newEntry];
    await Promise.all([
      AsyncStorage.setItem(SESSION_DATA_PREFIX + session.id, JSON.stringify(session)),
      saveIndex(updatedIndex),
      AsyncStorage.setItem(CURRENT_SESSION_KEY, session.id),
    ]);
  } catch (error) {
    console.error('Failed to create chat session:', error);
  }

  return session;
}

/**
 * Get all chat sessions (including message payloads).
 */
export async function getAllChatSessions(): Promise<ChatSession[]> {
  try {
    const index = await getIndex();
    if (index.length === 0) return [];

    const keys = index.map((m) => SESSION_DATA_PREFIX + m.id);
    const pairs = await AsyncStorage.multiGet(keys);
    return pairs
      .map(([, value]) => (value ? (JSON.parse(value) as ChatSession) : null))
      .filter((s): s is ChatSession => s !== null);
  } catch (error) {
    console.error('Failed to get chat sessions:', error);
    return [];
  }
}

/**
 * Get a specific chat session — O(1), reads only the requested session.
 */
export async function getChatSession(sessionId: string): Promise<ChatSession | null> {
  try {
    const data = await AsyncStorage.getItem(SESSION_DATA_PREFIX + sessionId);
    return data ? (JSON.parse(data) as ChatSession) : null;
  } catch (error) {
    console.error('Failed to get chat session:', error);
    return null;
  }
}

/**
 * Add message to chat session — O(1), touches only the target session.
 */
export async function addMessageToSession(
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  try {
    const key = SESSION_DATA_PREFIX + sessionId;
    const data = await AsyncStorage.getItem(key);
    if (!data) return;

    const session: ChatSession = JSON.parse(data);
    session.messages.push(message);
    session.updatedAt = Date.now();

    // Build a new index array (don't mutate cache in place) and save in parallel.
    const index = await getIndex();
    const updatedIndex = index.map((m) =>
      m.id === sessionId ? { ...m, updatedAt: session.updatedAt } : m
    );

    await Promise.all([
      AsyncStorage.setItem(key, JSON.stringify(session)),
      saveIndex(updatedIndex),
    ]);
  } catch (error) {
    console.error('Failed to add message to session:', error);
  }
}

/**
 * Update chat session title — O(1), touches only the target session.
 */
export async function updateSessionTitle(
  sessionId: string,
  title: string
): Promise<void> {
  try {
    const key = SESSION_DATA_PREFIX + sessionId;
    const data = await AsyncStorage.getItem(key);
    if (!data) return;

    const session: ChatSession = JSON.parse(data);
    session.title = title;
    session.updatedAt = Date.now();

    const index = await getIndex();
    const updatedIndex = index.map((m) =>
      m.id === sessionId ? { ...m, title, updatedAt: session.updatedAt } : m
    );

    await Promise.all([
      AsyncStorage.setItem(key, JSON.stringify(session)),
      saveIndex(updatedIndex),
    ]);
  } catch (error) {
    console.error('Failed to update session title:', error);
  }
}

/**
 * Delete chat session
 */
export async function deleteChatSession(sessionId: string): Promise<void> {
  try {
    const index = await getIndex();
    const filtered = index.filter((m) => m.id !== sessionId);

    await Promise.all([
      AsyncStorage.removeItem(SESSION_DATA_PREFIX + sessionId),
      saveIndex(filtered),
    ]);

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
    const index = await getIndex();
    const sessionKeys = index.map((m) => SESSION_DATA_PREFIX + m.id);
    await AsyncStorage.multiRemove([
      ...sessionKeys,
      CHAT_SESSIONS_INDEX_KEY,
      CURRENT_SESSION_KEY,
      MIGRATION_FLAG_KEY,
      // Remove legacy key so a subsequent migration pass finds no stale data.
      LEGACY_SESSIONS_KEY,
    ]);
    indexCache = null;
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
