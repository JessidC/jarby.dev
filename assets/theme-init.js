// Runs before first paint. Kept as a file so the CSP needs no 'unsafe-inline'.
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  // If site.js never runs, show everything without entrance animations.
  setTimeout(function () { if (!window.siteReady) d.classList.remove('js'); }, 2500);
  // A device that says it is small gets the page without its costliest effects (see .lite in site.css).
  var n = navigator;
  if ((n.deviceMemory && n.deviceMemory <= 2) || (n.hardwareConcurrency && n.hardwareConcurrency <= 2)) d.classList.add('lite');
  try { var t = localStorage.getItem('theme'); if (t === 'dark' || t === 'light') d.setAttribute('data-theme', t); } catch (e) {}
})();
