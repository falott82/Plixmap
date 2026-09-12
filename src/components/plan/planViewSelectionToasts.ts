import type { MutableRefObject, ReactNode } from 'react';
import { toast } from 'sonner';
import type { FloorPlan, MapObject } from '../../store/types';
import type { useT } from '../../i18n/useT';

// Body-extraction of usePlanView's selection-hint toast useEffects. Each effect body is moved
// verbatim; the closed-over values are passed in via `deps` (mirroring each effect's existing
// dependency array plus the refs it reads). The effect wrappers and dependency arrays in
// usePlanView remain unchanged. These effects have no cleanup.

export type RenderKeybindToast = (
  title: { it: string; en: string },
  items: Array<{ cmd: string; it: string; en: string }>
) => ReactNode;

export type SelectionHintToastIds = MutableRefObject<{
  selection: string;
  multi: string;
  desk: string;
  quote: string;
  media: string;
}>;

type CommonToastDeps = {
  contextMenu: unknown;
  renderPlan: FloorPlan | undefined;
  selectedObjectIds: string[];
  renderKeybindToast: RenderKeybindToast;
  selectionHintToastIds: SelectionHintToastIds;
};

export type MultiToastDeps = CommonToastDeps & {
  multiToastKeyRef: MutableRefObject<string>;
  multiToastIdRef: MutableRefObject<string | number | null>;
};

export const runMultiSelectionToastEffect = (deps: MultiToastDeps): void => {
  const {
    contextMenu,
    renderPlan,
    selectedObjectIds,
    renderKeybindToast,
    selectionHintToastIds,
    multiToastKeyRef,
    multiToastIdRef
  } = deps;
    if (contextMenu || !renderPlan || selectedObjectIds.length < 2) {
      multiToastKeyRef.current = '';
      if (multiToastIdRef.current != null) {
        toast.dismiss(multiToastIdRef.current);
        multiToastIdRef.current = null;
      }
      return;
    }
    const key = selectedObjectIds.slice().sort().join(',');
    if (multiToastKeyRef.current === key) return;
    multiToastKeyRef.current = key;
    if (multiToastIdRef.current != null) {
      toast.dismiss(multiToastIdRef.current);
    }
    const count = selectedObjectIds.length;
    const items =
      count === 2
        ? [
            { cmd: '+ / −', it: 'scala', en: 'scale' },
            { cmd: 'Ctrl/Cmd + C / V', it: 'copia/incolla', en: 'copy/paste' },
            { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
            { cmd: 'Canc', it: 'elimina', en: 'delete' }
          ]
        : [
            { cmd: '+ / −', it: 'scala', en: 'scale' },
            { cmd: 'Ctrl/Cmd + C / V', it: 'copia/incolla', en: 'copy/paste' },
            { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
            { cmd: 'Canc', it: 'elimina', en: 'delete' }
          ];
    multiToastIdRef.current = toast.info(
      renderKeybindToast(
        { it: `${count} oggetti selezionati`, en: `${count} objects selected` },
        items
      ),
      { duration: Infinity, id: selectionHintToastIds.current.multi }
    );
};

export type DeskToastDeps = CommonToastDeps & {
  selectedSingleObject: MapObject | undefined;
  isDeskType: (type: string) => boolean;
  deskToastKeyRef: MutableRefObject<string>;
  deskToastIdRef: MutableRefObject<string | number | null>;
};

export const runDeskSelectionToastEffect = (deps: DeskToastDeps): void => {
  const {
    contextMenu,
    renderPlan,
    selectedObjectIds,
    selectedSingleObject,
    isDeskType,
    renderKeybindToast,
    selectionHintToastIds,
    deskToastKeyRef,
    deskToastIdRef
  } = deps;
    if (contextMenu || !renderPlan || selectedObjectIds.length !== 1) {
      deskToastKeyRef.current = '';
      if (deskToastIdRef.current != null) {
        toast.dismiss(deskToastIdRef.current);
        deskToastIdRef.current = null;
      }
      return;
    }
    const selectedId = selectedObjectIds[0];
    const deskIds = selectedSingleObject && isDeskType(selectedSingleObject.type) ? [selectedId] : [];
    if (!deskIds.length) {
      deskToastKeyRef.current = '';
      if (deskToastIdRef.current != null) {
        toast.dismiss(deskToastIdRef.current);
        deskToastIdRef.current = null;
      }
      return;
    }
    const key = deskIds.slice().sort().join(',');
    if (deskToastKeyRef.current === key) return;
    deskToastKeyRef.current = key;
    if (deskToastIdRef.current != null) {
      toast.dismiss(deskToastIdRef.current);
    }
    deskToastIdRef.current = toast.info(
      renderKeybindToast(
        { it: 'Scrivania selezionata', en: 'Desk selected' },
        [
          { cmd: 'Frecce', it: 'sposta (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
          { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
          { cmd: '+ / −', it: 'scala', en: 'scale' }
        ]
      ),
      { duration: Infinity, id: selectionHintToastIds.current.desk }
    );
};

export type QuoteToastDeps = CommonToastDeps & {
  selectedSingleObject: MapObject | undefined;
  quoteToastKeyRef: MutableRefObject<string>;
  quoteToastIdRef: MutableRefObject<string | number | null>;
};

export const runQuoteSelectionToastEffect = (deps: QuoteToastDeps): void => {
  const {
    contextMenu,
    renderPlan,
    selectedObjectIds,
    selectedSingleObject,
    renderKeybindToast,
    selectionHintToastIds,
    quoteToastKeyRef,
    quoteToastIdRef
  } = deps;
    if (contextMenu || !renderPlan || selectedObjectIds.length !== 1) {
      quoteToastKeyRef.current = '';
      if (quoteToastIdRef.current != null) {
        toast.dismiss(quoteToastIdRef.current);
        quoteToastIdRef.current = null;
      }
      return;
    }
    const selectedId = selectedObjectIds[0];
    const quoteIds = selectedSingleObject?.type === 'quote' ? [selectedId] : [];
    if (!quoteIds.length) {
      quoteToastKeyRef.current = '';
      if (quoteToastIdRef.current != null) {
        toast.dismiss(quoteToastIdRef.current);
        quoteToastIdRef.current = null;
      }
      return;
    }
    const key = quoteIds.slice().sort().join(',');
    if (quoteToastKeyRef.current === key) return;
    quoteToastKeyRef.current = key;
    if (quoteToastIdRef.current != null) {
      toast.dismiss(quoteToastIdRef.current);
    }
    quoteToastIdRef.current = toast.info(
      renderKeybindToast(
        { it: 'Quota selezionata', en: 'Quote selected' },
        [
          { cmd: 'Trascina', it: 'sposta la quota', en: 'move the quote' },
          { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
          { cmd: 'Ctrl/Cmd + Frecce', it: 'sposta la scritta', en: 'move the label' },
          {
            cmd: 'Trascina gli apici',
            it: 'allunga/accorcia (Shift blocca orizz./vert.)',
            en: 'extend/shrink (Shift locks horizontal/vertical)'
          },
          { cmd: '+ / −', it: 'scala', en: 'scale' },
          { cmd: 'E', it: 'modifica', en: 'edit' }
        ]
      ),
      { duration: Infinity, id: selectionHintToastIds.current.quote }
    );
};

export type MediaToastDeps = CommonToastDeps & {
  selectedSingleObject: MapObject | undefined;
  mediaToastKeyRef: MutableRefObject<string>;
  mediaToastIdRef: MutableRefObject<string | number | null>;
};

export const runMediaSelectionToastEffect = (deps: MediaToastDeps): void => {
  const {
    contextMenu,
    renderPlan,
    selectedObjectIds,
    selectedSingleObject,
    renderKeybindToast,
    selectionHintToastIds,
    mediaToastKeyRef,
    mediaToastIdRef
  } = deps;
    if (contextMenu || !renderPlan || selectedObjectIds.length !== 1) {
      mediaToastKeyRef.current = '';
      if (mediaToastIdRef.current != null) {
        toast.dismiss(mediaToastIdRef.current);
        mediaToastIdRef.current = null;
      }
      return;
    }
    const selectedId = selectedObjectIds[0];
    const selectedType = selectedSingleObject?.type || '';
    const textIds = selectedType === 'text' ? [selectedId] : [];
    const imageIds = selectedType === 'image' ? [selectedId] : [];
    const photoIds = selectedType === 'photo' ? [selectedId] : [];
    const postitIds = selectedType === 'postit' ? [selectedId] : [];
    if (!textIds.length && !imageIds.length && !photoIds.length && !postitIds.length) {
      mediaToastKeyRef.current = '';
      if (mediaToastIdRef.current != null) {
        toast.dismiss(mediaToastIdRef.current);
        mediaToastIdRef.current = null;
      }
      return;
    }
    const key = `t:${textIds.slice().sort().join(',')}|i:${imageIds.slice().sort().join(',')}|ph:${photoIds
      .slice()
      .sort()
      .join(',')}|p:${postitIds
      .slice()
      .sort()
      .join(',')}`;
    if (mediaToastKeyRef.current === key) return;
    mediaToastKeyRef.current = key;
    if (mediaToastIdRef.current != null) {
      toast.dismiss(mediaToastIdRef.current);
    }
    const message =
      textIds.length && !imageIds.length && !photoIds.length && !postitIds.length
        ? renderKeybindToast(
            { it: 'Testo selezionato', en: 'Text selected' },
            [
              { cmd: 'Trascina', it: 'sposta', en: 'move' },
              { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
              { cmd: 'Maniglie', it: 'ridimensiona/ruota', en: 'resize/rotate' },
              { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
              { cmd: '+ / −', it: 'dimensione font', en: 'font size' },
              { cmd: 'F', it: 'font avanti', en: 'next font' },
              { cmd: 'Shift + B', it: 'font indietro', en: 'previous font' },
              { cmd: 'C', it: 'colore avanti', en: 'next color' },
              { cmd: 'Shift + C', it: 'colore indietro', en: 'previous color' },
              { cmd: 'B', it: 'mostra/nasconde background', en: 'toggle background' },
              { cmd: 'E', it: 'modifica', en: 'edit' }
            ]
          )
        : imageIds.length && !textIds.length && !photoIds.length && !postitIds.length
          ? renderKeybindToast(
              { it: 'Immagine selezionata', en: 'Image selected' },
              [
                { cmd: 'Trascina', it: 'sposta', en: 'move' },
                { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
                { cmd: 'Maniglie', it: 'ridimensiona/ruota', en: 'resize/rotate' },
                { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
                { cmd: '+ / −', it: 'scala', en: 'scale' },
                { cmd: 'E', it: 'modifica', en: 'edit' }
              ]
            )
            : photoIds.length && !textIds.length && !imageIds.length && !postitIds.length
              ? renderKeybindToast(
                  { it: 'Foto selezionata', en: 'Photo selected' },
                  [
                    { cmd: 'Trascina', it: 'sposta', en: 'move' },
                    { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
                    { cmd: '+ / −', it: 'scala', en: 'scale' },
                    { cmd: 'Doppio click', it: 'apri foto', en: 'open photo' },
                    { cmd: 'E', it: 'modifica', en: 'edit' }
                  ]
                )
              : postitIds.length && !textIds.length && !imageIds.length && !photoIds.length
                ? renderKeybindToast(
                    { it: 'Post-it selezionato', en: 'Post-it selected' },
                [
                  { cmd: 'Trascina', it: 'sposta', en: 'move' },
                  { cmd: 'Click icona', it: 'compatta/espandi', en: 'compact/expand' },
                  { cmd: '+ / −', it: 'scala', en: 'scale' },
                  { cmd: 'E', it: 'modifica', en: 'edit' }
                ]
              )
            : (() => {
                const base = [
                  { cmd: 'Trascina', it: 'sposta', en: 'move' },
                  { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
                  { cmd: 'Maniglie', it: 'ridimensiona/ruota', en: 'resize/rotate' },
                  { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
                  { cmd: '+ / −', it: 'scala', en: 'scale' },
                  { cmd: 'E', it: 'modifica', en: 'edit' }
                ];
                if (!textIds.length && !imageIds.length) {
                  const rotateIdx = base.findIndex((item) => item.cmd === 'Ctrl/Cmd + ←/→');
                  if (rotateIdx >= 0) base.splice(rotateIdx, 1);
                  const handleIdx = base.findIndex((item) => item.cmd === 'Maniglie');
                  if (handleIdx >= 0) base.splice(handleIdx, 1);
                }
                return renderKeybindToast({ it: 'Annotazioni selezionate', en: 'Annotations selected' }, base);
              })();
    mediaToastIdRef.current = toast.info(message, { duration: Infinity, id: selectionHintToastIds.current.media });
};

export type SelectionToastDeps = CommonToastDeps & {
  selectedSingleObject: MapObject | undefined;
  isDeskType: (type: string) => boolean;
  getTypeLabel: (type: string) => string;
  t: ReturnType<typeof useT>;
  selectionToastKeyRef: MutableRefObject<string>;
  selectionToastIdRef: MutableRefObject<string | number | null>;
};

export const runObjectSelectionToastEffect = (deps: SelectionToastDeps): void => {
  const {
    contextMenu,
    renderPlan,
    selectedObjectIds,
    selectedSingleObject,
    isDeskType,
    getTypeLabel,
    t,
    renderKeybindToast,
    selectionHintToastIds,
    selectionToastKeyRef,
    selectionToastIdRef
  } = deps;
    if (contextMenu || !renderPlan || selectedObjectIds.length !== 1) {
      selectionToastKeyRef.current = '';
      if (selectionToastIdRef.current != null) {
        toast.dismiss(selectionToastIdRef.current);
        selectionToastIdRef.current = null;
      }
      return;
    }
    const id = selectedObjectIds[0];
    const obj = selectedSingleObject;
    if (!obj) return;
    if (
      isDeskType(obj.type) ||
      obj.type === 'quote' ||
      obj.type === 'text' ||
      obj.type === 'image' ||
      obj.type === 'photo' ||
      obj.type === 'postit'
    ) {
      selectionToastKeyRef.current = '';
      if (selectionToastIdRef.current != null) {
        toast.dismiss(selectionToastIdRef.current);
        selectionToastIdRef.current = null;
      }
      return;
    }
    if (selectionToastKeyRef.current === id) return;
    selectionToastKeyRef.current = id;
    if (selectionToastIdRef.current != null) {
      toast.dismiss(selectionToastIdRef.current);
    }
    const objectTypeLabel = getTypeLabel(obj.type);
    const objectNameLabel = String(obj.name || '').trim() || t({ it: 'Senza nome', en: 'Unnamed' });
    selectionToastIdRef.current = toast.info(
      renderKeybindToast(
        { it: 'Oggetto selezionato', en: 'Object selected' },
        [
          { cmd: t({ it: 'Tipo oggetto:', en: 'Object type:' }), it: objectTypeLabel, en: objectTypeLabel },
          { cmd: t({ it: 'Nome oggetto:', en: 'Object name:' }), it: objectNameLabel, en: objectNameLabel },
          { cmd: 'Trascina', it: 'sposta', en: 'move' },
          { cmd: 'Frecce', it: 'muovi (Shift per passi maggiori)', en: 'move (Shift for larger steps)' },
          { cmd: 'Ctrl/Cmd + ←/→', it: 'ruota di 90°', en: 'rotate 90°' },
          { cmd: '+ / −', it: 'scala', en: 'scale' },
          { cmd: 'E', it: 'modifica', en: 'edit' }
        ]
      ),
      { duration: Infinity, id: selectionHintToastIds.current.selection }
    );
};

export type DismissSelectionHintToastsDeps = {
  selectionHintToastIds: SelectionHintToastIds;
  selectionToastKeyRef: MutableRefObject<string>;
  selectionToastIdRef: MutableRefObject<string | number | null>;
  deskToastKeyRef: MutableRefObject<string>;
  deskToastIdRef: MutableRefObject<string | number | null>;
  multiToastKeyRef: MutableRefObject<string>;
  multiToastIdRef: MutableRefObject<string | number | null>;
  quoteToastKeyRef: MutableRefObject<string>;
  quoteToastIdRef: MutableRefObject<string | number | null>;
  mediaToastKeyRef: MutableRefObject<string>;
  mediaToastIdRef: MutableRefObject<string | number | null>;
};

export const runDismissSelectionHintToasts = (deps: DismissSelectionHintToastsDeps): void => {
  const {
    selectionHintToastIds,
    selectionToastKeyRef,
    selectionToastIdRef,
    deskToastKeyRef,
    deskToastIdRef,
    multiToastKeyRef,
    multiToastIdRef,
    quoteToastKeyRef,
    quoteToastIdRef,
    mediaToastKeyRef,
    mediaToastIdRef
  } = deps;
    toast.dismiss(selectionHintToastIds.current.selection);
    toast.dismiss(selectionHintToastIds.current.desk);
    toast.dismiss(selectionHintToastIds.current.multi);
    toast.dismiss(selectionHintToastIds.current.quote);
    toast.dismiss(selectionHintToastIds.current.media);
    selectionToastKeyRef.current = '';
    if (selectionToastIdRef.current != null) {
      toast.dismiss(selectionToastIdRef.current);
      selectionToastIdRef.current = null;
    }
    deskToastKeyRef.current = '';
    if (deskToastIdRef.current != null) {
      toast.dismiss(deskToastIdRef.current);
      deskToastIdRef.current = null;
    }
    multiToastKeyRef.current = '';
    if (multiToastIdRef.current != null) {
      toast.dismiss(multiToastIdRef.current);
      multiToastIdRef.current = null;
    }
    quoteToastKeyRef.current = '';
    if (quoteToastIdRef.current != null) {
      toast.dismiss(quoteToastIdRef.current);
      quoteToastIdRef.current = null;
    }
    mediaToastKeyRef.current = '';
    if (mediaToastIdRef.current != null) {
      toast.dismiss(mediaToastIdRef.current);
      mediaToastIdRef.current = null;
    }
};
