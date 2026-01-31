import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { IconName, MapObjectType, WifiAntennaModel } from '../../store/types';
import Icon from '../ui/Icon';
import { useT } from '../../i18n/useT';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { WIFI_DEFAULT_STANDARD, WIFI_STANDARD_OPTIONS } from '../../store/data';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description?: string;
    layerIds?: string[];
    customValues?: Record<string, any>;
    scale?: number;
    wifiDb?: number;
    wifiStandard?: string;
    wifiBand24?: boolean;
    wifiBand5?: boolean;
    wifiBand6?: boolean;
    wifiBrand?: string;
    wifiModel?: string;
    wifiModelCode?: string;
    wifiCoverageSqm?: number;
    wifiCatalogId?: string;
    wifiShowRange?: boolean;
  }) => void;
  initialName?: string;
  initialDescription?: string;
  layers?: { id: string; label: string; color?: string }[];
  initialLayerIds?: string[];
  initialScale?: number;
  typeLabel?: string;
  type?: MapObjectType;
  icon?: IconName;
  objectId?: string;
  readOnly?: boolean;
  initialWifiDb?: number;
  initialWifiStandard?: string;
  initialWifiBand24?: boolean;
  initialWifiBand5?: boolean;
  initialWifiBand6?: boolean;
  initialWifiBrand?: string;
  initialWifiModel?: string;
  initialWifiModelCode?: string;
  initialWifiCoverageSqm?: number;
  initialWifiCatalogId?: string;
  initialWifiShowRange?: boolean;
  wifiModels?: WifiAntennaModel[];
}

const ObjectModal = ({
  open,
  onClose,
  onSubmit,
  initialName = '',
  initialDescription = '',
  layers = [],
  initialLayerIds = [],
  initialScale = 1,
  typeLabel,
  type,
  icon,
  objectId,
  readOnly = false,
  initialWifiDb,
  initialWifiStandard,
  initialWifiBand24,
  initialWifiBand5,
  initialWifiBand6,
  initialWifiBrand,
  initialWifiModel,
  initialWifiModelCode,
  initialWifiCoverageSqm,
  initialWifiCatalogId,
  initialWifiShowRange,
  wifiModels = []
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [layerIds, setLayerIds] = useState<string[]>(initialLayerIds);
  const [scale, setScale] = useState<number>(initialScale);
  const [customValues, setCustomValues] = useState<Record<string, any>>({});
  const [wifiDb, setWifiDb] = useState<string>('');
  const [wifiStandard, setWifiStandard] = useState<string>(WIFI_DEFAULT_STANDARD);
  const [wifiBand24, setWifiBand24] = useState(false);
  const [wifiBand5, setWifiBand5] = useState(false);
  const [wifiBand6, setWifiBand6] = useState(false);
  const [wifiSource, setWifiSource] = useState<'catalog' | 'custom'>('catalog');
  const [wifiCatalogId, setWifiCatalogId] = useState('');
  const [wifiCatalogQuery, setWifiCatalogQuery] = useState('');
  const [wifiCatalogSearchOpen, setWifiCatalogSearchOpen] = useState(false);
  const [wifiBrand, setWifiBrand] = useState('');
  const [wifiModel, setWifiModel] = useState('');
  const [wifiModelCode, setWifiModelCode] = useState('');
  const [wifiCoverageSqm, setWifiCoverageSqm] = useState('');
  const [wifiShowRange, setWifiShowRange] = useState(true);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const wifiCatalogSearchRef = useRef<HTMLInputElement | null>(null);
  const { hydrated, getFieldsForType, loadObjectValues } = useCustomFieldsStore();
  const isWifi = type === 'wifi';
  const wifiModelsById = useMemo(() => {
    const map = new Map<string, WifiAntennaModel>();
    for (const model of wifiModels || []) map.set(model.id, model);
    return map;
  }, [wifiModels]);
  const wifiFormValid = useMemo(() => {
    if (!isWifi) return true;
    const coverageRaw = wifiCoverageSqm.trim().replace(',', '.');
    const coverageValue = coverageRaw ? Number(coverageRaw) : undefined;
    if (wifiSource === 'catalog' && !wifiCatalogId) return false;
    if (!wifiBrand.trim()) return false;
    if (!wifiModel.trim()) return false;
    if (!wifiModelCode.trim()) return false;
    if (!wifiStandard) return false;
    if (!(wifiBand24 || wifiBand5 || wifiBand6)) return false;
    return Number.isFinite(coverageValue as number) && (coverageValue as number) > 0;
  }, [
    isWifi,
    wifiBand24,
    wifiBand5,
    wifiBand6,
    wifiBrand,
    wifiCatalogId,
    wifiCoverageSqm,
    wifiModel,
    wifiModelCode,
    wifiSource,
    wifiStandard
  ]);
  const wifiModelsSorted = useMemo(() => {
    return (wifiModels || [])
      .slice()
      .sort((a, b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`));
  }, [wifiModels]);
  const filteredWifiCatalogModels = useMemo(() => {
    const term = wifiCatalogQuery.trim().toLowerCase();
    if (!term) return wifiModelsSorted;
    return wifiModelsSorted.filter((model) => {
      const haystack = `${model.brand} ${model.model} ${model.modelCode}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [wifiCatalogQuery, wifiModelsSorted]);
  const hasWifiCatalog = wifiModels.length > 0;
  const canSave = useMemo(() => {
    if (readOnly) return false;
    if (type !== 'quote' && !name.trim()) return false;
    return wifiFormValid;
  }, [name, readOnly, type, wifiFormValid]);
  const customFields = useMemo(() => (type ? getFieldsForType(type) : []), [getFieldsForType, type]);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      setLayerIds(initialLayerIds);
      setScale(Number.isFinite(initialScale) ? initialScale : 1);
      setCustomValues({});
      setWifiDb(initialWifiDb !== undefined ? String(initialWifiDb) : '');
      const hasCatalog = (wifiModels || []).length > 0;
      const hasCustomFields = !!(
        initialWifiBrand ||
        initialWifiModel ||
        initialWifiModelCode ||
        initialWifiCoverageSqm ||
        initialWifiStandard ||
        initialWifiBand24 ||
        initialWifiBand5 ||
        initialWifiBand6
      );
      const catalogModel =
        hasCatalog && initialWifiCatalogId ? wifiModelsById.get(initialWifiCatalogId) : undefined;
      const nextCatalogId = catalogModel ? String(initialWifiCatalogId) : '';
      const nextSource: 'catalog' | 'custom' = catalogModel ? 'catalog' : 'custom';
      const shouldBlankCustom = !catalogModel && !hasCustomFields;
      setWifiSource(nextSource);
      setWifiCatalogId(nextCatalogId);
      if (nextSource === 'catalog' && nextCatalogId) {
        const model = wifiModelsById.get(nextCatalogId);
        setWifiBrand(model?.brand || '');
        setWifiModel(model?.model || '');
        setWifiModelCode(model?.modelCode || '');
        setWifiCoverageSqm(model?.coverageSqm ? String(model.coverageSqm) : '');
        setWifiStandard(model?.standard || WIFI_DEFAULT_STANDARD);
        setWifiBand24(!!model?.band24);
        setWifiBand5(!!model?.band5);
        setWifiBand6(!!model?.band6);
        setWifiShowRange(initialWifiShowRange !== undefined ? initialWifiShowRange : true);
      } else if (!shouldBlankCustom) {
        setWifiBrand(initialWifiBrand || '');
        setWifiModel(initialWifiModel || '');
        setWifiModelCode(initialWifiModelCode || '');
        setWifiCoverageSqm(initialWifiCoverageSqm ? String(initialWifiCoverageSqm) : '');
        setWifiStandard(initialWifiStandard || WIFI_DEFAULT_STANDARD);
        setWifiBand24(!!initialWifiBand24);
        setWifiBand5(!!initialWifiBand5);
        setWifiBand6(!!initialWifiBand6);
        setWifiShowRange(initialWifiShowRange !== undefined ? initialWifiShowRange : true);
      } else {
        setWifiBrand('');
        setWifiModel('');
        setWifiModelCode('');
        setWifiCoverageSqm('');
        setWifiStandard('');
        setWifiBand24(false);
        setWifiBand5(false);
        setWifiBand6(false);
        setWifiShowRange(true);
      }
      setWifiCatalogQuery('');
      setWifiCatalogSearchOpen(false);
      window.setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [
    initialDescription,
    initialLayerIds,
    initialName,
    initialScale,
    initialWifiBand24,
    initialWifiBand5,
    initialWifiBand6,
    initialWifiDb,
    initialWifiStandard,
    initialWifiBrand,
    initialWifiModel,
    initialWifiModelCode,
    initialWifiCoverageSqm,
    initialWifiCatalogId,
    initialWifiShowRange,
    open,
    wifiModels,
    wifiModelsById
  ]);

  useEffect(() => {
    if (!open) return;
    if (!isWifi) return;
    if (wifiSource !== 'catalog') return;
    if (!wifiCatalogId) return;
    const model = wifiModelsById.get(wifiCatalogId);
    if (!model) return;
    setWifiBrand(model.brand);
    setWifiModel(model.model);
    setWifiModelCode(model.modelCode);
    setWifiCoverageSqm(String(model.coverageSqm));
    setWifiStandard(model.standard || WIFI_DEFAULT_STANDARD);
    setWifiBand24(!!model.band24);
    setWifiBand5(!!model.band5);
    setWifiBand6(!!model.band6);
  }, [isWifi, open, wifiCatalogId, wifiModelsById, wifiSource]);

  useEffect(() => {
    if (!open || !isWifi) return;
    if (wifiSource !== 'catalog') return;
    if (name.trim()) return;
    if (!wifiBrand || !wifiModel) return;
    setName(`${wifiBrand} ${wifiModel}`);
  }, [isWifi, name, open, wifiBrand, wifiModel, wifiSource]);

  const closeWifiCatalogSearch = useCallback(() => {
    setWifiCatalogSearchOpen(false);
    setWifiCatalogQuery('');
  }, []);

  const handleDialogClose = useCallback(() => {
    if (wifiCatalogSearchOpen) return;
    onClose();
  }, [onClose, wifiCatalogSearchOpen]);

  const handleSearchDialogClose = useCallback(() => {}, []);

  const handleSelectCatalogModel = useCallback(
    (model: WifiAntennaModel) => {
      setWifiSource('catalog');
      setWifiCatalogId(model.id);
      setWifiBrand(model.brand);
      setWifiModel(model.model);
      setWifiModelCode(model.modelCode);
      setWifiCoverageSqm(String(model.coverageSqm));
      setWifiStandard(model.standard || WIFI_DEFAULT_STANDARD);
      setWifiBand24(!!model.band24);
      setWifiBand5(!!model.band5);
      setWifiBand6(!!model.band6);
      closeWifiCatalogSearch();
    },
    [closeWifiCatalogSearch]
  );

  useEffect(() => {
    if (!open) return;
    if (!hydrated) return;
    if (!objectId || !type) return;
    if (!customFields.length) return;
    loadObjectValues(objectId)
      .then((values) => setCustomValues(values || {}))
      .catch(() => setCustomValues({}));
  }, [customFields.length, hydrated, loadObjectValues, objectId, open, type]);

  useEffect(() => {
    if (open) return;
    closeWifiCatalogSearch();
  }, [closeWifiCatalogSearch, open]);

  const handleSave = () => {
    if (type !== 'quote' && !name.trim()) return;
    const dbRaw = wifiDb.trim().replace(',', '.');
    const dbValue = dbRaw ? Number(dbRaw) : undefined;
    const coverageRaw = wifiCoverageSqm.trim().replace(',', '.');
    const coverageValue = coverageRaw ? Number(coverageRaw) : undefined;
    if (isWifi) {
      if (wifiSource === 'catalog' && !wifiCatalogId) return;
      if (!wifiBrand.trim()) return;
      if (!wifiModel.trim()) return;
      if (!wifiModelCode.trim()) return;
      if (!wifiStandard) return;
      if (!(wifiBand24 || wifiBand5 || wifiBand6)) return;
      if (!Number.isFinite(coverageValue as number) || (coverageValue as number) <= 0) return;
    }
    const safeName = type === 'quote' ? name.trim() : name.trim();
    onSubmit({
      name: safeName,
      description: description.trim() || undefined,
      layerIds: layerIds.length ? layerIds : undefined,
      customValues: customFields.length ? customValues : undefined,
      scale: Number.isFinite(scale) ? Math.max(0.2, Math.min(2.4, scale)) : undefined,
      ...(isWifi
        ? {
            wifiDb: Number.isFinite(dbValue as number) ? (dbValue as number) : undefined,
            wifiStandard: wifiStandard || WIFI_DEFAULT_STANDARD,
            wifiBand24,
            wifiBand5,
            wifiBand6,
            wifiBrand: wifiBrand.trim(),
            wifiModel: wifiModel.trim(),
            wifiModelCode: wifiModelCode.trim(),
            wifiCoverageSqm: Number.isFinite(coverageValue as number) ? (coverageValue as number) : undefined,
            wifiCatalogId: wifiSource === 'catalog' ? wifiCatalogId : undefined,
            wifiShowRange
          }
        : {})
    });
    onClose();
  };

  return (
    <Fragment>
      <Transition show={open} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleDialogClose}>
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
                <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card">
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {initialName ? t({ it: 'Modifica oggetto', en: 'Edit object' }) : t({ it: 'Nuovo oggetto', en: 'New object' })}
                    </Dialog.Title>
                    <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
                  </div>
                  {typeLabel ? (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                      {icon ? <Icon name={icon} className="text-primary" /> : type ? <Icon type={type} className="text-primary" /> : null}
                      {typeLabel}
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {isWifi ? t({ it: 'Device Name', en: 'Device Name' }) : t({ it: 'Nome', en: 'Name' })}{' '}
                    <span className="text-rose-600">*</span>
                    <input
                      ref={nameRef}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSave();
                        }
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Es. Stampante HR', en: 'e.g. HR Printer' })}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Descrizione', en: 'Description' })}
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({ it: 'Facoltativa', en: 'Optional' })}
                      rows={3}
                    />
                  </label>
                  {isWifi ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">{t({ it: 'WiFi Antenna', en: 'WiFi Antenna' })}</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={readOnly || !hasWifiCatalog}
                            onClick={() => {
                              if (!hasWifiCatalog) return;
                              setWifiSource('catalog');
                              if (!wifiCatalogId) {
                                setWifiBrand('');
                                setWifiModel('');
                                setWifiModelCode('');
                                setWifiCoverageSqm('');
                                setWifiStandard('');
                                setWifiBand24(false);
                                setWifiBand5(false);
                                setWifiBand6(false);
                                setWifiCatalogSearchOpen(true);
                              }
                            }}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                              wifiSource === 'catalog'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            } ${readOnly || !hasWifiCatalog ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            {t({ it: 'Catalogo', en: 'Catalog' })}
                          </button>
                          <button
                            type="button"
                            disabled={readOnly}
                            onClick={() => {
                              setWifiSource('custom');
                              setWifiCatalogId('');
                              setWifiCatalogQuery('');
                              setWifiCatalogSearchOpen(false);
                              setWifiBrand('');
                              setWifiModel('');
                              setWifiModelCode('');
                              setWifiCoverageSqm('');
                              setWifiStandard('');
                              setWifiBand24(false);
                              setWifiBand5(false);
                              setWifiBand6(false);
                            }}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                              wifiSource === 'custom'
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                            } ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                          >
                            {t({ it: 'Custom', en: 'Custom' })}
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3">
                        {wifiSource === 'catalog' ? (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-medium text-slate-700">
                                {t({ it: 'Catalogo antenna', en: 'Antenna catalog' })}
                              </div>
                              <button
                                type="button"
                                disabled={readOnly || !hasWifiCatalog}
                                onClick={() => setWifiCatalogSearchOpen(true)}
                                className={`rounded-lg border px-2 py-1 text-xs font-semibold ${
                                  wifiCatalogId ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                } ${readOnly || !hasWifiCatalog ? 'cursor-not-allowed opacity-60' : ''}`}
                              >
                                {t({ it: 'Search from catalog', en: 'Search from catalog' })}
                              </button>
                            </div>
                            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                              {wifiCatalogId
                                ? t({
                                    it: `Selezionato: ${wifiBrand} ${wifiModel} (${wifiModelCode})`,
                                    en: `Selected: ${wifiBrand} ${wifiModel} (${wifiModelCode})`
                                  })
                                : t({ it: 'Nessun modello selezionato.', en: 'No model selected.' })}
                            </div>
                          </>
                        ) : null}
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Marca', en: 'Brand' })}
                          <input
                            value={wifiBrand}
                            disabled={readOnly || wifiSource === 'catalog'}
                            onChange={(e) => setWifiBrand(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Es. Ubiquiti', en: 'e.g. Ubiquiti' })}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Modello', en: 'Model' })}
                          <input
                            value={wifiModel}
                            disabled={readOnly || wifiSource === 'catalog'}
                            onChange={(e) => setWifiModel(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Es. U7 Pro', en: 'e.g. U7 Pro' })}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Codice modello', en: 'Model code' })}
                          <input
                            value={wifiModelCode}
                            disabled={readOnly || wifiSource === 'catalog'}
                            onChange={(e) => setWifiModelCode(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Es. U7-Pro', en: 'e.g. U7-Pro' })}
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Standard', en: 'Standard' })}
                          <select
                            value={wifiStandard}
                            disabled={readOnly || wifiSource === 'catalog'}
                            onChange={(e) => setWifiStandard(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          >
                            <option value="">{t({ it: 'Seleziona...', en: 'Select...' })}</option>
                            {WIFI_STANDARD_OPTIONS.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {t({ it: opt.it, en: opt.en })}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={wifiBand24}
                              disabled={readOnly || wifiSource === 'catalog'}
                              onChange={(e) => setWifiBand24(e.target.checked)}
                            />
                            2.4 GHz
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={wifiBand5}
                              disabled={readOnly || wifiSource === 'catalog'}
                              onChange={(e) => setWifiBand5(e.target.checked)}
                            />
                            5 GHz
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={wifiBand6}
                              disabled={readOnly || wifiSource === 'catalog'}
                              onChange={(e) => setWifiBand6(e.target.checked)}
                            />
                            6 GHz
                          </label>
                        </div>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Copertura (m2)', en: 'Coverage (m2)' })}
                          <input
                            value={wifiCoverageSqm}
                            disabled={readOnly || wifiSource === 'catalog'}
                            onChange={(e) => setWifiCoverageSqm(e.target.value)}
                            inputMode="decimal"
                            type="number"
                            min={1}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Es. 185', en: 'e.g. 185' })}
                          />
                        </label>
                        <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={wifiShowRange}
                            disabled={readOnly}
                            onChange={(e) => setWifiShowRange(e.target.checked)}
                          />
                          {t({ it: 'Mostra range access point', en: 'Show access point range' })}
                        </label>
                        {!wifiFormValid ? (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                            {t({
                              it: 'Completa tutti i campi dell’antenna.',
                              en: 'Complete all antenna fields.'
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {layers.length ? (
                    <div>
                      <div className="text-sm font-medium text-slate-700">{t({ it: 'Livelli', en: 'Layers' })}</div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {layers.map((l) => {
                          const on = layerIds.includes(l.id);
                          return (
                            <button
                              key={l.id}
                              type="button"
                              onClick={() =>
                                setLayerIds((prev) => (prev.includes(l.id) ? prev.filter((x) => x !== l.id) : [...prev, l.id]))
                              }
                              className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm font-semibold ${
                                on ? 'border-primary bg-primary/5 text-primary' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                              title={l.label}
                            >
                              <span className="truncate">{l.label}</span>
                              <span className="ml-2 h-2 w-2 rounded-full" style={{ background: l.color || (on ? '#2563eb' : '#cbd5e1') }} />
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {t({
                          it: 'Seleziona uno o più livelli: serve per filtrare e organizzare gli oggetti.',
                          en: 'Select one or more layers to filter and organize objects.'
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      {t({ it: 'Scala oggetto', en: 'Object scale' })}
                      <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">{scale.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.2}
                      max={2.4}
                      step={0.05}
                      value={scale}
                      disabled={readOnly}
                      onChange={(e) => setScale(Number(e.target.value))}
                      className="mt-2 w-full"
                    />
                    <div className="mt-1 text-xs text-slate-500">
                      {t({ it: 'Regola la dimensione dell’oggetto nella planimetria.', en: 'Adjust the object size on the floor plan.' })}
                    </div>
                  </div>

                  {customFields.length ? (
                    <div>
                      <div className="text-sm font-medium text-slate-700">{t({ it: 'Campi personalizzati', en: 'Custom fields' })}</div>
                      <div className="mt-2 space-y-2">
                        {customFields.map((f) => (
                          <label key={f.id} className="block text-sm font-medium text-slate-700">
                            <span className="flex items-center justify-between">
                              <span className="truncate">{f.label}</span>
                              <span className="ml-2 text-[11px] font-mono text-slate-400">{f.fieldKey}</span>
                            </span>
                            {f.valueType === 'boolean' ? (
                              <div className="mt-1 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                                <span className="text-sm text-slate-600">{t({ it: 'Valore', en: 'Value' })}</span>
                                <input
                                  type="checkbox"
                                  disabled={readOnly}
                                  checked={!!customValues[f.fieldKey]}
                                  onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: e.target.checked }))}
                                />
                              </div>
                            ) : f.valueType === 'number' ? (
                              <input
                                value={customValues[f.fieldKey] ?? ''}
                                disabled={readOnly}
                                onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: e.target.value }))}
                                inputMode="decimal"
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                placeholder={t({ it: 'Numero', en: 'Number' })}
                              />
                            ) : (
                              <input
                                value={customValues[f.fieldKey] ?? ''}
                                disabled={readOnly}
                                onChange={(e) => setCustomValues((prev) => ({ ...prev, [f.fieldKey]: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                placeholder={t({ it: 'Testo', en: 'Text' })}
                              />
                            )}
                          </label>
                        ))}
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {t({ it: 'Questi campi sono per-utente e non vengono condivisi.', en: 'These fields are per-user and not shared.' })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={onClose}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!canSave}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${canSave ? 'bg-primary hover:bg-primary/90' : 'bg-slate-300 cursor-not-allowed'}`}
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
      <Transition show={open && wifiCatalogSearchOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-[60]"
          initialFocus={wifiCatalogSearchRef}
          onClose={handleSearchDialogClose}
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
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
                  className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-card"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="text-lg font-semibold text-ink">
                      {t({ it: 'Cerca nel catalogo', en: 'Search catalog' })}
                    </Dialog.Title>
                    <button
                      onClick={closeWifiCatalogSearch}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-4">
                    <input
                      ref={wifiCatalogSearchRef}
                      value={wifiCatalogQuery}
                      onChange={(e) => setWifiCatalogQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          closeWifiCatalogSearch();
                        }
                      }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                      placeholder={t({
                        it: 'Cerca per marca, modello o codice...',
                        en: 'Search by brand, model, or code...'
                      })}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {t({ it: 'Double click to select.', en: 'Double click to select.' })}
                  </div>
                  <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-2">{t({ it: 'Marca', en: 'Brand' })}</th>
                          <th className="px-3 py-2">{t({ it: 'Modello', en: 'Model' })}</th>
                          <th className="px-3 py-2">{t({ it: 'Codice', en: 'Code' })}</th>
                          <th className="px-3 py-2">{t({ it: 'Standard', en: 'Standard' })}</th>
                          <th className="px-3 py-2">2.4</th>
                          <th className="px-3 py-2">5</th>
                          <th className="px-3 py-2">6</th>
                          <th className="px-3 py-2">{t({ it: 'Copertura', en: 'Coverage' })}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredWifiCatalogModels.map((model) => (
                          <tr
                            key={model.id}
                            onMouseDown={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSelectCatalogModel(model);
                            }}
                            className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                          >
                            <td className="px-3 py-2 text-slate-700">{model.brand}</td>
                            <td className="px-3 py-2 text-slate-700">{model.model}</td>
                            <td className="px-3 py-2 text-slate-600">{model.modelCode}</td>
                            <td className="px-3 py-2 text-slate-600">{model.standard}</td>
                            <td className="px-3 py-2 text-slate-600">{model.band24 ? t({ it: 'Si', en: 'Yes' }) : t({ it: 'No', en: 'No' })}</td>
                            <td className="px-3 py-2 text-slate-600">{model.band5 ? t({ it: 'Si', en: 'Yes' }) : t({ it: 'No', en: 'No' })}</td>
                            <td className="px-3 py-2 text-slate-600">{model.band6 ? t({ it: 'Si', en: 'Yes' }) : t({ it: 'No', en: 'No' })}</td>
                            <td className="px-3 py-2 text-slate-600">{model.coverageSqm}</td>
                          </tr>
                        ))}
                        {!filteredWifiCatalogModels.length ? (
                          <tr>
                            <td colSpan={8} className="px-3 py-6 text-center text-sm text-slate-500">
                              {t({ it: 'Nessun risultato nel catalogo.', en: 'No results in catalog.' })}
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{t({ it: 'Doppio click per selezionare.', en: 'Double click to select.' })}</span>
                    <button
                      onClick={closeWifiCatalogSearch}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
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
    </Fragment>
  );
};

export default ObjectModal;
