import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { IconName, MapObjectType, WifiAntennaModel } from '../../store/types';
import Icon from '../ui/Icon';
import { useT } from '../../i18n/useT';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { TEXT_FONT_OPTIONS, WIFI_DEFAULT_STANDARD, WIFI_STANDARD_OPTIONS } from '../../store/data';
import { formatBytes, readFileAsDataUrl, uploadLimits, uploadMimes, validateFile } from '../../utils/files';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description?: string;
    layerIds?: string[];
    customValues?: Record<string, any>;
    scale?: number;
    quoteLabelScale?: number;
    quoteLabelBg?: boolean;
    quoteLabelColor?: string;
    quoteLabelOffset?: number;
    quoteLabelPos?: 'center' | 'above' | 'below' | 'left' | 'right';
    quoteDashed?: boolean;
    quoteEndpoint?: 'arrows' | 'dots' | 'none';
    strokeColor?: string;
    textFont?: string;
    textSize?: number;
    textColor?: string;
    textBg?: boolean;
    textBgColor?: string;
    imageUrl?: string;
    imageWidth?: number;
    imageHeight?: number;
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
  initialQuoteLabelScale?: number;
  initialQuoteLabelBg?: boolean;
  initialQuoteLabelColor?: string;
  initialQuoteLabelOffset?: number;
  initialQuoteLabelPos?: 'center' | 'above' | 'below' | 'left' | 'right';
  initialQuoteDashed?: boolean;
  initialQuoteEndpoint?: 'arrows' | 'dots' | 'none';
  initialQuoteColor?: string;
  initialQuoteLengthLabel?: string;
  initialQuotePoints?: { x: number; y: number }[];
  initialTextFont?: string;
  initialTextSize?: number;
  initialTextColor?: string;
  initialTextBg?: boolean;
  initialTextBgColor?: string;
  initialImageUrl?: string;
  initialImageWidth?: number;
  initialImageHeight?: number;
  typeLabel?: string;
  type?: MapObjectType;
  icon?: IconName;
  objectId?: string;
  readOnly?: boolean;
  onDelete?: () => void;
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
  initialQuoteLabelScale = 1,
  initialQuoteLabelBg = true,
  initialQuoteLabelColor = '#0f172a',
  initialQuoteLabelOffset,
  initialQuoteLabelPos = 'center',
  initialQuoteDashed = false,
  initialQuoteEndpoint = 'arrows',
  initialQuoteColor = '#f97316',
  initialQuoteLengthLabel,
  initialQuotePoints,
  initialTextFont = 'Arial, sans-serif',
  initialTextSize = 18,
  initialTextColor = '#000000',
  initialTextBg = false,
  initialTextBgColor = '#ffffff',
  initialImageUrl,
  initialImageWidth,
  initialImageHeight,
  typeLabel,
  type,
  icon,
  objectId,
  readOnly = false,
  onDelete,
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
  const [quoteLabelScale, setQuoteLabelScale] = useState<number>(initialQuoteLabelScale);
  const [quoteLabelBg, setQuoteLabelBg] = useState<boolean>(!!initialQuoteLabelBg);
  const [quoteLabelColor, setQuoteLabelColor] = useState<string>(initialQuoteLabelColor);
  const [quoteLabelOffset, setQuoteLabelOffset] = useState<number>(Number.isFinite(initialQuoteLabelOffset) ? (initialQuoteLabelOffset as number) : 1);
  const [quoteLabelOffsetTouched, setQuoteLabelOffsetTouched] = useState<boolean>(false);
  const [quoteLabelPos, setQuoteLabelPos] = useState<'center' | 'above' | 'below' | 'left' | 'right'>(initialQuoteLabelPos);
  const [quoteDashed, setQuoteDashed] = useState<boolean>(!!initialQuoteDashed);
  const [quoteEndpoint, setQuoteEndpoint] = useState<'arrows' | 'dots' | 'none'>(initialQuoteEndpoint);
  const [quoteColor, setQuoteColor] = useState<string>(initialQuoteColor);
  const [textFont, setTextFont] = useState<string>(initialTextFont);
  const [textSize, setTextSize] = useState<number>(initialTextSize);
  const [textColor, setTextColor] = useState<string>(initialTextColor);
  const [textBg, setTextBg] = useState<boolean>(!!initialTextBg);
  const [textBgColor, setTextBgColor] = useState<string>(initialTextBgColor || '#ffffff');
  const [imageUrl, setImageUrl] = useState<string>(initialImageUrl || '');
  const [imageWidth, setImageWidth] = useState<number>(Number.isFinite(initialImageWidth) ? (initialImageWidth as number) : 0);
  const [imageHeight, setImageHeight] = useState<number>(Number.isFinite(initialImageHeight) ? (initialImageHeight as number) : 0);
  const [imageError, setImageError] = useState<string>('');
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
  const [wifiCatalogSelectedId, setWifiCatalogSelectedId] = useState('');
  const [wifiBrand, setWifiBrand] = useState('');
  const [wifiModel, setWifiModel] = useState('');
  const [wifiModelCode, setWifiModelCode] = useState('');
  const [wifiCoverageSqm, setWifiCoverageSqm] = useState('');
  const [wifiShowRange, setWifiShowRange] = useState(true);
  const nameRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const wifiCatalogSearchRef = useRef<HTMLInputElement | null>(null);
  const wifiCatalogRowsRef = useRef<Record<string, HTMLTableRowElement | null>>({});
  const { hydrated, getFieldsForType, loadObjectValues } = useCustomFieldsStore();
  const isWifi = type === 'wifi';
  const isQuote = type === 'quote';
  const isText = type === 'text';
  const isImage = type === 'image';
  const isPostIt = type === 'postit';
  const isEdit = !!objectId;
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
  const wifiCoverageValue = useMemo(() => {
    const coverageRaw = wifiCoverageSqm.trim().replace(',', '.');
    const coverageValue = coverageRaw ? Number(coverageRaw) : NaN;
    if (!Number.isFinite(coverageValue) || coverageValue <= 0) return null;
    return coverageValue;
  }, [wifiCoverageSqm]);
  const formatCoverage = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return rounded.toFixed(1).replace(/\.0$/, '');
  };
  const wifiCoverageRadius = wifiCoverageValue ? Math.sqrt(wifiCoverageValue / Math.PI) : null;
  const wifiCoverageDiameter = wifiCoverageRadius ? wifiCoverageRadius * 2 : null;
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
  const selectedWifiCatalogModel = useMemo(() => {
    if (!wifiCatalogSelectedId) return null;
    return filteredWifiCatalogModels.find((model) => model.id === wifiCatalogSelectedId) || null;
  }, [filteredWifiCatalogModels, wifiCatalogSelectedId]);
  const hasWifiCatalog = wifiModels.length > 0;
  const canSave = useMemo(() => {
    if (readOnly) return false;
    if (type !== 'quote' && type !== 'image' && !name.trim()) return false;
    if (isImage && !imageUrl) return false;
    return wifiFormValid;
  }, [imageUrl, isImage, name, readOnly, type, wifiFormValid]);
  const customFields = useMemo(() => (type ? getFieldsForType(type) : []), [getFieldsForType, type]);
  const quoteOrientation = useMemo(() => {
    if (!initialQuotePoints || initialQuotePoints.length < 2) return 'horizontal' as const;
    const start = initialQuotePoints[0];
    const end = initialQuotePoints[initialQuotePoints.length - 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    return Math.abs(dy) > Math.abs(dx) ? ('vertical' as const) : ('horizontal' as const);
  }, [initialQuotePoints]);
  const quoteLengthLabel = initialQuoteLengthLabel || '';
  const quoteLabelPosEffective = useMemo(() => {
    if (!isQuote) return 'center';
    if (quoteOrientation === 'vertical') {
      return quoteLabelPos === 'left' || quoteLabelPos === 'right' || quoteLabelPos === 'center' ? quoteLabelPos : 'center';
    }
    return quoteLabelPos === 'above' || quoteLabelPos === 'below' || quoteLabelPos === 'center' ? quoteLabelPos : 'center';
  }, [isQuote, quoteLabelPos, quoteOrientation]);
  const defaultQuoteLabelOffset = useMemo(() => 1, []);
  const quotePreview = (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-xs font-semibold text-slate-600">{t({ it: 'Anteprima', en: 'Preview' })}</div>
      <div className="mt-2">
        {quoteOrientation === 'vertical' ? (
          <svg viewBox="0 0 220 240" className="h-40 w-full">
            <line
              x1="110"
              y1="30"
              x2="110"
              y2="210"
              stroke={quoteColor}
              strokeWidth={2 * scale}
              strokeDasharray={quoteDashed ? '6 5' : undefined}
            />
            {quoteEndpoint === 'dots' ? (
              <>
                <circle cx="110" cy="30" r="4" fill={quoteColor} />
                <circle cx="110" cy="210" r="4" fill={quoteColor} />
              </>
            ) : null}
            {quoteEndpoint === 'arrows' ? (
              <>
                <polygon points="110,18 100,34 120,34" fill={quoteColor} />
                <polygon points="110,222 100,206 120,206" fill={quoteColor} />
              </>
            ) : null}
            <text
              x={
                quoteLabelPosEffective === 'left'
                  ? 110 - 30 * quoteLabelOffset
                  : quoteLabelPosEffective === 'right'
                    ? 110 + 30 * quoteLabelOffset
                    : 110
              }
              y={120}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10 * quoteLabelScale}
              fontWeight="bold"
              fill={quoteLabelColor}
              transform={`rotate(-90 ${
                quoteLabelPosEffective === 'left'
                  ? 110 - 30 * quoteLabelOffset
                  : quoteLabelPosEffective === 'right'
                    ? 110 + 30 * quoteLabelOffset
                    : 110
              } 120)`}
            >
              {quoteLengthLabel || '0'}
            </text>
          </svg>
        ) : (
          <svg viewBox="0 0 320 160" className="h-32 w-full">
            <line
              x1="40"
              y1="80"
              x2="280"
              y2="80"
              stroke={quoteColor}
              strokeWidth={2 * scale}
              strokeDasharray={quoteDashed ? '6 5' : undefined}
            />
            {quoteEndpoint === 'dots' ? (
              <>
                <circle cx="40" cy="80" r="4" fill={quoteColor} />
                <circle cx="280" cy="80" r="4" fill={quoteColor} />
              </>
            ) : null}
            {quoteEndpoint === 'arrows' ? (
              <>
                <polygon points="34,80 48,70 48,90" fill={quoteColor} />
                <polygon points="286,80 272,70 272,90" fill={quoteColor} />
              </>
            ) : null}
            <text
              x={160}
              y={
                quoteLabelPosEffective === 'above'
                  ? 80 - 10 * quoteLabelOffset
                  : quoteLabelPosEffective === 'below'
                    ? 80 + 10 * quoteLabelOffset
                    : 80
              }
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={10 * quoteLabelScale}
              fontWeight="bold"
              fill={quoteLabelColor}
            >
              {quoteLengthLabel || '0'}
            </text>
          </svg>
        )}
      </div>
    </div>
  );
  const fitImageSize = (width: number, height: number) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return { width: 160, height: 120 };
    }
    const maxDim = 240;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    return { width: Math.round(width * scale), height: Math.round(height * scale) };
  };

  useEffect(() => {
    if (open) {
      setName(initialName);
      setDescription(initialDescription);
      setLayerIds(initialLayerIds);
      setScale(Number.isFinite(initialScale) ? initialScale : 1);
      setQuoteLabelScale(Number.isFinite(initialQuoteLabelScale) ? initialQuoteLabelScale : 1);
      setQuoteLabelBg(!!initialQuoteLabelBg);
      setQuoteLabelColor(initialQuoteLabelColor || '#0f172a');
      setQuoteLabelOffset(
        Number.isFinite(initialQuoteLabelOffset)
          ? (initialQuoteLabelOffset as number)
          : (quoteOrientation === 'horizontal' && initialQuoteLabelPos === 'below' ? 1.15 : 1)
      );
      setQuoteLabelOffsetTouched(false);
      setQuoteLabelPos(initialQuoteLabelPos || 'center');
      setQuoteDashed(!!initialQuoteDashed);
      setQuoteEndpoint(initialQuoteEndpoint || 'arrows');
      setQuoteColor(initialQuoteColor || '#f97316');
      setTextFont(initialTextFont || 'Arial, sans-serif');
      setTextSize(Number.isFinite(initialTextSize) ? (initialTextSize as number) : 18);
      setTextColor(initialTextColor || '#000000');
      setTextBg(!!initialTextBg);
      setTextBgColor(initialTextBgColor || '#ffffff');
      setImageUrl(initialImageUrl || '');
      setImageWidth(Number.isFinite(initialImageWidth) ? (initialImageWidth as number) : 0);
      setImageHeight(Number.isFinite(initialImageHeight) ? (initialImageHeight as number) : 0);
      setImageError('');
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
      setWifiCatalogSelectedId('');
      window.setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [
    initialDescription,
    initialLayerIds,
    initialName,
    initialScale,
    initialQuoteDashed,
    initialQuoteEndpoint,
    initialQuoteLabelPos,
    initialQuoteLabelScale,
    initialQuoteLabelBg,
    initialQuoteLabelColor,
    initialQuoteLabelOffset,
    initialQuoteColor,
    initialTextFont,
    initialTextSize,
    initialTextColor,
    initialTextBg,
    initialTextBgColor,
    initialImageUrl,
    initialImageWidth,
    initialImageHeight,
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

  const focusWifiSearch = useCallback(() => {
    const input = wifiCatalogSearchRef.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    input.select();
  }, []);

  useEffect(() => {
    if (!open || !wifiCatalogSearchOpen) return;
    focusWifiSearch();
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      focusWifiSearch();
      raf2 = requestAnimationFrame(() => focusWifiSearch());
    });
    const timeoutId = window.setTimeout(() => focusWifiSearch(), 80);
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      window.clearTimeout(timeoutId);
    };
  }, [focusWifiSearch, open, wifiCatalogSearchOpen]);

  useEffect(() => {
    if (!wifiCatalogSearchOpen) return;
    if (!filteredWifiCatalogModels.length) {
      setWifiCatalogSelectedId('');
      return;
    }
    const hasSelected = wifiCatalogSelectedId && filteredWifiCatalogModels.some((model) => model.id === wifiCatalogSelectedId);
    if (hasSelected) return;
    if (wifiCatalogId && filteredWifiCatalogModels.some((model) => model.id === wifiCatalogId)) {
      setWifiCatalogSelectedId(wifiCatalogId);
      return;
    }
    setWifiCatalogSelectedId(filteredWifiCatalogModels[0].id);
  }, [filteredWifiCatalogModels, wifiCatalogId, wifiCatalogSearchOpen, wifiCatalogSelectedId]);

  useEffect(() => {
    if (!wifiCatalogSearchOpen || !wifiCatalogSelectedId) return;
    const row = wifiCatalogRowsRef.current[wifiCatalogSelectedId];
    row?.scrollIntoView({ block: 'nearest' });
  }, [wifiCatalogSearchOpen, wifiCatalogSelectedId]);

  useEffect(() => {
    if (!open || !isImage) return;
    if (!imageUrl) return;
    if (imageWidth > 0 && imageHeight > 0) return;
    const img = new Image();
    img.onload = () => {
      const fitted = fitImageSize(img.width, img.height);
      setImageWidth(fitted.width);
      setImageHeight(fitted.height);
    };
    img.src = imageUrl;
  }, [imageHeight, imageUrl, imageWidth, isImage, open]);

  useEffect(() => {
    if (!open || !isWifi) return;
    if (wifiSource !== 'catalog') return;
    if (name.trim()) return;
    if (!wifiBrand || !wifiModel) return;
    setName(`${wifiBrand} ${wifiModel}`);
  }, [isWifi, name, open, wifiBrand, wifiModel, wifiSource]);

  useEffect(() => {
    if (!isQuote) return;
    if (quoteLabelOffsetTouched) return;
    setQuoteLabelOffset(defaultQuoteLabelOffset);
  }, [defaultQuoteLabelOffset, isQuote, quoteLabelOffsetTouched]);

  const closeWifiCatalogSearch = useCallback(() => {
    setWifiCatalogSearchOpen(false);
    setWifiCatalogQuery('');
    setWifiCatalogSelectedId('');
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

  const moveWifiCatalogSelection = useCallback(
    (delta: number) => {
      if (!filteredWifiCatalogModels.length) return;
      const currentIndex = filteredWifiCatalogModels.findIndex((model) => model.id === wifiCatalogSelectedId);
      const nextIndex =
        currentIndex === -1
          ? delta > 0
            ? 0
            : filteredWifiCatalogModels.length - 1
          : Math.max(0, Math.min(filteredWifiCatalogModels.length - 1, currentIndex + delta));
      const next = filteredWifiCatalogModels[nextIndex];
      if (next) setWifiCatalogSelectedId(next.id);
    },
    [filteredWifiCatalogModels, wifiCatalogSelectedId]
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
    if (type !== 'quote' && type !== 'image' && !name.trim()) return;
    if (isImage && !imageUrl) return;
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
    const safeName = name.trim();
    onSubmit({
      name: safeName,
      description: description.trim() || undefined,
      layerIds: isQuote ? undefined : (layerIds.length ? layerIds : undefined),
      customValues: customFields.length ? customValues : undefined,
      scale: Number.isFinite(scale) ? Math.max(0.2, Math.min(2.4, scale)) : undefined,
      quoteLabelScale: Number.isFinite(quoteLabelScale) ? Math.max(0.6, Math.min(2, quoteLabelScale)) : undefined,
      quoteLabelBg,
      quoteLabelColor,
      quoteLabelOffset: Number.isFinite(quoteLabelOffset) ? Math.max(0.5, Math.min(2, quoteLabelOffset)) : undefined,
      quoteLabelPos: quoteLabelPosEffective as any,
      quoteDashed,
      quoteEndpoint,
      strokeColor: quoteColor,
      ...(isText
        ? {
            textFont: textFont || undefined,
            textSize: Number.isFinite(textSize) ? Math.max(6, Math.min(96, Number(textSize))) : undefined,
            textColor: textColor || undefined,
            textBg: !!textBg,
            textBgColor: textBgColor || '#ffffff'
          }
        : {}),
      ...(isImage
        ? {
            imageUrl: imageUrl || undefined,
            imageWidth: Number.isFinite(imageWidth) && imageWidth > 0 ? imageWidth : undefined,
            imageHeight: Number.isFinite(imageHeight) && imageHeight > 0 ? imageHeight : undefined
          }
        : {}),
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
      <Transition show={open && !wifiCatalogSearchOpen} as={Fragment}>
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
                <Dialog.Panel className={`w-full ${isWifi ? 'max-w-4xl' : 'max-w-md'} modal-panel`}>
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
                      {isEdit
                        ? (isQuote ? t({ it: 'Modifica quota', en: 'Edit quote' }) : t({ it: 'Modifica oggetto', en: 'Edit object' }))
                        : (isQuote ? t({ it: 'Nuova quota', en: 'New quote' }) : t({ it: 'Nuovo oggetto', en: 'New object' }))}
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
                    {isPostIt
                      ? t({ it: 'Nota', en: 'Note' })
                      : isText || isImage
                        ? t({ it: 'Testo', en: 'Text' })
                      : isWifi
                        ? t({ it: 'Device Name', en: 'Device Name' })
                        : t({ it: 'Nome', en: 'Name' })}{' '}
                    {!isQuote && !isImage ? <span className="text-rose-600">*</span> : null}
                    {isText || isPostIt ? (
                      <textarea
                        ref={nameRef as any}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={
                          isPostIt
                            ? t({ it: 'Scrivi una nota...', en: 'Write a note...' })
                            : t({ it: 'Scrivi il testo...', en: 'Write your text...' })
                        }
                        rows={isPostIt ? 6 : 4}
                      />
                    ) : (
                      <input
                        ref={nameRef as any}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSave();
                          }
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={
                          isImage
                            ? t({ it: 'Es. Logo ufficio', en: 'e.g. Office logo' })
                            : t({ it: 'Es. Stampante HR', en: 'e.g. HR Printer' })
                        }
                      />
                    )}
                  </label>
                  {!isText && !isImage && !isPostIt ? (
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
                  ) : null}
                  {isText ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Stile testo', en: 'Text style' })}</div>
                      <div className="mt-3 grid gap-3">
                        <label className="text-xs font-semibold text-slate-600">
                          {t({ it: 'Font', en: 'Font' })}
                          <select
                            value={textFont}
                            disabled={readOnly}
                            onChange={(e) => setTextFont(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-700"
                          >
                            {TEXT_FONT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            {t({ it: 'Dimensione', en: 'Size' })}
                            <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">{Math.round(textSize)}</span>
                          </div>
                          <input
                            type="range"
                            min={8}
                            max={96}
                            step={1}
                            value={textSize}
                            disabled={readOnly}
                            onChange={(e) => setTextSize(Number(e.target.value))}
                            className="mt-1 w-full"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{t({ it: 'Colore testo', en: 'Text color' })}</span>
                          <input
                            type="color"
                            value={textColor}
                            disabled={readOnly}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="h-7 w-9 rounded border border-slate-200 bg-white"
                            title={t({ it: 'Colore testo', en: 'Text color' })}
                          />
                        </div>
                        <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{t({ it: 'Mostra background', en: 'Show background' })}</span>
                          <input
                            type="checkbox"
                            checked={textBg}
                            disabled={readOnly}
                            onChange={(e) => setTextBg(e.target.checked)}
                          />
                        </label>
                        {textBg ? (
                          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                            <span>{t({ it: 'Colore background', en: 'Background color' })}</span>
                            <input
                              type="color"
                              value={textBgColor}
                              disabled={readOnly}
                              onChange={(e) => setTextBgColor(e.target.value)}
                              className="h-7 w-9 rounded border border-slate-200 bg-white"
                              title={t({ it: 'Colore background', en: 'Background color' })}
                            />
                          </div>
                        ) : null}
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
                          <div className="text-xs font-semibold text-slate-600">{t({ it: 'Anteprima', en: 'Preview' })}</div>
                          <div className="mt-2">
                            <div
                              style={{
                                fontFamily: textFont,
                                fontSize: Math.max(10, Math.round(textSize)),
                                color: textColor,
                                background: textBg ? textBgColor : 'transparent',
                                padding: textBg ? '6px 8px' : '0px',
                                borderRadius: textBg ? 6 : 0,
                                display: 'inline-block',
                                whiteSpace: 'pre-wrap'
                              }}
                            >
                              {name.trim() ? name : t({ it: 'Anteprima testo', en: 'Text preview' })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {isPostIt ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-3">
                      <div className="text-sm font-semibold text-amber-900">{t({ it: 'Anteprima', en: 'Preview' })}</div>
                      <div className="mt-2 rounded-xl border border-amber-200 bg-[#fde68a] p-3 text-sm text-amber-900 shadow-sm">
                        <div className="whitespace-pre-wrap">
                          {name.trim() ? name : t({ it: 'Scrivi una nota...', en: 'Write a note...' })}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-amber-700">
                        {t({
                          it: 'La nota è visibile al passaggio del mouse o con il doppio click.',
                          en: 'The note is visible on hover or with double click.'
                        })}
                      </div>
                    </div>
                  ) : null}
                  {isImage ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/40 px-3 py-3">
                      <div className="text-sm font-semibold text-ink">{t({ it: 'Immagine', en: 'Image' })}</div>
                      <div className="mt-2 flex flex-col gap-2 text-xs text-slate-600">
                        <label
                          className={`relative inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold ${
                            readOnly ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {t({ it: 'Scegli file', en: 'Choose file' })}
                          <input
                            type="file"
                            accept={uploadMimes.images.join(',')}
                            disabled={readOnly}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const validation = validateFile(file, {
                                allowedTypes: uploadMimes.images,
                                maxBytes: uploadLimits.noteImageBytes
                              });
                              if (!validation.ok) {
                                setImageError(
                                  validation.reason === 'size'
                                    ? t({
                                        it: `Immagine troppo grande (max ${formatBytes(uploadLimits.noteImageBytes)}).`,
                                        en: `Image too large (max ${formatBytes(uploadLimits.noteImageBytes)}).`
                                      })
                                    : t({
                                        it: `Formato non supportato (JPG/PNG/WEBP/GIF).`,
                                        en: `Unsupported format (JPG/PNG/WEBP/GIF).`
                                      })
                                );
                                return;
                              }
                              setImageError('');
                              try {
                                const dataUrl = await readFileAsDataUrl(file);
                                const img = new Image();
                                img.onload = () => {
                                  const fitted = fitImageSize(img.width, img.height);
                                  setImageWidth(fitted.width);
                                  setImageHeight(fitted.height);
                                };
                                img.src = dataUrl;
                                setImageUrl(dataUrl);
                              } catch {
                                setImageError(t({ it: 'Caricamento immagine non riuscito.', en: 'Image upload failed.' }));
                              }
                            }}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                        </label>
                        <div className="text-[11px] text-slate-500">
                          {t({
                            it: `Formati accettati: JPG, PNG, WEBP, GIF (max ${formatBytes(uploadLimits.noteImageBytes)}).`,
                            en: `Accepted formats: JPG, PNG, WEBP, GIF (max ${formatBytes(uploadLimits.noteImageBytes)}).`
                          })}
                        </div>
                        {imageError ? (
                          <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{imageError}</div>
                        ) : null}
                        {imageUrl ? (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-2">
                            <img src={imageUrl} alt="" className="max-h-40 w-full rounded-md object-contain" />
                          </div>
                        ) : (
                          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-[11px] text-slate-400">
                            {t({ it: 'Nessuna immagine selezionata.', en: 'No image selected.' })}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
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
                      <div className="mt-3 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                        <div className="space-y-3">
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
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="text-sm font-medium text-slate-700">{t({ it: 'Bande', en: 'Bands' })}</div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
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
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            <span className="flex items-center justify-between gap-2">
                              <span>{t({ it: 'Copertura (m2)', en: 'Coverage (m2)' })}</span>
                              {wifiCoverageRadius && wifiCoverageDiameter ? (
                                <span className="text-xs text-slate-500">
                                  {t({
                                    it: `Raggio ${formatCoverage(wifiCoverageRadius)} m · Diametro ${formatCoverage(wifiCoverageDiameter)} m`,
                                    en: `Radius ${formatCoverage(wifiCoverageRadius)} m · Diameter ${formatCoverage(wifiCoverageDiameter)} m`
                                  })}
                                </span>
                              ) : null}
                            </span>
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
                    </div>
                  ) : null}
                  {!isQuote && !isText && !isImage && !isPostIt && layers.length ? (
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
                  {!isQuote && !isText && !isImage && !isPostIt ? (
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
                  ) : null}
                  {isQuote ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{t({ it: 'Opzioni quota', en: 'Quote options' })}</span>
                        {quoteLengthLabel ? (
                          <span className="text-xs font-mono text-slate-500">{quoteLengthLabel}</span>
                        ) : null}
                      </div>
                      <div className={`mt-3 ${quoteOrientation === 'vertical' ? 'flex gap-3' : 'grid gap-3'}`}>
                        <div className={quoteOrientation === 'vertical' ? 'grid flex-1 gap-3' : 'grid gap-3'}>
                          <div>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              {t({ it: 'Scala linea', en: 'Line scale' })}
                              <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">{scale.toFixed(2)}</span>
                            </div>
                            <input
                              type="range"
                              min={0.5}
                              max={1.6}
                              step={0.05}
                              value={scale}
                              disabled={readOnly}
                              onChange={(e) => setScale(Number(e.target.value))}
                              className="mt-1 w-full"
                            />
                          </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            {t({ it: 'Scala etichetta', en: 'Label scale' })}
                            <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">{quoteLabelScale.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0.6}
                            max={2}
                            step={0.05}
                            value={quoteLabelScale}
                            disabled={readOnly}
                            onChange={(e) => setQuoteLabelScale(Number(e.target.value))}
                            className="mt-1 w-full"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                            {t({ it: 'Distanza scritta', en: 'Label distance' })}
                            <span className="ml-auto text-xs font-mono text-slate-500 tabular-nums">{quoteLabelOffset.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={0.5}
                            max={2}
                            step={0.05}
                            value={quoteLabelOffset}
                            disabled={readOnly}
                            onChange={(e) => {
                              setQuoteLabelOffset(Number(e.target.value));
                              setQuoteLabelOffsetTouched(true);
                            }}
                            className="mt-1 w-full"
                          />
                        </div>
                        <label className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{t({ it: 'Background etichetta', en: 'Label background' })}</span>
                          <input
                            type="checkbox"
                              checked={quoteLabelBg}
                              disabled={readOnly}
                              onChange={(e) => setQuoteLabelBg(e.target.checked)}
                            />
                          </label>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">
                              {t({ it: 'Posizione scritta', en: 'Label position' })}
                            </label>
                            <select
                            value={quoteLabelPosEffective}
                            disabled={readOnly}
                            onChange={(e) => setQuoteLabelPos(e.target.value as any)}
                            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                          >
                              {quoteOrientation === 'vertical' ? (
                                <>
                                  <option value="left">{t({ it: 'Sinistra', en: 'Left' })}</option>
                                  <option value="center">{t({ it: 'Centro', en: 'Center' })}</option>
                                  <option value="right">{t({ it: 'Destra', en: 'Right' })}</option>
                                </>
                              ) : (
                                <>
                                  <option value="above">{t({ it: 'Sopra', en: 'Above' })}</option>
                                  <option value="center">{t({ it: 'Centro', en: 'Center' })}</option>
                                  <option value="below">{t({ it: 'Sotto', en: 'Below' })}</option>
                                </>
                              )}
                            </select>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <input
                                type="checkbox"
                                checked={quoteDashed}
                                disabled={readOnly}
                                onChange={(e) => setQuoteDashed(e.target.checked)}
                              />
                              {t({ it: 'Tratteggio', en: 'Dashed' })}
                            </label>
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                              <span>{t({ it: 'Apici', en: 'Endpoints' })}</span>
                              <select
                                value={quoteEndpoint}
                                disabled={readOnly}
                                onChange={(e) => setQuoteEndpoint(e.target.value as any)}
                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                              >
                                <option value="arrows">{t({ it: 'Frecce', en: 'Arrows' })}</option>
                                <option value="dots">{t({ it: 'Puntini', en: 'Dots' })}</option>
                                <option value="none">{t({ it: 'Nessuno', en: 'None' })}</option>
                              </select>
                            </div>
                          </div>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{t({ it: 'Colore linea', en: 'Line color' })}</span>
                          <input
                            type="color"
                            value={quoteColor}
                            disabled={readOnly}
                            onChange={(e) => setQuoteColor(e.target.value)}
                            className="h-7 w-9 rounded border border-slate-200 bg-white"
                            title={t({ it: 'Colore linea', en: 'Line color' })}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                          <span>{t({ it: 'Colore testo', en: 'Text color' })}</span>
                          <input
                            type="color"
                            value={quoteLabelColor}
                            disabled={readOnly}
                            onChange={(e) => setQuoteLabelColor(e.target.value)}
                            className="h-7 w-9 rounded border border-slate-200 bg-white"
                            title={t({ it: 'Colore testo', en: 'Text color' })}
                          />
                        </div>
                        </div>
                        {quoteOrientation === 'vertical' ? <div className="w-44">{quotePreview}</div> : quotePreview}
                          </div>
                        </div>
                  ) : null}

                  {!isText && !isImage && !isPostIt && customFields.length ? (
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
                  {isQuote && isEdit && onDelete ? (
                    <button
                      onClick={onDelete}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                      title={t({ it: 'Elimina quota', en: 'Delete quote' })}
                    >
                      {t({ it: 'Elimina quota', en: 'Delete quote' })}
                    </button>
                  ) : null}
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
      <Transition
        show={open && wifiCatalogSearchOpen}
        as={Fragment}
        afterEnter={focusWifiSearch}
      >
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
                  className="w-full max-w-4xl modal-panel"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">
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
                      autoFocus
                      value={wifiCatalogQuery}
                      onChange={(e) => setWifiCatalogQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          closeWifiCatalogSearch();
                          return;
                        }
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          moveWifiCatalogSelection(1);
                          return;
                        }
                        if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          moveWifiCatalogSelection(-1);
                          return;
                        }
                        if (e.key === 'Enter') {
                          if (selectedWifiCatalogModel) {
                            e.preventDefault();
                            handleSelectCatalogModel(selectedWifiCatalogModel);
                          } else if (filteredWifiCatalogModels.length) {
                            e.preventDefault();
                            handleSelectCatalogModel(filteredWifiCatalogModels[0]);
                          }
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
                    {t({
                      it: 'Usa su/giu e Invio per selezionare (o doppio click).',
                      en: 'Use up/down and Enter to select (or double click).'
                    })}
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
                        {filteredWifiCatalogModels.map((model) => {
                          const isSelected = wifiCatalogSelectedId === model.id;
                          return (
                            <tr
                              key={model.id}
                              ref={(el) => {
                                wifiCatalogRowsRef.current[model.id] = el;
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={() => setWifiCatalogSelectedId(model.id)}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSelectCatalogModel(model);
                              }}
                              aria-selected={isSelected}
                              className={`cursor-pointer border-t border-slate-100 ${isSelected ? 'bg-sky-100' : 'hover:bg-slate-50'}`}
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
                          );
                        })}
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
                    <span>{t({ it: 'Seleziona con Invio o "Seleziona".', en: 'Select with Enter or "Select".' })}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!selectedWifiCatalogModel && filteredWifiCatalogModels.length) {
                            handleSelectCatalogModel(filteredWifiCatalogModels[0]);
                            return;
                          }
                          if (selectedWifiCatalogModel) handleSelectCatalogModel(selectedWifiCatalogModel);
                        }}
                        disabled={!selectedWifiCatalogModel && !filteredWifiCatalogModels.length}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
                          selectedWifiCatalogModel || filteredWifiCatalogModels.length
                            ? 'border-primary bg-primary/10 text-primary hover:bg-primary/20'
                            : 'border-slate-200 bg-white text-slate-400'
                        }`}
                      >
                        {t({ it: 'Seleziona', en: 'Select' })}
                      </button>
                      <button
                        onClick={closeWifiCatalogSearch}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                      >
                        {t({ it: 'Chiudi', en: 'Close' })}
                      </button>
                    </div>
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
