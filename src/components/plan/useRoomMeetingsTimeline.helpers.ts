import { type MeetingBooking } from '../../api/meetings';

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
