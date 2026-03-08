import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { Fragment } from 'react';

type Translate = (copy: { it: string; en: string }) => string;

export type RoomLayoutExportModalSortKey =
  | 'site'
  | 'plan'
  | 'room'
  | 'capacity'
  | 'scale'
  | 'opacity'
  | 'meetingRoom'
  | 'logical'
  | 'storageRoom'
  | 'bathroom'
  | 'technicalRoom'
  | 'noWindows';

export type RoomLayoutExportModalState = {
  clientId: string;
  sourcePlanId: string;
  sourceRoomId: string;
  sortKey: RoomLayoutExportModalSortKey;
  sortDir: 'asc' | 'desc';
  selectedKeys: string[];
};

export type RoomLayoutExportRow = {
  key: string;
  clientId: string;
  siteId: string;
  siteName: string;
  planId: string;
  planName: string;
  roomId: string;
  roomName: string;
  capacity: number;
  typeCodes: string;
  typeFlagsLabel: string;
  meetingRoom: boolean;
  logical: boolean;
  storageRoom: boolean;
  bathroom: boolean;
  technicalRoom: boolean;
  noWindows: boolean;
  color: string;
  fillOpacity: number;
  labelScale: number;
  isSource: boolean;
};

type Props = {
  open: boolean;
  modal: RoomLayoutExportModalState | null;
  rows: RoomLayoutExportRow[];
  source: RoomLayoutExportRow | null;
  t: Translate;
  onClose: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleAll: (checked: boolean) => void;
  onToggleRow: (key: string, checked: boolean) => void;
  onSort: (key: RoomLayoutExportModalSortKey) => void;
  onApply: () => void;
};

const SORTABLE_COLUMNS: Array<[RoomLayoutExportModalSortKey, { it: string; en: string }]> = [
  ['site', { it: 'Sede', en: 'Site' }],
  ['plan', { it: 'Planimetria', en: 'Floor plan' }],
  ['room', { it: 'Stanza', en: 'Room' }],
  ['capacity', { it: 'Capienza', en: 'Capacity' }],
  ['scale', { it: 'Scala', en: 'Scale' }],
  ['opacity', { it: 'Opacità', en: 'Opacity' }]
];

const TYPE_FLAG_COLUMNS: Array<[RoomLayoutExportModalSortKey, string, { it: string; en: string }, { it: string; en: string }]> = [
  ['meetingRoom', 'MR', { it: 'Meeting Room (MR): 1 attivo, 0 disattivo', en: 'Meeting Room (MR): 1 on, 0 off' }, { it: 'Meeting Room (MR): 1 attivo, 0 disattivo. Clicca per ordinare.', en: 'Meeting Room (MR): 1 on, 0 off. Click to sort.' }],
  ['logical', 'RL', { it: 'Room Logica (RL): 1 attivo, 0 disattivo', en: 'Logical room (RL): 1 on, 0 off' }, { it: 'Room Logica (RL): 1 attivo, 0 disattivo. Clicca per ordinare.', en: 'Logical room (RL): 1 on, 0 off. Click to sort.' }],
  ['storageRoom', 'RP', { it: 'Ripostiglio (RP): 1 attivo, 0 disattivo', en: 'Storage room (RP): 1 on, 0 off' }, { it: 'Ripostiglio (RP): 1 attivo, 0 disattivo. Clicca per ordinare.', en: 'Storage room (RP): 1 on, 0 off. Click to sort.' }],
  ['bathroom', 'BA', { it: 'Bagno (BA): 1 attivo, 0 disattivo', en: 'Bathroom (BA): 1 on, 0 off' }, { it: 'Bagno (BA): 1 attivo, 0 disattivo. Clicca per ordinare.', en: 'Bathroom (BA): 1 on, 0 off. Click to sort.' }],
  ['technicalRoom', 'LT', { it: 'Locale tecnico (LT): 1 attivo, 0 disattivo', en: 'Technical room (LT): 1 on, 0 off' }, { it: 'Locale tecnico (LT): 1 attivo, 0 disattivo. Clicca per ordinare.', en: 'Technical room (LT): 1 on, 0 off. Click to sort.' }],
  ['noWindows', 'SF', { it: 'Senza finestre (SF): 1 attivo, 0 disattivo', en: 'No windows (SF): 1 on, 0 off' }, { it: 'Senza finestre (SF): 1 attivo, 0 disattivo. Clicca per ordinare.', en: 'No windows (SF): 1 on, 0 off. Click to sort.' }]
];

const getSortTitle = (key: RoomLayoutExportModalSortKey, t: Translate) => {
  if (key === 'site') return t({ it: 'Ordina per sede', en: 'Sort by site' });
  if (key === 'plan') return t({ it: 'Ordina per planimetria', en: 'Sort by floor plan' });
  if (key === 'room') return t({ it: 'Ordina per nome stanza', en: 'Sort by room name' });
  if (key === 'capacity') return t({ it: 'Ordina per capienza stanza', en: 'Sort by room capacity' });
  if (key === 'scale') return t({ it: 'Ordina per scala etichetta', en: 'Sort by label scale' });
  return t({ it: 'Ordina per opacità sfondo', en: 'Sort by background opacity' });
};

const RoomLayoutExportModal = ({
  open,
  modal,
  rows,
  source,
  t,
  onClose,
  onSelectAll,
  onClearSelection,
  onToggleAll,
  onToggleRow,
  onSort,
  onApply
}: Props) => {
  const selectedKeys = modal?.selectedKeys || [];
  const selectableRows = rows.filter((row) => !row.isSource);
  const allSelected = selectableRows.length > 0 && selectableRows.every((row) => selectedKeys.includes(row.key));

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[70]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-[1800px] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {t({ it: 'Esporta layout stanza', en: 'Export room layout' })}
                    </Dialog.Title>
                    <div className="text-xs text-slate-500">
                      {t({
                        it: 'Copia colore, scala etichetta e opacità della stanza sorgente su altre stanze del cliente.',
                        en: 'Copy color, label scale and opacity from the source room to other client rooms.'
                      })}
                    </div>
                  </div>
                  <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-ink">
                    <X size={18} />
                  </button>
                </div>

                {source ? (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-semibold text-emerald-900">
                        {t({ it: 'Sorgente', en: 'Source' })}: {source.siteName} · {source.planName} · {source.roomName}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                        <span className="inline-block h-4 w-4 rounded border border-slate-300" style={{ backgroundColor: source.color }} />
                        {t({ it: 'Colore', en: 'Color' })}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                        {t({ it: 'Scala', en: 'Scale' })}: {source.labelScale.toFixed(2)}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700">
                        {t({ it: 'Opacità', en: 'Opacity' })}: {Math.round(source.fillOpacity * 100)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                    {t({ it: 'Stanza sorgente non trovata.', en: 'Source room not found.' })}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onSelectAll}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Seleziona tutte', en: 'Select all' })}
                  </button>
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Deseleziona tutte', en: 'Clear selection' })}
                  </button>
                  <span className="ml-auto text-xs text-slate-500">
                    {t({
                      it: `${selectedKeys.length} selezionate · ${rows.length} stanze`,
                      en: `${selectedKeys.length} selected · ${rows.length} rooms`
                    })}
                  </span>
                </div>

                <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                  <div className="max-h-[52vh] overflow-auto">
                    <table className="min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="w-10 px-3 py-2 text-left">
                            <input type="checkbox" checked={allSelected} onChange={(e) => onToggleAll(e.target.checked)} />
                          </th>
                          {SORTABLE_COLUMNS.map(([key, label]) => (
                            <th key={key} className="px-3 py-2 text-left">
                              <button
                                type="button"
                                onClick={() => onSort(key)}
                                className="inline-flex items-center gap-1 font-semibold hover:text-slate-700"
                                title={getSortTitle(key, t)}
                              >
                                {t(label)}
                                {modal?.sortKey === key ? <span>{modal.sortDir === 'asc' ? '▲' : '▼'}</span> : null}
                              </button>
                            </th>
                          ))}
                          {TYPE_FLAG_COLUMNS.map(([key, label, title, sortTitle]) => (
                            <th key={key} className="px-3 py-2 text-left" title={t(title)}>
                              <button
                                type="button"
                                className="inline-flex items-center gap-1 font-semibold hover:text-slate-700"
                                title={t(sortTitle)}
                                onClick={() => onSort(key)}
                              >
                                {label}
                                {modal?.sortKey === key ? <span>{modal.sortDir === 'asc' ? '▲' : '▼'}</span> : null}
                              </button>
                            </th>
                          ))}
                          <th className="px-3 py-2 text-left" title={t({ it: 'Colore di sfondo della stanza', en: 'Room background color' })}>
                            {t({ it: 'Colore', en: 'Color' })}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          const checked = selectedKeys.includes(row.key);
                          return (
                            <tr
                              key={row.key}
                              className={`border-t border-slate-100 ${row.isSource ? 'bg-emerald-50/60' : checked ? 'bg-sky-50/50' : 'bg-white'}`}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  disabled={row.isSource}
                                  checked={row.isSource ? false : checked}
                                  onChange={(e) => onToggleRow(row.key, e.target.checked)}
                                />
                              </td>
                              <td className="px-3 py-2 text-slate-700">{row.siteName}</td>
                              <td className="px-3 py-2 text-slate-700">{row.planName}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-ink">{row.roomName}</span>
                                  {row.isSource ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                      {t({ it: 'Sorgente', en: 'Source' })}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-3 py-2 text-slate-700">{row.capacity}</td>
                              <td className="px-3 py-2 font-mono text-slate-700">{row.labelScale.toFixed(2)}</td>
                              <td className="px-3 py-2 font-mono text-slate-700">{Math.round(row.fillOpacity * 100)}%</td>
                              <td className="px-3 py-2 text-center text-xs text-slate-700">
                                <input type="checkbox" checked={!!row.meetingRoom} readOnly disabled className="h-4 w-4 accent-primary" />
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-slate-700">
                                <input type="checkbox" checked={!!row.logical} readOnly disabled className="h-4 w-4 accent-primary" />
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-slate-700">
                                <input type="checkbox" checked={!!row.storageRoom} readOnly disabled className="h-4 w-4 accent-primary" />
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-slate-700">
                                <input type="checkbox" checked={!!row.bathroom} readOnly disabled className="h-4 w-4 accent-primary" />
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-slate-700">
                                <input type="checkbox" checked={!!row.technicalRoom} readOnly disabled className="h-4 w-4 accent-primary" />
                              </td>
                              <td className="px-3 py-2 text-center text-xs text-slate-700">
                                <input type="checkbox" checked={!!row.noWindows} readOnly disabled className="h-4 w-4 accent-primary" />
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <span className="inline-block h-5 w-5 rounded border border-slate-300" style={{ backgroundColor: row.color }} />
                                  <span className="font-mono text-xs text-slate-600">{row.color}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t({ it: 'Chiudi', en: 'Close' })}
                  </button>
                  <button
                    type="button"
                    onClick={onApply}
                    disabled={!source || !selectedKeys.length}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t({ it: 'Applica layout selezionato', en: 'Apply layout to selection' })}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default RoomLayoutExportModal;
