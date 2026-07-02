/* The avalanche field.
 *
 * A grid of dim cells, each holding one bit. Mostly the field is still.
 * Every so often an ambient disturbance starts somewhere and cascades
 * outward: each cell the wavefront touches flips with probability one
 * half, then the field settles into a new stable texture. The
 * cryptographic avalanche effect, played slowly enough to read as weather.
 *
 * Touch is violent instead: a click strikes a Lichtenberg discharge —
 * branching filaments that crackle across the lattice, permanently
 * rewriting the bits they touch, then fade. The cursor carries a faint
 * lantern of light through the field.
 *
 * Waves and bolts compose; several can run at once. Nothing redraws while
 * the field is still and the pointer rests.
 */

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');

const GAP = 26;          // px between cells
const DOT = 1.75;        // cell size, px
const SPEED = 230;       // wavefront px/s
const BAND = 150;        // glow band depth behind the front, px
const GLOW = 0.3;        // peak alpha added at the wavefront
const LANTERN_R = 150;   // pointer glow radius, px
const LANTERN = 0.22;    // peak alpha added under the pointer
const LULL = [8000, 14000]; // ms between ambient waves

const BOLT_STEP_MS = 7;  // filament growth per lattice step
const BOLT_FLASH = 900;  // ms for a filament segment to fade
const BOLT_ALPHA = 0.55; // peak filament brightness

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let dpr, w, h, cols, rows;
let bits;
let generation = 1;
let waves = []; // { x, y, start, gen, lastR }
let bolts = []; // { segs: [{ x1, y1, x2, y2, birth }], end }
let waveTimer = 0;
let pointer = null; // { x, y }
let dirty = true;

// deterministic per-cell noise
function noise(x, y, s) {
  let n = x * 374761393 + y * 668265263 + s * 1274126177;
  n = Math.imul(n ^ (n >>> 13), 1103515245);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function seedField() {
  bits = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++)
      bits[j * cols + i] = noise(i, j, generation) > 0.5 ? 1 : 0;
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  cols = Math.ceil(w / GAP) + 1;
  rows = Math.ceil(h / GAP) + 1;
  seedField();
  waves = [];
  dirty = true;
}

// base alpha, faded toward the page center so the type sits on calm ground
function cellAlpha(bit, px, py) {
  const base = bit ? 0.14 : 0.05;
  const dx = px - w / 2;
  const dy = py - h / 2;
  const d = Math.sqrt(dx * dx + dy * dy);
  const calm = Math.min(1, Math.max(0.18, d / (Math.min(w, h) * 0.42)));
  return base * calm;
}

function startWave(x, y) {
  generation += 1;
  waves.push({ x, y, start: performance.now(), gen: generation, lastR: 0 });
}

// A Lichtenberg discharge: branching random walks over the lattice.
// Each filament wanders, occasionally forks, and flips every bit it
// crosses — the strike leaves a permanent scar in the texture.
function strike(x, y) {
  const start = performance.now();
  const segs = [];
  let branches = [];
  const initial = 3 + Math.floor(Math.random() * 3);
  for (let b = 0; b < initial; b++) {
    branches.push({
      i: Math.round(x / GAP),
      j: Math.round(y / GAP),
      ang: Math.random() * Math.PI * 2,
      life: 16 + Math.random() * 20,
    });
  }

  for (let step = 0; branches.length && step < 60; step++) {
    const survivors = [];
    for (const br of branches) {
      br.ang += (Math.random() - 0.5) * (Math.PI / 1.5);
      const ni = br.i + Math.round(Math.cos(br.ang));
      const nj = br.j + Math.round(Math.sin(br.ang));
      br.life -= 1;
      if (br.life <= 0 || ni < 0 || nj < 0 || ni >= cols || nj >= rows) {
        continue; // filament dies at the edge or of exhaustion
      }
      segs.push({
        x1: br.i * GAP,
        y1: br.j * GAP,
        x2: ni * GAP,
        y2: nj * GAP,
        birth: start + step * BOLT_STEP_MS,
      });
      bits[nj * cols + ni] ^= 1;
      br.i = ni;
      br.j = nj;
      survivors.push(br);
      if (Math.random() < 0.1 && survivors.length < 12) {
        survivors.push({
          i: ni,
          j: nj,
          ang: br.ang + (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 3),
          life: br.life * 0.6,
        });
      }
    }
    branches = survivors;
  }

  if (segs.length) {
    bolts.push({ segs, end: segs[segs.length - 1].birth + BOLT_FLASH });
  }
  dirty = true;
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!waves.length && !bolts.length && !dirty) return;

  // advance every front, flipping the bits it newly covers
  for (const wv of waves) {
    const r = ((now - wv.start) / 1000) * SPEED;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const d = Math.hypot(i * GAP - wv.x, j * GAP - wv.y);
        if (d > wv.lastR && d <= r && noise(i, j, wv.gen) > 0.5) {
          bits[j * cols + i] ^= 1;
        }
      }
    }
    wv.lastR = r;
  }

  // retire waves that have cleared the far corner
  waves = waves.filter((wv) => {
    const reach = Math.max(
      Math.hypot(wv.x, wv.y),
      Math.hypot(w - wv.x, wv.y),
      Math.hypot(wv.x, h - wv.y),
      Math.hypot(w - wv.x, h - wv.y),
    );
    return wv.lastR <= reach + BAND;
  });

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#d9d3c5';

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const px = i * GAP;
      const py = j * GAP;
      let a = cellAlpha(bits[j * cols + i], px, py);

      for (const wv of waves) {
        const t = (wv.lastR - Math.hypot(px - wv.x, py - wv.y)) / BAND;
        if (t > 0 && t < 1) a += (1 - t) * (1 - t) * GLOW;
      }

      if (pointer) {
        const d = Math.hypot(px - pointer.x, py - pointer.y);
        if (d < LANTERN_R) {
          const f = 1 - d / LANTERN_R;
          a += f * f * LANTERN;
        }
      }

      ctx.globalAlpha = Math.min(0.5, a);
      ctx.fillRect(px, py, DOT, DOT);
    }
  }

  // filaments flash over the field, then fade
  if (bolts.length) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e8e4da';
    for (const bolt of bolts) {
      for (const s of bolt.segs) {
        const age = now - s.birth;
        if (age < 0 || age > BOLT_FLASH) continue;
        const k = 1 - age / BOLT_FLASH;
        ctx.globalAlpha = k * k * BOLT_ALPHA;
        ctx.beginPath();
        ctx.moveTo(s.x1, s.y1);
        ctx.lineTo(s.x2, s.y2);
        ctx.stroke();
      }
    }
    bolts = bolts.filter((b) => now < b.end);
  }

  ctx.globalAlpha = 1;
  dirty = false;
}

function schedule() {
  clearTimeout(waveTimer);
  waveTimer = setTimeout(
    () => {
      if (!document.hidden) {
        startWave(Math.random() * w, Math.random() * h);
      }
      schedule();
    },
    LULL[0] + Math.random() * (LULL[1] - LULL[0]),
  );
}

resize();
window.addEventListener('resize', resize);
requestAnimationFrame(frame);

if (!reduced) {
  window.addEventListener('pointermove', (e) => {
    pointer = { x: e.clientX, y: e.clientY };
    dirty = true;
  });

  window.addEventListener('pointerleave', () => {
    pointer = null;
    dirty = true;
  });

  window.addEventListener('pointerdown', (e) => {
    // links keep their meaning; anywhere else draws lightning
    if (e.target instanceof Element && e.target.closest('a')) return;
    strike(e.clientX, e.clientY);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) dirty = true;
  });

  schedule();
}
