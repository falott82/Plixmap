import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'sonner';
import { Check, CheckCheck, ChevronDown, Download, Paperclip, Send, Trash2, X, Users, Star, Info, Mic, Search, ChevronUp, UserCheck, UserX, Rows3 } from 'lucide-react';
import {
  ChatMessage,
  DmContactRow,
  blockChatUser,
  clearChat,
  deleteChatMessage,
  editChatMessage,
  exportChat,
  fetchChatMembers,
  fetchChatMessages,
  fetchChatUnreadSenders,
  fetchDmContacts,
  markChatRead,
  reactChatMessage,
  sendChatMessage,
  starChatMessage,
  unblockChatUser
} from '../../api/chat';
import { updateMyProfile } from '../../api/auth';
import { reviewMeeting } from '../../api/meetings';
import { fetchUserProfile } from '../../api/userProfile';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { useUIStore } from '../../store/useUIStore';
import { useT } from '../../i18n/useT';
import UserAvatar from '../ui/UserAvatar';
import { useDataStore } from '../../store/useDataStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { ChatMessageAttachments, ChatMessageReactions } from './ChatMessageBits';
import { ChatReviewRejectDialog, ChatDeleteMessageDialog } from './ChatConfirmDialogs';
import { ChatStarredPanel } from './ChatStarredPanel';
import { ChatReactionsModal } from './ChatReactionsModal';
import { ChatProfileModal } from './ChatProfileModal';
import { ChatMessageInfoModal } from './ChatMessageInfoModal';
import { ChatMediaLightbox, ChatUnstarConfirm } from './ChatSmallOverlays';
import { ChatActionMenu } from './ChatActionMenu';
import { ChatInfoPanel, ChatMembersPanel, ChatExportPanel, ChatClearChatPanel } from './ChatInfoOverlays';
import {
  MAX_NONVOICE_ATTACH_BYTES,
  MAX_VOICE_SECONDS,
  MAX_VOICE_BYTES,
  CHAT_HISTORY_FETCH_LIMIT,
  CHAT_REACTIONS,
  allowedExts,
  parseMeetingRequestToken,
  extForMime,
  safeFilename,
  isDmThreadId,
  parseDmThreadId,
  dmThreadIdForUsers,
  snippet,
  extOf,
  formatBytes,
  isVoiceRecordingAttachment,
  capFirst,
  localDateKey,
  isAudioAttachment,
  downloadBlob,
  canEditMessage,
  canDeleteForAll,
  computeCanChatClientIds,
  computeFilteredDmContacts,
  computeMembersSorted,
  computeStarredMessages,
  computeSearchHits
} from './ClientChatDock.helpers';


const ClientChatDock = () => {
  const t = useT();
  const { user, permissions } = useAuthStore();
  const isSuperAdmin = !!user?.isSuperAdmin;
  const onlineUserIds = useUIStore((s) => (s as any).onlineUserIds || {});
  const setClientChatDockHeight = useUIStore((s) => (s as any).setClientChatDockHeight);
  const { clientChatOpen, clientChatClientId, openClientChat, closeClientChat, clearChatUnread, chatUnreadByClientId, clientChatDockWidth, clientChatDockPreferredHeight, clientChatDividerLeftWidth, setClientChatDockWidth, setClientChatDockPreferredHeight, setClientChatDividerLeftWidth, setChatUnreadSenderIds } =
    useUIStore((s) => ({
    clientChatOpen: s.clientChatOpen,
    clientChatClientId: s.clientChatClientId,
    openClientChat: (s as any).openClientChat,
    closeClientChat: s.closeClientChat,
    clearChatUnread: s.clearChatUnread,
    chatUnreadByClientId: (s as any).chatUnreadByClientId || {},
    clientChatDockWidth: (s as any).clientChatDockWidth || 980,
    clientChatDockPreferredHeight: (s as any).clientChatDockPreferredHeight || 720,
    clientChatDividerLeftWidth: (s as any).clientChatDividerLeftWidth || 340,
    setClientChatDockWidth: (s as any).setClientChatDockWidth,
    setClientChatDockPreferredHeight: (s as any).setClientChatDockPreferredHeight,
    setClientChatDividerLeftWidth: (s as any).setClientChatDividerLeftWidth,
    setChatUnreadSenderIds: (s as any).setChatUnreadSenderIds
  }));
  const messages = useChatStore((s) => (clientChatClientId ? s.messagesByClientId[clientChatClientId] || [] : []));
  const clientNameFromStore = useChatStore((s) => (clientChatClientId ? s.clientNameById[clientChatClientId] : ''));
  const lastActivityByClientId = useChatStore((s) => s.lastActivityByClientId || {});
  const clientsFull = useDataStore((s) => s.clients || []);
  const clientTree = useDataStore((s) =>
    (s.clients || []).map((c) => ({
      id: c.id,
      name: c.shortName || c.name,
      logoUrl: (c as any).logoUrl,
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
  const [confirmDmBlock, setConfirmDmBlock] = useState<null | { userId: string; username: string }>(null);
  const [confirmReviewReject, setConfirmReviewReject] = useState<null | { meetingId: string; reason: string }>(null);
  const [confirmDeleteMessageMode, setConfirmDeleteMessageMode] = useState<null | { messageId: string; allowAll: boolean }>(null);
  const [unstarConfirmId, setUnstarConfirmId] = useState<string | null>(null);
  const [leftSearchQ, setLeftSearchQ] = useState('');
  const [leftCompact, setLeftCompact] = useState(false);
  const [leftGroupsCollapsed, setLeftGroupsCollapsed] = useState(false);
  const [leftUsersCollapsed, setLeftUsersCollapsed] = useState(false);
  const [dmContacts, setDmContacts] = useState<DmContactRow[]>([]);
  const [dmContactsLoading, setDmContactsLoading] = useState(false);
  const [activeDmMeta, setActiveDmMeta] = useState<any>(null);
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
  const atBottomRef = useRef(true);
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
  const chatLayoutAppliedForUserRef = useRef<string | null>(null);
  const saveChatLayoutTimerRef = useRef<number | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: window.innerWidth, h: window.innerHeight });
  const dragRef = useRef<
    | null
    | {
        mode: 'resize_w' | 'resize_h' | 'resize_wh' | 'divider';
        startX: number;
        startY: number;
        startW: number;
        startH: number;
        startDivider: number;
      }
  >(null);
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

  const activeClientObj = useMemo(() => {
    if (!clientChatClientId) return null;
    if (isDmThreadId(clientChatClientId)) return null;
    return (clientsFull || []).find((c: any) => String(c?.id) === String(clientChatClientId)) || null;
  }, [clientChatClientId, clientsFull]);

  const clientName = useMemo(() => {
    if (!clientChatClientId) return '';
    const fromClientTree = String((activeClientObj as any)?.shortName || (activeClientObj as any)?.name || '').trim();
    if (fromClientTree) return fromClientTree;
    const fromStore = String(clientNameFromStore || '').trim();
    if (fromStore) return fromStore;
    return clientChatClientId;
  }, [activeClientObj, clientChatClientId, clientNameFromStore]);

  const clientLogoUrl = useMemo(() => {
    if (!clientChatClientId) return '';
    const c = (clientTree || []).find((x) => String(x.id) === String(clientChatClientId));
    return String((c as any)?.logoUrl || '');
  }, [clientChatClientId, clientTree]);

  const clientInitial = useMemo(() => {
    const n = String(clientName || '').trim();
    return (n ? n[0] : '?').toUpperCase();
  }, [clientName]);

  // (dmReadOnly/dmBlockedByMe are declared after activeDmContact to avoid TDZ in TS)

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

  useEffect(() => {
    if (!user?.id) return;
    if (chatLayoutAppliedForUserRef.current === user.id) return;
    chatLayoutAppliedForUserRef.current = user.id;
    const layout = ((user as any).chatLayout || {}) as any;
    if (layout && typeof layout === 'object') {
      if (Number.isFinite(layout.chatDockWidth)) setClientChatDockWidth(Number(layout.chatDockWidth));
      if (Number.isFinite(layout.chatDockHeight)) setClientChatDockPreferredHeight(Number(layout.chatDockHeight));
      if (Number.isFinite(layout.chatDividerLeftWidth)) setClientChatDividerLeftWidth(Number(layout.chatDividerLeftWidth));
      if (typeof layout.leftCompact === 'boolean') setLeftCompact(layout.leftCompact);
      if (typeof layout.leftGroupsCollapsed === 'boolean') setLeftGroupsCollapsed(layout.leftGroupsCollapsed);
      if (typeof layout.leftUsersCollapsed === 'boolean') setLeftUsersCollapsed(layout.leftUsersCollapsed);
    }
  }, [
    setClientChatDividerLeftWidth,
    setClientChatDockPreferredHeight,
    setClientChatDockWidth,
    user?.id,
    setLeftCompact,
    setLeftGroupsCollapsed,
    setLeftUsersCollapsed
  ]);

  useEffect(() => {
    if (!user?.id) return;
    if (saveChatLayoutTimerRef.current) window.clearTimeout(saveChatLayoutTimerRef.current);
    saveChatLayoutTimerRef.current = window.setTimeout(() => {
      const prev = (((useAuthStore.getState() as any)?.user as any)?.chatLayout || {}) as any;
      const next = {
        ...(prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {}),
        chatDockWidth: clientChatDockWidth,
        chatDockHeight: clientChatDockPreferredHeight,
        chatDividerLeftWidth: clientChatDividerLeftWidth,
        leftCompact,
        leftGroupsCollapsed,
        leftUsersCollapsed
      };
      updateMyProfile({ chatLayout: next })
        .then(() => {
          // keep local auth store in sync (best effort)
          useAuthStore.setState((s) => (s.user ? ({ ...s, user: { ...(s.user as any), chatLayout: next } } as any) : s));
        })
        .catch(() => {});
    }, 650);
    return () => {
      if (saveChatLayoutTimerRef.current) window.clearTimeout(saveChatLayoutTimerRef.current);
      saveChatLayoutTimerRef.current = null;
    };
  }, [clientChatDividerLeftWidth, clientChatDockPreferredHeight, clientChatDockWidth, leftCompact, leftGroupsCollapsed, leftUsersCollapsed, user?.id]);

  const canChatClientIds = useMemo(
    () => computeCanChatClientIds(clientTree as any[], permissions as any[], user),
    [clientTree, permissions, user]
  );

  const chatClients = useMemo(() => {
    return (clientTree || [])
      .filter((c) => canChatClientIds.has(c.id))
      .map((c) => ({ id: c.id, name: c.name, logoUrl: (c as any)?.logoUrl }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [canChatClientIds, clientTree]);

  useEffect(() => {
    if (!clientChatOpen || !user?.id) return;
    setDmContactsLoading(true);
    fetchDmContacts()
      .then((payload) => {
        const list = Array.isArray(payload.users) ? payload.users : [];
        setDmContacts(list);
      })
      .catch(() => {
        setDmContacts([]);
      })
      .finally(() => setDmContactsLoading(false));
  }, [clientChatOpen, user?.id]);

  const refreshDmContacts = async () => {
    if (!user?.id) return;
    setDmContactsLoading(true);
    try {
      const payload = await fetchDmContacts();
      const list = Array.isArray(payload.users) ? payload.users : [];
      setDmContacts(list);
    } catch {
      // ignore
    } finally {
      setDmContactsLoading(false);
    }
  };

  useEffect(() => {
    if (!clientChatOpen) return;
    if (clientChatClientId) return;
    if (chatClients.length) {
      openClientChat(chatClients[0]!.id);
      return;
    }
    if (user?.id && dmContacts.length) {
      const threadId = dmThreadIdForUsers(user.id, dmContacts[0]!.id);
      if (threadId) openClientChat(threadId);
    }
  }, [chatClients, clientChatClientId, clientChatOpen, dmContacts, openClientChat, user?.id]);

  const activeDmContact = useMemo(() => {
    if (!clientChatClientId || !user?.id) return null;
    if (!isDmThreadId(clientChatClientId)) return null;
    const parsed = parseDmThreadId(clientChatClientId);
    if (!parsed) return null;
    const otherId = parsed.a === user.id ? parsed.b : parsed.b === user.id ? parsed.a : '';
    if (!otherId) return null;
    return dmContacts.find((u) => String(u.id) === String(otherId)) || null;
  }, [clientChatClientId, dmContacts, user?.id]);

  const dmReadOnly = useMemo(() => {
    if (!clientChatClientId) return false;
    if (!isDmThreadId(clientChatClientId)) return false;
    return !!(activeDmMeta as any)?.readOnly || !!(activeDmContact as any)?.readOnly;
  }, [activeDmContact, activeDmMeta, clientChatClientId]);

  const dmBlockedByMe = useMemo(() => {
    if (!clientChatClientId) return false;
    if (!isDmThreadId(clientChatClientId)) return false;
    return !!(activeDmMeta as any)?.blockedByMe || !!(activeDmContact as any)?.blockedByMe;
  }, [activeDmContact, activeDmMeta, clientChatClientId]);

  const leftQuery = useMemo(() => String(leftSearchQ || '').trim().toLowerCase(), [leftSearchQ]);
  const showLeftGroups = !!leftQuery || !leftGroupsCollapsed;
  const showLeftUsers = !!leftQuery || !leftUsersCollapsed;
  const filteredChatClients = useMemo(() => {
    if (!leftQuery) return chatClients;
    return (chatClients || []).filter((c) => String(c.name || '').toLowerCase().includes(leftQuery));
  }, [chatClients, leftQuery]);
  const filteredDmContacts = useMemo(
    () => computeFilteredDmContacts(dmContacts as any[], lastActivityByClientId, leftQuery, user),
    [dmContacts, lastActivityByClientId, leftQuery, user]
  );

  const membersSorted = useMemo(
    () => computeMembersSorted(members as any[], onlineUserIds),
    [members, onlineUserIds]
  );

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
      { k: 'Cmd+K / Ctrl+K / Esc', v: t({ it: 'Chiudi chat', en: 'Close chat' }) },
      { k: 'Enter', v: t({ it: 'Invia messaggio', en: 'Send message' }) },
      { k: 'Shift+Enter', v: t({ it: 'A capo', en: 'New line' }) },
      { k: 'Alt+M', v: t({ it: 'Modifica ultimo messaggio (entro 30 minuti)', en: 'Edit last message (within 30 minutes)' }) },
      { k: t({ it: 'Allegati', en: 'Attachments' }), v: t({ it: `max totale ${formatBytes(MAX_NONVOICE_ATTACH_BYTES)}`, en: `max total ${formatBytes(MAX_NONVOICE_ATTACH_BYTES)}` }) },
      { k: t({ it: 'Vocali', en: 'Voice notes' }), v: t({ it: `max ${voiceMins} minuti`, en: `max ${voiceMins} minutes` }) }
    ];
  }, [t]);

  const starredMessages = useMemo(() => computeStarredMessages(messages, user), [messages, user]);

  const searchHits = useMemo(() => computeSearchHits(messages, searchQ), [messages, searchQ]);

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
    atBottomRef.current = true;
  };

  const scrollToBottomSoon = () => {
    // Two rAFs to ensure layout/scrollHeight are correct after store updates.
    window.requestAnimationFrame(() => window.requestAnimationFrame(scrollToBottom));
  };

  const scrollToMessage = (id: string, behavior: ScrollBehavior = 'smooth') => {
    const el = document.getElementById(`chatmsg-${id}`);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior, block: 'center' });
    } catch {
      el.scrollIntoView();
    }
  };

  const scrollToMessageSoon = (id: string, behavior: ScrollBehavior = 'smooth') => {
    // Two rAFs to ensure the message nodes exist after store updates.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollToMessage(id, behavior)));
  };

  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottomRef.current = remaining < 80;
  };

  useEffect(() => {
    if (!clientChatOpen || !clientChatClientId || !user?.id) return;
    setErr(null);
    const cachedMessages = useChatStore.getState().messagesByClientId?.[clientChatClientId] || [];
    setLoading(!Array.isArray(cachedMessages) || !cachedMessages.length);
    setExportOpen(false);
    setMembersOpen(false);
    fetchChatMessages(clientChatClientId, { limit: CHAT_HISTORY_FETCH_LIMIT })
      .then((payload) => {
        setActiveDmMeta((payload as any)?.dm || null);
        const lastReadAt = Number((payload as any)?.lastReadAt || 0) || 0;
        const isGroupChat = !isDmThreadId(clientChatClientId);
        const firstUnreadId = isGroupChat
          ? String(
              (Array.isArray(payload.messages) ? payload.messages : []).find((m: any) => m && !m.deleted && Number(m.createdAt || 0) > lastReadAt)?.id || ''
            ).trim()
          : '';
        useChatStore.getState().setMessages(clientChatClientId, payload.clientName || '', payload.messages || []);
        clearChatUnread(clientChatClientId);
        markChatRead(clientChatClientId)
          .then(() => fetchChatUnreadSenders().then((p) => setChatUnreadSenderIds((p as any)?.senderIds || [])).catch(() => {}))
          .catch(() => {});
        if (firstUnreadId) {
          atBottomRef.current = false;
          scrollToMessageSoon(firstUnreadId, 'auto');
        } else {
          scrollToBottomSoon();
        }
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : 'Failed to load chat');
      })
      .finally(() => setLoading(false));
  }, [clearChatUnread, clientChatClientId, clientChatOpen, user?.id]);

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
    // WhatsApp-like: when opening the chat, focus the composer.
    window.setTimeout(() => composeTextareaRef.current?.focus(), 0);
  }, [clientChatClientId, clientChatOpen]);

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
    // Auto-scroll only if user is already at (or near) the bottom.
    if (!messages.length) return;
    if (!atBottomRef.current) return;
    scrollToBottomSoon();
  }, [clientChatClientId, clientChatOpen, messages.length]);

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
    const dmReadOnly = isDmThreadId(clientChatClientId) && (!!(activeDmMeta as any)?.readOnly || !!(activeDmContact as any)?.readOnly);
    const dmBlockedByMe = isDmThreadId(clientChatClientId) && (!!(activeDmMeta as any)?.blockedByMe || !!(activeDmContact as any)?.blockedByMe);
    if (dmReadOnly) {
      setErr(t({ it: 'Chat in sola lettura: non condividi clienti in comune con questo utente.', en: 'Read-only chat: you do not share any customers with this user.' }));
      return;
    }
    if (dmBlockedByMe) {
      setErr(t({ it: 'Hai bloccato questo utente: sbloccalo per inviare messaggi.', en: 'You blocked this user: unblock to send messages.' }));
      return;
    }
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

  const reviewMeetingFromChat = async (meetingId: string, action: 'approve' | 'reject') => {
    const id = String(meetingId || '').trim();
    if (!id) return;
    try {
      if (action === 'reject') {
        setConfirmReviewReject({ meetingId: id, reason: '' });
        return;
      }
      await reviewMeeting(id, { action });
      toast.success(
        action === 'approve'
          ? t({ it: 'Meeting approvato.', en: 'Meeting approved.' })
          : t({ it: 'Meeting rifiutato.', en: 'Meeting rejected.' })
      );
    } catch (error: any) {
      const msg = String(error?.message || '').trim();
      toast.error(
        msg ||
          t({
            it: 'Impossibile completare la revisione meeting.',
            en: 'Unable to complete meeting review.'
          })
      );
    }
  };

  const submitMeetingReject = async () => {
    const payload = confirmReviewReject;
    if (!payload?.meetingId) return;
    const reason = String(payload.reason || '').trim();
    if (!reason) return;
    try {
      await reviewMeeting(payload.meetingId, { action: 'reject', reason });
      toast.success(t({ it: 'Meeting rifiutato.', en: 'Meeting rejected.' }));
      setConfirmReviewReject(null);
    } catch (error: any) {
      const msg = String(error?.message || '').trim();
      toast.error(
        msg ||
          t({
            it: 'Impossibile completare la revisione meeting.',
            en: 'Unable to complete meeting review.'
          })
      );
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

  const confirmBlockDmUser = async () => {
    if (!confirmDmBlock?.userId) return;
    try {
      await blockChatUser(confirmDmBlock.userId);
      setActiveDmMeta((prev: any) => (prev && typeof prev === 'object' ? { ...prev, blockedByMe: true } : prev));
      await refreshDmContacts();
    } catch {
      // ignore
    } finally {
      setConfirmDmBlock(null);
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
    const allowDeleteForAll = !!user?.id && canDeleteForAll(msg, String(user.id));
    setConfirmDeleteMessageMode({ messageId: String(msg.id), allowAll: allowDeleteForAll });
  };

  const confirmRemoveMessage = async (mode: 'me' | 'all') => {
    if (!clientChatClientId || !confirmDeleteMessageMode?.messageId) return;
    try {
      await deleteChatMessage(confirmDeleteMessageMode.messageId, mode);
      if (mode === 'me') {
        const payload = await fetchChatMessages(clientChatClientId, { limit: CHAT_HISTORY_FETCH_LIMIT });
        useChatStore.getState().setMessages(clientChatClientId, payload.clientName || '', payload.messages || []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setConfirmDeleteMessageMode(null);
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
    // When running Plixmap on plain http://<lan-ip>, the browser will deny without prompting.
    if (!window.isSecureContext) {
      const host = window.location?.hostname || '';
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!isLocalhost) {
        setErr(
          t({
            it: `Il microfono in Chrome funziona solo su HTTPS (o su http://localhost). Apri Plixmap in HTTPS per usare i vocali. Origin: ${window.location?.origin || ''}`,
            en: `Microphone requires HTTPS (or http://localhost). Open Plixmap in HTTPS to record voice notes. Origin: ${window.location?.origin || ''}`
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

  const panelW = Math.max(520, Math.min(Number(clientChatDockWidth) || 980, Math.max(520, viewport.w - 32)));
  const panelH = Math.max(420, Math.min(Number(clientChatDockPreferredHeight) || 720, Math.max(420, viewport.h - 32)));

  const beginDrag = (mode: 'resize_w' | 'resize_h' | 'resize_wh' | 'divider', e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startW: panelW,
      startH: panelH,
      startDivider: clientChatDividerLeftWidth
    };
    const onMove = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = ev.clientX - d.startX;
      const dy = ev.clientY - d.startY;
      if (d.mode === 'resize_w' || d.mode === 'resize_wh') {
        setClientChatDockWidth(d.startW - dx);
      }
      if (d.mode === 'resize_h' || d.mode === 'resize_wh') {
        setClientChatDockPreferredHeight(d.startH - dy);
      }
      if (d.mode === 'divider') {
        setClientChatDividerLeftWidth(d.startDivider + dx);
      }
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
  };

  return (
    <>
      <Transition show={clientChatOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={onCloseChatDialog}>
	          <div className="fixed inset-0 pointer-events-none">
	            <div className="absolute bottom-4 right-4 pointer-events-auto" style={{ width: panelW }}>
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
		                    style={{ height: panelH }}
		                    className="relative rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card overflow-hidden"
		                  >
                        {/* Resize handles: drag left/top edges (panel is anchored bottom-right). */}
                        <div
                          className="absolute left-0 top-0 z-[90] h-full w-2 cursor-ew-resize"
                          onPointerDown={(e) => beginDrag('resize_w', e)}
                          title={t({ it: 'Ridimensiona larghezza', en: 'Resize width' })}
                        />
                        <div
                          className="absolute left-0 top-0 z-[90] h-2 w-full cursor-ns-resize"
                          onPointerDown={(e) => beginDrag('resize_h', e)}
                          title={t({ it: 'Ridimensiona altezza', en: 'Resize height' })}
                        />
                        <div
                          className="absolute left-0 top-0 z-[91] h-4 w-4 cursor-nwse-resize"
                          onPointerDown={(e) => beginDrag('resize_wh', e)}
                          title={t({ it: 'Ridimensiona', en: 'Resize' })}
                        />
	                  <div className="flex h-full min-h-0">
                        <div
                          className="flex shrink-0 flex-col border-r border-slate-800 bg-slate-950/40"
                          style={{ width: clientChatDividerLeftWidth }}
                        >
                          <div className="border-b border-slate-800 bg-slate-900/70 p-2">
                            <div className="flex items-center gap-2">
                              <input
                                value={leftSearchQ}
                                onChange={(e) => setLeftSearchQ(e.target.value)}
                                placeholder={t({ it: 'Cerca gruppi o utenti…', en: 'Search groups or users…' })}
                                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-primary/30 focus:ring-2"
                              />
                              <button
                                type="button"
                                className={`${headerIconBtn} h-10 w-10 rounded-xl ${leftCompact ? 'bg-slate-800 text-slate-50' : ''}`}
                                onClick={() => setLeftCompact((v) => !v)}
                                title={t({ it: leftCompact ? 'Vista normale' : 'Vista compatta', en: leftCompact ? 'Normal view' : 'Compact view' })}
                              >
                                <Rows3 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="min-h-0 flex-1 overflow-auto p-2">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-2 pb-1 text-[11px] font-semibold uppercase text-slate-400 hover:text-slate-200"
                              onClick={() => setLeftGroupsCollapsed((v) => !v)}
                              title={t({ it: 'Mostra/nascondi gruppi', en: 'Show/hide groups' })}
                            >
                              <span>{t({ it: 'Gruppi', en: 'Groups' })}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">{String(filteredChatClients.length)}</span>
                                <ChevronDown size={14} className={`transition-transform ${showLeftGroups ? '' : '-rotate-90'}`} />
                              </span>
                            </button>
                            {showLeftGroups ? (
                              <div className="space-y-1">
                                {(filteredChatClients || []).map((c) => {
                                  const active = c.id === clientChatClientId;
                                  const unread = Number((chatUnreadByClientId as any)?.[c.id] || 0);
                                  const logo = String((c as any)?.logoUrl || '').trim();
                                  const initial = (String(c.name || '').trim()?.[0] || '?').toUpperCase();
                                  return (
                                    <button
                                      key={c.id}
                                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2 text-left hover:bg-slate-900 ${
                                        leftCompact ? 'py-1.5' : 'py-2'
                                      } ${active ? 'border-slate-600 bg-slate-900/60' : 'border-transparent'}`}
                                      onClick={() => {
                                        setMediaModal(null);
                                        setMessageInfoId(null);
                                        setReplyToId(null);
                                        openClientChat(c.id);
                                      }}
                                      title={c.name}
                                    >
                                      <span className="flex min-w-0 items-center gap-2">
                                        <span
                                          className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60 ${
                                            leftCompact ? 'h-8 w-8' : 'h-9 w-9'
                                          }`}
                                        >
                                          {logo ? (
                                            <img src={logo} alt="" className="h-full w-full object-cover" draggable={false} />
                                          ) : (
                                            <span className="text-[13px] font-extrabold text-slate-200">{initial}</span>
                                          )}
                                        </span>
                                        <span className="min-w-0">
                                          <div className={`truncate font-semibold text-slate-100 ${leftCompact ? 'text-[13px]' : 'text-sm'}`}>{c.name}</div>
                                          {!leftCompact ? (
                                            <div className="truncate text-[11px] text-slate-400">{t({ it: 'Chat cliente', en: 'Customer chat' })}</div>
                                          ) : null}
                                        </span>
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

                            <button
                              type="button"
                              className="mt-4 flex w-full items-center justify-between gap-2 px-2 pb-1 text-[11px] font-semibold uppercase text-slate-400 hover:text-slate-200"
                              onClick={() => setLeftUsersCollapsed((v) => !v)}
                              title={t({ it: 'Mostra/nascondi utenti', en: 'Show/hide users' })}
                            >
                              <span>{t({ it: 'Utenti', en: 'Users' })}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">{String(filteredDmContacts.length)}</span>
                                <ChevronDown size={14} className={`transition-transform ${showLeftUsers ? '' : '-rotate-90'}`} />
                              </span>
                            </button>
                            {dmContactsLoading ? (
                              <div className="px-2 py-2 text-xs text-slate-400">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                            ) : null}
                            {showLeftUsers ? <div className="space-y-1">
                              {(filteredDmContacts || []).map((u) => {
                                if (!user?.id) return null;
                                const threadId = dmThreadIdForUsers(user.id, u.id);
                                const active = threadId && threadId === clientChatClientId;
                                const unread = threadId ? Number((chatUnreadByClientId as any)?.[threadId] || 0) : 0;
                                const displayName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
                                const status = u.lastOnlineAt ? 'offline' : 'never';
                                const online = !!(onlineUserIds as any)?.[u.id] || !!u.online;
                                const dot = u.readOnly ? 'bg-slate-500' : online ? 'bg-emerald-500' : u.lastOnlineAt ? 'bg-rose-500' : 'bg-slate-500';
                                const common = (u.commonClients || []).slice(0, 3).map((c: any) => c.name).join(', ');
                                return (
                                  <button
                                    key={u.id}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2 text-left hover:bg-slate-900 ${
                                      leftCompact ? 'py-1.5' : 'py-2'
                                    } ${active ? 'border-slate-600 bg-slate-900/60' : 'border-transparent'}`}
                                    onClick={() => {
                                      setMediaModal(null);
                                      setMessageInfoId(null);
                                      setReplyToId(null);
                                      if (threadId) openClientChat(threadId);
                                    }}
                                    title={displayName}
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      <span className="relative">
                                        <UserAvatar
                                          username={u.username}
                                          src={u.avatarUrl}
                                          size={leftCompact ? 32 : 36}
                                          className="border-slate-800 bg-slate-900"
                                        />
                                        {!u.readOnly && !u.blockedMe ? (
                                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-slate-950 ${dot}`} />
                                        ) : null}
                                      </span>
                                      <span className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <div className={`truncate font-semibold text-slate-100 ${leftCompact ? 'text-[13px]' : 'text-sm'}`}>{displayName}</div>
                                          {u.blockedByMe ? (
                                            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                              {t({ it: 'Bloccato', en: 'Blocked' })}
                                            </span>
                                          ) : null}
                                          {u.readOnly ? (
                                            <span className="rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                                              {t({ it: 'Sola lettura', en: 'Read-only' })}
                                            </span>
                                          ) : null}
                                        </div>
                                        {!leftCompact ? (
                                          <>
                                            <div className="truncate text-[11px] text-slate-400">
                                              {u.readOnly || u.blockedMe ? (
                                                t({ it: 'Gruppi in comune non disponibili', en: 'Common groups not available' })
                                              ) : common ? (
                                                t({ it: `In comune: ${common}`, en: `Common: ${common}` })
                                              ) : (
                                                t({ it: 'Nessun gruppo in comune', en: 'No common groups' })
                                              )}
                                            </div>
                                            <div className="truncate text-[11px] text-slate-500">
                                              {u.readOnly || u.blockedMe
                                                ? ''
                                                : online
                                                  ? t({ it: 'Online', en: 'Online' })
                                                  : status === 'never'
                                                    ? t({ it: 'Mai connesso', en: 'Never connected' })
                                                    : u.lastOnlineAt
                                                      ? `${t({ it: 'Last online', en: 'Last online' })}: ${new Date(u.lastOnlineAt).toLocaleString()}`
                                                      : ''}
                                            </div>
                                          </>
                                        ) : (
                                          <div className="truncate text-[11px] text-slate-500">
                                            {u.readOnly || u.blockedMe
                                              ? ''
                                              : online
                                                ? t({ it: 'Online', en: 'Online' })
                                                : status === 'never'
                                                  ? t({ it: 'Mai connesso', en: 'Never connected' })
                                                  : u.lastOnlineAt
                                                    ? `${t({ it: 'Last online', en: 'Last online' })}: ${new Date(u.lastOnlineAt).toLocaleString()}`
                                                    : ''}
                                          </div>
                                        )}
                                      </span>
                                    </span>
                                    {unread > 0 ? (
                                      <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                        {unread > 99 ? '99+' : String(unread)}
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div> : null}
                          </div>
                        </div>

                        <div
                          className="group relative shrink-0"
                          style={{ width: 8 }}
                          onPointerDown={(e) => beginDrag('divider', e)}
                          title={t({ it: 'Ridimensiona colonna', en: 'Resize column' })}
                        >
                          <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-slate-800 group-hover:bg-slate-700" />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col">
	                  <div className="relative z-[40] flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                    <div className="min-w-0">
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
                    </div>
		                    <div className="flex items-center gap-1">
                          {activeDmContact ? (
                            <button
                              className={headerIconBtn}
                              onClick={async () => {
                                try {
                                  if (!activeDmContact?.id) return;
                                  if (dmBlockedByMe) {
                                    await unblockChatUser(activeDmContact.id);
                                    setActiveDmMeta((prev: any) => (prev && typeof prev === 'object' ? { ...prev, blockedByMe: false } : prev));
                                    await refreshDmContacts();
                                    return;
                                  }
                                  setConfirmDmBlock({ userId: String(activeDmContact.id), username: String(activeDmContact.username || '') });
                                } catch {
                                  // ignore
                                }
                              }}
                              title={
                                dmBlockedByMe
                                  ? t({ it: 'Sblocca utente', en: 'Unblock user' })
                                  : t({ it: 'Blocca utente', en: 'Block user' })
                              }
                              aria-label={dmBlockedByMe ? t({ it: 'Sblocca utente', en: 'Unblock user' }) : t({ it: 'Blocca utente', en: 'Block user' })}
                            >
                              {dmBlockedByMe ? <UserCheck size={18} /> : <UserX size={18} />}
                            </button>
                          ) : null}
		                      <button
		                        className={headerIconBtn}
		                        onClick={() => {
		                          setHelpOpen(true);
		                          setMembersOpen(false);
		                          setExportOpen(false);
		                          setSearchOpen(false);
		                          setStarredOpen(false);
		                        }}
		                        title={t({ it: 'Info chat', en: 'Chat info' })}
		                        aria-label={t({ it: 'Info chat', en: 'Chat info' })}
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

                  {dmReadOnly ? (
                    <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-200">
                      {t({
                        it: 'Chat in sola lettura: non condividi piu alcun cliente in comune con questo utente.',
                        en: 'Read-only chat: you no longer share any customers with this user.'
                      })}
                    </div>
                  ) : dmBlockedByMe ? (
                    <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] font-semibold text-amber-200">
                      {t({ it: 'Hai bloccato questo utente. Sbloccalo per inviare messaggi.', en: 'You blocked this user. Unblock to send messages.' })}
                    </div>
                  ) : null}

	                <div className="min-h-0 flex-1 bg-slate-950">
	                  <div ref={listRef} onScroll={onListScroll} className="h-full overflow-auto p-3 space-y-2">
                    {loading ? (
                      <div className="text-sm text-slate-300">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                    ) : null}
	                    {(() => {
	                      let lastDay = '';
	                      return (messages || []).map((m) => {
	                        const mine = String(m.userId) === String(user?.id || '');
	                        const showDmTicks = !!clientChatClientId && isDmThreadId(clientChatClientId) && mine;
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
	                        const meetingRequestId = parseMeetingRequestToken(String(m.text || ''));
	                        const canReviewMeetingFromChat = !!meetingRequestId && (!!user?.isAdmin || !!user?.isSuperAdmin);
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
                                {showDmTicks ? (
                                  <span className="inline-flex items-center opacity-90" title={t({ it: 'Stato consegna', en: 'Delivery status' })}>
                                    {(m as any)?.readAt ? (
                                      <CheckCheck size={14} className="text-sky-400" />
                                    ) : (m as any)?.deliveredAt ? (
                                      <CheckCheck size={14} className="text-slate-300/80" />
                                    ) : (
                                      <Check size={14} className="text-slate-300/80" />
                                    )}
                                  </span>
                                ) : null}
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
                                {!m.deleted && canReviewMeetingFromChat ? (
                                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/40 px-2 py-2 text-xs">
                                    <button
                                      type="button"
                                      className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-700"
                                      onClick={() => reviewMeetingFromChat(String(meetingRequestId || ''), 'approve')}
                                    >
                                      {t({ it: 'Approva', en: 'Approve' })}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-lg bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700"
                                      onClick={() => reviewMeetingFromChat(String(meetingRequestId || ''), 'reject')}
                                    >
                                      {t({ it: 'Rifiuta', en: 'Reject' })}
                                    </button>
                                    <span className="text-slate-300">#{meetingRequestId}</span>
                                  </div>
                                ) : null}
                                {m.editedAt && !m.deleted ? (
                                  <span className="ml-2 text-[10px] font-semibold opacity-60">{t({ it: '(modificato)', en: '(edited)' })}</span>
                                ) : null}
                                {!m.deleted ? <ChatMessageAttachments m={m} user={user} setMediaModal={setMediaModal} t={t} /> : null}
                                {!m.deleted ? <ChatMessageReactions m={m} user={user} toggleReaction={toggleReaction} setReactionsModal={setReactionsModal} t={t} /> : null}
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
	                      disabled={recording || dmReadOnly || dmBlockedByMe}
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
		                      disabled={dmReadOnly || dmBlockedByMe}
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
	                      disabled={recording || dmReadOnly || dmBlockedByMe}
	                    />
		                    <button
	                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
	                      onClick={() => (recording ? stopRecording() : send())}
	                      title={recording ? t({ it: 'Invia vocale', en: 'Send voice note' }) : t({ it: 'Invia', en: 'Send' })}
		                      disabled={sending || dmReadOnly || dmBlockedByMe}
		                    >
	                      <Send size={18} />
	                    </button>
		                  </div>
		                  {/* Help moved to the Info button in the header */}
		                  </div>
		                  </div>
                        </div>
                      </div>
		                  {/* Action menu must live inside Dialog.Panel, otherwise HeadlessUI treats it as "outside click"
		                      and the click is lost (resulting in downloads/click-through). */}
		                  <ChatActionMenu
		                    actionMenu={actionMenu}
		                    setActionMenu={setActionMenu}
		                    actionMenuRef={actionMenuRef}
		                    messagesById={messagesById}
		                    user={user}
		                    isSuperAdmin={isSuperAdmin}
		                    startReply={startReply}
		                    setReactPickerId={setReactPickerId}
		                    scrollToMessage={scrollToMessage}
		                    toggleStar={toggleStar}
		                    copyMessageText={copyMessageText}
		                    openMessageInfo={openMessageInfo}
		                    startEdit={startEdit}
		                    remove={remove}
		                    t={t}
		                  />
			              <ChatInfoPanel
			                helpOpen={helpOpen}
			                setHelpOpen={setHelpOpen}
			                activeClientObj={activeClientObj}
			                clientLogoUrl={clientLogoUrl}
			                clientInitial={clientInitial}
			                clientName={clientName}
			                activeDmContact={activeDmContact}
			                onlineUserIds={onlineUserIds}
			                helpItems={helpItems}
			                t={t}
			              />
			              <ChatMembersPanel
			                membersOpen={membersOpen}
			                setMembersOpen={setMembersOpen}
			                members={members}
			                membersLoading={membersLoading}
			                membersSorted={membersSorted}
			                onlineUserIds={onlineUserIds}
			                openUserProfile={openUserProfile}
			                t={t}
			              />
			              <ChatExportPanel
			                exportOpen={exportOpen}
			                setExportOpen={setExportOpen}
			                doExport={doExport}
			                clientChatClientId={clientChatClientId}
			                clientName={clientName}
			                setErr={setErr}
			                t={t}
			              />
			              <ChatClearChatPanel
			                clearChatOpen={clearChatOpen}
			                setClearChatOpen={setClearChatOpen}
			                clearChatTyped={clearChatTyped}
			                setClearChatTyped={setClearChatTyped}
			                clearChatBusy={clearChatBusy}
			                doClearChat={doClearChat}
			                t={t}
			              />
			              <ChatMediaLightbox mediaModal={mediaModal} setMediaModal={setMediaModal} t={t} />
		              <ChatMessageInfoModal
		                messageInfoId={messageInfoId}
		                setMessageInfoId={setMessageInfoId}
		                messagesById={messagesById}
		                messageInfoMembersSorted={messageInfoMembersSorted}
		                messageInfoLoading={messageInfoLoading}
		                onlineUserIds={onlineUserIds}
		                openUserProfile={openUserProfile}
		                t={t}
		              />
			              <ChatStarredPanel
			                starredOpen={starredOpen}
			                setStarredOpen={setStarredOpen}
			                starredMessages={starredMessages}
			                user={user}
			                setUnstarConfirmId={setUnstarConfirmId}
			                scrollToMessage={scrollToMessage}
			                copyMessageText={copyMessageText}
			                setMediaModal={setMediaModal}
			                t={t}
			              />
			              <ChatUnstarConfirm
			                unstarConfirmId={unstarConfirmId}
			                setUnstarConfirmId={setUnstarConfirmId}
			                messagesById={messagesById}
			                toggleStar={toggleStar}
			                t={t}
			              />
		              <ChatReactionsModal
		                reactionsModal={reactionsModal}
		                setReactionsModal={setReactionsModal}
		                messagesById={messagesById}
		                membersById={membersById}
		                user={user}
		                toggleReaction={toggleReaction}
		                openUserProfile={openUserProfile}
		                t={t}
		              />
		              <ChatProfileModal
		                profileUserId={profileUserId}
		                setProfileUserId={setProfileUserId}
		                setProfileData={setProfileData}
		                profileLoading={profileLoading}
		                profileData={profileData}
		                onlineUserIds={onlineUserIds}
		                openClientChat={openClientChat}
		                t={t}
		              />
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
	        </Dialog>
	      </Transition>
      <ConfirmDialog
        open={!!confirmDmBlock}
        title={t({ it: 'Bloccare utente?', en: 'Block user?' })}
        description={
          confirmDmBlock
            ? t({
                it: `Bloccare ${confirmDmBlock.username}? I suoi messaggi resteranno con una sola spunta grigia finché il blocco è attivo.`,
                en: `Block ${confirmDmBlock.username}? Their messages will stay with one gray check while blocked.`
              })
            : ''
        }
        onCancel={() => setConfirmDmBlock(null)}
        onConfirm={() => {
          void confirmBlockDmUser();
        }}
        confirmLabel={t({ it: 'Blocca', en: 'Block' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        zIndexClass="z-[220]"
      />
      <ChatReviewRejectDialog
        confirmReviewReject={confirmReviewReject}
        setConfirmReviewReject={setConfirmReviewReject}
        submitMeetingReject={submitMeetingReject}
        t={t}
      />
      <ChatDeleteMessageDialog
        confirmDeleteMessageMode={confirmDeleteMessageMode}
        setConfirmDeleteMessageMode={setConfirmDeleteMessageMode}
        confirmRemoveMessage={confirmRemoveMessage}
        t={t}
      />
	    </>
	  );
};

export default ClientChatDock;
