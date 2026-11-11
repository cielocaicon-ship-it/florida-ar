// FLORIDA AR ADVENTURE — núcleo: cámara, render, mirada (giroscopio/arrastre), dedo índice, audio, interfaz y estrellas.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { startHands, stopHands } from './handTracking.js';
import { createHub, GAMES, Sparks, starMesh, disposeTree } from './scenes.js';

const $ = id => document.getElementById(id);
const video = $('cam');
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
const S = { mode: 'touch', stars: { orlando: 0, miami: 0, heat: 0 }, sound: true, cam: false, mirror: false, pts: false, key: null, scene: null };
const EYE = 1.6;

/* ================= 3D ================= */
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.75 : 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 600);
camera.position.set(0, EYE, 0);
scene.add(camera);
const root = new THREE.Group(); scene.add(root);           // escenario activo
const sparks = new Sparks(); scene.add(sparks.points);       // partículas compartidas

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 70 : 55; camera.updateProjectionMatrix();
  $('handsLayer').width = w; $('handsLayer').height = h;
  if (S.scene && S.scene.resize) S.scene.resize();
}
addEventListener('resize', resize);
resize();

/* ============ Mirada: giroscopio del celular o arrastre del dedo ============ */
const gyro = { avail: false, on: false, data: null, yaw: 0 };
const look = { yaw: 0, pitch: 0 };
const _e = new THREE.Euler(), _q = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _qy = new THREE.Quaternion();
const _q1 = new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2), _z = new THREE.Vector3(0, 0, 1), _y = new THREE.Vector3(0, 1, 0);
addEventListener('deviceorientation', e => {
  if (e.alpha == null) return;
  gyro.data = e;
  if (!gyro.avail) { gyro.avail = true; gyro.on = isMobile; recenter(); refreshTools(); }
});
function requestGyro() { // en iPhone el permiso debe pedirse dentro de un toque
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function' && !gyro.avail) D.requestPermission().catch(() => {});
}
function gyroQ(out) {
  const d = gyro.data, r = THREE.MathUtils.degToRad;
  const o = r((screen.orientation && screen.orientation.angle) || window.orientation || 0);
  _e.set(r(d.beta), r(d.alpha), -r(d.gamma), 'YXZ');
  return out.setFromEuler(_e).multiply(_q1).multiply(_q.setFromAxisAngle(_z, -o));
}
function recenter() { // lo que el teléfono mira ahora pasa a ser "al frente"
  if (gyro.data) gyro.yaw = new THREE.Euler().setFromQuaternion(gyroQ(new THREE.Quaternion()), 'YXZ').y;
}
function lookReset(yaw = 0, pitch = 0) { look.yaw = yaw; look.pitch = pitch; recenter(); }
function applyLook() {
  if (gyro.on && gyro.data) gyroQ(_qt).premultiply(_qy.setFromAxisAngle(_y, -gyro.yaw + look.yaw));
  else _qt.setFromEuler(_e.set(look.pitch, look.yaw, 0, 'YXZ'));
  camera.quaternion.slerp(_qt, 0.4);
}

/* ================= Puntero unificado (táctil, ratón y dedo índice) ================= */
const ptr = {
  ndc: new THREE.Vector2(), sx: innerWidth / 2, sy: innerHeight / 2, down: false, src: 'touch', ray: new THREE.Raycaster(), hist: [],
  vel(ms = 110) {
    const h = this.hist; if (h.length < 2) return { x: 0, y: 0 };
    const b = h[h.length - 1]; let a = b;
    for (let i = h.length - 2; i >= 0; i--) { a = h[i]; if (b.t - a.t > ms) break; }
    const dt = Math.max((b.t - a.t) / 1000, 0.016);
    return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt };
  }
};
const blocked = () => document.querySelector('.screen.show,.modal.show');
let drag = null;
function setPtr(sx, sy, src) {
  ptr.sx = sx; ptr.sy = sy; ptr.src = src;
  ptr.ndc.set(sx / innerWidth * 2 - 1, -(sy / innerHeight) * 2 + 1);
  ptr.ray.setFromCamera(ptr.ndc, camera);
  ptr.hist.push({ x: ptr.ndc.x, y: ptr.ndc.y, t: performance.now() });
  if (ptr.hist.length > 30) ptr.hist.shift();
  $('crosshair').style.transform = `translate(${sx}px,${sy}px)`;
}
function emit(type, sx, sy, src) {
  if (type === 'down') ptr.hist = [];
  setPtr(sx, sy, src);
  if (type === 'down') ptr.down = true;
  if (type === 'up') ptr.down = false;
  const sc = S.scene; if (!sc || blocked() || sc.busy) return;
  if (sc.onDown) { // escenas de control directo (baloncesto)
    const fn = { down: 'onDown', move: 'onMove', up: 'onUp' }[type];
    sc[fn] && sc[fn](ptr); return;
  }
  if (src === 'hand') { if (type === 'down' && sc.tap) sc.tap(ptr); else if (sc.hover) sc.hover(ptr); return; }
  if (type === 'down') drag = { x: sx, y: sy, yaw: look.yaw, pitch: look.pitch, moved: false };
  else if (type === 'move' && drag) {
    const dx = sx - drag.x, dy = sy - drag.y;
    if (Math.hypot(dx, dy) > 14) drag.moved = true;
    if (drag.moved && sc.look) {
      look.yaw = drag.yaw + dx * 0.006;
      if (!gyro.on) look.pitch = THREE.MathUtils.clamp(drag.pitch + dy * 0.005, -1.1, 1.1);
    }
  } else if (type === 'move' && sc.hover) sc.hover(ptr);
  else if (type === 'up' && drag) { if (!drag.moved && sc.tap) sc.tap(ptr); drag = null; }
}
const touch = $('touch');
touch.addEventListener('pointerdown', e => { audioInit(); try { touch.setPointerCapture(e.pointerId); } catch (_) {} emit('down', e.clientX, e.clientY, 'touch'); });
touch.addEventListener('pointermove', e => {
  if (!ptr.down && (e.pointerType !== 'mouse' || S.mode === 'hand')) return;
  emit('move', e.clientX, e.clientY, 'touch');
});
['pointerup', 'pointercancel'].forEach(n => touch.addEventListener(n, e => { if (ptr.down) emit('up', e.clientX, e.clientY, 'touch'); }));

/* ================= Dedo índice ================= */
const hand = { x: innerWidth / 2, y: innerHeight / 2, pinch: false, seen: 0, warned: false, present: false, open: 0, pose: '' };
const dwell = { key: null, t: 0, done: false };
let handsOn = false;
function toScreen(nx, ny, gain = 1) { // coordenadas del video (0..1) -> píxeles (object-fit: cover)
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
    hand.present = false; cur.style.opacity = 0;
    if (hand.pinch) { hand.pinch = false; emit('up', hand.x, hand.y, 'hand'); }
    return;
  }
  hand.seen = performance.now(); hand.present = true; hand.pose = r.pose;
  const [tx, ty] = toScreen(r.px, r.py, 1.4);
  const a = THREE.MathUtils.clamp(0.25 + Math.hypot(tx - hand.x, ty - hand.y) / 220, 0.25, 0.85); // suavizado adaptativo
  hand.x += (tx - hand.x) * a; hand.y += (ty - hand.y) * a;
  cur.style.opacity = 1; cur.style.transform = `translate(${hand.x}px,${hand.y}px)`;
  cur.classList.toggle('pinch', r.pinch);
  if (r.pinch && !hand.pinch) emit('down', hand.x, hand.y, 'hand');
  else if (!r.pinch && hand.pinch) emit('up', hand.x, hand.y, 'hand');
  else emit('move', hand.x, hand.y, 'hand');
  hand.pinch = r.pinch;
  hand.open = r.pose === 'open' ? hand.open + 1 : 0;
  if (hand.open === 4 && S.scene && S.scene.palm && !blocked()) S.scene.palm();
}
function updateDwell(dt) { // seleccionar dejando el dedo quieto encima
  const cur = $('cursor');
  if (S.mode !== 'hand' || !hand.present || hand.pinch) { dwell.key = null; cur.style.setProperty('--p', 0); return; }
  let key = null, isDom = false;
  const el = document.elementFromPoint(hand.x, hand.y);
  const btn = el && el.closest && el.closest('button');
  if (btn && !btn.disabled && btn.offsetParent !== null) { key = btn; isDom = true; }
  else if (!blocked() && S.scene && S.scene.hoverable) key = S.scene.hoverable(ptr);
  if (key !== dwell.key) { dwell.key = key; dwell.t = 0; dwell.done = false; }
  if (key && !dwell.done) {
    dwell.t += dt;
    const need = isDom ? 0.9 : (S.scene.dwellTime || 0.6);
    if (dwell.t >= need) {
      dwell.done = true;
      if (isDom) { sfx('click'); btn.click(); }
      else if (S.scene.tap) S.scene.tap(ptr);
      if (!isDom && S.scene && S.scene.repeatDwell) { dwell.done = false; dwell.t = -S.scene.repeatDwell; }
    }
  }
  cur.style.setProperty('--p', key && !dwell.done ? Math.max(0, Math.min(1, dwell.t / (isDom ? 0.9 : (S.scene.dwellTime || 0.6)))) : 0);
}
const CHAINS = [[0, 1, 2, 3, 4], [0, 5, 6, 7, 8], [5, 9, 10, 11, 12], [9, 13, 14, 15, 16], [13, 17, 18, 19, 20], [0, 17]];
function drawPts(lm) {
  const cv = $('handsLayer'), g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  if (!lm || !S.pts) return;
  const P = lm.map(p => toScreen(p.x, p.y, 1.4));
  g.lineCap = 'round'; g.shadowColor = '#24d1ff'; g.shadowBlur = 12;
  g.strokeStyle = 'rgba(120,230,255,.85)'; g.lineWidth = 6;
  for (const c of CHAINS) { g.beginPath(); c.forEach((i, k) => k ? g.lineTo(...P[i]) : g.moveTo(...P[i])); g.stroke(); }
  g.shadowBlur = 0; g.fillStyle = '#fff';
  P.forEach(([x, y], i) => { g.beginPath(); g.arc(x, y, i === 8 ? 9 : 4, 0, 7); g.fillStyle = i === 8 ? '#ffd54a' : '#fff'; g.fill(); });
}
setInterval(() => {
  if (S.mode === 'hand' && handsOn && !hand.warned && performance.now() - hand.seen > 7000) {
    hand.warned = true;
    toast(isMobile ? 'No veo tu mano ✋ Pon la otra mano detrás del celular, frente a la cámara trasera, y señala con el índice.' : 'No veo tu mano ✋ Levántala frente a la cámara y señala con el índice.', 6000);
  }
}, 2000);

/* ================= Audio (sonidos sintetizados, originales) ================= */
let ac = null;
function audioInit() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) {} }
function tone(f, d, type = 'sine', v = 0.2, f2 = 0, at = 0) {
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, v = 0.2, freq = 1200, at = 0, q = 1) {
  const t = ac.currentTime + at, b = ac.createBuffer(1, Math.ceil(ac.sampleRate * d), ac.sampleRate), a = b.getChannelData(0);
  for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.05, d / 4)); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  s.connect(f).connect(g).connect(ac.destination); s.start(t);
}
const arp = (notes, step, type, v) => notes.forEach((n, i) => tone(n, step * 1.6, type, v, 0, i * step));
const SFX = {
  click: () => tone(660, 0.08, 'square', 0.05),
  chest: () => { noise(0.35, 0.25, 400); arp([523, 659, 784, 1047, 1319], 0.09, 'triangle', 0.15); },
  rattle: () => { for (let i = 0; i < 4; i++) noise(0.06, 0.2, 300, i * 0.1); },
  shutter: () => { noise(0.05, 0.3, 3000); noise(0.08, 0.25, 1800, 0.09); },
  rumble: () => { noise(7, 0.5, 90, 0, 0.3); noise(6, 0.3, 300, 0.3, 0.3); tone(45, 7, 'sawtooth', 0.12, 30); },
  portal: () => { tone(200, 0.8, 'sine', 0.25, 900); tone(300, 0.8, 'triangle', 0.1, 1400); noise(0.8, 0.12, 2000); },
  gate: () => { tone(70, 1.6, 'sawtooth', 0.12, 50); noise(1.6, 0.1, 250, 0, 3); },
  spell: () => { tone(1400, 0.3, 'sawtooth', 0.06, 250); noise(0.3, 0.14, 3200); },
  charge: () => tone(200, 0.7, 'triangle', 0.08, 700),
  hit: () => { noise(0.35, 0.35, 700); tone(180, 0.3, 'square', 0.12, 60); },
  block: () => { tone(900, 0.35, 'triangle', 0.15, 1800); tone(1350, 0.35, 'sine', 0.08, 2600); },
  hurt: () => tone(150, 0.35, 'sawtooth', 0.2, 70),
  pickup: () => arp([880, 1175, 1568, 2093], 0.06, 'triangle', 0.14),
  throw: () => noise(0.25, 0.18, 600),
  rim: () => { tone(520, 0.18, 'square', 0.07, 470); tone(1040, 0.12, 'sine', 0.04); },
  bounce: () => tone(110, 0.12, 'sine', 0.25, 70),
  swish: () => noise(0.35, 0.18, 4000, 0, 0.7),
  crowd: () => { noise(2.2, 0.22, 900, 0, 0.4); noise(2, 0.12, 2200, 0.1, 0.5); },
  score: () => arp([523, 659, 784, 1047], 0.08, 'square', 0.08),
  waves: () => noise(2.5, 0.05, 500, 0, 0.3),
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
    el.onclick = () => { requestGyro(); audioInit(); c.classList.remove('show'); sfx('click'); b.fn && b.fn(); };
    box.appendChild(el);
  });
  c.classList.add('show');
}
let toastT;
function toast(msg, ms = 3000) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function setInfo(t) { $('info').innerHTML = t || ''; $('info').classList.toggle('hidden', !t); }
function setHint(t) { $('hint').innerHTML = t || ''; $('hint').classList.toggle('hidden', !t); }
function flash() { const f = $('flash'); f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
function fade(on) { $('fade').classList.toggle('on', on); }
const NAMES = [['orlando', '🏰', 'Orlando'], ['miami', '🌴', 'Tour Florida'], ['heat', '🏀', 'Miami Heat']];
function updateStars() {
  $('stars').innerHTML = NAMES.map(([k, i, n]) => `<span class="chip ${S.stars[k] ? 'got' : ''}">${i} ${n}: ${S.stars[k]}/1${S.stars[k] ? ' ⭐' : ''}</span>`).join('');
}
function refreshTools() {
  $('bBack').style.visibility = S.key && S.key !== 'hub' ? 'visible' : 'hidden';
  $('bCenter').classList.toggle('hidden', !gyro.on);
  $('bGyro').classList.toggle('hidden', !gyro.avail);
  $('bGyro').classList.toggle('off', !gyro.on);
  $('bSound').textContent = S.sound ? '🔊' : '🔇';
}

/* ================= Escenas ================= */
const ctx = {
  root, camera, scene, renderer, ptr, sfx, toast, flash, card, stars: S.stars, EYE, look, isMobile,
  info: setInfo, hint: setHint, lookReset, recenter,
  burst: (p, c, n, sp) => sparks.emit(p, c, n, sp),
  isHand: () => S.mode === 'hand',
  handVisible: () => S.mode === 'hand' && hand.present,
  gyroOn: () => gyro.on && !!gyro.data,
  enter: (k, o) => enter(k, o), win: k => win(k), lose: m => lose(m), ready: () => ready()
};
let winStar = null, winT = 0;
function enter(key, opt = {}) {
  fade(true);
  setTimeout(() => {
    if (S.scene && S.scene.dispose) S.scene.dispose();
    for (const c of [...root.children]) { root.remove(c); disposeTree(c); }
    scene.fog = null; winStar = null; drag = null; dwell.key = null;
    setInfo(''); setHint(''); $('crosshair').classList.add('hidden'); $('arrow').classList.add('hidden');
    camera.position.set(0, EYE, 0); lookReset(0, 0); setPtr(innerWidth / 2, innerHeight / 2, 'touch');
    S.key = key; refreshTools();
    document.body.classList.toggle('world', key !== 'hub');
    S.scene = key === 'hub' ? createHub(ctx, opt) : GAMES[key].create(ctx, opt);
    fade(false);
    if (key !== 'hub' && opt.quick) S.scene.start();
  }, 280);
}
function ready() { // la escena terminó su intro: mostrar instrucciones
  const G = GAMES[S.key];
  card(G.title, `<p>${G.how(S.mode === 'hand')}</p>`, [
    { label: '¡Jugar!', primary: true, fn: () => S.scene.start() },
    { label: 'Volver a los destinos', fn: () => enter('hub', { opened: true }) }
  ]);
}
function win(key) {
  const G = GAMES[key];
  S.stars[key] = 1; updateStars(); sfx('win');
  winStar = starMesh(); winStar.position.copy(camera.localToWorld(new THREE.Vector3(0, 0.1, -2.2))); winStar.scale.setScalar(0.01); root.add(winStar); winT = 0;
  sparks.emit(winStar.position, [0xffd700, 0xffffff, 0xff9d00], 80, 2);
  setTimeout(() => {
    const all = NAMES.every(([k]) => S.stars[k]);
    card(G.winMsg, `<div class="bigstar">⭐</div><p><b>¡Estrella de ${G.short} desbloqueada!</b></p><p class="fact">💡 ${G.fact}</p>`,
      [{ label: all ? 'Ver final 🎉' : 'Continuar', primary: true, fn: () => all ? finale() : enter('hub', { opened: true }) }]);
  }, 1600);
}
function lose(msg) {
  sfx('lose');
  card('¡Inténtalo de nuevo!', `<p>${msg}</p>`, [
    { label: 'Reintentar', primary: true, fn: () => enter(S.key, { quick: true }) },
    { label: 'Volver a los destinos', fn: () => enter('hub', { opened: true }) }
  ]);
}
function finale() {
  enter('hub', { opened: true });
  setTimeout(() => {
    sfx('final'); let n = 0;
    const iv = setInterval(() => {
      sparks.emit(camera.localToWorld(new THREE.Vector3(Math.random() * 1.6 - 0.8, Math.random() * 1.2 - 0.3, -2.5)), [0xff4fa3, 0xffd54a, 0x24d1ff, 0x7bff6a, 0xff3b30], 40, 2.2);
      if (++n > 14) clearInterval(iv);
    }, 180);
    card('¡FELICIDADES! HAS COMPLETADO TU AVENTURA POR FLORIDA', '<div class="bigstar">⭐⭐⭐</div><p>Conquistaste Orlando, exploraste Miami y brillaste con el Miami Heat.</p>',
      [{ label: 'Volver a jugar', primary: true, fn: replay }]);
  }, 400);
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
  $('optHand').disabled = !S.cam;
  $('optHand').classList.toggle('rec', !isMobile && S.cam);
  $('optTouch').classList.toggle('rec', isMobile || !S.cam);
  show('controls');
}
document.querySelectorAll('.opt').forEach(b => b.onclick = () => { sfx('click'); chooseMode(b.dataset.m); });
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
        await startHands(video, onHand); handsOn = true; hand.seen = performance.now();
        toast('☝️ ¡Listo! Señala con tu índice y déjalo quieto sobre algo para seleccionarlo.', 5000);
      } catch (e) {
        console.warn(e); S.mode = 'touch'; refreshTools();
        toast('No se pudo activar la detección de manos. Se activó el modo táctil.', 5000);
      }
    }
  } else if (handsOn) { stopHands(); handsOn = false; hand.present = false; $('cursor').style.opacity = 0; drawPts(null); }
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
$('bCenter').onclick = () => { sfx('click'); lookReset(look.yaw, 0); toast('Vista centrada al frente 🎯', 1500); };
$('bGyro').onclick = () => {
  requestGyro(); gyro.on = !gyro.on; lookReset(look.yaw, 0);
  refreshTools(); toast(gyro.on ? 'Movimiento activado: gira el celular para mirar alrededor' : 'Movimiento desactivado: arrastra el dedo para mirar', 2200);
};

/* ================= Bucle principal ================= */
const clock = new THREE.Clock(); let T = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); T += dt;
  if (!(S.scene && S.scene.camLock)) applyLook();
  // con la mano en los bordes de la pantalla también se puede girar la vista (computador sin giroscopio)
  if (S.mode === 'hand' && hand.present && !gyro.on && S.scene && S.scene.look && !blocked()) {
    const ex = hand.x / innerWidth;
    if (ex < 0.1) look.yaw += dt * 0.9; else if (ex > 0.9) look.yaw -= dt * 0.9;
  }
  ptr.ray.setFromCamera(ptr.ndc, camera);
  updateDwell(dt);
  if (S.scene && S.scene.update) S.scene.update(dt, T);
  if (winStar) {
    winT += dt;
    winStar.scale.setScalar(Math.min(1, winT * 2) * 0.9);
    winStar.position.y += dt * 0.15; winStar.rotation.y += dt * 4;
    if (Math.random() < 0.3) sparks.emit(winStar.position, 0xffd700, 2, 0.8);
  }
  sparks.update(dt);
  renderer.render(scene, camera);
});
updateStars();
if (location.search.includes('debug')) window.__fl = { S, enter, ctx, camera, root, look };
