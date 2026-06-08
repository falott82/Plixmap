import { type MeetingBooking } from '../../api/meetings';
import { meetingClockFromTs, hmToMinutes, minutesToHm } from './planViewTime';
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
