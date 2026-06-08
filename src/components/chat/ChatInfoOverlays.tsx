/* eslint-disable @typescript-eslint/no-explicit-any */
import { X } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { capWords, capFirst, downloadBlob, safeFilename } from './ClientChatDock.helpers';
import { exportChat } from '../../api/chat';

// "Chat info" overlay (client/DM details + shortcuts) extracted from ClientChatDock.
export const ChatInfoPanel = (props: any) => {
  const { helpOpen, setHelpOpen, activeClientObj, clientLogoUrl, clientInitial, clientName, activeDmContact, onlineUserIds, helpItems, t } = props;
  if (!helpOpen) return null;
  return (
                <div
                  className="fixed inset-0 z-[58] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setHelpOpen(false), 0);
                  }}
                >
                  <div
                    className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Info chat', en: 'Chat info' })}</div>
                      <button
                        className="icon-button"
                        onClick={() => window.setTimeout(() => setHelpOpen(false), 0)}
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-4">
                      {activeClientObj ? (
                        <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-700 bg-slate-950/60">
                              {clientLogoUrl ? (
                                <img src={clientLogoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                              ) : (
                                <span className="text-[16px] font-extrabold text-slate-200">{clientInitial}</span>
                              )}
                            </span>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-slate-50">
                                {String((activeClientObj as any)?.shortName || (activeClientObj as any)?.name || clientName || '').trim() ||
                                  clientName}
                              </div>
                              <div className="truncate text-[12px] text-slate-400">
                                {String((activeClientObj as any)?.address || '').trim()
                                  ? String((activeClientObj as any)?.address || '').trim()
                                  : t({ it: 'Cliente', en: 'Customer' })}
                              </div>
                            </div>
                          </div>
                          {String((activeClientObj as any)?.description || '').trim() ? (
                            <div className="mt-3 text-[12px] text-slate-300">{String((activeClientObj as any)?.description || '').trim()}</div>
                          ) : null}
                          {Array.isArray((activeClientObj as any)?.sites) ? (
                            <div className="mt-3">
                              <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase text-slate-400">
                                <span>{t({ it: 'Sedi', en: 'Sites' })}</span>
                                <span className="tabular-nums">{String(((activeClientObj as any).sites || []).length)}</span>
                              </div>
                              <div className="mt-2 space-y-1">
                                {(((activeClientObj as any).sites || []) as any[]).slice(0, 12).map((s: any) => {
                                  const plans = Array.isArray(s?.floorPlans) ? s.floorPlans.length : 0;
                                  const label = String(s?.name || '').trim() || String(s?.id || '').trim() || t({ it: 'Sede', en: 'Site' });
                                  return (
                                    <div key={String(s?.id || label)} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2">
                                      <div className="min-w-0 truncate text-[12px] font-semibold text-slate-100">{label}</div>
                                      <div className="shrink-0 text-[12px] text-slate-400 tabular-nums">
                                        {t({ it: `${plans} planimetrie`, en: `${plans} floor plans` })}
                                      </div>
                                    </div>
                                  );
                                })}
                                {(((activeClientObj as any).sites || []) as any[]).length > 12 ? (
                                  <div className="pt-1 text-[11px] font-semibold text-slate-500">
                                    {t({ it: 'Altre sedi disponibili…', en: 'More sites available…' })}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : activeDmContact ? (
                        <div className="mb-3 rounded-2xl border border-slate-800 bg-slate-900/20 p-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              username={activeDmContact.username}
                              src={activeDmContact.avatarUrl}
                              size={44}
                              className="border-slate-800 bg-slate-900"
                            />
                            <div className="min-w-0">
                              <div className="truncate text-sm font-extrabold text-slate-50">
                                {(`${activeDmContact.firstName || ''} ${activeDmContact.lastName || ''}`.trim() || activeDmContact.username).trim()}
                              </div>
                              <div className="truncate text-[12px] text-slate-400">@{activeDmContact.username}</div>
                            </div>
                          </div>
                          <div className="mt-3 text-[12px] text-slate-300">
                            {(() => {
                              const online = !!(onlineUserIds as any)?.[activeDmContact.id] || !!activeDmContact.online;
                              if (activeDmContact.readOnly || activeDmContact.blockedMe) return t({ it: 'Stato non disponibile', en: 'Status not available' });
                              if (online) return t({ it: 'Online', en: 'Online' });
                              if (!activeDmContact.lastOnlineAt) return t({ it: 'Mai connesso', en: 'Never connected' });
                              return `${t({ it: 'Last online', en: 'Last online' })}: ${new Date(activeDmContact.lastOnlineAt).toLocaleString()}`;
                            })()}
                          </div>
                          {!activeDmContact.readOnly && !activeDmContact.blockedMe ? (
                            <div className="mt-3">
                              <div className="text-[11px] font-semibold uppercase text-slate-400">{t({ it: 'Gruppi in comune', en: 'Common groups' })}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {(activeDmContact.commonClients || []).slice(0, 8).map((c: any) => (
                                  <span
                                    key={c.id}
                                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950/30 px-3 py-1 text-[12px] font-semibold text-slate-100"
                                    title={c.name}
                                  >
                                    {c.logoUrl ? <img src={c.logoUrl} alt="" className="h-4 w-4 rounded-full object-cover" draggable={false} /> : null}
                                    <span className="max-w-[200px] truncate">{c.name}</span>
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      <ul className="list-disc space-y-2 rounded-2xl border border-slate-800 bg-slate-900/20 px-6 py-4 text-sm text-slate-200">
                        {helpItems.map((it0: any) => (
                          <li key={it0.k}>
                            <span className="font-extrabold text-slate-50">{it0.k}</span>
                            <span className="text-slate-300">: {it0.v}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
  );
};

// Members list overlay extracted from ClientChatDock.
export const ChatMembersPanel = (props: any) => {
  const { membersOpen, setMembersOpen, members, membersLoading, membersSorted, onlineUserIds, openUserProfile, t } = props;
  if (!membersOpen) return null;
  return (
                <div
                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setMembersOpen(false), 0);
                  }}
                >
                  <div
                    className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Membri', en: 'Members' })}</div>
                      <div className="flex items-center gap-2">
                        <div className="text-[12px] font-semibold text-slate-400 tabular-nums">{members.length}</div>
                        <button
                          className="icon-button"
                          onClick={() => window.setTimeout(() => setMembersOpen(false), 0)}
                          title={t({ it: 'Chiudi', en: 'Close' })}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[70vh] overflow-auto p-3">
                      {membersLoading ? (
                        <div className="px-2 py-2 text-sm text-slate-400">{t({ it: 'Caricamento…', en: 'Loading…' })}</div>
                      ) : members.length ? (
                        <div className="space-y-1">
                          {membersSorted.map((m: any) => {
                            const online = !!(onlineUserIds as any)?.[m.id] || !!m.online;
                            const lastOnlineAt = (m as any).lastOnlineAt ? Number((m as any).lastOnlineAt) : null;
                            const dot = online ? 'bg-emerald-500' : lastOnlineAt ? 'bg-rose-500' : 'bg-slate-500';
                            const name = `${String(m.firstName || '').trim()} ${String(m.lastName || '').trim()}`.trim();
                            const label = name ? capWords(name) : capFirst(m.username);
                            return (
                              <div
                                key={m.id}
                                className="flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/20 px-2 py-2 hover:bg-slate-900/30"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  <button
                                    type="button"
                                    className="relative rounded-full focus:outline-none focus-visible:outline-none"
                                    onClick={() => openUserProfile(m.id)}
                                    title={t({ it: 'Profilo utente', en: 'User profile' })}
                                  >
                                    <UserAvatar username={m.username} name={name} src={m.avatarUrl} size={28} className="border-slate-800 bg-slate-900" />
                                    <span className={`absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border border-slate-950 ${dot}`} />
                                  </button>
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-slate-100">{label}</div>
                                    <div className="truncate text-[11px] text-slate-400">@{m.username}</div>
                                    <div className="truncate text-[11px] text-slate-500">
                                      {online
                                        ? t({ it: 'Online', en: 'Online' })
                                        : lastOnlineAt
                                          ? `${t({ it: 'Last online', en: 'Last online' })}: ${new Date(lastOnlineAt).toLocaleString()}`
                                          : t({ it: 'Mai connesso', en: 'Never connected' })}
                                    </div>
                                  </div>
                                </div>
                                <div className={`text-[11px] font-semibold ${online ? 'text-emerald-300' : lastOnlineAt ? 'text-rose-300' : 'text-slate-300'}`}>
                                  {online ? t({ it: 'Online', en: 'Online' }) : lastOnlineAt ? t({ it: 'Offline', en: 'Offline' }) : t({ it: 'Mai', en: 'Never' })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-sm text-slate-300">
                          {t({ it: 'Nessun membro trovato.', en: 'No members found.' })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
  );
};

// Export-chat (TXT/JSON/HTML) overlay extracted from ClientChatDock.
export const ChatExportPanel = (props: any) => {
  const { exportOpen, setExportOpen, doExport, clientChatClientId, clientName, setErr, t } = props;
  if (!exportOpen) return null;
  return (
                <div
                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setExportOpen(false), 0);
                  }}
                >
                  <div
                    className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Esporta chat', en: 'Export chat' })}</div>
                      <button
                        className="icon-button"
                        onClick={() => window.setTimeout(() => setExportOpen(false), 0)}
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-3 space-y-2">
                      <button
                        className="w-full rounded-2xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-left hover:bg-slate-900/30"
                        onClick={() => {
                          setExportOpen(false);
                          doExport('txt');
                        }}
                      >
                        <div className="text-sm font-bold text-slate-100">TXT</div>
                        <div className="mt-0.5 text-[12px] text-slate-400">{t({ it: 'Testo semplice', en: 'Plain text' })}</div>
                      </button>
                      <button
                        className="w-full rounded-2xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-left hover:bg-slate-900/30"
                        onClick={() => {
                          setExportOpen(false);
                          doExport('json');
                        }}
                      >
                        <div className="text-sm font-bold text-slate-100">JSON</div>
                        <div className="mt-0.5 text-[12px] text-slate-400">{t({ it: 'Backup strutturato', en: 'Structured backup' })}</div>
                      </button>
                      <button
                        className="w-full rounded-2xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-left hover:bg-slate-900/30"
                        onClick={async () => {
                          if (!clientChatClientId) return;
                          setExportOpen(false);
                          try {
                            const blob = await exportChat(clientChatClientId, 'html');
                            downloadBlob(blob, `chat-${safeFilename(clientName)}.html`);
                          } catch (e) {
                            setErr(e instanceof Error ? e.message : 'Failed to export');
                          }
                        }}
                      >
                        <div className="text-sm font-bold text-slate-100">HTML</div>
                        <div className="mt-0.5 text-[12px] text-slate-400">{t({ it: 'Da aprire nel browser', en: 'Open in a browser' })}</div>
                      </button>
                    </div>
                  </div>
                </div>
  );
};

// Clear-chat (type-DELETE-to-confirm) overlay extracted from ClientChatDock.
export const ChatClearChatPanel = (props: any) => {
  const { clearChatOpen, setClearChatOpen, clearChatTyped, setClearChatTyped, clearChatBusy, doClearChat, t } = props;
  if (!clearChatOpen) return null;
  return (
                <div
                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setClearChatOpen(false), 0);
                  }}
                >
                  <div
                    className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold text-rose-100">
                        {t({ it: 'Svuota chat', en: 'Clear chat' })}
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => window.setTimeout(() => setClearChatOpen(false), 0)}
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-4">
                      <div className="rounded-2xl border border-rose-900/40 bg-rose-950/25 px-4 py-3 text-sm text-rose-100">
                        {t({
                          it: `Questa operazione elimina tutti i messaggi della chat per questo cliente.`,
                          en: `This will delete all messages for this client chat.`
                        })}
                      </div>
                      <div className="mt-4">
                        <label className="block text-xs font-semibold uppercase text-slate-400">
                          {t({ it: 'Per confermare scrivi', en: 'To confirm type' })}{' '}
                          <span className="ml-1 font-extrabold text-rose-200">DELETE</span>
                        </label>
                        <input
                          value={clearChatTyped}
                          onChange={(e) => setClearChatTyped(e.target.value)}
                          className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 outline-none ring-primary/30 focus:ring-2"
                          placeholder="DELETE"
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          disabled={clearChatBusy}
                        />
                      </div>
                      <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                          className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/30"
                          onClick={() => {
                            setClearChatOpen(false);
                            setClearChatTyped('');
                          }}
                          disabled={clearChatBusy}
                        >
                          {t({ it: 'Annulla', en: 'Cancel' })}
                        </button>
                        <button
                          className="rounded-xl border border-rose-800 bg-rose-600/20 px-3 py-2 text-sm font-extrabold text-rose-100 hover:bg-rose-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                          onClick={doClearChat}
                          disabled={clearChatBusy || String(clearChatTyped || '').trim() !== 'DELETE'}
                        >
                          {clearChatBusy ? t({ it: 'Elimino…', en: 'Deleting…' }) : t({ it: 'Elimina', en: 'Delete' })}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
  );
};
