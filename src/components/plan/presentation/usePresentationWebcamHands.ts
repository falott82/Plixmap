import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

export type PresentationWebcamCalib = { pinchRatio: number };
type Msg = { it: string; en: string };
export type PresentationGuideStep = 'enable' | 'calibrate' | 'pan' | 'open' | 'done';

type HandLandmarkerModule = any;
type HandLandmarkerInstance = any;

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

const classifyHandPose = (lm: any[]) => {
  if (!Array.isArray(lm) || lm.length < 21) return { openFive: false, panEnter: false, panStay: false };
  const palm = dist2d(lm[5], lm[17]);
  if (!Number.isFinite(palm) || palm <= 1e-3) return { openFive: false, panEnter: false, panStay: false };

  const spread = dist2d(lm[8], lm[20]) / palm;
  const gapIdxMid = dist2d(lm[8], lm[12]) / palm;
  const gapMidRing = dist2d(lm[12], lm[16]) / palm;
  const gapRingPinky = dist2d(lm[16], lm[20]) / palm;
  const minGap = Math.min(gapIdxMid, gapMidRing, gapRingPinky);
  const maxGap = Math.max(gapIdxMid, gapMidRing, gapRingPinky);

  // "Numero 5": dita ben aperte.
  const openFive = spread > 1.42 && minGap > 0.2 && maxGap > 0.3;
  // Mano "compatta" (dita vicine) per pan; enter/stay thresholds for hysteresis.
  const panEnter = spread >= 0.62 && spread <= 1.22 && maxGap <= 0.36;
  const panStay = spread >= 0.55 && spread <= 1.34 && maxGap <= 0.48;

  return { openFive, panEnter, panStay };
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
    numHands: 1,
    // Be permissive: presentation rooms can have bad lighting/webcams.
    minHandDetectionConfidence: 0.25,
    minHandPresenceConfidence: 0.25,
    minTrackingConfidence: 0.25
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
  setPan: (pan: { x: number; y: number }) => void;
  onResetView?: () => void;
  onInfo: (msg: Msg) => void;
  onError: (msg: Msg) => void;
}) {
  const { active, webcamEnabled, setWebcamEnabled, calib, setCalib, mapRef, getViewport, setPan, onResetView, onInfo, onError } =
    opts;

  const [webcamReady, setWebcamReady] = useState(false);
  const [handDetected, setHandDetected] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [guidePanDone, setGuidePanDone] = useState(false);
  const [guideOpenDone, setGuideOpenDone] = useState(false);
  const [guideShowDone, setGuideShowDone] = useState(false);

  // Avoid stale closures inside the MediaPipe rAF loop.
  const calibRef = useRef<PresentationWebcamCalib | null>(calib);
  const calibratingRef = useRef(false);
  const guidePanDoneRef = useRef(false);
  const guideOpenDoneRef = useRef(false);
  useEffect(() => {
    calibRef.current = calib;
  }, [calib]);
  useEffect(() => {
    calibratingRef.current = calibrating;
  }, [calibrating]);
  useEffect(() => {
    guidePanDoneRef.current = guidePanDone;
  }, [guidePanDone]);
  useEffect(() => {
    guideOpenDoneRef.current = guideOpenDone;
  }, [guideOpenDone]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<HandLandmarkerInstance | null>(null);
  const rafRef = useRef<number | null>(null);
  const destroyedRef = useRef(false);
  const startTokenRef = useRef(0);
  const handDetectedRef = useRef(false);

  const calibrateFramesRef = useRef(0);
  const calibrateSumRef = useRef(0);
  const lastCalibrateInfoAtRef = useRef(0);
  const lastCalibrateBucketRef = useRef(-1);
  const lastInferAtRef = useRef(0);
  const lastHandSeenAtRef = useRef(0);
  const lastNoHandHintAtRef = useRef(0);
  const calibrationStartAtRef = useRef(0);
  const calibrationHintShownRef = useRef(false);
  const calibrationSawHandRef = useRef(false);
  const resetHoldStartAtRef = useRef(0);
  const resetCooldownUntilRef = useRef(0);
  const resetHoldCenterRef = useRef<{ x: number; y: number } | null>(null);

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
    if (!webcamEnabled) {
      onInfo({ it: 'Attiva prima la webcam.', en: 'Enable the webcam first.' });
      return;
    }
    if (calibratingRef.current) return;
    calibratingRef.current = true;
    setCalibrating(true);
    setCalibrationProgress(0);
    calibrateFramesRef.current = 0;
    calibrateSumRef.current = 0;
    lastCalibrateInfoAtRef.current = performance.now();
    calibrationStartAtRef.current = performance.now();
    calibrationHintShownRef.current = false;
    calibrationSawHandRef.current = false;
    onInfo({ it: 'Calibrazione: fai un pinch e tienilo fermo per 1 secondo.', en: 'Calibration: pinch and hold still for 1 second.' });
  }, [onInfo, webcamEnabled]);

  const stop = useCallback(() => {
    startTokenRef.current += 1;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setWebcamReady(false);
    setHandDetected(false);
    handDetectedRef.current = false;
    calibratingRef.current = false;
    setCalibrating(false);
    setCalibrationProgress(0);
    setStarting(false);
    setGuidePanDone(false);
    setGuideOpenDone(false);
    setGuideShowDone(false);
    calibrateFramesRef.current = 0;
    calibrateSumRef.current = 0;
    lastCalibrateBucketRef.current = -1;
    pinchSessionRef.current.active = false;
    pinchSessionRef.current.startCenter = null;
    lastInferAtRef.current = 0;
    lastHandSeenAtRef.current = 0;
    lastNoHandHintAtRef.current = 0;
    calibrationStartAtRef.current = 0;
    calibrationHintShownRef.current = false;
    calibrationSawHandRef.current = false;
    resetHoldStartAtRef.current = 0;
    resetCooldownUntilRef.current = 0;
    resetHoldCenterRef.current = null;

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

  const enableWebcam = useCallback(async () => {
    if (!active) return false;
    if (!canUseWebcam) {
      onError({ it: 'Webcam non supportata dal browser.', en: 'Webcam not supported by the browser.' });
      return false;
    }
    if (starting) return false;
    if (streamRef.current && landmarkerRef.current) {
      setWebcamEnabled(true);
      return true;
    }

    setStarting(true);
    const token = ++startTokenRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Lower resolution = lower latency + fewer long rAF frames.
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      if (destroyedRef.current || token !== startTokenRef.current) {
        try {
          stream.getTracks().forEach((t) => t.stop());
        } catch {}
        return false;
      }

      streamRef.current = stream;
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      (video as any).srcObject = stream;
      videoRef.current = video;
      await video.play();

      const mod = await loadTasksVision();
      if (destroyedRef.current || token !== startTokenRef.current) return false;
      const landmarker = await createHandLandmarker(mod);
      if (destroyedRef.current || token !== startTokenRef.current) {
        try {
          landmarker?.close?.();
        } catch {}
        return false;
      }
      landmarkerRef.current = landmarker;
      setWebcamReady(true);
      setWebcamEnabled(true);
      setGuidePanDone(false);
      setGuideOpenDone(false);
      setGuideShowDone(false);
      setCalibrationProgress(0);
      onInfo({ it: 'Webcam attiva. Premi Calibra per iniziare.', en: 'Webcam enabled. Press Calibrate to start.' });

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const lmkr = landmarkerRef.current as any;
        const v = videoRef.current;
        if (!lmkr || !v) return;
        if (v.readyState < 2) return;

        // Throttle inference to reduce long frames.
        const now = performance.now();
        const minIntervalMs = 1000 / 8; // ~8 FPS is enough for pan/zoom and lighter on CPU.
        if (now - lastInferAtRef.current < minIntervalMs) {
          if (handDetectedRef.current && lastHandSeenAtRef.current && now - lastHandSeenAtRef.current > 700) {
            handDetectedRef.current = false;
            setHandDetected(false);
          }
          return;
        }
        lastInferAtRef.current = now;

        let res: any = null;
        try {
          res = lmkr.detectForVideo(v, now);
        } catch {
          return;
        }

        const lms = (res as any)?.landmarks?.[0] || null;
        if (!Array.isArray(lms)) {
          if (handDetectedRef.current && lastHandSeenAtRef.current && now - lastHandSeenAtRef.current > 700) {
            handDetectedRef.current = false;
            setHandDetected(false);
          }
          if (calibratingRef.current) {
            const elapsed = calibrationStartAtRef.current ? now - calibrationStartAtRef.current : 0;
            if (!calibrationHintShownRef.current && elapsed > 1200 && now - lastNoHandHintAtRef.current > 1000) {
              lastNoHandHintAtRef.current = now;
              calibrationHintShownRef.current = true;
              onInfo({
                it: 'Calibrazione: inquadra una mano e fai un pinch (pollice + indice).',
                en: 'Calibration: show one hand and pinch (thumb + index).'
              });
            }
            // Never keep calibration stuck forever: apply a safe default and continue.
            if (elapsed > 8000) {
              const fallback = { pinchRatio: 0.55 };
              calibRef.current = fallback;
              setCalib(fallback);
              calibratingRef.current = false;
              setCalibrating(false);
              setCalibrationProgress(100);
              lastCalibrateBucketRef.current = -1;
              onInfo({
                it: 'Calibrazione standard applicata. Se i gesti non sono fluidi, riprova avvicinando la mano alla webcam.',
                en: 'Default calibration applied. If gestures are not smooth, retry with your hand closer to the webcam.'
              });
            }
          }
          return;
        }

        const pinchRatio = computePinchRatio(lms);
        const center = computeHandCenter(lms);
        if (!center || pinchRatio == null) return;

        lastHandSeenAtRef.current = now;
        calibrationSawHandRef.current = true;
        if (!handDetectedRef.current) {
          handDetectedRef.current = true;
          setHandDetected(true);
        }

      if (calibratingRef.current) {
        // Require a pinch, but keep it permissive to work across cameras/lighting.
        const isPinch = pinchRatio <= 0.9;
        if (isPinch) {
          calibrateFramesRef.current += 1;
          calibrateSumRef.current += pinchRatio;
            const bucket = Math.min(4, Math.floor((calibrateFramesRef.current / 30) * 4)); // 0..4
            if (bucket !== lastCalibrateBucketRef.current && now - lastCalibrateInfoAtRef.current > 350) {
              lastCalibrateBucketRef.current = bucket;
              lastCalibrateInfoAtRef.current = now;
              const pct = Math.min(100, Math.round((calibrateFramesRef.current / 30) * 100));
              setCalibrationProgress(pct);
              onInfo({ it: `Calibrazione in corso… ${pct}%`, en: `Calibrating… ${pct}%` });
            }
          if (calibrateFramesRef.current >= 30) {
            const avg = calibrateSumRef.current / Math.max(1, calibrateFramesRef.current);
            const next = { pinchRatio: avg };
            calibRef.current = next;
            setCalib(next);
            calibratingRef.current = false;
            setCalibrating(false);
            setCalibrationProgress(100);
            lastCalibrateBucketRef.current = -1;
            onInfo({ it: 'Calibrazione completata. Pinch per pan e zoom.', en: 'Calibration completed. Pinch to pan and zoom.' });
          }
        } else {
          // reset if the user releases the pinch
          calibrateFramesRef.current = 0;
          calibrateSumRef.current = 0;
          lastCalibrateBucketRef.current = -1;
          const elapsed = calibrationStartAtRef.current ? now - calibrationStartAtRef.current : 0;
          if (elapsed > 8000) {
            const fallback = { pinchRatio: 0.55 };
            calibRef.current = fallback;
            setCalib(fallback);
            calibratingRef.current = false;
            setCalibrating(false);
            setCalibrationProgress(100);
            onInfo({
              it: 'Calibrazione standard applicata. Se i gesti non sono fluidi, riprova mantenendo il pinch fermo per 1 secondo.',
              en: 'Default calibration applied. If gestures are not smooth, retry and keep the pinch steady for 1 second.'
            });
          }
        }
        return;
      }

      const pose = classifyHandPose(lms);
        const mapEl = mapRef.current;
        const cw = mapEl?.clientWidth || 0;
        const ch = mapEl?.clientHeight || 0;
        if (cw <= 0 || ch <= 0) return;

        // Open hand "5": go back to default view (hold briefly to avoid accidental trigger).
        if (pose.openFive) {
          if (!resetHoldStartAtRef.current) {
            resetHoldStartAtRef.current = now;
            resetHoldCenterRef.current = center;
          } else if (resetHoldCenterRef.current) {
            // Keep the hand relatively still while holding "5".
            const driftNorm = Math.hypot(center.x - resetHoldCenterRef.current.x, center.y - resetHoldCenterRef.current.y);
            if (driftNorm > 0.065) {
              resetHoldStartAtRef.current = now;
              resetHoldCenterRef.current = center;
            }
          }
          const holdMs = now - resetHoldStartAtRef.current;
          if (holdMs >= 550 && now >= resetCooldownUntilRef.current) {
            resetCooldownUntilRef.current = now + 2500;
            resetHoldStartAtRef.current = 0;
            resetHoldCenterRef.current = null;
            pinchSessionRef.current.active = false;
            pinchSessionRef.current.startCenter = null;
            smoothedRef.current = null;
            if (!guideOpenDoneRef.current) {
              guideOpenDoneRef.current = true;
              setGuideOpenDone(true);
              setGuideShowDone(true);
            }
            onResetView?.();
            onInfo({
              it: 'Vista predefinita ripristinata (gesto mano aperta).',
              en: 'Default view restored (open-hand gesture).'
            });
            return;
          }
        } else {
          resetHoldStartAtRef.current = 0;
          resetHoldCenterRef.current = null;
        }

        const session = pinchSessionRef.current;
        const panActive = session.active ? pose.panStay && !pose.openFive : pose.panEnter && !pose.openFive;
        if (panActive && !session.active) {
          const { pan } = getViewport();
          session.active = true;
          session.startCenter = center;
          session.startPan = pan;
          session.startZoom = getViewport().zoom;
          session.startPinchRatio = pinchRatio;
          smoothedRef.current = { pan, zoom: getViewport().zoom };
        } else if (!panActive && session.active) {
          session.active = false;
          session.startCenter = null;
          smoothedRef.current = null;
        }

        if (!session.active || !session.startCenter) return;

        const panGain = 1.05;
        const deadZonePx = 14;
        const rawDx = (center.x - session.startCenter.x) * cw;
        const rawDy = (center.y - session.startCenter.y) * ch;
        const dx = Math.abs(rawDx) <= deadZonePx ? 0 : (rawDx - Math.sign(rawDx) * deadZonePx) * panGain;
        const dy = Math.abs(rawDy) <= deadZonePx ? 0 : (rawDy - Math.sign(rawDy) * deadZonePx) * panGain;
        if (!guidePanDoneRef.current && Math.hypot(dx, dy) > 18) {
          guidePanDoneRef.current = true;
          setGuidePanDone(true);
        }
        const targetPan = { x: session.startPan.x + dx, y: session.startPan.y + dy };

        const current = getViewport();
        const smooth = smoothedRef.current || { pan: current.pan, zoom: current.zoom };
        const next = {
          pan: { x: lerp(smooth.pan.x, targetPan.x, 0.2), y: lerp(smooth.pan.y, targetPan.y, 0.2) },
          zoom: current.zoom
        };
        smoothedRef.current = next;
        setPan(next.pan);
        // Pan only: do not change zoom with gestures.
      };

      rafRef.current = requestAnimationFrame(tick);
      return true;
    } catch (e: any) {
      const name = String(e?.name || '');
      const itHint =
        name === 'NotAllowedError'
          ? 'Consenti la camera e riprova. Se sei in fullscreen, clicca di nuovo il bottone.'
          : name === 'NotFoundError'
            ? 'Nessuna camera trovata.'
            : name === 'NotReadableError'
              ? 'La camera e gia in uso da un’altra app.'
              : name === 'SecurityError'
                ? 'Richiede HTTPS o localhost.'
                : 'Riprova.';
      const enHint =
        name === 'NotAllowedError'
          ? 'Allow camera access and try again. If you are in fullscreen, click the button again.'
          : name === 'NotFoundError'
            ? 'No camera was found.'
            : name === 'NotReadableError'
              ? 'The camera is already in use by another app.'
              : name === 'SecurityError'
                ? 'Requires HTTPS or localhost.'
                : 'Please try again.';
      onError({
        it: `Impossibile attivare la webcam${name ? ` (${name})` : ''}. ${itHint}`,
        en: `Unable to enable the webcam${name ? ` (${name})` : ''}. ${enHint}`
      });
      setWebcamEnabled(false);
      stop();
      return false;
    } finally {
      if (token === startTokenRef.current) setStarting(false);
    }
  }, [active, canUseWebcam, getViewport, mapRef, onError, onInfo, onResetView, setCalib, setPan, setWebcamEnabled, starting, stop]);

  useEffect(() => {
    if (!guideOpenDone) return;
    const id = window.setTimeout(() => setGuideShowDone(false), 2600);
    return () => window.clearTimeout(id);
  }, [guideOpenDone]);

  useEffect(() => {
    if (!active || !webcamEnabled) return;
    if (starting) return;
    if (calibratingRef.current) return;
    if (calibRef.current) return;
    const id = window.setTimeout(() => requestCalibrate(), 450);
    return () => window.clearTimeout(id);
  }, [active, starting, requestCalibrate, webcamEnabled, calib, calibrating]);

  const disableWebcam = useCallback(() => {
    setWebcamEnabled(false);
    stop();
  }, [setWebcamEnabled, stop]);

  const toggleWebcam = useCallback(() => {
    if (starting) return;
    if (webcamEnabled) {
      disableWebcam();
      return;
    }
    // Start from the click handler (user gesture) to avoid NotAllowedError in fullscreen.
    void enableWebcam();
  }, [disableWebcam, enableWebcam, starting, webcamEnabled]);

  useEffect(() => {
    if (active) return;
    if (webcamEnabled || streamRef.current || landmarkerRef.current) {
      onInfo({
        it: 'Webcam disattivata: hai lasciato la modalità Presentazione.',
        en: 'Webcam disabled: you left Presentation mode.'
      });
    }
    disableWebcam();
  }, [active, disableWebcam, onInfo, webcamEnabled]);

  const guideStep: PresentationGuideStep = !webcamEnabled
    ? 'enable'
    : calibrating || !calib
      ? 'calibrate'
      : !guidePanDone
        ? 'pan'
        : !guideOpenDone
          ? 'open'
          : 'done';
  const guideVisible = !!active && (guideStep !== 'done' || guideShowDone);

  return {
    webcamReady,
    handDetected,
    calibrating,
    starting,
    requestCalibrate,
    toggleWebcam,
    guideStep,
    guideVisible,
    calibrationProgress,
    guidePanDone,
    guideOpenDone
  };
}
