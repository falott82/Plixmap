import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { toast } from 'sonner';
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
  starChatMessage
} from '../../api/chat';
import { updateMyProfile } from '../../api/auth';
import { reviewMeeting } from '../../api/meetings';
import { fetchUserProfile } from '../../api/userProfile';
import { useAuthStore } from '../../store/useAuthStore';
import { useChatStore } from '../../store/useChatStore';
import { useUIStore } from '../../store/useUIStore';
import { useT } from '../../i18n/useT';
import { useDataStore } from '../../store/useDataStore';
import ConfirmDialog from '../ui/ConfirmDialog';
import { ChatReviewRejectDialog, ChatDeleteMessageDialog } from './ChatConfirmDialogs';
import { ChatStarredPanel } from './ChatStarredPanel';
import { ChatReactionsModal } from './ChatReactionsModal';
import { ChatProfileModal } from './ChatProfileModal';
import { ChatMessageInfoModal } from './ChatMessageInfoModal';
import { ChatMediaLightbox, ChatUnstarConfirm } from './ChatSmallOverlays';
import { ChatActionMenu } from './ChatActionMenu';
import { ChatInfoPanel, ChatMembersPanel, ChatExportPanel, ChatClearChatPanel } from './ChatInfoOverlays';
import { ChatSidebar } from './ChatSidebar';
import { ChatComposer } from './ChatComposer';
import { ChatMessageList } from './ChatMessageList';
import { ChatHeader, ChatSearchBar } from './ChatHeaderBar';
import { useChatVoiceRecorder } from './useChatVoiceRecorder';
import {
  MAX_NONVOICE_ATTACH_BYTES,
  MAX_VOICE_SECONDS,
  CHAT_HISTORY_FETCH_LIMIT,
  CHAT_REACTIONS,
  allowedExts,
  extForMime,
  safeFilename,
  isDmThreadId,
  parseDmThreadId,
  dmThreadIdForUsers,
  extOf,
  formatBytes,
  isVoiceRecordingAttachment,
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

  const { recording, recordSeconds, waveform, startRecording, stopRecording, cancelRecording, resetRecording, formatRec } =
    useChatVoiceRecorder({
      clientChatClientId,
      user,
      sending,
      setSending,
      setErr,
      setReplyToId,
      replyToIdRef,
      scrollToBottomSoon,
      clearChatUnread,
      onFilesPicked: (f: File[]) => onFilesPicked(f),
      t
    });

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
    resetRecording();
    setSending(false);
    setEditingId(null);
    setEditingText('');
    setText('');
  }, [clientChatOpen, resetRecording]);

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
                        <ChatSidebar
                          clientChatDividerLeftWidth={clientChatDividerLeftWidth}
                          leftSearchQ={leftSearchQ}
                          setLeftSearchQ={setLeftSearchQ}
                          headerIconBtn={headerIconBtn}
                          leftCompact={leftCompact}
                          setLeftCompact={setLeftCompact}
                          setLeftGroupsCollapsed={setLeftGroupsCollapsed}
                          showLeftGroups={showLeftGroups}
                          filteredChatClients={filteredChatClients}
                          clientChatClientId={clientChatClientId}
                          chatUnreadByClientId={chatUnreadByClientId}
                          setMediaModal={setMediaModal}
                          setMessageInfoId={setMessageInfoId}
                          setReplyToId={setReplyToId}
                          openClientChat={openClientChat}
                          setLeftUsersCollapsed={setLeftUsersCollapsed}
                          showLeftUsers={showLeftUsers}
                          dmContactsLoading={dmContactsLoading}
                          filteredDmContacts={filteredDmContacts}
                          user={user}
                          onlineUserIds={onlineUserIds}
                          t={t}
                        />

                        <div
                          className="group relative shrink-0"
                          style={{ width: 8 }}
                          onPointerDown={(e) => beginDrag('divider', e)}
                          title={t({ it: 'Ridimensiona colonna', en: 'Resize column' })}
                        >
                          <div className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-slate-800 group-hover:bg-slate-700" />
                        </div>

                        <div className="flex min-w-0 flex-1 flex-col">
	                  <ChatHeader
	                    clientLogoUrl={clientLogoUrl}
	                    clientInitial={clientInitial}
	                    clientName={clientName}
	                    activeDmContact={activeDmContact}
	                    headerIconBtn={headerIconBtn}
	                    dmBlockedByMe={dmBlockedByMe}
	                    setActiveDmMeta={setActiveDmMeta}
	                    refreshDmContacts={refreshDmContacts}
	                    setConfirmDmBlock={setConfirmDmBlock}
	                    setHelpOpen={setHelpOpen}
	                    setMembersOpen={setMembersOpen}
	                    setExportOpen={setExportOpen}
	                    setSearchOpen={setSearchOpen}
	                    setStarredOpen={setStarredOpen}
	                    searchInputRef={searchInputRef}
	                    starredMessages={starredMessages}
	                    setClearChatOpen={setClearChatOpen}
	                    setClearChatTyped={setClearChatTyped}
	                    isSuperAdmin={isSuperAdmin}
	                    closeClientChat={closeClientChat}
	                    t={t}
	                  />

	                <ChatSearchBar
	                  searchOpen={searchOpen}
	                  searchInputRef={searchInputRef}
	                  searchQ={searchQ}
	                  setSearchQ={setSearchQ}
	                  searchHits={searchHits}
	                  searchHitIdx={searchHitIdx}
	                  setSearchHitIdx={setSearchHitIdx}
	                  setSearchOpen={setSearchOpen}
	                  headerIconBtn={headerIconBtn}
	                  t={t}
	                />

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
	                    <ChatMessageList
	                      messages={messages}
	                      user={user}
	                      clientChatClientId={clientChatClientId}
	                      messagesById={messagesById}
	                      searchOpen={searchOpen}
	                      searchHits={searchHits}
	                      searchHitIdx={searchHitIdx}
	                      editingId={editingId}
	                      editingText={editingText}
	                      setEditingText={setEditingText}
	                      editTextareaRef={editTextareaRef}
	                      setEditingId={setEditingId}
	                      commitEdit={commitEdit}
	                      openUserProfile={openUserProfile}
	                      openActionMenuFor={openActionMenuFor}
	                      reactPickerId={reactPickerId}
	                      setReactPickerId={setReactPickerId}
	                      reactPickerRef={reactPickerRef}
	                      toggleReaction={toggleReaction}
	                      setReactionsModal={setReactionsModal}
	                      scrollToMessage={scrollToMessage}
	                      setMediaModal={setMediaModal}
	                      reviewMeetingFromChat={reviewMeetingFromChat}
	                      t={t}
	                    />
                  </div>
                </div>

                <ChatComposer
                  fileInputRef={fileInputRef}
                  onFilesPicked={onFilesPicked}
                  replyToId={replyToId}
                  setReplyToId={setReplyToId}
                  messagesById={messagesById}
                  user={user}
                  pendingAttachments={pendingAttachments}
                  setPendingAttachments={setPendingAttachments}
                  pendingNonVoiceBytes={pendingNonVoiceBytes}
                  pendingVoiceCount={pendingVoiceCount}
                  recording={recording}
                  recordSeconds={recordSeconds}
                  waveform={waveform}
                  err={err}
                  pickFiles={pickFiles}
                  cancelRecording={cancelRecording}
                  startRecording={startRecording}
                  formatRec={formatRec}
                  stopRecording={stopRecording}
                  send={send}
                  sending={sending}
                  dmReadOnly={dmReadOnly}
                  dmBlockedByMe={dmBlockedByMe}
                  composeTextareaRef={composeTextareaRef}
                  text={text}
                  setText={setText}
                  t={t}
                />
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
