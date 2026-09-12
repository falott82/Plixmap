/* eslint-disable @typescript-eslint/no-explicit-any */
import { Rect, Text } from 'react-konva';
import { clamp } from '../../../utils/geometry';

// Room/corridor label renderer (konva nodes) extracted from CanvasStage.
export const renderRoomLabels = (
  options: {
  bounds: { x: number; y: number; width: number; height: number };
  name: string;
  showName: boolean;
  capacityText?: string | null;
  overCapacity?: boolean;
  labelScale?: number;
  labelPosition?: 'top' | 'bottom' | 'left' | 'right';
  },
  estimateTextWidth: (text: string, fontSize: number) => number
) => {
  const { bounds, name, showName, capacityText, overCapacity, labelScale, labelPosition } = options;
  if (!bounds.width || !bounds.height) return null;
  const minDim = Math.max(8, Math.min(bounds.width, bounds.height));
  const padding = Math.max(2, Math.min(4, Math.round(minDim / 12)));
  const baseNameSize = Math.max(7, Math.min(12, Math.round(minDim / 7)));
  const baseCapacitySize = Math.max(6, Math.min(10, Math.round(minDim / 9)));
  const scale = Number(labelScale) > 0 ? Number(labelScale) : 1;
  const nameFontSize = Math.max(4, Math.round(baseNameSize * scale));
  const capacityFontSize = Math.max(4, Math.round(baseCapacitySize * scale));
  const nameVisible = showName && !!name;
  const capacityVisible = !!capacityText;
  if (!nameVisible && !capacityVisible) return null;
  const isVertical = labelPosition === 'left' || labelPosition === 'right';
  if (isVertical) {
    const verticalParts: string[] = [];
    if (nameVisible) verticalParts.push(String(name || '').trim());
    if (capacityVisible) verticalParts.push(String(capacityText || '').trim());
    const verticalText = verticalParts.filter(Boolean).join(' · ');
    if (!verticalText) return null;
    const fontSize = Math.max(nameFontSize, capacityFontSize);
    const labelPad = Math.max(1, Math.min(8, Math.round(fontSize * 0.16)));
    const boxWidth = Math.max(12, Math.round(fontSize + labelPad * 2 + 1));
    const maxLabelHeight = Math.max(24, bounds.height - padding * 2);
    const preferredHeight = Math.round(estimateTextWidth(verticalText, fontSize) + labelPad * 2 + 1);
    const boxHeight = Math.max(24, Math.min(maxLabelHeight, preferredHeight));
    const labelX =
      labelPosition === 'left'
        ? bounds.x + padding
        : bounds.x + Math.max(padding, bounds.width - boxWidth - padding);
    const labelY = clamp(
      bounds.y + (bounds.height - boxHeight) / 2,
      bounds.y + padding,
      bounds.y + Math.max(padding, bounds.height - boxHeight - padding)
    );
    const textWidth = Math.max(10, boxHeight - labelPad * 2);
    return (
      <>
        <Rect
          x={labelX}
          y={labelY}
          width={boxWidth}
          height={boxHeight}
          fill="rgba(255,255,255,0.85)"
          stroke="rgba(148,163,184,0.6)"
          strokeWidth={0.9}
          cornerRadius={3}
          listening={false}
        />
        <Text
          x={labelX + boxWidth / 2}
          y={labelY + boxHeight / 2}
          width={textWidth}
          offsetX={textWidth / 2}
          offsetY={fontSize / 2}
          rotation={labelPosition === 'left' ? -90 : 90}
          text={verticalText}
          align="center"
          fontSize={fontSize}
          fontStyle="bold"
          fill={overCapacity ? '#dc2626' : '#0f172a'}
          wrap="none"
          ellipsis
          lineHeight={1.05}
          listening={false}
        />
      </>
    );
  }
  const maxWidth = Math.max(0, bounds.width - padding * 2);
  const maxHeight = Math.max(0, bounds.height - padding * 2);
  if (!maxWidth || maxWidth <= 0 || !maxHeight || maxHeight <= 0) return null;
  const maxLabelFont = Math.max(nameFontSize, capacityFontSize);
  const innerPadX = Math.max(1, Math.min(10, Math.round(maxLabelFont * 0.18)));
  const innerPadY = Math.max(1, Math.min(8, Math.round(maxLabelFont * 0.14)));
  const capacityWidth = capacityVisible ? estimateTextWidth(capacityText || '', capacityFontSize) + innerPadX * 2 : 0;
  const wrapNameLines = (raw: string, maxLineWidth: number, fontSize: number) => {
    const text = String(raw || '').trim();
    if (!text) return { text: '', lineCount: 0 };
    const avgChar = Math.max(1, fontSize * 0.58);
    const maxChars = Math.max(4, Math.floor(maxLineWidth / avgChar));
    if (text.length <= maxChars) return { text, lineCount: 1 };
    const splitIdx = text.lastIndexOf(' ', maxChars);
    const firstBreak = splitIdx >= Math.floor(maxChars * 0.55) ? splitIdx : maxChars;
    const line1 = text.slice(0, firstBreak).trim() || text.slice(0, maxChars).trim();
    let line2 = text.slice(firstBreak).trim();
    if (line2.length > maxChars) {
      const secondSplit = line2.lastIndexOf(' ', maxChars - 1);
      const cutAt = secondSplit >= Math.floor(maxChars * 0.55) ? secondSplit : maxChars - 1;
      line2 = `${line2.slice(0, cutAt).trim()}...`;
    }
    if (!line2) return { text: line1, lineCount: 1 };
    return { text: `${line1}\n${line2}`, lineCount: 2 };
  };
  const labelWidth = maxWidth;
  const inlineNameWidth = Math.max(24, labelWidth - (capacityVisible ? capacityWidth : 0) - innerPadX * 2);
  const wrappedName = nameVisible ? wrapNameLines(name, inlineNameWidth, nameFontSize) : { text: '', lineCount: 0 };
  let useStacked = false;
  if (nameVisible && capacityVisible) {
    const inlineNameNaturalWidth = estimateTextWidth(name, nameFontSize) + innerPadX * 2;
    useStacked = wrappedName.lineCount > 1 || inlineNameNaturalWidth + capacityWidth > labelWidth;
  }
  if (wrappedName.lineCount > 1) useStacked = true;
  const wrappedNameForStacked =
    nameVisible && useStacked ? wrapNameLines(name, Math.max(24, labelWidth - innerPadX * 2), nameFontSize) : wrappedName;
  const finalNameText = useStacked ? wrappedNameForStacked.text : wrappedName.text;
  const finalNameLineCount = useStacked ? wrappedNameForStacked.lineCount : wrappedName.lineCount;
  const lineGap = Math.max(1, Math.round(maxLabelFont * 0.08));
  const nameBlockHeight = nameVisible ? Math.max(nameFontSize, Math.round(nameFontSize * 1.05 * Math.max(1, finalNameLineCount))) : 0;
  const naturalHeight = useStacked
    ? nameBlockHeight + (capacityVisible ? capacityFontSize + lineGap : 0) + innerPadY * 2
    : Math.max(nameBlockHeight || nameFontSize, capacityFontSize) + innerPadY * 2;
  const labelHeight = Math.max(12, Math.min(maxHeight, naturalHeight));
  if (!labelWidth || labelWidth <= 0) return null;
  const verticalMin = bounds.y + padding;
  const verticalMax = bounds.y + Math.max(padding, bounds.height - labelHeight - padding);
  const centeredY = clamp(bounds.y + (bounds.height - labelHeight) / 2, verticalMin, verticalMax);
  const labelX = bounds.x + (bounds.width - labelWidth) / 2;
  const labelY =
    labelPosition === 'bottom'
      ? bounds.y + Math.max(padding, bounds.height - labelHeight - padding)
      : labelPosition === 'top'
        ? bounds.y + padding
        : centeredY;
  const capacityAlign = nameVisible ? 'right' : 'center';
  const textInnerWidth = Math.max(10, labelWidth - innerPadX * 2);
  return (
    <>
      <Rect
        x={labelX}
        y={labelY}
        width={labelWidth}
        height={labelHeight}
        fill="rgba(255,255,255,0.85)"
        stroke="rgba(148,163,184,0.6)"
        strokeWidth={0.9}
        cornerRadius={3}
        listening={false}
      />
      {useStacked ? (
        <>
          {nameVisible ? (
            <Text
              x={labelX + innerPadX}
              y={labelY + innerPadY}
              width={textInnerWidth}
              text={finalNameText}
              fontSize={nameFontSize}
              fontStyle="bold"
              fill="#0f172a"
              listening={false}
              lineHeight={1.05}
              align="center"
            />
          ) : null}
          {capacityVisible ? (
            <Text
              x={labelX + innerPadX}
              y={labelY + innerPadY + nameBlockHeight + lineGap}
              width={textInnerWidth}
              align="right"
              text={capacityText || ''}
              fontSize={capacityFontSize}
              fontStyle="bold"
              fill={overCapacity ? '#dc2626' : '#334155'}
              listening={false}
            />
          ) : null}
        </>
      ) : (
        <>
          {nameVisible ? (
            <Text
              x={labelX + innerPadX}
              y={labelY + innerPadY}
              width={Math.max(0, labelWidth - innerPadX * 2 - (capacityVisible ? capacityWidth : 0))}
              text={finalNameText}
              fontSize={nameFontSize}
              fontStyle="bold"
              fill="#0f172a"
              listening={false}
              lineHeight={1.05}
            />
          ) : null}
          {capacityVisible ? (
            <Text
              x={labelX + innerPadX}
              y={labelY + innerPadY}
              width={textInnerWidth}
              align={capacityAlign}
              text={capacityText || ''}
              fontSize={capacityFontSize}
              fontStyle="bold"
              fill={overCapacity ? '#dc2626' : '#334155'}
              listening={false}
            />
          ) : null}
        </>
      )}
    </>
  );
};
