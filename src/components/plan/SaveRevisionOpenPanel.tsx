import { Suspense, lazy } from 'react';

import { postAuditEvent } from '../../api/audit';

import { usePlanView } from './usePlanView';

const SaveRevisionModal = lazy(() => import('./SaveRevisionModal'));

type SaveRevisionOpenPanelProps = Pick<ReturnType<typeof usePlanView>, 'addRevision' | 'clearPendingPostSaveAction' | 'clearPendingSaveNavigate' | 'dispatchOpenClientMeetingsTimeline' | 'entrySnapshotRef' | 'getPlanSnapshot' | 'hasAnyRevision' | 'latestRev' | 'navigate' | 'pendingClientMeetingsPreset' | 'pendingMeetingManagerPreset' | 'pendingNavigateRef' | 'pendingPostSaveAction' | 'performPendingPostSaveAction' | 'plan' | 'planRef' | 'push' | 'resetTouched' | 'revertUnsavedChanges' | 'saveRevisionModalPreset' | 'saveRevisionOpen' | 'saveRevisionReason' | 'setMeetingManagerOpen' | 'setMeetingManagerPreset' | 'setPendingClientMeetingsPreset' | 'setPendingMeetingManagerPreset' | 'setSaveRevisionModalPreset' | 'setSaveRevisionOpen' | 't'>;

const SaveRevisionOpenPanel = (props: SaveRevisionOpenPanelProps) => {
  const {
    addRevision,
    clearPendingPostSaveAction,
    clearPendingSaveNavigate,
    dispatchOpenClientMeetingsTimeline,
    entrySnapshotRef,
    getPlanSnapshot,
    hasAnyRevision,
    latestRev,
    navigate,
    pendingClientMeetingsPreset,
    pendingMeetingManagerPreset,
    pendingNavigateRef,
    pendingPostSaveAction,
    performPendingPostSaveAction,
    plan,
    planRef,
    push,
    resetTouched,
    revertUnsavedChanges,
    saveRevisionModalPreset,
    saveRevisionOpen,
    saveRevisionReason,
    setMeetingManagerOpen,
    setMeetingManagerPreset,
    setPendingClientMeetingsPreset,
    setPendingMeetingManagerPreset,
    setSaveRevisionModalPreset,
    setSaveRevisionOpen,
    t
  } = props;
  if (!saveRevisionOpen) return null;
  return (
        <Suspense fallback={null}>
          <SaveRevisionModal
        open={saveRevisionOpen}
        hasExisting={hasAnyRevision}
        latestRevMajor={latestRev.major}
        latestRevMinor={latestRev.minor}
        initialBump={saveRevisionModalPreset.initialBump}
        requireNoteForMajor={saveRevisionModalPreset.requireNoteForMajor}
        reason={saveRevisionReason}
        onDiscard={
          pendingNavigateRef.current
            ? () => {
                const to = pendingNavigateRef.current;
                pendingNavigateRef.current = null;
                revertUnsavedChanges();
                resetTouched();
                entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
                clearPendingSaveNavigate?.();
                setSaveRevisionOpen(false);
                if (to) navigate(to);
              }
              : pendingPostSaveAction
                ? () => {
                  const action = pendingPostSaveAction;
                  clearPendingPostSaveAction();
                  revertUnsavedChanges();
                  resetTouched();
                  entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
                  setSaveRevisionOpen(false);
                  if (action) void performPendingPostSaveAction(action);
                }
              : pendingMeetingManagerPreset
                ? () => {
                    const preset = pendingMeetingManagerPreset;
                    setPendingMeetingManagerPreset(null);
                    revertUnsavedChanges();
                    resetTouched();
                    entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
                    setSaveRevisionOpen(false);
                    if (preset) {
                      setMeetingManagerPreset(preset);
                      setMeetingManagerOpen(true);
                    }
                  }
                : pendingClientMeetingsPreset
                  ? () => {
                      const preset = pendingClientMeetingsPreset;
                      setPendingClientMeetingsPreset(null);
                      revertUnsavedChanges();
                      resetTouched();
                      entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
                      setSaveRevisionOpen(false);
                      if (preset) {
                        dispatchOpenClientMeetingsTimeline(preset);
                      }
                    }
                : undefined
        }
        onClose={() => {
          setSaveRevisionOpen(false);
          setSaveRevisionModalPreset({ initialBump: 'minor', requireNoteForMajor: false });
          pendingNavigateRef.current = null;
          clearPendingSaveNavigate?.();
          clearPendingPostSaveAction();
          setPendingMeetingManagerPreset(null);
          setPendingClientMeetingsPreset(null);
        }}
        onConfirm={({ bump, note }) => {
          if (!plan) return;
          const next = !hasAnyRevision
            ? { major: 1, minor: 0 }
            : bump === 'major'
              ? { major: latestRev.major + 1, minor: 0 }
              : { major: latestRev.major, minor: latestRev.minor + 1 };
          addRevision(plan.id, {
            bump,
            name: 'Salvataggio',
            description: note
          });
          push(
            t({
              it: `Revisione salvata: Rev ${next.major}.${next.minor}`,
              en: `Revision saved: Rev ${next.major}.${next.minor}`
            }),
            'success'
          );
          postAuditEvent({
            event: 'revision_save',
            scopeType: 'plan',
            scopeId: plan.id,
            details: { bump, rev: `${next.major}.${next.minor}`, note: note || '' }
          });
          // New revision = clean state for navigation prompts.
          resetTouched();
          entrySnapshotRef.current = getPlanSnapshot(planRef.current || plan);
          if (pendingPostSaveAction) {
            const action = pendingPostSaveAction;
            clearPendingPostSaveAction();
            void performPendingPostSaveAction(action);
            return;
          }
          if (pendingMeetingManagerPreset) {
            const preset = pendingMeetingManagerPreset;
            setPendingMeetingManagerPreset(null);
            setMeetingManagerPreset(preset);
            setMeetingManagerOpen(true);
            return;
          }
          if (pendingClientMeetingsPreset) {
            const preset = pendingClientMeetingsPreset;
            setPendingClientMeetingsPreset(null);
            dispatchOpenClientMeetingsTimeline(preset || undefined);
            return;
          }
          if (pendingNavigateRef.current) {
            const to = pendingNavigateRef.current;
            pendingNavigateRef.current = null;
            clearPendingSaveNavigate?.();
            navigate(to);
          }
        }}
      />
        </Suspense>
  );
};

export default SaveRevisionOpenPanel;
