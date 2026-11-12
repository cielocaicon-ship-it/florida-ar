// FLORIDA AR ADVENTURE — contenido 3D: cofre AR, portales y tres mundos inmersivos 360°.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
const _v = new V3(), _w = new V3(), _u = new V3(), _y0 = new V3(0, 1, 0);

/* ---- Modelos .glb (personas con esqueleto animado y aves) ---- */
const glbCache = {}, gltfLoader = new GLTFLoader();
function loadGLB(name) {
  return glbCache[name] || (glbCache[name] = new Promise((res, rej) => gltfLoader.load('assets/' + name, gl => {
    gl.scene.traverse(o => { if (o.isMesh) { o.geometry.userData.keep = true; o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    res(gl);
  }, undefined, rej)));
}
function spawnGLB(name, parent, mixers, { x = 0, y = 0, z = 0, ry = 0, s = 1, speed = 1 } = {}) {
  const h = new THREE.Group(); h.position.set(x, y, z); h.rotation.y = ry; h.scale.setScalar(s); parent.add(h);
  loadGLB(name).then(gl => {
    if (!h.parent) return;
    const o = SkeletonUtils.clone(gl.scene); h.add(o);
    const mx = new THREE.AnimationMixer(o), a = mx.clipAction(gl.animations[0]); a.timeScale = speed; a.play(); mx.setTime(Math.random() * 4); mixers.push(mx);
  }).catch(e => console.warn('No se pudo cargar', name, e));
  return h;
}

/* ---- Personas con proporciones humanas reales (adultos y niños) ---- */
const _gc = {};
const GC = (k, f) => _gc[k] || (_gc[k] = keep(f()));
const capG = (r, l) => GC(`c${r.toFixed(3)}_${l.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, Math.max(0.01, l), 6, 14));
const sphG = (r, w = 20) => GC(`s${r.toFixed(3)}_${w}`, () => new THREE.SphereGeometry(r, w, Math.round(w * 0.75)));
const cylG = (a, b, h, n = 16) => GC(`y${a.toFixed(3)}_${b.toFixed(3)}_${h.toFixed(3)}_${n}`, () => new THREE.CylinderGeometry(a, b, h, n));
const hairG = (r, f) => GC(`h${r.toFixed(3)}_${f}`, () => new THREE.SphereGeometry(r, 20, 14, 0, Math.PI * 2, 0, Math.PI * f));
const SKINS = [0x4a2c1d, 0x6b4430, 0x8d5a3b, 0xb07a55, 0xc99a74, 0xe0b48c, 0xf2cfae];
const HAIRS = [0x0e0a07, 0x1c130b, 0x2e1d10, 0x4a3018, 0x7a5a32, 0xb8945a, 0x5a5a5a];
const pick = a => a[Math.random() * a.length | 0];
function person(o = {}) {
  const H = o.h || 1.75, kid = !!o.kid, ath = !!o.athlete;
  const hr = H * (kid ? 0.082 : 0.061);                 // los niños tienen la cabeza proporcionalmente más grande
  const leg = H * (kid ? 0.44 : 0.48), torso = H * (kid ? 0.25 : 0.29), shW = H * (ath ? 0.255 : kid ? 0.2 : 0.225);
  const skin = M(o.skin ?? pick(SKINS), { roughness: 0.55 }), top = o.topMat || M(o.top ?? 0x2266aa, { roughness: 0.92 });
  const bot = M(o.bottom ?? 0x2a3550, { roughness: 0.92 }), shoe = M(o.shoe ?? 0xf0f0f0, { roughness: 0.5 }), hairM = M(o.hair ?? pick(HAIRS), { roughness: 0.95 });
  const p = new THREE.Group(), hips = new THREE.Group(); hips.position.y = leg; p.add(hips);
  const tr = H * (ath ? 0.042 : kid ? 0.034 : 0.037), sr = H * (ath ? 0.031 : 0.027), short = o.shorts;
  const legs = [-1, 1].map(s => {
    const th = new THREE.Group(); th.position.x = s * shW * 0.22; hips.add(th);
    add(th, capG(tr, leg * 0.5 - tr * 2 + 0.03), short ? skin : bot, 0, -leg * 0.25, 0, false);
    if (short) add(th, cylG(tr * 1.45, tr * 1.3, leg * (o.longShorts ? 0.36 : 0.24), 14), bot, 0, -leg * (o.longShorts ? 0.16 : 0.1), 0, false);
    const kn = new THREE.Group(); kn.position.y = -leg * 0.5; th.add(kn);
    add(kn, capG(sr, leg * 0.44 - sr * 2), short ? skin : bot, 0, -leg * 0.22, 0, false);
    if (ath) add(kn, cylG(sr * 1.1, sr * 1.05, leg * 0.12, 12), M(0xffffff), 0, -leg * 0.38, 0, false);
    add(kn, box(sr * 2.3, sr * 1.5, H * 0.15), shoe, 0, -leg * 0.47, H * 0.03, false);
    return { th, kn };
  });
  add(hips, cylG(shW * 0.42, shW * 0.46, H * 0.09, 18), bot, 0, 0.01, 0, false);
  const tm = add(hips, capG(shW * 0.5, Math.max(0.02, torso - shW)), top, 0, torso * 0.5, 0); tm.scale.set(1, 1, 0.56);
  if (o.num) {
    const nt = textTex(o.num, 128, 128, 'rgba(0,0,0,0)', '#fff', 'bold 76px system-ui'); const nm = temp(new THREE.MeshStandardMaterial({ map: nt, transparent: true, roughness: 0.8 }));
    add(hips, new THREE.PlaneGeometry(shW * 0.55, shW * 0.55), nm, 0, torso * 0.58, shW * 0.285, false);
    const bk = add(hips, new THREE.PlaneGeometry(shW * 0.55, shW * 0.55), nm, 0, torso * 0.6, -shW * 0.285, false); bk.rotation.y = Math.PI;
  }
  add(hips, cylG(H * 0.028, H * 0.032, H * 0.06, 12), skin, 0, torso + H * 0.005, 0, false);
  const head = new THREE.Group(); head.position.y = torso + H * 0.03 + hr * 0.95; hips.add(head);
  add(head, sphG(hr, 24), skin, 0, 0, 0, false).scale.set(0.9, 1.08, 0.98);
  for (const s of [-1, 1]) {
    add(head, sphG(hr * 0.16, 12), M(0xf4f4f0, { roughness: 0.2 }), s * hr * 0.34, hr * 0.1, hr * 0.8, false);
    add(head, sphG(hr * 0.085, 10), M(0x2a1a0e, { roughness: 0.1 }), s * hr * 0.34, hr * 0.1, hr * 0.94, false);
    add(head, box(hr * 0.32, hr * 0.06, hr * 0.06), hairM, s * hr * 0.34, hr * 0.32, hr * 0.86, false);
    add(head, sphG(hr * 0.2, 10), skin, s * hr * 0.9, 0, 0, false).scale.set(0.45, 1, 0.8);
  }
  const nose = add(head, cone(hr * 0.12, hr * 0.28, 8), skin, 0, -hr * 0.08, hr * 0.98, false); nose.rotation.x = Math.PI / 2;
  add(head, box(hr * 0.32, hr * 0.045, hr * 0.03), M(0x8a4a3e), 0, -hr * 0.4, hr * 0.86, false);
  const style = o.hairStyle || 'short';
  if (style !== 'bald') { const hc = add(head, hairG(hr * 1.07, style === 'buzz' ? 0.42 : 0.55), hairM, 0, hr * 0.05, -hr * 0.05, false); hc.rotation.x = -0.35; }
  if (style === 'long') add(head, capG(hr * 0.72, hr * 1.3), hairM, 0, -hr * 0.65, -hr * 0.42, false);
  if (style === 'bun') add(head, sphG(hr * 0.42, 12), hairM, 0, hr * 0.75, -hr * 0.55, false);
  if (style === 'pony') { const pt = add(head, capG(hr * 0.25, hr * 1.1), hairM, 0, -hr * 0.4, -hr * 1.05, false); pt.rotation.x = 0.4; }
  if (o.band) add(head, cylG(hr * 0.93, hr * 0.93, hr * 0.22, 20), M(o.band), 0, hr * 0.42, 0, false);
  const ar = H * (ath ? 0.027 : kid ? 0.02 : 0.023);
  const arms = [-1, 1].map(s => {
    const sh = new THREE.Group(); sh.position.set(s * shW * 0.5, torso - H * 0.03, 0); hips.add(sh);
    add(sh, capG(ar, H * 0.16 - ar * 2), o.sleeves ? top : skin, 0, -H * 0.085, 0, false);
    if (o.sleeves) add(sh, cylG(ar * 1.35, ar * 1.25, H * 0.08, 12), top, 0, -H * 0.03, 0, false);
    const el = new THREE.Group(); el.position.y = -H * 0.17; sh.add(el);
    add(el, capG(ar * 0.85, H * 0.14 - ar * 1.7), skin, 0, -H * 0.075, 0, false);
    add(el, sphG(H * 0.024, 12), skin, 0, -H * 0.16, 0, false).scale.set(0.8, 1.1, 0.55);
    sh.rotation.z = s * 0.07;
    return { sh, el, s };
  });
  return { p, hips, legs, arms, head, H, leg };
}
function walkAnim(P, ph, amt = 1) {
  const s = Math.sin(ph);
  P.legs[0].th.rotation.x = s * 0.5 * amt; P.legs[1].th.rotation.x = -s * 0.5 * amt;
  P.legs[0].kn.rotation.x = Math.max(0, Math.cos(ph)) * 0.75 * amt; P.legs[1].kn.rotation.x = Math.max(0, -Math.cos(ph)) * 0.75 * amt;
  P.arms[0].sh.rotation.x = -s * 0.42 * amt; P.arms[1].sh.rotation.x = s * 0.42 * amt;
  P.arms.forEach(a => { a.el.rotation.x = -0.25 * amt; a.sh.rotation.z = a.s * 0.07; });
  P.hips.position.y = P.leg + Math.abs(Math.cos(ph)) * 0.025 * amt;
}
function clapAnim(P, t, ph = 0) {
  P.arms.forEach(a => { a.sh.rotation.x = -1.05; a.sh.rotation.z = -a.s * (0.38 + Math.sin(t * 13 + ph) * 0.12); a.el.rotation.x = -0.75; });
}
function idleAnim(P, t, ph = 0) {
  P.hips.position.y = P.leg + Math.sin(t * 1.6 + ph) * 0.006;
  P.arms.forEach(a => { a.sh.rotation.x = Math.sin(t * 0.8 + ph) * 0.04; a.el.rotation.x = -0.12; a.sh.rotation.z = a.s * 0.07; });
  P.head.rotation.y = Math.sin(t * 0.4 + ph) * 0.35;
}
function stripedMat(a, b, n = 10, vertical = true) {
  return temp(new THREE.MeshStandardMaterial({ roughness: 0.9, map: canvasTex(128, 128, (g, w, h) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; vertical ? g.fillRect(i * w / n, 0, w / n + 1, h) : g.fillRect(0, i * h / n, w, h / n + 1); } }) }));
}
function waterMat(color, { opacity = 1, amp = 1, rough = 0.08, metal = 0.12 } = {}) { // agua con olas y reflejos calculados en la tarjeta gráfica
  const m = temp(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, transparent: opacity < 1, opacity }));
  const uT = { value: 0 }; m.userData.uT = uT; const A = amp.toFixed(3);
  m.onBeforeCompile = sh => {
    sh.uniforms.uT = uT;
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `float a_=position.x*.12+uT*1.1, b_=position.y*.2+uT*1.5, c_=(position.x+position.y)*.5+uT*2.2, d_=position.x*1.7-position.y*1.1+uT*3.;
        float dx_=${A}*(.03*cos(a_)+.03*cos(c_)+.034*cos(d_)), dy_=${A}*(.05*cos(b_)+.03*cos(c_)-.022*cos(d_));
        vec3 objectNormal = normalize(vec3(-dx_,-dy_,1.));
        #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed.z += ${A}*(.25*sin(a_)+.25*sin(b_)+.06*sin(c_)+.02*sin(d_));`);
  };
  return m;
}

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
  constructor(n = 1400) {
    this.n = n; this.i = 0; this.col = new THREE.Color();
    this.p = new Float32Array(n * 3).fill(9999); this.c = new Float32Array(n * 3); this.base = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3); this.l = new Float32Array(n); this.gr = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.c, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.1, map: glowTex(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.points.frustumCulled = false; this.points.renderOrder = 5;
  }
  emit(pos, color = 0xffd700, count = 20, speed = 1.5, grav = 1.2) {
    for (let k = 0; k < count; k++) {
      const i = this.i++ % this.n, j = i * 3;
      this.col.set(Array.isArray(color) ? color[k % color.length] : color);
      const u = Math.random() * 2 - 1, a = Math.random() * 6.283, s = speed * (0.35 + Math.random() * 0.65), r = Math.sqrt(1 - u * u);
      this.p[j] = pos.x; this.p[j + 1] = pos.y; this.p[j + 2] = pos.z;
      this.v[j] = r * Math.cos(a) * s; this.v[j + 1] = u * s + speed * 0.3; this.v[j + 2] = r * Math.sin(a) * s;
      this.base[j] = this.col.r; this.base[j + 1] = this.col.g; this.base[j + 2] = this.col.b;
      this.l[i] = 1; this.gr[i] = grav;
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
      any = true; v[j + 1] -= this.gr[i] * dt;
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
  const segs = [0, 1, 2, 3, 4, 5].map(i => add(bar, new THREE.PlaneGeometry(0.13, 0.08), B(0xff3344), -0.375 + i * 0.15, 0, 0.002, false));
  return { w, robeM, arms, wand, tip, bar, segs, cape };
}

function pavementTex() {
  return rep(canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9a183'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 32) for (let x = 0; x < w; x += 64) {
      const o = (y / 32) % 2 ? 32 : 0, c = Math.random();
      g.fillStyle = c < 0.33 ? '#d8c3a2' : c < 0.66 ? '#c9a985' : '#b98d6a';
      g.fillRect(x + o + 2, y + 2, 60, 28);
    }
    g.strokeStyle = 'rgba(160,60,40,.5)'; g.lineWidth = 10; g.strokeRect(0, 0, w, h);
  }), 20, 12);
}
function limestoneTex() {
  return rep(canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#7d7468'; g.fillRect(0, 0, w, h);
    for (let y = 0, r = 0; y < h; y += 40, r++) for (let x = (r % 2) * 50 - 50; x < w; x += 100) {
      const c = 175 + Math.random() * 35 | 0; g.fillStyle = `rgb(${c},${c - 10},${c - 28})`; g.fillRect(x + 2, y + 2, 96, 36);
      for (let k = 0; k < 14; k++) { g.fillStyle = 'rgba(80,70,55,.18)'; g.fillRect(x + Math.random() * 96, y + Math.random() * 36, 3, 2); }
    }
  }), 3, 3);
}
let _archGeo;
function archGeo() { // ventana de arco apuntado (gótico)
  if (_archGeo) return _archGeo;
  const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(-0.5, 1.4); s.quadraticCurveTo(-0.45, 2.05, 0, 2.3); s.quadraticCurveTo(0.45, 2.05, 0.5, 1.4); s.lineTo(0.5, 0); s.lineTo(-0.5, 0);
  return (_archGeo = keep(new THREE.ExtrudeGeometry(s, { depth: 0.25, bevelEnabled: false })));
}
function gothicCastle(g, cx, cz) {
  const c = new THREE.Group(); c.position.set(cx, 0, cz); g.add(c);
  const stone = temp(new THREE.MeshStandardMaterial({ map: limestoneTex(), roughness: 0.92 }));
  const slate = M(0x2f3442, { roughness: 0.7, metalness: 0.2 }), glassW = M(0xffc874, { emissive: 0xffa040, emissiveIntensity: 2.2, roughness: 0.4 });
  add(c, box(30, 18, 14), stone, 0, 9, 0);
  const rf = add(c, roofGeo(), slate); rf.scale.set(31 / 1.732, 7 / 1.5, 14.5); rf.position.y = 18 + 0.5 * 7 / 1.5 * 1.5 / 1.5 * 1.5;
  rf.position.y = 18 + 0.5 * (7 / 1.5);
  for (let i = 0; i < 6; i++) { // contrafuertes y pináculos
    const x = -12.5 + i * 5; add(c, box(1.4, 16, 2.2), stone, x, 8, 7.6); add(c, cone(0.8, 3, 4), stone, x, 17.5, 7.6).rotation.y = Math.PI / 4;
  }
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { const w = add(c, archGeo(), glassW, -10 + i * 5, 3 + j * 7, 7.05, false); w.scale.set(1.8, 2.1, 1); }
  const rose = add(c, new THREE.CircleGeometry(2.6, 32), temp(new THREE.MeshStandardMaterial({ emissive: 0xffaa55, emissiveIntensity: 1.6, map: canvasTex(256, 256, (q, w) => { q.fillStyle = '#3a1f10'; q.fillRect(0, 0, w, w); for (let k = 0; k < 12; k++) { q.fillStyle = k % 2 ? '#ffcf7a' : '#ff8a3a'; q.beginPath(); q.moveTo(128, 128); q.arc(128, 128, 120, k / 12 * 6.283, (k + 0.8) / 12 * 6.283); q.fill(); } q.fillStyle = '#ffe9a8'; q.beginPath(); q.arc(128, 128, 30, 0, 7); q.fill(); }) })), 0, 20.5, 7.3, false);
  rose.material.emissiveMap = rose.material.map;
  const tower = (x, z, w, h, sp) => {
    add(c, box(w, h, w), stone, x, h / 2, z);
    for (let k = 0; k < 4; k++) add(c, box(w * 0.22, 1.2, w * 0.22), stone, x + (k % 2 ? 1 : -1) * w * 0.4, h + 0.6, z + (k < 2 ? 1 : -1) * w * 0.4);
    const s = add(c, cone(w * 0.62, sp, 4), slate, x, h + sp / 2, z); s.rotation.y = Math.PI / 4;
    for (let k = 0; k < 3; k++) { const a = add(c, archGeo(), glassW, x, h * (0.35 + k * 0.2), z + w / 2 + 0.02, false); a.scale.set(1.2, 1.3, 1); }
    const f = add(c, new THREE.PlaneGeometry(2.4, 1.4), M(0x8a1020, { side: THREE.DoubleSide }), x + 1.3, h + sp + 1.2, z, false); f.userData.flag = 1;
    add(c, cyl(0.06, 0.06, 3, 6), M(0x333333, { metalness: 0.8 }), x, h + sp + 0.8, z);
  };
  tower(-17, 6, 7, 30, 14); tower(17, 6, 7, 30, 14); tower(0, -4, 8, 40, 22); tower(-9, -6, 5, 26, 10); tower(9, -6, 5, 26, 10);
  add(c, box(6, 9, 0.6), M(0x2a160a), 0, 4.5, 7.35, false);
  return c;
}
function ferrisWheel(g, x, z) {
  const w = new THREE.Group(); w.position.set(x, 0, z); w.rotation.y = Math.PI / 2; g.add(w);
  const steel = M(0xf2f2f2, { metalness: 0.7, roughness: 0.35 });
  for (const s of [-1, 1]) for (const k of [-1, 1]) { const l = add(w, box(0.6, 19, 0.6), steel, k * 5, 9, s * 2); l.rotation.z = k * 0.27; }
  const rot = new THREE.Group(); rot.position.y = 18; w.add(rot);
  for (const s of [-1, 1]) add(rot, new THREE.TorusGeometry(15, 0.25, 8, 64), M(0xffffff, { emissive: 0xff66cc, emissiveIntensity: 0.9, metalness: 0.5 }), 0, 0, s * 1.6, false);
  for (let i = 0; i < 16; i++) { const sp = add(rot, box(0.18, 15, 0.18), steel, 0, 0, 0, false); sp.rotation.z = i / 16 * Math.PI * 2; sp.translateY(7.5); }
  add(rot, cyl(1.2, 1.2, 4, 16), steel, 0, 0, 0, false).rotation.x = Math.PI / 2;
  const gond = [];
  const GC2 = [0xff4fa3, 0x24d1ff, 0xffd23a, 0x7bff6a];
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2, cg = new THREE.Group(); cg.position.set(Math.cos(a) * 15, Math.sin(a) * 15, 0); rot.add(cg);
    add(cg, box(1.8, 1.8, 2.4), M(GC2[i % 4], { metalness: 0.3, roughness: 0.4 }), 0, -1.4, 0, false);
    add(cg, box(1.6, 0.9, 2.45), M(0x223344, { metalness: 0.9, roughness: 0.1 }), 0, -1.2, 0, false);
    gond.push(cg);
  }
  return { rot, gond };
}
function coaster(g) {
  const pts = [[20, 2, 12], [36, 3, 9], [52, 20, 12], [62, 22, 28], [55, 6, 44], [38, 15, 52], [24, 9, 40], [27, 4, 24]].map(p => new V3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const N = 320, L = [], R = [], up = new V3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const p = curve.getPointAt(i / N), t = curve.getTangentAt(i / N), n = new V3().crossVectors(t, up).normalize();
    L.push(p.clone().addScaledVector(n, 0.55)); R.push(p.clone().addScaledVector(n, -0.55));
    if (i % 3 === 0) { const tie = add(g, box(1.4, 0.12, 0.25), M(0x553322), p.x, p.y - 0.12, p.z, false); tie.lookAt(p.clone().add(t)); }
    if (i % 12 === 0) add(g, cyl(0.18, 0.25, p.y, 8), M(0xffffff, { metalness: 0.6, roughness: 0.4 }), p.x, p.y / 2, p.z);
  }
  const railM = M(0xff3b30, { metalness: 0.6, roughness: 0.3 });
  for (const P of [L, R]) add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P, true), 600, 0.13, 6, true), railM, 0, 0, 0);
  const cars = [0, 1, 2, 3].map(i => {
    const c = new THREE.Group(); g.add(c);
    add(c, box(1.5, 0.8, 2.2), M(i % 2 ? 0x24d1ff : 0xffd23a, { metalness: 0.5, roughness: 0.3 }), 0, 0.5, 0);
    for (let k = 0; k < 2; k++) { const r = person({ h: 1.7, top: pick([0xff4444, 0x3366ff, 0xffffff, 0x22aa66]) }); r.p.scale.setScalar(0.55); r.p.position.set(k ? 0.35 : -0.35, 0.35, 0); r.arms.forEach(a => (a.sh.rotation.x = -2.8)); c.add(r.p); }
    return c;
  });
  return { curve, cars, u: 0 };
}

function orlando(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x23306e, 0xffa66b, 0x3a2a3a); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0xc98a78, 45, 230);
  const sun = lightRig(g, { sky: 0xffd2b0, ground: 0x3a2a3a, hemi: 0.85, sun: 0xffb27a, sunI: 2.6, dir: [-30, 14, 12], size: 40, target: [0, 0, 12] });
  sun.shadow.camera.far = 200;
  add(g, sph(9, 24), B(0xffd9a0, { fog: false }), -300, 55, 120, false); const sg = glow(0xffb070, 160, 0.6); sg.position.set(-290, 55, 118); g.add(sg);
  const mixers = [];
  const ground = add(g, new THREE.PlaneGeometry(320, 320), temp(new THREE.MeshStandardMaterial({ map: cobbleTex(), roughness: 0.92 })), 0, 0, -10, false);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  /* ---------- 1) Entrada de un parque temático de Orlando ---------- */
  const plaza = add(g, new THREE.PlaneGeometry(100, 58), temp(new THREE.MeshStandardMaterial({ map: pavementTex(), roughness: 0.85 })), 0, 0.012, 33, false);
  plaza.rotation.x = -Math.PI / 2; plaza.receiveShadow = true;
  const grass = add(g, new THREE.PlaneGeometry(300, 140), M(0x4f7a32, { roughness: 1 }), 0, 0.005, 130, false); grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
  const stucco = M(0xf3e3c3, { roughness: 0.85 });
  for (const s of [-1, 1]) {
    add(g, cyl(1.1, 1.3, 10, 20), stucco, s * 7.5, 5, 40);
    add(g, sph(1.4, 24), M(0x24d1ff, { metalness: 0.6, roughness: 0.2 }), s * 7.5, 11, 40);
    add(g, box(3, 4.5, 3), M(0xff7a59, { roughness: 0.8 }), s * 12.5, 2.25, 38);
    add(g, box(3.6, 0.3, 3.6), M(0xffffff), s * 12.5, 4.6, 38);
    add(g, box(1.6, 1, 0.1), M(0x223344, { metalness: 0.8, roughness: 0.1 }), s * 12.5, 2.4, 36.45, false);
  }
  const arch = add(g, new THREE.TorusGeometry(7.5, 0.55, 14, 48, Math.PI), M(0xffd23a, { metalness: 0.5, roughness: 0.35 }), 0, 9.5, 40); arch.rotation.z = 0;
  add(g, new THREE.PlaneGeometry(10, 1.8), temp(new THREE.MeshStandardMaterial({ map: textTex('ORLANDO · PARQUE DE AVENTURAS', 1024, 180, '#1d2f6b', '#ffd23a', 'bold 74px system-ui'), roughness: 0.6, side: THREE.DoubleSide })), 0, 13, 40.2, false);
  for (let i = -3; i <= 3; i++) { if (i === 0) continue; add(g, box(0.5, 1, 0.9), M(0xb8c0c8, { metalness: 0.9, roughness: 0.25 }), i * 1.6, 0.5, 36); add(g, cyl(0.03, 0.03, 0.8, 6), M(0xffd23a, { metalness: 1 }), i * 1.6 - 0.6, 0.85, 36).rotation.z = Math.PI / 2; }
  const flags = [];
  for (let i = 0; i < 6; i++) { const x = -22 + i * 8.8; add(g, cyl(0.07, 0.07, 9, 8), M(0xdddddd, { metalness: 0.8 }), x, 4.5, 44); const f = add(g, new THREE.PlaneGeometry(2, 1.2), M([0xff4fa3, 0x24d1ff, 0xffd23a][i % 3], { side: THREE.DoubleSide }), x + 1, 8.3, 44, false); flags.push(f); }
  const palms = [];
  for (let z = 8; z <= 46; z += 7) for (const s of [-1, 1]) palms.push(palm(g, s * 9.5, z, 1, rnd(7, 9)));
  for (let z = 8; z <= 44; z += 6) for (const s of [-1, 1]) { // jardineras con flores
    add(g, box(2.5, 0.5, 1.2), M(0x8a6a4a), s * 12, 0.25, z);
    for (let k = 0; k < 5; k++) add(g, sph(0.3, 10), M(pick([0xff4fa3, 0xffd23a, 0xff5a3a, 0xffffff, 0xb36bff]), { roughness: 0.8 }), s * 12 + rnd(-1, 1), 0.6, z + rnd(-0.4, 0.4), false);
  }
  // laguna con fuentes, rueda de la fortuna y montaña rusa
  const lagoonM = waterMat(0x2a8fb0, { amp: 0.3, rough: 0.05 });
  const lag = add(g, new THREE.PlaneGeometry(46, 48, 60, 60), lagoonM, -40, -0.15, 30, false); lag.rotation.x = -Math.PI / 2;
  add(g, box(0.6, 0.5, 48), M(0xe9dcc4), -16.7, 0.25, 30);
  const jets = [[-30, 30], [-40, 22], [-40, 38], [-50, 30]];
  const FW = ferrisWheel(g, -46, 62);
  const CO = coaster(g);
  // vendedor de globos, carrito de comida
  const balloons = [];
  for (let i = 0; i < 12; i++) {
    const b = add(g, sph(0.32, 16), M(pick([0xff4fa3, 0xffd23a, 0x24d1ff, 0xff3b30, 0x7bff6a, 0xb36bff]), { roughness: 0.25, metalness: 0.1 }), 5.3 + rnd(-0.6, 0.6), rnd(2.6, 3.6), 22 + rnd(-0.6, 0.6));
    b.scale.y = 1.15; b.userData.y = b.position.y; b.userData.ph = rnd(0, 6); balloons.push(b);
    const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, -0.36, 0), new V3(5 - b.position.x + 0.2, 1.3 - b.position.y + 0.36 * 0, 22 - b.position.z)]), temp(new THREE.LineBasicMaterial({ color: 0xffffff })));
    b.add(str);
  }
  const vendor = person({ h: 1.72, top: 0xffffff, bottom: 0x334455, hairStyle: 'short' }); vendor.p.position.set(5, 0, 22); vendor.p.rotation.y = -Math.PI / 2; g.add(vendor.p);
  vendor.arms[0].sh.rotation.x = -1.2;
  const cart = new THREE.Group(); cart.position.set(-5.5, 0, 30); g.add(cart);
  add(cart, box(2.4, 1.1, 1.2), M(0xff5a3a, { roughness: 0.6 }), 0, 0.85, 0);
  for (const x of [-0.8, 0.8]) add(cart, cyl(0.3, 0.3, 0.12, 16), M(0x222222), x, 0.3, 0.62).rotation.x = Math.PI / 2;
  add(cart, cyl(0.04, 0.04, 2, 6), M(0xdddddd), 0, 2.2, 0); add(cart, cone(1.6, 0.6, 16), stripedMat('#ffffff', '#ff3b30', 16), 0, 3.1, 0);
  add(cart, sph(0.25, 12), M(0xffa020), -0.6, 1.55, 0); add(cart, sph(0.22, 12), M(0xffcf40), -0.2, 1.55, 0.1);
  // artista callejera bailando (modelo con animación real) y público aplaudiendo
  spawnGLB('Michelle.glb', g, mixers, { x: -5.2, z: 15, ry: Math.PI / 2 });
  const people = [];
  const TOPS = [0xff3b30, 0x24d1ff, 0xffffff, 0xffd23a, 0x2c6e49, 0x7a3fa0, 0xff7ab6, 0x1d2f6b, 0xf5a623];
  for (const [x, z, ry, kid] of [[-2.8, 13.2, -2.2, 0], [-2.4, 16.8, -1, 1], [-2.2, 15, -Math.PI / 2, 0], [-3.4, 18, -0.6, 1]]) {
    const P = person({ h: kid ? rnd(1.15, 1.3) : rnd(1.6, 1.85), kid: !!kid, top: pick(TOPS), bottom: pick([0x2a3550, 0x8a7a5a, 0x222222]), shorts: Math.random() < 0.5, sleeves: true, hairStyle: pick(['short', 'long', 'bun', 'pony', 'buzz']) });
    P.p.position.set(x, 0, z); P.p.rotation.y = ry; g.add(P.p); people.push({ P, mode: 'clap', ph: rnd(0, 6) });
  }
  for (let i = 0; i < 22; i++) { // visitantes caminando (adultos y niños)
    const kid = Math.random() < 0.3, lane = pick([-6, -4.5, -3, 3, 4.5, 6]);
    const P = person({ h: kid ? rnd(1.05, 1.35) : rnd(1.55, 1.92), kid, top: pick(TOPS), bottom: pick([0x2a3550, 0x8a7a5a, 0x222222, 0x5577aa]), shorts: Math.random() < 0.6, sleeves: Math.random() < 0.7, hairStyle: pick(['short', 'long', 'bun', 'pony', 'buzz', 'bald']) });
    const dir = Math.random() < 0.5 ? 1 : -1;
    P.p.position.set(lane + rnd(-0.4, 0.4), 0, rnd(8, 44)); P.p.rotation.y = dir > 0 ? 0 : Math.PI; g.add(P.p);
    people.push({ P, mode: 'walk', dir, sp: kid ? rnd(1.1, 1.4) : rnd(1.0, 1.4), ph: rnd(0, 6) });
  }
  /* ---------- 2) Mundo mágico: puerta, calle nevada y castillo gótico ---------- */
  const stone = temp(new THREE.MeshStandardMaterial({ map: limestoneTex(), roughness: 0.95 })), dark = M(0x5d586a, { roughness: 0.95 }), gold = M(0xd8b04a, { metalness: 0.9, roughness: 0.3 });
  for (const x of [-3.4, 3.4]) {
    add(g, box(1.3, 6.6, 1.3), stone, x, 3.3, 2);
    const cp = add(g, cone(1.1, 1.7, 4), M(0x3b2a6b), x, 7.45, 2); cp.rotation.y = Math.PI / 4;
  }
  add(g, box(8.1, 1.2, 1.4), stone, 0, 6.2, 2);
  add(g, new THREE.PlaneGeometry(5.6, 0.9), temp(new THREE.MeshStandardMaterial({ map: textTex('✦ MUNDO MÁGICO ✦', 1024, 160, '#2a1450', '#ffd36b', 'bold 80px Georgia,serif'), emissive: 0x332200, roughness: 0.6 })), 0, 6.2, 2.72, false);
  for (const s of [-1, 1]) add(g, box(30, 3.6, 1), stone, s * 19.05, 1.8, 2);
  const gates = [-1, 1].map(s => {
    const h = new THREE.Group(); h.position.set(s * 2.75, 0, 2); g.add(h);
    add(h, box(2.72, 5, 0.18), M(0x4a2e18, { roughness: 0.85 }), -s * 1.36, 2.5, 0);
    for (const y of [0.8, 2.5, 4.2]) add(h, box(2.72, 0.14, 0.24), M(0x2a2a2a, { metalness: 0.8, roughness: 0.4 }), -s * 1.36, y, 0);
    add(h, sph(0.08, 10), gold, -s * 2.4, 2.4, 0.15);
    return h;
  });
  // antorchas con fuego de partículas
  const fires = [];
  const torch = (x, y, z, big) => {
    add(g, cyl(big ? 0.35 : 0.06, big ? 0.15 : 0.08, big ? 0.4 : 0.5, 10), M(0x2a2a2a, { metalness: 0.8, roughness: 0.4 }), x, y, z);
    const l = glow(0xff8a2a, big ? 2.4 : 1.2, 0.7); l.position.set(x, y + 0.35, z); g.add(l);
    fires.push({ p: new V3(x, y + 0.25, z), l, big });
  };
  torch(-3.4, 5.2, 2.8); torch(3.4, 5.2, 2.8);
  for (const x of [-3.2, 3.2]) { add(g, cyl(0.12, 0.2, 1.2, 10), M(0x2a2a2a, { metalness: 0.7 }), x, 0.6, -26); torch(x, 1.35, -26, true); }
  for (const [x, z] of [[-3.2, -26], [3.2, -26]]) { const pl = new THREE.PointLight(0xff8a3a, 22, 14, 2); pl.position.set(x, 2.5, z); g.add(pl); fires.push({ light: pl }); }
  const SIGNS = ['Varitas', 'Dulces', 'Escobas', 'Libros', 'Plumas', 'Túnicas', 'Pociones', 'Lechuzas', 'Bromas', 'Mapas'];
  const COLS = [0x8a7360, 0x6f6a80, 0x7d5f52, 0x5f6f68, 0x8a6a7a];
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) house(g, s * 7, -3 - i * 6, rnd(4.6, 5.6), rnd(4.2, 6.2), COLS[(i + (s > 0 ? 2 : 0)) % 5], SIGNS[i * 2 + (s > 0 ? 1 : 0)]);
  const lamps = [];
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    const x = s * 3.7, z = -1 - i * 5.5;
    add(g, cyl(0.06, 0.09, 3.3, 8), M(0x1c1c22, { metalness: 0.7, roughness: 0.4 }), x, 1.65, z);
    add(g, box(0.34, 0.45, 0.34), M(0xffc46b, { emissive: 0xff9a2a, emissiveIntensity: 2.2 }), x, 3.4, z, false);
    add(g, cone(0.3, 0.3, 4), M(0x1c1c22, { metalness: 0.7 }), x, 3.78, z).rotation.y = Math.PI / 4;
    const gl = glow(0xffa94a, 1.7, 0.85); gl.position.set(x, 3.4, z); g.add(gl); lamps.push(gl);
  }
  for (const [x, z] of [[-3.7, -6.5], [3.7, -6.5], [-3.7, -17.5], [3.7, -17.5]]) { const pl = new THREE.PointLight(0xffa04a, 14, 11, 2); pl.position.set(x, 3.2, z); g.add(pl); }
  const candles = [];
  for (let i = 0; i < 30; i++) {
    const c = new THREE.Group(); c.position.set(rnd(-4, 4), rnd(4.5, 7.5), rnd(-30, 0)); g.add(c);
    add(c, cyl(0.035, 0.035, 0.25, 8), M(0xf5ecd5, { roughness: 0.6 }), 0, 0, 0, false);
    const f = glow(0xffb85a, 0.35); f.position.y = 0.17; c.add(f); c.userData.ph = Math.random() * 6; candles.push(c);
  }
  const runes = add(g, new THREE.RingGeometry(2.0, 2.3, 64), temp(new THREE.MeshBasicMaterial({ color: 0xb38bff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })), 0, 0.03, -23, false);
  runes.rotation.x = -Math.PI / 2;
  const castle = gothicCastle(g, 0, -62);
  for (let i = 0; i < 40; i++) { const a = rnd(0, Math.PI * 2), r = rnd(40, 90); const x = Math.cos(a) * r, z = -30 + Math.sin(a) * r; if (Math.abs(x) < 34 && z > -50) continue; pine(g, x, z, rnd(1, 1.7)); }

  // Mago enemigo
  const E = wizard(); const en = E.w; en.position.set(0, 0, -23); en.visible = false; g.add(en);
  const stunStars = [0, 1, 2].map(() => { const s = starMesh(); s.scale.setScalar(0.25); s.visible = false; en.add(s); return s; });
  // Varita del jugador: madera tallada de unos 30 cm, sin brillo exagerado
  const COL = { expelliarmus: 0xff3030, stupefy: 0x8fd0ff, protego: 0x66ccff };
  const wandTex = keep(canvasTex(64, 256, (q, w, h) => { q.fillStyle = '#6a4a2a'; q.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { q.fillStyle = Math.random() < 0.5 ? 'rgba(40,25,10,.4)' : 'rgba(160,120,80,.25)'; q.fillRect(Math.random() * w, Math.random() * h, 2, 8 + Math.random() * 20); } }));
  const wood = temp(new THREE.MeshStandardMaterial({ map: wandTex, bumpMap: wandTex, bumpScale: 1.2, roughness: 0.75 }));
  const wand = new THREE.Group(); camera.add(wand);
  const wg = new THREE.LatheGeometry([new V2(0.0045, 0.3), new V2(0.006, 0.2), new V2(0.008, 0.11), new V2(0.011, 0.1), new V2(0.012, 0.06), new V2(0.0105, 0.03), new V2(0.013, 0.005), new V2(0.001, 0)], 12); wg.rotateX(Math.PI / 2);
  add(wand, wg, wood, 0, 0, 0, false);
  const tip = glow(COL.expelliarmus, 0.06, 0.8); tip.position.z = 0.305; wand.add(tip);
  const shield = new THREE.Group(); shield.position.set(0, -0.02, -0.6); shield.visible = false; camera.add(shield);
  add(shield, new THREE.CircleGeometry(0.42, 48), temp(new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })), 0, 0, 0, false);
  const hex = add(shield, new THREE.IcosahedronGeometry(0.42, 1), temp(new THREE.MeshBasicMaterial({ color: 0xaee8ff, wireframe: true, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending })), 0, 0, 0, false);
  hex.scale.z = 0.25;

  const ui = document.getElementById('spells'), btns = [...ui.querySelectorAll('.sp')];
  let spell = 'expelliarmus';
  const setSpell = s => { spell = s; btns.forEach(x => x.classList.toggle('on', x.dataset.s === s)); tip.material.color.set(COL[s]); };
  btns.forEach(b => { b.onclick = () => { setSpell(b.dataset.s); ctx.sfx('click'); }; });
  setSpell('expelliarmus');
  document.getElementById('bCast').onclick = () => cast();

  let alive = true, running = false, hits = 0, hp = 4, cd = 0, shieldT = 0, shieldCd = 0, stun = 0, disarm = 0, fireT = 3, charge = 0, dead = 0, won = false, tx = 0, moveT = 0, kick = 0, castAnim = 0, gateOpen = 0, gateSnd = false;
  const shots = [], foes = [], flying = [];
  const enC = new V3(), camW = () => camera.getWorldPosition(_w);
  const info = () => ctx.info(`${'❤️'.repeat(hp)}${'🖤'.repeat(4 - hp)} · Aciertos ${hits}/6${hits >= 3 ? ' · 😡 fase 2' : ''}`);
  const intro = withIntro(ctx, opt, [
    { t: 0, p: [0, 1.6, 54], yaw: 0, pitch: 0.12 },
    { t: 3, p: [0, 1.6, 41], yaw: 0, pitch: 0.18 },
    { t: 5.5, p: [0, 1.6, 30], yaw: 0.7, pitch: 0.1 },
    { t: 8, p: [0, 1.6, 20], yaw: -0.7, pitch: 0.15 },
    { t: 10.5, p: [0, 1.6, 9], yaw: 0, pitch: 0.12 },
    { t: 12, p: [0, 1.6, 8.5], yaw: 0, pitch: 0.12 },
    { t: 16, p: [0, 1.6, -13], yaw: 0, pitch: 0.03 },
    { t: 16.8, p: [0, 1.6, -14], yaw: 0, pitch: 0.05 },
    { t: 21, p: [0, 1.6, -14], yaw: Math.PI * 2, pitch: 0.05 },
    { t: 21.5, p: [0, 1.6, -14], yaw: Math.PI * 2, pitch: 0 }
  ], 0, 0, () => {
    ctx.camera.position.set(0, 1.6, -14); gateOpen = 1;
    en.visible = true; ctx.sfx('portal');
    ctx.burst(en.localToWorld(_v.set(0, 1.2, 0)), [0x9b5cff, 0x66ffcc, 0xffffff], 70, 2.2);
    document.getElementById('crosshair').classList.remove('hidden');
  });
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
    hits++; E.segs[6 - hits].visible = false; if (hits === 3) { ctx.toast('😡 ¡El mago se enfurece! Ahora se mueve y ataca más rápido.', 3500); E.tip.material.color.set(0xff3344); } ctx.sfx('hit'); info();
    ctx.burst(en.localToWorld(_v.set(0, 1.2, 0)), [COL[kind], 0xffffff], 50, 2);
    E.robeM.emissive.set(kind === 'stupefy' ? 0x1f4f99 : 0x661111);
    if (kind === 'stupefy') stun = 2.6;
    else {
      disarm = 2; E.wand.visible = false; charge = 0;
      const fw = add(g, cyl(0.012, 0.018, 0.4, 6), M(0x2a1a0a), 0, 0, 0, false);
      E.wand.getWorldPosition(fw.position); fw.userData = { v: new V3(rnd(-1.5, 1.5), 4.5, rnd(1, 2)), life: 1.8 }; flying.push(fw);
    }
    if (hits >= 6) { running = false; dead = 0.001; }
  }
  function remove(list, i) { const o = list[i]; g.remove(o.m || o); disposeTree(o.m || o); list.splice(i, 1); }
  const refreshHint = () => ctx.hint(ctx.isHand() ? '☝️ Apunta al mago con tu índice (dispara solo) · ✋ palma abierta = Protego' : 'Toca al mago o pulsa ✨ Lanzar · arrastra o gira el celular para mirar');
  const coTmp = new V3();

  return {
    look: true, camLock: !opt.quick, dwellTime: 0.35, repeatDwell: 0.55, refreshHint,
    start() { running = true; this.camLock = false; ui.classList.remove('hidden'); info(); refreshHint(); setTimeout(() => { if (alive && running) ctx.hint(''); }, 5000); },
    tap() { if (intro.on) { intro.finish(); this.camLock = false; return; } cast(); },
    palm() { protego(); },
    hoverable(p) {
      if (!running || dead) return null;
      const c = en.localToWorld(_v.set(0, 1.2, 0));
      return p.ray.ray.distanceSqToPoint(c) < 0.9 ? 'enemy' : null;
    },
    update(dt, t) {
      mixers.forEach(m => m.update(dt));
      if (intro.on) {
        intro.update(dt);
        const it = intro.path.t;
        if ((it < 10.5 || (it > 12 && it < 16)) && it > 0.2) camera.position.y = 1.6 + Math.abs(Math.sin(it * 5.5)) * 0.045;
        gateOpen = smooth((it - 10.3) / 2.2);
        if (it > 10.3 && !gateSnd) { gateSnd = true; ctx.sfx('gate'); }
        if (!intro.on) this.camLock = false;
      }
      gates.forEach((h, i) => { h.rotation.y = (i ? -1 : 1) * 1.75 * gateOpen; });
      // ambiente del parque (solo se anima lo que está cerca de la cámara)
      const near = camera.position.z > -5;
      if (near) {
        FW.rot.rotation.z += dt * 0.06; FW.gond.forEach(c => (c.rotation.z = -FW.rot.rotation.z));
        CO.u = (CO.u + dt * 0.05) % 1;
        CO.cars.forEach((c, i) => { const u = (CO.u - i * 0.012 + 1) % 1; c.position.copy(CO.curve.getPointAt(u)); c.lookAt(coTmp.copy(CO.curve.getPointAt((u + 0.003) % 1))); });
        lagoonM.userData.uT.value = t;
        if (Math.random() < 0.9) for (const [x, z] of jets) ctx.burst(_v.set(x, 0.2, z), [0xffffff, 0xbfe9ff], 2, 3.2, 6);
        balloons.forEach(b => { b.position.y = b.userData.y + Math.sin(t * 1.5 + b.userData.ph) * 0.08; b.rotation.z = Math.sin(t + b.userData.ph) * 0.1; });
        flags.forEach((f, i) => (f.rotation.y = Math.sin(t * 3 + i) * 0.35));
        palms.forEach(p => { const c = p.userData.crown; c.rotation.z = Math.sin(t * 0.9 + p.userData.ph) * 0.05; });
        for (const o of people) {
          if (o.mode === 'clap') { clapAnim(o.P, t, o.ph); continue; }
          o.ph += dt * o.sp * 5.2; walkAnim(o.P, o.ph);
          o.P.p.position.z += o.dir * o.sp * dt;
          if (o.P.p.position.z > 46 || o.P.p.position.z < 7) { o.dir *= -1; o.P.p.rotation.y = o.dir > 0 ? 0 : Math.PI; }
        }
      }
      for (const f of fires) {
        if (f.light) { f.light.intensity = 18 + Math.sin(t * 17) * 4 + Math.random() * 3; continue; }
        if (Math.random() < (f.big ? 0.95 : 0.6)) ctx.burst(_v.copy(f.p).add(_u.set(rnd(-0.08, 0.08) * (f.big ? 3 : 1), 0, rnd(-0.08, 0.08) * (f.big ? 3 : 1))), [0xffcf5a, 0xff7a1a, 0xff4a0a], f.big ? 3 : 1, 0.35, -2.2);
        f.l.scale.setScalar((f.big ? 2.4 : 1.2) * (0.9 + Math.random() * 0.2));
      }
      lamps.forEach((l, i) => l.scale.setScalar(1.6 + Math.sin(t * 9 + i) * 0.12));
      candles.forEach(c => { c.position.y += Math.sin(t * 1.3 + c.userData.ph) * 0.003; });
      castle.traverse(o => { if (o.userData.flag) o.rotation.y = Math.sin(t * 2.5) * 0.3; });
      runes.rotation.z += dt * 0.3; runes.material.opacity = 0.5 + Math.sin(t * 2) * 0.2;
      // varita
      cd = Math.max(0, cd - dt); shieldCd = Math.max(0, shieldCd - dt); shieldT = Math.max(0, shieldT - dt);
      btns[2].classList.toggle('cool', shieldCd > 0 && shieldT <= 0);
      shield.visible = shieldT > 0; hex.rotation.z += dt; shield.scale.setScalar(Math.min(1, (1.7 - shieldT) * 6) * (1 + Math.sin(t * 20) * 0.02));
      kick = Math.max(0, kick - dt * 5);
      const n = ctx.ptr.ndc, hh = 0.45 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
      wand.visible = !intro.on;
      wand.position.set((n.x * 0.5 + 0.38) * hw, (n.y * 0.4 - 0.58) * hh, -0.42);
      wand.lookAt(aimPoint()); wand.rotateX(-kick * 0.5);
      const cw = camW();
      for (let i = flying.length - 1; i >= 0; i--) { const f = flying[i], u = f.userData; u.life -= dt; u.v.y -= 9 * dt; f.position.addScaledVector(u.v, dt); f.rotation.x += dt * 12; if (f.position.y < 0.05) { f.position.y = 0.05; u.v.set(0, 0, 0); } if (u.life <= 0) remove(flying, i); }
      if (en.visible) {
        en.lookAt(cw.x, 0, cw.z); E.bar.lookAt(cw); E.cape.rotation.y = Math.sin(t * 1.7) * 0.08;
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
        if (!stun) { moveT -= dt; if (moveT <= 0) { moveT = hits >= 3 ? rnd(0.9, 1.6) : rnd(1.6, 2.8); tx = rnd(-3.5, 3.5); } en.position.x = lerp(en.position.x, tx, dt * (hits >= 3 ? 2.6 : 1.5)); en.position.y = Math.sin(t * 2) * 0.05; }
        if (!stun && !disarm) {
          fireT -= dt;
          if (fireT < 0.9) { if (!charge) ctx.sfx('charge'); charge = 1; }
          castAnim = lerp(castAnim, fireT < 0.9 ? 1 : 0, dt * 6);
          E.tip.scale.setScalar(0.25 + (fireT < 0.9 ? (0.9 - fireT) * 0.9 : 0));
          if (fireT <= 0) {
            fireT = hits >= 3 ? rnd(1.6, 2.3) : rnd(2.4, 3.3); charge = 0;
            const from = E.tip.getWorldPosition(new V3()), to = cw.clone().add(_v.set(rnd(-0.2, 0.2), -0.1, 0));
            const m = add(g, sph(0.1, 10), B(0x66ff88), from.x, from.y, from.z, false); m.add(glow(0x66ff88, 1.3));
            foes.push({ m, v: to.sub(from).normalize().multiplyScalar(7) });
          }
        } else castAnim = lerp(castAnim, 0, dt * 6);
        E.arms[1].rotation.x = -castAnim * 1.9; E.arms[1].rotation.z = 0.15 + castAnim * 0.2;
        E.arms[0].rotation.x = Math.sin(t * 1.5) * 0.08;
      }
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i]; s.life -= dt;
        enC.copy(en.position).setY(1.15);
        if (s.assist && !dead) { _v.copy(enC).sub(s.m.position).normalize().multiplyScalar(16); s.v.lerp(_v, 0.15); }
        s.m.position.addScaledVector(s.v, dt);
        ctx.burst(s.m.position, COL[s.kind], 1, 0.25);
        if (!dead && running && en.visible && s.m.position.distanceTo(enC) < 0.6) { enemyHit(s.kind); remove(shots, i); }
        else if (s.life <= 0) remove(shots, i);
      }
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
/* ---- Fauna de Florida ---- */
function turtle() { // tortuga marina (caguama)
  const t = new THREE.Group();
  const shellT = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#5a4528'; g.fillRect(0, 0, w, h); for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) { g.fillStyle = `rgb(${110 + Math.random() * 40 | 0},${80 + Math.random() * 30 | 0},${40 + Math.random() * 20 | 0})`; g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * 6.283; g.lineTo(x * 52 + 26 + (y % 2) * 26 + Math.cos(a) * 22, y * 52 + 26 + Math.sin(a) * 22); } g.fill(); } });
  const shell = add(t, sph(0.45, 24), temp(new THREE.MeshStandardMaterial({ map: shellT, roughness: 0.55 })), 0, 0.17, 0); shell.scale.set(0.95, 0.38, 1.2);
  add(t, sph(0.42, 16), M(0xd8c8a0, { roughness: 0.8 }), 0, 0.12, 0).scale.set(0.9, 0.2, 1.1);
  const skin = M(0x6b6a4a, { roughness: 0.7 });
  add(t, sph(0.13, 14), skin, 0, 0.18, 0.62).scale.set(1, 0.8, 1.2);
  const fl = [[-1, 0.3], [1, 0.3], [-1, -0.38], [1, -0.38]].map(([s, z], i) => { const f = new THREE.Group(); f.position.set(s * 0.35, 0.12, z); t.add(f); add(f, box(i < 2 ? 0.55 : 0.28, 0.04, i < 2 ? 0.16 : 0.14), skin, s * (i < 2 ? 0.25 : 0.12), 0, 0); return f; });
  t.userData.fl = fl; return t;
}
function gator() { // caimán americano
  const a = new THREE.Group(), sk = M(0x3a4024, { roughness: 0.65 }), belly = M(0xb9b28a, { roughness: 0.8 });
  add(a, sph(0.4, 20), sk, 0, 0.22, 0).scale.set(0.95, 0.55, 2.2);
  add(a, sph(0.35, 16), belly, 0, 0.14, 0).scale.set(0.95, 0.35, 2);
  const head = new THREE.Group(); head.position.set(0, 0.25, 0.95); a.add(head);
  add(head, box(0.42, 0.2, 0.45), sk, 0, 0, 0.1);
  add(head, box(0.3, 0.12, 0.55), sk, 0, -0.03, 0.55);
  const jaw = add(head, box(0.3, 0.06, 0.6), belly, 0, -0.1, 0.5);
  for (const s of [-1, 1]) { add(head, sph(0.065, 10), sk, s * 0.14, 0.12, 0.05); add(head, sph(0.03, 8), M(0xd9c040, { roughness: 0.2 }), s * 0.15, 0.15, 0.1, false); }
  for (let i = 0; i < 9; i++) add(a, box(0.05, 0.06, 0.05), M(0x2c3018), (i % 2 ? 0.1 : -0.1), 0.42, 0.6 - i * 0.15, false);
  const tail = []; let par = a, z = -0.75;
  for (let i = 0; i < 6; i++) { const sg = new THREE.Group(); sg.position.set(0, i ? 0 : 0.2, i ? -0.28 : z); par.add(sg); add(sg, box(0.36 - i * 0.05, 0.22 - i * 0.025, 0.3), sk, 0, 0, -0.14); add(sg, box(0.03, 0.08, 0.25), M(0x2c3018), 0, 0.14 - i * 0.01, -0.14, false); tail.push(sg); par = sg; }
  for (const [x, zz] of [[-0.42, 0.5], [0.42, 0.5], [-0.42, -0.45], [0.42, -0.45]]) { const l = add(a, cap(0.07, 0.22), sk, x, 0.08, zz); l.rotation.z = Math.sign(x) * 1.2; }
  a.userData = { tail, jaw }; return a;
}
function dolphin() { // delfín nariz de botella
  const d = new THREE.Group(), gm = M(0x7c8894, { roughness: 0.3 }), wm = M(0xd6dde2, { roughness: 0.35 });
  const body = new THREE.LatheGeometry([new V2(0.001, 1.25), new V2(0.06, 1.1), new V2(0.13, 1.0), new V2(0.25, 0.75), new V2(0.33, 0.3), new V2(0.3, -0.2), new V2(0.18, -0.7), new V2(0.08, -1.05), new V2(0.001, -1.15)], 18); body.rotateX(Math.PI / 2);
  add(d, body, gm); const bl = add(d, body, wm, 0, -0.04, 0); bl.scale.set(0.85, 0.75, 0.97);
  const fs = new THREE.Shape(); fs.moveTo(0, 0); fs.quadraticCurveTo(0.05, 0.25, -0.22, 0.38); fs.quadraticCurveTo(-0.15, 0.15, -0.35, 0); fs.lineTo(0, 0);
  const fin = add(d, new THREE.ExtrudeGeometry(fs, { depth: 0.04, bevelEnabled: false }), gm, -0.02, 0.28, 0.05); fin.rotation.y = Math.PI / 2;
  add(d, box(0.75, 0.04, 0.22), gm, 0, 0, -1.15);
  for (const s of [-1, 1]) { const p = add(d, box(0.32, 0.03, 0.14), gm, s * 0.3, -0.12, 0.35); p.rotation.z = s * -0.5; }
  return d;
}
function cypress(g, x, z, s) { // ciprés calvo con musgo
  const c = new THREE.Group(); c.position.set(x, 0, z); c.scale.setScalar(s); g.add(c);
  add(c, new THREE.LatheGeometry([new V2(0.9, -0.4), new V2(0.55, 0.6), new V2(0.3, 2), new V2(0.22, 9), new V2(0.01, 10)], 10), M(0x6b5a46, { roughness: 1 }));
  for (let i = 0; i < 6; i++) { const b = add(c, sph(rnd(1.4, 2.2), 10), M(0x3e5a2a, { roughness: 1 }), rnd(-1.6, 1.6), rnd(7, 10), rnd(-1.6, 1.6)); b.scale.y = 0.45; }
  for (let i = 0; i < 6; i++) add(c, cyl(0.04, 0.01, rnd(1, 2.2), 4), M(0x9aa08a, { roughness: 1 }), rnd(-1.8, 1.8), rnd(5.5, 7), rnd(-1.8, 1.8), false);
}
function roadSign(g, x, z, txt, bg, fg = '#fff') {
  const s = new THREE.Group(); s.position.set(x, 0, z); g.add(s);
  for (const k of [-1.6, 1.6]) add(s, cyl(0.08, 0.08, 6, 8), M(0x888888, { metalness: 0.8 }), k, 3, 0);
  const b = add(s, new THREE.PlaneGeometry(4.6, 1.6), temp(new THREE.MeshStandardMaterial({ map: textTex(txt, 640, 220, bg, fg, 'bold 76px system-ui'), roughness: 0.6, side: THREE.DoubleSide })), 0, 5.2, 0, false);
  b.rotation.y = -Math.PI / 2; return s;
}

/* ================= MUNDO 2: ROAD TRIP POR FLORIDA ================= */
const LANE = 13.6, START = -60, END = 445;
const roadY = x => 2.2 * (smooth((x - 222) / 20) - smooth((x - 358) / 20));
function miami(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x1a72e0, 0xbfe9ff, 0xefe2c0); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0xd2ecff, 90, 380);
  const sunDir = new V3(-0.35, 0.6, -1).normalize();
  const sun = lightRig(g, { sky: 0xcbe7ff, ground: 0xe8d3a0, hemi: 1.0, sun: 0xfff0d2, sunI: 2.8, dir: [sunDir.x * 40, sunDir.y * 40, sunDir.z * 40], size: 30, target: [0, 0, 8] });
  const sunM = add(g, sph(10, 24), B(0xfff8e0, { fog: false }), 0, 0, 0, false); const sg = glow(0xfff0b0, 140, 0.7); g.add(sg);
  const mixers = [], waters = [], animals = [], zones = [];
  const zone = (cx) => { const z = new THREE.Group(); z.userData.cx = cx; g.add(z); zones.push(z); return z; };
  const addAnimal = (obj, sp, r = 1.8, y = 0) => { const h = add(obj, sph(r / obj.scale.x, 8), hitM, 0, y, 0, false); h.userData.sp = sp; animals.push(h); return obj; };
  const hitM = temp(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  // Carretera continua (con puente sobre los Cayos)
  const asphalt = M(0x56575d, { roughness: 0.95 }), yellow = M(0xffd23a), white = M(0xffffff);
  const seg = (x0, x1, y0, y1) => {
    const L = Math.hypot(x1 - x0, y1 - y0), r = add(g, box(L, 0.3, 8), asphalt, (x0 + x1) / 2, (y0 + y1) / 2 - 0.12, 15.5);
    r.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    for (let x = x0; x < x1 - 3; x += 6) add(r, box(2.4, 0.05, 0.15), yellow, x + 1.2 - (x0 + x1) / 2, 0.16, 0, false);
    for (const z of [-3.8, 3.8]) add(r, box(L, 0.06, 0.12), white, 0, 0.16, z, false);
    return r;
  };
  seg(-100, 222, 0, 0); for (let i = 0; i < 10; i++) { const a = 222 + i * 2, b = a + 2; seg(a, b, roadY(a), roadY(b)); }
  seg(242, 358, 2.2, 2.2); for (let i = 0; i < 10; i++) { const a = 358 + i * 2, b = a + 2; seg(a, b, roadY(a), roadY(b)); } seg(378, 470, 0, 0);

  /* ----- Zona 1: Miami Beach ----- */
  const Z1 = zone(0);
  const ocean = waterMat(0x0b8db0); waters.push(ocean);
  const oc = add(Z1, new THREE.PlaneGeometry(240, 420, 120, 100), ocean, -20, -0.35, -224, false); oc.rotation.x = -Math.PI / 2;
  const foamM = temp(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 1, depthWrite: false }));
  const foam = add(Z1, new THREE.PlaneGeometry(240, 1.6), foamM, -20, 0.02, -14, false); foam.rotation.x = -Math.PI / 2;
  const sandT = rep(canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#e8d2a2'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(170,140,90,.25)' : 'rgba(255,250,235,.35)'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }), 40, 6);
  const sand = add(Z1, new THREE.PlaneGeometry(240, 24), temp(new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 })), -20, 0, -3, false); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true;
  const wet = add(Z1, new THREE.PlaneGeometry(240, 6), M(0xb39a6c, { roughness: 0.35 }), -20, -0.4, -16.6, false); wet.rotation.x = -Math.PI / 2 + 0.13;
  add(Z1, box(240, 0.25, 3), M(0xf3c6c6, { roughness: 0.9 }), -20, 0.12, 10);
  add(Z1, box(240, 0.25, 2.5), M(0xe9e0d6, { roughness: 0.9 }), -20, 0.12, 20.5);
  const NEON = [0xff4fa3, 0x24d1ff, 0x7bff6a, 0xffb000, 0xb36bff], DCOL = [0xffc2d1, 0xa8ece6, 0xfff1b8, 0xd6c6ff, 0xffd3b0, 0xbfe6ff];
  const NAMES = ['SOL', 'PALMA', 'BRISA', 'CORAL', 'MAREA', 'FLORIDA', 'TROPICAL', 'AZUL', 'OCEAN', 'LUNA'];
  for (let x = -100, i = 0; x < 70; i++) { const w = rnd(11, 16); decoBuilding(Z1, x + w / 2, w, rnd(11, 22), DCOL[i % 6], NEON[i % 5], NAMES[i % 10]); x += w + 1.2; }
  const palms = [];
  for (let x = -95; x <= 75; x += 9) palms.push(palm(Z1, x + rnd(-1, 1), 8.6, 1, rnd(7, 10)));
  for (const [x, z] of [[-14, -4], [-11, -6], [15, -2], [19, -5], [40, -3], [55, -6]]) palms.push(palm(Z1, x, z, 1, rnd(6, 9)));
  const towers = [lifeguard(Z1, -9, -5, '#ff7ab6', '#24d1ff'), lifeguard(Z1, 30, -4, '#ffd23a', '#ff5a3a')];
  for (const [x, z, a, b] of [[-3, -2, '#ff5a3a', '#ffffff'], [10, -6, '#24d1ff', '#ffffff'], [-30, -8, '#ffd23a', '#ff4fa3'], [46, -7, '#7bff6a', '#ffffff']]) {
    add(Z1, cyl(0.04, 0.04, 2.4, 6), M(0xffffff), x, 1.2, z);
    add(Z1, cone(1.6, 0.6, 16), stripedMat(a, b, 16), x, 2.4, z);
  }
  const traffic = [[0xff4fa3, -30, 17.4, -6], [0x24d1ff, 20, 17.4, -6], [0xffe14d, 60, 17.4, -6]].map(a => car(Z1, ...a));
  roadSign(Z1, -40, 21, '📍 MIAMI BEACH', '#0a7a3a');
  const turtles = [];
  for (const [x, z] of [[-9, -3], [-3, -5], [4, -2], [10, -4], [16, -3]]) { const t = addAnimal(turtle(), '🐢', 1.6); t.scale.setScalar(1.4); t.position.set(x, 0.02, z); t.rotation.y = Math.PI; Z1.add(t); turtles.push(t); }
  const birds = [];
  for (let i = 0; i < 6; i++) { const b = spawnGLB('Parrot.glb', Z1, mixers, { s: 0.012 }); addAnimal(b, '🦜', 2.2); b.userData = { ...b.userData, r: rnd(4, 8), h: rnd(5, 9), cx: rnd(-14, 14), cz: rnd(4, 10), sp: rnd(0.35, 0.6) * (Math.random() < 0.5 ? 1 : -1), ph: rnd(0, 6) }; birds.push(b); }

  /* ----- Zona 2: Everglades ----- */
  const Z2 = zone(150);
  const swamp = waterMat(0x34401f, { amp: 0.15, rough: 0.12 }); waters.push(swamp);
  const sw = add(Z2, new THREE.PlaneGeometry(150, 300, 40, 40), swamp, 155, -0.25, 0, false); sw.rotation.x = -Math.PI / 2;
  add(Z2, box(150, 1, 12), M(0x5a6a3a, { roughness: 1 }), 155, -0.55, 15.5);
  const grassG = keep(new THREE.ConeGeometry(0.07, 1.4, 4)), grassM = temp(new THREE.MeshStandardMaterial({ roughness: 1 }));
  const NG = 1600, sawI = new THREE.InstancedMesh(grassG, grassM, NG), m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), col = new THREE.Color();
  for (let i = 0; i < NG; i++) {
    let x, z; do { x = rnd(82, 228); z = rnd(-70, 90); } while (Math.abs(z - 15.5) < 8);
    q4.setFromEuler(new THREE.Euler(rnd(-0.2, 0.2), 0, rnd(-0.2, 0.2))); m4.compose(_v.set(x, 0.3, z), q4, _u.set(1, rnd(0.6, 1.4), 1)); sawI.setMatrixAt(i, m4);
    sawI.setColorAt(i, col.setHSL(rnd(0.15, 0.22), 0.5, rnd(0.3, 0.5)));
  }
  Z2.add(sawI);
  for (let i = 0; i < 28; i++) { let z; do { z = rnd(-60, 80); } while (Math.abs(z - 15.5) < 10); cypress(Z2, rnd(85, 225), z, rnd(0.9, 1.4)); }
  const gators = [];
  for (const [x, z, swim] of [[120, 5, 1], [136, 6, 1], [142, 25, 0], [150, 7, 0], [156, 26, 1], [163, 5, 1], [170, 24, 0], [190, 26, 1]]) {
    const a = addAnimal(gator(), '🐊', 2); a.scale.setScalar(1.6); a.position.set(x, swim ? -0.32 : 0.05, z); a.rotation.y = rnd(0, 6.28); a.userData.swim = swim; a.userData.ph = rnd(0, 6);
    if (!swim) add(Z2, cyl(2.6, 2.8, 0.4, 20), M(0x5a4a30, { roughness: 1 }), x, -0.15, z);
    Z2.add(a); gators.push(a);
  }
  for (let i = 0; i < 7; i++) { const b = spawnGLB('Flamingo.glb', Z2, mixers, { s: 0.014 }); addAnimal(b, '🦩', 2.8); b.userData = { ...b.userData, r: rnd(7, 13), h: rnd(4, 8), cx: rnd(140, 160), cz: rnd(-4, 30), sp: rnd(0.25, 0.4), ph: i * 0.9 }; birds.push(b); }
  const airboat = new THREE.Group(); airboat.position.set(130, -0.15, -8); Z2.add(airboat);
  add(airboat, box(4, 0.5, 2), M(0xdddddd, { metalness: 0.6, roughness: 0.3 }), 0, 0.2, 0);
  add(airboat, new THREE.TorusGeometry(1.1, 0.06, 8, 24), M(0x333333, { metalness: 0.8 }), -1.6, 1.5, 0).rotation.y = Math.PI / 2;
  const prop = add(airboat, box(0.1, 2, 0.2), M(0x222222), -1.6, 1.5, 0); prop.rotation.y = 0;
  const pilot = person({ top: 0x2c6e49, bottom: 0x8a7a5a, sleeves: true }); pilot.p.position.set(0.5, 0.45, 0); pilot.p.rotation.y = Math.PI / 2; airboat.add(pilot.p);
  roadSign(Z2, 92, 21, '📍 EVERGLADES', '#6b4a2a');

  /* ----- Zona 3: Cayos de Florida ----- */
  const Z3 = zone(305);
  const keys = waterMat(0x2fd0c8, { opacity: 0.78, amp: 0.4, rough: 0.04 }); waters.push(keys);
  const kw = add(Z3, new THREE.PlaneGeometry(170, 400, 60, 100), keys, 305, -0.3, 0, false); kw.rotation.x = -Math.PI / 2;
  const bed = add(Z3, new THREE.PlaneGeometry(170, 400), M(0xe9dcb0, { roughness: 1 }), 305, -1.6, 0, false); bed.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 30; i++) { const p = add(Z3, new THREE.CircleGeometry(rnd(2, 6), 12), M(0x3a6a3a, { roughness: 1 }), rnd(225, 385), -1.55, rnd(-150, 150), false); p.rotation.x = -Math.PI / 2; }
  for (let x = 245; x < 358; x += 12) { add(Z3, cyl(0.6, 0.7, 4.2, 12), M(0xd8d4cc, { roughness: 0.9 }), x, 0, 13.5); add(Z3, cyl(0.6, 0.7, 4.2, 12), M(0xd8d4cc, { roughness: 0.9 }), x, 0, 17.5); }
  for (const z of [11.6, 19.4]) add(Z3, box(116, 0.8, 0.25), M(0xeeeeee, { roughness: 0.6 }), 300, 2.5, z);
  for (const [x, z, r] of [[262, -25, 7], [300, 45, 10], [335, -35, 8], [350, 32, 7]]) {
    add(Z3, cyl(r, r + 1.5, 0.8, 24), M(0xeadbb0, { roughness: 1 }), x, -0.1, z);
    for (let k = 0; k < 4; k++) palm(Z3, x + rnd(-r * 0.6, r * 0.6), z + rnd(-r * 0.6, r * 0.6), 1, rnd(6, 8));
  }
  const lh = new THREE.Group(); lh.position.set(300, 0.3, 45); Z3.add(lh); // faro de Key West
  add(lh, cyl(1.6, 2.4, 20, 16), M(0xf5f5f0, { roughness: 0.7 }), 0, 10, 0);
  add(lh, cyl(2.3, 2.3, 0.4, 16), M(0x111111, { metalness: 0.6 }), 0, 20.2, 0);
  add(lh, cyl(1.3, 1.3, 2, 12), M(0xaaccdd, { metalness: 0.9, roughness: 0.05 }), 0, 21.4, 0);
  add(lh, cone(1.5, 1.4, 12), M(0x111111, { metalness: 0.6 }), 0, 23.1, 0);
  const beacon = glow(0xfff2a0, 6, 0.9); beacon.position.y = 21.4; lh.add(beacon);
  add(lh, box(6, 3.5, 5), M(0xffffff, { roughness: 0.8 }), 5, 1.75, 2); const rr = add(lh, roofGeo(), M(0x7a7a7a)); rr.scale.set(7 / 1.732, 2 / 1.5, 5.4); rr.position.set(5, 3.5 + 0.5 * (2 / 1.5), 2);
  const buoyT = canvasTex(512, 256, (q, w, h) => { q.fillStyle = '#111'; q.fillRect(0, 0, w, h * 0.18); q.fillStyle = '#d4202a'; q.fillRect(0, h * 0.18, w, h * 0.22); q.fillStyle = '#f2c230'; q.fillRect(0, h * 0.4, w, h * 0.32); q.fillStyle = '#111'; q.fillRect(0, h * 0.72, w, h * 0.28); q.fillStyle = '#111'; q.font = 'bold 30px system-ui'; q.textAlign = 'center'; q.fillText('PUNTO MÁS AL SUR · EE. UU.', w / 4, h * 0.53); q.fillText('KEY WEST · 90 MILLAS A CUBA', w / 4, h * 0.66); q.fillText('PUNTO MÁS AL SUR · EE. UU.', w * 0.75, h * 0.53); q.fillText('KEY WEST · 90 MILLAS A CUBA', w * 0.75, h * 0.66); });
  add(Z3, new THREE.LatheGeometry([new V2(0.001, 3.8), new V2(0.9, 3.7), new V2(1.2, 3.2), new V2(1.5, 1), new V2(1.7, 0)], 28), temp(new THREE.MeshStandardMaterial({ map: buoyT, roughness: 0.6 })), 350, 0.3, 32);
  const dolphins = [];
  for (let i = 0; i < 5; i++) { const d = addAnimal(dolphin(), '🐬', 2.2); d.userData.ph = i * 1.3; d.scale.setScalar(1.3); d.userData.x0 = 278 + i * 8; d.userData.z0 = i % 2 ? 4 : 27; Z3.add(d); dolphins.push(d); }
  for (let i = 0; i < 5; i++) { const b = spawnGLB('Flamingo.glb', Z3, mixers, { s: 0.014 }); addAnimal(b, '🦩', 2.8); b.userData = { ...b.userData, r: rnd(12, 20), h: rnd(8, 12), cx: rnd(270, 330), cz: rnd(-20, 40), sp: rnd(0.25, 0.4), ph: i * 1.1 }; birds.push(b); }
  const boats = [];
  for (const [x, z] of [[270, -40], [320, 60], [345, -55]]) {
    const b = new THREE.Group(); b.position.set(x, -0.2, z); Z3.add(b);
    add(b, box(5, 0.9, 1.8), M(0xffffff, { roughness: 0.4 }), 0, 0.3, 0); add(b, cyl(0.07, 0.07, 7, 6), M(0xcccccc), 0, 4, 0);
    const ss = new THREE.Shape(); ss.moveTo(0, 0); ss.lineTo(0, 6); ss.lineTo(2.8, 0.2); ss.lineTo(0, 0);
    add(b, new THREE.ShapeGeometry(ss), M(0xfafafa, { side: THREE.DoubleSide, roughness: 0.9 }), 0.1, 1, 0); b.userData.ph = rnd(0, 6); boats.push(b);
  }
  roadSign(Z3, 228, 21, '📍 OVERSEAS HIGHWAY · CAYOS', '#0a5a8a');

  /* ----- Zona 4: Cabo Cañaveral ----- */
  const Z4 = zone(450);
  const scrub = add(Z4, new THREE.PlaneGeometry(200, 320), M(0x8d8f5a, { roughness: 1 }), 470, 0, 0, false); scrub.rotation.x = -Math.PI / 2; scrub.receiveShadow = true;
  const river = waterMat(0x22557a, { amp: 0.2 }); waters.push(river);
  const rv = add(Z4, new THREE.PlaneGeometry(200, 20, 40, 10), river, 470, 0.02, -25, false); rv.rotation.x = -Math.PI / 2;
  const pad = new THREE.Group(); pad.position.set(495, 0, -80); Z4.add(pad);
  add(pad, box(34, 2, 34), M(0xb8b4aa, { roughness: 1 }), 0, 1, 0);
  const steelR = M(0x8a1a1a, { metalness: 0.6, roughness: 0.5 });
  for (const [x, z] of [[-14, -3], [-14, 3], [-8, -3], [-8, 3]]) add(pad, box(0.5, 62, 0.5), steelR, x, 33, z);
  for (let y = 4; y < 64; y += 4) { add(pad, box(6.5, 0.3, 0.3), steelR, -11, y, -3); add(pad, box(6.5, 0.3, 0.3), steelR, -11, y, 3); add(pad, box(0.3, 0.3, 6.5), steelR, -14, y, 0); add(pad, box(0.3, 0.3, 6.5), steelR, -8, y, 0); }
  add(pad, box(6, 1, 1), steelR, -4.5, 48, 0);
  const rocket = new THREE.Group(); rocket.position.set(0, 2, 0); pad.add(rocket);
  const rw = M(0xf4f4f4, { roughness: 0.5, metalness: 0.2 }), rb = M(0x111111, { roughness: 0.5 });
  add(rocket, cyl(2.2, 2.2, 42, 24), rw, 0, 23, 0);
  for (const y of [8, 30]) add(rocket, cyl(2.25, 2.25, 1.2, 24), rb, 0, y, 0);
  add(rocket, cyl(2.2, 2.2, 10, 24), rw, 0, 49, 0);
  add(rocket, new THREE.LatheGeometry([new V2(2.3, 0), new V2(2.3, 3), new V2(2, 6), new V2(1.2, 8.5), new V2(0.001, 10)], 24), rw, 0, 54, 0);
  for (const s of [-1, 1]) { add(rocket, cyl(1, 1, 28, 16), rw, s * 3.3, 16, 0); add(rocket, cone(1, 3, 16), rw, s * 3.3, 31.5, 0); add(rocket, cone(0.9, 1.6, 12), rb, s * 3.3, 1.2, 0).rotation.x = Math.PI; }
  for (let k = 0; k < 4; k++) add(rocket, cone(0.7, 1.6, 12), rb, Math.cos(k * 1.57) * 1.1, 1.2, Math.sin(k * 1.57) * 1.1).rotation.x = Math.PI;
  const rl = add(rocket, new THREE.PlaneGeometry(2.4, 18), temp(new THREE.MeshStandardMaterial({ map: canvasTex(128, 512, (q, w, h) => { q.clearRect(0, 0, w, h); q.save(); q.translate(w / 2, h / 2); q.rotate(-Math.PI / 2); q.fillStyle = '#1d2f6b'; q.font = 'bold 84px system-ui'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('FLORIDA', 0, 0); q.restore(); }), transparent: true })), 0, 22, 2.22, false);
  rl.rotation.y = 0;
  add(Z4, box(60, 70, 50), M(0x9a9a9a, { roughness: 0.9 }), 430, 35, -150);
  add(Z4, new THREE.PlaneGeometry(26, 15), stripedMat('#b22234', '#ffffff', 13, false), 430, 45, -124.9, false);
  roadSign(Z4, 382, 21, '📍 CABO CAÑAVERAL · COSTA ESPACIAL', '#1d2f6b');
  const smoke = [];
  const smokeM = temp(new THREE.SpriteMaterial({ map: glowTex(), color: 0xd8d8d8, transparent: true, opacity: 0.85, depthWrite: false }));
  const flameS = glow(0xffb040, 1, 0); flameS.position.set(0, -2, 0); rocket.add(flameS);

  /* ----- Plataforma abierta del trolley turístico: nada te tapa la vista al girar ----- */
  const carG = new THREE.Group(); g.add(carG);
  const paint = M(0xd8102e, { metalness: 0.5, roughness: 0.3 }), chrome = M(0xdddddd, { metalness: 1, roughness: 0.2 });
  add(carG, box(5, 0.35, 2.6), paint, 0, 0.55, 0);
  add(carG, box(5, 0.04, 2.5), M(0x8a6a48, { roughness: 0.8 }), 0, 0.75, 0, false);
  for (const z of [-1.25, 1.25]) add(carG, box(5, 0.05, 0.05), chrome, 0, 1.15, z, false);
  for (const xx of [-2.45, 2.45]) add(carG, box(0.05, 0.05, 2.5), chrome, xx, 1.15, 0, false);
  for (const xx of [-2.4, -0.8, 0.8, 2.4]) for (const z of [-1.25, 1.25]) add(carG, cyl(0.025, 0.025, 0.4, 6), chrome, xx, 0.95, z, false);
  for (const wx of [-1.7, 1.7]) for (const wz of [-1.1, 1.1]) { const w = add(carG, cyl(0.4, 0.4, 0.3, 20), M(0x111111), wx, 0.4, wz); w.rotation.x = Math.PI / 2; }
  let alive = true, running = false, x = START, launched = 0, ended = false, zoneIdx = -1, infoT = 0, waveT = 0;
  const shots = new Set();
  const SP = { '🐢': 'Tortuga marina', '🦜': 'Loro silvestre', '🐊': 'Caimán americano', '🦩': 'Flamenco americano', '🐬': 'Delfín nariz de botella' };
  const FACT = {
    '🐢': 'Florida tiene la mayor cantidad de nidos de tortugas marinas de Estados Unidos.',
    '🦜': 'En Miami viven loros en libertad que se ven en parques y barrios.',
    '🐊': 'El caimán americano es el reptil oficial del estado de Florida.',
    '🦩': 'Los flamencos americanos se pueden ver en la bahía de Florida, junto a los Everglades.',
    '🐬': 'El delfín nariz de botella es el mamífero oficial de agua salada de Florida.'
  };
  const ZFACT = [
    '📍 Miami Beach — barrio Art Déco con edificios de los años 20 a 40.',
    '📍 Everglades — Parque Nacional desde 1947. Es el único lugar del mundo donde caimanes y cocodrilos viven juntos en libertad.',
    '📍 Overseas Highway — unos 182 km y 42 puentes que unen los Cayos. Key West está a 90 millas de Cuba.',
    '📍 Cabo Cañaveral — desde el Centro Espacial Kennedy despegó el Apolo 11 hacia la Luna en 1969.'
  ];
  const STOPS = [
    { x: 0, name: 'Miami Beach', need: ['🐢', '🦜'], tip: 'Busca 🐢 tortugas en la arena (a tu izquierda) y 🦜 loros volando sobre las palmeras',
      q: '¿De qué estilo son los edificios famosos de Miami Beach?', o: ['Gótico', 'Art Déco', 'Barroco'], a: 1 },
    { x: 150, name: 'Everglades', need: ['🐊', '🦩'], tip: 'Busca 🐊 caimanes en el agua y en las orillas, y 🦩 flamencos volando',
      q: '¿Qué tiene de único el sur de Florida?', o: ['Tiene volcanes activos', 'Caimanes y cocodrilos viven juntos en libertad', 'Nieva todo el año'], a: 1 },
    { x: 300, name: 'Cayos de Florida', need: ['🐬'], tip: 'Busca 🐬 delfines saltando a los dos lados del puente',
      q: '¿A cuántas millas de Cuba está Key West?', o: ['9 millas', '90 millas', '900 millas'], a: 1 },
    { x: 445, name: 'Cabo Cañaveral', need: [], tip: '🚀 Mira a tu izquierda: ¡va a despegar un cohete!',
      q: '¿Qué misión despegó en 1969 desde el Centro Espacial Kennedy rumbo a la Luna?', o: ['Apolo 11', 'Sputnik 1', 'Titanic'], a: 0 }
  ];
  let phase = 'drive', stopI = 0, stopT = 0, good = 0;
  const arrow = document.getElementById('arrow');
  const left = () => STOPS[stopI].need.filter(k => !shots.has(k));
  const info = () => ctx.info(phase === 'drive'
    ? `🚗 Rumbo a ${STOPS[stopI].name} · 📸 ${shots.size}/5`
    : `📍 Parada ${stopI + 1}/4 · ${STOPS[stopI].name} · 📸 ${shots.size}/5 ${Object.keys(SP).map(k => shots.has(k) ? '✅' : k).join('')}`);
  function arrive() {
    phase = 'stop'; stopT = 0; ctx.sfx('portal'); info();
    ctx.toast(ZFACT[stopI], 7000); ctx.hint(`📍 PARADA ${stopI + 1}/4 · ${STOPS[stopI].tip}. Sigue la flecha amarilla ➤`);
    if (stopI === 3) { launched = 0.001; ctx.sfx('charge'); }
  }
  function ask() {
    const S = STOPS[stopI]; phase = 'quiz'; arrow.classList.add('hidden');
    ctx.card(`❓ Pregunta ${stopI + 1} de 4 · ${S.name}`, `<p>${S.q}</p>`, S.o.map((o, i) => ({ label: o, fn: () => {
      if (i === S.a) { good++; ctx.sfx('pickup'); ctx.toast(`✅ ¡Correcto! Llevas ${good} de ${stopI + 1}.`, 2500); }
      else { ctx.sfx('hurt'); ctx.toast(`❌ Era: ${S.o[S.a]}`, 3000); }
      if (stopI === 3) { ended = true; running = false; setTimeout(() => ctx.win('miami'), 900); return; }
      stopI++; phase = 'drive'; info(); refreshHint();
    } })));
  }
  const seat = new V3();
  const seatPos = () => seat.set(x, roadY(x) + 2.35, LANE);
  const intro = withIntro(ctx, opt, [
    { t: 0, p: [-95, 30, -30], yaw: -2.2, pitch: -0.4 },
    { t: 3.8, p: [START - 10, 6, 6], yaw: -1.8, pitch: -0.2 },
    { t: 5.5, p: [START, 2.35, LANE], yaw: -Math.PI / 2, pitch: -0.05 }
  ], -Math.PI / 2, -0.05);
  function photo(sp, obj) {
    ctx.sfx('shutter');
    const f = document.getElementById('fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 90);
    if (shots.has(sp)) { ctx.toast(`📸 Ya tienes foto de ${SP[sp]}`, 1500); return; }
    if (navigator.vibrate) navigator.vibrate(40);
    shots.add(sp); info(); ctx.sfx('pickup'); ctx.burst(obj.getWorldPosition(_v), [0xffffff, 0xffd700], 30, 1.5);
    ctx.toast(`📸 ¡${SP[sp]}! ${FACT[sp]}`, 5000);
  }
  const pickA = p => { const h = p.ray.intersectObjects(animals.filter(a => a.parent && a.parent.visible !== false), false); return h.length ? h[0].object : null; };
  const refreshHint = () => ctx.hint(phase === 'drive' ? `🚗 Viajando a ${STOPS[stopI].name}… mira el paisaje` + (ctx.gyroOn() ? ' girando el celular' : ' arrastrando el dedo') : `📍 ${STOPS[stopI].tip}`);
  return {
    look: true, camLock: !opt.quick, dwellTime: 0.4, refreshHint, _dbg: { setX: v => (x = v), animals },
    start() { running = true; this.camLock = false; info(); refreshHint(); },
    tap(p) { if (intro.on) { intro.finish(); this.camLock = false; return; } if (!running) return; const h = pickA(p); if (h) photo(h.userData.sp, h.parent); },
    hoverable: p => (running ? pickA(p) : null),
    update(dt, t) {
      mixers.forEach(m => m.update(dt));
      waters.forEach(w => (w.userData.uT.value = t));
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      if (running && !ended) {
        if (phase === 'drive') { const tx = STOPS[stopI].x; x = Math.min(tx, x + dt * 9); if (x >= tx) arrive(); }
        else if (phase === 'stop') {
          stopT += dt;
          if (stopI < 3 && !left().length) { phase = 'wait'; ctx.hint('✅ ¡Fotos listas! Ahora una pregunta…'); setTimeout(() => alive && ask(), 1500); }
          else if (stopI < 3 && stopT > 35 && !this['tip' + stopI]) { this['tip' + stopI] = 1; ctx.toast('💡 Gira el celular (o arrastra) hacia donde apunta la flecha amarilla y toca el animal.', 5000); }
        }
        // flecha que guía hacia el animal que falta
        let best = null, bd = 1e9;
        if (phase === 'stop' && left().length) for (const a of animals) if (left().includes(a.userData.sp)) { a.getWorldPosition(_w); const d = _w.distanceToSquared(camera.position); if (d < bd) { bd = d; best = _w.clone(); } }
        if (best) {
          const loc = camera.worldToLocal(best.clone()), pr = best.clone().project(camera);
          if (loc.z < 0 && Math.abs(pr.x) < 0.85 && Math.abs(pr.y) < 0.85) arrow.classList.add('hidden');
          else { const ang = Math.atan2(loc.y, loc.x), Rr = Math.min(innerWidth, innerHeight) / 2 - 50; arrow.classList.remove('hidden'); arrow.style.transform = `translate(${innerWidth / 2 + Math.cos(ang) * Rr}px,${innerHeight / 2 - Math.sin(ang) * Rr}px) rotate(${-ang}rad)`; }
        } else arrow.classList.add('hidden');
      }
      if (!intro.on) camera.position.copy(seatPos());
      const shake = launched > 5 ? Math.min(1, (launched - 5) * 0.5) * Math.max(0, 1 - (launched - 9) * 0.3) : 0;
      if (shake > 0) camera.position.add(_u.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(0.03 * shake));
      carG.position.set(x, roadY(x), LANE); carG.rotation.z = Math.atan2(roadY(x + 1) - roadY(x - 1), 2);
      sun.position.set(x + sunDir.x * 40, sunDir.y * 40, 8 + sunDir.z * 40); sun.target.position.set(x, 0, 8);
      sunM.position.set(x + sunDir.x * 330, sunDir.y * 330, sunDir.z * 330); sg.position.copy(sunM.position).multiplyScalar(0.97);
      skyM.position.set(x, 0, 0);
      zones.forEach(z => (z.visible = Math.abs(x - z.userData.cx) < 190));
      foam.position.z = -14 + Math.sin(t * 0.8) * 1.2; foamM.opacity = 0.45 + Math.sin(t * 0.8 + 1) * 0.3;
      waveT -= dt; if (waveT <= 0 && x < 90) { waveT = 3.2; ctx.sfx('waves'); }
      if (Z1.visible) {
        traffic.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x < -100) c.position.x = 80; });
        palms.forEach(p => { p.userData.crown.rotation.z = Math.sin(t * 0.9 + p.userData.ph) * 0.05; });
        towers.forEach((tw, i) => { tw.userData.flag.rotation.y = Math.sin(t * 4 + i) * 0.4; });
        turtles.forEach((tt, i) => { tt.position.z -= dt * 0.12; if (tt.position.z < -12) tt.position.z = -2; tt.userData.fl.forEach((f, k) => (f.rotation.y = Math.sin(t * 2 + k) * 0.4)); });
      }
      birds.forEach(b => { if (!b.parent.visible) return; const u = b.userData, a = t * u.sp + u.ph; b.position.set(u.cx + Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.ph) * 1.2, u.cz + Math.sin(a) * u.r); b.rotation.y = Math.atan2(-Math.sin(a) * u.sp, Math.cos(a) * u.sp); });
      if (Z2.visible) {
        gators.forEach(a => { const u = a.userData; u.tail.forEach((s, i) => (s.rotation.y = Math.sin(t * 2 + u.ph - i * 0.5) * 0.18)); if (u.swim) { a.translateZ(dt * 0.4); a.rotation.y += dt * 0.08; } else u.jaw.rotation.x = Math.max(0, Math.sin(t * 0.5 + u.ph)) * 0.35; });
        airboat.position.x = 150 + Math.sin(t * 0.15) * 50; airboat.rotation.y = Math.cos(t * 0.15) > 0 ? 0 : Math.PI; prop.rotation.x += dt * 40;
      }
      if (Z3.visible) {
        dolphins.forEach(d => { const u = d.userData, c = ((t * 0.35 + u.ph) % 1); d.position.set(u.x0 + c * 12, -0.6 + Math.sin(c * Math.PI) * 2.6 - (c > 0.95 ? 2 : 0), u.z0); d.rotation.x = -Math.cos(c * Math.PI) * 0.9; d.rotation.y = Math.PI / 2; if (c > 0.93 && c < 0.96) ctx.burst(d.position, [0xffffff, 0xbfefff], 4, 2, 6); });
        boats.forEach(b => { b.rotation.z = Math.sin(t + b.userData.ph) * 0.05; b.position.y = -0.2 + Math.sin(t * 1.3 + b.userData.ph) * 0.1; });
        beacon.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
      }
      if (launched) {
        launched += dt;
        const L = launched;
        if (L < 4.2) ctx.info(`🚀 T-${Math.ceil(4.2 - L)} · 📸 ${shots.size}/5`);
        if (L > 4.2) {
          if (!this._rum) { this._rum = 1; ctx.sfx('rumble'); ctx.info(`🚀 ¡DESPEGUE! · 📸 ${shots.size}/5`); }
          flameS.material.opacity = 1; flameS.scale.set(9, 22, 1); flameS.position.y = -10;
          if (Math.random() < 0.8) { const s = new THREE.Sprite(smokeM); s.position.set(495 + rnd(-6, 6), 3, -80 + rnd(-6, 6)); s.scale.setScalar(8); s.userData.v = new V3(rnd(-6, 6), rnd(1, 4), rnd(-6, 6)); Z4.add(s); smoke.push(s); }
          ctx.burst(rocket.localToWorld(_v.set(0, -1, 0)), [0xffd060, 0xff7a20, 0xffffff], 5, 4, 3);
        }
        if (L > 5.5) { const k = L - 5.5; rocket.position.y = 2 + k * k * 3.2; }
        for (let i = smoke.length - 1; i >= 0; i--) { const s = smoke[i]; s.position.addScaledVector(s.userData.v, dt); s.scale.multiplyScalar(1 + dt * 0.35); if (s.scale.x > 45) { Z4.remove(s); smoke.splice(i, 1); } }
        if (L > 12 && phase === 'stop') ask();
      }
      if (running && !launched) { infoT += dt; if (infoT > 0.5) { infoT = 0; info(); } }
    },
    dispose() { alive = false; running = false; restoreEnv(); mixers.length = 0; arrow.classList.add('hidden'); }
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
  // Tribunas con aficionados individuales: sentados, aplaudiendo, de pie y celebrando
  const seat = M(0x2a0a10, { roughness: 0.9 }), seat2 = M(0x111111, { roughness: 0.9 });
  const fans = [];
  const stand = (cx, cz, len, alongX, out) => {
    const face = alongX ? (out < 0 ? 0 : Math.PI) : (out < 0 ? Math.PI / 2 : -Math.PI / 2);
    for (let k = 0; k < 9; k++) {
      const off = 1.6 * k, top = 0.85 + k * 0.85;
      const x = alongX ? cx : cx + out * off, z = alongX ? cz + out * off : cz;
      add(g, alongX ? box(len, 0.85, 1.6) : box(1.6, 0.85, len), k % 2 ? seat : seat2, x, top - 0.42, z, false);
      for (let s = -len / 2 + 0.4; s < len / 2; s += 0.62) if (Math.random() < 0.86) {
        const r = Math.random();
        fans.push({ x: alongX ? cx + s + rnd(-0.08, 0.08) : x, top, z: alongX ? z : cz + s + rnd(-0.08, 0.08), face: face + rnd(-0.25, 0.25), pose: r < 0.5 ? 'sit' : r < 0.75 ? 'clap' : r < 0.9 ? 'stand' : 'cheer', ph: rnd(0, 6.28), k: rnd(0.92, 1.08) });
      }
    }
  };
  stand(-12, 8.2, 38, false, -1); stand(12, 8.2, 38, false, 1); stand(0, -9, 24, true, -1); stand(0, 25, 24, true, 1);
  const mg = (parts) => keep(mergeGeometries(parts.map(([geo, x, y, z, rx = 0, rz = 0]) => geo.clone().rotateX(rx).rotateZ(rz).translate(x, y, z)), false));
  const armC = new THREE.CapsuleGeometry(0.055, 0.45, 3, 8), legC = new THREE.CapsuleGeometry(0.085, 0.62, 3, 8), thC = new THREE.CapsuleGeometry(0.09, 0.32, 3, 8);
  const GEO = {
    torso: keep(new THREE.CapsuleGeometry(0.2, 0.36, 4, 10).scale(1, 1, 0.62)),
    head: keep(new THREE.SphereGeometry(0.115, 12, 9).scale(0.92, 1.08, 1)),
    hair: keep(new THREE.SphereGeometry(0.122, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)),
    legs: mg([[legC, -0.1, -0.62, 0], [legC, 0.1, -0.62, 0]]),
    thighs: mg([[thC, -0.1, -0.3, 0.2, Math.PI / 2], [thC, 0.1, -0.3, 0.2, Math.PI / 2], [legC, -0.1, -0.62, 0.4], [legC, 0.1, -0.62, 0.4]]),
    down: mg([[armC, -0.25, -0.02, 0.02, 0, -0.1], [armC, 0.25, -0.02, 0.02, 0, 0.1]]),
    clap: mg([[armC, -0.15, 0.02, 0.2, -1.2, 0.5], [armC, 0.15, 0.02, 0.2, -1.2, -0.5]]),
    up: mg([[armC, -0.3, 0.42, 0, 0, 2.7], [armC, 0.3, 0.42, 0, 0, -2.7]])
  };
  const SH = [0xc8102e, 0xc8102e, 0xc8102e, 0x111111, 0x111111, 0xffffff, 0x3a5a8a, 0x8a8a8a, 0xf9a01b, 0x2c6e49, 0xd88aa8, 0xc8b08a];
  const lists = { torso: [], head: [], hair: [], legs: [], thighs: [], down: [], clap: [], up: [] };
  fans.forEach(f => {
    f.sit = f.pose === 'sit' || f.pose === 'clap';
    lists.torso.push(f); lists.head.push(f); lists.hair.push(f);
    lists[f.sit ? 'thighs' : 'legs'].push(f);
    lists[f.pose === 'clap' ? 'clap' : f.pose === 'cheer' ? 'up' : 'down'].push(f);
    f.q = new THREE.Quaternion().setFromAxisAngle(_y0, f.face); f.shirt = pick(SH); f.skin = pick(SKINS); f.hair = pick(HAIRS); f.pants = pick([0x223355, 0x222222, 0x5a5a5a, 0x7a6a4a]);
  });
  const crowdM = temp(new THREE.MeshStandardMaterial({ roughness: 0.85 })), col = new THREE.Color(), m4 = new THREE.Matrix4(), sc4 = new V3(), ps4 = new V3();
  const INST = {};
  for (const [k, list] of Object.entries(lists)) {
    const im = new THREE.InstancedMesh(GEO[k], crowdM, list.length); im.frustumCulled = false;
    list.forEach((f, i) => im.setColorAt(i, col.set(k === 'head' ? f.skin : k === 'hair' ? f.hair : k === 'legs' || k === 'thighs' ? f.pants : k === 'torso' ? f.shirt : f.pose === 'clap' || f.pose === 'cheer' ? f.skin : f.shirt)));
    g.add(im); INST[k] = { im, list };
  }
  const layoutCrowd = (t, cel) => {
    for (const k in INST) {
      const { im, list } = INST[k];
      for (let i = 0; i < list.length; i++) {
        const f = list[i], base = f.top + (f.sit ? 0.55 : 1.05) * f.k;
        let y = base;
        if (cel > 0) y += Math.max(0, Math.sin(t * 11 + f.ph)) * (f.sit ? 0.12 : 0.3);
        else if (f.pose === 'cheer') y += Math.max(0, Math.sin(t * 4 + f.ph)) * 0.08;
        else y += Math.sin(t * 1.5 + f.ph) * 0.01;
        const off = k === 'head' ? 0.42 * f.k : k === 'hair' ? 0.45 * f.k : 0;
        let sx = f.k;
        if (k === 'clap') sx *= 1 + Math.sin(t * 14 + f.ph) * 0.25;
        im.setMatrixAt(i, m4.compose(ps4.set(f.x, y + off, f.z), f.q, sc4.set(sx, f.k, f.k)));
      }
      im.instanceMatrix.needsUpdate = true;
    }
  };
  layoutCrowd(0, 0);
  // Techo, luces y pancartas
  add(g, box(60, 1, 70), M(0x0a0a0d), 0, 24, 8, false);
  for (let i = -2; i <= 2; i++) for (let j = -1; j <= 3; j++) { add(g, box(3, 0.2, 1), M(0xffffff, { emissive: 0xfff6e0, emissiveIntensity: 3 }), i * 8, 22.5, j * 8, false); const l = glow(0xfff2d0, 5, 0.45); l.position.set(i * 8, 22, j * 8); g.add(l); }
  [['MIAMI', '#c8102e'], ['FLORIDA', '#111111'], ['AR 2026', '#c8102e'], ['FERIA', '#111111']].forEach(([t, bg], i) => {
    const b = add(g, new THREE.PlaneGeometry(1.8, 3.6), temp(new THREE.MeshStandardMaterial({ map: canvasTex(128, 256, (c, w, h) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.strokeStyle = '#f9a01b'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12); c.save(); c.translate(w / 2, h / 2); c.rotate(-Math.PI / 2); c.fillStyle = '#fff'; c.font = 'bold 44px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(t, 0, 0); c.restore(); }), side: THREE.DoubleSide })), -4.5 + i * 3, 15, -12, false);
    b.userData.ph = i; b.name = 'banner';
  });
  // Jugadores con proporciones atléticas reales, árbitro y bailarinas (modelo con animación capturada)
  const mixers = [];
  const P = person({ h: 1.98, athlete: true, top: 0xc8102e, bottom: 0xc8102e, shorts: true, longShorts: true, shoe: 0xffffff, num: '26', hairStyle: 'buzz', band: 0x111111, skin: 0x6b4430 });
  P.p.position.set(5.2, 0, -3.8); P.p.rotation.y = Math.atan2(-5.2, 3.8); g.add(P.p);
  const R = person({ h: 2.03, athlete: true, top: 0x111111, bottom: 0x111111, shorts: true, longShorts: true, shoe: 0x111111, num: '7', hairStyle: 'short', skin: 0xc99a74 });
  R.p.position.set(-5.2, 0, -3.8); R.p.rotation.y = Math.atan2(5.2, 3.8); g.add(R.p);
  const ref = person({ h: 1.8, topMat: stripedMat('#ffffff', '#111111', 12), bottom: 0x111111, sleeves: true, shoe: 0x111111, hairStyle: 'bald' });
  ref.p.position.set(-6.9, 0, 0.6); ref.p.rotation.y = Math.PI / 2; g.add(ref.p);
  for (const [x, z, ry] of [[-4.6, -6.9, 0], [4.6, -6.9, 0], [-8.4, 4, Math.PI / 2], [8.4, 4, -Math.PI / 2]]) spawnGLB('Michelle.glb', g, mixers, { x, z, ry });
  // vallas LED alrededor de la cancha
  const ledT = rep(canvasTex(1024, 64, (q, w, h) => { q.fillStyle = '#0a0a0a'; q.fillRect(0, 0, w, h); q.font = 'bold 44px system-ui'; q.textBaseline = 'middle'; const items = [['MIAMI', '#ff2a3a'], ['·', '#fff'], ['FLORIDA AR', '#ffffff'], ['·', '#fff'], ['¡VAMOS!', '#f9a01b'], ['·', '#fff'], ['🏀 2026', '#ff2a3a']]; let x = 20; for (const [t2, c] of items) { q.fillStyle = c; q.fillText(t2, x, h / 2 + 2); x += q.measureText(t2).width + 28; } }), 3, 1);
  const ledM = temp(new THREE.MeshBasicMaterial({ map: ledT }));
  for (const [x, z, len, ry] of [[0, -6.6, 14, 0], [-7.95, 8, 26, Math.PI / 2], [7.95, 8, 26, -Math.PI / 2]]) {
    const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = ry; g.add(b);
    add(b, box(len, 0.9, 0.2), M(0x111111), 0, 0.45, 0); add(b, new THREE.PlaneGeometry(len, 0.75), ledM, 0, 0.47, 0.105, false);
  }
  const ball2 = add(g, sph(BR, 24), ballMat());
  // Balón del jugador
  const ball = add(g, sph(BR, 32), ballMat());
  const st = { mode: 'rest', v: new V3(), t: 0, scored: false, fb: '', inNet: 0, lastBounce: 0 };
  let running = false, alive = true, baskets = 0, pts = 0, shots = 0, cel = 0, netK = 0, netW = 0;
  const _d = new V3(), _q = new V3(), _n = new V3();
  const info = () => ctx.info(`🏀 Canastas ${baskets}/5 · Puntos ${pts} · Tiros ${shots}`);
  const SPOTS = [[0, 0, 'Tiro libre'], [-3.6, -1.2, 'Ala izquierda'], [3.6, -1.2, 'Ala derecha'], [0, 2.2, 'Frente al aro, más lejos'], [-2, 1.2, 'Diagonal izquierda']];
  const spot = new V3(0, 1.6, 0), spotFrom = new V3(0, 1.6, 0); let spotT = 1;
  function moveSpot(i) {
    const S2 = SPOTS[i % SPOTS.length]; spotFrom.copy(camera.position); spot.set(S2[0], 1.6, S2[1]); spotT = 0;
    ctx.toast(`📍 Nueva posición: ${S2[2]}`, 2500);
  }
  function drawBoard() {
    const c = sbTex.userData.g, w = 512, h = 200;
    c.fillStyle = '#050505'; c.fillRect(0, 0, w, h); c.strokeStyle = '#c8102e'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.textAlign = 'center'; c.fillStyle = '#ff3344'; c.font = 'bold 34px monospace'; c.fillText('PUNTOS    CANASTAS', w / 2, 50);
    c.font = 'bold 100px monospace'; c.fillStyle = '#ffd54a'; c.fillText(String(pts).padStart(2, '0'), 140, 160); c.fillText(`${baskets}/5`, 370, 160);
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
    if (baskets >= 5) { running = false; setTimeout(() => ctx.win('heat'), 1300); }
    else setTimeout(() => { if (alive) moveSpot(baskets); }, 1600);
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
      // público, bailarinas y vallas LED
      mixers.forEach(m => m.update(dt));
      if ((this._f = (this._f || 0) + 1) % 2 === 0) layoutCrowd(t, cel);
      ledT.offset.x = (ledT.offset.x + dt * 0.12) % 1;
      g.children.forEach(o => { if (o.name === 'banner') o.rotation.y = Math.sin(t * 0.8 + o.userData.ph) * 0.06; });
      // rival en defensa y árbitro
      R.legs.forEach(l => { l.th.rotation.x = -0.5; l.kn.rotation.x = 0.75; }); R.hips.position.y = R.leg - 0.16;
      R.p.position.x = -5.2 + Math.sin(t * 1.3) * 0.4; R.arms.forEach(a => { a.sh.rotation.z = a.s * (0.9 + Math.sin(t * 2) * 0.1); a.el.rotation.x = -0.3; });
      idleAnim(ref, t);
      // compañero: dribla y celebra
      const dr = Math.abs(Math.sin(t * 3.2));
      if (cel > 0) {
        cel -= dt; P.p.position.y = Math.abs(Math.sin(cel * 7)) * 0.45;
        P.arms.forEach(a => { a.sh.rotation.x = -2.9; a.el.rotation.x = 0; });
        ball2.position.lerp(P.p.localToWorld(_v.set(0.4, 0.12, 0.3)), 0.2);
      } else {
        P.p.position.y = 0; P.hips.position.y = P.leg - 0.06 - dr * 0.04;
        P.legs.forEach((l, i) => { l.th.rotation.x = -0.25 - dr * 0.1; l.kn.rotation.x = 0.4 + dr * 0.15; });
        P.arms[0].sh.rotation.x = -0.3; P.arms[0].el.rotation.x = -0.6;
        P.arms[1].sh.rotation.x = -0.5 - dr * 0.3; P.arms[1].el.rotation.x = -0.4;
        ball2.position.copy(P.p.localToWorld(_v.set(0.32, BR + (1 - dr) * 0.72, 0.35)));
      }
      // cambio de posición de tiro
      if (spotT < 1 && !intro.on) {
        spotT = Math.min(1, spotT + dt * 0.8); camera.position.lerpVectors(spotFrom, spot, smooth(spotT));
        if (spotT >= 1) { const d = _u.copy(RIM).sub(spot); ctx.lookReset(Math.atan2(-d.x, -d.z), 0.15); }
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
      ? 'Tu varita sigue tu <b>dedo índice</b>. Apunta al mago y mantén el dedo sobre él: el hechizo se lanza solo. Muestra la <b>palma abierta ✋</b> para activar 🛡️ Protego cuando veas el brillo verde. Cambia de hechizo dejando el dedo quieto sobre los botones. <b>Acierta 6 ataques</b> (a la mitad el mago se enfurece y ataca más rápido).'
      : 'Toca al mago para lanzarle el hechizo (o usa ✨ Lanzar). 🔴 Expelliarmus lo desarma y ⚡ Stupefy lo aturde. Cuando veas el brillo verde, elige 🛡️ Protego y lánzalo. Gira el celular o arrastra para mirar el parque. <b>Acierta 6 ataques</b> (a la mitad el mago se enfurece y ataca más rápido).',
    fact: 'The Wizarding World of Harry Potter abrió su zona de Hogsmeade en Islands of Adventure en 2010 y Diagon Alley en Universal Studios Florida en 2014. El tren Hogwarts Express conecta ambos parques.'
  },
  miami: {
    short: 'Tour Florida', title: '🌴 Miami y Florida — Road Trip', winMsg: '¡Has recorrido Florida!', create: miami,
    how: h => 'Viajas de pie en un trolley turístico abierto, así que puedes <b>girar el celular y mirar los 360°</b> como en la cancha. Hay <b>4 paradas</b>: Miami Beach → Everglades → Cayos → Cabo Cañaveral.<br>1️⃣ En cada parada el auto se detiene. 2️⃣ Sigue la <b>flecha amarilla ➤</b> girando el celular (o arrastrando). 3️⃣ ' + (h ? '<b>Señala con tu índice</b>' : '<b>Toca</b>') + ' el animal para tomarle la foto 📸. 4️⃣ Responde una pregunta sobre Florida y el viaje sigue.<br>Fotografía 🐢 🦜 🐊 🦩 🐬 y llega a ver el despegue del cohete 🚀.',
    fact: 'Florida es conocida como “The Sunshine State” (el Estado del Sol). Recorriste Miami Beach, los Everglades, la Overseas Highway de los Cayos y la Costa Espacial.'
  },
  heat: {
    short: 'Miami Heat', title: '🏀 Miami Heat — Basketball AR', winMsg: '¡Eres una estrella del Miami Heat!', create: heat,
    how: h => (h
      ? 'Estás en la línea de tiro libre. El balón sigue tu <b>dedo índice</b>: súbelo rápido hacia la canasta para lanzar.'
      : 'Empiezas en la línea de tiro libre. Pon el dedo en la pantalla y <b>desliza hacia arriba</b>, hacia la canasta. La velocidad del deslizamiento es la fuerza y la inclinación es la dirección.') + ' Gira el celular para ver la arena. <b>Encesta 5 balones</b>: después de cada canasta cambias de posición (tiro libre, alas y más lejos).',
    fact: 'El Miami Heat entró a la NBA en 1988 como equipo de expansión y ha ganado tres campeonatos: 2006, 2012 y 2013.'
  }
};
