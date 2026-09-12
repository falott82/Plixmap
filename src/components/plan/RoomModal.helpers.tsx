// Presentational sub-components and the palette constant extracted from
// RoomModal.tsx. Pure (props-only), no state or side effects.

export const COLORS = ['#64748b', '#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0ea5e9', '#14b8a6'];

export const IosSwitch = ({
  label,
  description,
  checked,
  onChange,
  disabled = false
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) => (
  <div
    className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 ${
      disabled ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-white'
    }`}
  >
    <div>
      <div className="text-sm font-semibold text-ink">{label}</div>
      {description ? <div className="mt-0.5 text-xs text-slate-500">{description}</div> : null}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative mt-0.5 h-6 w-11 rounded-full transition ${
        disabled ? 'cursor-not-allowed' : ''
      } ${checked ? 'bg-primary' : 'bg-slate-300'}`}
      title={label}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  </div>
);

export const ColorSwatchPicker = ({ color, onChange }: { color: string; onChange: (next: string) => void }) => (
  <div className="mt-2 flex flex-wrap gap-2">
    {COLORS.map((c) => {
      const active = (color || COLORS[0]).toLowerCase() === c.toLowerCase();
      return (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-8 w-8 rounded-xl border ${active ? 'border-ink ring-2 ring-primary/30' : 'border-slate-200'}`}
          style={{ background: c }}
          title={c}
        />
      );
    })}
  </div>
);
