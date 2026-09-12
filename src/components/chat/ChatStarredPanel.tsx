/* eslint-disable @typescript-eslint/no-explicit-any */
import { Star, X, Copy as CopyIcon, ArrowDownToLine } from 'lucide-react';
import type { ChatMessage } from '../../api/chat';
import { ChatVoiceNoteAttachment } from './ChatVoiceNoteAttachment';
import { isAudioAttachment, capFirst, extOf } from './ClientChatDock.helpers';

// Starred-messages overlay extracted from ClientChatDock.
export const ChatStarredPanel = (props: any) => {
  const {
    starredOpen,
    setStarredOpen,
    starredMessages,
    user,
    setUnstarConfirmId,
    scrollToMessage,
    copyMessageText,
    setMediaModal,
    t
  } = props as {
    starredOpen: boolean;
    setStarredOpen: (v: boolean) => void;
    starredMessages: ChatMessage[];
    user: any;
    setUnstarConfirmId: (v: string | null) => void;
    scrollToMessage: (id: string) => void;
    copyMessageText: (m: ChatMessage) => Promise<void>;
    setMediaModal: (v: { url: string; name: string }) => void;
    t: any;
  };
  if (!starredOpen) return null;
  return (
                <div
                  className="fixed inset-0 z-[54] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setStarredOpen(false), 0);
                  }}
                >
                  <div
                    className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold">
                        <span className="inline-flex items-center gap-2">
                          <Star size={16} className="text-amber-300" fill="currentColor" />
                          <span>
                            {t({ it: 'Messaggi importanti', en: 'Starred messages' })}{' '}
                            <span className="text-slate-400 font-semibold">
                              {t({ it: '(tasto destro per rimuovere)', en: '(right click to remove)' })}
                            </span>
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-[12px] font-semibold text-slate-400 tabular-nums">{starredMessages.length}</div>
                        <button
                          className="icon-button"
                          onClick={() => window.setTimeout(() => setStarredOpen(false), 0)}
                          title={t({ it: 'Chiudi', en: 'Close' })}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="max-h-[70vh] overflow-auto p-3">
                      {!starredMessages.length ? (
                        <div className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-3 text-sm text-slate-300">
                          {t({ it: 'Nessun messaggio importante.', en: 'No starred messages.' })}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {starredMessages
                            .slice()
                            .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
                            .map((m) => {
                              const mine = String(m.userId) === String(user?.id || '');
                              const list = Array.isArray(m.attachments) ? m.attachments : [];
                              const nonVoiceList = list.filter((a) => {
                                const url = String((a as any).url || '');
                                const name = String((a as any).name || url).toLowerCase();
                                return !(name.startsWith('voice-') && isAudioAttachment(a));
                              });
                              const who = mine ? t({ it: 'Tu', en: 'You' }) : capFirst(m.username);
                              const when = new Date(m.createdAt).toLocaleString();
                              const border = mine ? 'border-emerald-400/20 bg-emerald-950/20' : 'border-slate-800 bg-slate-900/20';
                              const voiceAtt = list.find((a) => {
                                const url = String((a as any).url || '');
                                const name = String((a as any).name || url).toLowerCase();
                                return !!url && name.startsWith('voice-') && isAudioAttachment(a);
                              });
                              const hasText = !!String(m.text || '').trim();
                              return (
                                <div
                                  key={m.id}
                                  className={`w-full rounded-2xl border px-3 py-3 ${border}`}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    // Right click asks confirmation before removing the star.
                                    setUnstarConfirmId(m.id);
                                  }}
                                >
                                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                                    <button
                                      type="button"
                                      className="min-w-0 truncate font-semibold text-slate-100 hover:underline"
                                      title={t({ it: 'Vai al messaggio', en: 'Go to message' })}
                                      onClick={() => {
                                        setStarredOpen(false);
                                        window.setTimeout(() => scrollToMessage(m.id), 0);
                                      }}
                                    >
                                      {who}
                                    </button>
                                    <div className="shrink-0 tabular-nums">{when}</div>
                                  </div>

                                  {hasText ? (
                                    <div className="mt-2 rounded-xl border border-slate-800 bg-slate-950/30 px-3 py-2">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0 whitespace-pre-wrap break-words text-sm text-slate-100">
                                          {m.text}
                                        </div>
                                        <button
                                          type="button"
                                          className="icon-button shrink-0"
                                          title={t({ it: 'Copia', en: 'Copy' })}
                                          onClick={() => copyMessageText(m).catch(() => {})}
                                        >
                                          <CopyIcon size={18} />
                                        </button>
                                      </div>
                                    </div>
                                  ) : null}

                                  {voiceAtt ? (
                                    <div className="mt-2">
                                      <ChatVoiceNoteAttachment
                                        url={String((voiceAtt as any).url || '')}
                                        mine={mine}
                                        seed={`starred:${m.id}:${String((voiceAtt as any).url || '')}`}
                                        sizeBytes={Number((voiceAtt as any).sizeBytes) || 0}
                                        t={t}
                                      />
                                    </div>
                                  ) : null}

                                  {nonVoiceList.length ? (
                                    <div className="mt-2 space-y-2">
                                      {nonVoiceList.map((a, idx) => {
                                        const url = String((a as any).url || '');
                                        const name = String((a as any).name || url);
                                        const mime = String((a as any).mime || '');
                                        const ext = extOf(name);
                                        const isImg = mime.startsWith('image/') || (!mime && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext));
                                        if (!url) return null;
                                        if (isImg) {
                                          return (
                                            <div
                                              key={`${url}:${idx}`}
                                              className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/30 px-2 py-2"
                                            >
                                              <button
                                                type="button"
                                                className="flex min-w-0 items-center gap-2 rounded-xl focus:outline-none focus-visible:outline-none"
                                                onClick={() => setMediaModal({ url, name })}
                                                title={name}
                                              >
                                                <img src={url} alt="" className="h-12 w-12 rounded-xl object-cover" draggable={false} />
                                                <div className="min-w-0 text-left">
                                                  <div className="truncate text-sm font-semibold text-slate-100">{name}</div>
                                                  <div className="truncate text-[11px] text-slate-400">{t({ it: 'Foto', en: 'Photo' })}</div>
                                                </div>
                                              </button>
                                              <a
                                                href={url}
                                                download={name}
                                                className="icon-button"
                                                title={t({ it: 'Scarica', en: 'Download' })}
                                              >
                                                <ArrowDownToLine size={18} />
                                              </a>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div
                                            key={`${url}:${idx}`}
                                            className="flex items-center justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950/30 px-3 py-2"
                                            title={name}
                                          >
                                            <div className="min-w-0">
                                              <div className="truncate text-sm font-semibold text-slate-100">{name}</div>
                                              <div className="truncate text-[11px] text-slate-400">{mime || ext || t({ it: 'Allegato', en: 'Attachment' })}</div>
                                            </div>
                                            <a
                                              href={url}
                                              download={name}
                                              className="icon-button shrink-0"
                                              title={t({ it: 'Scarica', en: 'Download' })}
                                            >
                                              <ArrowDownToLine size={18} />
                                            </a>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
  );
};
