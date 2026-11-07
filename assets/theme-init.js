// Applies the saved theme before first paint. Kept as a file so the CSP needs no 'unsafe-inline'.
try { var t = localStorage.getItem('theme'); if (t) document.documentElement.setAttribute('data-theme', t); } catch (e) {}
