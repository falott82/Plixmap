import { useEffect, type Dispatch, type SetStateAction } from 'react';
import type { useLocation, useNavigate } from 'react-router-dom';
import type { useT } from '../../i18n/useT';
import type { ToastTone } from '../../store/useToast';

export type UsePlanDeeplinkEffectsDeps = {
  location: ReturnType<typeof useLocation>;
  navigate: ReturnType<typeof useNavigate>;
  planId: string;
  isReadOnly: boolean;
  push: (message: string, tone?: ToastTone) => void;
  t: ReturnType<typeof useT>;
  setSelectedObject: (id: string) => void;
  triggerHighlight: (id: string) => void;
  clearSelection: () => void;
  setSelectedRoomId: Dispatch<SetStateAction<string | undefined>>;
  setSelectedRoomIds: Dispatch<SetStateAction<string[]>>;
  setHighlightRoom: Dispatch<SetStateAction<{ roomId: string; until: number } | null>>;
  setRevisionsOpen: Dispatch<SetStateAction<boolean>>;
  setPrintAreaMode: Dispatch<SetStateAction<boolean>>;
  setRoomAllocationPreset: Dispatch<SetStateAction<{ clientId?: string; siteId?: string } | null>>;
  setRoomAllocationOpen: Dispatch<SetStateAction<boolean>>;
};

export function usePlanDeeplinkEffects(deps: UsePlanDeeplinkEffectsDeps) {
  const {
    location,
    navigate,
    planId,
    isReadOnly,
    push,
    t,
    setSelectedObject,
    triggerHighlight,
    clearSelection,
    setSelectedRoomId,
    setSelectedRoomIds,
    setHighlightRoom,
    setRevisionsOpen,
    setPrintAreaMode,
    setRoomAllocationPreset,
    setRoomAllocationOpen
  } = deps;

  useEffect(() => {
    const sp = new URLSearchParams(location.search || '');
    const focusObject = sp.get('focusObject');
    const focusRoom = sp.get('focusRoom');
    if (!focusObject && !focusRoom) return;
    const timer = window.setTimeout(() => {
      if (focusObject) {
        setSelectedObject(focusObject);
        triggerHighlight(focusObject);
      }
      if (focusRoom) {
        clearSelection();
        setSelectedRoomId(focusRoom);
        setSelectedRoomIds([focusRoom]);
        setHighlightRoom({ roomId: focusRoom, until: Date.now() + 3200 });
      }
      navigate(`/plan/${planId}`, { replace: true });
    }, 40);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tm') !== '1') return;
    setRevisionsOpen(true);
    params.delete('tm');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('pa') !== '1') return;
    if (isReadOnly) return;
    setPrintAreaMode(true);
    push(
      t({
        it: 'Disegna un rettangolo sulla mappa per impostare l’area di stampa.',
        en: 'Draw a rectangle on the map to set the print area.'
      }),
      'info'
    );
    params.delete('pa');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('fa') !== '1') return;
    const presetClientId = String(params.get('faClient') || '').trim();
    const presetSiteId = String(params.get('faSite') || '').trim();
    setRoomAllocationPreset({
      clientId: presetClientId || undefined,
      siteId: presetSiteId || undefined
    });
    setRoomAllocationOpen(true);
    params.delete('fa');
    params.delete('faClient');
    params.delete('faSite');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);
}
