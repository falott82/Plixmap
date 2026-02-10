import { create } from 'zustand';
import { ChatMessage } from '../api/chat';

interface ChatState {
  messagesByClientId: Record<string, ChatMessage[]>;
  clientNameById: Record<string, string>;
  // Used for WhatsApp-like ordering (DM list by last interaction).
  lastActivityByClientId: Record<string, number>;
  setMessages: (clientId: string, clientName: string, messages: ChatMessage[]) => void;
  upsertMessage: (clientId: string, message: ChatMessage) => void;
  patchMessage: (clientId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  clearClient: (clientId: string) => void;
}

const sortMessages = (list: ChatMessage[]) => list.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

export const useChatStore = create<ChatState>()((set) => ({
  messagesByClientId: {},
  clientNameById: {},
  lastActivityByClientId: {},
  setMessages: (clientId, clientName, messages) =>
    set((state) => {
      const sorted = sortMessages(Array.isArray(messages) ? messages : []);
      const lastAt = sorted.length ? Number(sorted[sorted.length - 1]?.createdAt || 0) || 0 : 0;
      return {
        messagesByClientId: { ...state.messagesByClientId, [clientId]: sorted },
        clientNameById: { ...state.clientNameById, [clientId]: String(clientName || '') },
        lastActivityByClientId: { ...state.lastActivityByClientId, [clientId]: lastAt }
      };
    }),
  upsertMessage: (clientId, message) =>
    set((state) => {
      const prev = state.messagesByClientId[clientId] || [];
      const idx = prev.findIndex((m) => m.id === message.id);
      const next = idx >= 0 ? prev.map((m, i) => (i === idx ? message : m)) : [...prev, message];
      const createdAt = Number(message?.createdAt || 0) || 0;
      const prevLast = Number(state.lastActivityByClientId[clientId] || 0) || 0;
      return {
        messagesByClientId: { ...state.messagesByClientId, [clientId]: sortMessages(next) },
        lastActivityByClientId: { ...state.lastActivityByClientId, [clientId]: Math.max(prevLast, createdAt) }
      };
    }),
  patchMessage: (clientId, messageId, patch) =>
    set((state) => {
      const prev = state.messagesByClientId[clientId] || [];
      const idx = prev.findIndex((m) => m.id === messageId);
      if (idx < 0) return {};
      const next = prev.map((m, i) => (i === idx ? ({ ...m, ...(patch || {}) } as any) : m));
      return { messagesByClientId: { ...state.messagesByClientId, [clientId]: sortMessages(next) } };
    }),
  clearClient: (clientId) =>
    set((state) => {
      const next = { ...state.messagesByClientId };
      delete next[clientId];
      const nextLast = { ...state.lastActivityByClientId };
      delete nextLast[clientId];
      return { messagesByClientId: next, lastActivityByClientId: nextLast };
    })
}));
