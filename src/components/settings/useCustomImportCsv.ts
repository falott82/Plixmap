import { useRef, useState } from 'react';
import { ExternalUserRow, importCsv } from '../../api/customImport';
import { fetchState } from '../../api/state';
import { useDataStore } from '../../store/useDataStore';
import { rowsHaveDuplicates } from './CustomImportPanel.helpers';

type ToastKind = 'success' | 'danger' | 'info';

// CSV-import feature hook extracted from CustomImportPanel: owns the staged CSV
// file + confirm dialog and the template download / import handlers. Reload and
// cross-feature UI signals (users list, duplicates modal, webapi preview) are
// injected so the hook stays decoupled.
export const useCustomImportCsv = (deps: {
  activeClient: { name?: string | null; shortName?: string | null } | null | undefined;
  activeClientId: string | null;
  loadSummary: () => Promise<unknown> | void;
  loadUsers: (clientId: string) => Promise<ExternalUserRow[] | unknown> | void;
  refreshWebApiPreview: (clientId: string) => Promise<unknown> | void;
  setUsersOpen: (open: boolean) => void;
  setDuplicatesModalOpen: (open: boolean) => void;
  push: (message: string, kind?: ToastKind) => void;
  t: (label: { it: string; en: string }) => string;
}) => {
  const { activeClient, activeClientId, loadSummary, loadUsers, refreshWebApiPreview, setUsersOpen, setDuplicatesModalOpen, push, t } = deps;
  const setServerState = useDataStore((s) => s.setServerState);

  const [csvFile, setCsvFile] = useState<{ name: string; text: string } | null>(null);
  const [csvConfirmOpen, setCsvConfirmOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const csvConfirmDialogFocusRef = useRef<HTMLButtonElement | null>(null);

  const handleCsvFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setCsvFile({ name: file.name, text });
      setCsvConfirmOpen(true);
    };
    reader.readAsText(file);
  };

  const downloadCsvTemplate = () => {
    const safeClientName = String(activeClient?.shortName || activeClient?.name || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    const template = [
      'firstName,lastName,role,dept1,dept2,dept3,email,mobile,ext1,ext2,ext3,isExternal',
      'Mario,Rossi,HR,People,,,mario.rossi@example.com,+39 333 1234567,101,,,"0"'
    ].join('\n');
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeClientName ? `${safeClientName}-users-import-template.csv` : 'users-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const runCsvImport = async (mode: 'append' | 'replace') => {
    if (!activeClientId || !csvFile) return;
    setCsvImporting(true);
    setCsvConfirmOpen(false);
    try {
      const res = await importCsv({ clientId: activeClientId, csvText: csvFile.text, mode });
      push(
        t({
          it: `Import CSV completato (${res.summary?.created ?? 0} nuovi, ${res.summary?.updated ?? 0} aggiornati).`,
          en: `CSV import completed (${res.summary?.created ?? 0} new, ${res.summary?.updated ?? 0} updated).`
        }),
        'success'
      );
      if ((res as any)?.summary?.duplicateEmails > 0) {
        push(
          t({
            it: `CSV importato con ${(res as any).summary.duplicateEmails} email duplicate saltate.`,
            en: `CSV imported with ${(res as any).summary.duplicateEmails} duplicate-email records skipped.`
          }),
          'info'
        );
      }
      setCsvFile(null);
      await loadSummary();
      const rows = (await loadUsers(activeClientId)) as ExternalUserRow[] | undefined;
      await refreshWebApiPreview(activeClientId);
      if (rowsHaveDuplicates(rows || [])) {
        setUsersOpen(true);
        setDuplicatesModalOpen(true);
        push(
          t({
            it: 'Import CSV completato con possibili duplicati. Apri la lista e gestisci i record.',
            en: 'CSV import completed with possible duplicates. Open the list and review records.'
          }),
          'info'
        );
      }
      if (mode === 'replace') {
        try {
          const state = await fetchState();
          if (Array.isArray(state.clients)) setServerState({ clients: state.clients, objectTypes: state.objectTypes });
        } catch {}
      }
    } catch (err: any) {
      push(err?.message || t({ it: 'Import CSV fallito', en: 'CSV import failed' }), 'danger');
    } finally {
      setCsvImporting(false);
    }
  };

  return {
    csvFile,
    setCsvFile,
    csvConfirmOpen,
    setCsvConfirmOpen,
    csvImporting,
    csvConfirmDialogFocusRef,
    handleCsvFile,
    downloadCsvTemplate,
    runCsvImport
  };
};
