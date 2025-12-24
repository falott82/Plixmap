import { useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import SidebarTree from './components/layout/SidebarTree';
import HelpPanel from './components/layout/HelpPanel';
import ToastStack from './components/ui/ToastStack';
import PlanView from './components/plan/PlanView';
import SettingsView from './components/settings/SettingsView';
import { useDataStore } from './store/useDataStore';
import { useUIStore } from './store/useUIStore';
import { fetchState, saveState } from './api/state';
import LoginView from './components/auth/LoginView';
import FirstRunView from './components/auth/FirstRunView';
import { useAuthStore } from './store/useAuthStore';
import { shallow } from 'zustand/shallow';
import EmptyWorkspace from './components/layout/EmptyWorkspace';

const PlanRoute = () => {
  const { planId } = useParams();
  if (!planId) return <Navigate to="/" replace />;
  return <PlanView planId={planId} />;
};

const HomeRoute = () => {
  const clients = useDataStore((s) => s.clients);
  const { selectedPlanId, setSelectedPlan } = useUIStore(
    (s) => ({ selectedPlanId: s.selectedPlanId, setSelectedPlan: s.setSelectedPlan }),
    shallow
  );
  const { user } = useAuthStore();

  const findFirstPlanId = () => clients[0]?.sites[0]?.floorPlans[0]?.id;
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

  const planId = findDefaultPlanId() || selectedPlanId || findFirstPlanId();
  if (planId) {
    if (!selectedPlanId) setSelectedPlan(planId);
    return <Navigate to={`/plan/${planId}`} replace />;
  }
  return <EmptyWorkspace />;
};

const App = () => {
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
  const { selectedPlanId, setSelectedPlan } = useUIStore(
    (s) => ({ selectedPlanId: s.selectedPlanId, setSelectedPlan: s.setSelectedPlan }),
    shallow
  );
  const { user, hydrated: authHydrated, hydrate: hydrateAuth } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  const hydratedForUserId = useRef<string | null>(null);
  const defaultPlanRedirectAppliedForUserId = useRef<string | null>(null);
  const saveTimer = useRef<number | null>(null);
  const saveInFlight = useRef(false);
  const saveQueued = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const hasUnsavedEditsRef = useRef(false);
  const unsubscribeUnsavedRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

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
    if (!authHydrated) return;
    if (!user) {
      setHydrated(true);
      hydratedForUserId.current = null;
      return;
    }
    if (hydratedForUserId.current === user.id) return;
    setHydrated(false);
    fetchState()
      .then((state) => {
        // If server has no state yet, keep local defaults and seed server.
        if (state.updatedAt === null) {
          const local = useDataStore.getState().clients;
          const localTypes = useDataStore.getState().objectTypes;
          saveState(local, localTypes)
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
        setHydrated(true);
      });
  }, [authHydrated, markSaved, setServerState, user]);

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
          saveInFlight.current = false;
          if (saveQueued.current && useDataStore.getState().version !== useDataStore.getState().savedVersion) {
            // schedule an immediate follow-up save with the latest state
            if (saveTimer.current) window.clearTimeout(saveTimer.current);
            saveTimer.current = window.setTimeout(() => {
              if (saveInFlight.current) return;
              saveInFlight.current = true;
              saveQueued.current = false;
              if (abortRef.current) abortRef.current.abort();
              abortRef.current = new AbortController();
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
                  saveInFlight.current = false;
                });
            }, 50);
          }
        });
    }, 650);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [clients, hydrated, markSaved, objectTypes, savedVersion, setServerState, user, version]);

  useEffect(() => {
    if (!selectedPlanId) {
      const defaultPlanId = (user as any)?.defaultPlanId as string | null | undefined;
      const pickPlanId = () => {
        if (defaultPlanId) {
          for (const c of clients) {
            for (const s of c.sites) {
              if (s.floorPlans.some((p) => p.id === defaultPlanId)) return defaultPlanId;
            }
          }
        }
        return clients[0]?.sites[0]?.floorPlans[0]?.id;
      };
      const planId = pickPlanId();
      if (planId) {
        setSelectedPlan(planId);
        if (location.pathname === '/' || location.pathname === '') {
          navigate(`/plan/${planId}`, { replace: true });
        }
      }
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
    navigate(`/plan/${defaultPlanId}`, { replace: true });
    defaultPlanRedirectAppliedForUserId.current = user.id;
  }, [clients, hydrated, location.pathname, navigate, setSelectedPlan, user]);

  if (!authHydrated || !hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-mist text-ink">
        <div className="rounded-2xl bg-white px-6 py-4 shadow-card">
          <p className="text-sm text-slate-600">Caricamento…</p>
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
      </>
    );
  }

  return (
    <div className="flex bg-mist text-ink">
      <SidebarTree />
      <main className="flex-1 overflow-hidden">
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
      </main>
      <HelpPanel />
      <ToastStack />
    </div>
  );
};

export default App;
