import { Dialog, Transition } from '@headlessui/react';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { Fragment } from 'react';
import { CalendarPlus, Download, Loader2, Plus, Save, Share2, Trash2, X } from 'lucide-react';
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
import { type LexicalNotesEditorHandle } from '../ui/notes/LexicalNotesEditor';
import { useToastStore } from '../../store/useToast';
import {
  stripHtml,
  DAY_MS,
  parseIsoDay,
  toIsoDay,
  getDayOffsetFromToday,
  buildCheckInKeyForParticipant,
  normalizeActionProgress,
  computeActionInsights,
  NEW_NOTE_ID,
  toCompanyKey,
  TRANSLATE_LANGUAGE_OPTIONS
} from './MeetingNotesModal.helpers';
import { MeetingNotesTranslateLanguageModal } from './MeetingNotesTranslateLanguageModal';
import { MeetingNotesTimelineActivityModal } from './MeetingNotesTimelineActivityModal';
import { MeetingNotesActionsInsightsModal } from './MeetingNotesActionsInsightsModal';
import { MeetingNotesConfirmModal } from './MeetingNotesConfirmModal';
import { MeetingNotesPdfSelectionModal } from './MeetingNotesPdfSelectionModal';
import { MeetingNotesPdfReviewModal } from './MeetingNotesPdfReviewModal';
import { MeetingNotesAiPreviewModal } from './MeetingNotesAiPreviewModal';
import { MeetingNotesAiBusyModal } from './MeetingNotesAiBusyModal';
import { MeetingNotesManageActionModal } from './MeetingNotesManageActionModal';
import { MeetingNotesActionsTab } from './MeetingNotesActionsTab';
import { MeetingNotesHistoryTab } from './MeetingNotesHistoryTab';
import { MeetingNotesNotesTab } from './MeetingNotesNotesTab';
import { MeetingNotesDetailsTab } from './MeetingNotesDetailsTab';
import { exportMeetingNotesPdf } from './MeetingNotesPdfExport';
import { MeetingNotesTabBar } from './MeetingNotesTabBar';
import { MeetingNotesManagerTab } from './MeetingNotesManagerTab';

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

  const actionInsights = useMemo(() => computeActionInsights(normalizedManagerActions, t), [normalizedManagerActions]);

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

  const exportNotesPdf = async () =>
    exportMeetingNotesPdf({ meeting, managerFields, selectedNotesForPdf, invitedParticipants, followUpChain, reportActions, reportNextMeeting, actionInsights, selectedClient, selectedSite, selectedFloorPlan, pdfFileName, push, t, setPdfExporting, setPdfReviewModalOpen, setPdfSelectionModalOpen, setError });

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

                  <MeetingNotesTabBar {...{ activeTab, setActiveTab, followUpChain, t }} />

                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
                    {error ? <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
                    {aiError ? <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">{aiError}</div> : null}

                    {loading ? (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-500">
                        {t({ it: 'Caricamento appunti…', en: 'Loading notes…' })}
                      </div>
                    ) : (
                      <>
                        {activeTab === 'manager' ? <MeetingNotesManagerTab {...{ managerFields, setManagerField, canManageMeeting, t }} /> : null}

                        {activeTab === 'actions' ? <MeetingNotesActionsTab {...{ normalizedManagerActions, setManagerActionField, canManageMeeting, openManageActionModal, setActionsInsightsModalOpen, addManagerAction, t }} /> : null}

                        {activeTab === 'history' ? <MeetingNotesHistoryTab {...{ followUpChain, historySelectedMeetingId, timelineBlinkMeetingId, canManageMeeting, scheduleFollowUp, selectedHistoryEntry, meeting, managerFields, managerScheduling, selectedHistoryParticipants, formatMeetingRelativeDayLabel, setHistorySelectedMeetingId, setNoteContextMenu, setTimelineScheduleContextMenu, setTimelineActivityModalOpen, t }} /> : null}

                        {activeTab === 'notes' ? <MeetingNotesNotesTab {...{ notes, canEditNote, selectedId, shared, setShared, requestNewNote, onSelect, setTimelineScheduleContextMenu, setNoteContextMenu, sharedOthers, noteTitleInputRef, title, setTitle, canEditSelected, setDirty, editorRef, noteEditorContainerRef, editorKey, selectedNote, noteSaveButtonRef, save, saving, openTranslateLanguageModal, aiBusy, runAiTransform, exportCsv, exporting, meeting, remove, t }} /> : null}

                        {activeTab === 'details' ? <MeetingNotesDetailsTab {...{ participants, meeting, selectedClient, selectedSite, selectedFloorPlan, t }} /> : null}
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

      <MeetingNotesManageActionModal {...{ manageActionModalIndex, closeManageActionModal, actionManageDialogInitialFocusRef, managedAction, managedActionIsNotNeeded, managedActionProgress, updateManagedActionProgress, canManageMeeting, manageActionDueDateInputRef, manageActionDueDateDraft, setManageActionDueDateDraft, openManagedActionDatePicker, applyManagedActionDueDate, markManagedActionAsNotNeeded, deleteManagedAction, t }} />

      <MeetingNotesTimelineActivityModal {...{ timelineActivityModalOpen, closeTimelineActivityModal, timelineActivityDialogInitialFocusRef, timelineChain, timelineTaskEvents, t }} />

      <MeetingNotesActionsInsightsModal {...{ actionsInsightsModalOpen, closeActionsInsightsModal, actionInsightsDialogInitialFocusRef, actionInsights, t }} />

      <MeetingNotesPdfSelectionModal {...{ pdfSelectionModalOpen, closePdfSelectionModal, pdfDialogInitialFocusRef, pdfDialogCloseButtonRef, pdfFileName, setPdfFileName, notes, pdfSelection, setPdfSelection, selectedNotesForPdf, openPdfReviewModal, pdfExporting, t }} />

      <MeetingNotesPdfReviewModal {...{ pdfReviewModalOpen, closePdfReviewModal, pdfReviewDialogInitialFocusRef, selectedClient, selectedSite, selectedFloorPlan, meeting, invitedParticipants, reportParticipantsColumns, reportChainRows, managerFields, reportNextMeeting, reportActions, selectedNotesForPdf, actionInsights, exportNotesPdf, pdfExporting, t }} />

      <MeetingNotesConfirmModal {...{ confirmState, closeConfirmModal, confirmDialogInitialFocusRef, confirmTitle, confirmDescription, continueWithoutSaving, confirmAction, t }} />

      <MeetingNotesTranslateLanguageModal {...{ translateLanguageModalOpen, closeTranslateLanguageModal, translateDialogInitialFocusRef, translateDialogCloseButtonRef, translateLanguageCode, setTranslateLanguageCode, confirmTranslateLanguage, aiBusy, t }} />

      <MeetingNotesAiPreviewModal {...{ aiPreview, closeAiPreview, aiDialogInitialFocusRef, aiDialogCloseButtonRef, aiDraftText, setAiDraftText, canEditSelected, applyAiPreviewToNote, saving, t }} />

      <MeetingNotesAiBusyModal {...{ aiBusy, aiPreview, aiBusyDialogInitialFocusRef, t }} />
    </>
  );
};

export default MeetingNotesModal;
