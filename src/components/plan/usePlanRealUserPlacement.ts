/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import type { MapObjectType } from '../../store/types';
import { hasExternalUsers } from '../../api/customImport';

// Real-user placement handlers (open the real-user picker if the client has imported users,
// proceed-place-user dispatch) extracted from usePlanView. Bodies + dep arrays moved verbatim.
export const usePlanRealUserPlacement = (deps: any) => {
  const { isReadOnly, setPendingType, client, setRealUserImportMissing, setRealUserPicker, setModalState } = deps;

  const openRealUserPickerAt = useCallback(
    async (x: number, y: number) => {
      if (isReadOnly) return;
      setPendingType(null);
      if (!client?.id) {
        setRealUserImportMissing(true);
        return;
      }
      try {
        const hasUsers = await hasExternalUsers(client.id);
        if (!hasUsers) {
          setRealUserImportMissing(true);
          return;
        }
        setRealUserPicker({ x, y });
      } catch {
        setRealUserImportMissing(true);
      }
    },
    [client?.id, isReadOnly, setPendingType, setRealUserImportMissing, setRealUserPicker]
  );

  const proceedPlaceUser = useCallback(
    (type: MapObjectType, x: number, y: number) => {
      if (type === 'real_user') {
        void openRealUserPickerAt(x, y);
        return;
      }
      setModalState({ mode: 'create', type, coords: { x, y } });
      setPendingType(null);
    },
    [openRealUserPickerAt, setModalState, setPendingType]
  );

  return { openRealUserPickerAt, proceedPlaceUser };
};
