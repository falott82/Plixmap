type Translator = (msg: { it: string; en: string }) => string;

type BlockingUiStaticDeps = {
  setCorridorDoorLinkModal: (value: any) => void,
  setCorridorDoorModal: (value: any) => void,
  setCorridorConnectionModal: (value: any) => void,
  setCorridorModal: (value: any) => void
};

type DraftCancelStaticDeps = {
  setRoomDrawMode: (value: any) => void,
  setCorridorDrawMode: (value: any) => void,
  setCorridorDoorDraft: (value: any) => void,
  setRoomDoorDraft: (value: any) => void,
  setLinkFromId: (value: any) => void,
  push: (message: string, kind: 'info' | 'success' | 'danger') => void,
  t: Translator
};

export const createPlanBlockingUiShortcutHandler = ({
  setCorridorDoorLinkModal,
  setCorridorDoorModal,
  setCorridorConnectionModal,
  setCorridorModal
}: BlockingUiStaticDeps) =>
  (
    e: KeyboardEvent,
    allTypesOpen: boolean,
    corridorModal: any,
    corridorConnectionModal: any,
    corridorDoorModal: any,
    corridorDoorLinkModal: any
  ): boolean => {
    if (allTypesOpen) return true;
    const hasBlockingModal =
      !!corridorModal ||
      !!corridorConnectionModal ||
      !!corridorDoorModal ||
      !!corridorDoorLinkModal;
    if (!hasBlockingModal) return false;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (corridorDoorLinkModal) setCorridorDoorLinkModal(null);
      else if (corridorDoorModal) setCorridorDoorModal(null);
      else if (corridorConnectionModal) setCorridorConnectionModal(null);
      else if (corridorModal) setCorridorModal(null);
    }
    return true;
  };

export const createPlanDraftCancelShortcutHandler = ({
  setRoomDrawMode,
  setCorridorDrawMode,
  setCorridorDoorDraft,
  setRoomDoorDraft,
  setLinkFromId,
  push,
  t
}: DraftCancelStaticDeps) =>
  (
    e: KeyboardEvent,
    roomDrawMode: any,
    corridorDrawMode: any,
    corridorDoorDraft: any,
    roomDoorDraft: any,
    linkFromId: string | null
  ): boolean => {
    if (e.key !== 'Escape') return false;
    if (roomDrawMode) {
      e.preventDefault();
      setRoomDrawMode(null);
      push(t({ it: 'Disegno stanza annullato', en: 'Room drawing cancelled' }), 'info');
      return true;
    }
    if (corridorDrawMode) {
      e.preventDefault();
      setCorridorDrawMode(null);
      push(t({ it: 'Disegno corridoio annullato', en: 'Corridor drawing cancelled' }), 'info');
      return true;
    }
    if (corridorDoorDraft) {
      e.preventDefault();
      setCorridorDoorDraft(null);
      push(t({ it: 'Disegno porta corridoio annullato', en: 'Corridor door drawing cancelled' }), 'info');
      return true;
    }
    if (roomDoorDraft) {
      e.preventDefault();
      setRoomDoorDraft(null);
      push(t({ it: 'Inserimento porta di collegamento annullato', en: 'Connecting door placement cancelled' }), 'info');
      return true;
    }
    if (linkFromId) {
      e.preventDefault();
      setLinkFromId(null);
      push(t({ it: 'Creazione collegamento annullata', en: 'Link creation cancelled' }), 'info');
      return true;
    }
    return false;
  };
