/* eslint-disable @typescript-eslint/no-explicit-any */
import { CornerUpLeft, Smile, Star, Copy as CopyIcon, Info, Pencil, Trash2 } from 'lucide-react';
import { canEditMessage } from './ClientChatDock.helpers';

// Per-message context action menu (reply/react/star/copy/info/edit/delete)
// extracted from ClientChatDock. Lives inside Dialog.Panel by design.
export const ChatActionMenu = (props: any) => {
  const {
    actionMenu,
    setActionMenu,
    actionMenuRef,
    messagesById,
    user,
    isSuperAdmin,
    startReply,
    setReactPickerId,
    scrollToMessage,
    toggleStar,
    copyMessageText,
    openMessageInfo,
    startEdit,
    remove,
    t
  } = props;
  if (!actionMenu) return null;
  const msg = messagesById.get(actionMenu.id);
  if (!msg || msg.deleted) return null;
  const myId = String(user?.id || '');
  const canEdit = !!myId && canEditMessage(msg, myId);
  const canDelete = !!myId && (String(msg.userId) === myId || isSuperAdmin);
  const starredBy = Array.isArray((msg as any).starredBy) ? ((msg as any).starredBy as string[]) : [];
  const starred = !!myId && starredBy.some((id) => String(id) === myId);
  const menuW = 228;
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const left = Math.max(8, Math.min(actionMenu.x - menuW, viewportW - menuW - 8));
  const top = Math.max(8, Math.min(actionMenu.y + 8, viewportH - 420));
  return (
                        <div
                          className="fixed z-[70]"
                          ref={actionMenuRef}
                          style={{ left, top, width: menuW }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-sm shadow-card">
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                              onClick={() => {
                                setActionMenu(null);
                                startReply(msg);
                              }}
                            >
                              <CornerUpLeft size={16} className="text-slate-300" />
                              {t({ it: 'Rispondi', en: 'Reply' })}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                              onClick={() => {
                                setActionMenu(null);
                                setReactPickerId(msg.id);
                                window.setTimeout(() => scrollToMessage(msg.id), 0);
                              }}
                            >
                              <Smile size={16} className="text-slate-300" />
                              {t({ it: 'Reagisci', en: 'React' })}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                              onClick={() => {
                                setActionMenu(null);
                                toggleStar(msg);
                              }}
                            >
                              <Star size={16} className={starred ? 'text-amber-300' : 'text-slate-300'} fill={starred ? 'currentColor' : 'none'} />
                              {t({ it: 'Importante', en: 'Important' })}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                              onClick={() => {
                                setActionMenu(null);
                                copyMessageText(msg).catch(() => {});
                              }}
                            >
                              <CopyIcon size={16} className="text-slate-300" />
                              {t({ it: 'Copia', en: 'Copy' })}
                            </button>
                            <button
                              className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                              onClick={() => {
                                setActionMenu(null);
                                openMessageInfo(msg).catch(() => {});
                              }}
                            >
                              <Info size={16} className="text-slate-300" />
                              {t({ it: 'Info', en: 'Info' })}
                            </button>
                            {canEdit ? (
                              <button
                                className="flex w-full items-center gap-2 px-3 py-2 text-slate-100 hover:bg-slate-900"
                                onClick={() => {
                                  setActionMenu(null);
                                  startEdit(msg);
                                }}
                              >
                                <Pencil size={16} className="text-slate-300" />
                                {t({ it: 'Modifica', en: 'Edit' })}
                              </button>
                            ) : null}
                            <div className="my-1 h-px bg-slate-800" />
                            {canDelete ? (
                              <button
                                className="flex w-full items-center gap-2 px-3 py-2 text-rose-200 hover:bg-rose-950/35"
                                onClick={() => {
                                  setActionMenu(null);
                                  remove(msg).catch(() => {});
                                }}
                              >
                                <Trash2 size={16} className="text-rose-200" />
                                {t({ it: 'Elimina', en: 'Delete' })}
                              </button>
                            ) : null}
                          </div>
                        </div>
  );
};
