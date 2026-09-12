/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useMemo } from 'react';
import { type MeetingBooking } from '../../api/meetings';

// Plan access + meeting permission derivations (read/write access, super-admin / meeting-admin
// flags, meeting scheduling + notes capability) extracted from usePlanView. Pure derivations of
// the current user + permission scopes; bodies moved verbatim (dep arrays preserved exactly).
export const usePlanAccessPermissions = (deps: any) => {
  const { user, permissions, planId, site, client } = deps;

  const planAccess = useMemo<'ro' | 'rw'>(() => {
    if (!user) return 'ro';
    if (user.isAdmin) return 'rw';
    const planPerm = permissions.find((p: any) => p.scopeType === 'plan' && p.scopeId === planId);
    if (planPerm) return planPerm.access;
    if (site?.id) {
      const sitePerm = permissions.find((p: any) => p.scopeType === 'site' && p.scopeId === site.id);
      if (sitePerm) return sitePerm.access;
    }
    if (client?.id) {
      const clientPerm = permissions.find((p: any) => p.scopeType === 'client' && p.scopeId === client.id);
      if (clientPerm) return clientPerm.access;
    }
    return 'ro';
  }, [client?.id, permissions, planId, site?.id, user]);
  const isSuperAdmin = !!user?.isSuperAdmin && user?.username === 'superadmin';
  const isMeetingAdminLike = !!user?.isAdmin || !!user?.isSuperAdmin;
  const canManageMeetingScheduling = useMemo(
    () =>
      isMeetingAdminLike ||
      !!(user as any)?.canCreateMeetings ||
      !!(user as any)?.isMeetingOperator,
    [isMeetingAdminLike, user]
  );
  const canUseMeetingNotes = useCallback(
    (booking: MeetingBooking | null | undefined) => {
      if (!booking) return false;
      if (isMeetingAdminLike) return true;
      const linkedExternalClientId = String((user as any)?.linkedExternalClientId || '').trim();
      const linkedExternalId = String((user as any)?.linkedExternalId || '').trim();
      const userEmail = String(user?.email || '').trim().toLowerCase();
      const participants = Array.isArray(booking.participants) ? booking.participants : [];
      return participants.some((row) => {
        if (String(row?.kind || 'real_user') === 'manual') return false;
        const participantExternalId = String(row?.externalId || '').trim();
        const participantEmail = String(row?.email || '').trim().toLowerCase();
        if (linkedExternalId && linkedExternalClientId && linkedExternalClientId === String(booking.clientId || '') && participantExternalId === linkedExternalId) {
          return true;
        }
        return !!userEmail && !!participantEmail && participantEmail === userEmail;
      });
    },
    [isMeetingAdminLike, user]
  );

  return { planAccess, isSuperAdmin, isMeetingAdminLike, canManageMeetingScheduling, canUseMeetingNotes };
};
