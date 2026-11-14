// The short gestures of the portada and the story, and the floor that decides what may move.
// There is no library here. Every gesture is a Web Animation on transform or opacity, which the
// browser runs off the main thread: it keeps moving while the page scrolls and costs no script per
// frame. The scenes of the story are in flows.js (anime.js) and share this floor as window.siteFloor.
// scripts/build.mjs minifies this into assets/motion.js. site.js fetches it once the page has
// loaded, and not at all with reduced motion or on a device marked as small.

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';    // --ease in site.css
const EVEN = 'cubic-bezier(0.65, 0, 0.35, 1)';   // lines and covers, which travel at an even pace
const NS = 'http://www.w3.org/2000/svg';

// The floor decides what may move. A scene has it to itself: nothing else starts while a scene
// plays, and a scene waits for the gestures on screen to finish. Short gestures start one at a time,
// in page order, GAP apart, so a section opens as a cascade from its title down. A gesture that
// cannot start is shown finished instead (at once if a scene has the floor), so nothing stays hidden
// waiting, and a scene that leaves the screen pauses and gives the floor back.
const PATIENCE = 1500, GAP = 160;

function openFloor() {
  const items = [];
  let scene = null, moving = 0, lastStart = 0, timer = 0;
  const inOrder = (a, b) => (a.el.compareDocumentPosition(b.el) & 4 ? -1 : 1);   // 4: b comes after a
  const settle = (it) => { if (it.state === 'waiting') { it.state = 'done'; it.settle(); } };
  const ender = (it) => () => {
    if (it.state !== 'playing') return;
    it.state = 'done';
    if (!it.scene) moving--;
    else if (scene === it) scene = null;
    next();
  };
  function next() {
    if (scene) return;
    const it = items.filter((i) => i.state === 'waiting' && i.visible).sort(inOrder)[0];
    if (!it) return;
    if (it.scene) {
      if (moving > 0) return;
      scene = it;
      it.state = 'playing';
      items.forEach((i) => { if (!i.scene && i.visible) setTimeout(() => settle(i), 250); });
      if (it.began) it.resume();
      else { it.began = true; it.start(ender(it)); }
      return;
    }
    const wait = lastStart + GAP - performance.now();
    clearTimeout(timer);
    if (wait > 0) { timer = setTimeout(next, wait); return; }
    lastStart = performance.now();
    moving++;
    it.state = 'playing';
    it.began = true;
    it.start(ender(it));
    timer = setTimeout(next, GAP);
  }
  function seen(it, visible) {
    if (it.visible === visible) return;
    it.visible = visible;
    if (visible) {
      if (it.state === 'idle' || it.state === 'paused') {
        it.state = 'waiting';
        if (!it.scene) setTimeout(() => settle(it), scene ? 250 : PATIENCE);
      }
      next();
    } else if (it.scene) {
      if (it.state === 'playing') { it.pause(); it.state = 'paused'; scene = null; next(); }
      else if (it.state === 'waiting') it.state = it.began ? 'paused' : 'idle';
    } else settle(it);
  }
  // Things play in the reading zone, not at the edge where they come in: the bottom fifth of the
  // screen does not count, so a block starts once it is well inside and can be watched. The root
  // is named so the margin also holds when the page is shown inside a frame.
  const watch = (entries) => entries.forEach((e) => {
    const it = items.find((i) => i.el === e.target);
    if (!it) return;
    if (!it.scene) seen(it, e.isIntersecting && e.intersectionRect.height >= Math.min(e.boundingClientRect.height * 0.2, 48));
    else if (e.intersectionRatio >= it.need) seen(it, true);
    else if (e.intersectionRatio < 0.3) seen(it, false);
  });
  const zone = { rootMargin: '0px 0px -20% 0px', threshold: [0, 0.02, 0.05, 0.1, 0.2, 0.3, 0.45, 0.6, 0.85, 1] };
  let io;
  try { io = new IntersectionObserver(watch, Object.assign({ root: document }, zone)); }
  catch (e) { io = new IntersectionObserver(watch, zone); }

  return {
    // it: { el, scene, need, start(done), pause(), resume(), settle() }
    add(it) {
      Object.assign(it, { state: 'idle', visible: false, began: false });
      items.push(it);
      io.observe(it.el);
      return it;
    },
    // The reader asked for it (replay, a path button): the scene takes the floor at once.
    claim(it) {
      if (scene && scene !== it && scene.state === 'playing') { scene.pause(); scene.state = 'paused'; }
      scene = it;
      it.state = 'playing';
      it.began = true;
      return ender(it);
    },
  };
}

// One short gesture per block, the one that carries its point. A block listed here is taken over
// from the CSS reveal: it waits hidden until it has the floor, and what the CSS reveal already
// showed before this file arrived is left alone.
function gestures(floor) {
  const all = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const one = (sel, root) => (root || document).querySelector(sel);
  const each = (list) => () => list.forEach((f) => f && f());
  const small = () => document.documentElement.classList.contains('lite');
  // Lines are pseudo-elements. A browser that cannot animate those leaves them drawn.
  const pseudo = (() => {
    try {
      const a = document.documentElement.animate([], { pseudoElement: '::before' });
      const ok = !!a.effect && a.effect.pseudoElement === '::before';
      a.cancel();
      return ok;
    } catch (e) { return false; }
  })();
  let anims = [], waits = [];

  // One Web Animation. Its first frame also holds during the delay, and when it ends the element is
  // back on its own styles, so nothing is left behind in the page.
  const play = (el, frames, opts) => {
    const a = el.animate(frames, Object.assign({ duration: 520, easing: EASE, fill: 'backwards' }, opts));
    anims.push(a);
    return a;
  };
  const enter = (els, at, step, dx, dy) => els.filter(Boolean).forEach((el, i) => play(el,
    [{ opacity: 0, transform: 'translate(' + (dx || 0) + 'px, ' + (dy === undefined ? 14 : dy) + 'px)' }, { opacity: 1, transform: 'none' }],
    { delay: (at || 0) + i * (step || 0) }));
  const drawn = (el, axis, duration, at, easing) => {
    if (pseudo) play(el, [{ transform: 'scale' + axis + '(0)' }, { transform: 'none' }], { pseudoElement: '::before', duration, delay: at || 0, easing: easing || EVEN });
  };
  // A dot that rides the head of a line for `distance` pixels and is gone when it arrives.
  const rider = (el, axis, distance, duration) => {
    if (pseudo) play(el, [{ opacity: 0, transform: 'translate' + axis + '(0)' }, { opacity: 1, offset: 0.06 }, { opacity: 1, offset: 0.9 }, { opacity: 0, transform: 'translate' + axis + '(' + distance + 'px)' }],
      { pseudoElement: '::after', duration, easing: 'linear' });
  };

  // Splits the text of `el` into words (or characters), each inside its own clip. `restore` puts the
  // original text back, so nothing split stays in the page once the gesture is over.
  const split = (el, chars) => {
    const keep = Array.from(el.childNodes).map((n) => n.cloneNode(true)), parts = [];
    const piece = (str, into) => {
      const clip = document.createElement('span'), inner = document.createElement('span');
      clip.className = 'fx-clip'; inner.className = 'fx-in'; inner.textContent = str;
      clip.appendChild(inner); into.appendChild(clip); parts.push(inner);
    };
    const walk = (node) => Array.from(node.childNodes).forEach((c) => {
      if (c.nodeType === 1) { if (c.namespaceURI !== NS && !c.classList.contains('label')) walk(c); return; }
      if (c.nodeType !== 3) return;
      const frag = document.createDocumentFragment();
      c.textContent.split(/(\s+)/).forEach((w) => {
        if (!w) return;
        if (!w.trim()) { frag.appendChild(document.createTextNode(w)); return; }
        if (!chars) { piece(w, frag); return; }
        const word = document.createElement('span');
        word.className = 'fx-word';
        Array.from(w).forEach((ch) => piece(ch, word));
        frag.appendChild(word);
      });
      node.replaceChild(frag, c);
    });
    walk(el);
    return { parts, restore: () => el.replaceChildren(...keep) };
  };
  const rise = (el, at, step, chars) => {
    const s = split(el, chars);
    s.parts.forEach((p, i) => play(p, [{ transform: 'translateY(110%)' }, { transform: 'none' }], { duration: 560, delay: (at || 0) + i * (step || 36) }));
    return s.restore;
  };

  // Numbers and typed text are the only things worked out in script, and the page is only touched
  // when the text actually changes.
  const tween = (duration, delay, fn) => waits.push(new Promise((done) => {
    let start = 0;
    const tick = (now) => {
      if (!start) start = now + delay;
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      fn(p);
      if (p < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  }));
  const count = (node, to, tail, at, pad, from) => {
    const a = from || 0;
    let shown = null;
    const show = (v) => {
      if (v === shown) return;
      shown = v;
      node.textContent = (pad ? String(v).padStart(pad, '0') : String(v)) + tail;
    };
    show(a);
    tween(1000, at || 0, (p) => show(Math.round(a + (to - a) * (1 - Math.pow(1 - p, 4)))));
    return () => show(to);
  };
  // What is not typed yet stays in the page, invisible, so nothing around it moves.
  const type = (node, at) => {
    const full = node.textContent, shown = document.createElement('span'), rest = document.createElement('span');
    let k = 0;
    rest.className = 'fx-ghost';
    rest.textContent = full;
    node.textContent = '';
    node.append(shown, rest);
    tween(Math.max(260, full.length * 30), at || 0, (p) => {
      const n = Math.round(full.length * p);
      if (n === k) return;
      k = n;
      shown.textContent = full.slice(0, n); rest.textContent = full.slice(n);
    });
    return () => { node.textContent = full; };
  };

  // `build` starts the animations of the block and may return a function to run when they end.
  const take = (el, build) => {
    if (!el || el.classList.contains('in') || el.closest('.in') || el.querySelector('.in')) return;
    [el].concat(all('[data-reveal]', el)).forEach((n) => { n.removeAttribute('data-reveal'); n.removeAttribute('data-d'); });
    el.classList.add('fx-wait');
    const settle = () => { el.classList.add('fx-ease'); el.classList.remove('fx-wait'); };
    floor.add({
      el, settle,
      start: (done) => {
        if (small()) { settle(); done(); return; }
        anims = []; waits = [];
        let after = null;
        try { after = build(el); } catch (e) { anims.forEach((a) => a.cancel()); settle(); done(); return; }
        const mine = anims.map((a) => a.finished.catch(() => {})).concat(waits);
        el.classList.remove('fx-wait');
        Promise.all(mine).then(() => { if (after) after(); done(); });
      },
    });
  };

  // Every chapter of the story and every section of the portada opens the same way: its title rises
  // word by word. On small screens the chapter number counts up with it.
  all('.chapter > h2, .contact h2, .toc h2, .projects h2, .career h2, .work h2').forEach((h) => take(h, () => {
    const num = h.previousElementSibling;
    return each([rise(h, 0, 36), num && num.classList.contains('ch-num') ? count(num, +num.textContent, '', 0, 2) : null]);
  }));

  // Story, chapter 1, "read the data": the figures count up.
  take(one('.stats'), (el) => each(all('.stat', el).map((stat, i) => {
    const v = one('.v', stat), at = i * 140, m = /^(\d+)(.*)$/.exec(v.textContent.trim());
    enter([one('.label', stat)], at + 220);
    if (!m) return rise(v, at, 60);
    enter([v], at, 0, 0, 0);
    return count(v, +m[1], m[2], at);
  })));

  // Story, chapter 3, "one module at a time": the rollout line is drawn wave by wave.
  take(one('.timeline'), (el) => {
    const items = all('li', el), leg = 260;
    el.classList.add('fx');
    drawn(el, 'X', leg * items.length, 0, 'linear');
    rider(el, 'X', el.clientWidth, leg * items.length);
    enter(items, 60, leg, 0, 12);
  });

  // Story, chapter 4, "within noise": the words shake like a noisy reading before they settle.
  take(one('.lever .big'), (big) => {
    const s = split(big, true);
    big.classList.add('fx-free');
    const off = () => ({ transform: 'translateY(' + Math.round(Math.random() * 44 - 22) + '%)' });
    s.parts.forEach((p, i) => play(p, [{ transform: 'none' }, off(), off(), off(), off(), { transform: 'none' }], { duration: 760, delay: 200 + i * 30, easing: 'ease-out', fill: 'none' }));
    return () => { s.restore(); big.classList.remove('fx-free'); };
  });

  // Story, chapter 5, "like a product": the scorecard fills cell by cell.
  take(one('.score'), (el) => {
    all('.cell', el).forEach((c, i) => play(c, [{ opacity: 0, transform: 'translateY(16px) scale(0.95)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay: i * 100 }));
  });

  // Story, chapters 6 and 7: "handoffs to answers" and "CSAT up" arrive in the order they are read.
  all('.loop-result .big-n, .ops .big-n').forEach((b) => take(b, (el) => {
    enter([one('.from', el)], 0, 0, -18, 0);
    enter([one('.icon', el)], 220, 0, -22, 0);
    enter([one('.label', el)], 640);
    return one('.accent', el) ? rise(one('.accent', el), 400, 50, true) : null;
  }));

  // Portada, the chapters: a marker walks the line from 1 to 7 and each chapter appears as it gets
  // there. The eighth, still under construction, comes last on its dashed stretch.
  take(one('.map'), (el) => {
    const items = all('li', el), leg = 210, last = items.length - 1, total = leg * Math.max(1, last - 1);
    el.classList.add('fx');
    drawn(el, 'Y', total, 0, 'linear');
    rider(el, 'Y', el.clientHeight - 98, total + 120);   // 98: where the line starts and ends, see .map::before
    items.forEach((li, i) => {
      const at = i === last ? total + 220 : i * leg, n = one('.n', li);
      play(li, [{ opacity: 0, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'none' }], { delay: at });
      if (n) play(n, [{ transform: 'none' }, { transform: 'scale(1.22)', offset: 0.3 }, { transform: 'none' }], { duration: 460, delay: at + 60, fill: 'none' });
    });
  });

  // Portada, "built so others can keep building on it": the base line is drawn and the four pieces are laid on it.
  take(one('.built-on'), (el) => {
    el.classList.add('fx');
    drawn(el, 'X', 650);
    enter(all('li', el), 220, 100, 0, 16);
  });

  // Portada, projects: the screenshot is uncovered and the text follows.
  all('.proj, .stacked').forEach((p) => take(p, (el) => {
    const shot = one('.shot', el), img = shot && one('img', shot);
    let cover = null;
    if (img && img.complete && img.naturalWidth) {
      cover = document.createElement('span');
      cover.className = 'fx-cover';
      cover.setAttribute('aria-hidden', 'true');
      shot.classList.add('fx');
      shot.appendChild(cover);
      play(cover, [{ transform: 'none' }, { transform: 'translateY(-101%)' }], { duration: 850, easing: EVEN, fill: 'both' });
      play(img, [{ transform: 'scale(1.08)' }, { transform: 'none' }], { duration: 1100 });
    }
    enter(all(':scope > div:not(.strip) > *, :scope > :not(div):not(.shot)', el), cover ? 200 : 0, 50, 0, 12);
    return cover ? () => { cover.remove(); shot.classList.remove('fx'); } : null;
  }));
  // The results of the learning loop count from where the bot started to where it ended.
  take(one('.stacked .strip'), (el) => {
    enter(all(':scope > div', el), 0, 160, 0, 12);
    return each(all('.v', el).map((v, i) => {
      const from = one('.from', v), to = v.lastChild;
      const a = from && /^(\d+)(.*)$/.exec(from.textContent.trim()), b = to && to.nodeType === 3 && /^(\d+)(.*)$/.exec(to.textContent.trim());
      return a && b ? count(to, +b[1], b[2], 180 + i * 160, 0, +a[1]) : null;
    }));
  });

  // Portada, experience: each date is typed like a line in a log and its role follows.
  all('.career-list li').forEach((row) => take(row, (li) => {
    const when = one('.when', li);
    enter(all(':scope > div', li), 120, 0, 0, 12);
    return when ? type(when, 0) : null;
  }));

  // Portada, other work: the rule over each piece is drawn and its text follows.
  all('.work-grid .item').forEach((piece) => take(piece, (it) => {
    it.classList.add('fx');
    drawn(it, 'X', 600);
    enter(all(':scope > *', it), 180, 45, 0, 12);
  }));

  // Portada, the way out: the address rises letter by letter under its title.
  take(one('.contact .mail'), (el) => rise(el, 0, 16, true));
}

if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window && 'animate' in Element.prototype) {
  const floor = openFloor();
  window.siteFloor = floor;
  try { gestures(floor); } catch (e) { document.querySelectorAll('.fx-wait').forEach((el) => el.classList.remove('fx-wait')); }
}
