import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Database, Download, FileSpreadsheet, Info, RefreshCw, Upload } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { useT } from '../../i18n/useT';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { createCustomField } from '../../api/customFields';
import { saveState } from '../../api/state';
import { createServerBackup, fetchServerBackups, getServerBackupDownloadUrl, type ServerBackupRow } from '../../api/backup';

type SpreadsheetColumn = { header: string; key: string; width?: number };
type SpreadsheetRow = Record<string, unknown>;
type SpreadsheetSheet = { name: string; columns: SpreadsheetColumn[]; rows: SpreadsheetRow[] };

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

const fetchAsDataUrl = async (url: string) => {
  const res = await fetch(url, { credentials: 'include' });
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
};

const escapeXml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const sanitizeWorksheetName = (name: string) => {
  const cleaned = String(name || '')
    .replace(/[\\/*?:[\]]/g, '_')
    .trim();
  if (!cleaned) return 'Sheet';
  return cleaned.slice(0, 31);
};

const renderSpreadsheetCell = (value: unknown, header = false) => {
  const style = header ? ' ss:StyleID="Header"' : '';
  if (value === null || value === undefined || value === '') return `<Cell${style}/>`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<Cell${style}><Data ss:Type="Number">${String(value)}</Data></Cell>`;
  }
  if (typeof value === 'boolean') {
    return `<Cell${style}><Data ss:Type="Boolean">${value ? '1' : '0'}</Data></Cell>`;
  }
  return `<Cell${style}><Data ss:Type="String">${escapeXml(value)}</Data></Cell>`;
};

const buildSpreadsheetXml = (sheets: SpreadsheetSheet[]) => {
  const worksheetXml = sheets
    .map((sheet) => {
      const columns = sheet.columns
        .map((column) => {
          const width = Number(column.width || 0);
          const resolvedWidth = width > 0 ? Math.max(48, width * 6.6) : 110;
          return `<Column ss:AutoFitWidth="0" ss:Width="${resolvedWidth.toFixed(2)}"/>`;
        })
        .join('');
      const headerRow = `<Row>${sheet.columns.map((column) => renderSpreadsheetCell(column.header, true)).join('')}</Row>`;
      const rows = sheet.rows
        .map((row) => `<Row>${sheet.columns.map((column) => renderSpreadsheetCell(row[column.key])).join('')}</Row>`)
        .join('');
      return `<Worksheet ss:Name="${escapeXml(sanitizeWorksheetName(sheet.name))}"><Table>${columns}${headerRow}${rows}</Table></Worksheet>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#EEF2FF" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${worksheetXml}
</Workbook>`;
};

const BackupPanel = () => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const { clients, objectTypes, setClients, setServerState } = useDataStore();
  const customFields = useCustomFieldsStore((s) => s.fields);
  const [exportAssets, setExportAssets] = useState(true);
  const [busy, setBusy] = useState(false);
  const [serverBackupBusy, setServerBackupBusy] = useState(false);
  const [serverBackupDir, setServerBackupDir] = useState('');
  const [serverBackupRetention, setServerBackupRetention] = useState(0);
  const [serverBackups, setServerBackups] = useState<ServerBackupRow[]>([]);

  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [expandedSites, setExpandedSites] = useState<Record<string, boolean>>({});
  const [selectedPlanIds, setSelectedPlanIds] = useState<Record<string, boolean>>({});

  // Default: select everything (so export works out-of-the-box).
  useEffect(() => {
    setSelectedPlanIds((prev) => {
      const next = { ...prev };
      for (const c of clients || []) {
        for (const s of c.sites || []) {
          for (const p of s.floorPlans || []) {
            if (!(p.id in next)) next[p.id] = true;
          }
        }
      }
      // Drop removed planIds from selection.
      const existing = new Set((clients || []).flatMap((c) => (c.sites || []).flatMap((s) => (s.floorPlans || []).map((p) => p.id))));
      for (const k of Object.keys(next)) if (!existing.has(k)) delete next[k];
      return next;
    });
  }, [clients]);

  const selectedCount = useMemo(() => Object.values(selectedPlanIds).filter(Boolean).length, [selectedPlanIds]);
  const formatBytes = useCallback((bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIdx = 0;
    while (size >= 1024 && unitIdx < units.length - 1) {
      size /= 1024;
      unitIdx += 1;
    }
    return `${size.toFixed(unitIdx === 0 ? 0 : 1)} ${units[unitIdx]}`;
  }, []);

  const loadServerBackups = useCallback(async () => {
    try {
      const data = await fetchServerBackups();
      setServerBackupDir(data.backupDir || '');
      setServerBackupRetention(Number(data.retention || 0) || 0);
      setServerBackups(Array.isArray(data.backups) ? data.backups : []);
    } catch {
      setServerBackups([]);
      setServerBackupDir('');
      setServerBackupRetention(0);
    }
  }, []);

  useEffect(() => {
    void loadServerBackups();
  }, [loadServerBackups]);

  const filteredClients = useMemo(() => {
    const selected = new Set(Object.entries(selectedPlanIds).filter(([, v]) => !!v).map(([id]) => id));
    const stripRealUsers = (plan: any) => {
      const filterObjects = (objs: any) => (Array.isArray(objs) ? objs.filter((o) => o?.type !== 'real_user') : objs);
      plan.objects = filterObjects(plan.objects);
      if (Array.isArray(plan.revisions)) {
        plan.revisions = plan.revisions.map((r: any) => ({ ...r, objects: filterObjects(r.objects) }));
      }
      return plan;
    };

    const next = structuredClone(clients || []);
    for (const c of next) {
      c.sites = (c.sites || [])
        .map((s: any) => {
          s.floorPlans = (s.floorPlans || []).filter((p: any) => selected.has(p.id)).map(stripRealUsers);
          return s;
        })
        .filter((s: any) => (s.floorPlans || []).length);
    }
    return next.filter((c) => (c.sites || []).length);
  }, [clients, selectedPlanIds]);

  const handleCreateServerBackup = async () => {
    if (serverBackupBusy) return;
    setServerBackupBusy(true);
    try {
      const result = await createServerBackup();
      const pruned = Array.isArray(result?.backup?.pruned) ? result.backup.pruned.length : 0;
      push(
        t({
          it: pruned
            ? `Backup creato (${result.backup.fileName}), puliti ${pruned} vecchi backup`
            : `Backup creato (${result.backup.fileName})`,
          en: pruned
            ? `Backup created (${result.backup.fileName}), pruned ${pruned} old backups`
            : `Backup created (${result.backup.fileName})`
        }),
        'success'
      );
      await loadServerBackups();
    } catch {
      push(t({ it: 'Errore creazione backup server', en: 'Server backup failed' }), 'danger');
    } finally {
      setServerBackupBusy(false);
    }
  };

  const exportJson = async () => {
    if (!selectedCount) {
      push(t({ it: 'Seleziona almeno una planimetria', en: 'Select at least one floor plan' }), 'info');
      return;
    }
    setBusy(true);
    try {
      const payload: any = {
        kind: 'plixmap-workspace',
        version: 2,
        exportedAt: Date.now(),
        objectTypes,
        // Custom fields are stored per-user in the DB; we export the current user definitions.
        customFields: customFields || [],
        clients: structuredClone(filteredClients)
      };

      if (exportAssets) {
        const rewriteUrl = async (value: any) => {
          if (typeof value !== 'string') return value;
          if (value.startsWith('data:')) return value;
          try {
            const u = new URL(value, window.location.origin);
            if (u.pathname.startsWith('/uploads/') || u.pathname.startsWith('/seed/')) {
              return await fetchAsDataUrl(u.toString());
            }
          } catch {
            // ignore
          }
          if (value.startsWith('/uploads/') || value.startsWith('/seed/')) {
            try {
              return await fetchAsDataUrl(value);
            } catch {
              return value;
            }
          }
          return value;
        };
        for (const c of payload.clients || []) {
          c.logoUrl = await rewriteUrl(c.logoUrl);
          if (Array.isArray(c.attachments)) {
            for (const a of c.attachments) a.dataUrl = await rewriteUrl(a.dataUrl);
          }
          for (const s of c.sites || []) {
            for (const p of s.floorPlans || []) {
              p.imageUrl = await rewriteUrl(p.imageUrl);
              for (const r of p.revisions || []) r.imageUrl = await rewriteUrl(r.imageUrl);
            }
          }
        }
      }

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      downloadBlob(blob, `plixmap-workspace-${new Date().toISOString().slice(0, 10)}.json`);
      push(t({ it: 'Esportazione completata', en: 'Export completed' }), 'success');
    } catch {
      push(t({ it: 'Errore esportazione', en: 'Export failed' }), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = async () => {
    if (!selectedCount) {
      push(t({ it: 'Seleziona almeno una planimetria', en: 'Select at least one floor plan' }), 'info');
      return;
    }
    setBusy(true);
    try {
      const addSheet = (name: string, columns: SpreadsheetColumn[], rows: SpreadsheetRow[]): SpreadsheetSheet => ({
        name,
        columns,
        rows
      });

      const clientsRows: SpreadsheetRow[] = [];
      const sitesRows: SpreadsheetRow[] = [];
      const plansRows: SpreadsheetRow[] = [];
      const layersRows: SpreadsheetRow[] = [];
      const roomsRows: SpreadsheetRow[] = [];
      const viewsRows: SpreadsheetRow[] = [];
      const objectsRows: SpreadsheetRow[] = [];

      for (const c of filteredClients) {
        clientsRows.push({
          id: c.id,
          shortName: c.shortName || '',
          name: c.name,
          address: c.address || '',
          phone: c.phone || '',
          email: c.email || '',
          pecEmail: c.pecEmail || '',
          vatId: c.vatId || '',
          description: c.description || '',
          logoUrl: c.logoUrl || ''
        });
        for (const s of c.sites || []) {
          sitesRows.push({ id: s.id, clientId: c.id, name: s.name, coords: (s as any).coords || '' });
          for (const p of s.floorPlans || []) {
            plansRows.push({
              id: p.id,
              siteId: s.id,
              name: p.name,
              imageUrl: p.imageUrl,
              width: p.width ?? '',
              height: p.height ?? '',
              order: (p as any).order ?? ''
            });
            for (const l of (p as any).layers || []) {
              layersRows.push({ planId: p.id, id: l.id, name_it: l.name?.it || '', name_en: l.name?.en || '', color: l.color || '', order: l.order ?? '' });
            }
            for (const r of (p.rooms || []) as any[]) {
              roomsRows.push({
                planId: p.id,
                id: r.id,
                name: r.name,
                kind: r.kind || '',
                x: r.x ?? '',
                y: r.y ?? '',
                width: r.width ?? '',
                height: r.height ?? '',
                points: r.points ? JSON.stringify(r.points) : ''
              });
            }
            for (const v of (p.views || []) as any[]) {
              viewsRows.push({
                planId: p.id,
                id: v.id,
                name: v.name,
                description: v.description || '',
                zoom: v.zoom,
                panX: v.pan?.x ?? 0,
                panY: v.pan?.y ?? 0,
                isDefault: !!v.isDefault
              });
            }
            for (const o of (p.objects || []) as any[]) {
              if (o.type === 'real_user') continue;
              objectsRows.push({
                planId: p.id,
                id: o.id,
                type: o.type,
                name: o.name,
                description: o.description || '',
                x: o.x,
                y: o.y,
                scale: o.scale ?? 1,
                roomId: o.roomId || '',
                layerIds: Array.isArray(o.layerIds) ? o.layerIds.join(',') : ''
              });
            }
          }
        }
      }

      const sheets: SpreadsheetSheet[] = [
        addSheet(
          'ObjectTypes',
          [
            { header: 'id', key: 'id', width: 18 },
            { header: 'name_it', key: 'name_it', width: 22 },
            { header: 'name_en', key: 'name_en', width: 22 },
            { header: 'icon', key: 'icon', width: 14 },
            { header: 'builtin', key: 'builtin', width: 10 }
          ],
          objectTypes.map((o) => ({ id: o.id, name_it: o.name.it, name_en: o.name.en, icon: o.icon, builtin: !!o.builtin }))
        ),
        addSheet(
          'CustomFields',
          [
            { header: 'typeId', key: 'typeId', width: 18 },
            { header: 'fieldKey', key: 'fieldKey', width: 18 },
            { header: 'label', key: 'label', width: 26 },
            { header: 'valueType', key: 'valueType', width: 10 }
          ],
          (customFields || []).map((f) => ({ typeId: f.typeId, fieldKey: f.fieldKey, label: f.label, valueType: f.valueType }))
        ),
        addSheet(
        'Clients',
        [
          { header: 'id', key: 'id', width: 22 },
          { header: 'shortName', key: 'shortName', width: 14 },
          { header: 'name', key: 'name', width: 32 },
          { header: 'address', key: 'address', width: 28 },
          { header: 'phone', key: 'phone', width: 18 },
          { header: 'email', key: 'email', width: 26 },
          { header: 'pecEmail', key: 'pecEmail', width: 26 },
          { header: 'vatId', key: 'vatId', width: 18 },
          { header: 'description', key: 'description', width: 32 },
          { header: 'logoUrl', key: 'logoUrl', width: 28 }
        ],
        clientsRows
      ),
      addSheet(
        'Sites',
        [
          { header: 'id', key: 'id', width: 22 },
          { header: 'clientId', key: 'clientId', width: 22 },
          { header: 'name', key: 'name', width: 28 },
          { header: 'coords', key: 'coords', width: 22 }
        ],
        sitesRows
      ),
      addSheet(
        'FloorPlans',
        [
          { header: 'id', key: 'id', width: 22 },
          { header: 'siteId', key: 'siteId', width: 22 },
          { header: 'name', key: 'name', width: 26 },
          { header: 'imageUrl', key: 'imageUrl', width: 28 },
          { header: 'width', key: 'width', width: 10 },
          { header: 'height', key: 'height', width: 10 },
          { header: 'order', key: 'order', width: 8 }
        ],
        plansRows
      ),
      addSheet(
        'Layers',
        [
          { header: 'planId', key: 'planId', width: 22 },
          { header: 'id', key: 'id', width: 16 },
          { header: 'name_it', key: 'name_it', width: 22 },
          { header: 'name_en', key: 'name_en', width: 22 },
          { header: 'color', key: 'color', width: 12 },
          { header: 'order', key: 'order', width: 8 }
        ],
        layersRows
      ),
      addSheet(
        'Rooms',
        [
          { header: 'planId', key: 'planId', width: 22 },
          { header: 'id', key: 'id', width: 18 },
          { header: 'name', key: 'name', width: 22 },
          { header: 'kind', key: 'kind', width: 10 },
          { header: 'x', key: 'x', width: 10 },
          { header: 'y', key: 'y', width: 10 },
          { header: 'width', key: 'width', width: 10 },
          { header: 'height', key: 'height', width: 10 },
          { header: 'points', key: 'points', width: 30 }
        ],
        roomsRows
      ),
      addSheet(
        'Views',
        [
          { header: 'planId', key: 'planId', width: 22 },
          { header: 'id', key: 'id', width: 18 },
          { header: 'name', key: 'name', width: 22 },
          { header: 'description', key: 'description', width: 28 },
          { header: 'zoom', key: 'zoom', width: 10 },
          { header: 'panX', key: 'panX', width: 10 },
          { header: 'panY', key: 'panY', width: 10 },
          { header: 'isDefault', key: 'isDefault', width: 10 }
        ],
        viewsRows
      ),
      addSheet(
        'Objects',
        [
          { header: 'planId', key: 'planId', width: 22 },
          { header: 'id', key: 'id', width: 18 },
          { header: 'type', key: 'type', width: 14 },
          { header: 'name', key: 'name', width: 22 },
          { header: 'description', key: 'description', width: 28 },
          { header: 'x', key: 'x', width: 10 },
          { header: 'y', key: 'y', width: 10 },
          { header: 'scale', key: 'scale', width: 10 },
          { header: 'roomId', key: 'roomId', width: 18 },
          { header: 'layerIds', key: 'layerIds', width: 22 }
        ],
        objectsRows
      )
      ];

      const xml = buildSpreadsheetXml(sheets);
      downloadBlob(new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' }), 'plixmap-workspace.xls');
      push(t({ it: 'Excel esportato', en: 'Excel exported' }), 'success');
    } catch {
      push(t({ it: 'Errore export Excel', en: 'Excel export failed' }), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const handleImportJson = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const kind = String(parsed?.kind || '').trim();
      if (!parsed || !Array.isArray(parsed.clients) || (kind !== 'plixmap-workspace' && kind !== 'deskly-workspace')) {
        push(t({ it: 'File non valido', en: 'Invalid file' }), 'danger');
        return;
      }
      if (
        !window.confirm(
          t({
            it: 'Importare e sostituire il workspace corrente? Operazione irreversibile.',
            en: 'Import and replace the current workspace? This cannot be undone.'
          })
        )
      ) {
        return;
      }
      const nextObjectTypes = Array.isArray(parsed.objectTypes) ? parsed.objectTypes : objectTypes;
      const nextClients = parsed.clients;

      // Persist on server (also externalizes embedded data URLs into /uploads) then update the local store.
      try {
        await saveState(nextClients, nextObjectTypes);
      } catch {
        // If server isn't reachable (offline), we still update locally.
      }
      setServerState({ clients: nextClients, objectTypes: nextObjectTypes });
      setClients(nextClients);

      // Best-effort import custom fields (per-user)
      if (Array.isArray(parsed.customFields)) {
        for (const f of parsed.customFields) {
          const typeId = String(f?.typeId || '').trim();
          const fieldKey = String(f?.fieldKey || '').trim();
          const label = String(f?.label || '').trim();
          const valueType = f?.valueType;
          if (!typeId || !label || !valueType) continue;
          try {
            await createCustomField({ typeId, fieldKey: fieldKey || undefined, label, valueType });
          } catch {
            // ignore duplicates / invalid
          }
        }
      }

      push(t({ it: 'Import completato. Ricarico…', en: 'Import completed. Reloading…' }), 'success');
      window.setTimeout(() => window.location.reload(), 600);
    } catch {
      push(t({ it: 'Errore import', en: 'Import failed' }), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const infoBox = useMemo(
    () =>
      t({
        it:
          'Questa funzione esporta/importa solo: clienti, sedi, planimetrie, stanze/viste/livelli, oggetti (esclusi “Utente reale”), tipologie di oggetti e campi personalizzati. Non include: utenti del portale, password, configurazioni web API, utenti reali importati.',
        en:
          'This export/import includes only: clients, sites, floor plans, rooms/views/layers, objects (excluding “Real user”), object types and custom fields. It does NOT include: portal users, passwords, web API configs, imported real users.'
      }),
    [t]
  );

  const toggleAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const c of clients || []) for (const s of c.sites || []) for (const p of s.floorPlans || []) next[p.id] = value;
    setSelectedPlanIds(next);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-amber-700">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">{t({ it: 'Backup & Import/Export', en: 'Backup & Import/Export' })}</div>
            <div className="modal-description">{infoBox}</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Database size={16} /> {t({ it: 'Backup database server (SQLite)', en: 'Server database backup (SQLite)' })}
            </div>
            <div className="modal-description">
              {t({
                it: 'Backup atomico del database con retention automatica lato server.',
                en: 'Atomic database backup with automatic retention on server side.'
              })}
            </div>
            <div className="mt-2 text-xs text-slate-600">
              {t({ it: 'Directory', en: 'Directory' })}: <span className="font-mono">{serverBackupDir || '—'}</span>
              {' · '}
              {t({ it: 'Retention', en: 'Retention' })}: {serverBackupRetention || 0}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadServerBackups()}
              disabled={serverBackupBusy}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
              title={t({ it: 'Ricarica elenco backup', en: 'Reload backups list' })}
            >
              <RefreshCw size={15} /> {t({ it: 'Aggiorna', en: 'Refresh' })}
            </button>
            <button
              onClick={handleCreateServerBackup}
              disabled={serverBackupBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              title={t({ it: 'Crea backup server', en: 'Create server backup' })}
            >
              <Download size={15} />
              {serverBackupBusy ? t({ it: 'In corso…', en: 'Running…' }) : t({ it: 'Crea backup', en: 'Create backup' })}
            </button>
          </div>
        </div>
        <div className="mt-3 max-h-44 overflow-auto rounded-xl border border-slate-200">
          {serverBackups.length ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">{t({ it: 'File', en: 'File' })}</th>
                  <th className="px-3 py-2">{t({ it: 'Dimensione', en: 'Size' })}</th>
                  <th className="px-3 py-2">{t({ it: 'Data', en: 'Date' })}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {serverBackups.map((backup) => (
                  <tr key={backup.fileName} className="text-slate-700">
                    <td className="px-3 py-2">
                      <a
                        href={getServerBackupDownloadUrl(backup.fileName)}
                        className="font-mono text-[11px] font-semibold text-primary hover:underline"
                      >
                        {backup.fileName}
                      </a>
                    </td>
                    <td className="px-3 py-2">{formatBytes(backup.sizeBytes)}</td>
                    <td className="px-3 py-2">{new Date(backup.updatedAt || backup.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-3 py-3 text-xs text-slate-500">{t({ it: 'Nessun backup disponibile.', en: 'No backups available.' })}</div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Info size={16} /> {t({ it: 'Selezione export', en: 'Export selection' })}
            </div>
            <div className="modal-description">
              {t({
                it: 'Scegli quali planimetrie includere. Verranno esportate anche le sedi e i clienti necessari.',
                en: 'Choose which floor plans to include. Related sites and clients are exported automatically.'
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleAll(true)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
              title={t({ it: 'Seleziona tutte le planimetrie', en: 'Select all floor plans' })}
            >
              {t({ it: 'Tutte', en: 'All' })}
            </button>
            <button
              onClick={() => toggleAll(false)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
              title={t({ it: 'Deseleziona tutte le planimetrie', en: 'Deselect all floor plans' })}
            >
              {t({ it: 'Nessuna', en: 'None' })}
            </button>
          </div>
        </div>

        <div className="mt-4 max-h-[360px] overflow-auto rounded-2xl border border-slate-200">
          <div className="divide-y divide-slate-100">
            {(clients || []).map((c) => {
              const cOpen = !!expandedClients[c.id];
              const clientPlanIds = (c.sites || []).flatMap((s: any) => (s.floorPlans || []).map((p: any) => p.id));
              const clientChecked = clientPlanIds.length ? clientPlanIds.every((id: string) => !!selectedPlanIds[id]) : false;
              return (
                <div key={c.id} className="bg-white">
                  <button
                    onClick={() => setExpandedClients((p) => ({ ...p, [c.id]: !cOpen }))}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-ink hover:bg-slate-50"
                    title={
                      cOpen
                        ? t({ it: 'Comprimi cliente', en: 'Collapse client' })
                        : t({ it: 'Espandi cliente', en: 'Expand client' })
                    }
                  >
                    <span className="flex items-center gap-2">
                      {cOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <input
                        type="checkbox"
                        checked={clientChecked}
                        onChange={(e) => {
                          const next = { ...selectedPlanIds };
                          for (const id of clientPlanIds) next[id] = e.target.checked;
                          setSelectedPlanIds(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="truncate">{c.shortName || c.name}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">{clientPlanIds.length}</span>
                  </button>
                  {cOpen ? (
                    <div className="space-y-2 px-3 pb-3">
                      {(c.sites || []).map((s: any) => {
                        const skey = `${c.id}:${s.id}`;
                        const sOpen = !!expandedSites[skey];
                        const sitePlanIds = (s.floorPlans || []).map((p: any) => p.id);
                        const siteChecked = sitePlanIds.length ? sitePlanIds.every((id: string) => !!selectedPlanIds[id]) : false;
                        return (
                          <div key={s.id} className="rounded-xl border border-slate-200 bg-white">
                            <button
                              onClick={() => setExpandedSites((p) => ({ ...p, [skey]: !sOpen }))}
                              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              title={
                                sOpen
                                  ? t({ it: 'Comprimi sede', en: 'Collapse site' })
                                  : t({ it: 'Espandi sede', en: 'Expand site' })
                              }
                            >
                              <span className="flex items-center gap-2">
                                {sOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <input
                                  type="checkbox"
                                  checked={siteChecked}
                                  onChange={(e) => {
                                    const next = { ...selectedPlanIds };
                                    for (const id of sitePlanIds) next[id] = e.target.checked;
                                    setSelectedPlanIds(next);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="truncate">{s.name}</span>
                              </span>
                              <span className="text-xs font-semibold text-slate-500">{sitePlanIds.length}</span>
                            </button>
                            {sOpen ? (
                              <div className="divide-y divide-slate-100">
                                {(s.floorPlans || []).map((p: any) => (
                                  <label key={p.id} className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                    <span className="flex items-center gap-2">
                                      <input
                                        type="checkbox"
                                        checked={!!selectedPlanIds[p.id]}
                                        onChange={(e) => setSelectedPlanIds((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                                      />
                                      <span className="truncate font-medium">{p.name}</span>
                                    </span>
                                  </label>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!clients.length ? (
              <div className="px-3 py-6 text-sm text-slate-600">{t({ it: 'Nessun cliente.', en: 'No clients.' })}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-sm text-slate-600">
            {t({ it: `Selezionate: ${selectedCount}`, en: `Selected: ${selectedCount}` })}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={exportAssets} onChange={(e) => setExportAssets(e.target.checked)} />
            {t({ it: 'Includi immagini e allegati', en: 'Include images and attachments' })}
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Esporta (JSON)', en: 'Export (JSON)' })}</div>
          <div className="mt-2 text-sm text-slate-600">
            {t({
              it: 'Consigliato per migrare dati tra installazioni.',
              en: 'Recommended for migrating data between installations.'
            })}
          </div>
          <button
            onClick={exportJson}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-primary/90 disabled:opacity-50"
            title={t({ it: 'Esporta le planimetrie selezionate in JSON', en: 'Export selected floor plans to JSON' })}
          >
            <Download size={16} /> {t({ it: 'Esporta JSON', en: 'Export JSON' })}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Importa (JSON)', en: 'Import (JSON)' })}</div>
          <div className="mt-2 text-sm text-slate-600">
            {t({
              it: 'Sostituisce il workspace corrente con quello del file.',
              en: 'Replaces the current workspace with the one in the file.'
            })}
          </div>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
            <Upload size={16} /> {t({ it: 'Seleziona file JSON…', en: 'Choose JSON file…' })}
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => handleImportJson(e.target.files?.[0] || null)}
              disabled={busy}
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="text-sm font-semibold text-ink">{t({ it: 'Esporta (Excel)', en: 'Export (Excel)' })}</div>
        <div className="mt-2 text-sm text-slate-600">
          {t({
            it: 'Crea un file XLSX con le tabelle principali. Nota: non include utenti del portale e configurazioni web API.',
            en: 'Creates an XLSX file with the main tables. Note: it does not include portal users and web API configs.'
          })}
        </div>
        <button
          onClick={exportExcel}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
          title={t({ it: 'Esporta le tabelle in formato Excel', en: 'Export tables in Excel format' })}
        >
          <FileSpreadsheet size={16} /> {t({ it: 'Esporta Excel', en: 'Export Excel' })}
        </button>
      </div>
    </div>
  );
};

export default BackupPanel;
