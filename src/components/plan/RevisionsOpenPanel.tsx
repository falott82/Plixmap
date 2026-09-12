

import { Suspense, lazy } from 'react';

import { postAuditEvent } from '../../api/audit';

import { usePlanView } from './usePlanView';

const RevisionsModal = lazy(() => import('./RevisionsModal'));

type RevisionsOpenPanelProps = Pick<ReturnType<typeof usePlanView>, 'basePlan' | 'clearRevisions' | 'client' | 'deleteRevision' | 'isSuperAdmin' | 'planAccess' | 'planId' | 'push' | 'restoreRevision' | 'revisionsOpen' | 'selectedRevisionId' | 'setRevisionsOpen' | 'setSelectedRevision' | 'site' | 't' | 'toggleRevisionImmutable'>;

const RevisionsOpenPanel = (props: RevisionsOpenPanelProps) => {
  const {
    basePlan,
    clearRevisions,
    client,
    deleteRevision,
    isSuperAdmin,
    planAccess,
    planId,
    push,
    restoreRevision,
    revisionsOpen,
    selectedRevisionId,
    setRevisionsOpen,
    setSelectedRevision,
    site,
    t,
    toggleRevisionImmutable
  } = props;
  if (!revisionsOpen) return null;
  return (
        <Suspense fallback={null}>
          <RevisionsModal
            open={revisionsOpen}
            revisions={basePlan.revisions || []}
            selectedRevisionId={selectedRevisionId}
            breadcrumb={[client?.shortName || client?.name, site?.name, basePlan?.name].filter(Boolean).join(' → ')}
            onClose={() => setRevisionsOpen(false)}
            onSelect={(revisionId) => {
              setSelectedRevision(planId, revisionId);
              push(t({ it: 'Revisione caricata (sola lettura)', en: 'Revision loaded (read-only)' }), 'info');
            }}
            onBackToPresent={() => {
              setSelectedRevision(planId, null);
              push(t({ it: 'Tornato al presente', en: 'Back to present' }), 'info');
            }}
            onDelete={(revisionId) => {
              const rev = (basePlan.revisions || []).find((r) => r.id === revisionId);
              if (rev?.immutable && !isSuperAdmin) {
                push(t({ it: 'Revisione immutabile: non puoi eliminarla.', en: 'Immutable revision: you cannot delete it.' }), 'danger');
                return;
              }
              deleteRevision(basePlan.id, revisionId);
              if (selectedRevisionId === revisionId) {
                setSelectedRevision(planId, null);
              }
              push(t({ it: 'Revisione eliminata', en: 'Revision deleted' }), 'info');
              postAuditEvent({
                event: rev?.immutable ? 'revision_delete_immutable' : 'revision_delete',
                scopeType: 'plan',
                scopeId: basePlan.id,
                details: { id: revisionId, immutable: !!rev?.immutable }
              });
            }}
            onClearAll={() => {
              const hasImmutable = (basePlan.revisions || []).some((r) => r.immutable);
              if (hasImmutable && !isSuperAdmin) {
                push(t({ it: 'Impossibile eliminare le revisioni immutabili.', en: 'Immutable revisions cannot be deleted.' }), 'danger');
                return;
              }
              clearRevisions(basePlan.id);
              setSelectedRevision(planId, null);
              push(t({ it: 'Revisioni eliminate', en: 'Revisions deleted' }), 'info');
              postAuditEvent({
                event: 'revision_clear_all',
                scopeType: 'plan',
                scopeId: basePlan.id,
                details: { immutableIncluded: hasImmutable }
              });
            }}
            canRestore={planAccess === 'rw'}
            onRestore={(revisionId) => {
              if (planAccess !== 'rw') return;
              restoreRevision(basePlan.id, revisionId);
              setSelectedRevision(planId, null);
              push(
                t({ it: 'Revisione ripristinata (stato attuale aggiornato)', en: 'Revision restored (current state updated)' }),
                'success'
              );
              postAuditEvent({ event: 'revision_restore', scopeType: 'plan', scopeId: basePlan.id, details: { id: revisionId } });
            }}
            isSuperAdmin={isSuperAdmin}
            onToggleImmutable={toggleRevisionImmutable}
          />
        </Suspense>
  );
};

export default RevisionsOpenPanel;
