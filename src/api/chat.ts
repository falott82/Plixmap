import { apiFetch } from './client';

export interface ChatMessage {
  id: string;
  clientId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  // DM-only fields (WhatsApp-like checkmarks).
  toUserId?: string;
  deliveredAt?: number | null;
  readAt?: number | null;
  replyToId?: string | null;
  attachments?: { name: string; url: string; mime?: string; sizeBytes?: number }[];
  starredBy?: string[];
  reactions?: Record<string, string[]>;
  text: string;
  deleted: boolean;
  deletedAt: number | null;
  deletedById: string | null;
  editedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export const fetchChatUnread = async (): Promise<{ unreadByClientId: Record<string, number> }> => {
  const res = await apiFetch('/api/chat/unread', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch chat unread (${res.status})`);
  return res.json();
};

export const fetchChatMessages = async (
  clientId: string,
  options?: { limit?: number }
): Promise<{ clientId: string; clientName: string; lastReadAt: number; messages: ChatMessage[] }> => {
  const limit = Math.max(1, Math.min(500, Number(options?.limit) || 200));
  const res = await apiFetch(`/api/chat/${encodeURIComponent(clientId)}/messages?limit=${limit}`, {
    credentials: 'include',
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Failed to fetch chat messages (${res.status})`);
  return res.json();
};

export const fetchChatMembers = async (
  clientId: string
): Promise<{
  clientId: string;
  users: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    online: boolean;
    lastOnlineAt?: number | null;
    lastReadAt: number;
  }[];
  kind?: 'dm' | 'client';
  readOnly?: boolean;
}> => {
  const res = await apiFetch(`/api/chat/${encodeURIComponent(clientId)}/members`, {
    credentials: 'include',
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Failed to fetch chat members (${res.status})`);
  return res.json();
};

export const markChatRead = async (clientId: string): Promise<{ ok: boolean; lastReadAt: number }> => {
  const res = await apiFetch(`/api/chat/${encodeURIComponent(clientId)}/read`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Failed to mark chat read (${res.status})`);
  return res.json();
};

export const sendChatMessage = async (
  clientId: string,
  text: string,
  attachments?: { name: string; dataUrl: string }[],
  options?: { replyToId?: string | null }
): Promise<{ ok: boolean; message: ChatMessage }> => {
  const res = await apiFetch(`/api/chat/${encodeURIComponent(clientId)}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, ...(attachments?.length ? { attachments } : {}), ...(options?.replyToId ? { replyToId: options.replyToId } : {}) })
  });
  if (!res.ok) {
    const detail = await res
      .json()
      .then((j) => (j && typeof j === 'object' ? (j as any).error : ''))
      .catch(() => '');
    throw new Error(`Failed to send message (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  return res.json();
};

export const editChatMessage = async (id: string, text: string): Promise<{ ok: boolean; message: ChatMessage }> => {
  const res = await apiFetch(`/api/chat/messages/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error(`Failed to edit message (${res.status})`);
  return res.json();
};

export const deleteChatMessage = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/chat/messages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Failed to delete message (${res.status})`);
};

export const starChatMessage = async (id: string, star?: boolean): Promise<{ ok: boolean; message: ChatMessage }> => {
  const res = await apiFetch(`/api/chat/messages/${encodeURIComponent(id)}/star`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(typeof star === 'boolean' ? { star } : {})
  });
  if (!res.ok) throw new Error(`Failed to star message (${res.status})`);
  return res.json();
};

export const reactChatMessage = async (id: string, emoji: string): Promise<{ ok: boolean; message: ChatMessage }> => {
  const res = await apiFetch(`/api/chat/messages/${encodeURIComponent(id)}/react`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emoji })
  });
  if (!res.ok) throw new Error(`Failed to react message (${res.status})`);
  return res.json();
};

export const clearChat = async (clientId: string): Promise<void> => {
  const res = await apiFetch(`/api/chat/${encodeURIComponent(clientId)}/clear`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Failed to clear chat (${res.status})`);
};

export const exportChat = async (clientId: string, format: 'txt' | 'json' | 'html' = 'txt'): Promise<Blob> => {
  const res = await apiFetch(`/api/chat/${encodeURIComponent(clientId)}/export?format=${format}`, {
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Failed to export chat (${res.status})`);
  return res.blob();
};

export const fetchChatUnreadSenders = async (): Promise<{ count: number; senderIds: string[] }> => {
  const res = await apiFetch('/api/chat/unread-senders', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch unread senders (${res.status})`);
  return res.json();
};

export type DmContactRow = {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  online: boolean;
  lastOnlineAt: number | null;
  commonClients: { id: string; name: string; logoUrl?: string }[];
  canChat: boolean;
  readOnly: boolean;
  hasHistory: boolean;
  blockedByMe: boolean;
  blockedMe: boolean;
};

export const fetchDmContacts = async (): Promise<{ users: DmContactRow[] }> => {
  const res = await apiFetch('/api/chat/dm/contacts', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch DM contacts (${res.status})`);
  return res.json();
};

export const blockChatUser = async (userId: string): Promise<void> => {
  const res = await apiFetch(`/api/chat/blocks/${encodeURIComponent(userId)}`, {
    method: 'POST',
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Failed to block user (${res.status})`);
};

export const unblockChatUser = async (userId: string): Promise<void> => {
  const res = await apiFetch(`/api/chat/blocks/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  if (!res.ok) throw new Error(`Failed to unblock user (${res.status})`);
};
