// FLORIDA AR ADVENTURE — contenido 3D: cofre, portales y los tres minijuegos.
import * as THREE from 'three';
const V3 = THREE.Vector3;
const clamp = THREE.MathUtils.clamp;

/* ================= Utilidades compartidas ================= */
const mats = {};
const M = (c, o = {}) => { const k = 'l' + c + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshLambertMaterial({ color: c, ...o })); };
const B = (c, o = {}) => { const k = 'b' + c + JSON.stringify(o); return mats[k] || (mats[k] = new THREE.MeshBasicMaterial({ color: c, ...o })); };
const temp = m => { m.userData.temp = true; return m; };
function add(parent, geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 12) => new THREE.CylinderGeometry(rt, rb, h, s);
const sph = (r, s = 12) => new THREE.SphereGeometry(r, s, Math.max(6, (s * 0.75) | 0));
const cone = (r, h, s = 12) => new THREE.ConeGeometry(r, h, s);
const keep = g => { g.userData.keep = true; return g; };
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeBack = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const _v = new V3(), _w = new V3();

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.userData.g = g;
  return t;
}
let _glow;
const glowTex = () => _glow || (_glow = canvasTex(64, 64, g => {
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
}), _glow.userData.keep = true, _glow);
function glow(color, size, opacity = 1) {
  const s = new THREE.Sprite(temp(new THREE.SpriteMaterial({ map: glowTex(), color, opacity, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  s.scale.setScalar(size); return s;
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
    const m = n.material;
    if (m && m.userData.temp) { if (m.map && !m.map.userData.keep) m.map.dispose(); m.dispose(); }
  });
}

/* Partículas: un solo sistema reutilizable (pocas llamadas de dibujo) */
export class Sparks {
  constructor(n = 450) {
    this.n = n; this.i = 0; this.col = new THREE.Color();
    this.p = new Float32Array(n * 3).fill(9999); this.c = new Float32Array(n * 3); this.base = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3); this.l = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.07, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.points.frustumCulled = false;
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
    starGeo = keep(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }));
    starGeo.center();
  }
  const g = new THREE.Group();
  g.add(new THREE.Mesh(starGeo, M(0xffc933, { emissive: 0x8a5a00 })));
  g.add(glow(0xffd24a, 0.9, 0.7));
  return g;
}

let _ballMat;
const ballMat = () => _ballMat || (_ballMat = new THREE.MeshLambertMaterial({
  map: (() => {
    const t = canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#e8711c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#2a1206'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.moveTo(w / 4, 0); g.lineTo(w / 4, h); g.moveTo(w * 3 / 4, 0); g.lineTo(w * 3 / 4, h); g.stroke();
      g.beginPath(); g.ellipse(w / 2, h / 2, w / 8, h / 2, 0, 0, 7); g.stroke();
    });
    t.userData.keep = true; return t;
  })()
}));

function palm(par, x, z, s = 1) {
  const p = new THREE.Group(); p.position.set(x, 0, z); p.scale.setScalar(s); par.add(p);
  let y = 0, ox = 0;
  for (let i = 0; i < 5; i++) {
    const seg = add(p, cyl(0.022 - i * 0.002, 0.026 - i * 0.002, 0.1, 6), M(0x9b6b3d), ox, y + 0.05, 0);
    seg.rotation.z = -0.08 * i; ox += 0.012 * i; y += 0.095;
  }
  const top = new THREE.Group(); top.position.set(ox, y, 0); p.add(top);
  for (let i = 0; i < 6; i++) {
    const lg = new THREE.Group(); lg.rotation.y = i / 6 * Math.PI * 2; top.add(lg);
    const l = add(lg, cone(0.045, 0.3, 4), M(0x2fbf4a), 0.14, -0.04, 0);
    l.rotation.z = -Math.PI / 2 - 0.35; l.scale.set(0.3, 1, 1);
  }
  add(top, sph(0.022, 6), M(0x5a3a1a), 0.03, -0.03, 0.02); add(top, sph(0.022, 6), M(0x5a3a1a), -0.02, -0.03, -0.02);
  return p;
}

/* ================= INICIO: cofre mágico + portales ================= */
const ICONS = {
  orlando() {
    const i = new THREE.Group(), st = M(0xd4cfe0), rf = M(0x5b2ca0);
    add(i, cyl(0.07, 0.08, 0.24), st, 0, -0.04, 0); add(i, cone(0.1, 0.16), rf, 0, 0.16, 0);
    for (const x of [-0.12, 0.12]) { add(i, cyl(0.045, 0.05, 0.16), st, x, -0.08, 0); add(i, cone(0.065, 0.11), rf, x, 0.055, 0); }
    return i;
  },
  miami() { const i = new THREE.Group(); const p = palm(i, 0, 0, 0.55); p.position.y = -0.15; i.add(glow(0xffd54a, 0.25)); return i; },
  heat() {
    const i = new THREE.Group();
    add(i, sph(0.11, 16), ballMat());
    const f = add(i, cone(0.06, 0.16, 8), M(0xff3b1f, { emissive: 0xaa1100 }), 0.09, 0.1, 0); f.rotation.z = -0.5;
    return i;
  }
};
function swirlTex(col) {
  const c = new THREE.Color(col), rgb = `${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0}`;
  return canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, `rgba(${rgb},.9)`); r.addColorStop(1, 'rgba(10,0,40,.9)');
    g.fillStyle = r; g.beginPath(); g.arc(64, 64, 64, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    for (let k = 0; k < 3; k++) { g.beginPath(); for (let a = 0; a < 9; a += 0.2) { const rr = a * 6, x = 64 + Math.cos(a + k * 2.1) * rr, y = 64 + Math.sin(a + k * 2.1) * rr; a ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  });
}
function woodTex() {
  return canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#7a4a22'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) { g.fillStyle = '#4e2c10'; g.fillRect(0, y, w, 3); }
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60 | 0},${20 + Math.random() * 30 | 0},5,.3)`; g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 1.5); }
  });
}

export function createHub(ctx, opt = {}) {
  const g = new THREE.Group(); ctx.root.add(g);
  const ring = add(g, new THREE.RingGeometry(0.72, 0.8, 48), temp(new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.6, side: THREE.DoubleSide })));
  ring.rotation.x = -Math.PI / 2;
  const disc = add(g, new THREE.CircleGeometry(0.72, 48), temp(new THREE.MeshBasicMaterial({ color: 0x5a3ab0, transparent: true, opacity: 0.25 })));
  disc.rotation.x = -Math.PI / 2; disc.position.y = -0.004;

  // Cofre
  const chest = new THREE.Group(); chest.position.set(0, 0.45, 0); g.add(chest);
  const wood = temp(new THREE.MeshLambertMaterial({ map: woodTex() })), gold = M(0xffc940, { emissive: 0x6b4500 });
  add(chest, box(1, 0.5, 0.62), wood);
  for (const x of [-0.5, 0.5]) for (const z of [-0.31, 0.31]) add(chest, box(0.06, 0.52, 0.06), gold, x, 0, z);
  add(chest, box(1.04, 0.06, 0.66), gold, 0, -0.24, 0);
  add(chest, box(1.04, 0.05, 0.66), gold, 0, 0.23, 0);
  for (const x of [-0.25, 0.25]) add(chest, box(0.06, 0.5, 0.64), gold, x, 0, 0);
  add(chest, box(0.16, 0.2, 0.04), gold, 0, 0.12, 0.33);
  add(chest, box(0.03, 0.07, 0.01), M(0x221100), 0, 0.11, 0.355);
  const lid = new THREE.Group(); lid.position.set(0, 0.25, -0.31); chest.add(lid);
  const lm = add(lid, new THREE.CylinderGeometry(0.31, 0.31, 1, 16, 1, false, 0, Math.PI), wood, 0, 0, 0.31); lm.rotation.z = Math.PI / 2;
  for (const x of [-0.5, -0.25, 0.25, 0.5]) { const b = add(lid, new THREE.CylinderGeometry(0.325, 0.325, 0.06, 16, 1, true, 0, Math.PI), gold, x, 0, 0.31); b.rotation.z = Math.PI / 2; }
  const aura = glow(0xffd36b, 1.8, 0.45); aura.position.set(0, 0.1, -0.1); chest.add(aura);
  const inner = glow(0xfff0a0, 0.1, 0.95); inner.position.set(0, 0.3, 0); chest.add(inner);

  // Portales
  const DEST = [['orlando', -0.88, 1.28, 0x9b5cff], ['miami', 0, 1.6, 0xff4fa3], ['heat', 0.88, 1.28, 0xff3b30]];
  const portals = DEST.map(([key, x, y, col]) => {
    const p = new THREE.Group(); p.userData = { key, x, y, t: 0 }; p.visible = false; g.add(p);
    p.add(glow(col, 1.2, 0.5));
    add(p, new THREE.TorusGeometry(0.32, 0.035, 8, 32), M(col, { emissive: col }));
    p.userData.swirl = add(p, new THREE.CircleGeometry(0.3, 32), temp(new THREE.MeshBasicMaterial({ map: swirlTex(col), transparent: true, opacity: 0.92 })));
    const icon = ICONS[key](); icon.position.z = 0.14; p.add(icon); p.userData.icon = icon;
    const lb = label(GAMES[key].short, 0.13); lb.position.y = -0.47; p.add(lb);
    if (ctx.stars[key]) { const s = starMesh(); s.scale.setScalar(0.45); s.position.set(0.3, 0.3, 0.06); p.add(s); }
    return p;
  });

  let opened = !!opt.opened, openT = opened ? 1 : 0, hover = null, leaving = null, leaveT = 0, spark = 0;
  if (opened) portals.forEach(p => { p.visible = true; p.userData.t = 1; });
  const refreshHint = () => ctx.hint(opened
    ? (ctx.isHand() ? 'Señala un portal y haz pinza ✋ para viajar' : 'Toca un portal para viajar a ese destino')
    : (ctx.isHand() ? 'Señala el cofre mágico y haz pinza ✋ para abrirlo' : 'Toca el cofre mágico para abrirlo'));
  refreshHint();

  function pick(p) {
    const list = opened ? portals.filter(o => o.visible) : [chest];
    const h = p.ray.intersectObjects(list, true); if (!h.length) return null;
    let o = h[0].object; while (o && o !== chest && !o.userData.key) o = o.parent;
    return o;
  }
  return {
    refreshHint,
    onDown(p) {
      const o = pick(p); if (!o || leaving) return;
      if (o === chest && !opened) {
        opened = true; ctx.sfx('chest');
        ctx.burst(chest.localToWorld(_v.set(0, 0.3, 0)), [0xffd700, 0xfff3b0, 0xff9d00], 90, 2);
        setTimeout(() => { portals.forEach(q => (q.visible = true)); ctx.sfx('portal'); refreshHint(); }, 650);
      } else if (o.userData.key) {
        leaving = o; ctx.sfx('portal');
        ctx.burst(o.getWorldPosition(_v), [0xffffff, 0xffd700], 50, 1.6);
        setTimeout(() => ctx.enter(o.userData.key), 500);
      }
    },
    onMove(p) { hover = pick(p); },
    update(dt, t) {
      if (opened) openT = Math.min(1, openT + dt * 1.3);
      lid.rotation.x = -1.95 * easeBack(openT);
      const k = easeOut(openT);
      chest.position.y = 0.45 - 0.2 * k + Math.sin(t * 1.6) * 0.035;
      chest.scale.setScalar(1 - 0.3 * k);
      chest.rotation.y = Math.sin(t * 0.7) * 0.15 * (1 - k);
      aura.material.opacity = 0.35 + Math.sin(t * 3) * 0.12;
      inner.scale.setScalar(0.1 + k * 1.1);
      ring.material.opacity = 0.45 + Math.sin(t * 2) * 0.2;
      ring.scale.setScalar(1 - 0.25 * k);
      spark += dt;
      if (spark > 0.12) { spark = 0; ctx.burst(chest.localToWorld(_v.set((Math.random() - 0.5), 0.3, (Math.random() - 0.5) * 0.6)), opened ? 0xfff0a0 : 0xffc940, 1, 0.4); }
      for (const p of portals) {
        if (!p.visible) continue;
        const u = p.userData; u.t = Math.min(1, u.t + dt * 1.4);
        const e = easeBack(u.t);
        p.position.set(u.x * e, 0.4 + (u.y - 0.4) * e + Math.sin(t * 1.5 + u.x * 3) * 0.04, 0);
        let s = e * (hover === p ? 1.15 : 1);
        if (leaving === p) { leaveT += dt; s *= 1 + leaveT * 3; }
        p.scale.setScalar(Math.max(0.001, s));
        u.swirl.rotation.z -= dt * 2; u.icon.rotation.y += dt * 1.2;
      }
    },
    dispose() {}
  };
}

/* ================= MINIJUEGO 1: ORLANDO — DUELO MÁGICO ================= */
function orlando(ctx) {
  const { camera } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const stone = M(0xb3aec2), dark = M(0x585468), roof = M(0x4b2a8a), lit = M(0xffd27a, { emissive: 0xffa531 });
  add(g, cyl(1.35, 1.45, 0.16, 32), dark, 0, -0.08, 0);
  add(g, cyl(1.22, 1.22, 0.02, 32), M(0x8c8698), 0, 0.005, 0);
  // Castillo (inspiración medieval mágica, no es una réplica)
  const c = new THREE.Group(); c.position.set(0, 0, -1.05); g.add(c);
  add(c, box(1.1, 0.55, 0.3), stone, 0, 0.275, 0);
  for (let i = 0; i < 7; i++) add(c, box(0.09, 0.08, 0.32), stone, -0.48 + i * 0.16, 0.59, 0);
  const tower = (x, z, r, h, rh) => { add(c, cyl(r, r * 1.08, h), stone, x, h / 2, z); add(c, cone(r * 1.35, rh), roof, x, h + rh / 2, z); add(c, box(0.04, 0.07, 0.02), lit, x, h * 0.72, z + r); };
  tower(-0.62, 0, 0.15, 0.95, 0.38); tower(0.62, 0, 0.15, 0.95, 0.38);
  tower(-0.26, -0.15, 0.12, 1.25, 0.34); tower(0.26, -0.15, 0.12, 1.15, 0.32); tower(0, -0.06, 0.17, 1.5, 0.5);
  for (const x of [-0.36, -0.13, 0.13, 0.36]) add(c, box(0.06, 0.1, 0.02), lit, x, 0.32, 0.16);
  add(c, box(0.22, 0.3, 0.02), M(0x3a2414), 0, 0.15, 0.16);
  // Antorchas y niebla
  const flames = [];
  for (const [x, z] of [[-1.0, -0.45], [1.0, -0.45], [-1.05, 0.45], [1.05, 0.45]]) {
    add(g, cyl(0.02, 0.025, 0.4, 6), M(0x3a2a1a), x, 0.2, z);
    add(g, cyl(0.05, 0.03, 0.06, 8), dark, x, 0.42, z);
    const f = glow(0xff8a2a, 0.32); f.position.set(x, 0.5, z); g.add(f); flames.push(f);
  }
  const fogs = [0, 1, 2].map(i => { const f = glow(0xcfd6ff, 1.7, 0.16); f.position.set(-0.8 + i * 0.8, 0.15, -0.2 + i * 0.2); g.add(f); return f; });

  // Mago enemigo
  const en = new THREE.Group(); en.position.set(0, 0, -0.35); g.add(en);
  const robe = temp(new THREE.MeshLambertMaterial({ color: 0x3d1f63, emissive: 0x000000 }));
  add(en, cone(0.17, 0.6), robe, 0, 0.3, 0);
  add(en, sph(0.085), M(0xe0b48c), 0, 0.66, 0);
  add(en, cone(0.11, 0.26), M(0x231238), 0, 0.84, 0);
  add(en, cyl(0.14, 0.14, 0.015, 16), M(0x231238), 0, 0.72, 0);
  const eWand = new THREE.Group(); eWand.position.set(0.15, 0.45, 0.08); eWand.rotation.x = 0.9; en.add(eWand);
  add(eWand, cyl(0.008, 0.012, 0.26, 6), M(0x2a1a0a), 0, 0.13, 0);
  const eTip = glow(0x66ff88, 0.12); eTip.position.y = 0.27; eWand.add(eTip);
  const bar = new THREE.Group(); bar.position.y = 1.08; en.add(bar);
  add(bar, new THREE.PlaneGeometry(0.52, 0.08), B(0x111111));
  const segs = [0, 1, 2].map(i => add(bar, new THREE.PlaneGeometry(0.15, 0.05), B(0xff3344), -0.16 + i * 0.16, 0, 0.002));

  // Varita del jugador y escudo (pegados a la cámara)
  const COL = { expelliarmus: 0xff3030, stupefy: 0xbfe6ff, protego: 0x66ccff };
  const wand = new THREE.Group(); camera.add(wand);
  const wg = cyl(0.009, 0.015, 0.32, 6); wg.rotateX(Math.PI / 2); wg.translate(0, 0, 0.16);
  add(wand, wg, M(0x5a3a1c));
  const tip = glow(COL.expelliarmus, 0.1); tip.position.z = 0.33; wand.add(tip);
  const shield = new THREE.Group(); shield.position.set(0, -0.02, -0.55); shield.visible = false; camera.add(shield);
  const shM = temp(new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  add(shield, new THREE.CircleGeometry(0.3, 32), shM);
  add(shield, new THREE.TorusGeometry(0.3, 0.01, 6, 40), B(0xaee8ff));

  // UI de hechizos
  const ui = document.getElementById('spells'), btns = [...ui.querySelectorAll('.sp')];
  let spell = 'expelliarmus';
  btns.forEach(b => {
    b.classList.toggle('on', b.dataset.s === spell);
    b.onclick = () => { spell = b.dataset.s; btns.forEach(x => x.classList.toggle('on', x === b)); tip.material.color.set(COL[spell]); ctx.sfx('click'); };
  });
  document.getElementById('bCast').onclick = () => cast();
  ui.classList.remove('hidden');
  document.getElementById('crosshair').classList.remove('hidden');

  let alive = true, running = false, hits = 0, hp = 4, cd = 0, shieldT = 0, shieldCd = 0, stun = 0, disarm = 0, fireT = 2.6, dead = 0, et = 0, won = false;
  const shots = [], foes = [];
  const camW = () => camera.getWorldPosition(_w);
  const enCenter = new V3();
  const info = () => ctx.info(`${'❤️'.repeat(hp)}${'🖤'.repeat(4 - hp)} · Aciertos ${hits}/3`);
  ctx.hint('');

  function aimPoint() { // punto del rayo a la distancia del enemigo
    const e = en.localToWorld(_v.set(0, 0.45, 0)), d = e.distanceTo(camW());
    return ctx.ptr.ray.ray.at(d, new V3());
  }
  function cast() {
    if (!running || cd > 0) return;
    if (spell === 'protego') {
      if (shieldCd > 0) return;
      shieldT = 1.6; shieldCd = 3; ctx.sfx('block'); return;
    }
    cd = 0.45; ctx.sfx('spell');
    const from = g.worldToLocal(tip.getWorldPosition(new V3())), to = g.worldToLocal(aimPoint());
    enCenter.copy(en.position).setY(0.45);
    const assist = Math.abs(to.x - enCenter.x) < 0.4 && Math.abs(to.y - enCenter.y) < 0.5;
    if (assist) to.copy(enCenter);
    const m = add(g, sph(0.045, 8), B(COL[spell]), from.x, from.y, from.z); m.add(glow(COL[spell], 0.4));
    shots.push({ m, v: to.sub(from).normalize().multiplyScalar(5), kind: spell, life: 1.6, assist });
    ctx.burst(tip.getWorldPosition(_v), COL[spell], 8, 0.6);
  }
  function enemyHit(kind) {
    hits++; segs[3 - hits].visible = false; ctx.sfx('hit'); info();
    ctx.burst(en.localToWorld(_v.set(0, 0.45, 0)), [COL[kind], 0xffffff], 40, 1.4);
    robe.emissive.set(kind === 'stupefy' ? 0x2266aa : 0x661111);
    if (kind === 'stupefy') stun = 2.5;
    else { disarm = 1.8; eWand.visible = false; }
    if (hits >= 3) { running = false; dead = 0.001; }
  }
  function remove(list, i) { const o = list[i]; g.remove(o.m); disposeTree(o.m); list.splice(i, 1); }

  return {
    start() { running = true; info(); ctx.hint(ctx.isHand() ? 'Pinza ✋ = lanzar hechizo' : 'Toca al mago o pulsa ✨ Lanzar'); setTimeout(() => { if (alive) ctx.hint(''); }, 3500); },
    onDown() { cast(); },
    update(dt, t) {
      cd = Math.max(0, cd - dt); shieldCd = Math.max(0, shieldCd - dt); shieldT = Math.max(0, shieldT - dt);
      btns[2].classList.toggle('cool', shieldCd > 0 && shieldT <= 0);
      shield.visible = shieldT > 0; shield.scale.setScalar(0.9 + Math.sin(t * 20) * 0.03);
      // varita sigue el puntero (dedo índice o toque)
      const n = ctx.ptr.ndc, hh = 0.45 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
      wand.position.set((n.x * 0.5 + 0.35) * hw, (n.y * 0.4 - 0.55) * hh, -0.45);
      wand.lookAt(aimPoint());
      flames.forEach((f, i) => f.scale.setScalar(0.28 + Math.sin(t * 13 + i * 2) * 0.05));
      fogs.forEach((f, i) => { f.position.x = Math.sin(t * 0.2 + i * 2) * 0.9; });
      // enemigo
      const cw = camW();
      if (dead) {
        dead += dt; en.scale.setScalar(Math.max(0.01, 1 - dead * 1.4)); en.rotation.y += dt * 12;
        if (Math.random() < 0.6) ctx.burst(en.localToWorld(_v.set(0, 0.4, 0)), [0x9b5cff, 0xffd700], 3, 1);
        if (dead > 0.75 && !won) { won = true; en.visible = false; ctx.win('orlando'); }
      } else {
        stun = Math.max(0, stun - dt); disarm = Math.max(0, disarm - dt);
        if (!disarm) eWand.visible = true;
        if (!stun && !disarm) robe.emissive.set(0x000000);
        if (!stun) { et += dt; en.position.x = Math.sin(et * 0.9) * 0.55; }
        en.lookAt(cw.x, en.getWorldPosition(_v).y, cw.z);
        en.rotation.z = stun ? Math.sin(t * 9) * 0.15 : 0;
        bar.lookAt(cw);
        // ataque del enemigo: patrón simple con aviso previo
        if (running && !stun && !disarm) {
          fireT -= dt;
          eTip.scale.setScalar(fireT < 0.7 ? 0.12 + (0.7 - fireT) * 0.5 : 0.12);
          if (fireT <= 0) {
            fireT = 2.2 + Math.random() * 0.8;
            const from = g.worldToLocal(eTip.getWorldPosition(new V3())), to = g.worldToLocal(cw.clone().add(_v.set(0, -0.08, 0)));
            const m = add(g, sph(0.06, 8), B(0x66ff88), from.x, from.y, from.z); m.add(glow(0x66ff88, 0.5));
            foes.push({ m, v: to.sub(from).normalize().multiplyScalar(2.3) });
          }
        }
      }
      // hechizos del jugador
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]; s.life -= dt;
        if (s.assist && !dead) { enCenter.copy(en.position).setY(0.45); _v.copy(enCenter).sub(s.m.position).normalize().multiplyScalar(5); s.v.lerp(_v, 0.12); }
        s.m.position.addScaledVector(s.v, dt);
        if (Math.random() < 0.5) ctx.burst(s.m.getWorldPosition(_w), COL[s.kind], 1, 0.2);
        enCenter.copy(en.position).setY(0.45);
        if (!dead && running && s.m.position.distanceTo(enCenter) < 0.25) { enemyHit(s.kind); remove(shots, i); }
        else if (s.life <= 0) remove(shots, i);
      }
      // hechizos del enemigo
      for (let i = foes.length - 1; i >= 0; i--) {
        const f = foes[i]; f.m.position.addScaledVector(f.v, dt);
        const wp = f.m.getWorldPosition(new V3());
        if (wp.distanceTo(camW()) < 0.6) {
          if (shieldT > 0) { ctx.sfx('block'); ctx.burst(wp, [0x66ccff, 0xffffff], 30, 1.2); }
          else if (running) {
            hp--; ctx.sfx('hurt'); ctx.flash(); info();
            if (hp <= 0) { running = false; ctx.lose('El mago enemigo te derrotó. Consejo: cuando veas un hechizo verde, elige 🛡️ Protego y lánzalo para bloquearlo.'); }
          }
          remove(foes, i);
        }
      }
    },
    dispose() {
      alive = false; running = false;
      camera.remove(wand); camera.remove(shield); disposeTree(wand); disposeTree(shield);
      ui.classList.add('hidden'); document.getElementById('crosshair').classList.add('hidden');
      tip.material.color.set(COL.expelliarmus);
    }
  };
}

/* ================= MINIJUEGO 2: MIAMI — VICE CITY ADVENTURE ================= */
function building(par, x, z, w, h, col, neon) {
  const b = new THREE.Group(); b.position.set(x, 0, z); par.add(b);
  add(b, box(w, h, 0.3), M(col), 0, h / 2, 0);
  for (let y = 0.14; y < h - 0.05; y += 0.16) {
    add(b, box(w + 0.02, 0.018, 0.32), M(0xffffff), 0, y, 0);
    for (const wx of [-w * 0.3, w * 0.3]) add(b, box(0.07, 0.07, 0.01), M(0x5ad1ff, { emissive: 0x0a3a55 }), wx, y + 0.06, 0.152);
  }
  add(b, box(0.07, h + 0.18, 0.06), M(col), 0, (h + 0.18) / 2, 0.16);
  add(b, box(0.025, h * 0.8, 0.02), M(neon, { emissive: neon }), 0, h * 0.55, 0.195);
  add(b, cyl(0.06, 0.06, h, 12), M(col), w / 2, h / 2, 0.09);
}
const ITEM_BUILD = {
  key(i) { const gd = M(0xffcc33, { emissive: 0x7a5200 }); const r = add(i, new THREE.TorusGeometry(0.035, 0.012, 6, 16), gd, -0.05, 0, 0); r.rotation.y = 0; add(i, box(0.1, 0.016, 0.016), gd, 0.03, 0, 0); add(i, box(0.016, 0.03, 0.016), gd, 0.07, -0.02, 0); add(i, box(0.016, 0.02, 0.016), gd, 0.045, -0.015, 0); },
  glasses(i) { const k = M(0x1a1a1a), l = M(0x2b1a55, { emissive: 0x220044 }); for (const x of [-0.04, 0.04]) { add(i, new THREE.TorusGeometry(0.032, 0.008, 6, 16), k, x, 0, 0); add(i, new THREE.CircleGeometry(0.03, 16), l, x, 0, 0.001); } add(i, box(0.03, 0.008, 0.008), k, 0, 0.01, 0); },
  surf(i) { const m = add(i, sph(0.05, 12), M(0xff4fa3)); m.scale.set(1, 3.4, 0.25); const s = add(i, box(0.012, 0.3, 0.014), M(0xffffff), 0, 0, 0.01); },
  camera(i) { add(i, box(0.11, 0.07, 0.05), M(0x222222)); const l = add(i, cyl(0.025, 0.025, 0.035, 12), M(0x555555), 0, 0, 0.035); l.rotation.x = Math.PI / 2; add(i, box(0.025, 0.015, 0.02), M(0xffffff, { emissive: 0x666666 }), 0.035, 0.04, 0); },
  coin(i) { const m = add(i, cyl(0.05, 0.05, 0.012, 20), M(0xffd23a, { emissive: 0x8a6000 })); m.rotation.x = Math.PI / 2; add(i, box(0.03, 0.03, 0.016), M(0xff9d00, { emissive: 0x663300 })); }
};
function miami(ctx) {
  const g = new THREE.Group(); ctx.root.add(g);
  const tt = new THREE.Group(); g.add(tt);                     // tocadiscos: se gira deslizando
  add(tt, box(2.3, 0.1, 1.7), M(0xf3d9a4), 0, -0.05, 0);
  add(tt, box(2.3, 0.012, 0.38), M(0x3b3b46), 0, 0.006, -0.05);
  for (let i = 0; i < 8; i++) add(tt, box(0.12, 0.014, 0.025), M(0xffe14d), -0.98 + i * 0.28, 0.008, -0.05);
  add(tt, box(2.3, 0.03, 0.2), M(0xe8e1d4), 0, 0.015, -0.34);
  const sea = add(tt, box(2.3, 0.06, 0.42), temp(new THREE.MeshLambertMaterial({ color: 0x1ec8e6, transparent: true, opacity: 0.88, emissive: 0x05506a })), 0, -0.01, 0.64);
  const foam = add(tt, box(2.3, 0.012, 0.04), M(0xffffff), 0, 0.022, 0.43);
  // Edificios Art Déco (colores pastel + neón)
  [[-0.85, 0.36, 0.5, 0xffb3c7, 0x2ec4b6], [-0.42, 0.4, 0.72, 0x9ee6e0, 0xff5fa2], [0, 0.38, 0.86, 0xfff1b8, 0xff7ab6], [0.42, 0.4, 0.62, 0xc9b6ff, 0x24d1ff], [0.85, 0.36, 0.48, 0xffcfa6, 0xff3f8e]]
    .forEach(([x, w, h, c, n]) => building(tt, x, -0.62, w, h, c, n));
  [[-0.95, 0.27, 1], [-0.32, 0.25, 0.9], [0.2, 0.3, 1.1], [0.55, 0.2, 0.85], [-0.6, -0.3, 0.8], [0.62, -0.3, 0.8]].forEach(([x, z, s]) => palm(tt, x, z, s));
  // Autos deportivos
  const cars = [[0xff4fa3, -0.8, -0.13, 0.45], [0x24d1ff, 0.3, -0.13, 0.45], [0xffe14d, -0.2, 0.03, -0.55], [0x8a5cff, 0.9, 0.03, -0.55]].map(([col, x, z, sp]) => {
    const car = new THREE.Group(); car.position.set(x, 0, z); car.userData.sp = sp; tt.add(car);
    add(car, box(0.3, 0.06, 0.13), M(col), 0, 0.05, 0);
    add(car, box(0.14, 0.06, 0.11), M(0x1c2a3a), -0.02, 0.1, 0);
    for (const wx of [-0.1, 0.1]) for (const wz of [-0.065, 0.065]) { const w = add(car, cyl(0.03, 0.03, 0.02, 10), M(0x111111), wx, 0.03, wz); w.rotation.x = Math.PI / 2; }
    if (sp < 0) car.rotation.y = Math.PI;
    return car;
  });
  // Señal de tránsito
  add(tt, cyl(0.01, 0.01, 0.38, 6), M(0x888888), -1.05, 0.19, -0.3);
  const sign = add(tt, new THREE.PlaneGeometry(0.3, 0.075), temp(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, map: canvasTex(256, 64, (gg, w, h) => { gg.fillStyle = '#0a7a3a'; gg.fillRect(0, 0, w, h); gg.strokeStyle = '#fff'; gg.lineWidth = 4; gg.strokeRect(4, 4, w - 8, h - 8); gg.fillStyle = '#fff'; gg.font = 'bold 38px system-ui'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.fillText('OCEAN DR', w / 2, h / 2 + 2); }) })), -0.95, 0.38, -0.3);
  const stop = add(tt, cyl(0.06, 0.06, 0.01, 8), M(0xe02020), 1.05, 0.33, -0.3); stop.rotation.x = Math.PI / 2;
  add(tt, cyl(0.01, 0.01, 0.33, 6), M(0x888888), 1.05, 0.165, -0.31);
  // Torre salvavidas, sombrilla, toalla y sol
  const tw = new THREE.Group(); tw.position.set(0.85, 0, 0.32); tt.add(tw);
  for (const [x, z] of [[-0.06, -0.06], [0.06, -0.06], [-0.06, 0.06], [0.06, 0.06]]) add(tw, cyl(0.008, 0.008, 0.22, 5), M(0xffffff), x, 0.11, z);
  add(tw, box(0.18, 0.12, 0.16), M(0xff7ab6), 0, 0.27, 0);
  add(tw, box(0.22, 0.02, 0.2), M(0x24d1ff), 0, 0.34, 0);
  add(tt, cyl(0.006, 0.006, 0.3, 5), M(0xffffff), -0.15, 0.15, 0.3);
  add(tt, cone(0.17, 0.08, 10), M(0xffe14d), -0.15, 0.31, 0.3);
  add(tt, box(0.2, 0.004, 0.1), M(0xff5fa2), 0, 0.003, 0.32);
  const sunS = glow(0xffd36b, 1.2, 0.8); sunS.position.set(1.0, 1.35, -1.2); g.add(sunS);

  // Objetos escondidos
  const DEF = [['🔑', 'key', -0.6, 0.09, -0.34], ['🕶️', 'glasses', 0, 0.035, 0.32], ['🏄', 'surf', -0.65, 0.17, 0.42], ['📷', 'camera', 0.85, 0.4, 0.32], ['🪙', 'coin', 0.28, 0.22, -0.05]];
  const hitM = temp(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const items = DEF.map(([emoji, kind, x, y, z], k) => {
    const it = new THREE.Group(); it.position.set(x, y, z); tt.add(it);
    const body = new THREE.Group(); it.add(body); ITEM_BUILD[kind](body);
    it.add(glow(0xfff3a0, 0.32, 0.55));
    const hit = add(it, sph(0.14, 8), hitM);
    it.userData = { emoji, found: false, hit, body, by: y, ph: k, fly: 0 };
    return it;
  });

  let running = false, time = 60, found = 0, drag = null, hover = null, infoT = 0;
  const info = () => ctx.info(`⏱ ${Math.ceil(time)} s · ${found}/5 · ${items.map(i => i.userData.found ? '✅' : i.userData.emoji).join(' ')}`);
  const pick = p => { const h = p.ray.intersectObjects(items.filter(i => !i.userData.found).map(i => i.userData.hit)); return h.length ? h[0].object.parent : null; };
  function collect(it) {
    it.userData.found = true; it.userData.fly = 0.001; found++;
    ctx.sfx('pickup'); ctx.burst(it.getWorldPosition(_v), [0xffd700, 0xff4fa3, 0x24d1ff], 35, 1.3); info();
    if (found === 5) { running = false; setTimeout(() => ctx.win('miami'), 700); }
  }
  return {
    start() {
      running = true; info();
      ctx.hint(ctx.isHand() ? 'Señala un objeto y haz pinza ✋ · pinza en vacío + mover = girar' : 'Toca los objetos · desliza en una zona vacía para girar');
    },
    onDown(p) { if (!running) return; const it = pick(p); if (it) collect(it); else drag = { x: p.ndc.x, r: tt.rotation.y }; },
    onMove(p) { if (drag) tt.rotation.y = clamp(drag.r + (p.ndc.x - drag.x) * 1.6, -1, 1); else hover = running ? pick(p) : null; },
    onUp() { drag = null; },
    update(dt, t) {
      cars.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x > 1.05) c.position.x = -1.05; if (c.position.x < -1.05) c.position.x = 1.05; });
      sea.position.y = -0.01 + Math.sin(t * 1.5) * 0.006; foam.scale.z = 1 + Math.sin(t * 2) * 0.4;
      for (const it of items) {
        const u = it.userData;
        if (u.fly) {
          u.fly += dt; it.position.y += dt * 0.9; it.scale.setScalar(1 + u.fly * 2);
          if (u.fly > 0.45) it.visible = false; continue;
        }
        it.position.y = u.by + Math.sin(t * 2 + u.ph) * 0.02;
        u.body.rotation.y += dt * 1.5;
        it.scale.setScalar(hover === it ? 1.35 : 1);
      }
      if (running) {
        time -= dt; infoT += dt;
        if (infoT > 0.25) { infoT = 0; info(); }
        if (time <= 0) { time = 0; running = false; info(); ctx.lose(`Se acabó el tiempo. Encontraste ${found} de 5 objetos.`); }
      }
    },
    dispose() {}
  };
}

/* ================= MINIJUEGO 3: MIAMI HEAT — BASKETBALL AR ================= */
function courtTex() {
  return canvasTex(512, 600, (g, w, h) => {
    g.fillStyle = '#d9a35f'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 24) { g.fillStyle = 'rgba(120,70,20,.18)'; g.fillRect(x, 0, 2, h); }
    g.strokeStyle = '#111'; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
    g.fillStyle = '#c8102e'; g.fillRect(w / 2 - 80, 0, 160, 200);
    g.strokeStyle = '#fff'; g.lineWidth = 5;
    g.strokeRect(w / 2 - 80, 0, 160, 200);
    g.beginPath(); g.arc(w / 2, 200, 70, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(w / 2, 140, 220, 0.05, Math.PI - 0.05); g.stroke();
    g.beginPath(); g.arc(w / 2, h, 80, Math.PI, 0); g.stroke();
  });
}
function heat(ctx) {
  const { camera } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const RR = 0.21, BR = 0.11, GRAV = 6, BB_Z = -1.15, BB_Y = 1.205, RIM = new V3(0, 1.0, -0.885);
  const floor = add(g, new THREE.PlaneGeometry(2.2, 2.6), temp(new THREE.MeshLambertMaterial({ map: courtTex() })), 0, 0, -0.2); floor.rotation.x = -Math.PI / 2;
  add(g, box(2.3, 0.06, 2.7), M(0x111111), 0, -0.035, -0.2);
  // Canasta
  add(g, box(0.9, 0.55, 0.03), M(0xffffff), 0, BB_Y, BB_Z);
  const bt = canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8102e'; c.lineWidth = 10; c.strokeRect(5, 5, w - 10, h - 10); c.strokeStyle = '#111'; c.lineWidth = 6; c.strokeRect(w / 2 - 40, h - 70, 80, 56); });
  add(g, new THREE.PlaneGeometry(0.9, 0.55), temp(new THREE.MeshBasicMaterial({ map: bt })), 0, BB_Y, BB_Z + 0.016);
  add(g, cyl(0.035, 0.035, 1.3), M(0x222222), 0, 0.65, BB_Z - 0.3);
  add(g, box(0.05, 0.05, 0.3), M(0x222222), 0, 1.25, BB_Z - 0.15);
  add(g, box(0.22, 0.25, 0.22), M(0xc8102e), 0, 0.125, BB_Z - 0.3);
  const rim = add(g, new THREE.TorusGeometry(RR, 0.013, 8, 28), M(0xff3b1f, { emissive: 0x551100 }), RIM.x, RIM.y, RIM.z); rim.rotation.x = Math.PI / 2;
  add(g, box(0.05, 0.03, 0.06), M(0xff3b1f), 0, RIM.y, BB_Z + 0.045);
  const net = add(g, new THREE.LatheGeometry([new THREE.Vector2(RR, 0), new THREE.Vector2(RR * 0.85, -0.11), new THREE.Vector2(RR * 0.62, -0.24)], 12), B(0xffffff, { wireframe: true }), RIM.x, RIM.y, RIM.z);
  // Marcador digital
  const sbTex = canvasTex(512, 192, () => {});
  add(g, new THREE.PlaneGeometry(0.8, 0.3), temp(new THREE.MeshBasicMaterial({ map: sbTex })), 0, 1.72, BB_Z);
  const ttl = label('MIAMI · FLORIDA', 0.11, '#fff', 'rgba(200,16,46,.95)'); ttl.position.set(0, 1.98, BB_Z); g.add(ttl);
  // Decoración roja, negra y blanca
  for (const x of [-1.12, 1.12]) { add(g, box(0.04, 1.0, 0.5), M(0xc8102e), x, 0.5, -0.8); add(g, box(0.045, 1.0, 0.07), M(0x111111), x, 0.5, -0.8); add(g, box(0.046, 1.0, 0.025), M(0xffffff), x, 0.5, -0.72); }
  // Jugador con uniforme inspirado (sin logotipos oficiales)
  const pl = new THREE.Group(); pl.position.set(0.72, 0, -0.45); pl.rotation.y = -0.35; g.add(pl);
  const skin = M(0x8d5a3b), red = M(0xc8102e), wht = M(0xf5f5f5);
  for (const x of [-0.05, 0.05]) { add(pl, cyl(0.028, 0.025, 0.32, 8), skin, x, 0.2, 0); add(pl, box(0.065, 0.045, 0.12), wht, x, 0.022, 0.02); add(pl, box(0.067, 0.014, 0.122), red, x, 0.045, 0.02); }
  add(pl, cyl(0.1, 0.1, 0.14, 10), red, 0, 0.42, 0);
  add(pl, box(0.22, 0.26, 0.12), red, 0, 0.62, 0);
  const jt = canvasTex(128, 128, (c, w) => { c.fillStyle = '#fff'; c.font = 'bold 70px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FL', w / 2, 70); });
  add(pl, new THREE.PlaneGeometry(0.16, 0.16), temp(new THREE.MeshBasicMaterial({ map: jt, transparent: true })), 0, 0.63, 0.061);
  add(pl, sph(0.075), skin, 0, 0.84, 0);
  add(pl, cyl(0.077, 0.077, 0.025, 12), wht, 0, 0.87, 0);
  const arms = [-1, 1].map(sd => { const a = new THREE.Group(); a.position.set(0.14 * sd, 0.73, 0); pl.add(a); add(a, cyl(0.022, 0.022, 0.26, 6), skin, 0, -0.13, 0); return a; });
  // Balón
  const ball = add(g, sph(BR, 16), ballMat());
  const st = { mode: 'rest', v: new V3(), t: 0, scored: false, fb: '' };
  let running = false, baskets = 0, pts = 0, shots = 0, cel = 0, netK = 0;
  const _d = new V3(), _q = new V3(), _n = new V3();
  const info = () => ctx.info(`🏀 Canastas ${baskets}/3 · Puntos ${pts} · Tiros ${shots}`);
  function drawBoard() {
    const c = sbTex.userData.g, w = 512, h = 192;
    c.fillStyle = '#0b0b0b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8102e'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.textAlign = 'center'; c.fillStyle = '#ff3344'; c.font = 'bold 34px monospace'; c.fillText('PUNTOS      CANASTAS', w / 2, 52);
    c.font = 'bold 92px monospace'; c.fillStyle = '#ffd54a'; c.fillText(String(pts).padStart(2, '0'), 140, 160); c.fillText(`${baskets}/3`, 370, 160);
    sbTex.needsUpdate = true;
  }
  drawBoard();
  const restPos = () => g.worldToLocal(camera.localToWorld(_v.set(0, -0.3, -0.9)));
  const holdPos = () => g.worldToLocal(ctx.ptr.ray.ray.at(0.9, _v));
  ball.position.copy(restPos());

  function shoot(vel) {
    st.mode = 'fly'; st.t = 0; st.scored = false; shots++; info(); ctx.sfx('throw');
    const pw = clamp(1 + Math.log(vel.y / 2.8) * 0.6, 0.5, 1.6), lat = clamp(vel.x / Math.max(vel.y, 0.1), -1, 1);
    st.fb = pw > 1.15 ? 'Un poco más suave 👇' : pw < 0.85 ? '¡Más fuerte! 💪' : Math.abs(lat) > 0.16 ? 'Lanza más recto ⬆️' : '¡Casi!';
    const tgt = RIM.clone().add(_v.set(lat * 0.63, 0.03, -(pw - 1) * 0.56));
    const T = 1.15;
    st.v.copy(tgt).sub(ball.position).divideScalar(T); st.v.y += 0.5 * GRAV * T;
  }
  function score() {
    st.scored = true; baskets++; pts += 2; cel = 1.3; netK = 1; ctx.sfx('score'); info(); drawBoard();
    ctx.burst(rim.getWorldPosition(_w), [0xff2a2a, 0xffffff, 0xffb000], 60, 1.6);
    if (baskets >= 3) { running = false; setTimeout(() => ctx.win('heat'), 1000); }
  }
  let alive = true;
  const startHint = () => alive && ctx.hint(ctx.isHand() ? 'Pinza ✋ para agarrar · mueve la mano rápido hacia arriba y suelta' : 'Pon el dedo y desliza rápido hacia la canasta');
  return {
    start() { running = true; info(); startHint(); },
    onDown() { if (running && st.mode === 'rest') st.mode = 'hold'; },
    onMove(p) { if (st.mode === 'hold' && ctx.isHand()) { const v = p.vel(90); if (v.y > 3.2) shoot(v); } },
    onUp(p) { if (st.mode !== 'hold') return; const v = p.vel(110); if (v.y > 0.9) shoot(v); else st.mode = 'rest'; },
    update(dt, t) {
      // personaje
      if (cel > 0) { cel -= dt; pl.position.y = Math.abs(Math.sin(cel * 8)) * 0.15; arms.forEach((a, i) => (a.rotation.z = (i ? 1 : -1) * 2.8)); }
      else { pl.position.y = Math.abs(Math.sin(t * 3)) * 0.015; arms.forEach((a, i) => (a.rotation.z = (i ? 1 : -1) * (0.15 + Math.sin(t * 2) * 0.05))); }
      netK = Math.max(0, netK - dt * 2); net.scale.y = 1 + netK * 0.4;
      if (st.mode === 'rest') { ball.position.lerp(restPos(), 0.35); ball.rotation.y += dt; return; }
      if (st.mode === 'hold') { ball.position.lerp(holdPos(), 0.6); return; }
      // vuelo con física simplificada
      const sub = 3, h = dt / sub, P = ball.position, front = BB_Z + 0.015;
      for (let i = 0; i < sub; i++) {
        const prevY = P.y;
        st.v.y -= GRAV * h; P.addScaledVector(st.v, h);
        if (st.v.z < 0 && P.z - BR < front && P.z > BB_Z - 0.1 && Math.abs(P.x) < 0.5 && Math.abs(P.y - BB_Y) < 0.33) { P.z = front + BR; st.v.z *= -0.55; st.v.x *= 0.8; ctx.sfx('rim'); }
        _d.set(P.x - RIM.x, 0, P.z - RIM.z); const L = _d.length() || 1e-4;
        _q.copy(RIM).addScaledVector(_d, RR / L); _n.copy(P).sub(_q); const dist = _n.length();
        if (dist < BR + 0.013) {
          _n.divideScalar(dist || 1); P.copy(_q).addScaledVector(_n, BR + 0.014);
          const vn = st.v.dot(_n); if (vn < 0) { st.v.addScaledVector(_n, -1.6 * vn).multiplyScalar(0.85); if (vn < -0.4) ctx.sfx('rim'); }
        }
        if (!st.scored && st.v.y < 0 && prevY >= RIM.y && P.y < RIM.y && L < RR - BR * 0.25) score();
        if (P.y < BR) { P.y = BR; st.v.y *= -0.6; st.v.x *= 0.8; st.v.z *= 0.8; }
      }
      ball.rotation.x -= dt * 9;
      st.t += dt;
      if (st.t > 2.6) {
        st.mode = 'rest';
        if (!st.scored && running) { ctx.hint(st.fb); setTimeout(() => { if (running) startHint(); }, 1800); }
      }
    },
    dispose() { alive = false; running = false; }
  };
}

/* ================= Catálogo de minijuegos ================= */
export const GAMES = {
  orlando: {
    short: 'Orlando', title: '🏰 Orlando — Duelo mágico', winMsg: '¡Has conquistado Orlando!', create: orlando,
    how: h => h
      ? 'Tu varita sigue tu dedo índice: apunta al mago y haz <b>pinza</b> (pulgar + índice) para lanzar. Cambia de hechizo con los botones: 🔴 Expelliarmus lo desarma, ⚡ Stupefy lo aturde. Cuando veas un hechizo verde, elige 🛡️ Protego y haz pinza para bloquearlo. <b>Acierta 3 ataques.</b>'
      : 'Toca al mago para lanzarle el hechizo (o usa ✨ Lanzar). 🔴 Expelliarmus lo desarma, ⚡ Stupefy lo aturde. Cuando veas un hechizo verde, elige 🛡️ Protego y lánzalo para bloquearlo. <b>Acierta 3 ataques.</b>',
    fact: 'The Wizarding World of Harry Potter abrió su zona de Hogsmeade en Islands of Adventure en 2010 y Diagon Alley en Universal Studios Florida en 2014. El tren Hogwarts Express conecta ambos parques.'
  },
  miami: {
    short: 'Miami', title: '🌴 Miami — Vice City Adventure', winMsg: '¡Has explorado Miami!', create: miami,
    how: h => (h
      ? 'Señala con tu índice y haz <b>pinza</b> sobre cada objeto para recogerlo. Haz pinza en una zona vacía y mueve la mano para girar el escenario.'
      : 'Toca cada objeto para recogerlo. Desliza el dedo en una zona vacía para girar el escenario.') + ' Encuentra los 5 objetos en <b>60 segundos</b>: 🔑 🕶️ 🏄 📷 🪙',
    fact: 'Miami Beach tiene una de las mayores concentraciones de arquitectura Art Déco del mundo. Su distrito histórico entró al Registro Nacional de Lugares Históricos de EE. UU. en 1979 y reúne cientos de edificios de las décadas de 1920 a 1940.'
  },
  heat: {
    short: 'Miami Heat', title: '🏀 Miami Heat — Basketball AR', winMsg: '¡Eres una estrella del Miami Heat!', create: heat,
    how: h => (h
      ? 'Haz <b>pinza</b> para agarrar el balón, mueve la mano rápido hacia arriba y suelta (o solo da un impulso hacia arriba).'
      : 'Pon el dedo en la pantalla para agarrar el balón y <b>desliza hacia arriba</b>, hacia la canasta. La velocidad del deslizamiento es la fuerza y la inclinación es la dirección.') + ' <b>Encesta 3 balones.</b>',
    fact: 'El Miami Heat entró a la NBA en 1988 como equipo de expansión y ha ganado tres campeonatos: 2006, 2012 y 2013.'
  }
};
