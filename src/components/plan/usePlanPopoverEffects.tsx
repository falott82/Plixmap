import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { IconName } from '../../store/types';

type TypeMenuState = { typeId: string; label: string; icon?: IconName; x: number; y: number };
type TypeLayerModalState = { typeId: string; label: string };
type LayersQuickMenuState = { x: number; y: number };

export type UsePlanPopoverEffectsDeps = {
  countsOpen: boolean;
  setObjectListQuery: Dispatch<SetStateAction<string>>;
  setExpandedType: Dispatch<SetStateAction<string | null>>;
  setTypeMenu: Dispatch<SetStateAction<TypeMenuState | null>>;
  typeMenu: TypeMenuState | null;
  typeMenuRef: MutableRefObject<HTMLDivElement | null>;
  typeLayerModal: TypeLayerModalState | null;
  setTypeLayerName: Dispatch<SetStateAction<string>>;
  setTypeLayerColor: Dispatch<SetStateAction<string>>;
  typeLayerNameRef: MutableRefObject<HTMLInputElement | null>;
  presenceOpen: boolean;
  presenceRef: MutableRefObject<HTMLDivElement | null>;
  setPresenceOpen: Dispatch<SetStateAction<boolean>>;
  layersPopoverOpen: boolean;
  layersPopoverRef: MutableRefObject<HTMLDivElement | null>;
  setLayersPopoverOpen: Dispatch<SetStateAction<boolean>>;
  layersQuickMenu: LayersQuickMenuState | null;
  layersQuickMenuRef: MutableRefObject<HTMLDivElement | null>;
  setLayersQuickMenu: Dispatch<SetStateAction<LayersQuickMenuState | null>>;
  roomsOpen: boolean;
  setExpandedRoomId: Dispatch<SetStateAction<string | null>>;
  setNewRoomMenuOpen: Dispatch<SetStateAction<boolean>>;
};

export function usePlanPopoverEffects(deps: UsePlanPopoverEffectsDeps) {
  const {
    countsOpen,
    setObjectListQuery,
    setExpandedType,
    setTypeMenu,
    typeMenu,
    typeMenuRef,
    typeLayerModal,
    setTypeLayerName,
    setTypeLayerColor,
    typeLayerNameRef,
    presenceOpen,
    presenceRef,
    setPresenceOpen,
    layersPopoverOpen,
    layersPopoverRef,
    setLayersPopoverOpen,
    layersQuickMenu,
    layersQuickMenuRef,
    setLayersQuickMenu,
    roomsOpen,
    setExpandedRoomId,
    setNewRoomMenuOpen
  } = deps;

  useEffect(() => {
    if (!countsOpen) return;
    setObjectListQuery('');
    setExpandedType(null);
  }, [countsOpen]);

  useEffect(() => {
    if (countsOpen) return;
    setTypeMenu(null);
  }, [countsOpen]);

  useEffect(() => {
    if (!typeMenu) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (!typeMenuRef.current) return;
      if (typeMenuRef.current.contains(event.target as Node)) return;
      setTypeMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [typeMenu]);

  useEffect(() => {
    if (!typeLayerModal) return;
    setTypeLayerName(typeLayerModal.label);
    setTypeLayerColor('#0ea5e9');
    window.setTimeout(() => typeLayerNameRef.current?.focus(), 0);
  }, [typeLayerModal]);

  useEffect(() => {
    if (!presenceOpen) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (!presenceRef.current) return;
      if (presenceRef.current.contains(event.target as Node)) return;
      setPresenceOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [presenceOpen]);

  useEffect(() => {
    if (!layersPopoverOpen) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (!layersPopoverRef.current) return;
      if (layersPopoverRef.current.contains(event.target as Node)) return;
      setLayersPopoverOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [layersPopoverOpen]);

  useEffect(() => {
    if (!layersQuickMenu) return;
    const handleClick = (event: globalThis.MouseEvent) => {
      if (layersQuickMenuRef.current?.contains(event.target as Node)) return;
      setLayersQuickMenu(null);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [layersQuickMenu]);

  useEffect(() => {
    if (!roomsOpen) return;
    setExpandedRoomId(null);
    setNewRoomMenuOpen(false);
  }, [roomsOpen]);
}
