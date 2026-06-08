/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import { Check, CheckCheck, ChevronDown, Star } from 'lucide-react';
import UserAvatar from '../ui/UserAvatar';
import { ChatMessageAttachments, ChatMessageReactions } from './ChatMessageBits';
import {
  isDmThreadId,
  localDateKey,
  isAudioAttachment,
  parseMeetingRequestToken,
  capFirst,
  snippet,
  CHAT_REACTIONS
} from './ClientChatDock.helpers';

// Scrollable message list (day separators, bubbles, receipts, reply preview,
// inline edit, reaction picker, meeting-review actions) extracted from ClientChatDock.
export const ChatMessageList = (props: any) => {
  const {
    messages,
    user,
    clientChatClientId,
    messagesById,
    searchOpen,
    searchHits,
    searchHitIdx,
    editingId,
    editingText,
    setEditingText,
    editTextareaRef,
    setEditingId,
    commitEdit,
    openUserProfile,
    openActionMenuFor,
    reactPickerId,
    setReactPickerId,
    reactPickerRef,
    toggleReaction,
    setReactionsModal,
    scrollToMessage,
    setMediaModal,
    reviewMeetingFromChat,
    t
  } = props;
  return (
    <>
	                    {(() => {
	                      let lastDay = '';
	                      return (messages || []).map((m: any) => {
	                        const mine = String(m.userId) === String(user?.id || '');
	                        const showDmTicks = !!clientChatClientId && isDmThreadId(clientChatClientId) && mine;
	                        const showAvatar = true;
	                        const day = localDateKey(m.createdAt);
	                        const showDay = day !== lastDay;
	                        if (showDay) lastDay = day;
	                        const dayLabel = (() => {
	                          const d = new Date(m.createdAt);
	                          const now = new Date();
	                          const todayKey = localDateKey(now.getTime());
	                          const yesterdayKey = localDateKey(now.getTime() - 24 * 60 * 60 * 1000);
	                          if (day === todayKey) return t({ it: 'Oggi', en: 'Today' });
	                          if (day === yesterdayKey) return t({ it: 'Ieri', en: 'Yesterday' });
	                          return d.toLocaleDateString();
	                        })();
	                        const bubble = mine
	                          ? 'bg-emerald-500/15 text-emerald-50 border border-emerald-400/20'
	                          : 'bg-slate-900/50 text-slate-100 border border-slate-700';
	                        const hasVoice = (m.attachments || []).some((a: any) => {
	                          const name = String((a as any)?.name || '').toLowerCase();
	                          return name.startsWith('voice-') && isAudioAttachment(a);
	                        });
	                        const meetingRequestId = parseMeetingRequestToken(String(m.text || ''));
	                        const canReviewMeetingFromChat = !!meetingRequestId && (!!user?.isAdmin || !!user?.isSuperAdmin);
	                        const starredBy = Array.isArray((m as any).starredBy) ? ((m as any).starredBy as string[]) : [];
	                        const starred = !!user?.id && starredBy.some((id) => String(id) === String(user.id));
	                        const replyTarget = m.replyToId ? messagesById.get(String(m.replyToId)) : null;
	                        const isSearchHit = !!searchOpen && !!searchHits.length && searchHits[searchHitIdx] === String(m.id);
	                        return (
	                          <Fragment key={m.id}>
	                            {showDay ? (
	                              <div className="flex justify-center py-1">
	                                <div className="rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1 text-[11px] font-semibold text-slate-300">
	                                  {dayLabel}
	                                </div>
	                              </div>
	                            ) : null}
	                            <div id={`chatmsg-${m.id}`} className={`flex ${mine ? 'justify-end' : 'justify-start'} gap-2`}>
		                              {showAvatar && !mine ? (
		                                <button
		                                  type="button"
		                                  className="shrink-0 rounded-full focus:outline-none focus-visible:outline-none"
		                                  onClick={() => openUserProfile(m.userId)}
		                                  title={t({ it: 'Profilo utente', en: 'User profile' })}
		                                >
		                                  <UserAvatar username={m.username} src={m.avatarUrl} size={28} className="border-slate-800 bg-slate-900" />
		                                </button>
		                              ) : null}
	                              <div
	                                className={`group relative ${hasVoice ? 'flex-1 max-w-none' : 'max-w-[82%]'} rounded-2xl px-3 py-2 text-sm ${bubble} ${
	                                  isSearchHit ? 'ring-2 ring-amber-400/50' : ''
	                                }`}
	                              >
	                            <div className={`flex items-center justify-between gap-2 ${mine ? 'text-emerald-100' : 'text-slate-300'}`}>
	                              <div className="flex items-center gap-1 text-[11px] font-semibold">
	                                <span>{mine ? t({ it: 'Tu', en: 'You' }) : capFirst(m.username)}</span>
	                                {starred ? <Star size={12} className="text-amber-300" fill="currentColor" /> : null}
	                              </div>
                              <div className="flex items-center gap-1">
                                <div className="text-[10px] opacity-70">{new Date(m.createdAt).toLocaleTimeString()}</div>
                                {showDmTicks ? (
                                  <span className="inline-flex items-center opacity-90" title={t({ it: 'Stato consegna', en: 'Delivery status' })}>
                                    {(m as any)?.readAt ? (
                                      <CheckCheck size={14} className="text-sky-400" />
                                    ) : (m as any)?.deliveredAt ? (
                                      <CheckCheck size={14} className="text-slate-300/80" />
                                    ) : (
                                      <Check size={14} className="text-slate-300/80" />
                                    )}
                                  </span>
                                ) : null}
                                {!m.deleted ? (
                                  <button
                                    type="button"
                                    className="flex h-6 w-6 items-center justify-center rounded-md opacity-0 hover:bg-black/20 group-hover:opacity-100"
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openActionMenuFor(m, e.currentTarget);
                                    }}
                                    title={t({ it: 'Menu', en: 'Menu' })}
                                    aria-label={t({ it: 'Menu', en: 'Menu' })}
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                            {editingId === m.id ? (
                              <div className="mt-1 space-y-2">
                                <textarea
                                  ref={(el) => {
                                    if (el) editTextareaRef.current = el;
                                  }}
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none ring-primary/30 focus:ring-2"
                                  rows={3}
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditingText('');
                                    }}
                                  >
                                    {t({ it: 'Annulla', en: 'Cancel' })}
                                  </button>
                                  <button
                                    className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                                    onClick={commitEdit}
                                  >
                                    {t({ it: 'Salva', en: 'Save' })}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mt-1 whitespace-pre-wrap break-words">
                                {!m.deleted && m.replyToId ? (
                                  <button
                                    type="button"
                                    className={`mb-2 block w-full rounded-xl border px-2 py-1 text-left text-[12px] ${
                                      mine ? 'border-emerald-400/20 bg-emerald-500/10' : 'border-slate-700 bg-slate-950/20'
                                    }`}
                                    onClick={() => {
                                      const id = String(m.replyToId || '');
                                      if (id) scrollToMessage(id);
                                    }}
                                    title={t({ it: 'Vai al messaggio citato', en: 'Go to replied message' })}
                                  >
                                    <div className="font-semibold opacity-90">
                                      {t({ it: 'Risposta a', en: 'Reply to' })}{' '}
	                                      {replyTarget ? (replyTarget.userId === user?.id ? t({ it: 'Tu', en: 'You' }) : capFirst(replyTarget.username)) : '#'}
                                    </div>
                                    <div className="opacity-80">
                                      {replyTarget
                                        ? replyTarget.deleted
                                          ? t({ it: 'Messaggio eliminato', en: 'Message deleted' })
                                          : snippet(replyTarget.text) ||
                                            ((replyTarget.attachments || []).length
                                              ? t({ it: 'Allegato', en: 'Attachment' })
                                              : t({ it: 'Messaggio', en: 'Message' }))
                                        : t({ it: 'Messaggio non disponibile', en: 'Message not available' })}
                                    </div>
                                  </button>
                                ) : null}
                                {m.deleted ? (
                                  <span className="italic text-slate-400">{t({ it: 'Messaggio eliminato', en: 'Message deleted' })}</span>
                                ) : (
                                  m.text
                                )}
                                {!m.deleted && canReviewMeetingFromChat ? (
                                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/40 px-2 py-2 text-xs">
                                    <button
                                      type="button"
                                      className="rounded-lg bg-emerald-600 px-2 py-1 font-semibold text-white hover:bg-emerald-700"
                                      onClick={() => reviewMeetingFromChat(String(meetingRequestId || ''), 'approve')}
                                    >
                                      {t({ it: 'Approva', en: 'Approve' })}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-lg bg-rose-600 px-2 py-1 font-semibold text-white hover:bg-rose-700"
                                      onClick={() => reviewMeetingFromChat(String(meetingRequestId || ''), 'reject')}
                                    >
                                      {t({ it: 'Rifiuta', en: 'Reject' })}
                                    </button>
                                    <span className="text-slate-300">#{meetingRequestId}</span>
                                  </div>
                                ) : null}
                                {m.editedAt && !m.deleted ? (
                                  <span className="ml-2 text-[10px] font-semibold opacity-60">{t({ it: '(modificato)', en: '(edited)' })}</span>
                                ) : null}
                                {!m.deleted ? <ChatMessageAttachments m={m} user={user} setMediaModal={setMediaModal} t={t} /> : null}
                                {!m.deleted ? <ChatMessageReactions m={m} user={user} toggleReaction={toggleReaction} setReactionsModal={setReactionsModal} t={t} /> : null}
                                {!m.deleted && reactPickerId === m.id ? (
                                  <div
                                    ref={(el) => {
                                      reactPickerRef.current = el;
                                    }}
                                    className="mt-2 flex flex-wrap gap-1 rounded-2xl border border-slate-700 bg-slate-950/40 p-2"
                                  >
                                    {CHAT_REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        type="button"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-[18px] hover:bg-slate-900"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleReaction(m, emoji);
                                          setReactPickerId(null);
                                        }}
                                        title={t({ it: 'Reagisci', en: 'React' })}
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )}
	                              </div>
		                              {showAvatar && mine ? (
		                                <button
		                                  type="button"
		                                  className="shrink-0 rounded-full focus:outline-none focus-visible:outline-none"
		                                  onClick={() => {
		                                    const myId = String(user?.id || '').trim();
		                                    if (myId) openUserProfile(myId);
		                                  }}
		                                  title={t({ it: 'Profilo utente', en: 'User profile' })}
		                                >
		                                  <UserAvatar username={m.username} src={m.avatarUrl} size={28} className="border-slate-800 bg-slate-900" />
		                                </button>
		                              ) : null}
	                            </div>
	                          </Fragment>
	                        );
	                      });
	                    })()}
    </>
  );
};
