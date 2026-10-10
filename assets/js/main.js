/* mzollercreations — scroll choreography
   No libraries: native scrolling + position: sticky stages, one rAF loop
   that reads a smoothed scroll value and drives every effect from cached
   geometry (no layout reads per frame). */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const absTop = (el) => el.getBoundingClientRect().top + scrollY;

  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const Field = window.Field;

  let vw = innerWidth, vh = innerHeight, docH = 1;
  let y = scrollY, sy = y, prevSy = sy, vel = 0, clock = 0;

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
      else if (node.nodeType === 1) words(node.textContent, node.nodeName === 'EM' ? 'grad-word' : node.className);
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
      if (reduce) { el.textContent = to; continue; }
      const t0 = performance.now(), dur = 1700;
      const tick = (now) => {
        const t = clamp((now - t0) / dur), e3 = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(from + (to - from) * e3);
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = from;
      requestAnimationFrame(tick);
    }
  }, { threshold: 0.6 });
  $$('[data-count-from]').forEach((el) => countIO.observe(el));

  /* ================= MODULES ================= */

  /* hero: lines drift apart, content fades */
  const hero = (() => {
    const sec = $('.hero'); if (!sec) return null;
    const lines = $$('.line', sec).map((el) => ({ el, d: +el.dataset.depth || 0 }));
    const inner = $('.hero-inner', sec), meta = $('.hero-meta', sec);
    let h = 1;
    return {
      measure() { h = sec.offsetHeight; },
      update() {
        if (sy > h * 1.2) return;
        for (const l of lines) l.el.style.transform = `translate3d(0,${(-sy * l.d).toFixed(1)}px,0)`;
        const o = 1 - smooth(h * 0.12, h * 0.7, sy);
        inner.style.opacity = o.toFixed(3);
        meta.style.opacity = o.toFixed(3);
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
        const speed = reduce ? 0 : 46 + Math.min(Math.abs(vel), 40) * 26;
        for (const r of rows) {
          r.x += r.dir * sign * speed * dt;
          if (r.x <= -r.w) r.x += r.w;
          if (r.x > 0) r.x -= r.w;
          r.el.style.transform = `translate3d(${r.x.toFixed(1)}px,0,0)`;
        }
      },
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
        const p = clamp((sy - top + vh * 0.25) / (span + vh * 0.1));
        const f = smooth(0.04, 0.86, p) * (n + 1.5);
        if (Math.abs(f - last) < 0.004) return;
        last = f;
        for (let i = 0; i < n; i++) words[i].style.opacity = (0.14 + 0.86 * clamp(f - i)).toFixed(3);
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
        if (i !== idx) { idx = i; count.textContent = String(i).padStart(2, '0'); }
        for (let k = 0; k < cards.length; k++) {
          if (!vis[k]) continue;
          const rel = (cx[k] + x - vw / 2) / (vw / 2 + cw);
          vis[k].style.transform = `translate3d(${(rel * -36).toFixed(1)}px,0,0)`;
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

  /* zoom: headline flies into the camera, a light disc opens */
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
        const s = Math.pow(26, a * a);
        big.style.transform = `scale(${s.toFixed(4)})`;
        big.style.opacity = (1 - smooth(0.5, 0.64, p)).toFixed(3);
        d = smooth(0.3, 0.74, p);
        disc.style.clipPath = `circle(${(d * d * R).toFixed(1)}px at 50% 50%)`;
        const t = smooth(0.64, 0.88, p);
        inner.style.opacity = t.toFixed(3);
        inner.style.transform = `translate3d(0,${((1 - t) * 40).toFixed(1)}px,0) scale(${(0.94 + 0.06 * t).toFixed(4)})`;
      },
      // nav colour + canvas skipping
      full() { return d > 0.999 && y >= top && y <= top + span; },
      range() { return [top, top + span]; },
    };
  })();

  /* team: light section bounds + typing code */
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
    let top = 0, bot = 0, ctop = 0, n = -1;
    return {
      measure() {
        top = absTop(sec); bot = top + sec.offsetHeight;
        ctop = win ? absTop(win) : 0;
      },
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
      bounds() { return [top, bot]; },
    };
  })();

  /* process: cards stack and recede */
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
          shades[i].style.opacity = Math.min(0.62, depth * 0.36).toFixed(3);
        }
      },
    };
  })();

  /* footer: giant wordmark fitted to the width, gradient follows scroll */
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
        span.style.backgroundPosition = `${(p * 150).toFixed(1)}% 50%`;
      },
    };
  })();

  /* nav: hide on scroll down, colour on light sections, progress bar */
  const chrome = (() => {
    const nav = $('#nav'), bar = $('.progress i');
    let anchorY = y, hidden = false, light = false, scrolled = false;
    return {
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
        let l = false;
        if (team) { const [a, b] = team.bounds(); l = y + 36 >= a && y + 36 < b; }
        if (!l && zoom && zoom.full()) l = true;
        if (l !== light) { light = l; nav.classList.toggle('light', l); }
      },
    };
  })();

  /* particle scenes: anchors = tops of [data-scene] sections */
  const scenes = (() => {
    const secs = $$('[data-scene]').sort((a, b) => a.dataset.scene - b.dataset.scene);
    let B = [];
    return {
      measure() { B = secs.map(absTop); },
      value() {
        let f = 0;
        for (let k = 1; k < B.length; k++) {
          const t = smooth(B[k] - vh * 0.95, B[k] - vh * 0.12, sy);
          if (t <= 0) break;
          f = k - 1 + t;
        }
        return f;
      },
    };
  })();

  function covered() {
    if (zoom && zoom.full()) return true;
    if (team) { const [a, b] = team.bounds(); if (y >= a && y + vh <= b - 2) return true; }
    return false;
  }

  /* ================= LOOP ================= */
  const mods = [hero, marquee, manifest, services, zoom, team, stack, footer].filter(Boolean);

  function measure() {
    vw = innerWidth; vh = innerHeight;
    if (services) services.measure();          // sets its own height first
    for (const m of mods) if (m !== services) m.measure();
    scenes.measure();
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
    chrome.update();
    if (Field) Field.render(dt, scenes.value(), vel, sy, covered());
    requestAnimationFrame(frame);
  }

  /* ---------- cursor + magnetic buttons ---------- */
  if (finePointer && !reduce) {
    root.classList.add('has-cursor');
    const cur = $('.cursor');
    let cx = -100, cy = -100, tx = -100, ty = -100;
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    document.addEventListener('pointerover', (e) => {
      cur.classList.toggle('hover', !!e.target.closest('a, button, .card'));
    });
    document.addEventListener('pointerleave', () => cur.classList.add('hidden'));
    document.addEventListener('pointerenter', () => cur.classList.remove('hidden'));
    (function follow() {
      cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
      cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`;
      requestAnimationFrame(follow);
    })();

    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.translate = `${(dx * 0.22).toFixed(1)}px ${(dy * 0.3).toFixed(1)}px`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'translate .6s cubic-bezier(.16,1,.3,1), color .4s, box-shadow .5s';
        el.style.translate = '';
        setTimeout(() => { el.style.transition = ''; }, 600);
      });
    });
  }

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
      if (Field) Field.resize();
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
    const wait = reduce ? 0 : Math.max(0, 1150 - (performance.now() - t0));
    setTimeout(() => {
      if (loader) {
        loader.classList.add('done');
        setTimeout(() => loader.remove(), 1200);
      }
      root.classList.add('ready');
      if (Field) Field.start();
    }, wait);
  });
  addEventListener('load', measure);
})();
