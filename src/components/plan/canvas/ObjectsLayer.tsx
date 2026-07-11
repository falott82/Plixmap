import { Fragment, memo } from 'react';
import { Circle, Group, Image as KonvaImage, Layer, Line, Rect, Text, Transformer } from 'react-konva';
import { WIFI_RANGE_SCALE_MAX } from '../../../store/data';
import { isSecurityTypeId } from '../../../store/security';
import { clamp } from '../../../utils/geometry';
import { perfMetrics } from '../../../utils/perfMetrics';
import { isDeskType } from '../deskTypes';
import {
  TEXT_BOX_MIN_WIDTH,
  TEXT_BOX_MIN_HEIGHT,
  TEXT_BOX_DEFAULT_WIDTH,
  TEXT_BOX_DEFAULT_HEIGHT,
  SELECTION_STROKE_SCALE,
  SELECTION_COLOR,
  SELECTION_FILL,
  SELECTION_GLOW,
  SELECTION_DASH,
  SAFETY_CARD_COLOR_VARIANTS,
  SAFETY_CARD_TEXT_BG_VARIANTS,
  SAFETY_CARD_FONT_VALUES,
  type ObjectsLayerProps
} from './ObjectsLayer.helpers';
import { ObjectsLayerOverlays } from './ObjectsLayerOverlays';


const ObjectsLayerImpl = (props: ObjectsLayerProps) => {
  const {
    plan,
    visibleRegularObjects,
    objectById,
    selectedId,
    selectedIds,
    hideMultiSelectionBox,
    highlightId,
    highlightUntil,
    highlightNow,
    readOnly,
    panToolActive,
    toolMode,
    corridorDoorDraftActive,
    pendingType,
    pendingPreview,
    metersPerPixel,
    snapEnabled,
    zoom,
    perfEnabled,
    iconImages,
    imageObjects,
    cameraRotateId,
    selectedBounds,
    selectionBox,
    wallTypeIdSet,
    wallDraft,
    scaleDraft,
    scaleLine,
    measureDraft,
    quoteDraft,
    textDraftRect,
    safetyCard,
    safetyCardDraft,
    safetyCardSelected,
    objectNodeRefs,
    objectsLayerRef,
    dragStartRef,
    hoverRaf,
    pendingHoverRef,
    cameraRotateRef,
    deskTransformerRef,
    freeTransformerRef,
    safetyCardRectRef,
    safetyCardTransformerRef,
    safetyCardDraggingRef,
    selectionDragRef,
    selectedRoomIdsRef,
    roomNodeRefs,
    lastContextMenuAtRef,
    stageRef,
    estimateTextWidth,
    snap,
    pointerToWorld,
    isBoxSelecting,
    buildCameraFovPolygon,
    buildWifiRangeRings,
    scheduleCameraRotation,
    scheduleTextTransform,
    showSafetyCardHelpToast,
    getDeskBounds,
    polygonCentroid,
    formatMeasure,
    setHoverCard,
    setCameraRotateId,
    setSafetyCardSelected,
    setSafetyCardDraft,
    t,
    onMove,
    onMoveStart,
    onMoveWall,
    onSelect,
    onEdit,
    onUpdateObject,
    onUpdateRoom,
    onScaleMove,
    onScaleContextMenu,
    onScaleDoubleClick,
    onContextMenu,
    onSafetyCardChange,
    onSafetyCardContextMenu,
    onSafetyCardDoubleClick
  } = props;
  return (
        <Layer perfectDrawEnabled={false} ref={objectsLayerRef} listening={!toolMode && !corridorDoorDraftActive}>
          {visibleRegularObjects.map((obj) => {
            const isSelected = selectedIds ? selectedIds.includes(obj.id) : selectedId === obj.id;
            const highlightActive = !!(highlightId && highlightUntil && highlightId === obj.id && highlightUntil > highlightNow);
            const pulse = highlightActive ? 0.6 + 0.4 * Math.sin(highlightNow / 80) : 0;
            const isDesk = isDeskType(obj.type);
            const isText = obj.type === 'text';
            const isImage = obj.type === 'image';
            const isPhoto = obj.type === 'photo';
            const isPostIt = obj.type === 'postit';
            const multiSelected = (selectedIds || []).length > 1;
            const baseScale = Number(obj.scale ?? 1) || 1;
            const scale = isText || isImage ? 1 : baseScale;
            const isCamera = obj.type === 'camera';
            const isWifi = obj.type === 'wifi';
            const isSecurityObject = isSecurityTypeId(obj.type);
            const deskScaleX = isDesk ? clamp(Number(obj.scaleX ?? 1) || 1, 0.4, 4) : 1;
            const deskScaleY = isDesk ? clamp(Number(obj.scaleY ?? 1) || 1, 0.4, 4) : 1;
            const freeScaleX = isText || isImage ? clamp(Number(obj.scaleX ?? 1) || 1, 0.2, 6) : 1;
            const freeScaleY = isText || isImage ? clamp(Number(obj.scaleY ?? 1) || 1, 0.2, 6) : 1;
            const freeRotation = isText || isImage ? Number(obj.rotation || 0) : 0;
            const objectOpacity = typeof obj.opacity === 'number' ? Math.max(0.2, Math.min(1, obj.opacity)) : 1;
            const iconImg = iconImages[obj.type];
            const labelText =
              obj.type === 'real_user' && (((obj as any).firstName && String((obj as any).firstName).trim()) || ((obj as any).lastName && String((obj as any).lastName).trim()))
                ? `${String((obj as any).firstName || '').trim()}\n${String((obj as any).lastName || '').trim()}`.trim()
                : obj.name;
            const labelValue = String(labelText || '').trim();
            const labelLines = labelValue.includes('\n') ? 2 : 1;
            const labelLineHeight = 1.2;
            const labelFontSize = Math.max(4, 10 * scale);
            const labelHeight = labelLines * labelFontSize * labelLineHeight;
            const labelGap = 6;
            const labelY = -(18 * scale) - labelGap - labelHeight;
            const showLabel = !!labelValue && !isText && !isImage && !isPhoto && !isPostIt;
            const outline = highlightActive ? '#22d3ee' : isSelected ? (isPhoto ? '#16a34a' : '#2563eb') : '#cbd5e1';
            const outlineWidth = highlightActive
              ? (3 + 2 * pulse) * SELECTION_STROKE_SCALE
              : isSelected
                ? 3 * SELECTION_STROKE_SCALE
                : 2;
            const deskStrokeColor =
              typeof (obj as any).strokeColor === 'string' && String((obj as any).strokeColor).trim()
                ? String((obj as any).strokeColor).trim()
                : '#cbd5e1';
            const baseDeskStrokeWidth = clamp(Number((obj as any).strokeWidth ?? 2) || 2, 0.5, 6);
            const deskStroke = highlightActive ? '#22d3ee' : isSelected ? '#2563eb' : deskStrokeColor;
            const deskStrokeWidth = highlightActive
              ? baseDeskStrokeWidth + (1 + 2 * pulse) * SELECTION_STROKE_SCALE
              : isSelected
                ? baseDeskStrokeWidth + 1 * SELECTION_STROKE_SCALE
                : baseDeskStrokeWidth;
            const deskSize = 38 * scale;
            const deskHalf = deskSize / 2;
            const deskThickness = 12 * scale;
            const deskRotation = isDesk ? Number(obj.rotation || 0) : 0;
            const cameraRotation = isCamera ? Number(obj.rotation || 0) : 0;
            const textFont = (obj as any).textFont || 'Arial, sans-serif';
            const textSize = clamp(Number((obj as any).textSize ?? 18) || 18, 6, 160);
            const textColor = (obj as any).textColor || '#000000';
            const textBg = !!(obj as any).textBg;
            const textBgColor = (obj as any).textBgColor || '#ffffff';
            const textValue = isText ? String(obj.name || '') : '';
            const textLines = textValue ? textValue.split('\n') : [''];
            const textLineHeight = 1.2;
            const textNaturalWidth = isText
              ? Math.max(40, ...textLines.map((line) => estimateTextWidth(line || ' ', textSize)))
              : 0;
            const textNaturalHeight = isText ? Math.max(textSize, textLines.length * textSize * textLineHeight) : 0;
            const textPadding = Math.max(4, Math.round(textSize * 0.35));
            const baseTextBoxWidth = Number((obj as any).textBoxWidth || 0);
            const baseTextBoxHeight = Number((obj as any).textBoxHeight || 0);
            const fallbackTextBoxWidth = Math.max(TEXT_BOX_DEFAULT_WIDTH, textNaturalWidth + textPadding * 2);
            const fallbackTextBoxHeight = Math.max(TEXT_BOX_DEFAULT_HEIGHT, textNaturalHeight + textPadding * 2);
            const rawTextBoxWidth =
              Number.isFinite(baseTextBoxWidth) && baseTextBoxWidth > 0 ? baseTextBoxWidth : fallbackTextBoxWidth;
            const rawTextBoxHeight =
              Number.isFinite(baseTextBoxHeight) && baseTextBoxHeight > 0 ? baseTextBoxHeight : fallbackTextBoxHeight;
            const textBoxWidth = isText ? Math.max(TEXT_BOX_MIN_WIDTH, rawTextBoxWidth * freeScaleX) : 0;
            const textBoxHeight = isText ? Math.max(TEXT_BOX_MIN_HEIGHT, rawTextBoxHeight * freeScaleY) : 0;
            const textAreaWidth = Math.max(10, textBoxWidth - textPadding * 2);
            const textAreaHeight = Math.max(10, textBoxHeight - textPadding * 2);
            const imageW = Math.max(40, Number((obj as any).imageWidth ?? 160) || 160) * scale;
            const imageH = Math.max(30, Number((obj as any).imageHeight ?? 120) || 120) * scale;
            const postItCompact = !!(obj as any).postitCompact;
            const postItSize = (postItCompact ? 26 : 36) * scale;
            const postItHalf = postItSize / 2;
            const postItFold = postItSize * 0.28;
            const imageNode = isImage ? imageObjects[obj.id] : null;
            const photoSize = 34 * scale;
            const photoHalf = photoSize / 2;
            const photoRadius = Math.max(6, 7 * scale);
            const photoGradient = {
              fillLinearGradientStartPoint: { x: -photoHalf, y: -photoHalf },
              fillLinearGradientEndPoint: { x: photoHalf, y: photoHalf },
              fillLinearGradientColorStops: [0, '#f97316', 0.45, '#22d3ee', 1, '#6366f1']
            };
            const cameraRange = isCamera ? clamp(Number((obj as any).cctvRange ?? 160) || 160, 60, 600) : 0;
            const cameraAngle = isCamera ? clamp(Number((obj as any).cctvAngle ?? 70) || 70, 20, 160) : 0;
            const cameraOpacity = isCamera ? clamp(Number((obj as any).cctvOpacity ?? 0.6) || 0.6, 0.1, 0.9) : 0;
            const cameraOpacityLow = isCamera ? Math.max(0.05, cameraOpacity * 0.15) : 0;
            const cameraOpacityMid = isCamera ? Math.max(0.1, cameraOpacity * 0.55) : 0;
            const cameraFovPoints = isCamera ? buildCameraFovPolygon({ x: obj.x, y: obj.y }, cameraRange, cameraAngle, cameraRotation) : null;
            const showCameraHandle = isCamera && isSelected && !readOnly;
            const cameraHandleDistance = isCamera ? Math.max(22, Math.min(cameraRange * 0.85, cameraRange - 8)) : 0;
            const cameraHandleAngle = (cameraRotation * Math.PI) / 180;
            const cameraHandleX = isCamera ? Math.cos(cameraHandleAngle) * cameraHandleDistance : 0;
            const cameraHandleY = isCamera ? Math.sin(cameraHandleAngle) * cameraHandleDistance : 0;
            const wifiCoverageSqm = isWifi ? Number((obj as any).wifiCoverageSqm || 0) : 0;
            const wifiShowRange = isWifi ? (obj as any).wifiShowRange !== false : false;
            const wifiRangeScale = isWifi ? clamp(Number((obj as any).wifiRangeScale ?? 1) || 1, 0, WIFI_RANGE_SCALE_MAX) : 1;
            const wifiRangePx =
              isWifi && metersPerPixel && Number.isFinite(wifiCoverageSqm) && wifiCoverageSqm > 0
                ? (Math.sqrt(wifiCoverageSqm / Math.PI) * wifiRangeScale) / metersPerPixel
                : 0;
            const wifiRings =
              isWifi && wifiShowRange && wifiRangePx > 0 ? buildWifiRangeRings({ x: obj.x, y: obj.y }, wifiRangePx) : null;
            const bodyOpacity = isCamera ? 1 : objectOpacity;
            const deskRectW = deskSize * 1.45;
            const deskRectH = deskSize * 0.75;
            const deskLongW = deskSize * 1.85;
            const deskLongH = deskSize * 0.6;
            const deskDoubleW = deskSize * 0.7;
            const deskDoubleH = deskSize * 0.95;
            const deskDoubleGap = 4 * scale;
            const deskTrapTop = deskSize * 0.75;
            const deskTrapBottom = deskSize * 1.15;
            const deskTrapHeight = deskSize * 0.75;
            const deskTopLight = '#f9f3e7';
            const deskTopDark = '#e2c79b';
            const deskInsetStroke = 'rgba(255,255,255,0.55)';
            const deskInset = Math.max(1.5, 2 * scale);
            const deskGradient = (w: number, h: number) => ({
              fillLinearGradientStartPoint: { x: -w / 2, y: -h / 2 },
              fillLinearGradientEndPoint: { x: w / 2, y: h / 2 },
              fillLinearGradientColorStops: [0, deskTopLight, 1, deskTopDark]
            });
            const deskBounds = isDesk
              ? getDeskBounds(obj.type, {
                  deskSize,
                  deskRectW,
                  deskRectH,
                  deskLongW,
                  deskLongH,
                  deskDoubleW,
                  deskDoubleH,
                  deskDoubleGap,
                  deskTrapBottom,
                  deskTrapHeight
                })
              : null;
            const rotateHandleRadius = 8;
            const rotateHandleOffset = 10;
            const rotateHandleScaleX = isDesk ? 1 / Math.max(0.2, deskScaleX) : 1;
            const rotateHandleScaleY = isDesk ? 1 / Math.max(0.2, deskScaleY) : 1;
            const rotateHandleScale = 1 / Math.max(0.2, zoom);
            return (
              <Fragment key={obj.id}>
              <Group
                ref={(node) => {
                  if (node) objectNodeRefs.current[obj.id] = node;
                  else delete objectNodeRefs.current[obj.id];
                }}
                x={obj.x}
                y={obj.y}
                scaleX={isDesk ? deskScaleX : isImage ? freeScaleX : 1}
                scaleY={isDesk ? deskScaleY : isImage ? freeScaleY : 1}
                rotation={isText || isImage ? freeRotation : 0}
                draggable={!readOnly && !panToolActive && !toolMode && !(isCamera && cameraRotateId === obj.id)}
                onDragStart={(e) => {
                  if (cameraRotateRef.current?.id === obj.id) {
                    e.cancelBubble = true;
                    e.target.stopDrag?.();
                    return;
                  }
                  dragStartRef.current.set(obj.id, { x: obj.x, y: obj.y });
                  onMoveStart?.(obj.id, obj.x, obj.y, obj.roomId);
                  if (!isSelected) {
                    onSelect(obj.id, { multi: !!(e?.evt?.ctrlKey || e?.evt?.metaKey) });
                  }
                }}
                onMouseEnter={(e) => {
                  if (obj.type !== 'real_user' && obj.type !== 'postit') return;
                  if (perfEnabled) perfMetrics.hoverUpdates += 1;
                  setHoverCard({ clientX: e.evt.clientX, clientY: e.evt.clientY, obj });
                }}
                onMouseMove={(e) => {
                  if (obj.type !== 'real_user' && obj.type !== 'postit') return;
                  pendingHoverRef.current = { clientX: e.evt.clientX, clientY: e.evt.clientY, obj };
                  if (hoverRaf.current) return;
                  hoverRaf.current = requestAnimationFrame(() => {
                    hoverRaf.current = null;
                    const pending = pendingHoverRef.current;
                    if (!pending) return;
                    if (perfEnabled) perfMetrics.hoverUpdates += 1;
                    setHoverCard((prev) =>
                      prev ? { ...prev, clientX: pending.clientX, clientY: pending.clientY } : pending
                    );
                  });
                }}
                onMouseLeave={() => {
                  if (hoverRaf.current) cancelAnimationFrame(hoverRaf.current);
                  hoverRaf.current = null;
                  pendingHoverRef.current = null;
                  if (perfEnabled) perfMetrics.hoverUpdates += 1;
                  setHoverCard(null);
                }}
                onDragEnd={(e) => {
                  if (readOnly) return;
                  const stage = stageRef.current;
                  if (!stage) {
                    const nextX = snapEnabled ? snap(e.target.x()) : e.target.x();
                    const nextY = snapEnabled ? snap(e.target.y()) : e.target.y();
                    const accepted = onMove(obj.id, nextX, nextY);
                  if (accepted === false) {
                    const prev = dragStartRef.current.get(obj.id);
                    if (prev) {
                      e.target.position({ x: prev.x, y: prev.y });
                      stage?.batchDraw();
                    }
                  }
                    dragStartRef.current.delete(obj.id);
                    return;
                  }
                  const transform = stage.getAbsoluteTransform().copy();
                  transform.invert();
                  const abs = e.target.getAbsolutePosition();
                  const world = transform.point(abs);
                  const nextX = snapEnabled ? snap(world.x) : world.x;
                  const nextY = snapEnabled ? snap(world.y) : world.y;
                  const accepted = onMove(obj.id, nextX, nextY);
                  if (accepted === false) {
                    const prev = dragStartRef.current.get(obj.id);
                    if (prev) {
                      e.target.position({ x: prev.x, y: prev.y });
                      stage?.batchDraw();
                    }
                  }
                  dragStartRef.current.delete(obj.id);
                }}
                onTransform={(e) => {
                  if (readOnly || !onUpdateObject) return;
                  if (!isText) return;
                  const activeAnchor = freeTransformerRef.current?.getActiveAnchor?.();
                  if (activeAnchor === 'rotater') return;
                  const node = e.target as any;
                  const baseWidth = textBoxWidth || TEXT_BOX_DEFAULT_WIDTH;
                  const baseHeight = textBoxHeight || TEXT_BOX_DEFAULT_HEIGHT;
                  const nextWidth = Math.max(TEXT_BOX_MIN_WIDTH, baseWidth * node.scaleX());
                  const nextHeight = Math.max(TEXT_BOX_MIN_HEIGHT, baseHeight * node.scaleY());
                  node.scaleX(1);
                  node.scaleY(1);
                  scheduleTextTransform({ id: obj.id, width: nextWidth, height: nextHeight });
                }}
                onTransformEnd={(e) => {
                  if (readOnly || !onUpdateObject) return;
                  if (!isDesk && !isText && !isImage) return;
                  const node = e.target as any;
                  if (isDesk) {
                    const nextScaleX = clamp(node.scaleX(), 0.4, 4);
                    const nextScaleY = clamp(node.scaleY(), 0.4, 4);
                    node.scaleX(1);
                    node.scaleY(1);
                    onUpdateObject(obj.id, { scaleX: nextScaleX, scaleY: nextScaleY });
                    return;
                  }
                  let nextRotation = Number.isFinite(node.rotation()) ? node.rotation() : 0;
                  if ((e.evt as any)?.shiftKey) {
                    nextRotation = Math.round(nextRotation / 90) * 90;
                    node.rotation(nextRotation);
                  }
                  if (isText) {
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    const baseWidth = textBoxWidth || TEXT_BOX_DEFAULT_WIDTH;
                    const baseHeight = textBoxHeight || TEXT_BOX_DEFAULT_HEIGHT;
                    const nextWidth =
                      scaleX !== 1 ? Math.max(TEXT_BOX_MIN_WIDTH, baseWidth * scaleX) : undefined;
                    const nextHeight =
                      scaleY !== 1 ? Math.max(TEXT_BOX_MIN_HEIGHT, baseHeight * scaleY) : undefined;
                    node.scaleX(1);
                    node.scaleY(1);
                    const payload: any = { scaleX: 1, scaleY: 1, rotation: nextRotation };
                    if (nextWidth) payload.textBoxWidth = nextWidth;
                    if (nextHeight) payload.textBoxHeight = nextHeight;
                    onUpdateObject(obj.id, payload);
                    return;
                  }
                  const nextScaleX = clamp(node.scaleX(), 0.2, 6);
                  const nextScaleY = clamp(node.scaleY(), 0.2, 6);
                  node.scaleX(1);
                  node.scaleY(1);
                  onUpdateObject(obj.id, { scaleX: nextScaleX, scaleY: nextScaleY, rotation: nextRotation });
                }}
                onClick={(e) => {
                  e.cancelBubble = true;
                  if (typeof e.evt?.button === 'number' && e.evt.button !== 0) return;
                  const multiSelectionActive = (selectedIds || []).length > 1 && (selectedIds || []).includes(obj.id);
                  if (isPhoto && multiSelectionActive && !(e.evt.ctrlKey || e.evt.metaKey)) {
                    return;
                  }
                  if (isPostIt && isSelected && !readOnly) {
                    onUpdateObject?.(obj.id, { postitCompact: !(obj as any).postitCompact });
                  }
                  onSelect(obj.id, { multi: !!(e.evt.ctrlKey || e.evt.metaKey) });
                }}
                onDblClick={(e) => {
                  if (isPhoto) return;
                  e.cancelBubble = true;
                  if (typeof e.evt?.button === 'number' && e.evt.button !== 0) return;
                  if (readOnly) return;
                  onEdit(obj.id);
                }}
                onContextMenu={(e) => {
                  e.evt.preventDefault();
                  e.cancelBubble = true;
                  if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                  if (isBoxSelecting()) return;
                  lastContextMenuAtRef.current = Date.now();
                  // Keep current selection if object is already selected; select only when needed.
                  if (!isSelected) {
                    onSelect(obj.id, { keepContext: true });
                  }
                  if (pendingType || readOnly) return;
                  onContextMenu({ id: obj.id, clientX: e.evt.clientX, clientY: e.evt.clientY });
                }}
              >
                {isCamera && cameraFovPoints ? (
                  <Line
                    points={cameraFovPoints}
                    closed
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndRadius={cameraRange}
                    fillRadialGradientColorStops={[
                      0,
                      `rgba(34,197,94,${cameraOpacity})`,
                      0.6,
                      `rgba(34,197,94,${cameraOpacityMid})`,
                      1,
                      `rgba(34,197,94,${cameraOpacityLow})`
                    ]}
                    opacity={1}
                    listening={false}
                  />
                ) : null}
                {showCameraHandle ? (
                  <Circle
                    x={cameraHandleX}
                    y={cameraHandleY}
                    radius={4}
                    fill="#0f172a"
                    stroke="#f8fafc"
                    strokeWidth={1.5}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      if (readOnly) return;
                      cameraRotateRef.current = { id: obj.id, origin: { x: obj.x, y: obj.y } };
                      setCameraRotateId(obj.id);
                      const stage = e.target.getStage();
                      const pos = stage?.getPointerPosition();
                      if (pos) {
                        const world = pointerToWorld(pos.x, pos.y);
                        scheduleCameraRotation(world, !!e.evt.shiftKey);
                      }
                    }}
                  />
                ) : null}
                {wifiRings ? (
                  <>
                    <Line
                      points={wifiRings.outer}
                      closed
                      fill="rgba(239,68,68,0.12)"
                      listening={false}
                    />
                    <Line
                      points={wifiRings.mid}
                      closed
                      fill="rgba(234,179,8,0.18)"
                      listening={false}
                    />
                    <Line
                      points={wifiRings.inner}
                      closed
                      fill="rgba(34,197,94,0.22)"
                      listening={false}
                    />
                  </>
                ) : null}
                {isDesk ? (
                  <Group rotation={deskRotation} opacity={objectOpacity}>
                    {obj.type === 'desk_round' ? (
                      <>
                        <Circle
                          x={0}
                          y={0}
                          radius={deskHalf}
                          fillRadialGradientStartPoint={{ x: -deskHalf * 0.3, y: -deskHalf * 0.3 }}
                          fillRadialGradientStartRadius={deskHalf * 0.1}
                          fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                          fillRadialGradientEndRadius={deskHalf}
                          fillRadialGradientColorStops={[0, '#fdf8ef', 0.7, deskTopLight, 1, deskTopDark]}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Circle
                          x={0}
                          y={0}
                          radius={Math.max(6 * scale, deskHalf - deskInset)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_square' ? (
                      <>
                        <Rect
                          x={-deskHalf}
                          y={-deskHalf}
                          width={deskSize}
                          height={deskSize}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskSize, deskSize)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskHalf + deskInset}
                          y={-deskHalf + deskInset}
                          width={deskSize - deskInset * 2}
                          height={deskSize - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_rect' ? (
                      <>
                        <Rect
                          x={-deskRectW / 2}
                          y={-deskRectH / 2}
                          width={deskRectW}
                          height={deskRectH}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskRectW, deskRectH)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskRectW / 2 + deskInset}
                          y={-deskRectH / 2 + deskInset}
                          width={deskRectW - deskInset * 2}
                          height={deskRectH - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_double' ? (
                      <>
                        <Rect
                          x={-(deskDoubleW + deskDoubleGap / 2)}
                          y={-deskDoubleH / 2}
                          width={deskDoubleW}
                          height={deskDoubleH}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskDoubleW, deskDoubleH)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={deskDoubleGap / 2}
                          y={-deskDoubleH / 2}
                          width={deskDoubleW}
                          height={deskDoubleH}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskDoubleW, deskDoubleH)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-(deskDoubleW + deskDoubleGap / 2) + deskInset}
                          y={-deskDoubleH / 2 + deskInset}
                          width={deskDoubleW - deskInset * 2}
                          height={deskDoubleH - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                        <Rect
                          x={deskDoubleGap / 2 + deskInset}
                          y={-deskDoubleH / 2 + deskInset}
                          width={deskDoubleW - deskInset * 2}
                          height={deskDoubleH - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_long' ? (
                      <>
                        <Rect
                          x={-deskLongW / 2}
                          y={-deskLongH / 2}
                          width={deskLongW}
                          height={deskLongH}
                          cornerRadius={6 * scale}
                          {...deskGradient(deskLongW, deskLongH)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskLongW / 2 + deskInset}
                          y={-deskLongH / 2 + deskInset}
                          width={deskLongW - deskInset * 2}
                          height={deskLongH - deskInset * 2}
                          cornerRadius={Math.max(2, 5 * scale)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : obj.type === 'desk_trap' ? (
                      <Line
                        points={[
                          -deskTrapTop / 2,
                          -deskTrapHeight / 2,
                          deskTrapTop / 2,
                          -deskTrapHeight / 2,
                          deskTrapBottom / 2,
                          deskTrapHeight / 2,
                          -deskTrapBottom / 2,
                          deskTrapHeight / 2
                        ]}
                        closed
                        {...deskGradient(deskTrapBottom, deskTrapHeight)}
                        stroke={deskStroke}
                        strokeWidth={deskStrokeWidth}
                        strokeScaleEnabled={false}
                        shadowBlur={0}
                        shadowColor="transparent"
                      />
                    ) : obj.type === 'desk_l' ? (
                      <>
                        <Rect
                          x={-deskHalf}
                          y={deskHalf - deskThickness}
                          width={deskSize}
                          height={deskThickness}
                          {...deskGradient(deskSize, deskThickness)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskHalf}
                          y={-deskHalf}
                          width={deskThickness}
                          height={deskSize}
                          {...deskGradient(deskThickness, deskSize)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskHalf + deskInset}
                          y={deskHalf - deskThickness + deskInset}
                          width={deskSize - deskInset * 2}
                          height={Math.max(2, deskThickness - deskInset * 2)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                        <Rect
                          x={-deskHalf + deskInset}
                          y={-deskHalf + deskInset}
                          width={Math.max(2, deskThickness - deskInset * 2)}
                          height={deskSize - deskInset * 2}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    ) : (
                      <>
                        <Rect
                          x={-deskHalf}
                          y={deskHalf - deskThickness}
                          width={deskSize}
                          height={deskThickness}
                          {...deskGradient(deskSize, deskThickness)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={deskHalf - deskThickness}
                          y={-deskHalf}
                          width={deskThickness}
                          height={deskSize}
                          {...deskGradient(deskThickness, deskSize)}
                          stroke={deskStroke}
                          strokeWidth={deskStrokeWidth}
                          strokeScaleEnabled={false}
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Rect
                          x={-deskHalf + deskInset}
                          y={deskHalf - deskThickness + deskInset}
                          width={deskSize - deskInset * 2}
                          height={Math.max(2, deskThickness - deskInset * 2)}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                        <Rect
                          x={deskHalf - deskThickness + deskInset}
                          y={-deskHalf + deskInset}
                          width={Math.max(2, deskThickness - deskInset * 2)}
                          height={deskSize - deskInset * 2}
                          stroke={deskInsetStroke}
                          strokeWidth={1}
                          strokeScaleEnabled={false}
                          listening={false}
                        />
                      </>
                    )}
                  </Group>
                ) : isText ? (
                  <>
                    {isSelected ? (
                      <Rect
                        x={-textBoxWidth / 2}
                        y={-textBoxHeight / 2}
                        width={textBoxWidth}
                        height={textBoxHeight}
                        stroke="rgba(37,99,235,0.6)"
                        strokeWidth={Math.max(0.6, 1 * SELECTION_STROKE_SCALE)}
                        dash={[6, 6]}
                        listening={false}
                      />
                    ) : null}
                    <Group
                      opacity={objectOpacity}
                      clipX={-textBoxWidth / 2}
                      clipY={-textBoxHeight / 2}
                      clipWidth={textBoxWidth}
                      clipHeight={textBoxHeight}
                    >
                      <Rect
                        x={-textBoxWidth / 2}
                        y={-textBoxHeight / 2}
                        width={textBoxWidth}
                        height={textBoxHeight}
                        fill={textBg ? textBgColor : 'transparent'}
                        cornerRadius={Math.max(4, Math.round(textSize * 0.25))}
                        shadowBlur={0}
                        shadowColor="transparent"
                      />
                      <Text
                        text={textValue}
                        x={-textBoxWidth / 2 + textPadding}
                        y={-textBoxHeight / 2 + textPadding}
                        width={textAreaWidth}
                        height={textAreaHeight}
                        align="left"
                        verticalAlign="middle"
                        wrap="char"
                        lineHeight={textLineHeight}
                        fontSize={textSize}
                        fontFamily={textFont}
                        fill={textColor}
                        shadowBlur={0}
                        shadowColor="transparent"
                      />
                    </Group>
                  </>
                ) : isPhoto ? (
                  <Group opacity={objectOpacity}>
                    <Rect
                      x={-photoHalf}
                      y={-photoHalf}
                      width={photoSize}
                      height={photoSize}
                      cornerRadius={photoRadius}
                      stroke={outline}
                      strokeWidth={outlineWidth}
                      strokeScaleEnabled={false}
                      {...photoGradient}
                    />
                    <Circle x={-photoHalf + photoSize * 0.28} y={-photoHalf + photoSize * 0.28} radius={Math.max(2.2, 2.8 * scale)} fill="rgba(255,255,255,0.9)" />
                    <Line
                      points={[
                        -photoHalf + photoSize * 0.2,
                        photoHalf - photoSize * 0.28,
                        -photoHalf + photoSize * 0.42,
                        photoHalf - photoSize * 0.46,
                        -photoHalf + photoSize * 0.64,
                        photoHalf - photoSize * 0.3
                      ]}
                      stroke="#ffffff"
                      strokeWidth={Math.max(1.2, 1.6 * scale)}
                      lineCap="round"
                      lineJoin="round"
                      strokeScaleEnabled={false}
                    />
                  </Group>
                ) : isImage ? (
                  <Group opacity={objectOpacity}>
                    {imageNode ? (
                      <KonvaImage
                        image={imageNode}
                        x={-imageW / 2}
                        y={-imageH / 2}
                        width={imageW}
                        height={imageH}
                      />
                    ) : (
                      <>
                        <Rect
                          x={-imageW / 2}
                          y={-imageH / 2}
                          width={imageW}
                          height={imageH}
                          stroke="#94a3b8"
                          strokeWidth={1.5}
                          dash={[6, 4]}
                          fill="#ffffff"
                          shadowBlur={0}
                          shadowColor="transparent"
                        />
                        <Text
                          text="IMG"
                          x={-imageW / 2}
                          y={-8}
                          width={imageW}
                          align="center"
                          fontSize={12}
                          fontStyle="bold"
                          fill="#94a3b8"
                        />
                      </>
                    )}
                  </Group>
                ) : isPostIt ? (
                  <Group opacity={objectOpacity}>
                    <Rect
                      x={-postItHalf}
                      y={-postItHalf}
                      width={postItSize}
                      height={postItSize}
                      cornerRadius={6 * scale}
                      fill="#fde047"
                      stroke={outline}
                      strokeWidth={outlineWidth}
                      strokeScaleEnabled={false}
                      shadowBlur={0}
                      shadowColor="transparent"
                    />
                    <Line
                      points={[
                        postItHalf - postItFold,
                        -postItHalf,
                        postItHalf,
                        -postItHalf,
                        postItHalf,
                        -postItHalf + postItFold
                      ]}
                      closed
                      fill="#fef08a"
                      stroke={outline}
                      strokeWidth={Math.max(1, outlineWidth * 0.6)}
                      strokeScaleEnabled={false}
                    />
                    <Line
                      points={[
                        -postItHalf + 6 * scale,
                        -postItHalf + postItSize * 0.45,
                        postItHalf - 8 * scale,
                        -postItHalf + postItSize * 0.45
                      ]}
                      stroke="#b45309"
                      strokeWidth={Math.max(1, 1.6 * scale)}
                      strokeLinecap="round"
                      strokeScaleEnabled={false}
                    />
                    <Line
                      points={[
                        -postItHalf + 6 * scale,
                        -postItHalf + postItSize * 0.62,
                        postItHalf - 12 * scale,
                        -postItHalf + postItSize * 0.62
                      ]}
                      stroke="#b45309"
                      strokeWidth={Math.max(1, 1.6 * scale)}
                      strokeLinecap="round"
                      strokeScaleEnabled={false}
                    />
                  </Group>
                ) : (
                  <Group rotation={isCamera ? cameraRotation : 0} opacity={isCamera ? objectOpacity : 1}>
                    <Rect
                      x={-(18 * scale)}
                      y={-(18 * scale)}
                      width={36 * scale}
                      height={36 * scale}
                      cornerRadius={12 * scale}
                      fill={isSecurityObject ? '#fee2e2' : '#ffffff'}
                      stroke={outline}
                      strokeWidth={outlineWidth}
                      opacity={bodyOpacity}
                      shadowBlur={0}
                      shadowColor="transparent"
                    />
                    {iconImg ? (
                      <KonvaImage
                        image={iconImg}
                        x={-9 * scale}
                        y={-9 * scale}
                        width={18 * scale}
                        height={18 * scale}
                        opacity={bodyOpacity}
                        listening={false}
                      />
                    ) : (
                      <Text
                        text={'?'}
                        x={-(18 * scale)}
                        y={-(18 * scale) / 1.2}
                        width={36 * scale}
                        align="center"
                        fontSize={15 * scale}
                        fontStyle="bold"
                        fill={isSecurityObject ? '#dc2626' : '#2563eb'}
                        opacity={bodyOpacity}
                        listening={false}
                      />
                    )}
                  </Group>
                )}
                {isDesk && isSelected && !readOnly && deskBounds && !multiSelected ? (
                  <Group
                    x={deskBounds.width / 2 + rotateHandleOffset}
                    y={-(deskBounds.height / 2 + rotateHandleOffset)}
                    scaleX={rotateHandleScaleX * rotateHandleScale}
                    scaleY={rotateHandleScaleY * rotateHandleScale}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      if (!onUpdateObject) return;
                      onUpdateObject(obj.id, { rotation: (deskRotation + 90) % 360 });
                    }}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                    }}
                  >
                    <Circle radius={rotateHandleRadius} fill="#0f172a" stroke="#ffffff" strokeWidth={1.5} opacity={0.92} />
                    <Text
                      text="↻"
                      x={-rotateHandleRadius}
                      y={-rotateHandleRadius}
                      width={rotateHandleRadius * 2}
                      height={rotateHandleRadius * 2}
                      align="center"
                      verticalAlign="middle"
                      fontSize={rotateHandleRadius + 2}
                      fontStyle="bold"
                      fill="#ffffff"
                      listening={false}
                    />
                  </Group>
                ) : null}
              </Group>
              {showLabel ? (
                <Text
                  text={labelValue}
                  x={obj.x - 80}
                  y={obj.y + labelY}
                  width={160}
                  align="center"
                  fontStyle="bold"
                  fill="#0f172a"
                  fontSize={labelFontSize}
                  lineHeight={labelLineHeight}
                  shadowBlur={0}
                  shadowColor="transparent"
                  listening={false}
                />
              ) : null}
              </Fragment>
            );
          })}
          {!readOnly ? (
            <>
              <Transformer
                ref={deskTransformerRef}
                rotateEnabled={false}
                keepRatio={false}
                boundBoxFunc={(oldBox: any, newBox: any) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />
              <Transformer
                ref={freeTransformerRef}
                rotateEnabled
                keepRatio={false}
                boundBoxFunc={(oldBox: any, newBox: any) => {
                  if (newBox.width < 20 || newBox.height < 20) return oldBox;
                  return newBox;
                }}
              />
            </>
          ) : null}
        {/* Overlays (drafts + selection) */}
          <ObjectsLayerOverlays {...{ scaleLine, scaleDraft, wallDraft, measureDraft, quoteDraft, pendingType, pendingPreview, textDraftRect, readOnly, toolMode, iconImages, metersPerPixel, estimateTextWidth, formatMeasure, polygonCentroid, onScaleMove, onScaleContextMenu, onScaleDoubleClick, onContextMenu, t }} />

          {safetyCard?.visible && safetyCardDraft ? (
            (() => {
              const cardW = safetyCardDraft.w;
              const cardH = safetyCardDraft.h;
              const headerHeight = Math.max(20, safetyCardDraft.fontSize * 1.48);
              const bodyFontSize = Math.max(8, safetyCardDraft.fontSize);
              const bodyLineHeight = Math.max(12, bodyFontSize * 1.22);
              const titleFontSize = Math.max(9, safetyCardDraft.fontSize * 0.92);
              const titleY = Math.max(4, Math.round((headerHeight - titleFontSize) / 2) + 1);
              const bodyTop = Math.max(headerHeight + 6, Math.round((cardH - bodyLineHeight * 2) / 2 + 3));
              const numbersText = `${safetyCard.numbersLabel}: ${safetyCard.numbersText || safetyCard.noNumbersText}`;
              const pointsText = `${safetyCard.pointsLabel}: ${safetyCard.pointsText || safetyCard.noPointsText}`;
              const colorVariant =
                SAFETY_CARD_COLOR_VARIANTS[((Number(safetyCardDraft.colorIndex) % SAFETY_CARD_COLOR_VARIANTS.length) + SAFETY_CARD_COLOR_VARIANTS.length) % SAFETY_CARD_COLOR_VARIANTS.length];
              const textBgFill =
                SAFETY_CARD_TEXT_BG_VARIANTS[
                  ((Number(safetyCardDraft.textBgIndex) % SAFETY_CARD_TEXT_BG_VARIANTS.length) + SAFETY_CARD_TEXT_BG_VARIANTS.length) %
                    SAFETY_CARD_TEXT_BG_VARIANTS.length
                ];
              const fontFamily = SAFETY_CARD_FONT_VALUES.length
                ? SAFETY_CARD_FONT_VALUES[
                    ((Number(safetyCardDraft.fontIndex) % SAFETY_CARD_FONT_VALUES.length) + SAFETY_CARD_FONT_VALUES.length) %
                      SAFETY_CARD_FONT_VALUES.length
                  ]
                : 'Arial, sans-serif';
              const linePad = 3;
              const textBgWidth = Math.max(24, cardW - 16);
              const textBgHeight = bodyLineHeight + linePad * 2;
              return (
                <>
                  <Group
                    name="safety-card-group"
                    x={safetyCardDraft.x}
                    y={safetyCardDraft.y}
                    draggable={!readOnly && !panToolActive && !toolMode && !pendingType}
                    onMouseDown={(e) => {
                      e.cancelBubble = true;
                      onSelect(undefined);
                      setSafetyCardSelected(true);
                      showSafetyCardHelpToast();
                    }}
                    onClick={(e) => {
                      e.cancelBubble = true;
                      showSafetyCardHelpToast();
                    }}
                    onContextMenu={(e) => {
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      lastContextMenuAtRef.current = Date.now();
                      onSafetyCardContextMenu?.({
                        clientX: e.evt.clientX,
                        clientY: e.evt.clientY,
                        worldX: Number(safetyCardDraft.x || 0),
                        worldY: Number(safetyCardDraft.y || 0)
                      });
                    }}
                    onDblClick={(e) => {
                      e.cancelBubble = true;
                      onSafetyCardDoubleClick?.();
                    }}
                    onDragStart={() => {
                      safetyCardDraggingRef.current = true;
                    }}
                    onDragMove={(e) => {
                      const nextX = e.target.x();
                      const nextY = e.target.y();
                      setSafetyCardDraft((prev) => (prev ? { ...prev, x: nextX, y: nextY } : prev));
                    }}
                    onDragEnd={(e) => {
                      safetyCardDraggingRef.current = false;
                      const nextX = e.target.x();
                      const nextY = e.target.y();
                      const nextLayout = {
                        ...safetyCardDraft,
                        x: nextX,
                        y: nextY
                      };
                      setSafetyCardDraft(nextLayout);
                      onSafetyCardChange?.(nextLayout, { commit: true });
                    }}
                  >
                    <Rect
                      ref={safetyCardRectRef}
                      name="safety-card-body"
                      x={0}
                      y={0}
                      width={cardW}
                      height={cardH}
                      cornerRadius={0}
                      fill={colorVariant.body}
                      stroke={safetyCardSelected ? '#0284c7' : colorVariant.border}
                      strokeWidth={safetyCardSelected ? 2.1 : 1.5}
                      shadowColor="#0c4a6e"
                      shadowBlur={6}
                      shadowOpacity={0.16}
                      shadowOffset={{ x: 0, y: 1 }}
                      onTransformEnd={(e) => {
                        const node = e.target as any;
                        const scaleX = Number(node.scaleX() || 1);
                        const scaleY = Number(node.scaleY() || 1);
                        const nextW = Math.max(220, Number(node.width() || cardW) * scaleX);
                        const nextH = Math.max(56, Number(node.height() || cardH) * scaleY);
                        node.scaleX(1);
                        node.scaleY(1);
                        node.width(nextW);
                        node.height(nextH);
                        const nextLayout = {
                          ...safetyCardDraft,
                          w: nextW,
                          h: nextH
                        };
                        setSafetyCardDraft(nextLayout);
                        onSafetyCardChange?.(nextLayout, { commit: true });
                      }}
                    />
                    <Rect
                      name="safety-card-header"
                      x={1}
                      y={1}
                      width={Math.max(1, cardW - 2)}
                      height={Math.max(1, headerHeight - 2)}
                      cornerRadius={0}
                      fill={colorVariant.header}
                      listening={false}
                    />
                    <Text
                      x={10}
                      y={titleY}
                      width={Math.max(20, cardW - 20)}
                      text={String(safetyCard.title || '')}
                      fontSize={titleFontSize}
                      fontStyle="bold"
                      fontFamily={fontFamily}
                      fill={colorVariant.title}
                      wrap="none"
                      ellipsis
                      listening={false}
                    />
                    {textBgFill !== 'transparent' ? (
                      <>
                        <Rect
                          x={8}
                          y={bodyTop - linePad}
                          width={textBgWidth}
                          height={textBgHeight}
                          fill={textBgFill}
                          cornerRadius={0}
                          opacity={0.95}
                          listening={false}
                        />
                        <Rect
                          x={8}
                          y={bodyTop + bodyLineHeight - linePad}
                          width={textBgWidth}
                          height={textBgHeight}
                          fill={textBgFill}
                          cornerRadius={0}
                          opacity={0.95}
                          listening={false}
                        />
                      </>
                    ) : null}
                    <Text
                      x={10}
                      y={bodyTop}
                      width={Math.max(20, cardW - 20)}
                      text={numbersText}
                      fontSize={bodyFontSize}
                      fontStyle="bold"
                      fontFamily={fontFamily}
                      fill={colorVariant.text}
                      wrap="none"
                      ellipsis
                      listening={false}
                    />
                    <Text
                      x={10}
                      y={bodyTop + bodyLineHeight}
                      width={Math.max(20, cardW - 20)}
                      text={pointsText}
                      fontSize={bodyFontSize}
                      fontStyle="bold"
                      fontFamily={fontFamily}
                      fill={colorVariant.text}
                      wrap="none"
                      ellipsis
                      listening={false}
                    />
                  </Group>
                  {safetyCardSelected && !readOnly ? (
                    <Transformer
                      ref={safetyCardTransformerRef}
                      rotateEnabled={false}
                      keepRatio={false}
                      ignoreStroke
                      borderStroke="#0284c7"
                      borderStrokeWidth={1.2}
                      anchorStroke="#0284c7"
                      anchorFill="#ffffff"
                      anchorCornerRadius={0}
                      anchorSize={8}
                      onContextMenu={(e) => {
                        e.evt.preventDefault();
                        e.cancelBubble = true;
                      }}
                      boundBoxFunc={(oldBox: any, newBox: any) => {
                        if (newBox.width < 220 || newBox.height < 56) return oldBox;
                        return newBox;
                      }}
                    />
                  ) : null}
                </>
              );
            })()
          ) : null}

          {selectionBox ? (
            <Rect
              x={selectionBox.x}
              y={selectionBox.y}
              width={selectionBox.width}
              height={selectionBox.height}
              fill={SELECTION_FILL}
              stroke={SELECTION_COLOR}
              strokeWidth={1.2}
              dash={SELECTION_DASH}
              listening={false}
              cornerRadius={10}
            />
          ) : null}

          {!readOnly && selectedBounds && (selectedIds || []).length > 1 ? (
            <Group
              x={selectedBounds.minX}
              y={selectedBounds.minY}
              draggable={!panToolActive && !toolMode}
              onContextMenu={(e) => {
                e.evt.preventDefault();
                e.cancelBubble = true;
                if ((e.evt as any)?.metaKey || (e.evt as any)?.altKey) return;
                if (isBoxSelecting()) return;
                const firstId = (selectedIds || [])[0];
                if (!firstId) return;
                lastContextMenuAtRef.current = Date.now();
                onContextMenu({ id: firstId, clientX: e.evt.clientX, clientY: e.evt.clientY });
              }}
              onDragStart={(e) => {
                const startById: Record<string, { x: number; y: number }> = {};
                const ids = selectedIds || [];
                for (const id of ids) {
                  const obj = objectById.get(id);
                  if (!obj) continue;
                  const node = objectNodeRefs.current[id];
                  if (node) {
                    const pos = node.position();
                    startById[id] = { x: pos.x, y: pos.y };
                  } else {
                    startById[id] = { x: obj.x, y: obj.y };
                  }
                }
                const roomStartById: Record<string, { x: number; y: number; kind: 'rect' | 'poly' }> = {};
                for (const roomId of selectedRoomIdsRef.current) {
                  const room = (plan.rooms || []).find((r) => r.id === roomId);
                  if (!room) continue;
                  const node = roomNodeRefs.current[roomId];
                  if (!node) continue;
                  const pos = node.position();
                  const kind = (room.kind || (Array.isArray(room.points) && room.points.length ? 'poly' : 'rect')) as
                    | 'rect'
                    | 'poly';
                  roomStartById[roomId] = { x: pos.x, y: pos.y, kind };
                }
                const batchId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
                selectionDragRef.current = { startX: e.target.x(), startY: e.target.y(), startById, batchId, roomStartById };
              }}
              onDragMove={(e) => {
                const ref = selectionDragRef.current;
                if (!ref) return;
                const dx = e.target.x() - ref.startX;
                const dy = e.target.y() - ref.startY;
                for (const [id, start] of Object.entries(ref.startById)) {
                  const node = objectNodeRefs.current[id];
                  if (!node) continue;
                  node.position({ x: start.x + dx, y: start.y + dy });
                }
                if (ref.roomStartById) {
                  for (const [roomId, start] of Object.entries(ref.roomStartById)) {
                    const node = roomNodeRefs.current[roomId];
                    if (!node) continue;
                    node.position({ x: start.x + dx, y: start.y + dy });
                    node.getLayer()?.batchDraw?.();
                  }
                }
                objectsLayerRef.current?.batchDraw?.();
              }}
              onDragEnd={(e) => {
                const ref = selectionDragRef.current;
                selectionDragRef.current = null;
                if (!ref) return;
                const dx = e.target.x() - ref.startX;
                const dy = e.target.y() - ref.startY;
                const movedRoomIds = ref.roomStartById ? Object.keys(ref.roomStartById) : undefined;
                for (const [id, start] of Object.entries(ref.startById)) {
                  const nx = start.x + dx;
                  const ny = start.y + dy;
                  const obj = objectById.get(id);
                  if (obj && wallTypeIdSet.has(obj.type)) {
                    const node = objectNodeRefs.current[id];
                    if (node) {
                      node.position({ x: 0, y: 0 });
                      node.getLayer()?.batchDraw?.();
                    }
                    onMoveWall?.(id, dx, dy, ref.batchId, movedRoomIds);
                  } else {
                    onMove(id, snapEnabled ? snap(nx) : nx, snapEnabled ? snap(ny) : ny);
                  }
                }
                if (ref.roomStartById) {
                  for (const [roomId] of Object.entries(ref.roomStartById)) {
                    const room = (plan.rooms || []).find((r) => r.id === roomId);
                    if (!room) continue;
                    const kind = (room.kind || (Array.isArray(room.points) && room.points.length ? 'poly' : 'rect')) as
                      | 'rect'
                      | 'poly';
                    if (kind === 'poly') {
                      const node = roomNodeRefs.current[roomId];
                      if (node) {
                        node.position({ x: 0, y: 0 });
                        node.getLayer()?.batchDraw?.();
                      }
                      const pts = Array.isArray(room.points) ? room.points : [];
                      if (!pts.length) continue;
                      onUpdateRoom?.(roomId, { kind: 'poly', points: pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) });
                    } else {
                      const rx = Number(room.x || 0);
                      const ry = Number(room.y || 0);
                      onUpdateRoom?.(roomId, { kind: 'rect', x: rx + dx, y: ry + dy, width: room.width || 0, height: room.height || 0 });
                    }
                  }
                }
              }}
            >
              {hideMultiSelectionBox ? (
                <Rect
                  x={-12}
                  y={-12}
                  width={selectedBounds.maxX - selectedBounds.minX + 24}
                  height={selectedBounds.maxY - selectedBounds.minY + 24}
                  fill="rgba(0,0,0,0.001)"
                  strokeWidth={0}
                  listening={false}
                />
              ) : (
                <>
                  <Rect
                    x={-14}
                    y={-14}
                    width={selectedBounds.maxX - selectedBounds.minX + 28}
                    height={selectedBounds.maxY - selectedBounds.minY + 28}
                    fill="rgba(0,0,0,0.001)"
                    stroke={SELECTION_GLOW}
                    strokeWidth={4}
                    dash={SELECTION_DASH}
                    cornerRadius={14}
                    listening={false}
                  />
                  <Rect
                    x={-12}
                    y={-12}
                    width={selectedBounds.maxX - selectedBounds.minX + 24}
                    height={selectedBounds.maxY - selectedBounds.minY + 24}
                    fill="rgba(0,0,0,0.001)"
                    stroke="rgba(37,99,235,0.75)"
                    strokeWidth={1.2}
                    dash={SELECTION_DASH}
                    cornerRadius={12}
                    listening={true}
                  />
                </>
              )}
            </Group>
          ) : null}
        </Layer>
  );
};

ObjectsLayerImpl.displayName = 'ObjectsLayer';
// Presentational Konva layer: memoized so a CanvasStage re-render (e.g. the highlight
// tick) only rebuilds this layer when its props actually change.
export const ObjectsLayer = memo(ObjectsLayerImpl);
