// Seguimiento del pie con MediaPipe Pose Landmarker. El cuerpo se procesa internamente y NO se dibuja:
// solo se devuelve la punta estimada del zapato del pie elegido (landmarks 31/32 + extensión desde el talón 29/30).
const VER = '0.10.14';
const BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

let pl = null, on = false, lastTime = -1, lastRun = 0;
export const foot = { side: 'right', ext: 0.3 }; // ext: cuánto se prolonga desde el talón hacia la punta (calibrable)

export async function startFoot(video, cb) {
  if (on) return;
  if (!pl) {
    const { FilesetResolver, PoseLandmarker } = await import(`${BASE}/vision_bundle.mjs`);
    const files = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    const opts = delegate => ({ baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.4, minTrackingConfidence: 0.4 });
    try { pl = await PoseLandmarker.createFromOptions(files, opts('GPU')); }
    catch (e) { pl = await PoseLandmarker.createFromOptions(files, opts('CPU')); }
  }
  on = true;
  const step = () => {
    if (!on) return;
    requestAnimationFrame(step);
    const now = performance.now();
    if (now - lastRun < 33 || video.readyState < 2 || video.currentTime === lastTime) return;
    lastRun = now; lastTime = video.currentTime;
    let r; try { r = pl.detectForVideo(video, now); } catch (e) { return; }
    const p = r.landmarks && r.landmarks[0];
    const [hi, ti] = foot.side === 'left' ? [29, 31] : [30, 32];
    if (!p || !p[ti] || (p[ti].visibility ?? 1) < 0.4) { cb({ present: false }); return; }
    const h = p[hi], t = p[ti];
    cb({ present: true, x: t.x + (t.x - h.x) * foot.ext, y: t.y + (t.y - h.y) * foot.ext });
  };
  step();
}
export function stopFoot() { on = false; }
