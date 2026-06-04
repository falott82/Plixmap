// Types, Props, constants and pure helpers extracted verbatim from RackModal.tsx (<2k).
import type { FloorPlan, RackItemType } from '../../store/types';

export type RackItemDraft = {
  name: string;
  brand: string;
  model: string;
  ip: string;
  hostName: string;
  mgmtIp: string;
  idracIp: string;
  dualPower: boolean;
  notes: string;
  connectorType: 'SC' | 'LC' | 'ST' | 'FC';
  rails: boolean;
  outlets: number;
  mainSwitch: boolean;
  maintenanceDate: string;
  batteryChangeDate: string;
  unitStart: number;
  unitSize: number;
  ethPorts: number;
  fiberPorts: number;
  ethRangeStart: number;
  fiberRangeStart: number;
};

export interface Props {
  open: boolean;
  plan: FloorPlan;
  rackObjectId: string;
  rackObjectName: string;
  readOnly?: boolean;
  onClose: () => void;
}

export const unitHeight = 22;

export const typeLabels: Record<RackItemType, { it: string; en: string }> = {
  switch: { it: 'Switch', en: 'Switch' },
  router: { it: 'Router', en: 'Router' },
  firewall: { it: 'Firewall', en: 'Firewall' },
  server: { it: 'Server', en: 'Server' },
  patchpanel: { it: 'Patch panel', en: 'Patch panel' },
  optical_drawer: { it: 'Cassetto ottico', en: 'Fiber Patch Panel' },
  passacavo: { it: 'Passacavo', en: 'Cable Management Panel' },
  ups: { it: 'UPS', en: 'UPS' },
  power_strip: { it: 'Ciabatta elettrica', en: 'Power strip' },
  misc: { it: 'Varie', en: 'Misc' }
};

export const typeColors: Record<RackItemType, string> = {
  switch: '#3b82f6',
  router: '#22c55e',
  firewall: '#ef4444',
  server: '#14b8a6',
  patchpanel: '#f59e0b',
  optical_drawer: '#a855f7',
  passacavo: '#94a3b8',
  ups: '#f97316',
  power_strip: '#0ea5e9',
  misc: '#64748b'
};

export const normalizeRackName = (value: string) => value.trim().toLowerCase();
