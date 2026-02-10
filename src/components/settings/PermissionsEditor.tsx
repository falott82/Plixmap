import { useMemo } from 'react';
import { Client } from '../../store/types';
import { Permission } from '../../api/auth';
import { useT } from '../../i18n/useT';

type Access = '' | 'ro' | 'rw';

interface Props {
  clients: Client[];
  accessValue: Record<string, Access>;
  chatValue: Record<string, boolean>;
  onChangeAccess: (next: Record<string, Access>) => void;
  onChangeChat: (next: Record<string, boolean>) => void;
}

const keyOf = (scopeType: Permission['scopeType'], scopeId: string) => `${scopeType}:${scopeId}`;

const PermissionsEditor = ({ clients, accessValue, chatValue, onChangeAccess, onChangeChat }: Props) => {
  const t = useT();
  const { entries, keysByClientId } = useMemo(() => {
    const out: { key: string; scopeType: Permission['scopeType']; scopeId: string; label: string; depth: number }[] = [];
    const keyMap: Record<string, string[]> = {};
    for (const c of clients) {
      const clientKeys: string[] = [];
      const clientKey = keyOf('client', c.id);
      clientKeys.push(clientKey);
      out.push({ key: clientKey, scopeType: 'client', scopeId: c.id, label: c.name, depth: 0 });
      for (const s of c.sites || []) {
        const siteKey = keyOf('site', s.id);
        clientKeys.push(siteKey);
        out.push({ key: siteKey, scopeType: 'site', scopeId: s.id, label: s.name, depth: 1 });
        for (const p of s.floorPlans || []) {
          const planKey = keyOf('plan', p.id);
          clientKeys.push(planKey);
          out.push({ key: planKey, scopeType: 'plan', scopeId: p.id, label: p.name, depth: 2 });
        }
      }
      keyMap[c.id] = clientKeys;
    }
    return { entries: out, keysByClientId: keyMap };
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
              <div className="flex items-center gap-2">
                {e.depth === 0 ? (
                  (() => {
                    const keys = keysByClientId[e.scopeId] || [];
                    const hasAnyAccess = keys.some((k) => (accessValue[k] || '') === 'ro' || (accessValue[k] || '') === 'rw');
                    const enabled = keys.some(
                      (k) => !!chatValue[k] && ((accessValue[k] || '') === 'ro' || (accessValue[k] || '') === 'rw')
                    );
                    return (
                      <label
                        className={`flex items-center gap-2 rounded-lg border px-2 py-1 text-xs font-semibold ${
                          hasAnyAccess
                            ? enabled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-700'
                            : 'border-slate-200 bg-slate-100 text-slate-400'
                        }`}
                        title={t({ it: 'Abilita chat per questo cliente', en: 'Enable chat for this client' })}
                      >
                        <input
                          type="checkbox"
                          checked={enabled}
                          disabled={!hasAnyAccess}
                          onChange={(ev) => {
                            const want = ev.target.checked;
                            const next = { ...(chatValue || {}) };
                            if (want) {
                              for (const k of keys) {
                                const a = accessValue[k] || '';
                                if (a === 'ro' || a === 'rw') next[k] = true;
                              }
                            } else {
                              for (const k of keys) delete next[k];
                            }
                            onChangeChat(next);
                          }}
                        />
                        <span>{t({ it: 'Chat', en: 'Chat' })}</span>
                      </label>
                    );
                  })()
                ) : null}
                <select
                  value={accessValue[e.key] || ''}
                  onChange={(ev) => {
                    const next = { ...(accessValue || {}), [e.key]: ev.target.value as Access };
                    if (!next[e.key]) delete next[e.key];
                    onChangeAccess(next);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                  title={t({ it: 'Permesso', en: 'Permission' })}
                >
                  <option value="">{t({ it: 'Nessuno', en: 'None' })}</option>
                  <option value="ro">{t({ it: 'Sola lettura', en: 'Read-only' })}</option>
                  <option value="rw">{t({ it: 'Lettura+scrittura', en: 'Read/write' })}</option>
                </select>
              </div>
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

export const permissionsMapsToList = (accessValue: Record<string, Access>, chatValue: Record<string, boolean>): Permission[] => {
  const out: Permission[] = [];
  for (const [k, access] of Object.entries(accessValue || {})) {
    const [scopeType, scopeId] = k.split(':');
    if (!scopeType || !scopeId) continue;
    if (access !== 'ro' && access !== 'rw') continue;
    out.push({
      scopeType: scopeType as Permission['scopeType'],
      scopeId,
      access,
      ...(chatValue?.[k] ? { chat: true } : {})
    });
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

export const permissionsListToChatMap = (list: Permission[] | undefined): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const p of list || []) {
    if (p?.chat) out[keyOf(p.scopeType, p.scopeId)] = true;
  }
  return out;
};

export default PermissionsEditor;
