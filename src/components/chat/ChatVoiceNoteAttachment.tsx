/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { seededBars, clamp01, formatMmSs, formatBytes } from './ClientChatDock.helpers';

// WhatsApp-like voice-note player (waveform + seek). Extracted from ClientChatDock.
export const ChatVoiceNoteAttachment = ({
  url,
  mine,
  seed,
  sizeBytes,
  t
}: {
  url: string;
  mine: boolean;
  seed: string;
  sizeBytes?: number;
  t: any;
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const rafLastTsRef = useRef<number>(0);
  const bars = useMemo(() => seededBars(seed, 48), [seed]);
  const pct = dur > 0 ? clamp01(cur / dur) : 0;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onMeta = () => setDur(Number(el.duration) || 0);
    const onTime = () => setCur(Number(el.currentTime) || 0);
    const onSeeked = () => setCur(Number(el.currentTime) || 0);
    const startRaf = () => {
      if (rafRef.current) return;
      rafLastTsRef.current = 0;
      const tick = (ts: number) => {
        const a = audioRef.current;
        if (!a) return;
        if (a.paused) {
          rafRef.current = null;
          return;
        }
        // ~60fps is ok for a single playing voice note.
        if (!rafLastTsRef.current || ts - rafLastTsRef.current > 16) {
          rafLastTsRef.current = ts;
          setCur(Number(a.currentTime) || 0);
        }
        rafRef.current = window.requestAnimationFrame(tick);
      };
      rafRef.current = window.requestAnimationFrame(tick);
    };
    const stopRaf = () => {
      if (!rafRef.current) return;
      window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
    const onPlay = () => {
      setPlaying(true);
      startRaf();
    };
    const onPause = () => {
      setPlaying(false);
      stopRaf();
      setCur(Number(el.currentTime) || 0);
    };
    const onEnd = () => {
      setPlaying(false);
      stopRaf();
      try {
        el.currentTime = 0;
      } catch {}
      setCur(0);
    };
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('seeked', onSeeked);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnd);
    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('seeked', onSeeked);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      if (el.paused) await el.play();
      else el.pause();
    } catch {
      // ignore
    }
  };

  const seekToPct = (p: number) => {
    const el = audioRef.current;
    if (!el || !dur) return;
    const next = clamp01(p) * dur;
    el.currentTime = next;
    setCur(next);
  };

  const bg = mine ? 'bg-emerald-950/35 border-emerald-400/20' : 'bg-slate-950/25 border-slate-700';
  const waveFg = mine ? 'bg-emerald-100/80' : 'bg-slate-200/70';
  const waveBg = mine ? 'bg-emerald-200/20' : 'bg-slate-200/15';

  return (
      <div className={`w-full rounded-2xl border ${bg} px-3 py-2`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          className={`flex h-10 w-10 items-center justify-center rounded-full border ${
            mine ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50' : 'border-slate-700 bg-slate-900/40 text-slate-100'
          }`}
          title={playing ? t({ it: 'Pausa', en: 'Pause' }) : t({ it: 'Play', en: 'Play' })}
          aria-label={playing ? t({ it: 'Pausa', en: 'Pause' }) : t({ it: 'Play', en: 'Play' })}
        >
          {playing ? (
            <span className="inline-flex gap-1">
              <span className="h-4 w-1.5 rounded-sm bg-current" />
              <span className="h-4 w-1.5 rounded-sm bg-current" />
            </span>
          ) : (
            <span className="ml-0.5 inline-block h-0 w-0 border-y-[7px] border-y-transparent border-l-[10px] border-l-current" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div
            className="relative h-10 cursor-pointer select-none"
            onMouseDown={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const p = rect.width ? (e.clientX - rect.left) / rect.width : 0;
              seekToPct(p);
            }}
            title={t({ it: 'Trascina per avanzare', en: 'Drag to seek' })}
          >
            <div className={`absolute inset-0 rounded-xl ${waveBg}`} />
            <div className="absolute inset-0 flex items-center justify-between px-0">
              {bars.map((v, i) => {
                const barPct = bars.length > 1 ? i / (bars.length - 1) : 0;
                const active = barPct <= pct;
                const h = 4 + Math.round(v * 16);
                return (
                  <span
                    key={i}
                    className={`w-[2px] rounded-full ${active ? waveFg : ''}`}
                    style={{
                      height: `${h}px`,
                      backgroundColor: active ? undefined : 'rgba(255,255,255,0.18)'
                    }}
                  />
                );
              })}
            </div>
            <span
              className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border ${
                mine ? 'border-emerald-100/70 bg-emerald-100' : 'border-slate-100/70 bg-slate-100'
              }`}
              style={{ left: `clamp(0px, calc(${pct * 100}% - 6px), calc(100% - 12px))` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
            <span className="tabular-nums">{formatMmSs(dur || cur || 0)}</span>
            {typeof sizeBytes === 'number' && sizeBytes > 0 ? (
              <span className="tabular-nums text-slate-400">{formatBytes(sizeBytes)}</span>
            ) : (
              <span />
            )}
          </div>
        </div>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" className="hidden" />
    </div>
  );
};
