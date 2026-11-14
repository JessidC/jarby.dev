// The scenes of the story: the request trace (chapter 3), the learning loop (chapter 6) and the
// triage (chapter 8), animated with anime.js. This file only moves things: where a marker is, how far
// a line is drawn, when a step turns on. Colors and states are classes in site.css, so both themes
// and print keep working. The short gestures of the page and the floor that decides what may move
// are in motion.js, which has no library and loads first.
// scripts/build.mjs bundles this into assets/flows.js. If it never loads, site.js runs the CSS version.
import { createTimeline } from 'animejs/timeline';
import { createDrawable } from 'animejs/svg';
import { cubicBezier } from 'animejs/easings';
import { set, stagger } from 'animejs/utils';
import { engine } from 'animejs/engine';

const NS = 'http://www.w3.org/2000/svg';
const EASE = cubicBezier(0.16, 1, 0.3, 1); // same curve as --ease in site.css
const R = 4;                               // corner of the connectors, same as --radius

const S = (name, attrs, parent) => {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const mark = (cls) => {
  const n = document.createElement('span');
  n.className = cls;
  n.setAttribute('aria-hidden', 'true');
  return n;
};
const line = (l, x1, y1, x2, y2) => {
  l.setAttribute('x1', x1); l.setAttribute('y1', y1);
  l.setAttribute('x2', x2); l.setAttribute('y2', y2);
};
// Top-left corner of the area where absolutely positioned children of `box` are placed.
const origin = (box) => {
  const r = box.getBoundingClientRect();
  return { x: r.left + box.clientLeft, y: r.top + box.clientTop };
};
// A polyline with rounded corners, as SVG path data.
const rounded = (pts) => {
  let d = 'M' + pts[0][0] + ' ' + pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], prev = pts[i - 1], next = pts[i + 1];
    if (!next) { d += ' L' + p[0] + ' ' + p[1]; break; }
    const ax = p[0] - Math.sign(p[0] - prev[0]) * R, ay = p[1] - Math.sign(p[1] - prev[1]) * R;
    const bx = p[0] + Math.sign(next[0] - p[0]) * R, by = p[1] + Math.sign(next[1] - p[1]) * R;
    d += ' L' + ax + ' ' + ay + ' Q' + p[0] + ' ' + p[1] + ' ' + bx + ' ' + by;
  }
  return d;
};
const between = (min, v, max) => Math.max(min, Math.min(max, v));
const overlay = (before) => {
  const svg = S('svg', { class: 'fx-lines', 'aria-hidden': 'true' });
  before.parentNode.insertBefore(svg, before);
  return svg;
};
const onResize = (box, fn) => {
  if (!('ResizeObserver' in window)) return;
  let width = 0, height = 0;
  new ResizeObserver(() => {
    const r = box.getBoundingClientRect();
    if (Math.abs(r.width - width) < 0.5 && Math.abs(r.height - height) < 0.5) return;
    width = r.width; height = r.height;
    fn();
  }).observe(box);
};
const pen = (path) => createDrawable(path)[0];
const draw = (t, p, at, duration, ease) => t.add(p, { draw: ['0 0', '0 1'], duration, ease: ease || 'inOut(2)' }, at);
// Moves something along a path. `place` gets the point for each frame.
const along = (t, path, at, duration, place) => {
  const o = { p: 0 }, len = path.getTotalLength();
  t.add(o, { p: [0, 1], duration, ease: 'inOut(2)', onUpdate: () => place(path.getPointAtLength(len * o.p)) }, at);
};
// Text that resolves from left to right over what was there, a few scrambled characters ahead of the cursor.
const GLYPHS = 'abcdefghijklmnopqrstuvwxyz';
const write = (t, nodes, prev, lines, at, duration) => {
  const total = lines.reduce((a, l) => a + l.length, 0), o = { p: 0 };
  t.add(o, { p: [0, 1], duration, ease: 'linear', onUpdate: () => {
    let left = Math.round(total * o.p), open = true;
    nodes.forEach((node, i) => {
      const l = lines[i] || '', n = Math.min(l.length, left);
      left -= n;
      let s = l.slice(0, n);
      if (n < l.length) {
        if (open) { for (let k = Math.min(3, l.length - n); k > 0; k--) s += GLYPHS[(Math.random() * 26) | 0]; open = false; }
        s += (prev[i] || '').slice(s.length);
      }
      node.textContent = s;
    });
  } }, at);
};
// Breaks a sentence in two lines of similar length.
const halves = (text) => {
  let cut = -1;
  for (let i = text.indexOf(' '); i > -1; i = text.indexOf(' ', i + 1)) {
    if (cut < 0 || Math.abs(i - text.length / 2) < Math.abs(cut - text.length / 2)) cut = i;
  }
  return cut < 0 ? [text, ''] : [text.slice(0, cut), text.slice(cut + 1)];
};

// Slow devices. theme-init.js marks the ones that say they are small with .lite, and `probe` adds
// it when real frames come late while a scene plays. In lite the short gestures are off (those
// blocks keep the CSS reveal), the scenes skip their most expensive effects and run at 30 frames.
let lite = document.documentElement.classList.contains('lite');
const goLite = () => { lite = true; engine.fps = 30; document.documentElement.classList.add('lite'); };
if (lite) goLite();
const probe = () => {
  if (lite) return;
  let last = 0, n = 0, late = 0;
  const tick = (now) => {
    if (last && now - last > 30) late++;
    last = now;
    if (++n < 45) requestAnimationFrame(tick);
    else if (late >= 18) goLite();
  };
  requestAnimationFrame(tick);
};

// The floor (see motion.js) gives a scene the page to itself while it plays and pauses it when it
// leaves the screen. Without it, a scene simply plays the first time it is seen.
const floor = window.siteFloor || null;
const whenSeen = (el, ratio, fn) => {
  if (!('IntersectionObserver' in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) { io.disconnect(); fn(); } }, { threshold: ratio });
  io.observe(el);
};

// A scene is an SVG drawn in viewBox units inside a box that can scroll sideways, with a caption
// under it that says what is happening. On narrow screens the scene is wider than its window, so
// `pan` moves the window to follow the action.
const sceneBox = (before, w, h) => {
  const wrap = document.createElement('div');
  wrap.className = 'stage';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.tabIndex = -1;
  const svg = S('svg', { class: 'stage-svg', viewBox: '0 0 ' + w + ' ' + h }, wrap);
  const cap = document.createElement('p');
  cap.className = 'stage-cap';
  cap.setAttribute('aria-hidden', 'true');
  const parts = ['n', 'k', 't'].map((cls) => { const s = document.createElement('span'); s.className = cls; cap.appendChild(s); return s; });
  before.parentNode.insertBefore(wrap, before);
  before.parentNode.insertBefore(cap, before);
  const text = (x, y, cls, str, anchor) => {
    const n = S('text', { x, y, class: cls, 'text-anchor': anchor || 'start' }, svg);
    n.textContent = str || '';
    return n;
  };
  const say = (line) => parts.forEach((p, i) => { p.textContent = (line && line[i]) || ''; });
  // Keeps room for the longest caption, so the page below never moves while the scene plays. All
  // the captions are laid out at once in hidden copies, so this costs one layout, not one per line.
  const fit = (lines) => {
    const width = cap.clientWidth;
    if (!width) return;
    const box = document.createElement('div');
    box.style.position = 'absolute'; box.style.visibility = 'hidden'; box.style.pointerEvents = 'none';
    box.style.left = '0'; box.style.top = '0'; box.style.width = width + 'px';
    const copies = lines.map((l) => {
      const c = cap.cloneNode(true);
      c.style.minHeight = '0';
      Array.from(c.children).forEach((p, i) => { p.textContent = l[i] || ''; });
      return box.appendChild(c);
    });
    cap.parentNode.appendChild(box);
    const tall = Math.max(0, ...copies.map((c) => c.getBoundingClientRect().height));
    box.remove();
    if (tall) cap.style.minHeight = Math.ceil(tall) + 'px';
  };
  const caption = (t, line, when) => {
    t.call(() => say(line), when);
    t.add(cap, { opacity: [0.3, 1], duration: 320, ease: 'out(2)' }, when);
  };
  const panner = (t) => {
    let cam = 0;
    return (x, when) => {
      const room = wrap.scrollWidth - wrap.clientWidth;
      if (room < 2) return;
      const to = between(0, x * wrap.scrollWidth / w - wrap.clientWidth / 2, room);
      t.add(wrap, { scrollLeft: [cam, to], duration: 560, ease: EASE }, Math.max(0, when));
      cam = to;
    };
  };
  return { wrap, svg, text, say, fit, caption, panner, visible: () => wrap.getClientRects().length > 0 };
};

// Chapter 3, the scene. The same request, drawn: the question is rewritten, the index is searched,
// the passages are reranked and the answer is written from them. Coordinates are viewBox units.
const VIEW = [1060, 316];
const GRID = { cols: 12, rows: 8, x: 418, y: 100, gap: 16, band: [3, 9], q: [6, 3], hits: [[5, 2], [6, 3], [7, 3], [6, 4], [8, 4], [5, 5]] };
const BARS = { x: 650, y: 101, pitch: 20, h: 10, max: 140, floor: 80, found: [96, 70, 118, 54, 84, 62], ranked: [58, 124, 92, 40, 110, 66], weak: [58, 66, 52, 30, 62, 44] };
const TOKENS = [[30, 20, 36, 24, -14], [22, 34, 18, 30, 26], [36, -14, 24, 32, 20], [28, 22, -14]]; // negative: a citation
const ANSWER = { x: 836, y: 101, w: 208, h: 110 };

function buildStage(box, steps, outs, before) {
  const ask = box.dataset.ask, full = box.dataset.full;
  if (steps.length !== 7 || outs.length < 2 || !ask || !full) return null;
  const name = (el, sel) => { const n = el.querySelector(sel); return n ? n.textContent : ''; };
  const scene = sceneBox(before, VIEW[0], VIEW[1]);
  const { wrap, svg, text } = scene;
  const wire = (d, cls) => S('path', { d, class: cls || 'st-wire' }, svg);
  const flow = (d) => pen(S('path', { d: d || 'M0 0', class: 'st-flow' }, svg));
  const mid = 156;

  // Wires first, so everything else sits on top of them.
  const D = {
    a: 'M232 131 C248 131 240 ' + mid + ' 256 ' + mid,
    b: 'M320 ' + mid + ' L410 ' + mid,
    c: 'M602 ' + mid + ' L650 ' + mid,
    d: 'M790 ' + mid + ' L836 ' + mid,
    arc: 'M288 122 C288 34 374 30 474 30 L860 30 C916 30 940 52 940 ' + ANSWER.y,
    hand: 'M720 222 C720 270 770 288 828 288',
  };
  wire(D.a); wire(D.b); wire(D.c); wire(D.d); wire(D.arc, 'st-wire alt'); wire(D.hand, 'st-wire alt');
  const arcPath = S('path', { d: D.arc, class: 'st-flow' }, svg), handPath = S('path', { d: D.hand, class: 'st-flow' }, svg);
  const pens = { a: flow(D.a), b: flow(D.b), arc: pen(arcPath), hand: pen(handPath), feeds: [0, 1, 2].map(() => flow()) };

  const labels = [
    text(16, 193, 'st-label', name(steps[0], '.k')),
    text(16, 84, 'st-label', name(steps[1], '.k')),
    text(256, 84, 'st-label', name(steps[2], '.k')),
    text(410, 84, 'st-label', name(steps[3], '.k')),
    text(650, 84, 'st-label', name(steps[4], '.k')),
    text(ANSWER.x, 84, 'st-label', name(steps[5], '.k')),
    text(ANSWER.x + ANSWER.w, 84, 'st-label', name(steps[6], '.k'), 'end'),
  ];

  // The question and the rules it goes through.
  const qBox = S('rect', { x: 16, y: 100, width: 216, height: 62, rx: 8, class: 'st-box' }, svg);
  const qText = [text(30, 126, 'st-text'), text(30, 147, 'st-text')];
  const checks = [0, 1, 2, 3].map((i) => {
    const x = 152 + i * 20;
    return {
      box: S('rect', { x, y: 181, width: 14, height: 14, rx: 3, class: 'st-check' }, svg),
      tick: pen(S('path', { d: 'M' + (x + 3.5) + ' 188.5 l2.5 2.5 l4.5 -5.5', class: 'st-tick' }, svg)),
    };
  });

  // Curated answers: a small stack that is scanned for a close match.
  const cards = [126, 148, 170].map((y) => S('rect', { x: 256, y, width: 64, height: 16, rx: 3, class: 'st-card' }, svg));
  const scan = S('line', { x1: 250, x2: 326, y1: 122, y2: 122, class: 'st-scan' }, svg);

  // The index: every dot is a passage. The band is the ERP module the search is filtered by.
  const dots = [];
  for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) {
    dots.push(S('circle', { cx: GRID.x + c * GRID.gap, cy: GRID.y + r * GRID.gap, r: 2.6, class: 'st-dot' }, svg));
  }
  const at = (c, r) => r * GRID.cols + c;
  const outside = dots.filter((d, i) => i % GRID.cols < GRID.band[0] || i % GRID.cols > GRID.band[1]);
  const hits = GRID.hits.map((h) => dots[at(h[0], h[1])]);
  const band = pen(S('rect', {
    x: GRID.x + GRID.band[0] * GRID.gap - 8, y: GRID.y - 8, rx: 4, class: 'st-band',
    width: (GRID.band[1] - GRID.band[0]) * GRID.gap + 16, height: (GRID.rows - 1) * GRID.gap + 16,
  }, svg));
  const qx = GRID.x + GRID.q[0] * GRID.gap, qy = GRID.y + GRID.q[1] * GRID.gap;

  // What the search found, as bars. The reranker reorders them and a floor cuts the weak ones.
  const slot = (r) => BARS.y + r * BARS.pitch;
  BARS.found.forEach((w, i) => S('rect', { x: BARS.x, y: slot(i), width: BARS.max, height: BARS.h, rx: 2, class: 'st-track' }, svg));
  const bars = BARS.found.map((w, i) => S('rect', { x: BARS.x, y: slot(i), width: w, height: BARS.h, rx: 2, class: 'st-bar' }, svg));
  const floor = S('line', { x1: BARS.x + BARS.floor, x2: BARS.x + BARS.floor, y1: BARS.y - 7, y2: slot(5) + BARS.h + 7, class: 'st-floor' }, svg);
  const fly = hits.map(() => S('circle', { r: 3.2, class: 'st-fly' }, svg));

  // The answer, written token by token. The accent tokens are its citations.
  const aBox = S('rect', { x: ANSWER.x, y: ANSWER.y, width: ANSWER.w, height: ANSWER.h, rx: 8, class: 'st-box' }, svg);
  const tokens = [];
  TOKENS.forEach((row, r) => {
    let x = ANSWER.x + 16;
    row.forEach((w) => {
      tokens.push(S('rect', { x, y: ANSWER.y + 20 + r * 22, width: Math.abs(w), height: 8, rx: 2, class: w < 0 ? 'st-tok cite' : 'st-tok' }, svg));
      x += Math.abs(w) + 6;
    });
  });
  const cites = tokens.filter((n) => n.classList.contains('cite'));
  const badge = S('g', { class: 'st-badge' }, svg);
  const bx = ANSWER.x + ANSWER.w, by = ANSWER.y;
  S('circle', { cx: bx, cy: by, r: 11 }, badge);
  const badgeTick = pen(S('path', { d: 'M' + (bx - 5) + ' ' + by + ' l3.5 3.5 l6.5 -7.5', class: 'st-tick' }, badge));
  const exitA = text(ANSWER.x, 234, 'st-label', name(outs[0], '.mono'));
  const person = S('g', { class: 'st-person' }, svg);
  S('circle', { cx: 846, cy: 280, r: 6 }, person);
  S('path', { d: 'M834 302 a12 12 0 0 1 24 0' }, person);
  const exitB = text(868, 293, 'st-label', name(outs[1], '.mono'));

  const pulse = S('circle', { cx: qx, cy: qy, r: 5, class: 'st-pulse' }, svg);
  const req = S('circle', { r: 4.5, class: 'st-req' }, svg);
  const card = S('rect', { width: 64, height: 16, rx: 3, class: 'st-card on' }, svg);
  const marked = labels.concat([qBox, aBox, floor, person, exitA, exitB, wrap], cards, bars, hits, fly, checks.map((c) => c.box));
  const allPens = [pens.a, pens.b, pens.arc, pens.hand, band, badgeTick].concat(pens.feeds, checks.map((c) => c.tick));

  function reset() {
    wrap.scrollLeft = 0;
    scene.say(null);
    marked.forEach((n) => n.classList.remove('on', 'done', 'miss', 'hit', 'low', 'go', 'asis'));
    qText.forEach((n) => { n.textContent = ''; });
    allPens.forEach((p) => p.setAttribute('draw', '0 0'));
    bars.forEach((b, i) => b.setAttribute('width', BARS.found[i]));
    set(dots, { opacity: 1, scale: 1 });
    set(bars, { opacity: 0, scaleX: 0, translateY: 0 });
    set(tokens, { opacity: 0, scaleX: 1, scale: 1 });
    set(checks.map((c) => c.box), { scale: 1 });
    set([req, card, scan, badge, pulse], { opacity: 0 });
  }

  // Adds the scene to the timeline. Returns when each step starts and when the request leaves.
  function compose(t, kind) {
    const m = [];
    const on = (n, cls, when) => t.call(() => n.classList.add(cls || 'on'), when);
    const move = (x1, y1, x2, y2, when, duration) => t.add(req, { cx: [x1, x2], cy: [y1, y2], duration }, when);
    const lines = halves(full);
    const pan = scene.panner(t);
    let now = 0;

    on(qBox, 'on', now);
    write(t, qText, ['', ''], [ask, ''], now, 420);
    now += 480;

    m[0] = now; on(labels[0], 'on', now);
    checks.forEach((c, i) => {
      const when = now + i * 80;
      on(c.box, 'on', when);
      t.add(c.box, { scale: [{ to: 1.3, duration: 90 }, { to: 1, duration: 180 }] }, when);
      draw(t, c.tick, when + 40, 200);
    });
    now += 560;

    m[1] = now; on(labels[1], 'on', now);
    write(t, qText, [ask, ''], lines, now, 760);
    now += 840;

    t.add(req, { opacity: [0, 1], duration: 100 }, now);
    move(232, 131, 256, mid, now, 240);
    draw(t, pens.a, now, 240);
    now += 240;

    m[2] = now; on(labels[2], 'on', now); pan(288, now - 200);
    t.add(scan, { y1: [122, 190], y2: [122, 190], duration: 440 }, now);
    t.add(scan, { opacity: [{ to: 1, duration: 60 }, { to: 1, duration: 300 }, { to: 0, duration: 80 }] }, now);
    now += 460;
    if (kind === 'curated') {
      // A close match: the approved answer goes straight to the customer, nothing is generated.
      t.add(req, { opacity: [1, 0], duration: 120 }, now);
      on(cards[1], 'on', now);
      cards.forEach((c, i) => { if (i !== 1) on(c, 'miss', now); });
      t.add(cards[1], { scale: [{ to: 1.12, duration: 110 }, { to: 1, duration: 220 }] }, now);
      now += 380;
      t.add(card, { opacity: [0, 1], duration: 80 }, now);
      pan(940, now + 200);
      along(t, arcPath, now, 820, (p) => { card.setAttribute('x', p.x - 32); card.setAttribute('y', p.y - 8); });
      draw(t, pens.arc, now, 820);
      now += 820;
      t.add(card, { opacity: [1, 0], duration: 160 }, now);
      on(wrap, 'asis', now); on(aBox, 'done', now); on(exitA, 'on', now);
      t.add(tokens, { opacity: [0, 1], duration: 260, delay: stagger(8) }, now);
      return { marks: m, end: now + 300 };
    }
    cards.forEach((c) => on(c, 'miss', now));
    move(320, mid, 406, mid, now, 240);
    draw(t, pens.b, now, 240);
    move(406, mid, qx, qy, now + 240, 200);
    now += 440;

    m[3] = now - 200; on(labels[3], 'on', m[3]); pan(506, m[3] - 240);
    t.add(req, { opacity: [1, 0], duration: 140 }, now);
    t.add(pulse, { opacity: [0.8, 0], scale: [1, 5], duration: 620, ease: 'out(3)' }, now);
    t.add(outside, { opacity: [1, 0.25], duration: 320 }, now - 120);
    draw(t, band, now - 120, 380);
    // The wave over the whole index is the most expensive effect of the scene, so a slow device skips it.
    if (!lite) t.add(dots, {
      scale: [{ to: 2.2, duration: 150, ease: 'out(2)' }, { to: 1, duration: 380, ease: 'out(3)' }],
      delay: stagger(26, { grid: [GRID.cols, GRID.rows], from: at(GRID.q[0], GRID.q[1]) }),
    }, now);
    now += 560;
    hits.forEach((h, k) => on(h, 'hit', now + k * 45));
    t.add(hits, { scale: [1, 1.75], duration: 280, ease: EASE, delay: stagger(45) }, now);
    now += 520;

    // The passages leave the index and land as bars, in the order the search returned them.
    hits.forEach((h, k) => {
      const when = now + k * 55;
      on(fly[k], 'go', when);
      t.add(fly[k], { cx: [+h.getAttribute('cx'), BARS.x], cy: [+h.getAttribute('cy'), slot(k) + BARS.h / 2], duration: 420 }, when);
      t.call(() => fly[k].classList.remove('go'), when + 420);
      t.add(bars[k], { opacity: [0, 1], duration: 80 }, when + 400);
      t.add(bars[k], { scaleX: [0, 1], duration: 320, ease: EASE }, when + 400);
    });
    now += 5 * 55 + 420;

    m[4] = now; on(labels[4], 'on', now); pan(720, now - 500);
    now += 380;
    const scores = kind === 'weak' ? BARS.weak : BARS.ranked;
    const order = scores.map((s, i) => i).sort((a, b) => scores[b] - scores[a]);
    order.forEach((i, rank) => {
      t.add(bars[i], { translateY: [0, (rank - i) * BARS.pitch], width: [BARS.found[i], scores[i]], duration: 640, ease: EASE }, now + rank * 40);
    });
    now += 640 + 200;
    on(floor, 'go', now);
    order.forEach((i, rank) => { if (scores[i] < BARS.floor) on(bars[i], 'low', now + 180 + rank * 40); });
    now += 560;
    if (kind === 'weak') {
      // Nothing clears the floor: the chat goes to a person instead of a guess.
      t.add(req, { opacity: [0, 1], duration: 100 }, now);
      pan(850, now);
      along(t, handPath, now, 640, (p) => { req.setAttribute('cx', p.x); req.setAttribute('cy', p.y); });
      draw(t, pens.hand, now, 640);
      now += 640;
      t.add(req, { opacity: [1, 0], duration: 160 }, now);
      on(person, 'on', now); on(exitB, 'on', now);
      return { marks: m, end: now + 200 };
    }
    order.slice(0, 3).forEach((i, rank) => {
      const y = slot(rank) + BARS.h / 2, ty = mid - 12 + rank * 12, x = BARS.x + scores[i] + 5;
      pens.feeds[rank].setAttribute('d', 'M' + x + ' ' + y + ' C' + (x + 46) + ' ' + y + ' ' + (ANSWER.x - 40) + ' ' + ty + ' ' + ANSWER.x + ' ' + ty);
      draw(t, pens.feeds[rank], now + rank * 70, 340);
    });
    now += 460;

    m[5] = now; on(labels[5], 'on', now); on(aBox, 'on', now); pan(940, now - 400);
    if (lite) t.add(tokens, { opacity: [0, 1], duration: 400 }, now);
    else t.add(tokens, { opacity: [0, 1], scaleX: [0, 1], duration: 220, ease: EASE, delay: stagger(40) }, now);
    now += lite ? 500 : (tokens.length - 1) * 40 + 300;

    m[6] = now; on(labels[6], 'on', now);
    t.add(cites, { scale: [{ to: 1.7, duration: 140 }, { to: 1, duration: 280 }], delay: stagger(120) }, now);
    t.add(order.slice(0, 3).map((i) => bars[i]), { opacity: [{ to: 0.35, duration: 140 }, { to: 1, duration: 280 }], delay: stagger(120) }, now);
    now += 620;
    t.add(badge, { opacity: [0, 1], scale: [0.2, 1], duration: 340, ease: 'outBack(1.8)' }, now);
    draw(t, badgeTick, now + 160, 260);
    on(aBox, 'done', now); on(exitA, 'on', now + 200);
    return { marks: m, end: now + 420 };
  }

  reset();
  return { reset, compose, wrap, visible: scene.visible, caption: scene.caption, fit: scene.fit, say: scene.say };
}

// Chapter 6, the scene. A batch of closed chats goes through the filters, each survivor is rebuilt as a
// question and its answer, and what an expert approves fills a gap in the index.
const LOOP = { w: 1060, h: 250, mid: 128, stops: [40, 300, 470, 650], gate: 250, cols: 10, rows: 7, x: 872, y: 80, gap: 16,
  holes: [[2, 1], [6, 2], [4, 4], [8, 5], [1, 5], [7, 0]], known: [[3, 3], [5, 1], [8, 2], [2, 5]] };

function buildLoop(items, fate, before) {
  if (items.length !== 5) return null;
  const scene = sceneBox(before, LOOP.w, LOOP.h);
  const { wrap, svg, text } = scene;
  const n = fate.length, X = LOOP.stops;
  const pitch = Math.min(17, 170 / n), top = LOOP.mid - ((n - 1) * pitch) / 2 - 5;
  const row = (k) => top + k * pitch;
  const labels = [X[0], LOOP.gate - 8, X[2], X[3], LOOP.x - 8].map((x, i) => text(x, 30, 'st-label', '0' + (i + 1)));
  S('line', { x1: LOOP.gate, x2: LOOP.gate, y1: 44, y2: 214, class: 'st-gate' }, svg);

  const dots = [], holes = [], known = [];
  const is = (list, c, r) => list.findIndex((p) => p[0] === c && p[1] === r);
  for (let r = 0; r < LOOP.rows; r++) for (let c = 0; c < LOOP.cols; c++) {
    const hole = is(LOOP.holes, c, r), d = S('circle', { cx: LOOP.x + c * LOOP.gap, cy: LOOP.y + r * LOOP.gap, r: 2.8, class: hole > -1 ? 'st-dot hole' : 'st-dot' }, svg);
    dots.push(d);
    if (hole > -1) holes[hole] = d;
    if (is(LOOP.known, c, r) > -1) known[is(LOOP.known, c, r)] = d;
  }
  const links = fate.map(() => pen(S('path', { d: 'M0 0', class: 'st-link' }, svg)));
  const rings = fate.map(() => S('circle', { r: 5, class: 'st-pulse' }, svg));
  const cards = fate.map(() => {
    const g = S('g', { class: 'st-chat' }, svg);
    return {
      g,
      q: S('rect', { width: 46, height: 10, rx: 3, class: 'st-q' }, g),
      a: S('rect', { x: 24, width: 30, height: 10, rx: 3, class: 'st-a' }, g),
      ok: pen(S('path', { d: 'M62 5 l3 3 l5.5 -6.5', class: 'st-ok' }, g)),
    };
  });
  const scan = S('line', { x1: X[2] - 8, x2: X[2] + 62, y1: 40, y2: 40, class: 'st-scan' }, svg);

  function reset() {
    wrap.scrollLeft = 0;
    scene.say(null);
    labels.concat(dots, cards.map((c) => c.g)).forEach((el) => el.classList.remove('on', 'low', 'aim', 'hit'));
    cards.forEach((c) => { c.q.setAttribute('width', 46); c.ok.setAttribute('draw', '0 0'); });
    links.forEach((l) => l.setAttribute('draw', '0 0'));
    set(cards.map((c) => c.g), { opacity: 0, rotate: 0, scale: 1 });
    set(cards.map((c) => c.a), { opacity: 0, scaleX: 0 });
    set(dots, { scale: 1 });
    set(rings.concat([scan]), { opacity: 0 });
  }

  function compose(t) {
    const m = [], pan = scene.panner(t);
    const on = (el, cls, when) => t.call(() => el.classList.add(cls), when);
    // A card that is dropped stays where it was stopped, greyed, so the finished scene reads as a funnel.
    const out = (k, when) => {
      on(cards[k].g, 'low', when);
      t.add(cards[k].g, { translateY: [row(k), row(k) + 5], rotate: [0, -5], duration: 460, ease: 'out(3)' }, when);
    };
    const left = (step) => cards.map((c, k) => k).filter((k) => fate[k] < 0 || fate[k] >= step);
    let now = 0;

    m[0] = 0; on(labels[0], 'on', 0);
    cards.forEach((c, k) => {
      set(c.g, { translateX: X[0] - 44, translateY: row(k) });
      t.add(c.g, { translateX: [X[0] - 44, X[0]], opacity: [0, 1], duration: 440, ease: EASE }, k * 45);
      if (fate[k] === 0) out(k, k * 45 + 460);
    });
    now = (n - 1) * 45 + 620;

    // Staffing, frustration or risk: stopped at the gate, before any model call.
    m[1] = now; on(labels[1], 'on', now); pan(LOOP.gate, now - 200);
    left(1).forEach((k, j) => {
      const when = now + j * 40;
      if (fate[k] === 1) { t.add(cards[k].g, { translateX: [X[0], LOOP.gate - 62], duration: 420 }, when); out(k, when + 420); }
      else t.add(cards[k].g, { translateX: [X[0], X[1]], duration: 560 }, when);
    });
    now += left(1).length * 40 + 760;

    // The judge reads each one and rebuilds it as a question and a reusable answer.
    m[2] = now; on(labels[2], 'on', now); pan(X[2] + 30, now - 200);
    left(2).forEach((k, j) => t.add(cards[k].g, { translateX: [X[1], X[2]], duration: 520 }, now + j * 40));
    now += left(2).length * 40 + 560;
    const sweep = 760, y1 = top - 8, y2 = row(n - 1) + 18;
    t.add(scan, { y1: [y1, y2], y2: [y1, y2], duration: sweep, ease: 'linear' }, now);
    t.add(scan, { opacity: [{ to: 1, duration: 60 }, { to: 1, duration: sweep - 140 }, { to: 0, duration: 80 }] }, now);
    left(2).forEach((k) => {
      const when = now + sweep * (row(k) + 5 - y1) / (y2 - y1);
      if (fate[k] === 2) { out(k, when); return; }
      t.add(cards[k].q, { width: [46, 20], duration: 260, ease: EASE }, when);
      t.add(cards[k].a, { opacity: [0, 1], scaleX: [0, 1], duration: 320, ease: EASE }, when + 80);
    });
    now += sweep + 360;

    // Compared with what the engine already knows: covered ones are skipped, the rest point at a gap.
    m[3] = now; on(labels[3], 'on', now); pan(X[3] + 110, now - 200);
    left(3).forEach((k, j) => t.add(cards[k].g, { translateX: [X[2], X[3]], duration: 520 }, now + j * 50));
    now += left(3).length * 50 + 540;
    let gap = 0, seen = 0;
    left(3).forEach((k, j) => {
      const when = now + j * 130, covered = fate[k] === 3;
      const target = covered ? known[seen++ % known.length] : holes[gap++ % holes.length];
      const x1 = X[3] + 58, y = row(k) + 5, x2 = +target.getAttribute('cx'), ty = +target.getAttribute('cy');
      links[k].setAttribute('d', 'M' + x1 + ' ' + y + ' C' + (x1 + 70) + ' ' + y + ' ' + (x2 - 70) + ' ' + ty + ' ' + (x2 - 5) + ' ' + ty);
      draw(t, links[k], when, 360);
      cards[k].target = target;
      if (covered) {
        t.add(target, { scale: [{ to: 2.4, duration: 160 }, { to: 1, duration: 320 }] }, when + 340);
        t.add(links[k], { draw: ['0 1', '1 1'], duration: 300 }, when + 520);
        out(k, when + 420);
      } else on(target, 'aim', when + 340);
    });
    now += left(3).length * 130 + 700;

    // An expert approves: the answer is in the index right away.
    m[4] = now; on(labels[4], 'on', now); pan(LOOP.x + 70, now - 200);
    left(4).forEach((k, j) => {
      const when = now + j * 200, target = cards[k].target;
      if (fate[k] === 4 || !target) { out(k, when); return; }
      const x2 = +target.getAttribute('cx'), ty = +target.getAttribute('cy');
      draw(t, cards[k].ok, when, 240);
      t.add(links[k], { draw: ['0 1', '1 1'], duration: 420 }, when + 300);
      t.add(cards[k].g, { translateX: [X[3], x2 - 27], translateY: [row(k), ty - 5], scale: [1, 0.15], duration: 480 }, when + 300);
      t.add(cards[k].g, { opacity: [1, 0], duration: 120 }, when + 700);
      on(target, 'hit', when + 740);
      t.add(target, { scale: [{ to: 2.6, duration: 160, ease: 'out(2)' }, { to: 1.5, duration: 360, ease: 'out(3)' }] }, when + 740);
      rings[k].setAttribute('cx', x2); rings[k].setAttribute('cy', ty);
      t.add(rings[k], { opacity: [0.8, 0], scale: [1, 4.5], duration: 640, ease: 'out(3)' }, when + 740);
    });
    return { marks: m, end: now + left(4).length * 200 + 1100 };
  }

  reset();
  return { reset, compose, wrap, visible: scene.visible, caption: scene.caption, fit: scene.fit, say: scene.say };
}

// Chapter 3. The scene is the only thing that moves while it plays: its caption says which step the
// request is on, and the list below stays still until the run ends, when it is marked with the path
// taken. The path buttons choose where the request stops: data-stop is the last step that runs,
// data-out the exit it leaves through. Without a scene, the request travels the rail of the list.
function mountTrace(box) {
  const list = box.querySelector('.steps');
  const steps = Array.from(box.querySelectorAll('.step'));
  const dots = steps.map((s) => s.querySelector('.dot'));
  const outs = Array.from(box.querySelectorAll('.out'));
  const picker = box.querySelector('.paths');
  const picks = picker ? Array.from(picker.querySelectorAll('.path')) : [];
  if (!list || steps.length < 2 || dots.indexOf(null) > -1) return null;

  const svg = overlay(list);
  const rail = S('line', { class: 'rail' }, svg);
  const wires = outs.map(() => S('path', { class: 'rail' }, svg));
  const fill = S('line', {}, svg);
  const bridge = S('line', { class: 'bridge' }, svg);
  const link = S('path', {}, svg);
  const rings = steps.map(() => mark('fx-ring'));
  const pkt = mark('fx-pkt');
  box.append(...rings, pkt);
  const linkPen = pen(link);
  const stage = buildStage(box, steps, outs, svg);
  if (stage) {
    box.classList.add('staged');
    if (box.parentNode.classList.contains('build')) box.parentNode.classList.add('wide');
  }

  const n = steps.length;
  const paths = picks.length
    ? picks.map((b) => ({ stop: between(1, +b.dataset.stop || n, n), out: between(0, +b.dataset.out || 0, outs.length - 1) }))
    : [{ stop: n, out: 0 }];
  const dwell = steps.map((s) => +s.dataset.dwell || 200);
  // What the caption says: one line per step, then one per exit.
  const pad = (v) => String(v).padStart(2, '0');
  const said = (el, sel) => { const head = el.querySelector(sel), h = head ? head.textContent : ''; return [h, el.textContent.replace(h, '').trim()]; };
  const lines = steps.map((s, i) => [pad(i + 1) + '/' + pad(n)].concat(said(s, '.k'))).concat(outs.map((o) => [''].concat(said(o, '.mono'))));
  let active = 0, geo = null, tl = null, played = false, running = false, item = null;

  function measure() {
    const o = origin(box);
    const mid = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2 - o.x, r.top + r.height / 2 - o.y]; };
    const x = mid(dots[0])[0];
    const ys = dots.map((d) => mid(d)[1]);
    const bottom = list.getBoundingClientRect().bottom - o.y;
    const boxes = outs.map((el) => { const r = el.getBoundingClientRect(); return { l: r.left - o.x, t: r.top - o.y, h: r.height }; });
    // How the rail reaches each exit. turn: where it leaves the vertical. pts: the rest of the way.
    const exits = boxes.map((b, i) => {
      if (b.l - x >= 12) {
        if (boxes.every((other) => other.l >= b.l - 1)) {
          const y = b.t + Math.min(b.h / 2, 24);
          return { turn: y, pts: [[x, y - R], [x, y], [b.l, y]] };
        }
        const bus = (bottom + b.t) / 2, xin = b.l + 20;
        return { turn: bus, pts: [[x, bus - R], [x, bus], [xin, bus], [xin, b.t]] };
      }
      // Narrow screens stack the exits under the rail: the first is straight below, the others get no wire.
      return { turn: i === 0 ? b.t : bottom - 10, pts: null };
    });
    geo = { x, ys, exits };
    line(rail, x, ys[0], x, ys[n - 1]);
    exits.forEach((e, i) => {
      wires[i].setAttribute('d', e.pts ? rounded([[x, ys[n - 1]]].concat(e.pts.slice(1))) : 'M' + x + ' ' + ys[n - 1] + ' L' + x + ' ' + e.turn);
    });
    rings.forEach((r, i) => { r.style.left = x + 'px'; r.style.top = ys[i] + 'px'; });
  }

  // A branch step only gives the answer when the path stops on it. Otherwise it was checked and passed.
  const passes = (i, cfg) => steps[i].classList.contains('branch') && i !== cfg.stop - 1;
  const vertical = (e) => (e.pts ? e.turn - R : e.turn);
  const kind = (cfg) => (cfg.stop === n ? 'full' : steps[cfg.stop - 1].classList.contains('branch') ? 'curated' : cfg.stop === 5 ? 'weak' : null);

  function reset() {
    steps.forEach((s) => s.classList.remove('on', 'pass', 'idle'));
    outs.forEach((o) => o.classList.remove('on', 'off'));
    line(fill, geo.x, geo.ys[0], geo.x, geo.ys[0]);
    line(bridge, geo.x, geo.ys[0], geo.x, geo.ys[0]);
    link.setAttribute('d', 'M0 0');
    linkPen.setAttribute('draw', '0 0');
    set(rings, { opacity: 0 });
    set(pkt, { opacity: 0 });
  }

  function arrive(cfg) {
    outs.forEach((o, i) => { o.classList.toggle('on', i === cfg.out); o.classList.toggle('off', i !== cfg.out); });
  }

  // The list marked with the path that was taken, with no motion.
  function finish(cfg) {
    reset();
    const { x, ys } = geo, e = geo.exits[cfg.out], last = ys[cfg.stop - 1];
    steps.forEach((s, i) => {
      if (i >= cfg.stop) { s.classList.add('idle'); return; }
      s.classList.add('on');
      if (passes(i, cfg)) s.classList.add('pass');
    });
    if (cfg.stop === n) line(fill, x, ys[0], x, vertical(e));
    else { line(fill, x, ys[0], x, last); line(bridge, x, last, x, vertical(e)); }
    if (e.pts) { link.setAttribute('d', rounded(e.pts)); linkPen.setAttribute('draw', '0 1'); }
    arrive(cfg);
  }

  // No scene: the request itself travels the rail, stays on each step for its dwell and leaves by an exit.
  function travel(t, cfg) {
    const { x, ys } = geo, e = geo.exits[cfg.out];
    let at = 0;
    set(pkt, { x, y: ys[0] - 18, scale: 1 });
    t.add(pkt, { y: [ys[0] - 18, ys[0]], opacity: [0, 1], duration: 260, ease: EASE }, at);
    at += 260;
    for (let i = 0; i < cfg.stop; i++) {
      const pass = passes(i, cfg);
      t.call(() => { steps[i].classList.add('on'); if (pass) steps[i].classList.add('pass'); }, at);
      if (!pass) t.add(rings[i], { opacity: [0.6, 0], scale: [1, 2.3], duration: Math.max(520, dwell[i] + 240), ease: 'out(3)' }, at);
      at += pass ? 110 : dwell[i];
      if (i < cfg.stop - 1) {
        const d = between(150, (ys[i + 1] - ys[i]) * 3, 300);
        t.add(pkt, { y: [ys[i], ys[i + 1]], duration: d }, at);
        t.add(fill, { y2: [ys[i], ys[i + 1]], duration: d }, at);
        at += d;
      }
    }
    // Skipped steps are bridged with a dashed line.
    const last = ys[cfg.stop - 1], end = vertical(e), early = cfg.stop < n;
    if (early) t.call(() => steps.slice(cfg.stop).forEach((s) => s.classList.add('idle')), at);
    if (end - last > 1) {
      const d = between(180, (end - last) * (early ? 1.5 : 3), 520);
      t.add(pkt, { y: [last, end], duration: d }, at);
      if (early) line(bridge, x, last, x, last);
      t.add(early ? bridge : fill, { y2: [last, end], duration: d }, at);
      at += d;
    }
    if (e.pts) {
      link.setAttribute('d', rounded(e.pts));
      const legs = e.pts.slice(1).map((p, i) => Math.abs(p[0] - e.pts[i][0]) + Math.abs(p[1] - e.pts[i][1]));
      const total = legs.reduce((a, b) => a + b, 0);
      const d = between(240, total * 2.2, 560);
      draw(t, linkPen, at, d, 'linear');
      let from = e.pts[0], start = at;
      e.pts.slice(1).forEach((p, i) => {
        const part = d * legs[i] / total;
        t.add(pkt, { x: [from[0], p[0]], y: [from[1], p[1]], duration: part, ease: 'linear' }, start);
        start += part; from = p;
      });
      at += d;
    }
    t.call(() => arrive(cfg), at);
    t.add(pkt, { scale: [1, 0], opacity: [1, 0], duration: 280, ease: 'in(2)' }, at + 60);
  }

  function run(done) {
    picks.forEach((b, k) => b.setAttribute('aria-pressed', k === active ? 'true' : 'false'));
    if (tl) tl.cancel();
    measure();
    reset();
    if (stage) { stage.reset(); stage.say(lines[0]); }
    played = true;
    const cfg = paths[active], scene = stage && stage.visible() ? kind(cfg) : null;
    const t = tl = createTimeline({
      autoplay: false, playbackRate: scene ? 1.1 : 1, defaults: { ease: 'inOut(2)' },
      // The page can change size while the scene plays, so the list is marked from fresh measures.
      onComplete: () => { running = false; if (scene) { measure(); finish(cfg); } if (done) done(); },
    });
    if (scene) {
      probe();
      const s = stage.compose(t, scene);
      for (let i = 0; i < cfg.stop; i++) stage.caption(t, lines[i], s.marks[i]);
      stage.caption(t, lines[n + cfg.out], s.end);
      t.add({}, { duration: 1 }, s.end + 700);   // the last caption gets a moment before the list is marked
    } else travel(t, cfg);
    running = true;
    t.play();
  }
  // Replay and the path buttons are the reader asking: the scene takes the floor at once.
  function play(index) {
    if (typeof index === 'number') active = between(0, index, paths.length - 1);
    run(floor && item ? floor.claim(item) : null);
  }

  box.classList.add('fx');
  if (picker) {
    picker.hidden = false;
    picks.forEach((b, k) => b.addEventListener('click', () => play(k)));
  }
  measure();
  reset();
  if (stage) { stage.say(lines[0]); stage.fit(lines); }
  onResize(box, () => {
    if (stage) stage.fit(lines);
    if (running && stage && stage.visible()) { measure(); return; }
    if (tl) tl.cancel();
    running = false;
    measure();
    if (played) finish(paths[active]); else reset();
  });
  const pause = () => { if (tl && running) tl.pause(); }, resume = () => { if (tl && running) tl.resume(); };
  if (floor) item = floor.add({ el: stage ? stage.wrap : box, scene: true, need: stage ? 0.85 : 0.45, start: run, pause, resume });
  else whenSeen(box, 0.45, () => run());
  return { play: () => play() };
}

// Chapter 6. Same structure as chapter 3: the scene moves, its caption says which step it is on and
// the list is marked when the run ends. data-beads is how many closed chats start and data-drop how
// many leave at each step. The diagram is a sketch of the filter, so set those two to whatever
// proportion you want to show. Without a scene, beads go down the rail of the list.
function mountPipe(box, pipe) {
  const items = Array.from(pipe.children);
  if (items.length < 2) return null;
  const n = items.length;
  const count = between(1, +pipe.dataset.beads || 6, 12);
  const drops = (pipe.dataset.drop || '').split(',').map((v) => +v || 0);

  // fate[k]: the step where bead k leaves, or -1 if it reaches the end. The first bead always arrives.
  const fate = Array.from({ length: count }, () => -1);
  const pool = fate.map((_, k) => k).slice(1);
  for (let g = 0; g < n; g++) {
    for (let j = drops[g] || 0; j > 0 && pool.length; j--) fate[pool.splice((g + j) % pool.length, 1)[0]] = g;
  }

  const svg = overlay(pipe);
  const rail = S('line', { class: 'rail' }, svg);
  const fill = S('line', {}, svg);
  const beads = fate.map(() => mark('fx-bead'));
  const rings = fate.map((f) => (f < 0 ? mark('fx-ring') : null));
  box.append(...rings.filter(Boolean), ...beads);
  const stage = buildLoop(items, fate, svg);
  if (stage) {
    pipe.classList.add('staged');
    if (box.parentNode.classList.contains('loop2')) box.parentNode.classList.add('wide');
  }
  const pad = (v) => String(v).padStart(2, '0');
  const lines = items.map((li, i) => {
    const b = li.querySelector('b'), name = b ? b.textContent : '';
    return [pad(i + 1) + '/' + pad(n), name, li.textContent.replace(name, '').trim()];
  });

  const GAP = 130, LEG = 460, IN = 240;
  let geo = null, tl = null, played = false, running = false, item = null;

  function measure() {
    const o = origin(box);
    const dot = getComputedStyle(items[0], '::before');
    const size = parseFloat(dot.height) || 15;
    const off = (parseFloat(getComputedStyle(items[0]).paddingTop) || 0) + (parseFloat(dot.top) || 0) + size / 2;
    const x = items[0].getBoundingClientRect().left - o.x + size / 2;
    const ys = items.map((li) => li.getBoundingClientRect().top - o.y + off);
    geo = { x, ys };
    line(rail, x, ys[0], x, ys[n - 1]);
    rings.forEach((r) => { if (r) { r.style.left = x + 'px'; r.style.top = ys[n - 1] + 'px'; } });
  }

  function reset() {
    items.forEach((li) => li.classList.remove('on'));
    beads.forEach((b) => b.classList.remove('drop'));
    line(fill, geo.x, geo.ys[0], geo.x, geo.ys[0]);
    set(beads, { opacity: 0 });
    set(rings.filter(Boolean), { opacity: 0 });
  }

  function finish() {
    reset();
    items.forEach((li) => li.classList.add('on'));
    line(fill, geo.x, geo.ys[0], geo.x, geo.ys[n - 1]);
  }

  // No scene: beads go down the rail and some of them leave at each filter.
  function travel(t) {
    const { x, ys } = geo;
    for (let g = 0; g < n; g++) {
      const at = IN + g * LEG;
      t.call(() => items[g].classList.add('on'), at);
      if (g) t.add(fill, { y2: [ys[g - 1], ys[g]], duration: LEG }, at - LEG);
    }
    beads.forEach((b, k) => {
      const leaves = fate[k], last = leaves < 0 ? n - 1 : leaves;
      const stopAt = (g) => (g === leaves ? ys[g] - 15 : ys[g]);
      let at = k * GAP;
      set(b, { x, y: ys[0] - 18, scale: 1 });
      t.add(b, { y: [ys[0] - 18, stopAt(0)], opacity: [0, 1], duration: IN, ease: EASE }, at);
      at += IN;
      for (let g = 1; g <= last; g++) {
        t.add(b, { y: [ys[g - 1], stopAt(g)], duration: LEG }, at);
        at += LEG;
      }
      if (leaves < 0) {
        t.add(rings[k], { opacity: [0.6, 0], scale: [1, 2.3], duration: 560, ease: 'out(3)' }, at);
        t.add(b, { scale: [1, 0], opacity: [1, 0], duration: 260, ease: 'in(2)' }, at);
      } else {
        t.call(() => b.classList.add('drop'), at);
        t.add(b, { x: [x, x - 14], opacity: [1, 0], duration: 420, ease: EASE }, at + 80);
      }
    });
  }

  function run(done) {
    if (tl) tl.cancel();
    measure();
    reset();
    if (stage) { stage.reset(); stage.say(lines[0]); }
    played = true;
    const scene = stage && stage.visible();
    const t = tl = createTimeline({
      autoplay: false, defaults: { ease: 'inOut(2)' },
      onComplete: () => { running = false; if (scene) { measure(); finish(); } if (done) done(); },
    });
    if (scene) {
      probe();
      const s = stage.compose(t);
      lines.forEach((l, g) => stage.caption(t, l, s.marks[g]));
      t.add({}, { duration: 1 }, s.end);
    } else travel(t);
    running = true;
    t.play();
  }
  const play = () => run(floor && item ? floor.claim(item) : null);

  pipe.classList.add('fx');
  measure();
  reset();
  if (stage) { stage.say(lines[0]); stage.fit(lines); }
  onResize(box, () => {
    if (stage) stage.fit(lines);
    if (running && stage && stage.visible()) { measure(); return; }
    if (tl) tl.cancel();
    running = false;
    measure();
    if (played) finish(); else reset();
  });
  const pause = () => { if (tl && running) tl.pause(); }, resume = () => { if (tl && running) tl.resume(); };
  if (floor) item = floor.add({ el: stage ? stage.wrap : box, scene: true, need: stage ? 0.85 : 0.45, start: run, pause, resume });
  else whenSeen(box, 0.45, () => run());
  return { play };
}

// Chapter 8, the triage: it is built from the door down, then a few cases go through it and each is
// sent where it belongs. Until it plays, the diagram waits empty inside its pane.
function mountRoute() {
  const route = document.querySelector('.pane.next .route');
  if (!route || !floor || lite || route.closest('.in')) return;
  const kids = (sel) => Array.from(route.querySelectorAll(sel));
  const nodes = kids(':scope > .node'), wires = kids(':scope > .wire'), fan = route.querySelector('.fan'), ends = kids('.fan .node');
  if (nodes.length < 2 || wires.length < 2 || !fan) return;
  let tl = null;
  route.classList.add('fx');
  set(nodes.concat(ends), { opacity: 0 });
  set(wires, { scaleY: 0 });
  fan.style.setProperty('--bus', 0);
  floor.add({
    el: route, scene: true, need: 0.6,
    pause: () => tl && tl.pause(),
    resume: () => tl && tl.resume(),
    start: (done) => {
      const t = tl = createTimeline({ autoplay: false, defaults: { ease: EASE, duration: 700 } });
      let at = 0;
      t.add(nodes[0], { opacity: [0, 1], translateY: [-12, 0], duration: 520 }, at); at += 320;
      t.add(wires[0], { scaleY: [0, 1], duration: 260, ease: 'inOut(2)' }, at); at += 220;
      t.add(nodes[1], { opacity: [0, 1], scale: [0.94, 1], duration: 560 }, at); at += 380;
      t.add(wires[1], { scaleY: [0, 1], duration: 260, ease: 'inOut(2)' }, at); at += 200;
      t.add(fan, { '--bus': [0, 1], duration: 420, ease: 'inOut(2)' }, at); at += 300;
      t.add(ends, { opacity: [0, 1], translateY: [-10, 0], duration: 480, delay: stagger(90, { from: 'center' }) }, at); at += 760;
      if (getComputedStyle(fan, '::before').display !== 'none') {   // a stacked fan has no wires to follow
        const o = origin(route);
        const box = (n) => { const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2 - o.x, top: r.top - o.y, bottom: r.bottom - o.y }; };
        const door = box(nodes[0]), triage = box(nodes[1]), bus = fan.getBoundingClientRect().top - o.y;
        [1, 3, 0, 2].forEach((i, j) => {
          if (!ends[i]) return;
          const end = box(ends[i]), dot = mark('fx-ticket'), when = at + j * 1150;
          route.appendChild(dot);
          set(dot, { x: door.x, y: door.bottom, opacity: 0, scale: 1 });
          t.add(dot, { opacity: [0, 1], duration: 120 }, when);
          t.add(dot, { y: [door.bottom, triage.top], duration: 200, ease: 'in(2)' }, when);
          t.add(dot, { opacity: [1, 0], duration: 100 }, when + 200);
          t.call(() => nodes[1].classList.add('think'), when + 200);
          t.call(() => nodes[1].classList.remove('think'), when + 620);
          t.add(dot, { opacity: [0, 1], duration: 100 }, when + 600);
          t.add(dot, { y: [triage.bottom, bus], duration: 180, ease: 'linear' }, when + 600);
          t.add(dot, { x: [door.x, end.x], duration: 240, ease: 'inOut(2)' }, when + 780);
          t.add(dot, { y: [bus, end.top], duration: 180, ease: 'out(2)' }, when + 1020);
          t.add(dot, { opacity: [1, 0], scale: [1, 0.4], duration: 160 }, when + 1180);
          t.call(() => ends[i].classList.add('got'), when + 1180);
          t.call(() => ends[i].classList.remove('got'), when + 1900);
        });
      }
      t.play().then(() => {
        kids('.fx-ticket').forEach((d) => d.remove());
        nodes.concat(ends, wires).forEach((el) => {
          el.style.removeProperty('opacity');
          el.style.removeProperty('transform');
          if (el.getAttribute('style') === '') el.removeAttribute('style');
        });
        fan.style.removeProperty('--bus');
        if (fan.getAttribute('style') === '') fan.removeAttribute('style');
        done();
      });
    },
  });
}

// site.js lists the diagrams of the page in window.siteDiagrams and runs their CSS version until this
// file takes them over. A diagram is built shortly before it is reached, never while the page loads,
// and one whose CSS version already played is left as it is.
const mount = (box, target) => {
  try {
    return target.classList.contains('pipe') ? mountPipe(box, target) : mountTrace(box);
  } catch (e) {
    box.classList.remove('fx', 'staged');
    target.classList.remove('fx', 'staged');
    if (box.parentNode) box.parentNode.classList.remove('wide');
    box.querySelectorAll('.fx-lines, .fx-pkt, .fx-ring, .fx-bead, .stage, .stage-cap').forEach((el) => el.remove());
    const picker = box.querySelector('.paths');
    if (picker) picker.hidden = true;
    return null;
  }
};
try { mountRoute(); } catch (e) { /* the pane keeps its CSS reveal */ }
if ('IntersectionObserver' in window) {
  const list = window.siteDiagrams || [];
  // Building a scene is the one heavy thing this file does, so it waits for a moment the browser is free.
  const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 700 }) : setTimeout(fn, 60));
  const near = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    near.unobserve(e.target);
    const d = list.find((x) => x.box === e.target);
    if (d) idle(() => { if (!d.ran && !d.fx) d.fx = mount(d.box, d.target); });
  }), { rootMargin: '1400px 0px' });
  list.forEach((d) => near.observe(d.box));
}
