import { create } from 'zustand';
import { sendAssistantMessage, type AssistantChatResponseDTO } from '../services/assistantService';

export interface AssistantMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionConfirmation?: string;
  data?: any;
  status?: 'completed' | 'partial_failure' | 'failed';
}

interface AssistantState {
  messages: AssistantMessage[];
  isLoading: boolean;
  activeActionConfirmation: string | null;
  error: string | null;
  sendMessage: (prompt: string) => Promise<void>;
  clearHistory: () => void;
}

const STORAGE_KEY = 'harmony_assistant_session_history';

const loadInitialMessages = (): AssistantMessage[] => {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    // Ignore error
  }
  return [
    {
      id: 'welcome-msg',
      sender: 'assistant',
      text: 'Hello! I am your HarmonyAI Music Assistant. Ask me to find songs, discover vibes, curate playlists, control your queue, or explore your taste preferences.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ];
};

export const useAssistantStore = create<AssistantState>((set, get) => ({
  messages: loadInitialMessages(),
  isLoading: false,
  activeActionConfirmation: null,
  error: null,

  sendMessage: async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || get().isLoading) return;

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentMessages = [...get().messages, userMessage];
    set({
      messages: currentMessages,
      isLoading: true,
      error: null,
      activeActionConfirmation: null,
    });

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(currentMessages));
    } catch (e) {}

    const response = await sendAssistantMessage(trimmed);

    if (!response.success || !response.data) {
      const errorText = response.error || 'Failed to process assistant request. Please try again.';
      const assistantErrMsg: AssistantMessage = {
        id: `assist-${Date.now()}`,
        sender: 'assistant',
        text: errorText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'failed',
      };

      const updated = [...get().messages, assistantErrMsg];
      set({
        messages: updated,
        isLoading: false,
        error: errorText,
      });

      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return;
    }

    const resData: AssistantChatResponseDTO = response.data;
    const assistantMsg: AssistantMessage = {
      id: `assist-${Date.now()}`,
      sender: 'assistant',
      text: resData.responseMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      actionConfirmation: resData.actionConfirmation,
      data: resData.data,
      status: resData.status,
    };

    const updatedMessages = [...get().messages, assistantMsg];
    set({
      messages: updatedMessages,
      isLoading: false,
      activeActionConfirmation: resData.actionConfirmation || null,
      error: null,
    });

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedMessages));
    } catch (e) {}
  },

  clearHistory: () => {
    const defaultMsg: AssistantMessage[] = [
      {
        id: 'welcome-msg',
        sender: 'assistant',
        text: 'Conversation cleared. How can I help you with your music today?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    set({
      messages: defaultMsg,
      isLoading: false,
      activeActionConfirmation: null,
      error: null,
    });
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(defaultMsg));
    } catch (e) {}
  },
}));
