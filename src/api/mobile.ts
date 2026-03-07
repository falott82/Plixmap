import { apiFetch } from './client';
import type { MeetingBooking, MeetingCheckInMapByMeetingId, MeetingCheckInTimestampsByMeetingId } from './meetings';

export type MobileAgendaMeeting = MeetingBooking & {
  clientName: string;
  siteName: string;
  floorPlanName: string;
  participantMatch?: {
    kind: 'real_user';
    externalId: string;
    fullName: string;
    email: string;
    optional?: boolean;
    remote?: boolean;
  };
};

export type MobileAgendaResponse = {
  ok: true;
  day: string;
  mobilePublicUrl?: string;
  linkedUser: {
    clientId: string;
    externalId: string;
    fullName: string;
    portalEmail: string;
    importedEmail: string;
  };
  meetings: MobileAgendaMeeting[];
  checkInStatusByMeetingId?: MeetingCheckInMapByMeetingId;
  checkInTimestampsByMeetingId?: MeetingCheckInTimestampsByMeetingId;
};

export type MobileAgendaMonthResponse = {
  ok: true;
  month: string;
  linkedUser: {
    clientId: string;
    externalId: string;
    fullName: string;
    portalEmail: string;
    importedEmail: string;
  };
  days: Record<string, number>;
};

export const fetchMobileAppUrl = async (): Promise<{ url: string }> => {
  const res = await apiFetch('/api/mobile/app-url', { credentials: 'include', cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed to fetch mobile app url (${res.status})`);
  return body as { url: string };
};

export const fetchMobileAgenda = async (day: string): Promise<MobileAgendaResponse> => {
  const qs = new URLSearchParams();
  if (day) qs.set('day', day);
  const res = await apiFetch(`/api/mobile/agenda?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed to fetch mobile agenda (${res.status})`);
  return body as MobileAgendaResponse;
};

export const fetchMobileAgendaMonth = async (month: string): Promise<MobileAgendaMonthResponse> => {
  const qs = new URLSearchParams();
  if (month) qs.set('month', month);
  const res = await apiFetch(`/api/mobile/agenda-month?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed to fetch mobile agenda month (${res.status})`);
  return body as MobileAgendaMonthResponse;
};

export const mobileCheckInMeeting = async (meetingId: string, checked = true) => {
  const res = await apiFetch('/api/mobile/checkin', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, checked })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed mobile check-in (${res.status})`);
  return body as {
    ok: true;
    meetingId: string;
    checked: boolean;
    roomId: string;
    participantName: string;
    key: string;
    checkInMap: Record<string, true>;
    checkInTimestamps: Record<string, number>;
  };
};
