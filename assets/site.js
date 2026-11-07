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
  function stepper(box, target) {
    if (!box || !target) return;
    if (reduce) { target.classList.add('lit'); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { target.classList.add('run'); io.disconnect(); }
    }, { threshold: 0.45 });
    io.observe(box);
    var replay = box.querySelector('.replay');
    if (replay) {
      replay.addEventListener('click', function () {
        target.classList.remove('run');
        void target.offsetWidth;
        target.classList.add('run');
      });
    }
  }
  var trace = document.querySelector('.trace');
  stepper(trace, trace);
  var pipeBox = document.querySelector('.pipe-box');
  stepper(pipeBox, pipeBox && pipeBox.querySelector('.pipe'));

  // Before-and-after figures count once when they enter.
  var fmtFor = function (el) {
    var dec = parseInt(el.dataset.dec || '0', 10);
    var sep = el.dataset.sep || '.';
    var suffix = el.dataset.suffix || '';
    return function (v) { return v.toFixed(dec).replace('.', sep) + suffix; };
  };
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      countIO.unobserve(e.target);
      var el = e.target;
      var from = parseFloat(el.dataset.from), to = parseFloat(el.dataset.to);
      var fmt = fmtFor(el);
      if (reduce) { el.textContent = fmt(to); return; }
      var start = null, dur = 1400;
      var tick = function (t) {
        if (start === null) start = t;
        var p = Math.min((t - start) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 4);
        el.textContent = fmt(from + (to - from) * eased);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach(function (el) {
    if (!reduce) el.textContent = fmtFor(el)(parseFloat(el.dataset.from));
    countIO.observe(el);
  });

  // When printing, open every decision in the log.
  window.addEventListener('beforeprint', function () {
    document.querySelectorAll('.log details').forEach(function (d) { d.open = true; });
  });
})();
