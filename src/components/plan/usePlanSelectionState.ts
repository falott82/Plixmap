import { useState } from 'react';
import type { PhotoItem } from './PhotoViewerModal';
import type { SharedRoomSide } from './planViewUtils';

type QuickMenuState = {
  id: string;
  x: number;
  y: number;
  world: { x: number; y: number };
};

type CorridorDoorDraftState = {
  corridorId: string;
  start?: { edgeIndex: number; t: number; x: number; y: number };
};

type RoomDoorDraftState = {
  roomAId: string;
  roomBId: string;
  sharedSides: SharedRoomSide[];
};

type CableModalState = { mode: 'create'; fromId: string; toId: string } | { mode: 'edit'; linkId: string };

type PhotoViewerState = {
  photos: PhotoItem[];
  initialId?: string;
  title?: { it: string; en: string };
  countLabel?: { it: string; en: string };
  itemLabel?: { it: string; en: string };
  emptyLabel?: { it: string; en: string };
};

export const usePlanSelectionState = () => {
  const [panToolActive, setPanToolActive] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | undefined>(undefined);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [selectedCorridorId, setSelectedCorridorId] = useState<string | undefined>(undefined);
  const [selectedCorridorDoor, setSelectedCorridorDoor] = useState<{ corridorId: string; doorId: string } | null>(null);
  const [selectedRoomDoorId, setSelectedRoomDoorId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [wallQuickMenu, setWallQuickMenu] = useState<QuickMenuState | null>(null);
  const [corridorQuickMenu, setCorridorQuickMenu] = useState<QuickMenuState | null>(null);
  const [corridorDoorDraft, setCorridorDoorDraft] = useState<CorridorDoorDraftState | null>(null);
  const [roomDoorDraft, setRoomDoorDraft] = useState<RoomDoorDraftState | null>(null);
  const [wallTypeMenu, setWallTypeMenu] = useState<{ ids: string[]; x: number; y: number } | null>(null);
  const [mapSubmenu, setMapSubmenu] = useState<null | 'view' | 'measure' | 'create' | 'print' | 'manage'>(null);
  const [linkFromId, setLinkFromId] = useState<string | null>(null);
  const [cableModal, setCableModal] = useState<CableModalState | null>(null);
  const [linksModalObjectId, setLinksModalObjectId] = useState<string | null>(null);
  const [linkEditId, setLinkEditId] = useState<string | null>(null);
  const [realUserDetailsId, setRealUserDetailsId] = useState<string | null>(null);
  const [photoViewer, setPhotoViewer] = useState<PhotoViewerState | null>(null);

  return {
    panToolActive,
    setPanToolActive,
    expandedRoomId,
    setExpandedRoomId,
    selectedRoomId,
    setSelectedRoomId,
    selectedRoomIds,
    setSelectedRoomIds,
    selectedCorridorId,
    setSelectedCorridorId,
    selectedCorridorDoor,
    setSelectedCorridorDoor,
    selectedRoomDoorId,
    setSelectedRoomDoorId,
    selectedLinkId,
    setSelectedLinkId,
    wallQuickMenu,
    setWallQuickMenu,
    corridorQuickMenu,
    setCorridorQuickMenu,
    corridorDoorDraft,
    setCorridorDoorDraft,
    roomDoorDraft,
    setRoomDoorDraft,
    wallTypeMenu,
    setWallTypeMenu,
    mapSubmenu,
    setMapSubmenu,
    linkFromId,
    setLinkFromId,
    cableModal,
    setCableModal,
    linksModalObjectId,
    setLinksModalObjectId,
    linkEditId,
    setLinkEditId,
    realUserDetailsId,
    setRealUserDetailsId,
    photoViewer,
    setPhotoViewer
  };
};
