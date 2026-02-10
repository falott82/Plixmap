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
  changelogOpen: boolean;
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
  lockedPlans: Record<
    string,
    | {
        kind?: 'lock';
        userId: string;
        username: string;
        avatarUrl?: string;
        lastActionAt?: number | null;
        lastSavedAt?: number | null;
        lastSavedRev?: string | null;
      }
    | {
        kind: 'grant';
        userId: string;
        username: string;
        avatarUrl?: string;
        grantedAt?: number | null;
        expiresAt?: number | null;
        minutes?: number | null;
        grantedBy?: { userId: string; username: string } | null;
        lastActionAt?: number | null;
        lastSavedAt?: number | null;
        lastSavedRev?: string | null;
      }
  >;
  perfOverlayEnabled: boolean;
  hiddenLayersByPlan: Record<string, boolean>;
  expandedClients: Record<string, boolean>;
  expandedSites: Record<string, boolean>;
  lastQuoteScale: number;
  lastQuoteColor: string;
  lastQuoteLabelPosH: 'center' | 'above' | 'below';
  lastQuoteLabelPosV: 'center' | 'left' | 'right';
  lastQuoteLabelScale: number;
  lastQuoteLabelBg: boolean;
  lastQuoteLabelColor: string;
  lastQuoteDashed: boolean;
  lastQuoteEndpoint: 'arrows' | 'dots' | 'none';
  pendingPostSaveAction: { type: 'language'; value: 'it' | 'en' } | { type: 'logout' } | null;
  clientChatOpen: boolean;
  clientChatClientId: string | null;
  clientChatDockHeight: number;
  chatUnreadByClientId: Record<string, number>;
  onlineUserIds: Record<string, true>;
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
  openChangelog: () => void;
  closeChangelog: () => void;
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
  setLockedPlans: (
    payload: Record<
      string,
      | { kind?: 'lock'; userId: string; username: string; avatarUrl?: string; lastActionAt?: number | null; lastSavedAt?: number | null; lastSavedRev?: string | null }
      | {
          kind: 'grant';
          userId: string;
          username: string;
          avatarUrl?: string;
          grantedAt?: number | null;
          expiresAt?: number | null;
          minutes?: number | null;
          grantedBy?: { userId: string; username: string } | null;
          lastActionAt?: number | null;
          lastSavedAt?: number | null;
          lastSavedRev?: string | null;
        }
    >
  ) => void;
  togglePerfOverlay: () => void;
  setHideAllLayers: (planId: string, hidden: boolean) => void;
  setExpandedClients: (expanded: Record<string, boolean>) => void;
  setExpandedSites: (expanded: Record<string, boolean>) => void;
  toggleClientExpanded: (clientId: string, expanded?: boolean) => void;
  toggleSiteExpanded: (siteKey: string, expanded?: boolean) => void;
  setLastQuoteScale: (scale: number) => void;
  setLastQuoteColor: (color: string) => void;
  setLastQuoteLabelPosH: (pos: 'center' | 'above' | 'below') => void;
  setLastQuoteLabelPosV: (pos: 'center' | 'left' | 'right') => void;
  setLastQuoteLabelScale: (scale: number) => void;
  setLastQuoteLabelBg: (value: boolean) => void;
  setLastQuoteLabelColor: (color: string) => void;
  setLastQuoteDashed: (value: boolean) => void;
  setLastQuoteEndpoint: (value: 'arrows' | 'dots' | 'none') => void;
  setPendingPostSaveAction: (action: { type: 'language'; value: 'it' | 'en' } | { type: 'logout' } | null) => void;
  clearPendingPostSaveAction: () => void;
  openClientChat: (clientId: string) => void;
  closeClientChat: () => void;
  setClientChatDockHeight: (height: number) => void;
  setChatUnreadByClientId: (payload: Record<string, number>) => void;
  clearChatUnread: (clientId: string) => void;
  bumpChatUnread: (clientId: string, delta: number) => void;
  setOnlineUserIds: (userIds: string[]) => void;
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
      changelogOpen: false,
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
      lockedPlans: {},
      perfOverlayEnabled: false,
      hiddenLayersByPlan: {},
      expandedClients: {},
      expandedSites: {},
      lastQuoteScale: 1,
      lastQuoteColor: '#f97316',
      lastQuoteLabelPosH: 'center',
      lastQuoteLabelPosV: 'center',
      lastQuoteLabelScale: 1,
      lastQuoteLabelBg: false,
      lastQuoteLabelColor: '#0f172a',
      lastQuoteDashed: false,
      lastQuoteEndpoint: 'arrows',
      pendingPostSaveAction: null,
      clientChatOpen: false,
      clientChatClientId: null,
      clientChatDockHeight: 0,
      chatUnreadByClientId: {},
      onlineUserIds: {},
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
      openChangelog: () => set({ changelogOpen: true }),
      closeChangelog: () => set({ changelogOpen: false }),
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
      setLockedPlans: (payload) => set({ lockedPlans: { ...(payload || {}) } }),
      togglePerfOverlay: () => set((state) => ({ perfOverlayEnabled: !state.perfOverlayEnabled })),
      setHideAllLayers: (planId, hidden) =>
        set((state) => ({ hiddenLayersByPlan: { ...state.hiddenLayersByPlan, [planId]: !!hidden } })),
      setExpandedClients: (expanded) => set({ expandedClients: { ...(expanded || {}) } }),
      setExpandedSites: (expanded) => set({ expandedSites: { ...(expanded || {}) } }),
      toggleClientExpanded: (clientId, expanded) =>
        set((state) => {
          const isExpanded = state.expandedClients[clientId] !== false;
          const nextValue = typeof expanded === 'boolean' ? expanded : !isExpanded;
          const next = { ...state.expandedClients };
          if (nextValue) {
            if (clientId in next) delete next[clientId];
          } else {
            next[clientId] = false;
          }
          return { expandedClients: next };
        }),
      toggleSiteExpanded: (siteKey, expanded) =>
        set((state) => {
          const isExpanded = state.expandedSites[siteKey] !== false;
          const nextValue = typeof expanded === 'boolean' ? expanded : !isExpanded;
          const next = { ...state.expandedSites };
          if (nextValue) {
            if (siteKey in next) delete next[siteKey];
          } else {
            next[siteKey] = false;
          }
          return { expandedSites: next };
        }),
      setLastQuoteScale: (scale) => set({ lastQuoteScale: scale }),
      setLastQuoteColor: (color) => set({ lastQuoteColor: color || '#f97316' }),
      setLastQuoteLabelPosH: (pos) => set({ lastQuoteLabelPosH: pos || 'center' }),
      setLastQuoteLabelPosV: (pos) => set({ lastQuoteLabelPosV: pos || 'center' }),
      setLastQuoteLabelScale: (scale) => set({ lastQuoteLabelScale: Math.max(0.6, Math.min(2, Number(scale) || 1)) }),
      setLastQuoteLabelBg: (value) => set({ lastQuoteLabelBg: !!value }),
      setLastQuoteLabelColor: (color) => set({ lastQuoteLabelColor: color || '#0f172a' }),
      setLastQuoteDashed: (value) => set({ lastQuoteDashed: !!value }),
      setLastQuoteEndpoint: (value) => set({ lastQuoteEndpoint: value || 'arrows' }),
      setPendingPostSaveAction: (action) => set({ pendingPostSaveAction: action }),
      clearPendingPostSaveAction: () => set({ pendingPostSaveAction: null }),
      openClientChat: (clientId) => set({ clientChatOpen: true, clientChatClientId: clientId }),
      closeClientChat: () => set({ clientChatOpen: false }),
      setClientChatDockHeight: (height) => set({ clientChatDockHeight: Math.max(0, Number(height) || 0) }),
      setChatUnreadByClientId: (payload) => set({ chatUnreadByClientId: { ...(payload || {}) } }),
      clearChatUnread: (clientId) =>
        set((state) => {
          const next = { ...(state.chatUnreadByClientId || {}) };
          delete next[clientId];
          return { chatUnreadByClientId: next };
        }),
      bumpChatUnread: (clientId, delta) =>
        set((state) => {
          const current = Number(state.chatUnreadByClientId?.[clientId] || 0);
          const nextVal = Math.max(0, current + (Number(delta) || 0));
          return { chatUnreadByClientId: { ...(state.chatUnreadByClientId || {}), [clientId]: nextVal } };
        }),
      setOnlineUserIds: (userIds) =>
        set(() => {
          const next: Record<string, true> = {};
          for (const id of Array.isArray(userIds) ? userIds : []) {
            if (!id) continue;
            next[String(id)] = true;
          }
          return { onlineUserIds: next };
        })
    }),
    {
      name: 'deskly-ui',
      version: 8,
      migrate: (persistedState: any, _version: number) => {
        if (persistedState && typeof persistedState === 'object') {
          // Do not persist time-machine selection across reloads (always start from "present").
          if ('selectedRevisionByPlan' in persistedState) delete persistedState.selectedRevisionByPlan;
          if (!('expandedClients' in persistedState)) persistedState.expandedClients = {};
          if (!('expandedSites' in persistedState)) persistedState.expandedSites = {};
          if (!('lastQuoteScale' in persistedState)) persistedState.lastQuoteScale = 1;
          if (!('lastQuoteColor' in persistedState)) persistedState.lastQuoteColor = '#f97316';
          if (!('lastQuoteLabelPosH' in persistedState)) persistedState.lastQuoteLabelPosH = 'center';
          if (!('lastQuoteLabelPosV' in persistedState)) persistedState.lastQuoteLabelPosV = 'center';
          if (!('lastQuoteLabelScale' in persistedState)) persistedState.lastQuoteLabelScale = 1;
          if (!('lastQuoteLabelBg' in persistedState)) persistedState.lastQuoteLabelBg = false;
          if (!('lastQuoteLabelColor' in persistedState)) persistedState.lastQuoteLabelColor = '#0f172a';
          if (!('lastQuoteDashed' in persistedState)) persistedState.lastQuoteDashed = false;
          if (!('lastQuoteEndpoint' in persistedState)) persistedState.lastQuoteEndpoint = 'arrows';
          if (!('chatUnreadByClientId' in persistedState)) persistedState.chatUnreadByClientId = {};
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
        expandedClients: state.expandedClients,
        expandedSites: state.expandedSites,
        chatUnreadByClientId: state.chatUnreadByClientId,
        lastQuoteScale: state.lastQuoteScale,
        lastQuoteColor: state.lastQuoteColor,
        lastQuoteLabelPosH: state.lastQuoteLabelPosH,
        lastQuoteLabelPosV: state.lastQuoteLabelPosV,
        lastQuoteLabelScale: state.lastQuoteLabelScale,
        lastQuoteLabelBg: state.lastQuoteLabelBg,
        lastQuoteLabelColor: state.lastQuoteLabelColor,
        lastQuoteDashed: state.lastQuoteDashed,
        lastQuoteEndpoint: state.lastQuoteEndpoint
      })
    }
  )
);
