// Patada con la cámara TRASERA: sostienes el celular apuntando a tus pies y pateas el balón que aparece sobre tu piso real.
// Se detecta por MOVIMIENTO dentro del balón (diferencia entre cuadros de video), sin inteligencia artificial:
// funciona con cualquier zapato y no necesita ver el cuerpo entero.

// sens: sensibilidad (botón «Sensib.» del juego): 1 = normal, más alto = basta una patada más suave.
export const foot = { sens: 1 };
// Umbrales (fracciones de píxeles que cambian entre un cuadro y el siguiente):
//   zone: cuánto debe cambiar el área del balón para contar como patada. Bajar = más fácil.
//   ratio: el balón debe moverse X veces más que el resto de la imagen (así mover el celular no cuenta).
//   calm: cuánto puede moverse el área del balón mientras «esperas» antes de patear.
//   diff: diferencia de brillo (0–255) para considerar que un píxel cambió.
export const KICK = { zone: 0.14, ratio: 2.5, calm: 0.06, diff: 26, cooldown: 1100 };
const SW = 96; // ancho de la imagen reducida que se analiza
const SHIFT = 5; // cuántos píxeles (de esa imagen) puede moverse el celular entre un cuadro y otro y aun así compensarse

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// Cuánto se movió la imagen completa entre dos cuadros (la mano que sostiene el celular nunca está quieta).
// Prueba desplazamientos de -R a +R píxeles y se queda con el que mejor encaja, sin mirar la zona del balón (ahí está el pie).
function globalShift(gray, prev, w, h, zone, R) {
  const B2 = (zone.r * 2.6) ** 2;
  let best = Infinity, bx = 0, by = 0;
  for (let oy = -R; oy <= R; oy++) for (let ox = -R; ox <= R; ox++) {
    let sad = 0, n = 0;
    for (let y = R; y < h - R; y += 2) {
      const dy = y - zone.y, row = y * w, prow = (y + oy) * w + ox;
      for (let x = R; x < w - R; x += 2) {
        const dx = x - zone.x; if (dx * dx + dy * dy < B2) continue;
        sad += Math.abs(gray[row + x] - prev[prow + x]); n++;
      }
    }
    sad = n ? sad / n : 0;
    if (sad < best - 0.01 || (Math.abs(sad - best) <= 0.01 && ox * ox + oy * oy < bx * bx + by * by)) { best = sad; bx = ox; by = oy; }
  }
  return { dx: bx, dy: by };
}
export function createMotionKick() {
  let prev = null, hist = [], cdUntil = 0, pend = null;
  return {
    reset() { prev = null; hist = []; cdUntil = 0; pend = null; },
    // gray: brillo de cada píxel (Uint8Array w*h). zone: centro y radio del balón en esos píxeles. t: milisegundos.
    update(gray, w, h, zone, t) {
      if (!prev || prev.length !== gray.length) { prev = gray.slice(); return { ready: false, ez: 0, eg: 0 }; }
      // 1) se descuenta el movimiento del celular; 2) se cuenta qué cambió dentro del balón y qué cambió en el resto
      const sh = globalShift(gray, prev, w, h, zone, SHIFT);
      const R2 = zone.r * zone.r, B2 = (zone.r * 2.6) ** 2, D = KICK.diff;
      let zc = 0, zn = 0, gc = 0, gn = 0, sx = 0, sy = 0, mc = 0;
      for (let y = 0; y < h; y++) {
        const dy = y - zone.y, py = y + sh.dy; if (py < 0 || py >= h) continue;
        for (let x = 0; x < w; x++) {
          const px = x + sh.dx; if (px < 0 || px >= w) continue;
          const moved = Math.abs(gray[y * w + x] - prev[py * w + px]) > D, dx = x - zone.x, d2 = dx * dx + dy * dy;
          if (d2 <= R2) { zn++; if (moved) zc++; }
          if (d2 <= B2) { if (moved) { sx += x; sy += y; mc++; } } else { gn++; if (moved) gc++; }
        }
      }
      prev.set(gray);
      const ez = zn ? zc / zn : 0, eg = gn ? gc / gn : 0, c = mc > 4 ? { x: sx / mc, y: sy / mc } : null;
      hist.push({ t, ez, eg, c }); while (hist.length && t - hist[0].t > 1200) hist.shift();
      if (pend) { // patada ya detectada: se mide la dirección del pie durante ~0.1 s más y se dispara
        if (c) pend.c1 = c;
        if (t - pend.t0 < 100) return { ready: false, ez, eg, still: false };
        let lat = 0;
        if (pend.c0 && pend.c1) {
          const dx = pend.c1.x - pend.c0.x, dy = pend.c1.y - pend.c0.y;
          lat = clamp(dx / Math.max(Math.abs(dy), zone.r * 0.8) * 1.2, -1, 1); if (Math.abs(lat) < 0.15) lat = 0;
        }
        const kick = { pw: pend.pw, lat }; pend = null; hist = [];
        return { ready: false, ez, eg, still: false, kick };
      }
      const before = hist.filter(q => t - q.t >= 120 && t - q.t <= 700);
      const calm = before.length >= 4 && before[before.length - 1].t - before[0].t >= 350 && before.every(q => q.ez < KICK.calm * 1.6) && before.reduce((s, q) => s + q.ez, 0) / before.length < KICK.calm;
      const still = eg < 0.06; // el celular está quieto (casi nada cambia fuera del balón)
      const need = KICK.zone / foot.sens;
      if (t > cdUntil && calm && ez > need && ez > KICK.ratio * eg + 0.03) {
        // dirección: desde dónde empezó el «centro del movimiento» (últimos ~200 ms) hasta dónde llega en 0.1 s
        const old = hist.find(q => t - q.t <= 220 && q.c);
        pend = { t0: t, c0: old ? old.c : c, c1: c, pw: clamp(1 + (ez - need) * 1.5, 1, 1.3) };
        cdUntil = t + KICK.cooldown;
        return { ready: false, ez, eg, still };
      }
      return { ready: calm && still, ez, eg, still };
    }
  };
}

/* ---------- lectura de la cámara (unos 30 cuadros por segundo) ---------- */
let on = false, cv = null, g = null, gray = null, lastRun = 0, lastTime = -1;
const det = createMotionKick();
// getZone(vw, vh) devuelve { x, y, r } del balón en píxeles del VIDEO (o null si no hay balón en pantalla).
export async function startFoot(video, getZone, cb) {
  if (on) return;
  on = true; det.reset();
  cv = cv || document.createElement('canvas'); g = g || cv.getContext('2d', { willReadFrequently: true });
  const step = () => {
    if (!on) return;
    requestAnimationFrame(step);
    const now = performance.now();
    if (now - lastRun < 30 || video.readyState < 2 || video.currentTime === lastTime) return;
    const vw = video.videoWidth, vh = video.videoHeight; if (!vw) return;
    const z = getZone(vw, vh); if (!z) return;
    lastRun = now; lastTime = video.currentTime;
    const k = SW / vw, sh = Math.max(16, Math.round(vh * k));
    if (cv.width !== SW || cv.height !== sh || !gray) { cv.width = SW; cv.height = sh; gray = new Uint8Array(SW * sh); det.reset(); }
    g.drawImage(video, 0, 0, SW, sh);
    const px = g.getImageData(0, 0, SW, sh).data;
    for (let i = 0, j = 0; j < gray.length; i += 4, j++) gray[j] = (px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8;
    cb(det.update(gray, SW, sh, { x: z.x * k, y: z.y * k, r: Math.max(3, z.r * k) }, now));
  };
  step();
}
export function stopFoot() { on = false; }
