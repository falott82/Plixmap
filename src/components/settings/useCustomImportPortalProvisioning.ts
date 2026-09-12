import { useCallback, useMemo, useRef, useState } from 'react';
import { adminFetchUsers, type AdminUserRow } from '../../api/auth';
import { ExternalUserRow, provisionPortalUserFromImported } from '../../api/customImport';
import { suggestPortalUsername } from './CustomImportPanel.helpers';

type ToastKind = 'success' | 'danger' | 'info';

// Portal-provisioning feature hook extracted from CustomImportPanel: owns the
// list of portal users (for "already linked" lookups) plus the provisioning
// dialog state/handlers (create a portal account from an imported user).
export const useCustomImportPortalProvisioning = (deps: {
  isSuperAdmin: boolean;
  authUser: { language?: string | null } | null | undefined;
  activeClientId: string | null;
  push: (message: string, kind?: ToastKind) => void;
  t: (label: { it: string; en: string }) => string;
}) => {
  const { isSuperAdmin, authUser, activeClientId, push, t } = deps;

  const [portalUsersLoading, setPortalUsersLoading] = useState(false);
  const [portalUsersRows, setPortalUsersRows] = useState<AdminUserRow[]>([]);
  const [portalProvisionModalOpen, setPortalProvisionModalOpen] = useState(false);
  const [portalProvisionSaving, setPortalProvisionSaving] = useState(false);
  const [portalProvisionSourceUser, setPortalProvisionSourceUser] = useState<ExternalUserRow | null>(null);
  const [portalProvisionForm, setPortalProvisionForm] = useState({
    username: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    language: 'it' as 'it' | 'en',
    access: 'ro' as 'ro' | 'rw',
    chat: true,
    canCreateMeetings: false,
    sendEmail: false
  });
  const [portalProvisionResult, setPortalProvisionResult] = useState<null | {
    userId: string;
    username: string;
    temporaryPassword: string;
    importedDisplayName: string;
    emailDelivery: {
      attempted: boolean;
      sent: boolean;
      reason?: string | null;
      messageId?: string | null;
      smtpScope?: 'client' | 'global' | null;
    };
  }>(null);
  const portalProvisionDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const portalProvisionResultFocusRef = useRef<HTMLButtonElement | null>(null);

  const portalUserByImportedKey = useMemo(() => {
    const map = new Map<string, AdminUserRow>();
    for (const row of portalUsersRows || []) {
      const clientId = String(row.linkedExternalClientId || '').trim();
      const externalId = String(row.linkedExternalId || '').trim();
      if (!clientId || !externalId) continue;
      map.set(`${clientId}:${externalId}`, row);
    }
    return map;
  }, [portalUsersRows]);

  const loadPortalUsers = useCallback(async () => {
    if (!isSuperAdmin) {
      setPortalUsersRows([]);
      setPortalUsersLoading(false);
      return [];
    }
    setPortalUsersLoading(true);
    try {
      const res = await adminFetchUsers();
      const rows = Array.isArray(res.users) ? res.users : [];
      setPortalUsersRows(rows);
      return rows;
    } catch {
      setPortalUsersRows([]);
      return [];
    } finally {
      setPortalUsersLoading(false);
    }
  }, [isSuperAdmin]);

  const openPortalProvisionModal = useCallback(
    (row: ExternalUserRow) => {
      setPortalProvisionSourceUser(row);
      setPortalProvisionForm({
        username: suggestPortalUsername(row),
        firstName: String(row.firstName || ''),
        lastName: String(row.lastName || ''),
        phone: String(row.mobile || ''),
        email: String(row.email || ''),
        language: authUser?.language === 'en' ? 'en' : 'it',
        access: 'ro',
        chat: true,
        canCreateMeetings: false,
        sendEmail: !!String(row.email || '').trim()
      });
      setPortalProvisionModalOpen(true);
    },
    [authUser?.language]
  );

  const copyPortalProvisionSecret = useCallback(async (mode: 'credentials' | 'password') => {
    if (!portalProvisionResult) return;
    const text =
      mode === 'password'
        ? portalProvisionResult.temporaryPassword
        : t({
            it: `Username: ${portalProvisionResult.username}\nPassword temporanea: ${portalProvisionResult.temporaryPassword}`,
            en: `Username: ${portalProvisionResult.username}\nTemporary password: ${portalProvisionResult.temporaryPassword}`
          });
    try {
      await navigator.clipboard.writeText(text);
      push(t({ it: 'Copiato negli appunti', en: 'Copied to clipboard' }), 'success');
    } catch {
      push(t({ it: 'Copia non riuscita', en: 'Copy failed' }), 'danger');
    }
  }, [portalProvisionResult, push, t]);

  const submitPortalProvision = useCallback(async () => {
    if (!portalProvisionSourceUser || !activeClientId) return;
    const emailValue = String(portalProvisionForm.email || '').trim();
    if (portalProvisionForm.sendEmail && !emailValue) {
      push(t({ it: 'Inserisci un indirizzo email per inviare le credenziali.', en: 'Enter an email address to send credentials.' }), 'info');
      return;
    }
    setPortalProvisionSaving(true);
    try {
      const res = await provisionPortalUserFromImported({
        clientId: activeClientId,
        externalId: String(portalProvisionSourceUser.externalId || ''),
        username: portalProvisionForm.username,
        firstName: portalProvisionForm.firstName,
        lastName: portalProvisionForm.lastName,
        phone: portalProvisionForm.phone,
        email: emailValue,
        language: portalProvisionForm.language,
        access: portalProvisionForm.access,
        chat: portalProvisionForm.chat,
        canCreateMeetings: portalProvisionForm.canCreateMeetings,
        sendEmail: portalProvisionForm.sendEmail
      });
      setPortalProvisionModalOpen(false);
      setPortalProvisionResult({
        userId: res.id,
        username: res.username,
        temporaryPassword: res.temporaryPassword,
        importedDisplayName:
          `${String(portalProvisionSourceUser.firstName || '').trim()} ${String(portalProvisionSourceUser.lastName || '').trim()}`.trim() ||
          String(portalProvisionSourceUser.email || portalProvisionSourceUser.externalId || ''),
        emailDelivery: res.emailDelivery
      });
      await loadPortalUsers();
      push(t({ it: 'Utente portale creato', en: 'Portal user created' }), 'success');
    } catch (err: any) {
      if (err?.suggestedUsername) {
        setPortalProvisionForm((prev) => ({ ...prev, username: String(err.suggestedUsername || '') }));
      }
      if (err?.existingUsername) {
        push(
          t({
            it: `Questo utente importato e gia collegato all'utente portale ${String(err.existingUsername || '')}.`,
            en: `This imported user is already linked to portal user ${String(err.existingUsername || '')}.`
          }),
          'info'
        );
        return;
      }
      push(
        err?.message ||
          t({ it: 'Creazione utente portale non riuscita', en: 'Failed to create portal user' }),
        'danger'
      );
    } finally {
      setPortalProvisionSaving(false);
    }
  }, [activeClientId, loadPortalUsers, portalProvisionForm, portalProvisionSourceUser, push, t]);

  return {
    portalUsersLoading,
    portalUserByImportedKey,
    portalProvisionModalOpen,
    setPortalProvisionModalOpen,
    portalProvisionSaving,
    portalProvisionSourceUser,
    portalProvisionForm,
    setPortalProvisionForm,
    portalProvisionResult,
    setPortalProvisionResult,
    portalProvisionDialogFocusRef,
    portalProvisionResultFocusRef,
    loadPortalUsers,
    openPortalProvisionModal,
    copyPortalProvisionSecret,
    submitPortalProvision
  };
};
