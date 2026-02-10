import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type PresentationWebcamCalib = { pinchRatio: number };
type Msg = { it: string; en: string };

type HandLandmarkerModule = any;
type HandLandmarkerInstance = any;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const dist2d = (a: any, b: any) => Math.hypot(Number(a?.x || 0) - Number(b?.x || 0), Number(a?.y || 0) - Number(b?.y || 0));

const computeHandCenter = (lm: any[]) => {
  if (!Array.isArray(lm) || lm.length < 18) return null;
  const ids = [0, 5, 9, 13, 17];
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const id of ids) {
    const p = lm[id];
    const x = Number(p?.x);
    const y = Number(p?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    sx += x;
    sy += y;
    n += 1;
  }
  if (!n) return null;
  return { x: sx / n, y: sy / n };
};

const computePinchRatio = (lm: any[]) => {
  if (!Array.isArray(lm) || lm.length < 18) return null;
  const thumbTip = lm[4];
  const indexTip = lm[8];
  const indexMcp = lm[5];
  const pinkyMcp = lm[17];
  const pinch = dist2d(thumbTip, indexTip);
  const palm = dist2d(indexMcp, pinkyMcp);
  if (!Number.isFinite(pinch) || !Number.isFinite(palm) || palm <= 0) return null;
  return pinch / palm;
};

async function loadTasksVision(): Promise<HandLandmarkerModule> {
  // Runtime CDN import to keep the bundle lightweight and avoid hard deps.
  // Chrome-only is OK for now; if this fails we fall back gracefully.
  const url = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/vision_bundle.mjs';
  return import(/* @vite-ignore */ url);
}

async function createHandLandmarker(mod: HandLandmarkerModule): Promise<HandLandmarkerInstance> {
  const { FilesetResolver, HandLandmarker } = mod || {};
  if (!FilesetResolver || !HandLandmarker) throw new Error('Missing MediaPipe Tasks exports');

  const vision = await FilesetResolver.forVisionTasks(
    // wasm root
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
  );

  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      // Public model hosted by Google (downloaded by the browser at runtime).
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
    },
    runningMode: 'VIDEO',
    numHands: 1
  });
}

export function usePresentationWebcamHands(opts: {
  active: boolean;
  webcamEnabled: boolean;
  setWebcamEnabled: (enabled: boolean) => void;
  calib: PresentationWebcamCalib | null;
  setCalib: (calib: PresentationWebcamCalib | null) => void;
  mapRef: RefObject<HTMLDivElement>;
  getViewport: () => { zoom: number; pan: { x: number; y: number } };
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  onInfo: (msg: Msg) => void;
  onError: (msg: Msg) => void;
}) {
  const { active, webcamEnabled, setWebcamEnabled, calib, setCalib, mapRef, getViewport, setZoom, setPan, onInfo, onError } =
    opts;

  const [webcamReady, setWebcamReady] = useState(false);
  const [calibrating, setCalibrating] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  const destroyedRef = useRef(false);

  const calibrateFramesRef = useRef(0);
  const calibrateSumRef = useRef(0);

  const pinchSessionRef = useRef<{
    active: boolean;
    startCenter: { x: number; y: number } | null;
    startPan: { x: number; y: number };
    startZoom: number;
    startPinchRatio: number;
  }>({ active: false, startCenter: null, startPan: { x: 0, y: 0 }, startZoom: 1, startPinchRatio: 0 });

  const smoothedRef = useRef<{ pan: { x: number; y: number }; zoom: number } | null>(null);

  const canUseWebcam = useMemo(() => {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }, []);

  const requestCalibrate = useCallback(() => {
    if (!webcamEnabled) return;
    setCalibrating(true);
    calibrateFramesRef.current = 0;
    calibrateSumRef.current = 0;
    onInfo({ it: 'Calibrazione: fai un pinch e tienilo fermo per 1 secondo.', en: 'Calibration: pinch and hold still for 1 second.' });
  }, [onInfo, webcamEnabled]);

  const stop = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setWebcamReady(false);
    setCalibrating(false);
    calibrateFramesRef.current = 0;
    calibrateSumRef.current = 0;
    pinchSessionRef.current.active = false;
    pinchSessionRef.current.startCenter = null;

    const stream = streamRef.current;
    streamRef.current = null;
    try {
      stream?.getTracks?.().forEach((t) => t.stop());
    } catch {}

    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
      } catch {}
      try {
        (video as any).srcObject = null;
      } catch {}
    }

    const lm = landmarkerRef.current as any;
    landmarkerRef.current = null;
    try {
      lm?.close?.();
    } catch {}
  }, []);

  useEffect(() => {
    destroyedRef.current = false;
    return () => {
      destroyedRef.current = true;
      stop();
    };
  }, [stop]);

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    if (!webcamEnabled) {
      stop();
      return;
    }
    if (!canUseWebcam) {
      onError({ it: 'Webcam non supportata dal browser.', en: 'Webcam not supported by the browser.' });
      setWebcamEnabled(false);
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (cancelled || destroyedRef.current) {
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch {}
          return;
        }
        streamRef.current = stream;
        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        (video as any).srcObject = stream;
        videoRef.current = video;
        await video.play();

        const mod = await loadTasksVision();
        if (cancelled || destroyedRef.current) return;
        const landmarker = await createHandLandmarker(mod);
        if (cancelled || destroyedRef.current) {
          try {
            landmarker?.close?.();
          } catch {}
          return;
        }
        landmarkerRef.current = landmarker;
        onInfo({ it: 'Webcam attiva. Premi Calibra per iniziare.', en: 'Webcam enabled. Press Calibrate to start.' });

        const tick = () => {
          rafRef.current = requestAnimationFrame(tick);
          const lmkr = landmarkerRef.current as any;
          const v = videoRef.current;
          if (!lmkr || !v) return;
          if (v.readyState < 2) return;

          let res: any = null;
          try {
            res = lmkr.detectForVideo(v, performance.now());
          } catch {
            return;
          }

          const lms = (res as any)?.landmarks?.[0] || null;
          if (!Array.isArray(lms)) return;

          const pinchRatio = computePinchRatio(lms);
          const center = computeHandCenter(lms);
          if (!center || pinchRatio == null) return;

          setWebcamReady(true);

          if (calibrating) {
            // Require a reasonably closed pinch to calibrate.
            const isPinch = pinchRatio <= 0.65;
            if (isPinch) {
              calibrateFramesRef.current += 1;
              calibrateSumRef.current += pinchRatio;
              if (calibrateFramesRef.current >= 30) {
                const avg = calibrateSumRef.current / Math.max(1, calibrateFramesRef.current);
                setCalib({ pinchRatio: avg });
                setCalibrating(false);
                onInfo({ it: 'Calibrazione completata. Pinch per pan e zoom.', en: 'Calibration completed. Pinch to pan and zoom.' });
              }
            } else {
              // reset if the user releases the pinch
              calibrateFramesRef.current = 0;
              calibrateSumRef.current = 0;
            }
            return;
          }

          if (!calib) return;

          const pinchActive = pinchRatio <= calib.pinchRatio * 1.35;
          const mapEl = mapRef.current;
          const cw = mapEl?.clientWidth || 0;
          const ch = mapEl?.clientHeight || 0;
          if (cw <= 0 || ch <= 0) return;

          const session = pinchSessionRef.current;
          if (pinchActive && !session.active) {
            const { zoom, pan } = getViewport();
            session.active = true;
            session.startCenter = center;
            session.startPan = pan;
            session.startZoom = zoom;
            session.startPinchRatio = pinchRatio;
            smoothedRef.current = { pan, zoom };
          } else if (!pinchActive && session.active) {
            session.active = false;
            session.startCenter = null;
          }

          if (!session.active || !session.startCenter) return;

          const panGain = 1.25;
          const zoomGain = 2.2;

          const dx = (center.x - session.startCenter.x) * cw * panGain;
          const dy = (center.y - session.startCenter.y) * ch * panGain;
          const targetPan = { x: session.startPan.x + dx, y: session.startPan.y + dy };

          const pinchDelta = pinchRatio - session.startPinchRatio;
          const factor = clamp(1 + pinchDelta * zoomGain, 0.6, 1.6);
          const targetZoom = clamp(session.startZoom * factor, 0.2, 3);

          const smooth = smoothedRef.current || { pan: getViewport().pan, zoom: getViewport().zoom };
          const next = {
            pan: { x: lerp(smooth.pan.x, targetPan.x, 0.22), y: lerp(smooth.pan.y, targetPan.y, 0.22) },
            zoom: lerp(smooth.zoom, targetZoom, 0.22)
          };
          smoothedRef.current = next;
          setPan(next.pan);
          setZoom(next.zoom);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (e: any) {
        onError({
          it: 'Impossibile attivare la webcam (permesso negato o errore).',
          en: 'Unable to enable the webcam (permission denied or error).'
        });
        setWebcamEnabled(false);
        stop();
      }
    };

    start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [active, calib, calibrating, canUseWebcam, getViewport, mapRef, onError, onInfo, setCalib, setPan, setWebcamEnabled, setZoom, stop, webcamEnabled]);

  return { webcamReady, calibrating, requestCalibrate };
}
