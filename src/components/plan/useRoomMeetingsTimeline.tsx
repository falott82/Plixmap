import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { currentLocalIsoDay } from '../../utils/localDate';
import {
  meetingIsoDayFromTs,
  meetingClockFromTs,
  monthAnchorFromIso,
  toLocalHmFromTs,
  hmToMinutes,
  minutesToHm,
  localTsFromIsoHm
} from './planViewTime';
import type { Client, FloorPlan, Site } from '../../store/types';
import type { ToastTone } from '../../store/useToast';
import type { useT } from '../../i18n/useT';
import { listExternalUsers } from '../../api/customImport';
import {
  cancelMeeting,
  createMeeting,
  fetchMeetings,
  fetchMeetingOverview,
  updateMeeting,
  type MeetingBooking,
  type MeetingParticipant,
  type MeetingCheckInMapByMeetingId,
  type MeetingCheckInTimestampsByMeetingId
} from '../../api/meetings';
import {
  meetingCheckInEntryKey,
  getMeetingCheckInStats,
  resolveRoomDuplicateSlot,
  getRoomMeetingExtendMaxEndTs
} from './useRoomMeetingsTimeline.helpers';
import type { RoomMeetingDuplicateModalState } from './RoomMeetingDuplicateModal';
import { nanoid } from 'nanoid';

export type MyMeetingsModalState = {
  loading: boolean;
  error: string | null;
  now: number;
  meetings: MeetingBooking[];
  counts: { total: number; inProgress: number; upcoming: number; past: number };
  returnToHub?: boolean;
};

type SiteMeetingParticipantCandidate = {
  externalId: string;
  fullName: string;
  email: string | null;
  department?: string | null;
  phone?: string | null;
};

export type UseRoomMeetingsTimelineDeps = {
  t: ReturnType<typeof useT>;
  push: (message: string, tone?: ToastTone) => void;
  plan: FloorPlan | undefined;
  client: Client | undefined;
  site: Site | undefined;
  planId: string;
  siteMeetingParticipantCandidates: SiteMeetingParticipantCandidate[];
  myMeetingsModal: MyMeetingsModalState | null;
  setMyMeetingsModal: Dispatch<SetStateAction<MyMeetingsModalState | null>>;
  myMeetingsRestoreRef: RefObject<MyMeetingsModalState | null>;
  reloadMyMeetingsRef: RefObject<null | (() => Promise<void>)>;
};

export function useRoomMeetingsTimeline(deps: UseRoomMeetingsTimelineDeps) {
  const {
    t,
    push,
    plan,
    client,
    site,
    planId,
    siteMeetingParticipantCandidates,
    myMeetingsModal,
    setMyMeetingsModal,
    myMeetingsRestoreRef,
    reloadMyMeetingsRef
  } = deps;

  const [roomMeetingsTimelineModal, setRoomMeetingsTimelineModal] = useState<null | {
    roomId: string;
    roomName: string;
    day: string;
    loading: boolean;
    error: string | null;
    capacity: number;
    bookings: MeetingBooking[];
    checkInStatusByMeetingId: MeetingCheckInMapByMeetingId;
    checkInTimestampsByMeetingId: MeetingCheckInTimestampsByMeetingId;
  }>(null);
  const [roomMeetingsTimelineSearchTerm, setRoomMeetingsTimelineSearchTerm] = useState('');
  const [roomMeetingsTimelineSearchLoading, setRoomMeetingsTimelineSearchLoading] = useState(false);
  const [roomMeetingsTimelineSearchError, setRoomMeetingsTimelineSearchError] = useState<string | null>(null);
  const [roomMeetingsTimelineSearchResults, setRoomMeetingsTimelineSearchResults] = useState<
    Array<{
      booking: MeetingBooking;
      dayIso: string;
      participantsCount: number;
      participantsLabel: string;
    }>
  >([]);
  const [roomMeetingsTimelineSearchActiveIndex, setRoomMeetingsTimelineSearchActiveIndex] = useState(-1);
  const [roomMeetingsTimelineHighlightBookingId, setRoomMeetingsTimelineHighlightBookingId] = useState<string | null>(null);
  type MeetingNotesModalTab = 'manager' | 'actions' | 'history' | 'notes' | 'details';
  type MeetingNotesReturnState = {
    initialTab?: MeetingNotesModalTab;
    historyMeetingId?: string;
    highlightHistoryMeetingId?: string;
  };
  const [roomMeetingsTimelineBookingDetail, setRoomMeetingsTimelineBookingDetail] = useState<null | {
    booking: MeetingBooking;
    mode: 'view' | 'edit';
    subject: string;
    day: string;
    startTime: string;
    endTime: string;
    notes: string;
    videoConferenceLink: string;
    kioskLanguage: 'auto' | 'it' | 'en' | 'ru' | 'ar' | 'zh';
    setupBufferBeforeMin: number;
    setupBufferAfterMin: number;
    participantFilter: string;
    manualParticipantName: string;
    manualParticipantCompany: string;
    manualParticipantEmail: string;
    manualParticipantOptional: boolean;
    manualParticipantRemote: boolean;
    participantsDraft: Array<
      MeetingParticipant & {
        key: string;
        fullName: string;
        kind: 'real_user' | 'manual';
      }
    >;
    applyToSeries: boolean;
    returnToMyMeetings?: boolean;
    returnToMeetingNotes?: boolean;
    returnToMeetingNotesInitialTab?: MeetingNotesModalTab;
    returnToMeetingNotesHistoryMeetingId?: string;
    returnToMeetingNotesHighlightMeetingId?: string;
    saving: boolean;
    deleting: boolean;
    error: string | null;
  }>(null);
  const [roomMeetingEditExternalCandidates, setRoomMeetingEditExternalCandidates] = useState<
    Array<{ externalId: string; fullName: string; email: string | null; department?: string | null; phone?: string | null }>
  >([]);
  const [roomMeetingEditManualCompanyIsOther, setRoomMeetingEditManualCompanyIsOther] = useState(false);
  const [roomMeetingEditBusinessPartnersModalOpen, setRoomMeetingEditBusinessPartnersModalOpen] = useState(false);
  const [roomMeetingEditParticipantsModalOpen, setRoomMeetingEditParticipantsModalOpen] = useState(false);
  const [roomMeetingCheckInListOpen, setRoomMeetingCheckInListOpen] = useState(false);
  const [roomMeetingNotesModalBooking, setRoomMeetingNotesModalBooking] = useState<MeetingBooking | null>(null);
  const [roomMeetingNotesModalState, setRoomMeetingNotesModalState] = useState<MeetingNotesReturnState | null>(null);
  const [roomMeetingNotesReturnToMyMeetings, setRoomMeetingNotesReturnToMyMeetings] = useState(false);
  const [roomMeetingTimelineContextMenu, setRoomMeetingTimelineContextMenu] = useState<null | {
    x: number;
    y: number;
    booking: MeetingBooking;
  }>(null);
  const [roomMeetingExtendBusyId, setRoomMeetingExtendBusyId] = useState<string | null>(null);
  const [roomMeetingDeleteModal, setRoomMeetingDeleteModal] = useState<null | {
    booking: MeetingBooking;
    deleting: boolean;
    error: string | null;
  }>(null);
  const [roomMeetingDuplicateModal, setRoomMeetingDuplicateModal] = useState<RoomMeetingDuplicateModalState | null>(null);
  const [roomMeetingDuplicateRoomPickerOpen, setRoomMeetingDuplicateRoomPickerOpen] = useState(false);
  const roomMeetingDuplicateRoomPickerRef = useRef<HTMLDivElement | null>(null);
  const roomMeetingDetailFocusRef = useRef<HTMLButtonElement | null>(null);
  const roomMeetingsTimelineSearchInputRef = useRef<HTMLInputElement | null>(null);
  const roomMeetingTimelineContextMenuRef = useRef<HTMLDivElement | null>(null);
  const roomMeetingsTimelineDetailCloseGuardUntilRef = useRef(0);
  const roomMeetingEditParticipantsCloseGuardUntilRef = useRef(0);
  const roomMeetingEditParticipantsNameInputRef = useRef<HTMLInputElement | null>(null);
  const roomMeetingsTimelineScrollRef = useRef<HTMLDivElement | null>(null);

  const roomMeetingEditParticipantCandidates = useMemo(() => {
    const byExternalId = new Map<
      string,
      {
        externalId: string;
        fullName: string;
        email: string | null;
        department?: string | null;
        phone?: string | null;
      }
    >();
    for (const row of siteMeetingParticipantCandidates) byExternalId.set(String(row.externalId), row);
    for (const row of roomMeetingEditExternalCandidates) {
      const id = String(row.externalId || '').trim();
      if (!id) continue;
        byExternalId.set(id, {
          externalId: id,
          fullName: String(row.fullName || '').trim() || id,
          email: row.email ? String(row.email) : null,
          department: row.department ? String(row.department) : null,
          phone: row.phone ? String(row.phone) : null
        });
      }
    return [...byExternalId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' }));
  }, [roomMeetingEditExternalCandidates, siteMeetingParticipantCandidates]);

  useEffect(() => {
    let cancelled = false;
    const cid = String(client?.id || '').trim();
    if (!cid || !roomMeetingsTimelineBookingDetail || roomMeetingsTimelineBookingDetail.mode !== 'edit') return;
    listExternalUsers({ clientId: cid, includeHidden: false, includeMissing: true, limit: 5000 })
      .then((resp) => {
        if (cancelled) return;
        const rows = Array.isArray(resp?.rows) ? resp.rows : [];
        setRoomMeetingEditExternalCandidates(
          rows.map((u) => ({
            externalId: String(u.externalId || '').trim(),
            fullName: `${String(u.firstName || '').trim()} ${String(u.lastName || '').trim()}`.trim() || String(u.externalId || '').trim(),
            email: String(u.email || '').trim() || null,
            department:
              String(u.dept1 || '').trim() || String(u.dept2 || '').trim() || String(u.dept3 || '').trim() || null,
            phone:
              String(u.ext1 || '').trim() ||
              String(u.ext2 || '').trim() ||
              String(u.ext3 || '').trim() ||
              String(u.mobile || '').trim() ||
              null
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setRoomMeetingEditExternalCandidates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [client?.id, roomMeetingsTimelineBookingDetail?.mode]);

  const reloadRoomMeetingsTimeline = useCallback(
    async (roomId: string, day: string) => {
      const cid = String(client?.id || '').trim();
      const sid = String(site?.id || '').trim();
      if (!cid || !sid || !roomId) return;
      setRoomMeetingsTimelineModal((prev) =>
        prev && prev.roomId === roomId ? { ...prev, day, loading: true, error: null } : prev
      );
      try {
        const payload = await fetchMeetingOverview({ clientId: cid, siteId: sid, floorPlanId: planId, day });
        const row = (payload.rooms || []).find((r) => String(r.roomId) === String(roomId));
        if (!row) {
          setRoomMeetingsTimelineModal((prev) =>
            prev && prev.roomId === roomId
              ? {
                  ...prev,
                  day,
                  loading: false,
                  error: t({ it: 'Stanza non trovata nella timeline.', en: 'Room not found in timeline.' }),
                  bookings: [],
                  checkInStatusByMeetingId: {},
                  checkInTimestampsByMeetingId: {}
                }
              : prev
          );
          return;
        }
        setRoomMeetingsTimelineModal((prev) =>
          prev && prev.roomId === roomId
            ? {
                ...prev,
                roomName: row.roomName || prev.roomName,
                capacity: Number(row.capacity) || 0,
                day,
                loading: false,
                error: null,
                bookings: [...(row.bookings || [])].sort((a, b) => Number(a.startAt) - Number(b.startAt)),
                checkInStatusByMeetingId: payload.checkInStatusByMeetingId || {},
                checkInTimestampsByMeetingId: payload.checkInTimestampsByMeetingId || {}
              }
            : prev
        );
      } catch {
        setRoomMeetingsTimelineModal((prev) =>
          prev && prev.roomId === roomId
            ? { ...prev, day, loading: false, error: t({ it: 'Errore caricamento timeline meeting.', en: 'Failed to load meeting timeline.' }) }
            : prev
        );
      }
    },
    [client?.id, planId, site?.id, t]
  );

  const openRoomMeetingsTimeline = useCallback(
    (roomId: string) => {
      const room = (((plan as any)?.rooms || []) as any[]).find((r) => String(r?.id || '') === String(roomId));
      const day = currentLocalIsoDay();
      setRoomMeetingsTimelineModal({
        roomId,
        roomName: String(room?.name || t({ it: 'Meeting room', en: 'Meeting room' })),
        day,
        loading: true,
        error: null,
        capacity: Number(room?.capacity) || 0,
        bookings: [],
        checkInStatusByMeetingId: {}
        ,
        checkInTimestampsByMeetingId: {}
      });
      setRoomMeetingsTimelineSearchTerm('');
      setRoomMeetingsTimelineSearchResults([]);
      setRoomMeetingsTimelineSearchActiveIndex(-1);
      setRoomMeetingsTimelineSearchError(null);
      setRoomMeetingsTimelineSearchLoading(false);
      setRoomMeetingsTimelineHighlightBookingId(null);
      void reloadRoomMeetingsTimeline(roomId, day);
    },
    [plan, reloadRoomMeetingsTimeline, t]
  );

  const closeRoomMeetingsTimelineModal = useCallback(() => {
    setRoomMeetingsTimelineModal(null);
    setRoomMeetingsTimelineSearchTerm('');
    setRoomMeetingsTimelineSearchResults([]);
    setRoomMeetingsTimelineSearchActiveIndex(-1);
    setRoomMeetingsTimelineSearchError(null);
    setRoomMeetingsTimelineSearchLoading(false);
    setRoomMeetingsTimelineHighlightBookingId(null);
  }, []);

  useEffect(() => {
    if (!roomMeetingDuplicateRoomPickerOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!roomMeetingDuplicateRoomPickerRef.current) return;
      if (roomMeetingDuplicateRoomPickerRef.current.contains(event.target as Node)) return;
      setRoomMeetingDuplicateRoomPickerOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [roomMeetingDuplicateRoomPickerOpen]);

  useEffect(() => {
    if (!roomMeetingDuplicateModal || roomMeetingDuplicateModal.step !== 'setup') {
      setRoomMeetingDuplicateRoomPickerOpen(false);
    }
  }, [roomMeetingDuplicateModal?.step, roomMeetingDuplicateModal?.booking?.id]);

  useEffect(() => {
    const modal = roomMeetingsTimelineModal;
    if (!modal?.roomId) return;
    const timer = window.setInterval(() => {
      void reloadRoomMeetingsTimeline(modal.roomId, modal.day);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [reloadRoomMeetingsTimeline, roomMeetingsTimelineModal?.day, roomMeetingsTimelineModal?.roomId]);


  useEffect(() => {
    const modal = roomMeetingsTimelineModal;
    const resetSearchStateIfNeeded = () => {
      if (
        !roomMeetingsTimelineSearchLoading &&
        roomMeetingsTimelineSearchResults.length === 0 &&
        roomMeetingsTimelineSearchActiveIndex === -1 &&
        roomMeetingsTimelineSearchError === null
      ) {
        return;
      }
      if (roomMeetingsTimelineSearchLoading) setRoomMeetingsTimelineSearchLoading(false);
      if (roomMeetingsTimelineSearchResults.length) setRoomMeetingsTimelineSearchResults([]);
      if (roomMeetingsTimelineSearchActiveIndex !== -1) setRoomMeetingsTimelineSearchActiveIndex(-1);
      if (roomMeetingsTimelineSearchError !== null) setRoomMeetingsTimelineSearchError(null);
    };
    if (!modal?.roomId) {
      resetSearchStateIfNeeded();
      return;
    }
    const term = String(roomMeetingsTimelineSearchTerm || '').trim();
    if (!term) {
      resetSearchStateIfNeeded();
      return;
    }
    let cancelled = false;
    if (!roomMeetingsTimelineSearchLoading) setRoomMeetingsTimelineSearchLoading(true);
    if (roomMeetingsTimelineSearchError !== null) setRoomMeetingsTimelineSearchError(null);
    const timer = window.setTimeout(async () => {
      try {
        const now = Date.now();
        const response = await fetchMeetings({
          roomId: modal.roomId,
          fromAt: now - 365 * 24 * 60 * 60 * 1000,
          toAt: now + 365 * 24 * 60 * 60 * 1000
        });
        if (cancelled) return;
        const normalized = term.toLowerCase();
        const normalizedDigits = normalized.replace(/\D+/g, '');
        const matches = (response?.meetings || [])
          .filter((booking) => {
            const subject = String(booking.subject || '').toLowerCase();
            const meetingNumber = Number((booking as any)?.meetingNumber || 0);
            const meetingNumberText = meetingNumber > 0 ? String(meetingNumber) : '';
            const matchById =
              !!meetingNumberText && (meetingNumberText.includes(normalized) || (!!normalizedDigits && meetingNumberText.includes(normalizedDigits)));
            return subject.includes(normalized) || matchById;
          })
          .sort((a, b) => Number(b.startAt || 0) - Number(a.startAt || 0))
          .slice(0, 40)
          .map((booking) => {
            const participantNames = Array.from(
              new Set(
                [
                  ...(Array.isArray(booking.participants)
                    ? booking.participants.map((p: any) => String(p?.fullName || p?.externalId || '').trim()).filter(Boolean)
                    : []),
                  ...(Array.isArray((booking as any)?.externalGuestsDetails)
                    ? (booking as any).externalGuestsDetails.map((g: any) => String(g?.name || '').trim()).filter(Boolean)
                    : [])
                ].filter(Boolean)
              )
            );
            const participantsCount = participantNames.length;
            const participantsLabel =
              participantsCount === 0
                ? t({ it: 'Nessun partecipante', en: 'No participants' })
                : participantsCount <= 3
                  ? participantNames.join(', ')
                  : `${participantNames.slice(0, 3).join(', ')} +${participantsCount - 3}`;
            const dayIso = String((booking as any)?.occurrenceDate || '').trim() || meetingIsoDayFromTs(Number(booking.startAt || 0));
            return { booking, dayIso, participantsCount, participantsLabel };
          });
        setRoomMeetingsTimelineSearchResults(matches);
        setRoomMeetingsTimelineSearchActiveIndex(matches.length ? 0 : -1);
      } catch {
        if (cancelled) return;
        setRoomMeetingsTimelineSearchResults([]);
        setRoomMeetingsTimelineSearchActiveIndex(-1);
        setRoomMeetingsTimelineSearchError(t({ it: 'Errore ricerca meeting.', en: 'Meeting search failed.' }));
      } finally {
        if (!cancelled) {
          setRoomMeetingsTimelineSearchLoading(false);
        }
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    meetingIsoDayFromTs,
    roomMeetingsTimelineModal?.roomId,
    roomMeetingsTimelineSearchTerm,
    roomMeetingsTimelineSearchLoading,
    roomMeetingsTimelineSearchResults.length,
    roomMeetingsTimelineSearchActiveIndex,
    roomMeetingsTimelineSearchError,
    t
  ]);

  const jumpToTimelineMeetingFromSearch = useCallback(
    (result: { booking: MeetingBooking; dayIso: string }) => {
      const roomId = String(roomMeetingsTimelineModal?.roomId || '').trim();
      if (!roomId) return;
      const targetDay = String(result.dayIso || '').trim() || meetingIsoDayFromTs(Number(result.booking.startAt || 0));
      setRoomMeetingsTimelineSearchTerm('');
      setRoomMeetingsTimelineSearchResults([]);
      setRoomMeetingsTimelineSearchActiveIndex(-1);
      setRoomMeetingsTimelineSearchError(null);
      setRoomMeetingsTimelineHighlightBookingId(String(result.booking.id || ''));
      setRoomMeetingsTimelineModal((prev) => (prev ? { ...prev, day: targetDay } : prev));
      void reloadRoomMeetingsTimeline(roomId, targetDay);
    },
    [meetingIsoDayFromTs, reloadRoomMeetingsTimeline, roomMeetingsTimelineModal?.roomId]
  );


  const getRoomMeetingCheckInEntries = useCallback(
    (booking: MeetingBooking, checkMap?: Record<string, true> | null, tsMap?: Record<string, number> | null) => {
      const checked = checkMap || {};
      const timestamps = tsMap || {};
      const clientLogo = String((client as any)?.logoUrl || '').trim() || null;
      const businessPartners = Array.isArray((client as any)?.businessPartners) ? ((client as any).businessPartners as any[]) : [];
      const businessPartnerByName = new Map<string, any>();
      for (const bp of businessPartners) {
        const key = String(bp?.name || '').trim().toLowerCase();
        if (!key) continue;
        businessPartnerByName.set(key, bp);
      }
      const participants = Array.isArray(booking?.participants) ? booking.participants : [];

      const internal = participants
        .filter((p: any) => (p?.kind || 'real_user') !== 'manual' && !p?.remote)
        .map((p: any) => {
          const label = String(p?.fullName || p?.externalId || '-').trim() || '-';
          const email = p?.email ? String(p.email).trim() : '';
          const entryKey = meetingCheckInEntryKey({ tag: p?.optional ? 'OPT' : 'INT', label, email });
          return {
            key: entryKey,
            checked: !!checked[entryKey],
            checkedAt: Number(timestamps[entryKey] || 0) || null,
            label,
            company: client?.shortName || client?.name || null,
            email: email || null,
            logoUrl: clientLogo,
            kind: 'internal' as const
          };
        });

      const manualSeen = new Set<string>();
      const externalsFromParticipants = participants
        .filter((p: any) => p?.kind === 'manual' && !p?.remote)
        .map((p: any) => {
          const label = String(p?.fullName || p?.externalId || '-').trim() || '-';
          const email = p?.email ? String(p.email).trim() : '';
          const company = String(p?.company || '').trim();
          const identity = `${label.toLowerCase()}::${email.toLowerCase()}`;
          manualSeen.add(identity);
          const entryKey = meetingCheckInEntryKey({ tag: 'EXT', label, email });
          const bp = businessPartnerByName.get(company.toLowerCase());
          return {
            key: entryKey,
            checked: !!checked[entryKey],
            checkedAt: Number(timestamps[entryKey] || 0) || null,
            label,
            company: company || null,
            email: email || null,
            logoUrl: String(bp?.logoUrl || '').trim() || null,
            kind: 'external' as const
          };
        });

      const externalsLegacy = (Array.isArray((booking as any)?.externalGuestsDetails) ? (booking as any).externalGuestsDetails : [])
        .filter((g: any) => !g?.remote)
        .map((g: any) => {
          const label = String(g?.name || '-').trim() || '-';
          const email = g?.email ? String(g.email).trim() : '';
          const company = String((g as any)?.company || '').trim();
          const identity = `${label.toLowerCase()}::${email.toLowerCase()}`;
          if (manualSeen.has(identity)) return null;
          const entryKey = meetingCheckInEntryKey({ tag: 'EXT', label, email });
          const bp = businessPartnerByName.get(company.toLowerCase());
          return {
            key: entryKey,
            checked: !!checked[entryKey],
            checkedAt: Number(timestamps[entryKey] || 0) || null,
            label,
            company: company || null,
            email: email || null,
            logoUrl: String(bp?.logoUrl || '').trim() || null,
            kind: 'external' as const
          };
        })
        .filter(Boolean) as Array<any>;

      return [...internal, ...externalsFromParticipants, ...externalsLegacy]
        .filter((row) => row.checked)
        .sort((a, b) => Number(b.checkedAt || 0) - Number(a.checkedAt || 0));
    },
    [client]
  );

  useEffect(() => {
    const modal = roomMeetingsTimelineModal;
    const scroller = roomMeetingsTimelineScrollRef.current;
    if (!modal || !scroller || modal.loading) return;
    const bookings = modal.bookings || [];
    let minMinutes = 7 * 60;
    let maxMinutes = 20 * 60;
    for (const booking of bookings) {
      const s = new Date(Number(booking.startAt || 0));
      const e = new Date(Number(booking.endAt || 0));
      if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) continue;
      minMinutes = Math.min(minMinutes, s.getHours() * 60 + s.getMinutes());
      maxMinutes = Math.max(maxMinutes, e.getHours() * 60 + e.getMinutes());
    }
    minMinutes = Math.max(0, Math.floor((minMinutes - 30) / 60) * 60);
    maxMinutes = Math.min(24 * 60, Math.ceil((maxMinutes + 30) / 60) * 60);
    if (maxMinutes - minMinutes < 6 * 60) maxMinutes = Math.min(24 * 60, minMinutes + 6 * 60);
    const total = Math.max(1, maxMinutes - minMinutes);
    const timelineWidthPx = Math.max(980, Math.max(6, Math.ceil((maxMinutes - minMinutes) / 60)) * 120);
    const labelColPx = 240;
    const highlightedBooking = roomMeetingsTimelineHighlightBookingId
      ? bookings.find((booking) => String(booking.id || '') === String(roomMeetingsTimelineHighlightBookingId))
      : null;
    let target: number | null = null;
    if (highlightedBooking) {
      const start = new Date(Number(highlightedBooking.startAt || 0));
      const end = new Date(Number(highlightedBooking.endAt || 0));
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const midMinutes = (startMinutes + endMinutes) / 2;
      const x = labelColPx + ((midMinutes - minMinutes) / total) * timelineWidthPx;
      target = Math.max(0, x - scroller.clientWidth / 2);
    } else {
      const nowDate = new Date();
      const todayIsoLocal = currentLocalIsoDay();
      if (String(modal.day || '') !== todayIsoLocal) return;
      const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      const nowX = labelColPx + ((nowMinutes - minMinutes) / total) * timelineWidthPx;
      target = Math.max(0, nowX - scroller.clientWidth / 2);
    }
    if (target == null) return;
    const raf = window.requestAnimationFrame(() => {
      scroller.scrollLeft = target as number;
    });
    return () => window.cancelAnimationFrame(raf);
  }, [
    roomMeetingsTimelineHighlightBookingId,
    roomMeetingsTimelineModal?.day,
    roomMeetingsTimelineModal?.loading,
    roomMeetingsTimelineModal?.bookings
  ]);

  useEffect(() => {
    if (!roomMeetingsTimelineHighlightBookingId) return;
    const timer = window.setTimeout(() => setRoomMeetingsTimelineHighlightBookingId(null), 3200);
    return () => window.clearTimeout(timer);
  }, [roomMeetingsTimelineHighlightBookingId]);

  const restoreMyMeetingsFromSnapshot = useCallback(() => {
    const restoreSnapshot = myMeetingsRestoreRef.current;
    const fallback: MyMeetingsModalState = {
      loading: true,
      error: null,
      now: Date.now(),
      meetings: [],
      counts: { total: 0, inProgress: 0, upcoming: 0, past: 0 }
    };
    setMyMeetingsModal(restoreSnapshot || fallback);
    myMeetingsRestoreRef.current = null;
    if (!restoreSnapshot) {
      void reloadMyMeetingsRef.current?.();
    }
  }, []);

  const openRoomMeetingBookingDetail = useCallback(
    (
      booking: MeetingBooking,
      mode: 'view' | 'edit' = 'view',
      options?: { fromMyMeetings?: boolean; fromMeetingNotes?: boolean; meetingNotesState?: MeetingNotesReturnState | null }
    ) => {
      if (options?.fromMyMeetings) {
        if (myMeetingsModal) {
          myMeetingsRestoreRef.current = myMeetingsModal;
        }
        setMyMeetingsModal(null);
      }
      const meetingNotesState = options?.meetingNotesState || null;
      const normalizedParticipants: Array<
        MeetingParticipant & { key: string; fullName: string; kind: 'real_user' | 'manual' }
      > = (Array.isArray(booking.participants) ? booking.participants : []).map((row, idx) => {
        const kind: 'real_user' | 'manual' = row?.kind === 'manual' ? 'manual' : 'real_user';
        const externalId = String(row?.externalId || '').trim() || null;
        const fullName = String(row?.fullName || row?.externalId || '').trim() || (kind === 'manual' ? t({ it: 'Ospite', en: 'Guest' }) : 'User');
        const key = kind === 'real_user' && externalId ? `real:${externalId}` : `manual:${idx}:${nanoid(4)}`;
        return {
          key,
          kind,
          externalId,
          fullName,
          email: row?.email ? String(row.email) : null,
          optional: !!row?.optional,
          remote: !!row?.remote,
          company: row?.company ? String(row.company) : null
        };
      });
      setRoomMeetingsTimelineBookingDetail({
        booking,
        mode,
        subject: String(booking.subject || ''),
        day: meetingIsoDayFromTs(Number(booking.startAt || 0)),
        startTime: meetingClockFromTs(Number(booking.startAt || 0)),
        endTime: meetingClockFromTs(Number(booking.endAt || 0)),
        notes: String(booking.notes || ''),
        videoConferenceLink: String(booking.videoConferenceLink || ''),
        kioskLanguage: (() => {
          const raw = String((booking as any)?.kioskLanguage || '').trim().toLowerCase();
          return raw === 'it' || raw === 'en' || raw === 'ru' || raw === 'ar' || raw === 'zh' ? raw : 'auto';
        })(),
        setupBufferBeforeMin: Math.max(0, Math.min(60, Number(booking.setupBufferBeforeMin) || 0)),
        setupBufferAfterMin: Math.max(0, Math.min(60, Number(booking.setupBufferAfterMin) || 0)),
        participantFilter: '',
        manualParticipantName: '',
        manualParticipantCompany: '',
        manualParticipantEmail: '',
        manualParticipantOptional: false,
        manualParticipantRemote: false,
        participantsDraft: normalizedParticipants,
        applyToSeries: false,
        returnToMyMeetings: !!options?.fromMyMeetings,
        returnToMeetingNotes: !!options?.fromMeetingNotes,
        returnToMeetingNotesInitialTab: meetingNotesState?.initialTab,
        returnToMeetingNotesHistoryMeetingId: meetingNotesState?.historyMeetingId,
        returnToMeetingNotesHighlightMeetingId: meetingNotesState?.highlightHistoryMeetingId,
        saving: false,
        deleting: false,
        error: null
      });
      setRoomMeetingCheckInListOpen(false);
      setRoomMeetingEditManualCompanyIsOther(false);
      setRoomMeetingEditBusinessPartnersModalOpen(false);
    },
    [meetingClockFromTs, meetingIsoDayFromTs, myMeetingsModal, t]
  );

  const closeRoomMeetingBookingDetail = useCallback((options?: { bookingOverride?: MeetingBooking | null }) => {
    const detail = roomMeetingsTimelineBookingDetail;
    const shouldReturnToMyMeetings = !!detail?.returnToMyMeetings;
    const shouldReturnToMeetingNotes = !!detail?.returnToMeetingNotes;
    const bookingToRestoreInNotes = options?.bookingOverride || detail?.booking || null;
    const notesState: MeetingNotesReturnState | null = shouldReturnToMeetingNotes
      ? {
          initialTab: detail?.returnToMeetingNotesInitialTab || 'history',
          historyMeetingId: detail?.returnToMeetingNotesHistoryMeetingId || String(bookingToRestoreInNotes?.id || ''),
          highlightHistoryMeetingId: detail?.returnToMeetingNotesHighlightMeetingId || String(bookingToRestoreInNotes?.id || '')
        }
      : null;
    roomMeetingsTimelineDetailCloseGuardUntilRef.current = Date.now() + 350;
    roomMeetingEditParticipantsCloseGuardUntilRef.current = Date.now() + 350;
    setRoomMeetingEditParticipantsModalOpen(false);
    setRoomMeetingCheckInListOpen(false);
    setRoomMeetingsTimelineBookingDetail(null);
    if (shouldReturnToMeetingNotes && bookingToRestoreInNotes) {
      setRoomMeetingNotesReturnToMyMeetings(shouldReturnToMyMeetings);
      setRoomMeetingNotesModalState(notesState);
      setRoomMeetingNotesModalBooking(bookingToRestoreInNotes);
      return;
    }
    setRoomMeetingNotesModalState(null);
    if (shouldReturnToMyMeetings) {
      restoreMyMeetingsFromSnapshot();
    }
  }, [restoreMyMeetingsFromSnapshot, roomMeetingsTimelineBookingDetail]);

  const openRoomMeetingEditParticipantsModal = useCallback(() => {
    setRoomMeetingEditParticipantsModalOpen(true);
  }, []);

  const closeRoomMeetingEditParticipantsModal = useCallback(() => {
    roomMeetingEditParticipantsCloseGuardUntilRef.current = Date.now() + 250;
    setRoomMeetingEditParticipantsModalOpen(false);
  }, []);

  useEffect(() => {
    if (!roomMeetingEditParticipantsModalOpen) return;
    const timer = window.setTimeout(() => {
      roomMeetingEditParticipantsNameInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [roomMeetingEditParticipantsModalOpen]);

  useEffect(() => {
    if (!roomMeetingEditParticipantsModalOpen) return;
    const onKeyDown = (evt: KeyboardEvent) => {
      if (evt.key !== 'Escape') return;
      evt.preventDefault();
      evt.stopPropagation();
      if (roomMeetingEditBusinessPartnersModalOpen) return;
      closeRoomMeetingEditParticipantsModal();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [closeRoomMeetingEditParticipantsModal, roomMeetingEditBusinessPartnersModalOpen, roomMeetingEditParticipantsModalOpen]);

  const addTimelineMeetingRealParticipant = useCallback((externalId: string) => {
    const candidate = roomMeetingEditParticipantCandidates.find((row) => String(row.externalId) === String(externalId));
    if (!candidate) return;
    setRoomMeetingsTimelineBookingDetail((prev) => {
      if (!prev) return prev;
      if (prev.participantsDraft.some((p) => p.kind === 'real_user' && String(p.externalId || '') === String(candidate.externalId))) return prev;
      return {
        ...prev,
        participantsDraft: [
          ...prev.participantsDraft,
          {
            key: `real:${candidate.externalId}`,
            kind: 'real_user',
            externalId: candidate.externalId,
            fullName: candidate.fullName,
            email: candidate.email,
            optional: false,
            remote: false,
            company: null
          }
        ]
      };
    });
  }, [roomMeetingEditParticipantCandidates]);

  const removeTimelineMeetingParticipant = useCallback((key: string) => {
    setRoomMeetingsTimelineBookingDetail((prev) =>
      prev ? { ...prev, participantsDraft: prev.participantsDraft.filter((p) => String(p.key) !== String(key)) } : prev
    );
  }, []);

  const toggleTimelineMeetingParticipantFlag = useCallback((key: string, field: 'optional' | 'remote') => {
    setRoomMeetingsTimelineBookingDetail((prev) =>
      prev
        ? {
            ...prev,
            participantsDraft: prev.participantsDraft.map((p) =>
              String(p.key) === String(key) ? { ...p, [field]: !p[field] } : p
            )
          }
        : prev
    );
  }, []);

  const addTimelineMeetingManualParticipant = useCallback(() => {
    setRoomMeetingsTimelineBookingDetail((prev) => {
      if (!prev) return prev;
      const fullName = String(prev.manualParticipantName || '').trim();
      if (!fullName) return { ...prev, error: t({ it: 'Inserisci il nome ospite.', en: 'Enter guest name.' }) };
      const email = String(prev.manualParticipantEmail || '').trim();
      const company = String(prev.manualParticipantCompany || '').trim();
      return {
        ...prev,
        error: null,
        participantsDraft: [
          ...prev.participantsDraft,
          {
            key: `manual:${nanoid(6)}`,
            kind: 'manual',
            externalId: null,
            fullName,
            email: email || null,
            optional: !!prev.manualParticipantOptional,
            remote: !!prev.manualParticipantRemote,
            company: company || null
          }
        ],
        manualParticipantName: '',
        manualParticipantCompany: '',
        manualParticipantEmail: '',
        manualParticipantOptional: false,
        manualParticipantRemote: false
      };
    });
    setRoomMeetingEditManualCompanyIsOther(false);
  }, [t]);



  const extendRoomMeetingBooking = useCallback(
    async (booking: MeetingBooking, mode: '10m' | '30m' | '1h' | '1.5h' | '2h' | 'max') => {
      const modal = roomMeetingsTimelineModal;
      if (!booking) return;
      const currentEndTs = Number(booking.endAt || 0);
      const currentStartTs = Number(booking.startAt || 0);
      if (!Number.isFinite(currentEndTs) || !Number.isFinite(currentStartTs)) return;
      if (Date.now() >= currentEndTs) {
        push(
          t({
            it: 'Meeting concluso: estensione non consentita.',
            en: 'Meeting ended: extension is not allowed.'
          }),
          'info'
        );
        return;
      }
      const resolvedDay = String((booking as any).occurrenceDate || meetingIsoDayFromTs(currentStartTs) || modal?.day || '').trim();
      const resolvedRoomId = String((booking as any).roomId || modal?.roomId || '').trim();
      let roomBookings: MeetingBooking[] = [];
      if (modal && String(modal.roomId || '') === resolvedRoomId && String(modal.day || '') === resolvedDay) {
        roomBookings = modal.bookings || [];
      } else {
        const cid = String(client?.id || '').trim();
        const sid = String(site?.id || '').trim();
        if (cid && sid && resolvedRoomId && resolvedDay) {
          try {
            const payload = await fetchMeetingOverview({ clientId: cid, siteId: sid, floorPlanId: planId, day: resolvedDay });
            const roomRow = (payload.rooms || []).find((r) => String(r.roomId || '') === resolvedRoomId);
            roomBookings = roomRow?.bookings || [];
          } catch {
            roomBookings = [];
          }
        }
      }
      const maxEndTs = getRoomMeetingExtendMaxEndTs(booking, roomBookings);
      let targetEndTs = currentEndTs;
      if (mode === 'max') {
        targetEndTs = maxEndTs;
      } else {
        const addMin = mode === '10m' ? 10 : mode === '30m' ? 30 : mode === '1h' ? 60 : mode === '1.5h' ? 90 : 120;
        targetEndTs = Math.min(maxEndTs, currentEndTs + addMin * 60_000);
      }
      if (!Number.isFinite(targetEndTs) || targetEndTs <= currentEndTs) {
        push(
          t({
            it: 'Nessuno spazio disponibile per estendere il meeting.',
            en: 'No free slot available to extend the meeting.'
          }),
          'info'
        );
        return;
      }
      try {
        setRoomMeetingExtendBusyId(String(booking.id));
        const result = await updateMeeting(booking.id, {
          day: resolvedDay,
          startTime: toLocalHmFromTs(currentStartTs),
          endTime: toLocalHmFromTs(targetEndTs)
        });
        push(
          t({
            it: `Meeting esteso fino alle ${toLocalHmFromTs(Number(result.booking?.endAt || targetEndTs))}.`,
            en: `Meeting extended until ${toLocalHmFromTs(Number(result.booking?.endAt || targetEndTs))}.`
          }),
          'success'
        );
        if (roomMeetingsTimelineBookingDetail && String(roomMeetingsTimelineBookingDetail.booking.id) === String(booking.id)) {
          setRoomMeetingsTimelineBookingDetail((prev) =>
            prev ? { ...prev, booking: result.booking, mode: 'view', saving: false, error: null } : prev
          );
        }
        setRoomMeetingTimelineContextMenu(null);
        if (modal?.roomId) {
          await reloadRoomMeetingsTimeline(modal.roomId, modal.day);
        }
      } catch (err: any) {
        push(err?.message || t({ it: 'Estensione meeting fallita.', en: 'Failed to extend meeting.' }), 'danger');
      } finally {
        setRoomMeetingExtendBusyId(null);
      }
    },
    [
      client?.id,
      getRoomMeetingExtendMaxEndTs,
      meetingIsoDayFromTs,
      planId,
      push,
      reloadRoomMeetingsTimeline,
      roomMeetingsTimelineBookingDetail,
      roomMeetingsTimelineModal,
      site?.id,
      t,
      toLocalHmFromTs
    ]
  );

  const adjustRoomMeetingEditEndTime = useCallback(
    (mode: '10m' | '30m' | '1h' | '2h' | 'max') => {
      setRoomMeetingsTimelineBookingDetail((prev) => {
        if (!prev || prev.mode !== 'edit') return prev;
        const toLocalTs = (isoDay: string, hhmm: string) => {
          const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
          const tm = /^(\d{1,2}):(\d{1,2})$/.exec(String(hhmm || '').trim());
          if (!dm || !tm) return null;
          const y = Number(dm[1]);
          const mo = Number(dm[2]) - 1;
          const da = Number(dm[3]);
          const hh = Number(tm[1]);
          const mm = Number(tm[2]);
          if (![y, mo, da, hh, mm].every(Number.isFinite)) return null;
          if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
          const dt = new Date(y, mo, da, hh, mm, 0, 0);
          return Number.isFinite(dt.getTime()) ? dt.getTime() : null;
        };
        const startTs = toLocalTs(prev.day, prev.startTime);
        const endTs = toLocalTs(prev.day, prev.endTime);
        if (startTs === null || endTs === null) return prev;
        const siblingBookings = (roomMeetingsTimelineModal?.bookings || [])
          .filter((b) => String(b.id) !== String(prev.booking.id))
          .sort((a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0));
        const nextNeighbor =
          siblingBookings
            .filter((b) => Number((b as any).effectiveStartAt ?? b.startAt ?? 0) >= endTs)
            .sort((a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0))[0] || null;
        const dayEnd = new Date(`${String(prev.day || '').trim()}T23:59:00`);
        const dayEndTs = Number.isFinite(dayEnd.getTime()) ? dayEnd.getTime() : endTs;
        const nextBoundaryTs = nextNeighbor ? Number((nextNeighbor as any).effectiveStartAt ?? nextNeighbor.startAt ?? 0) : Number.POSITIVE_INFINITY;
        const maxEndTs = Math.min(dayEndTs, nextBoundaryTs);
        let targetEndTs = endTs;
        if (mode === 'max') {
          targetEndTs = maxEndTs;
        } else {
          const deltaMin = mode === '10m' ? 10 : mode === '30m' ? 30 : mode === '1h' ? 60 : 120;
          targetEndTs = Math.min(maxEndTs, endTs + deltaMin * 60_000);
        }
        if (!Number.isFinite(targetEndTs) || targetEndTs <= startTs) return prev;
        if (targetEndTs <= endTs) return prev;
        return { ...prev, endTime: toLocalHmFromTs(targetEndTs) };
      });
    },
    [roomMeetingsTimelineModal?.bookings, toLocalHmFromTs]
  );

  const openRoomMeetingDuplicateModal = useCallback(
    (booking: MeetingBooking, options?: { preferredDay?: string; mode?: 'duplicate' | 'followup' }) => {
      const baseDay = String((booking as any).occurrenceDate || meetingIsoDayFromTs(Number(booking.startAt || 0)) || '').trim();
      if (!baseDay) return;
      const preferredDayRaw = String(options?.preferredDay || '').trim();
      const preferredDay = /^\d{4}-\d{2}-\d{2}$/.test(preferredDayRaw) ? preferredDayRaw : '';
      const mode = options?.mode === 'followup' ? 'followup' : 'duplicate';
      const optionsById = new Map<string, { roomId: string; roomName: string; floorPlanId: string; floorPlanName: string }>();
      for (const floorPlan of site?.floorPlans || []) {
        const floorPlanId = String((floorPlan as any)?.id || '').trim();
        const floorPlanName = String((floorPlan as any)?.name || '').trim();
        for (const room of (floorPlan as any)?.rooms || []) {
          const roomId = String((room as any)?.id || '').trim();
          if (!roomId || !(room as any)?.meetingRoom) continue;
          if (optionsById.has(roomId)) continue;
          optionsById.set(roomId, {
            roomId,
            roomName: String((room as any)?.name || (booking as any)?.roomName || roomId).trim(),
            floorPlanId,
            floorPlanName
          });
        }
      }
      const sourceRoomId = String((booking as any)?.roomId || '').trim();
      if (sourceRoomId && !optionsById.has(sourceRoomId)) {
        optionsById.set(sourceRoomId, {
          roomId: sourceRoomId,
          roomName: String((booking as any)?.roomName || sourceRoomId).trim(),
          floorPlanId: String((booking as any)?.floorPlanId || '').trim(),
          floorPlanName: ''
        });
      }
      const roomOptions = Array.from(optionsById.values()).sort((a, b) => a.roomName.localeCompare(b.roomName));
      const selectedRoomId = roomOptions.some((entry) => entry.roomId === sourceRoomId)
        ? sourceRoomId
        : String(roomOptions[0]?.roomId || sourceRoomId || '').trim();
      setRoomMeetingDuplicateModal({
        mode,
        booking,
        step: 'setup',
        roomMode: 'selected',
        selectedRoomId,
        timeMode: 'same',
        customFromHm: '08:00',
        customToHm: '18:00',
        roomOptions,
        baseDay,
        preferredDay,
        monthAnchor: monthAnchorFromIso(preferredDay || baseDay),
        selectedDays: [],
        availabilityByDay: {},
        candidateByDay: {},
        loadingMonth: false,
        saving: false,
        error: null
      });
      setRoomMeetingTimelineContextMenu(null);
    },
    [meetingIsoDayFromTs, monthAnchorFromIso, site?.floorPlans]
  );

  useEffect(() => {
    let cancelled = false;
    const modal = roomMeetingDuplicateModal;
    const cid = String(client?.id || '').trim();
    const sid = String(site?.id || '').trim();
    const activeBookingId = String(modal?.booking?.id || '').trim();
    if (!modal || !activeBookingId || !cid || !sid || !planId) return;
    if (modal.step !== 'calendar') return;
    const booking = modal.booking;
    const baseDay = String(modal.baseDay || '').trim();
    const monthAnchor = String(modal.monthAnchor || '').trim();
    if (!baseDay || !monthAnchor) return;
    const today = currentLocalIsoDay();
    const monthDate = new Date(`${monthAnchor}T00:00:00`);
    if (!Number.isFinite(monthDate.getTime())) return;
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const monthDays = Array.from({ length: daysInMonth }, (_, idx) => {
      const d = new Date(y, m, idx + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const unknownDays = monthDays.filter((iso) => !modal.availabilityByDay?.[iso]);
    if (!unknownDays.length) return;
    const sourceSlot = resolveRoomDuplicateSlot(booking, baseDay, 'same');
    if (!sourceSlot) return;
    const durationMin = Math.max(1, sourceSlot.endMin - sourceSlot.startMin);
    const sourceStartMin = sourceSlot.startMin;
    const candidateRooms =
      modal.roomMode === 'any'
        ? modal.roomOptions
        : modal.roomOptions.filter((entry) => String(entry.roomId) === String(modal.selectedRoomId || ''));
    if (!candidateRooms.length) {
      setRoomMeetingDuplicateModal((prev) =>
        prev && String(prev.booking.id) === activeBookingId
          ? { ...prev, error: t({ it: 'Seleziona una saletta valida.', en: 'Select a valid room.' }) }
          : prev
      );
      return;
    }
    const prefilled: Record<string, any> = {};
    const queue: string[] = [];
    for (const day of unknownDays) {
      if (day <= baseDay) {
        prefilled[day] = {
          state: 'blocked',
          reason: day < today ? t({ it: 'Giorno passato', en: 'Past day' }) : t({ it: 'Giorno di origine', en: 'Source day' })
        };
        continue;
      }
      if (day < today) {
        prefilled[day] = { state: 'blocked', reason: t({ it: 'Giorno passato', en: 'Past day' }) };
        continue;
      }
      queue.push(day);
    }
    if (!Object.keys(prefilled).length && !queue.length) return;
    setRoomMeetingDuplicateModal((prev) => {
      if (!prev || String(prev.booking.id) !== activeBookingId || String(prev.monthAnchor) !== monthAnchor) return prev;
      return {
        ...prev,
        loadingMonth: queue.length > 0,
        availabilityByDay: {
          ...prev.availabilityByDay,
          ...prefilled,
          ...Object.fromEntries(queue.map((day) => [day, { state: 'loading' as const }]))
        },
        candidateByDay: Object.fromEntries(
          Object.entries(prev.candidateByDay || {}).filter(([day]) => monthDays.includes(day))
        )
      };
    });

    (async () => {
      if (!queue.length) {
        setRoomMeetingDuplicateModal((prev) => {
          if (!prev || String(prev.booking.id) !== activeBookingId || String(prev.monthAnchor) !== monthAnchor) return prev;
          return { ...prev, loadingMonth: false };
        });
        return;
      }
      const outcomes: Record<string, any> = {};
      const candidates: Record<string, { roomId: string; roomName: string; floorPlanId: string; floorPlanName: string; startHm: string; endHm: string }> = {};
      try {
        const monthStartTs = new Date(y, m, 1, 0, 0, 0, 0).getTime();
        const monthEndTs = new Date(y, m + 1, 0, 23, 59, 59, 999).getTime();
        const payload = await Promise.race([
          fetchMeetings({
            siteId: sid,
            fromAt: monthStartTs - 24 * 60 * 60 * 1000,
            toAt: monthEndTs + 24 * 60 * 60 * 1000
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4500))
        ]);
        const allMeetings = Array.isArray(payload?.meetings) ? payload.meetings : [];
        const scopedMeetings = allMeetings.filter((entry: any) => {
          if (String(entry?.clientId || '') !== cid) return false;
          if (String(entry?.siteId || '') !== sid) return false;
          return true;
        });
        const toIntervals = (day: string, roomId: string): Array<{ start: number; end: number }> => {
          const dayStartTs = localTsFromIsoHm(day, '00:00');
          if (dayStartTs === null) return [];
          const dayEndTs = dayStartTs + 24 * 60 * 60 * 1000;
          const raw = scopedMeetings
            .filter((entry: any) => String(entry?.roomId || '') === roomId && String(entry?.id || '') !== String(booking.id || ''))
            .map((entry: any) => {
              const startRaw = Number(entry?.startAt || 0);
              const endRaw = Number(entry?.endAt || 0);
              const preMin = Math.max(0, Number(entry?.setupBufferBeforeMin) || 0);
              const postMin = Math.max(0, Number(entry?.setupBufferAfterMin) || 0);
              const startAdj = startRaw - preMin * 60_000;
              const endAdj = endRaw + postMin * 60_000;
              return { startAdj, endAdj };
            })
            .filter((entry) => Number.isFinite(entry.startAdj) && Number.isFinite(entry.endAdj) && entry.startAdj < dayEndTs && entry.endAdj > dayStartTs)
            .map((entry) => ({
              start: Math.max(0, Math.floor((Math.max(entry.startAdj, dayStartTs) - dayStartTs) / 60_000)),
              end: Math.min(24 * 60, Math.ceil((Math.min(entry.endAdj, dayEndTs) - dayStartTs) / 60_000))
            }))
            .filter((entry) => entry.end > entry.start)
            .sort((a, b) => a.start - b.start);
          const merged: Array<{ start: number; end: number }> = [];
          for (const interval of raw) {
            const last = merged[merged.length - 1];
            if (!last || interval.start > last.end) {
              merged.push({ ...interval });
            } else {
              last.end = Math.max(last.end, interval.end);
            }
          }
          return merged;
        };
        const findSlot = (
          day: string,
          intervals: Array<{ start: number; end: number }>
        ): { startMin: number; endMin: number } | null => {
          const nowMin = (() => {
            if (day !== today) return 0;
            const now = new Date();
            return now.getHours() * 60 + now.getMinutes();
          })();
          if (modal.timeMode === 'same') {
            const startMin = Math.max(sourceStartMin, nowMin);
            const endMin = startMin + durationMin;
            if (endMin > 23 * 60 + 59) return null;
            const overlap = intervals.some((entry) => entry.start < endMin && entry.end > startMin);
            return overlap ? null : { startMin, endMin };
          }
          const windowStartRaw =
            modal.timeMode === 'custom' ? hmToMinutes(String(modal.customFromHm || '')) : 8 * 60;
          const windowEndRaw =
            modal.timeMode === 'custom' ? hmToMinutes(String(modal.customToHm || '')) : 18 * 60;
          if (!Number.isFinite(windowStartRaw) || !Number.isFinite(windowEndRaw)) return null;
          const windowStartMin = Number(windowStartRaw);
          const windowEndMin = Number(windowEndRaw);
          const windowStart = Math.max(0, Math.min(23 * 60 + 59, Math.max(windowStartMin, nowMin)));
          const windowEnd = Math.max(0, Math.min(23 * 60 + 59, windowEndMin));
          if (windowEnd <= windowStart) return null;
          let cursor = windowStart;
          for (const interval of intervals) {
            if (interval.end <= windowStart) continue;
            if (interval.start >= windowEnd) break;
            const blockedStart = Math.max(windowStart, interval.start);
            if (cursor + durationMin <= blockedStart) return { startMin: cursor, endMin: cursor + durationMin };
            cursor = Math.max(cursor, Math.min(windowEnd, interval.end));
            if (cursor >= windowEnd) break;
          }
          if (cursor + durationMin <= windowEnd) return { startMin: cursor, endMin: cursor + durationMin };
          return null;
        };
        for (const day of queue) {
          let chosen: { roomId: string; roomName: string; floorPlanId: string; floorPlanName: string; startHm: string; endHm: string } | null = null;
          for (const room of candidateRooms) {
            const intervals = toIntervals(day, room.roomId);
            const slot = findSlot(day, intervals);
            if (!slot) continue;
            chosen = {
              roomId: room.roomId,
              roomName: room.roomName,
              floorPlanId: room.floorPlanId,
              floorPlanName: room.floorPlanName,
              startHm: minutesToHm(slot.startMin),
              endHm: minutesToHm(slot.endMin)
            };
            break;
          }
          if (chosen) {
            outcomes[day] = {
              state: 'available',
              reason: `${chosen.roomName} • ${chosen.startHm} - ${chosen.endHm}`
            };
            candidates[day] = chosen;
          } else {
            outcomes[day] = {
              state: 'occupied',
              reason:
                modal.roomMode === 'any'
                  ? t({ it: 'Nessuna saletta disponibile in questa sede.', en: 'No meeting room available in this site.' })
                  : t({ it: 'Saletta occupata nello slot richiesto.', en: 'Selected room is busy in requested slot.' })
            };
          }
        }
      } catch {
        for (const day of queue) {
          outcomes[day] = { state: 'error', reason: t({ it: 'Errore verifica disponibilità', en: 'Availability check failed' }) };
        }
      }
      if (cancelled) return;
      setRoomMeetingDuplicateModal((prev) => {
        if (!prev || String(prev.booking.id) !== activeBookingId || String(prev.monthAnchor) !== monthAnchor) return prev;
        const mergedCandidates = { ...(prev.candidateByDay || {}), ...candidates };
        const validSelectedDays = prev.selectedDays.filter((day) => mergedCandidates[day] && outcomes[day]?.state === 'available');
        const preferredDay = String(prev.preferredDay || '').trim();
        if (
          preferredDay &&
          monthDays.includes(preferredDay) &&
          !validSelectedDays.includes(preferredDay) &&
          mergedCandidates[preferredDay] &&
          String((outcomes[preferredDay] || prev.availabilityByDay?.[preferredDay] || {}).state || '') === 'available'
        ) {
          validSelectedDays.push(preferredDay);
        }
        return {
          ...prev,
          loadingMonth: false,
          selectedDays: validSelectedDays,
          availabilityByDay: {
            ...prev.availabilityByDay,
            ...outcomes
          },
          candidateByDay: mergedCandidates
        };
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    client?.id,
    site?.id,
    planId,
    roomMeetingDuplicateModal?.step,
    roomMeetingDuplicateModal?.booking?.id,
    roomMeetingDuplicateModal?.baseDay,
    roomMeetingDuplicateModal?.preferredDay,
    roomMeetingDuplicateModal?.monthAnchor,
    roomMeetingDuplicateModal?.roomMode,
    roomMeetingDuplicateModal?.selectedRoomId,
    roomMeetingDuplicateModal?.timeMode,
    roomMeetingDuplicateModal?.customFromHm,
    roomMeetingDuplicateModal?.customToHm,
    hmToMinutes,
    resolveRoomDuplicateSlot
  ]);

  const saveRoomMeetingDuplicates = useCallback(async () => {
    const dup = roomMeetingDuplicateModal;
    if (!dup) return;
    const booking = dup.booking;
    const selectedDays = [...dup.selectedDays].sort();
    if (!selectedDays.length) {
      setRoomMeetingDuplicateModal((prev) => (prev ? { ...prev, error: t({ it: 'Seleziona almeno un giorno.', en: 'Select at least one day.' }) } : prev));
      return;
    }
    setRoomMeetingDuplicateModal((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    const successes: string[] = [];
    const createdMeetingIds: string[] = [];
    const failures: string[] = [];
    let followUpParentMeetingId = String(booking.id || '');
    for (const day of selectedDays) {
      try {
        const candidate = dup.candidateByDay?.[day];
        if (!candidate) {
          failures.push(`${day}: ${t({ it: 'Nessuna disponibilità valida', en: 'No valid availability' })}`);
          continue;
        }
        const duplicateFloorPlanId = String(candidate.floorPlanId || booking.floorPlanId || planId || '').trim();
        const created = await createMeeting({
          clientId: String(booking.clientId),
          siteId: String(booking.siteId),
          ...(duplicateFloorPlanId ? { floorPlanId: duplicateFloorPlanId } : {}),
          roomId: String(candidate.roomId || booking.roomId),
          subject: String(booking.subject || '').trim() || t({ it: 'Meeting', en: 'Meeting' }),
          requestedSeats: Math.max(0, Number(booking.requestedSeats) || 0),
          startDate: day,
          startTime: candidate.startHm,
          endTime: candidate.endHm,
          setupBufferBeforeMin: Math.max(0, Number(booking.setupBufferBeforeMin) || 0),
          setupBufferAfterMin: Math.max(0, Number(booking.setupBufferAfterMin) || 0),
          participants: Array.isArray(booking.participants) ? booking.participants : [],
          externalGuests: !!(booking as any).externalGuests,
          externalGuestsList: Array.isArray((booking as any).externalGuestsList) ? (booking as any).externalGuestsList : [],
          externalGuestsDetails: Array.isArray((booking as any).externalGuestsDetails) ? (booking as any).externalGuestsDetails : [],
          sendEmail: !!booking.sendEmail,
          technicalSetup: !!booking.technicalSetup,
          technicalEmail: String(booking.technicalEmail || ''),
          notes: String(booking.notes || ''),
          videoConferenceLink: String(booking.videoConferenceLink || ''),
          kioskLanguage: ((booking as any).kioskLanguage || null) as any,
          ...(dup.mode === 'followup' && followUpParentMeetingId ? { followUpOfMeetingId: followUpParentMeetingId } : {})
        });
        if (dup.mode === 'followup') {
          const firstCreatedBookingId = String((created as any)?.bookings?.[0]?.id || '').trim();
          if (firstCreatedBookingId) followUpParentMeetingId = firstCreatedBookingId;
          if (firstCreatedBookingId) createdMeetingIds.push(firstCreatedBookingId);
        }
        successes.push(day);
      } catch (err: any) {
        failures.push(`${day}: ${String(err?.message || t({ it: 'Errore creazione', en: 'Creation failed' }))}`);
      }
    }
    if (successes.length) {
      push(
        t({
          it:
            dup.mode === 'followup'
              ? `Follow-up creat${successes.length === 1 ? 'o' : 'i'} su ${successes.length} giorn${successes.length === 1 ? 'o' : 'i'}.`
              : `Riunione duplicata su ${successes.length} giorn${successes.length === 1 ? 'o' : 'i'}.`,
          en:
            dup.mode === 'followup'
              ? `Follow-up created on ${successes.length} day(s).`
              : `Meeting duplicated on ${successes.length} day(s).`
        }),
        'success'
      );
    }
    if (failures.length) {
      setRoomMeetingDuplicateModal((prev) =>
        prev ? { ...prev, saving: false, error: failures.slice(0, 3).join(' • ') } : prev
      );
      push(
        t({
          it: `Alcune date non sono state create (${failures.length}).`,
          en: `Some dates were not created (${failures.length}).`
        }),
        'danger'
      );
    } else {
      if (dup.mode === 'followup' && roomMeetingNotesModalBooking) {
        const highlightId = String(createdMeetingIds[createdMeetingIds.length - 1] || '').trim();
        setRoomMeetingNotesModalState({
          initialTab: 'history',
          historyMeetingId: highlightId || String(booking.id || ''),
          highlightHistoryMeetingId: highlightId || String(booking.id || '')
        });
      }
      setRoomMeetingDuplicateModal(null);
    }
    if (roomMeetingsTimelineModal?.roomId) {
      void reloadRoomMeetingsTimeline(roomMeetingsTimelineModal.roomId, roomMeetingsTimelineModal.day);
    }
  }, [
    planId,
    push,
    reloadRoomMeetingsTimeline,
    resolveRoomDuplicateSlot,
    roomMeetingDuplicateModal,
    roomMeetingNotesModalBooking,
    roomMeetingsTimelineModal,
    t
  ]);

  const saveRoomMeetingBookingEdit = useCallback(async () => {
    const detail = roomMeetingsTimelineBookingDetail;
    const modal = roomMeetingsTimelineModal;
    if (!detail) return;
    if (!detail.subject.trim()) {
      setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, error: t({ it: 'Oggetto meeting obbligatorio.', en: 'Meeting subject is required.' }) } : prev));
      return;
    }
    if (!detail.day || !detail.startTime || !detail.endTime) {
      setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, error: t({ it: 'Compila data e orari.', en: 'Fill date and times.' }) } : prev));
      return;
    }
    setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, saving: true, error: null } : prev));
    try {
      const nowTs = Date.now();
      const bookingStartTs = Number(detail.booking.startAt || 0);
      const bookingEndTs = Number(detail.booking.endAt || 0);
      const isInProgress = bookingStartTs <= nowTs && nowTs < bookingEndTs;
      const basePreSetup = Math.max(0, Math.min(60, Number(detail.booking.setupBufferBeforeMin) || 0));
      const basePostSetup = Math.max(0, Math.min(60, Number(detail.booking.setupBufferAfterMin) || 0));
      const requestedPreSetup = Math.max(0, Math.min(60, Number(detail.setupBufferBeforeMin) || 0));
      const requestedPostSetup = Math.max(0, Math.min(60, Number(detail.setupBufferAfterMin) || 0));
      const safePreSetup = isInProgress ? basePreSetup : requestedPreSetup;
      const safePostSetup = isInProgress ? Math.max(basePostSetup, requestedPostSetup) : requestedPostSetup;
      const availabilityClientId = String(detail.booking.clientId || client?.id || '').trim();
      const availabilitySiteId = String(detail.booking.siteId || site?.id || '').trim();
      const availabilityFloorPlanId = String(detail.booking.floorPlanId || '').trim();
      if (availabilitySiteId) {
        try {
          const availabilityPayload = await fetchMeetingOverview({
            ...(availabilityClientId ? { clientId: availabilityClientId } : {}),
            siteId: availabilitySiteId,
            ...(availabilityFloorPlanId ? { floorPlanId: availabilityFloorPlanId } : {}),
            day: detail.day,
            startTime: detail.startTime,
            endTime: detail.endTime,
            setupBufferBeforeMin: safePreSetup,
            setupBufferAfterMin: safePostSetup
          });
          const targetRoom = (availabilityPayload.rooms || []).find(
            (row) => String(row.roomId || '') === String(detail.booking.roomId || '')
          );
          const slotConflicts = (targetRoom?.slotConflicts || []).filter(
            (booking) => String(booking.id || '') !== String(detail.booking.id || '')
          );
          if (slotConflicts.length) {
            const firstConflict =
              [...slotConflicts].sort((a, b) => Number(a.startAt || 0) - Number(b.startAt || 0))[0] || slotConflicts[0];
            const message = t({
              it: `Saletta occupata nello slot selezionato (${new Date(Number(firstConflict.startAt || 0)).toLocaleDateString()} ${meetingClockFromTs(
                Number(firstConflict.startAt || 0)
              )}-${meetingClockFromTs(Number(firstConflict.endAt || 0))}).`,
              en: `Meeting room is occupied in the selected slot (${new Date(Number(firstConflict.startAt || 0)).toLocaleDateString()} ${meetingClockFromTs(
                Number(firstConflict.startAt || 0)
              )}-${meetingClockFromTs(Number(firstConflict.endAt || 0))}).`
            });
            setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
            push(message, 'danger');
            return;
          }
        } catch (availabilityError: any) {
          const message = String(
            availabilityError?.message ||
              t({
                it: 'Impossibile verificare disponibilità della saletta.',
                en: 'Unable to verify meeting room availability.'
              })
          );
          setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, saving: false, error: message } : prev));
          push(message, 'danger');
          return;
        }
      }
      const result = await updateMeeting(detail.booking.id, {
        subject: detail.subject.trim(),
        day: detail.day,
        startTime: detail.startTime,
        endTime: detail.endTime,
        notes: detail.notes,
        videoConferenceLink: detail.videoConferenceLink,
        kioskLanguage: detail.kioskLanguage,
        setupBufferBeforeMin: safePreSetup,
        setupBufferAfterMin: safePostSetup,
        participants: detail.participantsDraft.map((p) => ({
          kind: p.kind === 'manual' ? 'manual' : 'real_user',
          externalId: p.kind === 'real_user' ? String(p.externalId || '') : null,
          fullName: String(p.fullName || ''),
          email: p.email ? String(p.email) : null,
          optional: !!p.optional,
          remote: !!p.remote,
          company: p.company ? String(p.company) : null
        })),
        applyToSeries: !!detail.applyToSeries
      });
      push(
        detail.booking.sendEmail
          ? t({ it: 'Meeting aggiornato. Notifica email inviata ai partecipanti.', en: 'Meeting updated. Email notification sent to participants.' })
          : t({ it: 'Meeting aggiornato.', en: 'Meeting updated.' }),
        'success'
      );
      setRoomMeetingEditParticipantsModalOpen(false);
      if (modal?.roomId) {
        await reloadRoomMeetingsTimeline(modal.roomId, modal.day);
      }
      if (detail.returnToMeetingNotes) {
        closeRoomMeetingBookingDetail({ bookingOverride: result.booking });
        return;
      }
      setRoomMeetingsTimelineBookingDetail((prev) =>
        prev ? { ...prev, booking: result.booking, mode: 'view', saving: false, error: null, applyToSeries: false } : prev
      );
    } catch (err: any) {
      setRoomMeetingsTimelineBookingDetail((prev) => (prev ? { ...prev, saving: false, error: err?.message || 'Update failed' } : prev));
    }
  }, [client?.id, closeRoomMeetingBookingDetail, meetingClockFromTs, push, reloadRoomMeetingsTimeline, roomMeetingsTimelineBookingDetail, roomMeetingsTimelineModal, site?.id, t]);

  const deleteRoomMeetingBookingDirect = useCallback(
    async (booking: MeetingBooking) => {
      const modal = roomMeetingsTimelineModal;
      if (!booking || !modal) return;
      try {
        await cancelMeeting(booking.id);
        push(
          booking.sendEmail
            ? t({ it: 'Meeting eliminato. Notifica email inviata ai partecipanti.', en: 'Meeting deleted. Email notification sent to participants.' })
            : t({ it: 'Meeting eliminato.', en: 'Meeting deleted.' }),
          'success'
        );
        await reloadRoomMeetingsTimeline(modal.roomId, modal.day);
      } catch (err: any) {
        push(err?.message || t({ it: 'Eliminazione meeting fallita.', en: 'Failed to delete meeting.' }), 'danger');
        throw err;
      }
    },
    [push, reloadRoomMeetingsTimeline, roomMeetingsTimelineModal, t]
  );

  const promptDeleteRoomMeetingBooking = useCallback((booking: MeetingBooking) => {
    if (!booking) return;
    setRoomMeetingTimelineContextMenu(null);
    setRoomMeetingDeleteModal({ booking, deleting: false, error: null });
  }, []);

  const confirmDeleteRoomMeetingBooking = useCallback(async () => {
    const modal = roomMeetingDeleteModal;
    if (!modal?.booking) return;
    setRoomMeetingDeleteModal((prev) => (prev ? { ...prev, deleting: true, error: null } : prev));
    try {
      await deleteRoomMeetingBookingDirect(modal.booking);
      setRoomMeetingDeleteModal(null);
    } catch (err: any) {
      setRoomMeetingDeleteModal((prev) =>
        prev ? { ...prev, deleting: false, error: err?.message || t({ it: 'Eliminazione meeting fallita.', en: 'Failed to delete meeting.' }) } : prev
      );
    }
  }, [deleteRoomMeetingBookingDirect, roomMeetingDeleteModal, t]);

  useEffect(() => {
    if (!roomMeetingTimelineContextMenu) return;
    const onDown = (evt: MouseEvent) => {
      const target = evt.target as Node | null;
      if (target && roomMeetingTimelineContextMenuRef.current?.contains(target)) return;
      setRoomMeetingTimelineContextMenu(null);
    };
    const onKey = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') setRoomMeetingTimelineContextMenu(null);
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [roomMeetingTimelineContextMenu]);

  useEffect(() => {
    if (!roomMeetingsTimelineModal) {
      setRoomMeetingTimelineContextMenu(null);
      setRoomMeetingDeleteModal(null);
    }
  }, [roomMeetingsTimelineModal]);

  useEffect(() => {
    if (roomMeetingsTimelineBookingDetail?.mode === 'edit') return;
    setRoomMeetingEditParticipantsModalOpen(false);
  }, [roomMeetingsTimelineBookingDetail?.mode]);

  return {
    addTimelineMeetingManualParticipant,
    addTimelineMeetingRealParticipant,
    adjustRoomMeetingEditEndTime,
    closeRoomMeetingBookingDetail,
    closeRoomMeetingEditParticipantsModal,
    closeRoomMeetingsTimelineModal,
    confirmDeleteRoomMeetingBooking,
    extendRoomMeetingBooking,
    getMeetingCheckInStats,
    getRoomMeetingCheckInEntries,
    jumpToTimelineMeetingFromSearch,
    meetingCheckInEntryKey,
    openRoomMeetingBookingDetail,
    openRoomMeetingDuplicateModal,
    openRoomMeetingEditParticipantsModal,
    openRoomMeetingsTimeline,
    promptDeleteRoomMeetingBooking,
    reloadRoomMeetingsTimeline,
    removeTimelineMeetingParticipant,
    restoreMyMeetingsFromSnapshot,
    roomMeetingCheckInListOpen,
    roomMeetingDeleteModal,
    roomMeetingDetailFocusRef,
    roomMeetingDuplicateModal,
    roomMeetingDuplicateRoomPickerOpen,
    roomMeetingDuplicateRoomPickerRef,
    roomMeetingEditBusinessPartnersModalOpen,
    roomMeetingEditManualCompanyIsOther,
    roomMeetingEditParticipantCandidates,
    roomMeetingEditParticipantsCloseGuardUntilRef,
    roomMeetingEditParticipantsModalOpen,
    roomMeetingEditParticipantsNameInputRef,
    roomMeetingExtendBusyId,
    roomMeetingNotesModalBooking,
    roomMeetingNotesModalState,
    roomMeetingNotesReturnToMyMeetings,
    roomMeetingTimelineContextMenu,
    roomMeetingTimelineContextMenuRef,
    roomMeetingsTimelineBookingDetail,
    roomMeetingsTimelineDetailCloseGuardUntilRef,
    roomMeetingsTimelineHighlightBookingId,
    roomMeetingsTimelineModal,
    roomMeetingsTimelineScrollRef,
    roomMeetingsTimelineSearchActiveIndex,
    roomMeetingsTimelineSearchError,
    roomMeetingsTimelineSearchInputRef,
    roomMeetingsTimelineSearchLoading,
    roomMeetingsTimelineSearchResults,
    roomMeetingsTimelineSearchTerm,
    saveRoomMeetingBookingEdit,
    saveRoomMeetingDuplicates,
    setRoomMeetingCheckInListOpen,
    setRoomMeetingDeleteModal,
    setRoomMeetingDuplicateModal,
    setRoomMeetingDuplicateRoomPickerOpen,
    setRoomMeetingEditBusinessPartnersModalOpen,
    setRoomMeetingEditManualCompanyIsOther,
    setRoomMeetingNotesModalBooking,
    setRoomMeetingNotesModalState,
    setRoomMeetingNotesReturnToMyMeetings,
    setRoomMeetingTimelineContextMenu,
    setRoomMeetingsTimelineBookingDetail,
    setRoomMeetingsTimelineModal,
    setRoomMeetingsTimelineSearchActiveIndex,
    setRoomMeetingsTimelineSearchError,
    setRoomMeetingsTimelineSearchResults,
    setRoomMeetingsTimelineSearchTerm,
    toggleTimelineMeetingParticipantFlag
  };
}
