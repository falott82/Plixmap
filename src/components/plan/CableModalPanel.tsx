

import { Suspense, lazy } from 'react';

import { postAuditEvent } from '../../api/audit';

import { usePlanView } from './usePlanView';

const CableModal = lazy(() => import('./CableModal'));

type CableModalPanelProps = Pick<ReturnType<typeof usePlanView>, 'addLink' | 'basePlan' | 'cableModal' | 'isReadOnly' | 'markTouched' | 'push' | 'setCableModal' | 'setSelectedLinkId' | 't' | 'updateLink'>;

const CableModalPanel = (props: CableModalPanelProps) => {
  const {
    addLink,
    basePlan,
    cableModal,
    isReadOnly,
    markTouched,
    push,
    setCableModal,
    setSelectedLinkId,
    t,
    updateLink
  } = props;
  if (!cableModal) return null;
  return (
        <Suspense fallback={null}>
          <CableModal
        open={!!cableModal}
        initial={
          cableModal?.mode === 'edit'
            ? (() => {
                const l = (basePlan.links || []).find((x: any) => x.id === (cableModal as any).linkId);
                if (!l) return undefined;
                return {
                  name: l.name || l.label || '',
                  description: l.description || '',
                  color: l.color || '#2563eb',
                  width: l.width || 3,
                  dashed: !!l.dashed,
                  route: l.route || 'vh'
                };
              })()
            : undefined
        }
        onClose={() => setCableModal(null)}
        onSubmit={(payload) => {
          if (isReadOnly) return;
          if (cableModal?.mode === 'create') {
            markTouched();
            const id = addLink(basePlan.id, cableModal.fromId, cableModal.toId, {
              kind: 'cable',
              name: payload.name,
              description: payload.description,
              color: payload.color,
              width: payload.width,
              dashed: payload.dashed,
              route: payload.route
            });
            postAuditEvent({
              event: 'link_create',
              scopeType: 'plan',
              scopeId: basePlan.id,
              details: { id, kind: 'cable', fromId: cableModal.fromId, toId: cableModal.toId, ...payload }
            });
            push(t({ it: 'Collegamento creato', en: 'Link created' }), 'success');
            setSelectedLinkId(id);
            setCableModal(null);
            return;
          }
          if (cableModal?.mode === 'edit') {
            markTouched();
            updateLink(basePlan.id, cableModal.linkId, {
              name: payload.name,
              description: payload.description,
              color: payload.color,
              width: payload.width,
              dashed: payload.dashed,
              route: payload.route
            });
            postAuditEvent({
              event: 'link_update',
              scopeType: 'plan',
              scopeId: basePlan.id,
              details: { id: cableModal.linkId, kind: 'cable', ...payload }
            });
            push(t({ it: 'Collegamento aggiornato', en: 'Link updated' }), 'success');
            setCableModal(null);
          }
        }}
      />
        </Suspense>
  );
};

export default CableModalPanel;
