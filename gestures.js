// CAROLINA AR ADVENTURE — reconocedor de gestos para los hechizos del duelo de Blue Ridge (clave orlando).
// Tres figuras: ⚡ 'zigzag' (rayo), — 'line' (desarme) y ⭕ 'circle' (escudo).
// classify(puntos) recibe puntos de pantalla {x, y} en píxeles y devuelve { kind, ... } (kind = null si no se parece a ninguna).
// Si en el celular confunde figuras, ajusta GEST:
//  - line: qué tan recta debe ser la línea (1 = perfecta). Bájalo (0.8) si tus líneas no se reconocen.
//  - circleTurn: cuánto debe girar el círculo (6.28 = vuelta completa). Bájalo (3.8) si tus círculos no se reconocen.
//  - sharp: giro mínimo de cada pico del zigzag (1.75 ≈ 100°).
export const GEST = { minLen: 60, N: 32, line: 0.86, circleTurn: 4.4, circleClose: 0.45, sharp: 1.75, lobe: 1.0 };

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)); // ángulo entre -π y π

function pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }

export function resample(pts, n) { // n puntos repartidos a la misma distancia a lo largo del trazo
  const I = pathLen(pts) / (n - 1), out = [{ x: pts[0].x, y: pts[0].y }];
  let D = 0, prev = out[0];
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i]; let d = dist(prev, cur);
    while (D + d >= I && out.length < n && d > 0) {
      const k = (I - D) / d, q = { x: prev.x + k * (cur.x - prev.x), y: prev.y + k * (cur.y - prev.y) };
      out.push(q); prev = q; d = dist(prev, cur); D = 0;
    }
    D += d; prev = cur;
  }
  const last = pts[pts.length - 1];
  while (out.length < n) out.push({ x: last.x, y: last.y });
  return out;
}

export function classify(raw) {
  if (!raw || raw.length < 3) return { kind: null, why: 'corto' };
  const len = pathLen(raw);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of raw) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const diag = Math.hypot(x1 - x0, y1 - y0);
  if (len < GEST.minLen || diag < GEST.minLen * 0.6) return { kind: null, why: 'corto', len };
  const p = resample(raw, GEST.N);
  const ang = []; for (let i = 1; i < p.length; i++) ang.push(Math.atan2(p[i].y - p[i - 1].y, p[i].x - p[i - 1].x));
  const d = []; for (let i = 1; i < ang.length; i++) d.push(wrap(ang[i] - ang[i - 1]));
  const turn = d.reduce((a, b) => a + b, 0); // giro total con signo (una vuelta = ±6.28)
  // esquinas (picos del zigzag): giro acumulado en ventanas de 3 tramos
  const corners = [];
  for (let i = 0; i + 2 < d.length;) { const w = d[i] + d[i + 1] + d[i + 2]; if (Math.abs(w) > GEST.sharp) { corners.push(Math.sign(w)); i += 3; } else i++; }
  let alt = 0; for (let i = 1; i < corners.length; i++) if (corners[i] !== corners[i - 1]) alt++;
  // lóbulos (ondas suaves tipo «S» o «~»): tramos que giran hacia el mismo lado
  const lobes = []; let ls = 0, lsum = 0;
  for (const v of d) { if (Math.abs(v) < 0.05) { lsum += v; continue; } const s = Math.sign(v); if (ls && s !== ls) { lobes.push(lsum); lsum = 0; } ls = s; lsum += v; }
  lobes.push(lsum);
  const big = lobes.filter(v => Math.abs(v) > GEST.lobe);
  let waves = 0; for (let i = 1; i < big.length; i++) if (Math.sign(big[i]) !== Math.sign(big[i - 1])) waves++;
  const straight = dist(p[0], p[p.length - 1]) / len, close = dist(p[0], p[p.length - 1]) / Math.max(diag, 1);
  const f = { straight: +straight.toFixed(2), turn: +turn.toFixed(2), corners: corners.length, alt, waves, close: +close.toFixed(2) };
  if (straight >= GEST.line) return { kind: 'line', ...f };
  if (Math.abs(turn) >= GEST.circleTurn && close <= GEST.circleClose && alt === 0) return { kind: 'circle', ...f };
  if ((corners.length >= 2 && alt >= 1) || waves >= 1) return { kind: 'zigzag', ...f };
  if (corners.length >= 1 && Math.abs(turn) < 3.2 && straight < 0.8) return { kind: 'zigzag', ...f };
  if (straight >= 0.72) return { kind: 'line', ...f };
  if (Math.abs(turn) >= 3.6 && close <= 0.6) return { kind: 'circle', ...f };
  return { kind: null, why: 'no se parece', ...f };
}

// Con la mano (dedo índice en el aire) no hay «tocar y soltar»: el trazo empieza cuando el dedo se mueve rápido
// y termina cuando se queda casi quieto un momento. feed(x, y, t) con t en segundos; devuelve los puntos del trazo terminado o null.
export function createStroker(o = {}) {
  const C = { start: 650, stop: 220, still: 0.14, max: 1.8, minLen: 110, pre: 0.12, ...o };
  let hist = [], buf = [], on = false, slow = 0, t0 = 0;
  return {
    get active() { return on; },
    get points() { return buf; },
    reset() { hist = []; buf = []; on = false; slow = 0; },
    feed(x, y, t) {
      const last = hist[hist.length - 1], pt = { x, y, t };
      hist.push(pt); while (hist.length && t - hist[0].t > 0.3) hist.shift();
      if (!last || t <= last.t) return null;
      const dt = t - last.t, v = Math.hypot(x - last.x, y - last.y) / dt;
      if (!on) {
        if (v > C.start) { on = true; slow = 0; t0 = t; buf = hist.filter(h => t - h.t <= C.pre + dt); }
        return null;
      }
      buf.push(pt); slow = v < C.stop ? slow + dt : 0;
      if (slow >= C.still || t - t0 > C.max) {
        on = false; const out = buf; buf = [];
        return pathLen(out) >= C.minLen ? out : null;
      }
      return null;
    }
  };
}
