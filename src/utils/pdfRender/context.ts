import type { FloorPlan, IconName } from '../../store/types';

export interface PlanRenderOpts {
  targetLongPx: number;
  jpegQuality: number;
  includeObjects?: boolean;
  includeDesks?: boolean;
  includeSafety?: boolean;
  includeSafetySheet?: boolean;
  includeLinks?: boolean;
  includeRooms?: boolean;
  includeWalls?: boolean;
  includeQuotes?: boolean;
  includeScale?: boolean;
  objectTypeIcons?: Record<string, IconName | undefined>;
}

/** Everything a layer renderer needs to draw onto the export canvas. */
export interface PlanRenderContext {
  plan: FloorPlan;
  opts: PlanRenderOpts;
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  naturalW: number;
  naturalH: number;
  logicalW: number;
  logicalH: number;
  scaleX: number;
  scaleY: number;
  /** Print area (logical plan units). */
  ax: number;
  ay: number;
  aw: number;
  ah: number;
  /** Source crop in image pixels. */
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
  /** Output canvas size and scale factors. */
  outScale: number;
  outW: number;
  outH: number;
  worldToPxX: number;
  worldToPxY: number;
  worldToPx: number;
  drawArrowHead: (x1: number, y1: number, x2: number, y2: number, size: number) => void;
  isWallObject: (obj: any) => boolean;
}
