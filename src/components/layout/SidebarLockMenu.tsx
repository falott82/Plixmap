import { type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { Hourglass, X } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { formatTs, formatMinutes } from './SidebarTree.helpers';

type Translate = (msg: { it: string; en: string }) => string;

// Kept in sync with the dispatcher constants in SidebarTree.tsx.
const UNLOCK_REQUEST_EVENT = 'plixmap_unlock_request';
const FORCE_UNLOCK_EVENT = 'plixmap_force_unlock';

export type SidebarLockMenuProps = {
  lockMenu: any;
  setLockMenu: Dispatch<SetStateAction<any>>;
  lockMenuRef: MutableRefObject<HTMLDivElement | null>;
  user: any;
  isSuperAdmin: boolean;
  t: Translate;
};

/**
 * Floor-plan lock info popover (last action/save, request-unlock and
 * superadmin force-unlock actions). Extracted from SidebarTree.tsx.
 */
export const SidebarLockMenu = ({
  lockMenu,
  setLockMenu,
  lockMenuRef,
  user,
  isSuperAdmin,
  t
}: SidebarLockMenuProps) => {
  if (!lockMenu) return null;
  return (
    <div
      ref={lockMenuRef}
      className="fixed z-50 w-72 rounded-xl border border-slate-200 bg-white p-2 text-sm shadow-card"
      style={{ top: lockMenu.y, left: lockMenu.x }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <span className="font-semibold text-ink">{t({ it: 'Lock planimetria', en: 'Floor plan lock' })}</span>
        <button
          onClick={() => setLockMenu(null)}
          className="text-slate-400 hover:text-ink"
          title={t({ it: 'Chiudi', en: 'Close' })}
        >
          <X size={14} />
        </button>
      </div>
      <div className="px-2 pt-2 text-sm font-semibold text-ink">{lockMenu.planName}</div>
      <div className="px-2 text-xs text-slate-500">{lockMenu.clientName} / {lockMenu.siteName}</div>
      <div className="mt-2 flex items-center gap-2 px-2 text-xs text-slate-600">
        {lockMenu.kind === 'grant' ? (
          <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-amber-700">
            <Hourglass size={14} />
          </span>
        ) : (
          <UserAvatar src={lockMenu.avatarUrl} username={lockMenu.username} size={18} />
        )}
        <span>
          {lockMenu.kind === 'grant'
            ? t({ it: 'Lock concesso a', en: 'Lock granted to' })
            : t({ it: 'Bloccato da', en: 'Locked by' })}
          : {lockMenu.username || 'user'}
        </span>
      </div>

      <div className="mt-3 space-y-1 px-2 text-[11px] text-slate-600">
        <div>
          <span className="font-semibold text-slate-700">{t({ it: 'Ultima azione', en: 'Last action' })}</span>: {formatTs(lockMenu.lastActionAt)}
        </div>
        <div>
          <span className="font-semibold text-slate-700">{t({ it: 'Ultimo salvataggio', en: 'Last save' })}</span>: {formatTs(lockMenu.lastSavedAt)}
        </div>
        <div>
          <span className="font-semibold text-slate-700">{t({ it: 'Revisione', en: 'Revision' })}</span>: {String(lockMenu.lastSavedRev || '').trim() || '—'}
        </div>
        {lockMenu.kind === 'grant' ? (
          <div>
            <span className="font-semibold text-slate-700">{t({ it: 'Valida per', en: 'Valid for' })}</span>: {formatMinutes(lockMenu.minutes)} {t({ it: 'minuti', en: 'minutes' })}
          </div>
        ) : null}
      </div>

      {lockMenu.kind !== 'grant' && lockMenu.userId && lockMenu.userId !== String(user?.id || '') ? (
        <button
          onClick={() => {
            const detail = {
              planId: lockMenu.planId,
              planName: lockMenu.planName,
              clientName: lockMenu.clientName,
              siteName: lockMenu.siteName,
              userId: lockMenu.userId,
              username: lockMenu.username,
              avatarUrl: lockMenu.avatarUrl || ''
            };
            window.dispatchEvent(new CustomEvent(UNLOCK_REQUEST_EVENT, { detail }));
            setLockMenu(null);
          }}
          className="mt-3 flex w-full items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
          title={t({ it: 'Chiedi unlock', en: 'Request unlock' })}
        >
          {t({ it: 'Chiedi unlock', en: 'Request unlock' })}
        </button>
      ) : null}
      {isSuperAdmin && lockMenu.kind !== 'grant' && lockMenu.userId && lockMenu.userId !== String(user?.id || '') ? (
        <button
          onClick={() => {
            const detail = {
              planId: lockMenu.planId,
              planName: lockMenu.planName,
              clientName: lockMenu.clientName,
              siteName: lockMenu.siteName,
              userId: lockMenu.userId,
              username: lockMenu.username,
              avatarUrl: lockMenu.avatarUrl || ''
            };
            window.dispatchEvent(new CustomEvent(FORCE_UNLOCK_EVENT, { detail }));
            setLockMenu(null);
          }}
          className="mt-2 flex w-full items-center justify-center rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
          title={t({ it: 'Force unlock (Superadmin)', en: 'Force unlock (Superadmin)' })}
        >
          {t({ it: 'Force unlock', en: 'Force unlock' })}
        </button>
      ) : null}
    </div>
  );
};
