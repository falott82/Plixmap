import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ChevronLeft, ChevronRight, ChevronsRight, HelpCircle, Image as ImageIcon, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '../../i18n/useT';
import RoomShapePreview from './RoomShapePreview';
import Icon from '../ui/Icon';
import CapacityGauge from '../ui/CapacityGauge';
import { IconName, MapObject } from '../../store/types';

interface Props {
  open: boolean;
  initialDepartmentsOpen?: boolean;
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
  initialMeetingRoom?: boolean;
  initialNoWindows?: boolean;
  initialStorageRoom?: boolean;
  initialBathroom?: boolean;
  initialTechnicalRoom?: boolean;
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
    meetingRoom?: boolean;
    noWindows?: boolean;
    storageRoom?: boolean;
    bathroom?: boolean;
    technicalRoom?: boolean;
  }) => boolean | void;
}

const COLORS = ['#64748b', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9', '#14b8a6'];

const IosSwitch = ({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) => (
  <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
    <div>
      <div className="text-sm font-semibold text-ink">{label}</div>
      {description ? <div className="mt-0.5 text-xs text-slate-500">{description}</div> : null}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 h-6 w-11 rounded-full transition ${
        checked ? 'bg-primary' : 'bg-slate-300'
      }`}
      title={label}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  </div>
);

const RoomModal = ({
  open,
  initialDepartmentsOpen = false,
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
  initialMeetingRoom = false,
  initialNoWindows = false,
  initialStorageRoom = false,
  initialBathroom = false,
  initialTechnicalRoom = false,
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
  const [meetingRoom, setMeetingRoom] = useState(initialMeetingRoom);
  const [noWindows, setNoWindows] = useState(initialNoWindows);
  const [storageRoom, setStorageRoom] = useState(initialStorageRoom);
  const [bathroom, setBathroom] = useState(initialBathroom);
  const [technicalRoom, setTechnicalRoom] = useState(initialTechnicalRoom);
  const [nameError, setNameError] = useState('');
  const [capacityError, setCapacityError] = useState('');
  const [departmentsModalOpen, setDepartmentsModalOpen] = useState(false);
  const [propertiesModalOpen, setPropertiesModalOpen] = useState(false);
  const [departmentQuery, setDepartmentQuery] = useState('');
  const [availableSelection, setAvailableSelection] = useState<string[]>([]);
  const [selectedSelection, setSelectedSelection] = useState<string[]>([]);
  const [availableActiveIndex, setAvailableActiveIndex] = useState(0);
  const [availableAnchorIndex, setAvailableAnchorIndex] = useState<number | null>(null);
  const [selectedAnchorIndex, setSelectedAnchorIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'objects' | 'photos' | 'notes'>('info');
  const nameRef = useRef<HTMLInputElement | null>(null);
  const departmentSearchRef = useRef<HTMLInputElement | null>(null);
  const roomObjects = objects || [];
  const shouldShowContents = typeof objects !== 'undefined';
  const resolveIsUser = (typeId: string) => (isUserObject ? isUserObject(typeId) : typeId === 'user' || typeId === 'real_user');
  const users = roomObjects.filter((o) => resolveIsUser(o.type));
  const otherObjects = roomObjects.filter((o) => !resolveIsUser(o.type));
  const roomPhotos = roomObjects.filter((o) => o.type === 'photo' && Boolean((o as any).imageUrl));
  const roomCapacityValue = Number.isFinite(Number(capacity)) && Number(capacity) >= 0 ? Math.floor(Number(capacity)) : 0;
  const canOpenRoomPhotos = roomPhotos.length > 0 && !!onOpenPhotos;
  const openRoomPhotos = (id?: string) => {
    if (!onOpenPhotos || !roomPhotos.length) return;
    const ids = roomPhotos.map((photo) => photo.id);
    onOpenPhotos({ id: id || ids[0], selectionIds: ids });
  };
  const focusDepartmentSearch = useCallback((selectText = false) => {
    const tryFocus = () => {
      const input = departmentSearchRef.current;
      if (!input) return false;
      input.focus();
      if (selectText) {
        try {
          input.select();
        } catch {
          // ignore
        }
      }
      return document.activeElement === input;
    };
    if (tryFocus()) return;
    window.setTimeout(() => {
      if (tryFocus()) return;
      window.setTimeout(() => {
        tryFocus();
      }, 40);
    }, 0);
  }, []);

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
    setMeetingRoom(!!initialMeetingRoom);
    setNoWindows(!!initialNoWindows);
    setStorageRoom(!!initialStorageRoom);
    setBathroom(!!initialBathroom);
    setTechnicalRoom(!!initialTechnicalRoom);
    setActiveTab('info');
    setNameError('');
    setCapacityError('');
    setDepartmentsModalOpen(!!initialDepartmentsOpen);
    setPropertiesModalOpen(false);
    setDepartmentQuery('');
    setAvailableSelection([]);
    setSelectedSelection([]);
    setAvailableActiveIndex(0);
    setAvailableAnchorIndex(null);
    setSelectedAnchorIndex(null);
    window.setTimeout(() => {
      if (initialDepartmentsOpen) {
        focusDepartmentSearch(true);
        return;
      }
      nameRef.current?.focus();
    }, 0);
  }, [
    initialDepartmentsOpen,
    initialColor,
    initialDepartmentTags,
    initialLogical,
    initialMeetingRoom,
    initialNoWindows,
    initialStorageRoom,
    initialBathroom,
    initialTechnicalRoom,
    initialName,
    initialNameEn,
    initialCapacity,
    initialNotes,
    initialShowName,
    initialSurfaceSqm,
    focusDepartmentSearch,
    open
  ]);

  useEffect(() => {
    if (!open || !departmentsModalOpen) return;
    focusDepartmentSearch();
  }, [departmentsModalOpen, focusDepartmentSearch, open]);

  useEffect(() => {
    if (!open || !departmentsModalOpen) return;
    toast.dismiss();
  }, [departmentsModalOpen, open]);

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

  useEffect(() => {
    setAvailableActiveIndex((prev) => {
      if (!filteredAvailableDepartments.length) return 0;
      return Math.min(Math.max(0, prev), filteredAvailableDepartments.length - 1);
    });
  }, [filteredAvailableDepartments.length]);

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
    setAvailableAnchorIndex(null);
  };

  const removeSelectedDepartments = () => {
    const normalized = new Set(selectedSelection.map((entry) => String(entry || '').trim().toLocaleLowerCase()).filter(Boolean));
    if (!normalized.size) return;
    setDepartmentTags((prev) => prev.filter((entry) => !normalized.has(entry.toLocaleLowerCase())));
    setSelectedSelection([]);
    setSelectedAnchorIndex(null);
  };

  const moveAllAvailableDepartments = () => {
    if (!availableDepartments.length) return;
    setDepartmentTags((prev) => canonicalDepartmentTags([...prev, ...availableDepartments]));
    setAvailableSelection([]);
    setAvailableAnchorIndex(null);
    setAvailableActiveIndex(0);
  };

  const addFilteredDepartments = () => {
    if (availableSelection.length) {
      moveSelectedDepartments();
      return;
    }
    const raw = String(departmentQuery || '').trim();
    if (!raw) return;
    const active = filteredAvailableDepartments[availableActiveIndex] || filteredAvailableDepartments[0];
    if (active) {
      addDepartmentTag(active);
      return;
    }
    addDepartmentTag(raw);
  };

  const applyRangeSelection = (
    list: string[],
    current: string[],
    clickedIndex: number,
    anchorIndex: number | null,
    append: boolean
  ) => {
    const from = anchorIndex === null ? clickedIndex : Math.min(anchorIndex, clickedIndex);
    const to = anchorIndex === null ? clickedIndex : Math.max(anchorIndex, clickedIndex);
    const range = list.slice(from, to + 1);
    if (!append) return range;
    const normalized = new Set(current.map((entry) => entry.toLocaleLowerCase()));
    const merged = [...current];
    for (const entry of range) {
      const folded = entry.toLocaleLowerCase();
      if (normalized.has(folded)) continue;
      normalized.add(folded);
      merged.push(entry);
    }
    return merged;
  };

  const onAvailableRowClick = (entry: string, index: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    const isAppend = event.ctrlKey || event.metaKey;
    if (event.shiftKey) {
      setAvailableSelection((prev) => applyRangeSelection(filteredAvailableDepartments, prev, index, availableAnchorIndex, isAppend));
      setAvailableActiveIndex(index);
      if (availableAnchorIndex === null) setAvailableAnchorIndex(index);
      return;
    }
    if (isAppend) {
      setAvailableSelection((prev) => {
        const exists = prev.some((item) => item.toLocaleLowerCase() === entry.toLocaleLowerCase());
        if (exists) return prev.filter((item) => item.toLocaleLowerCase() !== entry.toLocaleLowerCase());
        return [...prev, entry];
      });
      setAvailableAnchorIndex(index);
      setAvailableActiveIndex(index);
      return;
    }
    setAvailableSelection([entry]);
    setAvailableAnchorIndex(index);
    setAvailableActiveIndex(index);
  };

  const onSelectedRowClick = (entry: string, index: number, event: ReactMouseEvent<HTMLButtonElement>) => {
    const isAppend = event.ctrlKey || event.metaKey;
    if (event.shiftKey) {
      setSelectedSelection((prev) => applyRangeSelection(filteredSelectedDepartments, prev, index, selectedAnchorIndex, isAppend));
      if (selectedAnchorIndex === null) setSelectedAnchorIndex(index);
      return;
    }
    if (isAppend) {
      setSelectedSelection((prev) => {
        const exists = prev.some((item) => item.toLocaleLowerCase() === entry.toLocaleLowerCase());
        if (exists) return prev.filter((item) => item.toLocaleLowerCase() !== entry.toLocaleLowerCase());
        return [...prev, entry];
      });
      setSelectedAnchorIndex(index);
      return;
    }
    setSelectedSelection([entry]);
    setSelectedAnchorIndex(index);
  };

  useEffect(() => {
    if (!open || !departmentsModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = String(target?.tagName || '').toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || !!(target as any)?.isContentEditable;
      if (!isTyping && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        focusDepartmentSearch(true);
        return;
      }
      if (tag !== 'input') return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!filteredAvailableDepartments.length) return;
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex =
          ((availableActiveIndex + delta) % filteredAvailableDepartments.length + filteredAvailableDepartments.length) %
          filteredAvailableDepartments.length;
        const entry = filteredAvailableDepartments[nextIndex];
        setAvailableActiveIndex(nextIndex);
        setAvailableSelection([entry]);
        setAvailableAnchorIndex(nextIndex);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        addFilteredDepartments();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    addFilteredDepartments,
    availableActiveIndex,
    departmentsModalOpen,
    filteredAvailableDepartments,
    focusDepartmentSearch,
    open
  ]);

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
      logical,
      meetingRoom,
      noWindows,
      storageRoom,
      bathroom,
      technicalRoom
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
      <Transition show={open && !departmentsModalOpen && !propertiesModalOpen} as={Fragment}>
      <Dialog
        as="div"
        className="relative z-50"
        onClose={onClose}
        initialFocus={nameRef}
      >
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
                      <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-medium text-slate-700">
                              {t({ it: 'Proprietà stanza', en: 'Room properties' })}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {t({
                                it: 'Nome visibile, room logica, meeting room, tipologia e colori.',
                                en: 'Show name, logical room, meeting room, room type and colors.'
                              })}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPropertiesModalOpen(true)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t({ it: 'Apri proprietà', en: 'Open properties' })}
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          {showName ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t({ it: 'Nome in mappa', en: 'Name on map' })}</span> : null}
                          {logical ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t({ it: 'Room logica', en: 'Logical room' })}</span> : null}
                          {meetingRoom ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t({ it: 'Meeting room', en: 'Meeting room' })}</span> : null}
                          {noWindows ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t({ it: 'Senza finestre', en: 'No windows' })}</span> : null}
                          {storageRoom ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t({ it: 'Ripostiglio', en: 'Storage room' })}</span> : null}
                          {bathroom ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t({ it: 'Bagno', en: 'Bathroom' })}</span> : null}
                          {technicalRoom ? <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{t({ it: 'Locale tecnico', en: 'Technical room' })}</span> : null}
                          {!showName && !logical && !meetingRoom && !noWindows && !storageRoom && !bathroom && !technicalRoom ? (
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{t({ it: 'Nessuna opzione attiva', en: 'No active option' })}</span>
                          ) : null}
                        </div>
                      </div>
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
                      <div className="grid gap-2 md:grid-cols-2">
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
                      </div>
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
                        <div className="text-sm font-medium text-slate-700">{t({ it: 'Stato capienza', en: 'Capacity status' })}</div>
                        <div className="mt-2 flex flex-col items-center gap-3 md:flex-row md:items-center md:justify-between">
                          <CapacityGauge value={users.length} total={roomCapacityValue} size={170} />
                          <div className="w-full rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 md:w-52">
                            <div className="flex items-center justify-between gap-2">
                              <span>{t({ it: 'Utenti presenti', en: 'Users present' })}</span>
                              <span className="font-semibold text-ink">{users.length}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span>{t({ it: 'Capienza impostata', en: 'Configured capacity' })}</span>
                              <span className="font-semibold text-ink">{roomCapacityValue}</span>
                            </div>
                            <div className="mt-1 flex items-center justify-between gap-2">
                              <span>{t({ it: 'Disponibilità', en: 'Availability' })}</span>
                              <span className="font-semibold text-ink">{Math.max(0, roomCapacityValue - users.length)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
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

      <Transition show={propertiesModalOpen && open} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setPropertiesModalOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-3xl modal-panel">
                  <div className="modal-header items-center">
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Proprietà stanza', en: 'Room properties' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({ it: 'Stanza', en: 'Room' })}: <span className="font-semibold text-slate-700">{name.trim() || initialName || '-'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setPropertiesModalOpen(false)}
                      className="icon-button"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4 space-y-2">
                    <IosSwitch
                      label={t({ it: 'Nome visibile in mappa', en: 'Show name on map' })}
                      description={t({
                        it: 'Mostra il nome della stanza direttamente sulla planimetria.',
                        en: 'Displays the room name directly on the floor plan.'
                      })}
                      checked={showName}
                      onChange={setShowName}
                    />
                    <IosSwitch
                      label={t({ it: 'Room logica', en: 'Logical room' })}
                      description={t({
                        it: "Usa 'logica' per gruppi non legati a una singola stanza fisica.",
                        en: "Use 'logical' for groups not tied to a single physical room."
                      })}
                      checked={logical}
                      onChange={setLogical}
                    />
                    <IosSwitch
                      label={t({ it: 'Meeting room', en: 'Meeting room' })}
                      description={t({
                        it: 'Esclusa dalla ricerca collocazione salvo opzione dedicata.',
                        en: 'Excluded from placement search unless explicitly enabled.'
                      })}
                      checked={meetingRoom}
                      onChange={setMeetingRoom}
                    />
                    <IosSwitch
                      label={t({ it: 'Stanza senza finestre', en: 'Room without windows' })}
                      checked={noWindows}
                      onChange={setNoWindows}
                    />
                    <IosSwitch
                      label={t({ it: 'Ripostiglio', en: 'Storage room' })}
                      description={t({
                        it: 'Non occupabile da utenti e utenti reali.',
                        en: 'Users and real users cannot be placed here.'
                      })}
                      checked={storageRoom}
                      onChange={setStorageRoom}
                    />
                    <IosSwitch
                      label={t({ it: 'Bagno', en: 'Bathroom' })}
                      description={t({
                        it: 'Non occupabile da utenti e utenti reali.',
                        en: 'Users and real users cannot be placed here.'
                      })}
                      checked={bathroom}
                      onChange={setBathroom}
                    />
                    <IosSwitch
                      label={t({ it: 'Locale tecnico', en: 'Technical room' })}
                      description={t({
                        it: 'Non occupabile da utenti e utenti reali.',
                        en: 'Users and real users cannot be placed here.'
                      })}
                      checked={technicalRoom}
                      onChange={setTechnicalRoom}
                    />
                  </div>
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white px-3 py-3">
                    <div className="text-sm font-medium text-slate-700">{t({ it: 'Colore stanza', en: 'Room color' })}</div>
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
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPropertiesModalOpen(false)}
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

      <Transition show={departmentsModalOpen && open} as={Fragment} afterEnter={() => focusDepartmentSearch()}>
        <Dialog as="div" className="relative z-[60]" onClose={() => setDepartmentsModalOpen(false)} initialFocus={departmentSearchRef}>
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
                    <div>
                      <Dialog.Title className="modal-title">{t({ it: 'Associa reparti', en: 'Assign departments' })}</Dialog.Title>
                      <div className="text-xs text-slate-500">
                        {t({ it: 'Stanza', en: 'Room' })}: <span className="font-semibold text-slate-700">{name.trim() || initialName || '-'}</span>
                      </div>
                    </div>
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
                      <span className="inline-flex items-center gap-2">
                        {t({ it: 'Ricerca reparto', en: 'Department search' })}
                        <span className="group relative inline-flex items-center">
                          <HelpCircle size={14} className="text-slate-400" />
                          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-72 -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-normal text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                            {t({
                              it: 'Shortcut: F torna alla ricerca. Frecce Su/Giù scorrono i risultati. Invio aggiunge la selezione. Shift/Ctrl (o Cmd) per selezione multipla.',
                              en: 'Shortcut: F focuses search. Up/Down arrows move results. Enter adds selection. Shift/Ctrl (or Cmd) for multi-select.'
                            })}
                          </span>
                        </span>
                      </span>
                      <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <Search size={14} className="text-slate-400" />
                        <input
                          ref={departmentSearchRef}
                          autoFocus
                          value={departmentQuery}
                          onChange={(e) => setDepartmentQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return;
                            e.preventDefault();
                            addFilteredDepartments();
                          }}
                          className="w-full text-sm outline-none"
                          placeholder={t({
                            it: 'Digita per filtrare (F = focus, frecce = naviga, Invio = aggiungi selezione).',
                            en: 'Type to filter (F = focus, arrows = navigate, Enter = add selection).'
                          })}
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
                          filteredAvailableDepartments.map((entry, index) => {
                            const selected = availableSelection.some((item) => item.toLocaleLowerCase() === entry.toLocaleLowerCase());
                            const active = index === availableActiveIndex;
                            return (
                              <button
                                type="button"
                                key={entry}
                                onClick={(event) => onAvailableRowClick(entry, index, event)}
                                onDoubleClick={() => addDepartmentTag(entry)}
                                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm ${
                                  selected
                                    ? 'bg-primary/10 text-primary'
                                    : active
                                      ? 'bg-slate-100 text-slate-800'
                                      : 'hover:bg-slate-50 text-slate-700'
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
                        onClick={moveAllAvailableDepartments}
                        className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                        title={t({ it: 'Svuota colonna sinistra', en: 'Clear left column' })}
                      >
                        <ChevronsRight size={16} />
                      </button>
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
                          filteredSelectedDepartments.map((entry, index) => {
                            const selected = selectedSelection.some((item) => item.toLocaleLowerCase() === entry.toLocaleLowerCase());
                            return (
                              <button
                                type="button"
                                key={entry}
                                onClick={(event) => onSelectedRowClick(entry, index, event)}
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
