// CAROLINA AR ADVENTURE — núcleo: cámara, render, mirada (giroscopio/arrastre), dedo índice, audio, interfaz y estrellas.
import * as THREE from 'three';
import { T as tr, I18N, applyLang, startLang } from './i18n.js'; // idioma: inglés al abrir, español opcional
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { startHands, stopHands } from './handTracking.js';
import { createHub, GAMES as G1, Sparks, starMesh, disposeTree, setQuality } from './scenes.js';
import { GAMES2 } from './scenes2.js';
import { startFoot, stopFoot, foot } from './footTracking.js';
import { preloadModels } from './models.js';
import { initXR, QUEST } from './xr.js';
preloadModels(); // tus modelos 3D (assets/modelos) se cargan desde el inicio, mientras la persona lee la bienvenida
const GAMES = { ...G1, ...GAMES2 };
startLang(); // la página arranca en inglés
// claves internas heredadas de la versión de Florida: orlando = Kitty Hawk (primer vuelo) · heroes = Research Triangle · city = Charlotte · miami = Outer Banks · heat = Hornets · fg = Panthers · penalty = Charlotte FC
const ORDER = [['orlando', '✈️'], ['heroes', '🤖'], ['city', '🏙️'], ['miami', '🚤'], ['heat', '🏀'], ['fg', '🏈'], ['penalty', '⚽']];

const $ = id => document.getElementById(id);
const video = $('cam');
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));
const S = { mode: 'touch', stars: Object.fromEntries(ORDER.map(([k]) => [k, 0])), quality: isMobile ? 1 : 2, sound: true, cam: false, mirror: false, pts: false, key: null, scene: null };
const EYE = 1.6;
let XRM = null; const inXR = () => !!(XRM && XRM.on()); // 🥽 Modo Quest (xr.js): en el visor, ventanas y avisos se dibujan en 3D

/* ================= 3D ================= */
const renderer = new THREE.WebGLRenderer({ canvas: $('scene'), alpha: true, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.5 : 2));
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(renderer), 0.04).texture;
const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 600);
camera.position.set(0, EYE, 0);
const rig = new THREE.Group(); scene.add(rig); rig.add(camera); // en el visor, la cabeza y las manos se mueven dentro de este grupo
const root = new THREE.Group(); scene.add(root);           // escenario activo
const sparks = new Sparks(); scene.add(sparks.points);       // partículas compartidas

function resize() {
  if (renderer.xr.isPresenting) return; // en el visor el tamaño lo pone el visor
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
    hand.present = false; cur.style.opacity = 0; pip.pts = [];
    if (!footMode) setStat(isMobile ? '✋ No veo tu mano: ponla frente a la cámara trasera' : '✋ No veo tu mano: levántala frente a la cámara', 'bad');
    if (hand.pinch) { hand.pinch = false; emit('up', hand.x, hand.y, 'hand'); }
    return;
  }
  hand.seen = performance.now(); hand.present = true; hand.pose = r.pose;
  pip.pts = [{ x: r.px, y: r.py, t: hand.seen }]; // punto amarillo en el recuadro de cámara
  if (!footMode) setStat('☝️ ¡Te veo! Señala con el índice', 'good');
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
  final: () => { arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.1, 'square', 0.09); arp([262, 330, 392, 523], 0.2, 'triangle', 0.15); },
  // ---- capa arcade (melodías originales de 8 bits) ----
  coin: () => { tone(880, 0.07, 'square', 0.07); tone(1760, 0.28, 'square', 0.06, 0, 0.07); noise(0.25, 0.05, 6000, 0.07); },
  stage: () => { // «entrando a un videojuego»: barrido, arpegio y acorde final
    tone(160, 0.45, 'sawtooth', 0.05, 900); noise(0.45, 0.06, 2500, 0, 0.6);
    [392, 494, 587, 784, 988, 1175].forEach((f, i) => tone(f, 0.12, 'square', 0.06, 0, 0.32 + i * 0.065));
    for (const f of [784, 988, 1175]) tone(f, 0.5, 'triangle', 0.08, 0, 0.75);
    tone(98, 0.6, 'square', 0.05, 0, 0.75);
  },
  tick: () => tone(523, 0.12, 'square', 0.07),
  go: () => { tone(1047, 0.35, 'square', 0.07); tone(1319, 0.35, 'square', 0.05); tone(262, 0.35, 'triangle', 0.1); },
  perfect: () => arp([1047, 1319, 1568, 2093], 0.045, 'square', 0.06),
  fire: () => { noise(0.9, 0.18, 500, 0, 0.5); arp([392, 523, 659, 784, 1047], 0.06, 'sawtooth', 0.05); },
  dribble: () => { tone(120 * (0.95 + Math.random() * 0.1), 0.1, 'sine', 0.28, 65); noise(0.05, 0.08, 900); },
  buzzer: () => tone(180, 0.7, 'square', 0.08, 170)
};
const sfx = n => { if (S.sound && ac) try { SFX[n](); } catch (e) {} };

/* ================= Interfaz ================= */
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id)); }
// La fuente pixel no trae letras con tilde: en los textos pixel se quitan las tildes (la ñ se conserva), como en las máquinas arcade.
const pxText = s => String(s).normalize('NFD').replace(/[̀-̂̄-ͯ]/g, '').normalize('NFC');
function card(title, html, btns, kind = '') { // tarjeta (ventana) con título pixel; kind: '' | 'win' | 'lose' | 'how'
  title = tr(title); html = tr(html); btns = btns.map(b => ({ ...b, label: tr(b.label) }));
  if (inXR()) return XRM.card(title, html, btns, kind);
  const c = $('card');
  c.dataset.kind = kind;
  c.querySelector('h2').textContent = pxText(title);
  c.querySelector('.body').innerHTML = html;
  const box = c.querySelector('.btns'); box.innerHTML = '';
  btns.forEach(b => {
    const el = document.createElement('button');
    el.className = 'btn' + (b.primary ? ' primary' : ''); el.textContent = b.label;
    el.onclick = () => { requestGyro(); audioInit(); c.classList.remove('show'); sfx('click'); b.fn && b.fn(); };
    box.appendChild(el);
  });
  c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); // reinicia la animación de entrada
}

/* ================= Capa arcade: título pixel, cuenta regresiva, mensajes, sacudida y cámara lenta ================= */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = { get: (k, d) => { try { const v = localStorage.getItem('fl_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: (k, v) => { try { localStorage.setItem('fl_' + k, JSON.stringify(v)); } catch (e) {} } };
S.fx = store.get('fx', !reduceMotion); // false = «Reducir efectos» (sin sacudidas ni cámara lenta)
let stageT = null;
function stageTitle(key) { // título pixel al entrar a cada minijuego + jingle de «entrar al videojuego»
  if (inXR()) { sfx('stage'); return XRM.pop(tr(GAMES[key].pix || GAMES[key].short)); }
  const G = GAMES[key], n = ORDER.findIndex(([k]) => k === key) + 1, st = $('stage');
  st.querySelector('.stage-n').textContent = `STAGE ${n}`;
  st.querySelector('.stage-t').textContent = pxText(tr(G.pix || G.short.toUpperCase()));
  st.querySelector('.stage-s').textContent = pxText(tr(G.tag || ''));
  st.classList.remove('hidden', 'out'); void st.offsetWidth; st.classList.add('in');
  sfx('stage'); if (navigator.vibrate) navigator.vibrate([20, 60, 30]);
  clearTimeout(stageT); stageT = setTimeout(hideStage, 2400);
}
function hideStage() { const st = $('stage'); if (st.classList.contains('hidden')) return; st.classList.add('out'); clearTimeout(stageT); stageT = setTimeout(() => st.classList.add('hidden'), 320); }
$('stage').onclick = hideStage;
function countdown(cb) { // 3 · 2 · 1 · ¡YA!
  if (inXR()) return XRM.countdown(cb);
  const el = $('count'); let n = 3;
  const step = () => {
    el.textContent = n > 0 ? String(n) : '¡YA!'; el.classList.remove('hidden', 'bump'); void el.offsetWidth; el.classList.add('bump');
    sfx(n > 0 ? 'tick' : 'go');
    if (n-- > 0) setTimeout(step, 620); else setTimeout(() => { el.classList.add('hidden'); cb(); }, 450);
  };
  step();
}
function pop(text, kind = 'good') { // mensaje pixel en el centro: «¡PERFECTO!», «+3», «¡EN LLAMAS!»…
  text = tr(text);
  if (inXR()) return XRM.pop(text, kind);
  const el = document.createElement('div'); el.className = 'pop ' + kind; el.textContent = pxText(text);
  $('pops').appendChild(el); setTimeout(() => el.remove(), 1150);
}
const trauma = { v: 0 }, slow = { t: 0, k: 1 };
const shake = a => { if (inXR()) return XRM.shake(a); if (S.fx) trauma.v = Math.min(1, trauma.v + a); };
const slowmo = (dur, k) => { if (S.fx) { slow.t = dur; slow.k = k; } };
function best(key, value, lowerIsBetter = false) { // guarda el récord de cada juego en este celular; devuelve si es nuevo récord
  const old = store.get('best_' + key, null), isNew = old === null || (lowerIsBetter ? value < old : value > old);
  if (isNew) store.set('best_' + key, value);
  return { isNew, best: isNew ? value : old };
}
let toastT;
function toast(msg, ms = 3000) { msg = tr(msg); if (inXR()) return XRM.toast(msg, ms); const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
function setInfo(t) { t = tr(t); if (inXR()) return XRM.info(t); $('info').innerHTML = t || ''; $('info').classList.toggle('hidden', !t); }
function setHint(t) { t = tr(t); if (inXR()) return XRM.hint(t); $('hint').innerHTML = t || ''; $('hint').classList.toggle('hidden', !t); }
function flash(kind = 'red') { if (inXR()) return XRM.flash(kind); const f = $('flash'); f.className = kind; f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on'))); }
function fade(on) { if (inXR()) return XRM.fade(on); $('fade').classList.toggle('on', on); }
const NAMES = ORDER;
function updateStars() { // barra de progreso: ⭐ n/7 y un punto por destino
  const n = ORDER.filter(([k]) => S.stars[k]).length;
  $('stars').innerHTML = `<span class="prog ${n === 7 ? 'got' : ''}" aria-label="${n} de 7 estrellas">⭐ <b>${n}</b>/7</span>` + ORDER.map(([k, i]) => `<span class="dot ${S.stars[k] ? 'got' : ''}" title="${GAMES[k].short}${S.stars[k] ? ' — completado' : ''}">${i}</span>`).join('');
}
function refreshTools() {
  $('bBack').style.visibility = S.key && S.key !== 'hub' ? 'visible' : 'hidden';
  $('bCenter').classList.toggle('hidden', !gyro.on);
  $('bGyro').classList.toggle('hidden', !gyro.avail);
  $('bGyro').querySelector('span').textContent = gyro.on ? 'Sensor de movimiento: activado' : 'Sensor de movimiento: apagado';
  $('bFx').querySelector('span').textContent = S.fx ? 'Efectos: completos' : 'Efectos: reducidos';
  $('bRestart').querySelector('span').textContent = S.key && S.key !== 'hub' ? 'Reiniciar este juego' : 'Reiniciar la aventura';
  $('bSound').textContent = S.sound ? '🔊' : '🔇'; $('bSound').setAttribute('aria-label', S.sound ? 'Silenciar' : 'Activar sonido');
}

/* ================= Recuadro con la cámara: te ves la mano mientras juegas ================= */
// Aparece dentro de los mundos cuando juegas con el dedo índice. Tócalo para agrandarlo; ✕ lo oculta y «📷 Cámara» lo vuelve a mostrar.
const pip = { on: false, pref: store.get('pip', true), big: false, pts: [], t: 0, flash: 0, want: null };
function pipWanted() { return S.cam && !!video.srcObject && !!S.key && S.key !== 'hub' && S.mode === 'hand' && handsOn && !footMode; }
function updatePip() {
  const want = pipWanted(); pip.want = want;
  $('bPip').classList.toggle('hidden', !want); $('bPip').setAttribute('aria-pressed', String(pip.pref));
  pip.on = want && pip.pref;
  $('pip').classList.toggle('hidden', !pip.on); $('pip').classList.toggle('big', pip.big);
  $('pipShow').classList.toggle('hidden', !(want && !pip.pref));
}
function setPipPref(v) { pip.pref = v; store.set('pip', v); updatePip(); }
function setStat(text, level) { // texto bajo el recuadro y color del borde: verde = listo, amarillo = casi, rojo = no te ve
  const f = $('footstat'); if (f.textContent !== text) f.textContent = text;
  const p = $('pip'); for (const k of ['good', 'mid', 'bad']) p.classList.toggle(k, k === level);
}
function drawPip(now) {
  if (pipWanted() !== pip.want) updatePip();
  if (!pip.on || now - pip.t < 33) return; pip.t = now; // ~30 cuadros por segundo
  const cv = $('pipCv'), dpr = Math.min(devicePixelRatio || 1, 2), W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
  if (!W || !H) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const g = cv.getContext('2d'), vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || video.readyState < 2) { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); return; }
  const s = Math.max(W / vw, H / vh), dw = vw * s, dh = vh * s, ox = (W - dw) / 2, oy = (H - dh) / 2;
  g.save(); if (S.mirror) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(video, ox, oy, dw, dh); g.restore();
  for (const p of pip.pts) { // solo un círculo amarillo (sin esqueleto)
    if (now - p.t > 400) continue;
    let x = ox + p.x * dw; const y = oy + p.y * dh; if (S.mirror) x = W - x;
    const r = (pip.big ? 13 : 9) * dpr;
    g.beginPath(); g.arc(x, y, r, 0, 7); g.fillStyle = 'rgba(255,213,74,.35)'; g.fill();
    g.lineWidth = 5 * dpr; g.strokeStyle = 'rgba(0,0,0,.55)'; g.stroke();
    g.lineWidth = 3 * dpr; g.strokeStyle = '#ffd54a'; g.stroke();
  }
}
$('pipCv').onclick = () => { pip.big = !pip.big; updatePip(); };
$('pipHide').onclick = e => { e.stopPropagation(); sfx('click'); setPipPref(false); };
$('pipShow').onclick = () => { sfx('click'); setPipPref(true); };
$('bPip').onclick = () => { sfx('click'); setPipPref(!pip.pref); };

/* ================= Pantalla siempre encendida (para jugar con el celular apoyado) ================= */
let wake = null;
async function keepAwake() { try { if ('wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => (wake = null)); } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.key) keepAwake(); });

/* ================= Patear con la cámara TRASERA: tu piso real abajo y el estadio 3D arriba ================= */
// Sostienes el celular apuntando a tus pies. La franja de abajo muestra tu piso (video de la cámara) con el balón encima.
// El balón queda ANCLADO a un punto de tu piso (con el giroscopio): aunque muevas el celular, no se va de ese sitio.
// Toca tu piso para poner el balón en otro lugar. La patada se detecta por movimiento (footTracking.js).
// F = alto de la franja (fracción de la pantalla) · BALL_Y = dónde aparece el balón al colocarlo (-1 abajo, 1 arriba)
// CAM_H = altura aproximada del celular sobre el piso (m) · FOV_LONG = ángulo de visión del lado largo de la cámara trasera
// BALL_K = el balón se dibuja un poco más grande que uno real para que sea más fácil darle
const FLOOR = { F: 0.46, D: 1.2, BALL_D: 0.95, BALL_Y: -0.56, BALL_R: 0.11, CAM_H: 1.2, FOV_LONG: 68, BALL_K: 1.3 };
let footMode = false, gyroBeforeFoot = false, floorMesh = null, floorTex = null, floorFlash = 0;
const floorGeo = { cx: 0, cy: 0, r: 0 };
const anchor = { world: false, W: new THREE.Vector3(), seen: true, fx: 0.5, fy: (1 - FLOOR.BALL_Y) / 2 };
const _aq = new THREE.Quaternion(), _ad = new THREE.Vector3(), _ac = new THREE.Vector3();
function floorBuild() {
  if (floorMesh) return;
  floorTex = new THREE.VideoTexture(video); floorTex.colorSpace = THREE.SRGBColorSpace;
  const fc = document.createElement('canvas'); fc.width = 4; fc.height = 128;
  const fg = fc.getContext('2d'), gr = fg.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#000'); gr.addColorStop(0.24, '#fff'); gr.addColorStop(1, '#fff');
  fg.fillStyle = gr; fg.fillRect(0, 0, 4, 128);
  floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: floorTex, alphaMap: new THREE.CanvasTexture(fc), transparent: true, toneMapped: false, fog: false }));
  floorMesh.renderOrder = 10; floorMesh.frustumCulled = false; floorMesh.visible = false; camera.add(floorMesh);
}
function stripMap() { // cómo se ve el video dentro de la franja (recorte tipo «cover»)
  const W = innerWidth, H = innerHeight, FH = H * FLOOR.F, vw = video.videoWidth || 720, vh = video.videoHeight || 1280, s = Math.max(W / vw, FH / vh);
  return { W, H, FH, vw, vh, s, ox: (W - vw * s) / 2, oy: H - FH + (FH - vh * s) / 2 };
}
function camTan(m) { const tl = Math.tan(THREE.MathUtils.degToRad(FLOOR.FOV_LONG / 2)); return m.vw >= m.vh ? { tx: tl, ty: tl * m.vh / m.vw } : { tx: tl * m.vw / m.vh, ty: tl }; }
function placeBallAt(sx, sy) { // ancla el balón al punto del piso que se ve en (sx, sy) de la pantalla
  if (!gyro.data) return false;
  const m = stripMap(), t = camTan(m);
  let u = (sx - m.ox) / (m.vw * m.s); if (S.mirror) u = 1 - u;
  const v = (sy - m.oy) / (m.vh * m.s);
  const d = _ad.set((2 * u - 1) * t.tx, -(2 * v - 1) * t.ty, -1).normalize().applyQuaternion(gyroQ(_aq));
  if (d.y > -0.22) return false; // el celular no está apuntando al piso
  const k = FLOOR.CAM_H / -d.y; if (k > 4) return false; // demasiado lejos
  anchor.W.copy(d).multiplyScalar(k).add(_ac.set(0, FLOOR.CAM_H, 0)); anchor.world = true; anchor.seen = true;
  return true;
}
function anchorProject() { // dónde se ve ahora el balón anclado, según el giro actual del celular
  const m = stripMap(), t = camTan(m);
  const d = _ad.copy(anchor.W).sub(_ac.set(0, FLOOR.CAM_H, 0)), dist = d.length();
  d.applyQuaternion(gyroQ(_aq).invert());
  if (d.z > -0.05) return null;
  let u = 0.5 + (d.x / -d.z) / (2 * t.tx); const v = 0.5 - (d.y / -d.z) / (2 * t.ty); if (S.mirror) u = 1 - u;
  const x = m.ox + u * m.vw * m.s, y = m.oy + v * m.vh * m.s, r = FLOOR.BALL_K * (FLOOR.BALL_R / dist) / (2 * t.ty) * m.vh * m.s;
  if (y < m.H - m.FH + r * 0.3 || y > m.H + r * 0.5 || x < -r * 0.5 || x > m.W + r * 0.5) return null; // fuera de la franja del piso
  return { cx: x, cy: y, r };
}
function floorReset() { // pone el balón frente a ti (al empezar y en cada intento)
  if (!placeBallAt(innerWidth / 2, anchor.fy * innerHeight)) { anchor.world = false; anchor.fx = 0.5; anchor.fy = (1 - FLOOR.BALL_Y) / 2; }
}
function floorLayout() { // tamaño de la franja, recorte del video y dónde se ve el balón
  if (!floorMesh) return;
  const th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hh = th * FLOOR.D, hw = hh * camera.aspect;
  floorMesh.scale.set(2 * hw, 2 * hh * FLOOR.F, 1); floorMesh.position.set(0, -hh + hh * FLOOR.F, -FLOOR.D);
  const vw = video.videoWidth || 16, vh = video.videoHeight || 9, As = camera.aspect / FLOOR.F, Av = vw / vh;
  let rx = 1, ry = 1; if (Av > As) rx = As / Av; else ry = Av / As;
  floorTex.repeat.set(S.mirror ? -rx : rx, ry); floorTex.offset.set(S.mirror ? (1 + rx) / 2 : (1 - rx) / 2, (1 - ry) / 2);
  if (anchor.world && gyro.data) { const p = anchorProject(); anchor.seen = !!p; if (p) Object.assign(floorGeo, p); }
  else { // sin giroscopio: el balón queda fijo en la pantalla
    anchor.seen = true; floorGeo.cx = anchor.fx * innerWidth; floorGeo.cy = anchor.fy * innerHeight;
    floorGeo.r = FLOOR.BALL_R / (FLOOR.BALL_D * th) * innerHeight / 2;
  }
  const ring = $('ring'), d = floorGeo.r * 2.5;
  ring.style.width = ring.style.height = d + 'px'; ring.style.transform = `translate(${floorGeo.cx - d / 2}px,${floorGeo.cy - d / 2}px)`;
  $('floorUi').style.top = (innerHeight * (1 - FLOOR.F) + 6) + 'px';
}
function floorZone(vw, vh) { // zona del balón en píxeles del video (para el detector); null si no se ve
  if (!anchor.seen) return null;
  const m = stripMap();
  let x = (floorGeo.cx - m.ox) / m.s; if (S.mirror) x = vw - x;
  return { x, y: (floorGeo.cy - m.oy) / m.s, r: floorGeo.r / m.s * 1.3 };
}
function floorPlace(obj) { // ubica el balón 3D justo encima del punto de tu piso (posición y tamaño en pantalla)
  if (!footMode) return false;
  obj.visible = anchor.seen; if (!anchor.seen) return false;
  const W = innerWidth, H = innerHeight, th = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), D = FLOOR.BALL_D;
  const nx = floorGeo.cx / W * 2 - 1, ny = -(floorGeo.cy / H * 2 - 1);
  camera.localToWorld(obj.position.set(nx * th * camera.aspect * D, ny * th * D, -D));
  obj.scale.setScalar(floorGeo.r * D * th / (FLOOR.BALL_R * H / 2));
  return true;
}
function setFloorMsg(t) { const m = $('floorMsg'); if (m.textContent !== t) m.textContent = t; }
async function beginFoot() {
  if (!S.cam || !video.srcObject) { toast('Para patear con el pie necesitas la cámara. Juega deslizando el dedo.', 4000); startScene(); return; }
  if (handsOn) { stopHands(); handsOn = false; hand.present = false; $('cursor').style.opacity = 0; }
  footMode = true; updatePip(); keepAwake(); requestGyro();
  // la vista 3D del estadio queda fija; el giroscopio se usa solo para anclar el balón a tu piso
  if (gyro.on) { gyroBeforeFoot = true; gyro.on = false; } lookReset(look.yaw, 0); refreshTools();
  floorBuild(); floorMesh.visible = true; floorReset(); floorLayout();
  document.body.classList.add('floor'); $('floorUi').classList.remove('hidden'); $('ring').classList.remove('hidden');
  setFloorMsg('🟡 Pie detrás del balón');
  startFoot(video, floorZone, onFoot);
  card('🦶 PATEA DE VERDAD', `<ol class="steps"><li><b>Sostén el celular</b> con la cámara de atrás apuntando a tus pies.</li><li>Abajo verás <b>tu piso con el balón encima</b>. El balón se queda en ese lugar aunque muevas el celular. Para cambiarlo de sitio, <b>toca tu piso</b>.</li><li>Pon un pie detrás del balón y, cuando el aro se ponga <b>verde</b>, <b>¡patéalo!</b> Para apuntar, patea un poco hacia la izquierda o la derecha.</li></ol><p class="small">¿No cuenta tus patadas? Toca «⚡ Sensib.». También puedes deslizar el dedo hacia arriba.</p>`, [{ label: '¡A PATEAR!', primary: true, fn: () => { floorReset(); startScene(); } }], 'how');
}
function endFoot() {
  const was = footMode; footMode = false; stopFoot();
  if (floorMesh) floorMesh.visible = false;
  document.body.classList.remove('floor'); $('floorUi').classList.add('hidden'); $('ring').classList.add('hidden');
  if (!was) { updatePip(); return; }
  if (gyroBeforeFoot) { gyroBeforeFoot = false; gyro.on = true; recenter(); refreshTools(); }
  if (S.mode === 'hand' && !handsOn) startHands(video, onHand).then(() => { handsOn = true; updatePip(); }).catch(() => {});
  updatePip();
}
function onFoot(r) {
  if (!footMode) return;
  const now = performance.now(), ring = $('ring');
  if (r.kick && S.scene && S.scene.kick && !blocked() && (!S.scene.canKick || S.scene.canKick())) {
    if (navigator.vibrate) navigator.vibrate(40);
    S.scene.kick({ pw: r.kick.pw, lat: r.kick.lat }); floorFlash = now; ring.dataset.st = 'kick'; setFloorMsg('⚡ ¡PATADA!'); return;
  }
  if (now - floorFlash < 900) return;
  const st = r.ready ? 'good' : r.still === false ? 'move' : 'mid';
  ring.dataset.st = st;
  setFloorMsg(!anchor.seen ? '📱 Apunta al balón' : st === 'good' ? '🟢 ¡Patea!' : st === 'move' ? '📱 Más quieto' : '🟡 Pie detrás del balón');
}
// tocar tu piso (sin deslizar) pone el balón en ese lugar
let floorTap = null;
touch.addEventListener('pointerdown', e => { floorTap = footMode ? { x: e.clientX, y: e.clientY, t: e.timeStamp } : null; });
touch.addEventListener('pointerup', e => {
  const s = floorTap; floorTap = null;
  if (!s || !footMode || blocked() || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 14 || e.timeStamp - s.t > 400) return;
  if (e.clientY < innerHeight * (1 - FLOOR.F)) return;
  if (S.scene && S.scene.canKick && !S.scene.canKick()) return;
  if (gyro.data) { if (placeBallAt(e.clientX, e.clientY)) { sfx('click'); toast('📍 Balón colocado ahí', 1000); } else toast('📱 Apunta el celular hacia el piso', 1600); }
  else { anchor.fx = e.clientX / innerWidth; anchor.fy = e.clientY / innerHeight; sfx('click'); }
});
$('fPlace').onclick = () => { sfx('click'); floorReset(); toast('📍 Balón frente a ti', 1000); };
const SENS = [[1, 'normal'], [1.6, 'alta'], [0.7, 'baja']];
$('fSens').onclick = () => {
  const i = (SENS.findIndex(([v]) => v === foot.sens) + 1) % SENS.length; foot.sens = SENS[i][0];
  $('fSens').textContent = '⚡ Sensib.: ' + SENS[i][1];
  toast(['Sensibilidad normal', 'Sensibilidad alta: basta un toque suave', 'Sensibilidad baja: solo patadas fuertes'][i], 1800);
};

/* ================= Escenas ================= */
const ctx = {
  root, camera, scene, renderer, ptr, sfx, toast, flash, card, stars: S.stars, EYE, look, isMobile,
  info: setInfo, hint: setHint, lookReset, recenter,
  burst: (p, c, n, sp) => sparks.emit(p, c, n, sp),
  isHand: () => S.mode === 'hand',
  handVisible: () => S.mode === 'hand' && hand.present,
  gyroOn: () => gyro.on && !!gyro.data, gyroData: () => gyro.data, GAMES, audio: () => (S.sound && ac ? ac : null),
  footOn: () => footMode || (inXR() && !!(GAMES[S.key] && GAMES[S.key].foot)), // en el visor, los juegos de patada usan el balón que flota frente a ti
  floorPlace: o => (inXR() ? XRM.floorPlace(o) : floorPlace(o)), floorReset: () => footMode && floorReset(),
  inXR: () => inXR(), xr: () => XRM, pop, shake, slowmo, best, fx: () => S.fx,
  teleport: (x, z, fx, fz, y) => inXR() && XRM.teleport(x, z, fx, fz, y), // (fx, fz): punto al que quedas mirando · y: altura del piso donde quedas parado
  enter: (k, o) => enter(k, o), win: (k, st) => win(k, st), lose: m => lose(m), ready: () => ready()
};
let winStar = null, winT = 0;
function enter(key, opt = {}) {
  fade(true);
  setTimeout(() => {
    const xr = inXR(); if (xr) XRM.gameEnd(); // 🥽 deja los materiales como estaban antes de borrar el juego
    if (S.scene && S.scene.dispose) S.scene.dispose();
    if (!GAMES[key] || !GAMES[key].foot) endFoot();
    for (const c of [...root.children]) { root.remove(c); disposeTree(c); }
    scene.fog = null; winStar = null; drag = null; dwell.key = null; trauma.v = 0; slow.t = 0;
    setInfo(''); setHint(''); $('crosshair').classList.add('hidden'); $('arrow').classList.add('hidden'); $('meter').classList.add('hidden');
    if (xr) { // en el visor: el cofre es el menú 3D y el juego se arma frente a ti (sin intro de cámara)
      if (key === 'hub') { S.scene = null; S.key = 'quest'; fade(false); XRM.showMenu(); return; }
      S.key = key; XRM.recenter();
      S.scene = GAMES[key].create(ctx, { ...opt, xr: true }); XRM.gameStart(S.scene); fade(false);
      if (opt.quick) startScene(); else stageTitle(key);
      return;
    }
    camera.position.set(0, EYE, 0); lookReset(0, 0); setPtr(innerWidth / 2, innerHeight / 2, 'touch');
    S.key = key; refreshTools();
    document.body.classList.toggle('world', key !== 'hub');
    S.scene = key === 'hub' ? createHub(ctx, opt) : GAMES[key].create(ctx, opt);
    fade(false);
    if (key === 'hub') hideStage();
    else if (opt.quick) startScene();
    else stageTitle(key); // título pixel + jingle mientras pasa la intro de cámara
  }, 280);
}
function startScene() { // algunos juegos empiezan con cuenta regresiva 3-2-1-¡YA!
  const sc = S.scene, G = GAMES[S.key]; if (!sc) return;
  hideStage();
  if (G && G.countdown) countdown(() => { if (S.scene === sc) sc.start(); }); else sc.start();
}
function ready() { // la escena terminó su intro: mostrar instrucciones
  if (inXR()) return XRM.ready(S.key, startScene);
  const G = GAMES[S.key];
  const play = G.foot ? [
    ...(S.cam ? [{ label: '🦶 Patear con mi pie (cámara)', primary: true, fn: () => beginFoot() }] : []),
    { label: S.mode === 'hand' ? '☝️ Jugar con mi dedo índice' : '👆 Jugar deslizando el dedo', primary: !S.cam, fn: () => { endFoot(); startScene(); } }
  ] : [{ label: '▶ ¡A JUGAR!', primary: true, fn: startScene }];
  card(G.title, `<p>${G.how(S.mode === 'hand')}</p>`, [
    ...play,
    { label: 'Volver a los destinos', fn: () => enter('hub', { opened: true }) }
  ], 'how');
}
const MEDAL = { oro: ['🥇', 'ORO'], plata: ['🥈', 'PLATA'], bronce: ['🥉', 'BRONCE'] };
function win(key, st = {}) { // st (opcional): { medal: 'oro'|'plata'|'bronce', line: 'texto de estadísticas', record: 'texto de récord' }
  const G = GAMES[key];
  S.stars[key] = 1; updateStars(); sfx('win'); shake(0.25);
  winStar = starMesh(); winStar.position.copy(camera.localToWorld(new THREE.Vector3(0, 0.1, -2.2))); winStar.scale.setScalar(0.01); root.add(winStar); winT = 0;
  sparks.emit(winStar.position, [0xffd700, 0xffffff, 0xff9d00], 80, 2);
  setTimeout(() => {
    const all = NAMES.every(([k]) => S.stars[k]), m = MEDAL[st.medal];
    card('¡NIVEL SUPERADO!', `${m ? `<div class="medal ${st.medal}"><span>${m[0]}</span><b>${m[1]}</b></div>` : '<div class="bigstar">⭐</div>'}<p class="win-t">${G.winMsg}</p>${st.line ? `<p class="stats">${st.line}</p>` : ''}${st.record ? `<p class="record">${pxText(st.record)}</p>` : ''}<p>⭐ <b>¡Estrella de ${G.short} desbloqueada!</b></p><p class="fact">💡 ${G.fact}</p>`,
      [{ label: all ? 'Ver final 🎉' : 'Continuar', primary: true, fn: () => all ? finale() : enter('hub', { opened: true }) }, { label: '↻ Jugar otra vez', fn: () => enter(key, { quick: true }) }], 'win');
  }, 1600);
}
function lose(msg) {
  sfx('lose');
  card('¡CASI!', `<div class="bigstar">💪</div><p>${msg}</p>`, [
    { label: '↻ Reintentar', primary: true, fn: () => enter(S.key, { quick: true }) },
    { label: 'Volver a los destinos', fn: () => enter('hub', { opened: true }) }
  ], 'lose');
}
function finale() {
  enter('hub', { opened: true });
  setTimeout(() => {
    sfx('final'); let n = 0;
    const iv = setInterval(() => {
      sparks.emit(camera.localToWorld(new THREE.Vector3(Math.random() * 1.6 - 0.8, Math.random() * 1.2 - 0.3, -2.5)), [0xff4fa3, 0xffd54a, 0x24d1ff, 0x7bff6a, 0xff3b30], 40, 2.2);
      if (++n > 14) clearInterval(iv);
    }, 180);
    card('¡FELICIDADES!', '<p class="win-t">HAS COMPLETADO TU TOUR POR CAROLINA DEL NORTE</p><div class="bigstar">⭐⭐⭐⭐⭐⭐⭐</div><p>Volaste como los hermanos Wright en Kitty Hawk, salvaste el Research Triangle, exploraste Charlotte, navegaste por los Outer Banks y jugaste con los Hornets, los Panthers y el Charlotte FC.</p>',
      [{ label: '↻ Volver a jugar', primary: true, fn: replay }], 'win');
  }, 400);
}
function replay() { for (const k in S.stars) S.stars[k] = 0; updateStars(); enter('hub'); }

/* ================= Cámara ================= */
function stopCamera() { const s = video.srcObject; if (s) s.getTracks().forEach(t => t.stop()); video.srcObject = null; }
async function startCamera(facing = isMobile ? 'environment' : 'user') {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('nohttps');
  stopCamera();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }
  });
  const fm = stream.getVideoTracks()[0].getSettings().facingMode;
  S.mirror = fm ? fm === 'user' : !isMobile;
  video.classList.toggle('mirror', S.mirror);
  video.srcObject = stream;
  await video.play();
}

/* ================= Flujo de pantallas ================= */
document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', e => { // 🌐 cambiar idioma (inglés / español)
  e.stopPropagation(); applyLang(b.dataset.lang); sfx('click'); updateStars();
  const sc = S.scene; if (sc && sc.refreshHint) sc.refreshHint();
  if (S.key === 'hub') enter('hub', { opened: true }); // los letreros 3D del cofre se vuelven a dibujar en el idioma nuevo
}));
$('bStart').onclick = () => { audioInit(); sfx('coin'); flash('white'); show('perm'); };
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
  if (!$('optQuest').classList.contains('hidden') && /OculusBrowser|Quest/i.test(navigator.userAgent)) { // en el visor se recomienda el Modo Quest
    $('optHand').classList.remove('rec'); $('optTouch').classList.remove('rec'); $('optQuest').classList.add('rec');
  }
  show('controls');
}
document.querySelectorAll('.opt[data-m]').forEach(b => b.onclick = () => { sfx('click'); chooseMode(b.dataset.m); });
async function chooseMode(m) {
  audioInit(); requestGyro(); keepAwake(); show(null);
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
  } else if (handsOn) { stopHands(); handsOn = false; hand.present = false; $('cursor').style.opacity = 0; drawPts(null); pip.pts = []; }
  refreshTools();
  if (S.scene && S.scene.refreshHint) S.scene.refreshHint();
}

/* ================= Barra superior y menú ⚙️ ================= */
const menu = $('menu');
function openMenu() { sfx('click'); refreshTools(); menu.classList.add('show'); setTimeout(() => $('menuClose').focus(), 50); }
function closeMenu() { menu.classList.remove('show'); }
$('bMenu').onclick = openMenu;
$('menuClose').onclick = () => { sfx('click'); closeMenu(); };
menu.addEventListener('click', e => { if (e.target === menu) closeMenu(); });
addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
$('bBack').onclick = () => { sfx('click'); enter('hub', { opened: true }); };
$('bSound').onclick = () => { audioInit(); S.sound = !S.sound; refreshTools(); sfx('click'); };
$('bMode').onclick = () => { closeMenu(); sfx('click'); goControls(); };
$('bRestart').onclick = () => {
  closeMenu(); sfx('click');
  if (S.key === 'hub') card('¿REINICIAR?', '<p>Se borrarán tus estrellas y el cofre se cerrará.</p>', [{ label: 'Sí, reiniciar', primary: true, fn: replay }, { label: 'Cancelar' }]);
  else enter(S.key, { quick: true });
};
$('bCenter').onclick = () => { closeMenu(); sfx('click'); lookReset(look.yaw, 0); toast('Vista centrada al frente 🎯', 1500); };
$('bGyro').onclick = () => {
  requestGyro(); gyro.on = !gyro.on; lookReset(look.yaw, 0);
  refreshTools(); toast(gyro.on ? 'Movimiento activado: gira el celular para mirar alrededor' : 'Movimiento desactivado: arrastra el dedo para mirar', 2200);
};
$('bFx').onclick = () => { S.fx = !S.fx; store.set('fx', S.fx); refreshTools(); sfx('click'); toast(S.fx ? '✨ Efectos completos: sacudidas y cámara lenta' : 'Efectos reducidos: sin sacudidas ni cámara lenta', 2000); };

/* ================= 🥽 Modo Quest (xr.js) ================= */
function clearScene() { // quita el juego actual (al entrar y salir del visor)
  if (S.scene && S.scene.dispose) S.scene.dispose();
  S.scene = null; for (const c of [...root.children]) { root.remove(c); disposeTree(c); }
  scene.fog = null; winStar = null; trauma.v = 0; slow.t = 0; setInfo(''); setHint('');
}
XRM = initXR({
  renderer, scene, camera, root, GAMES, ORDER, stars: S.stars, sfx, audioInit, toastDom: toast, fx: () => S.fx,
  key: () => S.key, enter: (k, o) => enter(k, o),
  sound: () => S.sound, setSound: v => { S.sound = v; refreshTools(); }, current: () => S.scene,
  onStart() { // al ponerte el visor: se cierran las pantallas del celular, se apaga la cámara de manos y se ajusta la calidad
    closeMenu(); $('card').classList.remove('show'); show(null); hideStage(); $('count').classList.add('hidden');
    endFoot(); if (handsOn) { stopHands(); handsOn = false; hand.present = false; $('cursor').style.opacity = 0; }
    clearScene(); S.key = 'quest'; $('hud').classList.add('hidden');
    setQuality(QUEST.SHADOWS ? 1 : 0); renderer.shadowMap.enabled = QUEST.SHADOWS;
  },
  onEnd() { // al salir: de vuelta a «¿Cómo juegas?» con todo como estaba
    clearScene(); S.key = null; applyQuality(S.quality); lookReset(0, 0); goControls();
  }
});

/* ================= Bucle principal ================= */
const clock = new THREE.Clock(); let T = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05); T += dt;
  const xrOn = inXR(); // en el visor la cabeza mueve la cámara: sin giroscopio, sin arrastre y sin sacudidas
  if (xrOn) XRM.frame(dt);
  else if (!(S.scene && S.scene.camLock)) applyLook();
  // con la mano en los bordes de la pantalla también se puede girar la vista (computador sin giroscopio)
  if (S.mode === 'hand' && hand.present && !gyro.on && S.scene && S.scene.look && !blocked()) {
    const ex = hand.x / innerWidth;
    if (ex < 0.1) look.yaw += dt * 0.9; else if (ex > 0.9) look.yaw -= dt * 0.9;
  }
  if (!xrOn) { ptr.ray.setFromCamera(ptr.ndc, camera); updateDwell(dt); }
  const sdt = slow.t > 0 ? dt * slow.k : dt; if (slow.t > 0) slow.t -= dt; // cámara lenta en momentos clave
  if (S.scene && S.scene.update) S.scene.update(sdt, T);
  if (trauma.v > 0 && !xrOn) { // sacudida de cámara (trauma²): fuerte al golpe y se calma sola
    const a = trauma.v * trauma.v * 0.035; camera.rotateX((Math.random() - 0.5) * a); camera.rotateY((Math.random() - 0.5) * a);
    trauma.v = Math.max(0, trauma.v - dt * 1.6);
  }
  if (footMode) {
    floorLayout(); $('ring').classList.toggle('off', !anchor.seen || !!(S.scene && S.scene.canKick && !S.scene.canKick()));
    if (!anchor.seen) setFloorMsg('📱 Apunta al balón');
  }
  if (winStar) {
    winT += dt;
    winStar.scale.setScalar(Math.min(1, winT * 2) * 0.9);
    winStar.position.y += dt * 0.15; winStar.rotation.y += dt * 4;
    if (Math.random() < 0.3) sparks.emit(winStar.position, 0xffd700, 2, 0.8);
  }
  sparks.update(sdt);
  renderer.render(scene, camera);
  if (xrOn) XRM.afterRender();
  drawPip(performance.now());
});
updateStars();
if (location.search.includes('debug')) window.__fl = { S, enter, ctx, camera, root, look, onFoot, beginFoot, startScene, xr: XRM };

// Calidad: bajo / medio / alto (resolución y sombras)
function applyQuality(q) {
  S.quality = q; setQuality(q);
  renderer.setPixelRatio(Math.min(devicePixelRatio, [1, 1.5, 2][q])); renderer.shadowMap.enabled = q > 0; resize();
  document.querySelectorAll('.qbtn[data-q]').forEach(b => b.classList.toggle('on', +b.dataset.q === q));
}
document.querySelectorAll('.qbtn[data-q]').forEach(b => (b.onclick = () => { applyQuality(+b.dataset.q); toast(['Calidad baja: más fluido', 'Calidad media', 'Calidad alta: más detalle'][+b.dataset.q], 1600); }));
applyQuality(S.quality);
