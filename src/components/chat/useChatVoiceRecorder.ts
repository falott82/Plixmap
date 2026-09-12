/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useRef, useState } from 'react';
import { sendChatMessage } from '../../api/chat';
import { useChatStore } from '../../store/useChatStore';
import { extForMime, MAX_VOICE_BYTES, MAX_VOICE_SECONDS } from './ClientChatDock.helpers';

// Voice-note recorder (MediaRecorder + live waveform + auto-send) extracted from ClientChatDock.
export const useChatVoiceRecorder = (deps: any) => {
  const {
    clientChatClientId,
    user,
    sending,
    setSending,
    setErr,
    setReplyToId,
    replyToIdRef,
    scrollToBottomSoon,
    clearChatUnread,
    onFilesPicked,
    t
  } = deps;

  const [recording, setRecording] = useState(false);
  const recordStartAtRef = useRef<number>(0);
  const recordTimerRef = useRef<number | null>(null);
  const recordRafRef = useRef<number | null>(null);
  const recordStoppedForMaxRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const discardRecordingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const waveformBufRef = useRef<number[]>([]);
  const waveformLastPushAtRef = useRef<number>(0);
  const [waveform, setWaveform] = useState<number[]>([]);

  // Stop any active recording and release the microphone (used on chat close/unmount).
  // Stable identity (refs + stable setters only) so callers can list it in effect deps.
  const resetRecording = useCallback(() => {
    try {
      recorderRef.current?.stop();
    } catch {}
    recorderRef.current = null;
    if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
    recordTimerRef.current = null;
    try {
      recordStreamRef.current?.getTracks()?.forEach((tr) => tr.stop());
    } catch {}
    recordStreamRef.current = null;
    recordChunksRef.current = [];
    setRecording(false);
    setRecordSeconds(0);
  }, []);

  const stopRecording = () => {
    try {
      recorderRef.current?.stop();
    } catch {}
  };

  const cancelRecording = () => {
    discardRecordingRef.current = true;
    stopRecording();
  };

  const sendVoiceFileNow = async (file: File) => {
    if (!clientChatClientId || !user?.id) return;
    if (!file) return;
    if (sending) {
      throw new Error(t({ it: 'Invio in corso. Riprova.', en: 'Send in progress. Please try again.' }));
    }
    setSending(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => resolve(String(reader.result || ''));
        reader.readAsDataURL(file);
      }).catch(() => '');
      if (!dataUrl.startsWith('data:') || !dataUrl.includes(';base64,')) {
        throw new Error(t({ it: `Errore lettura vocale.`, en: `Failed to read voice note.` }));
      }
      const res = await sendChatMessage(clientChatClientId, '', [{ name: file.name, dataUrl }], {
        replyToId: replyToIdRef.current
      });
      useChatStore.getState().upsertMessage(clientChatClientId, res.message);
      clearChatUnread(clientChatClientId);
      setErr(null);
      setReplyToId(null);
      scrollToBottomSoon();
    } finally {
      setSending(false);
    }
  };

  const startRecording = async () => {
    if (recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr(t({ it: 'Microfono non supportato dal browser.', en: 'Microphone not supported by this browser.' }));
      return;
    }
    // Chrome (and most browsers) require a secure context for getUserMedia unless on localhost.
    // When running Plixmap on plain http://<lan-ip>, the browser will deny without prompting.
    if (!window.isSecureContext) {
      const host = window.location?.hostname || '';
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (!isLocalhost) {
        setErr(
          t({
            it: `Il microfono in Chrome funziona solo su HTTPS (o su http://localhost). Apri Plixmap in HTTPS per usare i vocali. Origin: ${window.location?.origin || ''}`,
            en: `Microphone requires HTTPS (or http://localhost). Open Plixmap in HTTPS to record voice notes. Origin: ${window.location?.origin || ''}`
          })
        );
        return;
      }
    }
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStreamRef.current = stream;
      discardRecordingRef.current = false;
      setWaveform([]);
      waveformBufRef.current = [];
      waveformLastPushAtRef.current = 0;

      // Real-time waveform preview (WhatsApp-like).
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.65;
        source.connect(analyser);
        analyserRef.current = analyser;
        const buf = new Uint8Array(analyser.fftSize);
        const tick = () => {
          const a = analyserRef.current;
          if (!a) return;
          a.getByteTimeDomainData(buf);
          // RMS amplitude, normalized 0..1
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          const rms = Math.min(1, Math.sqrt(sum / buf.length));
          // Make it visually closer to WhatsApp (more reactive on low volume).
          const leveled = Math.min(1, Math.max(0, Math.pow(Math.max(0, rms - 0.01), 0.45) * 1.15));
          const now = Date.now();
          // Push ~14 samples/sec to keep UI smooth without rerendering every frame.
          if (now - waveformLastPushAtRef.current > 70) {
            waveformLastPushAtRef.current = now;
            const next = waveformBufRef.current.slice();
            next.push(leveled);
            // Keep a short history for the preview strip.
            while (next.length > 90) next.shift();
            waveformBufRef.current = next;
            setWaveform(next);
          }
          recordRafRef.current = window.requestAnimationFrame(tick);
        };
        recordRafRef.current = window.requestAnimationFrame(tick);
      } catch {
        // ignore waveform errors (still allow recording)
      }
      const pickMime = () => {
        const candidates = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/ogg'];
        for (const m of candidates) {
          try {
            if (typeof MediaRecorder !== 'undefined' && (MediaRecorder as any).isTypeSupported?.(m)) return m;
          } catch {}
        }
        return '';
      };
      const mimeType = pickMime();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;
      recordChunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) recordChunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        const chunks = recordChunksRef.current.slice();
        recordChunksRef.current = [];
        if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
        if (recordRafRef.current) window.cancelAnimationFrame(recordRafRef.current);
        recordRafRef.current = null;
        analyserRef.current = null;
        try {
          audioCtxRef.current?.close?.();
        } catch {}
        audioCtxRef.current = null;
        setRecording(false);
        setRecordSeconds(0);
        try {
          recordStreamRef.current?.getTracks()?.forEach((t) => t.stop());
        } catch {}
        recordStreamRef.current = null;

        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          setWaveform([]);
          waveformBufRef.current = [];
          return;
        }

        if (!chunks.length) return;
        const rawType = String(rec.mimeType || mimeType || 'audio/webm');
        const baseType = rawType.split(';')[0] || 'audio/webm';
        const blob = new Blob(chunks, { type: baseType });
        const ext = extForMime(baseType) || 'webm';
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: baseType });
        if ((Number(file.size) || 0) > MAX_VOICE_BYTES) {
          setErr(
            t({
              it: `Vocale troppo grande. Riprova con una registrazione piu breve.`,
              en: `Voice note too large. Please record a shorter message.`
            })
          );
          return;
        }
        try {
          await sendVoiceFileNow(file);
        } catch (e) {
          // Fallback: keep it as a pending attachment if auto-send fails.
          setErr(e instanceof Error ? e.message : t({ it: 'Errore invio vocale.', en: 'Failed to send voice note.' }));
          await onFilesPicked([file]);
        }
      };

      recordStartAtRef.current = Date.now();
      setRecording(true);
      setRecordSeconds(0);
      recordStoppedForMaxRef.current = false;
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - recordStartAtRef.current) / 1000);
        const safe = Math.max(0, secs);
        setRecordSeconds(safe);
        if (safe >= MAX_VOICE_SECONDS) {
          // auto-stop at 10 minutes
          if (!recordStoppedForMaxRef.current) {
            recordStoppedForMaxRef.current = true;
            setErr(t({ it: 'Registrazione fermata: massimo 10 minuti.', en: 'Recording stopped: max 10 minutes.' }));
            try {
              stopRecording();
            } catch {}
          }
        }
      }, 250);
      rec.start();
    } catch (e) {
      const errAny = e as any;
      const name = String(errAny?.name || '');
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setErr(
          t({
            it:
              'Permesso microfono negato o bloccato dal browser. Controlla il permesso del sito (icona lucchetto nella barra indirizzi) e riprova.',
            en:
              'Microphone permission denied or blocked by the browser. Check site permissions (lock icon in the address bar) and try again.'
          })
        );
      } else if (name === 'NotFoundError') {
        setErr(t({ it: 'Nessun microfono trovato sul dispositivo.', en: 'No microphone found on this device.' }));
      } else if (name === 'NotReadableError') {
        setErr(
          t({
            it: 'Impossibile accedere al microfono (forse è già in uso da un’altra app).',
            en: 'Unable to access the microphone (it may be in use by another app).'
          })
        );
      } else {
        setErr(e instanceof Error ? e.message : t({ it: 'Accesso al microfono negato.', en: 'Microphone access denied.' }));
      }
      try {
        recordStreamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
      recordStreamRef.current = null;
      recorderRef.current = null;
      recordChunksRef.current = [];
      setRecording(false);
      setRecordSeconds(0);
      recordStoppedForMaxRef.current = false;
      if (recordRafRef.current) window.cancelAnimationFrame(recordRafRef.current);
      recordRafRef.current = null;
      analyserRef.current = null;
      try {
        audioCtxRef.current?.close?.();
      } catch {}
      audioCtxRef.current = null;
      setWaveform([]);
      waveformBufRef.current = [];
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const formatRec = (secs: number) => {
    const s = Math.max(0, Math.floor(secs || 0));
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  return { recording, recordSeconds, waveform, startRecording, stopRecording, cancelRecording, resetRecording, formatRec };
};
