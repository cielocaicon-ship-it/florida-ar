// Detección de manos con MediaPipe Hand Landmarker (21 puntos).
// Devuelve: punta del índice (cursor), pinza y pose de la mano (señalar / palma abierta / puño).
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
      minHandDetectionConfidence: 0.4, minHandPresenceConfidence: 0.4, minTrackingConfidence: 0.4
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
    const size = d(0, 9) || 1;
    const ratio = d(4, 8) / size;
    pinch = pinch ? ratio < 0.45 : ratio < 0.28;              // histéresis
    const ext = (tip, pip) => d(0, tip) > d(0, pip) * 1.12;  // dedo estirado
    const i = ext(8, 6), m = ext(12, 10), rg = ext(16, 14), k = ext(20, 18);
    const pose = i && m && rg && k && ratio > 0.5 ? 'open' : i && !m && !rg ? 'point' : !i && !m && !rg && !k ? 'fist' : 'other';
    cb({ present: true, lm: p, pinch, pose, px: p[8].x, py: p[8].y });
  };
  step();
}

export function stopHands() { on = false; pinch = false; }
