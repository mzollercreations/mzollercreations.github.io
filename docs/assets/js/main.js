/* Sapphire Creators — scroll choreography
   No libraries: native scrolling + position: sticky stages, one rAF loop
   that reads a smoothed scroll value and drives every effect from cached
   geometry (no layout reads per frame). The stone itself lives in gem.js. */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const absTop = (el) => el.getBoundingClientRect().top + scrollY;

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const Gem = window.Gem;

  let vw = innerWidth, vh = innerHeight, docH = 1;
  let y = scrollY, sy = y, prevSy = sy, vel = 0, clock = 0;
  let mx = vw / 2, my = vh / 2;   // pointer, viewport px

  /* ---------- word splitting ---------- */
  function splitWords(el, cls) {
    const frag = document.createDocumentFragment();
    let idx = 0;
    const words = (text, inner) => {
      for (const part of text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
        const o = document.createElement('span');
        const s = document.createElement('span');
        o.className = cls;
        o.style.setProperty('--i', idx++);
        s.textContent = part;
        if (inner) s.className = inner;
        o.appendChild(s);
        frag.appendChild(o);
      }
    };
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) words(node.textContent);
      else if (node.nodeName === 'BR') frag.appendChild(document.createElement('br'));
      else if (node.nodeType === 1) words(node.textContent, node.nodeName === 'EM' ? 'it' : node.className);
    }
    el.textContent = '';
    el.appendChild(frag);
    return idx;
  }
  $$('[data-split]').forEach((el) => splitWords(el, 'sw'));

  /* ---------- reveal on enter ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -7% 0px', threshold: 0.12 });
  $$('[data-reveal], [data-split]').forEach((el) => io.observe(el));

  /* ---------- counters ---------- */
  const countIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      countIO.unobserve(e.target);
      const el = e.target, from = +el.dataset.countFrom, to = +el.dataset.countTo;
      const fmt = (n) => Math.round(n).toLocaleString(root.lang || undefined);
      if (reduce) { el.textContent = fmt(to); continue; }
      const t0 = performance.now(), dur = 1700;
      const tick = (now) => {
        const t = clamp((now - t0) / dur), e3 = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(from + (to - from) * e3);
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = fmt(from);
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  $$('[data-count-from]').forEach((el) => countIO.observe(el));

  if (finePointer) addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });

  /* ---------- turning the stone: slow spin + horizontal drag with inertia ----------
     touch-action: pan-y on the stage keeps vertical swipes scrolling the page. */
  function Spinner(el, hit) {
    const s = { yaw: 0.5, vel: reduce ? 0 : 0.36, base: reduce ? 0 : 0.36, drag: false, tx: 0, ty: 0 };
    let id = null, px = 0, last = 0;
    el.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || !hit(e.clientX, e.clientY)) return;
      s.drag = true; id = e.pointerId; px = e.clientX; last = performance.now(); s.vel = 0;
      el.classList.add('grabbing');
    });
    const end = (e) => {
      if (!s.drag || e.pointerId !== id) return;
      s.drag = false; id = null;
      el.classList.remove('grabbing');
    };
    addEventListener('pointermove', (e) => {
      if (finePointer && !s.drag) el.classList.toggle('grab', hit(e.clientX, e.clientY));
      if (!s.drag || e.pointerId !== id) return;
      const now = performance.now(), d = (e.clientX - px) * 0.011;
      px = e.clientX;
      s.yaw += d;
      s.vel = s.vel * 0.5 + (d / Math.max(0.008, (now - last) / 1000)) * 0.5;
      last = now;
    }, { passive: true });
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    s.step = (dt, cx, cy) => {
      if (!s.drag) {
        s.vel += (s.base - s.vel) * (1 - Math.exp(-dt * 1.4));
        s.yaw += s.vel * dt;
      }
      // the stone leans a little towards the pointer
      const tx = finePointer ? clamp((mx - cx) / vw, -0.6, 0.6) : 0;
      const ty = finePointer ? clamp((my - cy) / vh, -0.6, 0.6) : 0;
      s.tx += (tx - s.tx) * (1 - Math.exp(-dt * 3));
      s.ty += (ty - s.ty) * (1 - Math.exp(-dt * 3));
    };
    return s;
  }

  /* ================= MODULES ================= */

  /* hero: the stone turns beside the headline, then we fall into it */
  const hero = (() => {
    const sec = $('.hero'); if (!sec || !Gem) return null;
    const stage = $('.hero-stage', sec), copy = $('.hero-copy', sec), meta = $('.hero-meta', sec);
    const slot = $('#hero-slot'), voidEl = $('.hero-void', sec), canvas = $('#gem-hero');
    const extras = $$('.gem-slot > *', sec);
    const gem = Gem(canvas);
    let top = 0, span = 1, W = 1, H = 1, sx = 0, sy0 = 0, sr = 0, gx = 0, gy = 0, gr = 0, dark = 0, last = '';
    const spin = Spinner(stage, (x, yy) => Math.hypot(x - gx, yy - gy) < gr * 1.45);
    return {
      measure() {
        top = absTop(sec);
        span = Math.max(1, sec.offsetHeight - stage.offsetHeight);
        W = stage.clientWidth; H = stage.clientHeight;
        const a = slot.getBoundingClientRect(), b = stage.getBoundingClientRect();
        sx = a.left - b.left + a.width / 2;
        sy0 = a.top - b.top + a.height / 2;
        sr = Math.min(a.width, a.height) * 0.36;
        gem.resize();
      },
      update(dt) {
        if (y > top + span + vh) { dark = 1; return; }
        const p = clamp((sy - top) / span);
        spin.step(dt, gx, gy);

        // copy drifts up and fades
        const out = smooth(0, 0.26, p);
        copy.style.transform = `translate3d(0,${(-out * 70).toFixed(1)}px,0)`;
        copy.style.opacity = (1 - out).toFixed(3);
        const o2 = (1 - smooth(0, 0.12, p)).toFixed(3);
        meta.style.opacity = o2;
        for (const e of extras) e.style.opacity = o2;

        // the stone glides to the centre, tips its table to the camera and grows
        const m = smooth(0.04, 0.58, p), z = smooth(0.5, 1, p);
        const bob = reduce ? 0 : Math.sin(clock * 1.1) * sr * 0.03 * (1 - m);
        gx = lerp(sx, W / 2, m);
        gy = lerp(sy0, H / 2, m) + bob;
        gr = lerp(sr, Math.min(W, H) * 0.3, m) * Math.pow(10, z * z);
        const pitch = lerp(0.4, 1.32, smooth(0.12, 0.72, p)) + spin.ty * 0.22 * (1 - m);

        // the black opens from behind the stone
        const v = smooth(0.36, 0.86, p);
        const R = Math.hypot(Math.max(gx, W - gx), Math.max(gy, H - gy)) + 2;
        const clip = `circle(${(v * v * R).toFixed(1)}px at ${gx.toFixed(1)}px ${gy.toFixed(1)}px)`;
        if (clip !== last) { voidEl.style.clipPath = clip; last = clip; }
        dark = v;

        gem.draw({
          x: gx, y: gy, r: gr,
          yaw: spin.yaw, pitch, roll: spin.tx * 0.16 * (1 - m),
          dark: smooth(0.3, 0.6, p),
          alpha: 1 - smooth(0.8, 0.97, p),
          shadow: 1 - smooth(0.02, 0.22, p),
          fire: 1 - 0.75 * z,
          table: 1 - 0.8 * smooth(0.2, 0.62, p),
        });
      },
      dark() { return y <= top + span && dark > 0.5; },
    };
  })();

  /* manifest: words light up one after another */
  const manifest = (() => {
    const sec = $('.manifest'); if (!sec) return null;
    const text = $('.manifest-text', sec);
    const n = splitWords(text, 'w');
    const words = $$('.w', text);
    const stage = $('.sticky', sec);
    let top = 0, span = 1, last = -1;
    return {
      measure() { top = absTop(sec); span = Math.max(1, sec.offsetHeight - stage.offsetHeight); },
      update() {
        const p = clamp((sy - top + vh * 0.2) / (span + vh * 0.1));
        const f = smooth(0.05, 0.86, p) * (n + 1.5);
        if (Math.abs(f - last) < 0.004) return;
        last = f;
        for (let i = 0; i < n; i++) words[i].style.opacity = (0.16 + 0.84 * clamp(f - i)).toFixed(3);
      },
    };
  })();

  /* marquee: speed and direction follow the scroll */
  const marquee = (() => {
    const sec = $('.marquee'); if (!sec) return null;
    const rows = $$('.mq-row', sec).map((r) => ({ el: $('.mq-track', r), dir: +r.dataset.dir || 1, x: 0, w: 1 }));
    let top = 0, bot = 0, sign = 1;
    return {
      measure() {
        top = absTop(sec); bot = top + sec.offsetHeight;
        rows.forEach((r) => { r.w = r.el.scrollWidth / 2; });
      },
      update(dt) {
        if (y + vh < top - 50 || y > bot + 50) return;
        if (vel > 0.4) sign = 1; else if (vel < -0.4) sign = -1;
        const speed = reduce ? 0 : 40 + Math.min(Math.abs(vel), 40) * 24;
        for (const r of rows) {
          r.x += r.dir * sign * speed * dt;
          if (r.x <= -r.w) r.x += r.w;
          if (r.x > 0) r.x -= r.w;
          r.el.style.transform = `translate3d(${r.x.toFixed(1)}px,0,0)`;
        }
      },
    };
  })();

  /* services: vertical scroll → horizontal track */
  const services = (() => {
    const sec = $('.services'); if (!sec) return null;
    const stage = $('.sticky', sec), track = $('.track', sec), wrap = $('.track-wrap', sec);
    const cards = $$('.card', sec), vis = cards.map((c) => $('.card-vis', c));
    const count = $('.sp-count b', sec), bar = $('.sp-bar i', sec);
    const tc = $('[data-timecode]', sec), cd = $('[data-countdown]', sec);
    let top = 0, span = 1, shift = 0, idx = -1, cx = [], cw = 0, tcLast = -1;
    const pad = (v) => String(v).padStart(2, '0');
    return {
      measure() {
        sec.style.height = '';
        shift = Math.max(0, track.scrollWidth - wrap.clientWidth);
        sec.style.height = Math.round(shift * 1.1 + stage.offsetHeight * 1.5) + 'px';
        top = absTop(sec);
        span = Math.max(1, sec.offsetHeight - stage.offsetHeight);
        cx = cards.map((c) => c.offsetLeft + c.offsetWidth / 2);
        cw = cards[0] ? cards[0].offsetWidth : 1;
      },
      update() {
        if (y + vh < top || y > top + span + vh) return;
        const p = clamp((sy - top) / span);
        const q = smooth(0.08, 0.95, p);
        const x = -q * shift;
        track.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
        bar.style.transform = `scaleX(${q.toFixed(4)})`;
        const i = Math.min(cards.length, 1 + Math.round(q * (cards.length - 1)));
        if (i !== idx) { idx = i; count.textContent = pad(i); }
        for (let k = 0; k < cards.length; k++) {
          if (!vis[k]) continue;
          const rel = (cx[k] + x - vw / 2) / (vw / 2 + cw);
          vis[k].style.transform = `translate3d(${(rel * -30).toFixed(1)}px,0,0)`;
        }
        // live timecode + countdown in the card visuals
        const fr = Math.floor(clock * 25);
        if (fr !== tcLast) {
          tcLast = fr;
          const s = Math.floor(fr / 25);
          if (tc) tc.textContent = `00:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(fr % 25)}`;
          if (cd) {
            const r = 72 * 3600 - 1 - (s % (72 * 3600));
            cd.textContent = `${pad(Math.floor(r / 3600))}:${pad(Math.floor(r / 60) % 60)}:${pad(r % 60)}`;
          }
        }
      },
    };
  })();

  /* zoom: headline flies into the camera, a black disc opens */
  const zoom = (() => {
    const sec = $('.zoom'); if (!sec) return null;
    const stage = $('.sticky', sec), bigP = $('.zoom-big', sec), big = $('.zoom-big span', sec);
    const disc = $('.zoom-disc', sec), inner = $('.zoom-inner', sec);
    let top = 0, span = 1, R = 1, d = 0;
    return {
      measure() {
        bigP.style.fontSize = '';
        const w = big.offsetWidth;
        const fs = parseFloat(getComputedStyle(bigP).fontSize);
        if (w > 0) bigP.style.fontSize = (fs * (vw * 0.9) / w).toFixed(2) + 'px';
        top = absTop(sec);
        span = Math.max(1, sec.offsetHeight - stage.offsetHeight);
        R = Math.hypot(vw, stage.offsetHeight) / 2 + 2;
      },
      update() {
        if (y + vh < top || y > top + span + vh) { d = y > top ? 1 : 0; return; }
        const p = clamp((sy - top) / span);
        const a = smooth(0.02, 0.62, p);
        big.style.transform = `scale(${Math.pow(26, a * a).toFixed(4)})`;
        big.style.opacity = (1 - smooth(0.5, 0.64, p)).toFixed(3);
        d = smooth(0.3, 0.74, p);
        disc.style.clipPath = `circle(${(d * d * R).toFixed(1)}px at 50% 50%)`;
        const t = smooth(0.64, 0.88, p);
        inner.style.opacity = t.toFixed(3);
        inner.style.transform = `translate3d(0,${((1 - t) * 40).toFixed(1)}px,0) scale(${(0.94 + 0.06 * t).toFixed(4)})`;
      },
      dark() { return y >= top && y <= top + span + vh && d > 0.6; },
    };
  })();

  /* team: typing code */
  const team = (() => {
    const sec = $('.team'); if (!sec) return null;
    const code = $('[data-type]', sec), win = $('.code', sec);
    const chars = [];
    if (code) {
      const walk = (node) => {
        for (const c of Array.from(node.childNodes)) {
          if (c.nodeType === 3) {
            const frag = document.createDocumentFragment();
            for (const ch of c.textContent) {
              const s = document.createElement('span');
              s.className = 'ch';
              s.textContent = ch;
              frag.appendChild(s);
              chars.push(s);
            }
            c.replaceWith(frag);
          } else walk(c);
        }
      };
      walk(code);
    }
    const caret = document.createElement('span');
    caret.className = 'caret';
    let ctop = 0, n = -1;
    return {
      measure() { ctop = win ? absTop(win) : 0; },
      update() {
        if (!chars.length) return;
        const p = reduce ? 1 : clamp((sy + vh * 0.9 - ctop) / (vh * 0.7));
        const k = Math.round(p * chars.length);
        if (k === n) return;
        const lo = Math.max(0, Math.min(n, k)), hi = Math.max(n, k);
        for (let i = lo; i < hi; i++) chars[i].classList.toggle('on', i < k);
        n = k;
        if (k <= 0) chars[0].before(caret);
        else chars[k - 1].after(caret);
      },
    };
  })();

  /* process: cards stack and recede, white → black */
  const stack = (() => {
    const cards = $$('.pcard'); if (!cards.length) return null;
    const shades = cards.map((c) => $('.pcard-shade', c));
    const box = cards[0].parentElement;
    let stick = [];
    return {
      measure() {
        let acc = absTop(box);
        stick = cards.map((c) => {
          const cs = getComputedStyle(c);
          const st = parseFloat(cs.top) || 0;
          const at = acc - st;
          acc += c.offsetHeight + (parseFloat(cs.marginBottom) || 0);
          return at;
        });
      },
      update() {
        const L = cards.length;
        if (y + vh < stick[0] - vh || y > stick[L - 1] + vh * 2) return;
        const cover = stick.map((s, i) => (i < L - 1 ? clamp((sy - s) / Math.max(1, stick[i + 1] - s)) : 0));
        for (let i = 0; i < L; i++) {
          let depth = 0;
          for (let j = i; j < L - 1; j++) depth += cover[j];
          cards[i].style.transform = depth > 0.001 ? `scale(${(1 - depth * 0.045).toFixed(4)})` : '';
          shades[i].style.opacity = Math.min(0.5, depth * 0.3).toFixed(3);
        }
      },
    };
  })();

  /* gem boxes: the stone in its own frame (contact ring, projects page) */
  function GemBox(box) {
    const canvas = $('.gem-canvas', box);
    if (!canvas || !Gem) return null;
    const gem = Gem(canvas), size = +box.dataset.gemSize || 0.27;
    let top = 0, left = 0, h = 1, W = 1, H = 1, cx = 0, cy = 0, idle = false;
    const spin = Spinner(box, (x, yy) => Math.hypot(x - cx, yy - cy) < W * 0.42);
    return {
      measure() {
        const r = box.getBoundingClientRect();
        top = r.top + scrollY; left = r.left;
        h = box.offsetHeight; W = box.clientWidth; H = box.clientHeight;
        gem.resize();
      },
      update(dt) {
        if (y + vh < top || y > top + h) { if (!idle) { gem.draw({ alpha: 0 }); idle = true; } return; }
        idle = false;
        const p = clamp((y + vh - top) / (vh + h));
        cx = left + W / 2; cy = top - y + H / 2;
        spin.step(dt, cx, cy);
        gem.draw({
          x: W / 2, y: H / 2 - W * 0.03, r: W * size,
          yaw: spin.yaw, pitch: 0.3 + (0.5 - p) * 0.5 + spin.ty * 0.2, roll: spin.tx * 0.14,
          dark: 0, alpha: 1, shadow: 0.8,
        });
      },
    };
  }
  const gemBoxes = $$('[data-gem-box]').map(GemBox).filter(Boolean);

  /* browser frames grow to full size as they scroll in */
  const grow = (() => {
    const els = $$('[data-grow]'); if (!els.length || reduce) return null;
    let geo = [];
    return {
      measure() { geo = els.map((el) => { el.style.transform = ''; return [absTop(el), el.offsetHeight]; }); },
      update() {
        for (let i = 0; i < els.length; i++) {
          const [t, h] = geo[i];
          if (sy + vh < t - 80 || sy > t + h) continue;
          const k = smooth(0, 1, (sy + vh - t) / (vh * 0.85));
          els[i].style.transform = `scale(${lerp(0.86, 1, k).toFixed(4)})`;
        }
      },
    };
  })();

  /* depth: elements drift against the scroll (phones on the projects page) */
  const depth = (() => {
    const els = $$('[data-depth]'); if (!els.length || reduce) return null;
    let geo = [];
    return {
      measure() { geo = els.map((el) => { el.style.transform = ''; return [absTop(el) + el.offsetHeight / 2, +el.dataset.depth || 0]; }); },
      update() {
        for (let i = 0; i < els.length; i++) {
          const d = geo[i][0] - (sy + vh / 2);
          if (Math.abs(d) > vh * 1.5) continue;
          els[i].style.transform = `translate3d(0,${(d * geo[i][1]).toFixed(1)}px,0)`;
        }
      },
    };
  })();

  /* footer: giant wordmark fitted to the width, a light sweeps across it */
  const footer = (() => {
    const box = $('.footer-word'); if (!box) return null;
    const span = $('span', box);
    let top = 0;
    return {
      measure() {
        span.style.fontSize = '';
        const avail = box.clientWidth - 2 * parseFloat(getComputedStyle(box).paddingLeft);
        const fs = parseFloat(getComputedStyle(span).fontSize);
        if (span.offsetWidth > 0) span.style.fontSize = (fs * avail / span.offsetWidth).toFixed(2) + 'px';
        top = absTop(box);
      },
      update() {
        if (y + vh < top) return;
        const p = clamp((y + vh - top) / vh);
        span.style.backgroundPosition = `${(100 - p * 100).toFixed(1)}% 50%`;
      },
    };
  })();

  /* nav: hide on scroll down, invert over black sections, progress bar */
  const chrome = (() => {
    const nav = $('#nav'), bar = $('.progress i'), theme = $('meta[name="theme-color"]');
    const darks = $$('[data-dark]');
    let ranges = [], anchorY = y, hidden = false, onDark = false, scrolled = false;
    return {
      measure() { ranges = darks.map((el) => { const t = absTop(el); return [t, t + el.offsetHeight]; }); },
      update() {
        const max = Math.max(1, docH - vh);
        bar.style.transform = `scaleX(${clamp(y / max).toFixed(4)})`;
        const sc = y > 24;
        if (sc !== scrolled) { scrolled = sc; nav.classList.toggle('scrolled', sc); }
        if (Math.abs(y - anchorY) > 10) {
          const h = y > anchorY && y > vh * 0.5 && !root.classList.contains('menu-open');
          anchorY = y;
          if (h !== hidden) { hidden = h; nav.classList.toggle('hide', h); }
        }
        const probe = y + 36;
        let d = ranges.some(([a, b]) => probe >= a && probe < b);
        if (!d && hero && hero.dark()) d = true;
        if (!d && zoom && zoom.dark()) d = true;
        if (d !== onDark) {
          onDark = d;
          nav.classList.toggle('on-dark', d);
          if (theme) theme.content = d ? '#0a0a0a' : '#ffffff';
        }
      },
    };
  })();

  /* ================= LOOP ================= */
  const mods = [hero, manifest, marquee, services, zoom, team, stack, ...gemBoxes, grow, depth, footer, chrome].filter(Boolean);

  function measure() {
    vw = innerWidth; vh = innerHeight;
    if (services) services.measure();          // sets its own height first
    for (const m of mods) if (m !== services && m.measure) m.measure();
    docH = document.documentElement.scrollHeight;
  }

  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    clock += dt;
    y = scrollY;
    sy = reduce ? y : sy + (y - sy) * (1 - Math.exp(-dt * 9));
    if (Math.abs(y - sy) < 0.05) sy = y;
    const v = (sy - prevSy) / Math.max(dt * 60, 0.001);
    vel += (v - vel) * 0.2;
    prevSy = sy;
    for (const m of mods) m.update(dt);
    requestAnimationFrame(frame);
  }

  /* ---------- recordings of live sites: play only while on screen ---------- */
  const videos = $$('video[data-autoplay]');
  if (videos.length && !reduce) {
    const vio = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) { const pr = e.target.play(); if (pr && pr.catch) pr.catch(() => {}); }
        else e.target.pause();
      }
    }, { threshold: 0.15 });
    videos.forEach((v) => vio.observe(v));
  }

  /* ---------- before / after: drag or tap anywhere on the picture, or use the arrow keys ----------
     touch-action: pan-y keeps vertical swipes scrolling the page. */
  $$('[data-compare]').forEach((box) => {
    const range = $('.ba-range', box);
    let drag = false, moved = false, touched = false, id = null, px0 = 0, py0 = 0, axis = null;
    const set = (v) => {
      const pos = clamp(v, 0, 100);
      box.style.setProperty('--pos', pos.toFixed(2) + '%');
      if (range) range.value = Math.round(pos);
    };
    const fromX = (x) => { const r = box.getBoundingClientRect(); set(((x - r.left) / r.width) * 100); };
    const stop = () => { drag = false; id = null; box.classList.remove('dragging'); };
    box.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      drag = true; moved = false; touched = true; id = e.pointerId;
      px0 = e.clientX; py0 = e.clientY;
      axis = e.pointerType === 'mouse' ? 'x' : null;   // touch: wait until the swipe has a direction
      box.classList.add('dragging');
      if (axis) { e.preventDefault(); fromX(e.clientX); }
    });
    addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== id) return;
      if (!axis) {
        const dx = Math.abs(e.clientX - px0), dy = Math.abs(e.clientY - py0);
        if (dx < 6 && dy < 6) return;
        axis = dx > dy ? 'x' : 'y';
      }
      if (axis !== 'x') return;   // vertical swipe: the page scrolls, the slider stays
      moved = true;
      fromX(e.clientX);
    }, { passive: true });
    addEventListener('pointerup', (e) => {
      if (!drag || e.pointerId !== id) return;
      if (!moved && axis !== 'y') fromX(e.clientX);   // a tap jumps there
      stop();
    });
    addEventListener('pointercancel', (e) => { if (e.pointerId === id) stop(); });
    if (range) range.addEventListener('input', () => { touched = true; set(+range.value); });

    // once, when it comes into view: a short sweep that says "move me"
    if (reduce) return;
    const hint = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      hint.disconnect();
      setTimeout(() => {
        const t0 = performance.now();
        const tick = (now) => {
          if (touched) return;
          const t = clamp((now - t0) / 2400);
          set(50 + Math.sin(t * Math.PI * 2) * 22 * (1 - 0.4 * t));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, 450);
    }, { threshold: 0.6 });
    hint.observe(box);
  });

  /* ---------- mobile menu ---------- */
  const burger = $('.burger'), menu = $('#menu');
  if (burger && menu) {
    const label = $('.sr', burger);
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      label.textContent = open ? label.dataset.close : label.dataset.open;
      root.classList.toggle('menu-open', open);
      if (open) {
        menu.hidden = false;
        requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('open')));
        root.style.overflow = 'hidden';
      } else {
        menu.classList.remove('open');
        root.style.overflow = '';
        setTimeout(() => { if (!menu.classList.contains('open')) menu.hidden = true; }, 800);
      }
    };
    burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && root.classList.contains('menu-open')) setOpen(false); });
    addEventListener('resize', () => { if (innerWidth > 1080 && root.classList.contains('menu-open')) setOpen(false); });
  }

  /* ---------- resize ---------- */
  let rT = 0, lastW = vw, lastH = vh;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      const w = innerWidth, h = innerHeight;
      // iOS toolbars change the height while scrolling: only re-layout on real changes
      if (w !== lastW || Math.abs(h - lastH) > 150) { lastW = w; lastH = h; measure(); }
      else vh = h;
    }, 120);
  });
  if ('ResizeObserver' in window) {
    let first = true;
    new ResizeObserver(() => { if (first) { first = false; return; } clearTimeout(rT); rT = setTimeout(measure, 150); })
      .observe($('main'));
  }

  /* ---------- start ---------- */
  measure();
  requestAnimationFrame((t) => { lastT = t; frame(t); });

  const loader = $('.loader');
  const t0 = performance.now();
  const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(() => {
    measure();
    const wait = reduce || !loader ? 0 : Math.max(0, 1500 - (performance.now() - t0));
    setTimeout(() => {
      if (loader) {
        loader.classList.add('done');
        setTimeout(() => loader.remove(), 1200);
      }
      root.classList.add('ready');
      // intro transitions done → scroll-linked fades must not lag behind
      setTimeout(() => root.classList.add('settled'), 1900);
    }, wait);
  });
  addEventListener('load', measure);
})();
