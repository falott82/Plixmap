import { useCallback } from 'react';
import { runOpenMediaViewer } from './planViewMiscCallbacks';

// Media/photo viewer handlers extracted from usePlanView (generic media viewer
// opener, photo/image specializations, focus-from-gallery selection). Bodies are
// verbatim; shared deps injected once.
export const usePlanMediaViewerHandlers = (deps: any) => {
  const {
    renderPlan,
    renderPlanObjectById,
    push,
    t,
    setPhotoViewer,
    returnToBulkEditRef,
    triggerHighlight,
    setSelection,
    setSelectedObject,
    setSelectedRoomId,
    setSelectedRoomIds,
    setSelectedLinkId
  } = deps;

  const openMediaViewer = useCallback(
    (payload: {
      id: string;
      selectionIds?: string[];
      types: string[];
      title: { it: string; en: string };
      countLabel: { it: string; en: string };
      itemLabel: { it: string; en: string };
      emptyToast: { it: string; en: string };
      emptyLabel?: { it: string; en: string };
    }) => {
      runOpenMediaViewer(payload, { renderPlan, renderPlanObjectById, push, t, setPhotoViewer });
    },
    [push, renderPlan, renderPlanObjectById, t, setPhotoViewer]
  );

  const openPhotoViewer = useCallback(
    (payload: { id: string; selectionIds?: string[] }) => {
      openMediaViewer({
        ...payload,
        types: ['photo'],
        title: { it: 'Foto', en: 'Photos' },
        countLabel: { it: 'foto', en: 'photos' },
        itemLabel: { it: 'Foto', en: 'Photo' },
        emptyToast: { it: 'Nessuna foto disponibile per la selezione.', en: 'No photos available for this selection.' },
        emptyLabel: { it: 'Nessuna foto disponibile', en: 'No photos available' }
      });
    },
    [openMediaViewer]
  );

  const openImageViewer = useCallback(
    (payload: { id: string; selectionIds?: string[] }) => {
      openMediaViewer({
        ...payload,
        types: ['image'],
        title: { it: 'Immagini', en: 'Images' },
        countLabel: { it: 'immagini', en: 'images' },
        itemLabel: { it: 'Immagine', en: 'Image' },
        emptyToast: { it: 'Nessuna immagine disponibile per la selezione.', en: 'No images available for this selection.' },
        emptyLabel: { it: 'Nessuna immagine disponibile', en: 'No images available' }
      });
    },
    [openMediaViewer]
  );

  const focusPhotoFromGallery = useCallback(
    (id: string) => {
      if (!renderPlan) return;
      returnToBulkEditRef.current = false;
      const obj = renderPlanObjectById.get(id);
      if (!obj) return;
      setSelection([id]);
      setSelectedObject(id);
      setSelectedRoomId(undefined);
      setSelectedRoomIds([]);
      setSelectedLinkId(null);
      triggerHighlight(id);
    },
    [renderPlan, renderPlanObjectById, setSelectedLinkId, setSelectedObject, setSelectedRoomId, setSelectedRoomIds, setSelection, triggerHighlight, returnToBulkEditRef]
  );

  return { openMediaViewer, openPhotoViewer, openImageViewer, focusPhotoFromGallery };
};
