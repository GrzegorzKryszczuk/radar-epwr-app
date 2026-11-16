/* Radar EPWR – most do funkcji natywnych aplikacji Android (Capacitor).
 *
 * Strona radar-epwr.pl/app/ działa w dwóch miejscach:
 *  - w aplikacji Android (Capacitor ładuje ją w WebView) – wtedy działają powiadomienia push (FCM), systemowe udostępnianie,
 *    przycisk Wstecz i otwieranie linków w aplikacjach (YouTube, Telegram) lub w przeglądarce,
 *  - w zwykłej przeglądarce – wtedy wszystko wraca do zwykłych odpowiedników (Web Share, schowek, nowa karta), bez błędów.
 *
 * Bezpieczeństwo:
 *  - most natywny jest dostępny tylko dla stron z radar-epwr.pl (allowNavigation w capacitor.config.json),
 *    dlatego na /app/ nie ładujemy żadnych obcych skryptów (CSP w index.html i vercel.json),
 *  - z powiadomienia przyjmujemy tylko adres ekranu /app/ (z #widokiem) na tej samej domenie (safeTarget),
 *  - tematy powiadomień: tylko z listy w config.js (nazwy z wiadomości nie są wykonywane).
 */
(function () {
  'use strict';
  var CFG = window.RADAR_APP_CONFIG || {};
  var cap = window.Capacitor;
  var isApp = !!(cap && (window.androidBridge || (typeof cap.getPlatform === 'function' && cap.getPlatform() !== 'web') ||
    (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform())));

  // Strona zdalna dostaje od Androida tylko surowy most – doładowujemy rdzeń @capacitor/core (/app/capacitor.js, MIT,
  // ta sama wersja co aplikacja) i rejestrujemy wtyczki po nazwie. Poza aplikacją: null.
  var ready = null, cache = {};
  function loadCore() {
    if (ready) return ready;
    ready = new Promise(function (resolve) {
      if (!isApp) { resolve(false); return; }
      if (window.Capacitor && window.Capacitor.registerPlugin) { resolve(true); return; }
      var s = document.createElement('script');
      s.src = '/app/capacitor.js?v=862';
      s.onload = function () { resolve(!!(window.Capacitor && window.Capacitor.registerPlugin)); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
    return ready;
  }
  // Bez pliku google-services.json (np. kompilacja testowa) wtyczka powiadomień zakończyłaby się błędem natywnym – MainActivity
  // mówi przez RadarNative.fcmReady(), czy Firebase działa. Wtedy powiadomienia są po prostu niedostępne.
  function fcmReady() {
    try { return !(window.RadarNative && typeof window.RadarNative.fcmReady === 'function') || window.RadarNative.fcmReady() === true; } catch (e) { return false; }
  }
  function plugin(name) {
    return loadCore().then(function (ok) {
      if (!ok) return null;
      if (name === 'FirebaseMessaging' && !fcmReady()) return null;
      return cache[name] || (cache[name] = window.Capacitor.registerPlugin(name));
    });
  }

  function toast(text, ms) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = text; el.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, ms || 2800);
  }

  // ---------- Linki zewnętrzne ----------
  // Telegram, YouTube, Facebook, Google Play → intencja Androida (otwiera ich aplikację, jeśli jest zainstalowana).
  // Pozostałe (buycoffee.to, 7700.pl, podstrony radar-epwr.pl) → karta przeglądarki w aplikacji (Custom Tabs).
  var APP_HOSTS = /(^|\.)(t\.me|telegram\.me|youtube\.com|youtu\.be|facebook\.com|play\.google\.com)$/i;
  function openExternal(url) {
    var u;
    try { u = new URL(url, location.href); } catch (e) { return; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return;   // żadnych javascript:, intent:, file:
    if (!isApp) { window.open(u.href, '_blank', 'noopener'); return; }
    if (APP_HOSTS.test(u.hostname)) { location.href = u.href; return; }   // Capacitor przekaże obcy adres do systemu
    plugin('Browser').then(function (B) {
      if (B) return B.open({ url: u.href, toolbarColor: '#0b1220' });
      location.href = u.href;
    }).catch(function () { location.href = u.href; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#') return;
    var u; try { u = new URL(href, location.href); } catch (err) { return; }
    var inApp = u.origin === location.origin && /^\/app\/(index\.html)?$/.test(u.pathname);   // inne strony (np. prywatność) – w karcie przeglądarki
    if (inApp) return;
    e.preventDefault();
    openExternal(u.href);
  });

  // ---------- Udostępnianie ----------
  function share(o) {
    o = o || {};
    var text = o.text || '', url = o.url || location.href, title = o.title || 'Radar EPWR';
    return plugin('Share').then(function (S) {
      if (S) return S.share({ title: title, text: text, url: url, dialogTitle: o.dialog || 'Udostępnij' });
      if (navigator.share) return navigator.share({ title: title, text: text, url: url });
      return navigator.clipboard.writeText((text ? text + ' ' : '') + url).then(function () { toast('Link skopiowany – wklej go, gdzie chcesz'); });
    }).catch(function (e) {
      if (e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || e)))) return;   // użytkownik zamknął menu
      toast('Nie udało się udostępnić. Link: ' + url, 5000);
    });
  }

  // ---------- Powiadomienia push (FCM, tematy) ----------
  // Stan wyboru trzymamy na urządzeniu (bez kont i bez zapisu tokenu na naszym serwerze): serwer wysyła wiadomość na temat,
  // a Google dostarcza ją urządzeniom zapisanym na ten temat. Wyłączenie = wypisanie urządzenia z tematu.
  var TOPICS = (CFG.topics || []).filter(function (t) { return !t.planned; });
  var KEY = 'app.topics';
  // Wybór zapisujemy PODWÓJNIE: localStorage + trwałe ciasteczko (rok, tylko /app/). WebView Androida zapisuje localStorage
  // na dysk z opóźnieniem – po szybkim zamknięciu aplikacji wybór potrafił zniknąć (znów ekran powitalny i domyślne tematy).
  var CK = 'radar_topics';
  function parseC(t) { try { var c = JSON.parse(t || 'null'); return c && typeof c === 'object' && !Array.isArray(c) ? c : null; } catch (e) { return null; } }
  function readCookie() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + CK + '=([^;]*)'));
    if (!m) return null;
    try { return parseC(decodeURIComponent(m[1])); } catch (e) { return null; }
  }
  function loadChoice() {
    var ls = null; try { ls = parseC(localStorage.getItem(KEY)); } catch (e) { ls = null; }
    var ck = readCookie();
    var c = ls || ck;
    if (c && (!ls || !ck)) saveChoice(c);   // brakuje jednej kopii – odtwarzamy ją
    return c;
  }
  function saveChoice(c) {
    var t = JSON.stringify(c || {});
    try { localStorage.setItem(KEY, t); } catch (e) { /* tryb prywatny */ }
    try { document.cookie = CK + '=' + encodeURIComponent(t) + '; Max-Age=31536000; Path=/app/; Secure; SameSite=Lax'; } catch (e) { /* bez ciasteczek */ }
  }
  function choice() {
    var c = loadChoice() || {}, out = {};
    TOPICS.forEach(function (t) { out[t.id] = t.required ? true : (c[t.id] !== undefined ? !!c[t.id] : !!t.def); });
    if (c.test) out.test = true;   // ukryty temat testowy właściciela (7× stuknij numer wersji)
    return out;
  }

  var channelsMade = false;
  function makeChannels(F) {
    if (channelsMade) return Promise.resolve();
    channelsMade = true;
    var made = {};
    var list = (CFG.topics || []).filter(function (t) { if (made[t.channel]) return false; made[t.channel] = 1; return true; });
    list.push({ channel: 'test', name: 'Test (właściciel)', desc: 'Powiadomienia testowe', importance: 3 });
    return Promise.all(list.map(function (t) {
      return F.createChannel({ id: t.channel, name: t.name, description: t.desc, importance: t.importance || 3, visibility: 1, lights: true, vibration: true })
        .catch(function () { /* kanał już jest albo stary Android */ });
    }));
  }

  function permission() {
    return plugin('FirebaseMessaging').then(function (F) {
      if (!F) return 'unsupported';
      return F.checkPermissions().then(function (p) { return p.receive; });
    }).catch(function () { return 'unsupported'; });
  }

  // Zapisuje/wypisuje urządzenie z tematów zgodnie z wyborem. Wywoływane przy każdym starcie (naprawia stan po reinstalacji).
  function apply(c) {
    return plugin('FirebaseMessaging').then(function (F) {
      if (!F) return false;
      return F.checkPermissions().then(function (p) {
        if (p.receive !== 'granted') return false;
        return makeChannels(F).then(function () {
          var ids = TOPICS.map(function (t) { return t.id; }).concat(['test']);
          return Promise.all(ids.map(function (id) {
            var on = !!c[id];
            return (on ? F.subscribeToTopic({ topic: id }) : F.unsubscribeFromTopic({ topic: id })).catch(function () { return null; });
          })).then(function () { return true; });
        });
      });
    }).catch(function () { return false; });
  }

  // Prośba o zgodę (Android 13+) i zapis wyboru. Zwraca 'granted' | 'denied' | 'unsupported'.
  function enable(c) {
    saveChoice(c);
    return plugin('FirebaseMessaging').then(function (F) {
      if (!F) return 'unsupported';
      return F.requestPermissions().then(function (p) {
        if (p.receive !== 'granted') return p.receive || 'denied';
        return F.getToken().catch(function () { return null; }).then(function () { return apply(c); }).then(function () { return 'granted'; });
      });
    }).catch(function () { return 'unsupported'; });
  }

  function setTopic(id, on) {
    var c = choice(); c[id] = !!on; saveChoice(c);
    return apply(c);
  }

  // Adres z powiadomienia: tylko ekran /app/ (z #widokiem) na tej samej domenie
  function safeTarget(u) {
    if (typeof u !== 'string' || /[\u0000-\u001f\\]/.test(u)) return null;
    try {
      var x = new URL(u, location.origin);
      if (x.origin !== location.origin || !/^\/app\/(index\.html)?$/.test(x.pathname)) return null;
      return x.pathname + x.search + x.hash;
    } catch (e) { return null; }
  }
  function openTarget(t) {
    if (!t) return;
    var cur = location.pathname + location.search;
    if (t.split('#')[0] === cur) { location.hash = t.split('#')[1] || 'radar'; return; }
    location.href = t;
  }

  if (isApp) {
    plugin('FirebaseMessaging').then(function (F) {
      if (!F) return;
      F.addListener('notificationActionPerformed', function (ev) {
        var d = ev && ev.notification && ev.notification.data, t = safeTarget(d && d.url);
        openTarget(t);
        if (t) setTimeout(function () { document.dispatchEvent(new CustomEvent('app:pushopen', { detail: t })); }, 0);
      });
      // Powiadomienie przy otwartej aplikacji: Android go nie pokazuje – dajemy komunikat i odświeżamy dane
      F.addListener('notificationReceived', function (ev) {
        var n = ev && ev.notification || {};
        if (n.title) toast(n.title + (n.body ? ' – ' + n.body : ''), 5000);
        document.dispatchEvent(new CustomEvent('app:push', { detail: n }));
      });
      apply(choice());
    }).catch(function () {});

    // Przycisk Wstecz: najpierw zamyka arkusz / wraca na Radar, dopiero potem chowa aplikację
    plugin('App').then(function (A) {
      if (!A) return;
      A.addListener('backButton', function () {
        if (window.AppBack && window.AppBack()) return;
        A.minimizeApp();
      });
      A.addListener('resume', function () { document.dispatchEvent(new CustomEvent('app:resume')); });
    }).catch(function () {});

    plugin('StatusBar').then(function (S) {
      if (!S) return;
      var light = document.documentElement.getAttribute('data-theme') === 'light';
      S.setStyle({ style: light ? 'LIGHT' : 'DARK' }).catch(function () {});
    }).catch(function () {});
    document.documentElement.classList.add('is-app');
  }

  // Ustawienia powiadomień Androida (dźwięk, „Nie przeszkadzać”) – strona systemowa aplikacji
  function openSystemSettings() {
    try { if (window.RadarNative && window.RadarNative.openNotificationSettings) { window.RadarNative.openNotificationSettings(); return; } } catch (e) { /* stara wersja aplikacji */ }
    toast('Ustawienia → Aplikacje → Radar EPWR → Powiadomienia', 5000);
  }

  // Wersja zainstalowanej aplikacji (versionName z APK, np. „1.0.0”) albo null poza aplikacją
  function appVersion() {
    return plugin('App').then(function (A) { return A ? A.getInfo().then(function (i) { return i && i.version || null; }) : null; }).catch(function () { return null; });
  }

  window.AppNative = {
    isApp: isApp, appVersion: appVersion, plugin: plugin, share: share, toast: toast, openExternal: openExternal,
    push: { topics: TOPICS, choice: choice, hasChoice: function () { return !!loadChoice(); }, saveChoice: saveChoice, enable: enable, setTopic: setTopic, permission: permission, openSystemSettings: openSystemSettings }
  };
})();
