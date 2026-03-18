import { Dialog, Transition } from '@headlessui/react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Fragment } from 'react';
import jsPDF from 'jspdf';
import { BarChart3, CalendarPlus, ClipboardList, Download, History, Info, Languages, Loader2, NotebookText, Plus, Save, Settings2, Share2, SpellCheck, Trash2, Users, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import {
  cancelMeeting,
  deleteMeetingNote,
  exportMeetingNotesCsv,
  fetchMeetingNotes,
  MeetingBooking,
  MeetingCheckInMapByMeetingId,
  MeetingCheckInTimestampsByMeetingId,
  MeetingFollowUpChainEntry,
  MeetingManagerAction,
  MeetingManagerFields,
  MeetingNote,
  MeetingNoteParticipant,
  updateMeetingManagerFields,
  upsertMeetingNote
} from '../../api/meetings';
import { transformMeetingNoteWithAi } from '../../api/ai';
import { getMeetingSchedulePhase, getMeetingSchedulePhaseLabel } from '../../utils/meetingTime';
import LexicalNotesEditor, { type LexicalNotesEditorHandle } from '../ui/notes/LexicalNotesEditor';
import { useToastStore } from '../../store/useToast';

interface Props {
  open: boolean;
  meeting: MeetingBooking | null;
  initialTab?: 'manager' | 'actions' | 'history' | 'notes' | 'details';
  initialHistoryMeetingId?: string;
  highlightHistoryMeetingId?: string;
  suspendClose?: boolean;
  onClose: () => void;
  onOpenDetails?: (meeting: MeetingBooking) => void;
  onOpenFollowUpScheduler?: (meeting: MeetingBooking, options?: { preferredDay?: string; mode?: 'followup' }) => void;
}

const stripHtml = (value: string) =>
  String(value || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|h[1-6]|li|ul|ol|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const formatStamp = (ts: number) => {
  if (!Number.isFinite(Number(ts || 0)) || Number(ts) <= 0) return '—';
  return new Date(Number(ts)).toLocaleString();
};

const DAY_MS = 24 * 60 * 60 * 1000;

const parseIsoDay = (value: string) => {
  const normalized = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T00:00:00`);
  const ts = parsed.getTime();
  return Number.isFinite(ts) ? ts : null;
};

const toIsoDay = (ts: number) => {
  const date = new Date(Number(ts || 0));
  if (!Number.isFinite(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const formatIsoDayLabel = (value: string) => {
  const ts = parseIsoDay(value);
  if (!Number.isFinite(Number(ts))) return '—';
  return new Date(Number(ts)).toLocaleDateString();
};

const getDayOffsetFromToday = (ts: number) => {
  const target = new Date(Number(ts || 0));
  if (!Number.isFinite(target.getTime())) return null;
  const now = new Date();
  const todayStartTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const targetStartTs = new Date(target.getFullYear(), target.getMonth(), target.getDate(), 0, 0, 0, 0).getTime();
  return Math.round((targetStartTs - todayStartTs) / DAY_MS);
};

const buildCheckInKeyForParticipant = (participant: any) => {
  const tag = participant?.optional ? 'OPT' : 'INT';
  const label = String(participant?.fullName || participant?.externalId || '-')
    .trim()
    .toLowerCase();
  const email = String(participant?.email || '')
    .trim()
    .toLowerCase();
  return `${tag}::${label}::${email}`;
};

const normalizeActionProgress = (value: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const stepped = Math.round(numeric / 5) * 5;
  return Math.max(0, Math.min(100, stepped));
};

const NEW_NOTE_ID = '__new__';
const toCompanyKey = (value: string) => String(value || '').trim().toLowerCase();

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });

const fetchImageAsDataUrl = async (url: string) => {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return null;
  try {
    const response = await fetch(normalizedUrl, { credentials: 'include' });
    if (!response.ok) return null;
    return await blobToDataUrl(await response.blob());
  } catch {
    return null;
  }
};

const sanitizeFileName = (value: string, fallback: string) => {
  const base = String(value || '').trim() || String(fallback || '').trim() || 'Meeting-notes';
  const safe = base.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
  const withExt = safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
  return withExt || 'Meeting-notes.pdf';
};

const normalizePdfText = (value: string) =>
  (() => {
    const collapseSpacedLetters = (input: string) =>
      input.replace(/((?:\b[\p{L}\p{N}]\b(?:\s+|$)){3,})/gu, (match) => match.replace(/\s+/g, '').trim());
    let normalized = String(value || '')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/[\u00a0\u1680\u180e\u2000-\u200d\u2028\u2029\u202f\u205f\u3000]/g, ' ');
    normalized = collapseSpacedLetters(normalized);
    return normalized
      .replace(/\s+([,.;:!?)\]\}])/g, '$1')
      .replace(/([(\[\{])\s+/g, '$1')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s+/g, ' ')
      .trim();
  })();

const normalizePdfNoteText = (value: string) => {
  let normalized = normalizePdfText(stripHtml(value));
  for (let pass = 0; pass < 3; pass += 1) {
    normalized = normalized.replace(/((?:\b[\p{L}\p{N}]\b(?:\s+|$)){3,})/gu, (match) => match.replace(/\s+/g, '').trim());
  }
  return normalized || '—';
};

const wrapPdfTextToWidth = (doc: jsPDF, text: string, maxWidth: number): string[] => {
  const normalized = normalizePdfText(text);
  if (!normalized) return [''];
  const paragraphs = normalized
    .split(/\n+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const lines: string[] = [];
  const appendToken = (token: string, current: string) => {
    const candidate = current ? `${current} ${token}` : token;
    if (doc.getTextWidth(candidate) <= maxWidth) return { current: candidate, flushed: [] as string[] };
    if (doc.getTextWidth(token) <= maxWidth) {
      return current ? { current: token, flushed: [current] } : { current: token, flushed: [] as string[] };
    }
    const flushed: string[] = [];
    if (current) flushed.push(current);
    let chunk = '';
    for (const ch of [...token]) {
      const probe = `${chunk}${ch}`;
      if (!chunk || doc.getTextWidth(probe) <= maxWidth) {
        chunk = probe;
      } else {
        flushed.push(chunk);
        chunk = ch;
      }
    }
    return { current: chunk, flushed };
  };
  paragraphs.forEach((paragraph, idx) => {
    const tokens = paragraph.split(/\s+/).filter(Boolean);
    let current = '';
    for (const token of tokens) {
      const { current: nextCurrent, flushed } = appendToken(token, current);
      if (flushed.length) lines.push(...flushed);
      current = nextCurrent;
    }
    if (current) lines.push(current);
    if (idx < paragraphs.length - 1) lines.push('');
  });
  return lines.length ? lines : [''];
};

const TRANSLATE_LANGUAGE_OPTIONS: Array<{
  code: string;
  flag: string;
  label: string;
  native: string;
  aiLabel: string;
}> = [
  { code: 'en', flag: '🇬🇧', label: 'English', native: 'English', aiLabel: 'English' },
  { code: 'zh', flag: '🇨🇳', label: 'Chinese', native: '中文', aiLabel: 'Chinese (Mandarin)' },
  { code: 'hi', flag: '🇮🇳', label: 'Hindi', native: 'हिन्दी', aiLabel: 'Hindi' },
  { code: 'es', flag: '🇪🇸', label: 'Spanish', native: 'Español', aiLabel: 'Spanish' },
  { code: 'fr', flag: '🇫🇷', label: 'French', native: 'Français', aiLabel: 'French' },
  { code: 'ar', flag: '🇸🇦', label: 'Arabic', native: 'العربية', aiLabel: 'Arabic' },
  { code: 'pt', flag: '🇵🇹', label: 'Portuguese', native: 'Português', aiLabel: 'Portuguese' },
  { code: 'ru', flag: '🇷🇺', label: 'Russian', native: 'Русский', aiLabel: 'Russian' },
  { code: 'de', flag: '🇩🇪', label: 'German', native: 'Deutsch', aiLabel: 'German' },
  { code: 'ko', flag: '🇰🇷', label: 'Korean', native: '한국어', aiLabel: 'Korean' },
  { code: 'sv', flag: '🇸🇪', label: 'Swedish', native: 'Svenska', aiLabel: 'Swedish' },
  { code: 'it', flag: '🇮🇹', label: 'Italian', native: 'Italiano', aiLabel: 'Italian' }
];

const emptyManagerFields = (meetingId = ''): MeetingManagerFields => ({
  meetingId,
  topicsText: '',
  summaryText: '',
  actions: [],
  nextMeetingDate: '',
  updatedAt: 0,
  updatedById: '',
  updatedByUsername: ''
});

const MeetingNotesModal = ({
  open,
  meeting,
  initialTab,
  initialHistoryMeetingId,
  highlightHistoryMeetingId,
  suspendClose = false,
  onClose,
  onOpenDetails,
  onOpenFollowUpScheduler
}: Props) => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const myUserId = String(useAuthStore((s) => s.user?.id || ''));
  const clients = useDataStore((s) => s.clients);
  const editorRef = useRef<LexicalNotesEditorHandle | null>(null);
  const dialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const dialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const aiDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const aiDialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const translateDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const translateDialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const aiBusyDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const ignoreOuterCloseUntilRef = useRef(0);
  const timelineScheduleMenuRef = useRef<HTMLDivElement | null>(null);
  const noteTitleInputRef = useRef<HTMLInputElement | null>(null);
  const noteEditorContainerRef = useRef<HTMLDivElement | null>(null);
  const noteSaveButtonRef = useRef<HTMLButtonElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [participants, setParticipants] = useState<MeetingNoteParticipant[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [editorKey, setEditorKey] = useState(0);
  const [title, setTitle] = useState('');
  const [shared, setShared] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [aiBusy, setAiBusy] = useState<null | 'translate' | 'correct'>(null);
  const [aiError, setAiError] = useState('');
  const [aiPreview, setAiPreview] = useState<null | { mode: 'translate' | 'correct'; transformedText: string; targetLanguage?: string | null }>(null);
  const [aiDraftText, setAiDraftText] = useState('');
  const [confirmState, setConfirmState] = useState<null | { kind: 'close' | 'switch' | 'delete'; nextId?: string }>(null);
  const [translateLanguageModalOpen, setTranslateLanguageModalOpen] = useState(false);
  const [translateLanguageCode, setTranslateLanguageCode] = useState('en');
  const [noteContextMenu, setNoteContextMenu] = useState<null | { noteId: string; x: number; y: number }>(null);
  const [timelineScheduleContextMenu, setTimelineScheduleContextMenu] = useState<null | { meetingId: string; x: number; y: number }>(null);
  const [pdfSelectionModalOpen, setPdfSelectionModalOpen] = useState(false);
  const [pdfReviewModalOpen, setPdfReviewModalOpen] = useState(false);
  const [pdfSelection, setPdfSelection] = useState<Record<string, boolean>>({});
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [canManageMeeting, setCanManageMeeting] = useState(false);
  const [managerFields, setManagerFields] = useState<MeetingManagerFields>(emptyManagerFields());
  const [managerFieldsSnapshot, setManagerFieldsSnapshot] = useState<MeetingManagerFields>(emptyManagerFields());
  const [managerSaving, setManagerSaving] = useState(false);
  const [managerScheduling, setManagerScheduling] = useState(false);
  const [activeTab, setActiveTab] = useState<'manager' | 'actions' | 'history' | 'notes' | 'details'>('manager');
  const [followUpChain, setFollowUpChain] = useState<MeetingFollowUpChainEntry[]>([]);
  const [followUpCheckInStatusByMeetingId, setFollowUpCheckInStatusByMeetingId] = useState<MeetingCheckInMapByMeetingId>({});
  const [followUpCheckInTimestampsByMeetingId, setFollowUpCheckInTimestampsByMeetingId] = useState<MeetingCheckInTimestampsByMeetingId>({});
  const [historySelectedMeetingId, setHistorySelectedMeetingId] = useState('');
  const [timelineBlinkMeetingId, setTimelineBlinkMeetingId] = useState('');
  const [timelineActivityModalOpen, setTimelineActivityModalOpen] = useState(false);
  const [actionsInsightsModalOpen, setActionsInsightsModalOpen] = useState(false);
  const [manageActionModalIndex, setManageActionModalIndex] = useState(-1);
  const [manageActionDueDateDraft, setManageActionDueDateDraft] = useState('');
  const pdfDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const pdfDialogCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const pdfReviewDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const timelineActivityDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const actionManageDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const actionInsightsDialogInitialFocusRef = useRef<HTMLButtonElement | null>(null);
  const manageActionDueDateInputRef = useRef<HTMLInputElement | null>(null);

  const selectedClient = useMemo(() => {
    if (!meeting?.clientId) return null;
    return (clients || []).find((entry) => String(entry.id) === String(meeting.clientId)) || null;
  }, [clients, meeting?.clientId]);

  const selectedSite = useMemo(() => {
    if (!selectedClient || !meeting?.siteId) return null;
    return (selectedClient.sites || []).find((entry) => String(entry.id) === String(meeting.siteId)) || null;
  }, [selectedClient, meeting?.siteId]);

  const selectedFloorPlan = useMemo(() => {
    if (!selectedSite || !meeting?.floorPlanId) return null;
    return (selectedSite.floorPlans || []).find((entry) => String(entry.id) === String(meeting.floorPlanId)) || null;
  }, [selectedSite, meeting?.floorPlanId]);

  const selectedHistoryEntry = useMemo(
    () => followUpChain.find((entry) => String(entry.meeting.id || '') === String(historySelectedMeetingId || '')) || null,
    [followUpChain, historySelectedMeetingId]
  );
  const timelineScheduleContextEntry = useMemo(
    () =>
      timelineScheduleContextMenu
        ? followUpChain.find((entry) => String(entry.meeting.id || '') === String(timelineScheduleContextMenu.meetingId || '')) || null
        : null,
    [followUpChain, timelineScheduleContextMenu]
  );
  const selectedHistoryParticipants = useMemo(() => {
    if (!selectedHistoryEntry) return [];
    const meetingId = String(selectedHistoryEntry.meeting.id || '');
    const checkInMap = followUpCheckInStatusByMeetingId[meetingId] || {};
    const checkInTsMap = followUpCheckInTimestampsByMeetingId[meetingId] || {};
    const items: Array<{ key: string; label: string; checkedIn: boolean; checkInAt: number | null }> = [];
    for (const participant of Array.isArray(selectedHistoryEntry.meeting.participants) ? selectedHistoryEntry.meeting.participants : []) {
      const isManual = String((participant as any)?.kind || 'real_user') === 'manual';
      const label = String((participant as any)?.fullName || (participant as any)?.externalId || '').trim();
      if (!label) continue;
      const checkInKey = buildCheckInKeyForParticipant(participant);
      const checkedIn = !isManual && !!checkInMap[checkInKey];
      const checkInAt = checkedIn ? Number(checkInTsMap[checkInKey] || 0) || null : null;
      items.push({
        key: `participant-${checkInKey}`,
        label,
        checkedIn,
        checkInAt
      });
    }
    for (const guest of Array.isArray((selectedHistoryEntry.meeting as any)?.externalGuestsDetails) ? (selectedHistoryEntry.meeting as any).externalGuestsDetails : []) {
      const label = String(guest?.name || '').trim();
      if (!label) continue;
      items.push({
        key: `guest-${label.toLowerCase()}-${String(guest?.email || '').trim().toLowerCase()}`,
        label,
        checkedIn: false,
        checkInAt: null
      });
    }
    return items;
  }, [followUpCheckInStatusByMeetingId, followUpCheckInTimestampsByMeetingId, selectedHistoryEntry]);

  const businessPartnerByCompany = useMemo(() => {
    const map = new Map<string, { name: string; logoUrl?: string }>();
    const partners = Array.isArray((selectedClient as any)?.businessPartners) ? ((selectedClient as any).businessPartners as any[]) : [];
    for (const partner of partners) {
      const name = String(partner?.name || '').trim();
      if (!name) continue;
      map.set(toCompanyKey(name), { name, logoUrl: String(partner?.logoUrl || '').trim() || undefined });
    }
    return map;
  }, [selectedClient]);

  const invitedParticipants = useMemo(() => {
    const participantDepartmentByEmail = new Map(
      (participants || [])
        .filter((row) => String(row.email || '').trim() && String(row.department || '').trim())
        .map((row) => [String(row.email || '').trim().toLowerCase(), String(row.department || '').trim()])
    );
    const participantDepartmentByName = new Map(
      (participants || [])
        .filter((row) => String(row.label || '').trim() && String(row.department || '').trim())
        .map((row) => [String(row.label || '').trim().toLowerCase(), String(row.department || '').trim()])
    );
    const list: Array<{
      key: string;
      name: string;
      email?: string | null;
      department?: string | null;
      company?: string | null;
      kind: 'internal' | 'external';
      remote: boolean;
      logoUrl?: string | null;
    }> = [];
    const seen = new Set<string>();
    const clientLogo = String((selectedClient as any)?.logoUrl || '').trim() || null;

    for (const participant of Array.isArray(meeting?.participants) ? meeting!.participants : []) {
      const isManual = String((participant as any)?.kind || 'real_user') === 'manual';
      const name = String((participant as any)?.fullName || '').trim();
      if (!name) continue;
      const email = String((participant as any)?.email || '').trim() || null;
      const company = String((participant as any)?.company || '').trim() || null;
      const department =
        String((participant as any)?.department || '').trim() ||
        String(participantDepartmentByEmail.get(String(email || '').toLowerCase()) || '').trim() ||
        String(participantDepartmentByName.get(String(name || '').toLowerCase()) || '').trim() ||
        null;
      const remote = !!(participant as any)?.remote;
      const key = `${String(isManual ? 'external' : 'internal')}|${name.toLowerCase()}|${String(email || '').toLowerCase()}|${toCompanyKey(company || '')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const partnerLogo = company ? businessPartnerByCompany.get(toCompanyKey(company || ''))?.logoUrl || null : null;
      list.push({
        key,
        name,
        email,
        department,
        company,
        kind: isManual ? 'external' : 'internal',
        remote,
        logoUrl: isManual ? partnerLogo : clientLogo
      });
    }

    for (const guest of Array.isArray((meeting as any)?.externalGuestsDetails) ? ((meeting as any).externalGuestsDetails as any[]) : []) {
      const name = String(guest?.name || '').trim();
      if (!name) continue;
      const email = String(guest?.email || '').trim() || null;
      const company = String(guest?.company || '').trim() || null;
      const remote = !!guest?.remote;
      const key = `external|${name.toLowerCase()}|${String(email || '').toLowerCase()}|${toCompanyKey(company || '')}|guest-details`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        key,
        name,
        email,
        department: null,
        company,
        kind: 'external',
        remote,
        logoUrl: company ? businessPartnerByCompany.get(toCompanyKey(company || ''))?.logoUrl || null : null
      });
    }
    return list;
  }, [businessPartnerByCompany, meeting, participants, selectedClient]);

  const selectedNote = useMemo(() => {
    if (selectedId === NEW_NOTE_ID) return null;
    return notes.find((n) => String(n.id) === String(selectedId)) || null;
  }, [notes, selectedId]);

  const canEditSelected = useMemo(() => {
    if (selectedId === NEW_NOTE_ID) return true;
    if (!selectedNote) return false;
    return String(selectedNote.authorUserId || '') === myUserId;
  }, [selectedId, selectedNote, myUserId]);

  const canEditNote = useCallback(
    (note: MeetingNote | null | undefined) => {
      if (!note) return false;
      return String(note.authorUserId || '') === myUserId;
    },
    [myUserId]
  );

  const managerDirty = useMemo(() => {
    if (!canManageMeeting) return false;
    return (
      String(managerFields.topicsText || '') !== String(managerFieldsSnapshot.topicsText || '') ||
      String(managerFields.summaryText || '') !== String(managerFieldsSnapshot.summaryText || '') ||
      String(managerFields.nextMeetingDate || '') !== String(managerFieldsSnapshot.nextMeetingDate || '') ||
      JSON.stringify(managerFields.actions || []) !== JSON.stringify(managerFieldsSnapshot.actions || [])
    );
  }, [canManageMeeting, managerFields, managerFieldsSnapshot]);

  const normalizedManagerActions = useMemo(
    () =>
      (Array.isArray(managerFields.actions) ? managerFields.actions : []).map((row) => ({
        action: String(row.action || ''),
        assignedTo: String(row.assignedTo || ''),
        openingDate: String(row.openingDate || '').trim(),
        completionDate: String(row.completionDate || ''),
        progressPct: normalizeActionProgress(Number(row.progressPct ?? (String(row.status || '') === 'done' ? 100 : 0))),
        status:
          String(row.status || '') === 'not_needed'
            ? 'not_needed'
            : normalizeActionProgress(Number(row.progressPct ?? (String(row.status || '') === 'done' ? 100 : 0))) >= 100
              ? 'done'
              : 'open'
      })),
    [managerFields.actions]
  );

  const managedAction = useMemo(
    () => (manageActionModalIndex >= 0 ? normalizedManagerActions[manageActionModalIndex] || null : null),
    [manageActionModalIndex, normalizedManagerActions]
  );
  const managedActionProgress = useMemo(() => normalizeActionProgress(Number(managedAction?.progressPct || 0)), [managedAction]);
  const managedActionIsNotNeeded = String(managedAction?.status || '') === 'not_needed';

  const sanitizeManagerActionsForPersist = useCallback(
    (actions: MeetingManagerAction[]) =>
      (Array.isArray(actions) ? actions : [])
        .map((row) => {
          const action = String(row.action || '').trim();
          const assignedTo = String(row.assignedTo || '').trim();
          const openingDate = String(row.openingDate || '').trim();
          const completionDate = String(row.completionDate || '').trim();
          const progressPct = normalizeActionProgress(Number(row.progressPct || 0));
          const status = String(row.status || '').trim().toLowerCase() === 'not_needed' ? 'not_needed' : progressPct >= 100 ? 'done' : 'open';
          return {
            action,
            assignedTo,
            openingDate,
            completionDate,
            progressPct,
            status
          } as MeetingManagerAction;
        })
        .filter((row) => row.action || row.assignedTo || row.openingDate || row.completionDate || Number(row.progressPct || 0) > 0 || row.status === 'not_needed'),
    []
  );

  const findManagerActionMissingTitleIndex = useCallback((actions: MeetingManagerAction[]) => {
    const rows = Array.isArray(actions) ? actions : [];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const action = String(row.action || '').trim();
      const assignedTo = String(row.assignedTo || '').trim();
      const openingDate = String(row.openingDate || '').trim();
      const completionDate = String(row.completionDate || '').trim();
      const progressPct = normalizeActionProgress(Number(row.progressPct || 0));
      const status = String(row.status || '').trim().toLowerCase();
      const hasPayload = !!(action || assignedTo || openingDate || completionDate || progressPct > 0 || status === 'not_needed' || status === 'done');
      if (hasPayload && !action) return index;
    }
    return -1;
  }, []);

  const actionInsights = useMemo(() => {
    const rows = normalizedManagerActions.filter((row) => row.action || row.assignedTo || row.openingDate || row.completionDate || Number(row.progressPct || 0) > 0);
    const total = rows.length;
    const done = rows.filter((row) => row.status === 'done' || Number(row.progressPct || 0) >= 100).length;
    const notNeeded = rows.filter((row) => row.status === 'not_needed').length;
    const inProgress = Math.max(0, total - done - notNeeded);
    const todayIso = toIsoDay(Date.now());
    const overdue = rows.filter((row) => row.completionDate && row.completionDate < todayIso && row.status !== 'done' && row.status !== 'not_needed').length;
    const closedDurations = rows
      .filter((row) => row.status === 'done')
      .map((row) => {
        const fromTs = parseIsoDay(row.openingDate || row.completionDate);
        const toTs = parseIsoDay(row.completionDate || row.openingDate);
        if (!Number.isFinite(Number(fromTs)) || !Number.isFinite(Number(toTs))) return null;
        const delta = Math.max(0, Number(toTs) - Number(fromTs));
        return Math.max(1, Math.round(delta / DAY_MS) + 1);
      })
      .filter((value): value is number => Number.isFinite(Number(value)));
    const avgResolutionDays = closedDurations.length
      ? Number((closedDurations.reduce((sum, value) => sum + value, 0) / closedDurations.length).toFixed(1))
      : 0;
    const completionRate = total ? Math.round((done / total) * 100) : 0;
    const taskProgressBars = rows.map((row, index) => {
      const progressPct = normalizeActionProgress(Number(row.progressPct || 0));
      const tone =
        row.status === 'not_needed'
          ? 'bg-slate-400'
          : progressPct >= 100
            ? 'bg-emerald-500'
            : 'bg-amber-500';
      const openingLabel = formatIsoDayLabel(String(row.openingDate || ''));
      const completionLabel = formatIsoDayLabel(String(row.completionDate || ''));
      const completionTs = parseIsoDay(String(row.completionDate || ''));
      const daysLeft = Number.isFinite(Number(completionTs)) ? Math.ceil((Number(completionTs) - Date.now()) / DAY_MS) : null;
      const daysLeftLabel =
        daysLeft === null
          ? t({ it: 'n/d', en: 'n/a' })
          : daysLeft >= 0
            ? t({ it: `${daysLeft} giorni`, en: `${daysLeft} days left` })
            : t({ it: `${Math.abs(daysLeft)} giorni in ritardo`, en: `${Math.abs(daysLeft)} days overdue` });
      return {
        id: `task-progress-${index}`,
        row,
        index,
        progressPct,
        tone,
        openingLabel,
        completionLabel,
        daysLeftLabel
      };
    });
    return {
      rows,
      total,
      done,
      inProgress,
      notNeeded,
      overdue,
      avgResolutionDays,
      completionRate,
      taskProgressBars
    };
  }, [normalizedManagerActions]);

  const timelineChain = useMemo(
    () =>
      [...followUpChain]
        .sort((a, b) => Number(a.meeting.startAt || 0) - Number(b.meeting.startAt || 0))
        .map((entry, index) => {
          const now = Date.now();
          const startAt = Number(entry.meeting.effectiveStartAt || entry.meeting.startAt || 0);
          const endAt = Number(entry.meeting.effectiveEndAt || entry.meeting.endAt || 0);
          const phase = getMeetingSchedulePhase(startAt, endAt, now);
          return {
            entry,
            index,
            phase,
            phaseLabel: getMeetingSchedulePhaseLabel(phase, t)
          };
        }),
    [followUpChain, t]
  );

  const timelineTaskEvents = useMemo(() => {
    const events: Array<{
      id: string;
      ts: number;
      taskLabel: string;
      meetingLabel: string;
      actionLabel: string;
      tone: string;
    }> = [];
    let previousByKey = new Map<string, MeetingManagerAction>();
    for (const row of timelineChain) {
      const meeting = row.entry.meeting;
      const meetingTs = Number(meeting.startAt || 0) || Date.now();
      const meetingLabel = `${new Date(meetingTs).toLocaleDateString()} • ${meeting.roomName || '-'}`;
      const currentActions = sanitizeManagerActionsForPersist(Array.isArray(row.entry.managerFields.actions) ? row.entry.managerFields.actions : []);
      const currentByKey = new Map<string, MeetingManagerAction>();
      currentActions.forEach((actionRow, actionIndex) => {
        const keyBase = `${String(actionRow.action || '').trim().toLowerCase()}|${String(actionRow.assignedTo || '').trim().toLowerCase()}`;
        const key = keyBase || `${String(meeting.id || '')}::${actionIndex}`;
        currentByKey.set(key, actionRow);
        const prev = previousByKey.get(key);
        const taskLabel = String(actionRow.action || '').trim() || `${t({ it: 'Task', en: 'Task' })} ${actionIndex + 1}`;
        const actionTs = meetingTs + actionIndex;
        if (!prev) {
          events.push({
            id: `${key}-created-${actionTs}`,
            ts: actionTs,
            taskLabel,
            meetingLabel,
            actionLabel: t({ it: 'Task creata', en: 'Task created' }),
            tone: 'border-sky-200 bg-sky-50 text-sky-800'
          });
          return;
        }
        const prevDueTs = parseIsoDay(String(prev.completionDate || ''));
        const nextDueTs = parseIsoDay(String(actionRow.completionDate || ''));
        if (String(prev.completionDate || '') !== String(actionRow.completionDate || '')) {
          const label =
            Number.isFinite(Number(prevDueTs)) && Number.isFinite(Number(nextDueTs))
              ? Number(nextDueTs) > Number(prevDueTs)
                ? t({ it: 'Scadenza prolungata', en: 'Deadline extended' })
                : t({ it: 'Scadenza anticipata', en: 'Deadline moved earlier' })
              : t({ it: 'Scadenza aggiornata', en: 'Deadline updated' });
          events.push({
            id: `${key}-due-${actionTs}`,
            ts: actionTs + 100,
            taskLabel,
            meetingLabel,
            actionLabel: label,
            tone: 'border-violet-200 bg-violet-50 text-violet-800'
          });
        }
        const prevProgress = normalizeActionProgress(Number(prev.progressPct || 0));
        const nextProgress = normalizeActionProgress(Number(actionRow.progressPct || 0));
        if (prevProgress !== nextProgress) {
          events.push({
            id: `${key}-progress-${actionTs}`,
            ts: actionTs + 200,
            taskLabel,
            meetingLabel,
            actionLabel: t({ it: `Avanzamento ${nextProgress}%`, en: `Progress ${nextProgress}%` }),
            tone: 'border-amber-200 bg-amber-50 text-amber-800'
          });
        }
        if (String(prev.status || 'open') !== String(actionRow.status || 'open')) {
          const statusLabel =
            String(actionRow.status || '') === 'done'
              ? t({ it: 'Task chiusa', en: 'Task closed' })
              : String(actionRow.status || '') === 'not_needed'
                ? t({ it: 'Task non necessaria', en: 'Task marked not needed' })
                : t({ it: 'Task riaperta', en: 'Task reopened' });
          events.push({
            id: `${key}-status-${actionTs}`,
            ts: actionTs + 300,
            taskLabel,
            meetingLabel,
            actionLabel: statusLabel,
            tone: 'border-emerald-200 bg-emerald-50 text-emerald-800'
          });
        }
      });
      for (const [key, oldAction] of previousByKey.entries()) {
        if (currentByKey.has(key)) continue;
        events.push({
          id: `${key}-removed-${meetingTs}`,
          ts: meetingTs - 1,
          taskLabel: String(oldAction.action || '').trim() || t({ it: 'Task', en: 'Task' }),
          meetingLabel,
          actionLabel: t({ it: 'Task eliminata', en: 'Task deleted' }),
          tone: 'border-rose-200 bg-rose-50 text-rose-800'
        });
      }
      previousByKey = currentByKey;
    }
    return events.sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0));
  }, [sanitizeManagerActionsForPersist, t, timelineChain]);

  const load = async (opts?: { keepSelectedId?: string }) => {
    if (!meeting?.id) return;
    setLoading(true);
    setError('');
    try {
      const payload = await fetchMeetingNotes(String(meeting.id));
      setNotes(Array.isArray(payload.notes) ? payload.notes : []);
      setParticipants(Array.isArray(payload.participants) ? payload.participants : []);
      setFollowUpChain(Array.isArray(payload.followUpChain) ? payload.followUpChain : []);
      setFollowUpCheckInStatusByMeetingId(payload.checkInStatusByMeetingId || {});
      setFollowUpCheckInTimestampsByMeetingId(payload.checkInTimestampsByMeetingId || {});
      const nextManagerFields = payload.managerFields ? { ...emptyManagerFields(String(meeting.id)), ...payload.managerFields } : emptyManagerFields(String(meeting.id));
      setCanManageMeeting(!!payload.canManageMeeting);
      setManagerFields(nextManagerFields);
      setManagerFieldsSnapshot(nextManagerFields);
      const keep = String(opts?.keepSelectedId || '').trim();
      if (keep && payload.notes.some((n) => String(n.id) === keep)) {
        setSelectedId(keep);
      } else if (keep === NEW_NOTE_ID) {
        setSelectedId(NEW_NOTE_ID);
      } else if (payload.notes.length) {
        setSelectedId(String(payload.notes[0]?.id || ''));
      } else {
        setSelectedId(NEW_NOTE_ID);
      }
    } catch (e: any) {
      setError(String(e?.message || 'Unable to load notes'));
      setNotes([]);
      setParticipants([]);
      setFollowUpChain([]);
      setFollowUpCheckInStatusByMeetingId({});
      setFollowUpCheckInTimestampsByMeetingId({});
      setCanManageMeeting(false);
      const empty = emptyManagerFields(String(meeting.id));
      setManagerFields(empty);
      setManagerFieldsSnapshot(empty);
      setSelectedId(NEW_NOTE_ID);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !meeting?.id) return;
    setDirty(false);
    setActiveTab(initialTab || 'manager');
    setHistorySelectedMeetingId(String(initialHistoryMeetingId || ''));
    setTimelineBlinkMeetingId(String(highlightHistoryMeetingId || ''));
    setTimelineActivityModalOpen(false);
    setActionsInsightsModalOpen(false);
    setManageActionModalIndex(-1);
    setManageActionDueDateDraft('');
    setTimelineScheduleContextMenu(null);
    setPdfSelectionModalOpen(false);
    setPdfReviewModalOpen(false);
    setEditorKey((k) => k + 1);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meeting?.id, initialHistoryMeetingId, highlightHistoryMeetingId, initialTab]);

  useEffect(() => {
    if (!open) return;
    const meetingId = String(highlightHistoryMeetingId || '').trim();
    if (!meetingId) {
      setTimelineBlinkMeetingId('');
      return;
    }
    setTimelineBlinkMeetingId(meetingId);
    const timer = window.setTimeout(() => {
      setTimelineBlinkMeetingId((prev) => (prev === meetingId ? '' : prev));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [highlightHistoryMeetingId, meeting?.id, open]);

  useEffect(() => {
    if (manageActionModalIndex < 0) return;
    if (manageActionModalIndex >= normalizedManagerActions.length) {
      setManageActionModalIndex(-1);
      setManageActionDueDateDraft('');
      return;
    }
    const current = normalizedManagerActions[manageActionModalIndex];
    if (!current) return;
    setManageActionDueDateDraft((prev) => prev || String(current.completionDate || toIsoDay(Date.now() + 7 * DAY_MS)));
  }, [manageActionModalIndex, normalizedManagerActions]);

  useEffect(() => {
    if (!followUpChain.length) {
      setHistorySelectedMeetingId('');
      return;
    }
    const currentEntry =
      followUpChain.find((entry) => entry.isCurrent) ||
      followUpChain[followUpChain.length - 1] ||
      followUpChain[0] ||
      null;
    if (!currentEntry) return;
    setHistorySelectedMeetingId((prev) => {
      if (prev && followUpChain.some((entry) => String(entry.meeting.id || '') === String(prev))) return prev;
      return String(currentEntry.meeting.id || '');
    });
  }, [followUpChain]);

  useEffect(() => {
    if (!open) return;
    if (selectedId === NEW_NOTE_ID) {
      setTitle('');
      setShared(false);
      setDirty(false);
      setEditorKey((k) => k + 1);
      return;
    }
    if (!selectedNote) return;
    setTitle(String(selectedNote.title || ''));
    setShared(!!selectedNote.shared);
    setDirty(false);
    setEditorKey((k) => k + 1);
  }, [selectedId, selectedNote, open]);

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      if (!canEditSelected) return;
      if (activeTab === 'notes' && selectedId === NEW_NOTE_ID) {
        noteTitleInputRef.current?.focus();
        return;
      }
      if (activeTab === 'notes') {
        editorRef.current?.focus();
      }
    }, 90);
    return () => window.clearTimeout(focusTimer);
  }, [open, selectedId, canEditSelected, editorKey, activeTab]);

  useEffect(() => {
    if (!noteContextMenu) return;
    const close = () => setNoteContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
    };
  }, [noteContextMenu]);

  useEffect(() => {
    if (!timelineScheduleContextMenu) return;
    const close = () => setTimelineScheduleContextMenu(null);
    const onMouseDown = (event: Event) => {
      const target = event.target as Node | null;
      if (target && timelineScheduleMenuRef.current?.contains(target)) return;
      close();
    };
    const onContextMenu = (event: Event) => {
      const target = event.target as Node | null;
      if (target && timelineScheduleMenuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
    };
  }, [timelineScheduleContextMenu]);

  const requestClose = () => {
    if (suspendClose) return;
    if (
      aiPreview ||
      translateLanguageModalOpen ||
      pdfSelectionModalOpen ||
      pdfReviewModalOpen ||
      actionsInsightsModalOpen ||
      timelineActivityModalOpen ||
      manageActionModalIndex >= 0 ||
      !!confirmState
    ) {
      return;
    }
    if (Date.now() < ignoreOuterCloseUntilRef.current) return;
    if (dirty) {
      setConfirmState({ kind: 'close' });
      return;
    }
    onClose();
  };

  const onSelect = (id: string) => {
    if (String(id) === String(selectedId)) return;
    if (dirty) {
      setConfirmState({ kind: 'switch', nextId: id });
      return;
    }
    setSelectedId(id);
  };

  const requestNewNote = useCallback(() => {
    setActiveTab('notes');
    if (dirty) {
      setConfirmState({ kind: 'switch', nextId: NEW_NOTE_ID });
      return;
    }
    if (String(selectedId) === NEW_NOTE_ID) {
      noteTitleInputRef.current?.focus();
      return;
    }
    setSelectedId(NEW_NOTE_ID);
  }, [dirty, selectedId]);

  const save = async () => {
    if (!meeting?.id || !canEditSelected) return false;
    const normalizedTitle = String(title || '').trim();
    if (!normalizedTitle) {
      const message = t({ it: 'Il titolo della nota è obbligatorio.', en: 'Note title is required.' });
      setError(message);
      push(message, 'danger');
      return false;
    }
    const notesHtml = editorRef.current?.getHtml() || selectedNote?.contentHtml || '';
    const notesLexical = editorRef.current?.getStateJson() || selectedNote?.contentLexical || '';
    const contentText = stripHtml(notesHtml);
    if (!String(contentText || '').trim()) {
      const message = t({ it: 'Il corpo della nota è obbligatorio.', en: 'Note body is required.' });
      setError(message);
      push(message, 'danger');
      return false;
    }
    setSaving(true);
    try {
      const payload = await upsertMeetingNote(String(meeting.id), {
        ...(selectedNote ? { id: selectedNote.id } : {}),
        title: normalizedTitle,
        contentText,
        contentHtml: notesHtml,
        contentLexical: notesLexical,
        shared
      });
      setDirty(false);
      await load({ keepSelectedId: String(payload.note?.id || NEW_NOTE_ID) });
      push(t({ it: 'Appunto salvato', en: 'Note saved' }), 'success');
      return true;
    } catch (e: any) {
      setError(String(e?.message || 'Unable to save note'));
      push(String(e?.message || 'Unable to save note'), 'danger');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const getSelectedNoteText = () => {
    return String(editorRef.current?.getSelectedText() || '').trim();
  };

  const runAiTransform = async (mode: 'translate' | 'correct', explicitTargetLanguage?: string) => {
    if (!meeting?.id) return;
    const sourceText = getSelectedNoteText();
    if (!sourceText) {
      push(
        t({
          it: 'Seleziona prima una parte di testo da tradurre o correggere.',
          en: 'Select a portion of text first to translate or correct.'
        }),
        'info'
      );
      return;
    }
    let targetLanguage = '';
    if (mode === 'translate') {
      targetLanguage = String(explicitTargetLanguage || '').trim();
      if (!targetLanguage) return;
    }
    setAiError('');
    setAiBusy(mode);
    try {
      const result = await transformMeetingNoteWithAi(String(meeting.id), {
        mode,
        text: sourceText,
        ...(mode === 'translate' ? { targetLanguage } : {})
      });
      setAiPreview({
        mode: result.mode,
        transformedText: String(result.transformedText || '').trim(),
        targetLanguage: result.targetLanguage || (mode === 'translate' ? targetLanguage : null)
      });
      setAiDraftText(String(result.transformedText || '').trim());
    } catch (e: any) {
      const message = String(e?.message || t({ it: 'Operazione AI fallita.', en: 'AI operation failed.' }));
      setAiError(message);
      push(message, 'danger');
    } finally {
      setAiBusy(null);
    }
  };

  const closeAiPreview = () => {
    ignoreOuterCloseUntilRef.current = Date.now() + 450;
    setAiPreview(null);
    setAiDraftText('');
  };

  const closeTranslateLanguageModal = () => {
    ignoreOuterCloseUntilRef.current = Date.now() + 300;
    setTranslateLanguageModalOpen(false);
  };

  const openTranslateLanguageModal = () => {
    if (!getSelectedNoteText()) {
      push(
        t({
          it: 'Seleziona prima una parte di testo da tradurre.',
          en: 'Select a portion of text first to translate.'
        }),
        'info'
      );
      return;
    }
    setTranslateLanguageModalOpen(true);
  };

  const confirmTranslateLanguage = async () => {
    const selected = TRANSLATE_LANGUAGE_OPTIONS.find((entry) => entry.code === translateLanguageCode) || TRANSLATE_LANGUAGE_OPTIONS[0];
    closeTranslateLanguageModal();
    await runAiTransform('translate', selected.aiLabel);
  };

  useEffect(() => {
    if (!open || activeTab !== 'notes') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const useMeta = event.metaKey || event.ctrlKey;
      if (!useMeta) return;
      if (
        aiPreview ||
        translateLanguageModalOpen ||
        pdfSelectionModalOpen ||
        pdfReviewModalOpen ||
        actionsInsightsModalOpen ||
        timelineActivityModalOpen ||
        manageActionModalIndex >= 0 ||
        !!confirmState
      ) {
        return;
      }
      const key = String(event.key || '').toLowerCase();
      if (event.shiftKey && key === 'c') {
        event.preventDefault();
        event.stopPropagation();
        if (!canEditSelected || !!aiBusy) return;
        void runAiTransform('correct');
        return;
      }
      if (event.shiftKey && key === 't') {
        event.preventDefault();
        event.stopPropagation();
        if (!canEditSelected || !!aiBusy) return;
        openTranslateLanguageModal();
        return;
      }
      if (key === 's') {
        event.preventDefault();
        event.stopPropagation();
        if (!canEditSelected) return;
        void save();
        return;
      }
      if (key === 'n') {
        event.preventDefault();
        event.stopPropagation();
        requestNewNote();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTab,
    actionsInsightsModalOpen,
    aiPreview,
    canEditSelected,
    confirmState,
    manageActionModalIndex,
    open,
    openTranslateLanguageModal,
    pdfReviewModalOpen,
    pdfSelectionModalOpen,
    requestNewNote,
    runAiTransform,
    save,
    timelineActivityModalOpen,
    translateLanguageModalOpen,
    aiBusy
  ]);

  const applyAiPreviewToNote = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();
    if (!aiPreview || !canEditSelected) return;
    const nextText = String(aiDraftText || aiPreview.transformedText || '').trim();
    if (!nextText) return;
    const replaced = !!editorRef.current?.replaceSelectedText(nextText);
    if (!replaced) {
      push(
        t({
          it: 'Selezione non disponibile. Seleziona di nuovo il testo e riprova.',
          en: 'Selection is no longer available. Select the text again and retry.'
        }),
        'danger'
      );
      return;
    }
    setDirty(true);
    closeAiPreview();
    push(t({ it: 'Anteprima applicata alla selezione corrente', en: 'Preview applied to current selection' }), 'success');
  };

  const remove = async () => {
    if (!meeting?.id || !selectedNote || !canEditSelected) return;
    setConfirmState({ kind: 'delete' });
  };

  const deleteSelectedNote = async () => {
    if (!meeting?.id || !selectedNote || !canEditSelected) return;
    setSaving(true);
    try {
      await deleteMeetingNote(String(meeting.id), String(selectedNote.id));
      setDirty(false);
      await load();
      push(t({ it: 'Appunto eliminato', en: 'Note deleted' }), 'success');
    } catch (e: any) {
      setError(String(e?.message || 'Unable to delete note'));
      push(String(e?.message || 'Unable to delete note'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const setManagerField = useCallback(
    (field: 'topicsText' | 'summaryText' | 'nextMeetingDate', value: string) => {
      if (!canManageMeeting) return;
      setManagerFields((prev) => ({ ...prev, [field]: value }));
    },
    [canManageMeeting]
  );

  const setManagerActionField = useCallback(
    (index: number, field: keyof MeetingManagerAction, value: string | number) => {
      if (!canManageMeeting) return;
      setManagerFields((prev) => {
        const nextActions = Array.isArray(prev.actions) ? [...prev.actions] : [];
        const row = nextActions[index];
        if (!row) return prev;
        const nextValue =
          field === 'progressPct'
            ? normalizeActionProgress(Number(value || 0))
            : field === 'status'
              ? String(value || 'open')
              : String(value || '');
        nextActions[index] = {
          ...row,
          [field]: nextValue
        };
        if (field === 'progressPct') {
          const progress = normalizeActionProgress(Number(nextValue || 0));
          const currentStatus = String(nextActions[index].status || 'open');
          nextActions[index].status = currentStatus === 'not_needed' ? 'not_needed' : progress >= 100 ? 'done' : 'open';
        }
        return { ...prev, actions: nextActions };
      });
    },
    [canManageMeeting]
  );

  const addManagerAction = useCallback(() => {
    if (!canManageMeeting) return;
    setManagerFields((prev) => ({
      ...prev,
      actions: [...(Array.isArray(prev.actions) ? prev.actions : []), { action: '', assignedTo: '', openingDate: '', completionDate: '', progressPct: 0, status: 'open' }]
    }));
  }, [canManageMeeting]);

  const removeManagerAction = useCallback(
    (index: number) => {
      if (!canManageMeeting) return;
      setManagerFields((prev) => ({
        ...prev,
        actions: (Array.isArray(prev.actions) ? prev.actions : []).filter((_, idx) => idx !== index)
      }));
    },
    [canManageMeeting]
  );

  const openManageActionModal = useCallback(
    (index: number) => {
      if (!Number.isFinite(index) || index < 0) return;
      const row = normalizedManagerActions[index];
      if (!row) return;
      setManageActionModalIndex(index);
      setManageActionDueDateDraft(String(row.completionDate || toIsoDay(Date.now() + 7 * DAY_MS)));
    },
    [normalizedManagerActions]
  );

  const closeManageActionModal = useCallback(() => {
    ignoreOuterCloseUntilRef.current = Date.now() + 320;
    setManageActionModalIndex(-1);
    setManageActionDueDateDraft('');
  }, []);

  const closeTimelineActivityModal = useCallback(() => {
    ignoreOuterCloseUntilRef.current = Date.now() + 320;
    setTimelineActivityModalOpen(false);
  }, []);

  const closeActionsInsightsModal = useCallback(() => {
    ignoreOuterCloseUntilRef.current = Date.now() + 320;
    setActionsInsightsModalOpen(false);
  }, []);

  const closeConfirmModal = useCallback(() => {
    ignoreOuterCloseUntilRef.current = Date.now() + 320;
    setConfirmState(null);
  }, []);

  const openManagedActionDatePicker = useCallback(() => {
    if (!canManageMeeting) return;
    const input = manageActionDueDateInputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    if (!input) return;
    input.focus();
    try {
      input.showPicker?.();
    } catch {
      // ignore browsers without showPicker support
    }
  }, [canManageMeeting]);

  const updateManagedActionProgress = useCallback(
    (nextProgress: number) => {
      if (!canManageMeeting || manageActionModalIndex < 0) return;
      const normalized = normalizeActionProgress(nextProgress);
      setManagerFields((prev) => {
        const nextActions = Array.isArray(prev.actions) ? [...prev.actions] : [];
        const row = nextActions[manageActionModalIndex];
        if (!row) return prev;
        nextActions[manageActionModalIndex] = {
          ...row,
          progressPct: normalized,
          status: normalized >= 100 ? 'done' : 'open'
        };
        return { ...prev, actions: nextActions };
      });
    },
    [canManageMeeting, manageActionModalIndex]
  );

  const markManagedActionAsNotNeeded = useCallback(() => {
    if (!canManageMeeting || manageActionModalIndex < 0) return;
    setManagerFields((prev) => {
      const nextActions = Array.isArray(prev.actions) ? [...prev.actions] : [];
      const row = nextActions[manageActionModalIndex];
      if (!row) return prev;
      nextActions[manageActionModalIndex] = {
        ...row,
        status: 'not_needed',
        progressPct: 0
      };
      return { ...prev, actions: nextActions };
    });
  }, [canManageMeeting, manageActionModalIndex]);

  const applyManagedActionDueDate = useCallback(() => {
    if (!canManageMeeting || manageActionModalIndex < 0) return;
    const nextDate = String(manageActionDueDateDraft || '').trim();
    if (!nextDate) return;
    setManagerActionField(manageActionModalIndex, 'completionDate', nextDate);
  }, [canManageMeeting, manageActionModalIndex, manageActionDueDateDraft, setManagerActionField]);

  const deleteManagedAction = useCallback(() => {
    if (!canManageMeeting || manageActionModalIndex < 0) return;
    removeManagerAction(manageActionModalIndex);
    closeManageActionModal();
  }, [canManageMeeting, closeManageActionModal, manageActionModalIndex, removeManagerAction]);

  const saveManager = useCallback(async () => {
    if (!meeting?.id || !canManageMeeting || !managerDirty) return true;
    const missingTitleIndex = findManagerActionMissingTitleIndex(Array.isArray(managerFields.actions) ? managerFields.actions : []);
    if (missingTitleIndex >= 0) {
      const message = t({
        it: `La task ${missingTitleIndex + 1} non ha un titolo. Inserisci il titolo prima di salvare.`,
        en: `Task ${missingTitleIndex + 1} has no title. Enter a title before saving.`
      });
      setError(message);
      push(message, 'danger');
      return false;
    }
    setManagerSaving(true);
    try {
      const sanitizedActions = sanitizeManagerActionsForPersist(Array.isArray(managerFields.actions) ? managerFields.actions : []);
      const payload = await updateMeetingManagerFields(String(meeting.id), {
        topicsText: String(managerFields.topicsText || ''),
        summaryText: String(managerFields.summaryText || ''),
        actions: sanitizedActions,
        nextMeetingDate: String(managerFields.nextMeetingDate || '')
      });
      const next = payload.managerFields ? { ...emptyManagerFields(String(meeting.id)), ...payload.managerFields } : emptyManagerFields(String(meeting.id));
      setManagerFields(next);
      setManagerFieldsSnapshot(next);
      setCanManageMeeting(!!payload.canManageMeeting);
      setFollowUpChain((prev) =>
        prev.map((entry) => {
          const isCurrentMeeting = String(entry.meeting.id || '') === String(meeting.id || '');
          return {
            ...entry,
            managerFields: isCurrentMeeting
              ? next
              : {
                  ...entry.managerFields,
                  actions: Array.isArray(next.actions) ? next.actions : []
                }
          };
        })
      );
      push(t({ it: 'Campi manager salvati', en: 'Manager fields saved' }), 'success');
      return true;
    } catch (e: any) {
      const message = String(e?.message || t({ it: 'Salvataggio campi manager non riuscito', en: 'Failed to save manager fields' }));
      setError(message);
      push(message, 'danger');
      return false;
    } finally {
      setManagerSaving(false);
    }
  }, [meeting?.id, canManageMeeting, managerDirty, managerFields, t, push, findManagerActionMissingTitleIndex, sanitizeManagerActionsForPersist]);

  const scheduleFollowUp = useCallback(async (sourceMeeting?: MeetingBooking | null, preferredDay?: string) => {
    const baseMeeting = sourceMeeting || meeting;
    if (!baseMeeting?.id || !canManageMeeting) return;
    const nextDate = String(preferredDay || managerFields.nextMeetingDate || '').trim();
    if (onOpenFollowUpScheduler) {
      setManagerScheduling(true);
      try {
        onOpenFollowUpScheduler(baseMeeting, nextDate ? { preferredDay: nextDate, mode: 'followup' } : { mode: 'followup' });
      } finally {
        window.setTimeout(() => setManagerScheduling(false), 120);
      }
      return;
    }
    push(t({ it: 'Scheduling follow-up non disponibile in questa schermata', en: 'Follow-up scheduling is not available from this screen' }), 'info');
  }, [meeting, canManageMeeting, managerFields.nextMeetingDate, onOpenFollowUpScheduler, push, t]);

  const formatMeetingRelativeDayLabel = useCallback(
    (startAt: number) => {
      const offset = getDayOffsetFromToday(startAt);
      if (offset === null) return t({ it: 'n/d', en: 'n/a' });
      if (offset === 0) return t({ it: 'oggi', en: 'today' });
      if (offset > 0) return t({ it: `tra ${offset} giorni`, en: `in ${offset} days` });
      return t({ it: `${Math.abs(offset)} giorni fa`, en: `${Math.abs(offset)} days ago` });
    },
    [t]
  );

  const openTimelineScheduleManagement = useCallback(() => {
    const entry = timelineScheduleContextEntry;
    setTimelineScheduleContextMenu(null);
    if (!entry) return;
    if (onOpenDetails) {
      onOpenDetails(entry.meeting);
      return;
    }
    if (onOpenFollowUpScheduler) {
      const preferredDay = String(entry.meeting.occurrenceDate || '').trim() || toIsoDay(Number(entry.meeting.startAt || Date.now()));
      onOpenFollowUpScheduler(entry.meeting, { preferredDay, mode: 'followup' });
      return;
    }
    push(
      t({
        it: 'Gestione schedulazioni non disponibile in questa schermata',
        en: 'Schedule management is not available from this screen'
      }),
      'info'
    );
  }, [onOpenDetails, onOpenFollowUpScheduler, push, t, timelineScheduleContextEntry]);

  const deleteTimelineScheduledMeeting = useCallback(async () => {
    const entry = timelineScheduleContextEntry;
    setTimelineScheduleContextMenu(null);
    if (!entry) return;
    if (!canManageMeeting && !entry.canManageMeeting) {
      push(t({ it: 'Non hai i permessi per eliminare questa schedulazione', en: 'You do not have permission to remove this schedule' }), 'danger');
      return;
    }
    const confirmed = window.confirm(
      t({
        it: 'Confermi eliminazione della schedulazione selezionata?',
        en: 'Confirm deletion of the selected schedule?'
      })
    );
    if (!confirmed) return;
    setManagerScheduling(true);
    try {
      await cancelMeeting(String(entry.meeting.id), {
        reason: t({ it: 'Schedulazione eliminata dalla timeline follow-up', en: 'Schedule removed from follow-up timeline' })
      });
      push(t({ it: 'Schedulazione eliminata', en: 'Schedule deleted' }), 'success');
      await load({ keepSelectedId: String(selectedId || NEW_NOTE_ID) || NEW_NOTE_ID });
    } catch (e: any) {
      const message = String(e?.message || t({ it: 'Eliminazione schedulazione non riuscita', en: 'Failed to delete schedule' }));
      setError(message);
      push(message, 'danger');
    } finally {
      setManagerScheduling(false);
    }
  }, [canManageMeeting, load, push, selectedId, t, timelineScheduleContextEntry]);

  const saveAll = useCallback(async () => {
    if (canEditSelected && dirty) {
      const ok = await save();
      if (!ok) return;
    }
    if (canManageMeeting && managerDirty) {
      await saveManager();
    }
  }, [canEditSelected, dirty, canManageMeeting, managerDirty, save, saveManager]);

  const duplicateNote = async (note: MeetingNote) => {
    if (!meeting?.id) return;
    setSaving(true);
    setNoteContextMenu(null);
    try {
      const nextTitle = `${String(note.title || t({ it: 'Appunto meeting', en: 'Meeting note' })).trim()} ${t({ it: '(Copia)', en: '(Copy)' })}`;
      const payload = await upsertMeetingNote(String(meeting.id), {
        title: nextTitle.trim(),
        contentText: String(note.contentText || '').trim(),
        contentHtml: String(note.contentHtml || '').trim(),
        contentLexical: String(note.contentLexical || '').trim(),
        shared: !!note.shared
      });
      setDirty(false);
      await load({ keepSelectedId: String(payload.note?.id || '') });
      push(t({ it: 'Appunto duplicato', en: 'Note duplicated' }), 'success');
    } catch (e: any) {
      setError(String(e?.message || 'Unable to duplicate note'));
      push(String(e?.message || 'Unable to duplicate note'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const toggleShareForNote = async (note: MeetingNote) => {
    if (!meeting?.id) return;
    if (!canEditNote(note)) return;
    setSaving(true);
    setNoteContextMenu(null);
    try {
      await upsertMeetingNote(String(meeting.id), {
        id: String(note.id),
        title: String(note.title || '').trim(),
        contentText: String(note.contentText || '').trim(),
        contentHtml: String(note.contentHtml || '').trim(),
        contentLexical: String(note.contentLexical || '').trim(),
        shared: !note.shared
      });
      if (String(selectedId) === String(note.id)) {
        setShared(!note.shared);
        setDirty(false);
      }
      await load({ keepSelectedId: String(note.id) });
      push(
        !note.shared
          ? t({ it: 'Appunto condiviso', en: 'Note shared' })
          : t({ it: 'Condivisione rimossa', en: 'Sharing removed' }),
        'success'
      );
    } catch (e: any) {
      setError(String(e?.message || 'Unable to update share state'));
      push(String(e?.message || 'Unable to update share state'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const confirmTitle = useMemo(() => {
    switch (confirmState?.kind) {
      case 'close':
        return t({ it: 'Salvare prima di chiudere?', en: 'Save before closing?' });
      case 'switch':
        return t({ it: 'Salvare prima di cambiare nota?', en: 'Save before switching note?' });
      case 'delete':
        return t({ it: 'Eliminare questo appunto?', en: 'Delete this note?' });
      default:
        return '';
    }
  }, [confirmState?.kind, t]);

  const confirmDescription = useMemo(() => {
    switch (confirmState?.kind) {
      case 'close':
        return t({
          it: 'Hai modifiche non salvate nella nota corrente. Puoi salvare, uscire senza salvare o annullare.',
          en: 'You have unsaved changes in the current note. You can save, continue without saving, or cancel.'
        });
      case 'switch':
        return t({
          it: 'Hai modifiche non salvate nella nota corrente. Puoi salvare, passare senza salvare o annullare.',
          en: 'You have unsaved changes in the current note. You can save, switch without saving, or cancel.'
        });
      case 'delete':
        return t({
          it: 'L’appunto verrà eliminato definitivamente.',
          en: 'The note will be permanently deleted.'
        });
      default:
        return '';
    }
  }, [confirmState?.kind, t]);

  const confirmAction = useCallback(async () => {
    if (!confirmState) return;
    const current = confirmState;
    if (current.kind === 'close' || current.kind === 'switch') {
      const ok = await save();
      if (!ok) return;
    }
    setConfirmState(null);
    if (current.kind === 'close') {
      onClose();
      return;
    }
    if (current.kind === 'switch') {
      if (current.nextId) {
        setSelectedId(current.nextId);
      }
      return;
    }
    if (current.kind === 'delete') {
      await deleteSelectedNote();
    }
  }, [confirmState, onClose]);

  const continueWithoutSaving = useCallback(() => {
    if (!confirmState) return;
    const current = confirmState;
    setConfirmState(null);
    setDirty(false);
    if (current.kind === 'close') {
      onClose();
      return;
    }
    if (current.kind === 'switch' && current.nextId) {
      setSelectedId(current.nextId);
    }
  }, [confirmState, onClose]);

  const exportCsv = async () => {
    if (!meeting?.id) return;
    setExporting(true);
    try {
      const blob = await exportMeetingNotesCsv(String(meeting.id));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meeting-notes-${String(meeting.id).slice(0, 8)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(String(e?.message || 'Unable to export notes'));
      push(String(e?.message || 'Unable to export notes'), 'danger');
    } finally {
      setExporting(false);
    }
  };

  const openPdfSelectionModal = () => {
    const next: Record<string, boolean> = {};
    for (const note of notes) next[String(note.id)] = true;
    setPdfSelection(next);
    setPdfFileName(`Meeting-${String(meeting?.subject || t({ it: 'Riunione', en: 'Meeting' })).trim()}.pdf`);
    setPdfReviewModalOpen(false);
    setPdfSelectionModalOpen(true);
  };

  const closePdfSelectionModal = () => {
    ignoreOuterCloseUntilRef.current = Date.now() + 300;
    setPdfReviewModalOpen(false);
    setPdfSelectionModalOpen(false);
  };

  const openPdfReviewModal = () => {
    setPdfReviewModalOpen(true);
  };

  const closePdfReviewModal = () => {
    ignoreOuterCloseUntilRef.current = Date.now() + 300;
    setPdfReviewModalOpen(false);
  };

  const selectedNotesForPdf = useMemo(() => {
    return notes.filter((note) => !!pdfSelection[String(note.id)]);
  }, [notes, pdfSelection]);

  const reportActions = useMemo(
    () =>
      normalizedManagerActions.filter((row) => {
        const progress = normalizeActionProgress(Number(row.progressPct || 0));
        return !!(
          String(row.action || '').trim() ||
          String(row.assignedTo || '').trim() ||
          String(row.openingDate || '').trim() ||
          String(row.completionDate || '').trim() ||
          progress > 0 ||
          String(row.status || '') === 'not_needed' ||
          progress >= 100
        );
      }),
    [normalizedManagerActions]
  );

  const reportNextMeeting = useMemo(() => {
    const sorted = [...followUpChain].sort((a, b) => Number(a.meeting.startAt || 0) - Number(b.meeting.startAt || 0));
    const baseStart = Number(meeting?.startAt || 0);
    const nextEntry = sorted.find((entry) => Number(entry.meeting.startAt || 0) > baseStart) || null;
    if (nextEntry) {
      const nextStart = Number(nextEntry.meeting.startAt || 0);
      const nextEnd = Number(nextEntry.meeting.endAt || 0);
      const dayLabel = new Date(nextStart).toLocaleDateString(undefined, { weekday: 'long' });
      return {
        value: `${new Date(nextStart).toLocaleDateString()} (${dayLabel}) • ${new Date(nextStart).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })} - ${new Date(nextEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${String(nextEntry.meeting.roomName || '-')}`,
        dateLabel: new Date(nextStart).toLocaleDateString(),
        dayLabel,
        timeLabel: `${new Date(nextStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(nextEnd).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })}`,
        roomLabel: String(nextEntry.meeting.roomName || '-')
      };
    }
    const fallbackTs = parseIsoDay(String(managerFields.nextMeetingDate || ''));
    if (Number.isFinite(Number(fallbackTs))) {
      const ts = Number(fallbackTs);
      const dayLabel = new Date(ts).toLocaleDateString(undefined, { weekday: 'long' });
      return {
        value: `${new Date(ts).toLocaleDateString()} (${dayLabel}) • ${t({ it: 'orario da definire', en: 'time to be defined' })} • ${
          meeting?.roomName || '-'
        }`,
        dateLabel: new Date(ts).toLocaleDateString(),
        dayLabel,
        timeLabel: t({ it: 'Orario da definire', en: 'Time to be defined' }),
        roomLabel: String(meeting?.roomName || '-')
      };
    }
    return {
      value: '—',
      dateLabel: '—',
      dayLabel: '—',
      timeLabel: t({ it: 'Orario da definire', en: 'Time to be defined' }),
      roomLabel: String(meeting?.roomName || '-')
    };
  }, [followUpChain, managerFields.nextMeetingDate, meeting?.roomName, meeting?.startAt, t]);

  const reportParticipantsColumns = useMemo(() => {
    const splitIndex = Math.ceil(invitedParticipants.length / 2);
    return {
      left: invitedParticipants.slice(0, splitIndex),
      right: invitedParticipants.slice(splitIndex)
    };
  }, [invitedParticipants]);

  const reportChainRows = useMemo(() => {
    const now = Date.now();
    return [...followUpChain]
      .sort((a, b) => Number(a.meeting.startAt || 0) - Number(b.meeting.startAt || 0))
      .map((entry, index) => {
        const startAt = Number(entry.meeting.startAt || 0);
        const endAt = Number(entry.meeting.endAt || 0);
        const phase = getMeetingSchedulePhase(startAt, endAt, now);
        return {
          id: String(entry.meeting.id || `${index}`),
          index,
          entry,
          phase,
          phaseLabel: getMeetingSchedulePhaseLabel(phase, t, {
            past: { it: 'Passato', en: 'Past' }
          })
        };
      });
  }, [followUpChain, t]);

  const exportNotesPdf = async () => {
    if (!meeting?.id) return;
    setPdfExporting(true);
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 38;
      const footerReserved = 32;
      const contentWidth = pageWidth - margin * 2;
      const contentBottom = pageHeight - margin - footerReserved;
      let y = margin;

      const clientName = String(selectedClient?.name || meeting.clientId || '-');
      const siteName = String(selectedSite?.name || meeting.siteId || '-');
      const floorPlanName = String(selectedFloorPlan?.name || meeting.floorPlanId || '-');
      const roomName = String(meeting.roomName || '-');
      const meetingStart = Number(meeting.startAt || 0);
      const meetingEnd = Number(meeting.endAt || 0);
      const meetingDate = new Date(meetingStart).toLocaleDateString();
      const meetingTime = `${new Date(meetingStart).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })} - ${new Date(meetingEnd).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })}`;
      const clientLogoUrl = String((selectedClient as any)?.logoUrl || '').trim();
      const clientLogoData = await fetchImageAsDataUrl(clientLogoUrl);

      const addPage = () => {
        doc.addPage();
        y = margin;
      };
      const ensureSpace = (needed: number) => {
        if (y + needed <= contentBottom) return;
        addPage();
      };
      const drawSectionTitle = (title: string, subtitle?: string) => {
        ensureSpace(subtitle ? 36 : 24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text(title, margin, y + 11);
        if (subtitle) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(subtitle, margin, y + 24);
          y += 32;
          return;
        }
        y += 20;
      };

      const drawHeader = () => {
        const h = 118;
        ensureSpace(h + 10);
        doc.setFillColor(30, 64, 175);
        doc.roundedRect(margin, y, contentWidth, h, 12, 12, 'F');
        doc.setTextColor(248, 250, 252);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(t({ it: 'Report meeting manager', en: 'Meeting manager report' }), margin + 16, y + 24);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${clientName} • ${siteName} • ${floorPlanName}`, margin + 16, y + 44);
        doc.text(`${roomName} • ${meetingDate} • ${meetingTime}`, margin + 16, y + 60);
        doc.text(
          `${t({ it: 'Riunione', en: 'Meeting' })}: ${String(meeting.subject || t({ it: 'Senza oggetto', en: 'Untitled' }))}`,
          margin + 16,
          y + 76
        );
        doc.text(
          `${t({ it: 'Appunti inclusi', en: 'Included notes' })}: ${selectedNotesForPdf.length} • ${t({ it: 'Task', en: 'Tasks' })}: ${reportActions.length}`,
          margin + 16,
          y + 92
        );
        if (clientLogoData) {
          try {
            doc.addImage(clientLogoData, 'PNG', margin + contentWidth - 64, y + 14, 48, 48, undefined, 'FAST');
          } catch {
            // ignore invalid image
          }
        }
        y += h + 12;
      };

      const drawParticipantsTwoColumns = () => {
        drawSectionTitle(
          t({ it: 'Partecipanti', en: 'Participants' }),
          `${invitedParticipants.length} ${t({ it: 'invitati', en: 'invited' })}`
        );
        if (!invitedParticipants.length) {
          ensureSpace(18);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(t({ it: 'Nessun partecipante disponibile', en: 'No participants available' }), margin, y + 10);
          y += 18;
          return;
        }
        const tableGap = 12;
        const colWidth = (contentWidth - tableGap) / 2;
        const leftRows = Math.ceil(invitedParticipants.length / 2);
        for (let rowIdx = 0; rowIdx < leftRows; rowIdx += 1) {
          const left = invitedParticipants[rowIdx] || null;
          const right = invitedParticipants[rowIdx + leftRows] || null;
          const formatCell = (person: (typeof invitedParticipants)[number] | null) => {
            if (!person) return ['—'];
            const main = `${String(person.name || '').trim()} (${person.remote ? 'remote' : 'on site'})`;
            const secondary = person.kind === 'internal' ? String(person.department || '').trim() : String(person.company || '').trim();
            const text = secondary ? `${main} • ${secondary}` : main;
            return wrapPdfTextToWidth(doc, text, colWidth - 14);
          };
          const leftLines = formatCell(left);
          const rightLines = formatCell(right);
          const maxLines = Math.max(leftLines.length, rightLines.length, 1);
          const rowHeight = 8 + maxLines * 11;
          if (y + rowHeight > contentBottom) {
            addPage();
          }
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(margin, y, contentWidth, rowHeight);
          doc.line(margin + colWidth + tableGap / 2, y, margin + colWidth + tableGap / 2, y + rowHeight);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          leftLines.forEach((line, idx) => doc.text(line, margin + 8, y + 12 + idx * 11));
          rightLines.forEach((line, idx) => doc.text(line, margin + colWidth + tableGap / 2 + 8, y + 12 + idx * 11));
          y += rowHeight;
        }
        y += 10;
      };

      const drawFollowUpChainSection = () => {
        const hasFollowUpParent = !!String((meeting as any)?.followUpOfMeetingId || '').trim();
        if (!hasFollowUpParent && followUpChain.length <= 1) return;
        const chainRows = [...followUpChain].sort((a, b) => Number(a.meeting.startAt || 0) - Number(b.meeting.startAt || 0));
        if (!chainRows.length) return;
        drawSectionTitle(
          t({ it: 'Chain follow-up', en: 'Follow-up chain' }),
          `${chainRows.length} ${t({ it: 'meeting collegati', en: 'linked meetings' })}`
        );
        const colStep = 42;
        const colDate = 116;
        const colStatus = 76;
        const colSubject = contentWidth - colStep - colDate - colStatus - 16;
        const drawHeaderRow = () => {
          ensureSpace(22);
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 20, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, contentWidth, 20);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text('#', margin + 6, y + 13);
          doc.text(t({ it: 'Data', en: 'Date' }), margin + colStep + 6, y + 13);
          doc.text(t({ it: 'Stato', en: 'Status' }), margin + colStep + colDate + 6, y + 13);
          doc.text(t({ it: 'Riunione', en: 'Meeting' }), margin + colStep + colDate + colStatus + 6, y + 13);
          y += 20;
        };
        drawHeaderRow();
        for (let index = 0; index < chainRows.length; index += 1) {
          const row = chainRows[index];
          const startAt = Number(row.meeting.startAt || 0);
          const endAt = Number(row.meeting.endAt || 0);
          const now = Date.now();
          const phase = getMeetingSchedulePhase(startAt, endAt, now);
          const phaseLabel = getMeetingSchedulePhaseLabel(phase, t, {
            past: { it: 'Passato', en: 'Past' }
          });
          const fill =
            phase === 'past'
              ? ([241, 245, 249] as const)
              : phase === 'current'
                ? ([220, 252, 231] as const)
                : ([224, 242, 254] as const);
          const meetingLabel = `${String(row.meeting.subject || t({ it: 'Riunione', en: 'Meeting' }))} • ${String(row.meeting.roomName || '-')}`;
          const meetingLines = wrapPdfTextToWidth(doc, meetingLabel, colSubject - 10);
          const rowHeight = Math.max(20, 8 + meetingLines.length * 11);
          if (y + rowHeight > contentBottom) {
            addPage();
            drawHeaderRow();
          }
          doc.setFillColor(fill[0], fill[1], fill[2]);
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, contentWidth, rowHeight);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(String(index + 1).padStart(2, '0'), margin + 6, y + 13);
          doc.setFont('helvetica', 'normal');
          doc.text(new Date(startAt).toLocaleDateString(), margin + colStep + 6, y + 13);
          doc.text(phaseLabel, margin + colStep + colDate + 6, y + 13);
          meetingLines.forEach((line, idx) => doc.text(line, margin + colStep + colDate + colStatus + 6, y + 13 + idx * 11));
          y += rowHeight;
        }
        y += 10;
      };

      const drawReportSummary = () => {
        const topics = normalizePdfText(String(managerFields.topicsText || '')) || '—';
        const summary = normalizePdfText(String(managerFields.summaryText || '')) || '—';
        drawSectionTitle(t({ it: 'Temi e sommario', en: 'Topics and summary' }));

        const drawCard = (label: string, value: string, tone?: 'green') => {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          const labelLines = wrapPdfTextToWidth(doc, label, contentWidth - 24);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          const valueLines = wrapPdfTextToWidth(doc, value, contentWidth - 24);
          const height = 14 + labelLines.length * 10 + valueLines.length * 11;
          ensureSpace(height + 6);
          if (tone === 'green') {
            doc.setFillColor(220, 252, 231);
          } else {
            doc.setFillColor(248, 250, 252);
          }
          doc.roundedRect(margin, y, contentWidth, height, 8, 8, 'F');
          let cursor = y + 12;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(tone === 'green' ? 6 : 71, tone === 'green' ? 95 : 85, tone === 'green' ? 70 : 105);
          labelLines.forEach((line) => {
            doc.text(line, margin + 10, cursor);
            cursor += 10;
          });
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(tone === 'green' ? 6 : 15, tone === 'green' ? 95 : 23, tone === 'green' ? 70 : 42);
          valueLines.forEach((line) => {
            doc.text(line, margin + 10, cursor + 1);
            cursor += 11;
          });
          y += height + 6;
        };

        drawCard(t({ it: 'Temi trattati', en: 'Topics discussed' }), topics);
        drawCard(t({ it: 'Sommario generale', en: 'General summary' }), summary);
        drawCard(t({ it: 'Prossima riunione', en: 'Next meeting' }), reportNextMeeting.value, 'green');
      };

      const drawActionsSection = () => {
        drawSectionTitle(
          t({ it: 'Azioni meeting', en: 'Meeting actions' }),
          `${reportActions.length} ${t({ it: 'azioni totali', en: 'total actions' })}`
        );
        if (!reportActions.length) {
          ensureSpace(18);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(t({ it: 'Nessuna azione disponibile', en: 'No actions available' }), margin, y + 10);
          y += 18;
          return;
        }
        const colTask = contentWidth * 0.34;
        const colOwner = contentWidth * 0.2;
        const colDates = contentWidth * 0.2;
        const colStatus = contentWidth - colTask - colOwner - colDates;
        const drawHeaderRow = () => {
          ensureSpace(22);
          doc.setFillColor(241, 245, 249);
          doc.rect(margin, y, contentWidth, 20, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, contentWidth, 20);
          doc.line(margin + colTask, y, margin + colTask, y + 20);
          doc.line(margin + colTask + colOwner, y, margin + colTask + colOwner, y + 20);
          doc.line(margin + colTask + colOwner + colDates, y, margin + colTask + colOwner + colDates, y + 20);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(71, 85, 105);
          doc.text(t({ it: 'Task', en: 'Task' }), margin + 8, y + 13);
          doc.text(t({ it: 'Assegnata a', en: 'Assigned to' }), margin + colTask + 8, y + 13);
          doc.text(t({ it: 'Date', en: 'Dates' }), margin + colTask + colOwner + 8, y + 13);
          doc.text(t({ it: 'Stato', en: 'Status' }), margin + colTask + colOwner + colDates + 8, y + 13);
          y += 20;
        };
        drawHeaderRow();

        for (const row of reportActions) {
          const progress = normalizeActionProgress(Number(row.progressPct || 0));
          const isNotNeeded = String(row.status || '') === 'not_needed';
          const isDone = !isNotNeeded && progress >= 100;
          const tone = isNotNeeded ? ([241, 245, 249] as const) : isDone ? ([220, 252, 231] as const) : ([254, 249, 195] as const);
          const taskLabel = String(row.action || '').trim() || '—';
          const ownerLabel = String(row.assignedTo || '').trim() || '—';
          const dateLabel = `${formatIsoDayLabel(String(row.openingDate || ''))} -> ${formatIsoDayLabel(String(row.completionDate || ''))}`;
          const statusLabel = isNotNeeded
            ? `${t({ it: 'Non necessaria', en: 'Not needed' })} (N/A)`
            : isDone
              ? `${t({ it: 'Completata', en: 'Completed' })} (100%)`
              : `${t({ it: 'In corso', en: 'In progress' })} (${progress}%)`;
          const taskLines = wrapPdfTextToWidth(doc, taskLabel, colTask - 16);
          const ownerLines = wrapPdfTextToWidth(doc, ownerLabel, colOwner - 16);
          const dateLines = wrapPdfTextToWidth(doc, dateLabel, colDates - 16);
          const statusLines = wrapPdfTextToWidth(doc, statusLabel, colStatus - 16);
          const maxLines = Math.max(taskLines.length, ownerLines.length, dateLines.length, statusLines.length, 1);
          const rowHeight = 8 + maxLines * 11;
          if (y + rowHeight > contentBottom) {
            addPage();
            drawHeaderRow();
          }
          doc.setFillColor(tone[0], tone[1], tone[2]);
          doc.rect(margin, y, contentWidth, rowHeight, 'F');
          doc.setDrawColor(203, 213, 225);
          doc.rect(margin, y, contentWidth, rowHeight);
          doc.line(margin + colTask, y, margin + colTask, y + rowHeight);
          doc.line(margin + colTask + colOwner, y, margin + colTask + colOwner, y + rowHeight);
          doc.line(margin + colTask + colOwner + colDates, y, margin + colTask + colOwner + colDates, y + rowHeight);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(15, 23, 42);
          taskLines.forEach((line, idx) => doc.text(line, margin + 8, y + 12 + idx * 11));
          ownerLines.forEach((line, idx) => doc.text(line, margin + colTask + 8, y + 12 + idx * 11));
          dateLines.forEach((line, idx) => doc.text(line, margin + colTask + colOwner + 8, y + 12 + idx * 11));
          statusLines.forEach((line, idx) => doc.text(line, margin + colTask + colOwner + colDates + 8, y + 12 + idx * 11));
          y += rowHeight;
        }
        y += 10;
      };

      const drawNotesSection = () => {
        drawSectionTitle(t({ it: 'Appunti selezionati', en: 'Selected notes' }));
        if (!selectedNotesForPdf.length) {
          ensureSpace(20);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          doc.text(t({ it: 'Nessun appunto incluso nel report.', en: 'No notes included in the report.' }), margin, y + 10);
          y += 20;
          return;
        }
        for (let index = 0; index < selectedNotesForPdf.length; index += 1) {
          const note = selectedNotesForPdf[index];
          const noteTitle = String(note.title || t({ it: 'Appunto meeting', en: 'Meeting note' })).trim();
          const author = String(note.authorDisplayName || note.authorUsername || '-').trim();
          const noteText = normalizePdfNoteText(String(note.contentHtml || note.contentText || '').trim());
          const lines = wrapPdfTextToWidth(doc, noteText, contentWidth - 24);

          let cursor = 0;
          let firstChunk = true;
          while (cursor < lines.length || firstChunk) {
            if (firstChunk) {
              ensureSpace(38);
              doc.setFillColor(224, 242, 254);
              doc.roundedRect(margin, y, contentWidth, 30, 8, 8, 'F');
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(10);
              doc.setTextColor(3, 105, 161);
              doc.text(`${index + 1}. ${noteTitle}`, margin + 8, y + 13);
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(8);
              doc.setTextColor(14, 116, 144);
              doc.text(`${author} • ${formatStamp(Number(note.updatedAt || 0))}`, margin + 8, y + 24);
              y += 36;
              firstChunk = false;
            }
            const available = contentBottom - y;
            const maxLinesPerChunk = Math.max(1, Math.floor((Math.max(available, 32) - 14) / 10));
            const chunk = lines.slice(cursor, cursor + maxLinesPerChunk);
            const textHeight = Math.max(24, 10 + chunk.length * 10);
            if (y + textHeight + 8 > contentBottom) {
              addPage();
              continue;
            }
            const textTop = y;
            doc.setFillColor(248, 250, 252);
            doc.roundedRect(margin, textTop, contentWidth, textHeight, 8, 8, 'F');
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(30, 41, 59);
            chunk.forEach((line, lineIndex) => {
              doc.text(line, margin + 10, textTop + 12 + lineIndex * 10);
            });
            y = textTop + textHeight + 8;
            cursor += chunk.length;
            if (cursor < lines.length) addPage();
          }
        }
      };

      const drawChartsAndStats = () => {
        drawSectionTitle(t({ it: 'Grafici e statistiche', en: 'Charts and statistics' }));
        const total = Math.max(1, actionInsights.total);
        const doneW = Math.round((contentWidth * actionInsights.done) / total);
        const inProgressW = Math.round((contentWidth * actionInsights.inProgress) / total);
        const notNeededW = Math.max(0, contentWidth - doneW - inProgressW);
        ensureSpace(104);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
        doc.text(t({ it: 'Mix completamento', en: 'Completion mix' }), margin, y + 10);
        doc.setFillColor(22, 163, 74);
        doc.rect(margin, y + 16, doneW, 14, 'F');
        doc.setFillColor(245, 158, 11);
        doc.rect(margin + doneW, y + 16, inProgressW, 14, 'F');
        doc.setFillColor(148, 163, 184);
        doc.rect(margin + doneW + inProgressW, y + 16, notNeededW, 14, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin, y + 16, contentWidth, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(51, 65, 85);
        doc.text(`${t({ it: 'Completate', en: 'Completed' })}: ${actionInsights.done}`, margin, y + 40);
        doc.text(`${t({ it: 'In corso', en: 'In progress' })}: ${actionInsights.inProgress}`, margin + 150, y + 40);
        doc.text(`${t({ it: 'Non necessarie', en: 'Not needed' })}: ${actionInsights.notNeeded}`, margin + 300, y + 40);

        const statBoxWidth = (contentWidth - 18) / 4;
        const stats = [
          { label: t({ it: 'Tasso completamento', en: 'Completion rate' }), value: `${actionInsights.completionRate}%` },
          { label: t({ it: 'Tempo medio risoluzione', en: 'Avg resolution' }), value: `${actionInsights.avgResolutionDays || 0}d` },
          { label: t({ it: 'In ritardo', en: 'Overdue' }), value: String(actionInsights.overdue) },
          { label: t({ it: 'Totale task', en: 'Total tasks' }), value: String(actionInsights.total) }
        ];
        let boxX = margin;
        for (const stat of stats) {
          doc.setFillColor(248, 250, 252);
          doc.roundedRect(boxX, y + 52, statBoxWidth, 38, 6, 6, 'F');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7);
          doc.setTextColor(100, 116, 139);
          doc.text(stat.label, boxX + 6, y + 65);
          doc.setFontSize(12);
          doc.setTextColor(30, 41, 59);
          doc.text(stat.value, boxX + 6, y + 82);
          boxX += statBoxWidth + 6;
        }
        y += 98;

        const progressRows = reportActions.map((row, index) => {
          const progress = normalizeActionProgress(Number(row.progressPct || 0));
          const isNotNeeded = String(row.status || '') === 'not_needed';
          const isDone = !isNotNeeded && progress >= 100;
          const color = isNotNeeded ? ([148, 163, 184] as const) : isDone ? ([22, 163, 74] as const) : ([245, 158, 11] as const);
          return {
            id: `pdf-progress-${index}`,
            label: String(row.action || '').trim() || `${t({ it: 'Task', en: 'Task' })} ${index + 1}`,
            progress: isNotNeeded ? 100 : progress,
            isNotNeeded,
            color
          };
        });
        for (const item of progressRows) {
          ensureSpace(28);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(30, 41, 59);
          doc.text(item.label, margin, y + 8);
          doc.text(item.isNotNeeded ? 'N/A' : `${item.progress}%`, margin + contentWidth, y + 8, { align: 'right' });
          doc.setFillColor(226, 232, 240);
          doc.roundedRect(margin, y + 12, contentWidth, 8, 4, 4, 'F');
          doc.setFillColor(item.color[0], item.color[1], item.color[2]);
          doc.roundedRect(margin, y + 12, Math.max(0, Math.min(contentWidth, (contentWidth * item.progress) / 100)), 8, 4, 4, 'F');
          y += 26;
        }
      };

      drawHeader();
      drawParticipantsTwoColumns();
      drawFollowUpChainSection();
      drawReportSummary();
      drawActionsSection();
      drawNotesSection();
      drawChartsAndStats();

      const pages = doc.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        doc.setPage(page);
        doc.setDrawColor(226, 232, 240);
        doc.line(margin, pageHeight - 24, pageWidth - margin, pageHeight - 24);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(`${clientName} • ${siteName} • ${roomName}`, margin, pageHeight - 10);
        doc.text(`${page}/${pages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      }

      const finalFileName = sanitizeFileName(
        pdfFileName,
        `Meeting-${String(meeting?.subject || t({ it: 'Riunione', en: 'Meeting' })).trim()}`
      );
      doc.save(finalFileName);
      setPdfReviewModalOpen(false);
      setPdfSelectionModalOpen(false);
      push(t({ it: 'PDF generato', en: 'PDF generated' }), 'success');
    } catch (e: any) {
      const message = String(e?.message || 'Unable to export notes PDF');
      setError(message);
      push(message, 'danger');
    } finally {
      setPdfExporting(false);
    }
  };

  if (!meeting) return null;

  const sharedOthers = notes.filter((n) => n.shared && String(n.authorUserId || '') !== myUserId);
  const contextMenuNote = noteContextMenu
    ? notes.find((entry) => String(entry.id) === String(noteContextMenu.noteId)) || null
    : null;
  const contextMenuCanEdit = canEditNote(contextMenuNote);

  return (
    <>
      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-[130]" onClose={requestClose} initialFocus={dialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative flex h-[78vh] max-h-[88vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button
                    ref={dialogInitialFocusRef}
                    type="button"
                    className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
                  >
                    focus-sentinel
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Meeting manager', en: 'Meeting manager' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {meeting.subject || t({ it: 'Riunione', en: 'Meeting' })} • {meeting.roomName || '-'} • {new Date(Number(meeting.startAt || 0)).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <button
                        ref={dialogCloseButtonRef}
                        type="button"
                        onClick={requestClose}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="border-b border-slate-200 px-4 py-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
                      <button
                        type="button"
                        onClick={() => setActiveTab('manager')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'manager'
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ClipboardList size={15} />
                          {t({ it: 'Topics and Summary', en: 'Topics and Summary' })}
                        </div>
                        <div className="text-xs opacity-80">{t({ it: 'Temi trattati e sommario condiviso', en: 'Shared topics and summary' })}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('actions')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'actions'
                            ? 'border-amber-300 bg-amber-50 text-amber-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <ClipboardList size={15} />
                          {t({ it: 'Actions', en: 'Actions' })}
                        </div>
                        <div className="text-xs opacity-80">{t({ it: 'Azioni e prossima riunione', en: 'Actions and next meeting' })}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('notes')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'notes'
                            ? 'border-violet-300 bg-violet-50 text-violet-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <NotebookText size={15} />
                          {t({ it: 'Note', en: 'Notes' })}
                        </div>
                        <div className="text-xs opacity-80">{t({ it: 'Note personali e condivise', en: 'Personal and shared notes' })}</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'history'
                            ? 'border-sky-300 bg-sky-50 text-sky-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <History size={15} />
                          {t({ it: 'Timeline', en: 'Timeline' })}
                        </div>
                        <div className="text-xs opacity-80">
                          {followUpChain.length > 1
                            ? t({ it: 'Timeline dei follow-up collegati', en: 'Linked follow-up timeline' })
                            : t({ it: 'Nessun follow-up collegato', en: 'No linked follow-ups' })}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('details')}
                        className={`rounded-xl border px-3 py-2 text-left transition ${
                          activeTab === 'details'
                            ? 'border-sky-300 bg-sky-50 text-sky-800'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-sm font-semibold">
                          <Info size={15} />
                          {t({ it: 'Dettagli', en: 'Details' })}
                        </div>
                        <div className="text-xs opacity-80">{t({ it: 'Info meeting e partecipanti', en: 'Meeting info and participants' })}</div>
                      </button>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
                    {error ? <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
                    {aiError ? <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{aiError}</div> : null}

                    {loading ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-500">
                        {t({ it: 'Caricamento appunti…', en: 'Loading notes…' })}
                      </div>
                    ) : (
                      <>
                        {activeTab === 'manager' ? (
                          <section className="flex min-h-0 flex-1 flex-col overflow-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                            <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                              {t({ it: 'Topics and Summary', en: 'Topics and Summary' })}
                            </div>
                            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-2">
                              <label className="flex min-h-0 flex-col text-xs font-semibold text-slate-600">
                                {t({ it: 'Temi trattati', en: 'Topics discussed' })}
                                <textarea
                                  value={managerFields.topicsText}
                                  onChange={(e) => setManagerField('topicsText', e.target.value)}
                                  disabled={!canManageMeeting}
                                  rows={10}
                                  className="mt-1 h-full min-h-[460px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                />
                              </label>
                              <label className="flex min-h-0 flex-col text-xs font-semibold text-slate-600">
                                {t({ it: 'Sommario generale', en: 'General summary' })}
                                <textarea
                                  value={managerFields.summaryText}
                                  onChange={(e) => setManagerField('summaryText', e.target.value)}
                                  disabled={!canManageMeeting}
                                  rows={10}
                                  className="mt-1 h-full min-h-[460px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm leading-6 text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                />
                              </label>
                            </div>
                          </section>
                        ) : null}

                        {activeTab === 'actions' ? (
                          <section className="min-h-0 flex-1 overflow-auto rounded-2xl border border-slate-200 bg-gradient-to-br from-amber-50 to-white p-4">
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                              <table className="min-w-full border-collapse text-sm text-slate-700">
                                <thead className="bg-slate-100 text-xs uppercase tracking-[0.14em] text-slate-600">
                                  <tr>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Descrizione attività da eseguire', en: 'Task description' })}>
                                      {t({ it: 'Task', en: 'Task' })}
                                    </th>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Persona o team assegnato', en: 'Assigned owner' })}>
                                      {t({ it: 'Assegnata a', en: 'Assigned to' })}
                                    </th>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Data apertura task', en: 'Task opening date' })}>
                                      {t({ it: 'Apertura', en: 'Opening date' })}
                                    </th>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Data obiettivo chiusura task', en: 'Task target completion date' })}>
                                      {t({ it: 'Completamento', en: 'Completion date' })}
                                    </th>
                                    <th className="px-3 py-2 text-left" title={t({ it: 'Stato operativo della task', en: 'Task operational status' })}>
                                      {t({ it: 'Stato', en: 'Status' })}
                                    </th>
                                    <th className="px-3 py-2 text-center" title={t({ it: 'Azioni disponibili sulla riga', en: 'Available row actions' })}>
                                      {t({ it: 'Azioni', en: 'Actions' })}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {normalizedManagerActions.length ? (
                                    normalizedManagerActions.map((row, index) => {
                                      const progressPct = normalizeActionProgress(Number(row.progressPct || 0));
                                      const isNotNeeded = row.status === 'not_needed';
                                      const isDone = !isNotNeeded && progressPct >= 100;
                                      const rowHasPayload = !!(
                                        String(row.action || '').trim() ||
                                        String(row.assignedTo || '').trim() ||
                                        String(row.openingDate || '').trim() ||
                                        String(row.completionDate || '').trim() ||
                                        progressPct > 0 ||
                                        row.status === 'not_needed' ||
                                        row.status === 'done'
                                      );
                                      const rowNeedsTitle = rowHasPayload && !String(row.action || '').trim();
                                      const rowTone = isNotNeeded ? 'bg-slate-100' : isDone ? 'bg-emerald-50' : 'bg-amber-50';
                                      const barTone = isNotNeeded ? 'bg-slate-400' : isDone ? 'bg-emerald-500' : 'bg-amber-500';
                                      const statusLabel = isNotNeeded
                                        ? t({ it: 'Non necessaria', en: 'Not needed' })
                                        : isDone
                                          ? t({ it: 'Completata', en: 'Done' })
                                          : t({ it: 'In corso', en: 'In progress' });
                                      return (
                                        <tr
                                          key={`manager-action-${index}`}
                                          className={`border-t border-slate-200 align-top ${rowTone}`}
                                        >
                                          <td className="px-3 py-2">
                                            <input
                                              value={String(row.action || '')}
                                              onChange={(e) => setManagerActionField(index, 'action', e.target.value)}
                                              disabled={!canManageMeeting}
                                              aria-invalid={rowNeedsTitle}
                                              className={`w-full rounded-lg border bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100 ${
                                                rowNeedsTitle ? 'border-rose-300 focus:ring-rose-200' : 'border-slate-200'
                                              }`}
                                              placeholder={t({ it: 'Azione da completare', en: 'Action to complete' })}
                                              title={
                                                rowNeedsTitle
                                                  ? t({ it: 'Titolo task obbligatorio prima del salvataggio', en: 'Task title is required before saving' })
                                                  : t({ it: 'Descrizione attività', en: 'Task description' })
                                              }
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <input
                                              value={String(row.assignedTo || '')}
                                              onChange={(e) => setManagerActionField(index, 'assignedTo', e.target.value)}
                                              disabled={!canManageMeeting}
                                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                              placeholder={t({ it: 'Assegnata a (testo libero)', en: 'Assigned to (free text)' })}
                                              title={t({ it: 'Assegnatario attività', en: 'Task owner' })}
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <input
                                              type="date"
                                              value={String(row.openingDate || '')}
                                              onChange={(e) => setManagerActionField(index, 'openingDate', e.target.value)}
                                              disabled={!canManageMeeting}
                                              className="w-full min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                              title={t({ it: 'Data apertura task', en: 'Task opening date' })}
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <input
                                              type="date"
                                              value={String(row.completionDate || '')}
                                              onChange={(e) => setManagerActionField(index, 'completionDate', e.target.value)}
                                              disabled={!canManageMeeting}
                                              className="w-full min-w-[140px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                              title={t({ it: 'Data obiettivo completamento', en: 'Target completion date' })}
                                            />
                                          </td>
                                          <td className="px-3 py-2">
                                            <div className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                                                <span>{statusLabel}</span>
                                                <span>{isNotNeeded ? '—' : `${progressPct}%`}</span>
                                              </div>
                                              <div className="mt-1 h-2 rounded-full bg-slate-200" title={t({ it: 'Avanzamento task', en: 'Task progress' })}>
                                                <span className={`block h-2 rounded-full ${barTone}`} style={{ width: `${isNotNeeded ? 100 : progressPct}%` }} />
                                              </div>
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            <button
                                              type="button"
                                              onClick={() => openManageActionModal(index)}
                                              className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                                              title={t({ it: 'Gestisci avanzamento e stato task', en: 'Manage task progress and status' })}
                                            >
                                              {t({ it: 'Gestisci', en: 'Manage' })}
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  ) : (
                                    <tr>
                                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                                        {t({ it: 'Nessuna azione inserita', en: 'No actions added' })}
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                            <div className="mt-3 flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setActionsInsightsModalOpen(true)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                                title={t({
                                  it: 'Apri grafici e statistiche azioni',
                                  en: 'Open action charts and statistics'
                                })}
                              >
                                <BarChart3 size={15} />
                              </button>
                              {canManageMeeting ? (
                                <button
                                  type="button"
                                  onClick={addManagerAction}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  title={t({ it: 'Nuova azione', en: 'New action' })}
                                >
                                  <Plus size={16} />
                                </button>
                              ) : null}
                            </div>
                          </section>
                        ) : null}

                        {activeTab === 'history' ? (
                          <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
                            <div className="min-h-0 flex-1">
                              {followUpChain.length ? (
                                <div className="grid h-full min-h-0 grid-cols-[300px,minmax(0,1fr)] overflow-hidden">
                                  <aside className="flex min-h-0 flex-col border-r border-slate-200 bg-slate-50">
                                    <div className="border-b border-slate-200 px-4 py-3">
                                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        {t({ it: 'Timeline', en: 'Timeline' })}
                                      </div>
                                      <div className="mt-1 text-xs text-slate-500">
                                        {followUpChain.length} {t({ it: 'meeting collegati', en: 'linked meetings' })}
                                      </div>
                                    </div>
                                    <div className="min-h-0 space-y-2 overflow-y-auto p-3">
                                      {followUpChain.map((entry, index) => {
                                        const active = String(historySelectedMeetingId || '') === String(entry.meeting.id || '');
                                        const blinking = String(timelineBlinkMeetingId || '') === String(entry.meeting.id || '');
                                        const now = Date.now();
                                        const startAt = Number(entry.meeting.effectiveStartAt || entry.meeting.startAt || 0);
                                        const endAt = Number(entry.meeting.effectiveEndAt || entry.meeting.endAt || 0);
                                        const phase = getMeetingSchedulePhase(startAt, endAt, now);
                                        const dayLabel = formatMeetingRelativeDayLabel(startAt);
                                        const canManageEntry = canManageMeeting || entry.canManageMeeting;
                                        return (
                                          <div key={`followup-list-${String(entry.meeting.id || index)}`} className="relative">
                                            <button
                                              type="button"
                                              onClick={() => setHistorySelectedMeetingId(String(entry.meeting.id || ''))}
                                              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                                phase === 'past'
                                                  ? 'border-slate-300 bg-slate-100 text-slate-700'
                                                  : phase === 'current'
                                                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                                    : 'border-sky-300 bg-sky-50 text-sky-800'
                                              } ${active ? 'ring-2 ring-primary/40' : 'hover:opacity-90'} ${blinking ? 'animate-pulse ring-2 ring-emerald-300' : ''} ${
                                                phase === 'scheduled' && canManageEntry ? 'pr-10' : ''
                                              }`}
                                              title={new Date(Number(entry.meeting.startAt || 0)).toLocaleString()}
                                            >
                                              <div className="text-sm font-semibold">{`${new Date(Number(entry.meeting.startAt || 0)).toLocaleDateString()} (${dayLabel})`}</div>
                                              <div className="mt-1 text-xs opacity-80">
                                                {entry.meeting.roomName || '-'} • {entry.meeting.subject || t({ it: 'Riunione', en: 'Meeting' })}
                                              </div>
                                            </button>
                                            {phase === 'scheduled' && canManageEntry ? (
                                              <button
                                                type="button"
                                                onClick={(event) => {
                                                  event.preventDefault();
                                                  event.stopPropagation();
                                                  setHistorySelectedMeetingId(String(entry.meeting.id || ''));
                                                  setNoteContextMenu(null);
                                                  const triggerRect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                  setTimelineScheduleContextMenu({
                                                    meetingId: String(entry.meeting.id || ''),
                                                    x: Math.max(8, Math.min(triggerRect.right - 236, window.innerWidth - 250)),
                                                    y: Math.max(8, Math.min(triggerRect.bottom + 6, window.innerHeight - 104))
                                                  });
                                                }}
                                                className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md border border-sky-300 bg-white/80 text-sky-700 hover:bg-white"
                                                title={t({ it: 'Gestione schedulazione', en: 'Schedule management' })}
                                              >
                                                <Settings2 size={13} />
                                              </button>
                                            ) : null}
                                          </div>
                                        );
                                      })}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void scheduleFollowUp(
                                            selectedHistoryEntry?.meeting || meeting,
                                            String(selectedHistoryEntry?.managerFields?.nextMeetingDate || '').trim() || String(managerFields.nextMeetingDate || '').trim()
                                          )
                                        }
                                        disabled={managerScheduling || !canManageMeeting}
                                        className="w-full rounded-2xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-3 text-left text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-55"
                                        title={
                                          canManageMeeting
                                            ? t({ it: 'Crea un nuovo follow-up in chain', en: 'Create a new follow-up in chain' })
                                            : t({ it: 'Solo partecipanti/manager autorizzati possono creare follow-up', en: 'Only authorized participants/managers can create follow-ups' })
                                        }
                                      >
                                        <div className="inline-flex items-center gap-2 text-sm font-semibold">
                                          {managerScheduling ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                                          {t({ it: 'Create Follow-UP', en: 'Create Follow-UP' })}
                                        </div>
                                        <div className="mt-1 text-xs opacity-80">{t({ it: 'Nuova riunione della stessa chain', en: 'New meeting in the same chain' })}</div>
                                      </button>
                                    </div>
                                  </aside>

                                  <section className="min-h-0 overflow-y-auto bg-white p-4">
                                    {selectedHistoryEntry ? (
                                      (() => {
                                        const chainMeeting = selectedHistoryEntry.meeting;
                                        return (
                                          <div className="space-y-4">
                                            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4">
                                              <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div>
                                                  <div className="text-lg font-semibold text-slate-900">
                                                    {chainMeeting.subject || t({ it: 'Riunione', en: 'Meeting' })}
                                                  </div>
                                                  <div className="mt-1 text-sm text-slate-500">
                                                    {chainMeeting.roomName || '-'} • {new Date(Number(chainMeeting.startAt || 0)).toLocaleString()}
                                                  </div>
                                                </div>
                                              </div>
                                              <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                                                  {t({ it: 'Partecipanti', en: 'Participants' })}
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                  {selectedHistoryParticipants.length ? (
                                                    selectedHistoryParticipants.map((participant) => (
                                                      <span
                                                        key={participant.key}
                                                        className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] font-semibold ${
                                                          participant.checkedIn
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : 'bg-slate-100 text-slate-700'
                                                        }`}
                                                        title={
                                                          participant.checkedIn && participant.checkInAt
                                                            ? `${t({ it: 'Check-in effettuato', en: 'Checked in' })} • ${new Date(participant.checkInAt).toLocaleString()}`
                                                            : t({ it: 'Check-in non effettuato', en: 'Not checked in' })
                                                        }
                                                      >
                                                        {participant.label}
                                                      </span>
                                                    ))
                                                  ) : (
                                                    <span className="text-sm text-slate-500">{t({ it: 'Nessun partecipante disponibile', en: 'No participants available' })}</span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="grid gap-4 xl:grid-cols-2">
                                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                  {t({ it: 'Temi trattati', en: 'Topics discussed' })}
                                                </div>
                                                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                                                  {String(selectedHistoryEntry.managerFields.topicsText || '').trim() || '—'}
                                                </div>
                                              </div>
                                              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                                                  {t({ it: 'Sommario generale', en: 'General summary' })}
                                                </div>
                                                <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-800">
                                                  {String(selectedHistoryEntry.managerFields.summaryText || '').trim() || '—'}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex justify-end">
                                              <button
                                                type="button"
                                                onClick={() => setTimelineActivityModalOpen(true)}
                                                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                                title={t({ it: 'Apri time machine e log attività task', en: 'Open time machine and task activity log' })}
                                              >
                                                <History size={14} />
                                                {t({ it: 'Task Time Machine', en: 'Task Time Machine' })}
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })()
                                    ) : null}
                                  </section>
                                </div>
                              ) : (
                                <div className="flex h-full items-center justify-center p-6">
                                  <div className="w-full max-w-xl rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center">
                                    <div className="text-sm font-semibold text-slate-700">
                                      {t({ it: 'Nessuna timeline follow-up disponibile', en: 'No follow-up timeline available' })}
                                    </div>
                                    <div className="mt-2 text-sm text-slate-500">
                                      {t({
                                        it: 'Quando questo meeting avrà follow-up collegati, li troverai qui con temi, sommario e azioni condivise lungo tutta la chain.',
                                        en: 'When this meeting has linked follow-ups, you will find topics, summary and shared chain actions here.'
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </section>
                        ) : null}

                        {activeTab === 'notes' ? (
                          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[330px,minmax(0,1fr)]">
                            <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Appunti', en: 'Notes' })}</div>
                                <button
                                  type="button"
                                  onClick={requestNewNote}
                                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                                  title={t({ it: 'Crea un nuovo appunto', en: 'Create a new note' })}
                                >
                                  <Plus size={12} />
                                  {t({ it: 'Nuovo', en: 'New' })}
                                </button>
                              </div>
                              <div className="min-h-0 space-y-1 overflow-auto pr-1">
                                {notes.map((n) => {
                                  const mine = canEditNote(n);
                                  const isSelected = String(selectedId) === String(n.id);
                                  const effectiveShared = isSelected ? shared : !!n.shared;
                                  return (
                                    <button
                                      key={n.id}
                                      type="button"
                                      onClick={() => onSelect(String(n.id))}
                                      onContextMenu={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        setTimelineScheduleContextMenu(null);
                                        setNoteContextMenu({
                                          noteId: String(n.id),
                                          x: Math.min(event.clientX, window.innerWidth - 220),
                                          y: Math.min(event.clientY, window.innerHeight - 180)
                                        });
                                      }}
                                      className={`w-full rounded-lg border px-2 py-2 text-left text-xs ${
                                        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                      }`}
                                      title={t({ it: 'Tasto destro: duplica, condividi, elimina', en: 'Right click: duplicate, share, delete' })}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="truncate font-semibold">{n.title || t({ it: 'Senza titolo', en: 'Untitled' })}</div>
                                        <span
                                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                            effectiveShared ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700'
                                          }`}
                                        >
                                          {effectiveShared ? t({ it: 'Condiviso', en: 'Shared' }) : mine ? t({ it: 'Mio', en: 'Mine' }) : t({ it: 'Privato', en: 'Private' })}
                                        </span>
                                      </div>
                                      <div className="mt-0.5 truncate text-[10px] text-slate-500">{n.authorDisplayName || n.authorUsername || '-'}</div>
                                      <div className="mt-0.5 truncate text-[10px] text-slate-500">{formatStamp(Number(n.updatedAt || 0))}</div>
                                    </button>
                                  );
                                })}
                              </div>
                              {sharedOthers.length ? (
                                <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-2 py-2 text-[11px] text-violet-800">
                                  {sharedOthers.length} {t({ it: 'appunti condivisi da altri partecipanti', en: 'shared notes from other participants' })}
                                </div>
                              ) : null}
                            </aside>

                            <main className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-3">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr),auto]">
                                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                  {t({ it: 'Titolo', en: 'Title' })}
                                  <input
                                    ref={noteTitleInputRef}
                                    value={title}
                                    onChange={(e) => {
                                      setTitle(e.target.value);
                                      if (canEditSelected) setDirty(true);
                                    }}
                                    onKeyDown={(event) => {
                                      if (event.key !== 'Tab' || event.shiftKey) return;
                                      event.preventDefault();
                                      editorRef.current?.focus();
                                    }}
                                    disabled={!canEditSelected}
                                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                                    placeholder={t({ it: 'Titolo appunto', en: 'Note title' })}
                                  />
                                </label>
                                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 md:self-end">
                                  <input
                                    type="checkbox"
                                    checked={shared}
                                    disabled={!canEditSelected}
                                    onChange={(e) => {
                                      setShared(e.target.checked);
                                      if (canEditSelected) setDirty(true);
                                    }}
                                    title={t({ it: 'Attiva/disattiva condivisione appunto con i partecipanti', en: 'Enable/disable note sharing with participants' })}
                                  />
                                  <Share2 size={14} />
                                  {t({ it: 'Condividi con i partecipanti', en: 'Share with participants' })}
                                </label>
                              </div>

                              <div
                                ref={noteEditorContainerRef}
                                className="mt-2 min-h-[220px] flex-1 overflow-hidden"
                                onKeyDownCapture={(event) => {
                                  if (event.key !== 'Tab') return;
                                  if (event.shiftKey) {
                                    event.preventDefault();
                                    noteTitleInputRef.current?.focus();
                                    return;
                                  }
                                  event.preventDefault();
                                  noteSaveButtonRef.current?.focus();
                                }}
                              >
                                <LexicalNotesEditor
                                  key={`meeting-note-editor-${editorKey}-${selectedId}`}
                                  ref={editorRef}
                                  readOnly={!canEditSelected}
                                  initialStateJson={selectedNote?.contentLexical || ''}
                                  initialHtml={selectedNote?.contentHtml || ''}
                                  className="h-full"
                                  onDirtyChange={(next) => {
                                    if (!canEditSelected) return;
                                    setDirty(!!next);
                                  }}
                                />
                              </div>

                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
                                <div className="text-xs text-slate-500">
                                  {selectedNote
                                    ? `${t({ it: 'Autore', en: 'Author' })}: ${selectedNote.authorDisplayName || selectedNote.authorUsername || '-'} • ${formatStamp(
                                        Number(selectedNote.updatedAt || 0)
                                      )}`
                                    : t({ it: 'Nuovo appunto', en: 'New note' })}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    ref={noteSaveButtonRef}
                                    type="button"
                                    onClick={() => void save()}
                                    disabled={saving || !canEditSelected}
                                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
                                    title={t({
                                      it: 'Salva nota (⌘/Ctrl+S). Nuova nota: ⌘/Ctrl+N',
                                      en: 'Save note (⌘/Ctrl+S). New note: ⌘/Ctrl+N'
                                    })}
                                  >
                                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    {t({ it: 'Salva', en: 'Save' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={openTranslateLanguageModal}
                                    disabled={!!aiBusy}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    title={t({
                                      it: 'Traduce solo la selezione di testo con AI (⌘/Ctrl+Shift+T)',
                                      en: 'Translate only selected text with AI (⌘/Ctrl+Shift+T)'
                                    })}
                                  >
                                    {aiBusy === 'translate' ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
                                    {t({ it: 'Translate selection', en: 'Translate selection' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void runAiTransform('correct')}
                                    disabled={!!aiBusy}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    title={t({
                                      it: 'Corregge solo la selezione di testo con AI (⌘/Ctrl+Shift+C)',
                                      en: 'Correct only selected text with AI (⌘/Ctrl+Shift+C)'
                                    })}
                                  >
                                    {aiBusy === 'correct' ? <Loader2 size={13} className="animate-spin" /> : <SpellCheck size={13} />}
                                    {t({ it: 'Correct selection', en: 'Correct selection' })}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void exportCsv()}
                                    disabled={exporting || !meeting?.id}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    title={t({ it: 'Esporta appunti in formato CSV', en: 'Export notes as CSV' })}
                                  >
                                    <Download size={13} />
                                    {exporting ? 'CSV…' : 'CSV'}
                                  </button>
                                  {selectedNote && canEditSelected ? (
                                    <button
                                      type="button"
                                      onClick={() => void remove()}
                                      disabled={saving}
                                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                                      title={t({ it: 'Elimina appunto selezionato', en: 'Delete selected note' })}
                                    >
                                      <Trash2 size={13} />
                                      {t({ it: 'Elimina', en: 'Delete' })}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </main>
                          </div>
                        ) : null}

                        {activeTab === 'details' ? (
                          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[360px,minmax(0,1fr)]">
                            <aside className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50 p-3">
                              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <Users size={13} />
                                {t({ it: 'Partecipanti', en: 'Participants' })}
                              </div>
                              <div className="min-h-0 space-y-1 overflow-auto pr-1">
                                {participants.length ? (
                                  participants.map((p) => (
                                    <div
                                      key={p.key}
                                      className={`rounded-lg border px-2 py-1.5 text-xs ${
                                        p.hasShared ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700'
                                      }`}
                                      title={
                                        p.hasShared
                                          ? t({ it: 'Ha condiviso appunti', en: 'Has shared notes' })
                                          : t({ it: 'Nessun appunto condiviso', en: 'No shared notes' })
                                      }
                                    >
                                      <div className="truncate font-semibold">{p.label}</div>
                                      <div className="truncate text-[10px] text-slate-500">
                                        {p.department || p.email || p.company || '—'}
                                      </div>
                                      <div className="truncate text-[10px] text-slate-400">{p.email || p.company || '—'}</div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-2 py-2 text-xs text-slate-500">
                                    {t({ it: 'Nessun partecipante disponibile', en: 'No participants available' })}
                                  </div>
                                )}
                              </div>
                            </aside>
                            <section className="min-h-0 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
                              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">ID</div>
                                  <div className="text-sm font-semibold text-slate-800">#{meeting.meetingNumber || '—'}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Stato', en: 'Status' })}</div>
                                  <div className="text-sm font-semibold text-slate-800">{meeting.status}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 md:col-span-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Titolo meeting', en: 'Meeting title' })}</div>
                                  <div className="text-sm font-semibold text-slate-800">{meeting.subject || '-'}</div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Cliente/Sede/Piano', en: 'Client/Site/Floor' })}</div>
                                  <div className="text-sm text-slate-700">
                                    {selectedClient?.name || meeting.clientId} • {selectedSite?.name || meeting.siteId} • {selectedFloorPlan?.name || meeting.floorPlanId}
                                  </div>
                                </div>
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{t({ it: 'Sala e orario', en: 'Room and time' })}</div>
                                  <div className="text-sm text-slate-700">
                                    {meeting.roomName || '-'} • {new Date(Number(meeting.startAt || 0)).toLocaleString()} - {new Date(Number(meeting.endAt || 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </div>
                                </div>
                              </div>
                            </section>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3">
                    <div className="text-xs text-slate-500">
                      {managerDirty || dirty
                        ? t({ it: 'Modifiche non salvate presenti', en: 'Unsaved changes present' })
                        : t({ it: 'Nessuna modifica da salvare', en: 'No pending changes' })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={openPdfSelectionModal}
                        disabled={pdfExporting || !notes.length}
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        title={t({ it: 'Esporta PDF con selezione appunti', en: 'Export PDF with note selection' })}
                      >
                        <Download size={14} />
                        {t({ it: 'PDF', en: 'PDF' })}
                      </button>
                      <button
                        type="button"
                        onClick={requestClose}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Chiudi modale', en: 'Close modal' })}
                      >
                        {t({ it: 'Chiudi', en: 'Close' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveAll()}
                        disabled={saving || managerSaving || (!dirty && !managerDirty)}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                        title={t({ it: 'Salva tutte le modifiche delle tab', en: 'Save all tab changes' })}
                      >
                        {saving || managerSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {t({ it: 'Salva', en: 'Save' })}
                      </button>
                    </div>
                  </div>
                  {noteContextMenu && contextMenuNote ? (
                    <div
                      className="fixed z-[170] min-w-[210px] rounded-xl border border-slate-200 bg-white p-1 shadow-2xl pointer-events-auto"
                      style={{ left: noteContextMenu.x, top: noteContextMenu.y }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => void duplicateNote(contextMenuNote)}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        title={t({ it: 'Crea una copia di questo appunto', en: 'Create a copy of this note' })}
                      >
                        <Plus size={14} />
                        {t({ it: 'Duplica appunto', en: 'Duplicate note' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleShareForNote(contextMenuNote)}
                        disabled={!contextMenuCanEdit}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                        title={t({ it: 'Condividi o rimuovi condivisione appunto', en: 'Share or unshare this note' })}
                      >
                        <Share2 size={14} />
                        {contextMenuNote.shared ? t({ it: 'Rimuovi condivisione', en: 'Unshare note' }) : t({ it: 'Condividi', en: 'Share note' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNoteContextMenu(null);
                          if (String(selectedId) !== String(contextMenuNote.id)) setSelectedId(String(contextMenuNote.id));
                          if (canEditNote(contextMenuNote)) {
                            setConfirmState({ kind: 'delete' });
                          }
                        }}
                        disabled={!contextMenuCanEdit}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-45"
                        title={t({ it: 'Elimina questo appunto', en: 'Delete this note' })}
                      >
                        <Trash2 size={14} />
                        {t({ it: 'Elimina', en: 'Delete' })}
                      </button>
                    </div>
                  ) : null}

                  {timelineScheduleContextMenu && timelineScheduleContextEntry ? (
                    <div
                      ref={timelineScheduleMenuRef}
                      className="fixed z-[172] min-w-[238px] rounded-xl border border-slate-200 bg-white p-1 shadow-2xl pointer-events-auto"
                      style={{ left: timelineScheduleContextMenu.x, top: timelineScheduleContextMenu.y }}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openTimelineScheduleManagement();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        title={t({ it: 'Modifica schedulazione meeting', en: 'Edit meeting schedule' })}
                      >
                        <CalendarPlus size={14} />
                        {t({ it: 'Modifica', en: 'Edit' })}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void deleteTimelineScheduledMeeting();
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-700 hover:bg-rose-50"
                        title={t({ it: 'Elimina schedulazione meeting', en: 'Delete meeting schedule' })}
                      >
                        <Trash2 size={14} />
                        {t({ it: 'Elimina', en: 'Delete' })}
                      </button>
                    </div>
                  ) : null}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={manageActionModalIndex >= 0} as={Fragment}>
        <Dialog as="div" className="relative z-[162]" onClose={closeManageActionModal} initialFocus={actionManageDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={actionManageDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Gestione task', en: 'Task management' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">{String(managedAction?.action || '').trim() || '—'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={closeManageActionModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi gestione task', en: 'Close task management' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-4 px-4 py-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <span>{t({ it: 'Avanzamento', en: 'Progress' })}</span>
                        <span>{managedActionIsNotNeeded ? t({ it: 'Non necessaria', en: 'Not needed' }) : `${managedActionProgress}%`}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-200">
                        <span
                          className={`block h-3 rounded-full ${managedActionIsNotNeeded ? 'bg-slate-400' : managedActionProgress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                          style={{ width: `${managedActionIsNotNeeded ? 100 : managedActionProgress}%` }}
                        />
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        value={managedActionIsNotNeeded ? 0 : managedActionProgress}
                        onChange={(event) => updateManagedActionProgress(Number(event.target.value))}
                        disabled={!canManageMeeting || managedActionIsNotNeeded}
                        className="mt-3 w-full"
                        title={t({ it: 'Imposta avanzamento da 0 a 100 con step 5', en: 'Set progress from 0 to 100 in steps of 5' })}
                      />
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Scadenza', en: 'Deadline' })}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          ref={manageActionDueDateInputRef}
                          type="date"
                          value={manageActionDueDateDraft}
                          onChange={(event) => setManageActionDueDateDraft(event.target.value)}
                          disabled={!canManageMeeting}
                          className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2 disabled:bg-slate-100"
                          title={t({ it: 'Seleziona nuova data di scadenza task', en: 'Select new task deadline' })}
                        />
                        <button
                          type="button"
                          onClick={openManagedActionDatePicker}
                          disabled={!canManageMeeting}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          title={t({ it: 'Apri selettore data', en: 'Open date picker' })}
                        >
                          <CalendarPlus size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={applyManagedActionDueDate}
                          disabled={!canManageMeeting || !String(manageActionDueDateDraft || '').trim()}
                          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50"
                          title={t({ it: 'Applica nuova scadenza task', en: 'Apply new task deadline' })}
                        >
                          {t({ it: 'Prolunga scadenza', en: 'Extend deadline' })}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const baseTs = parseIsoDay(manageActionDueDateDraft || String(managedAction?.completionDate || '')) ?? Date.now();
                            setManageActionDueDateDraft(toIsoDay(baseTs + 7 * DAY_MS));
                          }}
                          disabled={!canManageMeeting}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          title={t({ it: 'Aggiungi 7 giorni alla scadenza proposta', en: 'Add 7 days to draft deadline' })}
                        >
                          +7d
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={markManagedActionAsNotNeeded}
                      disabled={!canManageMeeting}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                      title={t({ it: 'Imposta task come non necessaria', en: 'Set task as not needed' })}
                    >
                      {t({ it: 'Non necessaria', en: 'Not needed' })}
                    </button>
                    <button
                      type="button"
                      onClick={deleteManagedAction}
                      disabled={!canManageMeeting}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      title={t({ it: 'Elimina task', en: 'Delete task' })}
                    >
                      <Trash2 size={14} />
                      {t({ it: 'Elimina', en: 'Delete' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={timelineActivityModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[162]" onClose={closeTimelineActivityModal} initialFocus={timelineActivityDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={timelineActivityDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Task Time Machine', en: 'Task Time Machine' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({ it: 'Timeline meeting in alto, log attività task in basso', en: 'Meeting timeline on top, task activity log below' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeTimelineActivityModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi time machine', en: 'Close time machine' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-4 p-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Timeline meeting', en: 'Meeting timeline' })}</div>
                      <div className="overflow-x-auto">
                        <div className="relative min-w-[880px] px-6 py-6">
                          <div className="absolute left-10 right-10 top-1/2 h-[2px] -translate-y-1/2 bg-slate-300" />
                          <div className="relative flex items-center justify-between gap-6">
                            {timelineChain.length ? (
                              timelineChain.map((node) => (
                                <div key={`timeline-node-${String(node.entry.meeting.id || node.index)}`} className="relative flex min-w-[160px] flex-col items-center text-center">
                                  <span
                                    className={`z-10 h-4 w-4 rounded-full border-2 ${
                                      node.phase === 'past'
                                        ? 'border-slate-400 bg-slate-200'
                                        : node.phase === 'current'
                                          ? 'border-emerald-500 bg-emerald-200'
                                          : 'border-sky-500 bg-sky-200'
                                    }`}
                                  />
                                  <div className="mt-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                    {String(node.index + 1).padStart(2, '0')}
                                  </div>
                                  <div className="mt-1 text-xs font-semibold text-slate-700">{new Date(Number(node.entry.meeting.startAt || 0)).toLocaleDateString()}</div>
                                  <div className="text-[11px] text-slate-500">{node.phaseLabel}</div>
                                </div>
                              ))
                            ) : (
                              <div className="w-full text-center text-sm text-slate-500">{t({ it: 'Nessuna timeline disponibile', en: 'No timeline available' })}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Attività task', en: 'Task activity' })}</div>
                      <div className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
                        {timelineTaskEvents.length ? (
                          timelineTaskEvents.map((event) => (
                            <div key={event.id} className={`rounded-xl border px-3 py-2 ${event.tone}`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold">{event.taskLabel}</div>
                                <div className="text-[11px] opacity-80">{new Date(Number(event.ts || 0)).toLocaleString()}</div>
                              </div>
                              <div className="mt-1 text-xs font-semibold">{event.actionLabel}</div>
                              <div className="mt-0.5 text-[11px] opacity-80">{event.meetingLabel}</div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                            {t({ it: 'Nessuna attività task registrata', en: 'No task activity recorded' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={actionsInsightsModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[161]" onClose={closeActionsInsightsModal} initialFocus={actionInsightsDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-[1280px] rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={actionInsightsDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Grafici e statistiche task', en: 'Task charts and statistics' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">{actionInsights.total} {t({ it: 'task in analisi', en: 'tasks in analysis' })}</div>
                    </div>
                    <button
                      type="button"
                      onClick={closeActionsInsightsModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi grafici', en: 'Close charts' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1.4fr),minmax(0,1fr)]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {t({ it: 'Barre percentuali task', en: 'Task percentage bars' })}
                      </div>
                      <div className="mt-3 space-y-2">
                        {actionInsights.taskProgressBars.length ? (
                          actionInsights.taskProgressBars.map((entry) => (
                            <div key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold text-slate-700">
                                <span className="truncate">
                                  {`${String(entry.row.action || '').trim() || `${t({ it: 'Task', en: 'Task' })} ${entry.index + 1}`} (${entry.openingLabel} -> ${entry.completionLabel}, ${entry.daysLeftLabel})`}
                                </span>
                                <span>{entry.row.status === 'not_needed' ? t({ it: 'N/A', en: 'N/A' }) : `${entry.progressPct}%`}</span>
                              </div>
                              <div className="h-2 rounded-full bg-slate-200">
                                <span className={`block h-2 rounded-full ${entry.tone}`} style={{ width: `${entry.row.status === 'not_needed' ? 100 : entry.progressPct}%` }} />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500">
                            {t({ it: 'Aggiungi task per vedere i grafici', en: 'Add tasks to view charts' })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {t({ it: 'Fatte vs da fare', en: 'Done vs to-do' })}
                        </div>
                        <div className="mt-3 flex items-center gap-4">
                          <div
                            className="h-24 w-24 rounded-full border border-slate-200"
                            style={{
                              background: `conic-gradient(#16a34a 0deg ${
                                actionInsights.total ? Math.round((actionInsights.done / actionInsights.total) * 360) : 0
                              }deg, #cbd5e1 ${
                                actionInsights.total ? Math.round((actionInsights.done / actionInsights.total) * 360) : 0
                              }deg 360deg)`
                            }}
                            title={t({ it: 'Grafico torta azioni completate e rimanenti', en: 'Pie chart of completed and pending actions' })}
                          />
                          <div className="text-sm text-slate-700">
                            <div>{t({ it: 'Completate', en: 'Completed' })}: {actionInsights.done}</div>
                            <div>{t({ it: 'In corso', en: 'In progress' })}: {actionInsights.inProgress}</div>
                            <div>{t({ it: 'Non necessarie', en: 'Not needed' })}: {actionInsights.notNeeded}</div>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" title={t({ it: 'Percentuale task completate', en: 'Completed task rate' })}>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Tasso completamento', en: 'Completion rate' })}</div>
                          <div className="mt-1 text-lg font-semibold text-emerald-700">{actionInsights.completionRate}%</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" title={t({ it: 'Tempo medio tra apertura e chiusura task', en: 'Average time from opening to closure' })}>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Tempo medio', en: 'Avg resolution' })}</div>
                          <div className="mt-1 text-lg font-semibold text-slate-800">{actionInsights.avgResolutionDays || 0}d</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" title={t({ it: 'Task oltre la data prevista', en: 'Tasks overdue' })}>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'In ritardo', en: 'Overdue' })}</div>
                          <div className="mt-1 text-lg font-semibold text-rose-700">{actionInsights.overdue}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2" title={t({ it: 'Task attualmente in lavorazione', en: 'Tasks currently in progress' })}>
                          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'In corso', en: 'In progress' })}</div>
                          <div className="mt-1 text-lg font-semibold text-amber-700">{actionInsights.inProgress}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={pdfSelectionModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[160]" onClose={closePdfSelectionModal} initialFocus={pdfDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={pdfDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Esporta appunti in PDF', en: 'Export notes to PDF' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Seleziona gli appunti da includere nel PDF con logo cliente, luogo meeting, invitati e footer pagine.',
                          en: 'Select notes to include in a PDF with client logo, meeting location, invited people, and page footer.'
                        })}
                      </div>
                    </div>
                    <button
                      ref={pdfDialogCloseButtonRef}
                      type="button"
                      onClick={closePdfSelectionModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi selezione PDF', en: 'Close PDF selection' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-2 px-4 py-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t({ it: 'Nome file PDF', en: 'PDF file name' })}
                      <input
                        type="text"
                        value={pdfFileName}
                        onChange={(event) => setPdfFileName(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Meeting-nome meeting.pdf', en: 'Meeting-meeting name.pdf' })}
                        title={t({ it: 'Puoi modificare il nome del file PDF prima della creazione', en: 'You can change the PDF file name before export' })}
                      />
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next: Record<string, boolean> = {};
                          for (const note of notes) next[String(note.id)] = true;
                          setPdfSelection(next);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Seleziona tutti gli appunti', en: 'Select all notes' })}
                      >
                        {t({ it: 'Seleziona tutto', en: 'Select all' })}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfSelection({})}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Deseleziona tutti gli appunti', en: 'Clear note selection' })}
                      >
                        {t({ it: 'Deseleziona tutto', en: 'Clear all' })}
                      </button>
                      <span className="text-xs text-slate-500">
                        {selectedNotesForPdf.length}/{notes.length} {t({ it: 'appunti selezionati', en: 'notes selected' })}
                      </span>
                    </div>
                    <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-xs text-sky-800">
                      {t({
                        it: 'L’inclusione delle note degli utenti nel PDF è facoltativa: puoi anche generare il report senza note selezionate.',
                        en: 'Including user notes in the PDF is optional: you can also generate the report without selected notes.'
                      })}
                    </div>
                    <div className="max-h-[48vh] space-y-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                      {notes.map((note) => {
                        const checked = !!pdfSelection[String(note.id)];
                        return (
                          <label
                            key={`pdf-note-${note.id}`}
                            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${
                              checked ? 'border-primary bg-primary/10' : 'border-slate-200 bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) =>
                                setPdfSelection((prev) => ({
                                  ...prev,
                                  [String(note.id)]: event.target.checked
                                }))
                              }
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-slate-800">{note.title || t({ it: 'Senza titolo', en: 'Untitled' })}</span>
                              <span className="block truncate text-xs text-slate-500">
                                {note.authorDisplayName || note.authorUsername || '-'} • {formatStamp(Number(note.updatedAt || 0))}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={closePdfSelectionModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Annulla esportazione PDF', en: 'Cancel PDF export' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={openPdfReviewModal}
                      disabled={pdfExporting}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                      title={t({ it: 'Apri review del report prima della generazione PDF', en: 'Open report review before generating PDF' })}
                    >
                      <Info size={14} />
                      {t({ it: 'Rivedi report', en: 'Review report' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={pdfReviewModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[164]" onClose={closePdfReviewModal} initialFocus={pdfReviewDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={pdfReviewDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Rivedi report PDF', en: 'Review report PDF' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Controlla il contenuto del report prima della generazione.',
                          en: 'Review report content before generating the PDF.'
                        })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closePdfReviewModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi review', en: 'Close review' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-3 px-4 py-3">
                    <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-3">
                      <article
                        className="mx-auto w-full max-w-[780px] space-y-4 rounded-xl border border-slate-300 bg-white p-4 text-slate-800 shadow-sm"
                        style={{ fontFamily: '"Inter", "Helvetica Neue", Arial, sans-serif' }}
                      >
                        <section className="rounded-xl bg-blue-800 px-4 py-3 text-white">
                          <div className="text-lg font-semibold">{t({ it: 'Report meeting manager', en: 'Meeting manager report' })}</div>
                          <div className="mt-1 text-sm text-blue-100">{`${String(selectedClient?.name || meeting.clientId || '-')} • ${String(selectedSite?.name || meeting.siteId || '-')} • ${String(
                            selectedFloorPlan?.name || meeting.floorPlanId || '-'
                          )}`}</div>
                          <div className="text-sm text-blue-100">{`${String(meeting.roomName || '-')} • ${new Date(Number(meeting.startAt || 0)).toLocaleDateString()} • ${new Date(
                            Number(meeting.startAt || 0)
                          ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(Number(meeting.endAt || 0)).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}`}</div>
                          <div className="mt-1 text-sm font-semibold">{`${t({ it: 'Riunione', en: 'Meeting' })}: ${String(
                            meeting.subject || t({ it: 'Senza oggetto', en: 'Untitled' })
                          )}`}</div>
                        </section>

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Partecipanti', en: 'Participants' })}</div>
                          {invitedParticipants.length ? (
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                              {Array.from({ length: Math.max(reportParticipantsColumns.left.length, reportParticipantsColumns.right.length) }).map((_, rowIndex) => {
                                const left = reportParticipantsColumns.left[rowIndex];
                                const right = reportParticipantsColumns.right[rowIndex];
                                const renderCell = (person?: (typeof invitedParticipants)[number]) => {
                                  if (!person) return <span className="text-slate-400">—</span>;
                                  const locationLabel = person.remote ? 'remote' : 'on site';
                                  const secondary =
                                    person.kind === 'internal' ? String(person.department || '').trim() : String(person.company || '').trim();
                                  return (
                                    <span>
                                      <span className="font-semibold">{person.name}</span>
                                      <span className="text-slate-500">{` (${locationLabel})${secondary ? ` • ${secondary}` : ''}`}</span>
                                    </span>
                                  );
                                };
                                return (
                                  <div key={`pdf-preview-participants-row-${rowIndex}`} className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-sm last:border-b-0">
                                    <div className="border-r border-slate-200 px-3 py-2">{renderCell(left)}</div>
                                    <div className="px-3 py-2">{renderCell(right)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                              {t({ it: 'Nessun partecipante disponibile', en: 'No participants available' })}
                            </div>
                          )}
                        </section>

                        {String((meeting as any)?.followUpOfMeetingId || '').trim() || reportChainRows.length > 1 ? (
                          <section className="space-y-2">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Chain follow-up', en: 'Follow-up chain' })}</div>
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                              {reportChainRows.map((row) => {
                                const phaseTone =
                                  row.phase === 'past'
                                    ? 'bg-slate-100 text-slate-700'
                                    : row.phase === 'current'
                                      ? 'bg-emerald-50 text-emerald-800'
                                      : 'bg-sky-50 text-sky-800';
                                return (
                                  <div key={`pdf-preview-chain-${row.id}`} className={`grid grid-cols-[46px,120px,120px,minmax(0,1fr)] border-b border-slate-200 px-2 py-2 text-xs last:border-b-0 ${phaseTone}`}>
                                    <div className="font-semibold">{String(row.index + 1).padStart(2, '0')}</div>
                                    <div>{new Date(Number(row.entry.meeting.startAt || 0)).toLocaleDateString()}</div>
                                    <div>{row.phaseLabel}</div>
                                    <div className="truncate">{`${String(row.entry.meeting.subject || t({ it: 'Riunione', en: 'Meeting' }))} • ${String(
                                      row.entry.meeting.roomName || '-'
                                    )}`}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        ) : null}

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Temi e sommario', en: 'Topics and summary' })}</div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t({ it: 'Temi trattati', en: 'Topics discussed' })}</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{normalizePdfText(String(managerFields.topicsText || '')) || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{t({ it: 'Sommario generale', en: 'General summary' })}</div>
                            <div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-800">{normalizePdfText(String(managerFields.summaryText || '')) || '—'}</div>
                          </div>
                          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">{t({ it: 'Prossima riunione', en: 'Next meeting' })}</div>
                            <div className="mt-1 text-sm font-semibold">{`${reportNextMeeting.dateLabel} (${reportNextMeeting.dayLabel})`}</div>
                            <div className="text-sm">{reportNextMeeting.timeLabel}</div>
                            <div className="text-sm">{reportNextMeeting.roomLabel}</div>
                          </div>
                        </section>

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Azioni meeting', en: 'Meeting actions' })}</div>
                          {reportActions.length ? (
                            <div className="overflow-hidden rounded-xl border border-slate-200">
                              <div className="grid grid-cols-[34%,20%,20%,26%] bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                                <div>{t({ it: 'Task', en: 'Task' })}</div>
                                <div>{t({ it: 'Assegnata a', en: 'Assigned to' })}</div>
                                <div>{t({ it: 'Date', en: 'Dates' })}</div>
                                <div>{t({ it: 'Stato', en: 'Status' })}</div>
                              </div>
                              {reportActions.map((row, index) => {
                                const progress = normalizeActionProgress(Number(row.progressPct || 0));
                                const isNotNeeded = String(row.status || '') === 'not_needed';
                                const isDone = !isNotNeeded && progress >= 100;
                                const tone = isNotNeeded ? 'bg-slate-100' : isDone ? 'bg-emerald-50' : 'bg-amber-50';
                                const statusLabel = isNotNeeded
                                  ? `${t({ it: 'Non necessaria', en: 'Not needed' })} (N/A)`
                                  : isDone
                                    ? `${t({ it: 'Completata', en: 'Completed' })} (100%)`
                                    : `${t({ it: 'In corso', en: 'In progress' })} (${progress}%)`;
                                return (
                                  <div key={`pdf-preview-action-${index}`} className={`grid grid-cols-[34%,20%,20%,26%] border-t border-slate-200 px-3 py-2 text-xs text-slate-700 ${tone}`}>
                                    <div className="whitespace-pre-wrap break-words">{String(row.action || '').trim() || '—'}</div>
                                    <div className="whitespace-pre-wrap break-words">{String(row.assignedTo || '').trim() || '—'}</div>
                                    <div className="whitespace-pre-wrap break-words">{`${formatIsoDayLabel(String(row.openingDate || ''))} -> ${formatIsoDayLabel(String(
                                      row.completionDate || ''
                                    ))}`}</div>
                                    <div className="whitespace-pre-wrap break-words">{statusLabel}</div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                              {t({ it: 'Nessuna azione disponibile', en: 'No actions available' })}
                            </div>
                          )}
                        </section>

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Appunti selezionati', en: 'Selected notes' })}</div>
                          {selectedNotesForPdf.length ? (
                            selectedNotesForPdf.map((note, index) => (
                              <div key={`pdf-preview-note-${String(note.id || index)}`} className="rounded-xl border border-slate-200 bg-white">
                                <div className="rounded-t-xl bg-sky-100 px-3 py-2">
                                  <div className="text-sm font-semibold text-sky-800">{`${index + 1}. ${String(
                                    note.title || t({ it: 'Senza titolo', en: 'Untitled' })
                                  )}`}</div>
                                  <div className="text-xs text-sky-700">{`${note.authorDisplayName || note.authorUsername || '-'} • ${formatStamp(Number(
                                    note.updatedAt || 0
                                  ))}`}</div>
                                </div>
                                <div className="px-3 py-2 text-sm text-slate-700">
                                  <div className="whitespace-pre-wrap break-words leading-6">
                                    {normalizePdfNoteText(String(note.contentHtml || note.contentText || '').trim())}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                              {t({ it: 'Nessun appunto incluso nel report.', en: 'No notes included in the report.' })}
                            </div>
                          )}
                        </section>

                        <section className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t({ it: 'Grafici e statistiche', en: 'Charts and statistics' })}</div>
                          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                            <div className="text-sm font-semibold text-slate-700">{t({ it: 'Mix completamento', en: 'Completion mix' })}</div>
                            <div className="mt-2 h-3 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
                              <div className="flex h-full">
                                <span className="h-full bg-emerald-500" style={{ width: `${actionInsights.total ? (actionInsights.done / actionInsights.total) * 100 : 0}%` }} />
                                <span className="h-full bg-amber-500" style={{ width: `${actionInsights.total ? (actionInsights.inProgress / actionInsights.total) * 100 : 0}%` }} />
                                <span className="h-full bg-slate-400" style={{ width: `${actionInsights.total ? (actionInsights.notNeeded / actionInsights.total) * 100 : 0}%` }} />
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600 md:grid-cols-4">
                              <div>{`${t({ it: 'Completate', en: 'Completed' })}: ${actionInsights.done}`}</div>
                              <div>{`${t({ it: 'In corso', en: 'In progress' })}: ${actionInsights.inProgress}`}</div>
                              <div>{`${t({ it: 'Non necessarie', en: 'Not needed' })}: ${actionInsights.notNeeded}`}</div>
                              <div>{`${t({ it: 'In ritardo', en: 'Overdue' })}: ${actionInsights.overdue}`}</div>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Completamento', en: 'Completion' })}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-800">{actionInsights.completionRate}%</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Tempo medio', en: 'Avg resolution' })}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-800">{`${actionInsights.avgResolutionDays || 0}d`}</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Task totali', en: 'Total tasks' })}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-800">{actionInsights.total}</div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{t({ it: 'Chain', en: 'Chain' })}</div>
                              <div className="mt-1 text-lg font-semibold text-slate-800">{reportChainRows.length || 1}</div>
                            </div>
                          </div>
                        </section>
                      </article>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={closePdfReviewModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Torna alla selezione', en: 'Back to selection' })}
                    >
                      {t({ it: 'Indietro', en: 'Back' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void exportNotesPdf()}
                      disabled={pdfExporting}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                      title={t({ it: 'Genera il PDF finale', en: 'Generate final PDF' })}
                    >
                      {pdfExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      {pdfExporting ? t({ it: 'Creazione PDF…', en: 'Building PDF…' }) : t({ it: 'Genera PDF', en: 'Generate PDF' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!confirmState} as={Fragment}>
        <Dialog as="div" className="relative z-[155]" onClose={closeConfirmModal} initialFocus={confirmDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button
                    ref={confirmDialogInitialFocusRef}
                    type="button"
                    className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
                  >
                    focus-sentinel
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <Dialog.Title className="text-lg font-semibold text-ink">{confirmTitle}</Dialog.Title>
                    <button
                      type="button"
                      onClick={closeConfirmModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi dialog', en: 'Close dialog' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="px-4 py-4 text-sm text-slate-600">{confirmDescription}</div>
                  <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={closeConfirmModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Annulla e torna alla nota', en: 'Cancel and return to note' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    {confirmState?.kind !== 'delete' ? (
                      <button
                        type="button"
                        onClick={continueWithoutSaving}
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                        title={t({
                          it: 'Esci o passa alla nota selezionata senza salvare le modifiche correnti',
                          en: 'Close or switch note without saving current changes'
                        })}
                      >
                        {t({ it: 'Continua senza salvare', en: 'Continue without saving' })}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void confirmAction()}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white hover:opacity-95 ${
                        confirmState?.kind === 'delete' ? 'bg-rose-600' : 'bg-primary'
                      }`}
                      title={
                        confirmState?.kind === 'delete'
                          ? t({ it: 'Conferma eliminazione appunto', en: 'Confirm note deletion' })
                          : t({ it: 'Salva modifiche e continua', en: 'Save changes and continue' })
                      }
                    >
                      {confirmState?.kind === 'delete' ? t({ it: 'Elimina', en: 'Delete' }) : t({ it: 'Salva', en: 'Save' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={translateLanguageModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[145]" onClose={closeTranslateLanguageModal} initialFocus={translateDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={translateDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {t({ it: 'Seleziona lingua di traduzione', en: 'Select translation language' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({
                          it: 'Scegli una lingua tra le più usate al mondo e Italiano.',
                          en: 'Choose one language among the most used worldwide and Italian.'
                        })}
                      </div>
                    </div>
                    <button
                      ref={translateDialogCloseButtonRef}
                      type="button"
                      onClick={closeTranslateLanguageModal}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi selezione lingua', en: 'Close language selector' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2">
                    {TRANSLATE_LANGUAGE_OPTIONS.map((option) => {
                      const active = translateLanguageCode === option.code;
                      return (
                        <button
                          key={`translate-lang-${option.code}`}
                          type="button"
                          onClick={() => setTranslateLanguageCode(option.code)}
                          className={`flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${
                            active
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                          title={t({ it: `Traduci in ${option.label}`, en: `Translate to ${option.label}` })}
                        >
                          <span className="text-xl leading-none">{option.flag}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{option.label}</span>
                            <span className="block truncate text-xs opacity-80">{option.native}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      type="button"
                      onClick={closeTranslateLanguageModal}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Annulla selezione lingua', en: 'Cancel language selection' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmTranslateLanguage()}
                      disabled={!!aiBusy}
                      className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                      title={t({ it: 'Conferma lingua e avvia traduzione', en: 'Confirm language and start translation' })}
                    >
                      {aiBusy === 'translate' ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />}
                      {t({ it: 'Traduci', en: 'Translate' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!aiPreview} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[150]"
          onClose={closeAiPreview}
          initialFocus={aiDialogInitialFocusRef}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto p-4">
            <div className="flex min-h-full items-center justify-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-150"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-100"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <button ref={aiDialogInitialFocusRef} type="button" className="sr-only" tabIndex={0}>
                    focus
                  </button>
                  <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
                    <div>
                      <Dialog.Title className="text-lg font-semibold text-ink">
                        {aiPreview?.mode === 'translate'
                          ? t({ it: 'Anteprima traduzione selezione', en: 'Selection translation preview' })
                          : t({ it: 'Anteprima correzione selezione', en: 'Selection correction preview' })}
                      </Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {aiPreview?.mode === 'translate' && aiPreview.targetLanguage
                          ? t({ it: `Lingua: ${aiPreview.targetLanguage}`, en: `Language: ${aiPreview.targetLanguage}` })
                          : t({ it: 'Controlla il risultato prima di applicarlo', en: 'Review the result before applying' })}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={closeAiPreview}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink"
                      title={t({ it: 'Chiudi anteprima AI', en: 'Close AI preview' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-4">
                    <textarea
                      value={String(aiDraftText || aiPreview?.transformedText || '')}
                      onChange={(e) => setAiDraftText(e.target.value)}
                      rows={14}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
                    <button
                      ref={aiDialogCloseButtonRef}
                      type="button"
                      onClick={closeAiPreview}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      title={t({ it: 'Chiudi senza applicare', en: 'Close without applying changes' })}
                    >
                      {t({ it: 'Annulla', en: 'Cancel' })}
                    </button>
                    {canEditSelected ? (
                      <button
                        type="button"
                        onClick={(e) => applyAiPreviewToNote(e)}
                        disabled={saving || !String(aiDraftText || aiPreview?.transformedText || '').trim()}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-50"
                        title={t({
                          it: 'Sostituisci solo il testo selezionato con questa anteprima',
                          en: 'Replace only selected text with this preview'
                        })}
                      >
                        <Save size={14} />
                        {t({ it: 'Sostituisci testo selezionato', en: 'Replace selected text' })}
                      </button>
                    ) : null}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      <Transition show={!!aiBusy && !aiPreview} as={Fragment}>
        <Dialog as="div" className="relative z-[165]" onClose={() => {}} initialFocus={aiBusyDialogInitialFocusRef}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-150"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/55 backdrop-blur-sm" />
          </Transition.Child>
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-6 text-center shadow-2xl">
                <button
                  ref={aiBusyDialogInitialFocusRef}
                  type="button"
                  className="absolute -left-[9999px] h-px w-px overflow-hidden opacity-0"
                >
                  focus-sentinel
                </button>
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 size={22} className="animate-spin" />
                </div>
                <Dialog.Title className="mt-3 text-base font-semibold text-ink">
                  {aiBusy === 'translate'
                    ? t({ it: 'Traduzione selezione in corso', en: 'Selection translation in progress' })
                    : t({ it: 'Correzione selezione in corso', en: 'Selection correction in progress' })}
                </Dialog.Title>
                <div className="mt-1 text-sm text-slate-500">
                  {aiBusy === 'translate'
                    ? t({
                        it: 'Stiamo traducendo la selezione. Attendi qualche secondo…',
                        en: 'We are translating the selection. Please wait a few seconds…'
                      })
                    : t({
                        it: 'Stiamo correggendo la selezione. Attendi qualche secondo…',
                        en: 'We are correcting the selection. Please wait a few seconds…'
                      })}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default MeetingNotesModal;
