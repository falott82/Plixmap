import { BookmarkPlus, Camera, Crop, Eye, EyeOff, FileDown, Home, Image as ImageIcon, LayoutGrid, MoveDiagonal, Ruler, Square, StickyNote, Trash, Type as TypeIcon } from 'lucide-react';
import { usePlanView } from './usePlanView';

type ContextMenuMapSubmenusProps = Pick<
  ReturnType<typeof usePlanView>,
  | 'basePlan' | 'beginCorridorPolyDraw' | 'contextMenu' | 'deskCatalogDefs' | 'getSubmenuStyle'
  | 'goToDefaultView' | 'hasDefaultView' | 'isReadOnly' | 'mapSubmenu' | 'metersPerPixel'
  | 'push' | 'requestClearScale' | 'setAllTypesDefaultTab' | 'setAllTypesOpen' | 'setConfirmClearObjects'
  | 'setContextMenu' | 'setDeskCatalogOpen' | 'setExportModalOpen' | 'setMeasureMode' | 'setPaletteSection'
  | 'setPanToolActive' | 'setPendingType' | 'setPrintAreaMode' | 'setRoomCatalogOpen' | 'setRoomDrawMode'
  | 'setScaleMode' | 'setViewModalOpen' | 'setWallCatalogOpen' | 'setWallDrawMode' | 'showPrintArea'
  | 'startMeasure' | 'startQuote' | 'startScaleMode' | 't' | 'toggleShowPrintArea' | 'updateFloorPlan'
  | 'wallTypeDefs'
>;

/**
 * The five map-context submenus (view / measure / create / print / manage),
 * rendered when contextMenu.kind === 'map'. Extracted from ContextMenuPanel.
 */
export const ContextMenuMapSubmenus = (props: ContextMenuMapSubmenusProps) => {
  const {
    basePlan,
    beginCorridorPolyDraw,
    contextMenu,
    deskCatalogDefs,
    getSubmenuStyle,
    goToDefaultView,
    hasDefaultView,
    isReadOnly,
    mapSubmenu,
    metersPerPixel,
    push,
    requestClearScale,
    setAllTypesDefaultTab,
    setAllTypesOpen,
    setConfirmClearObjects,
    setContextMenu,
    setDeskCatalogOpen,
    setExportModalOpen,
    setMeasureMode,
    setPaletteSection,
    setPanToolActive,
    setPendingType,
    setPrintAreaMode,
    setRoomCatalogOpen,
    setRoomDrawMode,
    setScaleMode,
    setViewModalOpen,
    setWallCatalogOpen,
    setWallDrawMode,
    showPrintArea,
    startMeasure,
    startQuote,
    startScaleMode,
    t,
    toggleShowPrintArea,
    updateFloorPlan,
    wallTypeDefs
  } = props;
  if (!contextMenu) return null;
  return (
      <>
        {contextMenu.kind === 'map' && mapSubmenu === 'view' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Vista', en: 'View' })}</div>
            {!isReadOnly ? (
              <button
                onClick={() => {
                  setViewModalOpen(true);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Salva vista', en: 'Save view' })}
              >
                <BookmarkPlus size={14} className="text-slate-500" /> {t({ it: 'Salva vista', en: 'Save view' })}
              </button>
            ) : null}
            <button
              onClick={() => {
                if (!hasDefaultView) return;
                goToDefaultView();
                setContextMenu(null);
              }}
              disabled={!hasDefaultView}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              title={
                hasDefaultView
                  ? t({ it: 'Vai a default', en: 'Go to default' })
                  : t({ it: 'Imposta prima una vista di default', en: 'Set a default view first' })
              }
            >
              <Home size={14} className="text-slate-500" /> {t({ it: 'Vai a default', en: 'Go to default' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'measure' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">
              {t({ it: 'Misure', en: 'Measurements' })}
            </div>
            {!metersPerPixel && !isReadOnly ? (
              <button
                onClick={() => {
                  if ((contextMenu as any).kind !== 'map') return;
                  startScaleMode();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-50"
                title={t({ it: 'Imposta la scala della planimetria', en: 'Set the floor plan scale' })}
              >
                <Ruler size={14} className="text-rose-600" /> {t({ it: 'Imposta scala', en: 'Set scale' })}
              </button>
            ) : null}
            {metersPerPixel && !isReadOnly ? (
              <button
                onClick={() => {
                  if ((contextMenu as any).kind !== 'map') return;
                  requestClearScale();
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-700 hover:bg-rose-50"
                title={t({ it: 'Cancella la scala della planimetria', en: 'Clear the floor plan scale' })}
              >
                <Ruler size={14} className="text-rose-600" /> {t({ it: 'Cancella scala', en: 'Clear scale' })}
              </button>
            ) : null}
            <button
              onClick={() => {
                if ((contextMenu as any).kind !== 'map') return;
                startMeasure({ x: (contextMenu as any).worldX, y: (contextMenu as any).worldY });
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Misura distanza (m)', en: 'Measure distance (m)' })}
            >
              <Ruler size={14} className="text-slate-500" /> {t({ it: 'Misura distanza (m)', en: 'Measure distance (m)' })}
            </button>
            <button
              onClick={() => {
                if ((contextMenu as any).kind !== 'map') return;
                startQuote({ x: (contextMenu as any).worldX, y: (contextMenu as any).worldY });
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Quota (Q)', en: 'Quote (Q)' })}
            >
              <MoveDiagonal size={14} className="text-slate-500" /> {t({ it: 'Quota (Q)', en: 'Quote (Q)' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'create' ? (
          <div
            className="fixed z-50 w-80 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(320)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Aggiungi', en: 'Add' })}</div>
            {!isReadOnly ? (
              <>
                <div className="px-2 pt-1 text-[11px] font-semibold text-slate-500">{t({ it: 'Stanze', en: 'Rooms' })}</div>
                <button
                  onClick={() => {
                    setRoomCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Apri catalogo stanze', en: 'Open room catalog' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Catalogo stanze', en: 'Room catalog' })}
                </button>
                <button
                  onClick={() => {
                    beginCorridorPolyDraw();
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Crea corridoio', en: 'Create corridor' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Crea corridoio', en: 'Create corridor' })}
                </button>
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Oggetti', en: 'Objects' })}</div>
                <button
                  onClick={() => {
                    setAllTypesDefaultTab('objects');
                    setAllTypesOpen(true);
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Apri catalogo oggetti', en: 'Open object catalog' })}
                >
                  <LayoutGrid size={14} className="text-slate-500" /> {t({ it: 'Catalogo oggetti', en: 'Object catalog' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('text');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi testo', en: 'Add text' })}
                >
                  <TypeIcon size={14} className="text-slate-500" /> {t({ it: 'Aggiungi testo', en: 'Add text' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('image');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi immagine', en: 'Add image' })}
                >
                  <ImageIcon size={14} className="text-slate-500" /> {t({ it: 'Aggiungi immagine', en: 'Add image' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('photo');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi foto', en: 'Add photo' })}
                >
                  <Camera size={14} className="text-slate-500" /> {t({ it: 'Aggiungi foto', en: 'Add photo' })}
                </button>
                <button
                  onClick={() => {
                    setWallDrawMode(false);
                    setMeasureMode(false);
                    setScaleMode(false);
                    setRoomDrawMode(null);
                    setPanToolActive(false);
                    setPendingType('postit');
                    setPaletteSection('objects');
                    setContextMenu(null);
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  title={t({ it: 'Aggiungi post-it', en: 'Add post-it' })}
                >
                  <StickyNote size={14} className="text-slate-500" /> {t({ it: 'Aggiungi post-it', en: 'Add post-it' })}
                </button>
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Scrivanie', en: 'Desks' })}</div>
                <button
                  onClick={() => {
                    if (!deskCatalogDefs.length) return;
                    setDeskCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  disabled={!deskCatalogDefs.length}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={t({ it: 'Apri catalogo scrivanie', en: 'Open desk catalog' })}
                >
                  <LayoutGrid size={14} className="text-slate-500" /> {t({ it: 'Catalogo scrivanie', en: 'Desk catalog' })}
                </button>
                {!deskCatalogDefs.length ? (
                  <div className="mt-2 px-2 text-xs text-slate-500">
                    {t({ it: 'Nessuna scrivania disponibile.', en: 'No desks available.' })}
                  </div>
                ) : null}
                <div className="my-2 h-px bg-slate-100" />
                <div className="px-2 text-[11px] font-semibold text-slate-500">{t({ it: 'Mura', en: 'Walls' })}</div>
                <button
                  onClick={() => {
                    if (!wallTypeDefs.length) return;
                    setWallCatalogOpen(true);
                    setContextMenu(null);
                  }}
                  disabled={!wallTypeDefs.length}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  title={t({ it: 'Apri catalogo mura', en: 'Open wall catalog' })}
                >
                  <Square size={14} className="text-slate-500" /> {t({ it: 'Catalogo mura', en: 'Wall catalog' })}
                </button>
                {!wallTypeDefs.length ? (
                  <div className="mt-2 px-2 text-xs text-slate-500">
                    {t({ it: 'Nessun muro disponibile.', en: 'No walls available.' })}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="px-2 py-2 text-xs text-slate-500">{t({ it: 'Sola lettura', en: 'Read-only' })}</div>
            )}
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'print' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Stampa', en: 'Print' })}</div>
            {!isReadOnly ? (
              <button
                onClick={() => {
                  if ((basePlan as any)?.printArea) {
                    updateFloorPlan(basePlan.id, { printArea: undefined });
                    setContextMenu(null);
                    push(t({ it: 'Area di stampa rimossa correttamente', en: 'Print area removed successfully' }), 'info');
                    return;
                  }
                  setPrintAreaMode(true);
                  setContextMenu(null);
                  push(
                    t({
                      it: 'Disegna un rettangolo sulla mappa per impostare l’area di stampa.',
                      en: 'Draw a rectangle on the map to set the print area.'
                    }),
                    'info'
                  );
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={(basePlan as any)?.printArea ? t({ it: 'Rimuovi area di stampa', en: 'Clear print area' }) : t({ it: 'Imposta area di stampa', en: 'Set print area' })}
              >
                <Crop size={14} className="text-slate-500" />{' '}
                {(basePlan as any)?.printArea
                  ? t({ it: 'Rimuovi area di stampa', en: 'Clear print area' })
                  : t({ it: 'Imposta area di stampa', en: 'Set print area' })}
              </button>
            ) : null}
            {(basePlan as any)?.printArea ? (
              <button
                onClick={() => {
                  toggleShowPrintArea(basePlan.id);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                title={t({ it: 'Mostra/nascondi area di stampa come overlay', en: 'Show/hide the print area overlay' })}
              >
                {showPrintArea ? <EyeOff size={14} className="text-slate-500" /> : <Eye size={14} className="text-slate-500" />}{' '}
                {showPrintArea
                  ? t({ it: 'Nascondi area di stampa', en: 'Hide print area' })
                  : t({ it: 'Mostra area di stampa', en: 'Show print area' })}
              </button>
            ) : null}
            <button
              onClick={() => {
                setExportModalOpen(true);
                setContextMenu(null);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
              title={t({ it: 'Esporta PDF', en: 'Export PDF' })}
            >
              <FileDown size={14} className="text-slate-500" /> {t({ it: 'Esporta PDF', en: 'Export PDF' })}
            </button>
          </div>
        ) : null}

        {contextMenu.kind === 'map' && mapSubmenu === 'manage' ? (
          <div
            className="fixed z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
            style={getSubmenuStyle(240)}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 pb-2 text-xs font-semibold uppercase text-slate-500">{t({ it: 'Gestione', en: 'Manage' })}</div>
            {!isReadOnly ? (
              <button
                onClick={() => {
                  setConfirmClearObjects(true);
                  setContextMenu(null);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-rose-600 hover:bg-rose-50"
                title={t({ it: 'Elimina tutti gli oggetti', en: 'Delete all objects' })}
              >
                <Trash size={14} /> {t({ it: 'Elimina tutti gli oggetti', en: 'Delete all objects' })}
              </button>
            ) : (
              <div className="px-2 py-2 text-xs text-slate-500">{t({ it: 'Sola lettura', en: 'Read-only' })}</div>
            )}
          </div>
        ) : null}
      </>
  );
};
