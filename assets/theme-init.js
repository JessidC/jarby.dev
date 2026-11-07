// Runs before first paint. Kept as a file so the CSP needs no 'unsafe-inline'.
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  // If site.js never runs, show everything without entrance animations.
  setTimeout(function () { if (!window.siteReady) d.classList.remove('js'); }, 2500);
  try { var t = localStorage.getItem('theme'); if (t === 'dark' || t === 'light') d.setAttribute('data-theme', t); } catch (e) {}
})();
