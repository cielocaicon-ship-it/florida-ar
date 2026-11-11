// FLORIDA AR ADVENTURE — núcleo: cámara, render, controles, audio, interfaz y estrellas.
import * as THREE from 'three';
import { startHands, stopHands } from './handTracking.js';
import { createHub, GAMES, Sparks, starMesh, disposeTree } from './scenes.js';

const $ = id => document.getElementById(id);
const video = $('cam');
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
const S = { mode: 'touch', stars: { orlando: 0, miami: 0, heat: 0 }, sound: true, xr: false, xrPlace: false, cam: false, mirror: false, pts: false, key: null, scene: null };

/* ================= 3D ================= */
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), alpha: true, antialias: devicePixelRatio < 2 });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 80);
scene.add(camera);
scene.add(new THREE.HemisphereLight(0xffffff, 0x5a6478, 1.9));
const sun = new THREE.DirectionalLight(0xfff2dd, 2.2); sun.position.set(2, 5, 3); scene.add(sun);
const root = new THREE.Group(); scene.add(root);           // aquí vive el escenario activo
const sparks = new Sparks(); scene.add(sparks.points);       // partículas compartidas

function resize() {
  const w = innerWidth, h = innerHeight;
  if (!renderer.xr.isPresenting) renderer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 68 : 52; camera.updateProjectionMatrix();
  $('handsLayer').width = w; $('handsLayer').height = h;
  if (!S.xr) { // distancia para que el diorama (~2.3 de ancho) quepa en pantalla
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const d = Math.max(2.6, 1.2 / t);
    root.position.set(0, -d * 0.2, -d);
  }
}
addEventListener('resize', resize);
resize();

/* ============ Sensor de orientación (modo sin WebXR) ============ */
const gyro = { avail: false, on: false, data: null, yaw: 0, asked: false };
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _qy = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2), _z = new THREE.Vector3(0, 0, 1), _y = new THREE.Vector3(0, 1, 0);
addEventListener('deviceorientation', e => {
  if (e.alpha == null) return;
  gyro.data = e;
  if (!gyro.avail) { gyro.avail = true; gyro.on = isMobile; recenter(); refreshTools(); }
});
function requestGyro() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function' && !gyro.asked) { gyro.asked = true; D.requestPermission().catch(() => {}); }
}
function gyroQ(out) {
  const d = gyro.data, r = THREE.MathUtils.degToRad;
  const o = r((screen.orientation && screen.orientation.angle) || window.orientation || 0);
  _e.set(r(d.beta), r(d.alpha), -r(d.gamma), 'YXZ');
  return out.setFromEuler(_e).multiply(_q1).multiply(_q.setFromAxisAngle(_z, -o));
}
function recenter() {
  if (S.xr) { S.xrPlace = true; return; }
  if (gyro.data) gyro.yaw = new THREE.Euler().setFromQuaternion(gyroQ(new THREE.Quaternion()), 'YXZ').y;
}
function applyGyro() {
  if (!gyro.on || !gyro.data) return;
  gyroQ(_qt).premultiply(_qy.setFromAxisAngle(_y, -gyro.yaw));
  camera.quaternion.slerp(_qt, 0.5);
}

/* ================= Puntero unificado (táctil, ratón y mano) ================= */
const ptr = {
  ndc: new THREE.Vector2(), sx: innerWidth / 2, sy: innerHeight / 2, down: false, src: 'touch', ray: new THREE.Raycaster(), hist: [],
  vel(ms = 110) { // velocidad en unidades de pantalla (-1..1) por segundo
    const h = this.hist; if (h.length < 2) return { x: 0, y: 0 };
    const b = h[h.length - 1]; let a = b;
    for (let i = h.length - 2; i >= 0; i--) { a = h[i]; if (b.t - a.t > ms) break; }
    const dt = Math.max((b.t - a.t) / 1000, 0.016);
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }
};
const blocked = () => document.querySelector('.screen.show,.modal.show');
function emit(type, sx, sy, src) {
  ptr.sx = sx; ptr.sy = sy; ptr.src = src;
  ptr.ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
  ptr.ray.setFromCamera(ptr.ndc, camera);
  if (type === 'down') { ptr.down = true; ptr.hist = []; }
  ptr.hist.push({ x: ptr.ndc.x, y: ptr.ndc.y, t: performance.now() });
  if (ptr.hist.length > 24) ptr.hist.shift();
  if (type === 'up') ptr.down = false;
  const c = $('crosshair'); c.style.transform = `translate(${sx}px,${sy}px)`;
  if (!S.scene || blocked()) return;
  const fn = { down: 'onDown', move: 'onMove', up: 'onUp' }[type];
  S.scene[fn] && S.scene[fn](ptr);
}
const touch = $('touch');
touch.addEventListener('pointerdown', e => { audioInit(); try { touch.setPointerCapture(e.pointerId); } catch (_) {} emit('down', e.clientX, e.clientY, 'touch'); });
touch.addEventListener('pointermove', e => {
  if (!ptr.down && (e.pointerType !== 'mouse' || S.mode === 'hand')) return;
  emit('move', e.clientX, e.clientY, 'touch');
});
['pointerup', 'pointercancel'].forEach(n => touch.addEventListener(n, e => { if (ptr.down) emit('up', e.clientX, e.clientY, 'touch'); }));

/* ================= Mano ================= */
const hand = { x: innerWidth / 2, y: innerHeight / 2, pinch: false, seen: 0, warned: false };
let handsOn = false;
function toScreen(nx, ny, gain = 1) { // coordenadas del video (0..1) -> píxeles de pantalla (object-fit: cover)
  nx = 0.5 + (nx - 0.5) * gain; ny = 0.5 + (ny - 0.5) * gain;
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480, W = innerWidth, H = innerHeight;
  const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s;
  let x = (W - dw) / 2 + nx * dw; const y = (H - dh) / 2 + ny * dh;
  if (S.mirror) x = W - x;
  return [Math.min(W, Math.max(0, x)), Math.min(H, Math.max(0, y))];
}
function onHand(r) {
  if (S.mode !== 'hand') return;
  const cur = $('cursor');
  if (!r.present) {
    cur.style.opacity = 0;
    if (hand.pinch) { hand.pinch = false; emit('up', hand.x, hand.y, 'hand'); }
    drawPts(null); return;
  }
  hand.seen = performance.now();
  const [tx, ty] = toScreen(r.px, r.py, 1.35);
  hand.x += (tx - hand.x) * 0.55; hand.y += (ty - hand.y) * 0.55;
  cur.style.opacity = 1; cur.style.transform = `translate(${hand.x}px,${hand.y}px)`;
  cur.classList.toggle('pinch', r.pinch);
  if (r.pinch && !hand.pinch) emit('down', hand.x, hand.y, 'hand');
  else if (!r.pinch && hand.pinch) emit('up', hand.x, hand.y, 'hand');
  else emit('move', hand.x, hand.y, 'hand');
  hand.pinch = r.pinch;
  drawPts(r.lm);
}
const CHAINS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];
function drawPts(lm) {
  const cv = $('handsLayer'), g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  if (!lm || !S.pts) return;
  const P = lm.map(p => toScreen(p.x, p.y));
  g.strokeStyle = 'rgba(36,209,255,.9)'; g.lineWidth = 3;
  for (const c of CHAINS) { g.beginPath(); c.forEach((i, k) => k ? g.lineTo(...P[i]) : g.moveTo(...P[i])); g.stroke(); }
  g.fillStyle = '#ffd54a';
  P.forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); });
}
setInterval(() => {
  if (S.mode === 'hand' && handsOn && !hand.warned && performance.now() - hand.seen > 7000) {
    hand.warned = true; toast('No veo tu mano ✋ Muéstrala a la cámara o cambia a táctil en ⚙️', 5000);
  }
}, 2000);

/* ================= Audio (sonidos sintetizados, originales) ================= */
let ac = null;
function audioInit() {
  try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {}
}
function tone(f, d, type = 'sine', v = 0.2, f2 = 0, at = 0) {
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, v = 0.2, freq = 1200, at = 0) {
  const t = ac.currentTime + at, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * d), ac.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const arp = (notes, step, type, v) => notes.forEach((n, i) => tone(n, step * 1.6, type, v, 0, i * step));
const SFX = {
  click: () => tone(660, 0.08, 'square', 0.06),
  chest: () => { noise(0.35, 0.25, 400); arp([523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.15); },
  portal: () => { tone(200, 0.6, 'sine', 0.25, 900); tone(300, 0.6, 'triangle', 0.1, 1400); },
  spell: () => { tone(1200, 0.25, 'sawtooth', 0.07, 300); noise(0.2, 0.12, 3000); },
  hit: () => { noise(0.3, 0.3, 800); tone(180, 0.3, 'square', 0.12, 60); },
  block: () => tone(900, 0.3, 'triangle', 0.15, 1800),
  hurt: () => tone(150, 0.35, 'sawtooth', 0.2, 70),
  pickup: () => arp([880, 1175, 1568], 0.07, 'triangle', 0.15),
  throw: () => noise(0.25, 0.18, 600),
  rim: () => tone(420, 0.15, 'square', 0.08, 380),
  score: () => { noise(0.4, 0.2, 2500); arp([523, 659, 784, 1047], 0.08, 'square', 0.1); },
  win: () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.11, 'triangle', 0.16),
  lose: () => arp([392, 330, 262, 196], 0.16, 'sawtooth', 0.1),
  final: () => { arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.1, 'square', 0.09); arp([262, 330, 392, 523], 0.2, 'triangle', 0.15); }
};
const sfx = n => { if (S.sound && ac) try { SFX[n](); } catch (e) {} };

/* ================= Interfaz ================= */
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id)); }
function card(title, html, btns) {
  const c = $('card');
  c.querySelector('h2').textContent = title;
  c.querySelector('.body').innerHTML = html;
  const box = c.querySelector('.btns'); box.innerHTML = '';
  btns.forEach(b => {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? ' primary' : ''); el.textContent = b.label;
    el.onclick = () => { c.classList.remove('show'); sfx('click'); b.fn && b.fn(); };
    box.appendChild(el);
  });
  c.classList.add('show');
}
let toastT;
function toast(msg, ms = 3000) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function setInfo(t) { $('info').innerHTML = t || ''; $('info').classList.toggle('hidden', !t); }
function setHint(t) { $('hint').innerHTML = t || ''; $('hint').classList.toggle('hidden', !t); }
function flash() { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
const NAMES = [['orlando', '🏰', 'Orlando'], ['miami', '🌴', 'Miami'], ['heat', '🏀', 'Miami Heat']];
function updateStars() {
  $('stars').innerHTML = NAMES.map(([k, i, n]) => `<span class="chip ${S.stars[k] ? 'got' : ''}">${i} ${n}: ${S.stars[k]}/1${S.stars[k] ? ' ⭐' : ''}</span>`).join('');
}
function refreshTools() {
  $('bBack').style.visibility = S.key && S.key !== 'hub' ? 'visible' : 'hidden';
  $('bPts').classList.toggle('hidden', S.mode !== 'hand');
  $('bPts').classList.toggle('off', !S.pts);
  $('bCenter').classList.toggle('hidden', !(gyro.on || S.xr));
  $('bGyro').classList.toggle('hidden', !gyro.avail || S.xr);
  $('bGyro').classList.toggle('off', !gyro.on);
  $('bSound').textContent = S.sound ? '🔊' : '🔇';
}

/* ================= Escenas ================= */
const ctx = {
  root, camera, ptr, sfx, toast, flash, card, stars: S.stars,
  info: setInfo, hint: setHint,
  burst: (p, c, n, sp) => sparks.emit(p, c, n, sp),
  isHand: () => S.mode === 'hand',
  enter: (k, o) => enter(k, o), win: k => win(k), lose: m => lose(m)
};
let winStar = null, winT = 0;
function enter(key, opt = {}) {
  if (S.scene && S.scene.dispose) S.scene.dispose();
  for (const c of [...root.children]) { root.remove(c); disposeTree(c); }
  winStar = null; setInfo(''); setHint(''); $('crosshair').classList.add('hidden');
  S.key = key; refreshTools();
  if (key === 'hub') { S.scene = createHub(ctx, opt); return; }
  const G = GAMES[key];
  S.scene = G.create(ctx);
  if (opt.quick) { S.scene.start(); return; }
  card(G.title, `<p>${G.how(S.mode === 'hand')}</p>`, [
    { label: '¡Jugar!', primary: true, fn: () => S.scene.start() },
    { label: 'Volver a los destinos', fn: () => enter('hub', { opened: true }) }
  ]);
}
function win(key) {
  const G = GAMES[key];
  S.stars[key] = 1; updateStars(); sfx('win');
  winStar = starMesh(); winStar.position.set(0, 0.9, 0.5); winStar.scale.setScalar(0.01); root.add(winStar); winT = 0;
  sparks.emit(winStar.getWorldPosition(new THREE.Vector3()), [0xffd700, 0xffffff, 0xff9d00], 70, 2);
  setTimeout(() => {
    const all = NAMES.every(([k]) => S.stars[k]);
    card(G.winMsg, `<div class="bigstar">⭐</div><p><b>¡Estrella de ${G.short} desbloqueada!</b></p><p class="fact">💡 ${G.fact}</p>`,
      [{ label: all ? 'Ver final 🎉' : 'Continuar', primary: true, fn: () => all ? finale() : enter('hub', { opened: true }) }]);
  }, 1500);
}
function lose(msg) {
  sfx('lose');
  card('¡Inténtalo de nuevo!', `<p>${msg}</p>`, [
    { label: 'Reintentar', primary: true, fn: () => enter(S.key, { quick: true }) },
    { label: 'Volver a los destinos', fn: () => enter('hub', { opened: true }) }
  ]);
}
function finale() {
  enter('hub', { opened: true }); sfx('final');
  let n = 0;
  const iv = setInterval(() => {
    const p = camera.localToWorld(new THREE.Vector3(Math.random() * 1.6 - 0.8, Math.random() * 1.2 - 0.3, -2.5));
    sparks.emit(p, [0xff4fa3, 0xffd54a, 0x24d1ff, 0x7bff6a, 0xff3b30], 40, 2.2);
    if (++n > 14) clearInterval(iv);
  }, 180);
  card('¡FELICIDADES! HAS COMPLETADO TU AVENTURA POR FLORIDA', '<div class="bigstar">⭐⭐⭐</div><p>Conquistaste Orlando, exploraste Miami y brillaste con el Miami Heat.</p>',
    [{ label: 'Volver a jugar', primary: true, fn: replay }]);
}
function replay() { for (const k in S.stars) S.stars[k] = 0; updateStars(); enter('hub'); }

/* ================= Cámara ================= */
function stopCamera() { const s = video.srcObject; if (s) s.getTracks().forEach(t => t.stop()); video.srcObject = null; }
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nohttps');
  stopCamera();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false, video: { facingMode: { ideal: isMobile ? 'environment' : 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }
  });
  const fm = stream.getVideoTracks()[0].getSettings().facingMode;
  S.mirror = fm ? fm === 'user' : !isMobile;
  video.classList.toggle('mirror', S.mirror);
  video.srcObject = stream;
  await video.play();
}

/* ================= WebXR (solo si hay soporte real) ================= */
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-ar').then(ok => { if (ok) $('optXR').classList.remove('hidden'); }).catch(() => {});
}
let xrFrames = 0;
async function startXR() {
  try {
    const session = await navigator.xr.requestSession('immersive-ar', { optionalFeatures: ['dom-overlay'], domOverlay: { root: $('app') } });
    stopHands(); handsOn = false; S.mode = 'touch'; $('cursor').style.opacity = 0; stopCamera();
    renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local');
    await renderer.xr.setSession(session);
    S.xr = true; S.xrPlace = true; xrFrames = 0; document.body.classList.add('xr');
    session.addEventListener('end', () => {
      S.xr = false; renderer.xr.enabled = false; document.body.classList.remove('xr');
      root.scale.setScalar(1); root.rotation.set(0, 0, 0);
      camera.position.set(0, 0, 0); camera.quaternion.identity();
      resize(); refreshTools();
      if (S.cam) startCamera().catch(() => {});
    });
    show(null); $('hud').classList.remove('hidden'); refreshTools();
    if (!S.scene) enter('hub');
    toast('AR espacial activo: el escenario queda anclado en tu espacio. 🎯 lo vuelve a poner al frente.', 5000);
  } catch (e) { console.warn(e); toast('No se pudo iniciar el AR espacial. Usa el modo táctil.'); }
}
function placeXR() { // coloca el escenario 1.6 m delante del jugador
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion); dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  root.position.copy(camera.position).addScaledVector(dir, 1.6); root.position.y = camera.position.y - 0.55;
  root.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0); root.scale.setScalar(0.55);
  S.xrPlace = false;
}

/* ================= Flujo de pantallas ================= */
$('bStart').onclick = () => { audioInit(); sfx('click'); show('perm'); };
$('bCam').onclick = async () => {
  audioInit(); sfx('click');
  const err = $('camErr');
  try {
    await startCamera(); S.cam = true; document.body.classList.remove('nocam'); err.classList.add('hidden'); goControls();
  } catch (e) {
    err.classList.remove('hidden');
    err.textContent = e.message === 'nohttps' ? 'La cámara solo funciona desde un enlace HTTPS (por ejemplo, GitHub Pages).'
      : e.name === 'NotAllowedError' ? 'Permiso denegado. Actívalo en los ajustes del navegador (en iPhone: Ajustes › Safari › Cámara) y vuelve a intentar.'
      : e.name === 'NotFoundError' ? 'No se encontró ninguna cámara en este dispositivo.'
      : 'No se pudo abrir la cámara (' + (e.name || e.message) + ').';
  }
};
$('bNoCam').onclick = () => { S.cam = false; document.body.classList.add('nocam'); goControls(); };
function goControls() {
  $('optHand').disabled = !S.cam || S.xr;
  $('optHand').classList.toggle('rec', !isMobile && S.cam);
  $('optTouch').classList.toggle('rec', isMobile || !S.cam);
  show('controls');
}
document.querySelectorAll('.opt').forEach(b => b.onclick = () => { sfx('click'); b.dataset.m === 'xr' ? startXR() : chooseMode(b.dataset.m); });
async function chooseMode(m) {
  audioInit(); requestGyro(); show(null);
  $('hud').classList.remove('hidden'); updateStars();
  S.mode = m; refreshTools();
  if (!S.scene) enter('hub');
  if (m === 'hand') {
    hand.warned = false; hand.seen = performance.now();
    if (!handsOn) {
      toast('Cargando detector de manos…', 15000);
      try {
        await startHands(video, onHand); handsOn = true;
        hand.seen = performance.now();
        toast('✋ ¡Listo! Mueve tu índice y junta pulgar + índice para seleccionar.', 4500);
      } catch (e) {
        console.warn(e); S.mode = 'touch'; refreshTools();
        toast('No se pudo activar la detección de manos. Se activó el modo táctil.', 5000);
      }
    }
  } else if (handsOn) { stopHands(); handsOn = false; $('cursor').style.opacity = 0; drawPts(null); }
  refreshTools();
  if (S.scene && S.scene.refreshHint) S.scene.refreshHint();
}

/* ================= Botones de la barra superior ================= */
$('bBack').onclick = () => { sfx('click'); enter('hub', { opened: true }); };
$('bSound').onclick = () => { audioInit(); S.sound = !S.sound; refreshTools(); sfx('click'); };
$('bMode').onclick = () => { sfx('click'); goControls(); };
$('bRestart').onclick = () => {
  sfx('click');
  if (S.key === 'hub') card('¿Reiniciar la aventura?', '<p>Se borrarán tus estrellas y el cofre se cerrará.</p>', [{ label: 'Sí, reiniciar', primary: true, fn: replay }, { label: 'Cancelar' }]);
  else enter(S.key, { quick: true });
};
$('bCenter').onclick = () => { sfx('click'); recenter(); toast('Escenario centrado al frente 🎯', 1500); };
$('bGyro').onclick = () => {
  gyro.on = !gyro.on; if (gyro.on) recenter(); else camera.quaternion.identity();
  refreshTools(); toast(gyro.on ? 'Sensor activado: mueve el teléfono para mirar' : 'Sensor desactivado', 1800);
};
$('bPts').onclick = () => { S.pts = !S.pts; refreshTools(); if (!S.pts) drawPts(null); };

/* ================= Bucle principal ================= */
const clock = new THREE.Clock(); let T = 0;
const _wp = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); T += dt;
  if (!S.xr) applyGyro(); else if (S.xrPlace && ++xrFrames > 8) placeXR();
  ptr.ray.setFromCamera(ptr.ndc, camera);
  if (S.scene && S.scene.update) S.scene.update(dt, T);
  if (winStar) {
    winT += dt;
    winStar.scale.setScalar(Math.min(1, winT * 2) * 0.9);
    winStar.position.y = 0.9 + winT * 0.15; winStar.rotation.y += dt * 4;
    if (Math.random() < 0.3) sparks.emit(winStar.getWorldPosition(_wp), 0xffd700, 2, 0.8);
  }
  sparks.update(dt);
  renderer.render(scene, camera);
});
updateStars();
