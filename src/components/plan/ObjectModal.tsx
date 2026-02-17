import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ArrowUpDown, ExternalLink, FileText, History, Plus, Search, Trash2, X } from 'lucide-react';
import { IconName, MapObjectType, WifiAntennaModel } from '../../store/types';
import Icon from '../ui/Icon';
import { useT } from '../../i18n/useT';
import { useCustomFieldsStore } from '../../store/useCustomFieldsStore';
import { TEXT_FONT_OPTIONS, WIFI_DEFAULT_STANDARD, WIFI_RANGE_SCALE_MAX, WIFI_STANDARD_OPTIONS } from '../../store/data';
import { isSecurityTypeId } from '../../store/security';
import { formatBytes, readFileAsDataUrl, uploadLimits, uploadMimes, validateFile } from '../../utils/files';
import { isDeskType } from './deskTypes';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    name: string;
    description?: string;
    notes?: string;
    lastVerificationAt?: string;
    verifierCompany?: string;
    gpsCoords?: string;
    securityDocuments?: Array<{
      id: string;
      name: string;
      fileName?: string;
      dataUrl?: string;
      uploadedAt: string;
      validUntil?: string;
      notes?: string;
      archived?: boolean;
    }>;
    securityCheckHistory?: Array<{
      id: string;
      date?: string;
      company?: string;
      notes?: string;
      createdAt: number;
      archived?: boolean;
    }>;
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
    wifiRangeScale?: number;
    ip?: string;
    url?: string;
  }) => void;
  initialName?: string;
  initialDescription?: string;
  initialNotes?: string;
  initialLastVerificationAt?: string;
  initialVerifierCompany?: string;
  initialGpsCoords?: string;
  initialSecurityDocuments?: Array<{
    id: string;
    name: string;
    fileName?: string;
    dataUrl?: string;
    uploadedAt: string;
    validUntil?: string;
    notes?: string;
    archived?: boolean;
  }>;
  initialSecurityCheckHistory?: Array<{
    id: string;
    date?: string;
    company?: string;
    notes?: string;
    createdAt: number;
    archived?: boolean;
  }>;
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
  initialWifiRangeScale?: number;
  initialIp?: string;
  initialUrl?: string;
  wifiModels?: WifiAntennaModel[];
  existingRackObjects?: { id: string; name: string }[];
}

const normalizeRackName = (value: string) => value.trim().toLowerCase();
type SecurityDocsSortKey = 'name' | 'uploadedAt' | 'validUntil' | 'status';
const parseDateOnly = (value?: string) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const parseLatLngPair = (value: string): { lat: number; lng: number } | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const match = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const formatCoord = (value: number) => Number(value.toFixed(6)).toString();

const normalizeGoogleMapsCoordsInput = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const direct = parseLatLngPair(raw);
  if (direct) return `${formatCoord(direct.lat)}, ${formatCoord(direct.lng)}`;
  try {
    const url = new URL(raw);
    const candidates = [
      url.searchParams.get('q'),
      url.searchParams.get('query'),
      url.searchParams.get('ll'),
      url.searchParams.get('destination'),
      url.searchParams.get('daddr')
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      const parsed = parseLatLngPair(decodeURIComponent(String(candidate)));
      if (parsed) return `${formatCoord(parsed.lat)}, ${formatCoord(parsed.lng)}`;
    }
    const decodedPath = decodeURIComponent(String(url.pathname || ''));
    const atMatch = decodedPath.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (atMatch) {
      const parsed = parseLatLngPair(`${atMatch[1]},${atMatch[2]}`);
      if (parsed) return `${formatCoord(parsed.lat)}, ${formatCoord(parsed.lng)}`;
    }
  } catch {
    // Not a URL or not parseable as a Google Maps URL.
  }
  return raw;
};

const ObjectModal = ({
  open,
  onClose,
  onSubmit,
  initialName = '',
  initialDescription = '',
  initialNotes = '',
  initialLastVerificationAt = '',
  initialVerifierCompany = '',
  initialGpsCoords = '',
  initialSecurityDocuments = [],
  initialSecurityCheckHistory = [],
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
  initialWifiRangeScale,
  initialIp,
  initialUrl,
  wifiModels = [],
  existingRackObjects = []
}: Props) => {
  const t = useT();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [notes, setNotes] = useState(initialNotes);
  const [lastVerificationAt, setLastVerificationAt] = useState(initialLastVerificationAt);
  const [verifierCompany, setVerifierCompany] = useState(initialVerifierCompany);
  const [gpsCoords, setGpsCoords] = useState(initialGpsCoords);
  const [securityDocuments, setSecurityDocuments] = useState<
    Array<{ id: string; name: string; fileName?: string; dataUrl?: string; uploadedAt: string; validUntil?: string; notes?: string; archived?: boolean }>
  >(initialSecurityDocuments || []);
  const [securityCheckHistory, setSecurityCheckHistory] = useState<
    Array<{ id: string; date?: string; company?: string; notes?: string; createdAt: number; archived?: boolean }>
  >(initialSecurityCheckHistory || []);
  const [securityDocDraft, setSecurityDocDraft] = useState<{ name: string; validUntil: string; notes: string; archived: boolean; fileName?: string; dataUrl?: string }>(
    { name: '', validUntil: '', notes: '', archived: false }
  );
  const [securityCheckDraft, setSecurityCheckDraft] = useState<{ date: string; company: string; notes: string }>({
    date: '',
    company: '',
    notes: ''
  });
  const [securityError, setSecurityError] = useState('');
  const [securityDocumentsOpen, setSecurityDocumentsOpen] = useState(false);
  const [securityHistoryOpen, setSecurityHistoryOpen] = useState(false);
  const [securityDocsSearch, setSecurityDocsSearch] = useState('');
  const [securityDocsHideExpired, setSecurityDocsHideExpired] = useState(false);
  const [securityDocsSort, setSecurityDocsSort] = useState<{ key: SecurityDocsSortKey; dir: 'asc' | 'desc' }>({
    key: 'uploadedAt',
    dir: 'desc'
  });
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
  const [ipAddress, setIpAddress] = useState(initialIp || '');
  const [urlValue, setUrlValue] = useState(initialUrl || '');
  const [wifiBrand, setWifiBrand] = useState('');
  const [wifiModel, setWifiModel] = useState('');
  const [wifiModelCode, setWifiModelCode] = useState('');
  const [wifiCoverageSqm, setWifiCoverageSqm] = useState('');
  const [wifiShowRange, setWifiShowRange] = useState(true);
  const [wifiRangeScale, setWifiRangeScale] = useState<number>(1);
  const nameRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const wifiCatalogSearchRef = useRef<HTMLInputElement | null>(null);
  const wifiCatalogRowsRef = useRef<Record<string, HTMLTableRowElement | null>>({});
  const securityDocsFirstFieldRef = useRef<HTMLInputElement | null>(null);
  const securityDocsCloseRef = useRef<HTMLButtonElement | null>(null);
  const securityHistoryFirstFieldRef = useRef<HTMLInputElement | null>(null);
  const securityHistoryCloseRef = useRef<HTMLButtonElement | null>(null);
  const initSessionKeyRef = useRef('');
  const { hydrated, getFieldsForType, loadObjectValues } = useCustomFieldsStore();
  const isWifi = type === 'wifi';
  const isQuote = type === 'quote';
  const isText = type === 'text';
  const isImage = type === 'image';
  const isPhoto = type === 'photo';
  const isImageLike = isImage || isPhoto;
  const isPostIt = type === 'postit';
  const isSecurityType = isSecurityTypeId(type);
  const isAssemblyPoint = type === 'safety_assembly_point';
  const isDesk = type ? isDeskType(type) : false;
  const isWall = typeof type === 'string' && String(type).startsWith('wall_');
  const canHaveNetworkFields =
    !!type &&
    !isSecurityType &&
    !isQuote &&
    !isText &&
    !isImageLike &&
    !isPostIt &&
    !isDesk &&
    !isWall &&
    type !== 'user' &&
    type !== 'real_user';
  const ipIsValid = useMemo(() => {
    const raw = ipAddress.trim();
    if (!raw) return true;
    const parts = raw.split('.');
    if (parts.length !== 4) return false;
    return parts.every((part) => {
      if (!part || !/^\d+$/.test(part)) return false;
      const value = Number(part);
      return Number.isInteger(value) && value >= 0 && value <= 255;
    });
  }, [ipAddress]);
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
  const isRack = type === 'rack';
  const rackNameCandidate = (name || '').trim();
  const rackNameKey = rackNameCandidate ? normalizeRackName(rackNameCandidate) : '';
  const duplicateRackName = useMemo(() => {
    if (!isRack || !rackNameKey) return false;
    for (const entry of existingRackObjects) {
      if (!entry?.name || entry.id === objectId) continue;
      if (normalizeRackName(entry.name) === rackNameKey) return true;
    }
    return false;
  }, [existingRackObjects, isRack, objectId, rackNameKey]);
  const rackNameInputClass = isRack
    ? rackNameKey
      ? duplicateRackName
        ? 'border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-200'
        : 'border-emerald-200 bg-emerald-50 text-slate-800 focus:ring-emerald-200'
      : 'border-slate-200'
    : 'border-slate-200';
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
  const wifiEffectiveRadius = wifiCoverageRadius ? wifiCoverageRadius * (Number.isFinite(wifiRangeScale) ? wifiRangeScale : 1) : null;
  const wifiEffectiveDiameter = wifiEffectiveRadius ? wifiEffectiveRadius * 2 : null;
  const wifiCoverageAreaSqm = wifiCoverageValue;
  const wifiEffectiveAreaSqm =
    wifiCoverageAreaSqm && Number.isFinite(wifiRangeScale) ? wifiCoverageAreaSqm * Math.pow(wifiRangeScale, 2) : null;
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
    if (type !== 'quote' && type !== 'image' && type !== 'photo' && !name.trim()) return false;
    if (isImageLike && !imageUrl) return false;
    if (isRack && duplicateRackName) return false;
    if (canHaveNetworkFields && !ipIsValid) return false;
    return wifiFormValid;
  }, [canHaveNetworkFields, duplicateRackName, imageUrl, ipIsValid, isImageLike, isRack, name, readOnly, type, wifiFormValid]);
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
    if (!open) {
      initSessionKeyRef.current = '';
      return;
    }
    const sessionKey = `${String(objectId || 'create')}::${String(type || '')}`;
    if (initSessionKeyRef.current === sessionKey) return;
    initSessionKeyRef.current = sessionKey;
    setName(initialName);
    setDescription(initialDescription);
    setNotes(initialNotes || '');
    setLastVerificationAt(initialLastVerificationAt || '');
    setVerifierCompany(initialVerifierCompany || '');
    setGpsCoords(initialGpsCoords || '');
    setSecurityDocuments(Array.isArray(initialSecurityDocuments) ? initialSecurityDocuments : []);
    setSecurityCheckHistory(Array.isArray(initialSecurityCheckHistory) ? initialSecurityCheckHistory : []);
    setSecurityDocDraft({ name: '', validUntil: '', notes: '', archived: false });
    setSecurityCheckDraft({ date: '', company: '', notes: '' });
    setSecurityError('');
    setSecurityDocumentsOpen(false);
    setSecurityHistoryOpen(false);
    setSecurityDocsSearch('');
    setSecurityDocsHideExpired(false);
    setSecurityDocsSort({ key: 'uploadedAt', dir: 'desc' });
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
    setWifiRangeScale(
      Number.isFinite(initialWifiRangeScale as number)
        ? Math.max(0, Math.min(WIFI_RANGE_SCALE_MAX, Number(initialWifiRangeScale)))
        : 1
    );
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
    setIpAddress(initialIp || '');
    setUrlValue(initialUrl || '');
    window.setTimeout(() => nameRef.current?.focus(), 0);
  }, [
    initialDescription,
    initialGpsCoords,
    initialLastVerificationAt,
    initialLayerIds,
    initialName,
    initialNotes,
    initialSecurityCheckHistory,
    initialSecurityDocuments,
    initialVerifierCompany,
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
    initialWifiRangeScale,
    initialIp,
    initialUrl,
    objectId,
    type,
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
    if (!open || !isImageLike) return;
    if (!imageUrl) return;
    if (imageWidth > 0 && imageHeight > 0) return;
    const img = new Image();
    img.onload = () => {
      const fitted = fitImageSize(img.width, img.height);
      setImageWidth(fitted.width);
      setImageHeight(fitted.height);
    };
    img.src = imageUrl;
  }, [imageHeight, imageUrl, imageWidth, isImageLike, open]);

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
    if (wifiCatalogSearchOpen || securityDocumentsOpen || securityHistoryOpen) return;
    onClose();
  }, [onClose, securityDocumentsOpen, securityHistoryOpen, wifiCatalogSearchOpen]);

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

  const buildEntryId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const handleAttachSecurityDocument = async (fileList: FileList | null) => {
    if (!fileList?.[0]) return;
    const file = fileList[0];
    const validation = validateFile(file, {
      allowedTypes: uploadMimes.pdf,
      maxBytes: uploadLimits.pdfBytes
    });
    if (!validation.ok) {
      setSecurityError(
        validation.reason === 'size'
          ? t({
              it: `File troppo grande (max ${formatBytes(uploadLimits.pdfBytes)}).`,
              en: `File too large (max ${formatBytes(uploadLimits.pdfBytes)}).`
            })
          : t({
              it: 'Formato non supportato. Usa PDF.',
              en: 'Unsupported format. Use PDF.'
            })
      );
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setSecurityDocDraft((prev) => ({ ...prev, fileName: file.name, dataUrl }));
      setSecurityError('');
    } catch {
      setSecurityError(t({ it: 'Upload non riuscito.', en: 'Upload failed.' }));
    }
  };

  const addSecurityDocumentDraft = () => {
    const title = securityDocDraft.name.trim();
    if (!title) {
      setSecurityError(t({ it: 'Inserisci il nome del documento.', en: 'Enter a document name.' }));
      return;
    }
    setSecurityDocuments((prev) => [
      ...prev,
      {
        id: buildEntryId(),
        name: title,
        fileName: securityDocDraft.fileName || undefined,
        dataUrl: securityDocDraft.dataUrl || undefined,
        uploadedAt: new Date().toISOString(),
        validUntil: securityDocDraft.validUntil.trim() || undefined,
        notes: securityDocDraft.notes.trim() || undefined,
        archived: !!securityDocDraft.archived
      }
    ]);
    setSecurityDocDraft({ name: '', validUntil: '', notes: '', archived: false });
    setSecurityError('');
  };

  const removeSecurityDocument = (id: string) => {
    setSecurityDocuments((prev) => prev.filter((entry) => entry.id !== id));
  };
  const toggleSecurityDocumentValidity = (id: string, valid: boolean) => {
    setSecurityDocuments((prev) => prev.map((entry) => (entry.id === id ? { ...entry, archived: !valid } : entry)));
  };
  const getDocumentStatus = useCallback((doc: { archived?: boolean; validUntil?: string }): 'archived' | 'expired' | 'warning' | 'ok' | 'none' => {
    if (doc.archived) return 'archived';
    const due = parseDateOnly(doc.validUntil);
    if (!due) return 'none';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (due.getTime() < today.getTime()) return 'expired';
    const warnLimit = new Date(today);
    warnLimit.setMonth(warnLimit.getMonth() + 1);
    if (due.getTime() <= warnLimit.getTime()) return 'warning';
    return 'ok';
  }, []);
  const toggleSecurityDocsSort = (key: SecurityDocsSortKey) => {
    setSecurityDocsSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      const defaultDir = key === 'name' || key === 'status' ? 'asc' : 'desc';
      return { key, dir: defaultDir };
    });
  };
  const securityDocumentsRows = useMemo(() => {
    const q = securityDocsSearch.trim().toLowerCase();
    const base = securityDocuments.filter((doc) => {
      if (securityDocsHideExpired && getDocumentStatus(doc) === 'expired') return false;
      if (!q) return true;
      const hay = `${doc.name || ''} ${doc.fileName || ''} ${doc.notes || ''}`.toLowerCase();
      return hay.includes(q);
    });
    const statusRank: Record<ReturnType<typeof getDocumentStatus>, number> = {
      ok: 0,
      warning: 1,
      expired: 2,
      none: 3,
      archived: 4
    };
    const dateMs = (value?: string) => parseDateOnly(value)?.getTime() || 0;
    const sorted = base.slice().sort((a, b) => {
      let cmp = 0;
      switch (securityDocsSort.key) {
        case 'name':
          cmp = `${a.name || ''}`.localeCompare(`${b.name || ''}`);
          break;
        case 'uploadedAt':
          cmp = (new Date(a.uploadedAt || 0).getTime() || 0) - (new Date(b.uploadedAt || 0).getTime() || 0);
          break;
        case 'validUntil':
          cmp = dateMs(a.validUntil) - dateMs(b.validUntil);
          break;
        case 'status':
          cmp = statusRank[getDocumentStatus(a)] - statusRank[getDocumentStatus(b)];
          break;
      }
      if (cmp === 0) cmp = `${a.name || ''}`.localeCompare(`${b.name || ''}`);
      return securityDocsSort.dir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [getDocumentStatus, securityDocsHideExpired, securityDocsSearch, securityDocsSort.dir, securityDocsSort.key, securityDocuments]);

  const createNewSecurityVerification = () => {
    if (readOnly) return;
    const currentDate = lastVerificationAt.trim();
    const currentCompany = verifierCompany.trim();
    if (currentDate || currentCompany) {
      setSecurityCheckHistory((prev) => [
        {
          id: buildEntryId(),
          date: currentDate || undefined,
          company: currentCompany || undefined,
          createdAt: Date.now(),
          archived: true
        },
        ...prev
      ]);
    }
    setLastVerificationAt('');
    setVerifierCompany('');
    setSecurityError('');
  };

  const addSecurityCheckDraft = () => {
    const company = securityCheckDraft.company.trim();
    const date = securityCheckDraft.date.trim();
    const notesValue = securityCheckDraft.notes.trim();
    if (!company && !date && !notesValue) return;
    setSecurityCheckHistory((prev) => [
      ...prev,
      {
        id: buildEntryId(),
        date: date || undefined,
        company: company || undefined,
        notes: notesValue || undefined,
        createdAt: Date.now(),
        archived: true
      }
    ]);
    setSecurityCheckDraft({ date: '', company: '', notes: '' });
  };

  const removeSecurityCheck = (id: string) => {
    setSecurityCheckHistory((prev) => prev.filter((entry) => entry.id !== id));
  };

  const handleSave = () => {
    if (type !== 'quote' && type !== 'image' && type !== 'photo' && !name.trim()) return;
    if (isImageLike && !imageUrl) return;
    if (isRack && duplicateRackName) {
      nameRef.current?.focus();
      return;
    }
    if (canHaveNetworkFields && !ipIsValid) {
      return;
    }
    if (isSecurityType && !name.trim()) return;
    const trimmedIp = ipAddress.trim();
    const trimmedUrl = urlValue.trim();
    const normalizedGpsCoords = normalizeGoogleMapsCoordsInput(gpsCoords);
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
      ...(isSecurityType
        ? {
            notes: notes.trim() || undefined,
            lastVerificationAt: lastVerificationAt.trim() || undefined,
            verifierCompany: verifierCompany.trim() || undefined,
            gpsCoords: normalizedGpsCoords || undefined,
            securityDocuments,
            securityCheckHistory
          }
        : {}),
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
      ...(canHaveNetworkFields
        ? {
            ip: trimmedIp,
            url: trimmedUrl
          }
        : {}),
      ...(isImageLike
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
	            wifiShowRange,
	            wifiRangeScale: Number.isFinite(wifiRangeScale) ? Math.max(0, Math.min(WIFI_RANGE_SCALE_MAX, wifiRangeScale)) : 1
	          }
	        : {})
	    });
    onClose();
  };
  const getDocumentStatusMeta = (doc: { archived?: boolean; validUntil?: string }) => {
    const status = getDocumentStatus(doc);
    if (status === 'archived') {
      return {
        status,
        label: t({ it: 'Archivio', en: 'Archived' }),
        className: 'border-slate-300 bg-slate-200 text-slate-700'
      };
    }
    if (status === 'expired') {
      return {
        status,
        label: t({ it: 'Scaduto', en: 'Expired' }),
        className: 'border-rose-200 bg-rose-100 text-rose-700'
      };
    }
    if (status === 'warning') {
      return {
        status,
        label: t({ it: 'In scadenza', en: 'Expiring soon' }),
        className: 'border-amber-200 bg-amber-100 text-amber-800'
      };
    }
    if (status === 'ok') {
      return {
        status,
        label: t({ it: 'Valido', en: 'Valid' }),
        className: 'border-emerald-200 bg-emerald-100 text-emerald-700'
      };
    }
    return {
      status,
      label: t({ it: 'Senza scadenza', en: 'No expiry' }),
      className: 'border-slate-200 bg-slate-100 text-slate-700'
    };
  };

  return (
    <Fragment>
      <Transition show={open && !wifiCatalogSearchOpen && !securityDocumentsOpen && !securityHistoryOpen} as={Fragment}>
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
                <Dialog.Panel className={`w-full ${isWifi ? 'max-w-4xl' : isSecurityType ? 'max-w-5xl' : 'max-w-md'} modal-panel`}>
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
                  <div className={`mt-4 ${isSecurityType ? 'grid auto-rows-min gap-3 lg:grid-cols-2' : 'space-y-3'}`}>
                  <label className={`block text-sm font-medium text-slate-700 ${isSecurityType ? 'lg:col-span-2' : ''}`}>
                    {isPostIt
                      ? t({ it: 'Nota', en: 'Note' })
                      : isText || isImage
                        ? t({ it: 'Testo', en: 'Text' })
                      : isWifi
                        ? t({ it: 'Device Name', en: 'Device Name' })
                        : t({ it: 'Nome', en: 'Name' })}{' '}
                    {!isQuote && !isImage && !isPhoto ? <span className="text-rose-600">*</span> : null}
                    {isText || isPostIt ? (
                      <textarea
                        ref={nameRef as any}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 ${rackNameInputClass}`}
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
                        className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 ${rackNameInputClass}`}
                        placeholder={
                          isImage
                            ? t({ it: 'Es. Logo ufficio', en: 'e.g. Office logo' })
                            : isPhoto
                              ? t({ it: 'Es. Foto sala riunioni', en: 'e.g. Meeting room photo' })
                              : t({ it: 'Es. Stampante HR', en: 'e.g. HR Printer' })
                        }
                      />
                    )}
                    {isRack && duplicateRackName ? (
                      <div className="mt-1 text-xs font-semibold text-rose-600">
                        {t({
                          it: 'Esiste già un rack con questo nome nella planimetria. Scegli un nome diverso.',
                          en: 'A rack with this name already exists in this floor plan. Choose a different name.'
                        })}
                      </div>
                    ) : null}
                  </label>
                  {!isText && !isImage && !isPostIt ? (
                    <label className={`block text-sm font-medium text-slate-700 ${isSecurityType ? 'lg:col-span-2' : ''}`}>
                      {t({ it: 'Descrizione', en: 'Description' })}
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Facoltativa', en: 'Optional' })}
                        rows={isSecurityType ? 2 : 3}
                      />
                    </label>
                  ) : null}
                  {isSecurityType ? (
                    <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
                      {t({ it: 'Note', en: 'Notes' })}
                      <textarea
                        value={notes}
                        disabled={readOnly}
                        onChange={(e) => setNotes(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        rows={2}
                        placeholder={t({ it: 'Informazioni operative', en: 'Operational notes' })}
                      />
                    </label>
                  ) : null}
                  {isAssemblyPoint ? (
                    <label className="block text-sm font-medium text-slate-700 lg:col-span-2">
                      {t({ it: 'Coordinate Google Maps', en: 'Google Maps coordinates' })}
                      <input
                        value={gpsCoords}
                        disabled={readOnly}
                        onChange={(e) => setGpsCoords(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        placeholder={t({ it: 'Es. 41.9028, 12.4964 o URL Google Maps', en: 'e.g. 41.9028, 12.4964 or Google Maps URL' })}
                      />
                    </label>
                  ) : null}
                  {isSecurityType ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/40 px-3 py-3 lg:col-span-2">
                      <div className="text-sm font-semibold text-rose-900">{t({ it: 'Scheda sicurezza', en: 'Safety sheet' })}</div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Ultima verifica', en: 'Last check' })}
                          <input
                            type="date"
                            value={lastVerificationAt}
                            disabled={readOnly}
                            onChange={(e) => setLastVerificationAt(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Azienda verifica', en: 'Verifier company' })}
                          <input
                            value={verifierCompany}
                            disabled={readOnly}
                            onChange={(e) => setVerifierCompany(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Es. Safety Srl', en: 'e.g. Safety Ltd' })}
                          />
                        </label>
                        {!isAssemblyPoint ? (
                          <label className="block text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-1">
                            {t({ it: 'Coordinate GPS oggetto', en: 'Object GPS coordinates' })}
                            <input
                              value={gpsCoords}
                              disabled={readOnly}
                              onChange={(e) => setGpsCoords(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              placeholder={t({ it: 'Es. 41.9028, 12.4964', en: 'e.g. 41.9028, 12.4964' })}
                            />
                          </label>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={createNewSecurityVerification}
                          className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={14} />
                          {t({ it: 'Nuova verifica (archivia attuale)', en: 'New check (archive current)' })}
                        </button>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setSecurityDocumentsOpen(true)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <FileText size={15} />
                          {t({
                            it: `Gestisci documenti (${securityDocuments.length})`,
                            en: `Manage documents (${securityDocuments.length})`
                          })}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSecurityHistoryOpen(true)}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <History size={15} />
                          {t({
                            it: `Storico verifiche (${securityCheckHistory.length})`,
                            en: `Check history (${securityCheckHistory.length})`
                          })}
                        </button>
                      </div>
                      <div className="mt-2 text-xs text-slate-500">
                        {t({
                          it: 'Documenti e storico sono gestiti in modali dedicate.',
                          en: 'Documents and history are managed in dedicated modals.'
                        })}
                      </div>
                      {securityError ? (
                        <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{securityError}</div>
                      ) : null}
                    </div>
                  ) : null}
                  {canHaveNetworkFields ? (
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'IP', en: 'IP address' })}
                        <input
                          value={ipAddress}
                          onChange={(e) => setIpAddress(e.target.value)}
                          className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 ${
                            ipIsValid ? 'border-slate-200' : 'border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-200'
                          }`}
                          placeholder={t({ it: 'Es. 192.168.1.10', en: 'e.g. 192.168.1.10' })}
                        />
                        {!ipIsValid ? (
                          <div className="mt-1 text-xs font-semibold text-rose-600">
                            {t({ it: 'Formato IP non valido.', en: 'Invalid IP format.' })}
                          </div>
                        ) : null}
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'URL', en: 'URL' })}
                        <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30">
                          <input
                            value={urlValue}
                            onChange={(e) => setUrlValue(e.target.value)}
                            className="w-full bg-transparent text-sm outline-none"
                            placeholder={t({ it: 'Es. https://device.local', en: 'e.g. https://device.local' })}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const raw = urlValue.trim();
                              if (!raw) return;
                              const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
                              window.open(normalized, '_blank', 'noopener,noreferrer');
                            }}
                            disabled={!urlValue.trim()}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                            title={t({ it: 'Apri URL', en: 'Open URL' })}
                          >
                            <ExternalLink size={14} />
                          </button>
                        </div>
                      </label>
                    </div>
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
                  {isImageLike ? (
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
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
                              <span>{t({ it: 'Range (moltiplicatore)', en: 'Range (multiplier)' })}</span>
                              <span className="tabular-nums text-slate-700">x{(Number(wifiRangeScale) || 0).toFixed(2)}</span>
                            </div>
	                            <input
	                              type="range"
	                              min={0}
	                              max={WIFI_RANGE_SCALE_MAX}
	                              step={0.05}
	                              value={wifiRangeScale}
	                              disabled={readOnly}
	                              onChange={(e) => setWifiRangeScale(Number(e.target.value))}
	                              className="mt-1 w-full"
	                            />
	                            {wifiCoverageRadius &&
	                            wifiCoverageDiameter &&
	                            wifiCoverageAreaSqm &&
	                            wifiEffectiveRadius &&
	                            wifiEffectiveDiameter &&
	                            wifiEffectiveAreaSqm ? (
	                              <div className="mt-1 text-xs text-slate-500">
	                                <div>
	                                  {t({
	                                    it: `Base: r ${formatCoverage(wifiCoverageRadius)} m · d ${formatCoverage(
	                                      wifiCoverageDiameter
	                                    )} m · area ${formatCoverage(wifiCoverageAreaSqm)} m2`,
	                                    en: `Base: r ${formatCoverage(wifiCoverageRadius)} m · d ${formatCoverage(
	                                      wifiCoverageDiameter
	                                    )} m · area ${formatCoverage(wifiCoverageAreaSqm)} m2`
	                                  })}
	                                </div>
	                                <div>
	                                  {t({
	                                    it: `Esteso: r ${formatCoverage(wifiEffectiveRadius)} m · d ${formatCoverage(
	                                      wifiEffectiveDiameter
	                                    )} m · area ${formatCoverage(wifiEffectiveAreaSqm)} m2 (max r ${formatCoverage(
	                                      wifiCoverageRadius * WIFI_RANGE_SCALE_MAX
	                                    )} m)`,
	                                    en: `Extended: r ${formatCoverage(wifiEffectiveRadius)} m · d ${formatCoverage(
	                                      wifiEffectiveDiameter
	                                    )} m · area ${formatCoverage(wifiEffectiveAreaSqm)} m2 (max r ${formatCoverage(
	                                      wifiCoverageRadius * WIFI_RANGE_SCALE_MAX
	                                    )} m)`
	                                  })}
	                                </div>
	                              </div>
	                            ) : (
	                              <div className="mt-1 text-xs text-slate-500">
	                                {t({ it: 'Imposta la copertura per calcolare il raggio.', en: 'Set coverage to compute radius.' })}
	                              </div>
	                            )}
                          </div>
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
                  {!isQuote && !isText && !isImageLike && !isPostIt && !isSecurityType && layers.length ? (
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
                  {!isQuote && !isText && !isImageLike && !isPostIt ? (
                    <div className={isSecurityType ? 'lg:col-span-2' : ''}>
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

                  {!isText && !isImageLike && !isPostIt && customFields.length ? (
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
      <Transition show={open && isSecurityType && securityDocumentsOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" initialFocus={securityDocsCloseRef} onClose={() => setSecurityDocumentsOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-6xl modal-panel" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Documenti sicurezza', en: 'Safety documents' })}</Dialog.Title>
                    <button
                      ref={securityDocsCloseRef}
                      onClick={() => setSecurityDocumentsOpen(false)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.4fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Nuovo documento', en: 'New document' })}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <input
                          ref={securityDocsFirstFieldRef}
                          value={securityDocDraft.name}
                          disabled={readOnly}
                          onChange={(e) => setSecurityDocDraft((prev) => ({ ...prev, name: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2 sm:col-span-2"
                          placeholder={t({ it: 'Nome documento*', en: 'Document name*' })}
                        />
                        <label className="text-xs font-medium text-slate-600">
                          {t({ it: 'Scadenza documento', en: 'Document expiry' })}
                          <input
                            type="date"
                            value={securityDocDraft.validUntil}
                            disabled={readOnly}
                            onChange={(e) => setSecurityDocDraft((prev) => ({ ...prev, validUntil: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t({ it: 'Validità', en: 'Validity' })}
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={!securityDocDraft.archived}
                              disabled={readOnly}
                              onClick={() => setSecurityDocDraft((prev) => ({ ...prev, archived: !prev.archived }))}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                !securityDocDraft.archived ? 'bg-emerald-500' : 'bg-slate-400'
                              } disabled:cursor-not-allowed disabled:opacity-60`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                  !securityDocDraft.archived ? 'translate-x-5' : 'translate-x-1'
                                }`}
                              />
                            </button>
                            <span className={`text-xs font-semibold ${!securityDocDraft.archived ? 'text-emerald-700' : 'text-slate-600'}`}>
                              {!securityDocDraft.archived
                                ? t({ it: 'Valido', en: 'Valid' })
                                : t({ it: 'Archiviato', en: 'Archived' })}
                            </span>
                          </div>
                        </div>
                        <textarea
                          value={securityDocDraft.notes}
                          disabled={readOnly}
                          onChange={(e) => setSecurityDocDraft((prev) => ({ ...prev, notes: e.target.value }))}
                          className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          rows={3}
                          placeholder={t({ it: 'Note documento', en: 'Document notes' })}
                        />
                        <label
                          className={`relative inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold ${
                            readOnly
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                              : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {securityDocDraft.fileName
                            ? t({ it: `File: ${securityDocDraft.fileName}`, en: `File: ${securityDocDraft.fileName}` })
                            : t({ it: 'Carica PDF', en: 'Upload PDF' })}
                          <input
                            type="file"
                            accept={uploadMimes.pdf.join(',')}
                            disabled={readOnly}
                            onChange={(e) => {
                              void handleAttachSecurityDocument(e.target.files);
                              e.currentTarget.value = '';
                            }}
                            className="absolute inset-0 cursor-pointer opacity-0"
                          />
                        </label>
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={addSecurityDocumentDraft}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={14} />
                          {t({ it: 'Aggiungi documento', en: 'Add document' })}
                        </button>
                      </div>
                      <div className="mt-2 text-[11px] text-slate-500">
                        {t({
                          it: `Formato accettato: PDF (max ${formatBytes(uploadLimits.pdfBytes)}).`,
                          en: `Accepted format: PDF (max ${formatBytes(uploadLimits.pdfBytes)}).`
                        })}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Tabella documenti', en: 'Documents table' })}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <label className="relative min-w-[220px] flex-1">
                          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            value={securityDocsSearch}
                            onChange={(e) => setSecurityDocsSearch(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Cerca documento...', en: 'Search document...' })}
                          />
                        </label>
                        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
                          <input
                            type="checkbox"
                            checked={securityDocsHideExpired}
                            onChange={(e) => setSecurityDocsHideExpired(e.target.checked)}
                          />
                          {t({ it: 'Nascondi scaduti', en: 'Hide expired' })}
                        </label>
                      </div>
                      <div className="mt-2 max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                              {([
                                ['name', t({ it: 'Nome', en: 'Name' })],
                                ['uploadedAt', t({ it: 'Upload', en: 'Upload' })],
                                ['validUntil', t({ it: 'Scadenza', en: 'Expiry' })],
                                ['status', t({ it: 'Stato', en: 'Status' })]
                              ] as Array<[SecurityDocsSortKey, string]>).map(([key, label]) => (
                                <th key={key} className="px-2 py-2">
                                  <button
                                    type="button"
                                    onClick={() => toggleSecurityDocsSort(key)}
                                    className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
                                  >
                                    {label}
                                    <ArrowUpDown size={12} className={securityDocsSort.key === key ? 'text-primary' : 'text-slate-400'} />
                                  </button>
                                </th>
                              ))}
                              <th className="px-2 py-2">{t({ it: 'Validità', en: 'Validity' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Azioni', en: 'Actions' })}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {securityDocumentsRows.length ? (
                              securityDocumentsRows.map((doc) => {
                                const statusMeta = getDocumentStatusMeta(doc);
                                return (
                                  <tr key={doc.id} className={`border-t border-slate-100 ${doc.archived ? 'bg-slate-100 text-slate-500' : ''}`}>
                                    <td className="px-2 py-2">
                                      <div className="font-semibold text-slate-800">{doc.name}</div>
                                      <div className="text-[11px] text-slate-500">{doc.fileName || 'PDF'}</div>
                                    </td>
                                    <td className="px-2 py-2 text-slate-600">
                                      {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-2 py-2 text-slate-700">{doc.validUntil || '—'}</td>
                                    <td className="px-2 py-2">
                                      <span className={`inline-flex rounded-full border px-2 py-0.5 font-semibold ${statusMeta.className}`}>
                                        {statusMeta.label}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={!doc.archived}
                                          disabled={readOnly}
                                          onClick={() => toggleSecurityDocumentValidity(doc.id, !!doc.archived)}
                                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                                            !doc.archived ? 'bg-emerald-500' : 'bg-slate-400'
                                          } disabled:cursor-not-allowed disabled:opacity-60`}
                                        >
                                          <span
                                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                              !doc.archived ? 'translate-x-5' : 'translate-x-1'
                                            }`}
                                          />
                                        </button>
                                        <span className={`text-[11px] font-semibold ${!doc.archived ? 'text-emerald-700' : 'text-slate-600'}`}>
                                          {!doc.archived ? t({ it: 'Valido', en: 'Valid' }) : t({ it: 'Archiviato', en: 'Archived' })}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-2 py-2">
                                      {!readOnly ? (
                                        <button
                                          type="button"
                                          onClick={() => removeSecurityDocument(doc.id)}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                          title={t({ it: 'Rimuovi', en: 'Remove' })}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                                  {t({ it: 'Nessun documento trovato con i filtri correnti.', en: 'No documents found with current filters.' })}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  {securityError ? (
                    <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{securityError}</div>
                  ) : null}
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setSecurityDocumentsOpen(false)}
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
      <Transition show={open && isSecurityType && securityHistoryOpen} as={Fragment}>
        <Dialog as="div" className="relative z-[60]" initialFocus={securityHistoryCloseRef} onClose={() => setSecurityHistoryOpen(false)}>
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
                <Dialog.Panel className="w-full max-w-5xl modal-panel" onMouseDown={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <Dialog.Title className="modal-title">{t({ it: 'Storico modifiche/verifiche', en: 'Checks/changes history' })}</Dialog.Title>
                    <button
                      ref={securityHistoryCloseRef}
                      onClick={() => setSecurityHistoryOpen(false)}
                      className="text-slate-500 hover:text-ink"
                      title={t({ it: 'Chiudi', en: 'Close' })}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Nuova voce', en: 'New entry' })}
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="text-xs font-medium text-slate-600">
                          {t({ it: 'Data verifica', en: 'Check date' })}
                          <input
                            ref={securityHistoryFirstFieldRef}
                            type="date"
                            value={securityCheckDraft.date}
                            disabled={readOnly}
                            onChange={(e) => setSecurityCheckDraft((prev) => ({ ...prev, date: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                        <label className="text-xs font-medium text-slate-600">
                          {t({ it: 'Azienda', en: 'Company' })}
                          <input
                            value={securityCheckDraft.company}
                            disabled={readOnly}
                            onChange={(e) => setSecurityCheckDraft((prev) => ({ ...prev, company: e.target.value }))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            placeholder={t({ it: 'Azienda', en: 'Company' })}
                          />
                        </label>
                        <textarea
                          value={securityCheckDraft.notes}
                          disabled={readOnly}
                          onChange={(e) => setSecurityCheckDraft((prev) => ({ ...prev, notes: e.target.value }))}
                          className="sm:col-span-2 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          rows={3}
                          placeholder={t({ it: 'Note verifica', en: 'Check notes' })}
                        />
                        <button
                          type="button"
                          disabled={readOnly}
                          onClick={addSecurityCheckDraft}
                          className="sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Plus size={14} />
                          {t({ it: 'Aggiungi verifica', en: 'Add check' })}
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t({ it: 'Storico', en: 'History' })}
                      </div>
                      <div className="mt-2 max-h-[52vh] overflow-auto rounded-lg border border-slate-200">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-2 py-2">{t({ it: 'Data', en: 'Date' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Azienda', en: 'Company' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Note', en: 'Notes' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Creato', en: 'Created' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Stato', en: 'Status' })}</th>
                              <th className="px-2 py-2">{t({ it: 'Azioni', en: 'Actions' })}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {securityCheckHistory.length ? (
                              securityCheckHistory
                                .slice()
                                .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
                                .map((entry) => (
                                  <tr key={entry.id} className="border-t border-slate-100">
                                    <td className="px-2 py-2 text-slate-700">{entry.date || '—'}</td>
                                    <td className="px-2 py-2 text-slate-700">{entry.company || '—'}</td>
                                    <td className="px-2 py-2 text-slate-600">{entry.notes || '—'}</td>
                                    <td className="px-2 py-2 text-slate-500">
                                      {entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td className="px-2 py-2">
                                      <span
                                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                                          entry.archived === false
                                            ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                                            : 'border-slate-300 bg-slate-200 text-slate-700'
                                        }`}
                                      >
                                        {entry.archived === false
                                          ? t({ it: 'Attiva', en: 'Active' })
                                          : t({ it: 'Archiviata', en: 'Archived' })}
                                      </span>
                                    </td>
                                    <td className="px-2 py-2">
                                      {!readOnly ? (
                                        <button
                                          type="button"
                                          onClick={() => removeSecurityCheck(entry.id)}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                          title={t({ it: 'Rimuovi', en: 'Remove' })}
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                  </tr>
                                ))
                            ) : (
                              <tr>
                                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                                  {t({ it: 'Nessuna verifica registrata.', en: 'No checks registered.' })}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => setSecurityHistoryOpen(false)}
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
