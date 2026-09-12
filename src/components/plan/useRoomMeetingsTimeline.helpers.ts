import { nanoid } from 'nanoid';
import { type MeetingBooking, type MeetingParticipant } from '../../api/meetings';
import { meetingClockFromTs, hmToMinutes, minutesToHm, meetingIsoDayFromTs } from './planViewTime';
import { currentLocalIsoDay } from '../../utils/localDate';

// Pure check-in helpers extracted from useRoomMeetingsTimeline. They derive a
// stable participant key and on-site/remote check-in stats purely from a
// booking (and an optional check map), with no component state.

export const meetingCheckInEntryKey = (entry: { tag?: string | null; label?: string | null; email?: string | null }) => {
  const tag = String(entry.tag || 'INT');
  const label = String(entry.label || '-').trim().toLowerCase();
  const email = String(entry.email || '').trim().toLowerCase();
  return `${tag}::${label}::${email}`;
};

export const getMeetingCheckInStats = (booking: MeetingBooking, checkMap?: Record<string, true> | null) => {
  const participants = Array.isArray(booking?.participants) ? booking.participants : [];
  const internalOnSite = participants
    .filter((p: any) => (p?.kind || 'real_user') !== 'manual' && !p?.remote)
    .map((p: any) => ({
      tag: p?.optional ? 'OPT' : 'INT',
      label: String(p?.fullName || p?.externalId || '-'),
      email: p?.email ? String(p.email) : null
    }));
  const manualOnSiteFromParticipants = participants
    .filter((p: any) => p?.kind === 'manual' && !p?.remote)
    .map((p: any) => ({
      tag: 'EXT',
      label: String(p?.fullName || p?.externalId || '-'),
      email: p?.email ? String(p.email) : null
    }));
  const manualSeen = new Set(
    manualOnSiteFromParticipants.map((g) => `${String(g.label || '').trim().toLowerCase()}::${String(g.email || '').trim().toLowerCase()}`)
  );
  const externalOnSiteLegacy = (Array.isArray((booking as any)?.externalGuestsDetails) ? (booking as any).externalGuestsDetails : [])
    .filter((g: any) => !g?.remote)
    .filter(
      (g: any) =>
        !manualSeen.has(`${String(g?.name || '').trim().toLowerCase()}::${String(g?.email || '').trim().toLowerCase()}`)
    )
    .map((g: any) => ({
      tag: 'EXT',
      label: String(g?.name || '-'),
      email: g?.email ? String(g.email) : null
    }));
  const entries = [...internalOnSite, ...manualOnSiteFromParticipants, ...externalOnSiteLegacy];
  const map = checkMap || {};
  const checked = entries.filter((e) => !!map[meetingCheckInEntryKey(e)]).length;
  const total = entries.length;
  const remoteInternal = participants.filter((p: any) => (p?.kind || 'real_user') !== 'manual' && !!p?.remote).length;
  const manualRemoteKeys = new Set(
    participants
      .filter((p: any) => p?.kind === 'manual' && !!p?.remote)
      .map(
        (p: any) =>
          `${String(p?.fullName || p?.externalId || '-').trim().toLowerCase()}::${String(p?.email || '').trim().toLowerCase()}`
      )
  );
  const remoteExternalLegacy = (Array.isArray((booking as any)?.externalGuestsDetails) ? (booking as any).externalGuestsDetails : [])
    .filter((g: any) => !!g?.remote)
    .filter(
      (g: any) =>
        !manualRemoteKeys.has(`${String(g?.name || '').trim().toLowerCase()}::${String(g?.email || '').trim().toLowerCase()}`)
    ).length;
  return {
    checked,
    total,
    percent: total > 0 ? Math.round((checked / total) * 100) : 0,
    remoteParticipants: remoteInternal + remoteExternalLegacy,
    internalOnSite: internalOnSite.length,
    externalOnSite: manualOnSiteFromParticipants.length + externalOnSiteLegacy.length
  };
};

// Compute the target slot when duplicating a booking onto another day, honoring
// the original time (or any/custom), clamped to "now" for today and the day end.
export const resolveRoomDuplicateSlot = (
  booking: MeetingBooking,
  dayIso: string,
  timeMode: 'same' | 'any_08_18' | 'custom' = 'same'
): { startHm: string; endHm: string; startMin: number; endMin: number } | null => {
  const startTs = Number(booking.startAt || 0);
  const endTs = Number(booking.endAt || 0);
  const sourceStartHm = meetingClockFromTs(startTs);
  const parsedSourceStartMin = hmToMinutes(sourceStartHm);
  if (!Number.isFinite(parsedSourceStartMin)) return null;
  const sourceStartMin = Number(parsedSourceStartMin);
  const durationMinRaw = Math.round((endTs - startTs) / 60_000);
  const durationMin = Math.max(1, Number.isFinite(durationMinRaw) ? durationMinRaw : 60);
  let startMin = timeMode === 'same' ? sourceStartMin : 0;
  const today = currentLocalIsoDay();
  if (dayIso === today) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    startMin = Math.max(startMin, nowMin);
  }
  const endMin = startMin + durationMin;
  if (endMin > 23 * 60 + 59) return null;
  return { startHm: minutesToHm(startMin), endHm: minutesToHm(endMin), startMin, endMin };
};

// Latest timestamp a booking may be extended to: min(end of day, next booking start).
export const getRoomMeetingExtendMaxEndTs = (booking: MeetingBooking, bookings: MeetingBooking[]) => {
  const currentEnd = Number(booking.endAt || 0);
  const dayEnd = (() => {
    const d = new Date(Number(booking.startAt || 0));
    d.setHours(23, 59, 0, 0);
    return d.getTime();
  })();
  const nextBoundary = (bookings || [])
    .filter((b) => String(b.id) !== String(booking.id) && Number((b as any).effectiveStartAt ?? b.startAt ?? 0) >= currentEnd)
    .sort((a, b) => Number((a as any).effectiveStartAt ?? a.startAt ?? 0) - Number((b as any).effectiveStartAt ?? b.startAt ?? 0))[0];
  const nextStart = nextBoundary ? Number((nextBoundary as any).effectiveStartAt ?? nextBoundary.startAt ?? 0) : Number.POSITIVE_INFINITY;
  return Math.min(dayEnd, nextStart);
};

export type SiteMeetingParticipantCandidate = {
  externalId: string;
  fullName: string;
  email: string | null;
  department?: string | null;
  phone?: string | null;
};

// Merge the site-wide participant candidates with the per-edit external roster,
// de-duplicated by externalId and sorted by full name. Pure.
export const computeRoomMeetingEditParticipantCandidates = (
  siteMeetingParticipantCandidates: SiteMeetingParticipantCandidate[],
  roomMeetingEditExternalCandidates: SiteMeetingParticipantCandidate[]
): SiteMeetingParticipantCandidate[] => {
  const byExternalId = new Map<string, SiteMeetingParticipantCandidate>();
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
};

export const computeRoomMeetingCheckInEntries = (
  booking: MeetingBooking,
  checkMap: Record<string, true> | null | undefined,
  tsMap: Record<string, number> | null | undefined,
  client: any
): Array<any> => {
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
};

export const buildRoomMeetingSearchMatches = (
  meetings: any[],
  term: string,
  noParticipantsLabel: string
): Array<{ booking: MeetingBooking; dayIso: string; participantsCount: number; participantsLabel: string }> => {
    const normalized = term.toLowerCase();
    const normalizedDigits = normalized.replace(/\D+/g, '');
    return (meetings || [])
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
            ? noParticipantsLabel
            : participantsCount <= 3
              ? participantNames.join(', ')
              : `${participantNames.slice(0, 3).join(', ')} +${participantsCount - 3}`;
        const dayIso = String((booking as any)?.occurrenceDate || '').trim() || meetingIsoDayFromTs(Number(booking.startAt || 0));
        return { booking, dayIso, participantsCount, participantsLabel };
      });
};

export const normalizeBookingParticipantsDraft = (
  booking: MeetingBooking,
  guestLabel: string
): Array<MeetingParticipant & { key: string; fullName: string; kind: 'real_user' | 'manual' }> =>
  (Array.isArray(booking.participants) ? booking.participants : []).map((row, idx) => {
    const kind: 'real_user' | 'manual' = row?.kind === 'manual' ? 'manual' : 'real_user';
    const externalId = String(row?.externalId || '').trim() || null;
    const fullName = String(row?.fullName || row?.externalId || '').trim() || (kind === 'manual' ? guestLabel : 'User');
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

export const computeTimelineScrollTargetPx = (
  bookings: any[],
  highlightBookingId: string | null | undefined,
  modalDay: string,
  scrollerClientWidth: number
): number | null => {
    let minMinutes = 7 * 60;
    let maxMinutes = 20 * 60;
    for (const booking of bookings || []) {
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
    const highlightedBooking = highlightBookingId
      ? (bookings || []).find((booking) => String(booking.id || '') === String(highlightBookingId))
      : null;
    if (highlightedBooking) {
      const start = new Date(Number(highlightedBooking.startAt || 0));
      const end = new Date(Number(highlightedBooking.endAt || 0));
      const startMinutes = start.getHours() * 60 + start.getMinutes();
      const endMinutes = end.getHours() * 60 + end.getMinutes();
      const midMinutes = (startMinutes + endMinutes) / 2;
      const x = labelColPx + ((midMinutes - minMinutes) / total) * timelineWidthPx;
      return Math.max(0, x - scrollerClientWidth / 2);
    }
    const nowDate = new Date();
    if (String(modalDay || '') !== currentLocalIsoDay()) return null;
    const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    const nowX = labelColPx + ((nowMinutes - minMinutes) / total) * timelineWidthPx;
    return Math.max(0, nowX - scrollerClientWidth / 2);
};
