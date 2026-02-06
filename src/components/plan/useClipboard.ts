import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Client, FloorPlan, MapObject } from '../../store/types';
import type { ToastTone } from '../../store/useToast';

export type ClipboardPayload = {
  token: number;
  items: MapObject[];
  customValues: Record<string, Record<string, any>>;
  sourcePlanId?: string;
  sourcePlanName?: string;
  sourceClientId?: string;
  sourceClientName?: string;
};

export type PasteConfirmPayload = {
  title: string;
  description: string;
  clipboard: ClipboardPayload;
  targetPlanId: string;
};

type TranslateFn = (value: { it: string; en: string }) => string;

type ScaleStats = {
  byType: Map<string, number>;
  fallback: number;
  hasData: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const normalizeName = (value: string) => value.trim().toLowerCase();
const stripCopySuffix = (value: string) => value.trim().replace(/\s*\((copia|copy)(\s*\d+)?\)\s*$/i, '').trim();

const getScaleFactor = (obj: MapObject) => {
  if (obj.type === 'text' || obj.type === 'image') {
    const sx = Number((obj as any).scaleX ?? 1);
    const sy = Number((obj as any).scaleY ?? 1);
    const avg = (sx + sy) / 2;
    return Number.isFinite(avg) && avg > 0 ? avg : 1;
  }
  const s = Number((obj as any).scale ?? 1);
  return Number.isFinite(s) && s > 0 ? s : 1;
};

const buildScaleStats = (objects: MapObject[]): ScaleStats => {
  const byTypeBuckets = new Map<string, { sum: number; count: number }>();
  let totalSum = 0;
  let totalCount = 0;
  for (const obj of objects) {
    const raw = getScaleFactor(obj);
    if (!Number.isFinite(raw)) continue;
    const value = clamp(raw, 0.2, 6);
    totalSum += value;
    totalCount += 1;
    const bucket = byTypeBuckets.get(obj.type) || { sum: 0, count: 0 };
    bucket.sum += value;
    bucket.count += 1;
    byTypeBuckets.set(obj.type, bucket);
  }
  const byType = new Map<string, number>();
  for (const [type, bucket] of byTypeBuckets.entries()) {
    if (!bucket.count) continue;
    byType.set(type, bucket.sum / bucket.count);
  }
  return {
    byType,
    fallback: totalCount ? totalSum / totalCount : 1,
    hasData: totalCount > 0
  };
};

type UseClipboardOptions = {
  t: TranslateFn;
  client?: Client;
  planId?: string;
  planRef: MutableRefObject<FloorPlan | undefined>;
  isReadOnlyRef: MutableRefObject<boolean>;
  inferDefaultLayerIds: (typeId: string, layerIdSet: Set<string>) => string[];
  layerIdSet: Set<string>;
  addObject: (
    planId: string,
    typeId: string,
    name: string,
    description: string | undefined,
    x: number,
    y: number,
    scale: number,
    layerIds: string[],
    extra?: Partial<MapObject>
  ) => string;
  updateObject: (objectId: string, changes: Partial<MapObject>) => void;
  ensureObjectLayerVisible: (layerIds: string[], name: string, typeId: string) => void;
  getRoomIdAt: (rooms: any[] | undefined, x: number, y: number) => string | undefined;
  saveCustomValues: (objectId: string, typeId: string, values: Record<string, any>) => Promise<void>;
  loadCustomValues: (objectId: string) => Promise<Record<string, any>>;
  markTouched: () => void;
  push: (message: string, tone?: ToastTone) => void;
  pushStack?: (message: string, tone?: ToastTone, options?: { duration?: number }) => void;
  getTypeLabel: (typeId: string) => string;
  setSelection: (ids: string[]) => void;
  setContextMenu: (value: any) => void;
  lastInsertedRef: MutableRefObject<{ id: string; name: string } | null>;
  triggerHighlight?: (objectId: string, durationMs?: number) => void;
  getPastePoint?: () => { x: number; y: number } | null;
};

export const useClipboard = ({
  t,
  client,
  planId,
  planRef,
  isReadOnlyRef,
  inferDefaultLayerIds,
  layerIdSet,
  addObject,
  updateObject,
  ensureObjectLayerVisible,
  getRoomIdAt,
  saveCustomValues,
  loadCustomValues,
  markTouched,
  push,
  pushStack,
  getTypeLabel,
  setSelection,
  setContextMenu,
  lastInsertedRef,
  triggerHighlight,
  getPastePoint
}: UseClipboardOptions) => {
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const pasteCountRef = useRef(0);
  const [pasteConfirm, setPasteConfirm] = useState<PasteConfirmPayload | null>(null);
  const flashTimersRef = useRef<number[]>([]);
  const pendingPastePointRef = useRef<{ x: number; y: number } | null>(null);
  const lastHintKeyRef = useRef('');

  const clearFlashTimers = useCallback(() => {
    for (const id of flashTimersRef.current) {
      window.clearTimeout(id);
    }
    flashTimersRef.current = [];
  }, []);

  useEffect(() => () => clearFlashTimers(), [clearFlashTimers]);

  useEffect(() => {
    if (!planId) return;
    const clipboard = clipboardRef.current;
    if (!clipboard?.items?.length) return;
    if (!clipboard.sourcePlanId || clipboard.sourcePlanId === planId) return;
    const key = `${clipboard.token}:${planId}`;
    if (lastHintKeyRef.current === key) return;
    lastHintKeyRef.current = key;
    push(
      t({
        it: 'Hai copiato da un’altra planimetria: fai click sulla mappa per scegliere il punto di incolla, poi Ctrl/Cmd+V.',
        en: 'You copied from another plan: click the map to choose the paste point, then press Ctrl/Cmd+V.'
      }),
      'info'
    );
  }, [planId, push, t]);

  const flashObjects = useCallback(
    (ids: string[], durationMs = 1400) => {
      if (!triggerHighlight || !ids.length) return;
      clearFlashTimers();
      const unique = Array.from(new Set(ids.filter(Boolean)));
      unique.forEach((id, index) => {
        const delay = Math.min(160 * index, 1600);
        const timeout = window.setTimeout(() => {
          triggerHighlight(id, durationMs);
        }, delay);
        flashTimersRef.current.push(timeout);
      });
    },
    [clearFlashTimers, triggerHighlight]
  );

  const getRealUserPasteDuplicates = useCallback(
    (clipboard: ClipboardPayload, targetClientId: string) => {
      if (!client || !targetClientId) return [];
      const users = clipboard.items.filter((obj) => obj.type === 'real_user');
      if (!users.length) return [];
      const wanted = new Map<string, { name: string }>();
      for (const obj of users) {
        const externalUserId = String((obj as any).externalUserId || '').trim();
        const externalClientId = String((obj as any).externalClientId || targetClientId).trim();
        if (!externalUserId || !externalClientId) continue;
        const key = `${externalClientId}:${externalUserId}`;
        if (!wanted.has(key)) {
          const fallbackName = `${String((obj as any).firstName || '').trim()} ${String((obj as any).lastName || '').trim()}`.trim();
          const name = String(obj.name || fallbackName || externalUserId);
          wanted.set(key, { name });
        }
      }
      if (!wanted.size) return [];
      const matches: { name: string; planName: string }[] = [];
      for (const s of client.sites || []) {
        for (const p of s.floorPlans || []) {
          for (const o of p.objects || []) {
            if (o.type !== 'real_user') continue;
            const ocid = String((o as any).externalClientId || '').trim();
            const oeid = String((o as any).externalUserId || '').trim();
            if (!ocid || !oeid) continue;
            const key = `${ocid}:${oeid}`;
            const entry = wanted.get(key);
            if (!entry) continue;
            const planName = String(p.name || '') || t({ it: 'Planimetria', en: 'Floor plan' });
            matches.push({ name: entry.name, planName });
            wanted.delete(key);
            if (!wanted.size) return matches;
          }
        }
      }
      return matches;
    },
    [client, t]
  );

  const performPaste = useCallback(
    (clipboard: ClipboardPayload, currentPlan: FloorPlan, pastePoint?: { x: number; y: number } | null): string[] | undefined => {
      if (isReadOnlyRef.current) return undefined;
      if (!clipboard?.items?.length) return undefined;
      markTouched();
      const crossPlan = !!(clipboard.sourcePlanId && clipboard.sourcePlanId !== currentPlan.id);
      const scaleStats = crossPlan ? buildScaleStats(currentPlan.objects || []) : null;
      const adjustScale = !!(scaleStats && scaleStats.hasData);
      const rackCopySuffix = t({ it: ' (Copia)', en: ' (Copy)' });
      const rackCopySuffixFor = (count: number) =>
        count <= 1
          ? rackCopySuffix
          : t({ it: ` (Copia ${count})`, en: ` (Copy ${count})` });
      const existingRackNames = new Set(
        [
          ...(currentPlan.objects || []).filter((obj) => obj.type === 'rack').map((obj) => String(obj.name || '')),
          ...((currentPlan as any).racks || []).map((rack: any) => String(rack?.name || ''))
        ]
          .map((name) => normalizeName(name))
          .filter(Boolean)
      );
      pasteCountRef.current += 1;
      const offset = 24 * pasteCountRef.current;
      const usePoint = crossPlan && !!pastePoint;
      const anchor = usePoint
        ? (() => {
            let sumX = 0;
            let sumY = 0;
            let count = 0;
            for (const obj of clipboard.items) {
              if (!Number.isFinite(Number(obj.x)) || !Number.isFinite(Number(obj.y))) continue;
              sumX += obj.x;
              sumY += obj.y;
              count += 1;
            }
            if (!count) return null;
            return { x: sumX / count, y: sumY / count };
          })()
        : null;
      const shiftX = usePoint && anchor ? (pastePoint as any).x - anchor.x : offset;
      const shiftY = usePoint && anchor ? (pastePoint as any).y - anchor.y : offset * 0.6;
      const newIds: string[] = [];
      const newNames: string[] = [];
      for (const obj of clipboard.items) {
        const nextX = obj.x + shiftX;
        const nextY = obj.y + shiftY;
        const baseName = String(obj.name || getTypeLabel(obj.type) || '').trim();
        let nextName = obj.name;
        if (obj.type === 'rack') {
          const cleanBase = stripCopySuffix(baseName || getTypeLabel(obj.type) || '').trim() || getTypeLabel(obj.type);
          let count = 1;
          let candidate = `${cleanBase}${rackCopySuffixFor(count)}`;
          while (existingRackNames.has(normalizeName(candidate))) {
            count += 1;
            candidate = `${cleanBase}${rackCopySuffixFor(count)}`;
          }
          nextName = candidate;
          existingRackNames.add(normalizeName(candidate));
        }
        const targetScale = adjustScale
          ? scaleStats?.byType.get(obj.type) ?? scaleStats?.fallback ?? 1
          : Number((obj as any).scale ?? 1) || 1;
        const layerIds =
          Array.isArray(obj.layerIds) && obj.layerIds.length ? obj.layerIds : inferDefaultLayerIds(obj.type, layerIdSet);
        const extra: Partial<MapObject> = {
          opacity: obj.opacity,
          rotation: obj.rotation,
          strokeWidth: obj.strokeWidth,
          strokeColor: obj.strokeColor,
          scaleX:
            adjustScale && (obj.type === 'text' || obj.type === 'image')
              ? clamp(Number(targetScale) || 1, 0.2, 6)
              : obj.scaleX,
          scaleY:
            adjustScale && (obj.type === 'text' || obj.type === 'image')
              ? clamp(Number(targetScale) || 1, 0.2, 6)
              : obj.scaleY,
          ...(obj.type === 'image' || obj.type === 'photo'
            ? {
                imageUrl: (obj as any).imageUrl,
                imageWidth: (obj as any).imageWidth,
                imageHeight: (obj as any).imageHeight
              }
            : {}),
          points: obj.points ? obj.points.map((p) => ({ ...p })) : undefined,
          wallGroupId: obj.wallGroupId,
          wallGroupIndex: obj.wallGroupIndex,
          wifiDb: obj.wifiDb,
          wifiStandard: obj.wifiStandard,
          wifiBand24: obj.wifiBand24,
          wifiBand5: obj.wifiBand5,
          wifiBand6: obj.wifiBand6,
          wifiBrand: obj.wifiBrand,
          wifiModel: obj.wifiModel,
          wifiModelCode: obj.wifiModelCode,
          wifiCoverageSqm: obj.wifiCoverageSqm,
          wifiCatalogId: obj.wifiCatalogId,
          wifiShowRange: obj.wifiShowRange,
          cctvAngle: obj.cctvAngle,
          cctvRange: obj.cctvRange,
          cctvOpacity: obj.cctvOpacity,
          externalClientId: (obj as any).externalClientId,
          externalUserId: (obj as any).externalUserId,
          firstName: (obj as any).firstName,
          lastName: (obj as any).lastName,
          externalRole: (obj as any).externalRole,
          externalDept1: (obj as any).externalDept1,
          externalDept2: (obj as any).externalDept2,
          externalDept3: (obj as any).externalDept3,
          externalEmail: (obj as any).externalEmail,
          externalMobile: (obj as any).externalMobile,
          externalExt1: (obj as any).externalExt1,
          externalExt2: (obj as any).externalExt2,
          externalExt3: (obj as any).externalExt3,
          externalIsExternal: (obj as any).externalIsExternal
        };
        const id = addObject(
          currentPlan.id,
          obj.type,
          (nextName as string) || obj.name,
          obj.description,
          nextX,
          nextY,
          adjustScale && obj.type !== 'text' && obj.type !== 'image'
            ? clamp(Number(targetScale) || 1, 0.2, 6)
            : obj.scale ?? 1,
          layerIds,
          extra
        );
        ensureObjectLayerVisible(layerIds, nextName || obj.name, obj.type);
        const nextRoomId = getRoomIdAt(currentPlan.rooms, nextX, nextY);
        if (nextRoomId) updateObject(id, { roomId: nextRoomId });
        const customValues = clipboard.customValues?.[obj.id];
        if (customValues && Object.keys(customValues).length) {
          saveCustomValues(id, obj.type, customValues).catch(() => {});
        }
        newIds.push(id);
        newNames.push(String(nextName || obj.name || getTypeLabel(obj.type)));
      }
      if (newIds.length) {
        const last = newIds[newIds.length - 1];
        const label =
          newIds.length === 1
            ? String(newNames[0] || clipboard.items[0]?.name || getTypeLabel(clipboard.items[0]?.type || ''))
            : t({ it: `${newIds.length} oggetti`, en: `${newIds.length} objects` });
        lastInsertedRef.current = { id: last, name: label };
        setSelection(newIds);
        setContextMenu(null);
        const message =
          newIds.length === 1
            ? t({ it: `Oggetto duplicato: ${label}`, en: `Object duplicated: ${label}` })
            : t({ it: `Duplicati ${newIds.length} oggetti`, en: `Duplicated ${newIds.length} objects` });
        if (pushStack) {
          pushStack(message, 'success', { duration: 4000 });
        } else {
          push(message, 'success');
        }
      }
      if (crossPlan) {
        flashObjects(newIds, usePoint ? 1400 : 4000);
      }
      return newIds;
    },
    [
      addObject,
      ensureObjectLayerVisible,
      getRoomIdAt,
      getTypeLabel,
      inferDefaultLayerIds,
      isReadOnlyRef,
      layerIdSet,
      markTouched,
      push,
      pushStack,
      saveCustomValues,
      setContextMenu,
      setSelection,
      t,
      updateObject,
      lastInsertedRef
    ]
  );

  const copySelection = useCallback(
    (plan: FloorPlan | undefined, selectedIds: string[], isWallType: (typeId: string) => boolean) => {
      if (!plan) return false;
      const source = selectedIds
        .map((id) => plan.objects?.find((o) => o.id === id))
        .filter((obj): obj is MapObject => !!obj && !isWallType(obj.type));
      if (!source.length) return false;
      const token = Date.now();
      const sourcePlanName = String(plan.name || '') || t({ it: 'Planimetria', en: 'Floor plan' });
      clipboardRef.current = {
        token,
        items: source.map((obj) => {
          const next = {
            ...obj,
            points: obj.points ? obj.points.map((p) => ({ ...p })) : undefined
          } as MapObject & { externalClientId?: string };
          if (obj.type === 'real_user' && !String((obj as any).externalClientId || '').trim() && client?.id) {
            next.externalClientId = client.id;
          }
          return next;
        }),
        customValues: {},
        sourcePlanId: plan.id,
        sourcePlanName,
        sourceClientId: client?.id,
        sourceClientName: client?.shortName || client?.name || ''
      };
      pasteCountRef.current = 0;
      Promise.all(
        source.map(async (obj) => {
          try {
            const values = await loadCustomValues(obj.id);
            return { id: obj.id, values };
          } catch {
            return { id: obj.id, values: {} };
          }
        })
      ).then((results) => {
        if (!clipboardRef.current || clipboardRef.current.token !== token) return;
        const next: Record<string, Record<string, any>> = {};
        results.forEach(({ id, values }) => {
          next[id] = values || {};
        });
        clipboardRef.current = { ...clipboardRef.current, customValues: next };
      });
      if (pushStack) {
        pushStack(
          source.length === 1
            ? t({ it: 'Oggetto copiato', en: 'Object copied' })
            : t({ it: `Copiati ${source.length} oggetti`, en: `Copied ${source.length} objects` }),
          'success',
          { duration: 4000 }
        );
      } else {
        push(
          source.length === 1
            ? t({ it: 'Oggetto copiato', en: 'Object copied' })
            : t({ it: `Copiati ${source.length} oggetti`, en: `Copied ${source.length} objects` }),
          'success'
        );
      }
      flashObjects(
        source.map((obj) => obj.id),
        1400
      );
      return true;
    },
    [client, flashObjects, loadCustomValues, push, pushStack, t]
  );

  const requestPaste = useCallback(
    (currentPlan: FloorPlan | undefined) => {
      if (!currentPlan || isReadOnlyRef.current) return false;
      const clipboard = clipboardRef.current;
      if (!clipboard?.items?.length) return false;
      if (pasteConfirm) return true;
      const targetClientId = String(client?.id || '').trim();
      const hasRealUsers = clipboard.items.some((obj) => obj.type === 'real_user');
      if (hasRealUsers) {
        const mismatch = clipboard.items.some((obj) => {
          if (obj.type !== 'real_user') return false;
          const itemClientId = String((obj as any).externalClientId || clipboard.sourceClientId || '').trim();
          if (!targetClientId) return true;
          return itemClientId && itemClientId !== targetClientId;
        });
        if (mismatch) {
          push(
            t({
              it: 'Non puoi copiare utenti reali su un altro cliente.',
              en: 'You cannot copy real users to another client.'
            }),
            'danger'
          );
          return true;
        }
      }
      const crossPlan = !!(clipboard.sourcePlanId && clipboard.sourcePlanId !== currentPlan.id);
      const duplicates = hasRealUsers && targetClientId ? getRealUserPasteDuplicates(clipboard, targetClientId) : [];
      if (crossPlan || duplicates.length) {
        pendingPastePointRef.current = crossPlan ? (getPastePoint?.() || null) : null;
        const fromName = String(clipboard.sourcePlanName || '') || t({ it: 'Planimetria', en: 'Floor plan' });
        const toName = String(currentPlan.name || '') || t({ it: 'Planimetria', en: 'Floor plan' });
        const parts: string[] = [];
        if (crossPlan) {
          parts.push(
            t({
              it: `Stai incollando oggetti dalla planimetria "${fromName}" alla planimetria "${toName}".`,
              en: `You are pasting objects from "${fromName}" into "${toName}".`
            })
          );
        }
        if (duplicates.length) {
          const list = duplicates.map((d) => `${d.name} (${d.planName})`).join(', ');
          parts.push(
            duplicates.length === 1
              ? t({
                  it: `L'utente reale ${list} è già presente nel cliente.`,
                  en: `The real user ${list} is already present in this client.`
                })
              : t({
                  it: `Gli utenti reali ${list} sono già presenti nel cliente.`,
                  en: `The real users ${list} are already present in this client.`
                })
          );
        }
        parts.push(t({ it: 'Vuoi procedere comunque?', en: 'Do you want to proceed anyway?' }));
        setPasteConfirm({
          title: t({ it: 'Conferma incolla', en: 'Confirm paste' }),
          description: parts.join(' '),
          clipboard,
          targetPlanId: currentPlan.id
        });
        return true;
      }
      performPaste(clipboard, currentPlan);
      return true;
    },
    [client?.id, getPastePoint, getRealUserPasteDuplicates, isReadOnlyRef, pasteConfirm, performPaste, push, t]
  );

  const confirmPaste = useCallback(() => {
    if (!pasteConfirm) return;
    const currentPlan = planRef.current;
    if (!currentPlan || currentPlan.id !== pasteConfirm.targetPlanId) {
      setPasteConfirm(null);
      return;
    }
    performPaste(pasteConfirm.clipboard, currentPlan, pendingPastePointRef.current);
    pendingPastePointRef.current = null;
    setPasteConfirm(null);
  }, [flashObjects, pasteConfirm, performPaste, planRef]);

  const cancelPaste = useCallback(() => {
    setPasteConfirm(null);
  }, []);

  return { copySelection, requestPaste, pasteConfirm, confirmPaste, cancelPaste };
};
