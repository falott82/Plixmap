import { useEffect } from 'react';
import { toast } from 'sonner';
import type { Corridor } from '../../store/types';
import type { useT } from '../../i18n/useT';

export type UsePlanHelpToastEffectsDeps = {
  t: ReturnType<typeof useT>;
  isReadOnly: boolean;
  selectedCorridorId: string | undefined;
  corridorById: Map<string, Corridor>;
  corridorDrawMode: 'poly' | null;
  roomDrawMode: 'rect' | 'poly' | null;
  selectedRoomId: string | undefined;
};

export function usePlanHelpToastEffects(deps: UsePlanHelpToastEffectsDeps) {
  const {
    t,
    isReadOnly,
    selectedCorridorId,
    corridorById,
    corridorDrawMode,
    roomDrawMode,
    selectedRoomId
  } = deps;

  const corridorLabelHelpToastId = 'corridor-label-help';
  const corridorPolyHelpToastId = 'corridor-poly-help';
  const roomPolyHelpToastId = 'room-poly-help';
  const roomLabelHelpToastId = 'room-label-help';
  useEffect(() => {
    if (isReadOnly || !selectedCorridorId) {
      toast.dismiss(corridorLabelHelpToastId);
      return;
    }
    const selected = corridorById.get(selectedCorridorId);
    if (!selected || selected.showName === false || !String(selected.name || '').trim()) {
      toast.dismiss(corridorLabelHelpToastId);
      return;
    }
    toast.info(
      t({
        it: 'Comandi corridoio: trascina etichetta per spostarla, usa + / - per dimensione testo, premi E per rinomina; tasto centrale del mouse sul corridoio = aggiungi punto di snodo.',
        en: 'Corridor commands: drag label to move, use + / - to resize text, press E to rename; middle mouse button on corridor = add junction point.'
      }),
      {
        id: corridorLabelHelpToastId,
        duration: Infinity
      }
    );
  }, [corridorById, isReadOnly, selectedCorridorId, t]);
  useEffect(() => {
    return () => {
      toast.dismiss(corridorLabelHelpToastId);
    };
  }, []);
  useEffect(() => {
    if (isReadOnly || corridorDrawMode !== 'poly') {
      toast.dismiss(corridorPolyHelpToastId);
      return;
    }
    toast.info(
      t({
        it:
          'Disegno corridoio: clicca i vertici del perimetro. Click destro rimuove l’ultimo punto. Esc interrompe il disegno. Invio conclude il corridoio (oppure chiudi tornando sul primo punto).',
        en:
          'Corridor drawing: click perimeter vertices. Right click removes the last point. Esc cancels drawing. Enter finalizes the corridor (or close by returning to the first point).'
      }),
      {
        id: corridorPolyHelpToastId,
        duration: Infinity
      }
    );
  }, [corridorDrawMode, isReadOnly, t]);
  useEffect(() => {
    if (isReadOnly || roomDrawMode !== 'poly') {
      toast.dismiss(roomPolyHelpToastId);
      return;
    }
    toast.info(
      t({
        it:
          'Disegno stanza poligonale: linee orizzontali/verticali di default. Tieni premuto Shift per tracciare linee oblique. Per chiudere il poligono torna sul punto iniziale o premi Invio. Backspace annulla l’ultimo vertice.',
        en:
          'Polygon room drawing: horizontal/vertical lines by default. Hold Shift to draw oblique lines. Close the polygon by returning to the starting point or pressing Enter. Backspace removes the last vertex.'
      }),
      {
        id: roomPolyHelpToastId,
        duration: Infinity
      }
    );
  }, [isReadOnly, roomDrawMode, t]);
  useEffect(() => {
    if (isReadOnly || !selectedRoomId || roomDrawMode) {
      toast.dismiss(roomLabelHelpToastId);
      return;
    }
    toast.info(
      t({
        it: 'Stanza selezionata: frecce per spostare la stanza, Shift+frecce per spostare la scritta (alto/basso/sinistra/destra), + / - per dimensione testo.',
        en: 'Selected room: arrows move the room, Shift+arrows move the label (top/bottom/left/right), + / - changes text size.'
      }),
      {
        id: roomLabelHelpToastId,
        duration: Infinity
      }
    );
  }, [isReadOnly, roomDrawMode, selectedRoomId, t]);
  useEffect(() => {
    return () => {
      toast.dismiss(corridorPolyHelpToastId);
      toast.dismiss(roomPolyHelpToastId);
      toast.dismiss(roomLabelHelpToastId);
    };
  }, []);
}
