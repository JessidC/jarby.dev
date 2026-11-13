// Page behavior. No scroll listeners: everything runs on IntersectionObserver.
(function () {
  window.siteReady = true;

  // The chapters moved to their own page; old links like /#ch5 still land on the right chapter.
  var h = location.hash;
  if (/^#ch[1-8]$/.test(h) && !document.getElementById(h.slice(1))) {
    var mapLink = document.querySelector('.map a');
    if (mapLink) { location.replace(mapLink.getAttribute('href').split('#')[0] + h); return; }
  }
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme: light or dark, remembered for this visitor.
  var themeBtn = document.querySelector('.theme');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('[data-reveal], .map').forEach(function (el) { el.classList.add('in'); });
    document.querySelectorAll('.trace, .pipe').forEach(function (el) { el.classList.add('lit'); });
    return;
  }

  // Entrance on scroll.
  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.querySelectorAll('[data-reveal], .map').forEach(function (el) { revealIO.observe(el); });

  // Chapter rail: marks the chapter being read.
  var railLinks = {};
  document.querySelectorAll('.rail a').forEach(function (a) { railLinks[a.getAttribute('href').slice(1)] = a; });
  var chapterIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      Object.keys(railLinks).forEach(function (id) { railLinks[id].removeAttribute('aria-current'); });
      var link = railLinks[e.target.id];
      if (link) link.setAttribute('aria-current', 'true');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('.chapter').forEach(function (c) { chapterIO.observe(c); });

  // Step-by-step diagrams (the request trace and the improvement loop):
  // they light up in order the first time they are seen, with a replay button.
  // On the story pages assets/flows.js (anime.js) takes over the ones that have not played yet.
  var diagrams = [];
  function stepper(box, target) {
    if (!box || !target) return;
    if (reduce) { target.classList.add('lit'); return; }
    var d = { box: box, target: target, ran: false, fx: null };
    diagrams.push(d);
    var run = function () {
      if (d.fx) { d.fx.play(); return; }
      d.ran = true;
      target.classList.remove('run');
      void target.offsetWidth;
      target.classList.add('run');
    };
    var io = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      if (!d.fx) run();
    }, { threshold: 0.45 });
    io.observe(box);
    var replay = box.querySelector('.replay');
    if (replay) replay.addEventListener('click', run);
  }
  var trace = document.querySelector('.trace');
  stepper(trace, trace);
  var pipeBox = document.querySelector('.pipe-box');
  stepper(pipeBox, pipeBox && pipeBox.querySelector('.pipe'));

  // The animations are not part of loading the page. motion.js (the short gestures, no library) and,
  // on the story, flows.js (the scenes, anime.js) are fetched when the page is done and the browser is
  // idle, and not at all with reduced motion or on a device marked as small (see theme-init.js).
  var me = document.querySelector('script[data-motion]');
  if (!reduce && !root.classList.contains('lite')) {
    window.siteDiagrams = diagrams;
    if (me) {
      var fetchScripts = function () {
        [me.getAttribute('data-motion'), me.getAttribute('data-flows')].forEach(function (src) {
          if (!src) return;
          var el = document.createElement('script');
          el.src = src;
          el.async = false;   // in order: flows.js uses what motion.js sets up
          document.head.appendChild(el);
        });
      };
      var whenIdle = function () {
        if (window.requestIdleCallback) window.requestIdleCallback(fetchScripts, { timeout: 2000 });
        else setTimeout(fetchScripts, 300);
      };
      if (document.readyState === 'complete') whenIdle(); else window.addEventListener('load', whenIdle);
    }
  }
})();
