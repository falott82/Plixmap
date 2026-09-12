/* eslint-disable @typescript-eslint/no-explicit-any */
import { useImperativeHandle } from 'react';

// Imperative ref API (getSize / exportDataUrl / fitView / getObjectBounds) extracted from CanvasStage.
export const useCanvasImperativeHandle = (ref: any, deps: any) => {
  const { dimensions, stageRef, fitViewRef, objectById, getObjectBounds } = deps;
  useImperativeHandle(
    ref,
    () => ({
      getSize: () => ({ width: dimensions.width, height: dimensions.height }),
      exportDataUrl: (options: any) => {
        const stage = stageRef.current;
        const pixelRatio = Math.max(1, Number(options?.pixelRatio || 1));
        const mimeType = options?.mimeType || 'image/jpeg';
        const quality = typeof options?.quality === 'number' ? options.quality : 0.82;
        const width = Math.round(dimensions.width * pixelRatio);
        const height = Math.round(dimensions.height * pixelRatio);
        if (!stage) return { dataUrl: '', width, height };
        try {
          // Konva JPEG export fills transparency with black. Render to canvas, then composite on white.
          const rawCanvas: HTMLCanvasElement | null = stage.toCanvas ? stage.toCanvas({ pixelRatio }) : null;
          if (!rawCanvas) {
            if (!stage.toDataURL) return { dataUrl: '', width, height };
            const dataUrl = stage.toDataURL({ pixelRatio, mimeType, quality });
            return { dataUrl, width, height };
          }
          const out = document.createElement('canvas');
          out.width = rawCanvas.width;
          out.height = rawCanvas.height;
          const ctx = out.getContext('2d');
          if (!ctx) return { dataUrl: '', width, height };
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, out.width, out.height);
          ctx.drawImage(rawCanvas, 0, 0);
          const dataUrl = out.toDataURL(mimeType, quality);
          return { dataUrl, width: out.width, height: out.height };
        } catch {
          return { dataUrl: '', width, height };
        }
      },
      fitView: () => fitViewRef.current(),
      getObjectBounds: (id: string) => {
        const obj = objectById.get(id);
        if (!obj) return null;
        return getObjectBounds(obj);
      }
    }),
    [dimensions.height, dimensions.width, getObjectBounds, objectById, fitViewRef, stageRef]
  );
};
