// FLORIDA AR ADVENTURE — nuevas experiencias: Miami urbano, Isla de Héroes, fútbol americano y penales.
import * as THREE from 'three';
import {
  M, B, temp, add, box, cyl, sph, cone, cap, smooth, rnd, pick, canvasTex, rep, glow, textTex, label, sky, lightRig, envFromSky, withIntro,
  person, clapAnim, idleAnim, stripedMat, stripesTex, waterMat, palm, decoBuilding, car, lifeguard, disposeTree, SKINS, Q
} from './scenes.js';
const V3 = THREE.Vector3, clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
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
  // drones enemigos
  const drones = Array.from({ length: 5 }, (_, i) => { const d = drone(); d.userData = { ...d.userData, a: i / 5 * Math.PI * 2 - Math.PI / 2, r: rnd(9, 14), h: rnd(3, 6.5), sp: rnd(0.12, 0.22) * (i % 2 ? 1 : -1), alive: true, dead: 0 }; g.add(d); return d; });
  // armas: vista previa y arma en la mano
  const shelf = new THREE.Group(); shelf.position.set(0, -0.03, -0.75); shelf.visible = false; camera.add(shelf);
  const picks = WEAPONS.map((w, i) => { const h = new THREE.Group(); h.position.x = (i - 1) * 0.16; h.scale.setScalar(0.42); shelf.add(h); h.add(weaponModel(i)); add(h, box(0.7, 0.8, 0.3), temp(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })), 0, 0.15, 0, false).userData.wi = i; h.add(glow(w.col, 0.5, 0.4)); return h; });
  const hand = new THREE.Group(); camera.add(hand);
  let wi = -1, held = null, choosing = false, running = false, killed = 0, cd = 0, kick = 0, draw = 0, drawing = false, hover = -1;
  const bolts = [], arrows = [];
  const sh = { state: 'held', path: [], t: 0, obj: null };
  const info = () => ctx.info(`🎯 Drones ${killed}/5 · ${wi >= 0 ? WEAPONS[wi].name : 'elige arma'}`);
  const pickW = p => { const h = p.ray.intersectObjects(picks, true).find(o => o.object.userData.wi !== undefined); return h ? h.object.userData.wi : null; };
  const aimAt = p => { // dron más cercano al rayo (ayuda de puntería) o punto lejano
    let best = null, bd = 2.6 * 2.6; for (const d of drones) if (d.userData.alive) { const q = p.ray.ray.distanceSqToPoint(d.position); if (q < bd) { bd = q; best = d; } }
    return best;
  };
  function destroy(d) {
    if (!d.userData.alive) return; d.userData.alive = false; d.userData.dead = 0.001; killed++; info(); ctx.sfx('hit');
    ctx.burst(d.position, [0xffa020, 0xff3030, 0xffffff, 0x7fd8ff], 70, 3);
    if (killed >= 5) { running = false; setTimeout(() => ctx.win('heroes'), 1300); }
  }
  function choose(i) {
    wi = i; choosing = false; shelf.visible = false; held = weaponModel(i); hand.add(held); running = true; info(); ctx.sfx('pickup');
    if (i === 2) sh.obj = held;
    ctx.toast(`${WEAPONS[i].name}: ${WEAPONS[i].note}`, 3500); refreshHint();
  }
  function fire(p) {
    if (!running || cd > 0) return;
    const tgt = aimAt(p), tp = tgt ? tgt.position.clone() : p.ray.ray.at(25, new V3());
    const from = held.getWorldPosition(new V3());
    if (wi === 0) { // rayo
      cd = 0.8; kick = 1; ctx.sfx('spell');
      const pts = []; const n = 14; for (let k = 0; k <= n; k++) { const q = from.clone().lerp(tp, k / n); if (k && k < n) q.add(_v.set(rnd(-0.4, 0.4), rnd(-0.4, 0.4), rnd(-0.4, 0.4))); pts.push(q); }
      const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), temp(new THREE.LineBasicMaterial({ color: 0xbfefff, transparent: true, blending: THREE.AdditiveBlending })));
      g.add(ln); bolts.push({ ln, life: 0.25 }); ctx.burst(tp, [0x7fd8ff, 0xffffff], 20, 2);
      if (tgt) destroy(tgt);
    } else if (wi === 1) { // arco: tensar y soltar
      if (drawing) return; drawing = true; draw = 0; cd = 0.9;
      setTimeout(() => {
        drawing = false; ctx.sfx('throw');
        const dir = tp.clone().sub(from).normalize(), m = new THREE.Group(); m.position.copy(from); g.add(m);
        add(m, cyl(0.01, 0.01, 0.8, 6), M(0x6b4a2a), 0, 0, 0, false).rotation.x = Math.PI / 2; add(m, cone(0.03, 0.1, 8), M(0xaaaaaa, { metalness: 0.9 }), 0, 0, -0.45, false).rotation.x = -Math.PI / 2;
        arrows.push({ m, v: dir.multiplyScalar(32), tgt, life: 2 });
      }, 380);
    } else if (wi === 2 && sh.state === 'held') { // escudo bumerán
      const first = tgt; let second = null;
      if (first) { let bd = 12 * 12; for (const d of drones) if (d !== first && d.userData.alive) { const q = d.position.distanceToSquared(first.position); if (q < bd) { bd = q; second = d; } } }
      sh.path = [first || { position: tp }, ...(second ? [second] : []), 'back']; sh.state = 'fly'; sh.t = 0; sh.from = from.clone();
      hand.remove(sh.obj); g.add(sh.obj); sh.obj.position.copy(from); sh.obj.scale.setScalar(1.6); ctx.sfx('throw');
    }
  }
  const intro = withIntro(ctx, opt, [{ t: 0, p: [0, 1.6, 26], yaw: 0, pitch: 0.2 }, { t: 3.5, p: [0, 1.6, 4], yaw: 0, pitch: 0.12 }, { t: 7.5, p: [0, 1.6, 0], yaw: Math.PI * 2, pitch: 0.1 }], 0, 0.1);
  const refreshHint = () => ctx.hint(choosing ? (ctx.isHand() ? '☝️ Señala' : '👆 Toca') + ' el arma que quieras usar'
    : (ctx.isHand() ? '☝️ Apunta a un dron con tu índice y haz pinza (o déjalo quieto)' : '👆 Toca un dron para atacarlo') + ' · gira el celular para buscarlos');
  return {
    look: true, camLock: !opt.quick, dwellTime: 0.45, refreshHint,
    start() { this.camLock = false; choosing = true; shelf.visible = true; ctx.info('🦸 Elige tu arma'); refreshHint(); },
    tap(p) {
      if (intro.on) { intro.finish(); this.camLock = false; return; }
      if (choosing) { const i = pickW(p); if (i !== null && i !== undefined) choose(i); return; }
      fire(p);
    },
    hoverable(p) { if (choosing) return pickW(p); if (!running) return null; const d = aimAt(p); return d && d.position.distanceTo(camera.position) < 30 ? d : null; },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      seats.position.y = 4 + (Math.sin(t * 0.5) * 0.5 + 0.5) ** 3 * 38;
      if (choosing) { hover = pickW(ctx.ptr); picks.forEach((h, i) => { h.rotation.y += dt; h.scale.setScalar(i === hover ? 0.5 : 0.42); }); if (hover !== null && hover >= 0) ctx.info(`🦸 ${WEAPONS[hover].name} — ${WEAPONS[hover].note}`); }
      cd = Math.max(0, cd - dt); kick = Math.max(0, kick - dt * 4);
      // arma en la mano: sigue el puntero / dedo índice
      const n = ctx.ptr.ndc, hh = 0.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
      hand.position.set((n.x * 0.5 + 0.35) * hw, (n.y * 0.4 - 0.55) * hh, -0.5);
      hand.lookAt(ctx.ptr.ray.ray.at(20, _w)); hand.rotateX(Math.PI / 2 - kick * 0.6);
      if (held && wi === 1) { draw = drawing ? Math.min(1, draw + dt * 3) : Math.max(0, draw - dt * 8); const a = held.userData.string.geometry.attributes.position; a.setZ(1, 0.02 + draw * 0.22); a.needsUpdate = true; }
      if (held && wi === 0 && Math.random() < 0.3) ctx.burst(held.getWorldPosition(_v), 0x7fd8ff, 1, 0.5);
      for (const d of drones) {
        const u = d.userData;
        if (u.dead) { u.dead += dt; d.scale.setScalar(Math.max(0.01, 1 - u.dead * 2)); d.position.y -= dt * 3; if (u.dead > 0.6) d.visible = false; continue; }
        u.a += u.sp * dt; d.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(t * 1.3 + u.r) * 0.8, Math.sin(u.a) * u.r);
        d.lookAt(camera.position); u.rot.forEach(r => (r.rotation.y += dt * 40));
      }
      for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.life -= dt; b.ln.material.opacity = b.life * 4; if (b.life <= 0) { g.remove(b.ln); disposeTree(b.ln); bolts.splice(i, 1); } }
      for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i]; a.life -= dt; a.v.y -= 2 * dt;
        if (a.tgt && a.tgt.userData.alive) { _v.copy(a.tgt.position).sub(a.m.position).normalize().multiplyScalar(32); a.v.lerp(_v, 0.12); }
        a.m.position.addScaledVector(a.v, dt); a.m.lookAt(_w.copy(a.m.position).sub(a.v));
        const hit = drones.find(d => d.userData.alive && d.position.distanceTo(a.m.position) < 0.9);
        if (hit) destroy(hit);
        if (hit || a.life <= 0) { g.remove(a.m); disposeTree(a.m); arrows.splice(i, 1); }
      }
      if (sh.state === 'fly') {
        const tgt = sh.path[0], home = hand.getWorldPosition(new V3()), tp = tgt === 'back' ? home : tgt.position;
        _v.copy(tp).sub(sh.obj.position); const d = _v.length(); sh.obj.position.addScaledVector(_v.normalize(), Math.min(d, 26 * dt)); sh.obj.rotation.z += dt * 18;
        if (d < 0.8) {
          if (tgt === 'back') { g.remove(sh.obj); hand.add(sh.obj); sh.obj.position.set(0, 0, 0); sh.obj.rotation.set(0, 0, 0); sh.obj.scale.setScalar(1); sh.state = 'held'; ctx.sfx('block'); }
          else { if (tgt.userData) destroy(tgt); ctx.sfx('rim'); sh.path.shift(); }
        }
      }
      if (running) { let best = null, bd = 1e9; for (const d of drones) if (d.userData.alive) { const q = d.position.distanceToSquared(camera.position); if (q < bd) { bd = q; best = d.position; } } guideArrow(camera, best); }
    },
    dispose() { running = false; restoreEnv(); guideArrow(camera, null); camera.remove(shelf); camera.remove(hand); disposeTree(shelf); disposeTree(hand); }
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

/* ---------- iconos de portal y catálogo ---------- */
export const GAMES2 = {
  heroes: {
    short: 'Isla de Héroes', title: '🦸 Orlando — Isla de Héroes', winMsg: '¡Salvaste la Isla de Héroes!', create: heroes,
    icon() { const i = new THREE.Group(); const m = weaponModel(2); m.scale.setScalar(0.42); i.add(m); return i; },
    how: h => 'Estás en una zona de parque temático de superhéroes. Primero <b>elige tu arma</b>: martillo del trueno (rayos), arco de precisión (flechas) o escudo bumerán (rebota y regresa). Luego ' + (h ? '<b>apunta con tu índice</b> a los drones y haz pinza o deja el dedo quieto' : '<b>toca los drones</b>') + ' para derribarlos. Gira el celular para buscarlos. <b>Derriba 5 drones.</b>',
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
