/* eslint-disable @typescript-eslint/no-explicit-any */
import { X, ArrowDownToLine } from 'lucide-react';
import { snippet, capFirst } from './ClientChatDock.helpers';

// Image lightbox overlay extracted from ClientChatDock.
export const ChatMediaLightbox = (props: any) => {
  const { mediaModal, setMediaModal, t } = props;
  if (!mediaModal) return null;
  return (
                <div
                  className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setMediaModal(null), 0);
                  }}
                >
                  <div
                    className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold">{mediaModal.name}</div>
                      <div className="flex items-center gap-2">
                        <a
                          href={mediaModal.url}
                          download={mediaModal.name}
                          className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-900"
                          title={t({ it: 'Scarica', en: 'Download' })}
                        >
                          <ArrowDownToLine size={14} />
                          {t({ it: 'Scarica', en: 'Download' })}
                        </a>
                        <button
                          className="icon-button"
                          onClick={() => window.setTimeout(() => setMediaModal(null), 0)}
                          title={t({ it: 'Chiudi', en: 'Close' })}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-black">
                      <img src={mediaModal.url} alt="" className="mx-auto max-h-[78vh] w-auto max-w-full object-contain" />
                    </div>
                  </div>
                </div>
  );
};

// Unstar-confirmation overlay extracted from ClientChatDock.
export const ChatUnstarConfirm = (props: any) => {
  const { unstarConfirmId, setUnstarConfirmId, messagesById, toggleStar, t } = props;
  if (!unstarConfirmId) return null;
  return (
                <div
                  className="fixed inset-0 z-[56] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) window.setTimeout(() => setUnstarConfirmId(null), 0);
                  }}
                >
                  <div
                    className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 shadow-card"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2">
                      <div className="min-w-0 truncate text-sm font-semibold">
                        {t({ it: 'Rimuovere importante?', en: 'Remove starred?' })}
                      </div>
                      <button
                        className="icon-button"
                        onClick={() => window.setTimeout(() => setUnstarConfirmId(null), 0)}
                        title={t({ it: 'Chiudi', en: 'Close' })}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <div className="p-4">
                      {(() => {
                        const msg = unstarConfirmId ? messagesById.get(String(unstarConfirmId)) : null;
                        const preview =
                          msg && !msg.deleted
                            ? snippet(msg.text, 180) ||
                              ((msg.attachments || []).length ? t({ it: '[Allegati]', en: '[Attachments]' }) : t({ it: '[Messaggio]', en: '[Message]' }))
                            : t({ it: 'Messaggio non disponibile.', en: 'Message not available.' });
                        return (
                          <div className="rounded-2xl border border-slate-800 bg-slate-900/20 px-4 py-3 text-sm text-slate-200">
                            <div className="font-semibold text-slate-100">{capFirst(String(msg?.username || '')) || ''}</div>
                            <div className="mt-1 text-slate-300">{preview}</div>
                          </div>
                        );
                      })()}
                      <div className="mt-4 flex items-center justify-end gap-2">
                        <button
                          className="rounded-xl border border-slate-800 bg-slate-900/20 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900/30"
                          onClick={() => setUnstarConfirmId(null)}
                        >
                          {t({ it: 'Annulla', en: 'Cancel' })}
                        </button>
                        <button
                          className="rounded-xl border border-amber-800 bg-amber-500/15 px-3 py-2 text-sm font-extrabold text-amber-100 hover:bg-amber-500/25"
                          onClick={() => {
                            const msg = unstarConfirmId ? messagesById.get(String(unstarConfirmId)) : null;
                            if (msg) toggleStar(msg);
                            setUnstarConfirmId(null);
                          }}
                        >
                          {t({ it: 'Rimuovi', en: 'Remove' })}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
  );
};
