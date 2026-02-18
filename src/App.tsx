import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import SidebarTree from './components/layout/SidebarTree';
import ToastStack from './components/ui/ToastStack';
import ConfirmDialog from './components/ui/ConfirmDialog';
import { useDataStore } from './store/useDataStore';
import { defaultData } from './store/data';
import { useUIStore } from './store/useUIStore';
import { fetchState, saveState } from './api/state';
import LoginView from './components/auth/LoginView';
import FirstRunView from './components/auth/FirstRunView';
import { useAuthStore } from './store/useAuthStore';
import { shallow } from 'zustand/shallow';
import EmptyWorkspace from './components/layout/EmptyWorkspace';
import { useT } from './i18n/useT';
import PerfOverlay from './components/dev/PerfOverlay';
import { perfMetrics } from './utils/perfMetrics';
import ClientChatWs from './components/chat/ClientChatWs';

const PlanView = lazy(() => import('./components/plan/PlanView'));
const SettingsView = lazy(() => import('./components/settings/SettingsView'));
const HelpPanel = lazy(() => import('./components/layout/HelpPanel'));
const ChangelogPanel = lazy(() => import('./components/layout/ChangelogPanel'));
const ClientChatDock = lazy(() => import('./components/chat/ClientChatDock'));

const AppRouteFallback = () => (
  <div className="flex h-screen items-center justify-center bg-mist text-ink">
    <div className="rounded-2xl bg-white px-6 py-4 shadow-card">
      <p className="text-sm text-slate-600">Loading…</p>
    </div>
  </div>
);

const PlanRoute = () => {
  const { planId } = useParams();
  if (!planId) return <Navigate to="/" replace />;
  const planExists = useDataStore((s) => !!s.findFloorPlan(planId));
  if (!planExists) return <Navigate to="/" replace />;
  return <PlanView planId={planId} />;
};

const HomeRoute = () => {
  const clients = useDataStore((s) => s.clients);
  const { selectedPlanId, setSelectedPlan } = useUIStore(
    (s) => ({
      selectedPlanId: s.selectedPlanId,
      setSelectedPlan: s.setSelectedPlan
    }),
    shallow
  );
  const { user } = useAuthStore();

  const hasPlanId = (id?: string | null) => {
    if (!id) return false;
    for (const c of clients || []) {
      for (const s of c.sites || []) {
        if (s.floorPlans?.some((p) => p.id === id)) return true;
      }
    }
    return false;
  };
  const findFirstPlanId = () => {
    for (const c of clients || []) {
      for (const s of c.sites || []) {
        const plan = s.floorPlans?.[0];
        if (plan?.id) return plan.id;
      }
    }
    return null;
  };
  const findDefaultPlanId = () => {
    const defaultPlanId = (user as any)?.defaultPlanId as string | null | undefined;
    if (!defaultPlanId) return null;
    for (const c of clients) {
      for (const s of c.sites) {
        if (s.floorPlans.some((p) => p.id === defaultPlanId)) return defaultPlanId;
      }
    }
    return null;
  };

  const defaultPlanId = findDefaultPlanId();
  const selectedPlanIdSafe = hasPlanId(selectedPlanId) ? selectedPlanId : null;
  const planId = defaultPlanId || selectedPlanIdSafe || findFirstPlanId();
  if (planId) {
    if (selectedPlanId !== planId) setSelectedPlan(planId);
    return <Navigate to={`/plan/${planId}${defaultPlanId ? '?dv=1' : ''}`} replace />;
  }
  if (selectedPlanId) setSelectedPlan(undefined);
  return <EmptyWorkspace />;
};

const App = () => {
  const t = useT();
  const { clients, objectTypes, version, savedVersion, setServerState, markSaved } = useDataStore(
    (s) => ({
      clients: s.clients,
      objectTypes: s.objectTypes,
      version: s.version,
      savedVersion: s.savedVersion,
      setServerState: s.setServerState,
      markSaved: s.markSaved
    }),
    shallow
  );
  const { selectedPlanId, setSelectedPlan, perfOverlayEnabled } = useUIStore(
    (s) => ({
      selectedPlanId: s.selectedPlanId,
      setSelectedPlan: s.setSelectedPlan,
      perfOverlayEnabled: s.perfOverlayEnabled
    }),
    shallow
  );
  const presentationMode = useUIStore((s) => (s as any).presentationMode || false);
  const { user, hydrated: authHydrated, hydrate: hydrateAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const hideSidebar = presentationMode || location.pathname.startsWith('/settings');
  const perfEnabled = (() => {
    try {
      const queryEnabled = new URLSearchParams(location.search || '').get('perf') === '1';
      return queryEnabled || perfOverlayEnabled;
    } catch {
      return perfOverlayEnabled;
    }
  })();
  const [hydrated, setHydrated] = useState(false);
  const hydratedForUserId = useRef<string | null>(null);
  const lastMustChangeRef = useRef<boolean | null>(null);
  const defaultPlanRedirectAppliedForUserId = useRef<string | null>(null);
  const [firstRunPromptOpen, setFirstRunPromptOpen] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastSaveAtRef = useRef(0);
  const SAVE_DEBOUNCE_MS = 1200;
  const SAVE_MIN_INTERVAL_MS = 3000;
  const hasUnsavedEditsRef = useRef(false);
  const unsubscribeUnsavedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const applyTooltip = (el: HTMLElement) => {
      if (!el) return;
      const existing = el.getAttribute('title');
      if (existing && existing.trim().length) return;
      const aria = el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.getAttribute('data-title');
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      const label = (aria || text || '').trim();
      if (!label) return;
      el.setAttribute('title', label);
    };
    const scan = (root: ParentNode) => {
      (root as ParentNode).querySelectorAll?.('button, [role="button"]').forEach((node) => {
        if (node instanceof HTMLElement) applyTooltip(node);
      });
    };
    if (document?.body) scan(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (!(node instanceof HTMLElement)) return;
            if (node.matches?.('button, [role="button"]')) applyTooltip(node);
            scan(node);
          });
        } else if (m.type === 'attributes') {
          const target = m.target as HTMLElement;
          if (target?.matches?.('button, [role="button"]')) applyTooltip(target);
        } else if (m.type === 'characterData') {
          const parent = (m.target as any)?.parentElement as HTMLElement | null;
          const btn = parent?.closest?.('button, [role="button"]') as HTMLElement | null;
          if (btn) applyTooltip(btn);
        }
      }
    });
    if (document?.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
        attributeFilter: ['aria-label', 'data-tooltip', 'data-title', 'title']
      });
    }
    return () => observer.disconnect();
  }, [(user as any)?.language]);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    // Track camera permission state so we can decide whether to prompt before entering presentation mode.
    let cancelled = false;
    let status: any = null;
    let onChange: (() => void) | null = null;

    const normalize = (value: any): 'granted' | 'denied' | 'prompt' | 'unknown' => {
      const v = String(value || '');
      if (v === 'granted' || v === 'denied' || v === 'prompt') return v as any;
      return 'unknown';
    };

    (async () => {
      try {
        const p: any = (navigator as any)?.permissions;
        if (!p?.query) {
          useUIStore.getState().setCameraPermissionState?.('unknown');
          return;
        }
        status = await p.query({ name: 'camera' as any });
        if (cancelled) return;
        useUIStore.getState().setCameraPermissionState?.(normalize(status?.state));
        onChange = () => useUIStore.getState().setCameraPermissionState?.(normalize(status?.state));
        if (typeof status?.addEventListener === 'function') status.addEventListener('change', onChange);
        else status.onchange = onChange;
      } catch {
        useUIStore.getState().setCameraPermissionState?.('unknown');
      }
    })();

    return () => {
      cancelled = true;
      try {
        if (status && onChange && typeof status.removeEventListener === 'function') status.removeEventListener('change', onChange);
      } catch {}
      try {
        if (status) status.onchange = null;
      } catch {}
    };
  }, []);

  useEffect(() => {
    // Keep a cheap ref so we can warn on refresh/close without re-rendering App.
    if (unsubscribeUnsavedRef.current) unsubscribeUnsavedRef.current();
    unsubscribeUnsavedRef.current = useUIStore.subscribe((state) => {
      const dirtyByPlan = (state as any)?.dirtyByPlan || {};
      hasUnsavedEditsRef.current = Object.values(dirtyByPlan).some(Boolean);
    });
    return () => {
      if (unsubscribeUnsavedRef.current) unsubscribeUnsavedRef.current();
      unsubscribeUnsavedRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!user) return;
      if (!hasUnsavedEditsRef.current) return;
      e.preventDefault();
      // Modern browsers show a generic confirmation message.
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [user]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!useAuthStore.getState().user) return;
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || target?.isContentEditable;

      // ESC exits presentation mode.
      if (e.key === 'Escape' && useUIStore.getState().presentationMode) {
        e.preventDefault();
        useUIStore.getState().setPresentationMode?.(false);
        return;
      }

      // Toggle chat with Cmd+K / Ctrl+K (WhatsApp-like).
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useUIStore.getState().toggleClientChat?.();
        return;
      }

      if (isTyping) return;

      // Presentation mode with `P`: toggle fullscreen and collapse sidebar.
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'p') {
        const path = window.location?.pathname || '';
        if (!path.startsWith('/plan/')) return;
        e.preventDefault();
        if (useUIStore.getState().presentationMode) {
          useUIStore.getState().setPresentationMode?.(false);
          return;
        }
        const perm = useUIStore.getState().cameraPermissionState;
        if (perm === 'granted') {
          try {
            const doc: any = document as any;
            const root: any = document.documentElement as any;
            if (!doc.fullscreenElement) {
              const p = root?.requestFullscreen?.();
              if (p && typeof p.then === 'function') p.catch(() => {});
            }
          } catch {}
          useUIStore.getState().setPresentationMode?.(true);
          return;
        }
        // Let PlanView prompt before entering presentation (second click keeps the user gesture).
        useUIStore.getState().requestPresentationEnter?.();
      }
    };
    window.addEventListener('keydown', onKey, false);
    return () => window.removeEventListener('keydown', onKey, false);
  }, []);

  const prevSidebarCollapsedRef = useRef(false);
  const forcedPresentationRef = useRef(false);
  useEffect(() => {
    const doc: any = document as any;
    const want = !!useUIStore.getState().presentationMode;
    const inFs = !!doc.fullscreenElement;
    if (want) {
      if (!forcedPresentationRef.current) {
        prevSidebarCollapsedRef.current = !!useUIStore.getState().sidebarCollapsed;
        forcedPresentationRef.current = true;
      }
      useUIStore.setState({ sidebarCollapsed: true } as any);
      return;
    }
    if (forcedPresentationRef.current) {
      useUIStore.setState({ sidebarCollapsed: prevSidebarCollapsedRef.current } as any);
      forcedPresentationRef.current = false;
    }
    if (inFs) {
      try {
        doc?.exitFullscreen?.();
      } catch {
        // ignore
      }
    }
  }, [presentationMode]);

  useEffect(() => {
    const onFsChange = () => {
      // If the browser exits fullscreen (ESC), exit presentation mode too.
      const doc: any = document as any;
      const inFs = !!doc.fullscreenElement;
      if (inFs) return;
      if (useUIStore.getState().presentationMode) {
        useUIStore.getState().setPresentationMode?.(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    if (!authHydrated) return;
    if (!user) {
      setHydrated(true);
      hydratedForUserId.current = null;
      lastMustChangeRef.current = null;
      return;
    }
    if (hydratedForUserId.current === user.id && lastMustChangeRef.current === user.mustChangePassword) return;
    setHydrated(false);
    fetchState()
      .then((state) => {
        const isAdmin = !!user?.isAdmin;
        const hasClients = Array.isArray(state.clients) && state.clients.length > 0;
        // If server has no state yet (or a broken empty state), keep local defaults and seed server.
        if (state.updatedAt === null || (isAdmin && !hasClients)) {
          const local = useDataStore.getState().clients;
          const localTypes = useDataStore.getState().objectTypes;
          const seedClients = Array.isArray(local) && local.length ? local : defaultData();
          setServerState({ clients: seedClients, objectTypes: localTypes });
          setSelectedPlan(seedClients[0]?.sites[0]?.floorPlans[0]?.id);
          saveState(seedClients, localTypes)
            .then((res) => {
              if (Array.isArray(res.clients)) setServerState({ clients: res.clients, objectTypes: res.objectTypes });
              else markSaved();
            })
            .catch(() => {});
          return;
        }
        if (Array.isArray(state.clients)) {
          setServerState({ clients: state.clients, objectTypes: state.objectTypes });
        }
      })
      .catch(() => {
        // fallback to local defaultData already in store
      })
      .finally(() => {
        hydratedForUserId.current = user.id;
        lastMustChangeRef.current = user.mustChangePassword ?? null;
        setHydrated(true);
      });
  }, [authHydrated, markSaved, setServerState, user]);

  useEffect(() => {
    if (!authHydrated || !user) return;
    let shouldShow = false;
    try {
      shouldShow = window.sessionStorage.getItem('deskly_first_run_success') === '1';
    } catch {
      shouldShow = false;
    }
    if (!shouldShow) return;
    setFirstRunPromptOpen(true);
    try {
      window.sessionStorage.removeItem('deskly_first_run_success');
    } catch {}
  }, [authHydrated, user]);

  useEffect(() => {
    if (!hydrated || !user) return;
    if (clients.length) return;
    if (version !== 0) return;
    const seedClients = defaultData();
    setServerState({ clients: seedClients, objectTypes });
    setSelectedPlan(seedClients[0]?.sites[0]?.floorPlans[0]?.id);
  }, [clients.length, hydrated, objectTypes, setSelectedPlan, setServerState, user, version]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (version === savedVersion) return;
    // Do not autosave while the user has unsaved edits that must be committed as a revision.
    // This prevents "implicit saves" when navigating to Settings or switching floor plans.
    const dirtyByPlan = (useUIStore.getState() as any)?.dirtyByPlan || {};
    const hasUnsavedEdits = Object.values(dirtyByPlan).some(Boolean);
    if (hasUnsavedEdits) return;
    saveTimer.current = window.setTimeout(() => {
      if (saveInFlight.current) {
        saveQueued.current = true;
        return;
      }
      saveInFlight.current = true;
      saveQueued.current = false;
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      perfMetrics.autosaveCount += 1;
      perfMetrics.autosaveLastAt = Date.now();
      const saveStart = performance.now();
      lastSaveAtRef.current = Date.now();
      const currentClients = useDataStore.getState().clients;
      const currentTypes = useDataStore.getState().objectTypes;
      saveState(currentClients, currentTypes, { signal: abortRef.current.signal })
        .then((res) => {
          if (!Array.isArray(res.clients)) {
            markSaved();
            return;
          }
          const isAdmin = !!user?.isAdmin;
          const hasDataUrls = (clients: any[]) => {
            for (const c of clients || []) {
              if (typeof c?.logoUrl === 'string' && c.logoUrl.startsWith('data:')) return true;
              for (const a of c?.attachments || []) {
                if (typeof a?.dataUrl === 'string' && a.dataUrl.startsWith('data:')) return true;
              }
              for (const s of c?.sites || []) {
                for (const p of s?.floorPlans || []) {
                  if (typeof p?.imageUrl === 'string' && p.imageUrl.startsWith('data:')) return true;
                  for (const r of p?.revisions || []) {
                    if (typeof r?.imageUrl === 'string' && r.imageUrl.startsWith('data:')) return true;
                  }
                }
              }
            }
            return false;
          };
          // Avoid replacing the whole state graph on every save (reduces GC + Konva churn).
          // We only need the server echo for non-admin merges or to normalize data URLs → /uploads.
          if (!isAdmin || hasDataUrls(currentClients)) {
            setServerState({ clients: res.clients, objectTypes: res.objectTypes });
          } else {
            markSaved();
          }
        })
        .catch((_e) => {
          // ignore; keeps working offline/local
        })
        .finally(() => {
          perfMetrics.autosaveLastDurationMs = Math.round(performance.now() - saveStart);
          saveInFlight.current = false;
          if (saveQueued.current && useDataStore.getState().version !== useDataStore.getState().savedVersion) {
            // schedule an immediate follow-up save with the latest state
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            const elapsed = Date.now() - lastSaveAtRef.current;
            const delay = Math.max(SAVE_DEBOUNCE_MS, SAVE_MIN_INTERVAL_MS - elapsed);
            saveTimer.current = window.setTimeout(() => {
              if (saveInFlight.current) return;
              saveInFlight.current = true;
              saveQueued.current = false;
              if (abortRef.current) abortRef.current.abort();
              abortRef.current = new AbortController();
              perfMetrics.autosaveCount += 1;
              perfMetrics.autosaveLastAt = Date.now();
              const followupStart = performance.now();
              lastSaveAtRef.current = Date.now();
              const latestClients = useDataStore.getState().clients;
              const latestTypes = useDataStore.getState().objectTypes;
              saveState(latestClients, latestTypes, { signal: abortRef.current.signal })
                .then((res) => {
                  if (!Array.isArray(res.clients)) {
                    markSaved();
                    return;
                  }
                  const isAdmin = !!user?.isAdmin;
                  const hasDataUrls = (clients: any[]) => {
                    for (const c of clients || []) {
                      if (typeof c?.logoUrl === 'string' && c.logoUrl.startsWith('data:')) return true;
                      for (const a of c?.attachments || []) {
                        if (typeof a?.dataUrl === 'string' && a.dataUrl.startsWith('data:')) return true;
                      }
                      for (const s of c?.sites || []) {
                        for (const p of s?.floorPlans || []) {
                          if (typeof p?.imageUrl === 'string' && p.imageUrl.startsWith('data:')) return true;
                          for (const r of p?.revisions || []) {
                            if (typeof r?.imageUrl === 'string' && r.imageUrl.startsWith('data:')) return true;
                          }
                        }
                      }
                    }
                    return false;
                  };
                  if (!isAdmin || hasDataUrls(latestClients)) {
                    setServerState({ clients: res.clients, objectTypes: res.objectTypes });
                  } else {
                    markSaved();
                  }
                })
                .catch(() => {})
                .finally(() => {
                  perfMetrics.autosaveLastDurationMs = Math.round(performance.now() - followupStart);
                  saveInFlight.current = false;
                });
            }, delay);
          }
        });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [clients, hydrated, markSaved, objectTypes, savedVersion, setServerState, user, version]);

  useEffect(() => {
    const hasPlanId = (id?: string | null) => {
      if (!id) return false;
      for (const c of clients || []) {
        for (const s of c.sites || []) {
          if (s.floorPlans?.some((p) => p.id === id)) return true;
        }
      }
      return false;
    };
    const selectedValid = hasPlanId(selectedPlanId);
    if (selectedValid) return;

    const defaultPlanId = (user as any)?.defaultPlanId as string | null | undefined;
    const pickPlanId = () => {
      if (defaultPlanId && hasPlanId(defaultPlanId)) return defaultPlanId;
      for (const c of clients || []) {
        for (const s of c.sites || []) {
          const plan = s.floorPlans?.[0];
          if (plan?.id) return plan.id;
        }
      }
      return null;
    };
    const planId = pickPlanId();
    if (planId) {
      setSelectedPlan(planId);
      if (location.pathname === '/' || location.pathname === '') {
        navigate(`/plan/${planId}`, { replace: true });
      }
    } else if (selectedPlanId) {
      setSelectedPlan(undefined);
    }
  }, [clients, selectedPlanId, setSelectedPlan, navigate, location.pathname, user]);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) return;
    if (defaultPlanRedirectAppliedForUserId.current === user.id) return;

    // Ensure the workspace always opens on the user's default floor plan (if set and available),
    // even when the app boots on a non-default /plan/:id URL.
    const defaultPlanId = (user as any)?.defaultPlanId as string | null | undefined;
    if (!defaultPlanId) {
      defaultPlanRedirectAppliedForUserId.current = user.id;
      return;
    }
    let exists = false;
    for (const c of clients) {
      for (const s of c.sites) {
        if (s.floorPlans.some((p) => p.id === defaultPlanId)) {
          exists = true;
          break;
        }
      }
      if (exists) break;
    }
    if (!exists) {
      defaultPlanRedirectAppliedForUserId.current = user.id;
      return;
    }

    const path = location.pathname || '';
    const isWorkspace = path === '/' || path.startsWith('/plan/');
    if (!isWorkspace) {
      defaultPlanRedirectAppliedForUserId.current = user.id;
      return;
    }
    if (path === `/plan/${defaultPlanId}`) {
      defaultPlanRedirectAppliedForUserId.current = user.id;
      return;
    }

    setSelectedPlan(defaultPlanId);
    navigate(`/plan/${defaultPlanId}?dv=1`, { replace: true });
    defaultPlanRedirectAppliedForUserId.current = user.id;
  }, [clients, hydrated, location.pathname, navigate, setSelectedPlan, user]);

  if (!authHydrated || !hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-mist text-ink">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-card">
          <p className="text-sm text-slate-600">{t({ it: 'Caricamento…', en: 'Loading…' })}</p>
        </div>
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (user && (user as any).mustChangePassword && location.pathname !== '/first-run') {
    return <Navigate to="/first-run" replace />;
  }

  if (!user && location.pathname === '/login') {
    return (
      <>
        <Routes>
          <Route path="/login" element={<LoginView />} />
          <Route path="/first-run" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <ToastStack />
        <PerfOverlay enabled={perfEnabled} />
      </>
    );
  }

  return (
    <div className="flex bg-mist text-ink">
      {hideSidebar ? null : <SidebarTree />}
      <main className="flex-1 overflow-hidden">
        <Suspense fallback={<AppRouteFallback />}>
          <Routes>
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route
              path="/first-run"
              element={
                (user as any)?.mustChangePassword ? <FirstRunView /> : <Navigate to="/" replace />
              }
            />
            <Route path="/" element={<HomeRoute />} />
            <Route path="/plan/:planId" element={<PlanRoute />} />
            <Route path="/settings" element={<SettingsView />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      {presentationMode ? null : (
        <Suspense fallback={null}>
          <HelpPanel />
        </Suspense>
      )}
      {presentationMode ? null : (
        <Suspense fallback={null}>
          <ChangelogPanel />
        </Suspense>
      )}
      <ClientChatWs />
      {presentationMode ? null : (
        <Suspense fallback={null}>
          <ClientChatDock />
        </Suspense>
      )}
      <ConfirmDialog
        open={firstRunPromptOpen}
        title={t({ it: 'Superadmin creato con successo', en: 'Superadmin created successfully' })}
        description={t({
          it: 'Questo utente servirà per gestire tutti gli altri utenti del portale. Vuoi procedere alla creazione degli utenti?',
          en: 'This user will manage all other portal users. Do you want to proceed to user creation?'
        })}
        confirmLabel={t({ it: 'Sì, crea utenti', en: 'Yes, create users' })}
        cancelLabel={t({ it: 'No, più tardi', en: 'No, later' })}
        onCancel={() => setFirstRunPromptOpen(false)}
        onConfirm={() => {
          setFirstRunPromptOpen(false);
          navigate('/settings?tab=users&create=1');
        }}
      />
      <ToastStack />
      <PerfOverlay enabled={perfEnabled} />
    </div>
  );
};

export default App;
