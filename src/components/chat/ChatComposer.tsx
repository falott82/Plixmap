/* eslint-disable @typescript-eslint/no-explicit-any */
import { X, Paperclip, Mic, Trash2, Send } from 'lucide-react';
import { capFirst, snippet, formatBytes, isVoiceRecordingAttachment, MAX_NONVOICE_ATTACH_BYTES, MAX_VOICE_SECONDS } from './ClientChatDock.helpers';

// Message composer (reply preview, attachment previews, voice recorder, input row)
// extracted from ClientChatDock.
export const ChatComposer = (props: any) => {
  const {
    fileInputRef,
    onFilesPicked,
    replyToId,
    setReplyToId,
    messagesById,
    user,
    pendingAttachments,
    setPendingAttachments,
    pendingNonVoiceBytes,
    pendingVoiceCount,
    recording,
    recordSeconds,
    waveform,
    err,
    pickFiles,
    cancelRecording,
    startRecording,
    formatRec,
    stopRecording,
    send,
    sending,
    dmReadOnly,
    dmBlockedByMe,
    composeTextareaRef,
    text,
    setText,
    t
  } = props;
  return (
                <div className="border-t border-slate-800 bg-slate-900 p-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.jfif,.gif,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.mp3,.wav,.m4a,.aac,.ogg,.mp4,.webm,.mov,image/*,video/*,audio/*,application/pdf"
                    onChange={(e) => {
                      const picked = e.target.files ? Array.from(e.target.files) : [];
                      // allow selecting same file twice
                      e.target.value = '';
                      onFilesPicked(picked).catch(() => {});
                    }}
                  />
                  {replyToId ? (
                    <div className="mb-2 flex items-start justify-between gap-2 rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-slate-300">
                          {t({ it: 'Rispondi a', en: 'Replying to' })}{' '}
                          {(() => {
                            const target = messagesById.get(replyToId);
                            if (!target) return '#';
	                            return target.userId === user?.id ? t({ it: 'Tu', en: 'You' }) : capFirst(target.username);
	                          })()}
                        </div>
                        <div className="truncate text-[12px] text-slate-200">
                          {(() => {
                            const target = messagesById.get(replyToId);
                            if (!target) return t({ it: 'Messaggio non disponibile', en: 'Message not available' });
                            if (target.deleted) return t({ it: 'Messaggio eliminato', en: 'Message deleted' });
                            return snippet(target.text) || ((target.attachments || []).length ? t({ it: 'Allegato', en: 'Attachment' }) : t({ it: 'Messaggio', en: 'Message' }));
                          })()}
                        </div>
                      </div>
                      <button
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-200 hover:bg-slate-800"
                        onClick={() => setReplyToId(null)}
                        title={t({ it: 'Annulla risposta', en: 'Cancel reply' })}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : null}
                  {pendingAttachments.length ? (
                    <div className="mb-2 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <div>
                          {t({ it: 'Allegati', en: 'Attachments' })}:{' '}
                          <span
                            className={
                              pendingNonVoiceBytes > MAX_NONVOICE_ATTACH_BYTES ? 'text-rose-300 font-semibold' : 'text-slate-300 font-semibold'
                            }
                          >
                            {formatBytes(pendingNonVoiceBytes)}
                          </span>{' '}
                          / {formatBytes(MAX_NONVOICE_ATTACH_BYTES)}
                          {pendingVoiceCount ? (
                            <span className="ml-2 text-slate-400">
                              + {pendingVoiceCount} {t({ it: pendingVoiceCount === 1 ? 'vocale' : 'vocali', en: pendingVoiceCount === 1 ? 'voice note' : 'voice notes' })}
                            </span>
                          ) : null}
                        </div>
                        <button
                          className="text-slate-400 hover:text-slate-200"
                          onClick={() =>
                            setPendingAttachments((prev: any) => {
                              for (const a of prev) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
                              return [];
                            })
                          }
                          title={t({ it: 'Rimuovi tutti', en: 'Remove all' })}
                        >
                          {t({ it: 'Svuota', en: 'Clear' })}
                        </button>
                      </div>

                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {pendingAttachments.map((a: any) => (
                          <div
                            key={a.id}
                            className="relative shrink-0 w-[92px] h-[92px] rounded-2xl border border-slate-700 bg-slate-950/50 overflow-hidden"
                            title={`${isVoiceRecordingAttachment(a.name, a.file?.type || '') ? t({ it: 'Vocale', en: 'Voice note' }) : a.name} (${formatBytes(a.sizeBytes)})`}
                          >
                            {a.kind === 'image' && a.previewUrl ? (
                              <img src={a.previewUrl} alt="" className="h-full w-full object-cover" />
                            ) : null}
                            {a.kind === 'video' && a.previewUrl ? (
                              <video src={a.previewUrl} className="h-full w-full object-cover" muted />
                            ) : null}
                            {a.kind === 'audio' && a.previewUrl ? (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-2">
                                <audio src={a.previewUrl} controls className="w-full" />
                                <div className="text-[10px] text-slate-300 line-clamp-2 text-center">
                                  {isVoiceRecordingAttachment(a.name, a.file?.type || '')
                                    ? t({ it: 'Vocale', en: 'Voice note' })
                                    : a.name}
                                </div>
                              </div>
                            ) : null}
                            {a.kind === 'file' || !a.previewUrl ? (
                              <div className="flex h-full w-full flex-col items-center justify-center px-2 text-center">
                                <div className="text-[11px] font-semibold text-slate-200 line-clamp-2">{a.name}</div>
                                <div className="mt-1 text-[10px] text-slate-400">{formatBytes(a.sizeBytes)}</div>
                              </div>
                            ) : null}
                            <button
                              className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-slate-100 hover:bg-black/70"
                              onClick={() =>
                                setPendingAttachments((prev: any) => {
                                  const removing = prev.find((x: any) => x.id === a.id);
                                  if (removing?.previewUrl) URL.revokeObjectURL(removing.previewUrl);
                                  return prev.filter((x: any) => x.id !== a.id);
                                })
                              }
                              title={t({ it: 'Rimuovi', en: 'Remove' })}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
	                  {recording ? (
	                    <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-950/30 px-3 py-2">
	                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-2 w-2 rounded-full bg-rose-500" />
                          <span className="text-[12px] font-semibold text-slate-100 tabular-nums">{formatRec(recordSeconds)}</span>
                        </div>
	                        <div className="flex h-6 items-center gap-[2px]">
	                          {(waveform.length ? waveform : new Array(36).fill(0)).map((v: any, i: number) => {
	                            const h = 4 + Math.round(Math.min(1, Number(v) || 0) * 14);
	                            return (
	                              <span
	                                key={i}
	                                className="w-[2px] rounded-full bg-emerald-100/80"
	                                style={{ height: `${h}px`, opacity: 0.35 + Math.min(0.65, (Number(v) || 0) * 1.2) }}
	                              />
	                            );
	                          })}
	                        </div>
	                        <div className="text-[11px] text-slate-400 tabular-nums">
	                          {formatRec(MAX_VOICE_SECONDS)}
	                        </div>
	                      </div>
	                    </div>
	                  ) : null}
                  {err ? (
                    <div className="mb-2 rounded-xl border border-rose-900/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
                      {err}
                    </div>
                  ) : null}
                  <div className="flex items-end gap-2">
	                    <button
	                      className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950/40 text-slate-200 hover:bg-slate-900"
	                      onClick={pickFiles}
                      title={t({ it: 'Allega file (max 5MB)', en: 'Attach file (max 5MB)' })}
                      aria-label={t({ it: 'Allega file', en: 'Attach file' })}
	                      disabled={recording || dmReadOnly || dmBlockedByMe}
	                    >
                      <Paperclip size={18} />
                    </button>
		                    <button
	                      className={`flex h-11 w-11 items-center justify-center rounded-2xl border bg-slate-950/40 hover:bg-slate-900 ${
	                        recording ? 'border-rose-800 text-rose-200' : 'border-slate-700 text-slate-200'
	                      }`}
		                      onClick={() => (recording ? cancelRecording() : startRecording())}
	                      title={
	                        recording
	                          ? t({ it: `Annulla registrazione (${formatRec(recordSeconds)})`, en: `Cancel recording (${formatRec(recordSeconds)})` })
	                          : t({ it: 'Registra vocale', en: 'Record voice note' })
	                      }
		                      aria-label={t({ it: 'Vocale', en: 'Voice note' })}
		                      disabled={dmReadOnly || dmBlockedByMe}
		                    >
	                      {recording ? <Trash2 size={18} /> : <Mic size={18} />}
	                    </button>
                    <textarea
                      ref={composeTextareaRef}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={(e) => {
                        if (recording) return;
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          send();
                        }
                      }}
                      className="min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-primary/30 placeholder:text-slate-500 focus:ring-2"
                      placeholder={t({ it: 'Scrivi un messaggio…', en: 'Write a message…' })}
	                      rows={2}
	                      disabled={recording || dmReadOnly || dmBlockedByMe}
	                    />
		                    <button
	                      className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700"
	                      onClick={() => (recording ? stopRecording() : send())}
	                      title={recording ? t({ it: 'Invia vocale', en: 'Send voice note' }) : t({ it: 'Invia', en: 'Send' })}
		                      disabled={sending || dmReadOnly || dmBlockedByMe}
		                    >
	                      <Send size={18} />
	                    </button>
		                  </div>
		                  {/* Help moved to the Info button in the header */}
		                  </div>
  );
};
