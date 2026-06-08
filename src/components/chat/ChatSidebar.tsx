/* eslint-disable @typescript-eslint/no-explicit-any */
import { Rows3, ChevronDown } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { dmThreadIdForUsers } from './ClientChatDock.helpers';

// Left sidebar (group/client + DM-user lists with search) extracted from ClientChatDock.
export const ChatSidebar = (props: any) => {
  const {
    clientChatDividerLeftWidth,
    leftSearchQ,
    setLeftSearchQ,
    headerIconBtn,
    leftCompact,
    setLeftCompact,
    setLeftGroupsCollapsed,
    showLeftGroups,
    filteredChatClients,
    clientChatClientId,
    chatUnreadByClientId,
    setMediaModal,
    setMessageInfoId,
    setReplyToId,
    openClientChat,
    setLeftUsersCollapsed,
    showLeftUsers,
    dmContactsLoading,
    filteredDmContacts,
    user,
    onlineUserIds,
    t
  } = props;
  return (
                        <div
                          className="flex shrink-0 flex-col border-r border-slate-800 bg-slate-950/40"
                          style={{ width: clientChatDividerLeftWidth }}
                        >
                          <div className="border-b border-slate-800 bg-slate-900/70 p-2">
                            <div className="flex items-center gap-2">
                              <input
                                value={leftSearchQ}
                                onChange={(e) => setLeftSearchQ(e.target.value)}
                                placeholder={t({ it: 'Cerca gruppi o utenti…', en: 'Search groups or users…' })}
                                className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-primary/30 focus:ring-2"
                              />
                              <button
                                type="button"
                                className={`${headerIconBtn} h-10 w-10 rounded-xl ${leftCompact ? 'bg-slate-800 text-slate-50' : ''}`}
                                onClick={() => setLeftCompact((v: any) => !v)}
                                title={t({ it: leftCompact ? 'Vista normale' : 'Vista compatta', en: leftCompact ? 'Normal view' : 'Compact view' })}
                              >
                                <Rows3 size={16} />
                              </button>
                            </div>
                          </div>
                          <div className="min-h-0 flex-1 overflow-auto p-2">
                            <button
                              type="button"
                              className="flex w-full items-center justify-between gap-2 px-2 pb-1 text-[11px] font-semibold uppercase text-slate-400 hover:text-slate-200"
                              onClick={() => setLeftGroupsCollapsed((v: any) => !v)}
                              title={t({ it: 'Mostra/nascondi gruppi', en: 'Show/hide groups' })}
                            >
                              <span>{t({ it: 'Gruppi', en: 'Groups' })}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">{String(filteredChatClients.length)}</span>
                                <ChevronDown size={14} className={`transition-transform ${showLeftGroups ? '' : '-rotate-90'}`} />
                              </span>
                            </button>
                            {showLeftGroups ? (
                              <div className="space-y-1">
                                {(filteredChatClients || []).map((c: any) => {
                                  const active = c.id === clientChatClientId;
                                  const unread = Number((chatUnreadByClientId as any)?.[c.id] || 0);
                                  const logo = String((c as any)?.logoUrl || '').trim();
                                  const initial = (String(c.name || '').trim()?.[0] || '?').toUpperCase();
                                  return (
                                    <button
                                      key={c.id}
                                      className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2 text-left hover:bg-slate-900 ${
                                        leftCompact ? 'py-1.5' : 'py-2'
                                      } ${active ? 'border-slate-600 bg-slate-900/60' : 'border-transparent'}`}
                                      onClick={() => {
                                        setMediaModal(null);
                                        setMessageInfoId(null);
                                        setReplyToId(null);
                                        openClientChat(c.id);
                                      }}
                                      title={c.name}
                                    >
                                      <span className="flex min-w-0 items-center gap-2">
                                        <span
                                          className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950/60 ${
                                            leftCompact ? 'h-8 w-8' : 'h-9 w-9'
                                          }`}
                                        >
                                          {logo ? (
                                            <img src={logo} alt="" className="h-full w-full object-cover" draggable={false} />
                                          ) : (
                                            <span className="text-[13px] font-extrabold text-slate-200">{initial}</span>
                                          )}
                                        </span>
                                        <span className="min-w-0">
                                          <div className={`truncate font-semibold text-slate-100 ${leftCompact ? 'text-[13px]' : 'text-sm'}`}>{c.name}</div>
                                          {!leftCompact ? (
                                            <div className="truncate text-[11px] text-slate-400">{t({ it: 'Chat cliente', en: 'Customer chat' })}</div>
                                          ) : null}
                                        </span>
                                      </span>
                                      {unread > 0 ? (
                                        <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                          {unread > 99 ? '99+' : String(unread)}
                                        </span>
                                      ) : null}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}

                            <button
                              type="button"
                              className="mt-4 flex w-full items-center justify-between gap-2 px-2 pb-1 text-[11px] font-semibold uppercase text-slate-400 hover:text-slate-200"
                              onClick={() => setLeftUsersCollapsed((v: any) => !v)}
                              title={t({ it: 'Mostra/nascondi utenti', en: 'Show/hide users' })}
                            >
                              <span>{t({ it: 'Utenti', en: 'Users' })}</span>
                              <span className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">{String(filteredDmContacts.length)}</span>
                                <ChevronDown size={14} className={`transition-transform ${showLeftUsers ? '' : '-rotate-90'}`} />
                              </span>
                            </button>
                            {dmContactsLoading ? (
                              <div className="px-2 py-2 text-xs text-slate-400">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                            ) : null}
                            {showLeftUsers ? <div className="space-y-1">
                              {(filteredDmContacts || []).map((u: any) => {
                                if (!user?.id) return null;
                                const threadId = dmThreadIdForUsers(user.id, u.id);
                                const active = threadId && threadId === clientChatClientId;
                                const unread = threadId ? Number((chatUnreadByClientId as any)?.[threadId] || 0) : 0;
                                const displayName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
                                const status = u.lastOnlineAt ? 'offline' : 'never';
                                const online = !!(onlineUserIds as any)?.[u.id] || !!u.online;
                                const dot = u.readOnly ? 'bg-slate-500' : online ? 'bg-emerald-500' : u.lastOnlineAt ? 'bg-rose-500' : 'bg-slate-500';
                                const common = (u.commonClients || []).slice(0, 3).map((c: any) => c.name).join(', ');
                                return (
                                  <button
                                    key={u.id}
                                    className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2 text-left hover:bg-slate-900 ${
                                      leftCompact ? 'py-1.5' : 'py-2'
                                    } ${active ? 'border-slate-600 bg-slate-900/60' : 'border-transparent'}`}
                                    onClick={() => {
                                      setMediaModal(null);
                                      setMessageInfoId(null);
                                      setReplyToId(null);
                                      if (threadId) openClientChat(threadId);
                                    }}
                                    title={displayName}
                                  >
                                    <span className="flex min-w-0 items-center gap-2">
                                      <span className="relative">
                                        <UserAvatar
                                          username={u.username}
                                          src={u.avatarUrl}
                                          size={leftCompact ? 32 : 36}
                                          className="border-slate-800 bg-slate-900"
                                        />
                                        {!u.readOnly && !u.blockedMe ? (
                                          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border border-slate-950 ${dot}`} />
                                        ) : null}
                                      </span>
                                      <span className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <div className={`truncate font-semibold text-slate-100 ${leftCompact ? 'text-[13px]' : 'text-sm'}`}>{displayName}</div>
                                          {u.blockedByMe ? (
                                            <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">
                                              {t({ it: 'Bloccato', en: 'Blocked' })}
                                            </span>
                                          ) : null}
                                          {u.readOnly ? (
                                            <span className="rounded-full border border-slate-600 bg-slate-800/50 px-2 py-0.5 text-[10px] font-bold text-slate-200">
                                              {t({ it: 'Sola lettura', en: 'Read-only' })}
                                            </span>
                                          ) : null}
                                        </div>
                                        {!leftCompact ? (
                                          <>
                                            <div className="truncate text-[11px] text-slate-400">
                                              {u.readOnly || u.blockedMe ? (
                                                t({ it: 'Gruppi in comune non disponibili', en: 'Common groups not available' })
                                              ) : common ? (
                                                t({ it: `In comune: ${common}`, en: `Common: ${common}` })
                                              ) : (
                                                t({ it: 'Nessun gruppo in comune', en: 'No common groups' })
                                              )}
                                            </div>
                                            <div className="truncate text-[11px] text-slate-500">
                                              {u.readOnly || u.blockedMe
                                                ? ''
                                                : online
                                                  ? t({ it: 'Online', en: 'Online' })
                                                  : status === 'never'
                                                    ? t({ it: 'Mai connesso', en: 'Never connected' })
                                                    : u.lastOnlineAt
                                                      ? `${t({ it: 'Last online', en: 'Last online' })}: ${new Date(u.lastOnlineAt).toLocaleString()}`
                                                      : ''}
                                            </div>
                                          </>
                                        ) : (
                                          <div className="truncate text-[11px] text-slate-500">
                                            {u.readOnly || u.blockedMe
                                              ? ''
                                              : online
                                                ? t({ it: 'Online', en: 'Online' })
                                                : status === 'never'
                                                  ? t({ it: 'Mai connesso', en: 'Never connected' })
                                                  : u.lastOnlineAt
                                                    ? `${t({ it: 'Last online', en: 'Last online' })}: ${new Date(u.lastOnlineAt).toLocaleString()}`
                                                    : ''}
                                          </div>
                                        )}
                                      </span>
                                    </span>
                                    {unread > 0 ? (
                                      <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white">
                                        {unread > 99 ? '99+' : String(unread)}
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div> : null}
                          </div>
                        </div>
  );
};
