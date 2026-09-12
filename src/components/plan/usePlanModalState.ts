import { useRef, useState } from 'react';
import type { DoorVerificationEntry } from '../../store/types';
import type { RoomLayoutExportModalState } from './RoomLayoutExportModal';

export const usePlanModalState = () => {
  const [roomModal, setRoomModal] = useState<
    | { mode: 'create'; kind: 'rect'; rect: { x: number; y: number; width: number; height: number } }
    | { mode: 'create'; kind: 'poly'; points: { x: number; y: number }[] }
    | {
        mode: 'edit';
        roomId: string;
        openDepartments?: boolean;
        initialName: string;
        initialNameEn?: string;
        initialCapacity?: number;
        initialShowName?: boolean;
        initialSurfaceSqm?: number;
        initialNotes?: string;
        initialLogical?: boolean;
        initialMeetingRoom?: boolean;
        initialMeetingProjector?: boolean;
        initialMeetingTv?: boolean;
        initialMeetingVideoConf?: boolean;
        initialMeetingCoffeeService?: boolean;
        initialMeetingWhiteboard?: boolean;
        initialNoWindows?: boolean;
        initialWifiAvailable?: boolean;
        initialFridgeAvailable?: boolean;
        initialStorageRoom?: boolean;
        initialBathroom?: boolean;
        initialTechnicalRoom?: boolean;
      }
    | null
  >(null);
  const [roomMeasuresModal, setRoomMeasuresModal] = useState<{ roomId: string } | null>(null);
  const [roomLayoutExportModal, setRoomLayoutExportModal] = useState<RoomLayoutExportModalState | null>(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState<string | null>(null);
  const [confirmDeleteRoomIds, setConfirmDeleteRoomIds] = useState<string[] | null>(null);
  const [confirmDeleteCorridorId, setConfirmDeleteCorridorId] = useState<string | null>(null);
  const [corridorModal, setCorridorModal] = useState<
    | {
        mode: 'create';
        kind: 'poly';
        points: { x: number; y: number }[];
        initialName?: string;
        initialNameEn?: string;
        initialShowName?: boolean;
      }
    | { mode: 'edit'; corridorId: string; initialName: string; initialNameEn?: string; initialShowName?: boolean }
    | null
  >(null);
  const [corridorNameInput, setCorridorNameInput] = useState('');
  const [corridorNameEnInput, setCorridorNameEnInput] = useState('');
  const corridorNameInputRef = useRef<HTMLInputElement | null>(null);
  const [corridorShowNameInput, setCorridorShowNameInput] = useState(true);
  const [corridorDoorModal, setCorridorDoorModal] = useState<{
    corridorId: string;
    doorId: string;
    description: string;
    isEmergency: boolean;
    isMainEntrance: boolean;
    isExternal: boolean;
    isFireDoor: boolean;
    lastVerificationAt: string;
    verifierCompany: string;
    verificationHistory: DoorVerificationEntry[];
    mode: 'static' | 'auto_sensor' | 'automated';
    automationUrl: string;
  } | null>(null);
  const [corridorDoorLinkModal, setCorridorDoorLinkModal] = useState<{
    corridorId: string;
    doorId: string;
    selectedRoomIds: string[];
    nearestRoomId?: string;
    magneticRoomIds?: string[];
  } | null>(null);
  const [corridorDoorLinkQuery, setCorridorDoorLinkQuery] = useState('');
  const [corridorConnectionModal, setCorridorConnectionModal] = useState<{
    connectionId?: string | null;
    corridorId: string;
    edgeIndex: number;
    t: number;
    x: number;
    y: number;
    selectedPlanIds: string[];
    transitionType: 'stairs' | 'elevator';
  } | null>(null);
  const [wallTypeModal, setWallTypeModal] = useState<{ ids: string[]; typeId: string } | null>(null);
  const [wallTypeDraft, setWallTypeDraft] = useState<string>('');
  const [roomWallTypeModal, setRoomWallTypeModal] = useState<{
    roomId: string;
    roomName: string;
    segments: { start: { x: number; y: number }; end: { x: number; y: number }; label: string }[];
    mode?: 'create' | 'edit';
    wallIds?: string[];
    wallTypes?: string[];
  } | null>(null);
  const [roomWallTypeSelections, setRoomWallTypeSelections] = useState<string[]>([]);
  const [roomWallPrompt, setRoomWallPrompt] = useState<{
    roomId: string;
    roomName: string;
    kind: 'rect' | 'poly';
    rect?: { x: number; y: number; width: number; height: number };
    points?: { x: number; y: number }[];
  } | null>(null);

  return {
    roomModal,
    setRoomModal,
    roomMeasuresModal,
    setRoomMeasuresModal,
    roomLayoutExportModal,
    setRoomLayoutExportModal,
    confirmDeleteRoomId,
    setConfirmDeleteRoomId,
    confirmDeleteRoomIds,
    setConfirmDeleteRoomIds,
    confirmDeleteCorridorId,
    setConfirmDeleteCorridorId,
    corridorModal,
    setCorridorModal,
    corridorNameInput,
    setCorridorNameInput,
    corridorNameEnInput,
    setCorridorNameEnInput,
    corridorNameInputRef,
    corridorShowNameInput,
    setCorridorShowNameInput,
    corridorDoorModal,
    setCorridorDoorModal,
    corridorDoorLinkModal,
    setCorridorDoorLinkModal,
    corridorDoorLinkQuery,
    setCorridorDoorLinkQuery,
    corridorConnectionModal,
    setCorridorConnectionModal,
    wallTypeModal,
    setWallTypeModal,
    wallTypeDraft,
    setWallTypeDraft,
    roomWallTypeModal,
    setRoomWallTypeModal,
    roomWallTypeSelections,
    setRoomWallTypeSelections,
    roomWallPrompt,
    setRoomWallPrompt
  };
};
