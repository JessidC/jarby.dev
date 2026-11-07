(function () {
  var root = document.documentElement;
  root.classList.add('js');

  // Theme: system by default, the button overrides it for this viewer.
  var btn = document.getElementById('theme');
  function current() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  function label() {
    if (!btn) return;
    var dark = current() === 'dark';
    btn.textContent = dark ? btn.getAttribute('data-light') : btn.getAttribute('data-dark');
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }
  if (btn) {
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
      label();
    });
    label();
  }

  // Border under the top bar once the page has moved.
  var top = document.querySelector('.top');
  var sentinel = document.getElementById('top-sentinel');
  if (top && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      top.classList.toggle('scrolled', !e[0].isIntersecting);
    }).observe(sentinel);
  }

  // Reveal blocks as they enter the viewport.
  var items = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();
