import { Fragment, useEffect, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronLeft, ChevronRight, HelpCircle, Image as ImageIcon, Search, Trash2, X } from 'lucide-react';
import { useT } from '../../i18n/useT';
import RoomShapePreview from './RoomShapePreview';
import Icon from '../ui/Icon';
import { IconName, MapObject } from '../../store/types';

interface Props {
  open: boolean;
  initialName?: string;
  initialNameEn?: string;
  initialDepartmentTags?: string[];
  departmentOptions?: string[];
  initialColor?: string;
  initialCapacity?: number;
  initialLabelScale?: number;
  initialShowName?: boolean;
  initialSurfaceSqm?: number;
  initialNotes?: string;
  initialLogical?: boolean;
  surfaceLocked?: boolean;
  measurements?: {
    scaleMissing?: boolean;
    perimeterLabel?: string | null;
    areaLabel?: string | null;
    segments?: { label: string; lengthLabel?: string | null }[];
  } | null;
  shapePreview?: {
    points: { x: number; y: number }[];
    segments: { label: string; lengthLabel?: string | null }[];
  } | null;
  objects?: MapObject[];
  getTypeLabel?: (typeId: string) => string;
  getTypeIcon?: (typeId: string) => IconName | undefined;
  isUserObject?: (typeId: string) => boolean;
  canCreateWalls?: boolean;
  onCreateWalls?: () => void;
  onDeleteObject?: (id: string) => void;
  onOpenPhotos?: (payload: { id: string; selectionIds?: string[] }) => void;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    nameEn?: string;
    departmentTags?: string[];
    color?: string;
    capacity?: number;
    labelScale?: number;
    showName: boolean;
    surfaceSqm?: number;
    notes?: string;
    logical?: boolean;
  }) => boolean | void;
}

const COLORS = ['#64748b', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9', '#14b8a6'];

const RoomModal = ({
  open,
  initialName = '',
  initialNameEn = '',
  initialDepartmentTags,
  departmentOptions,
  initialColor = COLORS[0],
  initialCapacity,
  initialLabelScale,
  initialShowName = true,
  initialSurfaceSqm,
  initialNotes,
  initialLogical = false,
  surfaceLocked = false,
  measurements,
  shapePreview,
  objects,
  getTypeLabel,
  getTypeIcon,
  isUserObject,
  canCreateWalls = false,
  onCreateWalls,
  onDeleteObject,
  onOpenPhotos,
  onClose,
  onSubmit
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [nameEn, setNameEn] = useState(initialNameEn);
  const [departmentTags, setDepartmentTags] = useState<string[]>([]);
  const [color, setColor] = useState(initialColor);
  const [capacity, setCapacity] = useState('');
  const [showName, setShowName] = useState(initialShowName);
  const [surfaceSqm, setSurfaceSqm] = useState('');
  const [notes, setNotes] = useState('');
  const [labelScale, setLabelScale] = useState(1);
  const [logical, setLogical] = useState(initialLogical);
  const [nameError, setNameError] = useState('');
  const [capacityError, setCapacityError] = useState('');
  const [departmentsModalOpen, setDepartmentsModalOpen] = useState(false);
  const [departmentQuery, setDepartmentQuery] = useState('');
  const [availableSelection, setAvailableSelection] = useState<string[]>([]);
  const [selectedSelection, setSelectedSelection] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'objects' | 'photos' | 'notes'>('info');
  const nameRef = useRef<HTMLInputElement | null>(null);
  const roomObjects = objects || [];
  const shouldShowContents = typeof objects !== 'undefined';
  const resolveIsUser = (typeId: string) => (isUserObject ? isUserObject(typeId) : typeId === 'user' || typeId === 'real_user');
  const users = roomObjects.filter((o) => resolveIsUser(o.type));
  const otherObjects = roomObjects.filter((o) => !resolveIsUser(o.type));
  const roomPhotos = roomObjects.filter((o) => o.type === 'photo' && Boolean((o as any).imageUrl));
  const canOpenRoomPhotos = roomPhotos.length > 0 && !!onOpenPhotos;
  const openRoomPhotos = (id?: string) => {
    if (!onOpenPhotos || !roomPhotos.length) return;
    const ids = roomPhotos.map((photo) => photo.id);
    onOpenPhotos({ id: id || ids[0], selectionIds: ids });
  };

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setNameEn(initialNameEn);
    setDepartmentTags(
      Array.isArray(initialDepartmentTags)
        ? Array.from(
            new Set(
              initialDepartmentTags
                .map((entry) => String(entry || '').trim())
                .filter(Boolean)
                .map((entry) => entry.toLocaleLowerCase())
            )
          ).map((folded) => {
            const found = initialDepartmentTags.find((entry) => String(entry || '').trim().toLocaleLowerCase() === folded);
            return String(found || '').trim();
          })
        : []
    );
    setColor(initialColor || COLORS[0]);
    setCapacity(Number.isFinite(initialCapacity) && Number(initialCapacity) >= 0 ? String(Math.floor(Number(initialCapacity))) : '');
    setLabelScale(Number.isFinite(initialLabelScale) && (initialLabelScale || 0) > 0 ? Number(initialLabelScale) : 1);
    setShowName(initialShowName !== false);
    setSurfaceSqm(Number.isFinite(initialSurfaceSqm) && (initialSurfaceSqm || 0) > 0 ? String(initialSurfaceSqm) : '');
    setNotes(initialNotes || '');
    setLogical(!!initialLogical);
    setActiveTab('info');
    setNameError('');
    setCapacityError('');
    setDepartmentsModalOpen(false);
    setDepartmentQuery('');
    setAvailableSelection([]);
    setSelectedSelection([]);
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [
    initialColor,
    initialDepartmentTags,
    initialLogical,
    initialName,
    initialNameEn,
    initialCapacity,
    initialNotes,
    initialShowName,
    initialSurfaceSqm,
    open
  ]);

  const canonicalDepartmentTags = (input: string[]) =>
    Array.from(
      new Set(
        (input || [])
          .map((entry) => String(entry || '').trim())
          .filter(Boolean)
          .map((entry) => entry.toLocaleLowerCase())
      )
    ).map((folded) => {
      const found = (input || []).find((entry) => String(entry || '').trim().toLocaleLowerCase() === folded);
      return String(found || '').trim();
    });

  const allDepartments = canonicalDepartmentTags([...(departmentOptions || []), ...departmentTags]).sort((a, b) => a.localeCompare(b));
  const availableDepartments = allDepartments.filter(
    (entry) => !departmentTags.some((tag) => tag.toLocaleLowerCase() === entry.toLocaleLowerCase())
  );
  const filteredAvailableDepartments = availableDepartments.filter((entry) =>
    String(entry).toLocaleLowerCase().includes(String(departmentQuery || '').trim().toLocaleLowerCase())
  );
  const filteredSelectedDepartments = departmentTags.filter((entry) =>
    String(entry).toLocaleLowerCase().includes(String(departmentQuery || '').trim().toLocaleLowerCase())
  );

  const addDepartmentTag = (raw: string) => {
    const next = String(raw || '').trim();
    if (!next) return;
    const folded = next.toLocaleLowerCase();
    setDepartmentTags((prev) => {
      if (prev.some((entry) => entry.toLocaleLowerCase() === folded)) return prev;
      return [...prev, next];
    });
  };

  const removeDepartmentTag = (raw: string) => {
    const target = String(raw || '').trim().toLocaleLowerCase();
    setDepartmentTags((prev) => prev.filter((entry) => entry.toLocaleLowerCase() !== target));
  };

  const moveSelectedDepartments = () => {
    const normalized = new Set(availableSelection.map((entry) => String(entry || '').trim().toLocaleLowerCase()).filter(Boolean));
    if (!normalized.size) return;
    const toMove = availableDepartments.filter((entry) => normalized.has(entry.toLocaleLowerCase()));
    if (!toMove.length) return;
    setDepartmentTags((prev) => canonicalDepartmentTags([...prev, ...toMove]));
    setAvailableSelection([]);
  };

  const removeSelectedDepartments = () => {
    const normalized = new Set(selectedSelection.map((entry) => String(entry || '').trim().toLocaleLowerCase()).filter(Boolean));
    if (!normalized.size) return;
    setDepartmentTags((prev) => prev.filter((entry) => !normalized.has(entry.toLocaleLowerCase())));
    setSelectedSelection([]);
  };

  const addFilteredDepartments = () => {
    if (filteredAvailableDepartments.length) {
      setDepartmentTags((prev) => canonicalDepartmentTags([...prev, ...filteredAvailableDepartments]));
      setAvailableSelection([]);
      return;
    }
    const raw = String(departmentQuery || '').trim();
    if (!raw) return;
    addDepartmentTag(raw);
  };

  const submit = () => {
    if (!name.trim()) {
      setNameError(t({ it: 'Il nome della stanza è obbligatorio.', en: 'Room name is required.' }));
      window.setTimeout(() => nameRef.current?.focus(), 0);
      return;
    }
    if (!String(capacity).trim()) {
      setCapacityError(t({ it: 'La capienza è obbligatoria.', en: 'Capacity is required.' }));
      return;
    }
    const rawCapacity = Number(capacity);
    if (!Number.isFinite(rawCapacity) || rawCapacity < 0) {
      setCapacityError(t({ it: 'Inserisci una capienza valida (>= 0).', en: 'Enter a valid capacity (>= 0).' }));
      return;
    }
    const finalCapacity = Math.floor(rawCapacity);
    const finalLabelScale = Number.isFinite(labelScale) && labelScale > 0 ? Math.min(2, Math.max(0.2, labelScale)) : 1;
    const rawSurface = Number(surfaceSqm);
    const finalSurface = Number.isFinite(rawSurface) && rawSurface > 0 ? rawSurface : undefined;
    const finalNotes = notes.trim() ? notes.trim() : undefined;
    const finalNameEn = nameEn.trim() ? nameEn.trim() : undefined;
    const finalDepartmentTags = departmentTags
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
      .filter((entry, index, list) => list.findIndex((candidate) => candidate.toLocaleLowerCase() === entry.toLocaleLowerCase()) === index);
    const saved = onSubmit({
      name: name.trim(),
      nameEn: finalNameEn,
      departmentTags: finalDepartmentTags.length ? finalDepartmentTags : undefined,
      color: color || COLORS[0],
      capacity: finalCapacity,
      labelScale: finalLabelScale,
      showName,
      surfaceSqm: finalSurface,
      notes: finalNotes,
      logical
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
    <>
      <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose} initialFocus={nameRef}>
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
                className={`flex w-full flex-col modal-panel ${
                  shouldShowContents ? 'max-w-5xl max-h-[94vh]' : 'max-w-3xl max-h-[94vh]'
                }`}
              >
                <div className="modal-header items-center">
                  <Dialog.Title className="modal-title">
                    {initialName ? t({ it: 'Modifica stanza', en: 'Edit room' }) : t({ it: 'Nuova stanza', en: 'New room' })}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="icon-button"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'info', label: t({ it: 'Info', en: 'Info' }) },
                      ...(shouldShowContents
                        ? [
                            { id: 'users', label: t({ it: 'Utenti', en: 'Users' }) },
                            { id: 'objects', label: t({ it: 'Oggetti', en: 'Objects' }) },
                            { id: 'photos', label: t({ it: 'Foto', en: 'Photos' }) }
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
                      {shapePreview || measurements ? (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="flex flex-col gap-3 md:flex-row">
                            {shapePreview ? (
                              <div className="md:w-64">
                                <div className="text-xs font-semibold text-slate-600">
                                  {t({ it: 'Forma stanza', en: 'Room shape' })}
                                </div>
                                <div className="mt-2 rounded-lg bg-slate-50 p-2">
                                  <RoomShapePreview
                                    points={shapePreview.points}
                                    segments={shapePreview.segments}
                                    width={240}
                                    height={160}
                                    className="h-40 w-full"
                                  />
                                </div>
                              </div>
                            ) : null}
                            {measurements ? (
                              <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <div className="font-semibold text-slate-700">
                                  {t({ it: 'Misure stanza', en: 'Room measurements' })}
                                </div>
                                {measurements.scaleMissing ? (
                                  <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                                    {t({ it: 'Imposta una scala per misurare.', en: 'Set a scale to measure.' })}
                                  </div>
                                ) : (
                                  <>
                                    {measurements.perimeterLabel ? (
                                      <div className="mt-1 flex items-center justify-between gap-2">
                                        <span>{t({ it: 'Perimetro', en: 'Perimeter' })}</span>
                                        <span className="font-mono">{measurements.perimeterLabel}</span>
                                      </div>
                                    ) : null}
                                    {measurements.areaLabel ? (
                                      <div className="mt-1 flex items-center justify-between gap-2">
                                        <span>{t({ it: 'Area', en: 'Area' })}</span>
                                        <span className="font-mono">{measurements.areaLabel}</span>
                                      </div>
                                    ) : null}
                                    {measurements.segments?.length ? (
                                      <div className="mt-2">
                                        <div className="text-[11px] font-semibold text-slate-500">
                                          {t({ it: 'Lati', en: 'Sides' })}
                                        </div>
                                        <div className="mt-1 max-h-32 space-y-1 overflow-y-auto text-[11px] text-slate-600">
                                          {measurements.segments.map((seg) => (
                                            <div key={seg.label} className="flex items-center justify-between gap-2">
                                              <span className="font-mono">{seg.label}</span>
                                              <span className="font-mono">{seg.lengthLabel}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                      {canCreateWalls && onCreateWalls ? (
                        <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="text-xs font-semibold text-slate-600">
                            {t({ it: 'Mura fisiche', en: 'Physical walls' })}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <div className="text-xs text-slate-600">
                              {t({
                                it: 'Questa stanza non ha ancora muri fisici. Vuoi crearli ora?',
                                en: 'This room has no physical walls yet. Do you want to create them now?'
                              })}
                            </div>
                            <button
                              type="button"
                              onClick={onCreateWalls}
                              className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                            >
                              {t({ it: 'Crea muri', en: 'Create walls' })}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome stanza', en: 'Room name' })}
                        <input
                          ref={nameRef}
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (nameError) setNameError('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submit();
                            }
                          }}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 ${
                            nameError ? 'border-rose-300 ring-rose-200' : 'border-slate-200'
                          }`}
                          placeholder={t({ it: 'Es. Sala riunioni', en: 'e.g. Meeting room' })}
                        />
                        {nameError ? <div className="mt-1 text-xs font-semibold text-rose-600">{nameError}</div> : null}
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome stanza (EN)', en: 'Room name (EN)' })}
                        <input
                          value={nameEn}
                          onChange={(e) => setNameEn(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          placeholder={t({ it: 'Es. Meeting room', en: 'e.g. Meeting room' })}
                        />
                        <div className="mt-1 text-xs text-slate-500">
                          {t({
                            it: 'Opzionale: usato quando il portale è in inglese.',
                            en: 'Optional: used when the portal language is English.'
                          })}
                        </div>
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Capienza postazioni', en: 'Seat capacity' })}
                        <input
                          value={capacity}
                          onChange={(e) => {
                            setCapacity(e.target.value);
                            if (capacityError) setCapacityError('');
                          }}
                          inputMode="numeric"
                          type="number"
                          min={0}
                          step={1}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 ${
                            capacityError ? 'border-rose-300 ring-rose-200' : 'border-slate-200'
                          }`}
                          placeholder={t({ it: 'Es. 12 (obbligatorio)', en: 'e.g. 12 (required)' })}
                        />
                        {capacityError ? <div className="mt-1 text-xs font-semibold text-rose-600">{capacityError}</div> : null}
                        <div className="mt-1 text-xs text-slate-500">
                          {t({
                            it: 'Campo obbligatorio. Le stanze senza capienza vengono considerate 0/0.',
                            en: 'Required field. Rooms without capacity are treated as 0/0.'
                          })}
                        </div>
                      </label>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-slate-700">
                              {t({ it: 'Reparti associati', en: 'Assigned departments' })}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {t({
                                it: 'Gestisci l’associazione da una modale dedicata a doppia colonna.',
                                en: 'Manage assignment from a dedicated dual-column modal.'
                              })}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDepartmentsModalOpen(true)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t({ it: 'Gestisci reparti', en: 'Manage departments' })}
                          </button>
                        </div>
                        {departmentTags.length ? (
                          <div className="mt-2 flex max-h-28 flex-wrap gap-2 overflow-y-auto">
                            {departmentTags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500">
                            {t({ it: 'Nessun reparto associato.', en: 'No department assigned.' })}
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                          {t({ it: 'Scala etichette', en: 'Label scale' })}
                          <span className="ml-auto text-xs font-semibold text-slate-600 tabular-nums">{labelScale.toFixed(2)}</span>
                        </div>
                        <input
                          type="range"
                          min={0.2}
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
                          onChange={(e) => {
                            if (surfaceLocked) return;
                            setSurfaceSqm(e.target.value);
                          }}
                          inputMode="decimal"
                          type="number"
                          min={0.1}
                          step={0.1}
                          disabled={surfaceLocked}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 ${
                            surfaceLocked ? 'border-slate-200 bg-slate-100 text-slate-500' : 'border-slate-200'
                          }`}
                          placeholder={t({ it: 'Es. 24.5', en: 'e.g. 24.5' })}
                        />
                        {surfaceLocked ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {t({
                              it: 'Calcolata automaticamente dalla scala della planimetria.',
                              en: 'Calculated automatically from the floor plan scale.'
                            })}
                          </div>
                        ) : null}
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
                      <label className="flex items-start gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={logical}
                          onChange={(e) => setLogical(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary"
                        />
                        <span>
                          <span className="inline-flex items-center gap-2">
                            {t({ it: 'Room logica', en: 'Logical room' })}
                            <span className="group relative inline-flex items-center">
                              <HelpCircle size={14} className="text-slate-400" />
                              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-normal text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                                {t({
                                  it: "Logica = gruppo funzionale (es. 'Marketing' su piu stanze). Normale = stanza fisica disegnata (es. 'Sala riunioni 1').",
                                  en: "Logical = functional group (e.g. 'Marketing' across rooms). Normal = physical room drawn on the plan (e.g. 'Meeting room 1')."
                                })}
                              </span>
                            </span>
                          </span>
                          <span className="mt-1 block text-xs font-normal text-slate-500">
                            {t({
                              it: "Usa 'logica' per gruppi non legati a una singola stanza fisica (es. Team IT su piu ambienti).",
                              en: "Use 'logical' for groups not tied to a single physical room (e.g. IT team across rooms)."
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

                  {activeTab === 'photos' && shouldShowContents ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold text-ink">{t({ it: 'Foto nella stanza', en: 'Photos in room' })}</div>
                        <div className="flex items-center gap-2">
                          <div className="text-xs font-semibold text-slate-500">
                            {t({ it: `Totale ${roomPhotos.length}`, en: `Total ${roomPhotos.length}` })}
                          </div>
                          {canOpenRoomPhotos ? (
                            <button
                              type="button"
                              onClick={() => openRoomPhotos()}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              title={t({ it: 'Vedi galleria', en: 'View gallery' })}
                            >
                              <ImageIcon size={12} />
                              {t({ it: 'Vedi galleria', en: 'View gallery' })}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {roomPhotos.length ? (
                        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                          {roomPhotos.map((photo) => (
                            <button
                              key={photo.id}
                              type="button"
                              onClick={() => openRoomPhotos(photo.id)}
                              className="group rounded-xl border border-slate-200 bg-white p-2 text-left shadow-sm transition hover:border-sky-200 hover:shadow-md"
                              title={photo.name || t({ it: 'Foto', en: 'Photo' })}
                            >
                              <div className="relative h-24 w-full overflow-hidden rounded-lg bg-slate-100">
                                <img src={String((photo as any).imageUrl || '')} alt={photo.name || 'photo'} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                              </div>
                              <div className="mt-2">
                                <div className="truncate text-sm font-semibold text-ink">
                                  {photo.name || t({ it: 'Foto', en: 'Photo' })}
                                </div>
                                {photo.description ? <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{photo.description}</div> : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                          {t({ it: 'Nessuna foto in questa stanza.', en: 'No photos in this room.' })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={submit}
                    className="btn-primary"
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

      <Transition show={departmentsModalOpen && open} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setDepartmentsModalOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-5xl modal-panel">
                  <div className="modal-header items-center">
                    <Dialog.Title className="modal-title">{t({ it: 'Associa reparti', en: 'Assign departments' })}</Dialog.Title>
                    <button
                      onClick={() => setDepartmentsModalOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Ricerca reparto', en: 'Department search' })}
                      <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <Search size={14} className="text-slate-400" />
                        <input
                          value={departmentQuery}
                          onChange={(e) => setDepartmentQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            addFilteredDepartments();
                          }}
                          className="w-full text-sm outline-none"
                          placeholder={t({ it: 'Digita per filtrare. Invio aggiunge i risultati ai selezionati.', en: 'Type to filter. Enter adds results to selected.' })}
                        />
                      </div>
                    </label>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[1fr,auto,1fr]">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Tutti i reparti disponibili', en: 'All available departments' })}
                      </div>
                      <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
                        {filteredAvailableDepartments.length ? (
                          filteredAvailableDepartments.map((entry) => {
                            const selected = availableSelection.some((item) => item.toLocaleLowerCase() === entry.toLocaleLowerCase());
                            return (
                              <button
                                type="button"
                                key={entry}
                                onClick={() =>
                                  setAvailableSelection((prev) => {
                                    if (prev.some((item) => item.toLocaleLowerCase() === entry.toLocaleLowerCase())) {
                                      return prev.filter((item) => item.toLocaleLowerCase() !== entry.toLocaleLowerCase());
                                    }
                                    return [...prev, entry];
                                  })
                                }
                                onDoubleClick={() => addDepartmentTag(entry)}
                                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                                  selected ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span className="truncate">{entry}</span>
                                {selected ? <span className="text-[11px] font-semibold">✓</span> : null}
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                            {t({ it: 'Nessun reparto disponibile con questo filtro.', en: 'No available department for this filter.' })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-row items-center justify-center gap-2 md:flex-col">
                      <button
                        type="button"
                        onClick={moveSelectedDepartments}
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Aggiungi selezionati', en: 'Add selected' })}
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={removeSelectedDepartments}
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Rimuovi selezionati', en: 'Remove selected' })}
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Reparti selezionati', en: 'Selected departments' })}
                      </div>
                      <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
                        {filteredSelectedDepartments.length ? (
                          filteredSelectedDepartments.map((entry) => {
                            const selected = selectedSelection.some((item) => item.toLocaleLowerCase() === entry.toLocaleLowerCase());
                            return (
                              <button
                                type="button"
                                key={entry}
                                onClick={() =>
                                  setSelectedSelection((prev) => {
                                    if (prev.some((item) => item.toLocaleLowerCase() === entry.toLocaleLowerCase())) {
                                      return prev.filter((item) => item.toLocaleLowerCase() !== entry.toLocaleLowerCase());
                                    }
                                    return [...prev, entry];
                                  })
                                }
                                onDoubleClick={() => removeDepartmentTag(entry)}
                                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                                  selected ? 'bg-primary/10 text-primary' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span className="truncate">{entry}</span>
                                {selected ? <span className="text-[11px] font-semibold">✓</span> : null}
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-500">
                            {t({ it: 'Nessun reparto selezionato.', en: 'No selected departments.' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDepartmentsModalOpen(false)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {t({ it: 'Chiudi', en: 'Close' })}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default RoomModal;
