import { create } from 'zustand';
import { ChatMessage } from '../api/chat';

interface ChatState {
  messagesByClientId: Record<string, ChatMessage[]>;
  clientNameById: Record<string, string>;
  setMessages: (clientId: string, clientName: string, messages: ChatMessage[]) => void;
  upsertMessage: (clientId: string, message: ChatMessage) => void;
  clearClient: (clientId: string) => void;
}

const sortMessages = (list: ChatMessage[]) => list.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

export const useChatStore = create<ChatState>()((set) => ({
  messagesByClientId: {},
  clientNameById: {},
  setMessages: (clientId, clientName, messages) =>
    set((state) => ({
      messagesByClientId: { ...state.messagesByClientId, [clientId]: sortMessages(Array.isArray(messages) ? messages : []) },
      clientNameById: { ...state.clientNameById, [clientId]: String(clientName || '') }
    })),
  upsertMessage: (clientId, message) =>
    set((state) => {
      const prev = state.messagesByClientId[clientId] || [];
      const idx = prev.findIndex((m) => m.id === message.id);
      const next = idx >= 0 ? prev.map((m, i) => (i === idx ? message : m)) : [...prev, message];
      return { messagesByClientId: { ...state.messagesByClientId, [clientId]: sortMessages(next) } };
    }),
  clearClient: (clientId) =>
    set((state) => {
      const next = { ...state.messagesByClientId };
      delete next[clientId];
      return { messagesByClientId: next };
    })
}));
