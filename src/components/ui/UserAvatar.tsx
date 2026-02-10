import { useMemo } from 'react';

type Props = {
  src?: string | null;
  name?: string | null;
  username?: string | null;
  size?: number; // px
  className?: string;
};

const initialsOf = (name?: string | null, username?: string | null) => {
  const base = String(name || '').trim() || String(username || '').trim();
  if (!base) return '?';
  const parts = base.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || '';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] || '' : '';
  const out = `${a}${b}`.toUpperCase();
  return out || base.slice(0, 1).toUpperCase();
};

const UserAvatar = ({ src, name, username, size = 24, className = '' }: Props) => {
  const initials = useMemo(() => initialsOf(name, username), [name, username]);
  const s = Math.max(14, Math.min(64, Number(size) || 24));
  const hasImg = !!src && typeof src === 'string';

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100 ${className}`}
      style={{ width: s, height: s }}
      title={String(name || username || '').trim() || undefined}
    >
      {hasImg ? (
        <img src={String(src)} alt="" className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] font-extrabold text-slate-600">
          {initials}
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
