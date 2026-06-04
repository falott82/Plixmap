import { useEffect, useMemo, useRef, useState } from 'react';
import jsPDF from 'jspdf';
import { Cable, Link2 } from 'lucide-react';
import { useDataStore } from '../../store/useDataStore';
import { RackItem, RackItemType, RackPortKind } from '../../store/types';
import { useT } from '../../i18n/useT';
import { useToastStore } from '../../store/useToast';

import { RackItemDraft, Props, unitHeight, typeLabels, typeColors, normalizeRackName } from './RackModal.helpers';
import { RackModalBody } from './RackModalBody';

const RackModal = ({ open, plan, rackObjectId, rackObjectName, readOnly = false, onClose }: Props) => {
  const t = useT();
  const getTypeLabel = (type: RackItemType) => {
    const label = typeLabels[type];
    return label ? t(label) : type;
  };
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
  const rackNameCandidate = (name || '').trim() || t({ it: 'Rack', en: 'Rack' });
  const rackNameKey = normalizeRackName(rackNameCandidate);
  const duplicateRackName = useMemo(() => {
    if (!rackNameKey) return false;
    const rackEntries =
      (plan.racks || []).length > 0
        ? plan.racks || []
        : (plan.objects || []).filter((obj) => obj.type === 'rack').map((obj) => ({ id: obj.id, name: obj.name || '' }));
    return rackEntries.some((entry) => entry.id !== rackObjectId && normalizeRackName(String(entry.name || '')) === rackNameKey);
  }, [plan.objects, plan.racks, rackNameKey, rackObjectId]);
  const rackNameInputClass = rackNameKey
    ? duplicateRackName
      ? 'border-rose-300 bg-rose-50 text-rose-700 focus:ring-rose-200'
      : 'border-emerald-200 bg-emerald-50 text-slate-800 focus:ring-emerald-200'
    : 'border-slate-200';
  const [addPrompt, setAddPrompt] = useState<{
    type: RackItemType;
    step: 'units' | 'place';
    unitSize: number;
    preferredY?: number | null;
    mode?: 'add' | 'clone';
    sourceId?: string;
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
  const selectionRef = useRef<{ id: string; ts: number } | null>(null);
  const lastRackIdRef = useRef<string | null>(null);
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
      const typeLabel = typeLabels[item.type];
      const labelIt = typeLabel?.it || item.type;
      const labelEn = typeLabel?.en || item.type;
      const baseName =
        item.type === 'switch' || item.type === 'router' || item.type === 'firewall' || item.type === 'server'
          ? item.hostName || ''
          : item.name || '';
      const hay = `${baseName} ${labelIt} ${labelEn}`.toLowerCase();
      return hay.includes(term);
    });
  }, [rackItems, rackSearch]);

  useEffect(() => {
    if (!open) {
      lastRackIdRef.current = null;
      rackInitRef.current = null;
      rackNotesDirtyRef.current = false;
      setSelectedItemId(null);
      return;
    }
    if (lastRackIdRef.current !== rackObjectId) {
      lastRackIdRef.current = rackObjectId;
      setSelectedItemId(null);
    }
    if (!rack) {
      if (rackInitRef.current === rackObjectId) return;
      const fallbackName = rackObjectName || t({ it: 'Rack', en: 'Rack' });
      ensureRack(plan.id, rackObjectId, { name: fallbackName, totalUnits: 42 });
      setName(fallbackName);
      setTotalUnits(42);
      setRackNotes('');
      rackInitRef.current = rackObjectId;
      rackNotesDirtyRef.current = false;
      return;
    }
    const isNewRack = rackInitRef.current !== rackObjectId;
    if (isNewRack) {
      setName(rack.name || rackObjectName);
      setTotalUnits(rack.totalUnits || 42);
      setRackNotes(rack.notes || '');
      rackInitRef.current = rackObjectId;
      rackNotesDirtyRef.current = false;
      return;
    }
    if (!rackNotesDirtyRef.current) {
      setRackNotes(rack.notes || '');
    }
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
    const recent = selectionRef.current && Date.now() - selectionRef.current.ts < 400;
    if (recent) return;
    if (!selectedItemId && rackItems.length === 1) {
      setSelectedItemId(rackItems[0]?.id || null);
    }
  }, [open, rackItems, selectedItemId]);

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

  const hasEth = (type: RackItemType) =>
    type === 'switch' || type === 'router' || type === 'firewall' || type === 'server' || type === 'patchpanel';
  const hasFiber = (type: RackItemType) =>
    type === 'switch' || type === 'router' || type === 'firewall' || type === 'server' || type === 'optical_drawer';
  const hasPorts = (item: RackItem | null) => {
    if (!item) return false;
    return hasEth(item.type) || hasFiber(item.type);
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
    setAddPrompt({ type, step: 'units', unitSize: 1, preferredY: preferredY ?? null, mode: 'add' });
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

  const openClonePrompt = (item: RackItem) => {
    if (readOnly) return;
    const size = Math.max(1, item.unitSize || 1);
    if (!findFirstSlot(size)) {
      push(t({ it: 'Nessuno slot disponibile per clonare questo apparato.', en: 'No available slot to clone this device.' }), 'info');
      return;
    }
    setAddUnitSize(item.unitSize || 1);
    setAddDetails(toEditDetails(item));
    setAddPrompt({
      type: item.type,
      step: 'units',
      unitSize: item.unitSize || 1,
      preferredY: null,
      mode: 'clone',
      sourceId: item.id
    });
  };

  const handleDrop = (evt: React.DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    if (readOnly) return;
    dropAcceptedRef.current = true;
    const droppedType =
      evt.dataTransfer.getData('application/plixmap-rack-type') as RackItemType | '';
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
    const targetEl = (evt.target as HTMLElement | null)?.closest?.('[data-rack-item-id]') as HTMLElement | null;
    const targetId = targetEl?.getAttribute('data-rack-item-id') || '';
    if (targetId && targetId !== itemId) {
      const targetItem = rackItems.find((entry) => entry.id === targetId);
      if (!targetItem) return;
      if (targetItem.unitSize !== item.unitSize) {
        push(
          t({
            it: 'Scambio possibile solo con apparati della stessa dimensione (U).',
            en: 'Swap is only possible with devices of the same unit size.'
          }),
          'info'
        );
        return;
      }
      updateRackItem(plan.id, item.id, { unitStart: targetItem.unitStart });
      updateRackItem(plan.id, targetItem.id, { unitStart: item.unitStart });
      setSelectedItemId(item.id);
      return;
    }
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
    if (!normalizeRackName(trimmed)) {
      push(t({ it: 'Inserisci un nome rack valido.', en: 'Enter a valid rack name.' }), 'info');
      return;
    }
    if (duplicateRackName) {
      push(
        t({
          it: 'Esiste già un rack con questo nome nella planimetria. Scegli un nome diverso.',
          en: 'A rack with this name already exists in this floor plan. Choose a different name.'
        }),
        'info'
      );
      return;
    }
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
        const label = `${getRackItemLabel(item)} · ${item.unitSize}U · ${getTypeLabel(item.type)}`;
        const ip =
          (item.type === 'switch' || item.type === 'router' || item.type === 'firewall') && item.mgmtIp
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
      push(t({ it: 'Errore durante l’export PDF', en: 'PDF export failed' }), 'danger');
    }
  };

  const handleSaveItem = () => {
    if (readOnly || !selectedItem || !draft) return;
    const mainLabel = hasHostName(selectedItem.type) ? draft.hostName.trim() : draft.name.trim();
    if (!mainLabel) return;
    if (!isSlotFree(draft.unitStart, draft.unitSize, selectedItem.id)) {
      push(t({ it: 'La posizione è occupata.', en: 'Selected slot is occupied.' }), 'info');
      return;
    }
    const nextEthPorts = hasEth(selectedItem.type) ? Math.max(0, draft.ethPorts || 0) : 0;
    const nextFiberPorts = hasFiber(selectedItem.type) ? Math.max(0, draft.fiberPorts || 0) : 0;
    const nextEthStart = 1;
    const nextFiberStart = Math.max(1, nextEthStart + nextEthPorts);
    updateRackItem(plan.id, selectedItem.id, {
      name: hasHostName(selectedItem.type) ? (draft.hostName.trim() || draft.name.trim()) : draft.name.trim(),
      brand: draft.brand.trim(),
      model: draft.model.trim(),
      ip: draft.ip.trim(),
      hostName: hasHostName(selectedItem.type) ? draft.hostName.trim() : '',
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
    const hostName = editDetails.hostName.trim();
    const nextName = hasHostName(item.type) ? (hostName || item.name) : editDetails.name.trim() || item.name;
    updateRackItem(plan.id, item.id, {
      name: nextName,
      brand: editDetails.brand.trim(),
      model: editDetails.model.trim(),
      ip: item.type === 'server' ? editDetails.ip.trim() : '',
      hostName: hasHostName(item.type) ? hostName : '',
      mgmtIp: item.type === 'switch' || item.type === 'router' || item.type === 'firewall' ? editDetails.mgmtIp.trim() : '',
      idracIp: item.type === 'server' ? editDetails.idracIp.trim() : '',
      dualPower:
        item.type === 'switch' || item.type === 'router' || item.type === 'firewall' || item.type === 'server'
          ? editDetails.dualPower
          : false,
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
    return `${getTypeLabel(item.type)}${host}`;
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
  const hasHostName = (type: RackItemType) =>
    type === 'switch' || type === 'router' || type === 'firewall' || type === 'server';
  const normalizeIp = (value: string) => value.trim().replace(/^https?:\/\//i, '');
  const normalizeName = (value: string) => value.trim().toLowerCase();
  const toUrl = (value: string, protocol: 'http' | 'https' = 'http') => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return `${protocol}://${normalizeIp(trimmed)}`;
  };
  const getPrimaryIp = (entry: RackItem) => {
    if (entry.type === 'server') return normalizeIp(entry.ip || '');
    if (entry.type === 'switch' || entry.type === 'router' || entry.type === 'firewall') return normalizeIp(entry.mgmtIp || '');
    return '';
  };
  const getItemIdentityName = (entry: RackItem) =>
    normalizeName(hasHostName(entry.type) ? entry.hostName || '' : entry.name || '');
  const getDraftIdentityName = (type: RackItemType) =>
    normalizeName(hasHostName(type) ? addDetails.hostName || '' : addDetails.name || '');
  const getDraftPrimaryIp = (type: RackItemType) => {
    if (type === 'server') return normalizeIp(addDetails.ip);
    if (type === 'switch' || type === 'router' || type === 'firewall') return normalizeIp(addDetails.mgmtIp);
    return '';
  };
  const getRackItemLabel = (entry: RackItem) => {
    if (hasHostName(entry.type)) {
      const host = entry.hostName?.trim();
      return host || t({ it: 'Senza hostname', en: 'No hostname' });
    }
    return entry.name?.trim() || getTypeLabel(entry.type);
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
    const nameBase = getTypeLabel(type) || 'Item';
    const sameTypeCount = rackItems.filter((i) => i.type === type).length + 1;
    const ethPorts = hasEth(type) ? Math.max(0, addDetails.ethPorts) : 0;
    const fiberPorts = hasFiber(type) ? Math.max(0, addDetails.fiberPorts) : 0;
    const ethRangeStart = 1;
    const fiberRangeStart = Math.max(1, ethRangeStart + ethPorts);
    const finalHostName = addDetails.hostName.trim();
    const finalName =
      hasHostName(type) && finalHostName ? finalHostName : addDetails.name.trim() ? addDetails.name.trim() : `${nameBase} ${sameTypeCount}`;
    const finalMgmtIp = addDetails.mgmtIp.trim();
    const finalIdracIp = addDetails.idracIp.trim();
    const finalIp = addDetails.ip.trim();
    if (addPrompt?.mode === 'clone') {
      const normalizedName = getDraftIdentityName(type);
      if (normalizedName && rackItems.some((entry) => getItemIdentityName(entry) === normalizedName)) {
        push(
          hasHostName(type)
            ? t({
                it: 'Hostname già presente nel rack. Modificalo per continuare.',
                en: 'Hostname already used in this rack. Change it to continue.'
              })
            : t({
                it: 'Nome già presente nel rack. Modificalo per continuare.',
                en: 'Name already used in this rack. Change it to continue.'
              }),
          'danger'
        );
        return false;
      }
      const normalizedIp = getDraftPrimaryIp(type);
      if (normalizedIp && rackItems.some((entry) => getPrimaryIp(entry) === normalizedIp)) {
        push(
          t({
            it: 'IP già presente nel rack. Modificalo per continuare.',
            en: 'IP already used in this rack. Change it to continue.'
          }),
          'danger'
        );
        return false;
      }
    }
    const cloneSource =
      addPrompt?.mode === 'clone' && addPrompt.sourceId ? rackItems.find((entry) => entry.id === addPrompt.sourceId) : null;
    const trimPorts = (list: string[] | undefined, count: number) => {
      if (!list || !count) return undefined;
      return list.slice(0, count);
    };
    const useBrandModel =
      type === 'switch' ||
      type === 'router' ||
      type === 'firewall' ||
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
      hostName: hasHostName(type) ? finalHostName : '',
      mgmtIp: type === 'switch' || type === 'router' || type === 'firewall' ? finalMgmtIp : '',
      idracIp: type === 'server' ? finalIdracIp : '',
      dualPower:
        type === 'switch' || type === 'router' || type === 'firewall' || type === 'server' ? addDetails.dualPower : false,
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
      fiberRangeStart,
      ethPortNames: cloneSource ? trimPorts(cloneSource.ethPortNames, ethPorts) : undefined,
      fiberPortNames: cloneSource ? trimPorts(cloneSource.fiberPortNames, fiberPorts) : undefined,
      ethPortNotes: cloneSource ? trimPorts(cloneSource.ethPortNotes, ethPorts) : undefined,
      fiberPortNotes: cloneSource ? trimPorts(cloneSource.fiberPortNotes, fiberPorts) : undefined
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
    if (addPrompt.mode === 'clone') {
      const nameBase = getTypeLabel(addPrompt.type) || 'Item';
      const sameTypeCount = rackItems.filter((entry) => entry.type === addPrompt.type).length + 1;
      const finalName =
        hasHostName(addPrompt.type) && addDetails.hostName.trim()
          ? addDetails.hostName.trim()
          : addDetails.name.trim() || `${nameBase} ${sameTypeCount}`;
      const normalizedName = getDraftIdentityName(addPrompt.type) || normalizeName(finalName);
      if (normalizedName && rackItems.some((entry) => getItemIdentityName(entry) === normalizedName)) {
        push(
          hasHostName(addPrompt.type)
            ? t({
                it: 'Hostname già presente nel rack. Modificalo per continuare.',
                en: 'Hostname already used in this rack. Change it to continue.'
              })
            : t({
                it: 'Nome già presente nel rack. Modificalo per continuare.',
                en: 'Name already used in this rack. Change it to continue.'
              }),
          'danger'
        );
        return;
      }
      const normalizedIp = getDraftPrimaryIp(addPrompt.type);
      if (normalizedIp && rackItems.some((entry) => getPrimaryIp(entry) === normalizedIp)) {
        push(
          t({
            it: 'IP già presente nel rack. Modificalo per continuare.',
            en: 'IP already used in this rack. Change it to continue.'
          }),
          'danger'
        );
        return;
      }
    }
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
    const mainLabel = getRackItemLabel(item);
    const ipSuffix =
      (item.type === 'switch' || item.type === 'router' || item.type === 'firewall') && item.mgmtIp
        ? item.mgmtIp
        : item.type === 'server' && item.ip
          ? item.ip
          : '';
    const selectItem = (event?: React.MouseEvent | React.PointerEvent) => {
      if (event && 'button' in event && (event.button === 2 || event.ctrlKey)) return;
      selectionRef.current = { id: item.id, ts: Date.now() };
      setSelectedItemId(item.id);
      rackRef.current?.focus();
    };
    return (
      <div
        key={item.id}
        data-rack-item-id={item.id}
        draggable={!readOnly}
        title={t({
          it: 'Trascina per spostare. Trascina su un altro apparato con stessa U per scambiare.',
          en: 'Drag to move. Drop on another device with same U to swap.'
        })}
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
        onPointerDown={(e) => {
          e.stopPropagation();
          selectItem(e);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          selectItem(e);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          selectItem(e);
          setContextMenu({ x: e.clientX, y: e.clientY, itemId: item.id });
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          selectItem(e);
          setContextMenu(null);
          openEditPrompt(item);
        }}
        onClick={(e) => {
          e.stopPropagation();
          selectItem(e);
        }}
        className={`absolute left-1 right-1 flex flex-col justify-center rounded-lg border px-2 text-[11px] font-semibold transition ${
          isSelected
            ? 'border-primary bg-primary/5 text-ink shadow-md ring-2 ring-primary/40'
            : 'border-slate-200 bg-white text-slate-700'
        } ${isFlash ? 'animate-pulse ring-2 ring-primary/40' : ''}`}
        style={{ top, height, borderLeftColor: color, borderLeftWidth: 6 }}
      >
        {singleLine ? (
          <div className="flex items-center justify-between gap-2">
            <span className="truncate">
              {mainLabel} · {item.unitSize}U · {getTypeLabel(item.type)}
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
              <span className="truncate">{mainLabel}</span>
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
            <div className="text-[10px] text-slate-500">{item.unitSize}U · {getTypeLabel(item.type)}</div>
          </>
        )}
      </div>
    );
  };

  const handleRackClose = () => {
    if (addPrompt || editPrompt || deletePrompt || portsModalItemId) return;
    onClose();
  };

  const addActionLabel =
    addPrompt?.mode === 'clone' ? t({ it: 'Clona', en: 'Clone' }) : t({ it: 'Aggiungi', en: 'Add' });

  return <RackModalBody {...{ name, addActionLabel, addDetails, addPrompt, addPromptFocusRef, addRackLink, addUnitSize, allRackItems, contextMenu, createRackItemAt, deletePrompt, deleteRackItem, deleteRackLink, draft, duplicateRackName, editDetails, editPrompt, editUnitSize, filteredRackItems, formatItemLabel, freeUnits, getTypeLabel, handleAddItem, handleConfirmAdd, handleConfirmDelete, handleConfirmEdit, handleDrop, handleExportRackPdf, handleRackClose, handleRenamePort, handleSaveItem, handleSavePortNote, handleSaveRack, hasEth, hasFiber, hasHostName, hasPorts, isSlotFree, itemCard, maxContiguousFree, normalizeIp, onClose, openClonePrompt, openEditPrompt, open, plan, portsModalItem, portsModalItemId, portsModalShowConnections, rackDialogFocusRef, rackDisplayName, rackHeight, rackItems, rackNameInputClass, rackNotes, rackNotesDirtyRef, rackRef, rackSearch, rackViewRef, readOnly, selectedItem, selectedNameRef, selectionRef, setAddDetails, setAddPrompt, setAddUnitSize, setContextMenu, setDeletePrompt, setDraft, setEditDetails, setEditPrompt, setEditUnitSize, setName, setPortsModalItemId, setPortsModalShowConnections, setRackNotes, setRackSearch, setSelectedItemId, setTotalUnits, t, totalUnits, toUrl, updateRackItem }} />;
};

export default RackModal;
