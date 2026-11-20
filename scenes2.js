// CAROLINA AR ADVENTURE — nuevas experiencias: Charlotte urbano, Research Triangle, Panthers (gol de campo), Charlotte FC (penales) y tour por los Outer Banks.
import * as THREE from 'three';
import {
  M, B, temp, add, box, cyl, sph, cone, cap, smooth, rnd, pick, canvasTex, rep, glow, textTex, label, sky, lightRig, envFromSky, withIntro,
  person, clapAnim, idleAnim, stripedMat, stripesTex, waterMat, palm, decoBuilding, car, lifeguard, disposeTree, SKINS, Q, spawnGLB, turtle, dolphin, starMesh, pine, fallTree, blueRidge, keep
} from './scenes.js';
import { modelo, modelInfo, modelMat, setMaterial } from './models.js';
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
// fuerza (pw) y dirección (lat) del tiro: desde un deslizamiento del dedo, o ya calculadas por el detector de patadas
const shotFromVel = vel => (vel.pw !== undefined ? { pw: vel.pw, lat: vel.lat } : { pw: clamp(1 + Math.log(Math.max(vel.y, 0.1) / 2.8) * 0.6, 0.5, 1.6), lat: clamp(vel.x / Math.max(vel.y, 0.1), -1, 1) });
const flick = p => { const v = p.vel(120); return v.y > 2.4 ? v : null; }; // dedo índice movido rápido hacia arriba
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
// orilla sin parches: el mar pasa por debajo de la arena, pero sus olas nunca suben a la arena seca, y la arena mojada baja en rampa bajo el agua
// SEA_Y: altura del mar (m) · AMP: tamaño de las olas (la cresta llega a SEA_Y + AMP × 0.58: debe quedar bajo 0) · DROP / RUN: cuánto baja la rampa y en qué largo (m)
const SHORE = { SEA_Y: -0.4, AMP: 0.5, DROP: 1.2, RUN: 2.6 };
function shoreRamp(g, cx, len, z) { // rampa de arena mojada: empieza en el borde de la arena seca (z) y baja hacia el mar (−z)
  const r = add(g, new THREE.PlaneGeometry(len, Math.hypot(SHORE.DROP, SHORE.RUN)), M(0xb39a6c, { roughness: 0.35 }), cx, -SHORE.DROP / 2, z - SHORE.RUN / 2, false);
  r.rotation.x = -Math.PI / 2 - Math.atan2(SHORE.DROP, SHORE.RUN); r.receiveShadow = true; return r;
}

/* ================= CHARLOTTE UPTOWN — EXPLORACIÓN URBANA (5 objetos escondidos; clave interna 'city') ================= */
const ITEM = { // 5 íconos de Carolina del Norte, hechos por código
  flag(i) { // bandera a cuadros de NASCAR
    add(i, cyl(0.015, 0.015, 0.7, 8), M(0xcccccc, { metalness: 0.9 }), -0.25, 0, 0);
    const f = add(i, new THREE.PlaneGeometry(0.45, 0.3, 1, 1), temp(new THREE.MeshStandardMaterial({ map: canvasTex(64, 48, (c, w, h) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) { c.fillStyle = (x + y) % 2 ? '#111' : '#fff'; c.fillRect(x * 11, y * 12, 11, 12); } }), side: THREE.DoubleSide })), 0, 0.18, 0, false);
  },
  donut(i) { // dona glaseada (Krispy Kreme nació en Winston-Salem)
    add(i, new THREE.TorusGeometry(0.13, 0.065, 14, 28), M(0xd9a05b, { roughness: 0.7 })).rotation.x = Math.PI / 2;
    const gz = add(i, new THREE.TorusGeometry(0.13, 0.067, 14, 28, Math.PI * 2), M(0xfff3e0, { roughness: 0.25 }), 0, 0.02, 0, false); gz.rotation.x = Math.PI / 2; gz.scale.z = 0.6;
  },
  soda(i) { // vaso de refresco (la Pepsi se inventó en New Bern)
    add(i, cyl(0.1, 0.08, 0.3, 20), M(0x1d5fbf, { roughness: 0.35 }));
    add(i, cyl(0.105, 0.105, 0.04, 20), M(0xffffff), 0, 0.17, 0); add(i, cyl(0.012, 0.012, 0.25, 6), M(0xd4202a), 0.03, 0.27, 0).rotation.z = 0.25;
  },
  ball(i) { add(i, sph(0.15, 24), M(0xe07a28, { roughness: 0.6 })); add(i, new THREE.TorusGeometry(0.151, 0.006, 6, 30), M(0x111111), 0, 0, 0, false); add(i, new THREE.TorusGeometry(0.151, 0.006, 6, 30), M(0x111111), 0, 0, 0, false).rotation.y = Math.PI / 2; },
  crown(i) { // corona: Charlotte es la «Ciudad Reina» (Queen City)
    const gd = M(0xffcc33, { metalness: 1, roughness: 0.25 }); add(i, new THREE.CylinderGeometry(0.16, 0.16, 0.12, 24, 1, true), temp(new THREE.MeshStandardMaterial({ color: 0xffcc33, metalness: 1, roughness: 0.25, side: THREE.DoubleSide })));
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; add(i, cone(0.04, 0.12, 6), gd, Math.cos(a) * 0.15, 0.12, Math.sin(a) * 0.15); add(i, sph(0.025, 8), M(0x00788c, { emissive: 0x00505c }), Math.cos(a) * 0.15, 0.19, Math.sin(a) * 0.15, false); }
  }
};
function city(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x2a6fd6, 0xcfe6ff, 0xb9c4cf); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0xd2e4f5, 110, 420);
  lightRig(g, { sky: 0xcbe7ff, ground: 0xb8b0a0, hemi: 1.0, sun: 0xfff0d2, sunI: 2.8, dir: [-14, 30, -30], size: 30, target: [0, 0, 6] });
  // parque de Uptown (césped, caminos y fuente) donde antes estaba la playa
  const grassT = rep(canvasTex(128, 128, (c, w, h) => { c.fillStyle = '#4e8a3a'; c.fillRect(0, 0, w, h); for (let i = 0; i < 2500; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(30,70,20,.35)' : 'rgba(150,200,90,.3)'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 2.5); } }), 80, 40);
  const lawn = add(g, new THREE.PlaneGeometry(400, 200), temp(new THREE.MeshStandardMaterial({ map: grassT, roughness: 1 })), 0, 0, -91, false); lawn.rotation.x = -Math.PI / 2; lawn.receiveShadow = true;
  for (const [x, z, w, d] of [[0, 2, 3, 12], [0, -6, 26, 3], [-12, -14, 3, 16], [12, -14, 3, 16]]) add(g, box(w, 0.04, d), M(0xd8cdb8, { roughness: 0.95 }), x, 0.02, z, false);
  add(g, cyl(3.2, 3.4, 0.6, 32), M(0xbfb6a6, { roughness: 0.9 }), 0, 0.3, -6);
  const ocean = waterMat(0x3aa0c8, { amp: 0.08 }); const fw = add(g, new THREE.CircleGeometry(2.9, 32), ocean, 0, 0.58, -6, false); fw.rotation.x = -Math.PI / 2;
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; add(g, cyl(0.05, 0.12, 1.4, 6), temp(new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.55 })), Math.cos(a) * 1.4, 1.2, -6 + Math.sin(a) * 1.4, false); }
  // calle con tren ligero (LYNX), aceras
  add(g, box(400, 0.25, 3), M(0xc9c3ba, { roughness: 0.9 }), 0, 0.12, 10);
  add(g, box(400, 0.06, 8), M(0x55565c, { roughness: 0.95 }), 0, 0.03, 15.5);
  for (let i = -30; i < 30; i++) add(g, box(2.4, 0.07, 0.15), M(0xffd23a), i * 6, 0.04, 15.5, false);
  add(g, box(400, 0.25, 2.5), M(0xc9c3ba, { roughness: 0.9 }), 0, 0.12, 20.5);
  for (const z of [17.6, 18.8]) add(g, box(400, 0.05, 0.12), M(0x8a8f99, { metalness: 0.9, roughness: 0.3 }), 0, 0.09, z, false);
  const tram = new THREE.Group(); tram.position.set(-40, 0, 18.2); tram.userData.sp = 4; g.add(tram);
  add(tram, box(18, 2.6, 2.6), M(0xe9eef5, { roughness: 0.4 }), 0, 1.6, 0); add(tram, box(18.05, 0.7, 2.62), M(0x2a6fd6), 0, 2.1, 0, false); add(tram, box(16, 0.8, 2.64), M(0x223344, { metalness: 0.7, roughness: 0.1 }), 0, 1.9, 0, false);
  // rascacielos de Uptown Charlotte: delante (tras el parque) y detrás de la calle
  const TCOL = ['#7fa9d6', '#9ab7d0', '#6b8fb8', '#a9c3dc', '#5f7fa8'];
  const tower = (x, z, w, d, h, c) => { const m = temp(new THREE.MeshStandardMaterial({ map: rep(labTex(c), Math.max(1, w / 8), Math.max(1, h / 12)), roughness: 0.2, metalness: 0.6 })); add(g, box(w, h, d), m, x, h / 2, z); return h; };
  for (let x = -110, i = 0; x < 110; i++) { const w = rnd(12, 18); if (Math.abs(x + w / 2) > 14) tower(x + w / 2, -48 - rnd(0, 20), w, rnd(12, 18), rnd(40, 110), TCOL[i % 5]); x += w + rnd(3, 7); }
  for (let x = -90, i = 0; x < 90; i++) { const w = rnd(11, 16); tower(x + w / 2, 32 + rnd(0, 8), w, 12, rnd(25, 70), TCOL[(i + 2) % 5]); x += w + 2; }
  // la torre más alta de Charlotte con su corona de agujas (inspirada en el Bank of America Corporate Center)
  const ct = new THREE.Group(); ct.position.set(0, 0, -78); g.add(ct);
  add(ct, box(20, 160, 20), temp(new THREE.MeshStandardMaterial({ map: rep(labTex('#8fb0d8'), 3, 14), roughness: 0.25, metalness: 0.6 })), 0, 80, 0);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; add(ct, cyl(0.25, 0.5, 14, 6), M(0xd9c48a, { metalness: 0.9, roughness: 0.3 }), Math.cos(a) * 7, 167, Math.sin(a) * 7); }
  add(ct, cone(8, 18, 16), M(0xd9c48a, { metalness: 0.9, roughness: 0.3, transparent: true, opacity: 0.55 }), 0, 169, 0, false);
  // Salón de la Fama de NASCAR (a tu izquierda): edificio curvo con franja metálica y autos de carreras al frente
  const hof = new THREE.Group(); hof.position.set(-34, 0, -16); hof.rotation.y = Math.PI / 2 * 0.25; g.add(hof);
  add(hof, cyl(16, 16, 14, 32, 1, false, -0.8, 1.6), M(0x2a3542, { metalness: 0.5, roughness: 0.3 }), 0, 7, -10);
  const band = add(hof, new THREE.TorusGeometry(16.3, 0.9, 6, 40, 1.8), M(0xdfe5ea, { metalness: 1, roughness: 0.2 }), 0, 11, -10, false); band.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.9);
  add(hof, new THREE.PlaneGeometry(14, 2.2), temp(new THREE.MeshStandardMaterial({ map: textTex('SALÓN DE LA FAMA NASCAR', 1024, 160, '#111', '#ffd23a', 'bold 58px system-ui'), roughness: 0.5 })), 0, 5.5, 6.1, false);
  for (let k = 0; k < 3; k++) { const rc = car(hof, [0xd4202a, 0xffd23a, 0x2a6fd6][k], -6 + k * 6, 9, 0); rc.userData.sp = 0; }
  // árboles del parque (robles y arces) y bancas
  const palms = []; for (let x = -60; x <= 60; x += 10) { if (Math.abs(x) > 4) palms.push(fallTree(g, x + rnd(-1, 1), 6.5, rnd(0.8, 1.1))); palms.push(fallTree(g, x + 5, 23.5, rnd(0.7, 0.9))); }
  for (const [x, z] of [[-20, -10], [-8, -18], [9, -20], [22, -8], [-26, 0], [28, -2]]) palms.push(fallTree(g, x, z, rnd(0.9, 1.3)));
  const cars = [[0xd4202a, -30, 13.6, 7], [0x2a6fd6, 10, 13.6, 7], [0xffe14d, -5, 17.4 - 3.4, 6], [0x00788c, 35, 13.6, 7], [0xffffff, 55, 13.6, 8]].map(a => car(g, ...a));
  cars.push(tram);
  const towers = [];
  const stop = add(g, cyl(0.38, 0.38, 0.04, 8), M(0xd4202a), 3.5, 2.3, 11.6, false); stop.rotation.x = Math.PI / 2; stop.rotation.y = Math.PI;
  add(g, cyl(0.04, 0.04, 2.3, 6), M(0x999999, { metalness: 0.8 }), 3.5, 1.15, 11.7);
  const bench = new THREE.Group(); bench.position.set(-5, 0.25, 20.8); g.add(bench); add(bench, box(2, 0.08, 0.5), M(0x9a6a3a), 0, 0.55, 0); add(bench, box(2, 0.45, 0.06), M(0x9a6a3a), 0, 0.85, 0.25);
  const DEF = [['🏁', 'flag', -6, 0.6, 3.5], ['🍩', 'donut', 5, 0.35, 2.5], ['🥤', 'soda', 10.5, 0.5, -2.5], ['🏀', 'ball', -5, 1.05, 20.8], ['👑', 'crown', 12, 1.5, 9]];
  const hitM = temp(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })), beamM = temp(new THREE.MeshBasicMaterial({ color: 0xfff1a0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const items = DEF.map(([emoji, kind, x, y, z], k) => {
    const it = new THREE.Group(); it.position.set(x, y, z); g.add(it);
    const body = new THREE.Group(); it.add(body); ITEM[kind](body); it.add(glow(0xfff3a0, 1.1, 0.55));
    add(it, new THREE.CylinderGeometry(0.08, 0.35, 7, 12, 1, true), beamM, 0, 3.5, 0, false);
    add(it, sph(0.9, 8), hitM, 0, 0, 0, false);
    it.userData = { emoji, found: false, body, by: y, ph: k, fly: 0, spin: true };
    return it;
  });
  let running = false, time = 60, found = 0, hover = null, infoT = 0;
  const info = () => ctx.info(`⏱ ${Math.ceil(time)} s · ${found}/5 · ${items.map(i => i.userData.found ? '✅' : i.userData.emoji).join(' ')}`);
  const pickI = p => { const h = p.ray.intersectObjects(items.filter(i => !i.userData.found), true).find(o => o.object.material === hitM); return h ? h.object.parent : null; };
  const intro = withIntro(ctx, opt, [{ t: 0, p: [0, 22, -28], yaw: Math.PI, pitch: -0.32 }, { t: 3.5, p: [0, 1.6, 10], yaw: Math.PI, pitch: 0.05 }, { t: 6, p: [0, 1.6, 10], yaw: Math.PI * 2, pitch: 0 }], 0, 0);
  const refreshHint = () => ctx.hint(opt.xr ? '☝️ Apunta con la mano a un objeto y junta los dedos · sigue los haces de luz y la flecha amarilla' : (ctx.gyroOn() ? '📱 Gira el celular para buscar · ' : '👆 Arrastra para mirar · ') + (ctx.isHand() ? 'deja tu índice quieto sobre el objeto' : 'toca el objeto') + ' · sigue la flecha amarilla');
  function collect(it, inp) { // ¡encontrado!
    it.userData.found = true; it.userData.fly = 0.001; found++; ctx.sfx('pickup'); ctx.burst(it.getWorldPosition(_v), [0xffd700, 0xff4fa3, 0x24d1ff], 45, 2.2); info();
    if (opt.xr) { ctx.pop(`${it.userData.emoji} ¡LO TIENES!`, 'small'); ctx.xr().haptic(0.8, 70, inp); }
    if (found === 5) { running = false; guideArrow(camera, null); xArrow.visible = false; setTimeout(() => ctx.win('city'), 700); }
  }

  // ===== 🥽 Quest: apunta con la mano a un objeto y junta los dedos: vuela hasta tu mano =====
  // CURB: altura de la acera donde apareces (m) · PULL: segundos que tarda el objeto en llegar a tu mano
  // ARROW: a qué distancia de tus ojos flota la flecha (m) · SEEN: ángulo (°) desde el centro de tu vista en que el objeto ya se ve y la flecha se esconde
  const XC = { CURB: 0.245, PULL: 0.45, ARROW: 0.9, SEEN: 35 };
  const _cw = new V3(), _ro = new V3(), _rd = new V3(), _rq = new THREE.Quaternion(), xRc = new THREE.Raycaster();
  const camW = () => camera.getWorldPosition(_cw); // tu cabeza en el mundo (en el visor la cámara vive dentro de otro grupo)
  const hits = items.map(i => i.children.find(o => o.material === hitM));
  const xArrow = new THREE.Group(); xArrow.visible = false; g.add(xArrow); // flecha amarilla 3D frente a ti que señala el objeto más cercano
  { const am = temp(new THREE.MeshBasicMaterial({ color: 0xffd23a, depthTest: false, transparent: true }));
    const h = add(xArrow, cone(0.06, 0.14, 16), am, 0, 0, 0.07, false), s = add(xArrow, cyl(0.022, 0.022, 0.14, 10), am, 0, 0, -0.06, false);
    h.rotation.x = s.rotation.x = Math.PI / 2; h.renderOrder = s.renderOrder = 60; }
  function xrAim(inp) { // ¿a qué objeto apunta tu mano? → { it, d } (d = distancia en m)
    if (!inp || !inp.src || !inp.ok) return null;
    inp.ctl.getWorldPosition(_ro); _rd.set(0, 0, -1).applyQuaternion(inp.ctl.getWorldQuaternion(_rq)); xRc.set(_ro, _rd);
    const h = xRc.intersectObjects(hits.filter(m => !m.parent.userData.found && !m.parent.userData.pull), false)[0];
    return h ? { it: h.object.parent, d: h.distance } : null;
  }
  function xrHover() { for (const inp of ctx.xr().inputs) { const a = xrAim(inp); if (a) return a.it; } return null; }
  function xrInput(type, inp) { // pinza (o gatillo) apuntando a un objeto: vuela hasta tu mano
    if (!opt.xr || type !== 'selectstart' || !running) return;
    const a = xrAim(inp); if (!a) return;
    a.it.userData.pull = { t: 0, inp, from: a.it.position.clone() }; ctx.sfx('click'); ctx.xr().haptic(0.4, 30, inp);
  }
  function xrPull(it, dt) { // el objeto vuela hasta tu mano; al llegar, cuenta
    const u = it.userData, P = u.pull; P.t += dt; const k = Math.min(1, P.t / XC.PULL), e = 1 - Math.pow(1 - k, 3);
    it.position.lerpVectors(P.from, g.worldToLocal(_v.copy(P.inp.grabPos)), e); it.scale.setScalar(1.3 - e * 0.6); u.body.rotation.y += dt * 8;
    if (k >= 1) { u.pull = null; collect(it, P.inp); }
  }
  function xrArrow(p) { // si el objeto más cercano no se ve, la flecha frente a ti lo señala
    const h = camW(); _rd.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_rq));
    xArrow.visible = !!p && _ro.copy(p).sub(h).normalize().dot(_rd) < Math.cos(THREE.MathUtils.degToRad(XC.SEEN));
    if (!xArrow.visible) return;
    xArrow.position.copy(h).addScaledVector(_rd, XC.ARROW); xArrow.position.y -= 0.18; xArrow.lookAt(p);
  }
  if (opt.xr) ctx.teleport(0, 10, 0, 0, XC.CURB); // 🥽 apareces en la acera de Uptown Charlotte, mirando el parque

  return {
    look: true, camLock: !opt.quick, dwellTime: 0.5, refreshHint, xrInput, xrRays: () => opt.xr && running,
    xrRayLen: inp => { const a = running && xrAim(inp); return a ? a.d : 0; },
    start() { running = true; this.camLock = false; info(); refreshHint(); },
    tap(p) {
      if (intro.on) { intro.finish(); this.camLock = false; return; }
      const it = running && pickI(p); if (it) collect(it);
    },
    hoverable: p => (running ? pickI(p) : null),
    hover(p) { hover = running ? pickI(p) : null; },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      ocean.userData.uT.value = t;
      cars.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x > 75) c.position.x = -75; if (c.position.x < -75) c.position.x = 75; });
      palms.forEach(p => (p.userData.crown.rotation.z = Math.sin(t * 0.9 + p.userData.ph) * 0.05));
      towers.forEach((tw, i) => (tw.userData.flag.rotation.y = Math.sin(t * 4 + i) * 0.4));
      if (opt.xr) hover = running ? xrHover() : null;
      for (const it of items) {
        const u = it.userData;
        if (u.pull) { xrPull(it, dt); continue; }
        if (u.fly) { u.fly += dt; it.position.y += dt * 2.5; it.scale.setScalar(1 + u.fly * 2); if (u.fly > 0.5) it.visible = false; continue; }
        it.position.y = u.by + Math.sin(t * 2 + u.ph) * 0.08; if (u.spin) u.body.rotation.y += dt * 1.5; it.scale.setScalar(hover === it ? 1.3 : 1);
      }
      if (running) {
        time -= dt; infoT += dt; if (infoT > 0.25) { infoT = 0; info(); }
        let best = null, bd = 1e9; for (const it of items) if (!it.userData.found && !it.userData.pull) { const d = it.position.distanceToSquared(camW()); if (d < bd) { bd = d; best = it.position; } }
        if (opt.xr) xrArrow(best); else guideArrow(camera, best);
        if (time <= 0) { time = 0; running = false; guideArrow(camera, null); xArrow.visible = false; ctx.lose(`Se acabó el tiempo. Encontraste ${found} de 5 objetos. Sigue la flecha amarilla y los haces de luz.`); }
      }
    },
    dispose() { running = false; restoreEnv(); guideArrow(camera, null); }
  };
}

/* ================= RESEARCH TRIANGLE PARK (Raleigh-Durham) — laboratorio de drones (clave interna 'heroes') ================= */
function labTex(col, word) { // fachada de vidrio de un laboratorio moderno, con el nombre arriba
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#1c2633'; g.fillRect(0, 0, w, h);
    for (let y = 40; y < h; y += 26) for (let x = 6; x < w; x += 31) { g.fillStyle = Math.random() < 0.35 ? '#ffe6a8' : col; g.globalAlpha = 0.85; g.fillRect(x, y, 27, 20); }
    g.globalAlpha = 1; g.fillStyle = '#e9eef5'; g.fillRect(0, 0, w, 32);
    if (word) { g.fillStyle = '#123'; g.font = 'bold 24px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(word, 128, 17); }
  });
}
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
  { name: 'Martillo de pulsos', note: 'lanza rayos eléctricos: toca un dron', col: 0x7fd8ff },
  { name: 'Arco láser', note: 'tensa y dispara flechas de luz', col: 0xffd23a },
  { name: 'Escudo bumerán', note: 'rebota entre drones y regresa', col: 0xd8d8e0 }
];
// Armas con tus modelos FBX (martillo, arco y escudo). Vista "de exhibición": de pie, mirando a +Z.
// HOLD = giro extra cuando el arma está en la mano: el arco queda vertical con la cuerda hacia ti y el escudo te muestra su frente.
const HOLD = [[0, 0, 0], [-Math.PI / 2, 0.75, 0.25], [-Math.PI / 2, Math.PI, 0]];
const HOLD_POS = [[0, 0, 0], [0.16, 0.05, 0], [0.05, 0, 0]], HOLD_SCALE = [1, 1, 0.62]; // el arco más al centro y el escudo más pequeño
function holdPose(o, i) { o.rotation.set(...HOLD[i]); o.position.set(...HOLD_POS[i]); o.scale.setScalar(HOLD_SCALE[i]); }
const _hidden = new THREE.MeshBasicMaterial({ visible: false });
function weaponModel(i) {
  if (i === 0) return modelo('martillo', { fallback: () => weaponOld(0) });
  if (i === 2) return modelo('escudo', { fallback: () => weaponOld(2) });
  return modelo('arco', { fallback: () => weaponOld(1), onLoad: (o, info) => { // la cuerda del modelo se cambia por una que se puede tensar
    setMaterial(o, _hidden, modelMat('arco', 'Material.023'));
    const s = info.string, ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, s.top, s.z), new V3(0, 0, s.z), new V3(0, s.bot, s.z)]), temp(new THREE.LineBasicMaterial({ color: 0xeeeeee })));
    ln.name = 'cuerda'; ln.userData = { z0: s.z, dir: -1 }; o.add(ln);
  } });
}
function weaponOld(i) { // armas hechas por código (respaldo mientras cargan los modelos)
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
    const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, 0.31, 0.02), new V3(0, 0, 0.02), new V3(0, -0.31, 0.02)]), temp(new THREE.LineBasicMaterial({ color: 0xeeeeee })));
    ln.name = 'cuerda'; ln.userData = { z0: 0.02, dir: 1 }; g.add(ln);
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
  const tile = rep(canvasTex(256, 256, (q, w) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { q.fillStyle = (x + y) % 2 ? '#8c9096' : '#a3a7ad'; q.fillRect(x * 64 + 1, y * 64 + 1, 62, 62); } q.fillStyle = '#4fb3c8'; q.fillRect(0, 126, w, 4); }), 30, 30);
  const gr = add(g, new THREE.PlaneGeometry(200, 200), temp(new THREE.MeshStandardMaterial({ map: tile, roughness: 0.8 })), 0, 0, 0, false); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true;
  const COLS = ['#3a7bd5', '#4fb3c8', '#5a8fd0', '#3d9e8f', '#6a7fc8', '#2f8fb0'], WORDS = ['LAB ROBÓTICA', 'BIOTECNOLOGÍA', 'IA Y DATOS', 'ENERGÍA', 'DRONES', 'MEDICINA'];
  for (const [x, z] of [[-40, -30], [-30, -48], [38, -36], [46, -8], [-46, 6], [30, 30], [-28, 34], [0, -55], [52, 22], [-55, -20]]) pine(g, x, z, rnd(1.4, 2)); // pinos de Carolina alrededor del parque
  for (let i = 0; i < 12; i++) { // laboratorios de vidrio alrededor de la plaza
    const a = i / 12 * Math.PI * 2, r = rnd(24, 32), h = rnd(9, 20), w = rnd(8, 12), b = new THREE.Group(); b.position.set(Math.sin(a) * r, 0, -Math.cos(a) * r); b.rotation.y = -a; g.add(b);
    const side = temp(new THREE.MeshStandardMaterial({ map: labTex(COLS[i % 6]), roughness: 0.25, metalness: 0.5 })), front = temp(new THREE.MeshStandardMaterial({ map: labTex(COLS[(i + 2) % 6], WORDS[i % 6]), roughness: 0.25, metalness: 0.5 }));
    add(b, box(w, h, 8), [side, side, side, side, front, side], 0, h / 2, 0);
    for (let k = 0; k < 4; k++) add(b, box(0.25, 3, 0.25), M(0x8a8f9a, { metalness: 0.9, roughness: 0.3 }), -w / 2 + 1 + k * (w - 2) / 3, h + 1.5, -3);
    add(b, box(w - 1, 0.25, 0.25), M(0x8a8f9a, { metalness: 0.9 }), 0, h + 3, -3);
    add(b, box(w * 0.7, 0.2, 2), M(0x111111, { metalness: 0.5 }), 0, 3.2, 4.6);
  }
  // torre de caída libre con asientos que suben y bajan
  const tw = new THREE.Group(); tw.position.set(14, 0, -22); g.add(tw);
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(tw, box(0.3, 46, 0.3), M(0x8a8f9a, { metalness: 0.9, roughness: 0.3 }), x, 23, z);
  for (let y = 3; y < 46; y += 3) add(tw, box(2.3, 0.15, 2.3), M(0x6a6f7a, { metalness: 0.8 }), 0, y, 0, false);
  add(tw, cone(2, 4, 8), M(0xe9eef5, { metalness: 0.6 }), 0, 48, 0); add(tw, sph(0.6, 12), M(0xff3030, { emissive: 0xff2020, emissiveIntensity: 2 }), 0, 50.5, 0, false); // antena de pruebas
  const seats = new THREE.Group(); tw.add(seats); add(seats, cyl(2.4, 2.4, 1.2, 16), M(0xffd23a, { metalness: 0.4, roughness: 0.4 }), 0, 0, 0);
  const arch = add(g, new THREE.TorusGeometry(6, 0.6, 12, 40, Math.PI), M(0x4fb3c8, { metalness: 0.7, roughness: 0.25 }), 0, 0, 12); arch.rotation.y = Math.PI;
  add(g, new THREE.PlaneGeometry(9, 1.6), temp(new THREE.MeshStandardMaterial({ map: textTex('RESEARCH TRIANGLE PARK', 1024, 180, '#0f2a44', '#ffffff', 'bold 60px system-ui'), emissive: 0x222200, side: THREE.DoubleSide })), 0, 7, 12, false);
  // drones enemigos (fase 2): llegan en oleadas y al final aparece el JEFE. Cuando un dron brilla, te dispara una bola roja: ¡cúbrete!
  // WAVES = drones por oleada (suman 5). HZ = ajustes: vida, cada cuánto disparan (s), aviso antes del disparo (s), velocidad de la bola (m/s), pausa mínima entre disparos de distintos drones (s)
  const WAVES = [1, 2, 2];
  const HZ = { hp: [2, 3, 3], bossHp: 8, first: [1.0, 1.8], every: [4.2, 6.0], charge: 1.0, shotSp: 8, gap: 3.6, hearts: 3 }; // hp = golpes por dron en las oleadas 1, 2 y 3 · first = primer disparo (s) · every = cada cuánto dispara un dron · gap = pausa mínima entre disparos de distintos drones
  const ringT = canvasTex(128, 128, (q) => { q.strokeStyle = '#ff2a2a'; q.lineWidth = 10; q.beginPath(); q.arc(64, 64, 52, 0, 7); q.stroke(); q.lineWidth = 6; for (const a of [0, 1.57, 3.14, 4.71]) { q.beginPath(); q.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40); q.lineTo(64 + Math.cos(a) * 62, 64 + Math.sin(a) * 62); q.stroke(); } });
  const reticle = new THREE.Sprite(temp(new THREE.SpriteMaterial({ map: ringT, transparent: true, depthTest: false }))); reticle.scale.setScalar(2.4); reticle.visible = false; reticle.renderOrder = 9; g.add(reticle);
  const drones = Array.from({ length: 5 }, () => { const d = drone(); d.visible = false; g.add(d); return d; });
  // el JEFE: un dron gigante con anillo y tres ojos; a media vida se cubre con una burbuja
  const boss = drone(); boss.visible = false; boss.userData.boss = true; g.add(boss);
  add(boss, new THREE.TorusGeometry(0.75, 0.06, 8, 40), M(0xb36bff, { emissive: 0x8a2ad4, emissiveIntensity: 1.6 }), 0, 0, 0, false).rotation.x = Math.PI / 2;
  for (const x of [-0.22, 0.22]) add(boss, sph(0.08, 10), M(0xff2a2a, { emissive: 0xff1010, emissiveIntensity: 2.5 }), x, 0.12, 0.33, false);
  for (let k = 0; k < 5; k++) add(boss, cone(0.06, 0.25, 6), M(0xffd23a, { metalness: 0.8 }), Math.cos(k / 5 * 6.28) * 0.3, 0.32, Math.sin(k / 5 * 6.28) * 0.3, false);
  const bubble = add(boss, sph(0.95, 24), temp(new THREE.MeshBasicMaterial({ color: 0x24d1ff, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })), 0, 0, 0, false); bubble.visible = false;
  // bolas rojas de los drones (se reutilizan)
  const balls = Array.from({ length: 6 }, () => { const b = new THREE.Group(); add(b, sph(0.18, 12), M(0xff3a2a, { emissive: 0xff2010, emissiveIntensity: 2.5 }), 0, 0, 0, false); b.add(glow(0xff4030, 1.4, 0.8)); b.visible = false; b.userData.v = new V3(); g.add(b); return b; });
  // campo de fuerza para cubrirte
  const field = new THREE.Group(); field.position.set(0, -0.05, -0.55); field.visible = false; camera.add(field);
  add(field, new THREE.CircleGeometry(0.5, 48), temp(new THREE.MeshBasicMaterial({ color: 0x24d1ff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })), 0, 0, 0, false);
  const fHex = add(field, new THREE.IcosahedronGeometry(0.5, 1), temp(new THREE.MeshBasicMaterial({ color: 0x9feaff, wireframe: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })), 0, 0, 0, false); fHex.scale.z = 0.25;
  let wave = -1, waveT = 0, baseYaw = 0, killed = 0, hearts = HZ.hearts, combo = 0, egap = 0, bossOn = false, bossShield = 0, bossHalf = false, time = 0;
  const ALL = [...drones, boss];
  const alive = () => (bossOn ? [boss] : drones).filter(d => d.visible && !d.userData.dead);
  const amp = () => (ctx.gyroOn() ? 1 : 0.55); // sin giroscopio no puedes girar: los drones se quedan más al frente
  function launch(d, off, pat) {
    const u = d.userData; Object.assign(u, { hp: u.boss ? HZ.bossHp : HZ.hp[Math.min(pat, 2)], t0: 0, off, pat, dead: 0, wob: 0, charge: 0, burst: 0, next: rnd(HZ.first[0], HZ.first[1]) + Math.abs(off) * 3 });
    d.visible = true; d.scale.setScalar(0.01);
  }
  function startWave(i) {
    wave = i; const f = new V3(0, 0, -1).applyQuaternion(camera.quaternion); baseYaw = Math.atan2(f.x, -f.z);
    if (i < WAVES.length) {
      const n = WAVES[i], offs = n === 1 ? [0] : [-0.28, 0.28];
      for (let k = 0; k < n; k++) launch(drones[killed + k], offs[k], i);
      ctx.pop(`OLEADA ${i + 1}`, 'small'); ctx.sfx('charge');
      ctx.toast(i === 0 ? (opt.xr ? '🚨 ¡Dron a la vista! Apúntalo y junta los dedos. Bloquea sus bolas con tu escudo.' : '🚨 ¡Dron a la vista! Atácalo. Si te dispara, mantén 🛡️ CUBRIRSE.') : `🚨 ¡Oleada ${i + 1}: ${n} drones!`, 2600);
    } else { // jefe final
      bossOn = true; launch(boss, 0, 9); ctx.pop('¡JEFE FINAL!', 'fire'); ctx.sfx('buzzer'); ctx.shake(0.4);
      ctx.toast('👾 ¡El JEFE! Dispara ráfagas y a media vida se cubre con una burbuja.', 3200);
    }
    info();
  }
  // armas: vista previa giratoria + botones grandes para elegir
  const shelf = new THREE.Group(); shelf.position.set(0, 0.02, -0.8); shelf.visible = false; camera.add(shelf);
  const picks = WEAPONS.map((w, i) => { const h = new THREE.Group(); h.position.x = (i - 1) * 0.11; h.scale.setScalar(0.2); shelf.add(h); h.add(weaponModel(i)); h.add(glow(w.col, 0.5, 0.4)); return h; });
  const bar = document.createElement('div'); bar.id = 'pickbar'; bar.className = 'hidden'; document.getElementById('app').appendChild(bar);
  const ICON = ['⚡', '🏹', '🛡️'], VERB = ['⚡ RAYO', '🏹 FLECHA', '🛡️ LANZAR ESCUDO'];
  const hand = new THREE.Group(); hand.scale.setScalar(0.55); camera.add(hand);
  let wi = -1, held = null, running = false, cd = 0, kick = 0, draw = 0, drawing = false, holdCover = false, coverT = 0, warnT = 0, attackBtn = null, coverBtn = null;
  const covering = () => holdCover || coverT > 0;
  const bolts = [], arrows = [], sh = { state: 'held', obj: null, tgt: null };
  // ===== 🥽 Quest: elige tu poder tocándolo, apunta con la mano derecha y bloquea con el escudo de tu mano izquierda =====
  // SHIELD_R: tamaño del escudo de energía de tu mano izquierda (m) · HEAD_R: a qué distancia de tu cabeza te golpea una bola (m)
  // TOUCH: qué tan cerca debe estar tu mano de un poder para elegirlo (m) · THROW_V: rapidez de la mano para lanzar el escudo con el gesto (m/s)
  const XH = { SHIELD_R: 0.28, HEAD_R: 0.35, TOUCH: 0.12, THROW_V: 2.5 };
  const _cp = new V3(), _hq = new THREE.Quaternion(), _hd = new V3(), _ho = new V3();
  const camP = () => camera.getWorldPosition(_cp); // tu cabeza en el mundo (en el visor la cámara vive dentro de otro grupo)
  const xIn = side => ctx.xr().inputs.find(i => i.src && i.ok && i.src.handedness === side) || null;
  let xLeg = null;
  const lShield = new THREE.Group(); lShield.visible = false; g.add(lShield); // escudo de energía de tu mano izquierda
  add(lShield, new THREE.CircleGeometry(XH.SHIELD_R, 40), temp(new THREE.MeshBasicMaterial({ color: 0x24d1ff, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })), 0, 0, 0, false);
  add(lShield, new THREE.RingGeometry(XH.SHIELD_R - 0.02, XH.SHIELD_R, 40), temp(new THREE.MeshBasicMaterial({ color: 0xaee8ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })), 0, 0, 0, false);
  if (opt.xr) { camera.remove(shelf); g.add(shelf); shelf.scale.setScalar(2); camera.remove(hand); g.add(hand); hand.scale.setScalar(0.8); } // ya no van pegados a la cámara
  function xrPickStart() { // la vitrina de poderes flota frente a ti y además hay botones a tu derecha
    ctx.xr().gamePoint(0, ctx.xr().eye() - 0.3, -0.6, shelf.position); shelf.lookAt(camP());
    xLeg = ctx.xr().legend(WEAPONS.map((w, i) => ({ k: i, label: `${ICON[i]} ${w.name}`, c: '#' + new THREE.Color(w.col).getHexString() })), i => { if (wi < 0) choose(i); });
  }
  function xrPickW(inp, rayToo) { // ¿qué poder toca tu mano (o apunta tu rayo)?
    for (const h of picks) { h.getWorldPosition(_ho); if (inp.palmPos.distanceTo(_ho) < XH.TOUCH || (inp.src.hand && inp.tip.distanceTo(_ho) < XH.TOUCH)) return picks.indexOf(h); }
    if (!rayToo) return null;
    inp.ctl.getWorldPosition(_ho); _hd.set(0, 0, -1).applyQuaternion(inp.ctl.getWorldQuaternion(_hq));
    const hit = new THREE.Raycaster(_ho, _hd).intersectObjects(picks, true)[0]; if (!hit) return null;
    for (let o = hit.object; o; o = o.parent) { const i = picks.indexOf(o); if (i >= 0) return i; }
    return null;
  }
  function xrInput(type, inp) {
    if (!opt.xr || type !== 'selectstart' || !inp.ok) return;
    if (wi < 0) { const i = xrPickW(inp, true); if (i !== null) choose(i); return; }
    if (running) fire(); // pinza (o gatillo) = atacar al dron que apuntas con la mano derecha
  }
  function xrHands(tg) {
    if (wi < 0) { for (const inp of ctx.xr().inputs) if (inp.src && inp.ok) { const i = xrPickW(inp, false); if (i !== null) { choose(i); break; } } } // tocar un poder lo elige
    const R = xIn('right'), L = xIn('left');
    hand.visible = !!R && wi >= 0;
    if (R) {
      R.ctl.getWorldPosition(_ho); _hd.set(0, 0, -1).applyQuaternion(R.ctl.getWorldQuaternion(_hq));
      hand.position.copy(R.palmPos); hand.lookAt(tg ? tg.position : _ho.addScaledVector(_hd, 20)); hand.rotateX(Math.PI / 2 - kick * 0.6);
      const v = R.pp.v, s = v.length(); // escudo: también se lanza con el gesto (mano rápida hacia el dron)
      if (running && wi === 2 && sh.state === 'held' && tg && s > XH.THROW_V && v.dot(_hd.copy(tg.position).sub(R.palmPos).normalize()) > s * 0.6) fire();
    }
    lShield.visible = !!L && running;
    if (L) { lShield.position.copy(L.palmPos).addScaledVector(L.palmN, 0.06); lShield.lookAt(_ho.copy(lShield.position).add(L.palmN)); }
  }
  function xrBall(b) { // la bola choca con tu escudo; si te pasa cerca sin tocarte, ¡la esquivaste!
    if (lShield.visible && b.position.distanceTo(lShield.position) < XH.SHIELD_R + 0.1) {
      b.visible = false; ctx.sfx('block'); ctx.burst(b.position, [0x24d1ff, 0xffffff], 30, 1.8); ctx.pop('¡BLOQUEADO!', 'small'); ctx.xr().haptic(0.8, 60); return true;
    }
    const d = b.position.distanceTo(camP());
    if (d < 1.3 && d > XH.HEAD_R) b.userData.close = true;
    else if (b.userData.close && d >= 1.3 && b.userData.v.dot(_ho.copy(b.position).sub(_cp)) > 0) { b.userData.close = false; if (running) ctx.pop('¡ESQUIVADA!', 'small'); }
    return false;
  }
  const info = () => ctx.info(wi < 0 ? '🦸 Elige tu arma' : bossOn
    ? `👾 JEFE ${'▰'.repeat(Math.max(0, boss.userData.hp))}${'▱'.repeat(HZ.bossHp - Math.max(0, boss.userData.hp))} · ${'❤️'.repeat(hearts)}${'🖤'.repeat(HZ.hearts - hearts)}`
    : `🌊 Oleada ${Math.max(1, wave + 1)}/3 · ${'❤️'.repeat(hearts)}${'🖤'.repeat(HZ.hearts - hearts)} · Drones ${killed}/5${combo >= 2 ? ` · 🔥 x${combo}` : ''}`);
  function showPick() {
    bar.innerHTML = WEAPONS.map((w, i) => `<button data-i="${i}"><b>${ICON[i]} ${w.name}</b><span>${w.note}</span></button>`).join('');
    bar.querySelectorAll('button').forEach(b => (b.onclick = () => choose(+b.dataset.i)));
    bar.classList.remove('hidden'); shelf.visible = true; document.body.classList.add('hasbar');
  }
  function choose(i) {
    wi = i; shelf.visible = false; if (xLeg) { xLeg.dispose(); xLeg = null; } held = weaponModel(i); holdPose(held, i); hand.add(held); if (i === 2) sh.obj = held;
    bar.innerHTML = `<button class="attack">${VERB[i]}</button><button class="cover">🛡️ CUBRIRSE</button>`;
    attackBtn = bar.querySelector('.attack'); coverBtn = bar.querySelector('.cover');
    attackBtn.onclick = () => fire();
    const on = e => { e.preventDefault(); holdCover = true; }, off = () => { if (holdCover) coverT = Math.max(coverT, 0.25); holdCover = false; }; // al soltar queda 0.25 s de margen
    coverBtn.addEventListener('pointerdown', on); ['pointerup', 'pointercancel', 'pointerleave'].forEach(n => coverBtn.addEventListener(n, off));
    running = true; time = 0; ctx.sfx('pickup'); refreshHint(); startWave(0);
  }
  function target() { // el dron más cercano al centro de la pantalla (en el visor: hacia donde apunta tu mano derecha)
    const R = opt.xr && xIn('right'); let o = camP(), f;
    if (R) { o = R.ctl.getWorldPosition(_ho); f = _hd.set(0, 0, -1).applyQuaternion(R.ctl.getWorldQuaternion(_hq)); } else f = _w.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_hq));
    let best = null, bd = -2;
    for (const d of alive()) { if (d.userData.t0 < 0.7) continue; const c = _v.copy(d.position).sub(o).normalize().dot(f); if (c > bd) { bd = c; best = d; } }
    return best;
  }
  function hitDrone(d) {
    if (!d || !d.visible || d.userData.dead) return;
    const u = d.userData;
    if (u.boss && bossShield > 0) { ctx.sfx('block'); ctx.burst(d.position, [0x24d1ff, 0xffffff], 25, 2); ctx.pop('¡BURBUJA!', 'small'); return; }
    u.hp--; ctx.burst(d.position, [0x7fd8ff, 0xffffff, 0xffa020], 30, 2); ctx.sfx('hit'); u.wob = 1;
    if (u.boss && !bossHalf && u.hp <= HZ.bossHp / 2) { bossHalf = true; bossShield = 2.6; bubble.visible = true; u.burst = 3; u.bt = 0.8; ctx.pop('¡BURBUJA!', 'bad'); ctx.toast('🫧 Se cubrió: espera a que se rompa la burbuja.', 2200); }
    if (u.hp <= 0) {
      u.dead = 0.001; combo++; ctx.burst(d.position, [0xffa020, 0xff3030, 0xffffff], u.boss ? 220 : 80, u.boss ? 5 : 3.2); ctx.shake(u.boss ? 0.8 : 0.3);
      if (u.boss) { running = false; bar.classList.add('hidden'); ctx.slowmo(1, 0.3); ctx.pop('¡JEFE DERROTADO!', 'fire'); ctx.sfx('perfect'); finish(); }
      else {
        killed++; ctx.pop(combo >= 3 ? `¡DERRIBADO! x${combo}` : '¡DERRIBADO!', combo >= 3 ? 'fire' : 'good');
        if (!alive().length) { waveT = 1.8; if (wave + 1 < WAVES.length) setTimeout(() => running && ctx.pop('¡OLEADA SUPERADA!', 'good'), 600); }
      }
    }
    info();
  }
  function finish() {
    const secs = Math.round(time), medal = hearts >= 3 ? 'oro' : hearts >= 2 ? 'plata' : 'bronce', b = ctx.best('heroes', secs, true);
    setTimeout(() => ctx.win('heroes', { medal, line: `🦸 5 drones y el jefe en ${secs} s · ${'❤️'.repeat(hearts)}`, record: b.isNew ? '¡NUEVO RÉCORD!' : `RÉCORD: ${b.best} s` }), 1500);
  }
  function fire(d) {
    if (!running || cd > 0 || covering()) return;
    d = d || target(); if (!d || !d.visible || d.userData.dead) return;
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
  function enemyShot(d) { // el dron dispara una bola roja hacia ti
    const b = balls.find(x => !x.visible); if (!b) return;
    b.visible = true; b.position.copy(d.position);
    b.userData.close = false; b.userData.v.copy(camP()).add(_v.set(rnd(-0.25, 0.25), -0.15, 0)).sub(d.position).normalize().multiplyScalar(HZ.shotSp * (bossOn ? 1.2 : 1));
    ctx.sfx('throw');
  }
  const intro = withIntro(ctx, opt, [{ t: 0, p: [0, 1.6, 26], yaw: 0, pitch: 0.2 }, { t: 3.5, p: [0, 1.6, 4], yaw: 0, pitch: 0.12 }, { t: 7.5, p: [0, 1.6, 0], yaw: Math.PI * 2, pitch: 0.1 }], 0, 0.1);
  const refreshHint = () => ctx.hint(opt.xr ? (wi < 0 ? '✋ Toca el poder que quieras (o elígelo en los botones de tu derecha)' : '☝️ Apunta con tu mano derecha al dron del aro rojo y junta los dedos · 🛡️ pon el escudo de tu mano izquierda frente a las bolas rojas') : wi < 0 ? 'Elige tu arma con los botones de abajo 👇'
    : `Pulsa <b>${VERB[wi]}</b> ` + (ctx.isHand() ? 'o haz pinza' : 'o toca un dron') + ' para atacar (el <b>aro rojo</b> marca a cuál). Cuando venga una bola roja (el botón parpadea), mantén <b>🛡️ CUBRIRSE</b>' + (ctx.isHand() ? ' o muestra la palma ✋.' : '.'));
  const pickD = p => { let best = null, bd = 4; for (const d of alive()) { if (d.userData.t0 < 0.7) continue; const r = p.ray.ray.distanceSqToPoint(d.position) / (d.userData.boss ? 6 : 1); if (r < bd) { bd = r; best = d; } } return best; };
  return {
    camLock: !opt.quick, dwellTime: 0.45, refreshHint, xrInput, xrRays: () => opt.xr && (wi < 0 || running), _dbg: { incoming: () => balls.some(b => b.visible) },
    start() { this.camLock = false; info(); refreshHint(); showPick(); if (opt.xr) xrPickStart(); },
    onDown(p) { if (intro.on) { intro.finish(); this.camLock = false; return; } if (running) fire(p.src === 'hand' ? null : pickD(p)); },
    onMove() {}, onUp() {},
    palm() { if (running) { coverT = 1.3; ctx.sfx('block'); } }, // con la mano: palma abierta = cubrirte un momento
    tap(p) { if (intro.on) { intro.finish(); this.camLock = false; return; } fire(pickD(p)); },
    hoverable(p) { return running ? pickD(p) : null; },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      seats.position.y = 4 + (Math.sin(t * 0.5) * 0.5 + 0.5) ** 3 * 38;
      if (shelf.visible) picks.forEach(h => (h.rotation.y += dt));
      cd = Math.max(0, cd - dt); kick = Math.max(0, kick - dt * 4); coverT = Math.max(0, coverT - dt); egap = Math.max(0, egap - dt); bossShield = Math.max(0, bossShield - dt);
      if (bubble.visible && bossShield <= 0) { bubble.visible = false; ctx.sfx('block'); ctx.pop('¡AHORA!', 'good'); }
      if (running) time += dt;
      // campo de fuerza y botones
      field.visible = covering(); if (field.visible) { fHex.rotation.z += dt * 1.5; field.scale.setScalar(1 + Math.sin(t * 18) * 0.02); }
      if (coverBtn) { coverBtn.classList.toggle('on', covering()); coverBtn.classList.toggle('warn', warnT > 0 && !covering()); attackBtn.disabled = covering(); }
      warnT = 0;
      const tg = running ? target() : null;
      if (opt.xr) xrHands(tg); // 🥽 el arma en tu mano derecha y el escudo en la izquierda
      else {
        const n = ctx.ptr.ndc, hh = 0.5 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), hw = hh * camera.aspect;
        hand.position.set(0.55 * hw, -0.6 * hh, -0.5);
        hand.lookAt(tg ? tg.position : ctx.ptr.ray.ray.at(20, _w)); hand.rotateX(Math.PI / 2 - kick * 0.6 + (covering() ? 0.6 : 0));
      }
      if (held && wi === 1) { draw = drawing ? Math.min(1, draw + dt * 3) : Math.max(0, draw - dt * 8); const s = held.getObjectByName('cuerda'); if (s) { const a = s.geometry.attributes.position; a.setZ(1, s.userData.z0 + s.userData.dir * draw * 0.22); a.needsUpdate = true; } }
      if (held && wi === 0 && Math.random() < 0.3) ctx.burst(held.getWorldPosition(_v), 0x7fd8ff, 1, 0.5);
      if (running && waveT > 0) { waveT -= dt; if (waveT <= 0) startWave(wave + 1); }
      for (const dr of ALL) {
        const u = dr.userData; if (!dr.visible) continue;
        u.rot.forEach(r => (r.rotation.y += dt * 40));
        if (u.dead) { u.dead += dt; dr.scale.setScalar(Math.max(0.01, (u.boss ? 3 : 1.4) * (1 - u.dead * 1.6))); dr.position.y -= dt * 4; if (u.dead > 0.6) dr.visible = false; continue; }
        u.t0 += dt; const A = amp(), T0 = u.t0;
        // patrones de vuelo: 0 = vaivén suave · 1 = zigzag · 2 = rodea al jugador · 9 = jefe
        let ang, dist, y;
        if (u.pat === 0) { ang = Math.sin(T0 * 0.7) * 0.32; dist = 12 - Math.sin(T0 * 0.4) * 3; y = 3.2 + Math.sin(T0 * 1.3) * 0.9; }
        else if (u.pat === 1) { const tri = 2 * Math.abs(((T0 * 0.45) % 2) - 1) - 1; ang = tri * 0.42; dist = 11; y = 3 + Math.abs(Math.sin(T0 * 2)) * 1.2; }
        else if (u.pat === 2) { ang = Math.sin(T0 * 0.45 + u.off * 4) * 0.8; dist = 10 + Math.sin(T0 * 0.8) * 1.5; y = 3.6 + Math.sin(T0 * 1.7) * 0.6; }
        else { ang = Math.sin(T0 * 0.35) * 0.35; dist = 16 - Math.sin(T0 * 0.5) * 2; y = 5 + Math.sin(T0 * 0.9) * 0.8; }
        ang = baseYaw + u.off * A + ang * A;
        dr.position.set(Math.sin(ang) * dist, y, -Math.cos(ang) * dist);
        const full = u.boss ? 3 : 1.4; u.wob = Math.max(0, (u.wob || 0) - dt * 2); dr.rotation.z = Math.sin(t * 30) * 0.3 * u.wob;
        dr.lookAt(camP());
        // disparo: el ojo brilla y crece (aviso) y luego sale la bola roja
        let s = Math.min(full, u.t0 * 2 * full / 1.4);
        if (running && u.t0 > 0.8) {
          u.next -= dt;
          if (!u.charge && !u.burst && u.next <= 0 && egap <= 0) { u.charge = 0.001; egap = HZ.gap * (bossOn ? 0.6 : 1); ctx.sfx('charge'); }
          if (u.charge) {
            u.charge += dt; s *= 1 + Math.sin(u.charge * 30) * 0.06;
            ctx.burst(dr.position, 0xff3a2a, 1, 0.8);
            if (u.charge >= HZ.charge * (bossOn ? 0.8 : 1)) { u.charge = 0; u.burst = u.boss ? (u.burst || 2) : 1; u.bt = 0; }
          }
          if (u.burst) { warnT = 1; u.bt -= dt; if (u.bt <= 0) { enemyShot(dr); u.burst--; u.bt = 0.35; if (!u.burst) u.next = rnd(HZ.every[0], HZ.every[1]) * (u.boss ? 0.7 : 1); } }
        }
        dr.scale.setScalar(s);
      }
      if (tg && running) { reticle.visible = true; reticle.position.copy(tg.position); reticle.scale.setScalar((tg.userData.boss ? 5.5 : 2.4) + Math.sin(t * 6) * 0.25); reticle.material.rotation += dt; }
      else reticle.visible = false;
      // bolas rojas: si llegan y no estás cubierto, pierdes un corazón
      for (const b of balls) {
        if (!b.visible) continue;
        b.position.addScaledVector(b.userData.v, dt); warnT = 1;
        if (opt.xr && xrBall(b)) continue;
        if (b.position.distanceTo(camP()) < (opt.xr ? XH.HEAD_R : 1.0)) {
          b.visible = false;
          if (!running) continue;
          if (covering()) { ctx.sfx('block'); ctx.burst(b.position, [0x24d1ff, 0xffffff], 30, 1.8); ctx.pop('¡BLOQUEADO!', 'small'); }
          else {
            hearts--; combo = 0; ctx.sfx('hurt'); ctx.flash(); ctx.shake(0.5); info();
            if (hearts <= 0) { running = false; bar.classList.add('hidden'); ctx.lose(opt.xr ? 'Los drones te alcanzaron 3 veces. Consejo: pon el escudo de tu mano izquierda frente a la bola roja, o muévete para esquivarla.' : 'Los drones te alcanzaron 3 veces. Consejo: cuando venga la bola roja (el botón parpadea), mantén 🛡️ CUBRIRSE hasta que choque.'); }
            else ctx.pop('¡AUCH!', 'bad');
          }
        } else if (b.position.distanceTo(camP()) > 40) b.visible = false;
      }
      for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; b.life -= dt; b.ln.material.opacity = b.life * 4; if (b.life <= 0) { g.remove(b.ln); disposeTree(b.ln); bolts.splice(i, 1); } }
      for (let i = arrows.length - 1; i >= 0; i--) {
        const a = arrows[i]; a.life -= dt; _v.copy(a.d.position).sub(a.m.position); const dd = _v.length();
        a.m.position.addScaledVector(_v.normalize(), Math.min(dd, 30 * dt)); a.m.lookAt(_w.copy(a.m.position).sub(_v));
        if (dd < (a.d.userData.boss ? 1.4 : 0.7) || a.life <= 0) { if (a.life > 0) hitDrone(a.d); g.remove(a.m); disposeTree(a.m); arrows.splice(i, 1); }
      }
      if (sh.state !== 'held') {
        if (sh.state === 'go' && (!sh.tgt.visible || sh.tgt.userData.dead)) sh.state = 'back';
        const tp = sh.state === 'go' ? sh.tgt.position : hand.getWorldPosition(new V3());
        _v.copy(tp).sub(sh.obj.position); const dd = _v.length(); sh.obj.position.addScaledVector(_v.normalize(), Math.min(dd, 24 * dt)); sh.obj.rotation.z += dt * 18;
        if (dd < (sh.state === 'go' && sh.tgt.userData.boss ? 1.6 : 0.8)) {
          if (sh.state === 'go') { hitDrone(sh.tgt); ctx.sfx('rim'); sh.state = 'back'; }
          else { g.remove(sh.obj); hand.add(sh.obj); holdPose(sh.obj, 2); sh.state = 'held'; ctx.sfx('block'); }
        }
      }
      guideArrow(camera, tg && running ? tg.position : null);
    },
    dispose() { running = false; restoreEnv(); if (xLeg) xLeg.dispose(); guideArrow(camera, null); bar.remove(); document.body.classList.remove('hasbar'); camera.remove(shelf); camera.remove(hand); camera.remove(field); disposeTree(shelf); disposeTree(hand); disposeTree(field); }
  };
}

/* ================= FÚTBOL AMERICANO — FIELD GOAL CHALLENGE ================= */
const YD = 0.9144;
function fbFieldTex() {
  return canvasTex(512, 1200, (g, w, h) => {
    const py = h / 120; // 120 yardas
    for (let i = 0; i < 24; i++) { g.fillStyle = i % 2 ? '#2f7a2e' : '#358a33'; g.fillRect(0, i * 5 * py, w, 5 * py); }
    g.fillStyle = '#0085ca'; g.fillRect(0, 0, w, 10 * py); g.fillStyle = '#101820'; g.fillRect(0, h - 10 * py, w, 10 * py);
    g.fillStyle = '#fff'; g.font = 'bold 54px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('CAROLINA', w / 2, 5 * py); g.fillText('CHARLOTTE', w / 2, h - 5 * py);
    g.strokeStyle = '#fff'; g.lineWidth = 4;
    for (let yd = 10; yd <= 110; yd += 5) { g.beginPath(); g.moveTo(0, yd * py); g.lineTo(w, yd * py); g.stroke(); }
    g.font = 'bold 34px system-ui';
    for (let yd = 20; yd <= 100; yd += 10) { const n = yd <= 60 ? yd - 10 : 110 - yd; g.fillText(String(n), 60, yd * py); g.fillText(String(n), w - 60, yd * py); }
    g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10);
  });
}
function fbBall() { // tu balón FBX: 20 cm de ancho y 35 cm de largo (eje Z)
  const b = new THREE.Group();
  b.add(modelo('balon-americano', { onLoad: o => o.scale.setScalar(0.1), fallback: () => {
    const t = canvasTex(256, 128, (q, w, h) => { q.fillStyle = '#6b3410'; q.fillRect(0, 0, w, h); for (let i = 0; i < 3000; i++) { q.fillStyle = 'rgba(0,0,0,.15)'; q.fillRect(Math.random() * w, Math.random() * h, 2, 2); } q.fillStyle = '#fff'; q.fillRect(w * 0.35, h * 0.08, w * 0.3, 5); for (let k = 0; k < 7; k++) q.fillRect(w * 0.37 + k * w * 0.04, h * 0.03, 4, 16); });
    const m = new THREE.Mesh(sph(0.11, 24), temp(new THREE.MeshStandardMaterial({ map: t, roughness: 0.65 }))); m.scale.set(1, 1, 1.6); return m;
  } }));
  return b;
}
const POSTS0 = { half: 2.82, bar: 3.05, top: 12.05 }; // medidas de los postes anteriores
function goalPost(g, z) { // tus postes FBX + banderines arriba, en un grupo para poder moverlos de lado
  const G = new THREE.Group(); G.position.z = z; g.add(G);
  G.add(modelo('postes', { fallback: goalPostOld }));
  const info = modelInfo('postes') || POSTS0;
  for (const s of [-1, 1]) { const f = add(G, new THREE.PlaneGeometry(0.3, 1.1), M(0xff6a00, { side: THREE.DoubleSide }), s * info.half, info.top + 0.5, 0, false); f.userData.flag = 1; }
  return G;
}
function goalPostOld() { // postes hechos por código (respaldo mientras carga el modelo)
  const g = new THREE.Group(), z = 0;
  const y = M(0xffd400, { metalness: 0.4, roughness: 0.4 });
  add(g, cyl(0.12, 0.12, 3.05, 12), y, 0, 1.52, z + 1.8);
  add(g, box(0.2, 0.2, 1.8), y, 0, 3.05, z + 0.9);
  add(g, cyl(0.1, 0.1, 5.64, 12), y, 0, 3.05, z).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) add(g, cyl(0.07, 0.07, 9, 10), y, s * 2.82, 7.55, z);
  add(g, box(0.6, 3, 0.6), M(0x1d3a8a, { roughness: 0.8 }), 0, 1.5, z + 1.8);
  return g;
}
function fg(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const L = 110 * YD, postZ = -L / 2 - 10 * YD + 10 * YD; // postes en la línea de fondo
  const ST = stadium(g, { fieldTex: fbFieldTex(), w: 48.8, l: 120 * YD, cz: 0, crowdCols: [0x0085ca, 0x0085ca, 0x101820, 0x101820, 0xffffff, 0xa5acaf, 0x0085ca, 0xd4202a] });
  scene.fog = new THREE.Fog(0x0a1030, 60, 220);
  const PZ = -60 * YD + 0, post = goalPost(g, PZ);
  // los postes cambian de lado en cada ronda: 3 jugadores los empujan. POST_X = distancias posibles al centro (m)
  const POST_X = [2.5, 4.5], PUSH_SP = 3.5, CAM_LIFT = 1.8; // PUSH_SP = velocidad del empuje (m/s) · CAM_LIFT = cuánto sube la cámara para verlo (m)
  const pushers = [[0.6, -0.45], [0.6, 0.45], [1.25, 0]].map(([dx, dz]) => { const P = person({ h: rnd(1.85, 1.95), athlete: true, top: 0x101820, bottom: 0xa5acaf, num: String(70 + Math.floor(rnd(0, 9))) }); helmet(P, 0xa5acaf); P.p.rotation.order = 'YXZ'; P.dx = dx; P.dz = dz; post.add(P.p); return P; });
  const mv = { on: false, from: 0, to: 0, t: 0, dur: 1, dir: 1 };
  const placePushers = dir => pushers.forEach(P => { P.p.position.set(-dir * P.dx, 0, P.dz); P.p.rotation.set(0, dir * Math.PI / 2, 0); });
  placePushers(1);
  function movePosts() { // elige un lado al azar (izquierda o derecha) distinto de donde están ahora
    let to; do { to = pick([-1, 1]) * rnd(POST_X[0], POST_X[1]); } while (Math.abs(to - post.position.x) < 2);
    mv.on = true; mv.landed = false; mv.y0 = camera.position.y; mv.from = post.position.x; mv.to = to; mv.t = 0; mv.dur = clamp(Math.abs(to - mv.from) / PUSH_SP, 1.1, 2.6); mv.dir = Math.sign(to - mv.from);
    placePushers(mv.dir); ctx.sfx('gate'); ctx.pop(mv.dir > 0 ? '¡POSTES A LA DERECHA! >>' : '<< ¡POSTES A LA IZQUIERDA!', 'small');
  }
  goalPost(g, 60 * YD);
  const DIST = [20, 30, 40].map(y => y * YD);
  let stage = 0, good = 0, tries = 0, running = false, ball = fbBall(), st = 'rest', vel = new V3(), cel = 0, fbT = 0, crossed = false;
  g.add(ball);
  const team = [], refs = [];
  const spotZ = () => PZ + DIST[stage] + 7 * YD;
  const tee = add(g, cone(0.07, 0.12, 12), M(0xff6a00, { roughness: 0.6 }), 0, 0.06, 0);
  for (let i = 0; i < 7; i++) { const P = person({ h: rnd(1.85, 1.98), athlete: true, top: 0x0085ca, bottom: 0xa5acaf, num: String(60 + i) }); helmet(P, 0xa5acaf); P.p.rotation.y = Math.PI; g.add(P.p); team.push(P); }
  for (let i = 0; i < 7; i++) { const P = person({ h: rnd(1.85, 2), athlete: true, top: 0xffffff, bottom: 0xd4202a, num: String(90 + i) }); helmet(P, 0xd4202a); g.add(P.p); team.push(P); }
  const ref = person({ h: 1.8, topMat: stripedMat('#ffffff', '#111111', 12), bottom: 0xffffff, sleeves: true }); ref.p.position.set(0, 0, PZ + 2); g.add(ref.p); refs.push(ref);
  function setup() {
    const z = spotZ(); st = 'rest'; crossed = false; ball.scale.setScalar(1); ball.visible = true; ctx.floorReset(); // con el pie: el balón aparece en tu piso, frente a ti
    ball.position.set(0, 0.26, z);
    tee.position.z = z; ball.rotation.set(0.35, 0, 0);
    team.forEach((P, i) => { const k = i % 7, def = i >= 7; P.p.position.set((k - 3) * 1.1, 0, z - (def ? 7.5 : 6.3)); P.legs.forEach(l => { l.th.rotation.x = -0.6; l.kn.rotation.x = 0.9; }); P.hips.position.y = P.leg * 0.85; P.arms.forEach(a => { a.sh.rotation.x = def ? -1.6 : -0.4; }); });
    camera.position.set(0, 1.6, z + 4.2); ctx.lookReset(0, 0.04); ctx.teleport(0, z + 4.2); // 🥽 en el visor te lleva a la nueva distancia
    if (running) movePosts();
    ctx.info(`🏈 Goles ${good}/3 · ${Math.round(DIST[stage] / YD)} yardas · Intentos ${tries}`);
  }
  function kick(vel2) {
    if (!running || st !== 'rest' || mv.on) return;
    const { pw, lat } = shotFromVel(vel2); tries++; st = 'fly'; slowed = false; ctx.sfx('bounce'); ctx.sfx('throw'); ctx.shake(0.15);
    // alcance según la distancia real desde donde está el balón (en el tee o sobre tu piso) hasta los postes
    const R = (ball.position.z - PZ + 10) * pw, th = 0.66, sp = Math.sqrt(R * 9.8 / Math.sin(2 * th)), ang = lat * 0.32;
    vel.set(Math.sin(ang) * Math.cos(th) * sp, Math.sin(th) * sp, -Math.cos(ang) * Math.cos(th) * sp);
    fbT = 0;
  }
  let slowed = false;
  const intro = withIntro(ctx, opt, [{ t: 0, p: [18, 14, 30], yaw: 0.6, pitch: -0.3 }, { t: 4, p: [0, 1.6, spotZ() + 4.2], yaw: 0, pitch: 0.04 }], 0, 0.04, () => setup());
  const startHint = () => ctx.hint(mv.on ? '⏳ ¡Están moviendo los postes! Espera a que paren…' : (ctx.inXR() ? '✋ Golpea el balón con la palma hacia los postes · más fuerte llega más lejos' : ctx.footOn() ? '🦶 Pon el pie detrás del balón de tu piso y ¡patea hacia los postes!' : ctx.isHand() ? '☝️ Mueve el índice rápido hacia arriba, inclinado hacia los postes' : '👆 Desliza rápido hacia los postes (inclina el dedo hacia su lado)'));
  const PI0 = modelInfo('postes') || POSTS0; // ancho real de tus postes (centro de cada parante)
  setup();
  return {
    camLock: !opt.quick, foot: true, refreshHint: startHint, xrWorld: { type: 'portal', keep: [ball] }, _dbg: { good: () => good, tries: () => tries, postX: () => post.position.x, moving: () => mv.on, dist: () => ball.position.z - PZ },
    start() { running = true; this.camLock = false; setup(); startHint(); },
    canKick: () => running && st === 'rest' && !mv.on && (!ctx.footOn() || ball.visible),
    onDown() { if (intro.on) { intro.finish(); this.camLock = false; } },
    onMove(p) { if (running && p.src === 'hand' && !ctx.footOn()) { const v = flick(p); if (v) kick(v); } },
    onUp(p) { if (!running || p.src === 'hand') return; const v = p.vel(110); if (v.y > 0.9) kick(v); },
    kick(v) { kick(v); },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      ST.cheer(t, cel > 0 ? 0.3 : 0.02); cel = Math.max(0, cel - dt);
      g.traverse(o => { if (o.userData.flag) o.rotation.y = Math.sin(t * 3) * 0.4; });
      if (mv.on) { // los jugadores empujan los postes: inclinados, brazos al frente y piernas corriendo
        mv.t += dt; const u = Math.min(1, mv.t / mv.dur); post.position.x = lerp(mv.from, mv.to, smooth(u));
        // la cámara sube un momento (CAM_LIFT metros) para que se vea a los jugadores empujando por encima de la fila, y luego vuelve a bajar
        const lift = smooth(Math.min(1, mv.t / 0.35)) * (1 - smooth(clamp((mv.t - mv.dur) / 0.4, 0, 1)));
        camera.position.y = mv.y0 + lift * CAM_LIFT;
        if (u < 1) pushers.forEach((P, i) => { const ph = t * 11 + i * 2.1; P.p.rotation.x = 0.45; P.arms.forEach(a => { a.sh.rotation.x = -1.35; a.el.rotation.x = -0.35; });
          P.legs.forEach((l, k) => { const q = Math.sin(ph + k * Math.PI); l.th.rotation.x = q * 0.7 - 0.35; l.kn.rotation.x = 0.35 + Math.max(0, -q) * 0.9; }); });
        else if (!mv.landed) { mv.landed = true; ctx.sfx('bounce'); pushers.forEach(P => { P.p.rotation.x = 0; P.arms.forEach(a => { a.sh.rotation.x = 0; a.el.rotation.x = 0; }); P.legs.forEach(l => { l.th.rotation.x = 0; l.kn.rotation.x = 0; }); }); }
        if (mv.t >= mv.dur + 0.4) { mv.on = false; camera.position.y = mv.y0; startHint(); }
      } else pushers.forEach((P, i) => idleAnim(P, t, i));
      if (cel > 0) { refs[0].arms.forEach(a => (a.sh.rotation.x = -3)); team.slice(0, 7).forEach(P => P.arms.forEach(a => (a.sh.rotation.x = -2.9))); } else idleAnim(ref, t);
      if (st === 'rest' && ctx.footOn() && running) { ctx.floorPlace(ball); ball.rotation.set(0.35, t * 0.6, 0); } // el balón queda anclado a tu piso real
      if (st === 'fly') {
        fbT += dt; vel.y -= 9.8 * dt; const pz = ball.position.z; ball.position.addScaledVector(vel, dt); ball.rotation.x -= dt * 12;
        ball.visible = true; if (ball.scale.x !== 1) ball.scale.setScalar(Math.abs(ball.scale.x - 1) < 0.01 ? 1 : lerp(ball.scale.x, 1, 0.15));
        if (!slowed && !crossed && ball.position.z - PZ < 5 && ball.position.y > 2) { slowed = true; ctx.slowmo(0.7, 0.4); } // suspenso: ¿entra o no?
        if (!crossed && pz > PZ && ball.position.z <= PZ) {
          crossed = true;
          const ok = Math.abs(ball.position.x - post.position.x) < PI0.half && ball.position.y > PI0.bar; // los postes pueden estar corridos a un lado
          if (ok) { good++; cel = 2.5; ctx.sfx('crowd'); ctx.sfx('score'); ctx.shake(0.35); ctx.pop('¡ES BUENO!'); ctx.burst(_v.set(post.position.x, 12, PZ), [0x0085ca, 0x101820, 0xffffff, 0xa5acaf], 120, 4); }
          else { ctx.sfx('lose'); ctx.pop(ball.position.y <= PI0.bar ? 'LE FALTÓ FUERZA' : '¡DESVIADO!', 'bad'); }
          setTimeout(() => {
            if (!running) return;
            if (ok) {
              if (good >= 3) { running = false; const medal = tries <= 3 ? 'oro' : tries <= 5 ? 'plata' : 'bronce'; ctx.win('fg', { medal, line: `🏈 3 goles en ${tries} intentos` }); return; }
              stage = Math.min(2, stage + 1); ctx.toast(`📍 Ahora desde ${Math.round(DIST[stage] / YD)} yardas`, 2500);
            }
            setup();
          }, 2300);
        }
        if (ball.position.y < 0.12) { ball.position.y = 0.12; vel.multiplyScalar(0.4); vel.y = Math.abs(vel.y) * 0.4; }
        if (fbT > 6 && !crossed) { crossed = true; ctx.pop('¡NO LLEGÓ!', 'bad'); setTimeout(() => running && setup(), 1500); }
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
  const ST = stadium(g, { fieldTex: soccerTex(), w: 68, l: 105 * 0.5, cz: GZ + 105 * 0.25, crowdCols: [0x1a85c8, 0x1a85c8, 0x111111, 0x111111, 0xffffff, 0xa5acaf, 0x1a85c8, 0xd4202a] });
  scene.fog = new THREE.Fog(0x0a1030, 50, 200);
  // arco: tu modelo FBX (postes, travesaño y red). GI = medidas reales para saber si fue gol, palo o afuera
  const GI = modelInfo('arco-futbol') || { half: 3.66, bar: 2.44, postR: 0.06, depth: 2, old: true };
  const goal = modelo('arco-futbol', { fallback: () => {
    const o = new THREE.Group(), white = M(0xffffff, { roughness: 0.3, metalness: 0.2 });
    for (const s of [-1, 1]) add(o, cyl(0.06, 0.06, 2.44, 12), white, s * 3.66, 1.22, 0);
    add(o, cyl(0.06, 0.06, 7.44, 12), white, 0, 2.44, 0).rotation.z = Math.PI / 2;
    const netPts = [];
    for (let x = -3.66; x <= 3.67; x += 0.25) { netPts.push(x, 2.44, 0, x, 2.44, -2, x, 2.44, -2, x, 0, -2); }
    for (let y = 0; y <= 2.45; y += 0.25) { netPts.push(-3.66, y, -2, 3.66, y, -2); for (const s of [-1, 1]) netPts.push(s * 3.66, y, 0, s * 3.66, y, -2); }
    const netG = new THREE.BufferGeometry(); netG.setAttribute('position', new THREE.Float32BufferAttribute(netPts, 3));
    o.add(new THREE.LineSegments(netG, temp(new THREE.LineBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.8 })))); return o;
  } });
  goal.position.z = GZ; g.add(goal);
  const netBack = y => GZ - (GI.old ? 1.9 : Math.max(0.6, GI.depth * (1 - clamp(y / GI.bar, 0, 1)))) + 0.12; // la red de tu modelo es inclinada
  const K = person({ h: 1.9, athlete: true, top: 0x39ff6a, bottom: 0x111111, sleeves: true, shorts: true, num: '1', hairStyle: 'short' });
  K.arms.forEach(a => add(a.el, sph(0.06, 10), M(0xffffff), 0, -0.17 * 1.9, 0, false).scale.set(1.2, 1.4, 0.8));
  K.p.position.set(0, 0, GZ + 0.3); g.add(K.p);
  // 3 estilos de portero (cambia en cada penal). delay/dur = reacción y velocidad de la estirada; reach = alcance de las manos; read = probabilidad de adivinar tu lado
  const STY = [
    { word: 'LENTO', name: '🐢 LENTO', col: '#7fd8ff', delay: 0.25, dur: 0.95, reach: 0.75, read: 0.4, sway: 1, tip: '🐢 Portero LENTO: reacciona tarde. ¡Prueba la esquina dorada x2!' },
    { word: 'ADIVINADOR', name: '🎲 ADIVINADOR', col: '#ffd23a', delay: 0, dur: 0.45, reach: 1.15, read: -1, sway: 1.6, tip: '🎲 Portero ADIVINADOR: ya eligió su lado y se inclina hacia él. ¡Patea al otro lado!' },
    { word: 'FELINO', name: '🐆 FELINO', col: '#ff4fa3', delay: 0.04, dur: 0.36, reach: 1.15, read: 0.6, sway: 2.6, tip: '🐆 Portero FELINO: rapidísimo. Lo superas tirando al ángulo (esquinas de arriba).' }
  ];
  const ORDER = [0, 1, 2, pick([0, 1, 2]), pick([1, 2])]; // del más fácil al más difícil
  const tags = STY.map(o => { const l = label(o.name, 0.42, o.col); l.position.y = 2.85; l.visible = false; K.p.add(l); return l; });
  let sty = STY[0], guess = 0;
  // esquina dorada: una de las 4 esquinas brilla en cada penal y el gol ahí vale doble
  const CW = 0.8, CH = 0.6; // medio ancho y media altura de la esquina (m)
  const CORN = [[-1, 1], [1, 1], [-1, 0], [1, 0]].map(([sx, top]) => ({ x: sx * (GI.half - CW - 0.05), y: top ? GI.bar - CH - 0.04 : CH + 0.04 }));
  const hotT = canvasTex(256, 192, (q, w, h) => { q.shadowColor = '#ffd23a'; q.shadowBlur = 22; q.strokeStyle = '#ffd23a'; q.lineWidth = 12; q.strokeRect(16, 16, w - 32, h - 32); q.fillStyle = 'rgba(255,210,58,.18)'; q.fillRect(16, 16, w - 32, h - 32); q.shadowBlur = 8; q.fillStyle = '#fff'; q.font = 'bold 60px system-ui,sans-serif'; q.textAlign = 'center'; q.textBaseline = 'middle'; q.fillText('x2', w / 2, h / 2 + 4); });
  const hotM = add(g, new THREE.PlaneGeometry(CW * 2, CH * 2), temp(new THREE.MeshBasicMaterial({ map: hotT, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), 0, 0, GZ + 0.05, false);
  let hot = 0, pts = 0;
  const ball = modelo('balon-futbol', { fallback: () => new THREE.Mesh(sph(0.11, 32), soccerBallMat()), onLoad: o => o.scale.setScalar(0.11) }); g.add(ball);
  let running = false, shots = 0, goals = 0, st = 'rest', vel = new V3(), cel = 0, dive = 0, diveT = 0, kx = 0, res = '', saveX = 0, netK = 0, flyT = 0;
  const info = () => ctx.info(`⚽ Goles ${goals}/3 · Penal ${Math.min(shots + (st === 'rest' ? 1 : 0), 5)}/5 · ${pts} pts`);
  function setup() {
    st = 'rest'; res = ''; dive = 0; diveT = 0; ball.position.set(0, 0.11, 0); ball.rotation.set(0, 0, 0); ball.scale.setScalar(1); ball.visible = true; ctx.floorReset();
    K.p.position.set(0, 0, GZ + 0.3); K.p.rotation.set(0, 0, 0); K.hips.position.y = K.leg;
    const si = ORDER[Math.min(shots, 4)]; sty = STY[si]; tags.forEach((l, i) => (l.visible = i === si));
    guess = si === 1 ? pick([-1, 1]) : 0; // el adivinador elige su lado antes de tu tiro
    let h2 = Math.floor(Math.random() * 4); if (h2 === hot) h2 = (h2 + 1 + Math.floor(Math.random() * 3)) % 4; hot = h2;
    hotM.position.set(CORN[hot].x, CORN[hot].y, GZ + 0.05); hotM.visible = true;
    if (running) { ctx.pop('PORTERO ' + sty.word, 'small'); ctx.toast(sty.tip, 3200); }
    camera.position.set(0, 1.6, 2.8); ctx.lookReset(0, -0.05); ctx.teleport(0, 2.8); info();
  }
  function shoot(vel2) {
    if (!running || st !== 'rest') return;
    const { pw, lat } = shotFromVel(vel2); shots++; st = 'fly'; flyT = 0; slowed = false; ctx.sfx('bounce'); ctx.sfx('throw'); ctx.shake(0.15);
    // trayectoria desde donde está el balón (punto penal o sobre tu piso real) hasta el punto elegido del arco
    const P0 = ball.position, tx = clamp(lat * 1.8, -1.4, 1.4) * 3.66, ty = clamp(0.25 + (pw - 0.75) * 2.8, 0.12, 3.4), T = 0.62 / clamp(pw, 0.7, 1.4) * (GZ - P0.z) / GZ;
    vel.set((tx - P0.x) / T, (ty - P0.y) / T + 0.5 * 9.8 * T, (GZ - P0.z) / T);
    // el portero se lanza según su estilo: el adivinador al lado que ya eligió; los otros adivinan tu lado con probabilidad «read»
    const side = Math.abs(tx) > 0.9 ? Math.sign(tx) : 0;
    if (sty.read < 0) dive = guess;
    else dive = Math.random() < sty.read ? side : pick([-1, 0, 1].filter(v => v !== side));
    diveT = 0.001; saveX = dive * 2.3; tags.forEach(l => (l.visible = false)); // el letrero se esconde mientras se lanza
  }
  const intro = withIntro(ctx, opt, [{ t: 0, p: [10, 9, 14], yaw: 0.6, pitch: -0.32 }, { t: 3.8, p: [0, 1.6, 2.8], yaw: 0, pitch: -0.05 }], 0, -0.05, () => setup());
  let slowed = false;
  const startHint = () => ctx.hint(ctx.inXR() ? '✋ Golpea el balón con la palma hacia el arco · hacia arriba va alto · hacia un lado apuntas a esa esquina' : ctx.footOn() ? '🦶 Pon el pie detrás del balón de tu piso y ¡patea! (un poco a un lado para apuntar)' : ctx.isHand() ? '☝️ Mueve el índice rápido hacia arriba; inclínalo a un lado para apuntar' : '👆 Desliza hacia el arco: la inclinación apunta y la velocidad es la fuerza');
  setup();
  return {
    camLock: !opt.quick, foot: true, refreshHint: startHint, xrWorld: { type: 'portal', keep: [ball] }, _dbg: { goals: () => goals, shots: () => shots, hot: () => CORN[hot], sty: () => sty.word },
    start() { running = true; this.camLock = false; setup(); startHint(); },
    canKick: () => running && st === 'rest' && (!ctx.footOn() || ball.visible),
    onDown() { if (intro.on) { intro.finish(); this.camLock = false; } },
    onMove(p) { if (running && p.src === 'hand' && !ctx.footOn()) { const v = flick(p); if (v) shoot(v); } },
    onUp(p) { if (!running || p.src === 'hand') return; const v = p.vel(110); if (v.y > 0.9) shoot(v); },
    kick(v) { shoot(v); },
    update(dt, t) {
      if (intro.on) { intro.update(dt); if (!intro.on) this.camLock = false; }
      ST.cheer(t, cel > 0 ? 0.3 : 0.02); cel = Math.max(0, cel - dt);
      // portero: se mueve de lado a lado y luego se lanza
      if (diveT) {
        diveT += dt; const u = clamp((diveT - sty.delay) / sty.dur, 0, 1), k = smooth(u);
        K.p.position.x = lerp(kx, saveX, k); K.p.rotation.z = lerp(-guess * 0.14, -dive * 1.25, k); K.p.position.y = Math.sin(u * Math.PI) * (dive ? 0.5 : 0.45);
        K.arms.forEach(a => { a.sh.rotation.x = -2.9; a.sh.rotation.z = 0; });
      } else if (st === 'rest') {
        kx = guess * 0.5 + Math.sin(t * sty.sway) * (guess ? 0.3 : 0.8); K.p.position.x = kx; K.p.rotation.z = -guess * 0.14; // el adivinador se inclina hacia su lado K.legs.forEach(l => { l.th.rotation.x = -0.4; l.kn.rotation.x = 0.7; }); K.hips.position.y = K.leg - 0.12;
        K.arms.forEach(a => { a.sh.rotation.z = a.s * 0.7; a.sh.rotation.x = -0.3; a.el.rotation.x = -0.4; });
      }
      if (st === 'rest' && ctx.footOn() && running) { ctx.floorPlace(ball); ball.rotation.set(0, t * 0.6, 0); } // el balón queda anclado a tu piso real
      if (st === 'fly') {
        flyT += dt; vel.y -= 9.8 * dt; const pz = ball.position.z; ball.position.addScaledVector(vel, dt); ball.rotation.x -= dt * 20;
        ball.visible = true; if (ball.scale.x !== 1) ball.scale.setScalar(Math.abs(ball.scale.x - 1) < 0.01 ? 1 : lerp(ball.scale.x, 1, 0.15));
        if (!slowed && !res && ball.position.z - GZ < 3) { slowed = true; ctx.slowmo(0.45, 0.35); } // suspenso frente al portero
        if (pz > GZ && ball.position.z <= GZ && !res) {
          const { x, y } = ball.position, inGoal = Math.abs(x) < GI.half - GI.postR && y < GI.bar - 0.04 && y > 0;
          const handX = K.p.position.x - Math.sin(K.p.rotation.z) * 1.0, handY = 1.0 + K.p.position.y + Math.cos(K.p.rotation.z) * 0.9;
          const angulo = Math.abs(x) > 2.3 && y > 1.7; // esquinas de arriba: ningún portero que se lanza llega
          const saved = inGoal && (dive ? !angulo && Math.abs(x - handX) < sty.reach && y < 2.3 : Math.abs(x) < 0.85 && y < 2.4);
          const dbl = inGoal && Math.abs(x - CORN[hot].x) < CW && Math.abs(y - CORN[hot].y) < CH; // ¿entró por la esquina dorada?
          const corner = Math.abs(x) > 2.4 || y > 1.7; // esquinas y parte alta: más difícil de atajar
          if (!inGoal) { res = 'out'; const palo = Math.abs(Math.abs(x) - 3.66) < 0.25 || Math.abs(y - 2.44) < 0.2; ctx.sfx(palo ? 'rim' : 'lose'); ctx.pop(palo ? '¡AL PALO!' : '¡AFUERA!', 'bad'); if (palo) ctx.shake(0.3); vel.set(vel.x * 0.3, 2, 3); }
          else if (saved) { res = 'save'; ctx.sfx('block'); ctx.pop('¡ATAJADA!', 'bad'); ctx.shake(0.25); vel.set(-vel.x * 0.3, 3, 6); }
          else {
            res = 'goal'; goals++; pts += dbl ? 200 : 100; cel = 2.5; netK = 1; ctx.sfx('crowd'); ctx.sfx(dbl ? 'perfect' : 'score'); ctx.shake(dbl ? 0.6 : 0.45);
            ctx.burst(_v.set(x, y, GZ - 1), dbl ? [0xffd23a, 0xffffff, 0xff8a00] : [0x1a85c8, 0xffffff, 0x111111], dbl ? 140 : 80, dbl ? 4 : 3);
            ctx.pop(dbl ? '¡x2 ESQUINA DORADA!' : corner ? '¡GOLAZO AL ÁNGULO!' : '¡GOOOL!', dbl || corner ? 'fire' : 'good'); vel.multiplyScalar(0.15);
          }
          hotM.visible = dbl; // si fue gol dorado, el marco se queda brillando un momento
          info();
          setTimeout(() => {
            if (!running) return;
            if (goals >= 3) { running = false; const medal = pts >= 500 ? 'oro' : pts >= 400 || shots <= 3 ? 'plata' : 'bronce', b = ctx.best('penalty', pts); ctx.win('penalty', { medal, line: `⚽ ${goals} goles en ${shots} penales · ${pts} pts`, record: b.isNew ? '¡NUEVO RÉCORD!' : `RÉCORD: ${b.best} pts` }); return; }
            if (shots >= 5) { running = false; ctx.lose(`Hiciste ${goals} de 5 goles. Necesitas 3. Fíjate en el portero: el lento reacciona tarde, el adivinador se inclina hacia su lado y al felino lo superas tirando al ángulo (esquinas de arriba).`); return; }
            setup();
          }, 2200);
        }
        if (res === 'goal' && ball.position.z < netBack(ball.position.y)) { ball.position.z = netBack(ball.position.y); vel.z = 0; vel.x *= 0.3; }
        if (ball.position.y < 0.11) { ball.position.y = 0.11; vel.y = Math.abs(vel.y) * 0.4; vel.x *= 0.8; vel.z *= 0.8; }
      }
      if (hotM.visible) hotM.material.opacity = 0.65 + Math.sin(t * 7) * 0.35; // la esquina dorada palpita
      if (netK > 0) { netK = Math.max(0, netK - dt * 1.5); goal.scale.z = 1 + Math.abs(Math.sin(t * 14)) * 0.14 * netK; } // la red se infla al hacer gol
      else goal.scale.z = 1;
    },
    dispose() { running = false; }
  };
}


/* ================= OUTER BANKS — TOUR EN LANCHA (3 carriles, fácil de jugar; clave interna 'miami') ================= */
// Tour acuático tal como estaba antes de la actualización (pedido de Cielo): lancha y moto hechas por código.
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
/* ---------- Outer Banks: faros, caballos, pelícanos, casas sobre pilotes, Wright Flyer, barco pirata y postales del estado ---------- */
function lighthouseTex(kind) { // spiral = Cabo Hatteras · bands = Bodie Island · brick = Currituck · white = Ocracoke
  return canvasTex(256, 512, (c, w, h) => {
    if (kind === 'brick') { c.fillStyle = '#8a3a26'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 8; x < w; x += 16) { c.fillStyle = `rgba(${120 + Math.random() * 40 | 0},50,30,.6)`; c.fillRect(x, y, 15, 7); } return; }
    c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); if (kind === 'white') return;
    c.fillStyle = '#151515';
    if (kind === 'bands') { for (let i = 0; i < 5; i++) if (i % 2 === 0) c.fillRect(0, i * h / 5, w, h / 5); return; }
    for (const off of [-w, 0, w]) for (let k = 0; k < 2; k++) { const x0 = off + k * w / 2; c.beginPath(); c.moveTo(x0, h); c.lineTo(x0 + w / 4, h); c.lineTo(x0 + w / 4 + w, 0); c.lineTo(x0 + w, 0); c.fill(); }
  });
}
function lighthouse(g, x, z, h, kind, name) {
  const L = new THREE.Group(); L.position.set(x, 0, z); g.add(L);
  const r0 = h * 0.075, r1 = h * 0.048;
  if (kind === 'spiral') add(L, cyl(r0 * 1.4, r0 * 1.5, h * 0.08, 8), M(0xb34a32, { roughness: 0.9 }), 0, h * 0.04, 0);
  add(L, new THREE.CylinderGeometry(r1, r0, h, 24), temp(new THREE.MeshStandardMaterial({ map: lighthouseTex(kind), roughness: 0.8 })), 0, h / 2, 0);
  add(L, cyl(r1 * 1.45, r1 * 1.45, h * 0.025, 16), M(0x1a1a1a, { metalness: 0.6 }), 0, h, 0);
  add(L, cyl(r1 * 0.85, r1 * 0.85, h * 0.07, 16), M(0xfff3c0, { emissive: 0xffe08a, emissiveIntensity: 1.5, transparent: true, opacity: 0.85 }), 0, h + h * 0.045, 0, false);
  add(L, new THREE.SphereGeometry(r1 * 0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x1a1a1a, { metalness: 0.6 }), 0, h + h * 0.08, 0);
  const beam = glow(0xfff4c0, h * 0.35, 0.9); beam.position.y = h + h * 0.045; L.add(beam);
  const lb = label(name, 4.5, '#ffffff', 'rgba(10,40,70,.85)'); lb.position.y = h + h * 0.22; L.add(lb);
  L.userData.beam = beam; return L;
}
function horse() { // caballo salvaje de Corolla (mustang español), con patas que caminan
  const H = new THREE.Group(), c = M(pick([0x6b3e22, 0x4a2a16, 0x8a5a32, 0x2e1d12]), { roughness: 0.75 }), dk = M(0x1a120c);
  add(H, cap(0.32, 0.9), c, 0, 1.25, 0).rotation.z = Math.PI / 2;
  const nk = add(H, cap(0.17, 0.55), c, 0.62, 1.62, 0); nk.rotation.z = -0.7;
  const hd = add(H, cap(0.13, 0.42), c, 0.95, 1.85, 0); hd.rotation.z = -1.9;
  add(H, box(0.5, 0.12, 0.06), dk, 0.6, 1.8, 0, false).rotation.z = -0.75; // crin
  const tail = add(H, cone(0.1, 0.7, 6), dk, -0.85, 1.05, 0); tail.rotation.z = -2.6;
  H.userData.legs = [[0.42, 0.18], [0.42, -0.18], [-0.42, 0.18], [-0.42, -0.18]].map(([lx, lz], k) => { const p = new THREE.Group(); p.position.set(lx, 1.05, lz); H.add(p); add(p, cap(0.07, 0.75), c, 0, -0.45, 0); add(p, cyl(0.08, 0.09, 0.1, 8), dk, 0, -0.95, 0); p.userData.ph = k % 3 ? 0 : Math.PI; return p; });
  return H;
}
function pelican() { // pelícano pardo con alas que aletean
  const P = new THREE.Group(), b = M(0x7a6a58, { roughness: 0.8 });
  add(P, sph(0.35, 12), b).scale.set(1.6, 0.8, 0.8);
  add(P, sph(0.16, 10), M(0xf1ead8), 0.55, 0.25, 0);
  add(P, cone(0.07, 0.75, 8), M(0xd8a85a), 1.0, 0.15, 0).rotation.z = -Math.PI / 2 - 0.25;
  P.userData.w = [-1, 1].map(s => { const w = new THREE.Group(); w.position.z = s * 0.2; P.add(w); add(w, box(0.6, 0.04, 1.3), b, 0, 0, s * 0.65, false); return w; });
  return P;
}
function cottage(C, x, z, col) { // casa de playa sobre pilotes (típica de los Outer Banks)
  const h = new THREE.Group(); h.position.set(x, 0, z); C.add(h);
  for (const [px, pz] of [[-3, -2.6], [3, -2.6], [-3, 2.6], [3, 2.6], [0, -2.6], [0, 2.6]]) add(h, cyl(0.15, 0.15, 2.4, 6), M(0x7a6a58), px, 1.2, pz);
  add(h, box(6.6, 3, 5.6), M(col, { roughness: 0.85 }), 0, 3.9, 0);
  const rf = add(h, cone(5.2, 2.4, 4), M(0x5a6470, { roughness: 0.8 }), 0, 6.6, 0); rf.rotation.y = Math.PI / 4; rf.scale.set(1, 1, 0.85);
  add(h, box(6.8, 0.15, 2), M(0xeae4d8), 0, 2.45, -3.6); for (let k = -3; k <= 3; k++) add(h, box(0.08, 0.9, 0.08), M(0xffffff), k, 2.9, -4.55, false);
  for (const wx of [-1.8, 1.8]) add(h, box(1.1, 1.1, 0.05), M(0x223344, { metalness: 0.7, roughness: 0.1 }), wx, 4, -2.82, false);
  return h;
}
function wrightFlyer() { // réplica del Wright Flyer de 1903 (biplano de madera y tela)
  const F = new THREE.Group(), cloth = M(0xeee6cf, { roughness: 0.9, side: THREE.DoubleSide }), wood = M(0x8a6238);
  for (const y of [0, 1.8]) add(F, box(1.9, 0.05, 12.3), cloth, 0, y, 0);
  for (let k = -5; k <= 5; k += 2) for (const s of [-0.85, 0.85]) add(F, cyl(0.03, 0.03, 1.8, 5), wood, s, 0.9, k, false);
  for (const y of [0.4, 1.1]) add(F, box(0.7, 0.04, 2.6), cloth, 3.6, y, 0); add(F, box(3, 0.05, 0.05), wood, 2.2, 0.75, 0, false);
  for (const z of [-0.5, 0.5]) add(F, box(0.05, 1.5, 0.7), cloth, -3.2, 0.9, z); add(F, box(2.6, 0.05, 0.05), wood, -2, 0.9, 0, false);
  F.userData.props = [-1.6, 1.6].map(z => add(F, box(0.08, 2.4, 0.15), wood, -1.05, 0.9, z, false));
  const pilot = person({ h: 1.75, top: 0x2a2a2a, bottom: 0x2a2a2a, hairStyle: 'short' }); pilot.p.rotation.z = Math.PI / 2; pilot.p.position.set(0.9, 0.12, -0.5); pilot.p.scale.setScalar(0.9); F.add(pilot.p);
  return F;
}
function pirateShip() { // barco pirata con velas negras (inspirado en el Queen Anne's Revenge de Barba Negra)
  const S = new THREE.Group();
  const hs = new THREE.Shape(); hs.moveTo(-9, -2.6); hs.lineTo(6, -2.6); hs.quadraticCurveTo(10, -1.5, 11, 0); hs.quadraticCurveTo(10, 1.5, 6, 2.6); hs.lineTo(-9, 2.6); hs.lineTo(-9, -2.6);
  const hg = new THREE.ExtrudeGeometry(hs, { depth: 3.4, bevelEnabled: false }); hg.rotateX(-Math.PI / 2); add(S, hg, M(0x4a2e18, { roughness: 0.85 }), 0, -1.6, 0);
  add(S, box(4, 2.4, 5.2), M(0x3a2414), -7, 2.6, 0);
  const sail = M(0x1a1a1a, { roughness: 0.9, side: THREE.DoubleSide });
  for (const [mx, mh] of [[-3, 17], [3, 19], [8, 13]]) { add(S, cyl(0.25, 0.3, mh, 8), M(0x5a3a22), mx, mh / 2, 0); for (const y of [mh * 0.4, mh * 0.72]) add(S, keepPlane, sail, mx + 0.4, y, 0, false).scale.set(1, mh * 0.27, 7.5); }
  const flag = add(S, new THREE.PlaneGeometry(2.4, 1.5), temp(new THREE.MeshBasicMaterial({ map: canvasTex(128, 80, (c, w, h) => { c.fillStyle = '#111'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.beginPath(); c.arc(64, 34, 16, 0, 7); c.fill(); c.fillRect(54, 44, 20, 10); c.lineWidth = 6; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(36, 58); c.lineTo(92, 74); c.moveTo(92, 58); c.lineTo(36, 74); c.stroke(); c.fillStyle = '#111'; for (const ex of [58, 70]) { c.beginPath(); c.arc(ex, 32, 4, 0, 7); c.fill(); } }), side: THREE.DoubleSide })), 4.2, 19.6, 0, false);
  S.userData.flag = flag; return S;
}
const keepPlane = keep(new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2)); // vela: plano que mira a los lados del barco
const POSTALES = [ // vallas con lo más reconocido del resto del estado (se ven en la arena, a tu derecha)
  ['🏰', 'BILTMORE · ASHEVILLE', 'La casa privada más grande de EE. UU.', '#7a4a8a'],
  ['⛰️', 'MONTE MITCHELL', 'El pico más alto al este del río Misisipi', '#2f6f4a'],
  ['🏁', 'NASCAR · CHARLOTTE', 'Aquí está el Salón de la Fama de NASCAR', '#c8202a'],
  ['🍩', 'KRISPY KREME', 'Nació en Winston-Salem en 1937', '#1d7a3a'],
  ['🥤', 'PEPSI', 'Se inventó en New Bern en 1893', '#1d5fbf'],
  ['🏛️', 'RALEIGH', 'La capital de Carolina del Norte', '#5a5f6a'],
  ['🏀', 'DUKE vs. UNC', 'Gran rivalidad del baloncesto universitario', '#2a4ad4'],
  ['🌿', 'VENUS ATRAPAMOSCAS', 'Planta carnívora nativa de las Carolinas', '#3d8a2a'],
  ['🍠', 'BATATA', 'Carolina del Norte es el mayor productor de EE. UU.', '#c8642a'],
  ['🛣️', 'BLUE RIDGE PARKWAY', 'Carretera escénica por las montañas Apalaches', '#3b5fa6'],
  ['🔬', 'RESEARCH TRIANGLE', 'El parque de investigación más grande de EE. UU.', '#18a8c8']
];
function postcard(g, x, z, [em, title, txt, col]) {
  const B2 = new THREE.Group(); B2.position.set(x, 0, z); B2.rotation.y = Math.PI + 0.53; g.add(B2);
  for (const s of [-3, 3]) add(B2, cyl(0.15, 0.15, 3, 8), M(0x6a5a4a), s, 1.5, 0.1);
  add(B2, new THREE.PlaneGeometry(8, 5), temp(new THREE.MeshStandardMaterial({ map: canvasTex(512, 320, (c, w, h) => {
    c.fillStyle = col; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(14, 14, w - 28, h - 28);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '110px system-ui'; c.fillText(em, w / 2, 112);
    c.fillStyle = col; c.font = 'bold 40px system-ui'; c.fillText(title, w / 2, 210);
    c.fillStyle = '#222'; c.font = '25px system-ui'; c.fillText(txt, w / 2, 262);
  }), roughness: 0.7, side: THREE.DoubleSide })), 0, 5.4, 0, false);
  return B2;
}
function waterTour(ctx, opt) {
  const { camera, scene } = ctx, g = new THREE.Group(); ctx.root.add(g);
  const skyM = sky(0x1a72e0, 0xbfe9ff, 0xefe2c0); g.add(skyM);
  const restoreEnv = envFromSky(ctx, skyM);
  scene.fog = new THREE.Fog(0xd2ecff, 70, 240);
  const sun = lightRig(g, { sky: 0xcbe7ff, ground: 0xe8d3a0, hemi: 1.0, sun: 0xfff0d2, sunI: 2.8, dir: [-12, 24, -30], size: 28, target: [0, 0, -6] });
  const END = 1250, LANES = [-19, -15.5, -12], SPEED = { boat: 11, jet: 12.5 }; // 1250 m de costa: unos 2 minutos
  const ocean = waterMat(0x0d9fbf, { amp: SHORE.AMP });
  const oc = add(g, new THREE.PlaneGeometry(1700, 400, 340, 80), ocean, 600, SHORE.SEA_Y, -190, false); oc.rotation.x = -Math.PI / 2;
  const sandT = rep(canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#e8d2a2'; c.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(170,140,90,.25)' : 'rgba(255,250,235,.35)'; c.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } }), 200, 4);
  const sand = add(g, new THREE.PlaneGeometry(1700, 18.5), temp(new THREE.MeshStandardMaterial({ map: sandT, roughness: 1 })), 600, 0, -0.25, false); sand.rotation.x = -Math.PI / 2; sand.receiveShadow = true;
  const wet = shoreRamp(g, 600, 1700, -9.5); // el borde de la arena seca está en z = −9.5
  const foamM = temp(new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const foam = add(g, new THREE.PlaneGeometry(1700, 1.2), foamM, 600, 0, -10, false); foam.rotation.x = wet.rotation.x; // la espuma va pegada a la rampa
  const fS = SHORE.DROP / Math.hypot(SHORE.DROP, SHORE.RUN), fC = SHORE.RUN / Math.hypot(SHORE.DROP, SHORE.RUN);
  add(g, box(1700, 0.25, 3), M(0xd8cdb8, { roughness: 0.9 }), 600, 0.12, 10);
  add(g, box(1700, 0.06, 8), M(0x55565c, { roughness: 0.95 }), 600, 0.03, 15.5);
  add(g, box(1700, 0.25, 2.5), M(0xe9e0d6, { roughness: 0.9 }), 600, 0.12, 20.5);
  // escenario a la derecha (playa, dunas, casas sobre pilotes, faros y postales del estado) en tramos que se muestran cerca de ti
  const chunks = [], palms = [], towers = [], HCOL = [0xf3e6c8, 0xbfe0e6, 0xf6d6c8, 0xdfe8c8, 0xe6d8f0, 0xffffff];
  const animals = [], mixers = [], hitM = temp(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  const addA = (obj, sp, r) => { add(obj, sph(r / obj.scale.x, 8), hitM, 0, 0.5, 0, false).userData.sp = sp; animals.push(obj); return obj; };
  const dolphins = [], turtles = [], manatees = [], birds = [], horses = [];
  const duneM = M(0xe6cf9c, { roughness: 1 }), grassM = M(0x8a9a4a, { roughness: 1 });
  let bi = 0;
  for (let c0 = -60; c0 < END + 80; c0 += 120) {
    const C = new THREE.Group(); C.userData.cx = c0 + 60; g.add(C); chunks.push(C);
    for (let x = c0 + 4; x < c0 + 120; x += rnd(11, 15)) { cottage(C, x, rnd(28, 30), HCOL[bi % 6]); bi++; }
    for (let k = 0; k < 6; k++) { const d = add(C, sph(rnd(3, 5), 10), duneM, c0 + rnd(0, 120), -1.2, rnd(5, 8), false); d.scale.y = 0.45; for (let q = 0; q < 3; q++) add(C, cone(0.25, 0.8, 4), grassM, d.position.x + rnd(-2, 2), 0.8, d.position.z + rnd(-1, 1), false); }
    for (let k = 0; k < 6; k++) { const s = add(C, sph(rnd(1.6, 2.6), 8), M(0x3f6b34, { roughness: 1 }), c0 + rnd(0, 120), 1, rnd(37, 46), false); s.scale.y = 0.8; }
    towers.push(lifeguard(C, c0 + rnd(20, 100), -4, pick(['#ffffff', '#ffd23a', '#d4202a']), pick(['#d4202a', '#24d1ff', '#ffffff'])));
    for (let k = 0; k < 3; k++) { const x = c0 + rnd(5, 115), z = rnd(-6, 2); add(C, cyl(0.04, 0.04, 2.4, 6), M(0xffffff), x, 1.2, z); add(C, cone(1.6, 0.6, 16), stripedMat(pick(['#ff5a3a', '#24d1ff', '#ffd23a', '#1d5fbf']), '#ffffff', 16), x, 2.4, z); }
    if ((c0 / 120) % 2 === 0) { const px = c0 + rnd(30, 90); add(C, box(3, 0.3, 2.2), M(0x8a6a48, { roughness: 0.9 }), px, 0.5, -9.6); for (const s2 of [-1.3, 1.3]) add(C, cyl(0.15, 0.15, 2, 8), M(0x5a4030), px + s2, -0.3, -10.4); }
    for (let k = 0; k < 2; k++) { const t = addA(turtle(), '🐢', 1.8); t.scale.setScalar(1.5); t.position.set(c0 + rnd(10, 110), 0.02, rnd(-7, -3)); t.rotation.y = Math.PI; C.add(t); turtles.push(t); }
    for (let k = 0; k < 2; k++) { const h = addA(horse(), '🐴', 2.4); h.position.set(c0 + rnd(10, 110), 0, rnd(-2, 3)); h.userData.sp2 = rnd(0.5, 1.1); h.userData.ph = rnd(0, 6); C.add(h); horses.push(h); }
    for (let k = 0; k < 2; k++) { const d = addA(dolphin(), '🐬', 2.4); d.scale.setScalar(1.3); d.userData.x0 = c0 + rnd(10, 100); d.userData.z0 = k ? rnd(-31, -27) : rnd(-26, -23); d.userData.ph = rnd(0, 6); C.add(d); dolphins.push(d); }
    { const b = pelican(); addA(b, '🐦', 2.5); Object.assign(b.userData, { cx: c0 + rnd(20, 100), r: rnd(5, 9), h: rnd(5, 9), sp: rnd(0.4, 0.7), ph: rnd(0, 6) }); C.add(b); birds.push(b); }
  }
  POSTALES.forEach((P2, i) => postcard(g, 110 + i * 112, -1.5, P2));
  // lugares famosos de los Outer Banks, cerca de cada parada
  const lights = [lighthouse(g, 205, 34, 42, 'brick', 'Faro de Currituck'), lighthouse(g, 840, 36, 48, 'bands', 'Faro de Bodie Island'), lighthouse(g, 900, 30, 60, 'spiral', 'Faro del Cabo Hatteras'), lighthouse(g, 1130, 30, 24, 'white', 'Faro de Ocracoke')];
  const ridge = add(g, sph(28, 20), M(0xe8cf98, { roughness: 1 }), 440, -6, 52, false); ridge.scale.y = 0.62; // Kill Devil Hill con el monumento a los hermanos Wright
  const mon = new THREE.Group(); mon.position.set(440, 11, 52); g.add(mon);
  add(mon, box(4.5, 18, 2.6), M(0xd8d4cc, { roughness: 0.6 }), 0, 9, 0); add(mon, cone(2.6, 3, 4), M(0xd8d4cc, { roughness: 0.6 }), 0, 19.5, 0).rotation.y = Math.PI / 4;
  for (const s of [-1, 1]) add(mon, box(1.2, 3, 3.4), M(0xcfcac0), s * 2.5, 9, 0);
  const wlb = label('Monumento a los hermanos Wright', 4.5, '#ffffff', 'rgba(10,40,70,.85)'); wlb.position.y = 24; mon.add(wlb);
  const flyer = wrightFlyer(); flyer.scale.setScalar(1.2); g.add(flyer);
  const jr = []; for (const [dx, dz, r] of [[0, 0, 26], [-26, 8, 18], [24, 10, 16]]) { const d = add(g, sph(r, 18), M(0xf0d9a8, { roughness: 1 }), 665 + dx, -r * 0.35, 44 + dz, false); d.scale.y = 0.75; jr.push(d); } // dunas de Jockey's Ridge
  const jlb = label("Jockey's Ridge · duna gigante", 4, '#ffffff', 'rgba(10,40,70,.85)'); jlb.position.set(665, 24, 44); g.add(jlb);
  const gliders = [0, 1, 2].map(k => { const G3 = new THREE.Group(); g.add(G3); const w = add(G3, new THREE.ConeGeometry(3.2, 0.2, 3), M([0xff4fa3, 0xffd23a, 0x24d1ff][k], { side: THREE.DoubleSide }), 0, 0, 0, false); w.scale.set(1, 1, 0.5); const pp = person({ h: 1.7, top: 0x333333, bottom: 0x333333 }); pp.p.rotation.z = Math.PI / 2; pp.p.position.y = -1.2; pp.p.scale.setScalar(0.8); G3.add(pp.p); G3.userData.ph = k * 2.1; return G3; });
  const ship = pirateShip(); ship.position.set(1080, -0.6, -40); ship.rotation.y = -0.3; g.add(ship);
  const traffic = [[0xd4202a, 0, 13.6, 7], [0x24d1ff, 40, 13.6, 7], [0xffe14d, 20, 17.4, -6], [0x2a2f3e, 70, 17.4, -6]].map(a => car(g, ...a));
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
  const STOPS = [ // 5 paradas con pregunta sobre Carolina del Norte (+3 ⭐ si aciertas)
    { x: 230, name: 'Corolla', q: '¿De dónde vienen los caballos salvajes que corren libres por las playas de Corolla?', o: ['De caballos españoles traídos en los años 1500', 'De caballos de carreras que escaparon en 1990', 'De un zoológico cercano'], a: 0 },
    { x: 470, name: 'Kill Devil Hills', q: '¿Qué lograron aquí los hermanos Wright el 17 de diciembre de 1903?', o: ['El primer viaje en tren', 'El primer vuelo en avión con motor', 'El primer viaje en globo'], a: 1 },
    { x: 700, name: 'Nags Head', q: '¿Cuál es la capital de Carolina del Norte?', o: ['Charlotte', 'Raleigh', 'Asheville'], a: 1 },
    { x: 930, name: 'Cabo Hatteras', q: '¿Qué tiene de especial el faro del Cabo Hatteras, el de las rayas en espiral?', o: ['Es el faro de ladrillo más alto de EE. UU.', 'Es el faro más antiguo del mundo', 'Está en la cima de una montaña'], a: 0 },
    { x: 1160, name: 'Ocracoke', q: '¿Qué pirata famoso murió en una batalla en la isla de Ocracoke en 1718?', o: ['Francis Drake', 'Barba Negra', 'Henry Morgan'], a: 1 }
  ];
  const gate = (x, txt, col) => { const a = new THREE.Group(); a.position.set(x, 0, -15.5); g.add(a); for (const z of [-7.5, 7.5]) add(a, cyl(0.4, 0.5, 8, 12), M(col, { roughness: 0.4 }), 0, 3.5, z); add(a, box(0.5, 1.6, 15.6), M(col, { roughness: 0.4 }), 0, 7.6, 0); const sgn = add(a, new THREE.PlaneGeometry(14, 1.4), temp(new THREE.MeshStandardMaterial({ map: textTex(txt, 1024, 110, 'rgba(0,0,0,0)', '#ffffff', 'bold 70px system-ui'), transparent: true, emissive: 0x333333, side: THREE.DoubleSide })), -0.3, 7.6, 0, false); sgn.rotation.y = -Math.PI / 2; return a; };
  STOPS.forEach((S2, i) => gate(S2.x, `📍 PARADA ${i + 1} · ${S2.name.toUpperCase()}`, 0xff7a1a));
  gate(END, '🏁 META · PUERTO DE OCRACOKE', 0x1d6fd8);
  for (let k = 0; k < 4; k++) { const b = boatModel(); b.scale.setScalar(0.8); b.position.set(END + 12 + k * 7, -0.3, -12 + (k % 2) * 3); b.rotation.y = 0.3; g.add(b); }
  // vehículo del jugador
  const VEH = { boat: { g: boatModel(), eye: 2.35, cam: 0.6 }, jet: { g: jetModel(), eye: 1.75, cam: -0.45 } };
  VEH.boat.g.visible = VEH.jet.g.visible = false; g.add(VEH.boat.g, VEH.jet.g);
  let veh = null, running = false, alive = true, x = 0, lane = 1, z = LANES[1], hearts = 3, stars = 0, photos = new Set(), inv = 0, stopI = 0, phase = 'drive', infoT = 0, eng = null, waveT = 0;
  const FACT = { '🐢': 'Tortuga boba (caguama): cada verano pone sus huevos en las playas de los Outer Banks.', '🐬': 'Delfín nariz de botella: se ve con frecuencia frente a la costa de Carolina del Norte.', '🐴': 'Caballo salvaje de Corolla: desciende de caballos españoles traídos en los años 1500.', '🐦': 'Pelícano pardo: pesca lanzándose en picada al mar.' };
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
    if (opt.xr) { // 🥽 te subes al vehículo (fundido corto) y aparecen los botones de carril a tu derecha
      if (dock) dock.visible = false; ctx.xr().ride(x + VEH[k].cam, z, XW.FLOOR[k], true); lean0 = null;
      xLeg = ctx.xr().legend([{ k: -1, label: '◀ Izquierda', c: '#24d1ff' }, { k: 1, label: '▶ Derecha', c: '#24d1ff' }], d => { if (canShoot()) setLane(lane + d); });
    }
    const ac = ctx.audio && ctx.audio();
    if (ac) { const o = ac.createOscillator(), f = ac.createBiquadFilter(), gn = ac.createGain(); o.type = 'sawtooth'; o.frequency.value = 60; f.type = 'lowpass'; f.frequency.value = 450; gn.gain.value = 0.03; o.connect(f).connect(gn).connect(ac.destination); o.start(); eng = { o, gn }; }
  }
  function ask() {
    const S2 = STOPS[stopI]; phase = 'quiz'; if (eng) eng.gn.gain.value = 0.008;
    ctx.card(`❓ Parada ${stopI + 1} de ${STOPS.length} · ${S2.name}`, `<p>${S2.q}</p>`, S2.o.map((o, i) => ({ label: o, fn: () => {
      if (i === S2.a) { stars += 3; ctx.sfx('pickup'); ctx.toast('✅ ¡Correcto! +3 ⭐', 2200); } else { ctx.sfx('hurt'); ctx.toast(`❌ Era: ${S2.o[S2.a]}`, 2600); }
      stopI++; phase = 'drive'; info(); if (eng) eng.gn.gain.value = 0.03;
    } })));
  }
  function photo(a) {
    const sp = a.children.find(o => o.material === hitM)?.userData.sp || a.userData.sp; if (!sp) return;
    ctx.sfx('shutter');
    if (opt.xr) ctx.xr().flash('white'); else { const f = document.getElementById('fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 90); }
    if (photos.has(sp)) { ctx.toast('📸 Ya tienes esa foto', 1200); return; }
    photos.add(sp); stars += 2; info(); ctx.burst(a.getWorldPosition(_v), [0xffffff, 0xffd700], 30, 1.5); ctx.toast(`📸 ${FACT[sp]} (+2 ⭐)`, 4500);
  }
  const pickA = p => { const h = p.ray.intersectObjects(animals.filter(a => a.parent && a.parent.visible), true).find(o => o.object.material === hitM); return h ? h.object.parent : null; };
  const seat = new V3(), seatPos = () => { const V = VEH[veh || 'boat']; return seat.set(x + V.cam, V.eye + Math.sin(performance.now() / 600) * 0.06, z); };
  const refreshHint = () => ctx.hint(!running ? '' : opt.xr ? '↔️ Inclínate a un lado (o usa ◀ ▶ a tu derecha) para cambiar de carril · recoge ⭐ · esquiva las boyas · apunta a un animal y junta los dedos 📸'
    : (ctx.isHand() ? '☝️ Mueve el índice a la izquierda, al centro o a la derecha para cambiar de carril' : '◀ ▶ o desliza para cambiar de carril') + ' · recoge ⭐ · esquiva las boyas · toca animales para fotos 📸');

  // ===== 🥽 Quest: vas de pie en el vehículo; te inclinas para cambiar de carril; apuntas a un animal y juntas los dedos para la foto =====
  // SPEED: velocidad en el visor (1 = la del celular) · LANE_K: rapidez del cambio de carril · ROCK: cuánto se mece el vehículo (1 = como en el celular)
  // LEAN: cuánto inclinarte (m) para cambiar de carril (0 = apagado) · LEAN_BACK: cuánto volver al centro (m) para poder inclinarte otra vez · FLOOR: altura (m) del piso donde vas de pie
  const XW = { SPEED: 0.8, LANE_K: 8, ROCK: 0.3, LEAN: 0.15, LEAN_BACK: 0.06, FLOOR: { boat: 0.57, jet: 0.4 } };
  let xLeg = null, lean0 = null, leanOn = true, leanT = 0, stickOn = true;
  const _ro = new V3(), _rd = new V3(), _rq = new THREE.Quaternion(), _ws = new V3(), xRc = new THREE.Raycaster();
  const aHits = animals.map(a => a.children.find(o => o.material === hitM));
  const dock = opt.xr ? add(g, box(2.2, 0.3, 2.2), M(0x8a6a48, { roughness: 0.9 }), VEH.boat.cam, -0.15, LANES[1]) : null; // muelle donde esperas antes de subir
  const finder = new THREE.Group(); finder.visible = false; g.add(finder); // 📸 marco sobre el animal que apuntas
  const finderM = temp(new THREE.MeshBasicMaterial({ color: 0xffd23a, depthTest: false, transparent: true }));
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (const [w, h, px, py] of [[0.35, 0.06, sx * 0.82, sy], [0.06, 0.35, sx, sy * 0.82]]) add(finder, new THREE.PlaneGeometry(w, h), finderM, px, py, 0, false).renderOrder = 60;
  const canShoot = () => running && phase === 'drive';
  function xrAimA(inp) { // ¿a qué animal apunta tu mano? → { a, h, d } (d = distancia en m)
    if (!inp || !inp.src || !inp.ok) return null;
    inp.ctl.getWorldPosition(_ro); _rd.set(0, 0, -1).applyQuaternion(inp.ctl.getWorldQuaternion(_rq)); xRc.set(_ro, _rd);
    const hit = xRc.intersectObjects(aHits.filter(m => m.parent.parent && m.parent.parent.visible), false)[0];
    return hit ? { a: hit.object.parent, h: hit.object, d: hit.distance } : null;
  }
  function xrFinder() { // el marco aparece sobre el animal que apuntas (amarillo = foto nueva, gris = ya la tienes)
    let best = null; if (canShoot()) for (const inp of ctx.xr().inputs) { const r = xrAimA(inp); if (r && (!best || r.d < best.d)) best = r; }
    finder.visible = !!best; if (!best) return;
    best.h.getWorldPosition(finder.position); finder.scale.setScalar(best.h.geometry.parameters.radius * best.h.getWorldScale(_ws).x * 0.5); // la zona para apuntar es más grande que el animal
    finder.lookAt(camera.getWorldPosition(_ro)); finderM.color.set(photos.has(best.h.userData.sp) ? 0x9aa3b8 : 0xffd23a);
  }
  function xrInput(type, inp) { // pinza (o gatillo) apuntando a un animal = foto
    if (!opt.xr || type !== 'selectstart' || !canShoot()) return;
    const r = xrAimA(inp); if (r) { photo(r.a); ctx.xr().haptic(0.6, 50, inp); }
  }
  function xrSteer(dt) { // inclinarte hacia un lado (o la palanca del control) cambia de carril · va DESPUÉS de mover el vehículo
    camera.getWorldPosition(_ro); _rd.set(0, 0, -1).applyQuaternion(camera.getWorldQuaternion(_rq)); _rd.y = 0;
    if (_rd.lengthSq() > 1e-4) _ro.addScaledVector(_rd.normalize(), -0.09); // de los ojos al cuello: girar la cabeza para mirar la playa no cuenta como inclinarse
    const s = _ro.z - z; if (lean0 === null) lean0 = s; // a tu derecha es +z
    const d = s - lean0;
    if (leanOn) { lean0 += (s - lean0) * Math.min(1, dt / 3); leanT = 0; } // si das un paso, tu centro se acomoda despacio
    else if ((leanT += dt) > 4) { lean0 = s; leanOn = true; } // si te quedas inclinado mucho rato, esa pasa a ser tu postura
    if (XW.LEAN && canShoot()) {
      if (leanOn && Math.abs(d) > XW.LEAN) { leanOn = false; setLane(lane + Math.sign(d)); }
      else if (!leanOn && Math.abs(d) < XW.LEAN_BACK) leanOn = true;
    }
    let ax = 0; for (const inp of ctx.xr().inputs) { const gp = inp.src && !inp.src.hand && inp.src.gamepad; if (gp && gp.axes.length > 2 && Math.abs(gp.axes[2]) > Math.abs(ax)) ax = gp.axes[2]; }
    if (stickOn && Math.abs(ax) > 0.6 && canShoot()) { stickOn = false; setLane(lane + Math.sign(ax)); } else if (Math.abs(ax) < 0.3) stickOn = true;
  }
  if (opt.xr) ctx.teleport(VEH.boat.cam, LANES[1], 100, LANES[1]); // 🥽 esperas en el muelle, mirando hacia donde vas

  const intro = withIntro(ctx, opt, [{ t: 0, p: [-40, 26, -60], yaw: -2.4, pitch: -0.35 }, { t: 3.5, p: [-8, 6, -26], yaw: -1.9, pitch: -0.15 }, { t: 5, p: [0.6, 2.35, LANES[1]], yaw: -Math.PI / 2 - 0.25, pitch: -0.05 }], -Math.PI / 2 - 0.25, -0.05);
  let sx = 0, sy = 0;
  return {
    camLock: !opt.quick, dwellTime: 0.45, refreshHint, xrInput, xrRays: () => opt.xr && canShoot(),
    xrRayLen: inp => { const r = canShoot() && xrAimA(inp); return r ? r.d : 0; },
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
        x += SPEED[veh] * (opt.xr ? XW.SPEED : 1) * dt; inv = Math.max(0, inv - dt);
        if (stopI < STOPS.length && x >= STOPS[stopI].x) { x = STOPS[stopI].x; ask(); }
        if (x >= END) { x = END; running = false; bar.classList.add('hidden'); if (eng) eng.gn.gain.value = 0.0001;
          for (let k = 0; k < 6; k++) setTimeout(() => ctx.burst(_v.set(END + rnd(-5, 15), rnd(8, 14), rnd(-25, -10)), [0xff4fa3, 0xffd23a, 0x24d1ff, 0xffffff], 60, 4), k * 250);
          ctx.sfx('crowd'); setTimeout(() => ctx.win('miami'), 1500); }
      }
      z = lerp(z, LANES[lane], Math.min(1, dt * (opt.xr ? XW.LANE_K : 6)));
      if (!intro.on && !opt.xr) camera.position.copy(seatPos());
      if (veh) { const G2 = VEH[veh].g, rk = opt.xr ? XW.ROCK : 1; G2.position.set(x, -0.15 + Math.sin(t * 1.7) * 0.06 * rk, z); G2.rotation.set(Math.sin(t * 1.1) * 0.03 * rk, (LANES[lane] - z) * -0.06, Math.sin(t * 1.3) * 0.025 * rk);
        if (opt.xr) { ctx.xr().ride(x + VEH[veh].cam, z, XW.FLOOR[veh]); xrSteer(dt); } // 🥽 el vehículo te lleva (tu vista no se mece)
        if (running && phase === 'drive' && Math.random() < 0.9) { const back = veh === 'jet' ? 1.6 : 3.3; ctx.burst(_w.set(x - back, 0.1, z + rnd(-0.5, 0.5)), [0xffffff, 0xd8f4ff], 2, 1.4, 4); } }
      for (const it of items) {
        if (!it.o.visible || Math.abs(it.x - x) > 60) continue;
        if (it.type === 'star') it.o.rotation.y += dt * 3; else it.o.position.y = -0.3 + Math.sin(t * 1.5 + it.ph) * 0.1;
        if (running && Math.abs(it.x - x) < 2 && Math.abs(LANES[it.L] - z) < 2.2) {
          if (it.type === 'star') { it.o.visible = false; stars++; ctx.sfx('pickup'); ctx.burst(it.o.position, [0xffd700, 0xffffff], 20, 1.6); info(); }
          else if (!inv) { inv = 1.2; hearts--; ctx.sfx('hurt'); ctx.flash(); if (navigator.vibrate) navigator.vibrate(80); if (opt.xr) ctx.xr().haptic(1, 120); ctx.burst(it.o.position, [0xffffff, 0xbfefff], 30, 2.5, 5); info();
            if (hearts <= 0) { running = false; bar.classList.add('hidden'); if (eng) eng.gn.gain.value = 0.0001; ctx.lose(opt.xr ? 'Chocaste 3 veces con las boyas. Cuando veas una boya roja o verde adelante, inclínate hacia un lado (o usa ◀ ▶) para cambiar de carril.' : 'Chocaste 3 veces con las boyas. Cambia de carril con ◀ ▶ (o deslizando) cuando veas una boya roja o verde adelante.'); } }
        }
      }
      chunks.forEach(C => (C.visible = Math.abs(C.userData.cx - x) < 200));
      skyM.position.x = x; sun.position.set(x - 12, 24, -36); sun.target.position.set(x + 10, 0, -6);
      const fd = 1 + Math.sin(t * 0.8) * 0.35; foam.position.set(600, -fd * fS + 0.03, -9.5 - fd * fC); foamM.opacity = 0.45 + Math.sin(t * 0.8 + 1) * 0.3;
      waveT -= dt; if (waveT <= 0) { waveT = 3.2; ctx.sfx('waves'); }
      traffic.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x < x - 80) c.position.x += 200; if (c.position.x > x + 120) c.position.x -= 200; });
      palms.forEach(p => { if (p.parent.visible) p.userData.crown.rotation.z = Math.sin(t * 0.9 + p.userData.ph) * 0.05; });
      towers.forEach((tw, i) => { if (tw.parent.visible) tw.userData.flag.rotation.y = Math.sin(t * 4 + i) * 0.4; });
      turtles.forEach(tt => { if (!tt.parent.visible) return; tt.position.z -= dt * 0.1; if (tt.position.z < -8) tt.position.z = -3; tt.userData.fl.forEach((f, k) => (f.rotation.y = Math.sin(t * 2 + k) * 0.4)); });
      horses.forEach(h => { if (!h.parent.visible) return; const u = h.userData; h.position.x += u.sp2 * dt; if (h.position.x > h.parent.userData.cx + 60) h.position.x -= 120; u.legs.forEach(l => (l.rotation.z = Math.sin(t * 5 * u.sp2 + u.ph + l.userData.ph) * 0.35)); });
      if (Math.abs(x - 440) < 220) { const a = t * 0.25; flyer.visible = true; flyer.position.set(440 + Math.cos(a) * 34, 13 + Math.sin(t * 0.8) * 1.5, -6 + Math.sin(a) * 18); flyer.rotation.set(0, Math.atan2(-Math.cos(a) * 18, -Math.sin(a) * 34), Math.sin(a) * 0.15); flyer.userData.props.forEach(pr => (pr.rotation.x += dt * 25)); } else flyer.visible = false;
      gliders.forEach(G3 => { const a = t * 0.18 + G3.userData.ph; G3.position.set(665 + Math.cos(a) * 30, 30 + Math.sin(a * 2) * 3, 30 + Math.sin(a) * 16); G3.rotation.y = -a; });
      lights.forEach((L, i) => (L.userData.beam.material.opacity = 0.45 + 0.45 * Math.max(0, Math.sin(t * 1.6 + i))));
      ship.position.y = -0.6 + Math.sin(t * 0.9) * 0.25; ship.rotation.z = Math.sin(t * 0.7) * 0.04; ship.userData.flag.rotation.y = Math.sin(t * 3) * 0.3;
      dolphins.forEach(d => { if (!d.parent.visible) return; const u = d.userData, c = (t * 0.33 + u.ph) % 1; d.position.set(u.x0 + c * 12, -0.6 + Math.sin(c * Math.PI) * 2.4 - (c > 0.95 ? 2 : 0), u.z0); d.rotation.x = -Math.cos(c * Math.PI) * 0.9; d.rotation.y = Math.PI / 2; });
      birds.forEach(b => { if (!b.parent.visible) return; const u = b.userData, a = t * u.sp + u.ph; b.position.set(u.cx + Math.cos(a) * u.r, u.h, -2 + Math.sin(a) * u.r); b.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); u.w.forEach((w, k) => (w.rotation.x = (k ? 1 : -1) * Math.sin(t * 6 + u.ph) * 0.5)); });
      if (running) { infoT += dt; if (infoT > 0.5) { infoT = 0; info(); } }
      if (opt.xr) xrFinder();
    },
    dispose() { alive = false; running = false; restoreEnv(); if (xLeg) xLeg.dispose(); bar.remove(); document.body.classList.remove('hasbar'); removeEventListener('keydown', kd); if (eng) { try { eng.o.stop(); } catch (e) {} } }
  };
}

/* ---------- iconos de portal y catálogo ---------- */
export const GAMES2 = {
  miami: {
    short: 'Outer Banks', title: '🚤 Outer Banks — Tour en lancha', pix: 'OUTER BANKS', tag: 'COSTA · FAROS · 5 PARADAS', winMsg: '¡Completaste el tour por los Outer Banks!', create: waterTour,
    how: h => 'Recorres en lancha los <b>Outer Banks</b>, las islas de la costa de Carolina del Norte. <b>A tu derecha</b> verás la playa, las casas sobre pilotes, los <b>caballos salvajes</b>, el monumento a los <b>hermanos Wright</b>, las dunas de Jockey\'s Ridge, los faros de <b>Currituck, Bodie Island, Cabo Hatteras y Ocracoke</b>, y vallas con lo más famoso del resto del estado. A tu izquierda, en el mar, aparece el barco de <b>Barba Negra</b> 🏴‍☠️.<br>🚤 El vehículo avanza solo. Tú solo eliges el <b>carril</b>: ' + (h ? 'mueve tu índice a la izquierda, al centro o a la derecha' : 'botones <b>◀ ▶</b> o desliza el dedo') + '.<br>⭐ Recoge estrellas · 🔴🟢 esquiva las boyas (tienes 3 ❤️) · 📸 toca los animales para fotografiarlos (🐴 🐬 🐢 🐦).<br>❓ En 5 paradas respondes una pregunta sobre Carolina del Norte. ¡Llega a Ocracoke!',
    fact: 'Las placas de los carros de Carolina del Norte dicen «First in Flight» (primeros en volar), porque el primer vuelo en avión con motor de la historia fue en Kill Devil Hills, en los Outer Banks, el 17 de diciembre de 1903.'
  },
  heroes: {
    short: 'Research Triangle', title: '🤖 Research Triangle — Drones fuera de control', pix: 'DRONES RTP', tag: 'RALEIGH-DURHAM · OLEADAS Y JEFE', winMsg: '¡Salvaste el laboratorio del Research Triangle!', create: heroes,
    icon() { const i = new THREE.Group(); const m = weaponModel(2); m.scale.setScalar(0.42); i.add(m); return i; },
    how: h => '🚨 ¡Los drones de prueba de un laboratorio del Research Triangle Park se salieron de control!<ol class="steps"><li><b>Elige tu arma</b> con los botones de abajo.</li><li>Llegan en <b>3 oleadas</b> (1, 2 y 2 drones) y al final el <b>👾 JEFE</b>. Ataca con el botón grande ' + (h ? '(o haz pinza)' : '(o toca el dron)') + '; el <b>aro rojo</b> marca a cuál le das.</li><li>Cuando un dron <b>brille en rojo</b> te va a disparar: cuando venga la bola, mantén <b>🛡️ CUBRIRSE</b>' + (h ? ' (o muestra la palma ✋)' : '') + '. Tienes 3 ❤️.</li></ol><b>Derriba los 5 drones y al jefe.</b>',
    fact: 'El Research Triangle Park, entre Raleigh, Durham y Chapel Hill, es el parque de investigación más grande de Estados Unidos: unas 2.800 hectáreas con cientos de empresas de tecnología y ciencia. Se creó en 1959.'
  },
  city: {
    short: 'Charlotte', title: '🏙️ Charlotte — Exploración urbana', pix: 'CHARLOTTE', tag: 'UPTOWN · 60 SEGUNDOS', countdown: true, winMsg: '¡Has explorado la Ciudad Reina!', create: city,
    icon() { const i = new THREE.Group(); add(i, box(0.16, 0.26, 0.1), M(0xffc2d1), 0, 0, 0, false); add(i, box(0.03, 0.32, 0.03), M(0x24d1ff, { emissive: 0x24d1ff }), 0, 0.02, 0.06, false); return i; },
    how: h => 'Estás en <b>Uptown Charlotte</b>, el centro de la ciudad más grande de Carolina del Norte. Gira el celular (o arrastra) para mirar: el parque, los rascacielos, el tren ligero y el Salón de la Fama de NASCAR. Encuentra 5 íconos del estado en <b>60 segundos</b>: 🏁 bandera de NASCAR · 🍩 dona (Krispy Kreme) · 🥤 refresco (Pepsi) · 🏀 balón · 👑 corona de la «Ciudad Reina». Sigue la flecha amarilla y los haces de luz. ' + (h ? 'Deja tu <b>índice</b> quieto sobre cada objeto.' : '<b>Toca</b> cada objeto.'),
    fact: 'A Charlotte la llaman «Queen City» (la Ciudad Reina) en honor a la reina Carlota, esposa del rey Jorge III de Inglaterra. Es la ciudad más grande del estado y allí está el Salón de la Fama de NASCAR.'
  },
  fg: {
    short: 'Panthers NFL', title: '🏈 Carolina Panthers — Gol de campo', pix: 'PANTHERS NFL', tag: 'FÚTBOL AMERICANO · 3 GOLES', countdown: true, winMsg: '¡Eres el pateador estrella de los Panthers!', create: fg, foot: true,
    icon() { const i = new THREE.Group(); const b = fbBall(); b.scale.setScalar(1); i.add(b); return i; },
    how: h => 'Eres el pateador. Patea el balón para que pase <b>entre los postes amarillos y por encima del travesaño</b>. <b>¡Ojo!</b> En cada ronda unos jugadores <b>empujan los postes</b> a la izquierda o a la derecha: espera a que paren y patea hacia su lado. Cada gol te aleja más (20, 30 y 40 yardas). <b>Consigue 3 goles de campo.</b> Patea con tu pie (el celular apuntando a tus zapatos) ' + (h ? 'o mueve tu <b>índice rápido hacia arriba</b>.' : 'o desliza el dedo.'),
    fact: 'Los Carolina Panthers juegan en la NFL desde 1995 y su casa es el Bank of America Stadium, en Charlotte, con unos 75.000 asientos.'
  },
  penalty: {
    short: 'Charlotte FC', title: '⚽ Charlotte FC — Penales MLS', pix: 'CHARLOTTE FC', tag: 'FÚTBOL · 5 TIROS', countdown: true, winMsg: '¡Ganaste la tanda de penales!', create: penalty, foot: true,
    icon() { const i = new THREE.Group(); i.add(modelo('balon-futbol', { fallback: () => new THREE.Mesh(sph(0.11, 24), soccerBallMat()), onLoad: o => o.scale.setScalar(0.11) })); return i; },
    how: h => 'Tienes <b>5 penales</b> y el portero cambia: <b>🐢 lento</b>, <b>🎲 adivinador</b> (se inclina hacia el lado que eligió) y <b>🐆 felino</b>. Una esquina del arco brilla: <b>el gol ahí vale doble (x2)</b>. <b>Marca al menos 3 goles.</b> Patea con tu pie (el celular apuntando a tus zapatos) ' + (h ?'o mueve tu <b>índice rápido hacia arriba</b> (inclinado a un lado para apuntar).' : 'o desliza el dedo (la inclinación apunta, la velocidad es la fuerza).'),
    fact: 'El Charlotte FC juega en la MLS desde 2022, comparte el Bank of America Stadium con los Panthers y sus colores son azul Carolina, negro, plata y blanco.'
  }
};
