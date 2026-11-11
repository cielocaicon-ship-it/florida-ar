// FLORIDA AR ADVENTURE — contenido 3D: cofre AR, portales y tres mundos inmersivos 360°.
import * as THREE from 'three';
const V3 = THREE.Vector3, V2 = THREE.Vector2;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;

/* ================= Utilidades ================= */
const mats = {};
const M = (c, o = {}) => { const k = 's' + c + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0, ...o })); };
const B = (c, o = {}) => { const k = 'b' + c + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshBasicMaterial({ color: c, ...o })); };
const temp = m => { m.userData.temp = true; return m; };
const keep = x => { x.userData.keep = true; return x; };
function add(parent, geo, mat, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m); return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, s = 16) => new THREE.SphereGeometry(r, s, Math.max(6, (s * 0.7) | 0));
const cone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 4, 10);
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const rnd = (a, b) => a + Math.random() * (b - a);
const _v = new V3(), _w = new V3(), _u = new V3();

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.userData.g = g;
  return t;
}
const rep = (t, x, y) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(x, y); return t; };
let _glow;
const glowTex = () => _glow || (_glow = keep(canvasTex(64, 64, g => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
})));
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(temp(new THREE.SpriteMaterial({ map: glowTex(), color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  s.scale.setScalar(size); return s;
}
function textTex(text, w, h, bg, fg, font) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = font; g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 4, w - 20);
  });
}
function label(text, h = 0.14, color = '#fff', bg = 'rgba(10,15,45,.8)') {
  const tex = canvasTex(512, 128, (g, w, H) => {
    g.fillStyle = bg; g.beginPath(); g.roundRect(4, 4, w - 8, H - 8, 44); g.fill();
    g.font = 'bold 58px system-ui,sans-serif'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, H / 2 + 3, w - 40);
  });
  const s = new THREE.Sprite(temp(new THREE.SpriteMaterial({ map: tex, transparent: true })));
  s.scale.set(h * 4, h, 1); return s;
}
export function disposeTree(o) {
  o.traverse(n => {
    if (n.geometry && !n.geometry.userData.keep) n.geometry.dispose();
    const ms = Array.isArray(n.material) ? n.material : n.material ? [n.material] : [];
    for (const m of ms) if (m.userData.temp) { for (const k of ['map', 'bumpMap', 'alphaMap']) if (m[k] && !m[k].userData.keep) m[k].dispose(); m.dispose(); }
    if (n.isLight && n.dispose) n.dispose();
  });
}
function sky(top, hor, bot, stars = 0) { // cúpula de cielo con degradado (y estrellas opcionales)
  const mat = temp(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, hor: { value: new THREE.Color(hor) }, bot: { value: new THREE.Color(bot) }, stars: { value: stars } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `uniform vec3 top,hor,bot; uniform float stars; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453); }
      void main(){ float y = vP.y; vec3 c = y > 0. ? mix(hor, top, pow(y, .55)) : mix(hor, bot, pow(-y, .4));
        if (stars > 0. && y > .05) { vec3 q = floor(vP * 220.); c += step(.996, h(q)) * vec3(.9) * smoothstep(.05, .4, y); }
        gl_FragColor = vec4(c, 1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  }));
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mat);
  m.frustumCulled = false; m.renderOrder = -10; return m;
}
function lightRig(g, o) {
  g.add(new THREE.HemisphereLight(o.sky, o.ground, o.hemi));
  const d = new THREE.DirectionalLight(o.sun, o.sunI);
  const t = o.target || [0, 0, 0];
  d.position.set(t[0] + o.dir[0], t[1] + o.dir[1], t[2] + o.dir[2]); d.target.position.set(...t);
  g.add(d, d.target);
  d.castShadow = true; d.shadow.mapSize.set(2048, 2048);
  const c = d.shadow.camera; c.left = c.bottom = -o.size; c.right = c.top = o.size; c.near = 0.5; c.far = 120;
  d.shadow.bias = -0.0004; d.shadow.normalBias = 0.03;
  return d;
}
function envFromSky(ctx, skyMesh) { // reflejos del propio cielo en metales, agua y vidrio
  const prev = ctx.scene.environment, s = new THREE.Scene(); s.add(skyMesh.clone());
  const pm = new THREE.PMREMGenerator(ctx.renderer), rt = pm.fromScene(s, 0, 0.1, 1000);
  ctx.scene.environment = rt.texture; pm.dispose();
  return () => { ctx.scene.environment = prev; rt.dispose(); };
}
function camPath(ctx, keys) { // animación de cámara por fotogramas clave {t, p:[x,y,z], yaw, pitch}
  let t = 0; const end = keys[keys.length - 1].t, E = new THREE.Euler(0, 0, 0, 'YXZ');
  const api = {
    get done() { return t >= end; }, get t() { return t; },
    skip() { t = end; api.update(0); },
    update(dt) {
      t = Math.min(end, t + dt);
      let i = 0; while (i < keys.length - 2 && t > keys[i + 1].t) i++;
      const a = keys[i], b = keys[i + 1], u = smooth((t - a.t) / (b.t - a.t || 1));
      ctx.camera.position.set(lerp(a.p[0], b.p[0], u), lerp(a.p[1], b.p[1], u), lerp(a.p[2], b.p[2], u));
      ctx.camera.quaternion.setFromEuler(E.set(lerp(a.pitch || 0, b.pitch || 0, u), lerp(a.yaw || 0, b.yaw || 0, u), 0));
      return t;
    }
  };
  return api;
}
// Escena con intro de entrada: bloquea la cámara mientras se anima y luego muestra instrucciones
function withIntro(ctx, opt, keys, endYaw, endPitch, onEnd) {
  const path = camPath(ctx, keys); const st = { on: true };
  st.finish = () => { if (!st.on) return; st.on = false; path.skip(); ctx.lookReset(endYaw, endPitch); onEnd && onEnd(); if (!opt.quick) ctx.ready(); };
  st.update = dt => { if (!st.on) return; path.update(dt); if (path.done) st.finish(); };
  st.path = path;
  if (opt.quick) st.finish(); else ctx.hint('Toca la pantalla para saltar la intro ⏭');
  return st;
}

/* Partículas: un solo sistema reutilizable */
export class Sparks {
  constructor(n = 600) {
    this.n = n; this.i = 0; this.col = new THREE.Color();
    this.p = new Float32Array(n * 3).fill(9999); this.c = new Float32Array(n * 3); this.base = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3); this.l = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.1, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  emit(pos, color = 0xffd700, count = 20, speed = 1.5) {
    for (let k = 0; k < count; k++) {
      const i = this.i++ % this.n, j = i * 3;
      this.col.set(Array.isArray(color) ? color[k % color.length] : color);
      const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = speed * (0.35 + Math.random() * 0.65), r = Math.sqrt(1 - u * u);
      this.p[j] = pos.x; this.p[j + 1] = pos.y; this.p[j + 2] = pos.z;
      this.v[j] = r * Math.cos(a) * s; this.v[j + 1] = u * s + speed * 0.3; this.v[j + 2] = r * Math.sin(a) * s;
      this.base[j] = this.col.r; this.base[j + 1] = this.col.g; this.base[j + 2] = this.col.b;
      this.l[i] = 1;
    }
    this.dirty = true;
  }
  update(dt) {
    if (!this.dirty) return;
    const { p, v, c, base, l } = this; let any = false;
    for (let i = 0; i < this.n; i++) {
      if (l[i] <= 0) continue;
      const j = i * 3; l[i] -= dt * 1.1;
      if (l[i] <= 0) { p[j + 1] = 9999; c[j] = c[j + 1] = c[j + 2] = 0; continue; }
      any = true; v[j + 1] -= 1.2 * dt;
      p[j] += v[j] * dt; p[j + 1] += v[j + 1] * dt; p[j + 2] += v[j + 2] * dt;
      c[j] = base[j] * l[i]; c[j + 1] = base[j + 1] * l[i]; c[j + 2] = base[j + 2] * l[i];
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = true; a.color.needsUpdate = true;
    this.dirty = any;
  }
}

let starGeo;
export function starMesh() {
  if (!starGeo) {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.12 : 0.28, a = i / 10 * Math.PI * 2 + Math.PI / 2;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    starGeo = keep(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }));
    starGeo.center();
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(starGeo, M(0xffc933, { metalness: 1, roughness: 0.25, emissive: 0x5a3a00 })));
  g.add(glow(0xffd24a, 0.9, 0.7));
  return g;
}

let _ball;
function ballMat() { // balón con textura granulada y costuras
  if (_ball) return _ball;
  const t = keep(canvasTex(1024, 512, (g, w, h) => {
    g.fillStyle = '#c8581f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(90,30,5,.18)' : 'rgba(255,170,110,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = '#1b0d05'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (const x of [w / 4, w * 3 / 4]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (const cx of [0, w / 2, w]) { g.beginPath(); g.ellipse(cx, h / 2, w / 9, h / 2, 0, 0, 7); g.stroke(); }
  }));
  return (_ball = new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, bumpMap: t, bumpScale: 0.6 }));
}

/* ================= INICIO: cofre mágico en realidad aumentada ================= */
const ICONS = {
  orlando() {
    const i = new THREE.Group(), st = M(0xd8d2e6), rf = M(0x5b2ca0);
    add(i, cyl(0.07, 0.08, 0.24), st, 0, -0.04, 0); add(i, cone(0.1, 0.16), rf, 0, 0.16, 0);
    for (const x of [-0.12, 0.12]) { add(i, cyl(0.045, 0.05, 0.16), st, x, -0.08, 0); add(i, cone(0.065, 0.11), rf, x, 0.055, 0); }
    return i;
  },
  miami() { const i = new THREE.Group(); const p = palm(i, 0, 0, 0.05); p.position.y = -0.2; i.add(glow(0xffd54a, 0.25)); return i; },
  heat() {
    const i = new THREE.Group();
    add(i, sph(0.11, 24), ballMat());
    const f = add(i, cone(0.06, 0.16, 8), M(0xff3b1f, { emissive: 0xaa1100 }), 0.09, 0.1, 0); f.rotation.z = -0.5;
    return i;
  }
};
function swirlTex(col) {
  const c = new THREE.Color(col), rgb = `${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0}`;
  return canvasTex(256, 256, (g) => {
    const r = g.createRadialGradient(128, 128, 6, 128, 128, 128);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, `rgba(${rgb},.95)`); r.addColorStop(1, 'rgba(10,0,40,.95)');
    g.fillStyle = r; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 4;
    for (let k = 0; k < 4; k++) { g.beginPath(); for (let a = 0; a < 9; a += 0.15) { const rr = a * 13, x = 128 + Math.cos(a + k * 1.57) * rr, y = 128 + Math.sin(a + k * 1.57) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  });
}
function woodTex() {
  return canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = '#6e4120'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) { g.fillStyle = `rgb(${95 + Math.random() * 25 | 0},${55 + Math.random() * 15 | 0},${25 + Math.random() * 10 | 0})`; g.fillRect(0, y + 3, w, 58); g.fillStyle = '#3a200c'; g.fillRect(0, y, w, 3); }
    for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(${30 + Math.random() * 50 | 0},${15 + Math.random() * 20 | 0},5,.35)`; g.fillRect(Math.random() * w, Math.random() * h, 30 + Math.random() * 90, 1.5); }
  });
}

export function createHub(ctx, opt = {}) {
  const { camera } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const place = () => {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const d = Math.max(2.6, 1.25 / t); g.position.set(0, ctx.EYE - d * 0.22, -d);
  };
  place();
  lightRig(g, { sky: 0xffffff, ground: 0x887766, hemi: 1.1, sun: 0xfff4e0, sunI: 2.4, dir: [1.5, 4, 2.5], size: 2.5 });
  // atrapa-sombras: proyecta la sombra del cofre sobre tu entorno real
  const catcher = add(g, new THREE.PlaneGeometry(5, 5), temp(new THREE.ShadowMaterial({ opacity: 0.38 })), 0, 0, 0, false);
  catcher.rotation.x = -Math.PI / 2; catcher.receiveShadow = true;
  const ring = add(g, new THREE.RingGeometry(0.75, 0.8, 64), temp(new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false })), 0, 0.005, 0, false);
  ring.rotation.x = -Math.PI / 2;

  // Cofre
  const chest = new THREE.Group(); chest.position.set(0, 0.45, 0); g.add(chest);
  const wood = temp(new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.65 })), gold = M(0xffc940, { metalness: 1, roughness: 0.28 });
  add(chest, box(1, 0.5, 0.62), wood);
  for (const x of [-0.5, 0.5]) for (const z of [-0.31, 0.31]) add(chest, box(0.06, 0.52, 0.06), gold, x, 0, z);
  add(chest, box(1.04, 0.06, 0.66), gold, 0, -0.24, 0);
  add(chest, box(1.04, 0.05, 0.66), gold, 0, 0.23, 0);
  for (const x of [-0.25, 0.25]) add(chest, box(0.06, 0.5, 0.64), gold, x, 0, 0);
  add(chest, box(0.16, 0.2, 0.04), gold, 0, 0.12, 0.33);
  add(chest, box(0.03, 0.07, 0.01), M(0x1a0d00), 0, 0.11, 0.355);
  for (const x of [-0.5, 0.5]) { const h = add(chest, new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), gold, x * 1.04, 0.05, 0); h.rotation.y = Math.PI / 2; }
  const lid = new THREE.Group(); lid.position.set(0, 0.25, -0.31); chest.add(lid);
  const lm = add(lid, new THREE.CylinderGeometry(0.31, 0.31, 1, 24, 1, false, 0, Math.PI), wood, 0, 0, 0.31); lm.rotation.z = Math.PI / 2;
  for (const x of [-0.5, -0.25, 0.25, 0.5]) { const b = add(lid, new THREE.CylinderGeometry(0.325, 0.325, 0.06, 24, 1, true, 0, Math.PI), gold, x, 0, 0.31); b.rotation.z = Math.PI / 2; }
  const aura = glow(0xffd36b, 1.8, 0.4); aura.position.set(0, 0.1, -0.1); chest.add(aura);
  const inner = glow(0xfff0a0, 0.1, 0.95); inner.position.set(0, 0.3, 0); chest.add(inner);
  const beamM = temp(new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beams = [-0.25, 0, 0.25].map((x, i) => { const b = add(chest, new THREE.CylinderGeometry(0.28, 0.1, 1.8, 16, 1, true), beamM, x, 1.15, 0, false); b.rotation.z = (i - 1) * 0.25; return b; });
  // monedas que salen volando al abrir
  const coinGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.01, 20);
  const coins = [];

  // Portales
  const DEST = [['orlando', -0.88, 1.28, 0x9b5cff], ['miami', 0, 1.6, 0xff4fa3], ['heat', 0.88, 1.28, 0xff3b30]];
  const portals = DEST.map(([key, x, y, col]) => {
    const p = new THREE.Group(); p.userData = { key, x, y, t: 0 }; p.visible = false; g.add(p);
    p.add(glow(col, 1.3, 0.55));
    add(p, new THREE.TorusGeometry(0.32, 0.04, 16, 48), M(col, { emissive: col, emissiveIntensity: 1.4, metalness: 0.4, roughness: 0.3 }), 0, 0, 0, false);
    add(p, new THREE.TorusGeometry(0.36, 0.012, 8, 48), M(0xffd36b, { metalness: 1, roughness: 0.2 }), 0, 0, 0, false);
    p.userData.swirl = add(p, new THREE.CircleGeometry(0.3, 48), temp(new THREE.MeshBasicMaterial({ map: swirlTex(col), transparent: true, opacity: 0.95 })), 0, 0, 0, false);
    const icon = ICONS[key](); icon.position.z = 0.14; p.add(icon); p.userData.icon = icon;
    const lb = label(GAMES[key].short, 0.13); lb.position.y = -0.48; p.add(lb);
    if (ctx.stars[key]) { const s = starMesh(); s.scale.setScalar(0.45); s.position.set(0.3, 0.3, 0.06); p.add(s); }
    return p;
  });

  let opened = !!opt.opened, openT = opened ? 1 : 0, shake = 0, hover = null, leaving = null, leaveT = 0, spark = 0;
  if (opened) portals.forEach(p => { p.visible = true; p.userData.t = 1; });
  const refreshHint = () => ctx.hint(opened
    ? (ctx.isHand() ? '☝️ Señala un portal con tu índice y déjalo quieto para viajar' : 'Toca un portal para viajar a ese destino')
    : (ctx.isHand() ? '☝️ Señala el cofre con tu índice y déjalo quieto para abrirlo' : 'Toca el cofre mágico para abrirlo'));
  refreshHint();

  function pick(p) {
    const list = opened ? portals.filter(o => o.visible) : [chest];
    const h = p.ray.intersectObjects(list, true); if (!h.length) return null;
    let o = h[0].object; while (o && o !== chest && !o.userData.key) o = o.parent;
    return o;
  }
  function openChest() {
    shake = 0.001; ctx.sfx('rattle');
    setTimeout(() => {
      opened = true; ctx.sfx('chest');
      ctx.burst(chest.localToWorld(_v.set(0, 0.3, 0)), [0xffd700, 0xfff3b0, 0xff9d00], 90, 2);
      for (let i = 0; i < 14; i++) {
        const c = add(g, coinGeo, gold, 0, 0.7, 0); const a = Math.random() * 6.28, s = rnd(0.6, 1.3);
        c.userData = { v: new V3(Math.cos(a) * s, rnd(2, 3.2), Math.sin(a) * s * 0.6 + 0.4), r: new V3(rnd(-9, 9), rnd(-9, 9), 0), life: 2.5 };
        coins.push(c);
      }
      setTimeout(() => { portals.forEach(q => (q.visible = true)); ctx.sfx('portal'); refreshHint(); }, 700);
    }, 550);
  }
  return {
    refreshHint, resize: place, dwellTime: 0.7,
    hoverable: p => pick(p),
    hover(p) { hover = pick(p); },
    tap(p) {
      const o = pick(p); if (!o || leaving || shake && !opened) return;
      if (o === chest && !opened) openChest();
      else if (o.userData.key) {
        leaving = o; ctx.sfx('portal');
        ctx.burst(o.getWorldPosition(_v), [0xffffff, 0xffd700], 60, 1.6);
        setTimeout(() => ctx.enter(o.userData.key), 650);
      }
    },
    update(dt, t) {
      if (shake && !opened) { shake += dt; chest.rotation.z = Math.sin(shake * 60) * 0.05; chest.position.y = 0.45 + Math.abs(Math.sin(shake * 30)) * 0.04; }
      else chest.rotation.z = 0;
      if (opened) openT = Math.min(1, openT + dt * 1.2);
      lid.rotation.x = -1.95 * easeBack(openT);
      const k = easeOut(openT);
      if (!(shake && !opened)) chest.position.y = 0.45 - 0.2 * k + Math.sin(t * 1.6) * 0.03;
      chest.scale.setScalar(1 - 0.3 * k);
      chest.rotation.y = Math.sin(t * 0.7) * 0.15 * (1 - k);
      aura.material.opacity = 0.32 + Math.sin(t * 3) * 0.1;
      inner.scale.setScalar(0.1 + k * 1.2);
      beamM.opacity = k * (0.22 + Math.sin(t * 4) * 0.06);
      beams.forEach((b, i) => { b.scale.y = k; b.position.y = 0.25 + 0.9 * k; b.rotation.y += dt * (i + 1) * 0.5; });
      ring.material.opacity = 0.45 + Math.sin(t * 2) * 0.2;
      for (let i = coins.length - 1; i >= 0; i--) {
        const c = coins[i], u = c.userData; u.life -= dt;
        u.v.y -= 9 * dt; c.position.addScaledVector(u.v, dt);
        if (c.position.y < 0.01) { c.position.y = 0.01; u.v.y *= -0.35; u.v.x *= 0.6; u.v.z *= 0.6; }
        c.rotation.x += u.r.x * dt; c.rotation.y += u.r.y * dt;
        if (u.life < 0.4) c.scale.setScalar(Math.max(0.01, u.life / 0.4));
        if (u.life <= 0) { g.remove(c); coins.splice(i, 1); }
      }
      spark += dt;
      if (spark > 0.1) { spark = 0; ctx.burst(chest.localToWorld(_v.set(Math.random() - 0.5, 0.35, (Math.random() - 0.5) * 0.6)), opened ? 0xfff0a0 : 0xffc940, 1, 0.4); }
      for (const p of portals) {
        if (!p.visible) continue;
        const u = p.userData; u.t = Math.min(1, u.t + dt * 1.3);
        const e = easeBack(u.t);
        p.position.set(u.x * e, 0.4 + (u.y - 0.4) * e + Math.sin(t * 1.5 + u.x * 3) * 0.04, 0);
        let s = e * (hover === p ? 1.15 : 1);
        if (leaving === p) { leaveT += dt; s *= 1 + leaveT * leaveT * 12; p.position.z += leaveT * leaveT * 6; }
        p.scale.setScalar(Math.max(0.001, s));
        u.swirl.rotation.z -= dt * (leaving === p ? 8 : 2); u.icon.rotation.y += dt * 1.2;
      }
    },
    dispose() {}
  };
}

/* ================= MUNDO 1: ORLANDO — PARQUE MÁGICO ================= */
function cobbleTex() {
  return rep(canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#3c3946'; g.fillRect(0, 0, w, h);
    for (let y = 0, r = 0; y < h; y += 42, r++) for (let x = (r % 2) * 28 - 28; x < w; x += 56) {
      const c = 95 + Math.random() * 45 | 0; g.fillStyle = `rgb(${c},${c - 6},${c + 8})`;
      g.beginPath(); g.roundRect(x + 3, y + 3, 50, 36, 12); g.fill();
      g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(x + 8, y + 6, 30, 10, 6); g.fill();
    }
  }), 60, 60);
}
function pine(g, x, z, s) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); g.add(p);
  add(p, cyl(0.15, 0.22, 1.4, 8), M(0x3b2a1c), 0, 0.7, 0);
  [[1.6, 2.2, 1.8], [1.25, 1.9, 3.0], [0.85, 1.6, 4.1]].forEach(([r, h, y]) => {
    add(p, cone(r, h, 9), M(0x16402c, { roughness: 0.95 }), 0, y, 0);
    add(p, cone(r * 0.55, h * 0.35, 9), M(0xf2f5ff, { roughness: 0.6 }), 0, y + h * 0.33, 0);
  });
}
let _roofGeo;
const roofGeo = () => _roofGeo || (_roofGeo = keep(new THREE.CylinderGeometry(1, 1, 1, 3).rotateX(-Math.PI / 2)));
function house(g, x, z, w, h, col, sign) {
  const hg = new THREE.Group(); hg.position.set(x, 0, z); hg.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; g.add(hg);
  const d = 4.5, beam = M(0x3a2618, { roughness: 0.9 }), warm = M(0xffc46b, { emissive: 0xffa43a, emissiveIntensity: 1.6 });
  add(hg, box(w, h, d), M(col, { roughness: 0.95 }), 0, h / 2, 0);
  for (const bx of [-w / 2 + 0.12, w / 2 - 0.12]) add(hg, box(0.2, h, 0.12), beam, bx, h / 2, d / 2 + 0.02);
  add(hg, box(w, 0.2, 0.12), beam, 0, h * 0.48, d / 2 + 0.02);
  const sx = (w + 0.8) / 1.732, rh = 2.2, sy = rh / 1.5;
  const roof = add(hg, roofGeo(), M(0x4a2f5c, { roughness: 0.85 })); roof.scale.set(sx, sy, d + 0.6); roof.position.y = h + 0.5 * sy;
  const snow = add(hg, roofGeo(), M(0xf3f6ff, { roughness: 0.55 })); snow.scale.set(sx * 0.5, sy * 0.5, d + 0.7); snow.position.y = h + 1.5 * sy - sy * 0.5 + 0.06;
  add(hg, box(0.5, 1.6, 0.5), M(0x6b5a55), w * 0.25, h + rh * 0.7, -0.6);
  add(hg, box(w * 0.55, 1.3, 0.1), warm, -w * 0.12, 1.35, d / 2 + 0.03, false);
  add(hg, box(w * 0.6, 0.12, 0.25), beam, -w * 0.12, 2.05, d / 2 + 0.1);
  add(hg, box(0.95, 2, 0.1), M(0x2a160a), w * 0.33, 1, d / 2 + 0.03);
  for (const wx of [-w * 0.25, w * 0.2]) { add(hg, box(0.7, 0.85, 0.08), warm, wx, h * 0.72, d / 2 + 0.03, false); add(hg, box(0.82, 0.08, 0.14), beam, wx, h * 0.72 - 0.47, d / 2 + 0.06); }
  const sg = add(hg, new THREE.PlaneGeometry(1.3, 0.55), temp(new THREE.MeshStandardMaterial({ map: textTex(sign, 256, 110, '#2b1a3d', '#ffd36b', 'bold 44px Georgia,serif'), side: THREE.DoubleSide, roughness: 0.8 })), w / 2 + 0.05, 2.9, d / 2 + 0.7, false);
  sg.rotation.y = Math.PI / 2;
  add(hg, box(0.06, 0.06, 0.9), beam, w / 2 + 0.05, 3.25, d / 2 + 0.45);
  return hg;
}
function wizard() { // mago enemigo
  const w = new THREE.Group();
  const robeM = temp(new THREE.MeshStandardMaterial({ color: 0x2d1650, roughness: 0.85, emissive: 0x000000 }));
  add(w, new THREE.LatheGeometry([new V2(0.001, 1.45), new V2(0.2, 1.43), new V2(0.25, 1.2), new V2(0.28, 0.8), new V2(0.4, 0.2), new V2(0.5, 0)], 20), robeM);
  add(w, cyl(0.27, 0.29, 0.08, 20), M(0xc9a227, { metalness: 0.9, roughness: 0.3 }), 0, 1.0, 0);
  const cape = add(w, new THREE.CylinderGeometry(0.33, 0.58, 1.35, 20, 4, true, Math.PI * 0.6, Math.PI * 0.8), M(0x6b0f1a, { side: THREE.DoubleSide, roughness: 0.9 }), 0, 0.76, -0.03);
  add(w, sph(0.13, 24), M(0xe5b998, { roughness: 0.6 }), 0, 1.6, 0);
  const beard = add(w, cone(0.11, 0.34, 12), M(0xc9c9d4), 0, 1.44, 0.06); beard.rotation.x = Math.PI;
  for (const x of [-0.045, 0.045]) add(w, sph(0.018, 8), M(0x66ffcc, { emissive: 0x33ffaa, emissiveIntensity: 2 }), x, 1.63, 0.115, false);
  add(w, cyl(0.3, 0.3, 0.025, 28), M(0x1f0f38), 0, 1.72, 0);
  const hat = add(w, cone(0.2, 0.6, 20), M(0x1f0f38), 0, 2.0, -0.03); hat.rotation.x = -0.15;
  add(w, cyl(0.205, 0.205, 0.05, 20), M(0xc9a227, { metalness: 0.9, roughness: 0.3 }), 0, 1.76, 0);
  const arms = [-1, 1].map(s => {
    const a = new THREE.Group(); a.position.set(0.28 * s, 1.35, 0); w.add(a);
    add(a, cap(0.075, 0.42), robeM, 0, -0.27, 0); add(a, sph(0.06), M(0xe5b998), 0, -0.55, 0);
    a.rotation.z = s * 0.15; return a;
  });
  const wand = new THREE.Group(); wand.position.y = -0.58; arms[1].add(wand);
  add(wand, cyl(0.012, 0.018, 0.4, 6), M(0x2a1a0a), 0, -0.18, 0);
  const tip = glow(0x66ff88, 0.25); tip.position.y = -0.4; wand.add(tip);
  const bar = new THREE.Group(); bar.position.y = 2.55; w.add(bar);
  add(bar, new THREE.PlaneGeometry(0.9, 0.13), B(0x111111), 0, 0, 0, false);
  const segs = [0, 1, 2].map(i => add(bar, new THREE.PlaneGeometry(0.27, 0.08), B(0xff3344), -0.29 + i * 0.29, 0, 0.002, false));
  return { w, robeM, arms, wand, tip, bar, segs, cape };
}

function orlando(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x0a0828, 0x5e3a78, 0x140d26, 1); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0x3d2b5c, 22, 150);
  lightRig(g, { sky: 0x9f92ff, ground: 0x2a2038, hemi: 0.75, sun: 0xc7d4ff, sunI: 1.5, dir: [-10, 16, 8], size: 24, target: [0, 0, -10] });
  const moon = add(g, sph(7, 24), B(0xfff6dd, { fog: false }), -70, 85, -190, false); const mg = glow(0xcfd8ff, 70, 0.6); mg.position.copy(moon.position); g.add(mg);
  const ground = add(g, new THREE.PlaneGeometry(260, 260), temp(new THREE.MeshStandardMaterial({ map: cobbleTex(), roughness: 0.92 })), 0, 0, -20, false);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  // Puerta de entrada del parque
  const stone = M(0x8e899b, { roughness: 0.95 }), dark = M(0x5d586a, { roughness: 0.95 }), gold = M(0xd8b04a, { metalness: 0.9, roughness: 0.3 });
  for (const x of [-3.4, 3.4]) {
    add(g, box(1.3, 6.6, 1.3), stone, x, 3.3, 2);
    const cp = add(g, cone(1.1, 1.7, 4), M(0x3b2a6b), x, 7.45, 2); cp.rotation.y = Math.PI / 4;
    const l = glow(0xffb45a, 1.6); l.position.set(x, 5.4, 2.8); g.add(l);
    add(g, box(0.35, 0.45, 0.35), M(0xffc46b, { emissive: 0xff9a2a, emissiveIntensity: 2 }), x, 5.4, 2.75, false);
  }
  add(g, box(8.1, 1.2, 1.4), stone, 0, 6.2, 2);
  add(g, new THREE.PlaneGeometry(5.6, 0.9), temp(new THREE.MeshStandardMaterial({ map: textTex('✦ ORLANDO · MUNDO MÁGICO ✦', 1024, 160, '#2a1450', '#ffd36b', 'bold 70px Georgia,serif'), emissive: 0x332200, roughness: 0.6 })), 0, 6.2, 2.72, false);
  for (const s of [-1, 1]) add(g, box(30, 3.6, 1), dark, s * 19.05, 1.8, 2);
  const gates = [-1, 1].map(s => {
    const h = new THREE.Group(); h.position.set(s * 2.75, 0, 2); g.add(h);
    add(h, box(2.72, 5, 0.18), M(0x4a2e18, { roughness: 0.85 }), -s * 1.36, 2.5, 0);
    for (const y of [0.8, 2.5, 4.2]) add(h, box(2.72, 0.14, 0.24), M(0x2a2a2a, { metalness: 0.8, roughness: 0.4 }), -s * 1.36, y, 0);
    add(h, sph(0.08, 10), gold, -s * 2.4, 2.4, 0.15);
    return h;
  });
  // Calle de tiendas con techos nevados
  const SIGNS = ['Varitas', 'Dulces', 'Escobas', 'Libros', 'Plumas', 'Túnicas', 'Pociones', 'Lechuzas', 'Bromas', 'Mapas'];
  const COLS = [0x8a7360, 0x6f6a80, 0x7d5f52, 0x5f6f68, 0x8a6a7a];
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) {
    const w = rnd(4.6, 5.6), h = rnd(4.2, 6.2), z = -3 - i * 6;
    house(g, s * 7, z, w, h, COLS[(i + (s > 0 ? 2 : 0)) % 5], SIGNS[i * 2 + (s > 0 ? 1 : 0)]);
  }
  const lamps = [];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    const x = s * 3.7, z = -1 - i * 5.5;
    add(g, cyl(0.06, 0.09, 3.3, 8), M(0x1c1c22, { metalness: 0.7, roughness: 0.4 }), x, 1.65, z);
    add(g, box(0.34, 0.45, 0.34), M(0xffc46b, { emissive: 0xff9a2a, emissiveIntensity: 2.2 }), x, 3.4, z, false);
    add(g, cone(0.3, 0.3, 4), M(0x1c1c22, { metalness: 0.7 }), x, 3.78, z).rotation.y = Math.PI / 4;
    const gl = glow(0xffa94a, 1.7, 0.85); gl.position.set(x, 3.4, z); g.add(gl); lamps.push(gl);
  }
  for (const [x, z] of [[-3.7, -6.5], [3.7, -6.5], [-3.7, -17.5], [3.7, -17.5]]) { const pl = new THREE.PointLight(0xffa04a, 14, 11, 2); pl.position.set(x, 3.2, z); g.add(pl); }
  // Velas flotantes
  const candles = [];
  for (let i = 0; i < 36; i++) {
    const c = new THREE.Group(); c.position.set(rnd(-4, 4), rnd(4.5, 7.5), rnd(-30, 0)); g.add(c);
    add(c, cyl(0.035, 0.035, 0.25, 8), M(0xf5ecd5, { roughness: 0.6 }), 0, 0, 0, false);
    const f = glow(0xffb85a, 0.35); f.position.y = 0.17; c.add(f);
    c.userData.ph = Math.random() * 6; candles.push(c);
  }
  // Círculo del duelo
  const runes = add(g, new THREE.RingGeometry(2.0, 2.3, 64), temp(new THREE.MeshBasicMaterial({ color: 0xb38bff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })), 0, 0.03, -23, false);
  runes.rotation.x = -Math.PI / 2;
  // Castillo sobre la colina
  const hill = add(g, new THREE.SphereGeometry(40, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), M(0x202a28, { roughness: 1 }), 0, -3, -95, false); hill.scale.y = 0.35;
  const castle = new THREE.Group(); castle.position.set(0, 10.5, -92); g.add(castle);
  const cst = M(0x7a7488, { roughness: 0.95 }), roofC = M(0x2c1d4f), winC = M(0xffcf7a, { emissive: 0xffaa44, emissiveIntensity: 2.2 });
  add(castle, box(22, 11, 9), cst, 0, 5.5, 0, false);
  for (let i = 0; i < 11; i++) add(castle, box(1.1, 1.2, 9.2), cst, -10 + i * 2, 11.6, 0, false);
  const tower = (x, z, r, h, rh) => {
    add(castle, cyl(r, r * 1.08, h, 16), cst, x, h / 2, z, false); add(castle, cone(r * 1.35, rh, 16), roofC, x, h + rh / 2, z, false);
    for (let k = 0; k < 3; k++) add(castle, box(0.5, 0.9, 0.2), winC, x, h * (0.45 + k * 0.17), z + r, false);
  };
  tower(-12, 0, 2.6, 17, 8); tower(12, 0, 2.6, 17, 8); tower(-5.5, -3, 2.2, 23, 8); tower(5.5, -3, 2, 21, 7); tower(0, -1.5, 3, 30, 11); tower(-17, 4, 1.8, 12, 5); tower(17, 4, 1.8, 12, 5);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 2; j++) add(castle, box(0.6, 1.1, 0.2), winC, -8.8 + i * 2.2, 3 + j * 4, 4.55, false);
  // Bosque nevado, montañas
  for (let i = 0; i < 45; i++) { const a = rnd(0, Math.PI * 2), r = rnd(14, 45); const x = Math.cos(a) * r, z = 2 + Math.sin(a) * r; if (Math.abs(x) < 11 && z < 4 && z > -40) continue; pine(g, x, z, rnd(0.9, 1.6)); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = rnd(200, 230); add(g, cone(rnd(35, 60), rnd(50, 90), 6), M(0x1b1733, { fog: false, roughness: 1 }), Math.cos(a) * r, 15, Math.sin(a) * r, false); }
  // Nieve que cae
  const NS = 700, sp = new Float32Array(NS * 3);
  for (let i = 0; i < NS; i++) { sp[i * 3] = rnd(-18, 18); sp[i * 3 + 1] = rnd(0, 14); sp[i * 3 + 2] = rnd(-18, 18); }
  const snowG = new THREE.BufferGeometry(); snowG.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const snowP = new THREE.Points(snowG, temp(new THREE.PointsMaterial({ size: 0.07, map: glowTex(), color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.9 })));
  snowP.frustumCulled = false; g.add(snowP);

  // Mago enemigo (aparece al terminar la intro)
  const E = wizard(); const en = E.w; en.position.set(0, 0, -23); en.visible = false; g.add(en);
  const stunStars = [0, 1, 2].map(() => { const s = starMesh(); s.scale.setScalar(0.25); s.visible = false; en.add(s); return s; });
  // Varita del jugador y escudo Protego (pegados a la cámara)
  const COL = { expelliarmus: 0xff3030, stupefy: 0x8fd0ff, protego: 0x66ccff };
  const wand = new THREE.Group(); camera.add(wand);
  const wg = cyl(0.008, 0.014, 0.34, 8); wg.rotateX(Math.PI / 2); wg.translate(0, 0, 0.17);
  add(wand, wg, M(0x5a3a1c, { roughness: 0.6 }), 0, 0, 0, false);
  const hg = cyl(0.017, 0.017, 0.11, 8); hg.rotateX(Math.PI / 2); hg.translate(0, 0, 0.055);
  add(wand, hg, M(0x2a1608, { roughness: 0.5 }), 0, 0, 0, false);
  for (const z of [0.005, 0.11]) { const r = add(wand, new THREE.TorusGeometry(0.018, 0.004, 6, 16), M(0xd8b04a, { metalness: 1, roughness: 0.25 }), 0, 0, z, false); }
  const tip = glow(COL.expelliarmus, 0.12); tip.position.z = 0.35; wand.add(tip);
  const shield = new THREE.Group(); shield.position.set(0, -0.02, -0.6); shield.visible = false; camera.add(shield);
  const shM = temp(new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  add(shield, new THREE.CircleGeometry(0.42, 48), shM, 0, 0, 0, false);
  const hex = add(shield, new THREE.IcosahedronGeometry(0.42, 1), temp(new THREE.MeshBasicMaterial({ color: 0xaee8ff, wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })), 0, 0, 0, false);
  hex.scale.z = 0.25;

  // Interfaz de hechizos
  const ui = document.getElementById('spells'), btns = [...ui.querySelectorAll('.sp')];
  let spell = 'expelliarmus';
  const setSpell = s => { spell = s; btns.forEach(x => x.classList.toggle('on', x.dataset.s === s)); tip.material.color.set(COL[s]); };
  btns.forEach(b => { b.onclick = () => { setSpell(b.dataset.s); ctx.sfx('click'); }; });
  setSpell('expelliarmus');
  document.getElementById('bCast').onclick = () => cast();

  let alive = true, running = false, hits = 0, hp = 4, cd = 0, shieldT = 0, shieldCd = 0, stun = 0, disarm = 0, fireT = 3, charge = 0, dead = 0, won = false, tx = 0, moveT = 0, kick = 0, castAnim = 0, gateOpen = 0;
  const shots = [], foes = [], flying = [];
  const enC = new V3(), camW = () => camera.getWorldPosition(_w);
  const info = () => ctx.info(`${'❤️'.repeat(hp)}${'🖤'.repeat(4 - hp)} · Aciertos ${hits}/3`);
  const intro = withIntro(ctx, opt, [
    { t: 0, p: [0, 1.6, 10], yaw: 0, pitch: 0.18 },
    { t: 1.6, p: [0, 1.6, 9.2], yaw: 0, pitch: 0.12 },
    { t: 6.2, p: [0, 1.6, -12.5], yaw: 0, pitch: 0.02 },
    { t: 7, p: [0, 1.6, -13.5], yaw: 0, pitch: 0.05 },
    { t: 11.5, p: [0, 1.6, -14], yaw: Math.PI * 2, pitch: 0.05 },
    { t: 12, p: [0, 1.6, -14], yaw: Math.PI * 2, pitch: 0 }
  ], 0, 0, () => {
    ctx.camera.position.set(0, 1.6, -14); gateOpen = 1;
    en.visible = true; ctx.sfx('portal');
    ctx.burst(en.localToWorld(_v.set(0, 1.2, 0)), [0x9b5cff, 0x66ffcc, 0xffffff], 70, 2.2);
    document.getElementById('crosshair').classList.remove('hidden');
  });
  if (!opt.quick) setTimeout(() => alive && intro.on && ctx.sfx('gate'), 700);
  ui.classList.toggle('hidden', !!intro.on);

  function aimPoint() { const d = en.localToWorld(_v.set(0, 1.2, 0)).distanceTo(camW()); return ctx.ptr.ray.ray.at(d, new V3()); }
  function cast() {
    if (!running || cd > 0) return;
    if (spell === 'protego') { protego(); return; }
    cd = 0.5; kick = 1; ctx.sfx('spell');
    const from = tip.getWorldPosition(new V3()), to = aimPoint();
    enC.copy(en.position).setY(1.15);
    const assist = Math.abs(to.x - enC.x) < 1.2 && Math.abs(to.y - enC.y) < 1.3;
    const m = add(g, sph(0.07, 10), B(COL[spell]), from.x, from.y, from.z, false); m.add(glow(COL[spell], 1.1));
    shots.push({ m, v: (assist ? enC.clone() : to).sub(from).normalize().multiplyScalar(16), kind: spell, life: 1.4, assist });
    ctx.burst(from, COL[spell], 10, 0.8);
  }
  function protego() { if (!running || shieldCd > 0) return; shieldT = 1.7; shieldCd = 3; ctx.sfx('block'); }
  function enemyHit(kind) {
    hits++; E.segs[3 - hits].visible = false; ctx.sfx('hit'); info();
    ctx.burst(en.localToWorld(_v.set(0, 1.2, 0)), [COL[kind], 0xffffff], 50, 2);
    E.robeM.emissive.set(kind === 'stupefy' ? 0x1f4f99 : 0x661111);
    en.rotation.x = -0.25;
    if (kind === 'stupefy') stun = 2.6;
    else { // Expelliarmus: la varita sale volando
      disarm = 2; E.wand.visible = false; charge = 0;
      const fw = add(g, cyl(0.012, 0.018, 0.4, 6), M(0x2a1a0a), 0, 0, 0, false);
      E.wand.getWorldPosition(fw.position); fw.userData = { v: new V3(rnd(-1.5, 1.5), 4.5, rnd(1, 2)), life: 1.8 }; flying.push(fw);
    }
    if (hits >= 3) { running = false; dead = 0.001; }
  }
  function remove(list, i) { const o = list[i]; g.remove(o.m || o); disposeTree(o.m || o); list.splice(i, 1); }
  const refreshHint = () => ctx.hint(ctx.isHand() ? '☝️ Apunta al mago con tu índice (dispara solo) · ✋ palma abierta = Protego' : 'Toca al mago o pulsa ✨ Lanzar · arrastra o gira el celular para mirar');

  return {
    look: true, camLock: !opt.quick, dwellTime: 0.35, repeatDwell: 0.55, refreshHint,
    start() { running = true; this.camLock = false; ui.classList.remove('hidden'); info(); refreshHint(); setTimeout(() => { if (alive && running) ctx.hint(''); }, 5000); },
    tap() { if (intro.on) { intro.finish(); this.camLock = false; return; } cast(); },
    palm() { protego(); },
    hoverable(p) { // el dedo apunta al mago → dispara automáticamente
      if (!running || dead) return null;
      const c = en.localToWorld(_v.set(0, 1.2, 0));
      return p.ray.ray.distanceSqToPoint(c) < 0.9 ? 'enemy' : null;
    },
    update(dt, t) {
      if (intro.on) {
        intro.update(dt);
        if (intro.path.t > 1.5 && intro.path.t < 6) camera.position.y = 1.6 + Math.abs(Math.sin(intro.path.t * 5.5)) * 0.05;
        gateOpen = smooth((intro.path.t - 0.6) / 2.2);
        if (!intro.on) this.camLock = false;
      }
      gates.forEach((h, i) => { h.rotation.y = (i ? -1 : 1) * 1.75 * gateOpen; });
      // ambiente
      lamps.forEach((l, i) => l.scale.setScalar(1.6 + Math.sin(t * 9 + i) * 0.12));
      candles.forEach(c => { c.position.y += Math.sin(t * 1.3 + c.userData.ph) * 0.003; });
      runes.rotation.z += dt * 0.3; runes.material.opacity = 0.5 + Math.sin(t * 2) * 0.2;
      const cp = camera.position, arr = snowG.attributes.position.array;
      for (let i = 0; i < NS; i++) {
        const j = i * 3; arr[j + 1] -= dt * (0.7 + (i % 5) * 0.12); arr[j] += Math.sin(t + i) * dt * 0.2;
        if (arr[j + 1] < 0) arr[j + 1] = 14;
      }
      snowG.attributes.position.needsUpdate = true; snowP.position.set(cp.x, 0, cp.z);
      // varita sigue el puntero / dedo índice
      cd = Math.max(0, cd - dt); shieldCd = Math.max(0, shieldCd - dt); shieldT = Math.max(0, shieldT - dt);
      btns[2].classList.toggle('cool', shieldCd > 0 && shieldT <= 0);
      shield.visible = shieldT > 0; hex.rotation.z += dt; shield.scale.setScalar(Math.min(1, (1.7 - shieldT) * 6) * (1 + Math.sin(t * 20) * 0.02));
      kick = Math.max(0, kick - dt * 5);
      const n = ctx.ptr.ndc, hh = 0.45 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
      wand.visible = !intro.on;
      wand.position.set((n.x * 0.5 + 0.38) * hw, (n.y * 0.4 - 0.58) * hh, -0.45);
      wand.lookAt(aimPoint()); wand.rotateX(-kick * 0.5);
      // enemigo
      const cw = camW();
      for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i], u = f.userData; u.life -= dt; u.v.y -= 9 * dt; f.position.addScaledVector(u.v, dt); f.rotation.x += dt * 12; if (f.position.y < 0.05) { f.position.y = 0.05; u.v.set(0, 0, 0); } if (u.life <= 0) remove(flying, i); }
      if (en.visible) {
        en.lookAt(cw.x, 0, cw.z);
        en.rotation.x = lerp(en.rotation.x, 0, dt * 4);
        E.bar.lookAt(cw);
        E.cape.rotation.y = Math.sin(t * 1.7) * 0.08;
        stunStars.forEach((s, i) => { s.visible = stun > 0; const a = t * 4 + i * 2.1; s.position.set(Math.cos(a) * 0.35, 2.15, Math.sin(a) * 0.35); s.rotation.y += dt * 5; });
      }
      if (dead) {
        dead += dt; en.scale.setScalar(Math.max(0.01, 1 - dead * 1.2)); en.rotation.y += dt * 14; en.position.y += dt * 0.6;
        if (Math.random() < 0.7) ctx.burst(en.localToWorld(_v.set(0, 1, 0)), [0x9b5cff, 0xffd700], 4, 1.5);
        if (dead > 0.9 && !won) { won = true; en.visible = false; ctx.win('orlando'); }
      } else if (running) {
        stun = Math.max(0, stun - dt); disarm = Math.max(0, disarm - dt);
        if (!disarm) E.wand.visible = true;
        if (!stun && !disarm) E.robeM.emissive.lerp(_u.set(0, 0, 0), dt * 3);
        if (!stun) {
          moveT -= dt; if (moveT <= 0) { moveT = rnd(1.6, 2.8); tx = rnd(-3, 3); }
          en.position.x = lerp(en.position.x, tx, dt * 1.5);
          en.position.y = Math.sin(t * 2) * 0.05;
        } else en.rotation.z = Math.sin(t * 10) * 0.1;
        if (!stun) en.rotation.z = 0;
        // ataque con aviso: brazo arriba y brillo creciente
        if (!stun && !disarm) {
          fireT -= dt;
          if (fireT < 0.9) { if (!charge) ctx.sfx('charge'); charge = 1; }
          castAnim = lerp(castAnim, fireT < 0.9 ? 1 : 0, dt * 6);
          E.tip.scale.setScalar(0.25 + (fireT < 0.9 ? (0.9 - fireT) * 0.9 : 0));
          if (fireT <= 0) {
            fireT = rnd(2.4, 3.3); charge = 0;
            const from = E.tip.getWorldPosition(new V3()), to = cw.clone().add(_v.set(rnd(-0.2, 0.2), -0.1, 0));
            const m = add(g, sph(0.1, 10), B(0x66ff88), from.x, from.y, from.z, false); m.add(glow(0x66ff88, 1.3));
            foes.push({ m, v: to.sub(from).normalize().multiplyScalar(7) });
          }
        } else castAnim = lerp(castAnim, 0, dt * 6);
        E.arms[1].rotation.x = -castAnim * 1.9; E.arms[1].rotation.z = 0.15 + castAnim * 0.2;
        E.arms[0].rotation.x = Math.sin(t * 1.5) * 0.08;
      }
      // hechizos del jugador
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]; s.life -= dt;
        enC.copy(en.position).setY(1.15);
        if (s.assist && !dead) { _v.copy(enC).sub(s.m.position).normalize().multiplyScalar(16); s.v.lerp(_v, 0.15); }
        s.m.position.addScaledVector(s.v, dt);
        ctx.burst(s.m.position, COL[s.kind], 1, 0.25);
        if (!dead && running && en.visible && s.m.position.distanceTo(enC) < 0.6) { enemyHit(s.kind); remove(shots, i); }
        else if (s.life <= 0) remove(shots, i);
      }
      // hechizos del enemigo
      for (let i = foes.length - 1; i >= 0; i--) {
        const f = foes[i]; f.m.position.addScaledVector(f.v, dt);
        ctx.burst(f.m.position, 0x66ff88, 1, 0.2);
        if (f.m.position.distanceTo(camW()) < 0.85) {
          if (shieldT > 0) { ctx.sfx('block'); ctx.burst(f.m.position, [0x66ccff, 0xffffff], 40, 1.6); }
          else if (running) {
            hp--; ctx.sfx('hurt'); ctx.flash(); info();
            if (hp <= 0) { running = false; ctx.lose('El mago enemigo te derrotó. Consejo: cuando veas el brillo verde, activa 🛡️ Protego.'); }
          }
          remove(foes, i);
        } else if (f.m.position.z > camW().z + 3) remove(foes, i);
      }
    },
    dispose() {
      alive = false; running = false; restoreEnv();
      camera.remove(wand); camera.remove(shield); disposeTree(wand); disposeTree(shield);
      ui.classList.add('hidden'); document.getElementById('crosshair').classList.add('hidden');
    }
  };
}

/* ================= MUNDO 2: MIAMI — PLAYA 360° ================= */
let _frond;
function frondParts() { // hoja de palmera: tira curvada con textura de hojitas (compartida)
  if (_frond) return _frond;
  const geo = new THREE.PlaneGeometry(1.1, 3.4, 1, 10); geo.translate(0, 1.7, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = y / 3.4; p.setX(i, p.getX(i) * (1 - k * 0.75)); p.setZ(i, -y * y * 0.09); }
  geo.computeVertexNormals(); keep(geo);
  const tex = keep(canvasTex(128, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let y = 8; y < h; y += 7) {
      const k = 1 - y / h, len = (w / 2 - 4) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, (y / h) * 1.1)));
      g.strokeStyle = `rgb(${30 + Math.random() * 40 | 0},${110 + Math.random() * 60 | 0},${40 + Math.random() * 20 | 0})`; g.lineWidth = 4;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(w / 2, y); g.quadraticCurveTo(w / 2 + s * len * 0.6, y - 6, w / 2 + s * len, y + 14 * k + 6); g.stroke(); }
    }
    g.strokeStyle = '#6b5a2a'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
  }));
  return (_frond = { geo, mat: new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7 }) });
}
function palm(par, x, z, s = 1, h = 8) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); par.add(p);
  const tr = M(0x8a6a48, { roughness: 1 }), bend = rnd(-0.06, 0.06), segs = 10;
  let px = 0, py = 0;
  for (let i = 0; i < segs; i++) {
    const r = 0.22 - i * 0.012, len = h / segs;
    const sg = add(p, cyl(r - 0.01, r, len, 8), tr, px, py + len / 2, 0); sg.rotation.z = -bend * i;
    add(p, cyl(r + 0.02, r + 0.02, 0.06, 8), M(0x6f5236), px, py + 0.03, 0, false);
    px += Math.sin(bend * i) * len; py += Math.cos(bend * i) * len;
  }
  const crown = new THREE.Group(); crown.position.set(px, py, 0); p.add(crown);
  const F = frondParts();
  for (let i = 0; i < 11; i++) {
    const fg = new THREE.Group(); fg.rotation.y = i / 11 * Math.PI * 2 + rnd(-0.2, 0.2); crown.add(fg);
    const f = new THREE.Mesh(F.geo, F.mat); f.castShadow = true; f.rotation.x = rnd(0.9, 1.5); fg.add(f);
  }
  for (let i = 0; i < 4; i++) add(crown, sph(0.14, 10), M(0x5a3d1a), Math.cos(i * 1.6) * 0.2, -0.15, Math.sin(i * 1.6) * 0.2);
  p.userData.crown = crown; p.userData.ph = Math.random() * 6;
  return p;
}
function facadeTex(col, rows, cols) {
  const c = new THREE.Color(col), base = `rgb(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0})`;
  return canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const rh = h / rows, cw = w / cols;
    for (let r = 0; r < rows; r++) {
      g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, r * rh + rh - 8, w, 8);
      for (let k = 0; k < cols; k++) {
        if (r === rows - 1 && k % 2) continue;
        const x = k * cw + cw * 0.18, y = r * rh + rh * 0.2;
        g.fillStyle = '#244a66'; g.fillRect(x, y, cw * 0.64, rh * 0.55);
        g.fillStyle = 'rgba(160,220,255,.45)'; g.fillRect(x + 3, y + 3, cw * 0.25, rh * 0.5);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x - 2, y + rh * 0.55, cw * 0.64 + 4, 5);
      }
    }
  });
}
function decoBuilding(g, x, w, h, col, neon, name) {
  const z = 26, d = 10, b = new THREE.Group(); b.position.set(x, 0, z); g.add(b);
  const side = M(col, { roughness: 0.9 }), front = temp(new THREE.MeshStandardMaterial({ map: facadeTex(col, Math.round(h / 3.4), Math.max(3, Math.round(w / 2.6))), roughness: 0.85 }));
  add(b, box(w, h, d), [side, side, side, side, side, front]);
  for (let y = 3.4; y < h - 1; y += 3.4) add(b, box(w + 0.3, 0.18, 0.7), M(0xffffff, { roughness: 0.6 }), 0, y, -d / 2 - 0.3);
  add(b, box(1.2, h + 3, 1), side, 0, (h + 3) / 2, -d / 2 - 0.4);
  add(b, box(0.25, h + 2, 0.15), M(neon, { emissive: neon, emissiveIntensity: 2.2 }), 0, (h + 2) / 2 + 0.3, -d / 2 - 0.95, false);
  add(b, cyl(1.2, 1.2, h, 20), side, w / 2 - 0.6, h / 2, -d / 2 + 0.6);
  const sg = add(b, new THREE.PlaneGeometry(Math.min(w * 0.7, 9), 1.7), temp(new THREE.MeshStandardMaterial({ map: textTex(name, 512, 96, 'rgba(0,0,0,0)', '#fff', 'bold 72px system-ui'), transparent: true, emissive: neon, emissiveIntensity: 1.2, emissiveMap: null })), 0, h + 1.2, -d / 2 - 0.05, false);
  sg.material.emissiveMap = sg.material.map; sg.rotation.y = Math.PI;
  add(b, box(w * 0.8, 0.25, 1.6), M(neon, { roughness: 0.6 }), 0, 3.0, -d / 2 - 0.8);
}
function car(g, col, x, z, sp) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.userData.sp = sp; if (sp < 0) c.rotation.y = Math.PI; g.add(c);
  const paint = M(col, { metalness: 0.6, roughness: 0.25 }), glass = M(0x14202e, { metalness: 0.9, roughness: 0.08 });
  add(c, box(4.3, 0.65, 1.85), paint, 0, 0.65, 0);
  add(c, box(2.2, 0.55, 1.6), glass, -0.25, 1.22, 0);
  add(c, box(1.0, 0.25, 1.86), paint, 1.6, 0.98, 0);
  for (const wx of [-1.35, 1.35]) for (const wz of [-0.85, 0.85]) {
    const w = add(c, cyl(0.36, 0.36, 0.28, 18), M(0x111111, { roughness: 0.7 }), wx, 0.36, wz); w.rotation.x = Math.PI / 2;
    const r = add(c, cyl(0.2, 0.2, 0.3, 12), M(0xcccccc, { metalness: 1, roughness: 0.3 }), wx, 0.36, wz, false); r.rotation.x = Math.PI / 2;
  }
  for (const wz of [-0.6, 0.6]) add(c, box(0.08, 0.15, 0.35), M(0xffffee, { emissive: 0xffffcc, emissiveIntensity: 1.5 }), 2.16, 0.75, wz, false);
  return c;
}
function stripesTex(a, b, n = 8) { return canvasTex(256, 64, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * w / n, 0, w / n + 1, h); } }); }
function lifeguard(g, x, z, col, col2) {
  const t = new THREE.Group(); t.position.set(x, 0, z); t.rotation.y = rnd(-0.3, 0.3); g.add(t);
  for (const [lx, lz] of [[-1, -0.8], [1, -0.8], [-1, 0.8], [1, 0.8]]) add(t, box(0.15, 1.9, 0.15), M(0xf2f2f2), lx, 0.95, lz);
  add(t, box(2.8, 0.15, 2.2), M(0xe8e0d0), 0, 1.95, 0);
  add(t, box(2.4, 1.7, 1.8), temp(new THREE.MeshStandardMaterial({ map: stripesTex(col, col2), roughness: 0.8 })), 0, 2.9, 0);
  add(t, box(1.2, 0.8, 0.05), M(0x2a5a7a, { metalness: 0.6, roughness: 0.1 }), 0, 3.1, -0.93, false);
  const roof = add(t, box(3, 0.15, 2.5), M(col2), 0, 3.85, 0); roof.rotation.x = 0.1;
  const ramp = add(t, box(1, 0.1, 3.2), M(0xe8e0d0), 0, 1, 2.4); ramp.rotation.x = 0.62;
  add(t, cyl(0.03, 0.03, 2, 6), M(0xdddddd), 1.3, 4.6, 0);
  const flag = add(t, new THREE.PlaneGeometry(0.8, 0.5), M(0xff2a2a, { side: THREE.DoubleSide }), 1.7, 5.3, 0, false);
  t.userData.flag = flag; return t;
}
const ITEM_BUILD = {
  key(i) { const gd = M(0xffcc33, { metalness: 1, roughness: 0.25 }); add(i, new THREE.TorusGeometry(0.1, 0.03, 10, 24), gd, -0.15, 0, 0); add(i, box(0.32, 0.05, 0.05), gd, 0.08, 0, 0); add(i, box(0.05, 0.09, 0.05), gd, 0.2, -0.06, 0); add(i, box(0.05, 0.06, 0.05), gd, 0.12, -0.05, 0); },
  glasses(i) { const k = M(0x111111, { roughness: 0.3 }), l = M(0x2b1a55, { metalness: 0.9, roughness: 0.05 }); for (const x of [-0.12, 0.12]) { add(i, new THREE.TorusGeometry(0.09, 0.02, 8, 24), k, x, 0, 0); add(i, new THREE.CircleGeometry(0.085, 24), l, x, 0, 0.003); } add(i, box(0.08, 0.02, 0.02), k, 0, 0.03, 0); for (const x of [-0.21, 0.21]) add(i, box(0.02, 0.02, 0.3), k, x, 0.02, -0.15); },
  surf(i) { const m = add(i, sph(0.3, 24), temp(new THREE.MeshStandardMaterial({ map: stripesTex('#ff4fa3', '#ffffff', 3), roughness: 0.3 }))); m.scale.set(1, 3.6, 0.15); add(i, box(0.03, 2.1, 0.06), M(0x24d1ff), 0, 0, 0.02); },
  camera(i) { add(i, box(0.36, 0.22, 0.16), M(0x1b1b1b, { roughness: 0.4 })); const l = add(i, cyl(0.08, 0.09, 0.12, 20), M(0x333333, { metalness: 0.8, roughness: 0.2 }), 0, 0, 0.12); l.rotation.x = Math.PI / 2; add(i, cyl(0.06, 0.06, 0.01, 20), M(0x3355aa, { metalness: 1, roughness: 0.05 }), 0, 0, 0.18).rotation.x = Math.PI / 2; add(i, box(0.08, 0.05, 0.06), M(0xeeeeee, { emissive: 0x888888 }), 0.11, 0.13, 0); },
  coin(i) { const m = add(i, cyl(0.22, 0.22, 0.05, 32), M(0xffd23a, { metalness: 1, roughness: 0.2 })); m.rotation.x = Math.PI / 2; add(i, new THREE.TorusGeometry(0.17, 0.015, 6, 32), M(0xffe680, { metalness: 1, roughness: 0.2 }), 0, 0, 0.03); }
};

function miami(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x1a72e0, 0xbfe9ff, 0xefe2c0); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0xd2ecff, 90, 360);
  const sunDir = new V3(-0.35, 0.6, -1).normalize();
  lightRig(g, { sky: 0xcbe7ff, ground: 0xe8d3a0, hemi: 1.0, sun: 0xfff0d2, sunI: 2.8, dir: [sunDir.x * 40, sunDir.y * 40, sunDir.z * 40], size: 26, target: [0, 0, 4] });
  add(g, sph(10, 24), B(0xfff8e0, { fog: false }), sunDir.x * 330, sunDir.y * 330, sunDir.z * 330, false);
  const sg = glow(0xfff0b0, 140, 0.7); sg.position.copy(sunDir).multiplyScalar(320); g.add(sg);
  // Mar con olas animadas (deformación en la tarjeta gráfica)
  const oceanM = temp(new THREE.MeshStandardMaterial({ color: 0x0b8db0, roughness: 0.1, metalness: 0.15 }));
  const uT = { value: 0 };
  oceanM.onBeforeCompile = sh => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `float a_=position.x*.12+uT*1.1, b_=position.y*.2+uT*1.5, c_=(position.x+position.y)*.5+uT*2.2, d_=position.x*1.7-position.y*1.1+uT*3.;
        float dx_=.03*cos(a_)+.03*cos(c_)+.034*cos(d_), dy_=.05*cos(b_)+.03*cos(c_)-.022*cos(d_);
        vec3 objectNormal = normalize(vec3(-dx_,-dy_,1.));
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.z += .25*sin(a_)+.25*sin(b_)+.06*sin(c_)+.02*sin(d_);');
  };
  const ocean = add(g, new THREE.PlaneGeometry(800, 420, 160, 84), oceanM, 0, -0.35, -224, false); ocean.rotation.x = -Math.PI / 2;
  const foamM = temp(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 1, depthWrite: false }));
  const foam = add(g, new THREE.PlaneGeometry(800, 1.6), foamM, 0, 0.02, -14, false); foam.rotation.x = -Math.PI / 2;
  // Arena
  const sandT = rep(canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#e8d2a2'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { const v = Math.random(); c.fillStyle = v < 0.5 ? 'rgba(170,140,90,.25)' : 'rgba(255,250,235,.35)'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }), 120, 6);
  const sand = add(g, new THREE.PlaneGeometry(800, 24), temp(new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 })), 0, 0, -3, false); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true;
  const wet = add(g, new THREE.PlaneGeometry(800, 6), M(0xb39a6c, { roughness: 0.4 }), 0, -0.4, -16.6, false); wet.rotation.x = -Math.PI / 2 + 0.13;
  // Paseo, Ocean Drive y edificios Art Déco
  add(g, box(800, 0.25, 3), M(0xf3c6c6, { roughness: 0.9 }), 0, 0.12, 10);
  add(g, box(800, 0.06, 8), M(0x2f3036, { roughness: 0.85 }), 0, 0.03, 15.5);
  for (let i = -30; i < 30; i++) add(g, box(2.4, 0.07, 0.15), M(0xffd23a), i * 6, 0.04, 15.5, false);
  for (const z of [11.7, 19.3]) add(g, box(800, 0.07, 0.12), M(0xffffff), 0, 0.04, z, false);
  add(g, box(800, 0.25, 2.5), M(0xe9e0d6, { roughness: 0.9 }), 0, 0.12, 20.5);
  const NEON = [0xff4fa3, 0x24d1ff, 0x7bff6a, 0xffb000, 0xb36bff];
  const DCOL = [0xffc2d1, 0xa8ece6, 0xfff1b8, 0xd6c6ff, 0xffd3b0, 0xbfe6ff];
  const NAMES = ['SOL', 'PALMA', 'BRISA', 'CORAL', 'MAREA', 'FLORIDA', 'TROPICAL', 'AZUL', 'OCEAN', 'LUNA', 'ARENA', 'VICE'];
  for (let x = -72, i = 0; x < 72; i++) { const w = rnd(11, 16); decoBuilding(g, x + w / 2, w, rnd(11, 22), DCOL[i % 6], NEON[i % 5], NAMES[i % 12]); x += w + 1.2; }
  const palms = [];
  for (let x = -60; x <= 60; x += 9) palms.push(palm(g, x + rnd(-1, 1), 8.6, 1, rnd(7, 10)));
  for (const [x, z] of [[-14, -4], [-11, -6], [15, -2], [19, -5], [-24, 0], [26, 1]]) palms.push(palm(g, x, z, 1, rnd(6, 9)));
  const cars = [[0xff4fa3, -30, 13.6, 7], [0x24d1ff, 10, 13.6, 7], [0xffe14d, -5, 17.4, -6], [0x8a5cff, 35, 17.4, -6], [0xffffff, 55, 13.6, 7]].map(a => car(g, ...a));
  const towers = [lifeguard(g, -9, -5, '#ff7ab6', '#24d1ff'), lifeguard(g, 12, -3, '#ffd23a', '#ff5a3a')];
  for (const [x, z, a, b] of [[-3, -2, '#ff5a3a', '#ffffff'], [6, -6, '#24d1ff', '#ffffff'], [-16, -8, '#ffd23a', '#ff4fa3'], [20, -9, '#7bff6a', '#ffffff']]) {
    add(g, cyl(0.04, 0.04, 2.4, 6), M(0xffffff), x, 1.2, z);
    add(g, cone(1.6, 0.6, 16), temp(new THREE.MeshStandardMaterial({ map: stripesTex(a, b, 16), roughness: 0.8, side: THREE.DoubleSide })), x, 2.4, z);
    const tw = add(g, new THREE.PlaneGeometry(0.9, 1.9), temp(new THREE.MeshStandardMaterial({ map: stripesTex(a, b, 6), roughness: 1 })), x + 1, 0.02, z + 0.4, false); tw.rotation.x = -Math.PI / 2; tw.receiveShadow = true;
  }
  const bench = new THREE.Group(); bench.position.set(-4, 0.25, 9.5); g.add(bench);
  add(bench, box(2, 0.08, 0.5), M(0x9a6a3a), 0, 0.55, 0); add(bench, box(2, 0.45, 0.06), M(0x9a6a3a), 0, 0.85, 0.25);
  for (const x of [-0.85, 0.85]) add(bench, box(0.08, 0.55, 0.5), M(0x333333, { metalness: 0.7 }), x, 0.27, 0);
  // Nubes y gaviotas
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Group(), a = rnd(0, Math.PI * 2), r = rnd(120, 220); c.position.set(Math.cos(a) * r, rnd(45, 85), Math.sin(a) * r); g.add(c);
    for (let k = 0; k < 6; k++) add(c, sph(rnd(6, 12), 12), M(0xffffff, { roughness: 1, emissive: 0xbfd8ee, emissiveIntensity: 0.5, fog: false }), rnd(-14, 14), rnd(-2, 4), rnd(-6, 6), false);
    c.userData.sp = rnd(0.5, 1.5); clouds.push(c);
  }
  const gulls = [];
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Group(); g.add(b);
    add(b, sph(0.18, 8), M(0xf5f5f5), 0, 0, 0, false).scale.set(1, 0.7, 2);
    const wings = [-1, 1].map(s => { const w = new THREE.Group(); w.position.x = s * 0.12; b.add(w); add(w, box(0.9, 0.03, 0.28), M(0xe8e8e8), s * 0.45, 0, 0, false); add(w, box(0.25, 0.031, 0.2), M(0x333333), s * 0.82, 0, 0, false); return w; });
    b.userData = { wings, r: rnd(12, 30), h: rnd(10, 20), sp: rnd(0.15, 0.3) * (Math.random() < 0.5 ? -1 : 1), ph: rnd(0, 6), cz: rnd(-25, 0) };
    gulls.push(b);
  }
  // Objetos escondidos alrededor (con haz de luz para encontrarlos)
  const DEF = [['🔑', 'key', -7.2, 0.35, -2.8], ['🕶️', 'glasses', 4.4, 0.18, -2.6], ['🏄', 'surf', 9, 1.1, -9.5], ['📷', 'camera', -4, 1.05, 9.5], ['🪙', 'coin', 13, 1.5, 4]];
  const hitM = temp(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const beamM = temp(new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const items = DEF.map(([emoji, kind, x, y, z], k) => {
    const it = new THREE.Group(); it.position.set(x, y, z); g.add(it);
    const body = new THREE.Group(); it.add(body); ITEM_BUILD[kind](body);
    it.add(glow(0xfff3a0, 1.2, 0.6));
    const beam = add(it, new THREE.CylinderGeometry(0.08, 0.35, 7, 12, 1, true), beamM, 0, 3.5, 0, false);
    const hit = add(it, sph(0.95, 8), hitM, 0, 0, 0, false);
    it.userData = { emoji, found: false, hit, body, beam, by: y, ph: k, fly: 0, spin: kind !== 'surf' };
    return it;
  });

  let alive = true, running = false, time = 60, found = 0, hover = null, infoT = 0, waveT = 0;
  const arrow = document.getElementById('arrow');
  const info = () => ctx.info(`⏱ ${Math.ceil(time)} s · ${found}/5 · ${items.map(i => i.userData.found ? '✅' : i.userData.emoji).join(' ')}`);
  const pick = p => { const h = p.ray.intersectObjects(items.filter(i => !i.userData.found).map(i => i.userData.hit)); return h.length ? h[0].object.parent : null; };
  function collect(it) {
    it.userData.found = true; it.userData.fly = 0.001; found++;
    ctx.sfx('pickup'); ctx.burst(it.getWorldPosition(_v), [0xffd700, 0xff4fa3, 0x24d1ff], 45, 2.2); info();
    if (found === 5) { running = false; arrow.classList.add('hidden'); setTimeout(() => ctx.win('miami'), 700); }
  }
  const intro = withIntro(ctx, opt, [
    { t: 0, p: [0, 26, -60], yaw: Math.PI, pitch: -0.32 },
    { t: 4.5, p: [0, 1.6, -1], yaw: Math.PI, pitch: 0.05 },
    { t: 5.3, p: [0, 1.6, 0], yaw: Math.PI, pitch: 0.08 },
    { t: 8.2, p: [0, 1.6, 0], yaw: Math.PI * 2, pitch: 0 }
  ], 0, 0);
  const refreshHint = () => ctx.hint((ctx.gyroOn() ? '📱 Gira el celular para buscar · ' : '👆 Arrastra para mirar alrededor · ') + (ctx.isHand() ? 'deja tu índice quieto sobre el objeto' : 'toca el objeto'));
  return {
    look: true, camLock: !opt.quick, dwellTime: 0.5, refreshHint,
    start() { running = true; this.camLock = false; info(); refreshHint(); },
    tap(p) { if (intro.on) { intro.finish(); this.camLock = false; return; } if (!running) return; const it = pick(p); if (it) collect(it); },
    hoverable: p => (running ? pick(p) : null),
    hover(p) { hover = running ? pick(p) : null; },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      uT.value = t;
      foam.position.z = -14 + Math.sin(t * 0.8) * 1.2; foamM.opacity = 0.45 + Math.sin(t * 0.8 + 1) * 0.3;
      waveT -= dt; if (waveT <= 0) { waveT = 3.2; ctx.sfx('waves'); }
      cars.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x > 75) c.position.x = -75; if (c.position.x < -75) c.position.x = 75; });
      palms.forEach(p => { const c = p.userData.crown; c.rotation.z = Math.sin(t * 0.9 + p.userData.ph) * 0.05; c.rotation.x = Math.sin(t * 0.7 + p.userData.ph) * 0.04; });
      towers.forEach((tw, i) => { tw.userData.flag.rotation.y = Math.sin(t * 4 + i) * 0.4; });
      clouds.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x > 240) c.position.x = -240; });
      gulls.forEach(b => {
        const u = b.userData, a = t * u.sp + u.ph;
        b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.8 + u.ph) * 1.5, u.cz + Math.sin(a) * u.r);
        b.rotation.y = -a + (u.sp > 0 ? 0 : Math.PI); b.rotation.z = (u.sp > 0 ? 0.25 : -0.25);
        const f = Math.sin(t * 9 + u.ph) * 0.5; u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f;
      });
      for (const it of items) {
        const u = it.userData;
        if (u.fly) { u.fly += dt; it.position.y += dt * 2.5; it.scale.setScalar(1 + u.fly * 2); if (u.fly > 0.5) it.visible = false; continue; }
        it.position.y = u.by + Math.sin(t * 2 + u.ph) * 0.08;
        if (u.spin) u.body.rotation.y += dt * 1.5;
        u.beam.material.opacity = 0.18 + Math.sin(t * 3 + u.ph) * 0.06;
        it.scale.setScalar(hover === it ? 1.3 : 1);
        if (Math.random() < 0.05) ctx.burst(it.getWorldPosition(_v), 0xfff3a0, 1, 0.5);
      }
      if (running) {
        time -= dt; infoT += dt;
        if (infoT > 0.25) { infoT = 0; info(); }
        // flecha que señala el objeto más cercano cuando está fuera de la pantalla
        let best = null, bd = 1e9;
        for (const it of items) if (!it.userData.found) { const d = it.position.distanceToSquared(camera.position); if (d < bd) { bd = d; best = it; } }
        if (best) {
          const loc = camera.worldToLocal(best.getWorldPosition(_v)), pr = _w.copy(best.position).project(camera);
          if (loc.z < 0 && Math.abs(pr.x) < 0.9 && Math.abs(pr.y) < 0.9) arrow.classList.add('hidden');
          else {
            const a = Math.atan2(loc.y, loc.x), R = Math.min(innerWidth, innerHeight) / 2 - 50;
            arrow.classList.remove('hidden');
            arrow.style.transform = `translate(${innerWidth / 2 + Math.cos(a) * R}px,${innerHeight / 2 - Math.sin(a) * R}px) rotate(${-a}rad)`;
          }
        }
        if (time <= 0) { time = 0; running = false; info(); arrow.classList.add('hidden'); ctx.lose(`Se acabó el tiempo. Encontraste ${found} de 5 objetos. Consejo: sigue la flecha amarilla y los haces de luz.`); }
      }
    },
    dispose() { alive = false; running = false; restoreEnv(); arrow.classList.add('hidden'); }
  };
}

/* ================= MUNDO 3: MIAMI HEAT — ARENA DE BALONCESTO ================= */
const PX = 68.27; // píxeles por metro en la textura de la cancha
function courtTex() {
  return canvasTex(1024, 1912, (g, w, h) => {
    for (let x = 0; x < w; x += 7) { const c = 190 + Math.random() * 30 | 0; g.fillStyle = `rgb(${c},${c * 0.68 | 0},${c * 0.4 | 0})`; g.fillRect(x, 0, 7, h); }
    for (let x = 0; x < w; x += 7) for (let y = Math.random() * 300; y < h; y += 260 + Math.random() * 200) { g.fillStyle = 'rgba(60,30,10,.35)'; g.fillRect(x, y, 7, 2); }
    const X = m => (m + 7.5) * PX, Z = m => (m + 5.8) * PX, R = m => m * PX;
    const key = (z0, dir) => {
      g.fillStyle = '#a8102a'; g.fillRect(X(-2.45), dir > 0 ? Z(z0) : Z(z0 - 5.8), R(4.9), R(5.8));
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(X(-2.45), dir > 0 ? Z(z0) : Z(z0 - 5.8), R(4.9), R(5.8));
      const fz = z0 + dir * 5.8, bz = z0 + dir * 1.575;
      g.beginPath(); g.arc(X(0), Z(fz), R(1.8), 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(X(0), Z(bz), R(6.75), dir > 0 ? 0.33 : Math.PI + 0.33, dir > 0 ? Math.PI - 0.33 : Math.PI * 2 - 0.33); g.stroke();
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(s * 6.6), Z(z0)); g.lineTo(X(s * 6.6), Z(bz + dir * 2.1)); g.stroke(); }
      g.beginPath(); g.arc(X(0), Z(bz), R(1.25), dir > 0 ? 0 : Math.PI, dir > 0 ? Math.PI : Math.PI * 2); g.stroke();
    };
    key(-5.8, 1); key(22.2, -1);
    g.strokeStyle = '#fff'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, Z(8.2)); g.lineTo(w, Z(8.2)); g.stroke();
    g.fillStyle = '#a8102a'; g.beginPath(); g.arc(X(0), Z(8.2), R(1.8), 0, 7); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.font = 'bold 80px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MIAMI', X(0), Z(8.2));
    g.strokeStyle = '#111'; g.lineWidth = 16; g.strokeRect(8, 8, w - 16, h - 16);
  });
}
function hoop(g, z, rot) { // tablero de vidrio, aro, red y soporte (z = cara del tablero)
  const h = new THREE.Group(); h.position.set(0, 0, z); h.rotation.y = rot; g.add(h);
  const glass = temp(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0.2, depthWrite: false }));
  add(h, box(1.8, 1.05, 0.04), glass, 0, 3.425, -0.02, false);
  const blk = M(0x111111, { metalness: 0.6, roughness: 0.4 }), wht = M(0xffffff, { roughness: 0.4 });
  for (const [x, y, w, hh] of [[0, 3.94, 1.84, 0.05], [0, 2.91, 1.84, 0.05], [-0.9, 3.425, 0.05, 1.08], [0.9, 3.425, 0.05, 1.08]]) add(h, box(w, hh, 0.06), blk, x, y, -0.02);
  for (const [x, y, w, hh] of [[0, 3.495, 0.59, 0.04], [0, 3.05 + 0.15, 0.59, 0.04], [-0.295, 3.35, 0.04, 0.45], [0.295, 3.35, 0.04, 0.45]]) add(h, box(w, hh, 0.01), wht, x, y, 0.005, false);
  add(h, box(0.5, 0.6, 0.6), M(0x222222, { metalness: 0.6 }), 0, 3.4, -0.4);
  add(h, box(0.25, 0.25, 2.2), blk, 0, 3.6, -1.5);
  add(h, box(0.3, 3.8, 0.3), blk, 0, 1.9, -2.5);
  add(h, box(1.4, 1.2, 2.2), M(0xa8102a, { roughness: 0.7 }), 0, 0.6, -2.7);
  const rim = add(h, new THREE.TorusGeometry(0.2286, 0.011, 12, 48), M(0xff4a1c, { metalness: 0.6, roughness: 0.35 }), 0, 3.05, 0.3786); rim.rotation.x = Math.PI / 2;
  add(h, box(0.1, 0.04, 0.16), M(0xff4a1c, { metalness: 0.6 }), 0, 3.05, 0.08);
  // red: rombos con hilos (se anima al encestar)
  const RING = 6, PTS = 12, base = [], idx = [];
  for (let r = 0; r < RING; r++) for (let k = 0; k < PTS; k++) {
    const a = (k + (r % 2) * 0.5) / PTS * Math.PI * 2, rad = 0.2286 - r * 0.016;
    base.push(Math.cos(a) * rad, -r * 0.085, Math.sin(a) * rad);
  }
  for (let r = 0; r < RING - 1; r++) for (let k = 0; k < PTS; k++) {
    const i = r * PTS + k, n1 = (r + 1) * PTS + k, n2 = (r + 1) * PTS + (r % 2 ? (k + 1) % PTS : (k + PTS - 1) % PTS);
    idx.push(i, n1, i, n2);
  }
  const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(base.slice(), 3)); ng.setIndex(idx);
  const net = new THREE.LineSegments(ng, temp(new THREE.LineBasicMaterial({ color: 0xffffff }))); net.position.set(0, 3.05, 0.3786); h.add(net);
  return { h, net, base, RING, PTS };
}
function human(jersey, num) { // jugador articulado
  const p = new THREE.Group(), skin = M(0x7a4a2c, { roughness: 0.6 }), shirt = M(jersey, { roughness: 0.7 }), wht = M(0xf5f5f5);
  const hips = new THREE.Group(); hips.position.y = 0.98; p.add(hips);
  const legs = [-1, 1].map(s => {
    const th = new THREE.Group(); th.position.x = s * 0.11; hips.add(th);
    add(th, cap(0.075, 0.32), skin, 0, -0.22, 0);
    const kn = new THREE.Group(); kn.position.y = -0.46; th.add(kn);
    add(kn, cap(0.065, 0.32), skin, 0, -0.22, 0); add(kn, cyl(0.07, 0.07, 0.12, 10), wht, 0, -0.3, 0);
    add(kn, box(0.12, 0.09, 0.28), wht, 0, -0.48, 0.05); add(kn, box(0.125, 0.03, 0.285), M(0xa8102a), 0, -0.44, 0.05);
    return { th, kn };
  });
  add(hips, cyl(0.2, 0.22, 0.32, 14), shirt, 0, -0.1, 0);
  const torso = new THREE.Group(); hips.add(torso);
  add(torso, cap(0.19, 0.32), shirt, 0, 0.3, 0).scale.set(1.1, 1, 0.75);
  const nt = add(torso, new THREE.PlaneGeometry(0.22, 0.22), temp(new THREE.MeshStandardMaterial({ map: textTex(num, 128, 128, 'rgba(0,0,0,0)', '#fff', 'bold 80px system-ui'), transparent: true })), 0, 0.32, 0.148, false);
  add(torso, cyl(0.05, 0.06, 0.1, 10), skin, 0, 0.6, 0);
  add(torso, sph(0.115, 20), skin, 0, 0.74, 0);
  add(torso, cyl(0.118, 0.118, 0.035, 20), wht, 0, 0.78, 0);
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * 0.25, 0.5, 0); torso.add(sh);
    add(sh, cap(0.055, 0.26), skin, 0, -0.16, 0);
    const el = new THREE.Group(); el.position.y = -0.32; sh.add(el);
    add(el, cap(0.05, 0.24), skin, 0, -0.14, 0); add(el, sph(0.055, 10), skin, 0, -0.3, 0);
    return { sh, el };
  });
  return { p, hips, legs, torso, arms };
}

function heat(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const RR = 0.2286, BR = 0.12, GRAV = 9.8, BB_Z = -4.6, RIM = new V3(0, 3.05, BB_Z + 0.3786);
  g.add(sky(0x050507, 0x0b0b10, 0x050505));
  scene.fog = new THREE.Fog(0x0a0a10, 30, 80);
  lightRig(g, { sky: 0xfff4e8, ground: 0x2a1515, hemi: 0.55, sun: 0xffffff, sunI: 2.6, dir: [2, 18, 6], size: 10, target: [0, 0, -2] });
  for (const [x, z] of [[-5, -2], [5, -2], [0, 6]]) { const s = new THREE.SpotLight(0xfff3dd, 60, 40, 0.6, 0.5, 1.5); s.position.set(x, 18, z); s.target.position.set(x * 0.3, 0, z - 2); g.add(s, s.target); }
  // Cancha y piso
  const floor = add(g, new THREE.PlaneGeometry(15, 28), temp(new THREE.MeshStandardMaterial({ map: courtTex(), roughness: 0.32, metalness: 0.05 })), 0, 0.005, 8.2, false);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  const apron = add(g, new THREE.PlaneGeometry(26, 40), M(0x1a0d10, { roughness: 0.6 }), 0, 0, 8.2, false); apron.rotation.x = -Math.PI / 2; apron.receiveShadow = true;
  const H1 = hoop(g, BB_Z, 0); hoop(g, 21, Math.PI);
  // Marcador sobre el tablero y pantalla gigante
  const sbTex = canvasTex(512, 200, () => {});
  add(H1.h, box(1.1, 0.42, 0.25), M(0x111111, { metalness: 0.5 }), 0, 4.25, -0.1);
  add(H1.h, new THREE.PlaneGeometry(1.0, 0.36), temp(new THREE.MeshBasicMaterial({ map: sbTex })), 0, 4.25, 0.031, false);
  const jt = new THREE.Group(); jt.position.set(0, 12, 8.2); g.add(jt);
  add(jt, box(7, 4, 7), M(0x0c0c0c, { metalness: 0.5, roughness: 0.5 }), 0, 0, 0, false);
  for (let i = 0; i < 4; i++) { const s = add(jt, new THREE.PlaneGeometry(6.4, 3.4), temp(new THREE.MeshBasicMaterial({ map: sbTex })), Math.sin(i * Math.PI / 2) * 3.52, 0, Math.cos(i * Math.PI / 2) * 3.52, false); s.rotation.y = i * Math.PI / 2; }
  add(jt, box(7.2, 0.25, 7.2), M(0xff2a2a, { emissive: 0xff1a1a, emissiveIntensity: 2 }), 0, -2.1, 0, false);
  // Tribunas con público
  const seat = M(0x2a0a10, { roughness: 0.9 }), seat2 = M(0x111111, { roughness: 0.9 });
  const fans = [];
  const stand = (cx, cz, len, alongX, out) => { // out: dirección hacia afuera
    for (let k = 0; k < 9; k++) {
      const off = 1.6 * k, y = 0.6 + k * 0.85;
      const x = alongX ? cx : cx + out * off, z = alongX ? cz + out * off : cz;
      add(g, alongX ? box(len, 0.85, 1.6) : box(1.6, 0.85, len), k % 2 ? seat : seat2, x, y - 0.42, z, false);
      for (let s = -len / 2 + 0.4; s < len / 2; s += 0.62) if (Math.random() < 0.88) fans.push([alongX ? cx + s : x, y + 0.45, alongX ? z : cz + s]);
    }
  };
  stand(-12, 8.2, 38, false, -1); stand(12, 8.2, 38, false, 1); stand(0, -9, 24, true, -1); stand(0, 25, 24, true, 1);
  const fanG = new THREE.CapsuleGeometry(0.2, 0.45, 2, 6), headG = new THREE.SphereGeometry(0.12, 8, 6);
  const shirtsI = new THREE.InstancedMesh(fanG, temp(new THREE.MeshStandardMaterial({ roughness: 0.9 })), fans.length);
  const headsI = new THREE.InstancedMesh(headG, temp(new THREE.MeshStandardMaterial({ roughness: 0.8 })), fans.length);
  const SH = [0xc8102e, 0xc8102e, 0xc8102e, 0x111111, 0x111111, 0xffffff, 0xf9a01b, 0x3355aa], SK = [0x5a3420, 0x8d5a3b, 0xc68863, 0xe0b48c, 0xf1c9a5];
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), ph = new Float32Array(fans.length);
  fans.forEach((f, i) => {
    m4.makeTranslation(f[0], f[1], f[2]); shirtsI.setMatrixAt(i, m4);
    m4.makeTranslation(f[0], f[1] + 0.48, f[2]); headsI.setMatrixAt(i, m4);
    shirtsI.setColorAt(i, col.set(SH[i % 8 + (Math.random() * 3 | 0)] || 0xc8102e)); headsI.setColorAt(i, col.set(SK[Math.random() * 5 | 0]));
    ph[i] = Math.random() * 6.28;
  });
  g.add(shirtsI, headsI);
  // Techo, luces y pancartas
  add(g, box(60, 1, 70), M(0x0a0a0d), 0, 24, 8, false);
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 3; j++) { add(g, box(3, 0.2, 1), M(0xffffff, { emissive: 0xfff6e0, emissiveIntensity: 3 }), i * 8, 22.5, j * 8, false); const l = glow(0xfff2d0, 5, 0.45); l.position.set(i * 8, 22, j * 8); g.add(l); }
  [['MIAMI', '#c8102e'], ['FLORIDA', '#111111'], ['AR 2026', '#c8102e'], ['FERIA', '#111111']].forEach(([t, bg], i) => {
    const b = add(g, new THREE.PlaneGeometry(1.8, 3.6), temp(new THREE.MeshStandardMaterial({ map: canvasTex(128, 256, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = '#f9a01b'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.save(); c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2); c.fillStyle = '#fff'; c.font = 'bold 44px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 0, 0); c.restore(); }), side: THREE.DoubleSide })), -4.5 + i * 3, 15, -12, false);
    b.userData.ph = i; b.name = 'banner';
  });
  // Compañero de equipo con uniforme rojo y negro (sin logotipos oficiales)
  const P = human(0xc8102e, 'FL'); P.p.position.set(2.6, 0, -2.4); P.p.rotation.y = Math.atan2(-2.6, 2.4); g.add(P.p);
  const ball2 = add(g, sph(BR, 24), ballMat());
  // Balón del jugador
  const ball = add(g, sph(BR, 32), ballMat());
  const st = { mode: 'rest', v: new V3(), t: 0, scored: false, fb: '', inNet: 0, lastBounce: 0 };
  let running = false, alive = true, baskets = 0, pts = 0, shots = 0, cel = 0, netK = 0, netW = 0;
  const _d = new V3(), _q = new V3(), _n = new V3();
  const info = () => ctx.info(`🏀 Canastas ${baskets}/3 · Puntos ${pts} · Tiros ${shots}`);
  function drawBoard() {
    const c = sbTex.userData.g, w = 512, h = 200;
    c.fillStyle = '#050505'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8102e'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.textAlign = 'center'; c.fillStyle = '#ff3344'; c.font = 'bold 34px monospace'; c.fillText('PUNTOS    CANASTAS', w / 2, 50);
    c.font = 'bold 100px monospace'; c.fillStyle = '#ffd54a'; c.fillText(String(pts).padStart(2, '0'), 140, 160); c.fillText(`${baskets}/3`, 370, 160);
    sbTex.needsUpdate = true;
  }
  drawBoard();
  const restPos = () => camera.localToWorld(_v.set(0, -0.42, -0.9));
  const holdPos = () => ctx.ptr.ray.ray.at(0.75, _v);
  ball.position.copy(restPos());

  function shoot(vel) {
    st.mode = 'fly'; st.t = 0; st.scored = false; st.inNet = 0; shots++; info(); ctx.sfx('throw');
    const pw = clamp(1 + Math.log(Math.max(vel.y, 0.1) / 2.8) * 0.6, 0.5, 1.6), lat = clamp(vel.x / Math.max(vel.y, 0.1), -1, 1);
    st.fb = pw > 1.15 ? 'Un poco más suave 👇' : pw < 0.85 ? '¡Más fuerte! 💪' : Math.abs(lat) > 0.16 ? 'Lanza más recto ⬆️' : '¡Casi!';
    // la dirección se calcula respecto a hacia dónde miras
    const fwd = _u.set(0, 0, -1).applyQuaternion(camera.quaternion); fwd.y = 0; fwd.normalize();
    const right = new V3(-fwd.z, 0, fwd.x);
    const tgt = RIM.clone().addScaledVector(right, lat * 0.55).add(_w.set(0, 0.03, 0.03 - (pw - 1) * 0.5));
    const T = 1.0;
    st.v.copy(tgt).sub(ball.position).divideScalar(T); st.v.y += 0.5 * GRAV * T;
  }
  function score() {
    st.scored = true; st.inNet = 0.5; baskets++; pts += 2; cel = 2; netK = 1; info(); drawBoard();
    ctx.sfx('swish'); setTimeout(() => { ctx.sfx('crowd'); ctx.sfx('score'); }, 120);
    ctx.burst(RIM, [0xff2a2a, 0xffffff, 0xf9a01b], 80, 2.5);
    if (baskets >= 3) { running = false; setTimeout(() => ctx.win('heat'), 1300); }
  }
  const intro = withIntro(ctx, opt, [
    { t: 0, p: [6, 9, 18], yaw: 0.35, pitch: -0.3 },
    { t: 2.8, p: [1.5, 3.5, 5], yaw: 0.1, pitch: -0.05 },
    { t: 4.3, p: [0, 1.6, 0], yaw: 0, pitch: 0.18 }
  ], 0, 0.15);
  const startHint = () => alive && ctx.hint(ctx.isHand() ? '☝️ El balón sigue tu índice · sube el dedo rápido hacia la canasta para lanzar' : '👆 Pon el dedo y desliza rápido hacia la canasta');
  return {
    camLock: !opt.quick, refreshHint: startHint,
    start() { running = true; this.camLock = false; info(); startHint(); },
    onDown() { if (intro.on) { intro.finish(); this.camLock = false; return; } if (running && st.mode === 'rest') st.mode = 'hold'; },
    onMove(p) {
      if (!running) return;
      if (p.src === 'hand') {
        if (st.mode === 'rest') st.mode = 'hold';
        if (st.mode === 'hold') { const v = p.vel(120); if (v.y > 2.4) shoot(v); }
      }
    },
    onUp(p) { if (st.mode !== 'hold' || p.src === 'hand') return; const v = p.vel(110); if (v.y > 0.9) shoot(v); else st.mode = 'rest'; },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      // público
      const sa = shirtsI.instanceMatrix.array, ha = headsI.instanceMatrix.array, amp = cel > 0 ? 0.3 : 0.025, sp = cel > 0 ? 11 : 2;
      for (let i = 0; i < fans.length; i++) { const y = fans[i][1] + Math.max(0, Math.sin(t * sp + ph[i])) * amp; sa[i * 16 + 13] = y; ha[i * 16 + 13] = y + 0.48; }
      shirtsI.instanceMatrix.needsUpdate = true; headsI.instanceMatrix.needsUpdate = true;
      g.children.forEach(o => { if (o.name === 'banner') o.rotation.y = Math.sin(t * 0.8 + o.userData.ph) * 0.06; });
      // compañero: dribla y celebra
      const dr = Math.abs(Math.sin(t * 3.2));
      if (cel > 0) {
        cel -= dt; P.p.position.y = Math.abs(Math.sin(cel * 7)) * 0.45;
        P.arms.forEach(a => { a.sh.rotation.x = -2.9; a.el.rotation.x = 0; });
        ball2.position.lerp(P.p.localToWorld(_v.set(0.4, 0.12, 0.3)), 0.2);
      } else {
        P.p.position.y = 0; P.hips.position.y = 0.98 - dr * 0.04;
        P.legs.forEach((l, i) => { l.th.rotation.x = -0.25 - dr * 0.1; l.kn.rotation.x = 0.4 + dr * 0.15; });
        P.arms[0].sh.rotation.x = -0.3; P.arms[0].el.rotation.x = -0.6;
        P.arms[1].sh.rotation.x = -0.5 - dr * 0.3; P.arms[1].el.rotation.x = -0.4;
        ball2.position.copy(P.p.localToWorld(_v.set(0.32, BR + (1 - dr) * 0.72, 0.35)));
      }
      // red
      netK = Math.max(0, netK - dt * 1.6); netW += dt * 18;
      const pa = H1.net.geometry.attributes.position.array, b = H1.base;
      for (let i = 0; i < pa.length; i += 3) {
        const r = Math.floor(i / 3 / H1.PTS) / (H1.RING - 1);
        const k = netK * r, sq = 1 - k * 0.35 * Math.sin(netW - r * 3);
        pa[i] = b[i] * sq; pa[i + 2] = b[i + 2] * sq; pa[i + 1] = b[i + 1] * (1 + k * 0.5 * Math.sin(netW * 0.7 - r * 2));
      }
      H1.net.geometry.attributes.position.needsUpdate = true;
      // balón
      ball.visible = !intro.on;
      if (st.mode === 'rest') { ball.position.lerp(restPos(), 0.3); ball.rotation.y += dt; return; }
      if (st.mode === 'hold') { if (ctx.isHand() && !ctx.handVisible()) { st.mode = 'rest'; return; } ball.position.lerp(holdPos(), 0.55); return; }
      const sub = 4, h = dt / sub, Pp = ball.position, front = BB_Z + 0.02;
      for (let i = 0; i < sub; i++) {
        const prevY = Pp.y;
        st.v.y -= GRAV * h; Pp.addScaledVector(st.v, h);
        if (st.v.z < 0 && Pp.z - BR < front && Pp.z > BB_Z - 0.2 && Math.abs(Pp.x) < 0.9 && Pp.y > 2.9 && Pp.y < 3.95) { Pp.z = front + BR; st.v.z *= -0.6; st.v.x *= 0.85; ctx.sfx('rim'); }
        _d.set(Pp.x - RIM.x, 0, Pp.z - RIM.z); const L = _d.length() || 1e-4;
        _q.copy(RIM).addScaledVector(_d, RR / L); _n.copy(Pp).sub(_q); const dist = _n.length();
        if (dist < BR + 0.011) {
          _n.divideScalar(dist || 1); Pp.copy(_q).addScaledVector(_n, BR + 0.012);
          const vn = st.v.dot(_n); if (vn < 0) { st.v.addScaledVector(_n, -1.55 * vn).multiplyScalar(0.82); if (vn < -0.5) { ctx.sfx('rim'); netK = Math.max(netK, 0.3); } }
        }
        if (!st.scored && st.v.y < 0 && prevY >= RIM.y && Pp.y < RIM.y && L < RR - BR * 0.3) score();
        if (st.inNet > 0) { st.inNet -= h; st.v.x *= 0.9; st.v.z *= 0.9; st.v.y = Math.max(st.v.y, -2.5); Pp.x = lerp(Pp.x, RIM.x, 0.1); Pp.z = lerp(Pp.z, RIM.z, 0.1); }
        if (Pp.y < BR) { Pp.y = BR; if (st.v.y < -1 && st.t - st.lastBounce > 0.15) { ctx.sfx('bounce'); st.lastBounce = st.t; } st.v.y *= -0.72; st.v.x *= 0.85; st.v.z *= 0.85; }
      }
      ball.rotation.x -= dt * 8;
      st.t += dt;
      if (st.t > 2.8) {
        st.mode = 'rest';
        if (!st.scored && running) { ctx.hint(st.fb); setTimeout(() => { if (running) startHint(); }, 1800); }
      }
    },
    dispose() { alive = false; running = false; }
  };
}

/* ================= Catálogo de destinos ================= */
export const GAMES = {
  orlando: {
    short: 'Orlando', title: '🏰 Orlando — Duelo mágico', winMsg: '¡Has conquistado Orlando!', create: orlando,
    how: h => h
      ? 'Tu varita sigue tu <b>dedo índice</b>. Apunta al mago y mantén el dedo sobre él: el hechizo se lanza solo. Muestra la <b>palma abierta ✋</b> para activar 🛡️ Protego cuando veas el brillo verde. Cambia de hechizo dejando el dedo quieto sobre los botones. <b>Acierta 3 ataques.</b>'
      : 'Toca al mago para lanzarle el hechizo (o usa ✨ Lanzar). 🔴 Expelliarmus lo desarma y ⚡ Stupefy lo aturde. Cuando veas el brillo verde, elige 🛡️ Protego y lánzalo. Gira el celular o arrastra para mirar el parque. <b>Acierta 3 ataques.</b>',
    fact: 'The Wizarding World of Harry Potter abrió su zona de Hogsmeade en Islands of Adventure en 2010 y Diagon Alley en Universal Studios Florida en 2014. El tren Hogwarts Express conecta ambos parques.'
  },
  miami: {
    short: 'Miami', title: '🌴 Miami — Vice City Adventure', winMsg: '¡Has explorado Miami!', create: miami,
    how: h => 'Estás en la playa de Miami. <b>Gira el celular</b> (o arrastra el dedo) para mirar a tu alrededor: el mar, la arena, los edificios y la calle detrás de ti. Encuentra los 5 objetos en <b>60 segundos</b>: 🔑 🕶️ 🏄 📷 🪙. Busca los haces de luz y sigue la flecha amarilla. ' + (h ? 'Deja tu <b>índice</b> quieto sobre cada objeto para recogerlo.' : '<b>Toca</b> cada objeto para recogerlo.'),
    fact: 'Miami Beach tiene una de las mayores concentraciones de arquitectura Art Déco del mundo. Su distrito histórico entró al Registro Nacional de Lugares Históricos de EE. UU. en 1979 y reúne cientos de edificios de las décadas de 1920 a 1940.'
  },
  heat: {
    short: 'Miami Heat', title: '🏀 Miami Heat — Basketball AR', winMsg: '¡Eres una estrella del Miami Heat!', create: heat,
    how: h => (h
      ? 'Estás en la línea de tiro libre. El balón sigue tu <b>dedo índice</b>: súbelo rápido hacia la canasta para lanzar.'
      : 'Estás en la línea de tiro libre. Pon el dedo en la pantalla y <b>desliza hacia arriba</b>, hacia la canasta. La velocidad del deslizamiento es la fuerza y la inclinación es la dirección.') + ' Gira el celular para ver la arena. <b>Encesta 3 balones.</b>',
    fact: 'El Miami Heat entró a la NBA en 1988 como equipo de expansión y ha ganado tres campeonatos: 2006, 2012 y 2013.'
  }
};
