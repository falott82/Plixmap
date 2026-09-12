/* eslint-disable @typescript-eslint/no-explicit-any */
import { X, Star } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { capFirst, snippet } from './ClientChatDock.helpers';

// Message-info overlay (sender meta + per-user read receipts) extracted from ClientChatDock.
export const ChatMessageInfoModal = (props: any) => {
  const { messageInfoId, setMessageInfoId, messagesById, messageInfoMembersSorted, messageInfoLoading, onlineUserIds, openUserProfile, t } = props;
  if (!messageInfoId) return null;
  return (
                <div
                  className="fixed inset-0 z-[55] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setMessageInfoId(null), 0);
                  }}
                >
                  <div
                    className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Info messaggio', en: 'Message info' })}</div>
                      <button
                        className="icon-button"
                        onClick={() => window.setTimeout(() => setMessageInfoId(null), 0)}
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="max-h-[70vh] overflow-auto p-3">
                      {(() => {
                        const msg = messagesById.get(messageInfoId);
                        if (!msg) {
                          return <div className="text-sm text-slate-300">{t({ it: 'Messaggio non disponibile.', en: 'Message not available.' })}</div>;
                        }
                        const stars = Array.isArray((msg as any).starredBy) ? ((msg as any).starredBy as any[]).length : 0;
                        return (
                          <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/30 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                              <div className="truncate">
                                {t({ it: 'Da', en: 'From' })}: <span className="font-semibold text-slate-100">{capFirst(msg.username)}</span>
                              </div>
                              <div className="shrink-0">{new Date(msg.createdAt).toLocaleString()}</div>
                            </div>
                            <div className="mt-1 text-sm text-slate-100">
                              {msg.deleted ? (
                                <span className="italic text-slate-400">{t({ it: 'Messaggio eliminato', en: 'Message deleted' })}</span>
                              ) : (
                                snippet(msg.text, 240) || ((msg.attachments || []).length ? t({ it: '[Allegati]', en: '[Attachments]' }) : '')
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                              <div className="flex items-center gap-1">
                                <Star size={13} className={stars ? 'text-amber-300' : 'text-slate-500'} fill={stars ? 'currentColor' : 'none'} />
                                <span>
                                  {t({ it: 'Importanti', en: 'Starred' })}: <span className="font-semibold text-slate-200">{stars}</span>
                                </span>
                              </div>
                              <div>{msg.editedAt && !msg.deleted ? <span className="font-semibold">{t({ it: 'Modificato', en: 'Edited' })}</span> : null}</div>
                            </div>
                          </div>
                        );
                      })()}

                      <div className="flex items-center justify-between px-1 pb-2 text-xs font-semibold uppercase text-slate-400">
                        <span>{t({ it: 'Utenti', en: 'Users' })}</span>
                        <span className="text-slate-500">{messageInfoMembersSorted.length}</span>
                      </div>
                      <div className="space-y-1">
                        {messageInfoLoading ? (
                          <div className="px-2 py-2 text-sm text-slate-400">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                        ) : null}
                        {!messageInfoLoading && !messageInfoMembersSorted.length ? (
                          <div className="px-2 py-2 text-sm text-slate-400">{t({ it: 'Nessun utente.', en: 'No users.' })}</div>
                        ) : null}
                        {!messageInfoLoading
                          ? messageInfoMembersSorted.map((u: any) => {
                              const online = !!(onlineUserIds as any)?.[u.id] || !!u.online;
                              const dot = online ? 'bg-emerald-500' : 'bg-rose-500';
                              const msg = messageInfoId ? messagesById.get(messageInfoId) : null;
                              const lastReadAt = Number((u as any).lastReadAt || 0) || 0;
                              const read = !!msg && (u.id === msg.userId || lastReadAt >= Number(msg.createdAt || 0));
                              const when = lastReadAt ? new Date(lastReadAt).toLocaleString() : '';
                              return (
                                <div key={u.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-2 py-2">
                                  <div className="flex min-w-0 items-center gap-2">
                                    <button
                                      type="button"
                                      className="relative rounded-full focus:outline-none focus-visible:outline-none"
                                      onClick={() => openUserProfile(u.id)}
                                      title={t({ it: 'Profilo utente', en: 'User profile' })}
                                    >
                                      <UserAvatar
                                        username={u.username}
                                        name={`${u.firstName} ${u.lastName}`.trim()}
                                        src={u.avatarUrl}
                                        size={28}
                                        className="border-slate-800 bg-slate-900"
                                      />
                                      <span className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${dot}`} />
                                    </button>
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-slate-100">{capFirst(u.username)}</div>
                                      <div className="truncate text-[11px] text-slate-400">@{u.username}</div>
                                    </div>
                                  </div>
                                  <div className={`text-right text-[11px] font-semibold ${read ? 'text-emerald-300' : 'text-slate-400'}`}>
                                    <div>{read ? t({ it: 'Letto', en: 'Read' }) : t({ it: 'Non letto', en: 'Unread' })}</div>
                                    {read && when ? <div className="font-normal text-slate-400">{when}</div> : null}
                                  </div>
                                </div>
                              );
                            })
                          : null}
                      </div>
                    </div>
                  </div>
                </div>
  );
};
