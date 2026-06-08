import { type MeetingBooking } from '../../api/meetings';
// Pure date/time/geometry/coordinate helpers extracted from SidebarTree.tsx.

export const parseCoords = (value: string | undefined): { lat: number; lng: number } | null => {
  const s = String(value || '').trim();
  if (!s) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
};

export const formatTs = (value?: number | null): string => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

export const formatMinutes = (value?: number | null): string => {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  // Keep 0.5 steps readable.
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

export const toEpochMs = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return numeric;
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const roomPolygonPoints = (room: any): Array<{ x: number; y: number }> => {
  const shape = (room as any)?.shape || null;
  if (shape?.kind === 'poly' && Array.isArray(shape.points)) {
    return shape.points
      .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
      .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  if (Array.isArray((room as any)?.points)) {
    return (room as any).points
      .map((p: any) => ({ x: Number(p?.x), y: Number(p?.y) }))
      .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y));
  }
  const rect =
    shape?.kind === 'rect'
      ? { x: Number(shape?.x), y: Number(shape?.y), width: Number(shape?.width), height: Number(shape?.height) }
      : {
          x: Number((room as any)?.x),
          y: Number((room as any)?.y),
          width: Number((room as any)?.width),
          height: Number((room as any)?.height)
        };
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return [];
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ];
};

export const polygonCenter = (points: Array<{ x: number; y: number }>): { x: number; y: number } | null => {
  if (!Array.isArray(points) || points.length < 3) return null;
  let sumX = 0;
  let sumY = 0;
  for (const p of points) {
    sumX += Number(p.x) || 0;
    sumY += Number(p.y) || 0;
  }
  return { x: sumX / points.length, y: sumY / points.length };
};

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const shiftIsoDay = (isoDay: string, deltaDays: number) => {
  const base = String(isoDay || '').trim() || todayIso();
  const [y, m, d] = base.split('-').map(Number);
  const dt = new Date(Number.isFinite(y) ? y : new Date().getFullYear(), Number.isFinite(m) ? m - 1 : 0, Number.isFinite(d) ? d : 1);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

export const monthAnchorFromIso = (iso: string) => {
  const d = new Date(`${String(iso || '').trim() || todayIso()}T00:00:00`);
  if (!Number.isFinite(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const shiftMonthAnchor = (anchorIso: string, deltaMonths: number) => {
  const d = new Date(`${String(anchorIso || '').trim() || monthAnchorFromIso(todayIso())}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return monthAnchorFromIso(todayIso());
  d.setMonth(d.getMonth() + deltaMonths);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const timeHmFromTs = (value: number) => {
  const d = new Date(Number(value || 0));
  if (!Number.isFinite(d.getTime())) return '00:00';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const hmToMinutes = (hm: string): number => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
  if (!m) return 0;
  const h = Math.max(0, Math.min(23, Number(m[1]) || 0));
  const mm = Math.max(0, Math.min(59, Number(m[2]) || 0));
  return h * 60 + mm;
};

export const minutesToHm = (totalMinutes: number): string => {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.floor(Number(totalMinutes) || 0)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export const localTsFromIsoHm = (isoDay: string, hm: string): number | null => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDay || '').trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec(String(hm || '').trim());
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


export const meetingCheckInEntryKey = (entry: { tag?: string | null; label?: string | null; email?: string | null }) => {
    const tag = String(entry.tag || 'INT');
    const label = String(entry.label || '-').trim().toLowerCase();
    const email = String(entry.email || '').trim().toLowerCase();
    return `${tag}::${label}::${email}`;
  };

export const getClientMeetingCheckInStats = (booking: MeetingBooking, checkMap?: Record<string, true> | null) => {
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

export const computeClientMeetingCheckInEntries = (
  booking: MeetingBooking,
  checkMap: Record<string, true> | null | undefined,
  tsMap: Record<string, number> | null | undefined,
  selectedClient: any
) => {
    const checked = checkMap || {};
    const timestamps = tsMap || {};
    const clientLogo = String((selectedClient as any)?.logoUrl || '').trim() || null;
    const businessPartners = Array.isArray((selectedClient as any)?.businessPartners)
      ? (((selectedClient as any).businessPartners as any[]) || [])
      : [];
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
          company: (selectedClient as any)?.shortName || (selectedClient as any)?.name || null,
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
        const company = String((p as any)?.company || '').trim();
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
