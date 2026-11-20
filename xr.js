// xr.js — 🥽 MODO QUEST (Meta Quest 3S y otros visores con WebXR)
// Es un modo APARTE y opcional: si el navegador no soporta realidad virtual o mixta, el botón ni aparece
// y los modos del celular (táctil, mano y pie) no cambian.
// Aquí vive: entrar y salir del visor, tus manos (el dedo índice es el cursor), el menú 3D flotante,
// los paneles 3D (tarjetas, avisos y mensajes) y las reglas de confort (fundidos, sin sacudidas, vibración del control).
import * as THREE from 'three';

/* ================= Ajustes que puedes tocar ================= */
// MENU_D: a cuántos metros de ti aparece el menú · MENU_DROP: cuánto más abajo de tus ojos (m)
// POKE: el dedo pulsa un botón al llegar a esta distancia de su superficie (m) · POKE_OUT: al alejarlo esto, puede volver a pulsar
// NEAR: con el dedo a menos de esto de un panel se usa el dedo y se esconde el rayo (m)
// FOLLOW: si miras más de estos grados lejos del menú, el menú vuelve frente a ti
// SCALE: resolución en el visor (1 = la recomendada por el visor; menos = más fluido)
// FOVEA: 0 a 1, cuánto se simplifican los bordes de la vista (más = más fluido) · FPS: cuadros por segundo pedidos al visor
// SHADOWS: sombras dentro del visor (se ven mejor pero cuestan rendimiento)
export const QUEST = { MENU_D: 1.0, MENU_DROP: 0.2, POKE: 0.008, POKE_OUT: 0.025, NEAR: 0.15, FOLLOW: 55, SCALE: 1, FOVEA: 1, FPS: 72, SHADOWS: false };
// Patada con la mano (Penales y Fútbol americano). MIN: velocidad mínima de la mano para que cuente (m/s)
// REACH: qué tan cerca del balón cuenta el golpe (m) · POWER: fuerza por cada m/s de la mano · LIFT: cuánto sube el tiro si golpeas hacia arriba
// AIM: cuánto se desvía si golpeas hacia un lado · TEE_D / TEE_DROP: el balón flota a TEE_D m al frente y TEE_DROP m más abajo de tus ojos
export const HANDKICK = { MIN: 1.2, REACH: 0.08, POWER: 0.1, LIFT: 0.6, AIM: 1.2, TEE_D: 0.45, TEE_DROP: 0.7 };
// Ventana al estadio en realidad mixta: ancho y alto (m) y a qué distancia de ti
export const WINDOW = { W: 3.2, H: 2.5, D: 1.8 };

// Juegos del visor (ya están los 7) y cómo se juegan con las manos
const SPORTS = {
  city: { c: '#ff4fa3', how: 'Estás en Uptown Charlotte. Encuentra 5 íconos del estado en 60 segundos: 🏁 🍩 🥤 🏀 👑. Gira para mirar a tu alrededor (¡también detrás de ti!) y sigue los haces de luz y la flecha amarilla. Apunta con la mano a un objeto y junta los dedos: vuela hasta tu mano.' },
  miami: { c: '#24d1ff', how: 'Viajas de pie en una lancha (o moto de agua) por los Outer Banks de Carolina del Norte; la playa, los faros y los caballos salvajes quedan a tu derecha. Para cambiar de carril inclina el cuerpo a la izquierda o a la derecha (o usa los botones ◀ ▶ de tu derecha o la palanca del control). Recoge estrellas ⭐, esquiva las boyas 🔴🟢, responde 5 preguntas y fotografía los animales: apúntalos con la mano y junta los dedos 📸. Si te mareas, cierra los ojos un momento o quítate el visor.' },
  heat: { c: '#ff8a00', full: 'Cancha completa', how: 'Toca el balón con la palma para agarrarlo. Empújalo hacia el piso para driblar: vuelve a tu mano. Para tirar, súbelo sobre tu cabeza y lánzalo cuando la barra esté en VERDE. Tiras desde la bandeja, el doble, el triple y al final puedes hacer una CLAVADA. Mete 5 canastas.' },
  fg: { c: '#3ddc84', full: 'Estadio completo', how: 'El estadio se abre como una ventana. Golpea el balón con la palma hacia los postes: más fuerte llega más lejos y hacia un lado apuntas a ese lado. Ojo: los jugadores cambian los postes de lado.' },
  orlando: { c: '#9b5cff', how: 'El primer vuelo se juega en el celular.' },
  penalty: { c: '#24d1ff', full: 'Estadio completo', how: 'El estadio se abre como una ventana. Golpea el balón con la palma hacia el arco: si golpeas hacia arriba va alto y hacia un lado apuntas a esa esquina. La esquina dorada vale doble.' }
};
const WORLDS = ['city', 'miami']; // 'orlando' (primer vuelo) se juega solo en el celular // fila de mundos en realidad virtual del menú (en este orden)

/* ================= Estilo «arcade tropical» (los mismos colores de CSS/style.css) ================= */
const C = { ink: '#1a0b2e', violet: '#2a0e4a', pink: '#ff4fa3', orange: '#ff8a00', sun: '#ffd54a', sea: '#24d1ff', ok: '#3ddc84', bad: '#ff4d5e', text2: '#c9d1ff' };
const PXF = "'Press Start 2P', monospace", UIF = "'Baloo 2', system-ui, sans-serif", EMO = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
const PX = 1000; // píxeles del dibujo por metro de panel (1 px = 1 mm)
const pxText = s => String(s).normalize('NFD').replace(/[̀-̂̄-ͯ]/g, '').normalize('NFC'); // la fuente pixel no trae tildes
const mg = document.createElement('canvas').getContext('2d'); // solo para medir textos
const htmlText = h => { // las tarjetas del juego vienen en HTML: se pasan a texto con saltos de línea
  const d = document.createElement('div');
  d.innerHTML = String(h).replace(/<li[^>]*>/g, '\n• ').replace(/<\/(p|div|li|ol|ul)>|<br\s*\/?>/g, '\n');
  return d.textContent.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
};
function wrapLines(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (line && g.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}
function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
function fit(g, text, weight, size, fam, maxW) { // achica la letra hasta que el texto quepa
  do g.font = `${weight} ${size}px ${fam}`; while (g.measureText(text).width > maxW && --size > 10);
}
function panelBg(g, W, H, accent, r = 34) {
  const gr = g.createLinearGradient(0, 0, W * 0.4, H); gr.addColorStop(0, 'rgba(30,40,110,.96)'); gr.addColorStop(1, 'rgba(56,24,96,.96)');
  rr(g, 8, 8, W - 16, H - 16, r); g.fillStyle = gr; g.fill();
  g.lineWidth = 5; g.strokeStyle = accent; g.shadowColor = accent; g.shadowBlur = 14; g.stroke(); g.shadowBlur = 0;
}
function drawBtn(label, kind = 'ghost', size = 30) { // botón redondeado: primary (amarillo-naranja), ghost o danger
  return (g, W, H, st) => {
    const hov = st === 'hover', prs = st === 'press';
    rr(g, 6, 6, W - 12, H - 12, (H - 12) / 2);
    if (kind === 'primary') { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffe58a'); gr.addColorStop(0.35, C.sun); gr.addColorStop(1, C.orange); g.fillStyle = gr; }
    else g.fillStyle = kind === 'danger' ? `rgba(255,77,94,${hov ? 0.42 : 0.2})` : `rgba(255,255,255,${hov ? 0.24 : 0.1})`;
    g.fill();
    if (prs) { g.fillStyle = 'rgba(0,0,0,.28)'; g.fill(); }
    g.lineWidth = hov ? 7 : 3; g.strokeStyle = hov ? (kind === 'primary' ? '#fff' : C.sun) : kind === 'danger' ? C.bad : 'rgba(255,255,255,.35)';
    if (hov) { g.shadowColor = C.sun; g.shadowBlur = 14; } g.stroke(); g.shadowBlur = 0;
    g.fillStyle = kind === 'primary' ? C.ink : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fit(g, label, 800, size, UIF, W - 50); g.fillText(label, W / 2, H / 2 + 2);
  };
}

/* ================= Módulo ================= */
export function initXR(api) {
  const { renderer, scene, camera, GAMES, ORDER } = api;
  const rig = camera.parent; // la cámara y las manos viven dentro del mismo grupo (el origen del visor)
  const ANISO = renderer.capabilities.getMaxAnisotropy();
  const ui = new THREE.Group(); ui.visible = false; scene.add(ui); // todo lo del visor: menú, tarjetas, rayos y cursores
  const hud = new THREE.Group(); ui.add(hud);                       // avisos que te siguen la mirada con suavidad
  const surfs = new Set();                                          // superficies que tocas o apuntas (paneles y botones)
  let session = null, xmode = '', frames = 0, cardG = null, toastS = null, toastT = 0, state = '';
  const slots = { info: null, hint: null }, pops = [], popLog = [];
  const isQuestUA = /OculusBrowser|Quest/i.test(navigator.userAgent);

  // ---------- superficies dibujadas con canvas ----------
  function surface(w, h, draw, order = 1, top = false) {
    const cv = document.createElement('canvas'); cv.width = Math.ceil(w * PX); cv.height = Math.ceil(h * PX);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = ANISO;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, toneMapped: false, fog: false, depthTest: !top }));
    mesh.renderOrder = order;
    const s = { mesh, w, h, tex, st: '', z0: 0, lift: 0, liftV: 0, flash: 0 };
    s.paint = (st = s.st) => { s.st = st; const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); draw(g, cv.width, cv.height, st); tex.needsUpdate = true; };
    mesh.userData.surf = s; s.paint('idle');
    return s;
  }
  function button(w, h, draw, onPress, order = 2) { const b = surface(w, h, draw, order); b.onPress = onPress; surfs.add(b); return b; }
  function pad(s) { surfs.add(s); return s; } // panel que «frena» el dedo y el rayo (sin acción)
  function place(s, parent, x, y, z = 0) { s.mesh.position.set(x, y, z); s.z0 = z; parent.add(s.mesh); return s; }
  function drop(s) { if (!s) return; surfs.delete(s); s.mesh.removeFromParent(); s.mesh.geometry.dispose(); s.mesh.material.dispose(); s.tex.dispose(); }
  function dropGroup(g) { if (!g) return; for (const m of [...g.children]) if (m.userData.surf) drop(m.userData.surf); g.removeFromParent(); }
  const shown = o => { for (; o; o = o.parent) { if (!o.visible) return false; if (o === scene) return true; } return false; };

  // ---------- dónde está tu cabeza y hacia dónde miras ----------
  const _head = new THREE.Vector3(), _fwd = new THREE.Vector3(), _to = new THREE.Vector3(), _goal = new THREE.Vector3();
  function headPose() {
    camera.getWorldPosition(_head); camera.getWorldDirection(_fwd); _fwd.y = 0;
    if (_fwd.lengthSq() < 1e-4) _fwd.set(0, 0, -1); _fwd.normalize();
  }
  function putInFront(obj, dist, dy) {
    headPose(); obj.position.copy(_head).addScaledVector(_fwd, dist); obj.position.y = _head.y + dy;
    obj.lookAt(_head.x, obj.position.y, _head.z);
  }
  // «seguimiento perezoso»: si el panel queda lejos de tu mirada un momento, vuelve con suavidad frente a ti
  function follow(obj, mem, dist, dt, deg = QUEST.FOLLOW) {
    headPose(); _to.copy(obj.position).sub(_head); _to.y = 0;
    const ang = THREE.MathUtils.radToDeg(_to.angleTo(_fwd));
    mem.away = ang > deg ? (mem.away || 0) + dt : 0;
    if (mem.away > 0.6) mem.go = true;
    if (!mem.go) return;
    _goal.copy(_head).addScaledVector(_fwd, dist); _goal.y = obj.position.y;
    obj.position.lerp(_goal, 1 - Math.exp(-dt * 5)); obj.lookAt(_head.x, obj.position.y, _head.z);
    if (obj.position.distanceTo(_goal) < 0.01) mem.go = false;
  }

  // ---------- menú 3D flotante ----------
  const menu = new THREE.Group(); menu.visible = false; ui.add(menu);
  const menuMem = {}; let menuPlaced = false, menuBg = null, soundB = null;
  const MW = 1.12, MH = 0.74;
  const starsN = () => ORDER.filter(([k]) => api.stars[k]).length;
  function buildMenu() {
    for (const m of [...menu.children]) if (m.userData.surf) drop(m.userData.surf);
    menuBg = pad(place(surface(MW, MH, (g, W, H) => {
      panelBg(g, W, H, C.pink);
      g.textBaseline = 'alphabetic'; g.textAlign = 'left';
      g.font = `58px ${PXF}`; const tg = g.createLinearGradient(46, 50, 46 + 430, 110); tg.addColorStop(0, C.sun); tg.addColorStop(0.5, C.orange); tg.addColorStop(1, C.pink);
      g.fillStyle = '#b8005a'; g.fillText('CAROLINA', 50, 112); g.fillStyle = tg; g.fillText('CAROLINA', 46, 108);
      g.font = `20px ${PXF}`; g.fillStyle = C.sea; g.fillText('MODO QUEST', 50, 148);
      const sn = starsN(); g.textAlign = 'right'; g.font = `26px ${PXF}`; g.fillStyle = sn === ORDER.length ? C.sun : '#fff';
      g.fillText(`${sn}/${ORDER.length}`, W - 50, 104); g.font = `40px ${EMO}`; g.fillText('⭐', W - 50 - g.measureText(`${sn}/${ORDER.length}`).width - 64, 108);
      g.font = `600 22px ${UIF}`; g.fillStyle = C.text2; g.fillText('☝️ Toca con el dedo  ·  🤏 o apunta y junta los dedos', W - 46, 148);
      g.textAlign = 'left'; g.font = `700 24px ${UIF}`;
      g.fillText('DEPORTES · REALIDAD MIXTA', 46, 192); g.fillText('MUNDOS · REALIDAD VIRTUAL', 46, 480);
    }, 1), menu, 0, 0, 0));
    const at = (x, y, w, h) => [x / PX + w / PX / 2 - MW / 2, MH / 2 - y / PX - h / PX / 2];
    ['heat', 'fg', 'penalty'].forEach((k, i) => { // fichas grandes de los deportes
      const [x, y] = at(46 + i * 352, 208, 324, 234);
      place(button(0.324, 0.234, drawSport(k), () => openSport(k)), menu, x, y, 0.004);
    });
    WORLDS.forEach((k, i) => { // los 4 mundos en realidad virtual, en una fila
      const [x, y] = at(46 + i * 261, 496, 245, 112);
      place(button(0.245, 0.112, drawWorld(k), () => openSport(k)), menu, x, y, 0.004);
    });
    let [x, y] = at(46, 630, 290, 84);
    place(button(0.29, 0.084, drawBtn('🚪 Salir del Quest', 'danger', 28), end), menu, x, y, 0.004);
    [x, y] = at(352, 630, 250, 84);
    soundB = place(button(0.25, 0.084, (g, W, H, st) => drawBtn(api.sound() ? '🔊 Sonido: sí' : '🔇 Sonido: no', 'ghost', 28)(g, W, H, st), () => { api.setSound(!api.sound()); soundB.paint(); }), menu, x, y, 0.004);
  }
  function drawSport(k) {
    const G = GAMES[k], icon = (ORDER.find(([q]) => q === k) || [])[1], acc = SPORTS[k].c;
    return (g, W, H, st) => {
      const hov = st === 'hover', got = !!api.stars[k];
      rr(g, 6, 6, W - 12, H - 12, 24); g.fillStyle = st === 'press' ? '#120724' : C.ink; g.fill();
      g.save(); g.clip(); const rg = g.createRadialGradient(W / 2, 84, 8, W / 2, 84, 170); rg.addColorStop(0, acc); rg.addColorStop(1, 'rgba(26,11,46,0)');
      g.globalAlpha = hov ? 0.8 : 0.5; g.fillStyle = rg; g.fillRect(0, 0, W, H); g.restore();
      rr(g, 6, 6, W - 12, H - 12, 24); g.lineWidth = hov ? 8 : 4; g.strokeStyle = hov ? C.sun : acc;
      if (hov) { g.shadowColor = C.sun; g.shadowBlur = 16; } g.stroke(); g.shadowBlur = 0;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `86px ${EMO}`; g.fillText(icon, W / 2, 84);
      g.fillStyle = '#fff'; fit(g, G.short, 800, 34, UIF, W - 40); g.fillText(G.short, W / 2, 166);
      g.font = `600 22px ${UIF}`; g.fillStyle = got ? C.sun : C.text2; g.fillText(got ? '⭐ ¡Estrella conseguida!' : 'Toca para jugar', W / 2, 202);
    };
  }
  function drawWorld(k) { // ficha de mundo (Research Triangle, Charlotte, Outer Banks): horizontal, con su color
    const G = GAMES[k], icon = (ORDER.find(([q]) => q === k) || [])[1], acc = SPORTS[k].c;
    return (g, W, H, st) => {
      const hov = st === 'hover', got = !!api.stars[k];
      rr(g, 5, 5, W - 10, H - 10, 20); g.fillStyle = st === 'press' ? '#120724' : C.ink; g.fill();
      g.save(); g.clip(); const rg = g.createRadialGradient(42, H / 2, 6, 42, H / 2, 110); rg.addColorStop(0, acc); rg.addColorStop(1, 'rgba(26,11,46,0)');
      g.globalAlpha = hov ? 0.8 : 0.5; g.fillStyle = rg; g.fillRect(0, 0, W, H); g.restore();
      rr(g, 5, 5, W - 10, H - 10, 20); g.lineWidth = hov ? 7 : 4; g.strokeStyle = hov ? C.sun : acc;
      if (hov) { g.shadowColor = C.sun; g.shadowBlur = 14; } g.stroke(); g.shadowBlur = 0;
      g.textBaseline = 'middle'; g.textAlign = 'center'; g.font = `42px ${EMO}`; g.fillText(icon, 42, H / 2 + 2);
      g.textAlign = 'left'; g.fillStyle = '#fff'; fit(g, G.short, 800, 26, UIF, W - 92); g.fillText(G.short, 78, 44);
      g.font = `600 18px ${UIF}`; g.fillStyle = got ? C.sun : C.text2; g.fillText(got ? '⭐ ¡Conseguida!' : 'Toca para jugar', 78, 78);
    };
  }
  function showMenu() { // el menú aparece frente a ti (al entrar al visor y al volver de un juego)
    gameEnd(); state = 'menu'; buildMenu(); menuPlaced = false; menu.visible = false; menuMem.wait = true; menuMem.at = frames + 2;
  }
  function openSport(k) { api.enter(k); }

  // ---------- tarjeta 3D (lo mismo que las ventanas del celular) ----------
  function card(title, html, btns, kind = '') {
    closeCard();
    const acc = { win: C.sun, lose: C.pink, how: C.sea }[kind] || C.pink;
    const body = htmlText(html); let size = 30, lines;
    do { mg.font = `600 ${size}px ${UIF}`; lines = wrapLines(mg, body, 800); } while (lines.length > 11 && --size > 22);
    const lh = Math.round(size * 1.38), W = 900, bodyY = 150, btnY = bodyY + lines.length * lh + 30, H = btnY + 84 + 44;
    const g = new THREE.Group(); cardG = g; g.userData.t = 0;
    pad(place(surface(W / PX, H / PX, (c) => {
      panelBg(c, W, H, acc);
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = kind === 'lose' ? '#fff' : C.sun;
      const t = pxText(title); fit(c, t, '', 34, PXF, W - 100); c.fillText(t, W / 2, 84);
      c.textAlign = 'left'; c.textBaseline = 'alphabetic'; c.font = `600 ${size}px ${UIF}`; c.fillStyle = '#fff';
      lines.forEach((l, i) => c.fillText(l, 50, bodyY + (i + 0.75) * lh));
    }, 3), g, 0, 0, 0));
    const n = Math.max(1, btns.length), bw = (800 - 20 * (n - 1)) / n;
    btns.forEach((b, i) => {
      const x = (50 + i * (bw + 20) + bw / 2) / PX - W / PX / 2, y = H / PX / 2 - (btnY + 42) / PX;
      place(button(bw / PX, 0.084, drawBtn(b.label, b.primary ? 'primary' : 'ghost', 28), () => { closeCard(); b.fn && b.fn(); }, 4), g, x, y, 0.004);
    });
    ui.add(g);
    if (state === 'menu' && menuPlaced) { g.position.copy(menu.position); g.quaternion.copy(menu.quaternion); g.translateZ(0.04); }
    else putInFront(g, QUEST.MENU_D, -QUEST.MENU_DROP);
    g.scale.setScalar(0.88); menu.visible = false; hud.visible = false; // con la tarjeta abierta, los textos del juego no la tapan
  }
  function closeCard() {
    if (!cardG) return; dropGroup(cardG); cardG = null; hud.visible = true;
    if (state === 'menu' && menuPlaced) { menu.visible = true; for (const m of menu.children) m.userData.surf && m.userData.surf.paint(); }
  }

  // ---------- avisos, textos de juego y mensajes «pop» ----------
  function pill(text, { size = 28, color = '#fff', bg = 'rgba(11,16,38,.9)', border = 'rgba(255,255,255,.2)' } = {}) {
    mg.font = `700 ${size}px ${UIF}`; const lines = wrapLines(mg, text, 880);
    const lh = size * 1.3, W = Math.ceil(Math.max(...lines.map(l => mg.measureText(l).width)) + 64), H = Math.ceil(lines.length * lh + 34);
    return surface(W / PX, H / PX, g => {
      rr(g, 3, 3, W - 6, H - 6, Math.min(30, H / 2 - 3)); g.fillStyle = bg; g.fill(); g.lineWidth = 3; g.strokeStyle = border; g.stroke();
      g.font = `700 ${size}px ${UIF}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
      lines.forEach((l, i) => g.fillText(l, W / 2, 17 + lh * (i + 0.5)));
    }, 20, true);
  }
  const HUD_D = 1.15, HUD_Y = { info: 0.3, toast: -0.27, hint: -0.4 };
  function hudShow() { if (!hud.userData.placed) { putInFront(hud, HUD_D, 0); hud.userData.placed = true; } }
  function toast(msg, ms = 3000) {
    if (!session) return;
    const y = state === 'menu' && !cardG ? 0.27 : HUD_Y.toast; // con el menú abierto, el aviso va por encima para no taparlo
    drop(toastS); toastS = place(pill(htmlText(msg)), hud, 0, y, 0.01); toastT = ms / 1000; hudShow();
  }
  function setSlot(k, t) {
    const txt = htmlText(t || '');
    if (slots[k] && slots[k].txt === txt) return;
    drop(slots[k]); slots[k] = null;
    if (txt) { slots[k] = place(pill(txt, k === 'hint' ? { size: 26, color: C.text2 } : {}), hud, 0, HUD_Y[k]); slots[k].txt = txt; hudShow(); }
  }
  const POPC = { good: [C.sun, '#b8005a'], fire: ['#ffc04d', '#c21800'], bad: ['#fff', C.bad], small: [C.sun, '#b8005a'] };
  function pop(text, kind = 'good') {
    if (!session) return;
    popLog.push(String(text)); if (popLog.length > 30) popLog.shift();
    const t = pxText(text), size = kind === 'bad' || kind === 'small' ? 34 : 52;
    mg.font = `${size}px ${PXF}`; const W = Math.ceil(mg.measureText(t).width + 40), H = size * 2;
    const [fg, sh] = POPC[kind] || POPC.good;
    const s = surface(W / PX, H / PX, g => {
      g.font = `${size}px ${PXF}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = C.violet; g.fillText(t, W / 2 + 6, H / 2 + 6); g.fillStyle = sh; g.fillText(t, W / 2 + 3, H / 2 + 3); g.fillStyle = fg; g.fillText(t, W / 2, H / 2);
    }, 30, true);
    putInFront(s.mesh, 1.5, 0.12 - pops.length * 0.02); ui.add(s.mesh); s.life = 0; s.y0 = s.mesh.position.y; pops.push(s);
  }
  function countdown(cb) { // 3 · 2 · 1 · ¡YA!
    let n = 3;
    const step = () => { pop(n > 0 ? String(n) : '¡YA!'); api.sfx(n > 0 ? 'tick' : 'go'); if (n-- > 0) setTimeout(step, 620); else setTimeout(cb, 450); };
    step();
  }

  // ---------- confort: fundidos suaves, destello tenue y vibración del control en vez de sacudir la vista ----------
  const veil = (r, order) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color: 0, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false })); m.renderOrder = order; m.visible = false; return m; };
  const fadeM = veil(0.3, 9999), flashM = veil(0.28, 9998); let fadeGoal = 0;
  function fade(on) { fadeGoal = on ? 1 : 0; }
  function flash(kind = 'red') { if (!api.fx()) return; flashM.material.color.set(kind === 'white' ? 0xffffff : 0xff0032); flashM.material.opacity = kind === 'white' ? 0.22 : 0.18; }
  function haptic(v = 0.5, ms = 40, only = null) {
    for (const inp of inputs) {
      if (only && inp !== only) continue;
      const a = inp.src && !inp.src.hand && inp.src.gamepad && inp.src.gamepad.hapticActuators && inp.src.gamepad.hapticActuators[0];
      if (a && a.pulse) try { a.pulse(Math.min(1, v), ms); } catch (e) {}
    }
  }
  const shake = a => haptic(0.3 + a, 60 + a * 140);

  // ---------- tus manos y los controles: el dedo índice es el cursor ----------
  const rayTex = (() => { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 64); gr.addColorStop(0, '#000'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64); return new THREE.CanvasTexture(cv); })();
  const rayGeo = new THREE.CylinderGeometry(0.0012, 0.0028, 1, 8, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.5);
  const ringGeo = new THREE.RingGeometry(0.007, 0.0115, 28), dotGeo = new THREE.SphereGeometry(0.0055, 12, 8), jointGeo = new THREE.SphereGeometry(1, 8, 6);
  const mat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, fog: false, ...o });
  const inputs = [0, 1].map(i => {
    const inp = {
      i, ctl: renderer.xr.getController(i), hand: renderer.xr.getHand(i), src: null, hover: null, pressBtn: null, armed: null, near: null, tip: new THREE.Vector3(),
      palmN: new THREE.Vector3(0, -1, 0), // hacia dónde mira tu palma (o el frente del control)
      grabPos: new THREE.Vector3(), palmPos: new THREE.Vector3(), grabPrev: new THREE.Vector3(), palmPrev: new THREE.Vector3(), ok: false, // dónde agarras (entre pulgar e índice) y dónde está tu palma, en el mundo
      pg: { p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0 }, pp: { p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0 }, // sus velocidades (m/s)
      ray: new THREE.Mesh(rayGeo, mat(0xffffff, { alphaMap: rayTex, transparent: true, depthWrite: false })),
      ring: new THREE.Mesh(ringGeo, mat(C.sun, { transparent: true, depthWrite: false })),
      dot: new THREE.Mesh(dotGeo, mat(C.sun)),
      joints: new THREE.InstancedMesh(jointGeo, mat(0xffffff, { transparent: true, opacity: 0.85 }), 25)
    };
    inp.ray.renderOrder = 40; inp.ring.renderOrder = 41; inp.dot.renderOrder = 42;
    inp.joints.frustumCulled = false; inp.joints.count = 0;
    for (const m of [inp.ray, inp.ring, inp.dot, inp.joints]) { m.visible = false; ui.add(m); }
    rig.add(inp.ctl, inp.hand);
    inp.ctl.addEventListener('connected', e => { inp.src = e.data; });
    inp.ctl.addEventListener('disconnected', () => { inp.src = null; inp.hover = inp.pressBtn = inp.armed = inp.near = null; });
    inp.ctl.addEventListener('selectstart', () => {
      if (!session || inp.near) return; // con el dedo cerca de un panel manda el dedo, no la pinza
      if (inp.hover) inp.pressBtn = inp.hover; else sceneInput('selectstart', inp);
    });
    inp.ctl.addEventListener('selectend', () => {
      const b = inp.pressBtn; inp.pressBtn = null;
      if (b) { if (b === inp.hover) press(b, inp); } else if (session) sceneInput('selectend', inp);
    });
    inp.ctl.addEventListener('squeezestart', () => { if (session) sceneInput('squeezestart', inp); }); // botón de agarre del control
    inp.ctl.addEventListener('squeezeend', () => { if (session) sceneInput('squeezeend', inp); });
    return inp;
  });
  const _v1 = new THREE.Vector3(), _pq = new THREE.Quaternion();
  function track(st, p, now) { // velocidad suavizada de un punto de la mano (sin crear objetos en cada cuadro)
    if (st.t) { const dt = Math.max(now - st.t, 1e-3); _v1.copy(p).sub(st.p).divideScalar(dt); st.v.lerp(_v1, 1 - Math.exp(-dt / 0.035)); }
    st.p.copy(p); st.t = now;
  }
  const joint = (inp, n) => { const j = inp.hand.joints && inp.hand.joints[n]; return j && j.visible ? j : null; };
  function handPoints(inp) {
    inp.palmPrev.copy(inp.palmPos); inp.grabPrev.copy(inp.grabPos); // dónde estaba la mano en el cuadro anterior (para el golpe)
    if (inp.src.hand) {
      const th = joint(inp, 'thumb-tip'), ix = joint(inp, 'index-finger-tip'), pm = joint(inp, 'middle-finger-metacarpal') || joint(inp, 'wrist');
      inp.ok = !!pm; if (!pm) return;
      pm.getWorldPosition(inp.palmPos);
      if (th && ix) inp.grabPos.copy(th.getWorldPosition(_v1)).add(ix.getWorldPosition(_l)).multiplyScalar(0.5); else inp.grabPos.copy(inp.palmPos);
      const i0 = joint(inp, 'index-finger-metacarpal'), k0 = joint(inp, 'pinky-finger-metacarpal'), wr = joint(inp, 'wrist');
      if (i0 && k0 && wr) { // normal de la palma: (meñique − índice) × (nudillos − muñeca); en la mano derecha va al revés
        k0.getWorldPosition(_v1).sub(i0.getWorldPosition(_l)); wr.getWorldPosition(_l); _l.subVectors(inp.palmPos, _l);
        inp.palmN.crossVectors(_v1, _l).normalize(); if (inp.src.handedness === 'right') inp.palmN.negate();
      }
      const mt = joint(inp, 'middle-finger-tip'); // mano abierta: la punta del dedo medio lejos de la muñeca
      inp.open = !!(mt && wr) && mt.getWorldPosition(_v1).distanceTo(wr.getWorldPosition(_l)) > 0.15;
    } else { inp.ctl.getWorldPosition(inp.palmPos); inp.grabPos.copy(inp.palmPos); inp.palmN.set(0, 0, -1).applyQuaternion(inp.ctl.getWorldQuaternion(_pq)); inp.ok = true; inp.open = false; }
    const now = performance.now() / 1000; track(inp.pg, inp.grabPos, now); track(inp.pp, inp.palmPos, now);
  }
  function sceneInput(type, inp) { const sc = api.current(); if (sc && sc.xrInput) sc.xrInput(type, inp); } // el juego recibe la pinza / gatillo / agarre
  const sceneRays = () => { const sc = api.current(); return !!(sc && sc.xrRays && sc.xrRays()); };
  const sceneRayLen = inp => { const sc = api.current(); return (sc && sc.xrRayLen && sc.xrRayLen(inp)) || 0; }; // distancia (m) a lo que apunta tu mano en el juego, o 0
  function press(b, inp) { b.flash = 0.14; api.sfx('click'); haptic(0.5, 30, inp); queueMicrotask(() => b.onPress()); }
  const uiActive = () => !!cardG || (state === 'menu' && menu.visible) || (state === 'game' && bar.visible);
  const _l = new THREE.Vector3(), _o = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
  const rc = new THREE.Raycaster(); rc.far = 8;
  function nearest(tip, list) { // el panel o botón que tienes justo delante del dedo
    let best = null;
    for (const s of list) {
      s.mesh.worldToLocal(_l.copy(tip));
      if (Math.abs(_l.x) > s.w / 2 + 0.01 || Math.abs(_l.y) > s.h / 2 + 0.01 || _l.z < -0.04 || _l.z > QUEST.NEAR) continue;
      const score = _l.z - (s.onPress ? 0.02 : 0); // los botones están delante de su panel: ganan
      if (!best || score < best.score) best = { s, z: _l.z, x: _l.x, y: _l.y, score };
    }
    return best;
  }
  function updateInput(inp, list, meshes) {
    inp.ray.visible = inp.ring.visible = inp.dot.visible = inp.joints.visible = false; inp.near = null;
    if (!inp.src) { inp.hover = null; inp.ok = false; return; }
    handPoints(inp);
    const isHand = !!inp.src.hand, j = isHand && inp.hand.joints && inp.hand.joints['index-finger-tip'];
    if (isHand && (xmode === 'immersive-vr' || (state === 'game' && (!world || world.full)))) drawJoints(inp); // si el mundo tapa tu cuarto, no ves tus manos reales: se dibujan con puntos de luz
    if (j && j.visible) {
      j.getWorldPosition(inp.tip); inp.dot.position.copy(inp.tip); inp.dot.visible = uiActive();
      const nb = uiActive() ? nearest(inp.tip, list) : null;
      if (nb) { // modo dedo: un aro bajo la yema que se achica al acercarte; al «hundir» el dedo, pulsa
        inp.near = nb; const k = THREE.MathUtils.clamp(nb.z / QUEST.NEAR, 0, 1);
        nb.s.mesh.localToWorld(inp.ring.position.set(nb.x, nb.y, 0.003)); nb.s.mesh.getWorldQuaternion(inp.ring.quaternion);
        inp.ring.scale.setScalar(0.55 + k * 1.5); inp.ring.material.opacity = 1 - k * 0.6; inp.ring.visible = true;
        const btn = nb.s.onPress ? nb.s : null; inp.hover = btn;
        if (!btn) { inp.armed = null; return; }
        if (nb.z > QUEST.POKE_OUT) inp.armed = btn;
        if (inp.armed === btn && nb.z < QUEST.POKE) { inp.armed = null; press(btn, inp); }
        return;
      }
      inp.armed = null;
    }
    if (!uiActive()) { inp.hover = null; return; }
    // de lejos: rayo desde la mano o el control; la pinza (o el gatillo) es el clic
    inp.ctl.getWorldPosition(_o); inp.ctl.getWorldQuaternion(_q); _d.set(0, 0, -1).applyQuaternion(_q);
    rc.set(_o, _d); const h = rc.intersectObjects(meshes, false)[0];
    const aim = state === 'game' && !cardG && sceneRays(); // algunos juegos muestran el rayo para apuntar (elegir varita, apuntar a un dron)
    if (!h && state === 'game' && !cardG && !aim) { inp.hover = null; return; } // jugando, el rayo solo aparece al apuntar a un botón
    const far = aim && !h ? sceneRayLen(inp) : 0; // si apuntas a algo del juego (un objeto, un animal), el rayo llega hasta él
    inp.ray.position.copy(_o); inp.ray.quaternion.copy(_q); inp.ray.scale.set(1, 1, h ? h.distance : far || (aim ? 1.5 : 0.5));
    inp.ray.material.opacity = h || far ? 0.9 : 0.35; inp.ray.visible = true;
    if (h) { inp.ring.position.copy(h.point); h.object.getWorldQuaternion(inp.ring.quaternion); inp.ring.translateZ(0.003); inp.ring.scale.setScalar(1); inp.ring.material.opacity = 1; inp.ring.visible = true; }
    const s = h && h.object.userData.surf; inp.hover = s && s.onPress ? s : null;
  }
  function drawJoints(inp) {
    let n = 0;
    for (const jn of Object.values(inp.hand.joints || {})) {
      if (!jn.visible || n >= 25) continue;
      jn.getWorldPosition(_o); _s.setScalar(Math.max(0.004, (jn.jointRadius || 0.008) * 0.9));
      inp.joints.setMatrixAt(n++, _m.compose(_o, _q.identity(), _s));
    }
    inp.joints.count = n; inp.joints.instanceMatrix.needsUpdate = true; inp.joints.visible = n > 0;
  }
  function syncButtons(dt) { // estado visual de cada botón y un pequeño resorte: se levanta al apuntarlo y se hunde al pulsarlo
    for (const b of surfs) {
      if (!b.onPress) continue;
      const hov = inputs.some(i => i.hover === b), prs = b.flash > 0 || inputs.some(i => i.pressBtn === b);
      const st = prs ? 'press' : hov ? 'hover' : 'idle';
      if (st !== b.st) { if (st === 'hover' && b.st === 'idle') haptic(0.12, 12, inputs.find(i => i.hover === b)); b.paint(st); }
      const goal = st === 'press' ? -0.003 : st === 'hover' ? 0.008 : 0;
      b.liftV += ((goal - b.lift) * 320 - b.liftV * 30) * dt; b.lift += b.liftV * dt; b.mesh.position.z = b.z0 + b.lift;
      if (b.flash > 0) b.flash -= dt;
    }
  }

  // ---------- juegos dentro del visor ----------
  // El grupo de la cámara (rig) se gira y se mueve para que el juego quede frente a ti: «al frente» del juego es hacia donde miras al entrar.
  // Tu cuarto real no se mueve: al cambiar de posición en el juego, el estadio se mueve a tu alrededor (con un fundido corto).
  const _e = new THREE.Euler(), _b = new THREE.Vector3(), _hv = new THREE.Vector3();
  let spot = { x: 0, z: 0, yaw: 0, y: 0 }, eye = 1.6, world = null, kickBall = null, kickSeen = 0; // yaw: hacia dónde es «al frente» (0 = −Z del juego) · y: altura del piso donde estás parado (acera, cubierta de la lancha)
  const poseP = new THREE.Vector3(0, 1.6, 0), poseQ = new THREE.Quaternion(); // tu cabeza según el visor (se guarda justo después de dibujar)
  function afterRender() { poseP.copy(camera.position); poseQ.copy(camera.quaternion); }
  function placeRig() { // pone tu cabeza (en x, z) justo sobre el punto del juego «spot»
    _hv.copy(poseP).applyQuaternion(rig.quaternion);
    rig.position.set(spot.x - _hv.x, spot.y, spot.z - _hv.z); rig.updateMatrixWorld(true);
    for (const inp of inputs) { inp.pg.t = inp.pp.t = 0; inp.pg.v.set(0, 0, 0); inp.pp.v.set(0, 0, 0); } // el salto no cuenta como movimiento de la mano
    placeGameUi();
  }
  function recenter() { // al entrar a un juego: hacia donde miras pasa a ser «al frente» del juego
    closeCard(); state = 'game'; menu.visible = false;
    rig.rotation.set(0, -_e.setFromQuaternion(poseQ, 'YXZ').y, 0); rig.updateMatrixWorld(true);
    spot = { x: 0, z: 0, yaw: 0, y: 0 }; eye = THREE.MathUtils.clamp(poseP.y, 1.0, 2.0); placeRig();
  }
  // el juego te lleva a otro punto (otro penal, otra distancia, otra zona de tiro); con (fx, fz) además te deja mirando hacia ese punto
  // y: altura del piso donde quedas parado (0 = el suelo del juego; por ejemplo, la acera de Ocean Drive)
  function teleport(x, z, fx, fz, y = 0) {
    if (!session || state !== 'game') return;
    const yaw = fx === undefined ? spot.yaw : Math.atan2(-(fx - x), -(fz - z));
    if (Math.hypot(x - spot.x, z - spot.z) < 0.05 && Math.abs(yaw - spot.yaw) < 0.01 && Math.abs(y - spot.y) < 0.01) return;
    if (yaw !== spot.yaw) { rig.rotation.set(0, yaw - _e.setFromQuaternion(poseQ, 'YXZ').y, 0); rig.updateMatrixWorld(true); }
    spot = { x, z, yaw, y }; fadeM.material.opacity = 1; fadeGoal = 0; placeRig();
  }
  // el juego te lleva en un vehículo (tour acuático): te mueve junto con él sin fundido ni recentrar tu cabeza, y tus textos viajan contigo
  // blink: un fundido corto (para subirte a la lancha)
  const _rd = new THREE.Vector3();
  function ride(x, z, y = spot.y, blink = false) {
    if (!session || state !== 'game') return;
    _rd.set(x - spot.x, y - spot.y, z - spot.z); if (_rd.lengthSq() < 1e-10) return;
    spot.x = x; spot.y = y; spot.z = z; rig.position.add(_rd); rig.updateMatrixWorld(true);
    for (const o of [hud, cardG, ...pops.map(p => p.mesh)]) if (o) o.position.add(_rd);
    for (const p of pops) p.y0 += _rd.y;
    if (blink) { fadeM.material.opacity = 1; fadeGoal = 0; }
    placeGameUi();
  }
  const gamePoint = (dx, y, dz, out = new THREE.Vector3()) => { // punto del juego relativo a tu posición (dx a tu derecha, y sobre tu piso, dz hacia atrás)
    const c = Math.cos(spot.yaw), s = Math.sin(spot.yaw);
    return out.set(spot.x + dx * c + dz * s, y + spot.y, spot.z - dx * s + dz * c);
  };

  // botonera a tu izquierda: volver al menú y cambiar entre «ventana» y estadio completo
  const bar = new THREE.Group(); bar.visible = false; ui.add(bar);
  let fullB = null;
  function buildBar(key) {
    for (const m of [...bar.children]) if (m.userData.surf) drop(m.userData.surf);
    place(button(0.21, 0.07, drawBtn('🏠 Menú', 'ghost', 26), () => api.enter('hub')), bar, 0, 0.045);
    fullB = world ? place(button(0.21, 0.07, (g, W, H, st) => drawBtn(world.full ? (world.type === 'portal' ? '🪟 Ventana' : '🏠 Mi cuarto') : '🌍 ' + (SPORTS[key] ? SPORTS[key].full : 'Completo'), 'ghost', 22)(g, W, H, st), () => { world.full = !world.full; applyWorld(); fullB.paint(); }), bar, 0, -0.045) : null;
    bar.visible = true;
  }
  // ventana al estadio: un marco neón; dentro se ve el estadio y alrededor sigue tu cuarto (técnica «stencil»)
  const portal = new THREE.Group(); portal.visible = false; ui.add(portal);
  const mask = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.W, WINDOW.H), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp }));
  mask.renderOrder = -100; portal.add(mask);
  for (const [w, h, x, y, c] of [[WINDOW.W + 0.12, 0.06, 0, WINDOW.H / 2, C.pink], [0.06, WINDOW.H, -WINDOW.W / 2 - 0.03, 0, C.sun], [0.06, WINDOW.H, WINDOW.W / 2 + 0.03, 0, C.sun], [WINDOW.W + 0.12, 0.04, 0, -WINDOW.H / 2, C.pink]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05), mat(c)); m.position.set(x, y, 0); portal.add(m);
  }
  // soporte del balón: un aro de luz bajo el balón que flota frente a ti
  const tee = new THREE.Group(); tee.visible = false; ui.add(tee);
  { const r = new THREE.Mesh(new THREE.RingGeometry(0.13, 0.15, 40), mat(C.sun, { transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false })); r.rotation.x = -Math.PI / 2; tee.add(r);
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.13, 40), mat(C.sea, { transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); d.rotation.x = -Math.PI / 2; tee.add(d); }
  function placeGameUi() {
    gamePoint(0, WINDOW.H / 2, -WINDOW.D, portal.position); portal.rotation.set(0, spot.yaw, 0);
    gamePoint(-0.5, eye - 0.72, -0.28, bar.position); bar.lookAt(spot.x, bar.position.y + 0.25, spot.z);
    if (legendG) { gamePoint(0.5, eye - 0.62, -0.3, legendG.position); legendG.lookAt(spot.x, legendG.position.y + 0.25, spot.z); }
  }
  // leyenda del juego a tu derecha: una columna de botones (armas del Research Triangle…); set(k) ilumina uno
  let legendG = null;
  function legend(items, onPick) {
    dropLegend(); const gL = new THREE.Group(); legendG = gL; gL.userData.on = null; ui.add(gL);
    items.forEach((it, i) => place(button(0.26, 0.072, (g, W, H, st) => {
      const on = gL.userData.on === it.k, hov = st === 'hover';
      rr(g, 5, 5, W - 10, H - 10, (H - 10) / 2); g.fillStyle = on ? it.c : `rgba(20,26,61,${hov ? 1 : 0.9})`; g.fill();
      g.lineWidth = on || hov ? 6 : 3; g.strokeStyle = on ? '#fff' : it.c; if (on) { g.shadowColor = it.c; g.shadowBlur = 16; } g.stroke(); g.shadowBlur = 0;
      g.fillStyle = on ? C.ink : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fit(g, it.label, 800, 26, UIF, W - 40); g.fillText(it.label, W / 2, H / 2 + 2);
    }, () => onPick(it.k)), gL, 0, ((items.length - 1) / 2 - i) * 0.082));
    placeGameUi();
    return { set(k) { gL.userData.on = k; for (const m of gL.children) if (m.userData.surf) m.userData.surf.paint(); }, dispose() { if (legendG === gL) dropLegend(); } };
  }
  function dropLegend() { if (!legendG) return; for (const m of [...legendG.children]) if (m.userData.surf) drop(m.userData.surf); legendG.removeFromParent(); legendG = null; }
  function floorPlace(o) { // el balón de la patada flota frente a tu cintura (o queda en tu piso si pateas con los pies)
    if (feet.on) { gamePoint(0, 0.13, -FEET.BALL_D, _b); tee.position.set(_b.x, spot.y + 0.006, _b.z); }
    else { gamePoint(0, eye - HANDKICK.TEE_DROP, -HANDKICK.TEE_D, _b); tee.position.set(_b.x, _b.y - 0.14, _b.z); }
    o.position.copy(o.parent ? o.parent.worldToLocal(_b) : _b);
    o.visible = true; kickBall = o; kickSeen = 0.15;
    return true;
  }
  function kicks(dt) { // ¿alguna mano golpeó el balón? fuerza según la velocidad; dirección según hacia dónde va la mano
    kickSeen -= dt; tee.visible = kickSeen > 0;
    const sc = api.current(); if (!kickBall || kickSeen <= 0 || !sc || !sc.kick || (sc.canKick && !sc.canKick())) return;
    kickBall.getWorldPosition(_b);
    for (const inp of inputs) {
      if (!inp.src || !inp.ok) continue;
      for (const [p, p0, v] of [[inp.palmPos, inp.palmPrev, inp.pp.v], [inp.grabPos, inp.grabPrev, inp.pg.v]]) {
        const s = v.length(); if (s < HANDKICK.MIN) continue;
        // barrido: el tramo que recorrió la mano desde el cuadro anterior (un golpe rápido puede atravesar el balón entre dos cuadros)
        _seg.set(p0, p); _seg.closestPointToPoint(_b, true, _to);
        if (_to.distanceTo(_b) > 0.12 + HANDKICK.REACH || v.dot(_to.copy(_b).sub(p0)) <= 0) continue;
        const c = Math.cos(spot.yaw), sn = Math.sin(spot.yaw), vx = v.x * c - v.z * sn, vz = v.x * sn + v.z * c; // velocidad vista desde tu «al frente»
        const fwd = Math.max(-vz, 0.3), up = v.y / fwd;
        const pw = THREE.MathUtils.clamp(0.75 + HANDKICK.POWER * s + HANDKICK.LIFT * up, 0.8, 1.35), lat = THREE.MathUtils.clamp(vx / fwd * HANDKICK.AIM, -1, 1);
        haptic(1, 90, inp); kickBall = null; kickSeen = 0; tee.visible = false;
        _dbgKick = { pw, lat, s };
        sc.kick({ pw, lat }); return;
      }
    }
  }
  let _dbgKick = null; const _seg = new THREE.Line3();
  // mundo del juego en realidad mixta: «portal» = el estadio solo dentro de la ventana · «room» = solo lo del juego en tu cuarto
  function gameStart(sc) {
    state = 'game'; menu.visible = false;
    const w = sc && sc.xrWorld;
    world = w && xmode === 'immersive-ar' ? { type: w.type, keep: new Set(w.keep), full: false, mats: new Map(), vis: new Map(), t: 0 } : null;
    applyWorld(); buildBar(api.key()); placeGameUi();
  }
  function gameEnd() { // deja los materiales y objetos como estaban (algunos modelos se comparten entre juegos)
    if (world) { world.full = true; applyWorld(); for (const [m, o] of world.mats) Object.assign(m, o); for (const [o, v] of world.vis) o.visible = v; }
    world = null; kickBall = null; tee.visible = portal.visible = bar.visible = false; dropLegend();
    for (const m of [...bar.children]) if (m.userData.surf) drop(m.userData.surf);
  }
  function stencil(m, on) {
    if (!world.mats.has(m)) world.mats.set(m, { stencilWrite: m.stencilWrite, stencilRef: m.stencilRef, stencilFunc: m.stencilFunc, stencilZPass: m.stencilZPass });
    m.stencilWrite = on; m.stencilRef = 1; m.stencilFunc = THREE.EqualStencilFunc; m.stencilZPass = THREE.KeepStencilOp;
  }
  const mats = o => (o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []);
  function applyWorld() {
    if (!world) return;
    const root = api.root, on = !world.full;
    portal.visible = world.type === 'portal' && on;
    if (world.type === 'room') { // en tu cuarto solo queda lo del juego (y las luces)
      for (const g of root.children) for (const o of g.children) {
        if (o.isLight || world.keep.has(o)) continue;
        if (!world.vis.has(o)) world.vis.set(o, o.visible);
        o.visible = on ? false : world.vis.get(o);
      }
      return;
    }
    const walk = o => { if (world.keep.has(o)) return; for (const m of mats(o)) stencil(m, on); for (const c of o.children) walk(c); };
    walk(root);
    for (const k of world.keep) k.traverse(o => mats(o).forEach(m => stencil(m, on && behindWindow(k)))); // el balón: visible en tu cuarto, y dentro del estadio al cruzar la ventana
  }
  const behindWindow = o => portal.worldToLocal(o.getWorldPosition(_b)).z < 0;
  function worldTick(dt) {
    if (!world) return;
    world.t += dt;
    if (world.t > 0.5) { world.t = 0; applyWorld(); } // los modelos que terminan de cargar también quedan dentro de la ventana
    else if (world.type === 'portal' && !world.full) for (const k of world.keep) { const on = behindWindow(k); k.traverse(o => mats(o).forEach(m => stencil(m, on))); }
  }
  function ready(key, start) { // instrucciones del juego en el visor
    const G = GAMES[key], s = SPORTS[key];
    if (!session) return;
    if (state !== 'game' || !bar.visible) return setTimeout(() => ready(key, start), 0); // espera a que el juego esté armado
    const extra = `<p>🏠 A tu izquierda tienes el botón para volver al menú${world ? ` y 🌍 ${s.full.toLowerCase()}` : ''}.</p>`;
    if (!G.foot) return card(G.title, `<p>${s ? s.how : ''}</p>${extra}`, [{ label: '✋ ¡A JUGAR!', primary: true, fn: start }, { label: 'Volver al menú', fn: () => api.enter('hub') }], 'how');
    card(G.title, `<p>${s ? s.how : ''}</p><p>🦶 También puedes patear con tus pies si una PC con cámara te ve.</p>${extra}`, [
      { label: '✋ Con la palma', primary: true, fn: () => { feet.on = false; start(); } },
      { label: feet.conn ? '🦶 Con mis pies · PC lista' : '🦶 Con mis pies (PC)', fn: () => (feet.conn ? (feet.on = true, start()) : feetCard(key, start)) },
      { label: 'Menú', fn: () => api.enter('hub') }
    ], 'how');
  }

  // ---------- 🦶 patear con tus pies: la cámara de una PC te ve (sensor.html) y le avisa al visor ----------
  // BALL_D: a cuántos metros frente a ti queda el balón en el piso · PEER: servicio gratuito que solo ayuda a que la PC y el visor se encuentren
  // (el video nunca sale de la PC: solo viajan mensajes «patada: fuerza y dirección»)
  const FEET = { BALL_D: 0.55, PEER: 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/+esm' };
  const feet = { on: false, peer: null, conn: null, code: '', st: '' };
  const sensorUrl = () => (location.host + location.pathname.replace(/[^/]*$/, '') + 'sensor.html');
  async function feetConnect() {
    if (feet.peer) return;
    feet.code = feet.code || String(1000 + Math.floor(Math.random() * 9000));
    try {
      const mod = await import(FEET.PEER), Peer = mod.Peer || mod.default;
      const peer = new Peer('carolina-ar-' + feet.code); feet.peer = peer;
      peer.on('connection', c => {
        if (feet.conn) feet.conn.close();
        feet.conn = c; c.on('data', onFeet);
        c.on('open', () => { toast('🦶 PC conectada', 2500); api.sfx('coin'); });
        c.on('close', () => { if (feet.conn === c) { feet.conn = null; toast('🦶 La PC se desconectó', 3000); } });
      });
      peer.on('error', e => {
        console.warn('peer', e.type);
        if (e.type === 'unavailable-id') { feetStop(); feet.code = ''; feetConnect(); } // código ocupado: se elige otro
        else toast('🦶 No se pudo conectar con la PC (' + e.type + '). Revisa que los dos tengan internet.', 4500);
      });
    } catch (e) { toast('🦶 No se pudo cargar la conexión con la PC. Revisa el internet del visor.', 4500); }
  }
  function feetStop() { if (feet.peer) try { feet.peer.destroy(); } catch (e) {} feet.peer = feet.conn = null; feet.on = false; }
  function feetCard(key, start) {
    feet.code = feet.code || String(1000 + Math.floor(Math.random() * 9000)); feetConnect();
    card('🦶 PATEA CON TUS PIES', `<ol><li>En la PC abre: <b>${sensorUrl()}</b></li><li>Escribe este código: <b>${feet.code}</b></li><li>Pon la PC frente a ti (hacia el arco), a 2 o 3 metros, que te vea de cuerpo entero.</li><li>El balón queda en tu piso: ¡patéalo con el pie!</li></ol>`, [
      { label: '¡A PATEAR!', primary: true, fn: () => { feet.on = true; if (!feet.conn) toast('🦶 Esperando a la PC… escribe el código ' + feet.code, 5000); start(); } },
      { label: 'Volver', fn: () => ready(key, start) }
    ], 'how');
  }
  function onFeet(m) { // mensajes de la PC
    if (!m || !session) return;
    if (m.t === 'status' && m.s !== feet.st) { feet.st = m.s; if (feet.on && state === 'game') toast({ ok: '🦶 La PC te ve: ¡patea!', pies: '🦶 La PC no ve tus pies: aléjate un poco', nadie: '🦶 La PC no te ve' }[m.s] || '', 2200); }
    if (m.t !== 'kick' || !feet.on) return;
    const sc = api.current();
    if (!kickBall || kickSeen <= 0 || !sc || !sc.kick || (sc.canKick && !sc.canKick())) return;
    const pw = THREE.MathUtils.clamp(+m.pw || 1, 0.8, 1.35), lat = THREE.MathUtils.clamp(+m.lat || 0, -1, 1);
    kickBall = null; kickSeen = 0; tee.visible = false; _dbgKick = { pw, lat, s: 0, feet: true };
    sc.kick({ pw, lat });
  }

  // ---------- fondo simple si el visor solo tiene realidad virtual (sin cámaras de passthrough) ----------
  let env = null;
  function vrEnv() {
    const g = new THREE.Group(), cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
    const c = cv.getContext('2d'), gr = c.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0b1026'); gr.addColorStop(0.42, '#2a0e4a'); gr.addColorStop(0.5, '#ff4fa3'); gr.addColorStop(0.52, '#141a3d'); gr.addColorStop(1, '#0b1026');
    c.fillStyle = gr; c.fillRect(0, 0, 4, 256);
    const sky = new THREE.Mesh(new THREE.SphereGeometry(40, 32, 16), mat(0xffffff, { map: new THREE.CanvasTexture(cv), side: THREE.BackSide }));
    const grid = new THREE.GridHelper(16, 32, C.sea, '#2a6bff'); grid.material.transparent = true; grid.material.opacity = 0.35;
    g.add(sky, grid); return g;
  }

  // ---------- entrar y salir del visor ----------
  const fontsReady = Promise.race([
    Promise.all([`58px ${PXF}`, `800 30px ${UIF}`, `700 24px ${UIF}`, `600 22px ${UIF}`].map(f => document.fonts.load(f).catch(() => {}))),
    new Promise(r => setTimeout(r, 2500))
  ]);
  const sup = { ar: false, vr: false };
  const supported = (async () => {
    if (!navigator.xr || !navigator.xr.isSessionSupported || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return sup; // en celulares no se ofrece
    try { sup.ar = await navigator.xr.isSessionSupported('immersive-ar'); } catch (e) {}
    try { sup.vr = await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) {}
    return sup;
  })();
  async function start() {
    if (session) return;
    api.audioInit();
    const opts = { requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking', 'bounded-floor'] };
    let s = null;
    for (const m of sup.ar ? ['immersive-ar', 'immersive-vr'] : ['immersive-vr']) { // realidad mixta primero (ves tu cuarto)
      try { s = await navigator.xr.requestSession(m, opts); xmode = m; break; } catch (e) { console.warn('XR', m, e); }
    }
    if (!s) { api.toastDom('No se pudo abrir el modo Quest. Revisa que el navegador del visor tenga permiso de realidad virtual.', 5000); return; }
    session = s; frames = 0; menuPlaced = false; state = ''; hud.userData.placed = false;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.xr.setFramebufferScaleFactor(QUEST.SCALE);
    api.onStart(xmode);
    camera.add(fadeM, flashM);
    if (xmode === 'immersive-vr') { env = vrEnv(); ui.add(env); }
    ui.visible = true;
    try {
      await renderer.xr.setSession(s);
      renderer.xr.setFoveation(QUEST.FOVEA);
      if (s.supportedFrameRates && s.updateTargetFrameRate && [...s.supportedFrameRates].includes(QUEST.FPS)) s.updateTargetFrameRate(QUEST.FPS).catch(() => {});
    } catch (e) { console.warn(e); s.end().catch(() => {}); return; }
    await fontsReady;
    if (session === s) showMenu();
  }
  function end() { if (session) session.end().catch(() => {}); }
  renderer.xr.addEventListener('sessionend', () => { // al quitarte el visor o tocar «Salir»: todo vuelve a la pantalla del celular
    session = null; renderer.xr.enabled = false;
    gameEnd(); feetStop(); state = ''; rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0); rig.updateMatrixWorld(true); // la cámara del celular vuelve a su lugar
    closeCard(); drop(toastS); toastS = null; setSlot('info', ''); setSlot('hint', '');
    for (const p of pops.splice(0)) drop(p);
    for (const m of [...menu.children]) if (m.userData.surf) drop(m.userData.surf);
    if (env) { ui.remove(env); env.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }); env = null; }
    camera.remove(fadeM, flashM); fadeM.material.opacity = flashM.material.opacity = 0; fadeGoal = 0;
    for (const inp of inputs) { inp.src = inp.hover = inp.pressBtn = inp.armed = inp.near = null; }
    ui.visible = false; menu.visible = false;
    api.onEnd();
  });

  // ---------- botón «🥽 Modo Quest» en «¿Cómo juegas?» ----------
  const btn = document.getElementById('optQuest');
  supported.then(s => {
    if (!btn || !(s.ar || s.vr)) return;
    btn.classList.remove('hidden');
    btn.onclick = () => { api.sfx('click'); start(); };
  });

  // ---------- cada cuadro ----------
  function frame(dt) {
    if (!session) return;
    frames++;
    if (menuMem.wait && frames > Math.max(3, menuMem.at || 0)) { menuMem.wait = false; putInFront(menu, QUEST.MENU_D, -QUEST.MENU_DROP); menuPlaced = true; menu.visible = !cardG; }
    if (state === 'menu' && menu.visible) follow(menu, menuMem, QUEST.MENU_D, dt);
    if (cardG) { // la tarjeta entra con un pequeño «pop» y también te sigue si te giras
      cardG.userData.t += dt; cardG.scale.setScalar(THREE.MathUtils.lerp(0.88, 1, 1 - Math.pow(1 - Math.min(1, cardG.userData.t / 0.22), 3)));
      follow(cardG, cardG.userData, QUEST.MENU_D, dt);
    }
    if (hud.userData.placed) follow(hud, hud.userData, HUD_D, dt, 28);
    const list = [], meshes = [];
    for (const s of surfs) if (shown(s.mesh)) { s.mesh.updateWorldMatrix(true, false); list.push(s); meshes.push(s.mesh); }
    for (const inp of inputs) updateInput(inp, list, meshes);
    syncButtons(dt);
    if (state === 'game') { kicks(dt); worldTick(dt); }
    if (toastS && (toastT -= dt) <= 0) { drop(toastS); toastS = null; }
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.life += dt;
      p.mesh.position.y = p.y0 + p.life * 0.09; p.mesh.scale.setScalar(Math.min(1, 0.6 + p.life * 3));
      p.mesh.material.opacity = p.life < 0.7 ? 1 : Math.max(0, 1 - (p.life - 0.7) / 0.4);
      if (p.life > 1.1) { drop(p); pops.splice(i, 1); }
    }
    const fm = fadeM.material; fm.opacity = THREE.MathUtils.clamp(fm.opacity + Math.sign(fadeGoal - fm.opacity) * dt / 0.25, 0, 1); fadeM.visible = fm.opacity > 0.001;
    if (flashM.material.opacity > 0) flashM.material.opacity = Math.max(0, flashM.material.opacity - dt / 0.35); flashM.visible = flashM.material.opacity > 0.001;
  }

  // para las pruebas automáticas (?debug)
  const _dbg = {
    state: () => ({ on: !!session, mode: xmode, menu: menu.visible, card: !!cardG, toast: !!toastS, inputs: inputs.map(i => ({ src: !!i.src, side: i.src && i.src.handedness, hand: !!(i.src && i.src.hand), hover: !!i.hover, near: !!i.near })) }),
    where: name => { // centro (en el mundo) de un botón del menú o de la tarjeta: 'heat', 'fg', 'penalty', 'orlando'…, 'salir', 'sonido' o 'card0'
      const btns = gr => gr.children.filter(m => m.userData.surf && m.userData.surf.onPress);
      const ms = name.startsWith('card') ? (cardG ? btns(cardG) : []) : name.startsWith('bar') ? btns(bar) : btns(menu);
      const idx = /^(card|bar)\d$/.test(name) ? +name.slice(-1) : ['heat', 'fg', 'penalty', ...WORLDS, 'salir', 'sonido'].indexOf(name);
      const m = ms[idx]; if (!m) return null;
      const p = m.getWorldPosition(new THREE.Vector3()), n = new THREE.Vector3(0, 0, 1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()));
      return { p: p.toArray(), n: n.toArray() };
    },
    tip: i => inputs[i].src && inputs[i].src.hand ? inputs[i].tip.toArray() : null,
    vel: i => inputs[i].pg.v.toArray(), pops: () => popLog.splice(0), hud: () => ({ info: slots.info && slots.info.txt, hint: slots.hint && slots.hint.txt, toast: !!toastS }),
    palm: i => inputs[i].palmPos.toArray(), grab: i => inputs[i].grabPos.toArray(), kick: () => _dbgKick,
    ball: () => (kickBall && kickSeen > 0 ? kickBall.getWorldPosition(new THREE.Vector3()).toArray() : null),
    world: () => (world ? { type: world.type, full: world.full, portal: portal.visible } : null), phase: () => state, spot: () => ({ ...spot, eye }),
    ray: i => { inputs[i].ctl.getWorldPosition(_o); inputs[i].ctl.getWorldQuaternion(_q); return { o: _o.toArray(), d: _d.set(0, 0, -1).applyQuaternion(_q).toArray() }; }
  };
  return {
    on: () => !!session, isAR: () => xmode === 'immersive-ar', start, end, showMenu, afterRender, legend, recenter, teleport, ride, gamePoint, eye: () => eye, floorPlace, gameStart, gameEnd, ready, card, toast, info: t => setSlot('info', t), hint: t => setSlot('hint', t), pop, countdown, fade, flash, shake, haptic, frame, inputs, _dbg };
}
