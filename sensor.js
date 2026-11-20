// sensor.js — 🦶 Sensor de pies para el Modo Quest (se abre como sensor.html en una PC con cámara).
// La cámara te ve de cuerpo entero (MediaPipe Pose) y, cuando pateas, le avisa al visor: «patada, fuerza y dirección».
// El video NUNCA sale de esta PC. La conexión con el visor usa PeerJS (un servicio gratuito que solo los presenta por el código).
const VER = '0.10.14', BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const PEER = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/+esm';

/* ===== Ajustes que puedes tocar =====
   MIN: rapidez mínima del pie para contar una patada (en «largos de tu torso» por segundo; más alto = hay que patear más fuerte)
   COOL: segundos de espera entre una patada y la siguiente · POWER: cuánto sube la fuerza del tiro con la rapidez del pie
   AIM: cuánto pesa mover el pie hacia los lados (dirección) · SEEN: confianza mínima (0 a 1) para decir que la cámara ve tus pies */
export const KICKCAM = { MIN: 4.5, COOL: 1.2, POWER: 0.045, AIM: 1.0, SEEN: 0.5 };
const SENS = [[1, 'normal'], [0.75, 'alta'], [1.3, 'baja']]; // multiplica MIN

const $ = id => document.getElementById(id), video = $('v'), cv = $('cv'), g = cv.getContext('2d');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let pose = null, peer = null, conn = null, sens = 0, status = '', lastT = 0, lastVT = -1, coolT = 0, prev = [null, null], flashT = 0, running = false;

function setText(id, t, cls = '') { const e = $(id); e.textContent = t; e.className = cls; }
function send(m) { if (conn && conn.open) try { conn.send(m); } catch (e) {} }
function report(s) { // estado para el visor: ok = te ve con los pies · pies = no ve tus pies · nadie = no ve a nadie
  if (s === status) return; status = s;
  setText('st', { ok: '✅ te veo de cuerpo entero', pies: '⚠️ no veo tus pies: aléjate un poco', nadie: '❌ no veo a nadie' }[s], s === 'ok' ? 'ok' : s === 'pies' ? 'mid' : 'bad');
  send({ t: 'status', s });
}

async function startCam() {
  if (running) return;
  try {
    setText('st', 'pidiendo permiso…', 'mid');
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    video.srcObject = s; await video.play();
    if (!pose) {
      setText('st', 'cargando detector de cuerpo…', 'mid');
      const { FilesetResolver, PoseLandmarker } = await import(`${BASE}/vision_bundle.mjs`);
      const files = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      const opts = d => ({ baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      try { pose = await PoseLandmarker.createFromOptions(files, opts('GPU')); } catch (e) { pose = await PoseLandmarker.createFromOptions(files, opts('CPU')); }
    }
    running = true; status = ''; $('cam').textContent = '📷 Cámara encendida'; requestAnimationFrame(loop);
  } catch (e) {
    setText('st', e.name === 'NotAllowedError' ? 'permiso denegado: actívalo en el navegador' : 'no se pudo abrir la cámara (' + (e.name || e.message) + ')', 'bad');
  }
}

const LEGS = [[23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32], [23, 24]];
function loop() {
  requestAnimationFrame(loop);
  if (video.readyState < 2 || video.currentTime === lastVT) return;
  lastVT = video.currentTime;
  const now = performance.now(); let r;
  try { r = pose.detectForVideo(video, now); } catch (e) { return; }
  const W = video.videoWidth, H = video.videoHeight; if (cv.width !== W) { cv.width = W; cv.height = H; }
  g.clearRect(0, 0, W, H);
  const L = r.landmarks && r.landmarks[0];
  if (!L) { report('nadie'); prev = [null, null]; return; }
  const P = i => ({ x: L[i].x * W, y: L[i].y * H, z: L[i].z * W, v: L[i].visibility ?? 1 });
  // piernas dibujadas sobre el video (amarillo; se iluminan al patear)
  const hot = now - flashT < 300;
  g.lineWidth = Math.max(4, W / 220); g.strokeStyle = hot ? '#ffd54a' : 'rgba(36,209,255,.9)'; g.lineCap = 'round';
  for (const [a, b] of LEGS) { const A = P(a), B = P(b); if (A.v < 0.3 || B.v < 0.3) continue; g.beginPath(); g.moveTo(A.x, A.y); g.lineTo(B.x, B.y); g.stroke(); }
  const feet = [[31, 27], [32, 28]].map(([toe, ank]) => { const a = P(toe), b = P(ank); return a.v > KICKCAM.SEEN ? a : b.v > KICKCAM.SEEN ? b : null; });
  for (const f of feet) if (f) { g.beginPath(); g.arc(f.x, f.y, W / 70, 0, 7); g.fillStyle = hot ? '#ffd54a' : '#3ddc84'; g.fill(); }
  if (!feet[0] && !feet[1]) { report('pies'); prev = [null, null]; return; }
  report('ok');
  // rapidez de cada pie, medida en «largos de tu torso» por segundo (así da igual si estás cerca o lejos de la cámara)
  const sh = [P(11), P(12)], hp = [P(23), P(24)];
  const torso = Math.max(30, Math.hypot((sh[0].x + sh[1].x - hp[0].x - hp[1].x) / 2, (sh[0].y + sh[1].y - hp[0].y - hp[1].y) / 2));
  const dt = clamp((now - lastT) / 1000, 0.016, 0.2); lastT = now;
  const vel = feet.map((f, i) => { const p = prev[i]; prev[i] = f; return f && p ? { x: (f.x - p.x) / dt / torso, y: (f.y - p.y) / dt / torso, z: (f.z - p.z) / dt / torso } : null; });
  coolT -= dt; if (coolT > 0) return;
  // patada: un pie sube rápido (hacia la cámara) y bastante más rápido que el otro (así saltar o caminar no cuenta)
  const sp = vel.map(v => (v ? Math.hypot(v.x, v.y, v.z * 0.6) : 0)), k = sp[0] >= sp[1] ? 0 : 1, v = vel[k];
  if (!v || sp[k] < KICKCAM.MIN * SENS[sens][0] || sp[k] < sp[1 - k] * 1.8 || v.y > 0.5) return;
  const pw = clamp(0.95 + (sp[k] - KICKCAM.MIN) * KICKCAM.POWER, 0.85, 1.35);
  // la cámara te mira de frente: si pateas hacia TU derecha, el pie se mueve hacia la izquierda de la imagen
  const lat = clamp(-v.x / Math.max(Math.abs(v.y) + Math.abs(v.z) * 0.6, 1.5) * KICKCAM.AIM, -1, 1);
  coolT = KICKCAM.COOL; flashT = now;
  $('view').classList.add('kick'); setTimeout(() => $('view').classList.remove('kick'), 300);
  send({ t: 'kick', pw, lat });
  setText('kick', `¡PATADA! fuerza ${pw.toFixed(2)} · ${lat > 0.15 ? 'derecha' : lat < -0.15 ? 'izquierda' : 'centro'}${conn && conn.open ? '' : ' (sin visor)'}`);
}

async function connect() {
  const code = $('code').value.replace(/\D/g, '');
  if (code.length !== 4) { setText('net', 'Escribe los 4 números que muestra el visor', 'bad'); $('code').focus(); return; }
  startCam();
  setText('net', 'Conectando…', 'mid');
  try {
    const mod = await import(PEER), Peer = mod.Peer || mod.default;
    if (peer) peer.destroy();
    peer = new Peer();
    peer.on('open', () => {
      conn = peer.connect('carolina-ar-' + code, { reliable: true });
      conn.on('open', () => { setText('net', '✅ Conectado al visor ' + code, 'ok'); send({ t: 'status', s: status || 'nadie' }); });
      conn.on('close', () => setText('net', 'Se cortó la conexión. Toca Conectar otra vez.', 'bad'));
    });
    peer.on('error', e => setText('net', e.type === 'peer-unavailable' ? 'No encuentro ese código. Revisa el número en el visor (y que siga en la tarjeta de patear).' : 'Error de conexión (' + e.type + '). ¿Los dos tienen internet?', 'bad'));
  } catch (e) { setText('net', 'No se pudo cargar la conexión. ¿Hay internet?', 'bad'); }
}

$('go').onclick = connect;
$('code').addEventListener('keydown', e => { if (e.key === 'Enter') connect(); });
$('cam').onclick = startCam;
$('sens').onclick = () => { sens = (sens + 1) % SENS.length; $('sens').textContent = '⚡ Sensibilidad: ' + SENS[sens][1]; };
