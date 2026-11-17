// FLORIDA AR ADVENTURE — nuevas experiencias: Miami urbano, Isla de Héroes, fútbol americano y penales.
import * as THREE from 'three';
import {
  M, B, temp, add, box, cyl, sph, cone, cap, smooth, rnd, pick, canvasTex, rep, glow, textTex, label, sky, lightRig, envFromSky, withIntro,
  person, clapAnim, idleAnim, stripedMat, stripesTex, waterMat, palm, decoBuilding, car, lifeguard, disposeTree, SKINS, Q, spawnGLB, turtle, dolphin, starMesh
} from './scenes.js';
const V3 = THREE.Vector3, V2 = THREE.Vector2, clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const _v = new V3(), _w = new V3();

/* ---------- utilidades compartidas ---------- */
function guideArrow(camera, target) { // flecha amarilla hacia un objetivo fuera de pantalla
  const arrow = document.getElementById('arrow');
  if (!target) { arrow.classList.add('hidden'); return; }
  const loc = camera.worldToLocal(target.clone()), pr = target.clone().project(camera);
  if (loc.z < 0 && Math.abs(pr.x) < 0.85 && Math.abs(pr.y) < 0.85) { arrow.classList.add('hidden'); return; }
  const a = Math.atan2(loc.y, loc.x), R = Math.min(innerWidth, innerHeight) / 2 - 50;
  arrow.classList.remove('hidden');
  arrow.style.transform = `translate(${innerWidth / 2 + Math.cos(a) * R}px,${innerHeight / 2 - Math.sin(a) * R}px) rotate(${-a}rad)`;
}
const shotFromVel = vel => ({ pw: clamp(1 + Math.log(Math.max(vel.y, 0.1) / 2.8) * 0.6, 0.5, 1.6), lat: clamp(vel.x / Math.max(vel.y, 0.1), -1, 1) });
function stadium(g, { fieldTex, w, l, cz, crowdCols }) { // estadio nocturno con graderías, público y torres de luces
  g.add(sky(0x050a1e, 0x1a2450, 0x05060a, 1));
  lightRig(g, { sky: 0xdfe8ff, ground: 0x203020, hemi: 0.7, sun: 0xffffff, sunI: 2.4, dir: [6, 20, 10], size: 30, target: [0, 0, cz] });
  const f = add(g, new THREE.PlaneGeometry(w, l), temp(new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 0.95 })), 0, 0.01, cz, false); f.rotation.x = -Math.PI / 2; f.receiveShadow = true;
  const ap = add(g, new THREE.PlaneGeometry(w + 24, l + 24), M(0x2a5a2a, { roughness: 1 }), 0, 0, cz, false); ap.rotation.x = -Math.PI / 2; ap.receiveShadow = true;
  const seat = M(0x1b1f2a, { roughness: 0.9 }), seat2 = M(0x2a2f3e, { roughness: 0.9 }), fans = [];
  const dens = [0.35, 0.6, 0.85][Q];
  const side = (cx, czz, len, alongX, out) => {
    for (let k = 0; k < 10; k++) {
      const off = 1.6 * k + 2, top = 0.9 + k * 0.9, x = alongX ? cx : cx + out * off, z = alongX ? czz + out * off : czz;
      add(g, alongX ? box(len, 0.9, 1.6) : box(1.6, 0.9, len), k % 2 ? seat : seat2, x, top - 0.45, z, false);
      for (let s = -len / 2 + 0.4; s < len / 2; s += 0.62) if (Math.random() < dens) fans.push([alongX ? cx + s : x, top + 0.5 + rnd(-0.05, 0.05), alongX ? z : czz + s, Math.random()]);
    }
  };
  side(-w / 2 - 6, cz, l, false, -1); side(w / 2 + 6, cz, l, false, 1); side(0, cz - l / 2 - 6, w, true, -1); side(0, cz + l / 2 + 6, w, true, 1);
  const bodyG = new THREE.CapsuleGeometry(0.2, 0.42, 3, 8), headG = new THREE.SphereGeometry(0.12, 10, 8);
  const bi = new THREE.InstancedMesh(bodyG, temp(new THREE.MeshStandardMaterial({ roughness: 0.85 })), fans.length), hi = new THREE.InstancedMesh(headG, temp(new THREE.MeshStandardMaterial({ roughness: 0.7 })), fans.length);
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  fans.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); bi.setMatrixAt(i, m4); m4.makeTranslation(p[0], p[1] + 0.45, p[2]); hi.setMatrixAt(i, m4); bi.setColorAt(i, col.set(pick(crowdCols))); hi.setColorAt(i, col.set(pick(SKINS))); });
  g.add(bi, hi);
  for (const [x, z] of [[-w / 2 - 14, cz - l / 3], [w / 2 + 14, cz - l / 3], [-w / 2 - 14, cz + l / 3], [w / 2 + 14, cz + l / 3]]) {
    add(g, box(0.8, 34, 0.8), M(0x888888, { metalness: 0.8 }), x, 17, z, false);
    add(g, box(5, 3, 0.6), M(0xffffff, { emissive: 0xffffff, emissiveIntensity: 2.5 }), x, 34, z, false);
    const l2 = glow(0xfff6e0, 16, 0.5); l2.position.set(x, 34, z); g.add(l2);
  }
  return {
    fans, bi, hi, cheer(t, amp) { // el público salta al celebrar
      const a = bi.instanceMatrix.array, b = hi.instanceMatrix.array;
      for (let i = 0; i < fans.length; i++) { const y = fans[i][1] + Math.max(0, Math.sin(t * 11 + fans[i][3] * 9)) * amp; a[i * 16 + 13] = y; b[i * 16 + 13] = y + 0.45; }
      bi.instanceMatrix.needsUpdate = hi.instanceMatrix.needsUpdate = true;
    }
  };
}
function helmet(P, col) { // casco de fútbol americano con careta
  const r = P.H * 0.075;
  add(P.head, new THREE.SphereGeometry(r, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), M(col, { metalness: 0.4, roughness: 0.25 }), 0, 0.01, -0.005, false);
  for (const y of [-0.25, -0.45]) { const b = add(P.head, new THREE.TorusGeometry(r * 0.85, 0.004, 6, 16, Math.PI), M(0xdddddd, { metalness: 0.8 }), 0, y * r, r * 0.25, false); b.rotation.x = Math.PI / 2; b.rotation.z = Math.PI; }
}

/* ================= MIAMI — EXPLORACIÓN URBANA (5 objetos escondidos) ================= */
const ITEM = {
  key(i) { const gd = M(0xffcc33, { metalness: 1, roughness: 0.25 }); add(i, new THREE.TorusGeometry(0.1, 0.03, 10, 24), gd, -0.15, 0, 0); add(i, box(0.32, 0.05, 0.05), gd, 0.08, 0, 0); add(i, box(0.05, 0.09, 0.05), gd, 0.2, -0.06, 0); },
  glasses(i) { const k = M(0x111111, { roughness: 0.3 }), l = M(0x2b1a55, { metalness: 0.9, roughness: 0.05 }); for (const x of [-0.12, 0.12]) { add(i, new THREE.TorusGeometry(0.09, 0.02, 8, 24), k, x, 0, 0); add(i, new THREE.CircleGeometry(0.085, 24), l, x, 0, 0.003); } add(i, box(0.08, 0.02, 0.02), k, 0, 0.03, 0); },
  surf(i) { const m = add(i, sph(0.3, 24), temp(new THREE.MeshStandardMaterial({ map: stripesTex('#ff4fa3', '#ffffff', 3), roughness: 0.3 }))); m.scale.set(1, 3.6, 0.15); },
  camera(i) { add(i, box(0.36, 0.22, 0.16), M(0x1b1b1b, { roughness: 0.4 })); add(i, cyl(0.08, 0.09, 0.12, 20), M(0x333333, { metalness: 0.8, roughness: 0.2 }), 0, 0, 0.12).rotation.x = Math.PI / 2; },
  coin(i) { add(i, cyl(0.22, 0.22, 0.05, 32), M(0xffd23a, { metalness: 1, roughness: 0.2 })).rotation.x = Math.PI / 2; }
};
function city(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x1a72e0, 0xbfe9ff, 0xefe2c0); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0xd2ecff, 90, 360);
  lightRig(g, { sky: 0xcbe7ff, ground: 0xe8d3a0, hemi: 1.0, sun: 0xfff0d2, sunI: 2.8, dir: [-14, 24, -40], size: 26, target: [0, 0, 10] });
  const ocean = waterMat(0x0b8db0);
  const oc = add(g, new THREE.PlaneGeometry(400, 300, 100, 80), ocean, 0, -0.35, -165, false); oc.rotation.x = -Math.PI / 2;
  const sandT = rep(canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#e8d2a2'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(170,140,90,.25)' : 'rgba(255,250,235,.35)'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }), 60, 6);
  const sand = add(g, new THREE.PlaneGeometry(400, 26), temp(new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 })), 0, 0, -2, false); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true;
  add(g, box(400, 0.25, 3), M(0xf3c6c6, { roughness: 0.9 }), 0, 0.12, 10);
  add(g, box(400, 0.06, 8), M(0x55565c, { roughness: 0.95 }), 0, 0.03, 15.5);
  for (let i = -30; i < 30; i++) add(g, box(2.4, 0.07, 0.15), M(0xffd23a), i * 6, 0.04, 15.5, false);
  add(g, box(400, 0.25, 2.5), M(0xe9e0d6, { roughness: 0.9 }), 0, 0.12, 20.5);
  const NEON = [0xff4fa3, 0x24d1ff, 0x7bff6a, 0xffb000, 0xb36bff], DCOL = [0xffc2d1, 0xa8ece6, 0xfff1b8, 0xd6c6ff, 0xffd3b0, 0xbfe6ff], NAMES = ['SOL', 'PALMA', 'BRISA', 'CORAL', 'MAREA', 'VICE', 'TROPICAL', 'AZUL', 'OCEAN', 'LUNA'];
  for (let x = -70, i = 0; x < 70; i++) { const w = rnd(11, 16); decoBuilding(g, x + w / 2, w, rnd(11, 22), DCOL[i % 6], NEON[i % 5], NAMES[i % 10]); x += w + 1.2; }
  const palms = []; for (let x = -60; x <= 60; x += 9) { palms.push(palm(g, x + rnd(-1, 1), 8.6, 1, rnd(7, 10))); palms.push(palm(g, x + 4, 21.6, 0.9, rnd(6, 9))); }
  const cars = [[0xff4fa3, -30, 13.6, 7], [0x24d1ff, 10, 13.6, 7], [0xffe14d, -5, 17.4, -6], [0x8a5cff, 35, 17.4, -6], [0xffffff, 55, 13.6, 8]].map(a => car(g, ...a));
  const towers = [lifeguard(g, -9, -3, '#ff7ab6', '#24d1ff'), lifeguard(g, 9, -4, '#ffd23a', '#ff5a3a')];
  for (const [x, z, a, b] of [[-3, 0, '#ff5a3a', '#ffffff'], [4, -1, '#24d1ff', '#ffffff'], [-16, -5, '#ffd23a', '#ff4fa3']]) { add(g, cyl(0.04, 0.04, 2.4, 6), M(0xffffff), x, 1.2, z); add(g, cone(1.6, 0.6, 16), stripedMat(a, b, 16), x, 2.4, z); }
  const stop = add(g, cyl(0.38, 0.38, 0.04, 8), M(0xd4202a), 3.5, 2.3, 11.6, false); stop.rotation.x = Math.PI / 2; stop.rotation.y = Math.PI;
  add(g, cyl(0.04, 0.04, 2.3, 6), M(0x999999, { metalness: 0.8 }), 3.5, 1.15, 11.7);
  const bench = new THREE.Group(); bench.position.set(-5, 0.25, 20.8); g.add(bench); add(bench, box(2, 0.08, 0.5), M(0x9a6a3a), 0, 0.55, 0); add(bench, box(2, 0.45, 0.06), M(0x9a6a3a), 0, 0.85, 0.25);
  const DEF = [['🔑', 'key', -6, 0.35, 3.5], ['🕶️', 'glasses', 5, 0.18, 2.5], ['🏄', 'surf', 10.5, 1.1, -2.5], ['📷', 'camera', -5, 1.05, 20.8], ['🪙', 'coin', 12, 1.5, 9]];
  const hitM = temp(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })), beamM = temp(new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const items = DEF.map(([emoji, kind, x, y, z], k) => {
    const it = new THREE.Group(); it.position.set(x, y, z); g.add(it);
    const body = new THREE.Group(); it.add(body); ITEM[kind](body); it.add(glow(0xfff3a0, 1.1, 0.55));
    add(it, new THREE.CylinderGeometry(0.08, 0.35, 7, 12, 1, true), beamM, 0, 3.5, 0, false);
    add(it, sph(0.9, 8), hitM, 0, 0, 0, false);
    it.userData = { emoji, found: false, body, by: y, ph: k, fly: 0, spin: kind !== 'surf' };
    return it;
  });
  let running = false, time = 60, found = 0, hover = null, infoT = 0;
  const info = () => ctx.info(`⏱ ${Math.ceil(time)} s · ${found}/5 · ${items.map(i => i.userData.found ? '✅' : i.userData.emoji).join(' ')}`);
  const pickI = p => { const h = p.ray.intersectObjects(items.filter(i => !i.userData.found), true).find(o => o.object.material === hitM); return h ? h.object.parent : null; };
  const intro = withIntro(ctx, opt, [{ t: 0, p: [0, 22, -28], yaw: Math.PI, pitch: -0.32 }, { t: 3.5, p: [0, 1.6, 10], yaw: Math.PI, pitch: 0.05 }, { t: 6, p: [0, 1.6, 10], yaw: Math.PI * 2, pitch: 0 }], 0, 0);
  const refreshHint = () => ctx.hint((ctx.gyroOn() ? '📱 Gira el celular para buscar · ' : '👆 Arrastra para mirar · ') + (ctx.isHand() ? 'deja tu índice quieto sobre el objeto' : 'toca el objeto') + ' · sigue la flecha amarilla');
  return {
    look: true, camLock: !opt.quick, dwellTime: 0.5, refreshHint,
    start() { running = true; this.camLock = false; info(); refreshHint(); },
    tap(p) {
      if (intro.on) { intro.finish(); this.camLock = false; return; }
      const it = running && pickI(p); if (!it) return;
      it.userData.found = true; it.userData.fly = 0.001; found++; ctx.sfx('pickup'); ctx.burst(it.getWorldPosition(_v), [0xffd700, 0xff4fa3, 0x24d1ff], 45, 2.2); info();
      if (found === 5) { running = false; guideArrow(camera, null); setTimeout(() => ctx.win('city'), 700); }
    },
    hoverable: p => (running ? pickI(p) : null),
    hover(p) { hover = running ? pickI(p) : null; },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      ocean.userData.uT.value = t;
      cars.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x > 75) c.position.x = -75; if (c.position.x < -75) c.position.x = 75; });
      palms.forEach(p => (p.userData.crown.rotation.z = Math.sin(t * 0.9 + p.userData.ph) * 0.05));
      towers.forEach((tw, i) => (tw.userData.flag.rotation.y = Math.sin(t * 4 + i) * 0.4));
      for (const it of items) {
        const u = it.userData;
        if (u.fly) { u.fly += dt; it.position.y += dt * 2.5; it.scale.setScalar(1 + u.fly * 2); if (u.fly > 0.5) it.visible = false; continue; }
        it.position.y = u.by + Math.sin(t * 2 + u.ph) * 0.08; if (u.spin) u.body.rotation.y += dt * 1.5; it.scale.setScalar(hover === it ? 1.3 : 1);
      }
      if (running) {
        time -= dt; infoT += dt; if (infoT > 0.25) { infoT = 0; info(); }
        let best = null, bd = 1e9; for (const it of items) if (!it.userData.found) { const d = it.position.distanceToSquared(camera.position); if (d < bd) { bd = d; best = it.position; } }
        guideArrow(camera, best);
        if (time <= 0) { time = 0; running = false; guideArrow(camera, null); ctx.lose(`Se acabó el tiempo. Encontraste ${found} de 5 objetos. Sigue la flecha amarilla y los haces de luz.`); }
      }
    },
    dispose() { running = false; restoreEnv(); guideArrow(camera, null); }
  };
}

/* ================= ISLA DE HÉROES — parque temático de superhéroes ================= */
function comicTex(col, word) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = col; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 6; y < h; y += 12) for (let x = (y % 24 ? 6 : 0); x < w; x += 12) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
    if (word) {
      g.fillStyle = '#ffe14d'; g.beginPath(); for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283, r = k % 2 ? 70 : 110; g.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); } g.fill(); g.stroke();
      g.fillStyle = '#d4202a'; g.font = 'bold 50px Impact,system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, 128, 132);
    }
  });
}
const WEAPONS = [
  { name: 'Martillo del trueno', note: 'lanza rayos: toca un dron', col: 0x7fd8ff },
  { name: 'Arco de precisión', note: 'tensa y dispara flechas', col: 0xffd23a },
  { name: 'Escudo bumerán', note: 'rebota entre drones y regresa', col: 0xd8d8e0 }
];
function weaponModel(i) {
  const g = new THREE.Group();
  if (i === 0) { // martillo de guerra original con runas
    const rune = canvasTex(128, 64, (q, w, h) => { q.fillStyle = '#6d6f78'; q.fillRect(0, 0, w, h); q.strokeStyle = '#9ad8ff'; q.lineWidth = 3; for (let k = 0; k < 5; k++) { q.beginPath(); q.moveTo(12 + k * 22, 14); q.lineTo(22 + k * 22, 32); q.lineTo(12 + k * 22, 50); q.stroke(); } });
    add(g, new THREE.CylinderGeometry(0.085, 0.085, 0.24, 6), temp(new THREE.MeshStandardMaterial({ map: rune, metalness: 0.85, roughness: 0.35, emissive: 0x113344 })), 0, 0.3, 0, false).rotation.z = Math.PI / 2;
    add(g, cyl(0.022, 0.026, 0.3, 10), M(0x4a2e18, { roughness: 0.8 }), 0, 0.12, 0, false);
    for (let k = 0; k < 6; k++) add(g, new THREE.TorusGeometry(0.025, 0.006, 6, 12), M(0x2a1a0e), 0, 0.02 + k * 0.035, 0, false).rotation.x = Math.PI / 2;
    add(g, sph(0.03, 10), M(0x777777, { metalness: 0.9 }), 0, -0.03, 0, false);
  } else if (i === 1) { // arco recurvo
    const pts = []; for (let k = 0; k <= 20; k++) { const u = k / 20 - 0.5; pts.push(new V3(0, u * 0.62, -Math.abs(u) * 0.12 + (Math.abs(u) > 0.4 ? (Math.abs(u) - 0.4) * 0.6 : 0))); }
    add(g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.011, 8), M(0x2a2a30, { metalness: 0.6, roughness: 0.35 }), 0, 0, 0, false);
    add(g, cyl(0.016, 0.016, 0.1, 10), M(0x6b3a1a, { roughness: 0.8 }), 0, 0, -0.005, false);
    g.userData.string = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, 0.31, 0.02), new V3(0, 0, 0.02), new V3(0, -0.31, 0.02)]), temp(new THREE.LineBasicMaterial({ color: 0xeeeeee })));
    g.add(g.userData.string);
  } else { // escudo redondo con emblema de rayo
    const em = canvasTex(256, 256, (q, w) => { const r = q.createRadialGradient(128, 128, 10, 128, 128, 128); r.addColorStop(0, '#e9e9f0'); r.addColorStop(1, '#8a8a96'); q.fillStyle = r; q.fillRect(0, 0, w, w); q.fillStyle = '#1d3a8a'; q.beginPath(); q.arc(128, 128, 70, 0, 7); q.fill(); q.fillStyle = '#ffd23a'; q.beginPath(); q.moveTo(140, 70); q.lineTo(100, 135); q.lineTo(128, 135); q.lineTo(112, 190); q.lineTo(160, 118); q.lineTo(132, 118); q.closePath(); q.fill(); });
    const s = add(g, new THREE.SphereGeometry(0.3, 32, 12, 0, Math.PI * 2, 0, 0.5), temp(new THREE.MeshStandardMaterial({ map: em, metalness: 0.9, roughness: 0.25 })), 0, 0, 0, false); s.rotation.x = Math.PI / 2; s.scale.z = 0.5;
  }
  return g;
}
function drone() {
  const d = new THREE.Group();
  add(d, sph(0.45, 20), M(0x2a2d36, { metalness: 0.9, roughness: 0.3 })).scale.y = 0.6;
  add(d, sph(0.14, 12), M(0xff2a2a, { emissive: 0xff1010, emissiveIntensity: 2.5 }), 0, 0, 0.36, false);
  d.userData.rot = [[0.6, 0.6], [-0.6, 0.6], [0.6, -0.6], [-0.6, -0.6]].map(([x, z]) => {
    add(d, box(0.6, 0.06, 0.08), M(0x444a55, { metalness: 0.8 }), x / 2, 0, z / 2, false).rotation.y = Math.atan2(z, x);
    const r = add(d, box(0.5, 0.02, 0.06), M(0x111111), x, 0.1, z, false); return r;
  });
  d.add(glow(0xff3030, 1.2, 0.35));
  return d;
}
function heroes(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x1b1050, 0xff7a4a, 0x2a1830); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0x8a4a6a, 40, 200);
  lightRig(g, { sky: 0xffc8b0, ground: 0x2a2040, hemi: 0.9, sun: 0xffb27a, sunI: 2.4, dir: [-20, 16, 10], size: 30, target: [0, 0, -6] });
  const tile = rep(canvasTex(256, 256, (q, w) => { const C = ['#3a3f8a', '#d4202a', '#ffd23a', '#2c9a4a', '#ffffff']; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { q.fillStyle = (x + y) % 2 ? '#30344a' : C[(x * 3 + y) % 5]; q.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); } }), 30, 30);
  const gr = add(g, new THREE.PlaneGeometry(200, 200), temp(new THREE.MeshStandardMaterial({ map: tile, roughness: 0.8 })), 0, 0, 0, false); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true;
  const COLS = ['#d4202a', '#2a4ad4', '#2c9a4a', '#8a2ad4', '#ff8a1a', '#18a8c8'], WORDS = ['¡POW!', '¡ZAS!', '¡BUM!', '¡KRAK!', '¡ZOOM!', '¡WHAM!'];
  for (let i = 0; i < 12; i++) { // edificios estilo cómic alrededor de la plaza
    const a = i / 12 * Math.PI * 2, r = rnd(24, 32), h = rnd(9, 20), w = rnd(8, 12), b = new THREE.Group(); b.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r); b.rotation.y = -a; g.add(b);
    const side = temp(new THREE.MeshStandardMaterial({ map: comicTex(COLS[i % 6]), roughness: 0.7 })), front = temp(new THREE.MeshStandardMaterial({ map: comicTex(COLS[(i + 2) % 6], WORDS[i % 6]), roughness: 0.6 }));
    add(b, box(w, h, 8), [side, side, side, side, front, side], 0, h / 2, 0);
    for (let k = 0; k < 4; k++) add(b, box(0.25, 3, 0.25), M(0x8a8f9a, { metalness: 0.9, roughness: 0.3 }), -w / 2 + 1 + k * (w - 2) / 3, h + 1.5, -3);
    add(b, box(w - 1, 0.25, 0.25), M(0x8a8f9a, { metalness: 0.9 }), 0, h + 3, -3);
    add(b, box(w * 0.7, 0.2, 2), M(0x111111, { metalness: 0.5 }), 0, 3.2, 4.6);
  }
  // torre de caída libre con asientos que suben y bajan
  const tw = new THREE.Group(); tw.position.set(14, 0, -22); g.add(tw);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(tw, box(0.3, 46, 0.3), M(0x8a8f9a, { metalness: 0.9, roughness: 0.3 }), x, 23, z);
  for (let y = 3; y < 46; y += 3) add(tw, box(2.3, 0.15, 2.3), M(0x6a6f7a, { metalness: 0.8 }), 0, y, 0, false);
  add(tw, cone(2, 4, 8), M(0xd4202a, { metalness: 0.4 }), 0, 48, 0);
  const seats = new THREE.Group(); tw.add(seats); add(seats, cyl(2.4, 2.4, 1.2, 16), M(0xffd23a, { metalness: 0.4, roughness: 0.4 }), 0, 0, 0);
  const arch = add(g, new THREE.TorusGeometry(6, 0.6, 12, 40, Math.PI), M(0xd4202a, { metalness: 0.5, roughness: 0.3 }), 0, 0, 12); arch.rotation.y = Math.PI;
  add(g, new THREE.PlaneGeometry(9, 1.6), temp(new THREE.MeshStandardMaterial({ map: textTex('ISLA DE HÉROES', 1024, 180, '#111a4a', '#ffe14d', 'bold 96px Impact,system-ui'), emissive: 0x222200, side: THREE.DoubleSide })), 0, 7, 12, false);
  // drones enemigos: aparecen de uno en uno FRENTE a ti y se marcan con un aro rojo
  const ringT = canvasTex(128, 128, (q) => { q.strokeStyle = '#ff2a2a'; q.lineWidth = 10; q.beginPath(); q.arc(64, 64, 52, 0, 7); q.stroke(); q.lineWidth = 6; for (const a of [0, 1.57, 3.14, 4.71]) { q.beginPath(); q.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40); q.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); q.stroke(); } });
  const reticle = new THREE.Sprite(temp(new THREE.SpriteMaterial({ map: ringT, transparent: true, depthTest: false }))); reticle.scale.setScalar(2.4); reticle.visible = false; reticle.renderOrder = 9; g.add(reticle);
  const drones = Array.from({ length: 5 }, () => { const d = drone(); d.visible = false; d.userData.hp = 2; g.add(d); return d; });
  let cur = -1, baseYaw = 0, spawnT = 0;
  function spawn() {
    cur++; if (cur >= 5) return;
    const d = drones[cur], f = new V3(0, 0, -1).applyQuaternion(camera.quaternion); baseYaw = Math.atan2(f.x, -f.z);
    d.visible = true; d.userData.hp = 2; d.userData.t0 = 0; d.scale.setScalar(0.01);
    ctx.sfx('charge'); ctx.toast(`🚨 ¡Dron ${cur + 1} de 5 a la vista! Está marcado con el aro rojo.`, 2500); info();
  }
  // armas: vista previa giratoria + botones grandes para elegir
  const shelf = new THREE.Group(); shelf.position.set(0, 0.02, -0.8); shelf.visible = false; camera.add(shelf);
  const picks = WEAPONS.map((w, i) => { const h = new THREE.Group(); h.position.x = (i - 1) * 0.11; h.scale.setScalar(0.2); shelf.add(h); h.add(weaponModel(i)); h.add(glow(w.col, 0.5, 0.4)); return h; });
  const bar = document.createElement('div'); bar.id = 'pickbar'; bar.className = 'hidden'; document.getElementById('app').appendChild(bar);
  const ICON = ['⚡', '🏹', '🛡️'], VERB = ['⚡ LANZAR RAYO', '🏹 DISPARAR FLECHA', '🛡️ LANZAR ESCUDO'];
  const hand = new THREE.Group(); hand.scale.setScalar(0.55); camera.add(hand);
  let wi = -1, held = null, running = false, killed = 0, cd = 0, kick = 0, draw = 0, drawing = false;
  const bolts = [], arrows = [], sh = { state: 'held', obj: null, tgt: null };
  const info = () => ctx.info(wi < 0 ? '🦸 Elige tu arma' : `🎯 Dron ${Math.min(cur + 1, 5)}/5 · ${'❤️'.repeat(cur >= 0 && cur < 5 ? drones[cur].userData.hp : 0)} · Derribados ${killed}`);
  function showPick() {
    bar.innerHTML = WEAPONS.map((w, i) => `<button data-i="${i}"><b>${ICON[i]} ${w.name}</b><span>${w.note}</span></button>`).join('');
    bar.querySelectorAll('button').forEach(b => (b.onclick = () => choose(+b.dataset.i)));
    bar.classList.remove('hidden'); shelf.visible = true; document.body.classList.add('hasbar');
  }
  function choose(i) {
    wi = i; shelf.visible = false; held = weaponModel(i); hand.add(held); if (i === 2) sh.obj = held;
    bar.innerHTML = `<button class="attack">${VERB[i]}</button>`; bar.querySelector('button').onclick = () => fire();
    running = true; ctx.sfx('pickup'); refreshHint(); spawn();
  }
  function hitDrone(d) {
    if (!d || !d.visible || d.userData.dead) return;
    d.userData.hp--; ctx.burst(d.position, [0x7fd8ff, 0xffffff, 0xffa020], 30, 2); ctx.sfx('hit'); d.userData.wob = 1;
    if (d.userData.hp <= 0) {
      d.userData.dead = 0.001; killed++; ctx.burst(d.position, [0xffa020, 0xff3030, 0xffffff], 80, 3.2); reticle.visible = false;
      if (killed >= 5) { running = false; bar.classList.add('hidden'); setTimeout(() => ctx.win('heroes'), 1300); }
      else { ctx.toast(`💥 ¡Derribado! ${killed}/5`, 1600); spawnT = 1.4; }
    }
    info();
  }
  function fire() {
    if (!running || cd > 0) return;
    const d = drones[cur]; if (!d || !d.visible || d.userData.dead) return;
    const from = held.getWorldPosition(new V3()), tp = d.position.clone();
    if (wi === 0) {
      cd = 0.7; kick = 1; ctx.sfx('spell');
      const pts = []; for (let k = 0; k <= 14; k++) { const q = from.clone().lerp(tp, k / 14); if (k && k < 14) q.add(_v.set(rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4))); pts.push(q); }
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), temp(new THREE.LineBasicMaterial({ color: 0xbfefff, transparent: true, blending: THREE.AdditiveBlending })));
      g.add(ln); bolts.push({ ln, life: 0.25 }); hitDrone(d);
    } else if (wi === 1) {
      if (drawing) return; drawing = true; cd = 0.9;
      setTimeout(() => {
        drawing = false; if (!held) return; ctx.sfx('throw');
        const m = new THREE.Group(); m.position.copy(held.getWorldPosition(new V3())); g.add(m);
        add(m, cyl(0.012, 0.012, 0.8, 6), M(0x6b4a2a), 0, 0, 0, false).rotation.x = Math.PI / 2; add(m, cone(0.035, 0.1, 8), M(0xaaaaaa, { metalness: 0.9 }), 0, 0, -0.45, false).rotation.x = -Math.PI / 2;
        arrows.push({ m, d, life: 2 });
      }, 350);
    } else if (sh.state === 'held') {
      sh.state = 'go'; sh.tgt = d; hand.remove(sh.obj); g.add(sh.obj); sh.obj.position.copy(from); sh.obj.scale.setScalar(1.6); ctx.sfx('throw');
    }
  }
  const intro = withIntro(ctx, opt, [{ t: 0, p: [0, 1.6, 26], yaw: 0, pitch: 0.2 }, { t: 3.5, p: [0, 1.6, 4], yaw: 0, pitch: 0.12 }, { t: 7.5, p: [0, 1.6, 0], yaw: Math.PI * 2, pitch: 0.1 }], 0, 0.1);
  const refreshHint = () => ctx.hint(wi < 0 ? 'Elige tu arma con los botones de abajo 👇'
    : `Pulsa <b>${VERB[wi]}</b> ` + (ctx.isHand() ? 'o haz pinza' : 'o toca la pantalla') + ' para atacar al dron del <b>aro rojo</b>. Cada dron aguanta 2 golpes.');
  return {
    camLock: !opt.quick, dwellTime: 0.45, refreshHint,
    start() { this.camLock = false; info(); refreshHint(); showPick(); },
    onDown() { if (intro.on) { intro.finish(); this.camLock = false; return; } if (running) fire(); },
    onMove() {}, onUp() {},
    tap() { if (intro.on) { intro.finish(); this.camLock = false; return; } fire(); },
    hoverable(p) { const d = drones[cur]; return running && d && d.visible && !d.userData.dead && p.ray.ray.distanceSqToPoint(d.position) < 4 ? d : null; },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      seats.position.y = 4 + (Math.sin(t * 0.5) * 0.5 + 0.5) ** 3 * 38;
      if (shelf.visible) picks.forEach(h => (h.rotation.y += dt));
      cd = Math.max(0, cd - dt); kick = Math.max(0, kick - dt * 4);
      const n = ctx.ptr.ndc, hh = 0.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
      hand.position.set(0.55 * hw, -0.6 * hh, -0.5);
      const d = drones[cur];
      hand.lookAt(d && d.visible ? d.position : ctx.ptr.ray.ray.at(20, _w)); hand.rotateX(Math.PI / 2 - kick * 0.6);
      if (held && wi === 1) { draw = drawing ? Math.min(1, draw + dt * 3) : Math.max(0, draw - dt * 8); const a = held.userData.string.geometry.attributes.position; a.setZ(1, 0.02 + draw * 0.22); a.needsUpdate = true; }
      if (held && wi === 0 && Math.random() < 0.3) ctx.burst(held.getWorldPosition(_v), 0x7fd8ff, 1, 0.5);
      if (spawnT > 0) { spawnT -= dt; if (spawnT <= 0) spawn(); }
      drones.forEach(dr => {
        const u = dr.userData; if (!dr.visible) return;
        u.rot.forEach(r => (r.rotation.y += dt * 40));
        if (u.dead) { u.dead += dt; dr.scale.setScalar(Math.max(0.01, 1 - u.dead * 2)); dr.position.y -= dt * 4; if (u.dead > 0.6) dr.visible = false; return; }
        u.t0 += dt; const dist = 12 - Math.sin(u.t0 * 0.4) * 3, ang = baseYaw + Math.sin(u.t0 * 0.7) * 0.32;
        dr.position.set(Math.sin(ang) * dist, 3.2 + Math.sin(u.t0 * 1.3) * 0.9, -Math.cos(ang) * dist);
        dr.scale.setScalar(Math.min(1.4, u.t0 * 2)); u.wob = Math.max(0, (u.wob || 0) - dt * 2); dr.rotation.z = Math.sin(t * 30) * 0.3 * u.wob;
        dr.lookAt(camera.position);
        reticle.visible = true; reticle.position.copy(dr.position); reticle.scale.setScalar(2.4 + Math.sin(t * 6) * 0.25); reticle.material.rotation += dt;
      });
      for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.life -= dt; b.ln.material.opacity = b.life * 4; if (b.life <= 0) { g.remove(b.ln); disposeTree(b.ln); bolts.splice(i, 1); } }
      for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i]; a.life -= dt; _v.copy(a.d.position).sub(a.m.position); const dd = _v.length();
        a.m.position.addScaledVector(_v.normalize(), Math.min(dd, 30 * dt)); a.m.lookAt(_w.copy(a.m.position).sub(_v));
        if (dd < 0.7 || a.life <= 0) { if (dd < 0.7) hitDrone(a.d); g.remove(a.m); disposeTree(a.m); arrows.splice(i, 1); }
      }
      if (sh.state !== 'held') {
        const tp = sh.state === 'go' ? sh.tgt.position : hand.getWorldPosition(new V3());
        _v.copy(tp).sub(sh.obj.position); const dd = _v.length(); sh.obj.position.addScaledVector(_v.normalize(), Math.min(dd, 24 * dt)); sh.obj.rotation.z += dt * 18;
        if (dd < 0.8) {
          if (sh.state === 'go') { hitDrone(sh.tgt); ctx.sfx('rim'); sh.state = 'back'; }
          else { g.remove(sh.obj); hand.add(sh.obj); sh.obj.position.set(0, 0, 0); sh.obj.rotation.set(0, 0, 0); sh.obj.scale.setScalar(1); sh.state = 'held'; ctx.sfx('block'); }
        }
      }
      guideArrow(camera, d && d.visible && !d.userData.dead ? d.position : null);
    },
    dispose() { running = false; restoreEnv(); guideArrow(camera, null); bar.remove(); document.body.classList.remove('hasbar'); camera.remove(shelf); camera.remove(hand); disposeTree(shelf); disposeTree(hand); }
  };
}

/* ================= FÚTBOL AMERICANO — FIELD GOAL CHALLENGE ================= */
const YD = 0.9144;
function fbFieldTex() {
  return canvasTex(512, 1200, (g, w, h) => {
    const py = h / 120; // 120 yardas
    for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#2f7a2e' : '#358a33'; g.fillRect(0, i * 5 * py, w, 5 * py); }
    g.fillStyle = '#1d3a8a'; g.fillRect(0, 0, w, 10 * py); g.fillStyle = '#d4202a'; g.fillRect(0, h - 10 * py, w, 10 * py);
    g.fillStyle = '#fff'; g.font = 'bold 54px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('FLORIDA', w / 2, 5 * py); g.fillText('FLORIDA', w / 2, h - 5 * py);
    g.strokeStyle = '#fff'; g.lineWidth = 4;
    for (let yd = 10; yd <= 110; yd += 5) { g.beginPath(); g.moveTo(0, yd * py); g.lineTo(w, yd * py); g.stroke(); }
    g.font = 'bold 34px system-ui';
    for (let yd = 20; yd <= 100; yd += 10) { const n = yd <= 60 ? yd - 10 : 110 - yd; g.fillText(String(n), 60, yd * py); g.fillText(String(n), w - 60, yd * py); }
    g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  });
}
function fbBall() {
  const b = new THREE.Group();
  const t = canvasTex(256, 128, (q, w, h) => { q.fillStyle = '#6b3410'; q.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { q.fillStyle = 'rgba(0,0,0,.15)'; q.fillRect(Math.random() * w, Math.random() * h, 2, 2); } q.fillStyle = '#fff'; q.fillRect(w * 0.35, h * 0.08, w * 0.3, 5); for (let k = 0; k < 7; k++) q.fillRect(w * 0.37 + k * w * 0.04, h * 0.03, 4, 16); });
  const m = add(b, sph(0.11, 24), temp(new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 }))); m.scale.set(1, 1, 1.6);
  return b;
}
function goalPost(g, z) {
  const y = M(0xffd400, { metalness: 0.4, roughness: 0.4 });
  add(g, cyl(0.12, 0.12, 3.05, 12), y, 0, 1.52, z + 1.8);
  add(g, box(0.2, 0.2, 1.8), y, 0, 3.05, z + 0.9);
  add(g, cyl(0.1, 0.1, 5.64, 12), y, 0, 3.05, z).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { add(g, cyl(0.07, 0.07, 9, 10), y, s * 2.82, 7.55, z); const f = add(g, new THREE.PlaneGeometry(0.3, 1.1), M(0xff6a00, { side: THREE.DoubleSide }), s * 2.82, 12.4, z, false); f.userData.flag = 1; }
  add(g, box(0.6, 3, 0.6), M(0x1d3a8a, { roughness: 0.8 }), 0, 1.5, z + 1.8);
}
function fg(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const L = 110 * YD, postZ = -L / 2 - 10 * YD + 10 * YD; // postes en la línea de fondo
  const ST = stadium(g, { fieldTex: fbFieldTex(), w: 48.8, l: 120 * YD, cz: 0, crowdCols: [0xf47321, 0xf47321, 0x00843d, 0x00843d, 0xffffff, 0x1d3a8a, 0x111111, 0xd4202a] });
  scene.fog = new THREE.Fog(0x0a1030, 60, 220);
  const PZ = -60 * YD + 0; goalPost(g, PZ);
  goalPost(g, 60 * YD);
  const DIST = [20, 30, 40].map(y => y * YD);
  let stage = 0, good = 0, tries = 0, running = false, ball = fbBall(), st = 'rest', vel = new V3(), cel = 0, fbT = 0, crossed = false;
  g.add(ball);
  const team = [], refs = [];
  const spotZ = () => PZ + DIST[stage] + 7 * YD;
  const tee = add(g, cone(0.07, 0.12, 12), M(0xff6a00, { roughness: 0.6 }), 0, 0.06, 0);
  for (let i = 0; i < 7; i++) { const P = person({ h: rnd(1.85, 1.98), athlete: true, top: 0xf47321, bottom: 0xffffff, num: String(60 + i) }); helmet(P, 0x00843d); P.p.rotation.y = Math.PI; g.add(P.p); team.push(P); }
  for (let i = 0; i < 7; i++) { const P = person({ h: rnd(1.85, 2), athlete: true, top: 0x1d3a8a, bottom: 0xffffff, num: String(90 + i) }); helmet(P, 0xd4202a); g.add(P.p); team.push(P); }
  const ref = person({ h: 1.8, topMat: stripedMat('#ffffff', '#111111', 12), bottom: 0xffffff, sleeves: true }); ref.p.position.set(0, 0, PZ + 2); g.add(ref.p); refs.push(ref);
  function setup() {
    const z = spotZ(); st = 'rest'; crossed = false;
    ball.position.set(0, 0.26, z);
    tee.position.z = z; ball.rotation.set(0.35, 0, 0);
    team.forEach((P, i) => { const k = i % 7, def = i >= 7; P.p.position.set((k - 3) * 1.1, 0, z - (def ? 7.5 : 6.3)); P.legs.forEach(l => { l.th.rotation.x = -0.6; l.kn.rotation.x = 0.9; }); P.hips.position.y = P.leg * 0.85; P.arms.forEach(a => { a.sh.rotation.x = def ? -1.6 : -0.4; }); });
    camera.position.set(0, 1.6, z + 4.2); ctx.lookReset(0, 0.04);
    ctx.info(`🏈 Goles ${good}/3 · ${Math.round(DIST[stage] / YD)} yardas · Intentos ${tries}`);
  }
  function kick(vel2) {
    if (!running || st !== 'rest') return;
    const { pw, lat } = shotFromVel(vel2); tries++; st = 'fly'; ctx.sfx('bounce'); ctx.sfx('throw');
    const R = (DIST[stage] + 7 * YD + 10) * pw, th = 0.66, sp = Math.sqrt(R * 9.8 / Math.sin(2 * th)), ang = lat * 0.32;
    vel.set(Math.sin(ang) * Math.cos(th) * sp, Math.sin(th) * sp, -Math.cos(ang) * Math.cos(th) * sp);
    fbT = 0;
  }
  const intro = withIntro(ctx, opt, [{ t: 0, p: [18, 14, 30], yaw: 0.6, pitch: -0.3 }, { t: 4, p: [0, 1.6, spotZ() + 4.2], yaw: 0, pitch: 0.04 }], 0, 0.04, () => setup());
  const startHint = () => ctx.hint(ctx.footOn() ? '🦶 Pon el pie frente a la cámara (punto amarillo en la punta del zapato) y patea' : '👆 Pon el dedo y desliza rápido hacia los postes');
  setup();
  return {
    camLock: !opt.quick, foot: true, refreshHint: startHint,
    start() { running = true; this.camLock = false; setup(); startHint(); },
    onDown() { if (intro.on) { intro.finish(); this.camLock = false; } },
    onMove() {}, onUp(p) { if (!running || p.src === 'hand') return; const v = p.vel(110); if (v.y > 0.9) kick(v); },
    kick(v) { kick(v); },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      ST.cheer(t, cel > 0 ? 0.3 : 0.02); cel = Math.max(0, cel - dt);
      g.traverse(o => { if (o.userData.flag) o.rotation.y = Math.sin(t * 3) * 0.4; });
      if (cel > 0) { refs[0].arms.forEach(a => (a.sh.rotation.x = -3)); team.slice(0, 7).forEach(P => P.arms.forEach(a => (a.sh.rotation.x = -2.9))); } else idleAnim(ref, t);
      if (st === 'fly') {
        fbT += dt; vel.y -= 9.8 * dt; const pz = ball.position.z; ball.position.addScaledVector(vel, dt); ball.rotation.x -= dt * 12;
        if (!crossed && pz > PZ && ball.position.z <= PZ) {
          crossed = true;
          const ok = Math.abs(ball.position.x) < 2.82 && ball.position.y > 3.05;
          if (ok) { good++; cel = 2.5; ctx.sfx('crowd'); ctx.sfx('score'); ctx.burst(_v.set(0, 12, PZ), [0xf47321, 0x00843d, 0xffffff, 0xffd400], 120, 4); ctx.toast('🏈 ¡ES BUENO! Gol de campo', 2500); }
          else { ctx.sfx('lose'); ctx.toast(ball.position.y <= 3.05 ? '❌ ¡Le faltó fuerza! Patea más fuerte.' : '❌ ¡Desviado! Patea más recto.', 2500); }
          setTimeout(() => {
            if (!running) return;
            if (ok) { if (good >= 3) { running = false; ctx.win('fg'); return; } stage = Math.min(2, stage + 1); ctx.toast(`📍 Ahora desde ${Math.round(DIST[stage] / YD)} yardas`, 2500); }
            setup();
          }, 2300);
        }
        if (ball.position.y < 0.12) { ball.position.y = 0.12; vel.multiplyScalar(0.4); vel.y = Math.abs(vel.y) * 0.4; }
        if (fbT > 6 && !crossed) { crossed = true; ctx.toast('❌ ¡No llegó!', 2000); setTimeout(() => running && setup(), 1500); }
      }
    },
    dispose() { running = false; }
  };
}

/* ================= FÚTBOL — PENALTY CHALLENGE ================= */
function soccerTex() {
  return canvasTex(512, 800, (g, w, h) => {
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#2e7d32' : '#388e3c'; g.fillRect(0, i * h / 16, w, h / 16); }
    const px = w / 68; g.strokeStyle = '#fff'; g.lineWidth = 4;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.strokeRect(w / 2 - 20.16 * px, 4, 40.32 * px, 16.5 * px); g.strokeRect(w / 2 - 9.16 * px, 4, 18.32 * px, 5.5 * px);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2, 11 * px, 4, 0, 7); g.fill();
    g.beginPath(); g.arc(w / 2, 11 * px, 9.15 * px, 0.65, Math.PI - 0.65); g.stroke();
    g.beginPath(); g.moveTo(0, h - 4); g.lineTo(w, h - 4); g.stroke();
  });
}
let _sball;
function soccerBallMat() {
  return _sball || (_sball = new THREE.MeshStandardMaterial({ roughness: 0.45, map: (() => { const t = canvasTex(512, 256, (q, w, h) => { q.fillStyle = '#f4f4f4'; q.fillRect(0, 0, w, h); q.fillStyle = '#111'; for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { const cx = x * 64 + (y % 2) * 32 + 16, cy = y * 64 + 32; q.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 - 1.57; q.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); } q.fill(); } }); t.userData.keep = true; return t; })() }));
}
function penalty(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const GZ = -11; // línea de gol a 11 m del punto penal
  const ST = stadium(g, { fieldTex: soccerTex(), w: 68, l: 105 * 0.5, cz: GZ + 105 * 0.25, crowdCols: [0xf7b5cd, 0xf7b5cd, 0x111111, 0x111111, 0xffffff, 0x24d1ff, 0xffd23a, 0xd4202a] });
  scene.fog = new THREE.Fog(0x0a1030, 50, 200);
  const white = M(0xffffff, { roughness: 0.3, metalness: 0.2 });
  for (const s of [-1, 1]) add(g, cyl(0.06, 0.06, 2.44, 12), white, s * 3.66, 1.22, GZ);
  add(g, cyl(0.06, 0.06, 7.44, 12), white, 0, 2.44, GZ).rotation.z = Math.PI / 2;
  const netPts = [];
  for (let x = -3.66; x <= 3.67; x += 0.25) { netPts.push(x, 2.44, GZ, x, 2.44, GZ - 2, x, 2.44, GZ - 2, x, 0, GZ - 2); }
  for (let y = 0; y <= 2.45; y += 0.25) { netPts.push(-3.66, y, GZ - 2, 3.66, y, GZ - 2); for (const s of [-1, 1]) netPts.push(s * 3.66, y, GZ, s * 3.66, y, GZ - 2); }
  for (let z = 0; z <= 2.01; z += 0.25) { netPts.push(-3.66, 2.44, GZ - z, 3.66, 2.44, GZ - z); for (const s of [-1, 1]) netPts.push(s * 3.66, 0, GZ - z, s * 3.66, 2.44, GZ - z); }
  const netG = new THREE.BufferGeometry(); netG.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3)); const netBase = netPts.slice();
  const net = new THREE.LineSegments(netG, temp(new THREE.LineBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.8 }))); g.add(net);
  const K = person({ h: 1.9, athlete: true, top: 0x39ff6a, bottom: 0x111111, sleeves: true, shorts: true, num: '1', hairStyle: 'short' });
  K.arms.forEach(a => add(a.el, sph(0.06, 10), M(0xffffff), 0, -0.17 * 1.9, 0, false).scale.set(1.2, 1.4, 0.8));
  K.p.position.set(0, 0, GZ + 0.3); g.add(K.p);
  const ball = add(g, sph(0.11, 32), soccerBallMat());
  let running = false, shots = 0, goals = 0, st = 'rest', vel = new V3(), cel = 0, dive = 0, diveT = 0, kx = 0, res = '', saveX = 0, netK = 0, flyT = 0;
  const info = () => ctx.info(`⚽ Goles ${goals} · Penal ${Math.min(shots + (st === 'rest' ? 1 : 0), 5)}/5 · Necesitas 3`);
  function setup() {
    st = 'rest'; res = ''; dive = 0; diveT = 0; ball.position.set(0, 0.11, 0); ball.rotation.set(0, 0, 0);
    K.p.position.set(0, 0, GZ + 0.3); K.p.rotation.set(0, 0, 0); K.hips.position.y = K.leg;
    camera.position.set(0, 1.6, 2.8); ctx.lookReset(0, -0.05); info();
  }
  function shoot(vel2) {
    if (!running || st !== 'rest') return;
    const { pw, lat } = shotFromVel(vel2); shots++; st = 'fly'; flyT = 0; ctx.sfx('bounce'); ctx.sfx('throw');
    const tx = clamp(lat * 1.8, -1.4, 1.4) * 3.66, ty = clamp(0.25 + (pw - 0.75) * 2.8, 0.12, 3.4), T = 0.62 / clamp(pw, 0.7, 1.4);
    vel.set(tx / T, (ty - 0.11) / T + 0.5 * 9.8 * T, GZ / T);
    const r = Math.random(); dive = r < 0.4 ? -1 : r < 0.8 ? 1 : 0; diveT = 0.001; // el portero adivina un lado
    saveX = dive * 2.3;
  }
  const intro = withIntro(ctx, opt, [{ t: 0, p: [10, 9, 14], yaw: 0.6, pitch: -0.32 }, { t: 3.8, p: [0, 1.6, 2.8], yaw: 0, pitch: -0.05 }], 0, -0.05, () => setup());
  const startHint = () => ctx.hint(ctx.footOn() ? '🦶 Pon el pie frente a la cámara (punto amarillo en la punta del zapato) y patea' : '👆 Desliza hacia el arco: la inclinación apunta y la velocidad es la fuerza');
  setup();
  return {
    camLock: !opt.quick, foot: true, refreshHint: startHint,
    start() { running = true; this.camLock = false; setup(); startHint(); },
    onDown() { if (intro.on) { intro.finish(); this.camLock = false; } },
    onMove() {}, onUp(p) { if (!running || p.src === 'hand') return; const v = p.vel(110); if (v.y > 0.9) shoot(v); },
    kick(v) { shoot(v); },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      ST.cheer(t, cel > 0 ? 0.3 : 0.02); cel = Math.max(0, cel - dt);
      // portero: se mueve de lado a lado y luego se lanza
      if (diveT) {
        diveT += dt; const k = smooth(diveT / 0.45);
        K.p.position.x = lerp(kx, saveX, k); K.p.rotation.z = -dive * 1.25 * k; K.p.position.y = dive ? Math.sin(Math.min(1, diveT / 0.45) * Math.PI) * 0.5 : Math.sin(Math.min(1, diveT / 0.5) * Math.PI) * 0.45;
        K.arms.forEach(a => { a.sh.rotation.x = -2.9; a.sh.rotation.z = 0; });
      } else if (st === 'rest') {
        kx = Math.sin(t * 1.6) * 0.8; K.p.position.x = kx; K.legs.forEach(l => { l.th.rotation.x = -0.4; l.kn.rotation.x = 0.7; }); K.hips.position.y = K.leg - 0.12;
        K.arms.forEach(a => { a.sh.rotation.z = a.s * 0.7; a.sh.rotation.x = -0.3; a.el.rotation.x = -0.4; });
      }
      if (st === 'fly') {
        flyT += dt; vel.y -= 9.8 * dt; const pz = ball.position.z; ball.position.addScaledVector(vel, dt); ball.rotation.x -= dt * 20;
        if (pz > GZ && ball.position.z <= GZ && !res) {
          const { x, y } = ball.position, inGoal = Math.abs(x) < 3.6 && y < 2.4 && y > 0;
          const handX = K.p.position.x - Math.sin(K.p.rotation.z) * 1.0, handY = 1.0 + K.p.position.y + Math.cos(K.p.rotation.z) * 0.9;
          const saved = inGoal && (dive ? Math.abs(x - handX) < 1.15 && y < 2.3 : Math.abs(x) < 0.85 && y < 2.4);
          if (!inGoal) { res = 'out'; ctx.sfx(Math.abs(Math.abs(x) - 3.66) < 0.2 || Math.abs(y - 2.44) < 0.2 ? 'rim' : 'lose'); ctx.toast(Math.abs(Math.abs(x) - 3.66) < 0.25 ? '🥅 ¡Al palo!' : '❌ ¡Afuera!', 2000); vel.set(vel.x * 0.3, 2, 3); }
          else if (saved) { res = 'save'; ctx.sfx('block'); ctx.toast('🧤 ¡Atajada del portero!', 2000); vel.set(-vel.x * 0.3, 3, 6); }
          else { res = 'goal'; goals++; cel = 2.5; netK = 1; ctx.sfx('crowd'); ctx.sfx('score'); ctx.burst(_v.set(x, y, GZ - 1), [0xf7b5cd, 0xffffff, 0x111111], 80, 3); ctx.toast('⚽ ¡GOOOL!', 2000); vel.multiplyScalar(0.15); }
          info();
          setTimeout(() => {
            if (!running) return;
            if (goals >= 3) { running = false; ctx.win('penalty'); return; }
            if (shots >= 5) { running = false; ctx.lose(`Hiciste ${goals} de 5 goles. Necesitas 3. Apunta a las esquinas: el portero no siempre adivina.`); return; }
            setup();
          }, 2200);
        }
        if (ball.position.z < GZ - 1.9) { ball.position.z = GZ - 1.9; vel.z = 0; vel.x *= 0.3; }
        if (ball.position.y < 0.11) { ball.position.y = 0.11; vel.y = Math.abs(vel.y) * 0.4; vel.x *= 0.8; vel.z *= 0.8; }
      }
      if (netK > 0) { netK = Math.max(0, netK - dt * 1.5); const a = net.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) a[i + 2] = netBase[i + 2] - Math.sin(t * 20 + a[i]) * 0.15 * netK * (GZ - netBase[i + 2] > 1 ? 1 : 0.3); net.geometry.attributes.position.needsUpdate = true; }
    },
    dispose() { running = false; }
  };
}


/* ================= MIAMI BEACH — TOUR ACUÁTICO (3 carriles, fácil de jugar) ================= */
function boatModel() {
  const b = new THREE.Group();
  const hs = new THREE.Shape(); hs.moveTo(-3, -1.2); hs.lineTo(1.6, -1.2); hs.quadraticCurveTo(3, -1, 3.8, 0); hs.quadraticCurveTo(3, 1, 1.6, 1.2); hs.lineTo(-3, 1.2); hs.lineTo(-3, -1.2);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 0.9, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 }); hg.rotateX(-Math.PI / 2);
  add(b, hg, M(0xffffff, { roughness: 0.35, metalness: 0.1 }), 0, -0.2, 0);
  const sg = new THREE.ExtrudeGeometry(hs, { depth: 0.12, bevelEnabled: false }); sg.rotateX(-Math.PI / 2); add(b, sg, M(0x1d6fd8, { roughness: 0.4 }), 0, 0.42, 0, false).scale.set(1.03, 1, 1.06);
  const dg = new THREE.ShapeGeometry(hs); dg.rotateX(-Math.PI / 2); add(b, dg, M(0x9a6a3e, { roughness: 0.8 }), 0, 0.72, 0, false).scale.set(0.95, 1, 0.92);
  const chrome = M(0xdddddd, { metalness: 1, roughness: 0.2 });
  for (const z of [-1.15, 1.15]) add(b, box(4.6, 0.04, 0.04), chrome, -0.6, 1.25, z, false);
  add(b, box(0.06, 0.35, 1.6), M(0xbfe6ff, { transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.3 }), 2.2, 0.95, 0, false);
  add(b, box(0.6, 0.9, 0.5), M(0x222222, { roughness: 0.4, metalness: 0.3 }), -3.2, 0.6, 0);
  const c = person({ top: 0xffffff, bottom: 0x1d2f6b, sleeves: true }); c.p.position.set(-2.6, 0.72, -0.5); c.p.rotation.y = Math.PI / 2; b.add(c.p);
  return b;
}
function jetModel() {
  const j = new THREE.Group();
  const js = new THREE.Shape(); js.moveTo(-1.5, -0.55); js.lineTo(0.8, -0.55); js.quadraticCurveTo(1.6, -0.4, 1.9, 0); js.quadraticCurveTo(1.6, 0.4, 0.8, 0.55); js.lineTo(-1.5, 0.55); js.lineTo(-1.5, -0.55);
  const jg = new THREE.ExtrudeGeometry(js, { depth: 0.55, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 }); jg.rotateX(-Math.PI / 2);
  add(j, jg, M(0xffd23a, { roughness: 0.3, metalness: 0.2 }), 0, -0.1, 0);
  add(j, box(1.3, 0.25, 0.42), M(0x1a1a1a, { roughness: 0.6 }), -0.5, 0.78, 0);
  add(j, box(0.25, 0.45, 0.3), M(0x111111), 0.45, 0.85, 0);
  add(j, cyl(0.025, 0.025, 0.85, 8), M(0xdddddd, { metalness: 1 }), 0.5, 1.12, 0).rotation.x = Math.PI / 2;
  return j;
}
function manatee() {
  const m = new THREE.Group(), gm = M(0x7a7d78, { roughness: 0.8 });
  const bg = new THREE.LatheGeometry([new V2(0.001, 1.4), new V2(0.25, 1.25), new V2(0.45, 0.9), new V2(0.55, 0.2), new V2(0.45, -0.6), new V2(0.2, -1.1), new V2(0.001, -1.2)], 16); bg.rotateX(Math.PI / 2);
  add(m, bg, gm).scale.set(1, 0.7, 1);
  add(m, sph(0.55, 16), gm, 0, 0, -1.35).scale.set(1, 0.15, 0.8);
  for (const s of [-1, 1]) add(m, sph(0.18, 10), gm, s * 0.45, -0.15, 0.7).scale.set(0.4, 0.2, 1);
  return m;
}
function waterTour(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x1a72e0, 0xbfe9ff, 0xefe2c0); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0xd2ecff, 70, 240);
  const sun = lightRig(g, { sky: 0xcbe7ff, ground: 0xe8d3a0, hemi: 1.0, sun: 0xfff0d2, sunI: 2.8, dir: [-12, 24, -30], size: 28, target: [0, 0, -6] });
  const END = 900, LANES = [-19, -15.5, -12], SPEED = { boat: 11, jet: 12.5 };
  const ocean = waterMat(0x0d9fbf, { amp: 0.8 });
  const oc = add(g, new THREE.PlaneGeometry(1400, 400, 280, 80), ocean, 450, -0.35, -190, false); oc.rotation.x = -Math.PI / 2;
  const sandT = rep(canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#e8d2a2'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(170,140,90,.25)' : 'rgba(255,250,235,.35)'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }), 200, 4);
  const sand = add(g, new THREE.PlaneGeometry(1400, 18.5), temp(new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 })), 450, 0, -0.25, false); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true;
  const wet = add(g, new THREE.PlaneGeometry(1400, 4), M(0xb39a6c, { roughness: 0.35 }), 450, -0.25, -10.5, false); wet.rotation.x = -Math.PI / 2 + 0.1;
  const foamM = temp(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 1, depthWrite: false }));
  const foam = add(g, new THREE.PlaneGeometry(1400, 1.2), foamM, 450, 0.03, -9.4, false); foam.rotation.x = -Math.PI / 2;
  add(g, box(1400, 0.25, 3), M(0xf3c6c6, { roughness: 0.9 }), 450, 0.12, 10);
  add(g, box(1400, 0.06, 8), M(0x55565c, { roughness: 0.95 }), 450, 0.03, 15.5);
  add(g, box(1400, 0.25, 2.5), M(0xe9e0d6, { roughness: 0.9 }), 450, 0.12, 20.5);
  // escenario a la derecha (playa, palmeras, edificios Art Déco, horizonte) en tramos que se muestran cerca de ti
  const chunks = [], palms = [], towers = [], NEON = [0xff4fa3, 0x24d1ff, 0x7bff6a, 0xffb000, 0xb36bff], DCOL = [0xffc2d1, 0xa8ece6, 0xfff1b8, 0xd6c6ff, 0xffd3b0, 0xbfe6ff], NAMES = ['SOL', 'PALMA', 'BRISA', 'CORAL', 'MAREA', 'VICE', 'TROPICAL', 'AZUL', 'OCEAN', 'LUNA', 'ARENA', 'MIAMI'];
  const animals = [], mixers = [], hitM = temp(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const addA = (obj, sp, r) => { add(obj, sph(r / obj.scale.x, 8), hitM, 0, 0.5, 0, false).userData.sp = sp; animals.push(obj); return obj; };
  const dolphins = [], turtles = [], manatees = [], birds = [];
  let bi = 0;
  for (let c0 = -60; c0 < END + 80; c0 += 120) {
    const C = new THREE.Group(); C.userData.cx = c0 + 60; g.add(C); chunks.push(C);
    for (let x = c0; x < c0 + 120;) { const w = rnd(11, 16); decoBuilding(C, x + w / 2, w, rnd(11, 22), DCOL[bi % 6], NEON[bi % 5], NAMES[bi % 12]); bi++; x += w + 1.2; }
    for (let x = c0 + 5; x < c0 + 120; x += 18) palms.push(palm(C, x + rnd(-2, 2), 8.6, 1, rnd(7, 10)));
    for (let k = 0; k < 2; k++) palms.push(palm(C, c0 + rnd(10, 110), rnd(-2, 4), 1, rnd(6, 8)));
    towers.push(lifeguard(C, c0 + rnd(20, 100), -4, pick(['#ff7ab6', '#ffd23a', '#24d1ff']), pick(['#24d1ff', '#ff5a3a', '#ffffff'])));
    for (let k = 0; k < 3; k++) { const x = c0 + rnd(5, 115), z = rnd(-6, 2); add(C, cyl(0.04, 0.04, 2.4, 6), M(0xffffff), x, 1.2, z); add(C, cone(1.6, 0.6, 16), stripedMat(pick(['#ff5a3a', '#24d1ff', '#ffd23a', '#7bff6a']), '#ffffff', 16), x, 2.4, z); }
    for (let k = 0; k < 3; k++) { const h = rnd(45, 110), w = rnd(12, 18); add(C, box(w, h, w), M(pick([0x9fb8c8, 0xb8c8d4, 0x7f9aab, 0xd6dde2]), { metalness: 0.7, roughness: 0.12 }), c0 + rnd(0, 120), h / 2, rnd(75, 120), false); }
    if ((c0 / 120) % 2 === 0) { const px = c0 + rnd(30, 90); add(C, box(3, 0.3, 2.2), M(0x8a6a48, { roughness: 0.9 }), px, 0.5, -9.6); for (const s2 of [-1.3, 1.3]) add(C, cyl(0.15, 0.15, 2, 8), M(0x5a4030), px + s2, -0.3, -10.4); }
    for (let k = 0; k < 2; k++) { const t = addA(turtle(), '🐢', 1.8); t.scale.setScalar(1.5); t.position.set(c0 + rnd(10, 110), 0.02, rnd(-7, -3)); t.rotation.y = Math.PI; C.add(t); turtles.push(t); }
    { const m = addA(manatee(), '🦭', 2.2); m.position.set(c0 + rnd(20, 100), -0.42, -10.2); m.rotation.y = Math.PI / 2; m.userData.ph = rnd(0, 6); C.add(m); manatees.push(m); }
    for (let k = 0; k < 2; k++) { const d = addA(dolphin(), '🐬', 2.4); d.scale.setScalar(1.3); d.userData.x0 = c0 + rnd(10, 100); d.userData.z0 = k ? rnd(-31, -27) : rnd(-26, -23); d.userData.ph = rnd(0, 6); C.add(d); dolphins.push(d); }
    { const b = spawnGLB('Parrot.glb', C, mixers, { s: 0.014 }); addA(b, '🦜', 2.5); b.userData = { ...b.userData, cx: c0 + rnd(20, 100), r: rnd(5, 9), h: rnd(6, 10), sp: rnd(0.4, 0.7), ph: rnd(0, 6) }; birds.push(b); }
  }
  const traffic = [[0xff4fa3, 0, 13.6, 7], [0x24d1ff, 40, 13.6, 7], [0xffe14d, 20, 17.4, -6], [0x8a5cff, 70, 17.4, -6]].map(a => car(g, ...a));
  // estrellas para recoger y boyas para esquivar, en filas
  const items = [], starGeoG = starMesh;
  for (let x = 40; x < END - 20; x += 16) {
    const free = [0, 1, 2].sort(() => Math.random() - 0.5);
    if (Math.random() < 0.55) { const L = free.pop(), b = new THREE.Group(); b.position.set(x, -0.3, LANES[L]); g.add(b); const c = L % 2 ? 0xd4202a : 0x1f9a3a;
      add(b, cyl(0.5, 0.65, 1.6, 14), M(c, { roughness: 0.5 }), 0, 0.5, 0); add(b, cone(0.5, 0.6, 14), M(c), 0, 1.6, 0); add(b, box(1, 0.1, 1), M(0xffffff), 0, 0.9, 0, false);
      items.push({ o: b, x, L, type: 'buoy', ph: rnd(0, 6) }); }
    const L = free.pop(), st = starGeoG(); st.scale.setScalar(1.7); st.position.set(x, 1.3, LANES[L]); g.add(st); items.push({ o: st, x, L, type: 'star' });
  }
  // arcos de parada y meta
  const STOPS = [
    { x: 250, name: 'South Beach', q: '¿Cómo se llama la avenida frente a la playa de Miami Beach, famosa por sus edificios Art Déco?', o: ['Broadway', 'Ocean Drive', 'Hollywood Boulevard'], a: 1 },
    { x: 520, name: 'Bahía Biscayne', q: '¿Qué bahía separa a la ciudad de Miami de Miami Beach?', o: ['Bahía de Tampa', 'Bahía Biscayne', 'Bahía de Cádiz'], a: 1 },
    { x: 790, name: 'Pequeña Habana', q: '¿Qué barrio de Miami es famoso por la Calle Ocho y la cultura cubana?', o: ['La Pequeña Habana', 'Chinatown', 'Harlem'], a: 0 }
  ];
  const gate = (x, txt, col) => { const a = new THREE.Group(); a.position.set(x, 0, -15.5); g.add(a); for (const z of [-7.5, 7.5]) add(a, cyl(0.4, 0.5, 8, 12), M(col, { roughness: 0.4 }), 0, 3.5, z); add(a, box(0.5, 1.6, 15.6), M(col, { roughness: 0.4 }), 0, 7.6, 0); const sgn = add(a, new THREE.PlaneGeometry(14, 1.4), temp(new THREE.MeshStandardMaterial({ map: textTex(txt, 1024, 110, 'rgba(0,0,0,0)', '#ffffff', 'bold 70px system-ui'), transparent: true, emissive: 0x333333, side: THREE.DoubleSide })), -0.3, 7.6, 0, false); sgn.rotation.y = -Math.PI / 2; return a; };
  STOPS.forEach((S2, i) => gate(S2.x, `📍 PARADA ${i + 1} · ${S2.name.toUpperCase()}`, 0xff7a1a));
  gate(END, '🏁 META · MARINA DE MIAMI BEACH', 0x1d6fd8);
  for (let k = 0; k < 4; k++) { const b = boatModel(); b.scale.setScalar(0.8); b.position.set(END + 12 + k * 7, -0.3, -12 + (k % 2) * 3); b.rotation.y = 0.3; g.add(b); }
  // vehículo del jugador
  const VEH = { boat: { g: boatModel(), eye: 2.35, cam: 0.6 }, jet: { g: jetModel(), eye: 1.75, cam: -0.45 } };
  VEH.boat.g.visible = VEH.jet.g.visible = false; g.add(VEH.boat.g, VEH.jet.g);
  let veh = null, running = false, alive = true, x = 0, lane = 1, z = LANES[1], hearts = 3, stars = 0, photos = new Set(), inv = 0, stopI = 0, phase = 'drive', infoT = 0, eng = null, waveT = 0;
  const FACT = { '🐢': 'Tortuga marina: Florida tiene la mayor cantidad de nidos de tortugas marinas de EE. UU.', '🐬': 'Delfín nariz de botella: es el mamífero oficial de agua salada de Florida.', '🦭': 'Manatí: es el mamífero marino oficial de Florida. Nada despacio cerca de la orilla.', '🦜': 'Loro: en Miami viven loros en libertad.' };
  const info = () => ctx.info(`${'❤️'.repeat(hearts)}${'🖤'.repeat(3 - hearts)} · ⭐ ${stars} · 📸 ${photos.size}/4 · 🏁 ${Math.min(100, Math.round(x / END * 100))}%`);
  const bar = document.createElement('div'); bar.id = 'pickbar'; bar.className = 'hidden'; document.getElementById('app').appendChild(bar);
  const setLane = l => { const n = clamp(l, 0, 2); if (n !== lane) { lane = n; ctx.sfx('click'); } };
  function showLanes() {
    bar.innerHTML = '<button class="lane" data-d="-1">◀</button><button class="lane" data-d="1">▶</button>';
    bar.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); setLane(lane + +b.dataset.d); }));
    bar.classList.remove('hidden'); document.body.classList.add('hasbar');
  }
  const KEYS = { ArrowLeft: -1, KeyA: -1, ArrowRight: 1, KeyD: 1 }, kd = e => { if (KEYS[e.code] && running) setLane(lane + KEYS[e.code]); };
  addEventListener('keydown', kd);
  function pickVehicle() {
    ctx.card('Elige tu vehículo', '<p>🚤 <b>Lancha rápida</b>: vas de pie, ves todo desde arriba.<br>🌊 <b>Moto de agua</b>: más rápida y cerca del agua.</p>', [
      { label: '🚤 Lancha rápida', primary: true, fn: () => go('boat') }, { label: '🌊 Moto de agua', fn: () => go('jet') }]);
  }
  function go(k) {
    veh = k; VEH[k].g.visible = true; running = true; showLanes(); info(); refreshHint(); ctx.sfx('portal');
    const ac = ctx.audio && ctx.audio();
    if (ac) { const o = ac.createOscillator(), f = ac.createBiquadFilter(), gn = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = 60; f.type = 'lowpass'; f.frequency.value = 450; gn.gain.value = 0.03; o.connect(f).connect(gn).connect(ac.destination); o.start(); eng = { o, gn }; }
  }
  function ask() {
    const S2 = STOPS[stopI]; phase = 'quiz'; if (eng) eng.gn.gain.value = 0.008;
    ctx.card(`❓ Parada ${stopI + 1} de 3 · ${S2.name}`, `<p>${S2.q}</p>`, S2.o.map((o, i) => ({ label: o, fn: () => {
      if (i === S2.a) { stars += 3; ctx.sfx('pickup'); ctx.toast('✅ ¡Correcto! +3 ⭐', 2200); } else { ctx.sfx('hurt'); ctx.toast(`❌ Era: ${S2.o[S2.a]}`, 2600); }
      stopI++; phase = 'drive'; info(); if (eng) eng.gn.gain.value = 0.03;
    } })));
  }
  function photo(a) {
    const sp = a.children.find(o => o.material === hitM)?.userData.sp || a.userData.sp; if (!sp) return;
    ctx.sfx('shutter'); const f = document.getElementById('fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 90);
    if (photos.has(sp)) { ctx.toast('📸 Ya tienes esa foto', 1200); return; }
    photos.add(sp); stars += 2; info(); ctx.burst(a.getWorldPosition(_v), [0xffffff, 0xffd700], 30, 1.5); ctx.toast(`📸 ${FACT[sp]} (+2 ⭐)`, 4500);
  }
  const pickA = p => { const h = p.ray.intersectObjects(animals.filter(a => a.parent && a.parent.visible), true).find(o => o.object.material === hitM); return h ? h.object.parent : null; };
  const seat = new V3(), seatPos = () => { const V = VEH[veh || 'boat']; return seat.set(x + V.cam, V.eye + Math.sin(performance.now() / 600) * 0.06, z); };
  const refreshHint = () => ctx.hint(running ? (ctx.isHand() ? '☝️ Mueve el índice a la izquierda, al centro o a la derecha para cambiar de carril' : '◀ ▶ o desliza para cambiar de carril') + ' · recoge ⭐ · esquiva las boyas · toca animales para fotos 📸' : '');
  const intro = withIntro(ctx, opt, [{ t: 0, p: [-40, 26, -60], yaw: -2.4, pitch: -0.35 }, { t: 3.5, p: [-8, 6, -26], yaw: -1.9, pitch: -0.15 }, { t: 5, p: [0.6, 2.35, LANES[1]], yaw: -Math.PI / 2 - 0.25, pitch: -0.05 }], -Math.PI / 2 - 0.25, -0.05);
  let sx = 0, sy = 0;
  return {
    camLock: !opt.quick, dwellTime: 0.45, refreshHint,
    start() { this.camLock = false; pickVehicle(); },
    onDown(p) { if (intro.on) { intro.finish(); this.camLock = false; return; } sx = p.sx; sy = p.sy; },
    onMove(p) { if (p.src === 'hand' && running) setLane(p.ndc.x < -0.25 ? 0 : p.ndc.x > 0.25 ? 2 : 1); },
    onUp(p) { if (!running || p.src === 'hand') return; const dx = p.sx - sx; if (Math.abs(dx) > 40) setLane(lane + Math.sign(dx)); else { const a = pickA(p); if (a) photo(a); } },
    tap(p) { const a = running && pickA(p); if (a) photo(a); },
    hoverable: p => (running ? pickA(p) : null),
    update(dt, t) {
      mixers.forEach(m => m.update(dt)); ocean.userData.uT.value = t;
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      if (running && phase === 'drive') {
        x += SPEED[veh] * dt; inv = Math.max(0, inv - dt);
        if (stopI < 3 && x >= STOPS[stopI].x) { x = STOPS[stopI].x; ask(); }
        if (x >= END) { x = END; running = false; bar.classList.add('hidden'); if (eng) eng.gn.gain.value = 0.0001;
          for (let k = 0; k < 6; k++) setTimeout(() => ctx.burst(_v.set(END + rnd(-5, 15), rnd(8, 14), rnd(-25, -10)), [0xff4fa3, 0xffd23a, 0x24d1ff, 0xffffff], 60, 4), k * 250);
          ctx.sfx('crowd'); setTimeout(() => ctx.win('miami'), 1500); }
      }
      z = lerp(z, LANES[lane], Math.min(1, dt * 6));
      if (!intro.on) camera.position.copy(seatPos());
      if (veh) { const G2 = VEH[veh].g; G2.position.set(x, -0.15 + Math.sin(t * 1.7) * 0.06, z); G2.rotation.set(Math.sin(t * 1.1) * 0.03, (LANES[lane] - z) * -0.06, Math.sin(t * 1.3) * 0.025);
        if (running && phase === 'drive' && Math.random() < 0.9) { const back = veh === 'jet' ? 1.6 : 3.3; ctx.burst(_w.set(x - back, 0.1, z + rnd(-0.5, 0.5)), [0xffffff, 0xd8f4ff], 2, 1.4, 4); } }
      for (const it of items) {
        if (!it.o.visible || Math.abs(it.x - x) > 60) continue;
        if (it.type === 'star') it.o.rotation.y += dt * 3; else it.o.position.y = -0.3 + Math.sin(t * 1.5 + it.ph) * 0.1;
        if (running && Math.abs(it.x - x) < 2 && Math.abs(LANES[it.L] - z) < 2.2) {
          if (it.type === 'star') { it.o.visible = false; stars++; ctx.sfx('pickup'); ctx.burst(it.o.position, [0xffd700, 0xffffff], 20, 1.6); info(); }
          else if (!inv) { inv = 1.2; hearts--; ctx.sfx('hurt'); ctx.flash(); if (navigator.vibrate) navigator.vibrate(80); ctx.burst(it.o.position, [0xffffff, 0xbfefff], 30, 2.5, 5); info();
            if (hearts <= 0) { running = false; bar.classList.add('hidden'); if (eng) eng.gn.gain.value = 0.0001; ctx.lose('Chocaste 3 veces con las boyas. Cambia de carril con ◀ ▶ (o deslizando) cuando veas una boya roja o verde adelante.'); } }
        }
      }
      chunks.forEach(C => (C.visible = Math.abs(C.userData.cx - x) < 200));
      skyM.position.x = x; sun.position.set(x - 12, 24, -36); sun.target.position.set(x + 10, 0, -6);
      foam.position.z = -9.4 + Math.sin(t * 0.8) * 0.6; foamM.opacity = 0.45 + Math.sin(t * 0.8 + 1) * 0.3;
      waveT -= dt; if (waveT <= 0) { waveT = 3.2; ctx.sfx('waves'); }
      traffic.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x < x - 80) c.position.x += 200; if (c.position.x > x + 120) c.position.x -= 200; });
      palms.forEach(p => { if (p.parent.visible) p.userData.crown.rotation.z = Math.sin(t * 0.9 + p.userData.ph) * 0.05; });
      towers.forEach((tw, i) => { if (tw.parent.visible) tw.userData.flag.rotation.y = Math.sin(t * 4 + i) * 0.4; });
      turtles.forEach(tt => { if (!tt.parent.visible) return; tt.position.z -= dt * 0.1; if (tt.position.z < -8) tt.position.z = -3; tt.userData.fl.forEach((f, k) => (f.rotation.y = Math.sin(t * 2 + k) * 0.4)); });
      manatees.forEach(m => { m.position.x += dt * 0.6; m.position.y = -0.38 + Math.sin(t + m.userData.ph) * 0.06; });
      dolphins.forEach(d => { if (!d.parent.visible) return; const u = d.userData, c = (t * 0.33 + u.ph) % 1; d.position.set(u.x0 + c * 12, -0.6 + Math.sin(c * Math.PI) * 2.4 - (c > 0.95 ? 2 : 0), u.z0); d.rotation.x = -Math.cos(c * Math.PI) * 0.9; d.rotation.y = Math.PI / 2; });
      birds.forEach(b => { const u = b.userData, a = t * u.sp + u.ph; b.position.set(u.cx + Math.cos(a) * u.r, u.h, 6 + Math.sin(a) * u.r); b.rotation.y = Math.atan2(-Math.sin(a), Math.cos(a)); });
      if (running) { infoT += dt; if (infoT > 0.5) { infoT = 0; info(); } }
    },
    dispose() { alive = false; running = false; restoreEnv(); bar.remove(); document.body.classList.remove('hasbar'); removeEventListener('keydown', kd); if (eng) { try { eng.o.stop(); } catch (e) {} } }
  };
}

/* ---------- iconos de portal y catálogo ---------- */
export const GAMES2 = {
  miami: {
    short: 'Tour acuático', title: '🚤 Miami Beach — Tour acuático', winMsg: '¡Completaste el tour acuático por Miami Beach!', create: waterTour,
    how: h => 'Recorres la costa de Miami Beach por el mar: <b>a tu derecha</b> verás la playa, las palmeras, los edificios Art Déco y animales.<br>🚤 El vehículo avanza solo. Tú solo eliges el <b>carril</b>: ' + (h ? 'mueve tu índice a la izquierda, al centro o a la derecha' : 'botones <b>◀ ▶</b> o desliza el dedo') + '.<br>⭐ Recoge estrellas · 🔴🟢 esquiva las boyas (tienes 3 ❤️) · 📸 toca los animales para fotografiarlos.<br>❓ En 3 paradas respondes una pregunta sobre Miami. ¡Llega a la meta!',
    fact: 'Florida es conocida como “The Sunshine State” (el Estado del Sol), y Miami Beach es una de sus playas más famosas del mundo.'
  },
  heroes: {
    short: 'Isla de Héroes', title: '🦸 Orlando — Isla de Héroes', winMsg: '¡Salvaste la Isla de Héroes!', create: heroes,
    icon() { const i = new THREE.Group(); const m = weaponModel(2); m.scale.setScalar(0.42); i.add(m); return i; },
    how: h => '🚨 ¡Unos drones invaden el parque de superhéroes!<br>1️⃣ <b>Elige tu arma</b> con los botones de abajo.<br>2️⃣ Los drones aparecen <b>de uno en uno frente a ti</b>, marcados con un <b>aro rojo</b>.<br>3️⃣ Pulsa el botón grande de ataque ' + (h ? '(o haz pinza)' : '(o toca la pantalla)') + '. Cada dron aguanta 2 golpes.<br><b>Derriba 5 drones.</b>',
    fact: 'Islands of Adventure, en Universal Orlando, abrió en 1999 y una de sus zonas está dedicada a los superhéroes de cómic.'
  },
  city: {
    short: 'Miami urbano', title: '🌆 Miami — Exploración urbana', winMsg: '¡Has explorado Miami!', create: city,
    icon() { const i = new THREE.Group(); add(i, box(0.16, 0.26, 0.1), M(0xffc2d1), 0, 0, 0, false); add(i, box(0.03, 0.32, 0.03), M(0x24d1ff, { emissive: 0x24d1ff }), 0, 0.02, 0.06, false); return i; },
    how: h => 'Estás en Ocean Drive, Miami Beach. Gira el celular (o arrastra) para mirar: la playa, la calle y los edificios Art Déco. Encuentra 5 objetos en <b>60 segundos</b>: 🔑 🕶️ 🏄 📷 🪙. Sigue la flecha amarilla y los haces de luz. ' + (h ? 'Deja tu <b>índice</b> quieto sobre cada objeto.' : '<b>Toca</b> cada objeto.'),
    fact: 'Miami Beach tiene una de las mayores concentraciones de arquitectura Art Déco del mundo. Su distrito histórico entró al Registro Nacional de Lugares Históricos de EE. UU. en 1979.'
  },
  fg: {
    short: 'Fútbol americano', title: '🏈 Field Goal Challenge', winMsg: '¡Eres el pateador estrella!', create: fg, foot: true,
    icon() { const i = new THREE.Group(); const b = fbBall(); b.scale.setScalar(1); i.add(b); return i; },
    how: h => 'Eres el pateador. Patea el balón para que pase <b>entre los postes amarillos y por encima del travesaño</b>. Cada gol te aleja más (20, 30 y 40 yardas). <b>Consigue 3 goles de campo.</b> Puedes patear con tu pie real frente a la cámara o deslizar el dedo.',
    fact: 'Florida tiene tres equipos de la NFL: los Miami Dolphins, los Tampa Bay Buccaneers y los Jacksonville Jaguars.'
  },
  penalty: {
    short: 'Penales', title: '⚽ Penalty Challenge', winMsg: '¡Ganaste la tanda de penales!', create: penalty, foot: true,
    icon() { const i = new THREE.Group(); add(i, sph(0.11, 24), soccerBallMat()); return i; },
    how: h => 'Tienes <b>5 penales</b>. Apunta a las esquinas: el portero se lanza hacia un lado. <b>Marca al menos 3 goles.</b> Puedes patear con tu pie real frente a la cámara o deslizar el dedo (la inclinación apunta, la velocidad es la fuerza).',
    fact: 'El Inter Miami CF juega en la MLS desde 2020.'
  }
};
