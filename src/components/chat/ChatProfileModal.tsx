/* eslint-disable @typescript-eslint/no-explicit-any */
import { X } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { capWords, capFirst } from './ClientChatDock.helpers';

// User-profile overlay (avatar, presence, common clients) extracted from ClientChatDock.
export const ChatProfileModal = (props: any) => {
  const { profileUserId, setProfileUserId, setProfileData, profileLoading, profileData, onlineUserIds, openClientChat, t } = props;
  if (!profileUserId) return null;
  return (
                <div
                  className="fixed inset-0 z-[57] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) {
                      window.setTimeout(() => {
                        setProfileUserId(null);
                        setProfileData(null);
                      }, 0);
                    }
                  }}
                >
                  <div
                    className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Profilo utente', en: 'User profile' })}</div>
                      <button
                        className="icon-button"
                        onClick={() => {
                          window.setTimeout(() => {
                            setProfileUserId(null);
                            setProfileData(null);
                          }, 0);
                        }}
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="max-h-[70vh] overflow-auto p-4">
                      {profileLoading ? (
                        <div className="text-sm text-slate-300">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                      ) : profileData ? (
                        <>
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              username={profileData.username}
                              name={capWords(`${profileData.firstName} ${profileData.lastName}`.trim())}
                              src={profileData.avatarUrl}
                              size={54}
                            />
                            <div className="min-w-0">
                              <div className="truncate text-lg font-bold text-slate-50">
                                {(() => {
                                  const n = `${profileData.firstName} ${profileData.lastName}`.trim();
                                  return n ? capWords(n) : capFirst(profileData.username);
                                })()}
                              </div>
                              <div className="truncate text-sm text-slate-300">@{profileData.username}</div>
                              <div className="truncate text-[12px] text-slate-400">
                                {(() => {
                                  const online = !!(onlineUserIds as any)?.[profileData.id];
                                  if (online) return t({ it: 'Online', en: 'Online' });
                                  const ts = (profileData as any).lastOnlineAt ? Number((profileData as any).lastOnlineAt) : null;
                                  if (!ts) return t({ it: 'Mai connesso', en: 'Never connected' });
                                  return `${t({ it: 'Last online', en: 'Last online' })}: ${new Date(ts).toLocaleString()}`;
                                })()}
                              </div>
                              {profileData.email ? (
                                <div className="truncate text-sm text-slate-200">
                                  <span className="text-slate-400">{t({ it: 'Email', en: 'Email' })}: </span>
                                  <a className="underline hover:text-white" href={`mailto:${profileData.email}`}>
                                    {profileData.email}
                                  </a>
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="mb-2 text-xs font-semibold uppercase text-slate-400">
                              {t({ it: 'Clienti in comune', en: 'Clients in common' })}{' '}
                              <span className="ml-1 text-slate-500 tabular-nums">{profileData.clientsCommon.length}</span>
                            </div>
                            {!profileData.clientsCommon.length ? (
                              <div className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-sm text-slate-300">
                                {t({ it: 'Nessun cliente in comune.', en: 'No clients in common.' })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {profileData.clientsCommon.map((c: any) => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    className="rounded-full border border-slate-800 bg-slate-900/20 px-3 py-1 text-[12px] font-semibold text-slate-200 hover:bg-slate-900/40"
                                    onClick={() => {
                                      // Jump to that client's chat if available
                                      window.setTimeout(() => {
                                        setProfileUserId(null);
                                        setProfileData(null);
                                        openClientChat(c.id);
                                      }, 0);
                                    }}
                                    title={t({ it: 'Apri chat cliente', en: 'Open client chat' })}
                                  >
                                    {c.name}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-slate-300">{t({ it: 'Profilo non disponibile.', en: 'Profile not available.' })}</div>
                      )}
                    </div>
                  </div>
                </div>
  );
};
