import { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { Dialog } from '@headlessui/react';
import { Cable, Link2, Trash, X } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { RackItem, RackItemType, FloorPlan, RackPortKind } from '../../store/types';
import { useT } from '../../i18n/useT';
import { useToastStore } from '../../store/useToast';
import RackPortsModal from './RackPortsModal';

type RackItemDraft = {
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

interface Props {
  open: boolean;
  plan: FloorPlan;
  rackObjectId: string;
  rackObjectName: string;
  readOnly?: boolean;
  onClose: () => void;
}

const unitHeight = 22;

const typeLabels: Record<RackItemType, { it: string; en: string }> = {
  switch: { it: 'Switch', en: 'Switch' },
  server: { it: 'Server', en: 'Server' },
  patchpanel: { it: 'Patch panel', en: 'Patch panel' },
  optical_drawer: { it: 'Cassetto ottico', en: 'Optical drawer' },
  ups: { it: 'UPS', en: 'UPS' },
  power_strip: { it: 'Ciabatta elettrica', en: 'Power strip' },
  misc: { it: 'Varie', en: 'Misc' }
};

const typeColors: Record<RackItemType, string> = {
  switch: '#3b82f6',
  server: '#14b8a6',
  patchpanel: '#f59e0b',
  optical_drawer: '#a855f7',
  ups: '#f97316',
  power_strip: '#0ea5e9',
  misc: '#64748b'
};

const RackModal = ({ open, plan, rackObjectId, rackObjectName, readOnly = false, onClose }: Props) => {
  const t = useT();
  const { push } = useToastStore();
  const {
    ensureRack,
    updateRack,
    addRackItem,
    updateRackItem,
    deleteRackItem,
    addRackLink,
    deleteRackLink,
    updateObject
  } = useDataStore();
  const rack = useMemo(() => (plan.racks || []).find((r) => r.id === rackObjectId), [plan.racks, rackObjectId]);
  const rackDisplayName = rack?.name || rackObjectName;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [name, setName] = useState(rack?.name || rackObjectName);
  const [totalUnits, setTotalUnits] = useState(rack?.totalUnits || 42);
  const [rackNotes, setRackNotes] = useState(rack?.notes || '');
  const [rackSearch, setRackSearch] = useState('');
  const [addPrompt, setAddPrompt] = useState<{
    type: RackItemType;
    step: 'units' | 'place';
    unitSize: number;
    preferredY?: number | null;
  } | null>(null);
  const [editPrompt, setEditPrompt] = useState<{
    itemId: string;
    type: RackItemType;
  } | null>(null);
  const [deletePrompt, setDeletePrompt] = useState<{
    mode: 'single' | 'all';
    itemId?: string;
  } | null>(null);
  const [portsModalItemId, setPortsModalItemId] = useState<string | null>(null);
  const [portsModalShowConnections, setPortsModalShowConnections] = useState(false);
  const [addUnitSize, setAddUnitSize] = useState(1);
  const [editUnitSize, setEditUnitSize] = useState(1);
  const [flashItemId, setFlashItemId] = useState<string | null>(null);
  const [addDetails, setAddDetails] = useState<{
    name: string;
    brand: string;
    model: string;
    ip: string;
    dualPower: boolean;
    hostName: string;
    mgmtIp: string;
    idracIp: string;
    ethPorts: number;
    fiberPorts: number;
    notes: string;
    connectorType: 'SC' | 'LC' | 'ST' | 'FC';
    rails: boolean;
    outlets: number;
    mainSwitch: boolean;
    maintenanceDate: string;
    batteryChangeDate: string;
  }>({
    name: '',
    brand: '',
    model: '',
    ip: '',
    dualPower: false,
    hostName: '',
    mgmtIp: '',
    idracIp: '',
    ethPorts: 24,
    fiberPorts: 2,
    notes: '',
    connectorType: 'LC',
    rails: false,
    outlets: 6,
    mainSwitch: false,
    maintenanceDate: '',
    batteryChangeDate: ''
  });
  const [editDetails, setEditDetails] = useState<{
    name: string;
    brand: string;
    model: string;
    ip: string;
    dualPower: boolean;
    hostName: string;
    mgmtIp: string;
    idracIp: string;
    ethPorts: number;
    fiberPorts: number;
    notes: string;
    connectorType: 'SC' | 'LC' | 'ST' | 'FC';
    rails: boolean;
    outlets: number;
    mainSwitch: boolean;
    maintenanceDate: string;
    batteryChangeDate: string;
  } | null>(null);
  const rackDialogFocusRef = useRef<HTMLButtonElement | null>(null);
  const addPromptFocusRef = useRef<HTMLInputElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const dragItemIdRef = useRef<string | null>(null);
  const dropAcceptedRef = useRef(false);
  const rackRef = useRef<HTMLDivElement | null>(null);
  const rackViewRef = useRef<HTMLDivElement | null>(null);
  const selectedNameRef = useRef<HTMLInputElement | null>(null);
  const rackNotesDirtyRef = useRef(false);
  const rackInitRef = useRef<string | null>(null);

  const allRackItems = useMemo(() => plan.rackItems || [], [plan.rackItems]);
  const rackItems = useMemo(
    () => allRackItems.filter((i) => i.rackId === rackObjectId),
    [allRackItems, rackObjectId]
  );
  const filteredRackItems = useMemo(() => {
    const term = rackSearch.trim().toLowerCase();
    if (!term) return rackItems;
    return rackItems.filter((item) => {
      const label = typeLabels[item.type]?.it || item.type;
      const hay = `${item.name} ${item.hostName || ''} ${label}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rackItems, rackSearch]);

  useEffect(() => {
    if (!open) {
      rackInitRef.current = null;
      rackNotesDirtyRef.current = false;
      return;
    }
    if (!rack) {
      ensureRack(plan.id, rackObjectId, { name: rackObjectName || t({ it: 'Rack', en: 'Rack' }), totalUnits: 42 });
      setName(rackObjectName || t({ it: 'Rack', en: 'Rack' }));
      setTotalUnits(42);
      setRackNotes('');
      rackInitRef.current = rackObjectId;
      rackNotesDirtyRef.current = false;
    } else {
      const isNewRack = rackInitRef.current !== rackObjectId;
      if (isNewRack) {
        setName(rack.name || rackObjectName);
        setTotalUnits(rack.totalUnits || 42);
        setRackNotes(rack.notes || '');
        rackInitRef.current = rackObjectId;
        rackNotesDirtyRef.current = false;
      } else if (!rackNotesDirtyRef.current) {
        setRackNotes(rack.notes || '');
      }
    }
    setSelectedItemId(null);
  }, [ensureRack, open, plan.id, rack, rackObjectId, rackObjectName, t]);

  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      if (e.button === 2 || e.ctrlKey) return;
      setContextMenu(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [contextMenu]);

  useEffect(() => {
    if (!selectedItemId) return;
    rackRef.current?.focus();
  }, [selectedItemId]);

  useEffect(() => {
    if (addPrompt?.step !== 'units') return;
    const id = window.setTimeout(() => addPromptFocusRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [addPrompt?.step]);

  const selectedItem = useMemo(
    () => rackItems.find((i) => i.id === selectedItemId) || null,
    [rackItems, selectedItemId]
  );
  const portsModalItem = useMemo(
    () => rackItems.find((i) => i.id === portsModalItemId) || null,
    [rackItems, portsModalItemId]
  );

  useEffect(() => {
    if (!open) return;
    if (!selectedItem) return;
    setSelectedItemId(selectedItem.id);
  }, [open, selectedItem]);

  const toDraft = (item: RackItem): RackItemDraft => ({
    name: item.name || '',
    brand: item.brand || '',
    model: item.model || '',
    ip: item.ip || '',
    hostName: item.hostName || '',
    mgmtIp: item.mgmtIp || '',
    idracIp: item.idracIp || '',
    dualPower: !!item.dualPower,
    notes: item.notes || '',
    connectorType: (item.connectorType || 'LC') as 'SC' | 'LC' | 'ST' | 'FC',
    rails: !!item.rails,
    outlets: item.outlets || 0,
    mainSwitch: !!item.mainSwitch,
    maintenanceDate: item.maintenanceDate || '',
    batteryChangeDate: item.batteryChangeDate || '',
    unitStart: item.unitStart,
    unitSize: item.unitSize,
    ethPorts: item.ethPorts || 0,
    fiberPorts: item.fiberPorts || 0,
    ethRangeStart: item.ethRangeStart || 1,
    fiberRangeStart: item.fiberRangeStart || Math.max(1, (item.ethRangeStart || 1) + (item.ethPorts || 0))
  });

  const [draft, setDraft] = useState<RackItemDraft | null>(null);

  useEffect(() => {
    if (!selectedItem) {
      setDraft(null);
      return;
    }
    setDraft(toDraft(selectedItem));
  }, [selectedItem]);

  const hasEth = (type: RackItemType) => type === 'switch' || type === 'patchpanel';
  const hasFiber = (type: RackItemType) => type === 'switch' || type === 'optical_drawer';
  const hasPorts = (item: RackItem | null) => {
    if (!item) return false;
    return item.type === 'switch' || item.type === 'patchpanel' || item.type === 'optical_drawer';
  };

  const rangesOverlap = (aStart: number, aSize: number, bStart: number, bSize: number) => {
    const aEnd = aStart + aSize - 1;
    const bEnd = bStart + bSize - 1;
    return aStart <= bEnd && bStart <= aEnd;
  };

  const isSlotFree = (start: number, size: number, excludeId?: string) => {
    const end = start + size - 1;
    if (start < 1 || end > totalUnits) return false;
    return rackItems.every((i) => {
      if (excludeId && i.id === excludeId) return true;
      return !rangesOverlap(start, size, i.unitStart, i.unitSize);
    });
  };

  const findFirstSlot = (size: number) => {
    for (let start = 1; start <= totalUnits - size + 1; start += 1) {
      if (isSlotFree(start, size)) return start;
    }
    return null;
  };

  const maxContiguousFree = () => {
    let max = 0;
    let run = 0;
    for (let start = 1; start <= totalUnits; start += 1) {
      if (isSlotFree(start, 1)) {
        run += 1;
        if (run > max) max = run;
      } else {
        run = 0;
      }
    }
    return max;
  };

  const freeUnits = useMemo(() => {
    const used = rackItems.reduce((sum, item) => sum + (item.unitSize || 0), 0);
    return Math.max(0, totalUnits - used);
  }, [rackItems, totalUnits]);

  const findNearestSlot = (target: number, size: number) => {
    const maxStart = totalUnits - size + 1;
    const clamped = Math.max(1, Math.min(maxStart, target));
    if (isSlotFree(clamped, size)) return clamped;
    for (let delta = 1; delta <= maxStart; delta += 1) {
      const up = clamped + delta;
      if (up <= maxStart && isSlotFree(up, size)) return up;
      const down = clamped - delta;
      if (down >= 1 && isSlotFree(down, size)) return down;
    }
    return null;
  };

  const buildDefaultDetails = (type: RackItemType) => ({
    name: '',
    brand: '',
    model: '',
    ip: '',
    dualPower: false,
    hostName: '',
    mgmtIp: '',
    idracIp: '',
    ethPorts: type === 'patchpanel' || type === 'switch' ? 24 : 0,
    fiberPorts: type === 'optical_drawer' || type === 'switch' ? 2 : 0,
    notes: '',
    connectorType: 'LC' as const,
    rails: false,
    outlets: 6,
    mainSwitch: false,
    maintenanceDate: '',
    batteryChangeDate: ''
  });

  const toEditDetails = (item: RackItem) => ({
    name: item.name || '',
    brand: item.brand || '',
    model: item.model || '',
    ip: item.ip || '',
    dualPower: !!item.dualPower,
    hostName: item.hostName || '',
    mgmtIp: item.mgmtIp || '',
    idracIp: item.idracIp || '',
    ethPorts: item.ethPorts || 0,
    fiberPorts: item.fiberPorts || 0,
    notes: item.notes || '',
    connectorType: (item.connectorType || 'LC') as 'SC' | 'LC' | 'ST' | 'FC',
    rails: !!item.rails,
    outlets: item.outlets || 0,
    mainSwitch: !!item.mainSwitch,
    maintenanceDate: item.maintenanceDate || '',
    batteryChangeDate: item.batteryChangeDate || ''
  });

  const openAddPrompt = (type: RackItemType, preferredY?: number | null) => {
    if (readOnly) return;
    setAddUnitSize(1);
    setAddDetails(buildDefaultDetails(type));
    setAddPrompt({ type, step: 'units', unitSize: 1, preferredY: preferredY ?? null });
  };

  const handleAddItem = (type: RackItemType) => {
    openAddPrompt(type);
  };

  const openEditPrompt = (item: RackItem) => {
    if (readOnly) return;
    setSelectedItemId(item.id);
    setEditUnitSize(item.unitSize || 1);
    setEditDetails(toEditDetails(item));
    setEditPrompt({ itemId: item.id, type: item.type });
  };

  const handleDrop = (evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    if (readOnly) return;
    dropAcceptedRef.current = true;
    const droppedType = evt.dataTransfer.getData('application/deskly-rack-type') as RackItemType | '';
    if (droppedType) {
      const container = rackRef.current;
      if (!container) {
        openAddPrompt(droppedType);
        return;
      }
      const rect = container.getBoundingClientRect();
      const y = evt.clientY - rect.top;
      openAddPrompt(droppedType, y);
      return;
    }
    const itemId = dragItemIdRef.current;
    dragItemIdRef.current = null;
    if (!itemId) return;
    const item = rackItems.find((i) => i.id === itemId);
    const container = rackRef.current;
    if (!item || !container) return;
    const rect = container.getBoundingClientRect();
    const y = evt.clientY - rect.top;
    const fromTop = Math.max(0, Math.min(totalUnits - 1, Math.floor(y / unitHeight)));
    const start = totalUnits - fromTop - item.unitSize + 1;
    const clamped = Math.max(1, Math.min(totalUnits - item.unitSize + 1, start));
    if (!isSlotFree(clamped, item.unitSize, item.id)) {
      push(t({ it: 'Spazio già occupato.', en: 'Slot already occupied.' }), 'info');
      return;
    }
    updateRackItem(plan.id, item.id, { unitStart: clamped });
  };

  const handleSaveRack = () => {
    if (readOnly) return;
    const trimmed = name.trim() || t({ it: 'Rack', en: 'Rack' });
    updateRack(plan.id, rackObjectId, { name: trimmed, totalUnits, notes: rackNotes.trim() });
    updateObject(rackObjectId, { name: trimmed });
    rackNotesDirtyRef.current = false;
    push(t({ it: 'Rack aggiornato', en: 'Rack updated' }), 'success');
  };

  const handleExportRackPdf = async () => {
    if (!rackViewRef.current) return;
    try {
      const titleBase = (name || rackObjectName || t({ it: 'Rack', en: 'Rack' })).trim();
      const titleNotes = rackNotes.trim();
      const title = titleNotes ? `${titleBase} - ${titleNotes}` : titleBase;
      const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const labelWidth = 32;
      const titleFont = 12;
      const smallFont = 7;
      const nameFont = 8;
      const ipFont = 7;
      pdf.setFontSize(titleFont);
      const titleLines = pdf.splitTextToSize(title, pageWidth - margin * 2);
      const titleHeight = titleLines.length * (titleFont + 4);
      pdf.text(titleLines, margin, margin + titleFont);
      const rackX = margin + labelWidth + 6;
      const rackY = margin + titleHeight + 10;
      const rackWidth = pageWidth - margin - rackX;
      const rackHeight = pageHeight - rackY - margin;
      const unitHeight = rackHeight / Math.max(1, totalUnits);
      pdf.setFillColor(241, 245, 249);
      pdf.setDrawColor(203, 213, 225);
      pdf.roundedRect(rackX, rackY, rackWidth, rackHeight, 6, 6, 'FD');
      pdf.setFontSize(smallFont);
      pdf.setTextColor(100, 116, 139);
      for (let i = 1; i <= totalUnits; i += 1) {
        const y = rackY + rackHeight - i * unitHeight + unitHeight - 2;
        pdf.text(`${i}U`, margin + labelWidth - 2, y, { align: 'right' });
      }
      const truncate = (text: string, maxWidth: number) => {
        if (pdf.getTextWidth(text) <= maxWidth) return text;
        const ellipsis = '…';
        let trimmed = text;
        while (trimmed.length > 1 && pdf.getTextWidth(`${trimmed}${ellipsis}`) > maxWidth) {
          trimmed = trimmed.slice(0, -1);
        }
        return `${trimmed}${ellipsis}`;
      };
      rackItems.forEach((item) => {
        const top = rackY + (totalUnits - (item.unitStart + item.unitSize) + 1) * unitHeight;
        const height = item.unitSize * unitHeight;
        const color = typeColors[item.type] || '#94a3b8';
        pdf.setFillColor(255, 255, 255);
        pdf.setDrawColor(226, 232, 240);
        pdf.roundedRect(rackX + 6, top + 2, rackWidth - 12, height - 4, 6, 6, 'FD');
        const [r, g, b] = [
          parseInt(color.slice(1, 3), 16),
          parseInt(color.slice(3, 5), 16),
          parseInt(color.slice(5, 7), 16)
        ];
        pdf.setFillColor(r, g, b);
        pdf.rect(rackX + 6, top + 2, 4, height - 4, 'F');
        const hostSuffix =
          (item.type === 'switch' || item.type === 'server') && item.hostName ? ` · ${item.hostName}` : '';
        const label = `${item.name}${hostSuffix} · ${item.unitSize}U · ${typeLabels[item.type]?.it || item.type}`;
        const ip =
          item.type === 'switch' && item.mgmtIp
            ? item.mgmtIp
            : item.type === 'server' && item.ip
              ? item.ip
              : '';
        const textY = top + height / 2 + nameFont / 2 - 2;
        const leftTextX = rackX + 14;
        const rightTextX = rackX + rackWidth - 14;
        const ipWidth = ip ? pdf.getTextWidth(ip) + 6 : 0;
        const maxLabelWidth = rightTextX - leftTextX - ipWidth;
        pdf.setFontSize(nameFont);
        pdf.setTextColor(30, 41, 59);
        pdf.text(truncate(label, maxLabelWidth), leftTextX, textY);
        if (ip) {
          pdf.setFontSize(ipFont);
          pdf.setTextColor(100, 116, 139);
          pdf.text(ip, rightTextX, textY, { align: 'right' });
        }
      });
      pdf.save(`${title.replace(/\s+/g, '_')}.pdf`);
      push(t({ it: 'PDF rack creato', en: 'Rack PDF generated' }), 'success');
    } catch (error) {
      push(t({ it: 'Errore durante l’export PDF', en: 'PDF export failed' }), 'error');
    }
  };

  const handleSaveItem = () => {
    if (readOnly || !selectedItem || !draft) return;
    if (!draft.name.trim()) return;
    if (!isSlotFree(draft.unitStart, draft.unitSize, selectedItem.id)) {
      push(t({ it: 'La posizione è occupata.', en: 'Selected slot is occupied.' }), 'info');
      return;
    }
    const nextEthPorts = hasEth(selectedItem.type) ? Math.max(0, draft.ethPorts || 0) : 0;
    const nextFiberPorts = hasFiber(selectedItem.type) ? Math.max(0, draft.fiberPorts || 0) : 0;
    const nextEthStart = 1;
    const nextFiberStart = Math.max(1, nextEthStart + nextEthPorts);
    updateRackItem(plan.id, selectedItem.id, {
      name: draft.name.trim(),
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      ip: draft.ip.trim(),
      hostName: draft.hostName.trim(),
      mgmtIp: draft.mgmtIp.trim(),
      idracIp: draft.idracIp.trim(),
      dualPower: draft.dualPower,
      notes: draft.notes.trim(),
      connectorType: selectedItem.type === 'optical_drawer' ? draft.connectorType : undefined,
      rails: draft.rails,
      outlets: Math.max(0, draft.outlets || 0),
      mainSwitch: draft.mainSwitch,
      maintenanceDate: draft.maintenanceDate || '',
      batteryChangeDate: draft.batteryChangeDate || '',
      unitStart: Math.max(1, Math.min(totalUnits, draft.unitStart)),
      unitSize: Math.max(1, Math.min(totalUnits, draft.unitSize)),
      ethPorts: nextEthPorts,
      fiberPorts: nextFiberPorts,
      ethRangeStart: nextEthStart,
      fiberRangeStart: nextFiberStart
    });
    push(t({ it: 'Apparato aggiornato', en: 'Device updated' }), 'success');
  };

  const handleConfirmEdit = () => {
    if (readOnly || !editPrompt || !editDetails) return;
    const item = rackItems.find((entry) => entry.id === editPrompt.itemId);
    if (!item) {
      setEditPrompt(null);
      return;
    }
    const size = Math.max(1, Math.min(totalUnits, editUnitSize || 1));
    if (!isSlotFree(item.unitStart, size, item.id)) {
      push(t({ it: 'La posizione è occupata.', en: 'Selected slot is occupied.' }), 'info');
      return;
    }
    if (size > maxContiguousFree() && size > item.unitSize) {
      push(
        t({
          it: 'La dimensione supera lo spazio contiguo disponibile nel rack.',
          en: 'This size exceeds the contiguous space available in the rack.'
        }),
        'info'
      );
      return;
    }
    const nextEthPorts = hasEth(item.type) ? Math.max(0, editDetails.ethPorts || 0) : 0;
    const nextFiberPorts = hasFiber(item.type) ? Math.max(0, editDetails.fiberPorts || 0) : 0;
    const nextEthStart = 1;
    const nextFiberStart = Math.max(1, nextEthStart + nextEthPorts);
    updateRackItem(plan.id, item.id, {
      name:
        (item.type === 'switch' || item.type === 'server') && editDetails.name.trim()
          ? editDetails.name.trim()
          : item.name,
      brand: editDetails.brand.trim(),
      model: editDetails.model.trim(),
      ip: item.type === 'server' ? editDetails.ip.trim() : '',
      hostName: item.type === 'switch' || item.type === 'server' ? editDetails.hostName.trim() : '',
      mgmtIp: item.type === 'switch' ? editDetails.mgmtIp.trim() : '',
      idracIp: item.type === 'server' ? editDetails.idracIp.trim() : '',
      dualPower: item.type === 'switch' || item.type === 'server' ? editDetails.dualPower : false,
      connectorType: item.type === 'optical_drawer' ? editDetails.connectorType : undefined,
      rails: item.type === 'server' ? editDetails.rails : false,
      outlets: item.type === 'power_strip' ? Math.max(0, editDetails.outlets || 0) : 0,
      mainSwitch: item.type === 'power_strip' ? editDetails.mainSwitch : false,
      maintenanceDate: item.type === 'ups' ? editDetails.maintenanceDate : '',
      batteryChangeDate: item.type === 'ups' ? editDetails.batteryChangeDate : '',
      notes: editDetails.notes.trim(),
      unitSize: size,
      ethPorts: nextEthPorts,
      fiberPorts: nextFiberPorts,
      ethRangeStart: nextEthStart,
      fiberRangeStart: nextFiberStart
    });
    setEditPrompt(null);
  };

  const formatItemLabel = (item: RackItem) => {
    const host = item.hostName ? ` - ${item.hostName}` : '';
    return `${typeLabels[item.type]?.it || item.type}${host}`;
  };

  const handleConfirmDelete = () => {
    if (readOnly || !deletePrompt) return;
    if (deletePrompt.mode === 'all') {
      rackItems.forEach((item) => {
        deleteRackItem(plan.id, item.id);
      });
      setSelectedItemId(null);
      setDeletePrompt(null);
      return;
    }
    if (deletePrompt.itemId) {
      deleteRackItem(plan.id, deletePrompt.itemId);
      if (selectedItemId === deletePrompt.itemId) setSelectedItemId(null);
      setDeletePrompt(null);
    }
  };

  const rackHeight = Math.max(10, totalUnits) * unitHeight;
  const normalizeIp = (value: string) => value.trim().replace(/^https?:\/\//i, '');
  const toUrl = (value: string, protocol: 'http' | 'https' = 'http') => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return `${protocol}://${normalizeIp(trimmed)}`;
  };
  const handleRenamePort = (itemId: string, kind: RackPortKind, index: number, name: string) => {
    if (readOnly) return;
    const item = rackItems.find((entry) => entry.id === itemId);
    if (!item) return;
    const key = kind === 'ethernet' ? 'ethPortNames' : 'fiberPortNames';
    const current = (item[key] as string[] | undefined) || [];
    const next = [...current];
    const normalized = name.trim();
    while (next.length < index) next.push('');
    next[index - 1] = normalized;
    updateRackItem(plan.id, itemId, { [key]: next } as Partial<RackItem>);
  };
  const handleSavePortNote = (itemId: string, kind: RackPortKind, index: number, note: string) => {
    if (readOnly) return;
    const item = rackItems.find((entry) => entry.id === itemId);
    if (!item) return;
    const key = kind === 'ethernet' ? 'ethPortNotes' : 'fiberPortNotes';
    const current = (item[key] as string[] | undefined) || [];
    const next = [...current];
    const normalized = note.trim();
    while (next.length < index) next.push('');
    next[index - 1] = normalized;
    updateRackItem(plan.id, itemId, { [key]: next } as Partial<RackItem>);
  };
  const createRackItemAt = (type: RackItemType, size: number, start: number) => {
    const target = findNearestSlot(start, size);
    if (!target) {
      push(t({ it: 'Nessuno slot disponibile vicino.', en: 'No available slot nearby.' }), 'info');
      return false;
    }
    const nameBase = typeLabels[type]?.it || 'Item';
    const sameTypeCount = rackItems.filter((i) => i.type === type).length + 1;
    const ethPorts = hasEth(type)
      ? Math.max(0, type === 'switch' || type === 'patchpanel' ? addDetails.ethPorts : 0)
      : 0;
    const fiberPorts = hasFiber(type)
      ? Math.max(0, type === 'switch' || type === 'optical_drawer' ? addDetails.fiberPorts : 0)
      : 0;
    const ethRangeStart = 1;
    const fiberRangeStart = Math.max(1, ethRangeStart + ethPorts);
    const finalName =
      (type === 'switch' || type === 'server') && addDetails.name.trim()
        ? addDetails.name.trim()
        : `${nameBase} ${sameTypeCount}`;
    const finalHostName = addDetails.hostName.trim();
    const finalMgmtIp = addDetails.mgmtIp.trim();
    const finalIdracIp = addDetails.idracIp.trim();
    const finalIp = addDetails.ip.trim();
    const useBrandModel =
      type === 'switch' ||
      type === 'server' ||
      type === 'patchpanel' ||
      type === 'optical_drawer' ||
      type === 'ups' ||
      type === 'power_strip';
    const id = addRackItem(plan.id, {
      rackId: rackObjectId,
      type,
      name: finalName,
      unitStart: target,
      unitSize: size,
      brand: useBrandModel ? addDetails.brand.trim() : '',
      model: useBrandModel ? addDetails.model.trim() : '',
      ip: type === 'server' ? finalIp : '',
      hostName: type === 'switch' || type === 'server' ? finalHostName : '',
      mgmtIp: type === 'switch' ? finalMgmtIp : '',
      idracIp: type === 'server' ? finalIdracIp : '',
      dualPower: type === 'switch' || type === 'server' ? addDetails.dualPower : false,
      connectorType: type === 'optical_drawer' ? addDetails.connectorType : undefined,
      rails: type === 'server' ? addDetails.rails : false,
      outlets: type === 'power_strip' ? Math.max(0, addDetails.outlets) : 0,
      mainSwitch: type === 'power_strip' ? addDetails.mainSwitch : false,
      maintenanceDate: type === 'ups' ? addDetails.maintenanceDate : '',
      batteryChangeDate: type === 'ups' ? addDetails.batteryChangeDate : '',
      notes: addDetails.notes.trim(),
      ethPorts,
      fiberPorts,
      ethRangeStart,
      fiberRangeStart
    });
    setSelectedItemId(id);
    setFlashItemId(id);
    window.setTimeout(() => {
      setFlashItemId((prev) => (prev === id ? null : prev));
    }, 3200);
    setAddPrompt(null);
    return true;
  };

  const handleConfirmAdd = () => {
    if (!addPrompt) return;
    const size = Math.max(1, Math.min(totalUnits, addUnitSize || 1));
    if (size > maxContiguousFree()) {
      push(
        t({
          it: 'La dimensione supera lo spazio contiguo disponibile nel rack.',
          en: 'This size exceeds the contiguous space available in the rack.'
        }),
        'info'
      );
      return;
    }
    const hasSlot = findFirstSlot(size);
    if (!hasSlot) {
      push(t({ it: 'Nessuno slot disponibile per questa unità.', en: 'No available slot for this unit size.' }), 'info');
      return;
    }
    if (addPrompt.preferredY != null) {
      const fromTop = Math.max(0, Math.min(totalUnits - 1, Math.floor(addPrompt.preferredY / unitHeight)));
      const start = totalUnits - fromTop - size + 1;
      const clamped = Math.max(1, Math.min(totalUnits - size + 1, start));
      createRackItemAt(addPrompt.type, size, clamped);
      return;
    }
    setAddPrompt((prev) => (prev ? { ...prev, step: 'place', unitSize: size } : prev));
    push(t({ it: 'Seleziona uno slot nel rack per inserire l’apparato.', en: 'Select a rack slot to place the device.' }), 'info');
  };

  const itemCard = (item: RackItem) => {
    const top = (totalUnits - (item.unitStart + item.unitSize) + 1) * unitHeight;
    const height = item.unitSize * unitHeight;
    const isSelected = item.id === selectedItemId;
    const isFlash = item.id === flashItemId;
    const color = typeColors[item.type] || '#94a3b8';
    const singleLine = item.unitSize === 1;
    const showPorts = hasPorts(item);
    const hostSuffix =
      (item.type === 'switch' || item.type === 'server') && item.hostName ? ` · ${item.hostName}` : '';
    const ipSuffix =
      item.type === 'switch' && item.mgmtIp
        ? item.mgmtIp
        : item.type === 'server' && item.ip
          ? item.ip
          : '';
    return (
      <div
        key={item.id}
        draggable={!readOnly}
        onDragStart={() => {
          dragItemIdRef.current = item.id;
          dropAcceptedRef.current = false;
        }}
        onDragEnd={() => {
          if (readOnly) return;
          if (!dropAcceptedRef.current) {
            setDeletePrompt({ mode: 'single', itemId: item.id });
          }
        }}
        onMouseDown={(e) => {
          if (e.button === 2 || e.ctrlKey) return;
          e.stopPropagation();
          setSelectedItemId(item.id);
          rackRef.current?.focus();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSelectedItemId(item.id);
          setContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id });
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setSelectedItemId(item.id);
          setContextMenu(null);
          openEditPrompt(item);
        }}
        onClick={() => setSelectedItemId(item.id)}
        className={`absolute left-1 right-1 flex flex-col justify-center rounded-lg border px-2 text-[11px] font-semibold transition ${
          isSelected ? 'border-primary bg-white text-ink shadow-md ring-2 ring-primary/30' : 'border-slate-200 bg-white text-slate-700'
        } ${isFlash ? 'animate-pulse ring-2 ring-primary/40' : ''}`}
        style={{ top, height, borderLeftColor: color, borderLeftWidth: 6 }}
      >
        {singleLine ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">
              {item.name}
              {hostSuffix} · {item.unitSize}U · {typeLabels[item.type]?.it}
            </span>
            <div className="flex items-center gap-2">
              {showPorts ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPortsModalItemId(item.id);
                      setPortsModalShowConnections(false);
                    }}
                    className="rounded-full p-1 text-slate-400 hover:text-primary"
                    title={t({ it: 'Apri porte', en: 'Open ports' })}
                  >
                    <Cable size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPortsModalItemId(item.id);
                      setPortsModalShowConnections(true);
                    }}
                    className="rounded-full p-1 text-slate-400 hover:text-primary"
                    title={t({ it: 'Collegamenti', en: 'Connections' })}
                  >
                    <Link2 size={14} />
                  </button>
                </>
              ) : null}
              {ipSuffix ? <span className="shrink-0 text-[10px] text-slate-500">{ipSuffix}</span> : null}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate">
                {item.name}
                {hostSuffix}
              </span>
              <div className="flex items-center gap-2">
                {showPorts ? (
                  <>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPortsModalItemId(item.id);
                        setPortsModalShowConnections(false);
                      }}
                      className="rounded-full p-1 text-slate-400 hover:text-primary"
                      title={t({ it: 'Apri porte', en: 'Open ports' })}
                    >
                      <Cable size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPortsModalItemId(item.id);
                        setPortsModalShowConnections(true);
                      }}
                      className="rounded-full p-1 text-slate-400 hover:text-primary"
                      title={t({ it: 'Collegamenti', en: 'Connections' })}
                    >
                      <Link2 size={14} />
                    </button>
                  </>
                ) : null}
                {ipSuffix ? <span className="shrink-0 text-[10px] text-slate-500">{ipSuffix}</span> : null}
              </div>
            </div>
            <div className="text-[10px] text-slate-500">{item.unitSize}U · {typeLabels[item.type]?.it}</div>
          </>
        )}
      </div>
    );
  };

  const handleRackClose = () => {
    if (addPrompt || editPrompt || deletePrompt || portsModalItemId) return;
    onClose();
  };

  return (
    <>
      <Dialog open={open} as="div" className="relative z-[80]" onClose={handleRackClose} initialFocus={rackDialogFocusRef}>
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <Dialog.Panel className="w-full max-w-6xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-ink">{t({ it: 'Gestione rack', en: 'Rack editor' })}</Dialog.Title>
                    <div className="text-xs text-slate-500">
                      {t({ it: 'Inserisci apparati ed imposta la posizione nel rack', en: 'Add devices and set their position in the rack.' })}
                    </div>
                  </div>
                  <button
                    ref={rackDialogFocusRef}
                    onClick={onClose}
                    className="text-slate-500 hover:text-ink"
                    title={t({ it: 'Chiudi', en: 'Close' })}
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr_340px]">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Rack', en: 'Rack' })}</div>
                      <label className="mt-2 block text-sm font-medium text-slate-700">
                        {t({ it: 'Nome rack', en: 'Rack name' })}
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        />
                      </label>
                      <label className="mt-2 block text-sm font-medium text-slate-700">
                        {t({ it: 'Unità totali (U)', en: 'Total units (U)' })}
                        <input
                          type="number"
                          min={6}
                          max={60}
                          value={totalUnits}
                          onChange={(e) => setTotalUnits(Math.max(6, Math.min(60, Number(e.target.value) || 42)))}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        />
                      </label>
                      <label className="mt-2 block text-sm font-medium text-slate-700">
                        {t({ it: 'Note rack', en: 'Rack notes' })}
                        <textarea
                          rows={3}
                          value={rackNotes}
                          onChange={(e) => {
                            rackNotesDirtyRef.current = true;
                            setRackNotes(e.target.value);
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        />
                      </label>
                      <button
                        onClick={handleSaveRack}
                        disabled={readOnly}
                        className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold text-white ${readOnly ? 'bg-slate-300' : 'bg-primary hover:bg-primary/90'}`}
                      >
                        {t({ it: 'Salva rack', en: 'Save rack' })}
                      </button>
                      <button
                        onClick={handleExportRackPdf}
                        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t({ it: 'Esporta PDF rack', en: 'Export rack PDF' })}
                      </button>
                      <button
                        onClick={() => setDeletePrompt({ mode: 'all' })}
                        disabled={readOnly || rackItems.length === 0}
                        className={`mt-2 w-full rounded-lg px-3 py-2 text-sm font-semibold ${
                          readOnly || rackItems.length === 0
                            ? 'bg-slate-100 text-slate-400'
                            : 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        {t({ it: 'Elimina tutti gli apparati', en: 'Delete all devices' })}
                      </button>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Apparati', en: 'Devices' })}</div>
                      <div className="mt-2 flex flex-col gap-2">
                        {(Object.keys(typeLabels) as RackItemType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => handleAddItem(type)}
                            disabled={readOnly}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/deskly-rack-type', type);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                            style={{ borderLeftColor: typeColors[type] || '#cbd5f5', borderLeftWidth: 4 }}
                          >
                            <span>{typeLabels[type].it}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
                      <span>{t({ it: 'Vista rack', en: 'Rack view' })}</span>
                      <span className="flex items-center gap-2">
                        {addPrompt?.step === 'place' ? (
                          <>
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              {t({ it: 'Seleziona lo slot', en: 'Select a slot' })}
                            </span>
                            <button
                              onClick={() => setAddPrompt(null)}
                              className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                            >
                              {t({ it: 'Annulla', en: 'Cancel' })}
                            </button>
                          </>
                        ) : null}
                        <span>{t({ it: 'Unità disponibili', en: 'Available units' })} {freeUnits}</span>
                        <span>{t({ it: 'Max contigue', en: 'Max contiguous' })} {maxContiguousFree()}</span>
                        <span>{totalUnits}U</span>
                      </span>
                    </div>
                    <div className="mt-2">
                      <input
                        value={rackSearch}
                        onChange={(e) => setRackSearch(e.target.value)}
                        placeholder={t({ it: 'Cerca apparati o host...', en: 'Search devices or host...' })}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 outline-none ring-primary/30 focus:ring-2"
                      />
                    </div>
                    <div ref={rackViewRef} className="mt-3 grid grid-cols-[34px_1fr] gap-2">
                      <div className="flex flex-col-reverse items-end">
                        {Array.from({ length: totalUnits }, (_, idx) => (
                          <div key={idx} className="h-[22px] text-[10px] text-slate-400">
                            {idx + 1}U
                          </div>
                        ))}
                      </div>
                      <div
                        ref={rackRef}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (!selectedItem) return;
                          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                          e.preventDefault();
                          const delta = e.key === 'ArrowUp' ? 1 : -1;
                          const nextStart = Math.max(1, Math.min(totalUnits - selectedItem.unitSize + 1, selectedItem.unitStart + delta));
                          if (nextStart === selectedItem.unitStart) return;
                          if (!isSlotFree(nextStart, selectedItem.unitSize, selectedItem.id)) return;
                          updateRackItem(plan.id, selectedItem.id, { unitStart: nextStart });
                        }}
                        className="relative rounded-xl border border-dashed border-slate-300 bg-slate-100"
                        style={{ height: rackHeight }}
                        onClick={(e) => {
                          if (!addPrompt || addPrompt.step !== 'place') return;
                          const container = rackRef.current;
                          if (!container) return;
                          const rect = container.getBoundingClientRect();
                          const y = e.clientY - rect.top;
                          const fromTop = Math.max(0, Math.min(totalUnits - 1, Math.floor(y / unitHeight)));
                          const start = totalUnits - fromTop - addPrompt.unitSize + 1;
                          const clamped = Math.max(1, Math.min(totalUnits - addPrompt.unitSize + 1, start));
                          createRackItemAt(addPrompt.type, addPrompt.unitSize, clamped);
                        }}
                      >
                        {addPrompt?.step === 'place' ? (
                          <div className="pointer-events-none absolute inset-0 flex items-start justify-center">
                            <div className="mt-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
                              {t({ it: 'Clicca sul rack per posizionare', en: 'Click the rack to place' })}
                            </div>
                          </div>
                        ) : null}
                        {filteredRackItems.map(itemCard)}
                        {contextMenu ? (
                          <div
                            className="absolute z-10 w-36 rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-card"
                            style={{
                              top: contextMenu.y - (rackRef.current?.getBoundingClientRect().top || 0),
                              left: contextMenu.x - (rackRef.current?.getBoundingClientRect().left || 0)
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => {
                                const item = rackItems.find((entry) => entry.id === contextMenu.itemId);
                                if (item) openEditPrompt(item);
                                setContextMenu(null);
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                            >
                              {t({ it: 'Configura', en: 'Configure' })}
                            </button>
                            {(() => {
                              const item = rackItems.find((entry) => entry.id === contextMenu.itemId);
                              if (!item || !hasPorts(item)) return null;
                              return (
                                <button
                                  onClick={() => {
                                    setPortsModalItemId(item.id);
                                    setPortsModalShowConnections(false);
                                    window.setTimeout(() => setContextMenu(null), 0);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50"
                                >
                                  {t({ it: 'Porte', en: 'Ports' })}
                                </button>
                              );
                            })()}
                            <button
                              onClick={() => {
                                if (readOnly) return;
                                setContextMenu(null);
                                setDeletePrompt({ mode: 'single', itemId: contextMenu.itemId });
                              }}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-rose-600 hover:bg-rose-50"
                            >
                              {t({ it: 'Elimina', en: 'Delete' })}
                            </button>
                            {(() => {
                              const item = rackItems.find((entry) => entry.id === contextMenu.itemId);
                                  const ip =
                                    item?.type === 'switch'
                                      ? item?.mgmtIp || ''
                                      : item?.type === 'server'
                                        ? item?.ip || ''
                                        : '';
                                  if (!ip) return null;
                                  const rawIp = normalizeIp(ip);
                                  return (
                                    <div className="mt-1 border-t border-slate-200 pt-1">
                                      <div className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-400">
                                        {t({ it: 'Vai', en: 'Go to' })}
                                      </div>
                                      <a
                                        href={`https://${rawIp}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-primary hover:bg-slate-50"
                                      >
                                        HTTPS
                                      </a>
                                      <a
                                        href={`http://${rawIp}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-primary hover:bg-slate-50"
                                      >
                                        HTTP
                                      </a>
                                    </div>
                                  );
                                })()}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Dettaglio apparato', en: 'Device details' })}</div>
                      {selectedItem && rackDisplayName ? (
                        <div className="mt-1 text-xs font-semibold text-sky-600">{rackDisplayName}</div>
                      ) : null}
                      {selectedItem && draft ? (
                        <div className="mt-2 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome', en: 'Name' })}
                            <input
                              ref={selectedNameRef}
                              value={draft.name}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          {selectedItem.type !== 'misc' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Marca', en: 'Brand' })}
                                <input
                                  value={draft.brand}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Modello', en: 'Model' })}
                                <input
                                  value={draft.model}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                            </div>
                          ) : null}
                          {(selectedItem.type === 'switch' || selectedItem.type === 'server') ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Nome host', en: 'Host name' })}
                              <input
                                value={draft.hostName}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, hostName: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          ) : null}
                          {selectedItem.type === 'switch' ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'IP gestione', en: 'Management IP' })}
                              <input
                                value={draft.mgmtIp}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, mgmtIp: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                              {draft.mgmtIp.trim() ? (
                                <a
                                  href={toUrl(draft.mgmtIp)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline"
                                >
                                  {t({ it: 'Apri IP gestione', en: 'Open management IP' })}
                                </a>
                              ) : null}
                            </label>
                          ) : null}
                          {selectedItem.type === 'server' ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'IP address', en: 'IP address' })}
                              <input
                                value={draft.ip}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, ip: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                              {draft.ip.trim() ? (
                                <a
                                  href={toUrl(draft.ip)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline"
                                >
                                  {t({ it: 'Apri IP server', en: 'Open server IP' })}
                                </a>
                              ) : null}
                            </label>
                          ) : null}
                          {selectedItem.type === 'server' ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'DELL iDRAC IP', en: 'Dell iDRAC IP' })}
                              <input
                                value={draft.idracIp}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, idracIp: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                              {draft.idracIp.trim() ? (
                                <a
                                  href={toUrl(draft.idracIp)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline"
                                >
                                  {t({ it: 'Apri iDRAC', en: 'Open iDRAC' })}
                                </a>
                              ) : null}
                            </label>
                          ) : null}
                          {(selectedItem.type === 'switch' || selectedItem.type === 'server') ? (
                            <>
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={draft.dualPower}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, dualPower: e.target.checked } : prev))}
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                                />
                                {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                              </label>
                            </>
                          ) : null}
                          {selectedItem.type === 'server' ? (
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={draft.rails}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, rails: e.target.checked } : prev))}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                              />
                              {t({ it: 'Slitte', en: 'Rails' })}
                            </label>
                          ) : null}
                          {selectedItem.type === 'ups' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Data manutenzione', en: 'Maintenance date' })}
                                <input
                                  type="date"
                                  value={draft.maintenanceDate}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, maintenanceDate: e.target.value } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Cambio batterie', en: 'Battery change' })}
                                <input
                                  type="date"
                                  value={draft.batteryChangeDate}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, batteryChangeDate: e.target.value } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                            </div>
                          ) : null}
                          {selectedItem.type === 'power_strip' ? (
                            <div className="grid grid-cols-2 gap-2">
                              <label className="block text-sm font-medium text-slate-700">
                                {t({ it: 'Numero prese', en: 'Outlets' })}
                                <input
                                  type="number"
                                  min={0}
                                  value={draft.outlets}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, outlets: Number(e.target.value) || 0 } : prev))}
                                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                                />
                              </label>
                              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={draft.mainSwitch}
                                  onChange={(e) => setDraft((prev) => (prev ? { ...prev, mainSwitch: e.target.checked } : prev))}
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                                />
                                {t({ it: 'Interruttore generale', en: 'Main switch' })}
                              </label>
                            </div>
                          ) : null}
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={3}
                              value={draft.notes}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Unità (U)', en: 'Units (U)' })}
                              <input
                                type="number"
                                min={1}
                                max={totalUnits}
                                value={draft.unitSize}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, unitSize: Number(e.target.value) || 1 } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Unità start', en: 'Start unit' })}
                              <input
                                type="number"
                                min={1}
                                max={totalUnits}
                                value={draft.unitStart}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, unitStart: Number(e.target.value) || 1 } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          {hasEth(selectedItem.type) ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {selectedItem.type === 'switch'
                                ? t({ it: 'Porte rame', en: 'Ethernet ports' })
                                : t({ it: 'Numero porte', en: 'Ports count' })}
                              <input
                                type="number"
                                min={0}
                                value={draft.ethPorts}
                                onChange={(e) =>
                                  setDraft((prev) => {
                                    if (!prev) return prev;
                                    const nextEth = Number(e.target.value) || 0;
                                    return { ...prev, ethPorts: nextEth };
                                  })
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          ) : null}
                          {hasFiber(selectedItem.type) ? (
                            <label className="block text-sm font-medium text-slate-700">
                              {selectedItem.type === 'switch'
                                ? t({ it: 'Porte fibra', en: 'Fiber ports' })
                                : t({ it: 'Numero porte', en: 'Ports count' })}
                              <input
                                type="number"
                                min={0}
                                value={draft.fiberPorts}
                                onChange={(e) => setDraft((prev) => (prev ? { ...prev, fiberPorts: Number(e.target.value) || 0 } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          ) : null}
                          {hasPorts(selectedItem) ? (
                            <button
                              onClick={() => {
                                setPortsModalItemId(selectedItem.id);
                                setPortsModalShowConnections(false);
                              }}
                              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t({ it: 'Configurazione porte', en: 'Port configuration' })}
                            </button>
                          ) : null}
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              onClick={handleSaveItem}
                              disabled={readOnly}
                              className={`rounded-lg px-3 py-2 text-sm font-semibold text-white ${readOnly ? 'bg-slate-300' : 'bg-primary hover:bg-primary/90'}`}
                            >
                              {t({ it: 'Salva apparato', en: 'Save device' })}
                            </button>
                            <button
                              onClick={() => {
                                if (readOnly) return;
                                deleteRackItem(plan.id, selectedItem.id);
                                setSelectedItemId(null);
                              }}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-slate-500">
                          {t({ it: 'Seleziona un apparato nel rack.', en: 'Select a device inside the rack.' })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {addPrompt?.step === 'units' ? (
                  <div
                    className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        setAddPrompt(null);
                      }
                    }}
                  >
                    <div
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                      aria-hidden="true"
                      onClick={() => setAddPrompt(null)}
                    />
                    <div
                      className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-lg font-semibold text-ink">
                        {t({ it: 'Unità apparato', en: 'Device units' })}
                      </div>
                      {addPrompt ? (
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          {typeLabels[addPrompt.type]?.it || addPrompt.type}
                        </div>
                      ) : null}
                      <div className="mt-2 text-sm text-slate-600">
                        {t({ it: 'Specifica quante unità U occupa questo apparato.', en: 'Choose how many rack units this device occupies.' })}
                      </div>
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Unità (U)', en: 'Units (U)' })}
                          <input
                            ref={addPromptFocusRef}
                            type="number"
                            min={1}
                            max={totalUnits}
                            value={addUnitSize}
                            onChange={(e) => setAddUnitSize(Math.max(1, Math.min(totalUnits, Number(e.target.value) || 1)))}
                            autoFocus
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                      </div>
                      {addPrompt?.type === 'switch' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome host', en: 'Host name' })}
                            <input
                              value={addDetails.hostName}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, hostName: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'IP gestione', en: 'Management IP' })}
                            <input
                              value={addDetails.mgmtIp}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, mgmtIp: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte rame', en: 'Ethernet ports' })}
                              <input
                                type="number"
                                min={0}
                                value={addDetails.ethPorts}
                                onChange={(e) =>
                                  setAddDetails((prev) => ({ ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte fibra', en: 'Fiber ports' })}
                              <input
                                type="number"
                                min={0}
                                value={addDetails.fiberPorts}
                                onChange={(e) =>
                                  setAddDetails((prev) => ({ ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={addDetails.dualPower}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, dualPower: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'server' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome server', en: 'Server name' })}
                            <input
                              value={addDetails.name}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, name: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome host', en: 'Host name' })}
                            <input
                              value={addDetails.hostName}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, hostName: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'IP address', en: 'IP address' })}
                            <input
                              value={addDetails.ip}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, ip: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'DELL iDRAC IP', en: 'Dell iDRAC IP' })}
                            <input
                              value={addDetails.idracIp}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, idracIp: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={addDetails.rails}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, rails: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Slitte', en: 'Rails' })}
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={addDetails.dualPower}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, dualPower: e.target.checked }))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'patchpanel' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Numero porte', en: 'Ports count' })}
                            <input
                              type="number"
                              min={0}
                              value={addDetails.ethPorts}
                              onChange={(e) =>
                                setAddDetails((prev) => ({ ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'optical_drawer' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Connettore fibra', en: 'Fiber connector' })}
                            <select
                              value={addDetails.connectorType}
                              onChange={(e) =>
                                setAddDetails((prev) => ({ ...prev, connectorType: e.target.value as 'SC' | 'LC' | 'ST' | 'FC' }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            >
                              <option value="SC">SC</option>
                              <option value="LC">LC</option>
                              <option value="ST">ST</option>
                              <option value="FC">FC</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Numero porte', en: 'Ports count' })}
                            <input
                              type="number"
                              min={0}
                              value={addDetails.fiberPorts}
                              onChange={(e) =>
                                setAddDetails((prev) => ({ ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) }))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'ups' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Data manutenzione', en: 'Maintenance date' })}
                              <input
                                type="date"
                                value={addDetails.maintenanceDate}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, maintenanceDate: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Cambio batterie', en: 'Battery change' })}
                              <input
                                type="date"
                                value={addDetails.batteryChangeDate}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, batteryChangeDate: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'power_strip' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={addDetails.brand}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, brand: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={addDetails.model}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, model: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Numero prese', en: 'Outlets' })}
                              <input
                                type="number"
                                min={0}
                                value={addDetails.outlets}
                                onChange={(e) =>
                                  setAddDetails((prev) => ({ ...prev, outlets: Math.max(0, Number(e.target.value) || 0) }))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={addDetails.mainSwitch}
                                onChange={(e) => setAddDetails((prev) => ({ ...prev, mainSwitch: e.target.checked }))}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                              />
                              {t({ it: 'Interruttore generale', en: 'Main switch' })}
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {addPrompt?.type === 'misc' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={addDetails.notes}
                              onChange={(e) => setAddDetails((prev) => ({ ...prev, notes: e.target.value }))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => setAddPrompt(null)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {t({ it: 'Annulla', en: 'Cancel' })}
                        </button>
                        <button
                          onClick={handleConfirmAdd}
                          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                        >
                          {t({ it: 'Aggiungi', en: 'Add' })}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
                {editPrompt && editDetails ? (
                  <div
                    className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        setEditPrompt(null);
                      }
                    }}
                  >
                    <div
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                      aria-hidden="true"
                      onClick={() => setEditPrompt(null)}
                    />
                    <div
                      className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-lg font-semibold text-ink">
                        {t({ it: 'Configura apparato', en: 'Configure device' })}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {t({ it: 'Aggiorna i dati dell’apparato selezionato.', en: 'Update the selected device data.' })}
                      </div>
                      {(() => {
                        const item = rackItems.find((entry) => entry.id === editPrompt.itemId);
                        if (!item) return null;
                        const endUnit = item.unitStart + item.unitSize - 1;
                        return (
                          <div className="mt-1 text-xs font-semibold text-slate-500">
                            {t({ it: `Unità: ${item.unitStart}-${endUnit}`, en: `Units: ${item.unitStart}-${endUnit}` })}
                          </div>
                        );
                      })()}
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-slate-700">
                          {t({ it: 'Unità (U)', en: 'Units (U)' })}
                          <input
                            type="number"
                            min={1}
                            max={totalUnits}
                            value={editUnitSize}
                            onChange={(e) => setEditUnitSize(Math.max(1, Math.min(totalUnits, Number(e.target.value) || 1)))}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                          />
                        </label>
                      </div>
                      {editPrompt.type === 'switch' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome host', en: 'Host name' })}
                            <input
                              value={editDetails.hostName}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, hostName: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'IP gestione', en: 'Management IP' })}
                            <input
                              value={editDetails.mgmtIp}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, mgmtIp: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte rame', en: 'Ethernet ports' })}
                              <input
                                type="number"
                                min={0}
                                value={editDetails.ethPorts}
                                onChange={(e) =>
                                  setEditDetails((prev) => (prev ? { ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Porte fibra', en: 'Fiber ports' })}
                              <input
                                type="number"
                                min={0}
                                value={editDetails.fiberPorts}
                                onChange={(e) =>
                                  setEditDetails((prev) => (prev ? { ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={editDetails.dualPower}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, dualPower: e.target.checked } : prev))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'server' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome server', en: 'Server name' })}
                            <input
                              value={editDetails.name}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Nome host', en: 'Host name' })}
                            <input
                              value={editDetails.hostName}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, hostName: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'IP address', en: 'IP address' })}
                            <input
                              value={editDetails.ip}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, ip: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'DELL iDRAC IP', en: 'Dell iDRAC IP' })}
                            <input
                              value={editDetails.idracIp}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, idracIp: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={editDetails.rails}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, rails: e.target.checked } : prev))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Slitte', en: 'Rails' })}
                          </label>
                          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={editDetails.dualPower}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, dualPower: e.target.checked } : prev))}
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                            />
                            {t({ it: 'Doppia alimentazione', en: 'Dual power supply' })}
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'patchpanel' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Numero porte', en: 'Ports count' })}
                            <input
                              type="number"
                              min={0}
                              value={editDetails.ethPorts}
                              onChange={(e) =>
                                setEditDetails((prev) => (prev ? { ...prev, ethPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'optical_drawer' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Connettore fibra', en: 'Fiber connector' })}
                            <select
                              value={editDetails.connectorType}
                              onChange={(e) =>
                                setEditDetails((prev) =>
                                  prev ? { ...prev, connectorType: e.target.value as 'SC' | 'LC' | 'ST' | 'FC' } : prev
                                )
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            >
                              <option value="SC">SC</option>
                              <option value="LC">LC</option>
                              <option value="ST">ST</option>
                              <option value="FC">FC</option>
                            </select>
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Numero porte', en: 'Ports count' })}
                            <input
                              type="number"
                              min={0}
                              value={editDetails.fiberPorts}
                              onChange={(e) =>
                                setEditDetails((prev) => (prev ? { ...prev, fiberPorts: Math.max(0, Number(e.target.value) || 0) } : prev))
                              }
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'ups' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Data manutenzione', en: 'Maintenance date' })}
                              <input
                                type="date"
                                value={editDetails.maintenanceDate}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, maintenanceDate: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Cambio batterie', en: 'Battery change' })}
                              <input
                                type="date"
                                value={editDetails.batteryChangeDate}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, batteryChangeDate: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'power_strip' ? (
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Marca', en: 'Brand' })}
                              <input
                                value={editDetails.brand}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, brand: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Modello', en: 'Model' })}
                              <input
                                value={editDetails.model}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, model: e.target.value } : prev))}
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <label className="block text-sm font-medium text-slate-700">
                              {t({ it: 'Numero prese', en: 'Outlets' })}
                              <input
                                type="number"
                                min={0}
                                value={editDetails.outlets}
                                onChange={(e) =>
                                  setEditDetails((prev) => (prev ? { ...prev, outlets: Math.max(0, Number(e.target.value) || 0) } : prev))
                                }
                                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                              />
                            </label>
                            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={editDetails.mainSwitch}
                                onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, mainSwitch: e.target.checked } : prev))}
                                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/40"
                              />
                              {t({ it: 'Interruttore generale', en: 'Main switch' })}
                            </label>
                          </div>
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      {editPrompt.type === 'misc' ? (
                        <div className="mt-4 space-y-2">
                          <label className="block text-sm font-medium text-slate-700">
                            {t({ it: 'Note', en: 'Notes' })}
                            <textarea
                              rows={2}
                              value={editDetails.notes}
                              onChange={(e) => setEditDetails((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                            />
                          </label>
                        </div>
                      ) : null}
                      <div className="mt-4 flex justify-between gap-2">
                        {(() => {
                          const item = rackItems.find((entry) => entry.id === editPrompt.itemId);
                          if (!item || !hasPorts(item)) return <div />;
                          return (
                            <button
                              onClick={() => {
                                setPortsModalItemId(item.id);
                                setPortsModalShowConnections(false);
                                window.setTimeout(() => setEditPrompt(null), 0);
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              {t({ it: 'Configurazione porte', en: 'Port configuration' })}
                            </button>
                          );
                        })()}
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditPrompt(null)}
                            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {t({ it: 'Annulla', en: 'Cancel' })}
                          </button>
                          <button
                            onClick={handleConfirmEdit}
                            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                          >
                            {t({ it: 'Salva', en: 'Save' })}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {deletePrompt ? (
                  <div
                    className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        e.preventDefault();
                        setDeletePrompt(null);
                      }
                    }}
                  >
                    <div
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                      aria-hidden="true"
                      onClick={() => setDeletePrompt(null)}
                    />
                    <div
                      className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-lg font-semibold text-ink">
                        {t({ it: 'Conferma eliminazione', en: 'Confirm deletion' })}
                      </div>
                      <div className="mt-2 text-sm text-slate-600">
                        {deletePrompt.mode === 'all'
                          ? t({
                              it: 'Vuoi eliminare tutti gli apparati dal rack?',
                              en: 'Do you want to delete all devices from the rack?'
                            })
                          : (() => {
                              const item = rackItems.find((entry) => entry.id === deletePrompt.itemId);
                              if (!item) return '';
                              return t({
                                it: `Vuoi eliminare l'oggetto: ${formatItemLabel(item)} dal rack?`,
                                en: `Do you want to remove: ${formatItemLabel(item)} from the rack?`
                              });
                            })()}
                      </div>
                      {deletePrompt.mode === 'all' ? (
                        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          {rackItems.length === 0 ? (
                            <div>{t({ it: 'Nessun apparato presente.', en: 'No devices found.' })}</div>
                          ) : (
                            rackItems.map((item) => (
                              <div key={item.id} className="py-0.5">
                                {formatItemLabel(item)}
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                      <div className="mt-4 flex justify-end gap-2">
                        <button
                          onClick={() => setDeletePrompt(null)}
                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {t({ it: 'Annulla', en: 'Cancel' })}
                        </button>
                        <button
                          onClick={handleConfirmDelete}
                          className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                        >
                          {t({ it: 'Elimina', en: 'Delete' })}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Dialog.Panel>
          </div>
        </div>
      </Dialog>
      <RackPortsModal
        open={!!portsModalItemId}
        item={portsModalItem}
        racks={plan.racks || []}
        rackItems={allRackItems}
        rackLinks={plan.rackLinks || []}
        readOnly={readOnly}
        initialConnectionsOpen={portsModalShowConnections}
        onClose={() => {
          setPortsModalItemId(null);
          setPortsModalShowConnections(false);
        }}
        onAddLink={(payload) => addRackLink(plan.id, payload)}
        onDeleteLink={(linkId) => deleteRackLink(plan.id, linkId)}
        onRenamePort={handleRenamePort}
        onSavePortNote={handleSavePortNote}
      />
    </>
  );
};

export default RackModal;
