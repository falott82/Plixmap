import { Arrow, Circle, Group, Image as KonvaImage, Line, Rect, Text, Wedge } from 'react-konva';
import { clamp } from '../../../utils/geometry';
import { type ObjectsLayerProps } from './ObjectsLayer.helpers';

type ObjectsLayerOverlaysProps = Pick<
  ObjectsLayerProps,
  | 'scaleLine' | 'scaleDraft' | 'wallDraft' | 'measureDraft' | 'quoteDraft' | 'pendingType' | 'pendingPreview'
  | 'textDraftRect' | 'readOnly' | 'toolMode' | 'iconImages' | 'metersPerPixel'
  | 'estimateTextWidth' | 'formatMeasure' | 'polygonCentroid'
  | 'onScaleMove' | 'onScaleContextMenu' | 'onScaleDoubleClick' | 't'
>;

/**
 * Canvas overlay layer: scale line, wall/measure/quote drafts, text-draft rect
 * and pending-object placement preview. Extracted from ObjectsLayer.tsx.
 */
export const ObjectsLayerOverlays = (props: ObjectsLayerOverlaysProps) => {
  const {
    scaleLine,
    scaleDraft,
    wallDraft,
    measureDraft,
    quoteDraft,
    pendingType,
    pendingPreview,
    textDraftRect,
    readOnly,
    toolMode,
    iconImages,
    metersPerPixel,
    estimateTextWidth,
    formatMeasure,
    polygonCentroid,
    onScaleMove,
    onScaleContextMenu,
    onScaleDoubleClick,
    t
  } = props;
  return (scaleLine || scaleDraft || wallDraft || measureDraft || quoteDraft || (pendingType && pendingPreview)) ? (
            <>
              {scaleLine ? (() => {
                const scaleOpacity = clamp(Number(scaleLine.opacity ?? 1) || 1, 0.2, 1);
                const scaleLabelScale = clamp(Number(scaleLine.labelScale ?? 1) || 1, 0.6, 1.6);
                const rawLineWidth = Number(scaleLine.strokeWidth ?? 1.2);
                const lineWidth = clamp(Number.isFinite(rawLineWidth) ? rawLineWidth : 1.2, 0.6, 6);
                const dotRadius = Math.max(2, lineWidth + 1);
                const labelFontSize = Math.max(8, Math.round(9 * scaleLabelScale));
                const labelPadding = Math.max(6, Math.round(8 * scaleLabelScale));
                const labelHeight = Math.max(12, Math.round(12 * scaleLabelScale));
                return (
                  <Group
                    draggable={!readOnly && !toolMode && !!onScaleMove}
                    onDragStart={(e) => {
                      if (!onScaleMove || readOnly || toolMode) return;
                      e.cancelBubble = true;
                    }}
                    onDragEnd={(e) => {
                      if (!onScaleMove || !scaleLine || readOnly) return;
                      const node = e.target;
                      const dx = node.x();
                      const dy = node.y();
                      node.position({ x: 0, y: 0 });
                      node.getLayer()?.batchDraw?.();
                      if (!dx && !dy) return;
                      onScaleMove({
                        start: { x: scaleLine.start.x + dx, y: scaleLine.start.y + dy },
                        end: { x: scaleLine.end.x + dx, y: scaleLine.end.y + dy }
                      });
                    }}
                    onContextMenu={(e) => {
                      if (!onScaleContextMenu) return;
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      onScaleContextMenu({ clientX: e.evt.clientX, clientY: e.evt.clientY });
                    }}
                    onDblClick={(e) => {
                      if (!onScaleDoubleClick) return;
                      e.evt.preventDefault();
                      e.cancelBubble = true;
                      onScaleDoubleClick();
                    }}
                  >
                    <Line
                      points={[scaleLine.start.x, scaleLine.start.y, scaleLine.end.x, scaleLine.end.y]}
                      stroke="#0f172a"
                      strokeWidth={lineWidth}
                      dash={[6, 4]}
                      lineCap="round"
                      lineJoin="round"
                      opacity={scaleOpacity}
                    />
                    <Circle x={scaleLine.start.x} y={scaleLine.start.y} radius={dotRadius} fill="#0f172a" opacity={scaleOpacity} />
                    <Circle x={scaleLine.end.x} y={scaleLine.end.y} radius={dotRadius} fill="#0f172a" opacity={scaleOpacity} />
                    {scaleLine.label ? (() => {
                      const midX = (scaleLine.start.x + scaleLine.end.x) / 2;
                      const midY = (scaleLine.start.y + scaleLine.end.y) / 2;
                      const textW = estimateTextWidth(scaleLine.label, labelFontSize) + labelPadding;
                      return (
                        <Group
                          x={midX - textW / 2}
                          y={midY - labelHeight - 4}
                          opacity={scaleOpacity}
                          onContextMenu={(e) => {
                            if (!onScaleContextMenu) return;
                            e.evt.preventDefault();
                            e.cancelBubble = true;
                            onScaleContextMenu({ clientX: e.evt.clientX, clientY: e.evt.clientY });
                          }}
                        >
                          <Rect width={textW} height={labelHeight} fill="rgba(15,23,42,0.85)" cornerRadius={4} />
                          <Text
                            text={scaleLine.label}
                            width={textW}
                            height={labelHeight}
                            align="center"
                            verticalAlign="middle"
                            fontSize={labelFontSize}
                            fill="#f8fafc"
                          />
                        </Group>
                      );
                    })() : null}
                  </Group>
                );
              })() : null}
              <Group listening={false}>
              {scaleDraft?.start && (scaleDraft.end || scaleDraft.pointer) ? (
                <>
                  <Line
                    points={[
                      scaleDraft.start.x,
                      scaleDraft.start.y,
                      (scaleDraft.end || scaleDraft.pointer)!.x,
                      (scaleDraft.end || scaleDraft.pointer)!.y
                    ]}
                    stroke="#0ea5e9"
                    strokeWidth={1.5}
                    dash={[6, 4]}
                    lineCap="round"
                    lineJoin="round"
                  />
                  <Circle x={scaleDraft.start.x} y={scaleDraft.start.y} radius={3} fill="#0ea5e9" opacity={0.85} />
                  {scaleDraft.end ? <Circle x={scaleDraft.end.x} y={scaleDraft.end.y} radius={3} fill="#0ea5e9" opacity={0.85} /> : null}
                </>
              ) : null}

              {wallDraft?.points?.length ? (
                <>
                  <Line
                    points={[
                      ...wallDraft.points.flatMap((p) => [p.x, p.y]),
                      ...(wallDraft.pointer ? [wallDraft.pointer.x, wallDraft.pointer.y] : [])
                    ]}
                    stroke="#475569"
                    strokeWidth={2}
                    dash={[6, 4]}
                    lineCap="round"
                    lineJoin="round"
                  />
                  {wallDraft.points.map((p, idx) => (
                    <Circle key={`wall-draft-${idx}`} x={p.x} y={p.y} radius={3} fill="#475569" opacity={0.9} />
                  ))}
                  {wallDraft.pointer ? (
                    <Circle
                      x={wallDraft.pointer.x}
                      y={wallDraft.pointer.y}
                      radius={4}
                      fill="#0ea5e9"
                      opacity={0.95}
                    />
                  ) : null}
                  {metersPerPixel && wallDraft.pointer ? (() => {
                    const start = wallDraft.points[wallDraft.points.length - 1];
                    if (!start) return null;
                    const end = wallDraft.pointer;
                    const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
                    const meters = lengthPx * metersPerPixel;
                    const unit = t({ it: 'ml', en: 'm' });
                    const label = `${formatMeasure(meters)} ${unit}`;
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;
                    const textW = estimateTextWidth(label, 10) + 10;
                    return (
                      <Group x={midX - textW / 2} y={midY - 18}>
                        <Rect width={textW} height={16} fill="rgba(15,23,42,0.85)" cornerRadius={5} />
                        <Text
                          text={label}
                          width={textW}
                          height={16}
                          align="center"
                          verticalAlign="middle"
                          fontSize={10}
                          fill="#f8fafc"
                        />
                      </Group>
                    );
                  })() : null}
                </>
              ) : wallDraft?.pointer ? (
                <Circle x={wallDraft.pointer.x} y={wallDraft.pointer.y} radius={4} fill="#0ea5e9" opacity={0.95} />
              ) : null}

              {measureDraft?.points?.length ? (
                <>
                  <Line
                    points={[
                      ...measureDraft.points.flatMap((p) => [p.x, p.y]),
                      ...(measureDraft.pointer ? [measureDraft.pointer.x, measureDraft.pointer.y] : [])
                    ]}
                    stroke="#f97316"
                    strokeWidth={2}
                    lineCap="round"
                    lineJoin="round"
                    closed={!!measureDraft.closed}
                    fill={measureDraft.closed ? 'rgba(249,115,22,0.12)' : undefined}
                  />
                  {measureDraft.label ? (() => {
                    const anchor = measureDraft.pointer || measureDraft.points[measureDraft.points.length - 1];
                    const textW = estimateTextWidth(measureDraft.label, 12) + 12;
                    return (
                      <Group x={anchor.x + 8} y={anchor.y - 20}>
                        <Rect width={textW} height={18} fill="rgba(15,23,42,0.85)" cornerRadius={6} />
                        <Text
                          text={measureDraft.label}
                          width={textW}
                          height={18}
                          align="center"
                          verticalAlign="middle"
                          fontSize={12}
                          fill="#f8fafc"
                        />
                      </Group>
                    );
                  })() : null}
                  {measureDraft.areaLabel && measureDraft.closed && measureDraft.points.length >= 3 ? (() => {
                    const centroid = polygonCentroid(measureDraft.points);
                    const textW = estimateTextWidth(measureDraft.areaLabel, 12) + 12;
                    return (
                      <Group x={centroid.x - textW / 2} y={centroid.y - 10}>
                        <Rect width={textW} height={18} fill="rgba(15,23,42,0.85)" cornerRadius={6} />
                        <Text
                          text={measureDraft.areaLabel}
                          width={textW}
                          height={18}
                          align="center"
                          verticalAlign="middle"
                          fontSize={12}
                          fill="#f8fafc"
                        />
                      </Group>
                    );
                  })() : null}
                </>
              ) : null}
              {quoteDraft?.points?.length ? (() => {
                const pts = quoteDraft.pointer ? [...quoteDraft.points, quoteDraft.pointer] : quoteDraft.points;
                if (pts.length < 2) return null;
                const start = pts[0];
                const end = pts[1];
                const label = quoteDraft.label;
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                const textW = label ? estimateTextWidth(label, 10) + 10 : 0;
                return (
                  <>
                    <Arrow
                      points={[start.x, start.y, end.x, end.y]}
                      stroke="#f97316"
                      fill="#f97316"
                      pointerLength={6}
                      pointerWidth={6}
                      pointerAtBeginning
                      strokeWidth={2}
                      opacity={0.9}
                    />
                    {label ? (
                      <Group x={midX - textW / 2} y={midY - 16}>
                        <Rect width={textW} height={16} fill="rgba(255,255,255,0.9)" cornerRadius={5} />
                        <Text text={label} width={textW} height={16} align="center" fontSize={10} fontStyle="bold" fill="#0f172a" />
                      </Group>
                    ) : null}
                  </>
                );
              })() : null}

              {pendingType && pendingPreview && !(pendingType === 'text' && textDraftRect) ? (
                <Group x={pendingPreview.x} y={pendingPreview.y} opacity={0.7}>
                  {pendingType === 'camera' ? (
                    <Wedge
                      radius={160}
                      angle={70}
                      rotation={-35}
                      fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                      fillRadialGradientStartRadius={0}
                      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                      fillRadialGradientEndRadius={160}
                      fillRadialGradientColorStops={[
                        0,
                        'rgba(34,197,94,0.08)',
                        0.6,
                        'rgba(34,197,94,0.25)',
                        1,
                        'rgba(34,197,94,0.45)'
                      ]}
                    />
                  ) : null}
                  <Rect
                    x={-18}
                    y={-18}
                    width={36}
                    height={36}
                    cornerRadius={12}
                    fill="#ffffff"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    shadowBlur={0}
                    shadowColor="transparent"
                  />
                  {pendingType ? (
                    pendingType === 'text' ? (
                      <Text
                        text={'T'}
                        x={-18}
                        y={-14}
                        width={36}
                        align="center"
                        fontSize={15}
                        fontStyle="bold"
                        fill={'#2563eb'}
                        opacity={0.9}
                      />
                    ) : pendingType === 'image' ? (
                      <Text
                        text={'IMG'}
                        x={-18}
                        y={-8}
                        width={36}
                        align="center"
                        fontSize={10}
                        fontStyle="bold"
                        fill={'#2563eb'}
                        opacity={0.9}
                      />
                    ) : iconImages[pendingType] ? (
                      <KonvaImage
                        image={iconImages[pendingType] as HTMLImageElement}
                        x={-9}
                        y={-9}
                        width={18}
                        height={18}
                        opacity={0.9}
                      />
                    ) : (
                      <Text
                        text={'?'}
                        x={-18}
                        y={-14}
                        width={36}
                        align="center"
                        fontSize={15}
                        fontStyle="bold"
                        fill={'#2563eb'}
                        opacity={0.9}
                      />
                    )
                  ) : null}
                </Group>
              ) : null}
              </Group>
            </>
          ) : null;
};
