import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  Eye,
  EyeOff,
  FileDown,
  Info,
  Laptop,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  TestTube,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import { useT } from '../../i18n/useT';
import { useAuthStore } from '../../store/useAuthStore';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import ConfirmDialog from '../ui/ConfirmDialog';
import ModalShell from '../ui/ModalShell';
import {
  clearDeviceImport,
  createManualExternalDevice,
  deleteManyImportedDevices,
  deleteManualExternalDevice,
  type ExternalDeviceRow,
  fetchDeviceImportSummary,
  getDeviceImportConfig,
  importManyWebApiDevices,
  importDeviceCsv,
  listExternalDevices,
  previewDeviceImport,
  saveDeviceImportConfig,
  setExternalDeviceHidden,
  testDeviceImport,
  updateManualExternalDevice
} from '../../api/customImport';

type DeviceImportMode = 'webapi' | 'csv' | 'manual';

type ImportSummaryRow = {
  clientId: string;
  clientName: string;
  lastImportAt: number | null;
  total: number;
  presentCount: number;
  missingCount: number;
  hiddenCount: number;
  configUpdatedAt: number | null;
  hasConfig: boolean;
};

type DeviceImportConfigState = {
  url: string;
  username: string;
  method: 'GET' | 'POST' | string;
  hasPassword: boolean;
  bodyJson: string;
  updatedAt?: number;
};

type PreviewSide = 'left' | 'right';

type PreviewDeleteRequest = {
  devIds: string[];
  count: number;
};

const toDeviceConfigPayload = (cfg: DeviceImportConfigState | null, password: string) => {
  if (!cfg) return undefined;
  return {
    url: String(cfg.url || '').trim(),
    username: String(cfg.username || '').trim(),
    method: String(cfg.method || 'POST').trim().toUpperCase(),
    bodyJson: cfg.bodyJson || '',
    ...(password ? { password } : {})
  };
};

const normalizeSearchText = (value: unknown) => String(value || '').trim().toLowerCase();

const deviceSearchIndex = (row: Partial<ExternalDeviceRow>) =>
  [row.devId, row.deviceType, row.deviceName, row.manufacturer, row.model, row.serialNumber]
    .map((v) => String(v || '').trim())
    .join(' ')
    .toLowerCase();

const formatDate = (ts: number | null | undefined) => {
  if (!ts) return '—';
  try {
    return new Date(Number(ts)).toLocaleString();
  } catch {
    return '—';
  }
};

const getDisplayDeviceName = (row: Partial<ExternalDeviceRow>) => {
  const explicitName = String(row.deviceName || '').trim();
  if (explicitName) return explicitName.toUpperCase();
  return String(row.devId || '').trim();
};

const getDisplayDeviceHeading = (row: Partial<ExternalDeviceRow>) => {
  const name = getDisplayDeviceName(row);
  const serial = String(row.serialNumber || '').trim();
  return serial ? `${name} (S/N: ${serial})` : name;
};

const buildDeviceRowTooltip = (
  row: Partial<ExternalDeviceRow>,
  labels: {
    name: string;
    id: string;
    serial: string;
    type: string;
    brandModel: string;
    state: string;
  },
  stateLabel: string
) => {
  const brandModel = [String(row.manufacturer || '').trim(), String(row.model || '').trim()].filter(Boolean).join(' · ') || '—';
  return [
    `${labels.name}: ${getDisplayDeviceName(row) || '—'}`,
    `${labels.id}: ${String(row.devId || '').trim() || '—'}`,
    `${labels.serial}: ${String(row.serialNumber || '').trim() || '—'}`,
    `${labels.type}: ${String(row.deviceType || '').trim() || '—'}`,
    `${labels.brandModel}: ${brandModel}`,
    `${labels.state}: ${stateLabel}`
  ].join('\n');
};

const compareDeviceRows = (a: Partial<ExternalDeviceRow>, b: Partial<ExternalDeviceRow>) => {
  const byName = String(a.deviceName || '').localeCompare(String(b.deviceName || ''), undefined, { sensitivity: 'base' });
  if (byName !== 0) return byName;
  return String(a.devId || '').localeCompare(String(b.devId || ''), undefined, { sensitivity: 'base' });
};

const buildDeviceTemplateCsv = () => {
  const headers = ['dev_id', 'device_type', 'device_name', 'manufacturer', 'model', 'serial_number'];
  const examples = [
    ['1', 'Desktop PC', 'AR-BI-WK130', 'DELL', 'Optiplex 5060', 'ST01301'],
    ['2', 'Laptop', 'LT-IT-0042', 'Lenovo', 'ThinkPad T14', 'LEN00991']
  ];
  return [headers.join(','), ...examples.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
};

const ClientDevicesImportPanel = ({ initialClientId, lockClientSelection = false }: { initialClientId?: string | null; lockClientSelection?: boolean }) => {
  const t = useT();
  const clients = useDataStore((s) => s.clients);
  const { push } = useToastStore();
  const authUser = useAuthStore((s) => s.user);
  const isSuperAdmin = !!authUser?.isSuperAdmin && String(authUser?.username || '').toLowerCase() === 'superadmin';

  const [summaryRows, setSummaryRows] = useState<ImportSummaryRow[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [activeClientId, setActiveClientId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<DeviceImportMode>('webapi');

  const [configOpen, setConfigOpen] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [cfg, setCfg] = useState<DeviceImportConfigState | null>(null);
  const [password, setPassword] = useState('');
  const [savingCfg, setSavingCfg] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; status: number; count?: number; error?: string; contentType?: string; rawSnippet?: string } | null>(null);
  const [webApiTestPassedByClient, setWebApiTestPassedByClient] = useState<Record<string, boolean>>({});

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewRemoteRows, setPreviewRemoteRows] = useState<ExternalDeviceRow[]>([]);
  const [previewExistingRows, setPreviewExistingRows] = useState<ExternalDeviceRow[]>([]);
  const [previewLeftQuery, setPreviewLeftQuery] = useState('');
  const [previewRightQuery, setPreviewRightQuery] = useState('');
  const [previewShowImportedRight, setPreviewShowImportedRight] = useState(true);
  const [previewSelectedLeftIds, setPreviewSelectedLeftIds] = useState<string[]>([]);
  const [previewSelectedRightIds, setPreviewSelectedRightIds] = useState<string[]>([]);
  const [previewImportingIds, setPreviewImportingIds] = useState<Record<string, boolean>>({});
  const [previewDeletingIds, setPreviewDeletingIds] = useState<Record<string, boolean>>({});
  const [previewDeleteRequest, setPreviewDeleteRequest] = useState<PreviewDeleteRequest | null>(null);
  const [previewContextMenu, setPreviewContextMenu] = useState<{ side: PreviewSide; x: number; y: number } | null>(null);

  const [devicesOpen, setDevicesOpen] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceRows, setDeviceRows] = useState<ExternalDeviceRow[]>([]);
  const [devicesQuery, setDevicesQuery] = useState('');
  const [includeMissing, setIncludeMissing] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [devicesSelectedIds, setDevicesSelectedIds] = useState<string[]>([]);
  const [devicesDeletingIds, setDevicesDeletingIds] = useState<Record<string, boolean>>({});
  const [devicesDeleteRequest, setDevicesDeleteRequest] = useState<ExternalDeviceRow[] | null>(null);

  const [manualDeviceModalOpen, setManualDeviceModalOpen] = useState(false);
  const [manualDeviceSaving, setManualDeviceSaving] = useState(false);
  const [manualDeviceEditingId, setManualDeviceEditingId] = useState<string | null>(null);
  const [manualDeviceForm, setManualDeviceForm] = useState({
    devId: '',
    deviceType: '',
    deviceName: '',
    manufacturer: '',
    model: '',
    serialNumber: ''
  });

  const [csvFile, setCsvFile] = useState<{ name: string; text: string } | null>(null);
  const [csvConfirmOpen, setCsvConfirmOpen] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);

  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const summaryById = useMemo(() => new Map(summaryRows.map((row) => [row.clientId, row])), [summaryRows]);
  const activeClient = useMemo(() => clients.find((c) => c.id === activeClientId) || null, [activeClientId, clients]);
  const activeSummary = useMemo(() => (activeClientId ? summaryById.get(activeClientId) || null : null), [activeClientId, summaryById]);
  const hasImportedOnce = !!activeSummary?.lastImportAt;
  const hasWebApiConfig = !!activeSummary?.hasConfig;
  const canOpenImportPreview = !!(activeClientId && hasWebApiConfig && (webApiTestPassedByClient[activeClientId] || hasImportedOnce));
  const configChildDialogOpen = previewOpen || csvConfirmOpen || clearConfirmOpen;
  const devicesChildDialogOpen = manualDeviceModalOpen || !!devicesDeleteRequest;

  const configFocusRef = useRef<HTMLButtonElement | null>(null);
  const previewFocusRef = useRef<HTMLButtonElement | null>(null);
  const previewContextMenuFocusRef = useRef<HTMLButtonElement | null>(null);
  const devicesFocusRef = useRef<HTMLButtonElement | null>(null);
  const manualFocusRef = useRef<HTMLButtonElement | null>(null);
  const lastPreviewLeftSelectionRef = useRef<number | null>(null);
  const lastPreviewRightSelectionRef = useRef<number | null>(null);
  const lastDevicesSelectionRef = useRef<number | null>(null);

  const visibleSummaryRows = useMemo(() => {
    if (!lockClientSelection) return summaryRows;
    const forced = String(initialClientId || '').trim();
    if (!forced) return summaryRows;
    return summaryRows.filter((row) => String(row.clientId) === forced);
  }, [initialClientId, lockClientSelection, summaryRows]);

  const filteredDevices = useMemo(() => {
    const q = normalizeSearchText(devicesQuery);
    let rows = [...deviceRows];
    if (!includeMissing) rows = rows.filter((row) => row.present);
    if (onlyMissing) rows = rows.filter((row) => !row.present);
    if (!q) return rows;
    return rows.filter((row) => deviceSearchIndex(row).includes(q));
  }, [deviceRows, devicesQuery, includeMissing, onlyMissing]);

  const selectedDeviceIdSet = useMemo(() => new Set(devicesSelectedIds), [devicesSelectedIds]);
  const selectedDeviceRows = useMemo(
    () => deviceRows.filter((row) => selectedDeviceIdSet.has(String(row.devId))),
    [deviceRows, selectedDeviceIdSet]
  );

  const previewLeftRows = useMemo(() => {
    const q = normalizeSearchText(previewLeftQuery);
    const rows = [...previewExistingRows].sort(compareDeviceRows);
    if (!q) return rows;
    return rows.filter((row) => deviceSearchIndex(row).includes(q));
  }, [previewExistingRows, previewLeftQuery]);

  const previewRightRows = useMemo(() => {
    const q = normalizeSearchText(previewRightQuery);
    let rows = [...previewRemoteRows].sort((a, b) => compareDeviceRows(a, b));
    if (!previewShowImportedRight) rows = rows.filter((row) => row.importStatus !== 'existing');
    if (!q) return rows;
    return rows.filter((row) => deviceSearchIndex(row).includes(q));
  }, [previewRemoteRows, previewRightQuery, previewShowImportedRight]);

  const previewRemoteById = useMemo(() => new Map(previewRemoteRows.map((row) => [String(row.devId), row])), [previewRemoteRows]);
  const previewExistingById = useMemo(() => new Map(previewExistingRows.map((row) => [String(row.devId), row])), [previewExistingRows]);
  const previewSelectedLeftIdSet = useMemo(() => new Set(previewSelectedLeftIds), [previewSelectedLeftIds]);
  const previewSelectedRightIdSet = useMemo(() => new Set(previewSelectedRightIds), [previewSelectedRightIds]);

  const previewSummary = useMemo(() => {
    const remove = previewExistingRows.filter((row) => !previewRemoteById.has(String(row.devId)) && row.present).length;
    const add = previewRemoteRows.filter((row) => row.importStatus === 'new').length;
    const update = previewRemoteRows.filter((row) => row.importStatus === 'update').length;
    return { remove, add, update };
  }, [previewExistingRows, previewRemoteById, previewRemoteRows]);

  const selectedPreviewImportRows = useMemo(
    () => previewRemoteRows.filter((row) => previewSelectedRightIdSet.has(String(row.devId)) && row.importStatus !== 'existing'),
    [previewRemoteRows, previewSelectedRightIdSet]
  );

  const selectedPreviewDeleteRows = useMemo(
    () => previewExistingRows.filter((row) => previewSelectedLeftIdSet.has(String(row.devId))),
    [previewExistingRows, previewSelectedLeftIdSet]
  );

  const loadSummary = useCallback(async () => {
    if (!isSuperAdmin) {
      setSummaryRows([]);
      return;
    }
    setSummaryLoading(true);
    try {
      const res = await fetchDeviceImportSummary();
      setSummaryRows((res.rows || []) as ImportSummaryRow[]);
    } catch {
      setSummaryRows([]);
    } finally {
      setSummaryLoading(false);
    }
  }, [isSuperAdmin]);

  const loadConfig = useCallback(async (clientId: string) => {
    setCfg(null);
    setPassword('');
    setTestResult(null);
    if (!clientId) return;
    try {
      const res = await getDeviceImportConfig(clientId);
      setCfg(
        res.config
          ? {
              url: res.config.url,
              username: res.config.username,
              method: res.config.method || 'POST',
              hasPassword: res.config.hasPassword,
              bodyJson: res.config.bodyJson || '',
              updatedAt: res.config.updatedAt
            }
          : null
      );
    } catch {
      setCfg(null);
    }
  }, []);

  const loadDevices = useCallback(async (clientId: string) => {
    if (!clientId) {
      setDeviceRows([]);
      setDevicesSelectedIds([]);
      return;
    }
    setDevicesLoading(true);
    try {
      const res = await listExternalDevices({ clientId, includeHidden: true, includeMissing: true });
      setDeviceRows(res.rows || []);
      setDevicesSelectedIds([]);
    } catch {
      setDeviceRows([]);
      setDevicesSelectedIds([]);
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!initialClientId) return;
    setActiveClientId(String(initialClientId));
  }, [initialClientId]);

  useEffect(() => {
    if (!lockClientSelection || !activeClientId) return;
    void loadDevices(activeClientId);
  }, [activeClientId, loadDevices, lockClientSelection]);

  useEffect(() => {
    if (!previewContextMenu) return;
    const close = () => setPreviewContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [previewContextMenu]);

  const openConfig = useCallback(
    async (clientId: string, mode?: DeviceImportMode) => {
      setActiveClientId(clientId);
      setDevicesOpen(false);
      setPreviewOpen(false);
      setManualDeviceModalOpen(false);
      setDevicesDeleteRequest(null);
      setCsvConfirmOpen(false);
      setClearConfirmOpen(false);
      if (mode) setImportMode(mode);
      setConfigExpanded(mode === 'webapi');
      setConfigOpen(true);
      await loadConfig(clientId);
    },
    [loadConfig]
  );

  const openDevices = useCallback(
    async (clientId: string) => {
      setActiveClientId(clientId);
      setConfigOpen(false);
      setPreviewOpen(false);
      setManualDeviceModalOpen(false);
      setDevicesDeleteRequest(null);
      setDevicesQuery('');
      setIncludeMissing(false);
      setOnlyMissing(false);
      setDevicesSelectedIds([]);
      setDeviceRows([]);
      setDevicesOpen(true);
      await loadDevices(clientId);
    },
    [loadDevices]
  );

  const openManualCreate = () => {
    setManualDeviceEditingId(null);
    setManualDeviceForm({ devId: '', deviceType: '', deviceName: '', manufacturer: '', model: '', serialNumber: '' });
    setManualDeviceModalOpen(true);
  };

  const openManualEdit = (row: ExternalDeviceRow) => {
    setManualDeviceEditingId(row.devId);
    setManualDeviceForm({
      devId: row.devId,
      deviceType: row.deviceType || '',
      deviceName: row.deviceName || '',
      manufacturer: row.manufacturer || '',
      model: row.model || '',
      serialNumber: row.serialNumber || ''
    });
    setManualDeviceModalOpen(true);
  };

  const saveConfig = async () => {
    if (!activeClientId || !cfg?.url?.trim() || !cfg.username?.trim()) {
      push(t({ it: 'Compila URL e username', en: 'Fill URL and username' }), 'danger');
      return;
    }
    setSavingCfg(true);
    try {
      await saveDeviceImportConfig({
        clientId: activeClientId,
        url: cfg.url.trim(),
        username: cfg.username.trim(),
        method: cfg.method,
        bodyJson: cfg.bodyJson || '',
        password: password ? password : undefined
      });
      setPassword('');
      push(t({ it: 'Configurazione salvata', en: 'Configuration saved' }), 'success');
      await loadSummary();
      await loadConfig(activeClientId);
    } catch (err: any) {
      push(err?.message || t({ it: 'Salvataggio fallito', en: 'Save failed' }), 'danger');
    } finally {
      setSavingCfg(false);
    }
  };

  const runTest = async () => {
    if (!activeClientId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testDeviceImport(activeClientId, toDeviceConfigPayload(cfg, password));
      setTestResult({
        ok: result.ok,
        status: result.status,
        count: result.count,
        error: result.error,
        contentType: result.contentType,
        rawSnippet: result.rawSnippet
      });
      setWebApiTestPassedByClient((prev) => ({ ...prev, [activeClientId]: !!result.ok }));
    } catch {
      setTestResult({ ok: false, status: 0, error: 'Request failed' });
      setWebApiTestPassedByClient((prev) => ({ ...prev, [activeClientId]: false }));
    } finally {
      setTesting(false);
    }
  };

  const refreshPreview = useCallback(
    async (clientId: string) => {
      setPreviewLoading(true);
      setPreviewError(null);
      setPreviewContextMenu(null);
      try {
        const payload = await previewDeviceImport(clientId, toDeviceConfigPayload(cfg, password));
        if (!payload.ok) {
          setPreviewError(payload.error || t({ it: 'Anteprima non disponibile', en: 'Preview not available' }));
          setPreviewRemoteRows([]);
          setPreviewExistingRows([]);
          setPreviewSelectedLeftIds([]);
          setPreviewSelectedRightIds([]);
          return;
        }
        setPreviewRemoteRows(payload.remoteRows || []);
        setPreviewExistingRows(payload.existingRows || []);
        setPreviewSelectedLeftIds([]);
        setPreviewSelectedRightIds([]);
      } catch (err: any) {
        setPreviewError(err?.message || t({ it: 'Anteprima non disponibile', en: 'Preview not available' }));
        setPreviewRemoteRows([]);
        setPreviewExistingRows([]);
        setPreviewSelectedLeftIds([]);
        setPreviewSelectedRightIds([]);
      } finally {
        setPreviewLoading(false);
      }
    },
    [cfg, password, t]
  );

  const openPreview = async () => {
    if (!activeClientId) return;
    setConfigOpen(false);
    setDevicesOpen(false);
    setManualDeviceModalOpen(false);
    setDevicesDeleteRequest(null);
    setPreviewLeftQuery('');
    setPreviewRightQuery('');
    setPreviewShowImportedRight(true);
    setPreviewSelectedLeftIds([]);
    setPreviewSelectedRightIds([]);
    setPreviewDeleteRequest(null);
    setPreviewContextMenu(null);
    setPreviewOpen(true);
    await refreshPreview(activeClientId);
  };

  const runImportMany = async (rows: Array<ExternalDeviceRow>) => {
    if (!activeClientId || !rows.length) return;
    const devIds = Array.from(new Set(rows.map((row) => String(row.devId || '').trim()).filter(Boolean)));
    if (!devIds.length) return;
    setPreviewImportingIds((prev) => {
      const next = { ...prev };
      for (const devId of devIds) next[devId] = true;
      return next;
    });
    try {
      await importManyWebApiDevices({
        clientId: activeClientId,
        devIds,
        devices: rows,
        config: toDeviceConfigPayload(cfg, password)
      });
      setPreviewExistingRows((prev) => {
        const next = new Map(prev.map((row) => [String(row.devId), row]));
        const now = Date.now();
        for (const row of rows) {
          const devId = String(row.devId || '').trim();
          if (!devId) continue;
          next.set(devId, {
            ...(next.get(devId) || {
              clientId: activeClientId,
              hidden: false,
              present: true,
              lastSeenAt: now,
              createdAt: now,
              updatedAt: now
            }),
            ...row,
            clientId: activeClientId,
            present: true,
            hidden: false,
            updatedAt: now
          });
        }
        return Array.from(next.values());
      });
      setPreviewRemoteRows((prev) => prev.map((row) => (devIds.includes(String(row.devId)) ? { ...row, importStatus: 'existing', changes: [] } : row)));
      setPreviewSelectedRightIds((prev) => prev.filter((id) => !devIds.includes(id)));
      void refreshPreview(activeClientId);
      void loadSummary();
      void loadDevices(activeClientId);
      push(
        devIds.length === 1
          ? t({ it: 'Dispositivo importato', en: 'Device imported' })
          : t({ it: `${devIds.length} dispositivi importati`, en: `${devIds.length} devices imported` }),
        'success'
      );
    } catch (err: any) {
      push(err?.message || t({ it: 'Import fallito', en: 'Import failed' }), 'danger');
    } finally {
      setPreviewImportingIds((prev) => {
        const next = { ...prev };
        for (const devId of devIds) delete next[devId];
        return next;
      });
    }
  };

  const runImportOne = async (row: ExternalDeviceRow & { importStatus?: 'new' | 'update' | 'existing' }) => {
    await runImportMany([row]);
  };

  const runDeleteMany = async (devIds: string[]) => {
    if (!activeClientId || !devIds.length) return;
    setPreviewDeletingIds((prev) => {
      const next = { ...prev };
      for (const devId of devIds) next[devId] = true;
      return next;
    });
    try {
      await deleteManyImportedDevices({ clientId: activeClientId, devIds });
      setPreviewExistingRows((prev) => prev.filter((row) => !devIds.includes(String(row.devId))));
      setPreviewRemoteRows((prev) =>
        prev.map((row) => {
          if (!devIds.includes(String(row.devId))) return row;
          return { ...row, importStatus: Array.isArray(row.changes) && row.changes.length ? 'update' : 'new' };
        })
      );
      setPreviewSelectedLeftIds((prev) => prev.filter((id) => !devIds.includes(id)));
      void refreshPreview(activeClientId);
      void loadSummary();
      void loadDevices(activeClientId);
      push(
        devIds.length === 1
          ? t({ it: 'Dispositivo rimosso', en: 'Device removed' })
          : t({ it: `${devIds.length} dispositivi rimossi`, en: `${devIds.length} devices removed` }),
        'success'
      );
    } catch (err: any) {
      push(err?.message || t({ it: 'Rimozione fallita', en: 'Delete failed' }), 'danger');
    } finally {
      setPreviewDeletingIds((prev) => {
        const next = { ...prev };
        for (const devId of devIds) delete next[devId];
        return next;
      });
    }
  };

  const onCsvFileSelected = async (file: File | null) => {
    if (!file) return;
    if (!activeClientId) {
      push(t({ it: 'Seleziona un cliente', en: 'Select a client' }), 'danger');
      return;
    }
    try {
      const text = await file.text();
      setCsvFile({ name: file.name, text });
      setCsvConfirmOpen(true);
    } catch {
      push(t({ it: 'Lettura file fallita', en: 'Failed to read file' }), 'danger');
    }
  };

  const runCsvImport = async (mode: 'append' | 'replace') => {
    if (!activeClientId || !csvFile?.text) return;
    setCsvImporting(true);
    try {
      await importDeviceCsv({ clientId: activeClientId, csvText: csvFile.text, mode });
      setCsvConfirmOpen(false);
      setCsvFile(null);
      await Promise.all([loadSummary(), loadDevices(activeClientId)]);
      push(t({ it: 'Import CSV dispositivi completato', en: 'Devices CSV import completed' }), 'success');
    } catch (err: any) {
      push(err?.message || t({ it: 'Import CSV fallito', en: 'CSV import failed' }), 'danger');
    } finally {
      setCsvImporting(false);
    }
  };

  const saveManualDevice = async () => {
    if (!activeClientId) return;
    if (!String(manualDeviceForm.deviceName || '').trim()) {
      push(t({ it: 'Inserisci almeno il nome dispositivo', en: 'Enter at least the device name' }), 'danger');
      return;
    }
    setManualDeviceSaving(true);
    try {
      if (manualDeviceEditingId) {
        await updateManualExternalDevice({
          clientId: activeClientId,
          devId: manualDeviceEditingId,
          device: manualDeviceForm
        });
        push(t({ it: 'Dispositivo manuale aggiornato', en: 'Manual device updated' }), 'success');
      } else {
        await createManualExternalDevice({ clientId: activeClientId, device: manualDeviceForm });
        push(t({ it: 'Dispositivo manuale creato', en: 'Manual device created' }), 'success');
      }
      setManualDeviceModalOpen(false);
      await Promise.all([loadSummary(), loadDevices(activeClientId)]);
    } catch (err: any) {
      push(err?.message || t({ it: 'Salvataggio fallito', en: 'Save failed' }), 'danger');
    } finally {
      setManualDeviceSaving(false);
    }
  };

  const isManualDeviceRow = (row: ExternalDeviceRow) => !!row.manual || String(row.devId || '').toLowerCase().startsWith('manual:');

  const runDeleteDevices = async (rows: ExternalDeviceRow[]) => {
    if (!activeClientId || !rows.length) return;
    const normalizedRows = rows.filter((row) => !!String(row.devId || '').trim());
    if (!normalizedRows.length) return;
    const ids = normalizedRows.map((row) => String(row.devId));
    const importedIds = normalizedRows.filter((row) => !isManualDeviceRow(row)).map((row) => String(row.devId));
    const manualRows = normalizedRows.filter((row) => isManualDeviceRow(row));
    setDevicesDeletingIds((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = true;
      return next;
    });
    try {
      if (importedIds.length) {
        await deleteManyImportedDevices({ clientId: activeClientId, devIds: importedIds });
      }
      for (const row of manualRows) {
        await deleteManualExternalDevice({ clientId: activeClientId, devId: row.devId });
      }
      push(
        normalizedRows.length === 1
          ? t({ it: 'Dispositivo rimosso', en: 'Device removed' })
          : t({ it: `${normalizedRows.length} dispositivi rimossi`, en: `${normalizedRows.length} devices removed` }),
        'success'
      );
      await Promise.all([loadSummary(), loadDevices(activeClientId)]);
    } catch (err: any) {
      push(err?.message || t({ it: 'Rimozione fallita', en: 'Delete failed' }), 'danger');
    } finally {
      setDevicesDeletingIds((prev) => {
        const next = { ...prev };
        for (const id of ids) delete next[id];
        return next;
      });
    }
  };

  const toggleDeviceSelection = (devId: string, options?: { shiftKey?: boolean }) => {
    const normalized = String(devId || '').trim();
    if (!normalized) return;
    const currentIndex = filteredDevices.findIndex((row) => String(row.devId) === normalized);
    setDevicesSelectedIds((prev) => {
      if (options?.shiftKey && lastDevicesSelectionRef.current !== null && currentIndex >= 0) {
        const start = Math.min(lastDevicesSelectionRef.current, currentIndex);
        const end = Math.max(lastDevicesSelectionRef.current, currentIndex);
        const rangeIds = filteredDevices.slice(start, end + 1).map((row) => String(row.devId));
        return Array.from(new Set([...prev, ...rangeIds]));
      }
      return prev.includes(normalized) ? prev.filter((id) => id !== normalized) : [...prev, normalized];
    });
    if (currentIndex >= 0) lastDevicesSelectionRef.current = currentIndex;
  };

  const selectAllVisibleDevices = () => {
    setDevicesSelectedIds(filteredDevices.map((row) => String(row.devId)));
    lastDevicesSelectionRef.current = filteredDevices.length ? filteredDevices.length - 1 : null;
  };

  const clearDeviceSelection = () => {
    setDevicesSelectedIds([]);
    lastDevicesSelectionRef.current = null;
  };

  const requestDevicesDelete = (rows: ExternalDeviceRow[]) => {
    const normalized = rows.filter((row) => !!String(row.devId || '').trim());
    if (!normalized.length) return;
    setDevicesDeleteRequest(normalized);
  };

  const confirmDevicesDelete = async () => {
    if (!devicesDeleteRequest?.length) return;
    const rows = [...devicesDeleteRequest];
    setDevicesDeleteRequest(null);
    await runDeleteDevices(rows);
  };

  const toggleHidden = async (row: ExternalDeviceRow) => {
    if (!activeClientId) return;
    try {
      await setExternalDeviceHidden({ clientId: activeClientId, devId: row.devId, hidden: !row.hidden });
      await loadDevices(activeClientId);
    } catch {
      push(t({ it: 'Aggiornamento visibilità fallito', en: 'Visibility update failed' }), 'danger');
    }
  };

  const togglePreviewSelection = (side: PreviewSide, devId: string, options?: { shiftKey?: boolean }) => {
    const normalized = String(devId || '').trim();
    if (!normalized) return;
    if (side === 'left') {
      const currentIndex = previewLeftRows.findIndex((row) => String(row.devId) === normalized);
      setPreviewSelectedLeftIds((prev) => {
        if (options?.shiftKey && lastPreviewLeftSelectionRef.current !== null && currentIndex >= 0) {
          const start = Math.min(lastPreviewLeftSelectionRef.current, currentIndex);
          const end = Math.max(lastPreviewLeftSelectionRef.current, currentIndex);
          const rangeIds = previewLeftRows.slice(start, end + 1).map((row) => String(row.devId));
          return Array.from(new Set([...prev, ...rangeIds]));
        }
        return prev.includes(normalized) ? prev.filter((id) => id !== normalized) : [...prev, normalized];
      });
      if (currentIndex >= 0) lastPreviewLeftSelectionRef.current = currentIndex;
      return;
    }
    const row = previewRemoteById.get(normalized);
    if (!row || row.importStatus === 'existing') return;
    const currentIndex = previewRightRows.findIndex((entry) => String(entry.devId) === normalized);
    setPreviewSelectedRightIds((prev) => {
      if (options?.shiftKey && lastPreviewRightSelectionRef.current !== null && currentIndex >= 0) {
        const selectableRows = previewRightRows.filter((entry) => entry.importStatus !== 'existing');
        const currentSelectableIndex = selectableRows.findIndex((entry) => String(entry.devId) === normalized);
        if (currentSelectableIndex >= 0) {
          const start = Math.min(lastPreviewRightSelectionRef.current, currentSelectableIndex);
          const end = Math.max(lastPreviewRightSelectionRef.current, currentSelectableIndex);
          const rangeIds = selectableRows.slice(start, end + 1).map((entry) => String(entry.devId));
          return Array.from(new Set([...prev, ...rangeIds]));
        }
      }
      return prev.includes(normalized) ? prev.filter((id) => id !== normalized) : [...prev, normalized];
    });
    const selectableRows = previewRightRows.filter((entry) => entry.importStatus !== 'existing');
    const selectableIndex = selectableRows.findIndex((entry) => String(entry.devId) === normalized);
    if (selectableIndex >= 0) lastPreviewRightSelectionRef.current = selectableIndex;
  };

  const selectAllPreviewVisible = (side: PreviewSide) => {
    if (side === 'left') {
      setPreviewSelectedLeftIds(previewLeftRows.map((row) => String(row.devId)));
      lastPreviewLeftSelectionRef.current = previewLeftRows.length ? previewLeftRows.length - 1 : null;
      return;
    }
    setPreviewSelectedRightIds(
      previewRightRows.filter((row) => row.importStatus !== 'existing').map((row) => String(row.devId))
    );
    lastPreviewRightSelectionRef.current = previewRightRows.filter((row) => row.importStatus !== 'existing').length
      ? previewRightRows.filter((row) => row.importStatus !== 'existing').length - 1
      : null;
  };

  const clearPreviewSelection = (side?: PreviewSide) => {
    if (!side || side === 'left') setPreviewSelectedLeftIds([]);
    if (!side || side === 'right') setPreviewSelectedRightIds([]);
    if (!side || side === 'left') lastPreviewLeftSelectionRef.current = null;
    if (!side || side === 'right') lastPreviewRightSelectionRef.current = null;
  };

  const openPreviewContextMenu = (side: PreviewSide, event: ReactMouseEvent) => {
    event.preventDefault();
    setPreviewContextMenu({ side, x: event.clientX, y: event.clientY });
  };

  const requestPreviewDelete = (devIds: string[]) => {
    const ids = Array.from(new Set(devIds.map((value) => String(value || '').trim()).filter(Boolean)));
    if (!ids.length) return;
    setPreviewDeleteRequest({ devIds: ids, count: ids.length });
    setPreviewContextMenu(null);
  };

  const confirmPreviewDelete = async () => {
    if (!previewDeleteRequest) return;
    const ids = [...previewDeleteRequest.devIds];
    setPreviewDeleteRequest(null);
    await runDeleteMany(ids);
  };

  const buildUpdateTitle = (row: ExternalDeviceRow) => {
    const changes = Array.isArray(row.changes) ? row.changes : [];
    if (!changes.length) return t({ it: 'Aggiorna dal dato WebAPI', en: 'Update from WebAPI data' });
    const labels: Record<string, string> = {
      deviceName: t({ it: 'Nome', en: 'Name' }),
      deviceType: t({ it: 'Tipo', en: 'Type' }),
      manufacturer: t({ it: 'Marca', en: 'Brand' }),
      model: 'Model',
      serialNumber: 'Serial',
      present: t({ it: 'Presenza', en: 'Presence' })
    };
    return changes
      .map((change) => `${labels[change.field] || change.field}: ${change.previous || '—'} > ${change.next || '—'}`)
      .join('\n');
  };

  const previewTooltipLabels = {
    name: t({ it: 'Nome', en: 'Name' }),
    id: 'ID',
    serial: 'S/N',
    type: t({ it: 'Tipo', en: 'Type' }),
    brandModel: t({ it: 'Marca / Modello', en: 'Brand / Model' }),
    state: t({ it: 'Stato', en: 'State' })
  };

  const runClear = async () => {
    if (!activeClientId) return;
    setClearing(true);
    try {
      await clearDeviceImport(activeClientId);
      setClearConfirmOpen(false);
      await Promise.all([loadSummary(), loadDevices(activeClientId)]);
      push(t({ it: 'Import dispositivi svuotato', en: 'Device import cleared' }), 'success');
    } catch (err: any) {
      push(err?.message || t({ it: 'Eliminazione fallita', en: 'Delete failed' }), 'danger');
    } finally {
      setClearing(false);
    }
  };

  const downloadTemplate = () => {
    const client = clients.find((entry) => String(entry.id) === String(activeClientId));
    const slug = String(client?.shortName || client?.name || 'client')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'client';
    const fileName = `${slug}-devices-import-template.csv`;
    const blob = new Blob([buildDeviceTemplateCsv()], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <>
      <div className="space-y-6">
        {lockClientSelection && activeClientId ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                  <span>{t({ it: 'Dispositivi cliente', en: 'Client devices' })} · {activeClient?.shortName || activeClient?.name || '—'}</span>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-ink"
                    title={t({
                      it: 'Gestisci dispositivi cliente da tre sorgenti: WebAPI, CSV e manuale. Lo storage resta separato da utenti ma l’interfaccia è unificata.',
                      en: 'Manage client devices from three sources: WebAPI, CSV and manual. Storage remains separate from users, with unified UI.'
                    })}
                    >
                      <Info size={14} />
                    </button>
                </div>
                <div className="mt-1 text-[15px] text-slate-600">
                  {t({
                    it: 'Importa e sincronizza dispositivi (desktop, laptop, mobile, tablet) mantenendo storage separato dagli utenti.',
                    en: 'Import and sync devices (desktop, laptop, mobile, tablet) while keeping storage separate from users.'
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void openDevices(activeClientId)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold ${(activeSummary?.total || 0) > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  <Laptop size={15} />
                  {t({ it: 'Dispositivi importati', en: 'Imported devices' })}
                </button>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {t({ it: 'Totale', en: 'Total' })}: {activeSummary?.total ?? 0}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setImportMode('webapi')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'webapi' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>WebAPI</button>
              <button type="button" onClick={() => setImportMode('csv')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'csv' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>CSV</button>
              <button type="button" onClick={() => setImportMode('manual')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${importMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{t({ it: 'Manuale', en: 'Manual' })}</button>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              {importMode === 'webapi' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => void openConfig(activeClientId, 'webapi')} className="btn-secondary" disabled={!activeClientId}>
                    {t({ it: 'Configurazione', en: 'Configuration' })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeClientId) return;
                      if (canOpenImportPreview) {
                        void openPreview();
                        return;
                      }
                      void openConfig(activeClientId, 'webapi');
                    }}
                    disabled={!activeClientId}
                    className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <UploadCloud size={16} />
                    {t({ it: 'Import', en: 'Import' })}
                  </button>
                </div>
              ) : importMode === 'csv' ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={downloadTemplate} className="btn-secondary inline-flex items-center gap-2" disabled={!activeClientId}>
                    <FileDown size={16} />
                    {t({ it: 'Export template', en: 'Export template' })}
                  </button>
                  <button type="button" onClick={() => openConfig(activeClientId, 'csv')} className="btn-primary inline-flex items-center gap-2" disabled={!activeClientId}>
                    <UploadCloud size={16} />
                    {t({ it: 'Import', en: 'Import' })}
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={() => activeClientId && void openDevices(activeClientId)} className="btn-primary inline-flex items-center gap-2" disabled={!activeClientId}>
                    <Plus size={16} />
                    ADD
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {!lockClientSelection ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-ink">{t({ it: 'Import dispositivi per cliente', en: 'Client device imports' })}</div>
              <button
                onClick={() => void loadSummary()}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
              >
                <RefreshCw size={16} className={summaryLoading ? 'animate-spin text-primary' : 'text-slate-500'} />
                {t({ it: 'Aggiorna', en: 'Refresh' })}
              </button>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
              <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase text-slate-500">
                <div className="col-span-5">{t({ it: 'Cliente', en: 'Client' })}</div>
                <div className="col-span-3">{t({ it: 'Ultima importazione', en: 'Last import' })}</div>
                <div className="col-span-2">{t({ it: 'Dispositivi', en: 'Devices' })}</div>
                <div className="col-span-2 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
              </div>
              <div className="max-h-[420px] overflow-auto">
                {visibleSummaryRows.map((row) => (
                  <div key={row.clientId} className="grid grid-cols-12 gap-2 border-t border-slate-200 px-4 py-3 text-sm">
                    <div className="col-span-5 min-w-0">
                      <div className="truncate font-semibold text-ink">{row.clientName}</div>
                      <div className="mt-1 text-[11px] font-semibold uppercase text-slate-400">
                        {row.lastImportAt ? formatDate(row.lastImportAt) : t({ it: 'Import non eseguito', en: 'Import not executed' })}
                      </div>
                    </div>
                    <div className={`col-span-3 text-xs ${row.lastImportAt ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}`}>
                      {row.lastImportAt ? formatDate(row.lastImportAt) : 'MAI'}
                    </div>
                    <div className="col-span-2">
                      <div className="text-sm font-semibold text-ink">{row.total}</div>
                      <div className="text-[11px] text-slate-500">
                        {t({ it: `Attivi ${row.presentCount}`, en: `Active ${row.presentCount}` })}
                        {row.missingCount ? ` · ${t({ it: `Mancanti ${row.missingCount}`, en: `Missing ${row.missingCount}` })}` : ''}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      <button onClick={() => void openDevices(row.clientId)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" title={t({ it: 'Dispositivi importati', en: 'Imported devices' })}>
                        <Laptop size={14} />
                      </button>
                      <button onClick={() => void openConfig(row.clientId)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" title={t({ it: 'Impostazioni import', en: 'Import settings' })}>
                        <Settings2 size={14} />
                      </button>
                      <button onClick={() => { setActiveClientId(row.clientId); void openPreview(); }} disabled={!row.hasConfig} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40" title={t({ it: 'Importa da WebAPI', en: 'Import from WebAPI' })}>
                        <UploadCloud size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {!visibleSummaryRows.length && !summaryLoading ? <div className="px-4 py-6 text-sm text-slate-600">{t({ it: 'Nessun cliente disponibile.', en: 'No clients available.' })}</div> : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <ModalShell
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title={t({ it: 'Configurazione import dispositivi', en: 'Device import configuration' })}
        description={activeClient ? activeClient.name : t({ it: 'Nessun cliente selezionato', en: 'No client selected' })}
        sizeClassName="max-w-3xl"
        rootClassName="z-[120]"
        backdropClassName="bg-black/30 backdrop-blur-sm"
        closeDisabled={configChildDialogOpen}
        initialFocusRef={configFocusRef as any}
      >
        <button ref={configFocusRef} type="button" className="sr-only" tabIndex={0}>focus</button>
        {importMode === 'webapi' ? (
          <>
            {!configExpanded ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{t({ it: 'Apri le impostazioni WebAPI con l’icona ingranaggio.', en: 'Open WebAPI settings via the gear icon.' })}</span>
                  <button type="button" onClick={() => setConfigExpanded(true)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                    <Settings2 size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="block text-sm font-medium text-slate-700 md:col-span-3">
                  WebAPI URL
                  <input
                    value={cfg?.url || ''}
                    onChange={(e) =>
                      setCfg((prev) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), url: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="https://api.example.com/devices"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  {t({ it: 'Username', en: 'Username' })}
                  <input
                    value={cfg?.username || ''}
                    onChange={(e) =>
                      setCfg((prev) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), username: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  {t({ it: 'Password', en: 'Password' })}
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder={cfg?.hasPassword ? t({ it: 'Lascia vuoto per non cambiare', en: 'Leave empty to keep' }) : '••••••'}
                  />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  {t({ it: 'Metodo', en: 'Method' })}
                  <select
                    value={cfg?.method || 'POST'}
                    onChange={(e) =>
                      setCfg((prev) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), method: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                  </select>
                </label>
                <label className="block text-sm font-medium text-slate-700 md:col-span-3">
                  {t({ it: 'Body JSON (opzionale)', en: 'Body JSON (optional)' })}
                  <textarea
                    value={cfg?.bodyJson || ''}
                    onChange={(e) =>
                      setCfg((prev) => ({ ...(prev || { url: '', username: '', method: 'POST', hasPassword: false, bodyJson: '' }), bodyJson: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={3}
                    placeholder='{"devices": true}'
                  />
                </label>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button onClick={() => void saveConfig()} disabled={savingCfg || !activeClientId} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-60" title={t({ it: 'Salva configurazione', en: 'Save configuration' })}>
                <Save size={16} className={savingCfg ? 'animate-pulse' : ''} />
              </button>
              <button onClick={() => void runTest()} disabled={testing || !activeClientId || !hasWebApiConfig} className="btn-secondary inline-flex items-center gap-2 disabled:opacity-60">
                <TestTube size={16} /> {testing ? t({ it: 'Test…', en: 'Testing…' }) : t({ it: 'Test', en: 'Test' })}
              </button>
            </div>

            {testResult ? (
              testResult.ok ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {t({
                    it: `Test OK: ${testResult.count ?? 0} entita trovate.`,
                    en: `Test OK: ${testResult.count ?? 0} entities found.`
                  })}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <div className="font-semibold">
                    {t({ it: `Test fallito (HTTP ${testResult.status || 0}).`, en: `Test failed (HTTP ${testResult.status || 0}).` })}
                  </div>
                  {testResult.error ? <div className="mt-1 text-xs">{testResult.error}</div> : null}
                  {testResult.contentType ? <div className="mt-1 text-xs">Content-Type: {testResult.contentType}</div> : null}
                  {testResult.rawSnippet ? (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-white/70 p-2 text-[11px] text-slate-700">
                      {String(testResult.rawSnippet).slice(0, 500)}
                    </pre>
                  ) : null}
                </div>
              )
            ) : null}
          </>
        ) : importMode === 'csv' ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">{t({ it: 'Import CSV dispositivi', en: 'Device CSV import' })}</div>
                <div className="mt-1 text-xs text-slate-500">{t({ it: 'Carica un CSV per questo cliente. Puoi sommare o sostituire i dispositivi esistenti.', en: 'Upload a CSV for this client. You can append or replace existing devices.' })}</div>
              </div>
              <button onClick={downloadTemplate} className="btn-secondary inline-flex items-center gap-2">
                <FileDown size={16} /> {t({ it: 'Modello CSV', en: 'CSV template' })}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                <UploadCloud size={16} />
                {t({ it: 'Carica CSV', en: 'Upload CSV' })}
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void onCsvFileSelected(e.target.files?.[0] || null)} />
              </label>
              {csvFile ? <span className="text-xs text-slate-500">{csvFile.name}</span> : null}
              {csvImporting ? <span className="text-xs text-slate-500">{t({ it: 'Import in corso…', en: 'Importing…' })}</span> : null}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-ink">{t({ it: 'Inserimento manuale dispositivi', en: 'Manual device entry' })}</div>
                <div className="mt-1 text-xs text-slate-500">{t({ it: 'Aggiungi, modifica o rimuovi dispositivi senza WebAPI/CSV.', en: 'Add, edit or remove devices without WebAPI/CSV.' })}</div>
              </div>
              <button type="button" onClick={openManualCreate} className="inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
                <Plus size={15} /> {t({ it: 'Nuovo dispositivo manuale', en: 'New manual device' })}
              </button>
            </div>
          </div>
        )}
      </ModalShell>

      <ModalShell
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t({ it: 'Importazione WebAPI dispositivi', en: 'WebAPI device import' })}
        description={activeClient ? activeClient.name : ''}
        sizeClassName="max-w-7xl"
        rootClassName="z-[130]"
        backdropClassName="bg-black/35 backdrop-blur-sm"
        initialFocusRef={previewFocusRef as any}
        footer={
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              {t({ it: 'Selezionati per import', en: 'Selected for import' })}: <span className="font-semibold text-ink">{selectedPreviewImportRows.length}</span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={() => clearPreviewSelection()} className="btn-secondary">
                {t({ it: 'Pulisci selezione', en: 'Clear selection' })}
              </button>
              <button
                type="button"
                onClick={() => void runImportMany(selectedPreviewImportRows)}
                disabled={!selectedPreviewImportRows.length || Object.keys(previewImportingIds).length > 0}
                className="btn-primary inline-flex items-center gap-2 disabled:opacity-50"
              >
                <UploadCloud size={16} />
                {t({ it: 'Avvia importazione', en: 'Start import' })}
              </button>
            </div>
          </div>
        }
      >
        <button ref={previewFocusRef} type="button" className="sr-only" tabIndex={0}>focus</button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <div className="font-semibold text-ink">
              {t({ it: 'Totali da importazione', en: 'Total from import' })}: {previewRemoteRows.length} · {t({ it: 'Dispositivi esistenti', en: 'Existing devices' })}: {previewExistingRows.length}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="text-rose-700">{t({ it: 'Da eliminare', en: 'To delete' })}: {previewSummary.remove}</span>
              <span className="text-emerald-700">{t({ it: 'Da aggiungere', en: 'To add' })}: {previewSummary.add}</span>
              <span className="text-amber-700">{t({ it: 'Da aggiornare', en: 'To update' })}: {previewSummary.update}</span>
            </div>
          </div>
          <button type="button" onClick={() => activeClientId && void refreshPreview(activeClientId)} className="btn-secondary inline-flex items-center gap-2">
            <RefreshCw size={16} className={previewLoading ? 'animate-spin' : ''} />
            {t({ it: 'Ricarica', en: 'Reload' })}
          </button>
        </div>
        {previewError ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{previewError}</div> : null}

        <div className="mt-2 text-xs text-slate-500">
          {t({
            it: 'Click per selezione multipla. Tasto destro dentro una lista per selezionare tutti i risultati visibili o pulire la selezione.',
            en: 'Click for multi-select. Right-click inside a list to select all visible results or clear the selection.'
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr),72px,minmax(0,0.9fr)]">
          <div className="rounded-xl border border-slate-200" onContextMenu={(event) => openPreviewContextMenu('left', event)}>
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              <span>{t({ it: 'Dispositivi esistenti', en: 'Existing devices' })}</span>
              <span>{previewExistingRows.length}</span>
            </div>
            <div className="px-3 py-2">
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                <input value={previewLeftQuery} onChange={(e) => setPreviewLeftQuery(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm" placeholder={t({ it: 'Cerca dispositivi esistenti...', en: 'Search existing devices...' })} />
              </div>
            </div>
            <div className="max-h-[460px] overflow-auto px-3 pb-3">
              {previewLeftRows.map((row) => {
                const removed = !previewRemoteById.has(String(row.devId)) && row.present;
                const selected = previewSelectedLeftIdSet.has(String(row.devId));
                return (
                  <button
                    key={`prev-left-${row.devId}`}
                    type="button"
                    onClick={(event) => togglePreviewSelection('left', String(row.devId), { shiftKey: event.shiftKey })}
                    title={buildDeviceRowTooltip(
                      row,
                      previewTooltipLabels,
                      removed
                        ? t({ it: 'Rimosso dalla WebAPI', en: 'Removed from WebAPI' })
                        : row.present
                          ? t({ it: 'Nel contenitore locale', en: 'In local container' })
                          : t({ it: 'Mancante', en: 'Missing' })
                    )}
                    className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                        : removed
                          ? 'border-rose-200 bg-rose-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{getDisplayDeviceHeading(row)}</div>
                      <div className="truncate text-xs text-slate-500">{row.deviceType || '—'} · {row.manufacturer || '—'} · {row.model || '—'}</div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{row.present ? t({ it: 'Nel contenitore locale', en: 'In local container' }) : t({ it: 'Mancante', en: 'Missing' })}</span>
                      {removed ? <span className="font-semibold text-rose-700">{t({ it: 'Rimosso dalla WebAPI', en: 'Removed from WebAPI' })}</span> : null}
                    </div>
                  </button>
                );
              })}
              {!previewLeftRows.length ? <div className="py-6 text-center text-sm text-slate-500">{t({ it: 'Nessun dispositivo', en: 'No devices' })}</div> : null}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-2 py-4">
            <button
              type="button"
              onClick={() => void runImportMany(selectedPreviewImportRows)}
              disabled={!selectedPreviewImportRows.length || Object.keys(previewImportingIds).length > 0}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200 bg-white text-lg font-bold text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
              title={t({ it: 'Importa i dispositivi selezionati nel contenitore locale', en: 'Import selected devices into the local container' })}
            >
              {'<<'}
            </button>
          </div>

          <div className="rounded-xl border border-slate-200" onContextMenu={(event) => openPreviewContextMenu('right', event)}>
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
              <span>{t({ it: 'Dispositivi trovati dalla WebAPI', en: 'Devices found from WebAPI' })}</span>
              <span>{previewRightRows.length}</span>
            </div>
            <div className="px-3 py-2">
              <label className="mb-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                <input type="checkbox" checked={previewShowImportedRight} onChange={(e) => setPreviewShowImportedRight(e.target.checked)} />
                {t({ it: 'Mostra già importati', en: 'Show already imported' })}
              </label>
              <div className="relative">
                <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
                <input value={previewRightQuery} onChange={(e) => setPreviewRightQuery(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm" placeholder={t({ it: 'Cerca dispositivi WebAPI...', en: 'Search WebAPI devices...' })} />
              </div>
            </div>
            <div className="max-h-[460px] overflow-auto px-2.5 pb-2.5">
              {previewRightRows.map((row) => {
                const importStatus = row.importStatus || 'existing';
                const selected = previewSelectedRightIdSet.has(String(row.devId));
                const importing = !!previewImportingIds[row.devId];
                const deleting = !!previewDeletingIds[row.devId];
                const existingRow = previewExistingById.get(String(row.devId));
                return (
                  <button
                    key={`prev-right-${row.devId}`}
                    type="button"
                    onClick={(event) => togglePreviewSelection('right', String(row.devId), { shiftKey: event.shiftKey })}
                    disabled={importStatus === 'existing'}
                    title={buildDeviceRowTooltip(
                      row,
                      previewTooltipLabels,
                      importStatus === 'existing'
                        ? t({ it: 'Già nel contenitore locale', en: 'Already in local container' })
                        : importStatus === 'update'
                          ? t({ it: 'Differenze rilevate', en: 'Changes detected' })
                          : t({ it: 'Pronto per import', en: 'Ready to import' })
                    )}
                    className={`mb-2 w-full rounded-lg border px-2.5 py-2 text-left text-sm transition ${
                      importStatus === 'existing'
                        ? 'cursor-default border-sky-200 bg-sky-50'
                        : selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-ink">{getDisplayDeviceHeading(row)}</div>
                        <div className="truncate text-[11px] text-slate-500">{row.deviceType || '—'} · {row.manufacturer || '—'} · {row.model || '—'}</div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
                        {importStatus === 'new' ? (
                          <>
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {t({ it: 'NEW', en: 'NEW' })}
                            </span>
                            <button
                              type="button"
                              disabled={importing}
                              onClick={() => void runImportOne(row)}
                              className="inline-flex h-7 min-w-7 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                              title={t({ it: 'Importa questo dispositivo', en: 'Import this device' })}
                            >
                              <Plus size={13} />
                            </button>
                          </>
                        ) : importStatus === 'update' ? (
                          <button
                            type="button"
                            disabled={importing}
                            onClick={() => void runImportOne(row)}
                            className="inline-flex h-7 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                            title={buildUpdateTitle(row)}
                          >
                            {t({ it: 'UPDATE', en: 'UPDATE' })}
                          </button>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {t({ it: 'OK', en: 'OK' })}
                          </span>
                        )}
                        {existingRow ? (
                          <button
                            type="button"
                            disabled={deleting}
                            onClick={() => requestPreviewDelete([String(row.devId)])}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                            title={t({ it: 'Rimuovi dal contenitore locale', en: 'Remove from local container' })}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{importStatus === 'existing' ? t({ it: 'Già importato', en: 'Already imported' }) : t({ it: 'Pronto per import', en: 'Ready to import' })}</span>
                      {importStatus === 'existing' ? (
                        <span className="text-sky-700">{t({ it: 'Già nel contenitore', en: 'Already in container' })}</span>
                      ) : importStatus === 'update' ? (
                        <span className="text-amber-700">{t({ it: 'Differenze rilevate', en: 'Changes detected' })}</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
              {!previewRightRows.length ? <div className="py-6 text-center text-sm text-slate-500">{t({ it: 'Nessun dispositivo', en: 'No devices' })}</div> : null}
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr),72px,minmax(0,0.9fr)]">
          <div className="flex flex-wrap items-center gap-2 pl-1">
            {selectedPreviewDeleteRows.length ? (
              <button
                type="button"
                onClick={() => void runDeleteMany(selectedPreviewDeleteRows.map((row) => row.devId))}
                disabled={Object.keys(previewDeletingIds).length > 0}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                title={t({ it: 'Rimuovi i dispositivi selezionati dal contenitore locale', en: 'Remove selected devices from the local container' })}
              >
                <X size={16} />
              </button>
            ) : null}
            <div className="text-sm text-slate-600">
              {t({ it: 'Selezionati per rimozione', en: 'Selected for removal' })}: <span className="font-semibold text-ink">{selectedPreviewDeleteRows.length}</span>
            </div>
          </div>
          <div />
          <div />
        </div>

        {previewContextMenu ? (
          <div
            className="fixed z-[135] min-w-[220px] rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
            style={{ left: previewContextMenu.x, top: previewContextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={previewContextMenuFocusRef}
              type="button"
              onClick={() => {
                selectAllPreviewVisible(previewContextMenu.side);
                setPreviewContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span>{t({ it: 'Seleziona tutto', en: 'Select all' })}</span>
              <span className="font-mono text-xs text-slate-400">
                {previewContextMenu.side === 'left' ? previewLeftRows.length : previewRightRows.filter((row) => row.importStatus !== 'existing').length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                clearPreviewSelection(previewContextMenu.side);
                setPreviewContextMenu(null);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span>{t({ it: 'Deseleziona tutto', en: 'Deselect all' })}</span>
              <span className="font-mono text-xs text-slate-400">
                {previewContextMenu.side === 'left' ? selectedPreviewDeleteRows.length : selectedPreviewImportRows.length}
              </span>
            </button>
          </div>
        ) : null}
      </ModalShell>

      <ModalShell
        open={devicesOpen}
        onClose={() => setDevicesOpen(false)}
        title={t({ it: 'Dispositivi importati', en: 'Imported devices' })}
        description={activeClient ? activeClient.name : ''}
        sizeClassName="max-w-6xl"
        rootClassName="z-[140]"
        backdropClassName="bg-black/35 backdrop-blur-sm"
        closeDisabled={devicesChildDialogOpen}
        initialFocusRef={devicesFocusRef as any}
      >
        <button ref={devicesFocusRef} type="button" className="sr-only" tabIndex={0}>focus</button>
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr,auto,auto,auto]">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
            <input value={devicesQuery} onChange={(e) => setDevicesQuery(e.target.value)} className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm" placeholder={t({ it: 'Cerca per nome/tipo/modello/seriale…', en: 'Search by name/type/model/serial…' })} />
          </div>
          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={includeMissing} onChange={(e) => setIncludeMissing(e.target.checked)} /> {t({ it: 'Include missing', en: 'Include missing' })}
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> {t({ it: 'Only missing', en: 'Only missing' })}
          </label>
          <button type="button" onClick={openManualCreate} className="inline-flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10">
            <Plus size={14} /> {t({ it: 'Nuovo manuale', en: 'New manual' })}
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          <div className="text-slate-600">
            {t({ it: 'Selezionati', en: 'Selected' })}: <span className="font-semibold text-ink">{selectedDeviceRows.length}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={selectAllVisibleDevices} disabled={!filteredDevices.length} className="btn-secondary disabled:opacity-50">
              {t({ it: 'Seleziona tutti', en: 'Select all' })}
            </button>
            <button type="button" onClick={clearDeviceSelection} disabled={!selectedDeviceRows.length} className="btn-secondary disabled:opacity-50">
              {t({ it: 'Pulisci selezione', en: 'Clear selection' })}
            </button>
            <button
              type="button"
              onClick={() => requestDevicesDelete(selectedDeviceRows)}
              disabled={!selectedDeviceRows.length || Object.keys(devicesDeletingIds).length > 0}
              className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
            >
              <Trash2 size={14} /> {t({ it: 'Elimina selezionati', en: 'Delete selected' })}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-12 px-3 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={!!filteredDevices.length && filteredDevices.every((row) => selectedDeviceIdSet.has(String(row.devId)))}
                    onChange={(event) => {
                      if (event.target.checked) selectAllVisibleDevices();
                      else clearDeviceSelection();
                    }}
                    aria-label={t({ it: 'Seleziona tutti i dispositivi visibili', en: 'Select all visible devices' })}
                  />
                </th>
                <th className="px-3 py-3 text-left">{t({ it: 'Nome dispositivo', en: 'Device name' })}</th>
                <th className="px-3 py-3 text-left">{t({ it: 'Tipo', en: 'Type' })}</th>
                <th className="px-3 py-3 text-left">{t({ it: 'Marca / Modello', en: 'Brand / Model' })}</th>
                <th className="px-3 py-3 text-left">Serial</th>
                <th className="px-3 py-3 text-left">ID</th>
                <th className="px-3 py-3 text-right">{t({ it: 'Azioni', en: 'Actions' })}</th>
              </tr>
            </thead>
            <tbody>
              {filteredDevices.map((row) => {
                const isManual = isManualDeviceRow(row);
                const selected = selectedDeviceIdSet.has(String(row.devId));
                const deleting = !!devicesDeletingIds[row.devId];
                return (
                  <tr key={`dev-row-${row.devId}`} className={`border-t border-slate-200 align-top ${selected ? 'bg-primary/5' : 'hover:bg-slate-50'}`}>
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => toggleDeviceSelection(String(row.devId), { shiftKey: !!(event.nativeEvent as MouseEvent).shiftKey })}
                        aria-label={t({ it: 'Seleziona dispositivo', en: 'Select device' })}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-ink">{getDisplayDeviceName(row)}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs">
                        {isManual ? <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 font-semibold text-violet-700">{t({ it: 'MANUALE', en: 'MANUAL' })}</span> : null}
                        {!row.present ? <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">{t({ it: 'MISSING', en: 'MISSING' })}</span> : null}
                        {row.hidden ? <span className="rounded-full border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">{t({ it: 'NASCOSTO', en: 'HIDDEN' })}</span> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{row.deviceType || '—'}</td>
                    <td className="px-3 py-3 text-slate-700">{[row.manufacturer, row.model].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="px-3 py-3 text-slate-700">{row.serialNumber || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{row.devId || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {isManual ? (
                          <button type="button" onClick={() => openManualEdit(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" title={t({ it: 'Modifica', en: 'Edit' })}>
                            <Pencil size={14} />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={deleting}
                          onClick={() => requestDevicesDelete([row])}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                          title={t({ it: 'Elimina', en: 'Delete' })}
                        >
                          <Trash2 size={14} />
                        </button>
                        <button type="button" onClick={() => void toggleHidden(row)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50" title={row.hidden ? t({ it: 'Mostra dispositivo', en: 'Show device' }) : t({ it: 'Nascondi dispositivo', en: 'Hide device' })}>
                          {row.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!filteredDevices.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    {devicesLoading
                      ? t({ it: 'Caricamento…', en: 'Loading…' })
                      : t({
                          it: 'Non ci sono device importati per questo cliente.',
                          en: 'There are no imported devices for this client.'
                        })}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </ModalShell>

      <ModalShell
        open={manualDeviceModalOpen}
        onClose={() => {
          if (manualDeviceSaving) return;
          setManualDeviceModalOpen(false);
        }}
        title={manualDeviceEditingId ? t({ it: 'Modifica dispositivo manuale', en: 'Edit manual device' }) : t({ it: 'Nuovo dispositivo manuale', en: 'New manual device' })}
        description={activeClient ? activeClient.name : ''}
        sizeClassName="max-w-3xl"
        rootClassName="z-[150]"
        backdropClassName="bg-black/40 backdrop-blur-sm"
        initialFocusRef={manualFocusRef as any}
      >
        <button ref={manualFocusRef} type="button" className="sr-only" tabIndex={0}>focus</button>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { key: 'devId', label: 'Device ID', placeholder: 'manual:...' },
            { key: 'deviceType', label: t({ it: 'Tipo dispositivo', en: 'Device type' }), placeholder: 'Desktop PC / Laptop / Tablet / Mobile' },
            { key: 'deviceName', label: t({ it: 'Nome dispositivo', en: 'Device name' }), placeholder: 'AR-BI-WK130' },
            { key: 'manufacturer', label: t({ it: 'Manufacturer', en: 'Manufacturer' }), placeholder: 'Dell' },
            { key: 'model', label: 'Model', placeholder: 'Optiplex 5060' },
            { key: 'serialNumber', label: 'Serial', placeholder: 'ST01301' }
          ].map((field) => (
            <label key={field.key} className="block text-sm font-medium text-slate-700">
              {field.label}
              <input
                value={(manualDeviceForm as any)[field.key] || ''}
                onChange={(e) => setManualDeviceForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                disabled={field.key === 'devId' && !!manualDeviceEditingId}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder={field.placeholder}
              />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" onClick={() => setManualDeviceModalOpen(false)} disabled={manualDeviceSaving} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {t({ it: 'Chiudi', en: 'Close' })}
          </button>
          <button type="button" onClick={() => void saveManualDevice()} disabled={manualDeviceSaving || !activeClientId} className="btn-primary disabled:opacity-60">
            {manualDeviceSaving ? t({ it: 'Salvataggio…', en: 'Saving…' }) : t({ it: 'Salva', en: 'Save' })}
          </button>
        </div>
      </ModalShell>

      <ModalShell
        open={csvConfirmOpen}
        onClose={() => {
          if (csvImporting) return;
          setCsvConfirmOpen(false);
          setCsvFile(null);
        }}
        title={t({ it: 'Import CSV dispositivi', en: 'Device CSV import' })}
        description={t({
          it: 'Scegli se sommare i dispositivi dal CSV o sostituire l’intero contenitore dispositivi del cliente.',
          en: 'Choose whether to append CSV devices or replace the whole client device container.'
        })}
        sizeClassName="max-w-2xl"
        rootClassName="z-[160]"
        backdropClassName="bg-black/40 backdrop-blur-sm"
      >
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          {t({
            it: `File selezionato: ${csvFile?.name || '-'}`,
            en: `Selected file: ${csvFile?.name || '-'}`
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (csvImporting) return;
              setCsvConfirmOpen(false);
              setCsvFile(null);
            }}
            disabled={csvImporting}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {t({ it: 'Annulla', en: 'Cancel' })}
          </button>
          <button
            type="button"
            onClick={() => void runCsvImport('append')}
            disabled={csvImporting}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
          >
            {csvImporting ? t({ it: 'Importazione…', en: 'Importing…' }) : t({ it: 'Somma', en: 'Append' })}
          </button>
          <button
            type="button"
            onClick={() => void runCsvImport('replace')}
            disabled={csvImporting}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            <Trash2 size={14} />
            {csvImporting ? t({ it: 'Importazione…', en: 'Importing…' }) : t({ it: 'Sostituisci tutto', en: 'Replace all' })}
          </button>
        </div>
      </ModalShell>

      <ConfirmDialog
        open={clearConfirmOpen}
        title={t({ it: 'Eliminare import dispositivi?', en: 'Delete device import?' })}
        description={t({
          it: `Verranno rimossi ${activeSummary?.total || 0} dispositivi importati dal cliente selezionato.`,
          en: `${activeSummary?.total || 0} imported devices will be removed from selected client.`
        })}
        confirmLabel={clearing ? t({ it: 'Eliminazione…', en: 'Deleting…' }) : t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onConfirm={() => void runClear()}
        onCancel={() => {
          if (clearing) return;
          setClearConfirmOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!previewDeleteRequest}
        title={t({ it: 'Rimuovere dal contenitore locale?', en: 'Remove from local container?' })}
        description={t({
          it:
            (previewDeleteRequest?.count || 0) === 1
              ? 'Il dispositivo selezionato verrà rimosso dal contenitore locale. Nota importante: Plixmap non traccia ancora in modo strutturato i device importati nelle planimetrie, quindi prima di confermare verifica eventuali posizionamenti manuali in mappa.'
              : `${previewDeleteRequest?.count || 0} dispositivi selezionati verranno rimossi dal contenitore locale. Nota importante: Plixmap non traccia ancora in modo strutturato i device importati nelle planimetrie, quindi prima di confermare verifica eventuali posizionamenti manuali in mappa.`,
          en:
            (previewDeleteRequest?.count || 0) === 1
              ? 'The selected device will be removed from the local container. Important: Plixmap does not structurally track imported devices on floor plans yet, so verify any manual floor-plan placements before confirming.'
              : `${previewDeleteRequest?.count || 0} selected devices will be removed from the local container. Important: Plixmap does not structurally track imported devices on floor plans yet, so verify any manual floor-plan placements before confirming.`
        })}
        confirmLabel={t({ it: 'Rimuovi', en: 'Remove' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onConfirm={() => void confirmPreviewDelete()}
        onCancel={() => setPreviewDeleteRequest(null)}
      />

      <ConfirmDialog
        open={!!devicesDeleteRequest?.length}
        title={t({ it: 'Rimuovere i dispositivi selezionati?', en: 'Delete selected devices?' })}
        description={t({
          it:
            !devicesDeleteRequest?.length
              ? ''
              : devicesDeleteRequest.some((row) => !isManualDeviceRow(row))
                ? `${devicesDeleteRequest.length} dispositivi verranno rimossi. Nota importante: per i dispositivi importati Plixmap non traccia ancora in modo strutturato eventuali posizionamenti manuali in planimetria, quindi verifica la mappa prima di confermare.`
                : `${devicesDeleteRequest.length} dispositivi manuali verranno rimossi dal contenitore locale.`,
          en:
            !devicesDeleteRequest?.length
              ? ''
              : devicesDeleteRequest.some((row) => !isManualDeviceRow(row))
                ? `${devicesDeleteRequest.length} devices will be removed. Important: for imported devices Plixmap does not structurally track manual floor-plan placements yet, so verify the map before confirming.`
                : `${devicesDeleteRequest.length} manual devices will be removed from the local container.`
        })}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
        onConfirm={() => void confirmDevicesDelete()}
        onCancel={() => setDevicesDeleteRequest(null)}
      />
    </>
  );
};

export default ClientDevicesImportPanel;
