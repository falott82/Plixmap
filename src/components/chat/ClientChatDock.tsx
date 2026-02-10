import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'sonner';
import { ChevronDown, Download, Paperclip, Send, Trash2, X, Pencil, Users, ArrowDownToLine, Star, CornerUpLeft, Info, Mic, Smile, Copy as CopyIcon, Search, ChevronUp } from 'lucide-react';
import { ChatMessage, clearChat, deleteChatMessage, editChatMessage, exportChat, fetchChatMembers, fetchChatMessages, markChatRead, reactChatMessage, sendChatMessage, starChatMessage } from '../../api/chat';
import { fetchUserProfile } from '../../api/userProfile';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { useUIStore } from '../../store/useUIStore';
import { useT } from '../../i18n/useT';
import UserAvatar from '../ui/UserAvatar';
import { useDataStore } from '../../store/useDataStore';

const MAX_NONVOICE_ATTACH_BYTES = 5 * 1024 * 1024;
const MAX_VOICE_SECONDS = 10 * 60;
const MAX_VOICE_BYTES = 40 * 1024 * 1024; // keep in sync with server default limit
const CHAT_REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '😢', '🙏'] as const;
const allowedExts = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'jfif',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'zip',
  'rar',
  'mp3',
  'wav',
  'm4a',
  'aac',
  'ogg',
  'mp4',
  'webm',
  'mov'
]);

const extForMime = (mime: string) => {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/png') return 'png';
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/jpg') return 'jpg';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/webp') return 'webp';
  if (m === 'application/pdf') return 'pdf';
  if (m === 'application/msword') return 'doc';
  if (m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'docx';
  if (m === 'application/vnd.ms-excel') return 'xls';
  if (m === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return 'xlsx';
  if (m === 'application/vnd.ms-powerpoint') return 'ppt';
  if (m === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') return 'pptx';
  if (m === 'application/zip') return 'zip';
  if (m === 'application/x-zip-compressed') return 'zip';
  if (m === 'application/vnd.rar') return 'rar';
  if (m === 'application/x-rar-compressed') return 'rar';
  if (m === 'audio/mpeg' || m === 'audio/mp3') return 'mp3';
  if (m === 'audio/wav' || m === 'audio/x-wav' || m === 'audio/wave') return 'wav';
  if (m === 'audio/mp4' || m === 'audio/x-m4a') return 'm4a';
  if (m === 'audio/aac') return 'aac';
  if (m === 'audio/ogg') return 'ogg';
  if (m === 'audio/webm') return 'webm';
  if (m === 'video/mp4') return 'mp4';
  if (m === 'video/webm') return 'webm';
  if (m === 'video/quicktime') return 'mov';
  if (m === 'image/heic' || m === 'image/heif') return 'heic';
  return '';
};

const safeFilename = (value: string) =>
  String(value || 'chat')
    .replace(/[^\w\- ]+/g, '')
    .trim()
    .slice(0, 40) || 'chat';

const snippet = (value: string, max = 90) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const extOf = (name: string) => {
  const s = String(name || '').trim();
  const idx = s.lastIndexOf('.');
  if (idx === -1) return '';
  return s.slice(idx + 1).toLowerCase();
};

const formatBytes = (bytes: number) => {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round((b / 1024) * 10) / 10} KB`;
  return `${Math.round((b / (1024 * 1024)) * 10) / 10} MB`;
};

const isVoiceRecordingAttachment = (name: string, mime: string) => {
  const n = String(name || '').toLowerCase();
  const m = String(mime || '').toLowerCase();
  return n.startsWith('voice-') && m.startsWith('audio/');
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n) || 0));

const formatMmSs = (secs: number) => {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const mm = String(Math.floor(s / 60)).padStart(1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
};

const capFirst = (value: string) => {
  const s = String(value || '').trim();
  if (!s) return '';
  return s[0].toUpperCase() + s.slice(1);
};

const capWords = (value: string) => {
  const s = String(value || '').trim();
  if (!s) return '';
  return s
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => capFirst(w))
    .join(' ');
};

const localDateKey = (ts: number) => {
  const d = new Date(Number(ts) || 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isAudioAttachment = (a: any) => {
  const mime = String(a?.mime || '').toLowerCase();
  const name = String(a?.name || '');
  const ext = extOf(name);
  if (mime.startsWith('audio/')) return true;
  if (!mime && ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm'].includes(ext)) return true;
  return false;
};

const hasAudioMessage = (msg: ChatMessage) => {
  const atts = Array.isArray(msg.attachments) ? msg.attachments : [];
  return atts.some((a) => isAudioAttachment(a));
};

const seededBars = (seed: string, count = 44) => {
  // Deterministic pseudo-random bars; avoids decoding audio (fast even for long voice notes).
  let x = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    x ^= seed.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    const v = (x >>> 0) / 0xffffffff;
    // Bias toward mid bars, WhatsApp-like.
    out.push(0.2 + Math.pow(v, 0.65) * 0.8);
  }
  return out;
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
};

  const canEditMessage = (msg: ChatMessage, myUserId: string) => {
    if (msg.deleted) return false;
    if (String(msg.userId) !== String(myUserId)) return false;
    if (hasAudioMessage(msg)) return false;
    const age = Date.now() - (Number(msg.createdAt) || 0);
    return age <= 30 * 60 * 1000;
  };

const ClientChatDock = () => {
  const t = useT();
  const { user, permissions } = useAuthStore();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const onlineUserIds = useUIStore((s) => (s as any).onlineUserIds || {});
  const setClientChatDockHeight = useUIStore((s) => (s as any).setClientChatDockHeight);
  const { clientChatOpen, clientChatClientId, openClientChat, closeClientChat, clearChatUnread, chatUnreadByClientId } =
    useUIStore((s) => ({
    clientChatOpen: s.clientChatOpen,
    clientChatClientId: s.clientChatClientId,
    openClientChat: (s as any).openClientChat,
    closeClientChat: s.closeClientChat,
    clearChatUnread: s.clearChatUnread,
    chatUnreadByClientId: (s as any).chatUnreadByClientId || {}
  }));
  const messages = useChatStore((s) => (clientChatClientId ? s.messagesByClientId[clientChatClientId] || [] : []));
  const clientNameFromStore = useChatStore((s) => (clientChatClientId ? s.clientNameById[clientChatClientId] : ''));
  const clientTree = useDataStore((s) =>
    (s.clients || []).map((c) => ({
      id: c.id,
      name: c.shortName || c.name,
      sites: (c.sites || []).map((site) => ({ id: site.id, floorPlans: (site.floorPlans || []).map((p) => ({ id: p.id })) }))
    }))
  );

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [members, setMembers] = useState<{ id: string; username: string; firstName: string; lastName: string; avatarUrl?: string; online: boolean; lastReadAt: number }[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [clearChatOpen, setClearChatOpen] = useState(false);
  const [clearChatTyped, setClearChatTyped] = useState('');
  const [clearChatBusy, setClearChatBusy] = useState(false);
  const [unstarConfirmId, setUnstarConfirmId] = useState<string | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<
    { id: string; name: string; sizeBytes: number; file: File; previewUrl?: string; kind?: 'image' | 'video' | 'audio' | 'file' }[]
  >([]);
  const pendingNonVoiceBytes = useMemo(() => {
    return pendingAttachments.reduce((sum: number, a) => {
      const isVoice = isVoiceRecordingAttachment(a.name, a.file?.type || '');
      if (isVoice) return sum;
      return sum + (Number(a.sizeBytes) || 0);
    }, 0);
  }, [pendingAttachments]);
  const pendingVoiceCount = useMemo(() => {
    return pendingAttachments.reduce((n: number, a) => (isVoiceRecordingAttachment(a.name, a.file?.type || '') ? n + 1 : n), 0);
  }, [pendingAttachments]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const clientPickerRef = useRef<HTMLDivElement | null>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [mediaModal, setMediaModal] = useState<{ url: string; name: string } | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [messageInfoId, setMessageInfoId] = useState<string | null>(null);
  const [messageInfoMembers, setMessageInfoMembers] = useState<typeof members>([]);
  const [messageInfoLoading, setMessageInfoLoading] = useState(false);
  const [actionMenu, setActionMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [reactPickerId, setReactPickerId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const reactPickerRef = useRef<HTMLDivElement | null>(null);
  const replyToIdRef = useRef<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchHitIdx, setSearchHitIdx] = useState(0);
  const [starredOpen, setStarredOpen] = useState(false);
  const [reactionsModal, setReactionsModal] = useState<{ messageId: string; tab: 'all' | string } | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState<{
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    clientsCommon: { id: string; name: string }[];
  } | null>(null);
  const [recording, setRecording] = useState(false);
  const recordStartAtRef = useRef<number>(0);
  const recordTimerRef = useRef<number | null>(null);
  const recordRafRef = useRef<number | null>(null);
  const recordStoppedForMaxRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const discardRecordingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformBufRef = useRef<number[]>([]);
  const waveformLastPushAtRef = useRef<number>(0);
  const [waveform, setWaveform] = useState<number[]>([]);

  const clientName = useMemo(() => {
    if (!clientChatClientId) return '';
    return clientNameFromStore || clientChatClientId;
  }, [clientChatClientId, clientNameFromStore]);

  const clientLogoUrl = useMemo(() => {
    if (!clientChatClientId) return '';
    const c = (clientTree || []).find((x) => String(x.id) === String(clientChatClientId));
    return String((c as any)?.logoUrl || '');
  }, [clientChatClientId, clientTree]);

  const clientInitial = useMemo(() => {
    const n = String(clientName || '').trim();
    return (n ? n[0] : '?').toUpperCase();
  }, [clientName]);

  useEffect(() => {
    replyToIdRef.current = replyToId;
  }, [replyToId]);

  useEffect(() => {
    if (!clientChatOpen) return;
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined' || typeof setClientChatDockHeight !== 'function') return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setClientChatDockHeight(Math.round(r.height || 0));
    };
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => {
      ro.disconnect();
      setClientChatDockHeight(0);
    };
  }, [clientChatOpen, setClientChatDockHeight]);

  const canChatClientIds = useMemo(() => {
    const out = new Set<string>();
    if (user?.isAdmin || user?.isSuperAdmin) {
      for (const c of clientTree || []) out.add(c.id);
      return out;
    }
    const siteToClient = new Map<string, string>();
    const planToClient = new Map<string, string>();
    for (const c of clientTree || []) {
      for (const s of c.sites || []) {
        siteToClient.set(s.id, c.id);
        for (const p of s.floorPlans || []) planToClient.set(p.id, c.id);
      }
    }
    for (const p of permissions || []) {
      if (!(p as any)?.chat) continue;
      if (p.scopeType === 'client') out.add(p.scopeId);
      if (p.scopeType === 'site') {
        const clientId = siteToClient.get(p.scopeId);
        if (clientId) out.add(clientId);
      }
      if (p.scopeType === 'plan') {
        const clientId = planToClient.get(p.scopeId);
        if (clientId) out.add(clientId);
      }
    }
    return out;
  }, [clientTree, permissions, user?.isAdmin, user?.isSuperAdmin]);

  const chatClients = useMemo(() => {
    return (clientTree || [])
      .filter((c) => canChatClientIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, logoUrl: (c as any)?.logoUrl }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [canChatClientIds, clientTree]);

  const membersSorted = useMemo(() => {
    const list = Array.isArray(members) ? members.slice() : [];
    const onlineOf = (m: any) => !!(onlineUserIds as any)?.[m?.id] || !!m?.online;
    list.sort((a, b) => {
      const ao = onlineOf(a) ? 1 : 0;
      const bo = onlineOf(b) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return String(a.username || '').localeCompare(String(b.username || ''));
    });
    return list;
  }, [members, onlineUserIds]);

  const membersById = useMemo(() => {
    const m = new Map<string, (typeof members)[number]>();
    for (const u of members || []) {
      if (!u?.id) continue;
      m.set(String(u.id), u);
    }
    return m;
  }, [members]);

  const messagesById = useMemo(() => {
    const map = new Map<string, ChatMessage>();
    for (const m of messages || []) {
      if (!m?.id) continue;
      map.set(String(m.id), m);
    }
    return map;
  }, [messages]);

  const messageInfoMembersSorted = useMemo(() => {
    const list = Array.isArray(messageInfoMembers) ? messageInfoMembers.slice() : [];
    const onlineOf = (m: any) => !!(onlineUserIds as any)?.[m?.id] || !!m?.online;
    list.sort((a, b) => {
      const ao = onlineOf(a) ? 1 : 0;
      const bo = onlineOf(b) ? 1 : 0;
      if (ao !== bo) return bo - ao;
      return String(a.username || '').localeCompare(String(b.username || ''));
    });
    return list;
  }, [messageInfoMembers, onlineUserIds]);

  const helpItems = useMemo(() => {
    const voiceMins = Math.round(MAX_VOICE_SECONDS / 60);
    return [
      { k: 'Enter', v: t({ it: 'Invia messaggio', en: 'Send message' }) },
      { k: 'Shift+Enter', v: t({ it: 'A capo', en: 'New line' }) },
      { k: 'Alt+M', v: t({ it: 'Modifica ultimo messaggio (entro 30 minuti)', en: 'Edit last message (within 30 minutes)' }) },
      { k: t({ it: 'Allegati', en: 'Attachments' }), v: t({ it: `max totale ${formatBytes(MAX_NONVOICE_ATTACH_BYTES)}`, en: `max total ${formatBytes(MAX_NONVOICE_ATTACH_BYTES)}` }) },
      { k: t({ it: 'Vocali', en: 'Voice notes' }), v: t({ it: `max ${voiceMins} minuti`, en: `max ${voiceMins} minutes` }) }
    ];
  }, [t]);

  const starredMessages = useMemo(() => {
    const myId = String(user?.id || '');
    if (!myId) return [];
    return (messages || []).filter((m) => {
      if (!m || m.deleted) return false;
      const list = Array.isArray((m as any).starredBy) ? ((m as any).starredBy as string[]) : [];
      return list.some((id) => String(id) === myId);
    });
  }, [messages, user?.id]);

  const searchHits = useMemo(() => {
    const q = String(searchQ || '').trim().toLowerCase();
    if (!q) return [];
    const out: string[] = [];
    for (const m of messages || []) {
      if (!m?.id || m.deleted) continue;
      const hay = `${String(m.username || '')} ${String(m.text || '')}`.toLowerCase();
      if (hay.includes(q)) out.push(String(m.id));
    }
    return out;
  }, [messages, searchQ]);

  useEffect(() => {
    setSearchHitIdx(0);
  }, [searchQ, clientChatClientId]);

  useEffect(() => {
    if (!searchOpen) return;
    if (!searchHits.length) return;
    const id = searchHits[Math.max(0, Math.min(searchHitIdx, searchHits.length - 1))];
    if (id) window.setTimeout(() => scrollToMessage(id), 0);
  }, [searchHitIdx, searchHits, searchOpen]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  const scrollToBottomSoon = () => {
    // Two rAFs to ensure layout/scrollHeight are correct after store updates.
    window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToBottom));
  };

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`chatmsg-${id}`);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      el.scrollIntoView();
    }
  };

  useEffect(() => {
    if (!clientChatOpen || !clientChatClientId || !user?.id) return;
    setErr(null);
    setLoading(true);
    setExportOpen(false);
    setMembersOpen(false);
    setClientPickerOpen(false);
    fetchChatMessages(clientChatClientId, { limit: 300 })
      .then((payload) => {
        useChatStore.getState().setMessages(clientChatClientId, payload.clientName || '', payload.messages || []);
        clearChatUnread(clientChatClientId);
        markChatRead(clientChatClientId).catch(() => {});
        scrollToBottomSoon();
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : 'Failed to load chat');
      })
      .finally(() => setLoading(false));
  }, [clearChatUnread, clientChatClientId, clientChatOpen, user?.id]);

  const needsInitialScrollRef = useRef(false);
  const lastOpenRef = useRef(false);
  const lastClientRef = useRef<string | null>(null);
  useEffect(() => {
    if (clientChatOpen && clientChatClientId && (!lastOpenRef.current || lastClientRef.current !== clientChatClientId)) {
      needsInitialScrollRef.current = true;
      lastOpenRef.current = true;
      lastClientRef.current = clientChatClientId;
    }
    if (!clientChatOpen) {
      lastOpenRef.current = false;
      lastClientRef.current = null;
      needsInitialScrollRef.current = false;
    }
  }, [clientChatClientId, clientChatOpen]);

  useEffect(() => {
    if (!clientChatOpen) return;
    if (!needsInitialScrollRef.current) return;
    if (!messages.length) return;
    needsInitialScrollRef.current = false;
    scrollToBottomSoon();
  }, [clientChatOpen, messages.length]);

  useEffect(() => {
    if (!clientChatOpen || !clientChatClientId || !user?.id) return;
    setMembersLoading(true);
    fetchChatMembers(clientChatClientId)
      .then((payload) => {
        setMembers(Array.isArray(payload.users) ? payload.users : []);
      })
      .catch(() => {
        setMembers([]);
      })
      .finally(() => setMembersLoading(false));
  }, [clientChatClientId, clientChatOpen, user?.id]);

  useEffect(() => {
    if (!clientChatOpen) return;
    // Dismiss "new chat message" toasts once the chat is opened.
    for (const c of chatClients || []) {
      toast.dismiss(`client-chat-new:${c.id}`);
    }
  }, [chatClients, clientChatOpen]);

  useEffect(() => {
    if (!clientChatOpen) return;
    // WhatsApp-like: when opening the chat, focus the composer.
    window.setTimeout(() => composeTextareaRef.current?.focus(), 0);
  }, [clientChatClientId, clientChatOpen]);

  useEffect(() => {
    if (!actionMenu && !reactPickerId) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target) {
        if (actionMenuRef.current?.contains(target)) return;
        if (reactPickerRef.current?.contains(target)) return;
      }
      setActionMenu(null);
      setReactPickerId(null);
    };
    // Capture phase so we reliably close on outside clicks without causing "click-through" on menu items.
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [actionMenu, reactPickerId]);

  useEffect(() => {
    if (clientChatOpen) return;
    // Cleanup previews when chat closes.
    setPendingAttachments((prev) => {
      for (const a of prev) {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      }
      return [];
    });
    setReplyToId(null);
    setMessageInfoId(null);
    setMessageInfoMembers([]);
    setMessageInfoLoading(false);
    // Stop any active recording and release the microphone.
    try {
      recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;
    if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    try {
      recordStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    recordStreamRef.current = null;
    recordChunksRef.current = [];
    setRecording(false);
    setRecordSeconds(0);
    setSending(false);
    setEditingId(null);
    setEditingText('');
    setText('');
  }, [clientChatOpen]);

  useEffect(() => {
    if (!clientChatOpen) return;
    scrollToBottomSoon();
  }, [clientChatOpen, messages.length]);

  useEffect(() => {
    if (!editingId) return;
    window.setTimeout(() => {
      const el = editTextareaRef.current;
      if (!el) return;
      el.focus();
      try {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      } catch {
        // ignore
      }
    }, 0);
  }, [editingId]);

  // Export and members are rendered as centered modals (not header dropdowns),
  // so they don't need "click-outside" handlers here.

  useEffect(() => {
    if (!clientPickerOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (clientPickerRef.current?.contains(target)) return;
      setClientPickerOpen(false);
    };
    window.addEventListener('mousedown', onDown, true);
    return () => window.removeEventListener('mousedown', onDown, true);
  }, [clientPickerOpen]);

  useEffect(() => {
    if (!clientChatOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const key = String(e.key || '').toLowerCase();
      if (key !== 'm') return;
      if (!user?.id) return;
      // Edit last message (within 30 minutes) without needing mouse.
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (!m) continue;
        if (String(m.userId) !== String(user.id)) continue;
        if (!canEditMessage(m, user.id)) continue;
        e.preventDefault();
        setEditingId(m.id);
        setEditingText(m.text || '');
        return;
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [clientChatOpen, messages, user?.id]);

  useEffect(() => {
    if (!reactPickerId) reactPickerRef.current = null;
  }, [reactPickerId]);

  useEffect(() => {
    if (!reactionsModal) return;
    const msg = reactionsModal ? messagesById.get(reactionsModal.messageId) : null;
    if (!msg) return;
    const reactions =
      (msg as any).reactions && typeof (msg as any).reactions === 'object' ? ((msg as any).reactions as Record<string, string[]>) : {};
    const emojis = CHAT_REACTIONS.filter((e) => Array.isArray(reactions[e]) && reactions[e]!.length);
    const total = emojis.reduce((sum, e) => sum + (Array.isArray(reactions[e]) ? reactions[e]!.length : 0), 0);
    if (!total) {
      setReactionsModal(null);
      return;
    }
    if (reactionsModal.tab !== 'all') {
      const tab = String(reactionsModal.tab);
      const list = Array.isArray(reactions[tab]) ? reactions[tab]! : [];
      if (!list.length) setReactionsModal({ messageId: reactionsModal.messageId, tab: 'all' });
    }
  }, [messagesById, reactionsModal]);

  const openUserProfile = async (userId: string) => {
    const id = String(userId || '').trim();
    if (!id) return;
    setProfileUserId(id);
    setProfileLoading(true);
    setProfileData(null);
    try {
      const res = await fetchUserProfile(id);
      setProfileData(res);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load profile');
      setProfileUserId(null);
      setProfileData(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const send = async () => {
    if (!clientChatClientId || !user?.id) return;
    if (sending) return;
    const trimmed = text.replace(/\r\n/g, '\n').trim();
    const toSend = pendingAttachments.slice(0, 10);
    if (!trimmed && !toSend.length) return;
    if (pendingNonVoiceBytes > MAX_NONVOICE_ATTACH_BYTES) {
      setErr(
        t({
          it: `Allegati troppo grandi: max totale ${formatBytes(MAX_NONVOICE_ATTACH_BYTES)}.`,
          en: `Attachments too large: max total ${formatBytes(MAX_NONVOICE_ATTACH_BYTES)}.`
        })
      );
      return;
    }
    setSending(true);
    try {
      const atts = [];
      for (const a of toSend) {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(new Error('read'));
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(a.file);
        }).catch(() => '');
        if (!dataUrl.startsWith('data:') || !dataUrl.includes(';base64,')) {
          throw new Error(t({ it: `Errore lettura file: ${a.name}`, en: `Failed to read file: ${a.name}` }));
        }
        atts.push({ name: a.name, dataUrl });
      }
      const res = await sendChatMessage(clientChatClientId, trimmed, atts.length ? atts : undefined, {
        replyToId
      });
      useChatStore.getState().upsertMessage(clientChatClientId, res.message);
      clearChatUnread(clientChatClientId);
      setErr(null);
      setText('');
      setReplyToId(null);
      setPendingAttachments((prev) => {
        for (const a of prev) {
          if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
        }
        return [];
      });
      scrollToBottomSoon();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const startEdit = (msg: ChatMessage) => {
    setEditingId(msg.id);
    setEditingText(msg.text || '');
  };

  const startReply = (msg: ChatMessage) => {
    if (msg.deleted) return;
    setReplyToId(msg.id);
    window.setTimeout(() => composeTextareaRef.current?.focus(), 0);
  };

  const copyMessageText = async (msg: ChatMessage) => {
    if (msg.deleted) return;
    const value = String(msg.text || '');
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setErr(null);
      toast.success(t({ it: 'Copiato.', en: 'Copied.' }));
    } catch {
      // fallback
      try {
        const el = document.createElement('textarea');
        el.value = value;
        el.style.position = 'fixed';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        setErr(null);
        toast.success(t({ it: 'Copiato.', en: 'Copied.' }));
      } catch {
        setErr(t({ it: 'Impossibile copiare.', en: 'Unable to copy.' }));
      }
    }
  };

  const openActionMenuFor = (msg: ChatMessage, anchor: HTMLElement) => {
    const r = anchor.getBoundingClientRect();
    setActionMenu({ id: msg.id, x: Math.round(r.right), y: Math.round(r.bottom) });
  };

  const toggleStar = async (msg: ChatMessage) => {
    if (!clientChatClientId || !user?.id) return;
    if (msg.deleted) return;
    const starredBy = Array.isArray((msg as any).starredBy) ? ((msg as any).starredBy as string[]) : [];
    const starred = starredBy.some((id) => String(id) === String(user.id));
    try {
      const res = await starChatMessage(msg.id, !starred);
      useChatStore.getState().upsertMessage(clientChatClientId, res.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to star');
    }
  };

  const toggleReaction = async (msg: ChatMessage, emoji: string) => {
    if (!clientChatClientId || !user?.id) return;
    if (msg.deleted) return;
    if (!(CHAT_REACTIONS as readonly string[]).includes(String(emoji))) return;
    try {
      const res = await reactChatMessage(msg.id, emoji);
      useChatStore.getState().upsertMessage(clientChatClientId, res.message);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to react');
    }
  };

  const openMessageInfo = async (msg: ChatMessage) => {
    if (!clientChatClientId) return;
    setMessageInfoId(msg.id);
    setMessageInfoLoading(true);
    try {
      const payload = await fetchChatMembers(clientChatClientId);
      setMessageInfoMembers(Array.isArray(payload.users) ? payload.users : []);
    } catch {
      setMessageInfoMembers([]);
    } finally {
      setMessageInfoLoading(false);
    }
  };

  const commitEdit = async () => {
    if (!editingId || !clientChatClientId) return;
    const trimmed = editingText.replace(/\r\n/g, '\n').trim();
    if (!trimmed) return;
    try {
      const res = await editChatMessage(editingId, trimmed);
      useChatStore.getState().upsertMessage(clientChatClientId, res.message);
      setEditingId(null);
      setEditingText('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to edit');
    }
  };

  const remove = async (msg: ChatMessage) => {
    if (!clientChatClientId) return;
    if (!window.confirm(t({ it: 'Eliminare questo messaggio?', en: 'Delete this message?' }))) return;
    try {
      await deleteChatMessage(msg.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    }
  };

  const doClearChat = async () => {
    if (!clientChatClientId) return;
    if (clearChatBusy) return;
    if (String(clearChatTyped || '').trim() !== 'DELETE') return;
    setClearChatBusy(true);
    try {
      await clearChat(clientChatClientId);
      useChatStore.getState().setMessages(clientChatClientId, clientName, []);
      clearChatUnread(clientChatClientId);
      setClearChatOpen(false);
      setClearChatTyped('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to clear');
    } finally {
      setClearChatBusy(false);
    }
  };

  const doExport = async (format: 'txt' | 'json') => {
    if (!clientChatClientId) return;
    try {
      const blob = await exportChat(clientChatClientId, format);
      downloadBlob(blob, `chat-${safeFilename(clientName)}.${format}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to export');
    }
  };

  const pickFiles = () => fileInputRef.current?.click();

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
    } catch {}
  };

  const cancelRecording = () => {
    discardRecordingRef.current = true;
    stopRecording();
  };

  const sendVoiceFileNow = async (file: File) => {
    if (!clientChatClientId || !user?.id) return;
    if (!file) return;
    if (sending) {
      throw new Error(t({ it: 'Invio in corso. Riprova.', en: 'Send in progress. Please try again.' }));
    }
    setSending(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      }).catch(() => '');
      if (!dataUrl.startsWith('data:') || !dataUrl.includes(';base64,')) {
        throw new Error(t({ it: `Errore lettura vocale.`, en: `Failed to read voice note.` }));
      }
      const res = await sendChatMessage(clientChatClientId, '', [{ name: file.name, dataUrl }], {
        replyToId: replyToIdRef.current
      });
      useChatStore.getState().upsertMessage(clientChatClientId, res.message);
      clearChatUnread(clientChatClientId);
      setErr(null);
      setReplyToId(null);
      scrollToBottomSoon();
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(t({ it: 'Microfono non supportato dal browser.', en: 'Microphone not supported by this browser.' }));
      return;
    }
    // Chrome (and most browsers) require a secure context for getUserMedia unless on localhost.
    // When running Deskly on plain http://<lan-ip>, the browser will deny without prompting.
    if (!window.isSecureContext) {
      const host = window.location?.hostname || '';
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!isLocalhost) {
        setErr(
          t({
            it: `Il microfono in Chrome funziona solo su HTTPS (o su http://localhost). Apri Deskly in HTTPS per usare i vocali. Origin: ${window.location?.origin || ''}`,
            en: `Microphone requires HTTPS (or http://localhost). Open Deskly in HTTPS to record voice notes. Origin: ${window.location?.origin || ''}`
          })
        );
        return;
      }
    }
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      discardRecordingRef.current = false;
      setWaveform([]);
      waveformBufRef.current = [];
      waveformLastPushAtRef.current = 0;

      // Real-time waveform preview (WhatsApp-like).
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        analyserRef.current = analyser;
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          const a = analyserRef.current;
          if (!a) return;
          a.getByteTimeDomainData(buf);
          // RMS amplitude, normalized 0..1
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.min(1, Math.sqrt(sum / buf.length));
          // Make it visually closer to WhatsApp (more reactive on low volume).
          const leveled = Math.min(1, Math.max(0, Math.pow(Math.max(0, rms - 0.01), 0.45) * 1.15));
          const now = Date.now();
          // Push ~14 samples/sec to keep UI smooth without rerendering every frame.
          if (now - waveformLastPushAtRef.current > 70) {
            waveformLastPushAtRef.current = now;
            const next = waveformBufRef.current.slice();
            next.push(leveled);
            // Keep a short history for the preview strip.
            while (next.length > 90) next.shift();
            waveformBufRef.current = next;
            setWaveform(next);
          }
          recordRafRef.current = window.requestAnimationFrame(tick);
        };
        recordRafRef.current = window.requestAnimationFrame(tick);
      } catch {
        // ignore waveform errors (still allow recording)
      }
      const pickMime = () => {
        const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg'];
        for (const m of candidates) {
          try {
            if (typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported?.(m)) return m;
          } catch {}
        }
        return '';
      };
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;
      recordChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) recordChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const chunks = recordChunksRef.current.slice();
        recordChunksRef.current = [];
        if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
        if (recordRafRef.current) window.cancelAnimationFrame(recordRafRef.current);
        recordRafRef.current = null;
        analyserRef.current = null;
        try {
          audioCtxRef.current?.close?.();
        } catch {}
        audioCtxRef.current = null;
        setRecording(false);
        setRecordSeconds(0);
        try {
          recordStreamRef.current?.getTracks()?.forEach((t) => t.stop());
        } catch {}
        recordStreamRef.current = null;

        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          setWaveform([]);
          waveformBufRef.current = [];
          return;
        }

        if (!chunks.length) return;
        const rawType = String(rec.mimeType || mimeType || 'audio/webm');
        const baseType = rawType.split(';')[0] || 'audio/webm';
        const blob = new Blob(chunks, { type: baseType });
        const ext = extForMime(baseType) || 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: baseType });
        if ((Number(file.size) || 0) > MAX_VOICE_BYTES) {
          setErr(
            t({
              it: `Vocale troppo grande. Riprova con una registrazione piu breve.`,
              en: `Voice note too large. Please record a shorter message.`
            })
          );
          return;
        }
        try {
          await sendVoiceFileNow(file);
        } catch (e) {
          // Fallback: keep it as a pending attachment if auto-send fails.
          setErr(e instanceof Error ? e.message : t({ it: 'Errore invio vocale.', en: 'Failed to send voice note.' }));
          await onFilesPicked([file]);
        }
      };

      recordStartAtRef.current = Date.now();
      setRecording(true);
      setRecordSeconds(0);
      recordStoppedForMaxRef.current = false;
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - recordStartAtRef.current) / 1000);
        const safe = Math.max(0, secs);
        setRecordSeconds(safe);
        if (safe >= MAX_VOICE_SECONDS) {
          // auto-stop at 10 minutes
          if (!recordStoppedForMaxRef.current) {
            recordStoppedForMaxRef.current = true;
            setErr(t({ it: 'Registrazione fermata: massimo 10 minuti.', en: 'Recording stopped: max 10 minutes.' }));
            try {
              stopRecording();
            } catch {}
          }
        }
      }, 250);
      rec.start();
    } catch (e) {
      const errAny = e as any;
      const name = String(errAny?.name || '');
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setErr(
          t({
            it:
              'Permesso microfono negato o bloccato dal browser. Controlla il permesso del sito (icona lucchetto nella barra indirizzi) e riprova.',
            en:
              'Microphone permission denied or blocked by the browser. Check site permissions (lock icon in the address bar) and try again.'
          })
        );
      } else if (name === 'NotFoundError') {
        setErr(t({ it: 'Nessun microfono trovato sul dispositivo.', en: 'No microphone found on this device.' }));
      } else if (name === 'NotReadableError') {
        setErr(
          t({
            it: 'Impossibile accedere al microfono (forse è già in uso da un’altra app).',
            en: 'Unable to access the microphone (it may be in use by another app).'
          })
        );
      } else {
        setErr(e instanceof Error ? e.message : t({ it: 'Accesso al microfono negato.', en: 'Microphone access denied.' }));
      }
      try {
        recordStreamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
      recordStreamRef.current = null;
      recorderRef.current = null;
      recordChunksRef.current = [];
      setRecording(false);
      setRecordSeconds(0);
      recordStoppedForMaxRef.current = false;
      if (recordRafRef.current) window.cancelAnimationFrame(recordRafRef.current);
      recordRafRef.current = null;
      analyserRef.current = null;
      try {
        audioCtxRef.current?.close?.();
      } catch {}
      audioCtxRef.current = null;
      setWaveform([]);
      waveformBufRef.current = [];
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const formatRec = (secs: number) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const VoiceNoteAttachment = ({
    url,
    mine,
    seed,
    sizeBytes
  }: {
    url: string;
    mine: boolean;
    seed: string;
    sizeBytes?: number;
  }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [dur, setDur] = useState(0);
    const [cur, setCur] = useState(0);
    const [playing, setPlaying] = useState(false);
    const rafRef = useRef<number | null>(null);
    const rafLastTsRef = useRef<number>(0);
    const bars = useMemo(() => seededBars(seed, 48), [seed]);
    const pct = dur > 0 ? clamp01(cur / dur) : 0;

    useEffect(() => {
      const el = audioRef.current;
      if (!el) return;
      const onMeta = () => setDur(Number(el.duration) || 0);
      const onTime = () => setCur(Number(el.currentTime) || 0);
      const onSeeked = () => setCur(Number(el.currentTime) || 0);
      const startRaf = () => {
        if (rafRef.current) return;
        rafLastTsRef.current = 0;
        const tick = (ts: number) => {
          const a = audioRef.current;
          if (!a) return;
          if (a.paused) {
            rafRef.current = null;
            return;
          }
          // ~60fps is ok for a single playing voice note.
          if (!rafLastTsRef.current || ts - rafLastTsRef.current > 16) {
            rafLastTsRef.current = ts;
            setCur(Number(a.currentTime) || 0);
          }
          rafRef.current = window.requestAnimationFrame(tick);
        };
        rafRef.current = window.requestAnimationFrame(tick);
      };
      const stopRaf = () => {
        if (!rafRef.current) return;
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      };
      const onPlay = () => {
        setPlaying(true);
        startRaf();
      };
      const onPause = () => {
        setPlaying(false);
        stopRaf();
        setCur(Number(el.currentTime) || 0);
      };
      const onEnd = () => {
        setPlaying(false);
        stopRaf();
        try {
          el.currentTime = 0;
        } catch {}
        setCur(0);
      };
      el.addEventListener('loadedmetadata', onMeta);
      el.addEventListener('timeupdate', onTime);
      el.addEventListener('seeked', onSeeked);
      el.addEventListener('play', onPlay);
      el.addEventListener('pause', onPause);
      el.addEventListener('ended', onEnd);
      return () => {
        if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        el.removeEventListener('loadedmetadata', onMeta);
        el.removeEventListener('timeupdate', onTime);
        el.removeEventListener('seeked', onSeeked);
        el.removeEventListener('play', onPlay);
        el.removeEventListener('pause', onPause);
        el.removeEventListener('ended', onEnd);
      };
    }, []);

    const toggle = async () => {
      const el = audioRef.current;
      if (!el) return;
      try {
        if (el.paused) await el.play();
        else el.pause();
      } catch {
        // ignore
      }
    };

    const seekToPct = (p: number) => {
      const el = audioRef.current;
      if (!el || !dur) return;
      const next = clamp01(p) * dur;
      el.currentTime = next;
      setCur(next);
    };

    const bg = mine ? 'bg-emerald-950/35 border-emerald-400/20' : 'bg-slate-950/25 border-slate-700';
    const waveFg = mine ? 'bg-emerald-100/80' : 'bg-slate-200/70';
    const waveBg = mine ? 'bg-emerald-200/20' : 'bg-slate-200/15';

    return (
	      <div className={`w-full rounded-2xl border ${bg} px-3 py-2`}>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className={`flex h-10 w-10 items-center justify-center rounded-full border ${
              mine ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50' : 'border-slate-700 bg-slate-900/40 text-slate-100'
            }`}
            title={playing ? t({ it: 'Pausa', en: 'Pause' }) : t({ it: 'Play', en: 'Play' })}
            aria-label={playing ? t({ it: 'Pausa', en: 'Pause' }) : t({ it: 'Play', en: 'Play' })}
          >
            {playing ? (
              <span className="inline-flex gap-1">
                <span className="h-4 w-1.5 rounded-sm bg-current" />
                <span className="h-4 w-1.5 rounded-sm bg-current" />
              </span>
            ) : (
              <span className="ml-0.5 inline-block h-0 w-0 border-y-[7px] border-y-transparent border-l-[10px] border-l-current" />
            )}
          </button>

          <div className="min-w-0 flex-1">
	            <div
	              className="relative h-10 cursor-pointer select-none"
              onMouseDown={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const p = rect.width ? (e.clientX - rect.left) / rect.width : 0;
                seekToPct(p);
              }}
              title={t({ it: 'Trascina per avanzare', en: 'Drag to seek' })}
            >
	              <div className={`absolute inset-0 rounded-xl ${waveBg}`} />
	              <div className="absolute inset-0 flex items-center justify-between px-0">
	                {bars.map((v, i) => {
	                  const barPct = bars.length > 1 ? i / (bars.length - 1) : 0;
	                  const active = barPct <= pct;
	                  const h = 4 + Math.round(v * 16);
	                  return (
	                    <span
	                      key={i}
	                      className={`w-[2px] rounded-full ${active ? waveFg : ''}`}
	                      style={{
	                        height: `${h}px`,
	                        backgroundColor: active ? undefined : 'rgba(255,255,255,0.18)'
	                      }}
	                    />
	                  );
	                })}
	              </div>
	              <span
	                className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border ${
	                  mine ? 'border-emerald-100/70 bg-emerald-100' : 'border-slate-100/70 bg-slate-100'
	                }`}
	                style={{ left: `clamp(0px, calc(${pct * 100}% - 6px), calc(100% - 12px))` }}
	              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
              <span className="tabular-nums">{formatMmSs(dur || cur || 0)}</span>
              {typeof sizeBytes === 'number' && sizeBytes > 0 ? (
                <span className="tabular-nums text-slate-400">{formatBytes(sizeBytes)}</span>
              ) : (
                <span />
              )}
            </div>
          </div>
        </div>
        <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
      </div>
    );
  };

  const onFilesPicked = async (picked: File[]) => {
    if (!picked?.length) return;
    const next: { id: string; name: string; sizeBytes: number; file: File; previewUrl?: string; kind?: 'image' | 'video' | 'audio' | 'file' }[] = [];
    let runningTotal = pendingNonVoiceBytes;
    let skippedForTotal = 0;
    for (const f of picked) {
      const sizeBytes = Number(f.size) || 0;
      if (sizeBytes <= 0) continue;
      const voice = isVoiceRecordingAttachment(f.name, f.type || '');
      if (!voice && sizeBytes > MAX_NONVOICE_ATTACH_BYTES) {
        setErr(
          t({ it: `File troppo grande (max 5MB): ${f.name}`, en: `File too large (max 5MB): ${f.name}` })
        );
        continue;
      }
      if (!voice && runningTotal + sizeBytes > MAX_NONVOICE_ATTACH_BYTES) {
        skippedForTotal += 1;
        continue;
      }
      const ext = extOf(f.name);
      const mimeExt = extForMime(f.type || '');
      if (mimeExt === 'heic') {
        setErr(
          t({
            it: `Formato non supportato (HEIC/HEIF): ${f.name}. Converti in JPG/PNG.`,
            en: `Unsupported format (HEIC/HEIF): ${f.name}. Convert to JPG/PNG.`
          })
        );
        continue;
      }
      // Be permissive like WhatsApp: accept based on MIME even if extension is missing or uncommon.
      const okByExt = !!ext && allowedExts.has(ext);
      const okByMime = !!mimeExt && allowedExts.has(mimeExt);
      if (!okByExt && !okByMime) {
        setErr(t({ it: `Tipo file non supportato: ${f.name}`, en: `Unsupported file type: ${f.name}` }));
        continue;
      }
      const mime = String(f.type || '').toLowerCase();
      const isImg = mime.startsWith('image/') || (!mime && ['png', 'jpg', 'jpeg', 'gif', 'webp', 'jfif'].includes(ext || mimeExt));
      const isAud = mime.startsWith('audio/') || (!mime && ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext || mimeExt));
      const isVid = (mime.startsWith('video/') || (!mime && ['mp4', 'webm', 'mov'].includes(ext || mimeExt))) && !isAud;
      const previewUrl = isImg || isVid || isAud ? URL.createObjectURL(f) : undefined;
      next.push({
        id: (crypto as any)?.randomUUID?.() ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`,
        name: f.name,
        sizeBytes,
        file: f,
        previewUrl,
        kind: isImg ? 'image' : isVid ? 'video' : isAud ? 'audio' : 'file'
      });
      if (!voice) runningTotal += sizeBytes;
    }
    if (next.length) {
      setPendingAttachments((prev) => [...prev, ...next].slice(0, 10));
    }
    if (skippedForTotal) {
      setErr(
        t({
          it: `Allegati troppo grandi: max totale ${formatBytes(MAX_NONVOICE_ATTACH_BYTES)}. Alcuni file non sono stati aggiunti.`,
          en: `Attachments too large: max total ${formatBytes(MAX_NONVOICE_ATTACH_BYTES)}. Some files were not added.`
        })
      );
    }
  };

  const renderAttachments = (m: ChatMessage) => {
    const list = Array.isArray(m.attachments) ? m.attachments : [];
    if (!list.length) return null;
    const mine = String(m.userId) === String(user?.id || '');
    return (
      <div className="mt-2 space-y-2">
        {list.map((a, idx) => {
          const url = String((a as any).url || '');
          const name = String((a as any).name || url);
          const mime = String((a as any).mime || '');
          const ext = extOf(name);
          const isImg = mime.startsWith('image/') || (!mime && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext));
          const isAud = mime.startsWith('audio/') || (!mime && ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext));
          const isVid = (mime.startsWith('video/') || (!mime && ['mp4', 'webm', 'mov'].includes(ext))) && !isAud;
          const isVoice = name.toLowerCase().startsWith('voice-') && isAud;
          if (isImg) {
            return (
              <button
                key={`${url}:${idx}`}
                type="button"
                onClick={() => setMediaModal({ url, name })}
                className="block w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950/30 hover:border-slate-600"
                title={name}
              >
                <img src={url} alt="" className="max-h-48 w-full object-cover" />
              </button>
            );
          }
          if (isVid) {
            return (
              <div
                key={`${url}:${idx}`}
                className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/30"
                title={name}
              >
                <video src={url} controls className="max-h-56 w-full" />
              </div>
            );
          }
          if (isAud) {
            if (isVoice) {
              return (
                <VoiceNoteAttachment
                  key={`${url}:${idx}`}
                  url={url}
                  mine={mine}
                  seed={`${m.id}:${idx}:${url}`}
                  sizeBytes={Number((a as any).sizeBytes) || 0}
                />
              );
            }
            return (
              <div
                key={`${url}:${idx}`}
                className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2"
                title={isVoice ? t({ it: 'Vocale', en: 'Voice note' }) : name}
              >
                {!isVoice ? (
                  <div className="mb-1 flex items-center justify-between gap-2 text-[12px] text-slate-200">
                    <span className="min-w-0 truncate">{name}</span>
                    <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(Number((a as any).sizeBytes) || 0)}</span>
                  </div>
                ) : null}
                <audio src={url} controls className="w-full" />
              </div>
            );
          }
          return (
            <a
              key={`${url}:${idx}`}
              href={url}
              target="_blank"
              rel="noreferrer"
              download={name}
              className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2 text-[12px] text-slate-100 hover:border-slate-600"
              title={name}
            >
              <span className="min-w-0 truncate">{name}</span>
              <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(Number((a as any).sizeBytes) || 0)}</span>
            </a>
          );
        })}
      </div>
    );
  };

  const renderReactions = (m: ChatMessage) => {
    const reactions = (m as any).reactions && typeof (m as any).reactions === 'object' ? ((m as any).reactions as Record<string, string[]>) : {};
    const keys = CHAT_REACTIONS.filter((e) => Array.isArray(reactions[e]) && reactions[e]!.length);
    if (!keys.length) return null;
    const myId = String(user?.id || '');
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {keys.map((emoji) => {
          const list = Array.isArray(reactions[emoji]) ? reactions[emoji]! : [];
          const count = list.length;
          const mine = !!myId && list.some((id) => String(id) === myId);
          return (
            <button
              key={emoji}
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] ${
                'border-slate-700 bg-slate-950/30 text-slate-100 hover:border-slate-600'
              }`}
              onClick={() => {
                // WhatsApp-like: if you reacted with this emoji, clicking it removes your reaction.
                if (mine) {
                  toggleReaction(m, emoji);
                  return;
                }
                setReactionsModal({ messageId: m.id, tab: emoji });
              }}
              title={t({ it: 'Dettagli reazioni', en: 'Reaction details' })}
            >
              <span className="text-[14px] leading-none">{emoji}</span>
              <span className="tabular-nums text-[11px] font-semibold">{count}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const onCloseChatDialog = () => {
    if (helpOpen) {
      setHelpOpen(false);
      return;
    }
    if (clearChatOpen) {
      setClearChatOpen(false);
      setClearChatTyped('');
      return;
    }
    if (unstarConfirmId) {
      setUnstarConfirmId(null);
      return;
    }
    // If a media modal is open, close it first and keep the chat open.
    if (mediaModal) {
      setMediaModal(null);
      return;
    }
    if (messageInfoId) {
      setMessageInfoId(null);
      return;
    }
    if (actionMenu) {
      setActionMenu(null);
      return;
    }
    if (reactPickerId) {
      setReactPickerId(null);
      return;
    }
    if (reactionsModal) {
      setReactionsModal(null);
      return;
    }
    if (profileUserId) {
      setProfileUserId(null);
      setProfileData(null);
      return;
    }
    if (starredOpen) {
      setStarredOpen(false);
      return;
    }
    if (searchOpen) {
      setSearchOpen(false);
      return;
    }
    if (clientPickerOpen) {
      setClientPickerOpen(false);
      return;
    }
    if (membersOpen) {
      setMembersOpen(false);
      return;
    }
    if (exportOpen) {
      setExportOpen(false);
      return;
    }
    if (replyToId) {
      setReplyToId(null);
      return;
    }
    closeClientChat();
  };

  const headerIconBtn =
    'icon-button inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg leading-none text-slate-200 hover:bg-slate-800 hover:text-slate-50';

  return (
    <>
      <Transition show={clientChatOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onCloseChatDialog}>
	          <div className="fixed inset-0 pointer-events-none">
	            <div className="absolute bottom-4 right-4 pointer-events-auto w-[min(420px,calc(100vw-2rem))]">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 translate-y-2"
                enterTo="opacity-100 translate-y-0"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 translate-y-0"
                leaveTo="opacity-0 translate-y-2"
              >
		                <Dialog.Panel className="relative">
		                  <div
		                    ref={panelRef}
		                    className="rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card overflow-hidden"
		                  >
	                  <div className="relative z-[40] flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                    <div className="min-w-0">
	                      <div className="relative" ref={clientPickerRef}>
	                        {chatClients.length > 1 ? (
	                          <button
	                            type="button"
	                            className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-slate-50 hover:bg-slate-800"
	                            onClick={() => {
	                              setClientPickerOpen((v) => !v);
	                              setMembersOpen(false);
	                              setExportOpen(false);
	                              setHelpOpen(false);
	                              setClearChatOpen(false);
	                            }}
	                            title={t({ it: 'Cambia chat cliente', en: 'Switch client chat' })}
	                          >
	                            <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-slate-950/60">
	                              {clientLogoUrl ? (
	                                <img src={clientLogoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
	                              ) : (
	                                <span className="text-[12px] font-extrabold text-slate-200">{clientInitial}</span>
	                              )}
	                            </span>
	                            <span className="truncate">{clientName}</span>
	                            <ChevronDown size={16} className="text-slate-300" />
	                          </button>
	                        ) : (
	                          <Dialog.Title className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-50">
	                            <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-slate-950/60">
	                              {clientLogoUrl ? (
	                                <img src={clientLogoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
	                              ) : (
	                                <span className="text-[12px] font-extrabold text-slate-200">{clientInitial}</span>
	                              )}
	                            </span>
	                            <span className="truncate">{clientName}</span>
	                          </Dialog.Title>
	                        )}
	                        {clientPickerOpen ? (
	                          <div className="absolute left-0 top-full z-[60] mt-2 w-72 rounded-2xl border border-slate-700 bg-slate-950 p-1 text-sm shadow-2xl ring-1 ring-black/60">
		                            {chatClients.map((c) => {
		                              const active = c.id === clientChatClientId;
		                              const unread = Number((chatUnreadByClientId as any)?.[c.id] || 0);
		                              const logo = String((c as any)?.logoUrl || '').trim();
		                              const initial = (String(c.name || '').trim()?.[0] || '?').toUpperCase();
		                              return (
		                                <button
		                                  key={c.id}
		                                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-slate-900 ${
		                                    active ? 'bg-slate-900' : ''
		                                  }`}
                                  onClick={() => {
                                    setClientPickerOpen(false);
                                    setMembersOpen(false);
                                    setExportOpen(false);
                                    setMediaModal(null);
                                    setMessageInfoId(null);
                                    setReplyToId(null);
                                    openClientChat(c.id);
                                  }}
                                  title={c.name}
		                                >
		                                  <span className="flex min-w-0 items-center gap-2">
		                                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-slate-950/60">
		                                      {logo ? (
		                                        <img src={logo} alt="" className="h-full w-full object-cover" draggable={false} />
		                                      ) : (
		                                        <span className="text-[12px] font-extrabold text-slate-200">{initial}</span>
		                                      )}
		                                    </span>
		                                    <span className="min-w-0 truncate text-slate-100">{c.name}</span>
		                                  </span>
		                                  {unread > 0 ? (
		                                    <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
		                                      {unread > 99 ? '99+' : String(unread)}
		                                    </span>
		                                  ) : null}
		                                </button>
		                              );
		                            })}
		                          </div>
		                        ) : null}
                      </div>
                    </div>
		                    <div className="flex items-center gap-1">
		                      <button
		                        className={headerIconBtn}
		                        onClick={() => {
		                          setHelpOpen(true);
		                          setMembersOpen(false);
		                          setExportOpen(false);
		                          setClientPickerOpen(false);
		                          setSearchOpen(false);
		                          setStarredOpen(false);
		                        }}
		                        title={t({ it: 'Info scorciatoie', en: 'Help / shortcuts' })}
		                        aria-label={t({ it: 'Info scorciatoie', en: 'Help / shortcuts' })}
		                      >
		                        <Info size={18} />
		                      </button>
	                      <button
	                        className={headerIconBtn}
	                        onClick={() => {
	                          setSearchOpen((v) => !v);
	                          setStarredOpen(false);
	                          setMembersOpen(false);
	                          setExportOpen(false);
	                          setClientPickerOpen(false);
	                          window.setTimeout(() => searchInputRef.current?.focus(), 0);
	                        }}
	                        title={t({ it: 'Cerca nella chat', en: 'Search chat' })}
	                        aria-label={t({ it: 'Cerca nella chat', en: 'Search chat' })}
	                      >
	                        <Search size={18} />
	                      </button>
	                      <button
	                        className={headerIconBtn}
	                        onClick={() => {
	                          setStarredOpen(true);
	                          setSearchOpen(false);
	                          setMembersOpen(false);
	                          setExportOpen(false);
	                          setClientPickerOpen(false);
	                        }}
	                        title={t({ it: 'Messaggi importanti', en: 'Starred messages' })}
	                        aria-label={t({ it: 'Messaggi importanti', en: 'Starred messages' })}
	                      >
	                        <Star size={18} className={starredMessages.length ? 'text-amber-300' : ''} fill={starredMessages.length ? 'currentColor' : 'none'} />
	                      </button>
		                      <button
		                        className={headerIconBtn}
		                        onClick={() => {
		                          setMembersOpen((v) => !v);
		                          setExportOpen(false);
		                          setClientPickerOpen(false);
		                          setSearchOpen(false);
		                          setStarredOpen(false);
		                          setHelpOpen(false);
		                          setClearChatOpen(false);
		                        }}
		                        title={t({ it: 'Membri chat', en: 'Chat members' })}
		                        aria-label={t({ it: 'Membri chat', en: 'Chat members' })}
		                      >
		                        <Users size={18} />
		                      </button>
		                      <button
		                        className={headerIconBtn}
		                        onClick={() => {
		                          setExportOpen((v) => !v);
		                          setMembersOpen(false);
		                          setClientPickerOpen(false);
		                          setSearchOpen(false);
		                          setStarredOpen(false);
		                          setHelpOpen(false);
		                          setClearChatOpen(false);
		                        }}
		                        title={t({ it: 'Esporta chat', en: 'Export chat' })}
		                        aria-label={t({ it: 'Esporta chat', en: 'Export chat' })}
		                      >
		                        <Download size={18} />
		                      </button>
	                    {isSuperAdmin ? (
	                      <button
	                        className={`${headerIconBtn} text-rose-300`}
	                        onClick={() => {
	                          setClearChatOpen(true);
	                          setClearChatTyped('');
	                          setHelpOpen(false);
	                          setMembersOpen(false);
	                          setExportOpen(false);
	                          setClientPickerOpen(false);
	                          setSearchOpen(false);
	                          setStarredOpen(false);
	                        }}
	                        title={t({ it: 'Svuota chat', en: 'Clear chat' })}
	                      >
	                        <Trash2 size={18} />
	                      </button>
                    ) : null}
                    <button className={headerIconBtn} onClick={closeClientChat} title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
	                  </div>
	                </div>

	                {searchOpen ? (
	                  <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2">
	                    <Search size={16} className="text-slate-300" />
		                    <input
		                      ref={searchInputRef}
		                      value={searchQ}
		                      onChange={(e) => setSearchQ(e.target.value)}
		                      onKeyDown={(e) => {
		                        if (e.key === 'Enter') {
		                          e.preventDefault();
		                          if (!searchHits.length) return;
		                          setSearchHitIdx((i) => (i + 1) % searchHits.length);
		                        }
	                      }}
	                      className="h-9 flex-1 rounded-xl border border-slate-800 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none ring-primary/30 placeholder:text-slate-500 focus:ring-2"
	                      placeholder={t({ it: 'Cerca…', en: 'Search…' })}
	                    />
	                    <div className="shrink-0 text-[11px] font-semibold text-slate-400 tabular-nums">
	                      {searchHits.length ? `${Math.min(searchHitIdx + 1, searchHits.length)}/${searchHits.length}` : `0/0`}
	                    </div>
	                    <button
	                      className={`${headerIconBtn} h-9 w-9 rounded-xl`}
	                      onClick={() => {
	                        if (!searchHits.length) return;
	                        setSearchHitIdx((i) => (i - 1 + searchHits.length) % searchHits.length);
	                      }}
	                      disabled={!searchHits.length}
	                      title={t({ it: 'Risultato precedente', en: 'Previous result' })}
	                    >
	                      <ChevronUp size={16} />
	                    </button>
	                    <button
	                      className={`${headerIconBtn} h-9 w-9 rounded-xl`}
	                      onClick={() => {
	                        if (!searchHits.length) return;
	                        setSearchHitIdx((i) => (i + 1) % searchHits.length);
	                      }}
	                      disabled={!searchHits.length}
	                      title={t({ it: 'Risultato successivo', en: 'Next result' })}
	                    >
	                      <ChevronDown size={16} />
	                    </button>
	                    <button
	                      className={`${headerIconBtn} h-9 w-9 rounded-xl`}
	                      onClick={() => setSearchOpen(false)}
	                      title={t({ it: 'Chiudi ricerca', en: 'Close search' })}
	                    >
	                      <X size={16} />
	                    </button>
	                  </div>
	                ) : null}

	                <div className="h-[360px] bg-slate-950">
	                  <div ref={listRef} className="h-full overflow-auto p-3 space-y-2">
                    {loading ? (
                      <div className="text-sm text-slate-300">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                    ) : null}
	                    {(() => {
	                      let lastDay = '';
	                      return (messages || []).map((m) => {
	                        const mine = String(m.userId) === String(user?.id || '');
	                        const showAvatar = true;
	                        const day = localDateKey(m.createdAt);
	                        const showDay = day !== lastDay;
	                        if (showDay) lastDay = day;
	                        const dayLabel = (() => {
	                          const d = new Date(m.createdAt);
	                          const now = new Date();
	                          const todayKey = localDateKey(now.getTime());
	                          const yesterdayKey = localDateKey(now.getTime() - 24 * 60 * 60 * 1000);
	                          if (day === todayKey) return t({ it: 'Oggi', en: 'Today' });
	                          if (day === yesterdayKey) return t({ it: 'Ieri', en: 'Yesterday' });
	                          return d.toLocaleDateString();
	                        })();
	                        const bubble = mine
	                          ? 'bg-emerald-500/15 text-emerald-50 border border-emerald-400/20'
	                          : 'bg-slate-900/50 text-slate-100 border border-slate-700';
	                        const hasVoice = (m.attachments || []).some((a) => {
	                          const name = String((a as any)?.name || '').toLowerCase();
	                          return name.startsWith('voice-') && isAudioAttachment(a);
	                        });
	                        const starredBy = Array.isArray((m as any).starredBy) ? ((m as any).starredBy as string[]) : [];
	                        const starred = !!user?.id && starredBy.some((id) => String(id) === String(user.id));
	                        const replyTarget = m.replyToId ? messagesById.get(String(m.replyToId)) : null;
	                        const isSearchHit = !!searchOpen && !!searchHits.length && searchHits[searchHitIdx] === String(m.id);
	                        return (
	                          <Fragment key={m.id}>
	                            {showDay ? (
	                              <div className="flex justify-center py-1">
	                                <div className="rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-[11px] font-semibold text-slate-300">
	                                  {dayLabel}
	                                </div>
	                              </div>
	                            ) : null}
	                            <div id={`chatmsg-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2`}>
		                              {showAvatar && !mine ? (
		                                <button
		                                  type="button"
		                                  className="shrink-0 rounded-full focus:outline-none focus-visible:outline-none"
		                                  onClick={() => openUserProfile(m.userId)}
		                                  title={t({ it: 'Profilo utente', en: 'User profile' })}
		                                >
		                                  <UserAvatar username={m.username} src={m.avatarUrl} size={28} className="border-slate-800 bg-slate-900" />
		                                </button>
		                              ) : null}
	                              <div
	                                className={`group relative ${hasVoice ? 'flex-1 max-w-none' : 'max-w-[82%]'} rounded-2xl px-3 py-2 text-sm ${bubble} ${
	                                  isSearchHit ? 'ring-2 ring-amber-400/50' : ''
	                                }`}
	                              >
	                            <div className={`flex items-center justify-between gap-2 ${mine ? 'text-emerald-100' : 'text-slate-300'}`}>
	                              <div className="flex items-center gap-1 text-[11px] font-semibold">
	                                <span>{mine ? t({ it: 'Tu', en: 'You' }) : capFirst(m.username)}</span>
	                                {starred ? <Star size={12} className="text-amber-300" fill="currentColor" /> : null}
	                              </div>
                              <div className="flex items-center gap-1">
                                <div className="text-[10px] opacity-70">{new Date(m.createdAt).toLocaleTimeString()}</div>
                                {!m.deleted ? (
                                  <button
                                    type="button"
                                    className="flex h-6 w-6 items-center justify-center rounded-md opacity-0 hover:bg-black/20 group-hover:opacity-100"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openActionMenuFor(m, e.currentTarget);
                                    }}
                                    title={t({ it: 'Menu', en: 'Menu' })}
                                    aria-label={t({ it: 'Menu', en: 'Menu' })}
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {editingId === m.id ? (
                              <div className="mt-1 space-y-2">
                                <textarea
                                  ref={(el) => {
                                    if (el) editTextareaRef.current = el;
                                  }}
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none ring-primary/30 focus:ring-2"
                                  rows={3}
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditingText('');
                                    }}
                                  >
                                    {t({ it: 'Annulla', en: 'Cancel' })}
                                  </button>
                                  <button
                                    className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                    onClick={commitEdit}
                                  >
                                    {t({ it: 'Salva', en: 'Save' })}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 whitespace-pre-wrap break-words">
                                {!m.deleted && m.replyToId ? (
                                  <button
                                    type="button"
                                    className={`mb-2 block w-full rounded-xl border px-2 py-1 text-left text-[12px] ${
                                      mine ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-slate-700 bg-slate-950/20'
                                    }`}
                                    onClick={() => {
                                      const id = String(m.replyToId || '');
                                      if (id) scrollToMessage(id);
                                    }}
                                    title={t({ it: 'Vai al messaggio citato', en: 'Go to replied message' })}
                                  >
                                    <div className="font-semibold opacity-90">
                                      {t({ it: 'Risposta a', en: 'Reply to' })}{' '}
	                                      {replyTarget ? (replyTarget.userId === user?.id ? t({ it: 'Tu', en: 'You' }) : capFirst(replyTarget.username)) : '#'}
                                    </div>
                                    <div className="opacity-80">
                                      {replyTarget
                                        ? replyTarget.deleted
                                          ? t({ it: 'Messaggio eliminato', en: 'Message deleted' })
                                          : snippet(replyTarget.text) ||
                                            ((replyTarget.attachments || []).length
                                              ? t({ it: 'Allegato', en: 'Attachment' })
                                              : t({ it: 'Messaggio', en: 'Message' }))
                                        : t({ it: 'Messaggio non disponibile', en: 'Message not available' })}
                                    </div>
                                  </button>
                                ) : null}
                                {m.deleted ? (
                                  <span className="italic text-slate-400">{t({ it: 'Messaggio eliminato', en: 'Message deleted' })}</span>
                                ) : (
                                  m.text
                                )}
                                {m.editedAt && !m.deleted ? (
                                  <span className="ml-2 text-[10px] font-semibold opacity-60">{t({ it: '(modificato)', en: '(edited)' })}</span>
                                ) : null}
                                {!m.deleted ? renderAttachments(m) : null}
                                {!m.deleted ? renderReactions(m) : null}
                                {!m.deleted && reactPickerId === m.id ? (
                                  <div
                                    ref={(el) => {
                                      reactPickerRef.current = el;
                                    }}
                                    className="mt-2 flex flex-wrap gap-1 rounded-2xl border border-slate-700 bg-slate-950/40 p-2"
                                  >
                                    {CHAT_REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-[18px] hover:bg-slate-900"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleReaction(m, emoji);
                                          setReactPickerId(null);
                                        }}
                                        title={t({ it: 'Reagisci', en: 'React' })}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )}
	                              </div>
		                              {showAvatar && mine ? (
		                                <button
		                                  type="button"
		                                  className="shrink-0 rounded-full focus:outline-none focus-visible:outline-none"
		                                  onClick={() => {
		                                    const myId = String(user?.id || '').trim();
		                                    if (myId) openUserProfile(myId);
		                                  }}
		                                  title={t({ it: 'Profilo utente', en: 'User profile' })}
		                                >
		                                  <UserAvatar username={m.username} src={m.avatarUrl} size={28} className="border-slate-800 bg-slate-900" />
		                                </button>
		                              ) : null}
	                            </div>
	                          </Fragment>
	                        );
	                      });
	                    })()}
                  </div>
                </div>

                <div className="border-t border-slate-800 bg-slate-900 p-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.jfif,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.webm,.mov,image/*,video/*,audio/*,application/pdf"
                    onChange={(e) => {
                      const picked = e.target.files ? Array.from(e.target.files) : [];
                      // allow selecting same file twice
                      e.target.value = '';
                      onFilesPicked(picked).catch(() => {});
                    }}
                  />
                  {replyToId ? (
                    <div className="mb-2 flex items-start justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-300">
                          {t({ it: 'Rispondi a', en: 'Replying to' })}{' '}
                          {(() => {
                            const target = messagesById.get(replyToId);
                            if (!target) return '#';
	                            return target.userId === user?.id ? t({ it: 'Tu', en: 'You' }) : capFirst(target.username);
	                          })()}
                        </div>
                        <div className="truncate text-[12px] text-slate-200">
                          {(() => {
                            const target = messagesById.get(replyToId);
                            if (!target) return t({ it: 'Messaggio non disponibile', en: 'Message not available' });
                            if (target.deleted) return t({ it: 'Messaggio eliminato', en: 'Message deleted' });
                            return snippet(target.text) || ((target.attachments || []).length ? t({ it: 'Allegato', en: 'Attachment' }) : t({ it: 'Messaggio', en: 'Message' }));
                          })()}
                        </div>
                      </div>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
                        onClick={() => setReplyToId(null)}
                        title={t({ it: 'Annulla risposta', en: 'Cancel reply' })}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : null}
                  {pendingAttachments.length ? (
                    <div className="mb-2 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <div>
                          {t({ it: 'Allegati', en: 'Attachments' })}:{' '}
                          <span
                            className={
                              pendingNonVoiceBytes > MAX_NONVOICE_ATTACH_BYTES ? 'text-rose-300 font-semibold' : 'text-slate-300 font-semibold'
                            }
                          >
                            {formatBytes(pendingNonVoiceBytes)}
                          </span>{' '}
                          / {formatBytes(MAX_NONVOICE_ATTACH_BYTES)}
                          {pendingVoiceCount ? (
                            <span className="ml-2 text-slate-400">
                              + {pendingVoiceCount} {t({ it: pendingVoiceCount === 1 ? 'vocale' : 'vocali', en: pendingVoiceCount === 1 ? 'voice note' : 'voice notes' })}
                            </span>
                          ) : null}
                        </div>
                        <button
                          className="text-slate-400 hover:text-slate-200"
                          onClick={() =>
                            setPendingAttachments((prev) => {
                              for (const a of prev) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
                              return [];
                            })
                          }
                          title={t({ it: 'Rimuovi tutti', en: 'Remove all' })}
                        >
                          {t({ it: 'Svuota', en: 'Clear' })}
                        </button>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {pendingAttachments.map((a) => (
                          <div
                            key={a.id}
                            className="relative shrink-0 w-[92px] h-[92px] rounded-2xl border border-slate-700 bg-slate-950/50 overflow-hidden"
                            title={`${isVoiceRecordingAttachment(a.name, a.file?.type || '') ? t({ it: 'Vocale', en: 'Voice note' }) : a.name} (${formatBytes(a.sizeBytes)})`}
                          >
                            {a.kind === 'image' && a.previewUrl ? (
                              <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                            ) : null}
                            {a.kind === 'video' && a.previewUrl ? (
                              <video src={a.previewUrl} className="h-full w-full object-cover" muted />
                            ) : null}
                            {a.kind === 'audio' && a.previewUrl ? (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
                                <audio src={a.previewUrl} controls className="w-full" />
                                <div className="text-[10px] text-slate-300 line-clamp-2 text-center">
                                  {isVoiceRecordingAttachment(a.name, a.file?.type || '')
                                    ? t({ it: 'Vocale', en: 'Voice note' })
                                    : a.name}
                                </div>
                              </div>
                            ) : null}
                            {a.kind === 'file' || !a.previewUrl ? (
                              <div className="flex h-full w-full flex-col items-center justify-center px-2 text-center">
                                <div className="text-[11px] font-semibold text-slate-200 line-clamp-2">{a.name}</div>
                                <div className="mt-1 text-[10px] text-slate-400">{formatBytes(a.sizeBytes)}</div>
                              </div>
                            ) : null}
                            <button
                              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-slate-100 hover:bg-black/70"
                              onClick={() =>
                                setPendingAttachments((prev) => {
                                  const removing = prev.find((x) => x.id === a.id);
                                  if (removing?.previewUrl) URL.revokeObjectURL(removing.previewUrl);
                                  return prev.filter((x) => x.id !== a.id);
                                })
                              }
                              title={t({ it: 'Rimuovi', en: 'Remove' })}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
	                  {recording ? (
	                    <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-950/30 px-3 py-2">
	                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-rose-500" />
                          <span className="text-[12px] font-semibold text-slate-100 tabular-nums">{formatRec(recordSeconds)}</span>
                        </div>
	                        <div className="flex h-6 items-center gap-[2px]">
	                          {(waveform.length ? waveform : new Array(36).fill(0)).map((v, i) => {
	                            const h = 4 + Math.round(Math.min(1, Number(v) || 0) * 14);
	                            return (
	                              <span
	                                key={i}
	                                className="w-[2px] rounded-full bg-emerald-100/80"
	                                style={{ height: `${h}px`, opacity: 0.35 + Math.min(0.65, (Number(v) || 0) * 1.2) }}
	                              />
	                            );
	                          })}
	                        </div>
	                        <div className="text-[11px] text-slate-400 tabular-nums">
	                          {formatRec(MAX_VOICE_SECONDS)}
	                        </div>
	                      </div>
	                    </div>
	                  ) : null}
                  {err ? (
                    <div className="mb-2 rounded-xl border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                      {err}
                    </div>
                  ) : null}
                  <div className="flex items-end gap-2">
                    <button
                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/40 text-slate-200 hover:bg-slate-900"
                      onClick={pickFiles}
                      title={t({ it: 'Allega file (max 5MB)', en: 'Attach file (max 5MB)' })}
                      aria-label={t({ it: 'Allega file', en: 'Attach file' })}
                      disabled={recording}
                    >
                      <Paperclip size={18} />
                    </button>
	                    <button
	                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border bg-slate-950/40 hover:bg-slate-900 ${
	                        recording ? 'border-rose-800 text-rose-200' : 'border-slate-700 text-slate-200'
	                      }`}
	                      onClick={() => (recording ? cancelRecording() : startRecording())}
	                      title={
	                        recording
	                          ? t({ it: `Annulla registrazione (${formatRec(recordSeconds)})`, en: `Cancel recording (${formatRec(recordSeconds)})` })
	                          : t({ it: 'Registra vocale', en: 'Record voice note' })
	                      }
	                      aria-label={t({ it: 'Vocale', en: 'Voice note' })}
	                    >
	                      {recording ? <Trash2 size={18} /> : <Mic size={18} />}
	                    </button>
                    <textarea
                      ref={composeTextareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (recording) return;
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-primary/30 placeholder:text-slate-500 focus:ring-2"
                      placeholder={t({ it: 'Scrivi un messaggio…', en: 'Write a message…' })}
                      rows={2}
                      disabled={recording}
                    />
	                    <button
	                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
	                      onClick={() => (recording ? stopRecording() : send())}
	                      title={recording ? t({ it: 'Invia vocale', en: 'Send voice note' }) : t({ it: 'Invia', en: 'Send' })}
	                      disabled={sending}
	                    >
	                      <Send size={18} />
	                    </button>
		                  </div>
		                  {/* Help moved to the Info button in the header */}
		                  </div>
		                  </div>
		                  {/* Action menu must live inside Dialog.Panel, otherwise HeadlessUI treats it as "outside click"
		                      and the click is lost (resulting in downloads/click-through). */}
		                  {actionMenu ? (
		                    (() => {
                      const msg = messagesById.get(actionMenu.id);
                      if (!msg || msg.deleted) return null;
                      const myId = String(user?.id || '');
                      const canEdit = !!myId && canEditMessage(msg, myId);
                      const canDelete = !!myId && (String(msg.userId) === myId || isSuperAdmin);
                      const starredBy = Array.isArray((msg as any).starredBy) ? ((msg as any).starredBy as string[]) : [];
                      const starred = !!myId && starredBy.some((id) => String(id) === myId);
                      const menuW = 228;
                      const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
                      const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
                      const left = Math.max(8, Math.min(actionMenu.x - menuW, viewportW - menuW - 8));
                      const top = Math.max(8, Math.min(actionMenu.y + 8, viewportH - 420));
                      return (
                        <div
                          className="fixed z-[70]"
                          ref={actionMenuRef}
                          style={{ left, top, width: menuW }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-sm shadow-card">
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                              onClick={() => {
                                setActionMenu(null);
                                startReply(msg);
                              }}
                            >
                              <CornerUpLeft size={16} className="text-slate-300" />
                              {t({ it: 'Rispondi', en: 'Reply' })}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                              onClick={() => {
                                setActionMenu(null);
                                setReactPickerId(msg.id);
                                window.setTimeout(() => scrollToMessage(msg.id), 0);
                              }}
                            >
                              <Smile size={16} className="text-slate-300" />
                              {t({ it: 'Reagisci', en: 'React' })}
                            </button>
	                            <button
	                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
	                              onClick={() => {
	                                setActionMenu(null);
	                                toggleStar(msg);
	                              }}
	                            >
	                              <Star size={16} className={starred ? 'text-amber-300' : 'text-slate-300'} fill={starred ? 'currentColor' : 'none'} />
	                              {t({ it: 'Importante', en: 'Important' })}
	                            </button>
	                            <button
	                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
	                              onClick={() => {
	                                setActionMenu(null);
	                                copyMessageText(msg).catch(() => {});
                              }}
                            >
                              <CopyIcon size={16} className="text-slate-300" />
                              {t({ it: 'Copia', en: 'Copy' })}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                              onClick={() => {
                                setActionMenu(null);
                                openMessageInfo(msg).catch(() => {});
                              }}
                            >
                              <Info size={16} className="text-slate-300" />
                              {t({ it: 'Info', en: 'Info' })}
                            </button>
                            {canEdit ? (
                              <button
                                className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                                onClick={() => {
                                  setActionMenu(null);
                                  startEdit(msg);
                                }}
                              >
                                <Pencil size={16} className="text-slate-300" />
                                {t({ it: 'Modifica', en: 'Edit' })}
                              </button>
                            ) : null}
                            <div className="my-1 h-px bg-slate-800" />
	                            {canDelete ? (
	                              <button
	                                className="flex w-full items-center gap-2 px-3 py-2 text-rose-200 hover:bg-rose-950/35"
	                                onClick={() => {
	                                  setActionMenu(null);
	                                  remove(msg).catch(() => {});
	                                }}
	                              >
	                                <Trash2 size={16} className="text-rose-200" />
	                                {t({ it: 'Elimina', en: 'Delete' })}
	                              </button>
	                            ) : null}
	                          </div>
	                        </div>
	                      );
	                    })()
                  ) : null}
			              {helpOpen ? (
			                <div
			                  className="fixed inset-0 z-[58] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
			                  onMouseDown={(e) => {
			                    if (e.target === e.currentTarget) window.setTimeout(() => setHelpOpen(false), 0);
			                  }}
			                >
		                  <div
		                    className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
		                    onMouseDown={(e) => e.stopPropagation()}
		                  >
		                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
		                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Info chat', en: 'Chat info' })}</div>
		                      <button
		                        className="icon-button"
		                        onClick={() => window.setTimeout(() => setHelpOpen(false), 0)}
		                        title={t({ it: 'Chiudi', en: 'Close' })}
		                      >
		                        <X size={18} />
		                      </button>
			                    </div>
			                    <div className="p-4">
			                      <ul className="list-disc space-y-2 rounded-2xl border border-slate-800 bg-slate-900/20 px-6 py-4 text-sm text-slate-200">
			                        {helpItems.map((it0) => (
			                          <li key={it0.k}>
			                            <span className="font-extrabold text-slate-50">{it0.k}</span>
			                            <span className="text-slate-300">: {it0.v}</span>
			                          </li>
			                        ))}
			                      </ul>
			                    </div>
			                  </div>
			                </div>
			              ) : null}
			              {membersOpen ? (
			                <div
			                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
			                  onMouseDown={(e) => {
			                    if (e.target === e.currentTarget) window.setTimeout(() => setMembersOpen(false), 0);
			                  }}
			                >
			                  <div
			                    className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
			                    onMouseDown={(e) => e.stopPropagation()}
			                  >
			                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
			                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Membri', en: 'Members' })}</div>
			                      <div className="flex items-center gap-2">
			                        <div className="text-[12px] font-semibold text-slate-400 tabular-nums">{members.length}</div>
			                        <button
			                          className="icon-button"
			                          onClick={() => window.setTimeout(() => setMembersOpen(false), 0)}
			                          title={t({ it: 'Chiudi', en: 'Close' })}
			                        >
			                          <X size={18} />
			                        </button>
			                      </div>
			                    </div>
			                    <div className="max-h-[70vh] overflow-auto p-3">
			                      {membersLoading ? (
			                        <div className="px-2 py-2 text-sm text-slate-400">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
			                      ) : members.length ? (
			                        <div className="space-y-1">
			                          {membersSorted.map((m) => {
			                            const online = !!(onlineUserIds as any)?.[m.id] || !!m.online;
			                            const dot = online ? 'bg-emerald-500' : 'bg-rose-500';
			                            const name = `${String(m.firstName || '').trim()} ${String(m.lastName || '').trim()}`.trim();
			                            const label = name ? capWords(name) : capFirst(m.username);
			                            return (
			                              <div
			                                key={m.id}
			                                className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-2 py-2 hover:bg-slate-900/30"
			                              >
			                                <div className="flex min-w-0 items-center gap-2">
			                                  <button
			                                    type="button"
			                                    className="relative rounded-full focus:outline-none focus-visible:outline-none"
			                                    onClick={() => openUserProfile(m.id)}
			                                    title={t({ it: 'Profilo utente', en: 'User profile' })}
			                                  >
			                                    <UserAvatar username={m.username} name={name} src={m.avatarUrl} size={28} className="border-slate-800 bg-slate-900" />
			                                    <span className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${dot}`} />
			                                  </button>
			                                  <div className="min-w-0">
			                                    <div className="truncate text-sm font-semibold text-slate-100">{label}</div>
			                                    <div className="truncate text-[11px] text-slate-400">@{m.username}</div>
			                                  </div>
			                                </div>
			                                <div className={`text-[11px] font-semibold ${online ? 'text-emerald-300' : 'text-rose-300'}`}>
			                                  {online ? t({ it: 'Online', en: 'Online' }) : t({ it: 'Offline', en: 'Offline' })}
			                                </div>
			                              </div>
			                            );
			                          })}
			                        </div>
			                      ) : (
			                        <div className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-sm text-slate-300">
			                          {t({ it: 'Nessun membro trovato.', en: 'No members found.' })}
			                        </div>
			                      )}
			                    </div>
			                  </div>
			                </div>
			              ) : null}
			              {exportOpen ? (
			                <div
			                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
			                  onMouseDown={(e) => {
			                    if (e.target === e.currentTarget) window.setTimeout(() => setExportOpen(false), 0);
			                  }}
			                >
			                  <div
			                    className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
			                    onMouseDown={(e) => e.stopPropagation()}
			                  >
			                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
			                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Esporta chat', en: 'Export chat' })}</div>
			                      <button
			                        className="icon-button"
			                        onClick={() => window.setTimeout(() => setExportOpen(false), 0)}
			                        title={t({ it: 'Chiudi', en: 'Close' })}
			                      >
			                        <X size={18} />
			                      </button>
			                    </div>
			                    <div className="p-3 space-y-2">
			                      <button
			                        className="w-full rounded-2xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-left hover:bg-slate-900/30"
			                        onClick={() => {
			                          setExportOpen(false);
			                          doExport('txt');
			                        }}
			                      >
			                        <div className="text-sm font-bold text-slate-100">TXT</div>
			                        <div className="mt-0.5 text-[12px] text-slate-400">{t({ it: 'Testo semplice', en: 'Plain text' })}</div>
			                      </button>
			                      <button
			                        className="w-full rounded-2xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-left hover:bg-slate-900/30"
			                        onClick={() => {
			                          setExportOpen(false);
			                          doExport('json');
			                        }}
			                      >
			                        <div className="text-sm font-bold text-slate-100">JSON</div>
			                        <div className="mt-0.5 text-[12px] text-slate-400">{t({ it: 'Backup strutturato', en: 'Structured backup' })}</div>
			                      </button>
			                      <button
			                        className="w-full rounded-2xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-left hover:bg-slate-900/30"
			                        onClick={async () => {
			                          if (!clientChatClientId) return;
			                          setExportOpen(false);
			                          try {
			                            const blob = await exportChat(clientChatClientId, 'html');
			                            downloadBlob(blob, `chat-${safeFilename(clientName)}.html`);
			                          } catch (e) {
			                            setErr(e instanceof Error ? e.message : 'Failed to export');
			                          }
			                        }}
			                      >
			                        <div className="text-sm font-bold text-slate-100">HTML</div>
			                        <div className="mt-0.5 text-[12px] text-slate-400">{t({ it: 'Da aprire nel browser', en: 'Open in a browser' })}</div>
			                      </button>
			                    </div>
			                  </div>
			                </div>
			              ) : null}
			              {clearChatOpen ? (
			                <div
			                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
			                  onMouseDown={(e) => {
			                    if (e.target === e.currentTarget) window.setTimeout(() => setClearChatOpen(false), 0);
			                  }}
			                >
			                  <div
			                    className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
			                    onMouseDown={(e) => e.stopPropagation()}
			                  >
			                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
			                      <div className="min-w-0 truncate text-sm font-semibold text-rose-100">
			                        {t({ it: 'Svuota chat', en: 'Clear chat' })}
			                      </div>
			                      <button
			                        className="icon-button"
			                        onClick={() => window.setTimeout(() => setClearChatOpen(false), 0)}
			                        title={t({ it: 'Chiudi', en: 'Close' })}
			                      >
			                        <X size={18} />
			                      </button>
			                    </div>
			                    <div className="p-4">
			                      <div className="rounded-2xl border border-rose-900/40 bg-rose-950/25 px-4 py-3 text-sm text-rose-100">
			                        {t({
			                          it: `Questa operazione elimina tutti i messaggi della chat per questo cliente.`,
			                          en: `This will delete all messages for this client chat.`
			                        })}
			                      </div>
			                      <div className="mt-4">
			                        <label className="block text-xs font-semibold uppercase text-slate-400">
			                          {t({ it: 'Per confermare scrivi', en: 'To confirm type' })}{' '}
			                          <span className="ml-1 font-extrabold text-rose-200">DELETE</span>
			                        </label>
			                        <input
			                          value={clearChatTyped}
			                          onChange={(e) => setClearChatTyped(e.target.value)}
			                          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 outline-none ring-primary/30 focus:ring-2"
			                          placeholder="DELETE"
			                          autoCapitalize="none"
			                          autoCorrect="off"
			                          spellCheck={false}
			                          disabled={clearChatBusy}
			                        />
			                      </div>
			                      <div className="mt-4 flex items-center justify-end gap-2">
			                        <button
			                          className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/30"
			                          onClick={() => {
			                            setClearChatOpen(false);
			                            setClearChatTyped('');
			                          }}
			                          disabled={clearChatBusy}
			                        >
			                          {t({ it: 'Annulla', en: 'Cancel' })}
			                        </button>
			                        <button
			                          className="rounded-xl border border-rose-800 bg-rose-600/20 px-3 py-2 text-sm font-extrabold text-rose-100 hover:bg-rose-600/30 disabled:cursor-not-allowed disabled:opacity-50"
			                          onClick={doClearChat}
			                          disabled={clearChatBusy || String(clearChatTyped || '').trim() !== 'DELETE'}
			                        >
			                          {clearChatBusy ? t({ it: 'Elimino…', en: 'Deleting…' }) : t({ it: 'Elimina', en: 'Delete' })}
			                        </button>
			                      </div>
			                    </div>
			                  </div>
			                </div>
			              ) : null}
			              {mediaModal ? (
			                <div
			                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
			                  onMouseDown={(e) => {
		                    if (e.target === e.currentTarget) window.setTimeout(() => setMediaModal(null), 0);
		                  }}
		                >
		                  <div
		                    className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
		                    onMouseDown={(e) => e.stopPropagation()}
		                  >
		                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
		                      <div className="min-w-0 truncate text-sm font-semibold">{mediaModal.name}</div>
		                      <div className="flex items-center gap-2">
		                        <a
		                          href={mediaModal.url}
		                          download={mediaModal.name}
		                          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900"
		                          title={t({ it: 'Scarica', en: 'Download' })}
		                        >
		                          <ArrowDownToLine size={14} />
		                          {t({ it: 'Scarica', en: 'Download' })}
		                        </a>
		                        <button
		                          className="icon-button"
		                          onClick={() => window.setTimeout(() => setMediaModal(null), 0)}
		                          title={t({ it: 'Chiudi', en: 'Close' })}
		                        >
		                          <X size={18} />
		                        </button>
		                      </div>
		                    </div>
		                    <div className="bg-black">
		                      <img src={mediaModal.url} alt="" className="mx-auto max-h-[78vh] w-auto max-w-full object-contain" />
		                    </div>
		                  </div>
		                </div>
		              ) : null}
		              {messageInfoId ? (
		                <div
		                  className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		                  onMouseDown={(e) => {
		                    if (e.target === e.currentTarget) window.setTimeout(() => setMessageInfoId(null), 0);
		                  }}
		                >
		                  <div
		                    className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
		                    onMouseDown={(e) => e.stopPropagation()}
		                  >
		                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
		                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Info messaggio', en: 'Message info' })}</div>
		                      <button
		                        className="icon-button"
		                        onClick={() => window.setTimeout(() => setMessageInfoId(null), 0)}
		                        title={t({ it: 'Chiudi', en: 'Close' })}
		                      >
		                        <X size={18} />
		                      </button>
		                    </div>
		                    <div className="max-h-[70vh] overflow-auto p-3">
		                      {(() => {
		                        const msg = messagesById.get(messageInfoId);
		                        if (!msg) {
		                          return <div className="text-sm text-slate-300">{t({ it: 'Messaggio non disponibile.', en: 'Message not available.' })}</div>;
		                        }
		                        const stars = Array.isArray((msg as any).starredBy) ? ((msg as any).starredBy as any[]).length : 0;
		                        return (
		                          <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/30 px-3 py-2">
		                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
		                              <div className="truncate">
		                                {t({ it: 'Da', en: 'From' })}: <span className="font-semibold text-slate-100">{capFirst(msg.username)}</span>
		                              </div>
		                              <div className="shrink-0">{new Date(msg.createdAt).toLocaleString()}</div>
		                            </div>
		                            <div className="mt-1 text-sm text-slate-100">
		                              {msg.deleted ? (
		                                <span className="italic text-slate-400">{t({ it: 'Messaggio eliminato', en: 'Message deleted' })}</span>
		                              ) : (
		                                snippet(msg.text, 240) || ((msg.attachments || []).length ? t({ it: '[Allegati]', en: '[Attachments]' }) : '')
		                              )}
		                            </div>
		                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
		                              <div className="flex items-center gap-1">
		                                <Star size={13} className={stars ? 'text-amber-300' : 'text-slate-500'} fill={stars ? 'currentColor' : 'none'} />
		                                <span>
		                                  {t({ it: 'Importanti', en: 'Starred' })}: <span className="font-semibold text-slate-200">{stars}</span>
		                                </span>
		                              </div>
		                              <div>{msg.editedAt && !msg.deleted ? <span className="font-semibold">{t({ it: 'Modificato', en: 'Edited' })}</span> : null}</div>
		                            </div>
		                          </div>
		                        );
		                      })()}

		                      <div className="flex items-center justify-between px-1 pb-2 text-xs font-semibold uppercase text-slate-400">
		                        <span>{t({ it: 'Utenti', en: 'Users' })}</span>
		                        <span className="text-slate-500">{messageInfoMembersSorted.length}</span>
		                      </div>
		                      <div className="space-y-1">
		                        {messageInfoLoading ? (
		                          <div className="px-2 py-2 text-sm text-slate-400">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
		                        ) : null}
		                        {!messageInfoLoading && !messageInfoMembersSorted.length ? (
		                          <div className="px-2 py-2 text-sm text-slate-400">{t({ it: 'Nessun utente.', en: 'No users.' })}</div>
		                        ) : null}
		                        {!messageInfoLoading
		                          ? messageInfoMembersSorted.map((u) => {
		                              const online = !!(onlineUserIds as any)?.[u.id] || !!u.online;
		                              const dot = online ? 'bg-emerald-500' : 'bg-rose-500';
		                              const msg = messageInfoId ? messagesById.get(messageInfoId) : null;
		                              const lastReadAt = Number((u as any).lastReadAt || 0) || 0;
		                              const read = !!msg && (u.id === msg.userId || lastReadAt >= Number(msg.createdAt || 0));
		                              const when = lastReadAt ? new Date(lastReadAt).toLocaleString() : '';
		                              return (
		                                <div key={u.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-2 py-2">
			                                  <div className="flex min-w-0 items-center gap-2">
			                                    <button
			                                      type="button"
			                                      className="relative rounded-full focus:outline-none focus-visible:outline-none"
			                                      onClick={() => openUserProfile(u.id)}
			                                      title={t({ it: 'Profilo utente', en: 'User profile' })}
			                                    >
			                                      <UserAvatar
			                                        username={u.username}
			                                        name={`${u.firstName} ${u.lastName}`.trim()}
			                                        src={u.avatarUrl}
			                                        size={28}
			                                        className="border-slate-800 bg-slate-900"
			                                      />
			                                      <span className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${dot}`} />
			                                    </button>
		                                    <div className="min-w-0">
		                                      <div className="truncate text-sm font-semibold text-slate-100">{capFirst(u.username)}</div>
		                                      <div className="truncate text-[11px] text-slate-400">@{u.username}</div>
		                                    </div>
		                                  </div>
		                                  <div className={`text-right text-[11px] font-semibold ${read ? 'text-emerald-300' : 'text-slate-400'}`}>
		                                    <div>{read ? t({ it: 'Letto', en: 'Read' }) : t({ it: 'Non letto', en: 'Unread' })}</div>
		                                    {read && when ? <div className="font-normal text-slate-400">{when}</div> : null}
		                                  </div>
		                                </div>
		                              );
		                            })
		                          : null}
		                      </div>
		                    </div>
		                  </div>
		                </div>
		              ) : null}
			              {starredOpen ? (
		                <div
		                  className="fixed inset-0 z-[54] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		                  onMouseDown={(e) => {
		                    if (e.target === e.currentTarget) window.setTimeout(() => setStarredOpen(false), 0);
		                  }}
		                >
		                  <div
		                    className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
		                    onMouseDown={(e) => e.stopPropagation()}
		                  >
			                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
			                      <div className="min-w-0 truncate text-sm font-semibold">
			                        <span className="inline-flex items-center gap-2">
			                          <Star size={16} className="text-amber-300" fill="currentColor" />
			                          <span>
			                            {t({ it: 'Messaggi importanti', en: 'Starred messages' })}{' '}
			                            <span className="text-slate-400 font-semibold">
			                              {t({ it: '(tasto destro per rimuovere)', en: '(right click to remove)' })}
			                            </span>
			                          </span>
			                        </span>
			                      </div>
			                      <div className="flex items-center gap-2">
			                        <div className="text-[12px] font-semibold text-slate-400 tabular-nums">{starredMessages.length}</div>
			                        <button
			                          className="icon-button"
		                          onClick={() => window.setTimeout(() => setStarredOpen(false), 0)}
		                          title={t({ it: 'Chiudi', en: 'Close' })}
		                        >
		                          <X size={18} />
		                        </button>
		                      </div>
		                    </div>
		                    <div className="max-h-[70vh] overflow-auto p-3">
		                      {!starredMessages.length ? (
		                        <div className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-sm text-slate-300">
		                          {t({ it: 'Nessun messaggio importante.', en: 'No starred messages.' })}
		                        </div>
			                      ) : (
			                        <div className="space-y-3">
			                          {starredMessages
			                            .slice()
			                            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
			                            .map((m) => {
			                              const mine = String(m.userId) === String(user?.id || '');
			                              const list = Array.isArray(m.attachments) ? m.attachments : [];
			                              const nonVoiceList = list.filter((a) => {
			                                const url = String((a as any).url || '');
			                                const name = String((a as any).name || url).toLowerCase();
			                                return !(name.startsWith('voice-') && isAudioAttachment(a));
			                              });
			                              const who = mine ? t({ it: 'Tu', en: 'You' }) : capFirst(m.username);
			                              const when = new Date(m.createdAt).toLocaleString();
			                              const border = mine ? 'border-emerald-400/20 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/20';
			                              const voiceAtt = list.find((a) => {
			                                const url = String((a as any).url || '');
			                                const name = String((a as any).name || url).toLowerCase();
			                                return !!url && name.startsWith('voice-') && isAudioAttachment(a);
			                              });
			                              const hasText = !!String(m.text || '').trim();
			                              return (
			                                <div
			                                  key={m.id}
			                                  className={`w-full rounded-2xl border px-3 py-3 ${border}`}
			                                  onContextMenu={(e) => {
			                                    e.preventDefault();
			                                    // Right click asks confirmation before removing the star.
			                                    setUnstarConfirmId(m.id);
			                                  }}
			                                >
			                                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
			                                    <button
			                                      type="button"
			                                      className="min-w-0 truncate font-semibold text-slate-100 hover:underline"
			                                      title={t({ it: 'Vai al messaggio', en: 'Go to message' })}
			                                      onClick={() => {
			                                        setStarredOpen(false);
			                                        window.setTimeout(() => scrollToMessage(m.id), 0);
			                                      }}
			                                    >
			                                      {who}
			                                    </button>
			                                    <div className="shrink-0 tabular-nums">{when}</div>
			                                  </div>

			                                  {hasText ? (
			                                    <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2">
			                                      <div className="flex items-start justify-between gap-2">
			                                        <div className="min-w-0 whitespace-pre-wrap break-words text-sm text-slate-100">
			                                          {m.text}
			                                        </div>
			                                        <button
			                                          type="button"
			                                          className="icon-button shrink-0"
			                                          title={t({ it: 'Copia', en: 'Copy' })}
			                                          onClick={() => copyMessageText(m).catch(() => {})}
			                                        >
			                                          <CopyIcon size={18} />
			                                        </button>
			                                      </div>
			                                    </div>
			                                  ) : null}

			                                  {voiceAtt ? (
			                                    <div className="mt-2">
			                                      <VoiceNoteAttachment
			                                        url={String((voiceAtt as any).url || '')}
			                                        mine={mine}
			                                        seed={`starred:${m.id}:${String((voiceAtt as any).url || '')}`}
			                                        sizeBytes={Number((voiceAtt as any).sizeBytes) || 0}
			                                      />
			                                    </div>
			                                  ) : null}

			                                  {nonVoiceList.length ? (
			                                    <div className="mt-2 space-y-2">
			                                      {nonVoiceList.map((a, idx) => {
			                                        const url = String((a as any).url || '');
			                                        const name = String((a as any).name || url);
				                                        const mime = String((a as any).mime || '');
				                                        const ext = extOf(name);
				                                        const isImg = mime.startsWith('image/') || (!mime && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext));
				                                        if (!url) return null;
				                                        if (isImg) {
			                                          return (
			                                            <div
			                                              key={`${url}:${idx}`}
			                                              className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/30 px-2 py-2"
			                                            >
			                                              <button
			                                                type="button"
			                                                className="flex min-w-0 items-center gap-2 rounded-xl focus:outline-none focus-visible:outline-none"
			                                                onClick={() => setMediaModal({ url, name })}
			                                                title={name}
			                                              >
			                                                <img src={url} alt="" className="h-12 w-12 rounded-xl object-cover" draggable={false} />
			                                                <div className="min-w-0 text-left">
			                                                  <div className="truncate text-sm font-semibold text-slate-100">{name}</div>
			                                                  <div className="truncate text-[11px] text-slate-400">{t({ it: 'Foto', en: 'Photo' })}</div>
			                                                </div>
			                                              </button>
			                                              <a
			                                                href={url}
			                                                download={name}
			                                                className="icon-button"
			                                                title={t({ it: 'Scarica', en: 'Download' })}
			                                              >
			                                                <ArrowDownToLine size={18} />
			                                              </a>
			                                            </div>
			                                          );
			                                        }
			                                        return (
			                                          <div
			                                            key={`${url}:${idx}`}
			                                            className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/30 px-3 py-2"
			                                            title={name}
			                                          >
			                                            <div className="min-w-0">
			                                              <div className="truncate text-sm font-semibold text-slate-100">{name}</div>
			                                              <div className="truncate text-[11px] text-slate-400">{mime || ext || t({ it: 'Allegato', en: 'Attachment' })}</div>
			                                            </div>
			                                            <a
			                                              href={url}
			                                              download={name}
			                                              className="icon-button shrink-0"
			                                              title={t({ it: 'Scarica', en: 'Download' })}
			                                            >
			                                              <ArrowDownToLine size={18} />
			                                            </a>
			                                          </div>
			                                        );
			                                      })}
			                                    </div>
			                                  ) : null}
			                                </div>
			                              );
			                            })}
			                        </div>
			                      )}
			                    </div>
			                  </div>
			                </div>
			              ) : null}
			              {unstarConfirmId ? (
			                <div
			                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
			                  onMouseDown={(e) => {
			                    if (e.target === e.currentTarget) window.setTimeout(() => setUnstarConfirmId(null), 0);
			                  }}
			                >
			                  <div
			                    className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
			                    onMouseDown={(e) => e.stopPropagation()}
			                  >
			                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
			                      <div className="min-w-0 truncate text-sm font-semibold">
			                        {t({ it: 'Rimuovere importante?', en: 'Remove starred?' })}
			                      </div>
			                      <button
			                        className="icon-button"
			                        onClick={() => window.setTimeout(() => setUnstarConfirmId(null), 0)}
			                        title={t({ it: 'Chiudi', en: 'Close' })}
			                      >
			                        <X size={18} />
			                      </button>
			                    </div>
			                    <div className="p-4">
			                      {(() => {
			                        const msg = unstarConfirmId ? messagesById.get(String(unstarConfirmId)) : null;
			                        const preview =
			                          msg && !msg.deleted
			                            ? snippet(msg.text, 180) ||
			                              ((msg.attachments || []).length ? t({ it: '[Allegati]', en: '[Attachments]' }) : t({ it: '[Messaggio]', en: '[Message]' }))
			                            : t({ it: 'Messaggio non disponibile.', en: 'Message not available.' });
			                        return (
			                          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 px-4 py-3 text-sm text-slate-200">
			                            <div className="font-semibold text-slate-100">{capFirst(String(msg?.username || '')) || ''}</div>
			                            <div className="mt-1 text-slate-300">{preview}</div>
			                          </div>
			                        );
			                      })()}
			                      <div className="mt-4 flex items-center justify-end gap-2">
			                        <button
			                          className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/30"
			                          onClick={() => setUnstarConfirmId(null)}
			                        >
			                          {t({ it: 'Annulla', en: 'Cancel' })}
			                        </button>
			                        <button
			                          className="rounded-xl border border-amber-800 bg-amber-500/15 px-3 py-2 text-sm font-extrabold text-amber-100 hover:bg-amber-500/25"
			                          onClick={() => {
			                            const msg = unstarConfirmId ? messagesById.get(String(unstarConfirmId)) : null;
			                            if (msg) toggleStar(msg);
			                            setUnstarConfirmId(null);
			                          }}
			                        >
			                          {t({ it: 'Rimuovi', en: 'Remove' })}
			                        </button>
			                      </div>
			                    </div>
			                  </div>
			                </div>
			              ) : null}
		              {reactionsModal ? (
		                <div
		                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		                  onMouseDown={(e) => {
		                    if (e.target === e.currentTarget) window.setTimeout(() => setReactionsModal(null), 0);
		                  }}
		                >
		                  <div
		                    className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
		                    onMouseDown={(e) => e.stopPropagation()}
		                  >
		                    {(() => {
		                      const msg = reactionsModal ? messagesById.get(reactionsModal.messageId) : null;
		                      const reactions =
		                        msg && (msg as any).reactions && typeof (msg as any).reactions === 'object'
		                          ? ((msg as any).reactions as Record<string, string[]>)
		                          : {};
		                      const emojis = CHAT_REACTIONS.filter((e) => Array.isArray(reactions[e]) && reactions[e]!.length);
		                      const tabs: { id: 'all' | string; label: string; count: number }[] = [
		                        {
		                          id: 'all',
		                          label: t({ it: 'Tutti', en: 'All' }),
		                          count: emojis.reduce((sum, e) => sum + (Array.isArray(reactions[e]) ? reactions[e]!.length : 0), 0)
		                        },
		                        ...emojis.map((e) => ({ id: e, label: e, count: Array.isArray(reactions[e]) ? reactions[e]!.length : 0 }))
		                      ];
		                      const activeTab = tabs.some((t0) => t0.id === reactionsModal.tab) ? reactionsModal.tab : 'all';
		                      const userToEmoji = new Map<string, string>();
		                      for (const e of emojis) {
		                        for (const uid of Array.isArray(reactions[e]) ? reactions[e]! : []) {
		                          const id = String(uid || '').trim();
		                          if (!id) continue;
		                          if (!userToEmoji.has(id)) userToEmoji.set(id, e);
		                        }
		                      }
		                      const listUserIds =
		                        activeTab === 'all'
		                          ? Array.from(userToEmoji.keys())
		                          : Array.isArray(reactions[String(activeTab)])
		                            ? (reactions[String(activeTab)] as any[]).map((x) => String(x || '').trim()).filter(Boolean)
		                            : [];
		                      const rows = listUserIds
		                        .map((id) => {
		                          const m = membersById.get(id);
		                          const username = m?.username ? String(m.username) : '';
		                          const fullName = `${String(m?.firstName || '').trim()} ${String(m?.lastName || '').trim()}`.trim();
		                          const label = fullName ? capWords(fullName) : username ? capFirst(username) : id.slice(0, 8);
		                          const avatarUrl = m?.avatarUrl ? String(m.avatarUrl) : '';
		                          const emoji = activeTab === 'all' ? userToEmoji.get(id) || '' : String(activeTab);
		                          return { id, username, label, avatarUrl, emoji };
		                        })
		                        .sort((a, b) => a.label.localeCompare(b.label));
		                      return (
		                        <>
		                          <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
		                            <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Reazioni', en: 'Reactions' })}</div>
		                            <button
		                              className="icon-button"
		                              onClick={() => window.setTimeout(() => setReactionsModal(null), 0)}
		                              title={t({ it: 'Chiudi', en: 'Close' })}
		                            >
		                              <X size={18} />
		                            </button>
		                          </div>
			                          <div className="border-b border-slate-800 bg-slate-950 px-2 py-2">
			                            <div className="flex items-center gap-1 overflow-x-auto">
			                              {tabs.map((tab) => {
			                                const isActive = tab.id === activeTab;
			                                const myId = String(user?.id || '');
			                                const list = tab.id !== 'all' && reactions ? (Array.isArray((reactions as any)[tab.id]) ? (reactions as any)[tab.id] : []) : [];
			                                const mine = !!myId && tab.id !== 'all' && Array.isArray(list) && list.some((id: any) => String(id) === myId);
			                                return (
			                                  <button
			                                    key={tab.id}
			                                    type="button"
			                                    className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold ${
			                                      isActive
			                                        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50'
			                                        : 'border-slate-800 bg-slate-900/20 text-slate-200 hover:bg-slate-900/40'
			                                    }`}
			                                    onClick={() => {
			                                      // If you reacted with this emoji, clicking the same emoji removes it.
			                                      if (tab.id !== 'all' && isActive && mine && msg) {
			                                        toggleReaction(msg, String(tab.id));
			                                        return;
			                                      }
			                                      setReactionsModal({ messageId: reactionsModal.messageId, tab: tab.id });
			                                    }}
			                                    title={
			                                      tab.id !== 'all' && mine
			                                        ? t({ it: 'Clicca per togliere la tua reazione', en: 'Click to remove your reaction' })
			                                        : undefined
			                                    }
			                                  >
			                                    <span className="mr-2">{tab.label}</span>
			                                    <span className="tabular-nums text-slate-300">{tab.count}</span>
			                                  </button>
			                                );
			                              })}
			                            </div>
			                          </div>
		                          <div className="max-h-72 overflow-auto p-2">
		                            {!rows.length ? (
		                              <div className="px-2 py-4 text-sm text-slate-400">{t({ it: 'Nessuna reazione.', en: 'No reactions.' })}</div>
		                            ) : (
		                              <div className="space-y-1">
		                                {rows.map((r) => (
		                                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-slate-900/40">
			                                    <button
			                                      type="button"
			                                      className="flex min-w-0 items-center gap-2 rounded-xl focus:outline-none focus-visible:outline-none"
			                                      onClick={() => openUserProfile(r.id)}
			                                      title={t({ it: 'Profilo utente', en: 'User profile' })}
			                                    >
			                                      <UserAvatar username={r.username || r.label} src={r.avatarUrl} size={28} className="border-slate-800 bg-slate-900" />
			                                      <div className="min-w-0 text-left">
			                                        <div className="truncate text-sm font-semibold text-slate-100">{r.label}</div>
			                                        {r.username ? <div className="truncate text-[11px] text-slate-400">@{r.username}</div> : null}
			                                      </div>
			                                    </button>
		                                    <div className="shrink-0 text-[18px]">{r.emoji}</div>
		                                  </div>
		                                ))}
		                              </div>
		                            )}
		                          </div>
		                        </>
		                      );
		                    })()}
		                  </div>
		                </div>
		              ) : null}
		              {profileUserId ? (
		                <div
		                  className="fixed inset-0 z-[57] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
		                  onMouseDown={(e) => {
		                    if (e.target === e.currentTarget) {
		                      window.setTimeout(() => {
		                        setProfileUserId(null);
		                        setProfileData(null);
		                      }, 0);
		                    }
		                  }}
		                >
		                  <div
		                    className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
		                    onMouseDown={(e) => e.stopPropagation()}
		                  >
		                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
		                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Profilo utente', en: 'User profile' })}</div>
		                      <button
		                        className="icon-button"
		                        onClick={() => {
		                          window.setTimeout(() => {
		                            setProfileUserId(null);
		                            setProfileData(null);
		                          }, 0);
		                        }}
		                        title={t({ it: 'Chiudi', en: 'Close' })}
		                      >
		                        <X size={18} />
		                      </button>
		                    </div>
		                    <div className="max-h-[70vh] overflow-auto p-4">
		                      {profileLoading ? (
		                        <div className="text-sm text-slate-300">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
		                      ) : profileData ? (
		                        <>
		                          <div className="flex items-center gap-3">
		                            <UserAvatar
		                              username={profileData.username}
		                              name={capWords(`${profileData.firstName} ${profileData.lastName}`.trim())}
		                              src={profileData.avatarUrl}
		                              size={54}
		                            />
		                            <div className="min-w-0">
		                              <div className="truncate text-lg font-bold text-slate-50">
		                                {(() => {
		                                  const n = `${profileData.firstName} ${profileData.lastName}`.trim();
		                                  return n ? capWords(n) : capFirst(profileData.username);
		                                })()}
		                              </div>
		                              <div className="truncate text-sm text-slate-300">@{profileData.username}</div>
		                              {profileData.email ? (
		                                <div className="truncate text-sm text-slate-200">
		                                  <span className="text-slate-400">{t({ it: 'Email', en: 'Email' })}: </span>
		                                  <a className="underline hover:text-white" href={`mailto:${profileData.email}`}>
		                                    {profileData.email}
		                                  </a>
		                                </div>
		                              ) : null}
		                            </div>
		                          </div>

		                          <div className="mt-4">
		                            <div className="mb-2 text-xs font-semibold uppercase text-slate-400">
		                              {t({ it: 'Clienti in comune', en: 'Clients in common' })}{' '}
		                              <span className="ml-1 text-slate-500 tabular-nums">{profileData.clientsCommon.length}</span>
		                            </div>
		                            {!profileData.clientsCommon.length ? (
		                              <div className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-sm text-slate-300">
		                                {t({ it: 'Nessun cliente in comune.', en: 'No clients in common.' })}
		                              </div>
		                            ) : (
		                              <div className="flex flex-wrap gap-2">
		                                {profileData.clientsCommon.map((c) => (
		                                  <button
		                                    key={c.id}
		                                    type="button"
		                                    className="rounded-full border border-slate-800 bg-slate-900/20 px-3 py-1 text-[12px] font-semibold text-slate-200 hover:bg-slate-900/40"
		                                    onClick={() => {
		                                      // Jump to that client's chat if available
		                                      window.setTimeout(() => {
		                                        setProfileUserId(null);
		                                        setProfileData(null);
		                                        openClientChat(c.id);
		                                      }, 0);
		                                    }}
		                                    title={t({ it: 'Apri chat cliente', en: 'Open client chat' })}
		                                  >
		                                    {c.name}
		                                  </button>
		                                ))}
		                              </div>
		                            )}
		                          </div>
		                        </>
		                      ) : (
		                        <div className="text-sm text-slate-300">{t({ it: 'Profilo non disponibile.', en: 'Profile not available.' })}</div>
		                      )}
		                    </div>
		                  </div>
		                </div>
		              ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
	        </Dialog>
	      </Transition>
	    </>
	  );
};

export default ClientChatDock;
