/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dialog } from '@headlessui/react';
import { UserCheck, UserX, Info, Search, Star, Users, Download, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { unblockChatUser } from '../../api/chat';

// Chat panel header (title + action buttons) extracted from ClientChatDock.
export const ChatHeader = (props: any) => {
  const {
    clientLogoUrl, clientInitial, clientName, activeDmContact, headerIconBtn, dmBlockedByMe,
    setActiveDmMeta, refreshDmContacts, setConfirmDmBlock, setHelpOpen, setMembersOpen,
    setExportOpen, setSearchOpen, setStarredOpen, searchInputRef, starredMessages,
    setClearChatOpen, setClearChatTyped, isSuperAdmin, closeClientChat, t
  } = props;
  return (
	                  <div className="relative z-[40] flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                    <div className="min-w-0">
                      <Dialog.Title className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-50">
                        <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-md border border-slate-700 bg-slate-950/60">
                          {clientLogoUrl ? (
                            <img src={clientLogoUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                          ) : (
                            <span className="text-[12px] font-extrabold text-slate-200">{clientInitial}</span>
                          )}
                        </span>
                        <span className="truncate">{clientName}</span>
                      </Dialog.Title>
                    </div>
		                    <div className="flex items-center gap-1">
                          {activeDmContact ? (
                            <button
                              className={headerIconBtn}
                              onClick={async () => {
                                try {
                                  if (!activeDmContact?.id) return;
                                  if (dmBlockedByMe) {
                                    await unblockChatUser(activeDmContact.id);
                                    setActiveDmMeta((prev: any) => (prev && typeof prev === 'object' ? { ...prev, blockedByMe: false } : prev));
                                    await refreshDmContacts();
                                    return;
                                  }
                                  setConfirmDmBlock({ userId: String(activeDmContact.id), username: String(activeDmContact.username || '') });
                                } catch {
                                  // ignore
                                }
                              }}
                              title={
                                dmBlockedByMe
                                  ? t({ it: 'Sblocca utente', en: 'Unblock user' })
                                  : t({ it: 'Blocca utente', en: 'Block user' })
                              }
                              aria-label={dmBlockedByMe ? t({ it: 'Sblocca utente', en: 'Unblock user' }) : t({ it: 'Blocca utente', en: 'Block user' })}
                            >
                              {dmBlockedByMe ? <UserCheck size={18} /> : <UserX size={18} />}
                            </button>
                          ) : null}
		                      <button
		                        className={headerIconBtn}
		                        onClick={() => {
		                          setHelpOpen(true);
		                          setMembersOpen(false);
		                          setExportOpen(false);
		                          setSearchOpen(false);
		                          setStarredOpen(false);
		                        }}
		                        title={t({ it: 'Info chat', en: 'Chat info' })}
		                        aria-label={t({ it: 'Info chat', en: 'Chat info' })}
		                      >
		                        <Info size={18} />
		                      </button>
	                      <button
	                        className={headerIconBtn}
	                        onClick={() => {
	                          setSearchOpen((v: any) => !v);
	                          setStarredOpen(false);
	                          setMembersOpen(false);
	                          setExportOpen(false);
	                          window.setTimeout(() => searchInputRef.current?.focus(), 0);
	                        }}
	                        title={t({ it: 'Cerca nella chat', en: 'Search chat' })}
	                        aria-label={t({ it: 'Cerca nella chat', en: 'Search chat' })}
	                      >
	                        <Search size={18} />
	                      </button>
	                      <button
	                        className={headerIconBtn}
	                        onClick={() => {
	                          setStarredOpen(true);
	                          setSearchOpen(false);
	                          setMembersOpen(false);
	                          setExportOpen(false);
	                        }}
	                        title={t({ it: 'Messaggi importanti', en: 'Starred messages' })}
	                        aria-label={t({ it: 'Messaggi importanti', en: 'Starred messages' })}
	                      >
	                        <Star size={18} className={starredMessages.length ? 'text-amber-300' : ''} fill={starredMessages.length ? 'currentColor' : 'none'} />
	                      </button>
		                      <button
		                        className={headerIconBtn}
		                        onClick={() => {
		                          setMembersOpen((v: any) => !v);
		                          setExportOpen(false);
		                          setSearchOpen(false);
		                          setStarredOpen(false);
		                          setHelpOpen(false);
		                          setClearChatOpen(false);
		                        }}
		                        title={t({ it: 'Membri chat', en: 'Chat members' })}
		                        aria-label={t({ it: 'Membri chat', en: 'Chat members' })}
		                      >
		                        <Users size={18} />
		                      </button>
		                      <button
		                        className={headerIconBtn}
		                        onClick={() => {
		                          setExportOpen((v: any) => !v);
		                          setMembersOpen(false);
		                          setSearchOpen(false);
		                          setStarredOpen(false);
		                          setHelpOpen(false);
		                          setClearChatOpen(false);
		                        }}
		                        title={t({ it: 'Esporta chat', en: 'Export chat' })}
		                        aria-label={t({ it: 'Esporta chat', en: 'Export chat' })}
		                      >
		                        <Download size={18} />
		                      </button>
	                    {isSuperAdmin ? (
	                      <button
	                        className={`${headerIconBtn} text-rose-300`}
	                        onClick={() => {
	                          setClearChatOpen(true);
	                          setClearChatTyped('');
	                          setHelpOpen(false);
	                          setMembersOpen(false);
	                          setExportOpen(false);
	                          setSearchOpen(false);
	                          setStarredOpen(false);
	                        }}
	                        title={t({ it: 'Svuota chat', en: 'Clear chat' })}
	                      >
	                        <Trash2 size={18} />
	                      </button>
                    ) : null}
                    <button className={headerIconBtn} onClick={closeClientChat} title={t({ it: 'Chiudi', en: 'Close' })}>
                      <X size={18} />
                    </button>
	                  </div>
	                </div>
  );
};

// In-chat search bar extracted from ClientChatDock.
export const ChatSearchBar = (props: any) => {
  const { searchOpen, searchInputRef, searchQ, setSearchQ, searchHits, searchHitIdx, setSearchHitIdx, setSearchOpen, headerIconBtn, t } = props;
  if (!searchOpen) return null;
  return (
	                  <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-2">
	                    <Search size={16} className="text-slate-300" />
		                    <input
		                      ref={searchInputRef}
		                      value={searchQ}
		                      onChange={(e) => setSearchQ(e.target.value)}
		                      onKeyDown={(e) => {
		                        if (e.key === 'Enter') {
		                          e.preventDefault();
		                          if (!searchHits.length) return;
		                          setSearchHitIdx((i: any) => (i + 1) % searchHits.length);
		                        }
	                      }}
	                      className="h-9 flex-1 rounded-xl border border-slate-800 bg-slate-900/40 px-3 text-sm text-slate-100 outline-none ring-primary/30 placeholder:text-slate-500 focus:ring-2"
	                      placeholder={t({ it: 'Cerca…', en: 'Search…' })}
	                    />
	                    <div className="shrink-0 text-[11px] font-semibold text-slate-400 tabular-nums">
	                      {searchHits.length ? `${Math.min(searchHitIdx + 1, searchHits.length)}/${searchHits.length}` : `0/0`}
	                    </div>
	                    <button
	                      className={`${headerIconBtn} h-9 w-9 rounded-xl`}
	                      onClick={() => {
	                        if (!searchHits.length) return;
	                        setSearchHitIdx((i: any) => (i - 1 + searchHits.length) % searchHits.length);
	                      }}
	                      disabled={!searchHits.length}
	                      title={t({ it: 'Risultato precedente', en: 'Previous result' })}
	                    >
	                      <ChevronUp size={16} />
	                    </button>
	                    <button
	                      className={`${headerIconBtn} h-9 w-9 rounded-xl`}
	                      onClick={() => {
	                        if (!searchHits.length) return;
	                        setSearchHitIdx((i: any) => (i + 1) % searchHits.length);
	                      }}
	                      disabled={!searchHits.length}
	                      title={t({ it: 'Risultato successivo', en: 'Next result' })}
	                    >
	                      <ChevronDown size={16} />
	                    </button>
	                    <button
	                      className={`${headerIconBtn} h-9 w-9 rounded-xl`}
	                      onClick={() => setSearchOpen(false)}
	                      title={t({ it: 'Chiudi ricerca', en: 'Close search' })}
	                    >
	                      <X size={16} />
	                    </button>
	                  </div>
  );
};
