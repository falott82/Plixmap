import { useMemo } from 'react';

interface Point {
  x: number;
  y: number;
}

interface SegmentLabel {
  label: string;
  lengthLabel?: string | null;
}

interface Props {
  points: Point[];
  segments?: SegmentLabel[];
  width?: number;
  height?: number;
  className?: string;
}

const formatCornerLabel = (index: number) => {
  if (index < 0) return '';
  let n = index;
  let label = '';
  while (n >= 0) {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

const RoomShapePreview = ({ points, segments, width = 320, height = 200, className }: Props) => {
  const preview = useMemo(() => {
    if (!points?.length) return null;
    const cleaned =
      points.length >= 3 && points[0].x === points[points.length - 1].x && points[0].y === points[points.length - 1].y
        ? points.slice(0, -1)
        : points;
    if (cleaned.length < 2) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of cleaned) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const pad = 16;
    const scale = Math.min((width - pad * 2) / w, (height - pad * 2) / h);
    const mapPoint = (p: Point) => ({
      x: (p.x - minX) * scale + pad,
      y: (p.y - minY) * scale + pad
    });
    const scaled = cleaned.map(mapPoint);
    const path = scaled.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
    const fallbackSegments: SegmentLabel[] = scaled.map((_, idx) => ({
      label: `${formatCornerLabel(idx)}-${formatCornerLabel((idx + 1) % scaled.length)}`
    }));
    return {
      scaled,
      path,
      segments: segments?.length ? segments : fallbackSegments
    };
  }, [points, segments, width, height]);

  if (!preview) return null;
  const labelFont = 10;
  const lengthFont = 9;
  return (
    <div className={className}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
        <path d={preview.path} fill="rgba(59,130,246,0.08)" stroke="#2563eb" strokeWidth="1.2" />
        {preview.scaled.map((p, idx) => (
          <g key={`corner-${idx}`}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#2563eb" />
            <text x={p.x + 6} y={p.y - 6} fontSize={10} fontWeight="700" fill="#1e293b">
              {formatCornerLabel(idx)}
            </text>
          </g>
        ))}
        {preview.segments.map((seg, idx) => {
          const start = preview.scaled[idx];
          const end = preview.scaled[(idx + 1) % preview.scaled.length];
          if (!start || !end) return null;
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          return (
            <text
              key={`seg-${idx}`}
              x={midX}
              y={midY}
              textAnchor="middle"
              fontSize={labelFont}
              fontWeight="600"
              fill="#0f172a"
            >
              <tspan x={midX} dy="-2">
                {seg.label}
              </tspan>
              {seg.lengthLabel ? (
                <tspan x={midX} dy={lengthFont}>
                  {seg.lengthLabel}
                </tspan>
              ) : null}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

export default RoomShapePreview;
