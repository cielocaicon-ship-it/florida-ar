// CAROLINA AR ADVENTURE — modelos 3D propios (carpeta assets/modelos, archivos FBX exportados desde Blender).
// Cada archivo se carga UNA sola vez al abrir la página, se ajusta (orientación, tamaño y materiales) y después
// las escenas usan copias. Los FBX no traen las imágenes de textura adentro (solo la ruta del computador donde se
// hicieron), así que los materiales se crean aquí: colores del propio modelo y texturas dibujadas por código.
import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

/* ===================== AJUSTES FÁCILES ===================== */
export const AJUSTES = {
  // El aro del tablero de tu modelo mide unos 94 cm de diámetro (uno real mide 46 cm).
  // true = el aro se reduce al tamaño real para que el balón y la física cuadren (recomendado).
  // false = se deja exactamente como en tu modelo (encestar se vuelve mucho más fácil).
  aroReglamentario: true
};
// Si encuentras las imágenes originales de TUS texturas, cópialas a assets/modelos/texturas/ y escribe aquí
// el nombre del material (como se llama en Blender) y el de la imagen. Ejemplo:
//   'tablero-basket.fbx': { 'Material.008': 'tablero.png' },
const TEXTURAS = {
};

/* ===================== Cargador ===================== */
const DIR = 'assets/modelos/';
const V3 = THREE.Vector3;
// Las texturas que pide el FBX no existen en el servidor: se reemplazan por un píxel para no generar errores.
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
const manager = new THREE.LoadingManager();
manager.setURLModifier(url => (/\.fbx(\?|$)/i.test(url) || /^(data|blob):/.test(url) ? url : PIXEL));
const loader = new FBXLoader(manager);

const std = o => new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, ...o });
const lin = (r, g, b) => new THREE.Color().setRGB(r, g, b); // colores tal como están en Blender (lineales)
function tex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData.keep = true;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/* ---- utilidades de geometría (todo se hace una vez, al cargar) ---- */
function bake(root) { // aplica la posición/rotación/escala del FBX a la geometría y pasa de centímetros a metros
  root.updateMatrixWorld(true);
  const parts = [], cm = new THREE.Matrix4().makeScale(0.01, 0.01, 0.01);
  root.traverse(o => {
    if (!o.isMesh) return;
    const geo = o.geometry.clone(); geo.applyMatrix4(o.matrixWorld); geo.applyMatrix4(cm);
    parts.push({ name: o.name, geo, mats: (Array.isArray(o.material) ? o.material : [o.material]).map(m => m.name) });
  });
  return parts;
}
const _m4 = new THREE.Matrix4();
const rotate = (parts, ax, deg) => parts.forEach(p => p.geo.applyMatrix4(_m4['makeRotation' + ax](deg * Math.PI / 180)));
const scale = (parts, x, y = x, z = x) => parts.forEach(p => p.geo.scale(x, y, z));
const move = (parts, x, y, z) => parts.forEach(p => p.geo.translate(x, y, z));
function ranges(p, mat) { // tramos de vértices que usan un material (o todos)
  const n = p.geo.attributes.position.count;
  if (mat == null) return [[0, n]];
  if (!p.geo.groups.length) return p.mats[0] === mat ? [[0, n]] : [];
  return p.geo.groups.filter(g => p.mats[g.materialIndex] === mat).map(g => [g.start, Math.min(n, g.start + g.count)]);
}
function eachV(parts, mat, fn) { // recorre vértices; si fn devuelve true, guarda el vértice modificado
  const v = new V3();
  for (const p of parts) {
    const pos = p.geo.attributes.position;
    for (const [a, b] of ranges(p, mat)) for (let i = a; i < b; i++) { v.fromBufferAttribute(pos, i); if (fn(v, i, p) === true) pos.setXYZ(i, v.x, v.y, v.z); }
    pos.needsUpdate = true;
  }
}
function bbox(parts, mat = null, filter = null) { const b = new THREE.Box3(); eachV(parts, mat, v => { if (!filter || filter(v)) b.expandByPoint(v); }); return b; }
function place(parts, how = {}, b = bbox(parts)) { // 'c' = centrar, 'min' = apoyar el mínimo en 0
  const c = b.getCenter(new V3()), off = k => (how[k] || 'c') === 'c' ? -c[k] : how[k] === 'min' ? -b.min[k] : how[k] === 'max' ? -b.max[k] : 0;
  move(parts, off('x'), off('y'), off('z'));
}
function boxUVs(parts, mat, cell) { // coordenadas de textura por proyección (la red del arco no traía UV)
  const a = new V3(), b = new V3(), c = new V3(), n = new V3(), e = new V3();
  for (const p of parts) {
    const pos = p.geo.attributes.position;
    let uv = p.geo.attributes.uv;
    if (!uv) { uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2); p.geo.setAttribute('uv', uv); }
    for (const [s, f] of ranges(p, mat)) for (let i = s; i + 2 < f; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      n.subVectors(b, a).cross(e.subVectors(c, a));
      const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
      [a, b, c].forEach((q, k) => { const [u, w] = ax >= ay && ax >= az ? [q.z, q.y] : ay >= az ? [q.x, q.z] : [q.x, q.y]; uv.setXY(i + k, u / cell, w / cell); });
    }
    uv.needsUpdate = true;
  }
}
function soccerMat() { // balón clásico: 12 pentágonos oscuros y 20 hexágonos blancos, calculado píxel a píxel (nítido)
  const t = (1 + Math.sqrt(5)) / 2;
  const P = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(a => new V3(...a).normalize());
  const H = []; // centros de los hexágonos = centros de las caras del icosaedro
  for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++)
    if (P[i].dot(P[j]) > 0.4 && P[i].dot(P[k]) > 0.4 && P[j].dot(P[k]) > 0.4) H.push(P[i].clone().add(P[j]).add(P[k]).normalize());
  const m = std({ color: 0xffffff, roughness: 0.42 });
  m.onBeforeCompile = sh => {
    sh.uniforms.uP = { value: P }; sh.uniforms.uH = { value: H };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP; uniform vec3 uP[12]; uniform vec3 uH[20];')
      .replace('#include <color_fragment>', `#include <color_fragment>
        { vec3 n = normalize(vOP); float a = -2.0, b = -2.0;
          for (int i = 0; i < 12; i++) a = max(a, dot(n, uP[i]));
          for (int i = 0; i < 20; i++) b = max(b, dot(n, uH[i]));
          float e = a - 1.0266 * b; // > 0 dentro de un pentágono (proyección del icosaedro truncado)
          diffuseColor.rgb *= mix(vec3(0.93), vec3(0.025), smoothstep(-0.003, 0.003, e)); }`);
  };
  return m;
}
function splitNet(parts, minAlt = 0.3) { // separa los paneles anchos (red) de los tubos (marco), sin importar el material
  const out = [], a = new V3(), b = new V3(), c = new V3(), e1 = new V3(), e2 = new V3();
  for (const p of parts) {
    const src = p.geo, pos = src.attributes.position, lists = { marco: [], red: [] };
    for (let i = 0; i + 2 < pos.count; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
      const L = Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a)) || 1;
      const alt = e1.subVectors(b, a).cross(e2.subVectors(c, a)).length() / L; // altura mínima del triángulo
      lists[alt > minAlt ? 'red' : 'marco'].push(i);
    }
    for (const [k, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const g = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(src.attributes)) {
        const n = attr.itemSize, arr = new Float32Array(list.length * 3 * n);
        list.forEach((s, j) => { for (let q = 0; q < 3 * n; q++) arr[j * 3 * n + q] = attr.array[s * n + q]; });
        g.setAttribute(name, new THREE.BufferAttribute(arr, n));
      }
      out.push({ name: p.name + '-' + k, geo: g, mats: [k] });
    }
  }
  return out;
}
function plantilla(parts, mats, info = {}, extra = []) { // grupo listo para clonar (geometrías y materiales compartidos)
  const g = new THREE.Group(), fallback = std({ color: 0xcccccc });
  for (const p of parts) {
    p.geo.userData.keep = true; p.geo.computeBoundingBox(); p.geo.computeBoundingSphere();
    let ms = p.mats.map(n => mats[n] || mats['*'] || fallback);
    if (ms.length > 1 && !p.geo.groups.length) ms = [ms[0]];
    const m = new THREE.Mesh(p.geo, ms.length > 1 ? ms : ms[0]); m.name = p.name; m.castShadow = m.receiveShadow = true; g.add(m);
  }
  extra.forEach(m => { m.geometry.userData.keep = true; m.castShadow = true; g.add(m); });
  g.userData.info = info; g.mats = mats; // (mats fuera de userData: así no se copia en cada clon)
  return g;
}

/* ===================== Texturas dibujadas por código ===================== */
function basketTex() { // balón naranja granulado con costuras (mapa esférico)
  return tex(1024, 512, (g, w, h) => {
    g.fillStyle = '#c8581f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(90,30,5,.18)' : 'rgba(255,170,110,.12)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.strokeStyle = '#1b0d05'; g.lineWidth = 9;
    g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    for (const x of [w / 4, w * 3 / 4]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (const cx of [0, w / 2, w]) { g.beginPath(); g.ellipse(cx, h / 2, w / 9, h / 2, 0, 0, 7); g.stroke(); }
  });
}
function footballTex(u0) { // cuero marrón, franjas blancas cerca de las puntas y cordones en el meridiano de arriba
  return tex(1024, 512, (g, w, h) => {
    g.fillStyle = '#6b3410'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16000; i++) { g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.16)' : 'rgba(255,190,140,.08)'; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    g.fillStyle = '#f4f1ea'; for (const v of [0.2, 0.8]) g.fillRect(0, (1 - v) * h - 9, w, 18);
    const x0 = u0 * w;
    for (const dx of [-w, 0, w]) { // se dibuja también desplazado por si cae sobre la costura del mapa
      const x = x0 + dx; g.fillStyle = '#f4f1ea';
      g.fillRect(x - 3, 0.36 * h, 6, 0.28 * h);
      for (let k = 0; k < 8; k++) g.fillRect(x - 16, 0.37 * h + k * 0.035 * h, 32, 6);
    }
  });
}
function surfTex() { // tabla original: base crema, franja central rosada, puntas turquesa y un sol
  return tex(512, 1024, (g, w, h) => {
    g.fillStyle = '#fbf3e4'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#24c6dc'; g.fillRect(0, 0, w, h * 0.16); g.fillRect(0, h * 0.84, w, h * 0.16);
    g.fillStyle = '#ff4fa3'; g.fillRect(w * 0.475, 0, w * 0.05, h);
    g.fillStyle = '#ffb000'; g.beginPath(); g.arc(w * 0.49, h * 0.5, w * 0.075, 0, 7); g.fill();
    g.strokeStyle = '#ff7a1a'; g.lineWidth = 6; g.beginPath(); g.arc(w * 0.49, h * 0.5, w * 0.1, 0, 7); g.stroke();
  });
}
function emblemTex() { // centro del escudo: rayo original sobre naranja (sin estrellas ni logos)
  return tex(1024, 1024, (g, w) => {
    const c = w / 2, r = 0.15 * w;
    const gr = g.createRadialGradient(c, c, 10, c, c, r); gr.addColorStop(0, '#ff8a2a'); gr.addColorStop(1, '#d4420e');
    g.fillStyle = '#d4420e'; g.fillRect(0, 0, w, w); g.fillStyle = gr; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    const s = r / 100; g.fillStyle = '#fff4c2'; g.strokeStyle = '#7a2200'; g.lineWidth = 4;
    g.beginPath(); [[12, -78], [-34, 8], [-4, 8], [-18, 80], [36, -14], [6, -14], [20, -78]].forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, c + x * s, c + y * s)); g.closePath(); g.fill(); g.stroke();
  });
}
function goalNetMat() { // malla cuadrada (cada repetición = un cuadro de la red)
  const t = tex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.strokeRect(0, 0, w, h); }, true);
  return std({ map: t, color: 0xf2f2f2, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
}
function hoopNetMat() { // malla de rombos para la red del aro
  const t = tex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke(); }, true);
  t.repeat.set(14, 14);
  return std({ map: t, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.9 });
}
function boardMat() { // tablero de vidrio con marco negro y el rectángulo de tiro
  const t = tex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111'; g.lineWidth = 26; g.strokeRect(13, 13, w - 26, h - 26);
    // rectángulo de 59 x 45 cm justo encima del aro (u ≈ 0.5 ± 0.17; v de 0.25 a 0.62)
    g.strokeStyle = '#ffffff'; g.lineWidth = 12; g.strokeRect(w * 0.33, h * (1 - 0.62), w * 0.34, h * 0.37);
  });
  return std({ map: t, transparent: true, depthWrite: false, roughness: 0.05, metalness: 0.2 });
}

/* ===================== Ajuste de cada archivo ===================== */
function hoopPrep(parts) { // tablero: frente hacia +Z en z = 0, piso en y = 0, aro centrado en x = 0
  rotate(parts, 'Y', -90);
  const b = bbox(parts), brd = bbox(parts, 'Material.008');
  move(parts, -(b.min.x + b.max.x) / 2, -b.min.y, -brd.max.z);
  let rim = { y: 3.05, z: 0.3786, r: 0.2286 };
  const sel = v => v.z > -0.12 && v.y > 2.9 && v.y < 3.15; // vértices del aro (el poste y el brazo están detrás del tablero)
  const rb = bbox(parts, 'Material.007', sel), C = rb.getCenter(new V3()), outer = (rb.max.x - rb.min.x) / 2;
  const extra = [];
  if (AJUSTES.aroReglamentario && outer > 0.3) {
    const s = (rim.r + 0.011) / outer, T = new V3(0, rim.y, rim.z);
    eachV(parts, 'Material.007', v => { if (!sel(v)) return false; v.sub(C).multiplyScalar(s).add(T); return true; });
    eachV(parts, 'Material.009', v => { v.set(T.x + (v.x - C.x) * s, T.y + (v.y - C.y) * 0.75, T.z + (v.z - C.z) * s); return true; });
    const brk = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.16), std({ color: lin(0.8, 0.25, 0), metalness: 0.5, roughness: 0.35 })); brk.position.set(0, rim.y - 0.01, 0.08); extra.push(brk);
  } else rim = { y: C.y, z: C.z, r: outer - 0.025 };
  const board = bbox(parts, 'Material.008');
  return { parts, extra, info: { rim, board: { bottom: board.min.y, top: board.max.y, half: board.max.x } } };
}
const DEF = {
  varitas: { file: 'varitas.fbx', prep(parts) { // 5 varitas: mango en y = 0, largo 1 (la escena las escala)
    const out = {};
    for (const p of parts) {
      const n = parseInt((p.mats[0].match(/\d+/) || ['1'])[0], 10) - 1;
      const b = bbox([p]), L = b.max.y - b.min.y; place([p], { y: 'min' }, b); scale([p], 1 / L);
      out['varita' + n] = plantilla([p], { '*': std({ color: 0x8a6238, roughness: 0.7 }) });
    }
    return out;
  } },
  martillo: { file: 'martillo.fbx', prep(parts) { // mango vertical, cabeza arriba, 46 cm
    const b = bbox(parts); place(parts, { y: 'min' }, b); scale(parts, 0.46 / (b.max.y - b.min.y)); move(parts, 0, -0.06, 0);
    return { martillo: plantilla(parts, { metalic: std({ color: 0x9aa3b0, metalness: 0.9, roughness: 0.3, emissive: 0x0a2a44, emissiveIntensity: 0.6 }), 'Material.011': std({ color: 0x4a2e18, roughness: 0.85 }) }) };
  } },
  arco: { file: 'arco-flechas.fbx', prep(parts) { // arco vertical de 62 cm: empuñadura en el origen, cuerda hacia -Z
    rotate(parts, 'X', 90);
    const c = bbox(parts, 'metalic').getCenter(new V3()); move(parts, -c.x, -c.y, -c.z);
    const b = bbox(parts); scale(parts, 0.62 / (b.max.y - b.min.y));
    const st = bbox(parts, 'Material.023');
    return { arco: plantilla(parts, { metalic: std({ color: 0xb8bcc6, metalness: 0.9, roughness: 0.3 }), MADEIRA: std({ color: 0x7a4a24, roughness: 0.6 }), 'Material.023': std({ color: 0xeeeeee }) },
      { string: { top: st.max.y, bot: st.min.y, z: (st.min.z + st.max.z) / 2 } }) };
  } },
  escudo: { file: 'escudo.fbx', prep(parts) { // disco de 60 cm mirando a +Z (colores originales: turquesa, dorado y naranja)
    rotate(parts, 'X', 90); const b = bbox(parts); place(parts, {}, b); scale(parts, 0.6 / (b.max.x - b.min.x));
    return { escudo: plantilla(parts, { 'Material.024': std({ map: emblemTex(), metalness: 0.4, roughness: 0.35 }), 'metalic.001': std({ color: 0xe0b440, metalness: 0.95, roughness: 0.28 }), 'rojo meta': std({ color: 0x17a9b6, metalness: 0.45, roughness: 0.32 }), 'metalic escudo 2': std({ color: 0x3a3f4a, metalness: 0.9, roughness: 0.4 }) }) };
  } },
  lancha: { file: 'lancha.fbx', prep(parts) { // proa hacia +X, 6 m de largo, quilla en y = 0
    rotate(parts, 'Y', 180); // en el modelo la proa mira hacia -X
    const b = bbox(parts); place(parts, { y: 'min' }, b); scale(parts, 6 / (b.max.x - b.min.x));
    const deck = bbox(parts, 'Material.017'), con = bbox(parts, 'Material.012');
    return { lancha: plantilla(parts, {
      'Material.013': std({ color: lin(0.8, 0.002, 0.005), roughness: 0.35, metalness: 0.1 }), 'Material.015': std({ color: lin(0.018, 0.018, 0.018), roughness: 0.8 }),
      'Material.016': std({ color: lin(0.223, 0.223, 0.223), roughness: 0.7 }), 'Material.017': std({ color: lin(0.205, 0.195, 0.192), roughness: 0.8 }),
      'Material.018': std({ color: lin(0.407, 0.407, 0.407), roughness: 0.4, metalness: 0.3 }), 'Material.012': std({ color: lin(0.8, 0.8, 0.8), roughness: 0.3 })
    }, { deck: deck.max.y, consoleX: [con.min.x, con.max.x], consoleTop: con.max.y, length: 6 }) };
  } },
  moto: { file: 'moto-acuatica.fbx', prep(parts) { // proa hacia +X, 3.2 m de largo
    rotate(parts, 'Y', 90); const b = bbox(parts); place(parts, { y: 'min' }, b); scale(parts, 3.2 / (b.max.x - b.min.x));
    const seat = bbox(parts, 'Material.035');
    return { moto: plantilla(parts, {
      'Material.032': std({ color: lin(0.345, 0, 0.8), roughness: 0.3, metalness: 0.2 }), 'Material.034': std({ color: lin(0.793, 0.001, 0.8), roughness: 0.3, metalness: 0.2 }),
      'Material.035': std({ color: lin(0.755, 0, 0.196), roughness: 0.6 }), 'Material.036': std({ color: lin(0.044, 0.044, 0.044), roughness: 0.6 }),
      'Material.037': std({ color: lin(0.233, 0.233, 0.233), roughness: 0.4, metalness: 0.6 }), 'Material.039': std({ color: 0x050505, roughness: 0.7 })
    }, { seatX: (seat.min.x + seat.max.x) / 2, seatY: seat.max.y }) };
  } },
  surf: { file: 'tabla-surf.fbx', prep(parts) { // tabla parada: largo en Y (2.16 m), cara hacia +Z
    rotate(parts, 'X', 90); rotate(parts, 'Z', 90); const b = bbox(parts); place(parts, {}, b); scale(parts, 2.16 / (b.max.y - b.min.y));
    return { surf: plantilla(parts, { '*': std({ map: surfTex(), roughness: 0.3 }) }) };
  } },
  basket: { file: 'balon-basket.fbx', prep(parts) { // radio 1 (la escena lo escala)
    const b = bbox(parts); place(parts, {}, b); scale(parts, 2 / (b.max.x - b.min.x));
    return { 'balon-basket': plantilla(parts, { '*': std({ map: basketTex(), roughness: 0.78 }) }) };
  } },
  americano: { file: 'balon-americano.fbx', prep(parts) { // radio corto 1, eje largo en Z (≈1.75)
    rotate(parts, 'X', 90); const b = bbox(parts); place(parts, {}, b); scale(parts, 2 / (b.max.x - b.min.x));
    let top = -1e9, u0 = 0.25; const uv = parts[0].geo.attributes.uv;
    if (uv) eachV(parts, null, (v, i) => { if (v.y > top) { top = v.y; u0 = uv.getX(i); } });
    return { 'balon-americano': plantilla(parts, { '*': std({ map: footballTex(u0), roughness: 0.6 }) }) };
  } },
  futbol: { file: 'balon-futbol.fbx', prep(parts) { // radio 1, diseño clásico de pentágonos (original, sin el diseño de la marca)
    const b = bbox(parts); place(parts, {}, b); scale(parts, 2 / (b.max.x - b.min.x));
    return { 'balon-futbol': plantilla(parts, { '*': soccerMat() }) };
  } },
  arcoFutbol: { file: 'arco-futbol.fbx', prep(parts) { // postes en x = ±3.66, travesaño a 2.44 m, red hacia -Z
    rotate(parts, 'Y', -90);
    const b = bbox(parts), R = 0.12; // radio del poste en el modelo
    move(parts, -(b.min.x + b.max.x) / 2, -b.min.y, -(b.max.z - R));
    const sx = 3.66 / ((b.max.x - b.min.x) / 2 - R), sy = 2.44 / ((b.max.y - b.min.y) - R);
    scale(parts, sx, sy, 1);
    const sp = splitNet(parts); boxUVs(sp, 'red', 0.14);
    return { 'arco-futbol': plantilla(sp, { marco: std({ color: 0xffffff, roughness: 0.35, metalness: 0.2 }), red: goalNetMat() }, { half: 3.66, bar: 2.44, postR: R * sx, depth: -bbox(sp).min.z }) };
  } },
  postes: { file: 'postes-americano.fbx', prep(parts) { // travesaño a lo largo de X a 3.05 m, base en y = 0
    rotate(parts, 'Y', 90);
    const b = bbox(parts), base = bbox(parts, 'Material.004');
    move(parts, -(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    const s = 3.05 / (base.max.y - b.min.y); scale(parts, s);
    const up = bbox(parts, 'Material.003', v => v.y > 4);
    return { postes: plantilla(parts, { 'Material.003': std({ color: 0xffd400, metalness: 0.4, roughness: 0.4 }), 'Material.004': std({ color: lin(0.751, 0.751, 0.751), roughness: 0.7 }) }, { half: up.max.x - 0.1 * s, bar: 3.05, top: up.max.y }) };
  } },
  tablero: { file: 'tablero-basket.fbx', prep(parts) {
    const r = hoopPrep(parts);
    return { tablero: plantilla(r.parts, { 'Material.007': std({ color: lin(0.8, 0.25, 0), metalness: 0.5, roughness: 0.35 }), 'Material.008': boardMat() }, r.info, r.extra) };
  } },
  tableroMalla: { file: 'tablero-basket-malla.fbx', prep(parts) {
    const r = hoopPrep(parts);
    return { 'tablero-malla': plantilla(r.parts, { 'Material.007': std({ color: lin(0.8, 0.25, 0), metalness: 0.5, roughness: 0.35 }), 'Material.008': boardMat(), 'Material.009': hoopNetMat() }, r.info, r.extra) };
  } }
};

/* ===================== API para las escenas ===================== */
const KEY2FILE = { varita0: 'varitas', varita1: 'varitas', varita2: 'varitas', varita3: 'varitas', varita4: 'varitas', martillo: 'martillo', arco: 'arco', escudo: 'escudo', lancha: 'lancha', moto: 'moto', surf: 'surf', 'balon-basket': 'basket', 'balon-americano': 'americano', 'balon-futbol': 'futbol', 'arco-futbol': 'arcoFutbol', postes: 'postes', tablero: 'tablero', 'tablero-malla': 'tableroMalla' };
const ready = {}, loading = {};
function loadFile(f) {
  return loading[f] || (loading[f] = loader.loadAsync(DIR + DEF[f].file).then(root => {
    const out = DEF[f].prep(bake(root));
    for (const [k, t] of Object.entries(out)) { applyTextures(DEF[f].file, t); ready[k] = t; }
    return true;
  }).catch(e => { console.warn('No se pudo cargar el modelo', DEF[f].file, e); return false; }));
}
function applyTextures(file, t) {
  const list = TEXTURAS[file]; if (!list) return;
  for (const [mat, img] of Object.entries(list)) {
    const m = t.mats[mat]; if (!m) continue;
    new THREE.TextureLoader().load(DIR + 'texturas/' + img, tx => { tx.colorSpace = THREE.SRGBColorSpace; tx.userData.keep = true; m.map = tx; m.color.set(0xffffff); m.vertexColors = false; m.needsUpdate = true; });
  }
}
const SIN_USO = ['lancha', 'moto']; // el tour acuático volvió a sus vehículos hechos por código; quita un nombre de aquí para volver a usar ese FBX
export function preloadModels() { return Promise.all(Object.keys(DEF).filter(f => !SIN_USO.includes(f)).map(loadFile)); }
export const modelInfo = key => (ready[key] ? ready[key].userData.info : null);
export const modelMat = (key, name) => (ready[key] ? ready[key].mats[name] : null);
function free(o) { o.traverse(n => { if (n.geometry && !n.geometry.userData.keep) n.geometry.dispose(); }); }
// Devuelve un grupo con una copia del modelo. Si todavía está cargando (o falla), muestra el modelo anterior
// hecho por código (fallback) y lo cambia por el nuevo apenas esté listo. onLoad(copia, info) permite ajustarlo.
export function modelo(key, { fallback = null, onLoad = null } = {}) {
  const h = new THREE.Group();
  const put = () => { const o = ready[key].clone(); h.add(o); if (onLoad) onLoad(o, ready[key].userData.info); };
  if (ready[key]) { put(); return h; }
  const fb = fallback ? fallback() : null; if (fb) h.add(fb);
  loadFile(KEY2FILE[key]).then(ok => { if (!ok || !ready[key]) return; if (fb) { h.remove(fb); free(fb); } put(); });
  return h;
}
// Cambia el material de todas las piezas de una copia (por ejemplo, la madera de cada varita).
export function setMaterial(obj, mat, only = null) {
  obj.traverse(n => {
    if (!n.isMesh) return;
    if (!only) { n.material = Array.isArray(n.material) ? n.material.map(() => mat) : mat; return; }
    if (Array.isArray(n.material)) n.material = n.material.map(m => (m === only ? mat : m));
    else if (n.material === only) n.material = mat;
  });
}
