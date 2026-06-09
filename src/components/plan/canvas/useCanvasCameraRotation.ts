/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useState } from 'react';

// Camera-object rotation drag (drag to set rotation; Shift snaps to 90°) extracted from CanvasStage.
export const useCanvasCameraRotation = (deps: {
  onUpdateObject?: (id: string, patch: any) => void;
  readOnly: boolean;
}) => {
  const { onUpdateObject, readOnly } = deps;
  const [cameraRotateId, setCameraRotateId] = useState<string | null>(null);
  const cameraRotateRef = useRef<{ id: string; origin: { x: number; y: number } } | null>(null);
  const cameraRotateRaf = useRef<number | null>(null);
  const cameraRotatePendingRef = useRef<{ x: number; y: number } | null>(null);
  const cameraRotateSnapRef = useRef<boolean>(false);

  const commitCameraRotation = useCallback(() => {
    const active = cameraRotateRef.current;
    const pending = cameraRotatePendingRef.current;
    if (!active || !pending || !onUpdateObject || readOnly) return;
    const dx = pending.x - active.origin.x;
    const dy = pending.y - active.origin.y;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (!Number.isFinite(angle)) return;
    let normalized = angle < 0 ? angle + 360 : angle;
    if (cameraRotateSnapRef.current) {
      normalized = Math.round(normalized / 90) * 90;
    }
    onUpdateObject(active.id, { rotation: normalized });
  }, [onUpdateObject, readOnly]);

  const scheduleCameraRotation = useCallback(
    (world: { x: number; y: number }, shiftKey?: boolean) => {
      cameraRotateSnapRef.current = !!shiftKey;
      cameraRotatePendingRef.current = world;
      if (cameraRotateRaf.current) return;
      cameraRotateRaf.current = requestAnimationFrame(() => {
        cameraRotateRaf.current = null;
        commitCameraRotation();
      });
    },
    [commitCameraRotation]
  );

  const stopCameraRotation = useCallback(() => {
    if (!cameraRotateRef.current) return false;
    cameraRotateRef.current = null;
    cameraRotatePendingRef.current = null;
    if (cameraRotateRaf.current) {
      cancelAnimationFrame(cameraRotateRaf.current);
      cameraRotateRaf.current = null;
    }
    cameraRotateSnapRef.current = false;
    setCameraRotateId(null);
    return true;
  }, []);

  return { cameraRotateId, setCameraRotateId, cameraRotateRef, scheduleCameraRotation, stopCameraRotation };
};
