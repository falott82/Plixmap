import { useCallback, useMemo, useRef, useState } from 'react';
import {
  createManualExternalUser,
  deleteManualExternalUser,
  ExternalUserRow,
  updateExternalUser
} from '../../api/customImport';

type ToastKind = 'success' | 'danger' | 'info';

// Manual-users feature hook extracted from CustomImportPanel: owns the
// create/edit manual-user dialog state plus save/remove handlers. The users
// list (usersRows), assignment guard, and reload functions are injected so the
// hook stays decoupled from the rest of the panel.
export const useCustomImportManualUsers = (deps: {
  activeClientId: string | null;
  usersRows: ExternalUserRow[];
  assignedCounts: Map<string, number>;
  loadSummary: () => Promise<unknown> | void;
  loadUsers: (clientId: string) => Promise<unknown> | void;
  push: (message: string, kind?: ToastKind) => void;
  t: (label: { it: string; en: string }) => string;
}) => {
  const { activeClientId, usersRows, assignedCounts, loadSummary, loadUsers, push, t } = deps;

  const [manualUserModalOpen, setManualUserModalOpen] = useState(false);
  const [manualUserEditingId, setManualUserEditingId] = useState<string | null>(null);
  const [manualUserEditingKind, setManualUserEditingKind] = useState<'manual' | 'imported' | null>(null);
  const [manualUserSaving, setManualUserSaving] = useState(false);
  const [manualUserDeletingId, setManualUserDeletingId] = useState<string | null>(null);
  const [manualDeleteCandidate, setManualDeleteCandidate] = useState<ExternalUserRow | null>(null);
  const [manualUserForm, setManualUserForm] = useState({
    externalId: '',
    firstName: '',
    lastName: '',
    role: '',
    dept1: '',
    dept2: '',
    dept3: '',
    email: '',
    mobile: '',
    ext1: '',
    ext2: '',
    ext3: '',
    isExternal: false
  });
  const manualUserDialogFocusRef = useRef<HTMLButtonElement | null>(null);

  const manualRowsCount = useMemo(
    () => usersRows.filter((r) => r.manual || String(r.externalId || '').toLowerCase().startsWith('manual:')).length,
    [usersRows]
  );

  const resetManualUserForm = useCallback(() => {
    setManualUserEditingId(null);
    setManualUserEditingKind(null);
    setManualUserForm({
      externalId: '',
      firstName: '',
      lastName: '',
      role: '',
      dept1: '',
      dept2: '',
      dept3: '',
      email: '',
      mobile: '',
      ext1: '',
      ext2: '',
      ext3: '',
      isExternal: false
    });
  }, []);

  const openManualUserCreate = useCallback(() => {
    resetManualUserForm();
    setManualUserEditingKind('manual');
    setManualUserModalOpen(true);
  }, [resetManualUserForm]);

  const openManualUserEdit = useCallback((row: ExternalUserRow) => {
    setManualUserEditingId(row.externalId);
    setManualUserEditingKind((row.manual || String(row.externalId || '').toLowerCase().startsWith('manual:')) ? 'manual' : 'imported');
    setManualUserForm({
      externalId: row.externalId,
      firstName: row.firstName || '',
      lastName: row.lastName || '',
      role: row.role || '',
      dept1: row.dept1 || '',
      dept2: row.dept2 || '',
      dept3: row.dept3 || '',
      email: row.email || '',
      mobile: row.mobile || '',
      ext1: row.ext1 || '',
      ext2: row.ext2 || '',
      ext3: row.ext3 || '',
      isExternal: !!row.isExternal
    });
    setManualUserModalOpen(true);
  }, []);

  const saveManualUser = async () => {
    if (!activeClientId) return;
    const hasIdentity = !!manualUserForm.firstName.trim() || !!manualUserForm.lastName.trim() || !!manualUserForm.email.trim();
    if (!hasIdentity) {
      push(t({ it: 'Compila almeno nome, cognome o email.', en: 'Fill at least first name, last name or email.' }), 'info');
      return;
    }
    const emailKey = String(manualUserForm.email || '').trim().toLowerCase();
    const firstKey = String(manualUserForm.firstName || '').trim().toLowerCase();
    const lastKey = String(manualUserForm.lastName || '').trim().toLowerCase();
    const possibleDuplicate = usersRows.find((r) => {
      if (manualUserEditingId && r.externalId === manualUserEditingId) return false;
      const re = String(r.email || '').trim().toLowerCase();
      if (emailKey && re && emailKey === re) return true;
      if (!emailKey) {
        const rf = String(r.firstName || '').trim().toLowerCase();
        const rl = String(r.lastName || '').trim().toLowerCase();
        if ((firstKey || lastKey) && rf === firstKey && rl === lastKey) return true;
      }
      return false;
    });
    if (possibleDuplicate) {
      push(
        t({
          it: 'Possibile duplicato rilevato (stessa email oppure nome+cognome). Modifica il record esistente o cambia i dati.',
          en: 'Possible duplicate detected (same email or same first+last name). Edit the existing record or change the data.'
        }),
        'info'
      );
      return;
    }
    setManualUserSaving(true);
    try {
      if (manualUserEditingId) {
        await updateExternalUser({
          clientId: activeClientId,
          externalId: manualUserEditingId,
          user: manualUserForm
        });
        push(
          manualUserEditingKind === 'imported'
            ? t({ it: 'Utente importato aggiornato nel contenitore locale', en: 'Imported user updated in the local container' })
            : t({ it: 'Utente manuale aggiornato', en: 'Manual user updated' }),
          'success'
        );
      } else {
        await createManualExternalUser({
          clientId: activeClientId,
          user: manualUserForm
        });
        push(t({ it: 'Utente manuale creato', en: 'Manual user created' }), 'success');
      }
      setManualUserModalOpen(false);
      resetManualUserForm();
      await loadSummary();
      await loadUsers(activeClientId);
    } catch (err: any) {
      push(err?.message || t({ it: 'Operazione fallita', en: 'Operation failed' }), 'danger');
    } finally {
      setManualUserSaving(false);
    }
  };

  const removeManualUser = async (row: ExternalUserRow) => {
    if (!activeClientId) return;
    const assigned = assignedCounts.get(`${row.clientId}:${row.externalId}`) || 0;
    if (assigned > 0) {
      push(
        t({
          it: `Impossibile rimuovere: utente assegnato a ${assigned} oggetti. Rimuovi prima le assegnazioni.`,
          en: `Cannot delete: user is assigned to ${assigned} objects. Remove assignments first.`
        }),
        'info'
      );
      return;
    }
    setManualUserDeletingId(row.externalId);
    try {
      await deleteManualExternalUser({ clientId: activeClientId, externalId: row.externalId });
      push(t({ it: 'Utente manuale rimosso', en: 'Manual user removed' }), 'success');
      await loadSummary();
      await loadUsers(activeClientId);
    } catch (err: any) {
      push(err?.message || t({ it: 'Rimozione fallita', en: 'Delete failed' }), 'danger');
    } finally {
      setManualUserDeletingId(null);
    }
  };

  return {
    manualUserModalOpen,
    setManualUserModalOpen,
    manualUserEditingId,
    manualUserEditingKind,
    manualUserSaving,
    manualUserDeletingId,
    manualDeleteCandidate,
    setManualDeleteCandidate,
    manualUserForm,
    setManualUserForm,
    manualUserDialogFocusRef,
    manualRowsCount,
    openManualUserCreate,
    openManualUserEdit,
    saveManualUser,
    removeManualUser
  };
};
