import type { FloorPlan } from '../../store/types';

type Translator = (msg: { it: string; en: string }) => string;
type LastInserted = { id: string; name: string } | null;

type SaveShortcutStaticDeps = {
  getPlanUnsavedChanges: (plan: FloorPlan) => boolean,
  push: (message: string, kind: 'info' | 'success' | 'danger') => void,
  t: Translator,
  setSaveRevisionModalPreset: (value: any) => void,
  setSaveRevisionOpen: (value: boolean) => void,
  addRevision: (planId: string, payload: any) => void,
  postAuditEvent: (payload: any) => void,
  resetTouched: () => void,
  captureEntrySnapshot: (plan: FloorPlan) => void,
  getLatestRevisionCached: (revisions: any[]) => any,
  getRevisionVersion: (revision: any) => { major: number; minor: number }
};

type UndoRedoStaticDeps = {
  performUndo: () => boolean,
  performRedo: () => void,
  getLastInserted: () => LastInserted,
  clearLastInserted: () => void,
  setUndoConfirm: (value: LastInserted) => void
};

export const createPlanSaveShortcutHandler = ({
  getPlanUnsavedChanges,
  push,
  t,
  setSaveRevisionModalPreset,
  setSaveRevisionOpen,
  addRevision,
  postAuditEvent,
  resetTouched,
  captureEntrySnapshot,
  getLatestRevisionCached,
  getRevisionVersion
}: SaveShortcutStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null,
    isReadOnly: boolean,
    saveRevisionOpen: boolean
  ): boolean => {
    if (saveRevisionOpen) {
      e.preventDefault();
      return true;
    }
    if (!currentPlan || isReadOnly) return true;
    if (!getPlanUnsavedChanges(currentPlan)) {
      e.preventDefault();
      push(t({ it: 'Nessuna modifica da salvare', en: 'No changes to save' }), 'info');
      return true;
    }
    if (e.shiftKey) {
      e.preventDefault();
      setSaveRevisionModalPreset({ initialBump: 'major', requireNoteForMajor: true });
      setSaveRevisionOpen(true);
      return true;
    }
    e.preventDefault();
    const revisions: any[] = currentPlan.revisions || [];
    const latest = getRevisionVersion(getLatestRevisionCached(revisions));
    const next = revisions.length ? { major: latest.major, minor: latest.minor + 1 } : { major: 1, minor: 0 };
    const stamp = new Date().toLocaleString();
    const quickName = t({ it: 'Aggiornamento rapido', en: 'Quick update' });
    addRevision(currentPlan.id, {
      bump: 'minor',
      name: quickName,
      description: t({ it: `Aggiornamento rapido ${stamp}`, en: `Quick update ${stamp}` })
    });
    push(
      t({
        it: `Aggiornamento rapido Ver: ${next.major}.${next.minor}`,
        en: `Quick update Ver: ${next.major}.${next.minor}`
      }),
      'success'
    );
    postAuditEvent({
      event: 'revision_quick_save',
      scopeType: 'plan',
      scopeId: currentPlan.id,
      details: { rev: `${next.major}.${next.minor}`, note: stamp }
    });
    resetTouched();
    captureEntrySnapshot(currentPlan);
    return true;
  };

export const createPlanUndoRedoShortcutHandler = ({
  performUndo,
  performRedo,
  getLastInserted,
  clearLastInserted,
  setUndoConfirm
}: UndoRedoStaticDeps) =>
  (
    e: KeyboardEvent,
    currentPlan: FloorPlan | null,
    isReadOnly: boolean,
    isUndo: boolean
  ): boolean => {
    if (!currentPlan || isReadOnly) return true;
    e.preventDefault();
    if (isUndo) {
      if (performUndo()) return true;
      const last = getLastInserted();
      if (!last) return true;
      const exists = (currentPlan.objects || []).some((obj) => obj.id === last.id);
      if (!exists) {
        clearLastInserted();
        return true;
      }
      setUndoConfirm(last);
      return true;
    }
    performRedo();
    return true;
  };
