

import { Suspense, lazy } from 'react';

import { postAuditEvent } from '../../api/audit';

import { SYSTEM_LAYER_IDS } from '../../store/data';

import { usePlanView } from './usePlanView';

const ObjectModal = lazy(() => import('./ObjectModal'));

type ModalStatePanelProps = Pick<ReturnType<typeof usePlanView>, 'client' | 'closeReturnToSelectionList' | 'deleteObject' | 'getTypeIcon' | 'getTypeLabel' | 'handleCreate' | 'handleUpdate' | 'isReadOnly' | 'lang' | 'markTouched' | 'modalInitials' | 'modalState' | 'planId' | 'planLayers' | 'push' | 'setModalState' | 't'>;

const ModalStatePanel = (props: ModalStatePanelProps) => {
  const {
    client,
    closeReturnToSelectionList,
    deleteObject,
    getTypeIcon,
    getTypeLabel,
    handleCreate,
    handleUpdate,
    isReadOnly,
    lang,
    markTouched,
    modalInitials,
    modalState,
    planId,
    planLayers,
    push,
    setModalState,
    t
  } = props;
  if (!modalState) return null;
  return (
        <Suspense fallback={null}>
          <ObjectModal
		        open={!!modalState}
            objectId={modalState?.mode === 'edit' ? (modalState as any).objectId : undefined}
		        type={modalInitials?.type}
	          icon={modalInitials?.type ? getTypeIcon(modalInitials.type) : undefined}
            layers={planLayers
              .filter((l: any) => !SYSTEM_LAYER_IDS.has(String(l.id)))
              .map((l: any) => ({
                id: l.id,
                label: (l?.name?.[lang] as string) || (l?.name?.it as string) || l.id,
                color: l.color
              }))}
            initialLayerIds={(modalInitials as any)?.layerIds || []}
            initialScale={(modalInitials as any)?.scale}
            initialQuoteLabelScale={(modalInitials as any)?.quoteLabelScale}
            initialQuoteLabelBg={(modalInitials as any)?.quoteLabelBg}
            initialQuoteLabelColor={(modalInitials as any)?.quoteLabelColor}
            initialQuoteLabelOffset={(modalInitials as any)?.quoteLabelOffset}
            initialQuoteLabelPos={(modalInitials as any)?.quoteLabelPos}
            initialQuoteDashed={(modalInitials as any)?.quoteDashed}
            initialQuoteEndpoint={(modalInitials as any)?.quoteEndpoint}
            initialQuoteColor={(modalInitials as any)?.quoteColor}
            initialQuoteLengthLabel={(modalInitials as any)?.quoteLengthLabel}
            initialQuotePoints={(modalInitials as any)?.quotePoints}
            initialTextFont={(modalInitials as any)?.textFont}
            initialTextSize={(modalInitials as any)?.textSize}
            initialTextColor={(modalInitials as any)?.textColor}
            initialTextBg={(modalInitials as any)?.textBg}
            initialTextBgColor={(modalInitials as any)?.textBgColor}
            initialImageUrl={(modalInitials as any)?.imageUrl}
            initialImageWidth={(modalInitials as any)?.imageWidth}
            initialImageHeight={(modalInitials as any)?.imageHeight}
            initialIp={(modalInitials as any)?.ip}
            initialUrl={(modalInitials as any)?.url}
            initialNotes={(modalInitials as any)?.notes}
            initialLastVerificationAt={(modalInitials as any)?.lastVerificationAt}
            initialVerifierCompany={(modalInitials as any)?.verifierCompany}
            initialGpsCoords={(modalInitials as any)?.gpsCoords}
            initialSecurityDocuments={(modalInitials as any)?.securityDocuments}
            initialSecurityCheckHistory={(modalInitials as any)?.securityCheckHistory}
            typeLabel={
              modalState?.mode === 'create'
                ? `${t({ it: 'Nuovo', en: 'New' })} ${modalInitials?.type ? getTypeLabel(modalInitials.type) : ''} (${Math.round((modalState as any)?.coords?.x || 0)}, ${Math.round(
                    (modalState as any)?.coords?.y || 0
                  )})`
                : undefined
            }
            initialName={modalInitials?.name}
            initialDescription={modalInitials?.description}
            initialWifiDb={(modalInitials as any)?.wifiDb}
            initialWifiStandard={(modalInitials as any)?.wifiStandard}
            initialWifiBand24={(modalInitials as any)?.wifiBand24}
            initialWifiBand5={(modalInitials as any)?.wifiBand5}
            initialWifiBand6={(modalInitials as any)?.wifiBand6}
            initialWifiBrand={(modalInitials as any)?.wifiBrand}
            initialWifiModel={(modalInitials as any)?.wifiModel}
            initialWifiModelCode={(modalInitials as any)?.wifiModelCode}
            initialWifiCoverageSqm={(modalInitials as any)?.wifiCoverageSqm}
            initialWifiCatalogId={(modalInitials as any)?.wifiCatalogId}
            initialWifiShowRange={(modalInitials as any)?.wifiShowRange}
            initialWifiRangeScale={(modalInitials as any)?.wifiRangeScale}
            wifiModels={client?.wifiAntennaModels}
            readOnly={isReadOnly}
            onClose={() => {
              setModalState(null);
              closeReturnToSelectionList();
            }}
            onDelete={modalState?.mode === 'edit' ? () => {
              if (isReadOnly) return;
              if (!modalState || modalState.mode !== 'edit') return;
              markTouched();
              deleteObject(modalState.objectId);
              postAuditEvent({
                event: 'object_delete',
                scopeType: 'plan',
                scopeId: planId,
                details: { id: modalState.objectId }
              });
              setModalState(null);
              closeReturnToSelectionList();
              push(t({ it: 'Quota eliminata', en: 'Quote deleted' }), 'info');
            } : undefined}
            onSubmit={modalState?.mode === 'edit' ? handleUpdate : handleCreate}
          />
        </Suspense>
  );
};

export default ModalStatePanel;
