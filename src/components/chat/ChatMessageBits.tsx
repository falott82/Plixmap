/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ChatMessage } from '../../api/chat';
import { ChatVoiceNoteAttachment } from './ChatVoiceNoteAttachment';
import { extOf, formatBytes, CHAT_REACTIONS } from './ClientChatDock.helpers';

// Renders a chat message's attachments (images, video, audio/voice notes, files).
// Extracted from ClientChatDock.
export const ChatMessageAttachments = (props: any) => {
  const { m, user, setMediaModal, t } = props as {
    m: ChatMessage;
    user: any;
    setMediaModal: (v: { url: string; name: string }) => void;
    t: any;
  };
  const list = Array.isArray(m.attachments) ? m.attachments : [];
  if (!list.length) return null;
  const mine = String(m.userId) === String(user?.id || '');
  return (
    <div className="mt-2 space-y-2">
      {list.map((a, idx) => {
        const url = String((a as any).url || '');
        const name = String((a as any).name || url);
        const mime = String((a as any).mime || '');
        const ext = extOf(name);
        const isImg = mime.startsWith('image/') || (!mime && ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext));
        const isAud = mime.startsWith('audio/') || (!mime && ['mp3', 'wav', 'm4a', 'aac', 'ogg'].includes(ext));
        const isVid = (mime.startsWith('video/') || (!mime && ['mp4', 'webm', 'mov'].includes(ext))) && !isAud;
        const isVoice = name.toLowerCase().startsWith('voice-') && isAud;
        if (isImg) {
          return (
            <button
              key={`${url}:${idx}`}
              type="button"
              onClick={() => setMediaModal({ url, name })}
              className="block w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-950/30 hover:border-slate-600"
              title={name}
            >
              <img src={url} alt="" className="max-h-48 w-full object-cover" />
            </button>
          );
        }
        if (isVid) {
          return (
            <div
              key={`${url}:${idx}`}
              className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/30"
              title={name}
            >
              <video src={url} controls className="max-h-56 w-full" />
            </div>
          );
        }
        if (isAud) {
          if (isVoice) {
            return (
              <ChatVoiceNoteAttachment
                key={`${url}:${idx}`}
                url={url}
                mine={mine}
                seed={`${m.id}:${idx}:${url}`}
                sizeBytes={Number((a as any).sizeBytes) || 0}
                t={t}
              />
            );
          }
          return (
            <div
              key={`${url}:${idx}`}
              className="overflow-hidden rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2"
              title={isVoice ? t({ it: 'Vocale', en: 'Voice note' }) : name}
            >
              {!isVoice ? (
                <div className="mb-1 flex items-center justify-between gap-2 text-[12px] text-slate-200">
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(Number((a as any).sizeBytes) || 0)}</span>
                </div>
              ) : null}
              <audio src={url} controls className="w-full" />
            </div>
          );
        }
        return (
          <a
            key={`${url}:${idx}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            download={name}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/30 px-3 py-2 text-[12px] text-slate-100 hover:border-slate-600"
            title={name}
          >
            <span className="min-w-0 truncate">{name}</span>
            <span className="shrink-0 text-[11px] text-slate-400">{formatBytes(Number((a as any).sizeBytes) || 0)}</span>
          </a>
        );
      })}
    </div>
  );
};

// Renders a chat message's reaction chips. Extracted from ClientChatDock.
export const ChatMessageReactions = (props: any) => {
  const { m, user, toggleReaction, setReactionsModal, t } = props as {
    m: ChatMessage;
    user: any;
    toggleReaction: (msg: ChatMessage, emoji: string) => void;
    setReactionsModal: (v: { messageId: string; tab: 'all' | string }) => void;
    t: any;
  };
  const reactions = (m as any).reactions && typeof (m as any).reactions === 'object' ? ((m as any).reactions as Record<string, string[]>) : {};
  const keys = CHAT_REACTIONS.filter((e) => Array.isArray(reactions[e]) && reactions[e]!.length);
  if (!keys.length) return null;
  const myId = String(user?.id || '');
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {keys.map((emoji) => {
        const list = Array.isArray(reactions[emoji]) ? reactions[emoji]! : [];
        const count = list.length;
        const mine = !!myId && list.some((id) => String(id) === myId);
        return (
          <button
            key={emoji}
            type="button"
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] ${
              'border-slate-700 bg-slate-950/30 text-slate-100 hover:border-slate-600'
            }`}
            onClick={() => {
              // WhatsApp-like: if you reacted with this emoji, clicking it removes your reaction.
              if (mine) {
                toggleReaction(m, emoji);
                return;
              }
              setReactionsModal({ messageId: m.id, tab: emoji });
            }}
            title={t({ it: 'Dettagli reazioni', en: 'Reaction details' })}
          >
            <span className="text-[14px] leading-none">{emoji}</span>
            <span className="tabular-nums text-[11px] font-semibold">{count}</span>
          </button>
        );
      })}
    </div>
  );
};
