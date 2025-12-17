import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { useToastStore } from '../../store/useToast';
import Icon from '../ui/Icon';
import ConfirmDialog from '../ui/ConfirmDialog';
import ObjectTypeModal from './ObjectTypeModal';
import { ObjectTypeDefinition } from '../../store/types';
import { useLang, useT } from '../../i18n/useT';

const ObjectTypesPanel = () => {
  const t = useT();
  const lang = useLang();
  const { clients, objectTypes, addObjectType, updateObjectType, deleteObjectType } = useDataStore();
  const push = useToastStore((s) => s.push);

  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ def?: ObjectTypeDefinition } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const usedCountByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of clients) {
      for (const s of c.sites) {
        for (const p of s.floorPlans) {
          for (const o of p.objects) {
            map.set(o.type, (map.get(o.type) || 0) + 1);
          }
        }
      }
    }
    return map;
  }, [clients]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (objectTypes || []).slice();
    list.sort((a, b) => (a.name?.[lang] || a.id).localeCompare(b.name?.[lang] || b.id));
    if (!term) return list;
    return list.filter((d) => `${d.id} ${d.name?.it || ''} ${d.name?.en || ''}`.toLowerCase().includes(term));
  }, [lang, objectTypes, q]);

  const canDelete = (def: ObjectTypeDefinition) => !def.builtin && (usedCountByType.get(def.id) || 0) === 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-ink">{t({ it: 'Tipi oggetto', en: 'Object types' })}</div>
          <div className="mt-1 text-xs text-slate-500">
            {t({
              it: 'Aggiungi nuovi tipi e cambia icone/nomi: gli oggetti esistenti si aggiornano automaticamente.',
              en: 'Add new types and change icons/names: existing objects update automatically.'
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t({ it: 'Cerca…', en: 'Search…' })}
            className="w-64 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
          />
          <button
            onClick={() => setModal({})}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
            title={t({ it: 'Aggiungi tipo', en: 'Add type' })}
          >
            <Plus size={16} />
            {t({ it: 'Aggiungi', en: 'Add' })}
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-12 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
          <div className="col-span-1">{t({ it: 'Icona', en: 'Icon' })}</div>
          <div className="col-span-3">ID</div>
          <div className="col-span-3">{t({ it: 'Nome (IT)', en: 'Name (IT)' })}</div>
          <div className="col-span-3">{t({ it: 'Nome (EN)', en: 'Name (EN)' })}</div>
          <div className="col-span-1 text-center">{t({ it: 'Usi', en: 'Uses' })}</div>
          <div className="col-span-1 text-right">{t({ it: 'Azioni', en: 'Actions' })}</div>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.map((def) => {
            const uses = usedCountByType.get(def.id) || 0;
            return (
              <div key={def.id} className="grid grid-cols-12 items-center px-3 py-2 text-sm">
                <div className="col-span-1">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-primary shadow-sm">
                    <Icon name={def.icon} />
                  </span>
                </div>
                <div className="col-span-3 font-mono text-xs text-slate-700">{def.id}</div>
                <div className="col-span-3 text-slate-700">{def.name?.it || def.id}</div>
                <div className="col-span-3 text-slate-700">{def.name?.en || def.name?.it || def.id}</div>
                <div className="col-span-1 text-center text-xs font-semibold text-slate-700">{uses}</div>
                <div className="col-span-1 flex justify-end gap-2">
                  <button
                    title={t({ it: 'Modifica', en: 'Edit' })}
                    onClick={() => setModal({ def })}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    title={
                      def.builtin
                        ? t({ it: 'Tipo di sistema: non eliminabile', en: 'System type: cannot delete' })
                        : uses
                          ? t({ it: 'Non eliminabile: in uso', en: 'Cannot delete: in use' })
                          : t({ it: 'Elimina', en: 'Delete' })
                    }
                    disabled={!canDelete(def)}
                    onClick={() => setConfirmDeleteId(def.id)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {!filtered.length ? (
            <div className="px-3 py-6 text-sm text-slate-600">{t({ it: 'Nessun tipo.', en: 'No types.' })}</div>
          ) : null}
        </div>
      </div>

      <ObjectTypeModal
        open={!!modal}
        initial={modal?.def || null}
        onClose={() => setModal(null)}
        onSubmit={(payload) => {
          const exists = objectTypes.some((d) => d.id === payload.id);
          if (!exists) {
            addObjectType(payload);
            push(t({ it: 'Tipo oggetto creato', en: 'Object type created' }), 'success');
          } else {
            updateObjectType(payload.id, { nameIt: payload.nameIt, nameEn: payload.nameEn, icon: payload.icon });
            push(t({ it: 'Tipo oggetto aggiornato', en: 'Object type updated' }), 'success');
          }
        }}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        title={t({ it: 'Eliminare il tipo?', en: 'Delete type?' })}
        description={
          confirmDeleteId
            ? t({
                it: `Eliminare il tipo "${confirmDeleteId}"? Gli oggetti esistenti con questo tipo devono essere prima rimossi o cambiati.`,
                en: `Delete type "${confirmDeleteId}"? Existing objects must be removed or changed first.`
              })
            : undefined
        }
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (!confirmDeleteId) return;
          const def = objectTypes.find((d) => d.id === confirmDeleteId);
          if (!def) return;
          if (!canDelete(def)) {
            push(t({ it: 'Tipo non eliminabile (in uso o di sistema).', en: 'Type cannot be deleted (in use or system).' }), 'info');
            setConfirmDeleteId(null);
            return;
          }
          deleteObjectType(confirmDeleteId);
          push(t({ it: 'Tipo eliminato', en: 'Type deleted' }), 'info');
          setConfirmDeleteId(null);
        }}
        confirmLabel={t({ it: 'Elimina', en: 'Delete' })}
        cancelLabel={t({ it: 'Annulla', en: 'Cancel' })}
      />
    </div>
  );
};

export default ObjectTypesPanel;

