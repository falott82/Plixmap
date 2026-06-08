/* eslint-disable @typescript-eslint/no-explicit-any */
import { X } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { CHAT_REACTIONS, capWords, capFirst } from './ClientChatDock.helpers';

// Reaction-details modal (per-emoji tabs + who reacted) extracted from ClientChatDock.
export const ChatReactionsModal = (props: any) => {
  const { reactionsModal, setReactionsModal, messagesById, membersById, user, toggleReaction, openUserProfile, t } = props;
  if (!reactionsModal) return null;
  return (
                <div
                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setReactionsModal(null), 0);
                  }}
                >
                  <div
                    className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {(() => {
                      const msg = reactionsModal ? messagesById.get(reactionsModal.messageId) : null;
                      const reactions =
                        msg && (msg as any).reactions && typeof (msg as any).reactions === 'object'
                          ? ((msg as any).reactions as Record<string, string[]>)
                          : {};
                      const emojis = CHAT_REACTIONS.filter((e) => Array.isArray(reactions[e]) && reactions[e]!.length);
                      const tabs: { id: 'all' | string; label: string; count: number }[] = [
                        {
                          id: 'all',
                          label: t({ it: 'Tutti', en: 'All' }),
                          count: emojis.reduce((sum, e) => sum + (Array.isArray(reactions[e]) ? reactions[e]!.length : 0), 0)
                        },
                        ...emojis.map((e) => ({ id: e, label: e, count: Array.isArray(reactions[e]) ? reactions[e]!.length : 0 }))
                      ];
                      const activeTab = tabs.some((t0) => t0.id === reactionsModal.tab) ? reactionsModal.tab : 'all';
                      const userToEmoji = new Map<string, string>();
                      for (const e of emojis) {
                        for (const uid of Array.isArray(reactions[e]) ? reactions[e]! : []) {
                          const id = String(uid || '').trim();
                          if (!id) continue;
                          if (!userToEmoji.has(id)) userToEmoji.set(id, e);
                        }
                      }
                      const listUserIds =
                        activeTab === 'all'
                          ? Array.from(userToEmoji.keys())
                          : Array.isArray(reactions[String(activeTab)])
                            ? (reactions[String(activeTab)] as any[]).map((x) => String(x || '').trim()).filter(Boolean)
                            : [];
                      const rows = listUserIds
                        .map((id) => {
                          const m = membersById.get(id);
                          const username = m?.username ? String(m.username) : '';
                          const fullName = `${String(m?.firstName || '').trim()} ${String(m?.lastName || '').trim()}`.trim();
                          const label = fullName ? capWords(fullName) : username ? capFirst(username) : id.slice(0, 8);
                          const avatarUrl = m?.avatarUrl ? String(m.avatarUrl) : '';
                          const emoji = activeTab === 'all' ? userToEmoji.get(id) || '' : String(activeTab);
                          return { id, username, label, avatarUrl, emoji };
                        })
                        .sort((a, b) => a.label.localeCompare(b.label));
                      return (
                        <>
                          <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                            <div className="min-w-0 truncate text-sm font-semibold">{t({ it: 'Reazioni', en: 'Reactions' })}</div>
                            <button
                              className="icon-button"
                              onClick={() => window.setTimeout(() => setReactionsModal(null), 0)}
                              title={t({ it: 'Chiudi', en: 'Close' })}
                            >
                              <X size={18} />
                            </button>
                          </div>
                          <div className="border-b border-slate-800 bg-slate-950 px-2 py-2">
                            <div className="flex items-center gap-1 overflow-x-auto">
                              {tabs.map((tab) => {
                                const isActive = tab.id === activeTab;
                                const myId = String(user?.id || '');
                                const list = tab.id !== 'all' && reactions ? (Array.isArray((reactions as any)[tab.id]) ? (reactions as any)[tab.id] : []) : [];
                                const mine = !!myId && tab.id !== 'all' && Array.isArray(list) && list.some((id: any) => String(id) === myId);
                                return (
                                  <button
                                    key={tab.id}
                                    type="button"
                                    className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold ${
                                      isActive
                                        ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50'
                                        : 'border-slate-800 bg-slate-900/20 text-slate-200 hover:bg-slate-900/40'
                                    }`}
                                    onClick={() => {
                                      // If you reacted with this emoji, clicking the same emoji removes it.
                                      if (tab.id !== 'all' && isActive && mine && msg) {
                                        toggleReaction(msg, String(tab.id));
                                        return;
                                      }
                                      setReactionsModal({ messageId: reactionsModal.messageId, tab: tab.id });
                                    }}
                                    title={
                                      tab.id !== 'all' && mine
                                        ? t({ it: 'Clicca per togliere la tua reazione', en: 'Click to remove your reaction' })
                                        : undefined
                                    }
                                  >
                                    <span className="mr-2">{tab.label}</span>
                                    <span className="tabular-nums text-slate-300">{tab.count}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div className="max-h-72 overflow-auto p-2">
                            {!rows.length ? (
                              <div className="px-2 py-4 text-sm text-slate-400">{t({ it: 'Nessuna reazione.', en: 'No reactions.' })}</div>
                            ) : (
                              <div className="space-y-1">
                                {rows.map((r) => (
                                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-slate-900/40">
                                    <button
                                      type="button"
                                      className="flex min-w-0 items-center gap-2 rounded-xl focus:outline-none focus-visible:outline-none"
                                      onClick={() => openUserProfile(r.id)}
                                      title={t({ it: 'Profilo utente', en: 'User profile' })}
                                    >
                                      <UserAvatar username={r.username || r.label} src={r.avatarUrl} size={28} className="border-slate-800 bg-slate-900" />
                                      <div className="min-w-0 text-left">
                                        <div className="truncate text-sm font-semibold text-slate-100">{r.label}</div>
                                        {r.username ? <div className="truncate text-[11px] text-slate-400">@{r.username}</div> : null}
                                      </div>
                                    </button>
                                    <div className="shrink-0 text-[18px]">{r.emoji}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
  );
};
