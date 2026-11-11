// Detección de manos con MediaPipe Hand Landmarker (21 puntos).
const VER = '0.10.14';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let lm = null, on = false, lastTime = -1, lastRun = 0, pinch = false;

export async function startHands(video, cb) {
  if (on) return;
  if (!lm) {
    const { FilesetResolver, HandLandmarker } = await import(`${BASE}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    const opts = delegate => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO', numHands: 1,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
    });
    try { lm = await HandLandmarker.createFromOptions(files, opts('GPU')); }
    catch (e) { lm = await HandLandmarker.createFromOptions(files, opts('CPU')); }
  }
  on = true;
  const step = () => {
    if (!on) return;
    requestAnimationFrame(step);
    const now = performance.now();
    if (now - lastRun < 33 || video.readyState < 2 || video.currentTime === lastTime) return;
    lastRun = now; lastTime = video.currentTime;
    let r;
    try { r = lm.detectForVideo(video, now); } catch (e) { return; }
    const p = r.landmarks && r.landmarks[0];
    if (!p) { pinch = false; cb({ present: false }); return; }
    const W = video.videoWidth, H = video.videoHeight;
    const d = (a, b) => Math.hypot((p[a].x - p[b].x) * W, (p[a].y - p[b].y) * H);
    const ratio = d(4, 8) / (d(0, 9) || 1);          // distancia pulgar-índice / tamaño de la mano
    pinch = pinch ? ratio < 0.5 : ratio < 0.32;      // histéresis: evita parpadeos
    cb({ present: true, lm: p, pinch, px: p[8].x * 0.65 + p[4].x * 0.35, py: p[8].y * 0.65 + p[4].y * 0.35 });
  };
  step();
}

export function stopHands() { on = false; pinch = false; }
