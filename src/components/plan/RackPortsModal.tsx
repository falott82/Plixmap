import { Dialog } from '@headlessui/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, Link2, Search, X } from 'lucide-react';
import { RackDefinition, RackItem, RackItemType, RackLink, RackPortKind } from '../../store/types';
import { useT } from '../../i18n/useT';
import { useToastStore } from '../../store/useToast';

type Props = {
  open: boolean;
  item: RackItem | null;
  racks: RackDefinition[];
  rackItems: RackItem[];
  rackLinks: RackLink[];
  readOnly?: boolean;
  initialConnectionsOpen?: boolean;
  initialConnectionsKind?: RackPortKind;
  closeOnBackdrop?: boolean;
  onClose: () => void;
  onAddLink: (payload: Omit<RackLink, 'id' | 'createdAt'>) => void;
  onDeleteLink: (id: string) => void;
  onRenamePort: (itemId: string, kind: RackPortKind, index: number, name: string) => void;
  onSavePortNote: (itemId: string, kind: RackPortKind, index: number, note: string) => void;
};

type LinkPrompt = {
  kind: RackPortKind;
  index: number;
  side?: PortSide;
  existingLinkId?: string;
};

type PortSide = 'female' | 'cable';

type RenamePrompt = {
  kind: RackPortKind;
  index: number;
};

type NotePrompt = {
  kind: RackPortKind;
  index: number;
};

type PathPart = {
  key: string;
  label: string;
  deviceType?: RackItemType;
  deviceId?: string;
  rackName?: string;
};

const speedOptions: Record<RackPortKind, { value: string; label: string }[]> = {
  ethernet: [
    { value: '1G', label: '1GB' },
    { value: '100M', label: '100M' }
  ],
  fiber: [
    { value: '1G', label: '1GB' },
    { value: '10G', label: '10G' },
    { value: '25G', label: '25G' }
  ]
};

const speedColors: Record<string, string> = {
  '100M': '#94a3b8',
  '1G': '#3b82f6',
  '10G': '#a855f7',
  '25G': '#f59e0b'
};

const kindDefaults: Record<RackPortKind, string> = {
  ethernet: '#3b82f6',
  fiber: '#a855f7'
};

const typeColors: Record<RackItemType, string> = {
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

const RackPortsModal = ({
  open,
  item,
  racks,
  rackItems,
  rackLinks,
  readOnly = false,
  initialConnectionsOpen = false,
  initialConnectionsKind,
  closeOnBackdrop = true,
  onClose,
  onAddLink,
  onDeleteLink,
  onRenamePort,
  onSavePortNote
}: Props) => {
  const t = useT();
  const { push } = useToastStore();
  const [linkPrompt, setLinkPrompt] = useState<LinkPrompt | null>(null);
  const [renamePrompt, setRenamePrompt] = useState<RenamePrompt | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [notePrompt, setNotePrompt] = useState<NotePrompt | null>(null);
  const [noteValue, setNoteValue] = useState('');
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const noteTitleId = useId();
  const noteDescriptionId = useId();
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connectionsExpanded, setConnectionsExpanded] = useState(false);
  const [connectionsOnlyActive, setConnectionsOnlyActive] = useState(true);
  const [connectionsKindFilter, setConnectionsKindFilter] = useState<'all' | 'ethernet' | 'fiber'>('all');
  const [connectionsQuery, setConnectionsQuery] = useState('');
  const [overwritePrompt, setOverwritePrompt] = useState<{ linkId: string } | null>(null);
  const [portPickerOpen, setPortPickerOpen] = useState(false);
  const [targetRackId, setTargetRackId] = useState('');
  const [targetItemId, setTargetItemId] = useState('');
  const [targetPortIndex, setTargetPortIndex] = useState(0);
  const [targetSide, setTargetSide] = useState<PortSide>('female');
  const [speed, setSpeed] = useState('1G');

  const itemId = item?.id || '';
  const allowSpeed = item?.type === 'switch';
  const canRename = item?.type === 'switch' && !readOnly;

  const getPortCount = (device: RackItem | null, kind: RackPortKind) => {
    if (!device) return 0;
    if (kind === 'ethernet') return Math.max(0, device.ethPorts || 0);
    return Math.max(0, device.fiberPorts || 0);
  };

  const isDualSide = (device: RackItem | null) => device?.type === 'patchpanel' || device?.type === 'optical_drawer';

  const getLinkForPort = (deviceId: string, kind: RackPortKind, index: number, side?: PortSide) => {
    const device = rackItems.find((d) => d.id === deviceId);
    const dual = isDualSide(device || null);
    const matchSide = dual && side;
    return activeRackLinks.find((l) => {
      if (l.fromItemId === deviceId && l.fromPortKind === kind && l.fromPortIndex === index) {
        if (!matchSide) return true;
        const fromSide = l.fromSide || 'female';
        return fromSide === side;
      }
      if (l.toItemId === deviceId && l.toPortKind === kind && l.toPortIndex === index) {
        if (!matchSide) return true;
        const toSide = l.toSide || 'female';
        return toSide === side;
      }
      return false;
    });
  };

  const getOtherSide = (link: RackLink, deviceId: string) => {
    if (link.fromItemId === deviceId) {
      return { itemId: link.toItemId, kind: link.toPortKind, index: link.toPortIndex, side: link.toSide };
    }
    return { itemId: link.fromItemId, kind: link.fromPortKind, index: link.fromPortIndex, side: link.fromSide };
  };

  const getDeviceLabel = (device: RackItem | null) => {
    if (!device) return '';
    const hasHost =
      device.type === 'switch' || device.type === 'router' || device.type === 'firewall' || device.type === 'server';
    if (hasHost) {
      return device.hostName?.trim() || t({ it: 'Senza hostname', en: 'No hostname' });
    }
    return device.name;
  };

  const getRackName = (rackId: string) => racks.find((r) => r.id === rackId)?.name || '';

  const rackName = item ? getRackName(item.rackId) : '';

  const getDefaultPortName = (device: RackItem | null, kind: RackPortKind, index: number) => {
    if (!device) return `${index}`;
    if (device.type === 'switch') {
      return kind === 'ethernet' ? `GE${index}` : `SFP${index}`;
    }
    return kind === 'ethernet' ? `ETH${index}` : `FIB${index}`;
  };

  const getPortDisplayName = (device: RackItem | null, kind: RackPortKind, index: number) => {
    if (!device) return `${index}`;
    const names = kind === 'ethernet' ? device.ethPortNames : device.fiberPortNames;
    const custom = names?.[index - 1];
    if (custom && custom.trim()) return custom.trim();
    return getDefaultPortName(device, kind, index);
  };

  const getPortNote = (device: RackItem | null, kind: RackPortKind, index: number) => {
    if (!device) return '';
    const notes = kind === 'ethernet' ? device.ethPortNotes : device.fiberPortNotes;
    const note = notes?.[index - 1];
    return note ? note.trim() : '';
  };

  const getGroupForType = (type?: RackItemType) => {
    if (type === 'server') return 'server';
    if (type === 'switch' || type === 'router' || type === 'firewall') return 'switch';
    if (type === 'patchpanel' || type === 'optical_drawer') return 'patch';
    return 'other';
  };

  const orientPath = (parts: PathPart[]) => {
    if (parts.length < 2) return parts;
    const available: Record<'server' | 'switch' | 'patch' | 'other', boolean> = {
      server: parts.some((p) => getGroupForType(p.deviceType) === 'server'),
      switch: parts.some((p) => getGroupForType(p.deviceType) === 'switch'),
      patch: parts.some((p) => getGroupForType(p.deviceType) === 'patch'),
      other: true
    };
    const pickGroup = (order: Array<'server' | 'switch' | 'patch' | 'other'>, fallback: 'server' | 'switch' | 'patch' | 'other') =>
      order.find((g) => available[g]) || fallback;
    const endGroup = pickGroup(['server', 'switch', 'patch', 'other'], 'other');
    const edgeGroup = pickGroup(['switch', 'patch', 'server', 'other'], endGroup);
    const middleGroup = pickGroup(['patch', 'switch', 'server', 'other'], endGroup);
    const length = parts.length;
    const expectedGroupFor = (pos: number) => {
      if (length === 2 && pos === 1) return edgeGroup;
      const dist = Math.min(pos, length - 1 - pos);
      if (dist === 0) return endGroup;
      if (dist === 1) return edgeGroup;
      return middleGroup;
    };
    const score = (list: { deviceType?: RackItemType }[]) =>
      list.reduce((acc, part, idx) => acc + (getGroupForType(part.deviceType) === expectedGroupFor(idx) ? 1 : 0), 0);
    const forwardScore = score(parts);
    const reversed = [...parts].reverse();
    const reverseScore = score(reversed);
    if (reverseScore > forwardScore) return reversed;
    if (reverseScore < forwardScore) return parts;
    const priority: Record<string, number> = { server: 3, switch: 2, patch: 1, other: 0 };
    const forwardStart = getGroupForType(parts[0].deviceType);
    const reverseStart = getGroupForType(reversed[0].deviceType);
    if (priority[reverseStart] > priority[forwardStart]) return reversed;
    return parts;
  };

  const activeRackLinks = useMemo(() => {
    if (!rackLinks.length) return [];
    const byId = new Map(rackItems.map((device) => [device.id, device]));
    const cleaned: RackLink[] = [];
    for (const link of rackLinks) {
      const fromDevice = byId.get(link.fromItemId);
      const toDevice = byId.get(link.toItemId);
      if (!fromDevice || !toDevice) continue;
      const fromCount = getPortCount(fromDevice, link.fromPortKind);
      const toCount = getPortCount(toDevice, link.toPortKind);
      if (!fromCount || !toCount) continue;
      if (link.fromPortIndex < 1 || link.fromPortIndex > fromCount) continue;
      if (link.toPortIndex < 1 || link.toPortIndex > toCount) continue;
      const normalized: RackLink = { ...link };
      if (isDualSide(fromDevice)) normalized.fromSide = normalized.fromSide || 'female';
      else normalized.fromSide = undefined;
      if (isDualSide(toDevice)) normalized.toSide = normalized.toSide || 'female';
      else normalized.toSide = undefined;
      cleaned.push(normalized);
    }
    if (cleaned.length <= 1) return cleaned;
    const sorted = [...cleaned].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    const used = new Set<string>();
    const deduped: RackLink[] = [];
    for (const link of sorted) {
      const fromKey = `${link.fromItemId}:${link.fromPortKind}:${link.fromPortIndex}:${link.fromSide || ''}`;
      const toKey = `${link.toItemId}:${link.toPortKind}:${link.toPortIndex}:${link.toSide || ''}`;
      if (used.has(fromKey) || used.has(toKey)) continue;
      used.add(fromKey);
      used.add(toKey);
      deduped.push(link);
    }
    return deduped;
  }, [rackItems, rackLinks]);

  const getPortKey = (deviceId: string, kind: RackPortKind, index: number, side?: PortSide) => {
    const device = rackItems.find((d) => d.id === deviceId) || null;
    const normalizedSide = isDualSide(device) ? side || 'female' : '';
    return `${deviceId}:${kind}:${index}:${normalizedSide}`;
  };

  const getLinksForPort = (deviceId: string, kind: RackPortKind, index: number, side?: PortSide) => {
    const key = getPortKey(deviceId, kind, index, side);
    return rackLinks.filter((link) => {
      const fromKey = getPortKey(link.fromItemId, link.fromPortKind, link.fromPortIndex, link.fromSide);
      const toKey = getPortKey(link.toItemId, link.toPortKind, link.toPortIndex, link.toSide);
      return fromKey === key || toKey === key;
    });
  };

  const getPortLabel = (deviceId: string, kind: RackPortKind, index: number, side?: PortSide) => {
    const device = rackItems.find((d) => d.id === deviceId);
    const rack = device ? getRackName(device.rackId) : '';
    const portLabel = getPortDisplayName(device || null, kind, index);
    const deviceLabel = getDeviceLabel(device || null);
    const sideLabel = side ? ` · ${side === 'female' ? 'Femmina' : 'Cablaggio'}` : '';
    return `${rack ? `${rack} / ` : ''}${deviceLabel} · ${portLabel}${sideLabel}`;
  };

  const getConnectionTitle = (link: RackLink | null, deviceId: string) => {
    if (!link) return '';
    const other = getOtherSide(link, deviceId);
    const targetDevice = rackItems.find((d) => d.id === other.itemId) || null;
    const rack = targetDevice ? getRackName(targetDevice.rackId) : '';
    const deviceLabel = getDeviceLabel(targetDevice);
    const portLabel = getPortDisplayName(targetDevice, other.kind, other.index);
    const sideLabel = other.side ? ` (${other.side === 'female' ? 'Femmina' : 'Cablaggio'})` : '';
    return `${rack} -> ${deviceLabel} -> ${portLabel}${sideLabel}`;
  };

  const findFreePorts = (deviceId: string, kind: RackPortKind, allowLinkId?: string, side?: PortSide) => {
    const device = rackItems.find((d) => d.id === deviceId);
    const count = getPortCount(device || null, kind);
    if (!count) return [];
    const ports: number[] = [];
    for (let i = 1; i <= count; i += 1) {
      const link = getLinkForPort(deviceId, kind, i, side);
      if (!link || link.id === allowLinkId) ports.push(i);
    }
    return ports;
  };

  const getAllPorts = (deviceId: string, kind: RackPortKind) => {
    const device = rackItems.find((d) => d.id === deviceId);
    const count = getPortCount(device || null, kind);
    if (!count) return [];
    return Array.from({ length: count }, (_, idx) => idx + 1);
  };

  const linkableItems = useMemo(() => {
    return rackItems.filter((device) => device.id !== itemId);
  }, [rackItems, itemId]);

  const availableTargets = useMemo(() => {
    if (!linkPrompt) return [];
    return linkableItems.filter((device) => getPortCount(device, linkPrompt.kind) > 0);
  }, [linkPrompt, linkableItems]);

  const targetDevice = useMemo(() => {
    if (!targetItemId) return null;
    return rackItems.find((device) => device.id === targetItemId) || null;
  }, [rackItems, targetItemId]);

  const targetPortLabel = useMemo(() => {
    if (!linkPrompt || !targetDevice || !targetPortIndex) return '';
    return getPortDisplayName(targetDevice, linkPrompt.kind, targetPortIndex);
  }, [linkPrompt, targetDevice, targetPortIndex]);

  const targetPortLink = useMemo(() => {
    if (!linkPrompt || !targetItemId || !targetPortIndex) return null;
    return getLinkForPort(targetItemId, linkPrompt.kind, targetPortIndex, targetSide);
  }, [linkPrompt, targetItemId, targetPortIndex, targetSide]);

  const portPickerPorts = useMemo(() => {
    if (!linkPrompt || !targetItemId) return [];
    return getAllPorts(targetItemId, linkPrompt.kind);
  }, [linkPrompt, targetItemId]);

  const openLinkPrompt = (kind: RackPortKind, index: number, side?: PortSide) => {
    if (readOnly) return;
    if (!item) return;
    const existing = getLinkForPort(item.id, kind, index, side);
    const nextPrompt: LinkPrompt = { kind, index, side, existingLinkId: existing?.id };
    setLinkPrompt(nextPrompt);
    setPortPickerOpen(false);
    if (existing) {
      const other = getOtherSide(existing, item.id);
      const initialRack = rackItems.find((d) => d.id === other.itemId)?.rackId || '';
      setTargetRackId(initialRack);
      setTargetItemId(other.itemId);
      setTargetSide(other.side || 'female');
      setTargetPortIndex(other.index || 0);
      setSpeed(existing?.speed || speedOptions[kind][0]?.value || '1G');
      return;
    }
    setTargetRackId('');
    setTargetItemId('');
    setTargetSide(side || 'female');
    setTargetPortIndex(0);
    setSpeed(speedOptions[kind][0]?.value || '1G');
  };

  const openNotePrompt = (kind: RackPortKind, index: number) => {
    if (readOnly) return;
    if (!item) return;
    setNotePrompt({ kind, index });
    setNoteValue(getPortNote(item, kind, index));
  };

  const closeNotePrompt = () => {
    setNotePrompt(null);
    setNoteValue('');
  };

  useEffect(() => {
    if (!open || readOnly || !rackLinks.length) return;
    const validIds = new Set(activeRackLinks.map((link) => link.id));
    const invalid = rackLinks.filter((link) => !validIds.has(link.id));
    if (!invalid.length) return;
    invalid.forEach((link) => onDeleteLink(link.id));
  }, [activeRackLinks, onDeleteLink, open, rackLinks, readOnly]);

  useEffect(() => {
    if (!open) return;
    setConnectionsOpen(initialConnectionsOpen);
  }, [initialConnectionsOpen, itemId, open]);

  useEffect(() => {
    if (!open) return;
    setConnectionsKindFilter(initialConnectionsKind || 'all');
  }, [initialConnectionsKind, itemId, open]);

  useEffect(() => {
    if (!connectionsOpen) return;
    setConnectionsQuery('');
  }, [connectionsOpen, itemId]);

  useEffect(() => {
    if (!linkPrompt) setPortPickerOpen(false);
  }, [linkPrompt]);

  useEffect(() => {
    if (open) return;
    setLinkPrompt(null);
    setRenamePrompt(null);
    setRenameValue('');
    setNotePrompt(null);
    setNoteValue('');
    setConnectionsOpen(false);
    setPortPickerOpen(false);
  }, [open]);

  const applySaveLink = (forceOverwrite: boolean) => {
    if (!item || !linkPrompt) return;
    if (!targetRackId || !targetItemId || !targetPortIndex) {
      push(t({ it: 'Seleziona rack, apparato e porta.', en: 'Select rack, device, and port.' }), 'info');
      return;
    }
    const availablePorts = findFreePorts(targetItemId, linkPrompt.kind, linkPrompt.existingLinkId, targetSide);
    const targetLinks = getLinksForPort(targetItemId, linkPrompt.kind, targetPortIndex, targetSide);
    const hasConflictingTarget = targetLinks.some((link) => link.id !== linkPrompt.existingLinkId);
    if (hasConflictingTarget && !forceOverwrite) {
      const conflict = targetLinks.find((link) => link.id !== linkPrompt.existingLinkId);
      setOverwritePrompt({ linkId: conflict?.id || '' });
      return;
    }
    if (!targetLinks.length && !availablePorts.includes(targetPortIndex)) {
      push(t({ it: 'Porta di destinazione non disponibile.', en: 'Target port not available.' }), 'info');
      return;
    }
    const sourceLinks = getLinksForPort(item.id, linkPrompt.kind, linkPrompt.index, linkPrompt.side);
    const removeIds = new Set<string>();
    sourceLinks.forEach((link) => removeIds.add(link.id));
    targetLinks.forEach((link) => removeIds.add(link.id));
    removeIds.forEach((id) => onDeleteLink(id));
    const color = allowSpeed ? speedColors[speed] || kindDefaults[linkPrompt.kind] : kindDefaults[linkPrompt.kind];
    onAddLink({
      fromItemId: item.id,
      fromPortKind: linkPrompt.kind,
      fromPortIndex: linkPrompt.index,
      fromSide: linkPrompt.side,
      toItemId: targetItemId,
      toPortKind: linkPrompt.kind,
      toPortIndex: targetPortIndex,
      toSide: isDualSide(rackItems.find((d) => d.id === targetItemId) || null) ? targetSide : undefined,
      kind: linkPrompt.kind,
      color,
      speed: allowSpeed ? speed : undefined
    });
    setLinkPrompt(null);
  };

  const handleSaveLink = () => applySaveLink(false);

  const handleRenameSave = () => {
    if (!item || !renamePrompt) return;
    onRenamePort(item.id, renamePrompt.kind, renamePrompt.index, renameValue.trim());
    setRenamePrompt(null);
  };

  const handleNoteSave = () => {
    if (!item || !notePrompt) return;
    onSavePortNote(item.id, notePrompt.kind, notePrompt.index, noteValue.trim());
    closeNotePrompt();
  };

  const handleBackdropClose = () => {
    if (!closeOnBackdrop) return;
    if (notePrompt || linkPrompt) return;
    onClose();
  };

  const handleConnectionsClose = () => {
    if (!closeOnBackdrop) return;
    setConnectionsOpen(false);
  };

  const buildPathParts = (kind: RackPortKind, index: number, side?: PortSide): PathPart[] => {
    if (!item) return [];
    const visited = new Set<string>();
    const parts: PathPart[] = [];
    let current = { itemId: item.id, kind, index, side };
    while (current) {
      const key = `${current.itemId}:${current.kind}:${current.index}:${current.side || ''}`;
      if (visited.has(key)) break;
      visited.add(key);
      const device = rackItems.find((d) => d.id === current.itemId) || null;
      const rackName = device ? getRackName(device.rackId) : '';
      parts.push({
        key,
        label: getPortLabel(current.itemId, current.kind, current.index, current.side),
        deviceType: device?.type,
        deviceId: device?.id,
        rackName
      });
      const link = getLinkForPort(current.itemId, current.kind, current.index, current.side);
      if (!link) break;
      current = getOtherSide(link, current.itemId);
    }
    return orientPath(parts);
  };

  const connections = useMemo(() => {
    if (!item) return [];
    const items: {
      id: string;
      portName: string;
      sideLabel?: string;
      parts: PathPart[];
      kind: RackPortKind;
      active: boolean;
      speed?: string;
      note?: string;
    }[] = [];
    (['ethernet', 'fiber'] as RackPortKind[]).forEach((kind) => {
      const count = getPortCount(item, kind);
      for (let index = 1; index <= count; index += 1) {
        const portName = getPortDisplayName(item, kind, index);
        const note = getPortNote(item, kind, index);
        if (isDualSide(item)) {
          (['female', 'cable'] as PortSide[]).forEach((side) => {
            const link = getLinkForPort(item.id, kind, index, side);
            const sideLabel = side === 'female' ? t({ it: 'Femmina', en: 'Female' }) : t({ it: 'Cablaggio', en: 'Cabling' });
            const parts = buildPathParts(kind, index, side);
            if (!parts.length) return;
            items.push({
              id: `${kind}-${index}-${side}`,
              portName,
              sideLabel,
              parts,
              kind,
              active: !!link,
              speed: link?.speed,
              note
            });
          });
        } else {
          const link = getLinkForPort(item.id, kind, index);
          const parts = buildPathParts(kind, index);
          if (!parts.length) return;
          items.push({
            id: `${kind}-${index}`,
            portName,
            parts,
            kind,
            active: !!link,
            speed: link?.speed,
            note
          });
        }
      }
    });
    return items;
  }, [item, rackItems, activeRackLinks, t]);

  const connectionCollator = useMemo(() => new Intl.Collator('it', { sensitivity: 'base' }), []);

  const visibleConnections = useMemo(() => {
    const normalizedQuery = connectionsQuery.trim().toLowerCase();
    const filtered = connections.filter((entry) => {
      if (connectionsOnlyActive && !entry.active) return false;
      if (connectionsKindFilter !== 'all' && entry.kind !== connectionsKindFilter) return false;
      if (normalizedQuery) {
        const labels = [
          entry.portName,
          entry.sideLabel || '',
          entry.note || '',
          entry.speed || '',
          ...entry.parts.map((part) => part.label)
        ]
          .join(' ')
          .toLowerCase();
        if (!labels.includes(normalizedQuery)) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      const aStart = a.parts[0]?.rackName || '';
      const bStart = b.parts[0]?.rackName || '';
      const byStart = connectionCollator.compare(aStart, bStart);
      if (byStart) return byStart;
      const aEnd = a.parts[a.parts.length - 1]?.rackName || '';
      const bEnd = b.parts[b.parts.length - 1]?.rackName || '';
      const byEnd = connectionCollator.compare(aEnd, bEnd);
      if (byEnd) return byEnd;
      const aLabel = `${a.portName} ${a.sideLabel || ''}`.trim();
      const bLabel = `${b.portName} ${b.sideLabel || ''}`.trim();
      return connectionCollator.compare(aLabel, bLabel);
    });
  }, [connectionCollator, connections, connectionsKindFilter, connectionsOnlyActive, connectionsQuery]);

  const renderDualRow = (kind: RackPortKind, index: number) => {
      if (!item) return null;
      const portName = getPortDisplayName(item, kind, index);
      const portNote = getPortNote(item, kind, index);
      const femaleLink = getLinkForPort(item.id, kind, index, 'female');
      const cableLink = getLinkForPort(item.id, kind, index, 'cable');
      const femaleTitle = femaleLink ? getConnectionTitle(femaleLink, item.id) : '';
      const cableTitle = cableLink ? getConnectionTitle(cableLink, item.id) : '';
      const statusLabel = (linked: boolean) => (linked ? t({ it: 'Attiva', en: 'Active' }) : t({ it: 'Libera', en: 'Free' }));
      return (
        <div
          key={`${kind}-${index}`}
          className="rounded-lg border border-slate-200 px-2 py-2"
          onContextMenu={(event) => {
            if (!canRename) return;
            event.preventDefault();
            setRenamePrompt({ kind, index });
            setRenameValue(portName);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-700">{portName}</div>
                {portNote ? <div className="mt-1 text-[11px] text-slate-500">{portNote}</div> : null}
                <div className="mt-1 flex flex-col gap-1 text-[11px] text-slate-500">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: femaleLink ? '#16a34a' : '#cbd5f5' }}
                      title={femaleTitle}
                    />
                    <span className="w-16 text-[10px] font-semibold uppercase text-slate-400">{t({ it: 'Femmina', en: 'Female' })}</span>
                    <span>{statusLabel(!!femaleLink)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cableLink ? '#16a34a' : '#cbd5f5' }}
                      title={cableTitle}
                    />
                    <span className="w-16 text-[10px] font-semibold uppercase text-slate-400">{t({ it: 'Cablaggio', en: 'Cabling' })}</span>
                    <span>{statusLabel(!!cableLink)}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openLinkPrompt(kind, index, 'female')}
                    disabled={readOnly}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                    title={t({ it: 'Collega femmina', en: 'Link female' })}
                  >
                    {t({ it: 'Femmina', en: 'Female' })}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openLinkPrompt(kind, index, 'cable')}
                    disabled={readOnly}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                    title={t({ it: 'Collega cablaggio', en: 'Link cabling' })}
                  >
                    {t({ it: 'Cablaggio', en: 'Cabling' })}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openNotePrompt(kind, index)}
                    disabled={readOnly}
                    className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                    title={t({ it: 'Aggiungi nota', en: 'Add note' })}
                  >
                    {t({ it: 'Nota', en: 'Note' })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    };

  const renderSingleRow = (kind: RackPortKind, index: number) => {
    if (!item) return null;
    const link = getLinkForPort(item.id, kind, index);
    const statusColor = link ? '#16a34a' : '#cbd5f5';
    const infoTitle = link ? getConnectionTitle(link, item.id) : '';
    const portName = getPortDisplayName(item, kind, index);
    const portNote = getPortNote(item, kind, index);
    return (
      <div
        key={`${kind}-${index}`}
        className="rounded-lg border border-slate-200 px-2 py-2"
        onContextMenu={(event) => {
          if (!canRename) return;
          event.preventDefault();
          setRenamePrompt({ kind, index });
          setRenameValue(portName);
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor }} title={infoTitle} />
            <div>
              <div className="text-xs font-semibold text-slate-700">{portName}</div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <span>{link ? t({ it: 'Attiva', en: 'Active' }) : t({ it: 'Libera', en: 'Free' })}</span>
                {allowSpeed && link?.speed ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {link.speed}
                  </span>
                ) : null}
              </div>
              {portNote ? <div className="mt-1 text-[11px] text-slate-500">{portNote}</div> : null}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {link ? (
              <button
                onClick={() => openLinkPrompt(kind, index)}
                disabled={readOnly}
                className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                title={t({ it: 'Modifica collegamento', en: 'Edit link' })}
              >
                {t({ it: 'Modifica', en: 'Edit' })}
              </button>
            ) : (
              <button
                onClick={() => openLinkPrompt(kind, index)}
                disabled={readOnly}
                className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white hover:bg-primary/90"
                title={t({ it: 'Collega porta', en: 'Link port' })}
              >
                {t({ it: 'Collega', en: 'Link' })}
              </button>
            )}
            <button
              onClick={() => openNotePrompt(kind, index)}
              disabled={readOnly}
              className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              title={t({ it: 'Aggiungi nota', en: 'Add note' })}
            >
              {t({ it: 'Nota', en: 'Note' })}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderPorts = (kind: RackPortKind) => {
    if (!item) return null;
    const count = getPortCount(item, kind);
    if (!count) return null;
    const indices = Array.from({ length: count }, (_, i) => i + 1);
    const left = count > 24 ? indices.slice(0, 24) : indices;
    const right = count > 24 ? indices.slice(24) : [];
    const dual = isDualSide(item);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-ink">
            {kind === 'ethernet' ? t({ it: 'Porte Ethernet', en: 'Ethernet ports' }) : t({ it: 'Porte Fibra', en: 'Fiber ports' })}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {dual ? (
              <span
                className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500"
                title={t({
                  it: 'Femmina = porta frontale. Cablaggio = collegamento verso altri apparati/patch.',
                  en: 'Female = front port. Cabling = back-side patch to other devices.'
                })}
              >
                {t({ it: 'Femmina/Cablaggio', en: 'Female/Cabling' })}
              </span>
            ) : null}
            <span>{count}</span>
          </div>
        </div>
        <div className={`mt-3 gap-3 ${right.length ? 'grid grid-cols-2' : ''}`}>
          <div className="space-y-2">
            {left.map((index) => (dual ? renderDualRow(kind, index) : renderSingleRow(kind, index)))}
          </div>
          {right.length ? (
            <div className="space-y-2">
              {right.map((index) => (dual ? renderDualRow(kind, index) : renderSingleRow(kind, index)))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  if (!item) return null;
  const ethCount = getPortCount(item, 'ethernet');
  const fiberCount = getPortCount(item, 'fiber');
  const hasConnectionsQuery = connectionsQuery.trim().length > 0;

  return (
    <>
      <Dialog open={open} as="div" className="relative z-[90]" onClose={handleBackdropClose}>
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-4 py-6">
            <Dialog.Panel className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Configurazione porte', en: 'Port configuration' })}
                  </Dialog.Title>
                  <div className="text-xs text-slate-500">
                    {getDeviceLabel(item)}
                    {rackName ? <span className="ml-2 font-semibold text-sky-600">{rackName}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setConnectionsOpen(true)}
                    className="rounded-full border border-slate-200 p-1 text-slate-500 hover:text-primary"
                    title={t({ it: 'Mostra collegamenti', en: 'Show links' })}
                  >
                    <Link2 size={16} />
                  </button>
                  <button onClick={onClose} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
              </div>

              {ethCount === 0 && fiberCount === 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  {t({
                    it: 'Nessuna porta configurata. Imposta il numero di porte nel dettaglio apparato.',
                    en: 'No ports configured. Set the port count in device details.'
                  })}
                </div>
              ) : (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {renderPorts('ethernet')}
                  {renderPorts('fiber')}
                </div>
              )}
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>

      {notePrompt ? (
        <Dialog open={!!notePrompt} as="div" className="relative z-[120]" onClose={closeNotePrompt} initialFocus={noteInputRef}>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-6">
              <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title id={noteTitleId} className="text-lg font-semibold text-ink">
                    {t({ it: 'Nota porta', en: 'Port note' })}
                  </Dialog.Title>
                  <button onClick={closeNotePrompt} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <Dialog.Description id={noteDescriptionId} className="mt-2 text-xs text-slate-500">
                  {t({ it: 'Porta', en: 'Port' })}: {getPortDisplayName(item, notePrompt.kind, notePrompt.index)}
                </Dialog.Description>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  {t({ it: 'Nota', en: 'Note' })}
                  <textarea
                    rows={4}
                    value={noteValue}
                    onChange={(e) => setNoteValue(e.target.value)}
                    readOnly={readOnly}
                    aria-readonly={readOnly}
                    ref={noteInputRef}
                    className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={closeNotePrompt}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={handleNoteSave}
                    disabled={readOnly}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
                    title={t({ it: 'Salva', en: 'Save' })}
                  >
                    {t({ it: 'Salva', en: 'Save' })}
                  </button>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      ) : null}

      {linkPrompt ? (
        <Dialog open={!!linkPrompt} as="div" className="relative z-[95]" onClose={() => setLinkPrompt(null)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-6">
              <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Collega porta', en: 'Link port' })}
                  </Dialog.Title>
                  <button onClick={() => setLinkPrompt(null)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {t({ it: 'Porta', en: 'Port' })}: {getPortDisplayName(item, linkPrompt.kind, linkPrompt.index)}
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Rack di destinazione', en: 'Target rack' })}
                    <select
                      value={targetRackId}
                      onChange={(e) => {
                        const nextRackId = e.target.value;
                        setTargetRackId(nextRackId);
                        setTargetItemId('');
                        setTargetPortIndex(0);
                        setTargetSide('female');
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    >
                      <option value="">{t({ it: 'Seleziona rack', en: 'Select rack' })}</option>
                      {racks.map((rack) => (
                        <option key={rack.id} value={rack.id}>
                          {rack.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    {t({ it: 'Apparato', en: 'Device' })}
                    <select
                      value={targetItemId}
                      onChange={(e) => {
                        const nextItemId = e.target.value;
                        setTargetItemId(nextItemId);
                        const nextDevice = rackItems.find((d) => d.id === nextItemId) || null;
                        const nextSide = isDualSide(nextDevice) ? linkPrompt?.side || 'female' : 'female';
                        setTargetSide(nextSide);
                        setTargetPortIndex(0);
                      }}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                    >
                      <option value="">{t({ it: 'Seleziona apparato', en: 'Select device' })}</option>
                      {availableTargets
                        .filter((d) => (targetRackId ? d.rackId === targetRackId : false))
                        .map((device) => (
                          <option key={device.id} value={device.id}>
                            {getDeviceLabel(device)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm font-medium text-slate-700">
                      {t({ it: 'Porta', en: 'Port' })}
                      <button
                        type="button"
                        onClick={() => setPortPickerOpen(true)}
                        disabled={!targetItemId}
                        className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-left outline-none ring-primary/30 focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-100"
                        title={t({ it: 'Seleziona porta', en: 'Select port' })}
                      >
                        <span className="truncate text-slate-700">
                          {targetPortIndex ? targetPortLabel : t({ it: 'Seleziona porta', en: 'Select port' })}
                        </span>
                        {targetPortIndex ? (
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              targetPortLink ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {targetPortLink ? t({ it: 'Collegata', en: 'Linked' }) : t({ it: 'Libera', en: 'Free' })}
                          </span>
                        ) : null}
                      </button>
                    </label>
                    {allowSpeed ? (
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Velocità', en: 'Speed' })}
                        <select
                          value={speed}
                          onChange={(e) => setSpeed(e.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        >
                          {speedOptions[linkPrompt.kind].map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div />
                    )}
                  </div>
                  {(() => {
                    if (!isDualSide(targetDevice)) return null;
                    return (
                      <label className="block text-sm font-medium text-slate-700">
                        {t({ it: 'Lato', en: 'Side' })}
                        <select
                          value={targetSide}
                          onChange={(e) => {
                            const next = e.target.value as PortSide;
                            setTargetSide(next);
                            setTargetPortIndex(0);
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                        >
                          <option value="female">{t({ it: 'Femmina', en: 'Female' })}</option>
                          <option value="cable">{t({ it: 'Cablaggio', en: 'Cabling' })}</option>
                        </select>
                      </label>
                    );
                  })()}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setLinkPrompt(null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  {linkPrompt.existingLinkId ? (
                    <button
                      onClick={() => {
                        onDeleteLink(linkPrompt.existingLinkId || '');
                        setLinkPrompt(null);
                      }}
                      className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                      title={t({ it: 'Scollega', en: 'Unlink' })}
                    >
                      {t({ it: 'Scollega', en: 'Unlink' })}
                    </button>
                  ) : null}
                  <button
                    onClick={handleSaveLink}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    title={t({ it: 'Salva collegamento', en: 'Save link' })}
                  >
                    {t({ it: 'Salva collegamento', en: 'Save link' })}
                  </button>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      ) : null}
      {linkPrompt && portPickerOpen ? (
        <Dialog open={portPickerOpen} as="div" className="relative z-[98]" onClose={() => setPortPickerOpen(false)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-6">
              <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Seleziona porta', en: 'Select port' })}
                  </Dialog.Title>
                  <button onClick={() => setPortPickerOpen(false)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-2 text-sm text-slate-500">{targetDevice ? getDeviceLabel(targetDevice) : ''}</div>
                {targetDevice ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    {getRackName(targetDevice.rackId) ? (
                      <span className="rounded-full border border-slate-200 px-2 py-0.5 text-sky-600">
                        {getRackName(targetDevice.rackId)}
                      </span>
                    ) : null}
                    {isDualSide(targetDevice) ? (
                      <span className="rounded-full border border-slate-200 px-2 py-0.5">
                        {targetSide === 'cable' ? t({ it: 'Cablaggio', en: 'Cabling' }) : t({ it: 'Femmina', en: 'Female' })}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-slate-200 px-2 py-0.5">
                      {linkPrompt.kind === 'fiber' ? t({ it: 'Fibra', en: 'Fiber' }) : t({ it: 'Rame', en: 'Copper' })}
                    </span>
                  </div>
                ) : null}
                <div className="mt-4 space-y-2">
                  {portPickerPorts.length ? (
                    portPickerPorts.map((port) => {
                      const link = getLinkForPort(targetItemId, linkPrompt.kind, port, targetSide);
                      const isConnected = !!link;
                      const statusLabel = isConnected ? t({ it: 'Collegata', en: 'Linked' }) : t({ it: 'Libera', en: 'Free' });
                      const statusColor = isConnected ? 'bg-emerald-500' : 'bg-rose-500';
                      return (
                        <button
                          key={port}
                          type="button"
                          onClick={() => {
                            setTargetPortIndex(port);
                            setPortPickerOpen(false);
                          }}
                          className={`w-full rounded-lg border px-3 py-2 text-left ${
                            isConnected ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/60'
                          } ${targetPortIndex === port ? 'ring-2 ring-primary/40' : ''}`}
                          title={getPortDisplayName(targetDevice, linkPrompt.kind, port)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${statusColor}`} />
                              <span className="text-sm font-semibold text-slate-700">
                                {getPortDisplayName(targetDevice, linkPrompt.kind, port)}
                              </span>
                            </div>
                            <span className={`text-xs font-semibold ${isConnected ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {statusLabel}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {isConnected ? getConnectionTitle(link, targetItemId) : t({ it: 'Nessun collegamento', en: 'No link' })}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                      {t({ it: 'Seleziona un apparato per vedere le porte disponibili.', en: 'Select a device to view available ports.' })}
                    </div>
                  )}
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      ) : null}
      {renamePrompt ? (
        <Dialog open={!!renamePrompt} as="div" className="relative z-[100]" onClose={() => setRenamePrompt(null)}>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-6">
              <Dialog.Panel className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Rinomina porta', en: 'Rename port' })}
                  </Dialog.Title>
                  <button onClick={() => setRenamePrompt(null)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {t({ it: 'Nome di default', en: 'Default name' })}:{' '}
                  {getDefaultPortName(item, renamePrompt.kind, renamePrompt.index)}
                </div>
                <label className="mt-3 block text-sm font-medium text-slate-700">
                  {t({ it: 'Nome porta', en: 'Port name' })}
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-primary/30 focus:ring-2"
                  />
                </label>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setRenamePrompt(null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={handleRenameSave}
                    className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                    title={t({ it: 'Salva', en: 'Save' })}
                  >
                    {t({ it: 'Salva', en: 'Save' })}
                  </button>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      ) : null}
      {connectionsOpen ? (
        <Dialog open={connectionsOpen} as="div" className="relative z-[110]" onClose={handleConnectionsClose}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-6">
              <Dialog.Panel className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Collegamenti apparati', en: 'Device links' })}
                  </Dialog.Title>
                  <button onClick={() => setConnectionsOpen(false)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-1 text-xs text-slate-500">{getDeviceLabel(item)}</div>
                {rackName ? <div className="mt-1 text-xs font-semibold text-sky-600">{rackName}</div> : null}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                      <Search size={12} className="text-slate-400" />
                      <input
                        value={connectionsQuery}
                        onChange={(e) => setConnectionsQuery(e.target.value)}
                        onKeyDown={(event) => event.stopPropagation()}
                        placeholder={t({ it: 'Cerca porta, rack, nota...', en: 'Search port, rack, note...' })}
                        className="w-44 bg-transparent text-[11px] text-slate-600 placeholder:text-slate-400 focus:outline-none"
                        title={t({ it: 'Cerca nei collegamenti', en: 'Search links' })}
                      />
                    </div>
                    <button
                      onClick={() => setConnectionsOnlyActive((prev) => !prev)}
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                        connectionsOnlyActive ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-600'
                      }`}
                      title={t({ it: 'Mostra solo attive', en: 'Show active only' })}
                    >
                      {t({ it: 'Solo attive', en: 'Active only' })}
                    </button>
                    <div className="flex items-center rounded-full border border-slate-200 p-0.5 text-[10px] font-semibold text-slate-600">
                      {(['all', 'ethernet', 'fiber'] as const).map((kind) => {
                        const label =
                          kind === 'all'
                            ? t({ it: 'Tutte', en: 'All' })
                            : kind === 'ethernet'
                              ? t({ it: 'Rame', en: 'Copper' })
                              : t({ it: 'Fibra', en: 'Fiber' });
                        const isActive = connectionsKindFilter === kind;
                        return (
                          <button
                            key={kind}
                            onClick={() => setConnectionsKindFilter(kind)}
                            className={`rounded-full px-2 py-0.5 ${isActive ? 'bg-slate-900 text-white' : ''}`}
                            title={label}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => setConnectionsExpanded((prev) => !prev)}
                      className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                        connectionsExpanded ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                      }`}
                      title={connectionsExpanded ? t({ it: 'Vista espansa', en: 'Expanded view' }) : t({ it: 'Vista compatta', en: 'Compact view' })}
                    >
                      {connectionsExpanded ? t({ it: 'Vista espansa', en: 'Expanded view' }) : t({ it: 'Vista compatta', en: 'Compact view' })}
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500">
                    {[
                      { label: t({ it: 'Server', en: 'Server' }), colors: [typeColors.server] },
                      { label: t({ it: 'Switch', en: 'Switch' }), colors: [typeColors.switch] },
                      { label: t({ it: 'Router/Firewall', en: 'Router/Firewall' }), colors: [typeColors.router, typeColors.firewall] },
                      { label: t({ it: 'Patch/ottico', en: 'Patch/Optical' }), colors: [typeColors.patchpanel, typeColors.optical_drawer] }
                    ].map((entry) => (
                      <div key={entry.label} className="flex items-center gap-1">
                        <span className="flex items-center gap-0.5">
                          {entry.colors.map((color) => (
                            <span key={color} className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                          ))}
                        </span>
                        <span>{entry.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {visibleConnections.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    {hasConnectionsQuery
                      ? t({ it: 'Nessun collegamento trovato con questa ricerca.', en: 'No links match this search.' })
                      : t({ it: 'Nessun collegamento presente.', en: 'No links available.' })}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {visibleConnections.map((entry) => {
                      const kindLabel =
                        entry.kind === 'ethernet' ? t({ it: 'Rame', en: 'Copper' }) : t({ it: 'Fibra', en: 'Fiber' });
                      const portLabel =
                        connectionsExpanded && entry.sideLabel ? `${entry.portName} · ${entry.sideLabel}` : entry.portName;
                      const speedLabel = connectionsExpanded && entry.speed ? ` · ${entry.speed}` : '';
                      const kindColor = kindDefaults[entry.kind];
                      const kindBadgeStyle = {
                        borderColor: kindColor,
                        backgroundColor: connectionsExpanded ? `${kindColor}1a` : `${kindColor}26`,
                        color: kindColor
                      };
                      return (
                        <div key={entry.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-slate-600">{portLabel}</div>
                            <div className="flex items-center gap-2 text-[10px] font-semibold">
                              <span
                                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5"
                                style={kindBadgeStyle}
                              >
                                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: kindColor }} />
                                <span>
                                  {kindLabel}
                                  {speedLabel}
                                </span>
                              </span>
                              {connectionsExpanded && !entry.active ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-500">
                                  {t({ it: 'Libera', en: 'Free' })}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {connectionsExpanded && entry.note ? (
                            <div className="mt-2 text-[11px] text-slate-500">{entry.note}</div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                            {entry.parts.map((part, idx, arr) => {
                              const color = part.deviceType ? typeColors[part.deviceType] : '#94a3b8';
                              const badgeStyle = {
                                borderColor: color,
                                backgroundColor: `${color}26`
                              };
                              return (
                                <span key={`${entry.id}-${part.key}`} className="inline-flex items-center gap-2">
                                  <span className="inline-flex items-center gap-2 rounded-full border px-2 py-1" style={badgeStyle}>
                                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                                    <span className="font-medium text-slate-700">{part.label}</span>
                                  </span>
                                  {idx < arr.length - 1 ? <ArrowRight size={12} className="text-slate-400" /> : null}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      ) : null}
      {overwritePrompt ? (
        <Dialog open={!!overwritePrompt} as="div" className="relative z-[120]" onClose={() => setOverwritePrompt(null)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center px-4 py-6">
              <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-lg font-semibold text-ink">
                    {t({ it: 'Porta già collegata', en: 'Port already linked' })}
                  </Dialog.Title>
                  <button onClick={() => setOverwritePrompt(null)} className="text-slate-500 hover:text-ink" title={t({ it: 'Chiudi', en: 'Close' })}>
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  {t({
                    it: 'La porta selezionata è già collegata. Vuoi sovrascrivere il collegamento?',
                    en: 'The selected port is already linked. Do you want to overwrite it?'
                  })}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    onClick={() => setOverwritePrompt(null)}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    title={t({ it: 'Annulla', en: 'Cancel' })}
                  >
                    {t({ it: 'Annulla', en: 'Cancel' })}
                  </button>
                  <button
                    onClick={() => {
                      setOverwritePrompt(null);
                      applySaveLink(true);
                    }}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    title={t({ it: 'Sovrascrivi', en: 'Overwrite' })}
                  >
                    {t({ it: 'Sovrascrivi', en: 'Overwrite' })}
                  </button>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
};

export default RackPortsModal;
