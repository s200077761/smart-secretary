import React, { createContext, useContext, useReducer, useCallback, ReactNode } from "react";
import { ChatMessage, ChatState } from "./types";
import { sendChatMessage, SECRETARY_SYSTEM_PROMPT } from "./ai-service";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "smart_secretary_chat_history";

type ChatAction =
  | { type: "ADD_MESSAGE"; payload: ChatMessage }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; content: string; isLoading?: boolean } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "CLEAR_MESSAGES" }
  | { type: "LOAD_MESSAGES"; payload: ChatMessage[] };

const initialState: ChatState = {
  messages: [],
  isLoading: false,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id
            ? { ...msg, content: action.payload.content, isLoading: action.payload.isLoading }
            : msg
        ),
      };
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "CLEAR_MESSAGES":
      return { ...state, messages: [] };
    case "LOAD_MESSAGES":
      return { ...state, messages: action.payload };
    default:
      return state;
  }
}

interface ChatContextType {
  state: ChatState;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => Promise<void>;
  loadMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const saveMessages = useCallback(async (messages: ChatMessage[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error("Failed to save messages:", error);
    }
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const messages = JSON.parse(stored).map((msg: ChatMessage) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        dispatch({ type: "LOAD_MESSAGES", payload: messages });
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };
    dispatch({ type: "ADD_MESSAGE", payload: userMessage });

    // Add placeholder for assistant response
    const assistantId = `assistant_${Date.now()}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isLoading: true,
    };
    dispatch({ type: "ADD_MESSAGE", payload: assistantMessage });
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      // Get all messages for context (excluding the loading placeholder)
      const messagesForApi = [...state.messages, userMessage];
      
      const response = await sendChatMessage(messagesForApi, SECRETARY_SYSTEM_PROMPT);
      
      if (response.error) {
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: assistantId,
            content: `عذراً، حدث خطأ: ${response.error}`,
            isLoading: false,
          },
        });
      } else {
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            id: assistantId,
            content: response.content,
            isLoading: false,
          },
        });
      }

      // Save updated messages
      const updatedMessages = [
        ...state.messages,
        userMessage,
        { ...assistantMessage, content: response.content || response.error || "", isLoading: false },
      ];
      await saveMessages(updatedMessages);
    } catch (error) {
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: assistantId,
          content: "عذراً، حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.",
          isLoading: false,
        },
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.messages, saveMessages]);

  const clearMessages = useCallback(async () => {
    dispatch({ type: "CLEAR_MESSAGES" });
    await AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ChatContext.Provider value={{ state, sendMessage, clearMessages, loadMessages }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
