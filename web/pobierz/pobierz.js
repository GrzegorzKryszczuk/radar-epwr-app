(function () {
  'use strict';
  var android = /Android/i.test(navigator.userAgent);
  if (!android) { var d = document.getElementById('desk'); if (d) d.style.display = 'block'; }
  // Wersja i rozmiar z GitHub Releases (bez nich przycisk i tak działa).
  fetch('https://api.github.com/repos/GrzegorzKryszczuk/radar-epwr-app/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      if (!j) return;
      var a = (j.assets || []).filter(function (x) { return x.name === 'radar-epwr.apk'; })[0];
      var txt = 'Wersja ' + String(j.tag_name || '').replace(/^v/, '');
      if (a) txt += ' · ' + (a.size / 1048576).toFixed(1).replace('.', ',') + ' MB';
      if (j.published_at) txt += ' · ' + new Date(j.published_at).toLocaleDateString('pl-PL');
      document.getElementById('meta').textContent = txt + ' · Android 8.0+';
    })
    .catch(function () {});
})();
