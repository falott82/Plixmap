// Props, types and pure helpers extracted verbatim from ObjectModal.tsx (<2k).
import type { IconName, MapObjectType, WifiAntennaModel } from '../../store/types';

export interface Props {
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

export const normalizeRackName = (value: string) => value.trim().toLowerCase();
export type SecurityDocsSortKey = 'name' | 'uploadedAt' | 'validUntil' | 'status';
export const parseDateOnly = (value?: string) => {
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

export const parseLatLngPair = (value: string): { lat: number; lng: number } | null => {
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

export const formatCoord = (value: number) => Number(value.toFixed(6)).toString();

export const normalizeGoogleMapsCoordsInput = (value: string) => {
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


// Search-filter (optionally hiding expired) + sort the security documents.
// Pure; the status classifier is passed in. Extracted from ObjectModal.
export const sortFilterSecurityDocuments = (
  securityDocuments: any[],
  search: string,
  hideExpired: boolean,
  sort: { key: SecurityDocsSortKey; dir: 'asc' | 'desc' },
  getDocumentStatus: (doc: { archived?: boolean; validUntil?: string }) => 'archived' | 'expired' | 'warning' | 'ok' | 'none'
): any[] => {
  const q = search.trim().toLowerCase();
  const base = (securityDocuments || []).filter((doc) => {
    if (hideExpired && getDocumentStatus(doc) === 'expired') return false;
    if (!q) return true;
    const hay = `${doc.name || ''} ${doc.fileName || ''} ${doc.notes || ''}`.toLowerCase();
    return hay.includes(q);
  });
  const statusRank: Record<'archived' | 'expired' | 'warning' | 'ok' | 'none', number> = {
    ok: 0,
    warning: 1,
    expired: 2,
    none: 3,
    archived: 4
  };
  const dateMs = (value?: string) => parseDateOnly(value)?.getTime() || 0;
  return base.slice().sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
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
    return sort.dir === 'asc' ? cmp : -cmp;
  });
};
