import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

type CorridorModalLike = {
  initialName?: string;
  initialNameEn?: string;
  initialShowName?: boolean;
} | null;

export type UsePlanCorridorModalEffectsDeps = {
  corridorModal: CorridorModalLike;
  setCorridorNameInput: Dispatch<SetStateAction<string>>;
  setCorridorNameEnInput: Dispatch<SetStateAction<string>>;
  setCorridorShowNameInput: Dispatch<SetStateAction<boolean>>;
  corridorNameInputRef: MutableRefObject<HTMLInputElement | null>;
  corridorDoorLinkModal: unknown;
  corridorDoorLinkQuery: string;
  setCorridorDoorLinkQuery: Dispatch<SetStateAction<string>>;
};

/**
 * Draft-sync effects for the corridor modals: seed the name/visibility inputs
 * when the corridor edit/create modal opens, move focus into the name field,
 * and clear the door-link search query once that modal is dismissed.
 */
export function usePlanCorridorModalEffects(deps: UsePlanCorridorModalEffectsDeps) {
  const {
    corridorModal,
    setCorridorNameInput,
    setCorridorNameEnInput,
    setCorridorShowNameInput,
    corridorNameInputRef,
    corridorDoorLinkModal,
    corridorDoorLinkQuery,
    setCorridorDoorLinkQuery
  } = deps;

  useEffect(() => {
    if (!corridorModal) return;
    setCorridorNameInput(corridorModal.initialName || '');
    setCorridorNameEnInput(corridorModal.initialNameEn || '');
    setCorridorShowNameInput(corridorModal.initialShowName !== false);
  }, [corridorModal]);

  useEffect(() => {
    if (!corridorModal) return;
    const timer = window.setTimeout(() => {
      const el = corridorNameInputRef.current;
      if (!el) return;
      const len = el.value.length;
      el.focus();
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore unsupported inputs
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [corridorModal]);

  useEffect(() => {
    if (corridorDoorLinkModal) return;
    if (corridorDoorLinkQuery) setCorridorDoorLinkQuery('');
  }, [corridorDoorLinkModal, corridorDoorLinkQuery]);
}
