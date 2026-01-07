import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Trash2, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import Icon from '../ui/Icon';
import { IconName, MapObject } from '../../store/types';

interface Props {
  open: boolean;
  initialName?: string;
  initialColor?: string;
  initialCapacity?: number;
  initialLabelScale?: number;
  initialShowName?: boolean;
  initialSurfaceSqm?: number;
  initialNotes?: string;
  objects?: MapObject[];
  getTypeLabel?: (typeId: string) => string;
  getTypeIcon?: (typeId: string) => IconName | undefined;
  isUserObject?: (typeId: string) => boolean;
  onDeleteObject?: (id: string) => void;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    color?: string;
    capacity?: number;
    labelScale?: number;
    showName: boolean;
    surfaceSqm?: number;
    notes?: string;
  }) => boolean | void;
}

const COLORS = ['#64748b', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9', '#14b8a6'];

const RoomModal = ({
  open,
  initialName = '',
  initialColor = COLORS[0],
  initialCapacity,
  initialLabelScale,
  initialShowName = true,
  initialSurfaceSqm,
  initialNotes,
  objects,
  getTypeLabel,
  getTypeIcon,
  isUserObject,
  onDeleteObject,
  onClose,
  onSubmit
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [capacity, setCapacity] = useState('');
  const [showName, setShowName] = useState(initialShowName);
  const [surfaceSqm, setSurfaceSqm] = useState('');
  const [notes, setNotes] = useState('');
  const [labelScale, setLabelScale] = useState(1);
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'objects' | 'notes'>('info');
  const nameRef = useRef<HTMLInputElement | null>(null);
  const roomObjects = objects || [];
  const shouldShowContents = typeof objects !== 'undefined';
  const resolveIsUser = (typeId: string) => (isUserObject ? isUserObject(typeId) : typeId === 'user' || typeId === 'real_user');
  const users = roomObjects.filter((o) => resolveIsUser(o.type));
  const otherObjects = roomObjects.filter((o) => !resolveIsUser(o.type));

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setColor(initialColor || COLORS[0]);
    setCapacity(Number.isFinite(initialCapacity) && (initialCapacity || 0) > 0 ? String(initialCapacity) : '');
    setLabelScale(Number.isFinite(initialLabelScale) && (initialLabelScale || 0) > 0 ? Number(initialLabelScale) : 1);
    setShowName(initialShowName !== false);
    setSurfaceSqm(Number.isFinite(initialSurfaceSqm) && (initialSurfaceSqm || 0) > 0 ? String(initialSurfaceSqm) : '');
    setNotes(initialNotes || '');
    setActiveTab('info');
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [initialColor, initialName, initialCapacity, initialShowName, initialSurfaceSqm, initialNotes, open]);

  const submit = () => {
    if (!name.trim()) return;
    const rawCapacity = Number(capacity);
    const finalCapacity = Number.isFinite(rawCapacity) && rawCapacity > 0 ? Math.floor(rawCapacity) : undefined;
    const finalLabelScale = Number.isFinite(labelScale) && labelScale > 0 ? Math.min(2, Math.max(0.6, labelScale)) : 1;
    const rawSurface = Number(surfaceSqm);
    const finalSurface = Number.isFinite(rawSurface) && rawSurface > 0 ? rawSurface : undefined;
    const finalNotes = notes.trim() ? notes.trim() : undefined;
    const saved = onSubmit({
      name: name.trim(),
      color: color || COLORS[0],
      capacity: finalCapacity,
      labelScale: finalLabelScale,
      showName,
      surfaceSqm: finalSurface,
      notes: finalNotes
    });
    if (saved !== false) onClose();
  };

  const renderObjectRow = (obj: MapObject, allowDelete: boolean) => {
    const displayName =
      obj.type === 'real_user'
        ? `${String(obj.firstName || '').trim()} ${String(obj.lastName || '').trim()}`.trim() || obj.name
        : obj.name;
    const label = getTypeLabel ? getTypeLabel(obj.type) : obj.type;
    return (
      <div key={obj.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-primary">
          <Icon name={getTypeIcon?.(obj.type)} type={obj.type} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{displayName}</div>
          <div className="truncate text-xs text-slate-500">{label}</div>
        </div>
        {allowDelete && onDeleteObject ? (
          <button
            onClick={() => onDeleteObject(obj.id)}
            className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
            title={t({ it: 'Elimina oggetto', en: 'Delete object' })}
            type="button"
          >
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-100"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
        </Transition.Child>
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-8">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-150"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-100"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel
                className={`flex w-full flex-col rounded-2xl bg-white p-6 shadow-card ${
                  shouldShowContents ? 'max-w-3xl h-[760px]' : 'max-w-md h-[680px]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {initialName ? t({ it: 'Modifica stanza', en: 'Edit room' }) : t({ it: 'Nuova stanza', en: 'New room' })}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-slate-500 hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className={`mt-4 flex-1 pr-1 ${shouldShowContents ? 'overflow-y-auto' : 'overflow-y-visible'}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'info', label: t({ it: 'Info', en: 'Info' }) },
                      ...(shouldShowContents
                        ? [
                            { id: 'users', label: t({ it: 'Utenti', en: 'Users' }) },
                            { id: 'objects', label: t({ it: 'Oggetti', en: 'Objects' }) }
                          ]
                        : []),
                      { id: 'notes', label: t({ it: 'Note', en: 'Notes' }) }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                          activeTab === tab.id
                            ? 'border-primary bg-primary text-white shadow-card'
                            : 'border-slate-200 bg-white text-ink hover:bg-slate-50'
                        }`}
                        title={tab.label}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === 'info' ? (
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome stanza', en: 'Room name' })}
                        <input
                          ref={nameRef}
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submit();
                            }
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder={t({ it: 'Es. Sala riunioni', en: 'e.g. Meeting room' })}
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Capienza postazioni', en: 'Seat capacity' })}
                        <input
                          value={capacity}
                          onChange={(e) => setCapacity(e.target.value)}
                          inputMode="numeric"
                          type="number"
                          min={1}
                          step={1}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder={t({ it: 'Lascia vuoto per illimitata', en: 'Leave empty for unlimited' })}
                        />
                        <div className="mt-1 text-xs text-slate-500">
                          {t({
                            it: 'La capienza indica il numero massimo di utenti consigliati.',
                            en: 'Capacity indicates the recommended maximum number of users.'
                          })}
                        </div>
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          {t({ it: 'Scala etichette', en: 'Label scale' })}
                          <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">{labelScale.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.6}
                          max={2}
                          step={0.05}
                          value={labelScale}
                          onChange={(e) => setLabelScale(Number(e.target.value))}
                          className="mt-1 w-full"
                        />
                      </div>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Superficie (mq)', en: 'Surface (sqm)' })}
                        <input
                          value={surfaceSqm}
                          onChange={(e) => setSurfaceSqm(e.target.value)}
                          inputMode="decimal"
                          type="number"
                          min={0.1}
                          step={0.1}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder={t({ it: 'Es. 24.5', en: 'e.g. 24.5' })}
                        />
                      </label>
                      <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={showName}
                          onChange={(e) => setShowName(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary"
                        />
                        <span>
                          {t({ it: 'Nome visibile in mappa', en: 'Show name on map' })}
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            {t({
                              it: 'Mostra il nome della stanza direttamente sulla planimetria.',
                              en: 'Displays the room name directly on the floor plan.'
                            })}
                          </span>
                        </span>
                      </label>
                      <div>
                        <div className="text-sm font-medium text-slate-700">{t({ it: 'Colore', en: 'Color' })}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {COLORS.map((c) => {
                            const active = (color || COLORS[0]).toLowerCase() === c.toLowerCase();
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setColor(c)}
                                className={`h-9 w-9 rounded-xl border ${active ? 'border-ink ring-2 ring-primary/30' : 'border-slate-200'}`}
                                style={{ background: c }}
                                title={c}
                              />
                            );
                          })}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {t({
                            it: 'Il colore viene usato per evidenziare l’area della stanza.',
                            en: 'The color is used to highlight the room area.'
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activeTab === 'notes' ? (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Note', en: 'Notes' })}
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder={t({ it: 'Note interne sulla stanza', en: 'Internal notes about this room' })}
                          rows={6}
                        />
                      </label>
                    </div>
                  ) : null}

                  {activeTab === 'users' && shouldShowContents ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-ink">{t({ it: 'Utenti nella stanza', en: 'Users in room' })}</div>
                        <div className="text-xs font-semibold text-slate-500">
                          {t({ it: `Totale ${users.length}`, en: `Total ${users.length}` })}
                        </div>
                      </div>
                      {users.length ? (
                        <div className="mt-3 space-y-2">
                          {users.map((obj) => renderObjectRow(obj, true))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                          {t({ it: 'Nessun utente in questa stanza.', en: 'No users in this room.' })}
                        </div>
                      )}
                    </div>
                  ) : null}

                  {activeTab === 'objects' && shouldShowContents ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-ink">{t({ it: 'Oggetti nella stanza', en: 'Objects in room' })}</div>
                        <div className="text-xs font-semibold text-slate-500">
                          {t({ it: `Totale ${otherObjects.length}`, en: `Total ${otherObjects.length}` })}
                        </div>
                      </div>
                      {otherObjects.length ? (
                        <div className="mt-3 space-y-2">
                          {otherObjects.map((obj) => renderObjectRow(obj, true))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                          {t({ it: 'Nessun oggetto in questa stanza.', en: 'No objects in this room.' })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    title={t({ it: 'Salva', en: 'Save' })}
                  >
                    {t({ it: 'Salva', en: 'Save' })}
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

export default RoomModal;
