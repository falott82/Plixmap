interface CapacityGaugeProps {
  value: number;
  total: number;
  size?: number;
  className?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const CapacityGauge = ({ value, total, size = 180, className = '' }: CapacityGaugeProps) => {
  const safeValue = Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const safeTotal = Number.isFinite(Number(total)) ? Math.max(0, Number(total)) : 0;
  const ratioRaw = safeTotal > 0 ? safeValue / safeTotal : safeValue > 0 ? 1 : 0;
  const ratio = clamp(ratioRaw, 0, 1);
  const pct = Math.round((safeTotal > 0 ? ratioRaw : 0) * 100);
  const over = safeTotal > 0 && safeValue > safeTotal;
  const color = over ? '#dc2626' : ratioRaw >= 0.85 ? '#d97706' : '#16a34a';
  const compact = size <= 110;

  const vbWidth = 120;
  const vbHeight = 88;
  const radius = 50;
  const cx = 60;
  const cy = 70;
  const angle = Math.PI * (1 - ratio);
  const markerX = cx + radius * Math.cos(angle);
  const markerY = cy - radius * Math.sin(angle);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg viewBox={`0 0 ${vbWidth} ${vbHeight}`} width={size} height={Math.round((size / vbWidth) * vbHeight)} role="img" aria-label="capacity gauge">
        <path d="M10 70 A50 50 0 0 1 110 70" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" pathLength={100} />
        <path
          d="M10 70 A50 50 0 0 1 110 70"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${ratio * 100} 100`}
        />
        <circle cx={markerX} cy={markerY} r="4" fill={color} />
      </svg>
      <div className={`${compact ? '-mt-1' : '-mt-2'} text-center leading-tight`}>
        <div className={`${compact ? 'text-lg' : 'text-xl'} font-black text-ink`}>
          {Math.round(safeValue)}/{Math.round(safeTotal)}
        </div>
        <div className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold ${over ? 'text-rose-700' : 'text-slate-500'}`}>
          {Number.isFinite(pct) ? `${pct}%` : '--'}
        </div>
      </div>
    </div>
  );
};

export default CapacityGauge;
