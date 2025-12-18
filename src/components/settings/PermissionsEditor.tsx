import { useMemo } from 'react';
import { Client } from '../../store/types';
import { Permission } from '../../api/auth';
import { useT } from '../../i18n/useT';

type Access = '' | 'ro' | 'rw';

interface Props {
  clients: Client[];
  value: Record<string, Access>;
  onChange: (next: Record<string, Access>) => void;
}

const keyOf = (scopeType: Permission['scopeType'], scopeId: string) => `${scopeType}:${scopeId}`;

const PermissionsEditor = ({ clients, value, onChange }: Props) => {
  const t = useT();
  const entries = useMemo(() => {
    const out: { key: string; scopeType: Permission['scopeType']; scopeId: string; label: string; depth: number }[] = [];
    for (const c of clients) {
      out.push({ key: keyOf('client', c.id), scopeType: 'client', scopeId: c.id, label: c.name, depth: 0 });
      for (const s of c.sites || []) {
        out.push({ key: keyOf('site', s.id), scopeType: 'site', scopeId: s.id, label: s.name, depth: 1 });
        for (const p of s.floorPlans || []) {
          out.push({ key: keyOf('plan', p.id), scopeType: 'plan', scopeId: p.id, label: p.name, depth: 2 });
        }
      }
    }
    return out;
  }, [clients]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{t({ it: 'Permessi', en: 'Permissions' })}</div>
      <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-slate-100">
        {entries.length ? (
          entries.map((e) => (
            <div
              key={e.key}
              className={`flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 ${
                e.depth === 0 ? 'bg-slate-50 font-semibold' : ''
              }`}
              style={{ paddingLeft: 12 + e.depth * 16 }}
            >
              <div className="min-w-0 truncate">{e.label}</div>
              <select
                value={value[e.key] || ''}
                onChange={(ev) => {
                  const next = { ...value, [e.key]: ev.target.value as Access };
                  if (!next[e.key]) delete next[e.key];
                  onChange(next);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                title={t({ it: 'Permesso', en: 'Permission' })}
              >
                <option value="">{t({ it: 'Nessuno', en: 'None' })}</option>
                <option value="ro">{t({ it: 'Sola lettura', en: 'Read-only' })}</option>
                <option value="rw">{t({ it: 'Lettura+scrittura', en: 'Read/write' })}</option>
              </select>
            </div>
          ))
        ) : (
          <div className="px-3 py-3 text-sm text-slate-600">
            {t({ it: 'Nessun cliente disponibile.', en: 'No clients available.' })}
          </div>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {t({
          it: 'Nota: il permesso più specifico vince (planimetria > sede > cliente).',
          en: 'Note: the most specific permission wins (floor plan > site > client).'
        })}
      </div>
    </div>
  );
};

export const permissionsMapToList = (value: Record<string, Access>): Permission[] => {
  const out: Permission[] = [];
  for (const [k, access] of Object.entries(value)) {
    const [scopeType, scopeId] = k.split(':');
    if (!scopeType || !scopeId) continue;
    if (access !== 'ro' && access !== 'rw') continue;
    out.push({ scopeType: scopeType as Permission['scopeType'], scopeId, access });
  }
  return out;
};

export const permissionsListToMap = (list: Permission[] | undefined): Record<string, Access> => {
  const out: Record<string, Access> = {};
  for (const p of list || []) {
    out[keyOf(p.scopeType, p.scopeId)] = p.access;
  }
  return out;
};

export default PermissionsEditor;
