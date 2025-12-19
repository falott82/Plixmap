import { useMemo, useState } from 'react';
import { Download, Upload, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import { useT } from '../../i18n/useT';

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
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
};

const BackupPanel = () => {
  const t = useT();
  const push = useToastStore((s) => s.push);
  const { clients, objectTypes, setClients, setServerState } = useDataStore();
  const [exportAssets, setExportAssets] = useState(true);
  const [busy, setBusy] = useState(false);

  const exportJson = async () => {
    setBusy(true);
    try {
      const payload: any = {
        kind: 'deskly-workspace',
        version: 1,
        exportedAt: Date.now(),
        objectTypes,
        clients: structuredClone(clients)
      };
      if (exportAssets) {
        const rewriteUrl = async (value: any) => {
          if (typeof value !== 'string') return value;
          if (value.startsWith('data:')) return value;
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
      downloadBlob(blob, `deskly-workspace-${new Date().toISOString().slice(0, 10)}.json`);
      push(t({ it: 'Esportazione completata', en: 'Export completed' }), 'success');
    } catch {
      push(t({ it: 'Errore esportazione', en: 'Export failed' }), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = async () => {
    setBusy(true);
    try {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Deskly';
      wb.created = new Date();

      const addSheet = (name: string, columns: { header: string; key: string; width?: number }[], rows: any[]) => {
        const ws = wb.addWorksheet(name);
        ws.columns = columns as any;
        ws.getRow(1).font = { bold: true };
        ws.addRows(rows);
      };

      const clientsRows: any[] = [];
      const sitesRows: any[] = [];
      const plansRows: any[] = [];
      const layersRows: any[] = [];
      const roomsRows: any[] = [];
      const viewsRows: any[] = [];
      const objectsRows: any[] = [];

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
      );

      for (const c of clients) {
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
      );
      addSheet(
        'Sites',
        [
          { header: 'id', key: 'id', width: 22 },
          { header: 'clientId', key: 'clientId', width: 22 },
          { header: 'name', key: 'name', width: 28 },
          { header: 'coords', key: 'coords', width: 22 }
        ],
        sitesRows
      );
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
      );
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
      );
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
      );
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
      );
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
      );

      const buf = await wb.xlsx.writeBuffer();
      downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'deskly-workspace.xlsx');
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
      if (!parsed || parsed.kind !== 'deskly-workspace' || !Array.isArray(parsed.clients)) {
        push(t({ it: 'File non valido', en: 'Invalid file' }), 'danger');
        return;
      }
      if (!window.confirm(t({ it: 'Importare e sostituire il workspace corrente? Operazione irreversibile.', en: 'Import and replace the current workspace? This cannot be undone.' }))) {
        return;
      }
      const nextObjectTypes = Array.isArray(parsed.objectTypes) ? parsed.objectTypes : objectTypes;
      const nextClients = parsed.clients;
      // Update store (and mark as saved) then force sync via App autosave.
      setServerState({ clients: nextClients, objectTypes: nextObjectTypes });
      setClients(nextClients);
      push(t({ it: 'Import completato. Ricarico…', en: 'Import completed. Reloading…' }), 'success');
      window.setTimeout(() => window.location.reload(), 500);
    } catch {
      push(t({ it: 'Errore import', en: 'Import failed' }), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const attachmentNote = useMemo(
    () =>
      t({
        it: 'Nota: questo export riguarda il “workspace” (clienti/sedi/planimetrie/oggetti). Gli utenti e le password sono gestiti nel database e non vengono inclusi.',
        en: 'Note: this export covers the “workspace” (clients/sites/floor plans/objects). Users and passwords are stored in the database and are not included.'
      }),
    [t]
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-amber-700">
            <AlertTriangle size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-ink">{t({ it: 'Backup & Import/Export', en: 'Backup & Import/Export' })}</div>
            <div className="mt-1 text-sm text-slate-600">{attachmentNote}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Esporta workspace (JSON)', en: 'Export workspace (JSON)' })}</div>
          <div className="mt-2 text-sm text-slate-600">
            {t({
              it: 'Consigliato per migrare clienti/planimetrie tra installazioni.',
              en: 'Recommended for migrating clients/floor plans between installations.'
            })}
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-ink">
            <input type="checkbox" checked={exportAssets} onChange={(e) => setExportAssets(e.target.checked)} />
            {t({ it: 'Includi immagini e allegati (file più grande)', en: 'Include images and attachments (larger file)' })}
          </label>
          <button
            onClick={exportJson}
            disabled={busy}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-primary/90 disabled:opacity-50"
          >
            <Download size={16} /> {t({ it: 'Esporta JSON', en: 'Export JSON' })}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="text-sm font-semibold text-ink">{t({ it: 'Importa workspace (JSON)', en: 'Import workspace (JSON)' })}</div>
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
        <div className="text-sm font-semibold text-ink">{t({ it: 'Esporta workspace (Excel)', en: 'Export workspace (Excel)' })}</div>
        <div className="mt-2 text-sm text-slate-600">
          {t({
            it: 'Crea un file XLSX con tutte le tabelle principali (clienti/sedi/planimetrie/oggetti/stanze/viste/livelli).',
            en: 'Creates an XLSX file with the main tables (clients/sites/floor plans/objects/rooms/views/layers).'
          })}
        </div>
        <button
          onClick={exportExcel}
          disabled={busy}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-50"
        >
          <FileSpreadsheet size={16} /> {t({ it: 'Esporta Excel', en: 'Export Excel' })}
        </button>
      </div>
    </div>
  );
};

export default BackupPanel;
