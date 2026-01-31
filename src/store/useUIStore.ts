import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HighlightState } from './types';
import { perfMetrics } from '../utils/perfMetrics';

interface UIState {
  selectedPlanId?: string;
  selectedObjectId?: string;
  selectedObjectIds: string[];
  selectedRevisionByPlan: Record<string, string | null>;
  zoom: number;
  pan: { x: number; y: number };
  panForPlan: Record<string, { zoom: number; pan: { x: number; y: number } }>;
  highlight?: HighlightState;
  helpOpen: boolean;
  sidebarCollapsed: boolean;
  lastObjectScale: number;
  dirtyByPlan: Record<string, boolean>;
  pendingSaveNavigateTo?: string | null;
  visibleLayerIdsByPlan: Record<string, string[]>;
  gridSnapEnabled: boolean;
  gridSize: number;
  showGrid: boolean;
  showPrintAreaByPlan: Record<string, boolean>;
  roomCapacityStateByPlan: Record<string, Record<string, { userCount: number; capacity?: number }>>;
  perfOverlayEnabled: boolean;
  hiddenLayersByPlan: Record<string, boolean>;
  lastQuoteScale: number;
  lastQuoteColor: string;
  lastQuoteLabelPosH: 'center' | 'above' | 'below';
  lastQuoteLabelPosV: 'center' | 'left' | 'right';
  lastQuoteLabelScale: number;
  lastQuoteLabelBg: boolean;
  lastQuoteDashed: boolean;
  lastQuoteEndpoint: 'arrows' | 'dots' | 'none';
  pendingPostSaveAction: { type: 'language'; value: 'it' | 'en' } | { type: 'logout' } | null;
  setSelectedPlan: (id?: string) => void;
  setSelectedObject: (id?: string) => void;
  setSelection: (ids: string[]) => void;
  toggleSelectedObject: (id: string) => void;
  clearSelection: () => void;
  setSelectedRevision: (planId: string, revisionId: string | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  setLastObjectScale: (scale: number) => void;
  saveViewport: (planId: string, zoom: number, pan: { x: number; y: number }) => void;
  loadViewport: (planId: string) => { zoom: number; pan: { x: number; y: number } } | undefined;
  openHelp: () => void;
  closeHelp: () => void;
  triggerHighlight: (objectId: string, durationMs?: number) => void;
  toggleSidebar: () => void;
  setPlanDirty: (planId: string, dirty: boolean) => void;
  requestSaveAndNavigate: (to: string) => void;
  clearPendingSaveNavigate: () => void;
  setVisibleLayerIds: (planId: string, layerIds: string[]) => void;
  setVisibleLayerIdsByPlan: (payload: Record<string, string[]>) => void;
  toggleLayerVisibility: (planId: string, layerId: string) => void;
  setGridSnapEnabled: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setShowGrid: (show: boolean) => void;
  toggleShowPrintArea: (planId: string) => void;
  setRoomCapacityState: (planId: string, state: Record<string, { userCount: number; capacity?: number }>) => void;
  togglePerfOverlay: () => void;
  setHideAllLayers: (planId: string, hidden: boolean) => void;
  setLastQuoteScale: (scale: number) => void;
  setLastQuoteColor: (color: string) => void;
  setLastQuoteLabelPosH: (pos: 'center' | 'above' | 'below') => void;
  setLastQuoteLabelPosV: (pos: 'center' | 'left' | 'right') => void;
  setLastQuoteLabelScale: (scale: number) => void;
  setLastQuoteLabelBg: (value: boolean) => void;
  setLastQuoteDashed: (value: boolean) => void;
  setLastQuoteEndpoint: (value: 'arrows' | 'dots' | 'none') => void;
  setPendingPostSaveAction: (action: { type: 'language'; value: 'it' | 'en' } | { type: 'logout' } | null) => void;
  clearPendingPostSaveAction: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      zoom: 1,
      pan: { x: 0, y: 0 },
      panForPlan: {},
      selectedObjectIds: [],
      selectedRevisionByPlan: {},
      helpOpen: false,
      sidebarCollapsed: false,
      lastObjectScale: 1,
      dirtyByPlan: {},
      pendingSaveNavigateTo: null,
      visibleLayerIdsByPlan: {},
      gridSnapEnabled: false,
      gridSize: 20,
      showGrid: false,
      showPrintAreaByPlan: {},
      roomCapacityStateByPlan: {},
      perfOverlayEnabled: false,
      hiddenLayersByPlan: {},
      lastQuoteScale: 1,
      lastQuoteColor: '#f97316',
      lastQuoteLabelPosH: 'center',
      lastQuoteLabelPosV: 'center',
      lastQuoteLabelScale: 1,
      lastQuoteLabelBg: true,
      lastQuoteDashed: false,
      lastQuoteEndpoint: 'arrows',
      pendingPostSaveAction: null,
      setSelectedPlan: (id) => set({ selectedPlanId: id, selectedObjectId: undefined, selectedObjectIds: [] }),
      setSelectedObject: (id) =>
        set({
          selectedObjectId: id,
          selectedObjectIds: id ? [id] : []
        }),
      setSelection: (ids) =>
        set({
          selectedObjectIds: ids,
          selectedObjectId: ids[0]
        }),
      toggleSelectedObject: (id) =>
        set((state) => {
          const exists = state.selectedObjectIds.includes(id);
          const next = exists ? state.selectedObjectIds.filter((x) => x !== id) : [id, ...state.selectedObjectIds];
          return { selectedObjectIds: next, selectedObjectId: next[0] };
        }),
      clearSelection: () => set({ selectedObjectIds: [], selectedObjectId: undefined }),
      setSelectedRevision: (planId, revisionId) =>
        set((state) => ({
          selectedRevisionByPlan: { ...state.selectedRevisionByPlan, [planId]: revisionId }
        })),
      setZoom: (zoom) => {
        perfMetrics.zoomUpdates += 1;
        set({ zoom });
      },
      setPan: (pan) => {
        perfMetrics.panUpdates += 1;
        set({ pan });
      },
      setLastObjectScale: (scale) => set({ lastObjectScale: scale }),
      saveViewport: (planId, zoom, pan) =>
        set((state) => ({
          panForPlan: { ...state.panForPlan, [planId]: { zoom, pan } }
        })),
      loadViewport: (planId) => get().panForPlan[planId],
      openHelp: () => set({ helpOpen: true }),
      closeHelp: () => set({ helpOpen: false }),
      triggerHighlight: (objectId, durationMs = 3200) =>
        set({ highlight: { objectId, until: Date.now() + durationMs } }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }))
      ,
      setPlanDirty: (planId, dirty) =>
        set((state) => ({
          dirtyByPlan: { ...state.dirtyByPlan, [planId]: dirty }
        })),
      requestSaveAndNavigate: (to) => set({ pendingSaveNavigateTo: to }),
      clearPendingSaveNavigate: () => set({ pendingSaveNavigateTo: null }),
      setVisibleLayerIds: (planId, layerIds) =>
        set((state) => ({
          visibleLayerIdsByPlan: { ...state.visibleLayerIdsByPlan, [planId]: Array.from(new Set(layerIds)) }
        })),
      setVisibleLayerIdsByPlan: (payload) =>
        set(() => ({
          visibleLayerIdsByPlan: { ...(payload || {}) }
        })),
      toggleLayerVisibility: (planId, layerId) =>
        set((state) => {
          const current = state.visibleLayerIdsByPlan[planId] || [];
          const exists = current.includes(layerId);
          const next = exists ? current.filter((x) => x !== layerId) : [...current, layerId];
          return { visibleLayerIdsByPlan: { ...state.visibleLayerIdsByPlan, [planId]: next } };
        }),
      setGridSnapEnabled: (enabled) => set({ gridSnapEnabled: !!enabled }),
      setGridSize: (size) => set({ gridSize: Math.max(5, Math.min(200, Number(size) || 20)) }),
      setShowGrid: (show) => set({ showGrid: !!show }),
      toggleShowPrintArea: (planId) =>
        set((state) => ({
          showPrintAreaByPlan: { ...state.showPrintAreaByPlan, [planId]: !state.showPrintAreaByPlan[planId] }
        })),
      setRoomCapacityState: (planId, stateByRoom) =>
        set((state) => ({
          roomCapacityStateByPlan: { ...state.roomCapacityStateByPlan, [planId]: stateByRoom }
        })),
      togglePerfOverlay: () => set((state) => ({ perfOverlayEnabled: !state.perfOverlayEnabled })),
      setHideAllLayers: (planId, hidden) =>
        set((state) => ({ hiddenLayersByPlan: { ...state.hiddenLayersByPlan, [planId]: !!hidden } })),
      setLastQuoteScale: (scale) => set({ lastQuoteScale: scale }),
      setLastQuoteColor: (color) => set({ lastQuoteColor: color || '#f97316' }),
      setLastQuoteLabelPosH: (pos) => set({ lastQuoteLabelPosH: pos || 'center' }),
      setLastQuoteLabelPosV: (pos) => set({ lastQuoteLabelPosV: pos || 'center' }),
      setLastQuoteLabelScale: (scale) => set({ lastQuoteLabelScale: Math.max(0.6, Math.min(2, Number(scale) || 1)) }),
      setLastQuoteLabelBg: (value) => set({ lastQuoteLabelBg: !!value }),
      setLastQuoteDashed: (value) => set({ lastQuoteDashed: !!value }),
      setLastQuoteEndpoint: (value) => set({ lastQuoteEndpoint: value || 'arrows' }),
      setPendingPostSaveAction: (action) => set({ pendingPostSaveAction: action }),
      clearPendingPostSaveAction: () => set({ pendingPostSaveAction: null })
    }),
    {
      name: 'deskly-ui',
      version: 5,
      migrate: (persistedState: any, _version: number) => {
        if (persistedState && typeof persistedState === 'object') {
          // Do not persist time-machine selection across reloads (always start from "present").
          if ('selectedRevisionByPlan' in persistedState) delete persistedState.selectedRevisionByPlan;
          if (!('lastQuoteScale' in persistedState)) persistedState.lastQuoteScale = 1;
          if (!('lastQuoteColor' in persistedState)) persistedState.lastQuoteColor = '#f97316';
          if (!('lastQuoteLabelPosH' in persistedState)) persistedState.lastQuoteLabelPosH = 'center';
          if (!('lastQuoteLabelPosV' in persistedState)) persistedState.lastQuoteLabelPosV = 'center';
          if (!('lastQuoteLabelScale' in persistedState)) persistedState.lastQuoteLabelScale = 1;
          if (!('lastQuoteLabelBg' in persistedState)) persistedState.lastQuoteLabelBg = true;
          if (!('lastQuoteDashed' in persistedState)) persistedState.lastQuoteDashed = false;
          if (!('lastQuoteEndpoint' in persistedState)) persistedState.lastQuoteEndpoint = 'arrows';
        }
        return persistedState as any;
      },
      partialize: (state) => ({
        panForPlan: state.panForPlan,
        sidebarCollapsed: state.sidebarCollapsed,
        lastObjectScale: state.lastObjectScale,
        visibleLayerIdsByPlan: state.visibleLayerIdsByPlan,
        hiddenLayersByPlan: state.hiddenLayersByPlan,
        gridSnapEnabled: state.gridSnapEnabled,
        gridSize: state.gridSize,
        showGrid: state.showGrid,
        showPrintAreaByPlan: state.showPrintAreaByPlan,
        roomCapacityStateByPlan: state.roomCapacityStateByPlan,
        perfOverlayEnabled: state.perfOverlayEnabled,
        lastQuoteScale: state.lastQuoteScale,
        lastQuoteColor: state.lastQuoteColor,
        lastQuoteLabelPosH: state.lastQuoteLabelPosH,
        lastQuoteLabelPosV: state.lastQuoteLabelPosV,
        lastQuoteLabelScale: state.lastQuoteLabelScale,
        lastQuoteLabelBg: state.lastQuoteLabelBg,
        lastQuoteDashed: state.lastQuoteDashed,
        lastQuoteEndpoint: state.lastQuoteEndpoint
      })
    }
  )
);
