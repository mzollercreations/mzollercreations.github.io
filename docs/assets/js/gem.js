/* Sapphire Creators — the stone
   A brilliant cut (57 facets) built from its geometry and drawn on a 2D canvas.
   Black polished glass, lit by a fixed studio (softboxes + strip lights), so the
   facets flash as the stone turns. No libraries, one instance per canvas:

     const gem = Gem(canvas);
     gem.draw({ x, y, r, yaw, pitch, roll, dark, alpha, shadow, fire, table });
*/
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const D = 5.2;          // camera distance (girdle radius = 1)
  const DS = 2.4;         // closer camera for shading → light varies across a facet

  /* ---------- geometry ---------- */
  function brilliant() {
    const V = [], F = [];
    const ring = (n, r, y, off) => Array.from({ length: n }, (_, i) => {
      const a = ((i + off) / n) * TAU;
      V.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      return V.length - 1;
    });
    const g = 0.022, hT = 0.33, rt = 0.56, rs = 0.79, hP = 0.86, rl = 0.36;
    const T = ring(8, rt, g + hT, 0);                          // table
    const S = ring(8, rs, g + hT * (1 - rs) / (1 - rt), 0.5);  // star points
    const G = ring(16, 1, g, 0);                               // girdle, top
    const B = ring(16, 1, -g, 0);                              // girdle, bottom
    const L = ring(8, rl, -g - hP * (1 - rl), 0.5);            // lower girdle tips
    V.push([0, -g - hP, 0]);
    const C = V.length - 1;                                    // culet

    const m8 = (i) => (i + 8) % 8, m16 = (i) => (i + 16) % 16;
    F.push({ v: T.slice(), k: 'table' });
    for (let i = 0; i < 8; i++) {
      F.push({ v: [T[i], T[m8(i + 1)], S[i]], k: 'star' });
      F.push({ v: [T[i], S[m8(i - 1)], G[2 * i]], k: 'bezel' });
      F.push({ v: [T[i], G[2 * i], S[i]], k: 'bezel' });
      F.push({ v: [S[i], G[2 * i], G[2 * i + 1]], k: 'ug' });
      F.push({ v: [S[i], G[2 * i + 1], G[m16(2 * i + 2)]], k: 'ug' });
      F.push({ v: [B[2 * i], B[2 * i + 1], L[i]], k: 'lg' });
      F.push({ v: [B[2 * i + 1], B[m16(2 * i + 2)], L[i]], k: 'lg' });
      F.push({ v: [C, L[i], B[2 * i]], k: 'pav' });
      F.push({ v: [C, B[2 * i], L[m8(i - 1)]], k: 'pav' });
    }
    for (let j = 0; j < 16; j++) F.push({ v: [G[j], G[m16(j + 1)], B[m16(j + 1)], B[j]], k: 'girdle' });

    // orient every face outwards and give it a fixed "inner bounce" rotation
    const inside = [0, -0.18, 0];
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const f of F) {
      const c = centroid(V, f.v);
      let n = normal(V, f.v);
      if (dot(n, sub(c, inside)) < 0) { f.v.reverse(); n = normal(V, f.v); }
      f.n = n;
      const ax = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
      f.ax = ax;
      f.ang = 0.7 + rnd() * 1.9;
    }
    return { V, F };
  }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function centroid(V, idx) {
    const c = [0, 0, 0];
    for (const i of idx) { c[0] += V[i][0]; c[1] += V[i][1]; c[2] += V[i][2]; }
    return [c[0] / idx.length, c[1] / idx.length, c[2] / idx.length];
  }
  function normal(V, idx) {
    // Newell's method: robust for slightly non-planar polygons
    const n = [0, 0, 0];
    for (let i = 0; i < idx.length; i++) {
      const a = V[idx[i]], b = V[idx[(i + 1) % idx.length]];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    return norm(n);
  }
  function rotAxis(v, k, a) {
    // Rodrigues
    const c = Math.cos(a), s = Math.sin(a), kv = dot(k, v), kx = cross(k, v);
    return [
      v[0] * c + kx[0] * s + k[0] * kv * (1 - c),
      v[1] * c + kx[1] * s + k[1] * kv * (1 - c),
      v[2] * c + kx[2] * s + k[2] * kv * (1 - c),
    ];
  }

  /* ---------- studio light (view space: x right, y up, z towards the viewer) ---------- */
  const LIGHTS = [
    { d: norm([0.05, 1, 0.42]), a: 0.8, b: 0.95, i: 1.05 },    // big softbox above
    { d: norm([-1, 0.22, 0.38]), a: 0.91, b: 0.955, i: 0.95 },  // strip, left
    { d: norm([1, -0.05, 0.3]), a: 0.93, b: 0.97, i: 0.75 },    // strip, right
    { d: norm([0.25, 0.3, 1]), a: 0.965, b: 0.992, i: 0.9 },    // small key towards camera
    { d: norm([-0.3, -1, 0.2]), a: 0.9, b: 0.95, i: 0.28 },     // bounce from the floor
  ];
  function env(r) {
    // white studio: brighter sky, a pale horizon band, dark floor
    const hz = 1 - Math.min(1, Math.abs(r[1] - 0.08) / 0.32);
    let v = 0.05 + 0.16 * Math.max(0, r[1]) + 0.2 * hz * hz;
    for (const L of LIGHTS) {
      const c = dot(r, L.d);
      if (c > L.a) { const t = Math.min(1, (c - L.a) / (L.b - L.a)); v += L.i * t * t * (3 - 2 * t); }
    }
    return v;
  }
  function shade(n, f, p, camD, fireK) {
    // p: point in view space (gem units), n: facet normal (view space)
    const V = norm([-p[0], -p[1], camD - p[2]]);
    const ndv = Math.max(0, dot(n, V));
    const R = [2 * ndv * n[0] - V[0], 2 * ndv * n[1] - V[1], 2 * ndv * n[2] - V[2]];
    const fr = 0.07 + 0.93 * Math.pow(1 - ndv, 3);
    const inner = env(rotAxis(R, f.axV, f.ang));
    const fire = fireK * (1 - fr) * 0.95 * Math.pow(Math.min(1.4, inner), 1.7);
    return { v: 0.02 + fr * env(R) + fire, fire };
  }
  const tone = (v) => Math.round(255 * Math.pow(Math.min(1, Math.max(0, v)), 0.82));

  /* ---------- instance ---------- */
  function Gem(canvas) {
    const ctx = canvas.getContext('2d');
    const { V, F } = brilliant();
    const P = V.map(() => [0, 0, 0]);   // view-space positions
    const S = V.map(() => [0, 0]);      // screen positions
    let W = 0, H = 0, dpr = 1;

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
    }

    function glint(x, y, s, a) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y);
      ctx.rotate(0.26);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.42);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, s * 0.42, 0, TAU); ctx.fill();
      const w = s * 0.07;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(s, 0); ctx.lineTo(w, w); ctx.lineTo(0, s * 0.72); ctx.lineTo(-w, w);
      ctx.lineTo(-s, 0); ctx.lineTo(-w, -w); ctx.lineTo(0, -s * 0.72); ctx.lineTo(w, -w);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    function draw(o) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!(o.alpha > 0.002) || o.r <= 0) return;
      const cx = o.x * dpr, cy = o.y * dpr, R = o.r * dpr;
      const dark = o.dark || 0;
      const fireK = o.fire == null ? 1 : o.fire;
      const tableK = o.table == null ? 1 : o.table;   // < 1 darkens the table (seen face-up)

      // rotation: roll (z) → yaw (y) → pitch (x)
      const cy_ = Math.cos(o.yaw), sy_ = Math.sin(o.yaw);
      const cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
      const cr = Math.cos(o.roll || 0), sr = Math.sin(o.roll || 0);
      const rot = (v) => {
        let x = v[0], y = v[1], z = v[2];
        let x1 = x * cy_ + z * sy_, z1 = -x * sy_ + z * cy_;           // yaw
        let y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;              // pitch
        return [x1 * cr - y2 * sr, x1 * sr + y2 * cr, z2];             // roll
      };
      for (let i = 0; i < V.length; i++) {
        const p = rot(V[i]);
        P[i][0] = p[0]; P[i][1] = p[1]; P[i][2] = p[2];
        const k = (R * D) / (D - p[2]);
        S[i][0] = cx + p[0] * k;
        S[i][1] = cy - p[1] * k;
      }

      ctx.globalAlpha = o.alpha;

      // soft contact shadow on paper
      if (o.shadow > 0.01) {
        const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        sh.addColorStop(0, `rgba(0,0,0,${(0.2 * o.shadow).toFixed(3)})`);
        sh.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save();
        ctx.translate(cx, cy + R * 1.14);
        ctx.scale(R * 0.95, R * 0.13);
        ctx.fillStyle = sh;
        ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.fill();
        ctx.restore();
      }

      const lw = Math.max(1, dpr * 0.9);
      const edge = `rgba(255,255,255,${(0.1 + 0.22 * dark).toFixed(3)})`;
      const glints = [];
      for (const f of F) {
        const n = rot(f.n);
        const c = centroid(P, f.v);
        if (dot(n, [-c[0], -c[1], D - c[2]]) <= 0) continue;   // back face
        f.axV = rot(f.ax);

        // light at the facet's extreme points → gradient across the facet
        let a = f.v[0], b = f.v[0];
        for (const i of f.v) { if (S[i][1] < S[a][1]) a = i; if (S[i][1] > S[b][1]) b = i; }
        const s0 = shade(n, f, P[a], DS, fireK), s1 = shade(n, f, P[b], DS, fireK), sc = shade(n, f, c, D, fireK);
        const tk = f.k === 'table' ? tableK : 1;
        const g0 = tone(s0.v * tk), g1 = tone(s1.v * tk);

        ctx.beginPath();
        for (let k = 0; k < f.v.length; k++) {
          const q = S[f.v[k]];
          if (k) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]);
        }
        ctx.closePath();
        if (Math.abs(g0 - g1) < 3 || S[b][1] - S[a][1] < 1) {
          const g = (g0 + g1) >> 1;
          ctx.fillStyle = `rgb(${g},${g},${g})`;
        } else {
          const gr = ctx.createLinearGradient(S[a][0], S[a][1], S[b][0], S[b][1]);
          gr.addColorStop(0, `rgb(${g0},${g0},${g0})`);
          gr.addColorStop(1, `rgb(${g1},${g1},${g1})`);
          ctx.fillStyle = gr;
        }
        ctx.fill();
        ctx.lineWidth = lw;
        ctx.strokeStyle = edge;
        ctx.stroke();

        if (sc.fire > 0.62 && f.k !== 'girdle') {
          const sx = (S[a][0] + S[b][0]) / 2, sy = (S[a][1] + S[b][1]) / 2;
          glints.push([sx, sy, Math.min(1, (sc.fire - 0.62) / 0.4)]);
        }
      }

      // sparkle on the brightest facets
      glints.sort((p, q) => q[2] - p[2]);
      for (let i = 0; i < Math.min(3, glints.length); i++) {
        const [x, y, k] = glints[i];
        glint(x, y, R * (0.1 + 0.16 * k), o.alpha * (0.35 + 0.65 * k));
      }
      ctx.globalAlpha = 1;
    }

    resize();
    return { resize, draw };
  }

  window.Gem = Gem;
})();
