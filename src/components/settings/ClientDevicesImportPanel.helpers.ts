// Types and pure helpers extracted from ClientDevicesImportPanel.tsx
// (config payload mapping, device search/sort, display-name formatting,
// row tooltip and CSV template builders).
import { type ExternalDeviceRow } from '../../api/customImport';

export type DeviceImportMode = 'webapi' | 'csv' | 'manual';

export type ImportSummaryRow = {
  clientId: string;
  clientName: string;
  lastImportAt: number | null;
  total: number;
  presentCount: number;
  missingCount: number;
  hiddenCount: number;
  configUpdatedAt: number | null;
  hasConfig: boolean;
};

export type DeviceImportConfigState = {
  url: string;
  username: string;
  method: 'GET' | 'POST' | string;
  hasPassword: boolean;
  bodyJson: string;
  updatedAt?: number;
};

export type PreviewSide = 'left' | 'right';

export type PreviewDeleteRequest = {
  devIds: string[];
  count: number;
};

export const toDeviceConfigPayload = (cfg: DeviceImportConfigState | null, password: string) => {
  if (!cfg) return undefined;
  return {
    url: String(cfg.url || '').trim(),
    username: String(cfg.username || '').trim(),
    method: String(cfg.method || 'POST').trim().toUpperCase(),
    bodyJson: cfg.bodyJson || '',
    ...(password ? { password } : {})
  };
};

export const normalizeSearchText = (value: unknown) => String(value || '').trim().toLowerCase();

export const deviceSearchIndex = (row: Partial<ExternalDeviceRow>) =>
  [row.devId, row.deviceType, row.deviceName, row.manufacturer, row.model, row.serialNumber]
    .map((v) => String(v || '').trim())
    .join(' ')
    .toLowerCase();

export const formatDate = (ts: number | null | undefined) => {
  if (!ts) return '—';
  try {
    return new Date(Number(ts)).toLocaleString();
  } catch {
    return '—';
  }
};

export const getDisplayDeviceName = (row: Partial<ExternalDeviceRow>) => {
  const explicitName = String(row.deviceName || '').trim();
  if (explicitName) return explicitName.toUpperCase();
  return String(row.devId || '').trim();
};

export const getDisplayDeviceHeading = (row: Partial<ExternalDeviceRow>) => {
  const name = getDisplayDeviceName(row);
  const serial = String(row.serialNumber || '').trim();
  return serial ? `${name} (S/N: ${serial})` : name;
};

export const buildDeviceRowTooltip = (
  row: Partial<ExternalDeviceRow>,
  labels: {
    name: string;
    id: string;
    serial: string;
    type: string;
    brandModel: string;
    state: string;
  },
  stateLabel: string
) => {
  const brandModel = [String(row.manufacturer || '').trim(), String(row.model || '').trim()].filter(Boolean).join(' · ') || '—';
  return [
    `${labels.name}: ${getDisplayDeviceName(row) || '—'}`,
    `${labels.id}: ${String(row.devId || '').trim() || '—'}`,
    `${labels.serial}: ${String(row.serialNumber || '').trim() || '—'}`,
    `${labels.type}: ${String(row.deviceType || '').trim() || '—'}`,
    `${labels.brandModel}: ${brandModel}`,
    `${labels.state}: ${stateLabel}`
  ].join('\n');
};

export const compareDeviceRows = (a: Partial<ExternalDeviceRow>, b: Partial<ExternalDeviceRow>) => {
  const byName = String(a.deviceName || '').localeCompare(String(b.deviceName || ''), undefined, { sensitivity: 'base' });
  if (byName !== 0) return byName;
  return String(a.devId || '').localeCompare(String(b.devId || ''), undefined, { sensitivity: 'base' });
};

export const buildDeviceTemplateCsv = () => {
  const headers = ['dev_id', 'device_type', 'device_name', 'manufacturer', 'model', 'serial_number'];
  const examples = [
    ['1', 'Desktop PC', 'AR-BI-WK130', 'DELL', 'Optiplex 5060', 'ST01301'],
    ['2', 'Laptop', 'LT-IT-0042', 'Lenovo', 'ThinkPad T14', 'LEN00991']
  ];
  return [headers.join(','), ...examples.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
};
