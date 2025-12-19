import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { HighlightState } from './types';

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
  toggleLayerVisibility: (planId: string, layerId: string) => void;
  setGridSnapEnabled: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setShowGrid: (show: boolean) => void;
  toggleShowPrintArea: (planId: string) => void;
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
      setZoom: (zoom) => set({ zoom }),
      setPan: (pan) => set({ pan }),
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
        }))
    }),
    {
      name: 'deskly-ui',
      version: 2,
      migrate: (persistedState: any, _version: number) => {
        if (persistedState && typeof persistedState === 'object') {
          // Do not persist time-machine selection across reloads (always start from "present").
          if ('selectedRevisionByPlan' in persistedState) delete persistedState.selectedRevisionByPlan;
        }
        return persistedState as any;
      },
      partialize: (state) => ({
        panForPlan: state.panForPlan,
        sidebarCollapsed: state.sidebarCollapsed,
        lastObjectScale: state.lastObjectScale,
        visibleLayerIdsByPlan: state.visibleLayerIdsByPlan,
        gridSnapEnabled: state.gridSnapEnabled,
        gridSize: state.gridSize,
        showGrid: state.showGrid,
        showPrintAreaByPlan: state.showPrintAreaByPlan
      })
    }
  )
);
