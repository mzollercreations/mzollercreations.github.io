/* mzollercreations — particle field
   A fixed canvas behind the page. ~2,600 points morph between five shapes
   (sphere → galaxy → helix → wave → ring) as the visitor scrolls through
   the sections marked with data-scene. Driven by main.js via Field.render(). */
(function () {
  'use strict';

  const canvas = document.getElementById('field');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* spectral palette across the screen, 8 steps */
  const STOPS = [[57, 213, 255], [124, 92, 255], [255, 92, 168], [255, 176, 58]];
  const NC = 8;
  const COLORS = [];
  for (let i = 0; i < NC; i++) {
    const t = (i / (NC - 1)) * (STOPS.length - 1);
    const k = Math.min(STOPS.length - 2, Math.floor(t));
    const f = t - k;
    const c = STOPS[k].map((v, j) => Math.round(v + (STOPS[k + 1][j] - v) * f));
    COLORS.push(`rgb(${c[0]},${c[1]},${c[2]})`);
  }
  const ALPHA = [0.28, 0.55, 0.95];
  const NB = NC * ALPHA.length;

  let W = 0, H = 0, DPR = 1, N = 0, small = false;
  let shapes = [];           // per scene: Float32Array(N*3) unit-space positions
  let aux = null;            // helix: angle per particle
  let rad = null;            // helix: radius per particle
  let rnd, jx, jy, startX, startY, ox, oy;
  let px, py, pp, bucket, order, counts, offs, fillPos;

  let time = 0, intro = reduce ? 1 : 0, started = false;
  let mouse = { x: -9999, y: -9999, on: false }, tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  let wasCovered = false;

  /* ---------- shapes (unit space, y up) ---------- */
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function sphere(n) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * 2.399963229728653;
      a[i * 3] = Math.cos(th) * r;
      a[i * 3 + 1] = y;
      a[i * 3 + 2] = Math.sin(th) * r;
    }
    return a;
  }

  function galaxy(n) {
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      let x, y, z;
      if (i % 7 === 0) {               // dense core
        const r = Math.abs(gauss()) * 0.22;
        const th = Math.random() * TAU;
        x = Math.cos(th) * r; z = Math.sin(th) * r; y = gauss() * 0.06;
      } else {
        const t = Math.pow(Math.random(), 0.75);
        const r = 0.15 + t * 1.6;
        const arm = i % 3;
        const ang = arm * (TAU / 3) + r * 2.3 + gauss() * 0.22 * (1.15 - t * 0.5);
        x = Math.cos(ang) * r; z = Math.sin(ang) * r;
        y = gauss() * 0.05 * (1.8 - r);
      }
      a[i * 3] = x; a[i * 3 + 1] = y; a[i * 3 + 2] = z;
    }
    return a;
  }

  function helix(n) {
    const a = new Float32Array(n * 3);
    aux = new Float32Array(n);
    rad = new Float32Array(n);
    const R = 0.42, turns = 3.5;
    for (let i = 0; i < n; i++) {
      let t, ang, r;
      if (i % 5 === 0) {               // rungs between the two strands
        const k = Math.floor(Math.random() * 34);
        t = (k + 0.5) / 34;
        ang = t * TAU * turns;
        r = R * (1 - 2 * Math.random());
      } else {
        t = Math.random();
        ang = t * TAU * turns + (i % 2) * Math.PI;
        r = R * (1 + gauss() * 0.03);
      }
      a[i * 3] = (t - 0.5) * 4.6;
      aux[i] = ang;
      rad[i] = r;
    }
    return a;
  }

  function wave(n) {
    const a = new Float32Array(n * 3);
    const cols = Math.round(Math.sqrt(n * 2.4));
    const rows = Math.ceil(n / cols);
    for (let i = 0; i < n; i++) {
      const c = i % cols, r = Math.floor(i / cols);
      a[i * 3] = (c / (cols - 1) - 0.5) * 4.8;
      a[i * 3 + 1] = 0;
      a[i * 3 + 2] = (r / Math.max(1, rows - 1) - 0.5) * 2.2;
    }
    return a;
  }

  function torus(n) {
    const a = new Float32Array(n * 3);
    const R = 1, r = 0.26;
    for (let i = 0; i < n; i++) {
      const u = TAU * ((i * 0.7548776662) % 1);
      const v = TAU * ((i * 0.5698402910) % 1);
      const rr = r * (0.75 + Math.random() * 0.25);
      a[i * 3] = (R + rr * Math.cos(v)) * Math.cos(u);
      a[i * 3 + 1] = rr * Math.sin(v);
      a[i * 3 + 2] = (R + rr * Math.cos(v)) * Math.sin(u);
    }
    return a;
  }

  /* per-scene placement; recomputed on resize */
  let SC = [];
  function sceneConfig() {
    const m = small;
    const tall = !m && H > W * 1.15;          // tablets in portrait: sphere above the headline
    const mn = Math.min(W, H);
    SC = [
      { cx: m || tall ? 0.5 : 0.7, cy: m ? 0.36 : tall ? 0.31 : 0.47, s: tall ? W * 0.34 : mn * (m ? 0.38 : 0.34), tilt: 0.32, spin: 0.14, alpha: m ? 0.62 : tall ? 0.8 : 1, kind: 'sphere' },
      { cx: 0.5, cy: 0.5, s: Math.max(W * 0.27, H * 0.3), tilt: 1.12, spin: 0.045, alpha: 0.62, kind: 'galaxy' },
      { cx: 0.5, cy: m ? 0.62 : 0.6, s: Math.max(W * 0.24, 150), tilt: 0.18, spin: 0, alpha: 0.6, kind: 'helix' },
      { cx: 0.5, cy: 0.66, s: Math.max(W * 0.26, 160), tilt: 0.55, spin: 0, alpha: 0.5, kind: 'wave' },
      { cx: 0.5, cy: 0.5, s: mn * (m ? 0.46 : 0.42), tilt: 1.12, spin: 0.11, alpha: 0.85, kind: 'torus' },
    ];
  }

  function alloc() {
    N = W < 700 ? 1150 : W < 1100 ? 1900 : 2600;
    shapes = [sphere(N), galaxy(N), helix(N), wave(N), torus(N)];
    rnd = new Float32Array(N); jx = new Float32Array(N); jy = new Float32Array(N);
    startX = new Float32Array(N); startY = new Float32Array(N);
    ox = new Float32Array(N); oy = new Float32Array(N);
    px = new Float32Array(N); py = new Float32Array(N); pp = new Float32Array(N);
    bucket = new Uint8Array(N); order = new Uint16Array(N);
    counts = new Uint16Array(NB); offs = new Uint16Array(NB + 1); fillPos = new Uint16Array(NB);
    for (let i = 0; i < N; i++) {
      rnd[i] = Math.random();
      const a = Math.random() * TAU;
      jx[i] = Math.cos(a); jy[i] = Math.sin(a);
      const d = 0.7 + Math.random() * 0.9;
      startX[i] = 0.5 + Math.cos(a) * d;
      startY[i] = 0.5 + Math.sin(a) * d;
    }
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    const wasSmall = small;
    small = w < 760;
    DPR = Math.min(window.devicePixelRatio || 1, small ? 1.6 : 1.75);
    const sizeChanged = w !== W || Math.abs(h - H) > 1;
    const needAlloc = !N || wasSmall !== small || (W < 1100) !== (w < 1100) || (W < 700) !== (w < 700);
    W = w; H = h;
    if (sizeChanged) {
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
    }
    if (needAlloc) alloc();
    sceneConfig();
  }

  /* position of particle i in scene k, projected to screen; writes into tmp */
  const tmp = { x: 0, y: 0, p: 1 };
  function place(k, i, scrollRot) {
    const S = SC[k], a = shapes[k], j = i * 3;
    let x = a[j], y = a[j + 1], z = a[j + 2];

    if (S.kind === 'sphere') {
      const b = 1 + 0.07 * Math.sin(y * 3.2 + time * 1.3) * Math.cos(x * 2.4 - time * 0.9);
      x *= b; y *= b; z *= b;
    } else if (S.kind === 'helix') {
      const ang = aux[i] + time * 0.7 + scrollRot * 2.2;
      y = Math.cos(ang) * rad[i];
      z = Math.sin(ang) * rad[i];
    } else if (S.kind === 'wave') {
      y = Math.sin(x * 1.5 + time * 1.1) * 0.16 + Math.cos(z * 2.8 + x * 0.6 + time * 0.8) * 0.12;
    }

    // spin around Y (own axis), then tilt around X
    const ry = S.spin * time + (S.kind === 'helix' || S.kind === 'wave' ? 0 : scrollRot) + tilt.y;
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const x1 = x * cy + z * sy;
    const z1 = -x * sy + z * cy;
    const rx = S.tilt + tilt.x;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const y2 = y * cx - z1 * sx;
    const z2 = y * sx + z1 * cx;

    const p = 4 / (4 - z2);
    tmp.x = S.cx * W + x1 * p * S.s;
    tmp.y = S.cy * H - y2 * p * S.s;
    tmp.p = p;
  }

  /**
   * f        — continuous scene index (0..4)
   * vel      — scroll velocity in px/frame (smoothed)
   * scrollY  — smoothed scroll position
   * covered  — true while an opaque section fills the viewport
   */
  function render(dt, f, vel, scrollY, covered) {
    if (!W) return;
    if (!reduce) time += dt;
    if (started && intro < 1) intro = Math.min(1, intro + dt / 2.4);

    tilt.x += (tilt.tx - tilt.x) * 0.05;
    tilt.y += (tilt.ty - tilt.y) * 0.05;

    if (covered) {
      if (!wasCovered) ctx.clearRect(0, 0, canvas.width, canvas.height);
      wasCovered = true;
      return;
    }
    wasCovered = false;

    f = clamp(f, 0, SC.length - 1);
    const k = Math.min(SC.length - 2, Math.floor(f));
    const m = f - k;
    const A = SC[k], B = SC[k + 1];
    const alpha = (A.alpha + (B.alpha - A.alpha) * m) * (0.15 + 0.85 * intro);
    const scrollRot = scrollY * 0.00055;
    const spread = reduce ? 0 : Math.min(Math.abs(vel), 70) / 70;
    const ie = 1 - Math.pow(1 - intro, 3);
    const R = small ? 0 : 120, R2 = R * R;
    const mx = mouse.x, my = mouse.y, useMouse = mouse.on && R > 0;

    counts.fill(0);

    for (let i = 0; i < N; i++) {
      place(k, i, scrollRot);
      let x = tmp.x, y = tmp.y, p = tmp.p;

      // staggered morph with a slight arc
      if (m > 0) {
        let mi = clamp((m - rnd[i] * 0.35) / 0.65, 0, 1);
        mi = mi * mi * (3 - 2 * mi);
        if (mi > 0) {
          const ax = x, ay = y, ap = p;
          place(k + 1, i, scrollRot);
          const arc = Math.sin(mi * Math.PI) * 70 * (rnd[i] - 0.5);
          x = ax + (tmp.x - ax) * mi + jy[i] * arc;
          y = ay + (tmp.y - ay) * mi - jx[i] * arc;
          p = ap + (tmp.p - ap) * mi;
        }
      }

      // intro: fly in from outside
      if (ie < 1) {
        const ii = clamp((ie - rnd[i] * 0.3) / 0.7, 0, 1);
        const e = 1 - Math.pow(1 - ii, 3);
        x = startX[i] * W + (x - startX[i] * W) * e;
        y = startY[i] * H + (y - startY[i] * H) * e;
      }

      // scroll velocity scatter
      if (spread > 0.01) {
        const s = spread * 46 * (0.4 + rnd[i]);
        x += jx[i] * s; y += jy[i] * s;
      }

      // pointer repel (smoothed)
      let tx = 0, ty = 0;
      if (useMouse) {
        const dx = x - mx, dy = y - my, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2), q = 1 - d / R;
          const push = q * q * 46;
          tx = (dx / d) * push; ty = (dy / d) * push;
        }
      }
      ox[i] += (tx - ox[i]) * 0.14;
      oy[i] += (ty - oy[i]) * 0.14;
      x += ox[i]; y += oy[i];

      px[i] = x; py[i] = y; pp[i] = p;
      const c = clamp(Math.floor((x / W) * NC), 0, NC - 1);
      const al = p < 0.92 ? 0 : p < 1.12 ? 1 : 2;
      const b = c * 3 + al;
      bucket[i] = b;
      counts[b]++;
    }

    // counting sort into buckets → one fill() per colour/alpha
    offs[0] = 0;
    for (let b = 0; b < NB; b++) offs[b + 1] = offs[b] + counts[b];
    fillPos.set(offs.subarray(0, NB));
    for (let i = 0; i < N; i++) order[fillPos[bucket[i]]++] = i;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    const base = small ? 1.25 : 1.45;
    for (let b = 0; b < NB; b++) {
      const n0 = offs[b], n1 = offs[b + 1];
      if (n0 === n1) continue;
      ctx.fillStyle = COLORS[(b / 3) | 0];
      ctx.globalAlpha = ALPHA[b % 3] * alpha;
      ctx.beginPath();
      for (let o = n0; o < n1; o++) {
        const i = order[o];
        const s = base * pp[i];
        ctx.rect(px[i] - s * 0.5, py[i] - s * 0.5, s, s);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.on = true;
    tilt.ty = (e.clientX / W - 0.5) * 0.5;
    tilt.tx = (e.clientY / H - 0.5) * 0.28;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.on = false; });

  resize();
  window.Field = {
    render,
    resize,
    start() { started = true; },
  };
})();
