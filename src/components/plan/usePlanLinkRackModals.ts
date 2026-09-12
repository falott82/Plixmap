/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo } from 'react';
import type { RackItem, RackPortKind } from '../../store/types';
import { computeLinksModalRows, computeLinkCreateHint, computeUpdateRackPortField } from './planViewComputeBits';

// Links + rack-ports modal derivations/handlers (modal object name, link rows, create hint,
// rack-ports link item + open/rename/note handlers) extracted from usePlanView. Bodies moved
// verbatim (dep arrays preserved); owns the rack-ports-link cleanup effect internally.
export const usePlanLinkRackModals = (deps: any) => {
  const {
    linksModalObjectId, renderPlan, objectTypeDefs, lang, linkFromId, isReadOnly, linkCreateMode, t,
    rackPortsLink, setRackPortsLink, rackOverlayById, planId, updateRackItem
  } = deps;

  const linksModalObjectName = useMemo(() => {
    if (!linksModalObjectId) return '';
    const obj = ((renderPlan as any)?.objects || []).find((o: any) => o.id === linksModalObjectId);
    return String(obj?.name || linksModalObjectId);
  }, [linksModalObjectId, renderPlan]);

  const linksModalRows = useMemo(
    () => computeLinksModalRows({ linksModalObjectId, renderPlan, objectTypeDefs, lang }),
    [lang, linksModalObjectId, objectTypeDefs, renderPlan]
  );

  const linkCreateHint = useMemo(
    () => computeLinkCreateHint({ linkFromId, isReadOnly, renderPlan, linkCreateMode, t }),
    [isReadOnly, linkCreateMode, linkFromId, renderPlan, t]
  );

  const rackPortsLinkItem = useMemo(() => {
    if (!rackPortsLink || !renderPlan) return null;
    return ((renderPlan as any).rackItems || []).find((item: RackItem) => item.id === rackPortsLink.itemId) || null;
  }, [rackPortsLink, renderPlan]);

  useEffect(() => {
    if (!rackPortsLink) return;
    if (!rackPortsLinkItem) setRackPortsLink(null);
  }, [rackPortsLink, rackPortsLinkItem, setRackPortsLink]);

  const openRackLinkPorts = useCallback(
    (id: string) => {
      const link = rackOverlayById.get(id);
      if (!link) return;
      const targetItemId = link.rackFromItemId || link.rackToItemId;
      if (!targetItemId) return;
      setRackPortsLink({
        itemId: String(targetItemId),
        kind: link.rackKind as RackPortKind,
        openConnections: true
      });
    },
    [rackOverlayById, setRackPortsLink]
  );

  const handleRackPortsRename = useCallback(
    (itemId: string, kind: RackPortKind, index: number, name: string) =>
      computeUpdateRackPortField(itemId, kind, index, name, 'names', { isReadOnly, planId, renderPlan, updateRackItem }),
    [isReadOnly, planId, renderPlan, updateRackItem]
  );

  const handleRackPortsNote = useCallback(
    (itemId: string, kind: RackPortKind, index: number, note: string) =>
      computeUpdateRackPortField(itemId, kind, index, note, 'notes', { isReadOnly, planId, renderPlan, updateRackItem }),
    [isReadOnly, planId, renderPlan, updateRackItem]
  );

  return {
    linksModalObjectName,
    linksModalRows,
    linkCreateHint,
    rackPortsLinkItem,
    openRackLinkPorts,
    handleRackPortsRename,
    handleRackPortsNote,
  };
};
