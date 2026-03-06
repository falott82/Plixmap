import { apiFetch } from './client';

export interface MeetingParticipant {
  kind: 'real_user' | 'manual';
  externalId?: string | null;
  fullName?: string;
  email?: string | null;
  department?: string | null;
  optional?: boolean;
  remote?: boolean;
  company?: string | null;
}

export interface MeetingExternalGuest {
  name: string;
  email?: string | null;
  sendEmail?: boolean;
  remote?: boolean;
}

export interface SiteSupportContacts {
  cleaning?: { email?: string; phone?: string };
  it?: { email?: string; phone?: string };
  coffee?: { email?: string; phone?: string };
}

export interface MeetingBooking {
  id: string;
  meetingNumber?: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvalRequired: boolean;
  clientId: string;
  siteId: string;
  floorPlanId: string;
  roomId: string;
  roomName: string;
  subject: string;
  requestedSeats: number;
  roomCapacity: number;
  equipment: string[];
  participants: MeetingParticipant[];
  externalGuests: boolean;
  externalGuestsList: string[];
  externalGuestsDetails?: MeetingExternalGuest[];
  sendEmail: boolean;
  technicalSetup: boolean;
  technicalEmail: string;
  notes: string;
  videoConferenceLink: string;
  kioskLanguage?: 'it' | 'en' | 'ru' | 'ar' | 'zh' | null;
  setupBufferBeforeMin: number;
  setupBufferAfterMin: number;
  startAt: number;
  endAt: number;
  effectiveStartAt: number;
  effectiveEndAt: number;
  multiDayGroupId: string | null;
  occurrenceDate: string;
  followUpOfMeetingId?: string | null;
  followUpSequence?: number;
  requestedById: string;
  requestedByUsername: string;
  requestedByEmail: string;
  meetingAdminIds: string[];
  requestedAt: number;
  reviewedAt: number | null;
  reviewedById: string | null;
  reviewedByUsername: string | null;
  rejectReason: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MeetingManagerAction {
  action: string;
  assignedTo: string;
  openingDate?: string;
  completionDate: string;
  progressPct?: number;
  status?: 'open' | 'done' | 'not_needed' | 'reschedule';
}

export interface MeetingManagerFields {
  meetingId: string;
  topicsText: string;
  summaryText: string;
  actions: MeetingManagerAction[];
  nextMeetingDate: string;
  updatedAt: number;
  updatedById: string;
  updatedByUsername: string;
}

export interface MeetingFollowUpChainEntry {
  meeting: MeetingBooking;
  managerFields: MeetingManagerFields;
  canManageMeeting: boolean;
  isCurrent: boolean;
}

export interface MeetingNote {
  id: string;
  meetingId: string;
  authorUserId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorExternalId?: string;
  authorEmail?: string;
  title: string;
  contentText: string;
  contentHtml?: string;
  contentLexical?: string;
  shared: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MeetingNoteParticipant {
  key: string;
  kind: 'internal' | 'external';
  label: string;
  email?: string | null;
  department?: string | null;
  company?: string | null;
  remote?: boolean;
  optional?: boolean;
  sharedCount: number;
  hasShared: boolean;
}

export type MeetingCheckInMapByMeetingId = Record<string, Record<string, true>>;
export type MeetingCheckInTimestampsByMeetingId = Record<string, Record<string, number>>;

export interface MeetingRoomOverviewRow {
  clientId: string;
  clientName: string;
  siteId: string;
  siteName: string;
  siteSupportContacts?: SiteSupportContacts | null;
  floorPlanId: string;
  floorPlanName: string;
  roomId: string;
  roomName: string;
  isMeetingRoom: boolean;
  capacity: number;
  currentPeople: number;
  availableSeats: number;
  equipment: string[];
  surfaceSqm?: number | null;
  shape?:
    | { kind: 'rect'; x: number; y: number; width: number; height: number }
    | { kind: 'poly'; points: Array<{ x: number; y: number }> };
  hasMeetingToday: boolean;
  inProgress: boolean;
  bookings: MeetingBooking[];
  slotConflicts: MeetingBooking[];
}

export interface MeetingOverviewResponse {
  rooms: MeetingRoomOverviewRow[];
  checkInStatusByMeetingId?: MeetingCheckInMapByMeetingId;
  checkInTimestampsByMeetingId?: MeetingCheckInTimestampsByMeetingId;
  meta: {
    day: string;
    siteId: string;
    floorPlanId: string | null;
    slot: null | {
      startTime: string;
      endTime: string;
      setupBufferBeforeMin: number;
      setupBufferAfterMin: number;
    };
  };
}

export const fetchMeetingOverview = async (params: {
  clientId?: string;
  siteId: string;
  floorPlanId?: string;
  day?: string;
  startTime?: string;
  endTime?: string;
  setupBufferBeforeMin?: number;
  setupBufferAfterMin?: number;
  includeNonMeeting?: boolean;
}): Promise<MeetingOverviewResponse> => {
  const qs = new URLSearchParams();
  if (params.clientId) qs.set('clientId', params.clientId);
  qs.set('siteId', params.siteId);
  if (params.floorPlanId) qs.set('floorPlanId', params.floorPlanId);
  if (params.day) qs.set('day', params.day);
  if (params.startTime) qs.set('startTime', params.startTime);
  if (params.endTime) qs.set('endTime', params.endTime);
  if (params.setupBufferBeforeMin !== undefined) qs.set('setupBufferBeforeMin', String(params.setupBufferBeforeMin));
  if (params.setupBufferAfterMin !== undefined) qs.set('setupBufferAfterMin', String(params.setupBufferAfterMin));
  if (params.includeNonMeeting) qs.set('includeNonMeeting', '1');
  const res = await apiFetch(`/api/meetings/overview?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch meeting overview (${res.status})`);
  return res.json();
};

export const fetchMeetings = async (params?: {
  siteId?: string;
  roomId?: string;
  status?: string;
  fromAt?: number;
  toAt?: number;
}): Promise<{ meetings: MeetingBooking[] }> => {
  const qs = new URLSearchParams();
  if (params?.siteId) qs.set('siteId', params.siteId);
  if (params?.roomId) qs.set('roomId', params.roomId);
  if (params?.status) qs.set('status', params.status);
  if (params?.fromAt !== undefined) qs.set('fromAt', String(params.fromAt));
  if (params?.toAt !== undefined) qs.set('toAt', String(params.toAt));
  const url = qs.toString() ? `/api/meetings?${qs.toString()}` : '/api/meetings';
  const res = await apiFetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch meetings (${res.status})`);
  return res.json();
};

export const fetchMyMeetings = async (params?: {
  fromAt?: number;
  toAt?: number;
  limit?: number;
}): Promise<{
  meetings: MeetingBooking[];
  now: number;
  counts: { total: number; inProgress: number; upcoming: number; past: number };
}> => {
  const qs = new URLSearchParams();
  if (params?.fromAt !== undefined) qs.set('fromAt', String(params.fromAt));
  if (params?.toAt !== undefined) qs.set('toAt', String(params.toAt));
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  const url = qs.toString() ? `/api/meetings/mine?${qs.toString()}` : '/api/meetings/mine';
  const res = await apiFetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch my meetings (${res.status})`);
  return res.json();
};

export const fetchPendingMeetings = async (): Promise<{ pending: MeetingBooking[]; pendingCount: number }> => {
  const res = await apiFetch('/api/meetings/pending', { credentials: 'include', cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch pending meetings (${res.status})`);
  return res.json();
};

export const fetchMeetingLog = async (params?: { q?: string; limit?: number; format?: 'json' | 'csv' }) => {
  const qs = new URLSearchParams();
  if (params?.q) qs.set('q', params.q);
  if (params?.limit !== undefined) qs.set('limit', String(params.limit));
  if (params?.format === 'csv') qs.set('format', 'csv');
  const res = await apiFetch(`/api/meetings/log?${qs.toString()}`, { credentials: 'include', cache: 'no-store' });
  if (params?.format === 'csv') {
    if (!res.ok) throw new Error(`Failed to export meeting log (${res.status})`);
    return res.blob();
  }
  if (!res.ok) throw new Error(`Failed to fetch meeting log (${res.status})`);
  return res.json();
};

export const createMeeting = async (payload: {
  clientId: string;
  siteId: string;
  floorPlanId?: string;
  roomId: string;
  subject: string;
  requestedSeats: number;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  setupBufferBeforeMin?: number;
  setupBufferAfterMin?: number;
  participants?: MeetingParticipant[];
  meetingAdminIds?: string[];
  externalGuests?: boolean;
  externalGuestsList?: string[];
  externalGuestsDetails?: MeetingExternalGuest[];
  sendEmail?: boolean;
  technicalSetup?: boolean;
  technicalEmail?: string;
  notes?: string;
  videoConferenceLink?: string;
  kioskLanguage?: 'it' | 'en' | 'ru' | 'ar' | 'zh' | 'auto' | null;
  roomSnapshotPngDataUrl?: string;
  followUpOfMeetingId?: string;
}) => {
  const res = await apiFetch('/api/meetings', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error || `Failed to create meeting (${res.status})`);
    if (body?.conflictsByDay) err.conflictsByDay = body.conflictsByDay;
    if (body?.missingEmails) err.missingEmails = body.missingEmails;
    throw err;
  }
  return body as { ok: true; status: MeetingBooking['status']; approvalRequired: boolean; bookings: MeetingBooking[]; warnings?: string[] };
};

export const reviewMeeting = async (id: string, payload: { action: 'approve' | 'reject'; reason?: string }) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(id)}/review`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error || `Failed to review meeting (${res.status})`);
    if (body?.conflicts) err.conflicts = body.conflicts;
    throw err;
  }
  return body as { ok: true; booking: MeetingBooking; pendingCount: number };
};

export const updateMeeting = async (
  id: string,
  payload: {
    subject?: string;
    day?: string;
    startTime?: string;
    endTime?: string;
    notes?: string;
    videoConferenceLink?: string;
    kioskLanguage?: 'it' | 'en' | 'ru' | 'ar' | 'zh' | 'auto' | null;
    setupBufferBeforeMin?: number;
    setupBufferAfterMin?: number;
    participants?: MeetingParticipant[];
    meetingAdminIds?: string[];
    externalGuestsDetails?: MeetingExternalGuest[];
    applyToSeries?: boolean;
  }
) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error || `Failed to update meeting (${res.status})`);
    if (body?.conflicts) err.conflicts = body.conflicts;
    throw err;
  }
  return body as { ok: true; booking: MeetingBooking };
};

export const cancelMeeting = async (id: string, payload?: { reason?: string }) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  if (!res.ok) throw new Error(`Failed to cancel meeting (${res.status})`);
  return res.json() as Promise<{ ok: true; booking: MeetingBooking }>;
};

export const fetchMeetingRoomSchedule = async (roomId: string) => {
  const res = await apiFetch(`/api/meeting-room/${encodeURIComponent(roomId)}/schedule`, {
    credentials: 'omit',
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`Failed to fetch meeting room schedule (${res.status})`);
  return res.json() as Promise<{
    room: MeetingRoomOverviewRow;
    now: number;
    inProgress: MeetingBooking | null;
    upcoming: MeetingBooking[];
    daySchedule: MeetingBooking[];
    checkInStatusByMeetingId?: MeetingCheckInMapByMeetingId;
    checkInTimestampsByMeetingId?: MeetingCheckInTimestampsByMeetingId;
    kioskPublicUrl?: string;
    mobilePublicUrl?: string;
  }>;
};

export const toggleMeetingRoomCheckIn = async (roomId: string, payload: { meetingId: string; key: string; checked: boolean }) => {
  const res = await apiFetch(`/api/meeting-room/${encodeURIComponent(roomId)}/checkin-toggle`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(body?.error || `Failed to update check-in (${res.status})`);
    throw err;
  }
  return body as { ok: true; meetingId: string; checkInMap: Record<string, true>; checkInTimestamps?: Record<string, number> };
};

export const sendMeetingRoomHelpRequest = async (
  roomId: string,
  payload: { service: 'it' | 'cleaning' | 'coffee' }
) => {
  const res = await apiFetch(`/api/meeting-room/${encodeURIComponent(roomId)}/help-request`, {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error || `Failed to send help request (${res.status})`);
  }
  return body as { ok: true; service: string };
};

export const fetchMeetingNotes = async (meetingId: string) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}/notes`, {
    credentials: 'include',
    cache: 'no-store'
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed to fetch meeting notes (${res.status})`);
  return body as {
    ok: true;
    meetingId: string;
    meeting: MeetingBooking;
    notes: MeetingNote[];
    participants: MeetingNoteParticipant[];
    canManageMeeting?: boolean;
    managerFields?: MeetingManagerFields;
    followUpChain?: MeetingFollowUpChainEntry[];
    checkInStatusByMeetingId?: MeetingCheckInMapByMeetingId;
    checkInTimestampsByMeetingId?: MeetingCheckInTimestampsByMeetingId;
  };
};

export const fetchMeetingManagerFields = async (meetingId: string) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}/manager-fields`, {
    credentials: 'include',
    cache: 'no-store'
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed to fetch manager fields (${res.status})`);
  return body as {
    ok: true;
    meetingId: string;
    managerFields: MeetingManagerFields;
    canManageMeeting: boolean;
  };
};

export const updateMeetingManagerFields = async (
  meetingId: string,
  payload: {
    topicsText?: string;
    summaryText?: string;
    actions?: MeetingManagerAction[];
    nextMeetingDate?: string;
  }
) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}/manager-fields`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed to update manager fields (${res.status})`);
  return body as {
    ok: true;
    meetingId: string;
    managerFields: MeetingManagerFields;
    canManageMeeting: boolean;
  };
};

export const upsertMeetingNote = async (
  meetingId: string,
  payload: {
    id?: string;
    title?: string;
    contentText?: string;
    contentHtml?: string;
    contentLexical?: string;
    shared?: boolean;
  }
) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}/notes`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed to save meeting note (${res.status})`);
  return body as { ok: true; note: MeetingNote };
};

export const deleteMeetingNote = async (meetingId: string, noteId: string) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}/notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error || `Failed to delete meeting note (${res.status})`);
  return body as { ok: true };
};

export const exportMeetingNotesCsv = async (meetingId: string) => {
  const res = await apiFetch(`/api/meetings/${encodeURIComponent(meetingId)}/notes-export`, {
    credentials: 'include',
    cache: 'no-store'
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any)?.error || `Failed to export meeting notes (${res.status})`);
  }
  return res.blob();
};
