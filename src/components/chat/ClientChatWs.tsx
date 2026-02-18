import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { fetchChatUnread, fetchChatUnreadSenders, markChatRead } from '../../api/chat';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { useUIStore } from '../../store/useUIStore';
import { useT } from '../../i18n/useT';
import { createLogger } from '../../utils/logger';
import { closeSocketSafely, getWsUrl } from '../../utils/ws';

const logger = createLogger('client-chat-ws');

const ClientChatWs = () => {
  const t = useT();
  const user = useAuthStore((s) => s.user);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const readDebounceRef = useRef<Record<string, number>>({});
  const lastToastAtByClientRef = useRef<Record<string, number>>({});

  useEffect(() => {
    // Initial unread badge hydration.
    if (!user?.id) {
      useUIStore.getState().setChatUnreadByClientId({});
      useUIStore.getState().setChatUnreadSenderIds([]);
      return;
    }
    fetchChatUnread()
      .then((payload) => {
        useUIStore.getState().setChatUnreadByClientId(payload.unreadByClientId || {});
      })
      .catch(() => {
        // ignore
      });
    fetchChatUnreadSenders()
      .then((payload) => {
        useUIStore.getState().setChatUnreadSenderIds(payload.senderIds || []);
      })
      .catch(() => {
        // ignore
      });
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
      closeSocketSafely(wsRef.current);
      wsRef.current = null;
      return;
    }

    let alive = true;
    const connect = () => {
      if (!alive) return;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
      closeSocketSafely(wsRef.current);

      const ws = new WebSocket(getWsUrl());
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(String(ev.data || ''));
        } catch {
          return;
        }
        if (msg?.type === 'client_chat_new' && msg?.clientId && msg?.message?.id) {
          const clientId = String(msg.clientId);
          const message = msg.message;
          useChatStore.getState().upsertMessage(clientId, message);

          const ui = useUIStore.getState();
          const me = useAuthStore.getState().user;
          if (String(message.userId) === String(me?.id || '')) return;

          if (ui.clientChatOpen && ui.clientChatClientId === clientId) {
            ui.clearChatUnread(clientId);
            // Debounce read marking while chat is open.
            if (readDebounceRef.current[clientId]) window.clearTimeout(readDebounceRef.current[clientId]);
            readDebounceRef.current[clientId] = window.setTimeout(() => {
              markChatRead(clientId).catch(() => {});
            }, 400);
            return;
          }
          ui.bumpChatUnread(clientId, 1);
          ui.addChatUnreadSenderId(String(message.userId || ''));
          return;
        }
        if (msg?.type === 'dm_chat_new' && msg?.threadId && msg?.message?.id) {
          const threadId = String(msg.threadId);
          const message = msg.message;
          useChatStore.getState().upsertMessage(threadId, message);

          const ui = useUIStore.getState();
          const me = useAuthStore.getState().user;
          const fromMe = String(message.userId) === String(me?.id || '');
          if (!fromMe) {
            if (ui.clientChatOpen && ui.clientChatClientId === threadId) {
              ui.clearChatUnread(threadId);
              if (readDebounceRef.current[threadId]) window.clearTimeout(readDebounceRef.current[threadId]);
              readDebounceRef.current[threadId] = window.setTimeout(() => {
                markChatRead(threadId).catch(() => {});
              }, 350);
            } else {
              ui.bumpChatUnread(threadId, 1);
              ui.addChatUnreadSenderId(String(message.userId || ''));
              // Show DM toast only when the chat dock is closed.
              if (!msg?.backfill && !ui.clientChatOpen) {
                const now = Date.now();
                const last = Number(lastToastAtByClientRef.current[threadId] || 0);
                if (now - last > 1200) {
                  lastToastAtByClientRef.current[threadId] = now;
                  const fromRaw = String(message.username || '').trim();
                  const from = fromRaw ? (fromRaw.startsWith('@') ? fromRaw : `@${fromRaw}`) : t({ it: '@utente', en: '@user' });
                  toast.info(
                    t({
                      it: `Hai ricevuto un messaggio privato da ${from}`,
                      en: `You received a private message from ${from}`
                    }),
                    { duration: 5000, id: `dm-chat-new:${threadId}` }
                  );
                }
              }
            }
          }
          return;
        }
        if ((msg?.type === 'dm_chat_update' || msg?.type === 'dm_chat_receipt') && msg?.threadId && msg?.message?.id) {
          const threadId = String(msg.threadId);
          useChatStore.getState().upsertMessage(threadId, msg.message);
          return;
        }
        if (msg?.type === 'dm_chat_read' && msg?.threadId && Array.isArray(msg.messageIds)) {
          const threadId = String(msg.threadId);
          const readAt = typeof msg.readAt === 'number' ? msg.readAt : Date.now();
          for (const id of msg.messageIds) {
            const mid = String(id || '').trim();
            if (!mid) continue;
            useChatStore.getState().patchMessage(threadId, mid, { readAt });
          }
          return;
        }
        if (msg?.type === 'client_chat_update' && msg?.clientId && msg?.message?.id) {
          const clientId = String(msg.clientId);
          useChatStore.getState().upsertMessage(clientId, msg.message);
          return;
        }
        if (msg?.type === 'client_chat_read' && msg?.clientId) {
          // Read receipts are currently used only for message info UI; chat list is driven by unread counts.
          return;
        }
        if (msg?.type === 'client_chat_clear' && msg?.clientId) {
          const clientId = String(msg.clientId);
          useChatStore.getState().setMessages(clientId, '', []);
          useUIStore.getState().clearChatUnread(clientId);
        }
        if (msg?.type === 'global_presence' && msg.lockedPlans && typeof msg.lockedPlans === 'object') {
          // Keep sidebar lock badges alive even when PlanView is not mounted.
          useUIStore.getState().setLockedPlans(msg.lockedPlans);
        }
        if (msg?.type === 'global_presence' && Array.isArray(msg.users)) {
          const ids = msg.users.map((u: any) => String(u?.userId || '')).filter(Boolean);
          useUIStore.getState().setOnlineUserIds(ids);
        }
      };

      ws.onclose = () => {
        if (!alive) return;
        logger.warn('Chat websocket closed, scheduling reconnect');
        reconnectRef.current = window.setTimeout(connect, 1500);
      };
      ws.onerror = () => {
        logger.warn('Chat websocket error');
        closeSocketSafely(ws);
      };
    };

    connect();
    return () => {
      alive = false;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
      closeSocketSafely(wsRef.current);
      wsRef.current = null;
    };
  }, [user?.id]);

  return null;
};

export default ClientChatWs;
