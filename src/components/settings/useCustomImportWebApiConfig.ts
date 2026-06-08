import { useCallback, useState } from 'react';
import {
  ExternalUserRow,
  getImportConfig,
  saveImportConfig,
  syncImport,
  testImport
} from '../../api/customImport';
import { rowsHaveDuplicates, toWebApiConfigPayload } from './CustomImportPanel.helpers';

type ToastKind = 'success' | 'danger' | 'info';
type WebApiCfg = { url: string; username: string; method: 'GET' | 'POST' | string; hasPassword: boolean; bodyJson: string; updatedAt?: number } | null;

// WebAPI configuration + connection feature hook extracted from
// CustomImportPanel: owns the connection-test / sync result state and the
// load/save config + test/sync handlers. cfg/password remain owned by the panel
// (shared with the live preview) and are injected here.
export const useCustomImportWebApiConfig = (deps: {
  activeClientId: string | null;
  cfg: WebApiCfg;
  password: string;
  setCfg: (cfg: WebApiCfg) => void;
  setPassword: (password: string) => void;
  loadSummary: () => Promise<unknown> | void;
  loadUsers: (clientId: string) => Promise<ExternalUserRow[] | unknown> | void;
  refreshWebApiPreview: (clientId: string) => Promise<unknown> | void;
  setUsersOpen: (open: boolean) => void;
  setDuplicatesModalOpen: (open: boolean) => void;
  push: (message: string, kind?: ToastKind) => void;
  t: (label: { it: string; en: string }) => string;
}) => {
  const {
    activeClientId,
    cfg,
    password,
    setCfg,
    setPassword,
    loadSummary,
    loadUsers,
    refreshWebApiPreview,
    setUsersOpen,
    setDuplicatesModalOpen,
    push,
    t
  } = deps;

  const [savingCfg, setSavingCfg] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncingClientId, setSyncingClientId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number; count?: number; error?: string; contentType?: string; rawSnippet?: string } | null>(null);
  const [webApiTestPassedByClient, setWebApiTestPassedByClient] = useState<Record<string, boolean>>({});
  const [syncResult, setSyncResult] = useState<any | null>(null);

  const loadConfig = useCallback(async (clientId: string) => {
    setCfg(null);
    setPassword('');
    setTestResult(null);
    setSyncResult(null);
    if (!clientId) return;
    try {
      const res = await getImportConfig(clientId);
      setCfg(
        res.config
          ? {
              url: res.config.url,
              username: res.config.username,
              hasPassword: res.config.hasPassword,
              method: res.config.method || 'POST',
              bodyJson: res.config.bodyJson || '',
              updatedAt: res.config.updatedAt
            }
          : null
      );
    } catch {
      setCfg(null);
    }
  }, [setCfg, setPassword]);

  const runSync = async (clientId: string) => {
    setSyncingClientId(clientId);
    setSyncResult(null);
    try {
      const res = await syncImport(clientId);
      setSyncResult(res);
      if (res.ok) {
        push(t({ it: 'Import completato', en: 'Import completed' }), 'success');
        if ((res as any)?.summary?.duplicateEmails > 0) {
          push(
            t({
              it: `Import completato con ${(res as any).summary.duplicateEmails} email duplicate saltate. Apri la schermata importazione per gestire le variazioni.`,
              en: `Import completed with ${(res as any).summary.duplicateEmails} duplicate-email records skipped. Open import preview to review changes.`
            }),
            'info'
          );
        }
        await loadSummary();
        const rows = (await loadUsers(clientId)) as ExternalUserRow[] | undefined;
        await refreshWebApiPreview(clientId);
        if (rowsHaveDuplicates(rows || [])) {
          setUsersOpen(true);
          setDuplicatesModalOpen(true);
          push(
            t({
              it: 'Import WebAPI completato con possibili duplicati. Apri la lista e gestisci i record.',
              en: 'WebAPI import completed with possible duplicates. Open the list and review records.'
            }),
            'info'
          );
        }
      } else {
        push(t({ it: 'Import fallito', en: 'Import failed' }), 'danger');
      }
    } catch {
      push(t({ it: 'Import fallito', en: 'Import failed' }), 'danger');
    } finally {
      setSyncingClientId(null);
    }
  };

  const saveConfig = async () => {
    if (!activeClientId) return;
    if (!cfg?.url?.trim() || !cfg?.username?.trim()) {
      push(t({ it: 'Compila URL e username.', en: 'Please fill URL and username.' }), 'info');
      return;
    }
    setSavingCfg(true);
    try {
      const res = await saveImportConfig({
        clientId: activeClientId,
        url: cfg.url.trim(),
        username: cfg.username.trim(),
        password: password || undefined,
        method: cfg.method || 'POST',
        bodyJson: cfg.bodyJson
      });
      setCfg(
        res.config
          ? {
              url: res.config.url,
              username: res.config.username,
              hasPassword: res.config.hasPassword,
              method: res.config.method || 'POST',
              bodyJson: res.config.bodyJson || '',
              updatedAt: res.config.updatedAt
            }
          : null
      );
      setPassword('');
      if (activeClientId) {
        setWebApiTestPassedByClient((prev) => ({ ...prev, [activeClientId]: false }));
      }
      push(t({ it: 'Configurazione salvata', en: 'Configuration saved' }), 'success');
      await loadSummary();
    } catch {
      push(t({ it: 'Salvataggio fallito', en: 'Save failed' }), 'danger');
    } finally {
      setSavingCfg(false);
    }
  };

  const runTest = async () => {
    if (!activeClientId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testImport(activeClientId, toWebApiConfigPayload(cfg, password));
      setTestResult({ ok: res.ok, status: res.status, count: res.count, error: res.error, contentType: res.contentType, rawSnippet: res.rawSnippet });
      setWebApiTestPassedByClient((prev) => ({ ...prev, [activeClientId]: !!res.ok }));
      if (res.ok) push(t({ it: 'Test riuscito', en: 'Test successful' }), 'success');
      else push(t({ it: 'Test fallito', en: 'Test failed' }), 'danger');
    } catch {
      setTestResult({ ok: false, status: 0, error: 'Request failed' });
      if (activeClientId) setWebApiTestPassedByClient((prev) => ({ ...prev, [activeClientId]: false }));
      push(t({ it: 'Test fallito', en: 'Test failed' }), 'danger');
    } finally {
      setTesting(false);
    }
  };

  return {
    savingCfg,
    testing,
    syncingClientId,
    testResult,
    syncResult,
    webApiTestPassedByClient,
    loadConfig,
    runSync,
    saveConfig,
    runTest
  };
};
