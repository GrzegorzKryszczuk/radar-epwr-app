/* Motyw ustawiany przed narysowaniem strony (bez mignięcia). auto = jak w systemie. */
(function () {
  'use strict';
  var t = 'dark';
  try { t = localStorage.getItem('app.theme') || 'dark'; } catch (e) { /* tryb prywatny */ }
  var eff = t === 'auto' ? (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
  document.documentElement.setAttribute('data-theme', eff);
  document.documentElement.setAttribute('data-theme-pref', t);
})();
