/* Radar EPWR – aplikacja (radar-epwr.pl/app/). Ekrany: Radar · Loty · Zdarzenia · Nasłuch · Więcej.
 *
 * Wszystkie dane z tych samych źródeł co radar-epwr.pl (Worker /live, /flights, /alerts, /metar, /studio/status, /audio,
 * 7700.pl/api/alarm, Open-Meteo) – bez nowej logiki wykrywania i bez dodatkowego obciążenia: pobieramy tylko to,
 * co jest widoczne, i tylko gdy aplikacja jest na pierwszym planie.
 * Treści z serwera wstawiamy przez textContent albo esc() – nigdy surowym HTML.
 */
(function () {
  'use strict';
  var CFG = window.RADAR_APP_CONFIG;
  var N = window.AppNative;
  var W = CFG.worker;
  var MIN = 60000;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* tryb prywatny */ } }
  var SHOW_TEST = /[?&]alerttest=1/.test(location.search) || lsGet('app.owner') === '1';
  function active() { return !document.hidden; }
  function getJson(url, opt) {
    return fetch(url, opt || { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  var fmtHm = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hour12: false });
  var fmtDay = new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', year: 'numeric' });
  function hm(ts) { try { return fmtHm.format(new Date(ts)); } catch (e) { return ''; } }
  function dayPrefix(ts) {
    var d = fmtDay.format(new Date(ts));
    if (d === fmtDay.format(new Date())) return '';
    if (d === fmtDay.format(new Date(Date.now() - 24 * 60 * MIN))) return 'wczoraj ';
    return d.slice(0, 5) + ' ';
  }
  // Worker podaje godziny rozkładu jako czas LOKALNY lotniska z dopiskiem „+00:00” – HH:MM wycinamy z tekstu.
  // 'RRRR-MM-DDTHH:MM' w strefie Europe/Warsaw (do porównań z godzinami rozkładu)
  var fmtIso = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  function localIso(ts) { return fmtIso.format(new Date(ts)).replace(' ', 'T'); }
  function fhm(iso) { var m = /T(\d{2}:\d{2})/.exec(iso || ''); return m ? m[1] : ''; }

  // ===================== Zegar =====================
  function tick() {
    var d = new Date();
    $('clock').textContent = hm(d) + ' LOC · ' + d.toISOString().slice(11, 16) + ' UTC';
  }
  tick(); setInterval(tick, 15000);

  // ===================== Nawigacja =====================
  var VIEWS = ['radar', 'loty', 'zdarzenia', 'nasluch', 'wiecej'];
  var current = null;
  function parseHash() {
    var h = location.hash.replace(/^#/, ''), q = {};
    var parts = h.split('?'), v = parts[0];
    (parts[1] || '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    return { view: VIEWS.indexOf(v) >= 0 ? v : 'radar', q: q };
  }
  function show(view) {
    if (current === view) return;
    current = view;
    VIEWS.forEach(function (v) { $('v-' + v).hidden = v !== view; });
    document.querySelectorAll('.tabbar a').forEach(function (a) {
      if (a.dataset.tab === view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.dispatchEvent(new CustomEvent('app:view', { detail: view }));
    updateMini();
  }
  function route() {
    var r = parseHash();
    show(r.view);
    if (r.view === 'radar' && r.q.hex) radarFocus(r.q.hex);
    if (r.view === 'zdarzenia' && r.q.f) setEvFilter(r.q.f);
    if (r.q.update) { checkUpdate(true); history.replaceState(null, '', '#' + r.view); }   // kolejny push z tym samym adresem znów zadziała
  }
  window.addEventListener('hashchange', route);
  // Przycisk Wstecz w Androidzie (native.js): true = obsłużone tutaj
  window.AppBack = function () {
    if (!$('sheet').hidden) { closeSheet(); return true; }
    if (!$('onb').hidden) return false;
    if (radar.map && radar.sel) { radar.map.close(); return true; }
    if (current !== 'radar') { location.hash = 'radar'; return true; }
    return false;
  };

  // ===================== Arkusz dolny =====================
  var lastFocus = null;
  function openSheet(title, html, after) {
    lastFocus = document.activeElement;
    $('sheetTitle').textContent = title;
    $('sheetBody').innerHTML = html;
    $('sheet').hidden = $('sheetBg').hidden = false;
    $('sheet').scrollTop = 0;
    $('sheetClose').focus();
    if (after) after($('sheetBody'));
  }
  function closeSheet() {
    $('sheet').hidden = $('sheetBg').hidden = true;
    $('sheetBody').innerHTML = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $('sheetClose').addEventListener('click', closeSheet);
  $('sheetBg').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('sheet').hidden) closeSheet(); });

  // ===================== Udostępnianie lotu =====================
  function altTxt(a) {
    if (a.alt_baro === 'ground') return 'na ziemi';
    var v = typeof a.alt_baro === 'number' ? a.alt_baro : a.alt_geom;
    if (typeof v !== 'number') return '';
    return v >= 6500 ? 'FL' + String(Math.round(v / 100)).padStart(3, '0') : Math.round(v / 50) * 50 + ' ft';
  }
  function shareAircraft(a) {
    var cs = String(a.flight || '').trim() || String(a.r || '').trim() || a.hex.toUpperCase();
    var url = CFG.site + '/lot/?hex=' + encodeURIComponent(a.hex) + (cs ? '&cs=' + encodeURIComponent(cs) : '');
    var bits = [a.t, altTxt(a), typeof a.gs === 'number' ? Math.round(a.gs) + ' kt' : ''].filter(Boolean).join(' · ');
    N.share({ title: 'Lot ' + cs + ' – Radar EPWR', text: '✈️ Śledzę lot ' + cs + (bits ? ' (' + bits + ')' : '') + ' nad Wrocławiem na żywo w Radar EPWR:', url: url, dialog: 'Udostępnij lot' })
      .then(coffeeAfterShare);
  }
  function shareBoardFlight(f, isDep) {
    var nr = flightNr(f), other = (isDep ? f.arrival : f.departure) || {}, leg = (isDep ? f.departure : f.arrival) || {};
    var place = cityOf(other.airport) || other.iata || '';
    var url = CFG.site + '/lot/?nr=' + encodeURIComponent(nr) + '&k=' + (isDep ? 'dep' : 'arr') + '&s=' + encodeURIComponent(String(leg.scheduled || '').slice(0, 16));
    var txt = (isDep ? '🛫 Lot ' + nr + ' Wrocław → ' + place : '🛬 Lot ' + nr + ' ' + place + ' → Wrocław') + ', planowo ' + (fhm(leg.scheduled) || '') + ' · ' + statusOf(f, isDep)[1] + '. Śledź na żywo w Radar EPWR:';
    N.share({ title: 'Lot ' + nr + ' – Radar EPWR', text: txt, url: url, dialog: 'Udostępnij lot' }).then(coffeeAfterShare);
  }

  // ===================== RADAR (mapa) =====================
  var radar = { map: null, pg: null, loading: false, mode: 'radar', sel: null, pendingHex: null };
  var leafletP = null;
  function load(src, css) {
    return new Promise(function (ok, fail) {
      var el = document.createElement(css ? 'link' : 'script');
      if (css) { el.rel = 'stylesheet'; el.href = src; } else { el.src = src; }
      el.onload = ok; el.onerror = fail; document.head.appendChild(el);
    });
  }
  function ensureLeaflet() {
    if (window.L) return Promise.resolve();
    if (!leafletP) leafletP = Promise.all([load('/vendor/leaflet/leaflet.css', true), load('/vendor/leaflet/leaflet.js')]).catch(function (e) { leafletP = null; throw e; });
    return leafletP;
  }
  function onSelect(a) {
    radar.sel = a;
    var bar = $('selBar');
    if (!a) { bar.hidden = true; return; }
    $('selCs').textContent = String(a.flight || '').trim() || String(a.r || '').trim() || a.hex.toUpperCase();
    $('selSub').textContent = [a.t, a.r, altTxt(a)].filter(Boolean).join(' · ');
    bar.hidden = false;
  }
  $('selShare').addEventListener('click', function () { if (radar.sel) shareAircraft(radar.sel); });
  function initMap() {
    if (radar.map || radar.loading) return;
    if ($('v-radar').hidden) return;   // Leaflet na ukrytym ekranie ma zerowy rozmiar (zły zoom) – start przy pierwszym pokazaniu Radaru
    radar.loading = true;
    ensureLeaflet()
      .then(function () { return load('/procedury/epwr-procedury.js?v=15'); })
      .then(function () {
        $('map').textContent = '';
        radar.map = window.radarEpwrProcedury($('map'), { wind: window.radarEpwrWind, mode: radar.mode === 'proc' ? 'proc' : 'radar', onSelect: onSelect, focusHex: radar.pendingHex });
        radar.pendingHex = null;
      })
      .catch(function () { $('map').textContent = 'Nie udało się wczytać radaru. Sprawdź internet i otwórz aplikację ponownie.'; })
      .then(function () { radar.loading = false; });
  }
  function initPogoda() {
    if (radar.pg) { radar.pg.setVisible(true); return; }
    if ($('v-radar').hidden || radar.pgLoading) return;
    radar.pgLoading = true;
    $('pogodaMap').textContent = 'Ładowanie mapy pogody…';
    ensureLeaflet()
      .then(function () { return load('/pogoda/logika.js?v=2'); })
      .then(function () { return window.radarEpwrKarta ? 0 : load('/procedury/epwr-procedury.js?v=15'); })
      .then(function () { return load('/pogoda/pogoda.js?v=5'); })
      .then(function () { $('pogodaMap').textContent = ''; radar.pg = window.radarEpwrPogoda($('pogodaMap'), { workerBase: W, params: '', flags: { lightning: false }, dock: $('pogodaDock') }); })
      .catch(function () { $('pogodaMap').textContent = 'Nie udało się wczytać mapy pogody.'; })
      .then(function () { radar.pgLoading = false; });
  }
  var FOOT = {
    radar: 'Samoloty: adsb.lol / adsb.fi (ODbL) · mapa © OpenStreetMap · stuknij samolot: karta, ślad i udostępnianie',
    proc: 'Procedury: AIP Polska (PAŻP) – ilustracja, nie do nawigacji · stuknij trasę lub samolot',
    pogoda: 'Opady: RainViewer · SIGMET/METAR/TAF: aviationweather.gov · ostrzeżenia IMGW · poglądowo, nie do nawigacji'
  };
  function setMode(m) {
    radar.mode = m;
    document.querySelectorAll('#v-radar .seg button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.mode === m ? 'true' : 'false'); });
    var pog = m === 'pogoda';
    $('map').hidden = pog; $('pogodaMap').hidden = !pog;
    $('pogodaDock').hidden = !pog; $('v-radar').classList.toggle('pog', pog);
    if (!pog) $('v-radar').scrollTop = 0;
    $('selBar').hidden = pog || !radar.sel;
    $('mapFoot').textContent = FOOT[m];
    if (pog) { initPogoda(); return; }
    if (radar.pg) radar.pg.setVisible(false);
    if (radar.map) { radar.map.setMode(m === 'proc' ? 'proc' : 'radar'); radar.map.refresh(); } else initMap();
  }
  document.querySelectorAll('#v-radar .seg button').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
  function radarFocus(hex) {
    hex = String(hex || '').toLowerCase();
    if (!/^[0-9a-f]{6}$/.test(hex)) return;
    if (radar.mode === 'pogoda') setMode('radar');
    if (radar.map) { if (!radar.map.select(hex)) N.toast('Szukam samolotu na radarze…'); }
    else { radar.pendingHex = hex; initMap(); }
  }
  document.addEventListener('app:view', function (e) {
    if (e.detail !== 'radar') return;
    if (radar.mode === 'pogoda') initPogoda();
    else if (radar.map) radar.map.refresh(); else initMap();
  });

  // ===================== Pogoda (pasek nad mapą + arkusz) =====================
  var wx = { d: null, metar: '' };
  var WX_URL = 'https://api.open-meteo.com/v1/forecast?latitude=51.1027&longitude=16.8858&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility&hourly=temperature_2m,weather_code&forecast_hours=7&wind_speed_unit=kn&timezone=Europe%2FWarsaw';
  function wmo(code, isDay) {
    var night = isDay === 0;
    if (code === 0) return [night ? '🌙' : '☀️', 'Bezchmurnie'];
    if (code === 1) return [night ? '🌙' : '🌤️', 'Przeważnie pogodnie'];
    if (code === 2) return ['⛅', 'Zachmurzenie umiarkowane'];
    if (code === 3) return ['☁️', 'Pochmurno'];
    if (code === 45 || code === 48) return ['🌫️', 'Mgła'];
    if (code >= 51 && code <= 57) return ['🌦️', 'Mżawka'];
    if (code >= 61 && code <= 67) return ['🌧️', code >= 66 ? 'Marznący deszcz' : 'Deszcz'];
    if (code >= 71 && code <= 77) return ['🌨️', 'Śnieg'];
    if (code >= 80 && code <= 82) return ['🌦️', 'Przelotny deszcz'];
    if (code === 85 || code === 86) return ['🌨️', 'Przelotny śnieg'];
    if (code >= 95) return ['⛈️', 'Burza'];
    return ['·', '—'];
  }
  function pad3(n) { n = Math.round(n) % 360; return String(n).padStart(3, '0'); }
  function rwyOf(dir, spd) {   // ten sam wzór co mapa procedur: składowa czołowa na pas 29 (kurs 296°)
    if (!(spd >= 3) || typeof dir !== 'number') return '29';
    return Math.cos((dir - 296) * Math.PI / 180) * spd < -1 ? '11' : '29';
  }
  function loadWx() {
    if (!active()) return;
    getJson(WX_URL, {}).then(function (d) {
      wx.d = d; var c = d.current || {}, w = wmo(c.weather_code, c.is_day), spd = Math.round(c.wind_speed_10m);
      $('wxIco').textContent = w[0];
      $('wxT').textContent = Math.round(c.temperature_2m) + '°C';
      $('wxW').textContent = spd < 1 ? 'cisza' : pad3(c.wind_direction_10m) + '°/' + spd + ' kt';
      $('wxRwy').textContent = 'PAS ' + rwyOf(c.wind_direction_10m, c.wind_speed_10m);
      window.radarEpwrWind = { dir: c.wind_direction_10m, spd: c.wind_speed_10m };
      if (radar.map) radar.map.setWind(window.radarEpwrWind);
    }).catch(function () { $('wxW').textContent = 'pogoda niedostępna'; });
    fetch(W + '/metar').then(function (r) { if (!r.ok) throw new Error(); return r.text(); })
      .then(function (t) { t = (t || '').trim(); if (/^(METAR|SPECI)?\s*EPWR/.test(t)) wx.metar = t; }).catch(function () {});
  }
  $('wxStrip').addEventListener('click', function () {
    var c = (wx.d && wx.d.current) || {}, h = (wx.d && wx.d.hourly) || {}, w = wmo(c.weather_code, c.is_day);
    var hours = '';
    for (var i = 1; i < Math.min(7, (h.time || []).length); i++) hours += '<div><b>' + esc(h.time[i].slice(11, 13)) + '</b>' + wmo(h.weather_code[i], 1)[0] + '<br>' + Math.round(h.temperature_2m[i]) + '°</div>';
    var vis = c.visibility;
    openSheet('Pogoda EPWR ' + w[0],
      '<p>' + esc(w[1]) + (wx.d ? ' · odczuwalna ' + Math.round(c.apparent_temperature) + '°C · wilgotność ' + Math.round(c.relative_humidity_2m) + '%' : '') + '</p>' +
      '<dl class="kv"><div><dt>Temperatura</dt><dd>' + (wx.d ? Math.round(c.temperature_2m) + '°C' : '–') + '</dd></div>' +
      '<div><dt>Wiatr</dt><dd>' + (wx.d ? (Math.round(c.wind_speed_10m) < 1 ? 'cisza' : pad3(c.wind_direction_10m) + '° / ' + Math.round(c.wind_speed_10m) + ' kt') : '–') + '</dd></div>' +
      '<div><dt>Porywy</dt><dd>' + (wx.d ? Math.round(c.wind_gusts_10m) + ' kt' : '–') + '</dd></div>' +
      '<div><dt>QNH</dt><dd>' + (wx.d ? Math.round(c.pressure_msl) + ' hPa' : '–') + '</dd></div>' +
      '<div><dt>Widzialność</dt><dd>' + (vis == null ? '–' : vis >= 10000 ? '10+ km' : (vis / 1000).toFixed(vis < 5000 ? 1 : 0) + ' km') + '</dd></div>' +
      '<div><dt>Pas w użyciu (szacunek)</dt><dd>' + (wx.d ? rwyOf(c.wind_direction_10m, c.wind_speed_10m) : '–') + '</dd></div></dl>' +
      (hours ? '<div class="hours">' + hours + '</div>' : '') +
      '<h3>METAR</h3><div class="metar" id="shMetar"></div>' +
      '<p class="note">Pas w użyciu podaje ATIS – tu szacunek z wiatru. Źródło: Open-Meteo, aviationweather.gov. Nie do nawigacji.</p>' +
      '<div class="acts"><a class="btn ghost" href="' + CFG.site + '/metar-epwr/">METAR rozkodowany po polsku</a><button type="button" class="btn ghost" id="shPog">Mapa opadów i burz</button></div>',
      function (b) {
        b.querySelector('#shMetar').textContent = wx.metar || 'METAR chwilowo niedostępny.';
        b.querySelector('#shPog').addEventListener('click', function () { closeSheet(); setMode('pogoda'); });
      });
  });

  // ===================== LOTY (tablica) =====================
  var fl = { data: { departures: [], arrivals: [] }, board: 'dep', q: '', loaded: false, at: 0, fetchedAt: null, stale: false };
  var CHIP = ['#c8102e', '#0b4ea2', '#e4007c', '#f2a900', '#00843d', '#6d2077', '#00a3e0', '#d4451d', '#3b3b3b', '#0e7c86'];
  function chipColor(code) { var h = 0; for (var i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) >>> 0; return CHIP[h % CHIP.length]; }
  function mergeCodeshares(list) {
    var byNr = {};
    list.forEach(function (f) {
      f._cs = (f.flight && Array.isArray(f.flight.codeshares)) ? f.flight.codeshares.map(function (x) { return String(x).toUpperCase(); }) : [];
      var nr = f.flight && f.flight.iata;
      if (nr && !(f.flight && f.flight.codeshared)) byNr[nr.toUpperCase()] = f;
    });
    return list.filter(function (f) {
      var cs = f.flight && f.flight.codeshared;
      if (!cs) return true;
      var op = byNr[String(cs.flight_iata || '').toUpperCase()];
      if (op) { op._cs.push((f.flight.iata || '').toUpperCase()); return false; }
      return true;
    });
  }
  function flightNr(f) { return String((f.flight && (f.flight.iata || f.flight.icao)) || '').toUpperCase() || '—'; }
  function airCode(f) { var n = flightNr(f); return (f.airline && f.airline.iata ? f.airline.iata : n.replace(/\d.*$/, '')).toUpperCase() || '??'; }
  function cityOf(s) { return String(s || '').replace(/\s*\([A-Z]{3,4}\)\s*$/, ''); }
  function statusOf(f, isDep) {
    var leg = (isDep ? f.departure : f.arrival) || {}, s = f.flight_status, delay = leg.delay || 0;
    var est = fhm(leg.estimated), act = fhm(leg.actual);
    if (s === 'cancelled') return ['cancel', 'Odwołany'];
    if (s === 'incident') return ['cancel', 'Incydent'];
    if (s === 'diverted') return ['delay', 'Przekierowany'];
    if (s === 'landed') return ['done', (isDep ? 'Odleciał' : 'Wylądował') + (act ? ' ' + act : '')];
    if (s === 'active') return isDep ? ['done', 'Odleciał' + (act ? ' ' + act : '')] : ['go', 'W powietrzu' + (est ? ' · ' + est : '')];
    if (delay >= 10) return ['delay', 'Opóźniony' + (est ? ' ' + est : ' +' + delay + '′')];
    return ['', isDep ? 'Planowy' : 'Oczekiwany'];
  }
  var DONE = { landed: 1, cancelled: 1, diverted: 1, incident: 1 };
  function isDone(f, isDep) { return !!DONE[f.flight_status] || (isDep && f.flight_status === 'active'); }
  function boardList() {
    var isDep = fl.board === 'dep', key = isDep ? 'departure' : 'arrival';
    var list = (isDep ? fl.data.departures : fl.data.arrivals).slice().sort(function (a, b) {
      var ta = (a[key] || {}).scheduled || '', tb = (b[key] || {}).scheduled || ''; return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
    var q = fl.q.trim().toLowerCase();
    if (q) {
      return list.filter(function (f) {
        var other = (isDep ? f.arrival : f.departure) || {};
        return [flightNr(f), (f._cs || []).join(' '), other.airport, other.iata, f.airline && f.airline.name, f.flight && f.flight.icao, f.aircraft && f.aircraft.registration]
          .join(' ').toLowerCase().indexOf(q) >= 0;
      });
    }
    // Od godziny wstecz (czas lokalny Wrocławia; źródło bywa nieaktualne i zostawia poranne loty jako „planowe”).
    // Samoloty w powietrzu (przyloty „active”) zostają zawsze.
    var cut = localIso(Date.now() - 60 * MIN);
    var recent = list.filter(function (f) {
      var leg = f[key] || {};
      if (!isDep && f.flight_status === 'active') return true;
      return String(leg.actual || leg.estimated || leg.scheduled || '').slice(0, 16) >= cut;
    });
    return recent.length ? recent : list.slice(-10);
  }
  function renderBoard() {
    var isDep = fl.board === 'dep', ul = $('fList');
    document.querySelectorAll('#v-loty .seg button').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.board === fl.board ? 'true' : 'false'); });
    if (!fl.loaded) return;
    var list = boardList();
    if (!list.length) { ul.innerHTML = '<li class="empty">' + (fl.q ? 'Brak lotów pasujących do „' + esc(fl.q) + '”.' : 'Brak lotów do wyświetlenia.') + '</li>'; return; }
    ul.innerHTML = list.map(function (f, i) {
      var leg = (isDep ? f.departure : f.arrival) || {}, other = (isDep ? f.arrival : f.departure) || {};
      var st = statusOf(f, isDep), sch = fhm(leg.scheduled), est = fhm(leg.actual || leg.estimated);
      var code = airCode(f), cs = (f._cs || []).join(' ');
      return '<li><button type="button" class="fl' + (isDone(f, isDep) ? ' done' : '') + '" data-i="' + i + '">' +
        '<span class="t">' + esc(sch || '—') + (est && est !== sch ? (st[0] === 'delay' ? '<em>' + esc(est) + '</em>' : '<s>' + esc(sch) + '</s>') : '') + '</span>' +
        '<span class="m"><span class="p">' + esc(cityOf(other.airport) || other.iata || '—') + '</span>' +
        '<span class="n"><span class="chip" style="background:' + chipColor(code) + '">' + esc(code) + '</span><b>' + esc(flightNr(f)) + '</b>' +
        (cs ? ' · ' + esc(cs) : '') + ((f.airline && f.airline.name) ? ' · ' + esc(f.airline.name) : '') + '</span></span>' +
        '<span class="st ' + st[0] + '">' + esc(st[1]) + '</span></button></li>';
    }).join('');
    ul._list = list;
  }
  $('fList').addEventListener('click', function (e) {
    var b = e.target.closest('button.fl'); if (!b) return;
    var f = $('fList')._list[+b.dataset.i]; if (f) flightSheet(f, fl.board === 'dep');
  });
  document.querySelectorAll('#v-loty .seg button').forEach(function (b) { b.addEventListener('click', function () { fl.board = b.dataset.board; renderBoard(); $('v-loty').scrollTop = 0; }); });
  $('fSearch').addEventListener('input', function (e) { fl.q = e.target.value; renderBoard(); });
  function loadFlights(force) {
    if (!active() || (!force && Date.now() - fl.at < 4 * MIN)) return;
    fl.at = Date.now();
    getJson(W + '/flights').then(function (d) {
      if (d.error || !Array.isArray(d.departures) || !Array.isArray(d.arrivals)) throw new Error(d.error || 'zła odpowiedź');
      fl.data.departures = mergeCodeshares(d.departures || []);
      fl.data.arrivals = mergeCodeshares(d.arrivals || []);
      window.radarEpwrFids = fl.data;   // karta samolotu na radarze: skąd–dokąd z rozkładu
      fl.loaded = true; fl.fetchedAt = d.fetchedAt; fl.stale = !!d.stale;
      $('fUpd').textContent = fl.fetchedAt ? 'stan z ' + hm(fl.fetchedAt) + (fl.stale ? ' (może być nieaktualny)' : '') : '';
      renderBoard();
    }).catch(function () {
      if (!fl.loaded) $('fList').innerHTML = '<li class="empty">Rozkład chwilowo niedostępny – spróbuj za kilka minut.</li>';
    });
  }
  // Szukanie samolotu z tablicy na radarze (/live): znak ATC, numer ICAO albo rejestracja
  function findOnRadar(f) {
    var keys = [f.flight && f.flight.atc, f.flight && f.flight.icao].filter(Boolean).map(function (x) { return String(x).replace(/\s/g, '').toUpperCase(); });
    var reg = String((f.aircraft && f.aircraft.registration) || '').replace(/-/g, '').toUpperCase();
    return getJson(W + '/live').then(function (d) {
      var hit = (d.ac || []).filter(function (a) {
        var cs = String(a.flight || '').trim().toUpperCase(), r = String(a.r || '').replace(/-/g, '').toUpperCase();
        return (cs && keys.indexOf(cs) >= 0) || (reg && r === reg);
      })[0];
      return hit ? hit.hex : null;
    });
  }
  // Baner partnerski w karcie lotu (Travelpayouts, sub ID „app”): AirHelp przy odwołaniu/opóźnieniu >= 45 min, Kiwitaxi przy przylocie.
  // Zwykły link – native.js otwiera go w karcie przeglądarki (śledzenie partnera działa w przeglądarce). Bez skryptów.
  var AIRHELP = 'https://airhelp.tpk.lv/HYjJWtoC', KIWITAXI = 'https://kiwitaxi.tpk.lv/WQGwGVIb?u=https%3A%2F%2Fkiwitaxi.com%2Fpl';
  function partnerHtml(f, isDep) {
    var leg = (isDep ? f.departure : f.arrival) || {}, bad = f.flight_status === 'cancelled' || (leg.delay || 0) >= 45, p;
    if (bad) p = { c: 'airhelp', h: AIRHELP, img: '/partnerzy/airhelp-logo.svg', alt: 'AirHelp', w: 78, ht: 26,
      t: f.flight_status === 'cancelled' ? 'Lot odwołany?' : 'Lot opóźniony?',
      s: 'Sprawdź, czy należy Ci się odszkodowanie do 600 € za lot w UE. Kilka minut i bez ryzyka.', b: 'Sprawdź swoje prawa' };
    else if (!isDep && f.flight_status !== 'landed' && !DONE[f.flight_status]) p = { c: 'kiwitaxi', h: KIWITAXI, img: '/partnerzy/kiwitaxi-logo.svg', alt: 'Kiwitaxi', w: 30, ht: 26,
      t: 'Odbierasz kogoś z lotniska?', s: 'Zamów transfer z góry po stałej cenie. Kierowca czeka na przylocie.', b: 'Zamów transfer' };
    else return '';
    return '<a class="pb pb-' + p.c + '" href="' + p.h + '" target="_blank" rel="sponsored noopener" aria-label="' + esc(p.t + ' ' + p.s) + ' (reklama, otwiera się w przeglądarce)">' +
      '<span class="pb-label">Reklama · partner</span><img class="pb-logo" src="' + p.img + '" alt="' + p.alt + '" width="' + p.w + '" height="' + p.ht + '">' +
      '<strong class="pb-title">' + esc(p.t) + '</strong><span class="pb-sub">' + esc(p.s) + '</span><span class="pb-cta">' + esc(p.b) + ' →</span></a>';
  }
  function flightSheet(f, isDep) {
    var leg = (isDep ? f.departure : f.arrival) || {}, other = (isDep ? f.arrival : f.departure) || {}, st = statusOf(f, isDep);
    var nr = flightNr(f), place = cityOf(other.airport) || other.iata || '—';
    var live = !isDone(f, isDep) || f.flight_status === 'active' || (f.flight_status === 'landed' && !isDep);
    var odb = CFG.features.odbior;
    var pickKey = String((f.flight && (f.flight.icao || f.flight.iata)) || '').toUpperCase() + '|' + String((f.arrival && f.arrival.scheduled) || '');
    openSheet((isDep ? '🛫 ' : '🛬 ') + nr,
      '<p><b>' + esc(isDep ? 'Wrocław → ' + place : place + ' → Wrocław') + '</b>' + ((f.airline && f.airline.name) ? ' · ' + esc(f.airline.name) : '') + '</p>' +
      '<dl class="kv"><div><dt>Planowo</dt><dd>' + esc(fhm(leg.scheduled) || '–') + '</dd></div>' +
      '<div><dt>' + (leg.actual ? 'Rzeczywiście' : 'Szacowany') + '</dt><dd>' + esc(fhm(leg.actual || leg.estimated) || '–') + '</dd></div>' +
      '<div><dt>Status</dt><dd>' + esc(st[1]) + '</dd></div>' +
      '<div><dt>' + (isDep ? 'Bramka' : 'Taśma bagażowa') + '</dt><dd>' + esc((isDep ? leg.gate : leg.baggage) || '–') + '</dd></div>' +
      ((f.aircraft && f.aircraft.registration) ? '<div><dt>Rejestracja</dt><dd>' + esc(f.aircraft.registration) + '</dd></div>' : '') +
      ((f._cs || []).length ? '<div><dt>Codeshare</dt><dd>' + esc(f._cs.join(' ')) + '</dd></div>' : '') + '</dl>' +
      '<div class="acts">' +
      (live ? '<button type="button" class="btn" id="shRadar">Pokaż na radarze</button>' : '') +
      '<button type="button" class="btn ghost" id="shShare"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.7-3.4a3 3 0 0 0 0-1.6l6.7-3.4A3 3 0 1 0 15 7l-6.7 3.4a3 3 0 1 0 0 3.2L15 17a3 3 0 1 0 3-1z"/></svg>Udostępnij lot</button>' +
      (odb.enabled && !isDep && !isDone(f, isDep) ? '<a class="btn ghost" href="' + esc(odb.url + '?dodaj=' + encodeURIComponent(pickKey)) + '">' + esc(odb.label) + '</a>' : '') +
      '</div>' + partnerHtml(f, isDep) + '<p class="note">Godziny lokalne. Dane: ' + esc(f.source === 'avionio' ? 'Avionio' : 'FlightAware / Avionio') + ' – mogą się różnić od tablicy na lotnisku.</p>',
      function (b) {
        b.querySelector('#shShare').addEventListener('click', function () { shareBoardFlight(f, isDep); });
        var r = b.querySelector('#shRadar');
        if (r) r.addEventListener('click', function () {
          r.disabled = true; r.textContent = 'Szukam na radarze…';
          findOnRadar(f).then(function (hex) {
            if (!hex) { r.disabled = false; r.textContent = 'Pokaż na radarze'; N.toast('Samolotu nie ma teraz w zasięgu radaru (60 NM wokół Wrocławia).', 4000); return; }
            closeSheet(); location.hash = 'radar?hex=' + hex;
          }).catch(function () { r.disabled = false; r.textContent = 'Pokaż na radarze'; N.toast('Radar chwilowo niedostępny.'); });
        });
      });
  }
  document.addEventListener('app:view', function (e) { if (e.detail === 'loty') loadFlights(false); });

  // ===================== ZDARZENIA i pasek alarmu =====================
  var HOT = { emergency: 'alert', diversion: 'warn', goaround: 'warn', pattern: 'warn', holding: 'warn' };
  var HIDDEN = { unverified: 1 };   // wątpliwe wg AI – nie pokazujemy nigdzie (jak na stronie)
  var CATS = {
    emergency: ['Alarm', '#ff4d4d'], diversion: ['Przekierowanie', '#ffd54f'], goaround: ['Odejście na drugi krąg', '#ffd54f'],
    pattern: ['Seria podejść', '#ffd54f'], holding: ['Holding', '#ffd54f'],
    military: ['Wojsko', '#8fd16a'], cargo: ['Rzadki gość', '#ffb020'], calibration: ['Kalibracja', '#5cc8ff'],
    heli: ['Śmigłowiec', '#ff8fb1'], orbit: ['Krążenie', '#ff8fb1'], night: ['Nocny lot', '#b59cff'],
    newcomer: ['Nowy gość', '#ffb020'], runway: ['Zmiana pasa', '#5ce1e6'], wx: ['Pogoda', '#5cc8ff'],
    wxNeighbour: ['Pogoda u sąsiadów', '#5cc8ff'], taf: ['Prognoza', '#5cc8ff'], delays: ['Opóźnienia', '#ffb020'],
    cancel: ['Odwołania', '#ff7a7a'], summary: ['Podsumowanie dnia', '#9aa6c9']
  };
  var ACTIVE_MS = { alert: 45 * MIN, warn: 30 * MIN };
  var ev = { all: [], f: 'all', at: 0, sig: '' };
  function setEvFilter(f) {
    ev.f = ['all', 'hot', 'feed'].indexOf(f) >= 0 ? f : 'all';
    document.querySelectorAll('#v-zdarzenia .chips button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.f === ev.f ? 'true' : 'false'); });
    renderEvents();
  }
  document.querySelectorAll('#v-zdarzenia .chips button').forEach(function (b) { b.addEventListener('click', function () { setEvFilter(b.dataset.f); }); });
  function evList() {
    var now = Date.now();
    return ev.all.filter(function (a) {
      if (HIDDEN[a.rule] || (a.test && !SHOW_TEST) || now - a.ts > 48 * 60 * MIN) return false;
      if (ev.f === 'hot') return !!HOT[a.rule];
      if (ev.f === 'feed') return !HOT[a.rule];
      return true;
    });
  }
  function renderEvents() {
    var ul = $('eList'), list = evList(), now = Date.now();
    if (!ev.loaded) return;
    if (!list.length) { ul.innerHTML = '<li class="empty">Spokojnie – brak zdarzeń w ostatnich 48 h' + (ev.f !== 'all' ? ' w tej kategorii' : '') + '.</li>'; return; }
    ul.innerHTML = list.slice(0, 60).map(function (a, i) {
      var c = CATS[a.rule] || ['Zdarzenie', '#8e9bc0'];
      return '<li class="ev" style="--bar:' + c[1] + '"><span class="cat">' + esc(c[0]) + (a.test ? ' · TEST' : '') + '</span>' +
        (now - a.ts < 15 * MIN ? '<span class="new">NOWE</span>' : '') +
        '<div class="eh"><h3 class="et">' + esc(a.title) + '</h3><time>' + esc(dayPrefix(a.ts) + hm(a.ts)) + '</time></div>' +
        (a.ident || a.where ? '<p>' + esc([a.ident, a.where].filter(Boolean).join(' · ')) + '</p>' : '') +
        (a.desc ? '<p>' + esc(a.desc) + '</p>' : '') +
        '<div class="ea">' + (a.hex ? '<button type="button" class="btn sm" data-map="' + i + '">Pokaż na radarze</button>' : '') +
        '<button type="button" class="btn sm ghost" data-share="' + i + '">Udostępnij</button></div></li>';
    }).join('');
    ul._list = list;
  }
  $('eList').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    var a = ($('eList')._list || [])[+(b.dataset.map || b.dataset.share)]; if (!a) return;
    if (b.dataset.map !== undefined) { location.hash = 'radar?hex=' + a.hex; return; }
    var url = a.hex ? CFG.site + '/lot/?hex=' + a.hex + '&cs=' + encodeURIComponent(String(a.ident || '').split(/[ ·,]/)[0]) : (a.rule === 'emergency' ? CFG.site + '/alert/' : CFG.site + '/');
    N.share({ title: a.title, text: a.title + (a.ident ? ' · ' + a.ident : '') + ' – Radar EPWR', url: url, dialog: 'Udostępnij zdarzenie' }).then(coffeeAfterShare);
  });
  function renderBar() {
    var now = Date.now();
    var hot = ev.all.filter(function (a) { var l = HOT[a.rule]; return l && (!a.test || SHOW_TEST) && now - a.ts < ACTIVE_MS[l]; });
    var bar = $('abar');
    if (!hot.length) { bar.hidden = true; return; }
    var a = hot[0], lvl = HOT[a.rule];
    bar.className = 'abar ' + lvl; bar.hidden = false;
    $('abarTag').textContent = lvl === 'alert' ? 'ALARM' : 'UWAGA';
    $('abarTxt').textContent = hm(a.ts) + ' · ' + a.title + (a.ident ? ' · ' + a.ident : '');
  }
  $('abar').addEventListener('click', function () { location.hash = 'zdarzenia?f=hot'; });
  function renderBadge() {
    var seen = +(lsGet('app.evSeen') || 0), n = 0;
    if (current === 'zdarzenia') { lsSet('app.evSeen', String(Date.now())); seen = Date.now(); }
    ev.all.forEach(function (a) { if (a.ts > seen && !HIDDEN[a.rule] && (!a.test || SHOW_TEST) && Date.now() - a.ts < 48 * 60 * MIN) n++; });
    var b = $('evBadge'); b.hidden = !n || !seen; b.textContent = n > 9 ? '9+' : String(n);
    if (!seen) lsSet('app.evSeen', String(Date.now()));   // pierwsze uruchomienie: bez zaległego licznika
  }
  function loadEvents(force) {
    if (!active() || (!force && Date.now() - ev.at < 25000)) return;
    ev.at = Date.now();
    getJson(W + '/alerts').then(function (d) {
      var list = (Array.isArray(d) ? d : []).filter(function (a) { return a && a.title && typeof a.ts === 'number'; }).sort(function (a, b) { return b.ts - a.ts; });
      var sig = list.map(function (a) { return a.id; }).join(',');
      ev.loaded = true; ev.all = list;
      if (sig !== ev.sig) { ev.sig = sig; renderEvents(); }
      renderBar(); renderBadge();
    }).catch(function () { if (!ev.loaded) $('eList').innerHTML = '<li class="empty">Zdarzenia chwilowo niedostępne.</li>'; });
  }
  document.addEventListener('app:view', function (e) { if (e.detail === 'zdarzenia') { loadEvents(false); renderEvents(); renderBadge(); } });
  document.addEventListener('app:push', function () { loadEvents(true); checkLive(true); });

  // ===================== Alarm 7700 nad Polską (7700.pl) =====================
  var A77 = { PRIO: { '7500': 0, '7700': 1, '7600': 2 }, LEVEL: { '7700': 'emergency', '7600': 'radio', '7500': 'hijack' }, NAME: { '7700': 'niebezpieczeństwo', '7600': 'brak łączności', '7500': 'bezprawna ingerencja' }, d: null, at: 0 };
  function load7700() {
    if (!active() || Date.now() - A77.at < 14000) return;
    A77.at = Date.now();
    getJson(CFG.alarm7700).then(function (d) {
      A77.d = d;
      var p = $('a77Pill');
      if (!d.sourceOk || !(Date.now() - Date.parse(d.updatedAt) < 5 * MIN)) { p.dataset.level = 'unknown'; $('a77Txt').textContent = '7700 ?'; return; }
      var act = (d.active || []).filter(function (a) { return a && A77.LEVEL[a.code]; }).sort(function (a, b) { return A77.PRIO[a.code] - A77.PRIO[b.code]; });
      if (!act.length) { p.dataset.level = 'ok'; $('a77Txt').textContent = '7700 BRAK'; return; }
      p.dataset.level = A77.LEVEL[act[0].code]; $('a77Txt').textContent = 'SQ ' + act[0].code + (act.length > 1 ? ' +' + (act.length - 1) : '');
    }).catch(function () { $('a77Pill').dataset.level = 'unknown'; $('a77Txt').textContent = '7700 ?'; });
  }
  $('a77Pill').addEventListener('click', function () {
    var d = A77.d, lvl = $('a77Pill').dataset.level, act = d && (d.active || []).filter(function (a) { return A77.LEVEL[a.code]; });
    var txt = lvl === 'ok' ? 'Żaden samolot nad Polską nie nadaje kodu 7700, 7600 ani 7500' + (d && d.updatedAt ? ' (stan z ' + hm(d.updatedAt) + ').' : '.')
      : lvl === 'unknown' ? '7700.pl chwilowo nie ma danych ADS-B. Aktualny stan sprawdzisz na 7700.pl.'
        : 'Samolot nad Polską nadaje kod ' + act[0].code + ' (' + A77.NAME[act[0].code] + ')' + (act.length > 1 ? ' · razem ' + act.length + ' alarmy' : '') + '. Kod bywa nadany omyłkowo – szczegóły na 7700.pl.';
    openSheet('Alarm 7700 nad Polską', '<p>' + esc(txt) + '</p><div class="acts"><a class="btn" href="https://7700.pl/">Przejdź na 7700.pl</a></div><p class="note">Dane: 7700.pl (odświeżane co 15 s). Pokazujemy tylko kod alarmu – szczegóły lotu na 7700.pl.</p>');
  });

  // ===================== Transmisja na żywo (panel /live → Worker /studio/status) =====================
  var liveSt = { on: false, since: null, at: 0 };
  function checkLive(force) {
    if (!active() || (!force && Date.now() - liveSt.at < 55000)) return;
    liveSt.at = Date.now();
    getJson(W + '/studio/status').then(function (d) {
      liveSt.on = !!d.live; liveSt.since = d.since || null;
      $('livePill').hidden = !liveSt.on;
      var closed = false; try { closed = sessionStorage.getItem('app.liveClosed') === String(liveSt.since); } catch (e) { /* tryb prywatny */ }
      $('liveBanner').hidden = !liveSt.on || closed;
    }).catch(function () { $('livePill').hidden = true; $('liveBanner').hidden = true; });
  }
  function watchLive() { N.openExternal(CFG.youtube + '/live'); }
  $('livePill').addEventListener('click', watchLive);
  $('liveWatch').addEventListener('click', watchLive);
  $('liveClose').addEventListener('click', function () { try { sessionStorage.setItem('app.liveClosed', String(liveSt.since)); } catch (e) {} $('liveBanner').hidden = true; });

  // ===================== NASŁUCH ATC =====================
  var STREAMS = [
    { key: 'tower', name: 'EPWR Tower', sub: 'wieża – starty i lądowania · 120,255', url: 'https://airband.kosma.pl/epwr_twr', c: '#FBBF24' },
    { key: 'approach', name: 'Approach #2 (Poznań)', sub: 'zbliżanie · 128,925', url: 'https://airband.kosma.pl/epwr_app2', c: '#FDE047' },
    { key: 'delivery', name: 'EPWR Delivery', sub: 'zezwolenia przed startem · 121,805', url: 'https://airband.kosma.pl/epwr_del', c: '#CA8A04' },
    { key: 'app1', name: 'Approach #1 (Poznań)', sub: '123,040 · gra kanał „Wszystko oprócz ATIS”', url: 'https://airband.kosma.pl/epwr_all', c: '#C4B5FD' },
    { key: 'fisn', name: 'FIS północ (Poznań)', sub: '126,300 · gra kanał „Wszystko oprócz ATIS”', url: 'https://airband.kosma.pl/epwr_all', c: '#86EFAC' },
    { key: 'fiss', name: 'FIS południe (Poznań)', sub: 'informacja · 127,250', url: 'https://airband.kosma.pl/epwr_fis_s', c: '#6EE7B7' },
    { key: 'guard', name: 'Guard', sub: 'częstotliwość awaryjna · 121,500', url: 'https://airband.kosma.pl/epwr_guard', c: '#FB7185' },
    { key: 'atis', name: 'ATIS', sub: 'komunikat pogodowy · 124,330', url: 'https://airband.kosma.pl/epwr_atis', c: '#E2E8F0' },
    { key: 'all', name: 'Wszystko oprócz ATIS', sub: 'kilka kanałów naraz', url: 'https://airband.kosma.pl/epwr_all', c: '#F0ABFC' }
  ];
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>', STOP = '<svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z"/></svg>';
  function playerUi() {
    $('players').innerHTML = STREAMS.map(function (s) {
      return '<div class="pl" id="pl-' + s.key + '" style="--c:' + s.c + '"><button type="button" class="play" data-k="' + s.key + '" aria-label="Włącz ' + esc(s.name) + '">' + PLAY + '</button>' +
        '<div class="info"><b>' + esc(s.name) + '</b><span id="st-' + s.key + '">' + esc(s.sub) + '</span></div><span class="eq" aria-hidden="true"><i></i><i></i><i></i></span></div>';
    }).join('');
    STREAMS.forEach(function (s) {
      // Zwykły odtwarzacz, BEZ Web Audio: w WebView Androida AudioContext utworzony poza stuknięciem zostaje wstrzymany
      // i wycisza strumień (dlatego bez wskaźnika poziomu/waterfall).
      var el = new Audio(); el.preload = 'none';
      s.el = el; s.tries = 0; s.want = false;
      function st(t) { $('st-' + s.key).textContent = t; }
      function ui() {
        var on = !el.paused && s.want;
        $('pl-' + s.key).classList.toggle('on', on);
        var b = $('pl-' + s.key).querySelector('.play');
        b.innerHTML = s.want ? STOP : PLAY; b.setAttribute('aria-label', (s.want ? 'Zatrzymaj ' : 'Włącz ') + s.name);
        updateMini();
      }
      s.ui = ui;
      // Twarde zatrzymanie: pauza + usunięcie źródła + load() (przerywa też strumień, który dopiero się łączy)
      s.kill = function () { try { el.pause(); } catch (e) {} el.removeAttribute('src'); try { el.load(); } catch (e) {} };
      el.addEventListener('playing', function () { if (!s.want) { s.kill(); return; } s.tries = 0; if (!s.started) s.started = Date.now(); st('Na żywo'); ui(); });
      el.addEventListener('waiting', function () { st('Buforowanie…'); });
      el.addEventListener('pause', function () { if (!s.want) st(s.sub); ui(); });
      function retry(why) {
        if (!s.want) return;
        if (++s.tries > 4) { s.want = false; s.kill(); st('Strumień nasłuchu chwilowo niedostępny – spróbuj później'); ui(); return; }
        var d = Math.min(2000 * Math.pow(1.5, s.tries - 1), 15000);
        st(why + ' – ponawiam za ' + Math.round(d / 1000) + ' s…');
        setTimeout(function () { if (s.want) { s.reset(); el.src = W + '/audio?url=' + encodeURIComponent(s.url); el.play().catch(function () {}); } }, d);
      }
      el.addEventListener('error', function () { if (el.getAttribute('src')) retry('Przerwa w strumieniu'); });
      el.addEventListener('ended', function () { retry('Strumień się zakończył'); });
      var lastT = -1, lastCheck = 0;
      s.reset = function () { lastT = -1; lastCheck = Date.now(); };
      setInterval(function () {   // strażnik: brak połączenia (źródło nie odpowiada) albo strumień „zamarł” bez błędu
        if (!s.want) { if (!el.paused || el.getAttribute('src')) s.kill(); return; }   // wyłączony, a coś jeszcze gra → zatrzymaj
        var now = Date.now();
        if (el.currentTime > lastT + 0.05) { lastT = el.currentTime; lastCheck = now; }
        else if (lastCheck && now - lastCheck > 12000) { lastCheck = now; retry(el.currentTime > 0 ? 'Brak dźwięku' : 'Serwer nie odpowiada'); }
      }, 3000);
    });
  }
  function toggle(key) {
    var s = STREAMS.filter(function (x) { return x.key === key; })[0]; if (!s) return;
    if (s.want) {
      var mins = s.started ? Math.round((Date.now() - s.started) / MIN) : 0; s.started = 0;
      s.want = false; s.kill(); s.ui();
      if (mins >= 10) coffeeMoment('Słuchałeś ' + s.name.replace('EPWR ', '') + ' przez ' + mins + ' min 🎧');
      return;
    }
    s.want = true; s.tries = 0; s.reset(); $('st-' + s.key).textContent = 'Łączenie…';
    s.el.src = W + '/audio?url=' + encodeURIComponent(s.url);
    s.el.play().catch(function () { s.want = false; $('st-' + s.key).textContent = 'Nie udało się włączyć – spróbuj ponownie'; s.ui(); });
    s.ui(); mediaSession();
  }
  function playing() { return STREAMS.filter(function (s) { return s.want; }); }
  function updateMini() {
    var p = playing();
    $('mini').hidden = !p.length || current === 'nasluch';
    $('miniTxt').textContent = 'Nasłuch: ' + p.map(function (s) { return s.name.replace('EPWR ', ''); }).join(' + ');
  }
  function mediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({ title: 'Nasłuch ATC EPWR', artist: 'Radar EPWR', artwork: [{ src: '/app/ikona-512.png', sizes: '512x512', type: 'image/png' }] });
      navigator.mediaSession.setActionHandler('pause', function () { playing().forEach(function (s) { toggle(s.key); }); });
      navigator.mediaSession.setActionHandler('stop', function () { playing().forEach(function (s) { toggle(s.key); }); });
    } catch (e) { /* stary WebView */ }
  }
  $('players').addEventListener('click', function (e) { var b = e.target.closest('.play'); if (b) toggle(b.dataset.k); });
  $('miniStop').addEventListener('click', function () { playing().forEach(function (s) { toggle(s.key); }); });
  playerUi();

  // ===================== WIĘCEJ: powiadomienia, motyw, wsparcie =====================
  function topicRows(c, idp) {
    return N.push.topics.map(function (t) {
      return '<label class="topic"><div><b>' + esc(t.name) + '</b><small>' + esc(t.desc) + '</small></div>' +
        '<input type="checkbox" class="sw" data-topic="' + esc(t.id) + '" id="' + idp + t.id + '"' + (c[t.id] || t.required ? ' checked' : '') + (t.required ? ' disabled' : '') + '></label>';
    }).join('');
  }
  function renderTopics() {
    var c = N.push.choice();
    $('topicList').innerHTML = topicRows(c, 'tp-');
    if (!N.isApp) {
      $('notifHint').innerHTML = 'Powiadomienia push działają w aplikacji <b>Radar EPWR</b> na Androidzie. Alarmy znajdziesz też na kanale <a href="' + CFG.telegramAlerts + '">Telegram</a>.';
      $('topicList').querySelectorAll('input').forEach(function (i) { i.disabled = true; });
      return;
    }
    N.push.permission().then(function (p) {
      $('notifSystem').hidden = false;
      $('notifHint').textContent = p === 'granted' ? 'Wybierz, o czym mamy Cię powiadamiać. Dźwięk i „Nie przeszkadzać” ustawisz w Androidzie.'
        : p === 'denied' ? 'Powiadomienia są zablokowane w ustawieniach Androida. Włącz je tam, a potem wybierz tematy poniżej.'
          : 'Włącz przełącznik – zapytamy o zgodę na powiadomienia.';
    });
  }
  $('topicList').addEventListener('change', function (e) {
    var i = e.target; if (!i.dataset.topic) return;
    N.push.permission().then(function (p) {
      if (p === 'granted') return N.push.setTopic(i.dataset.topic, i.checked).then(function () { N.toast(i.checked ? 'Powiadomienia włączone' : 'Powiadomienia wyłączone'); });
      var c = N.push.choice(); c[i.dataset.topic] = i.checked;
      return N.push.enable(c).then(function (r) {
        if (r !== 'granted') { N.toast('Bez zgody Androida nie możemy wysyłać powiadomień.', 4000); }
        renderTopics();
      });
    });
  });
  $('notifSystem').addEventListener('click', function () { N.push.openSystemSettings(); });

  function applyTheme(t) {
    lsSet('app.theme', t);
    var eff = t === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
    document.documentElement.setAttribute('data-theme', eff);
    document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.themeSet === t ? 'true' : 'false'); });
  }
  document.querySelectorAll('[data-theme-set]').forEach(function (b) { b.addEventListener('click', function () { applyTheme(b.dataset.themeSet); }); });
  applyTheme(lsGet('app.theme') || 'dark');
  $('setProc').checked = lsGet('app.startProc') === '1';
  $('setProc').addEventListener('change', function (e) { lsSet('app.startProc', e.target.checked ? '1' : '0'); });

  $('tileBoard').addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); show('loty'); });

  // Polecanie aplikacji: systemowe menu udostępniania (WhatsApp, X, Messenger, SMS…). Link idzie w treści wiadomości,
  // bo część aplikacji pomija osobne pole URL. Dopóki nie ma aplikacji w Google Play, wskazujemy stronę pobierania.
  $('shareApp').addEventListener('click', function () {
    var link = CFG.playPublished ? CFG.playStore : CFG.site + '/pobierz/';
    N.share({ title: 'Radar EPWR', text: '✈️ Samoloty nad Wrocławiem na żywo, tablica lotów, nasłuch wieży i alarmy z lotniska – aplikacja Radar EPWR (bezpłatna): ' + link, dialog: 'Poleć aplikację' });
  });

  // Funkcje z planów (config.js → features): kafelki pojawiają się same po włączeniu
  (function () {
    var t = $('tiles'), F = CFG.features;
    if (F.gra.enabled) t.insertAdjacentHTML('beforeend', '<a class="tile" href="' + esc(F.gra.url) + '"><span aria-hidden="true">🎮</span><b>' + esc(F.gra.label) + '</b><small>' + esc(F.gra.desc) + '</small></a>');
    if (F.odbior.enabled) t.insertAdjacentHTML('beforeend', '<a class="tile" href="' + esc(F.odbior.url) + '"><span aria-hidden="true">🚗</span><b>Odbiór z lotniska</b><small>' + esc(F.odbior.desc) + '</small></a>');
  })();

  // Wersja + ukryty tryb testowy właściciela (7 stuknięć): zdarzenia testowe i temat push „test”
  $('ver').textContent = 'Wersja ekranów ' + CFG.version + (N.isApp ? ' · aplikacja Android' : ' · przeglądarka');
  if (N.isApp) N.appVersion().then(function (v) { if (v) $('ver').textContent = 'Aplikacja Android ' + v + ' · ekrany ' + CFG.version; });
  (function () {
    var n = 0, t = 0;
    $('ver').addEventListener('click', function () {
      if (Date.now() - t > 2000) n = 0;
      t = Date.now();
      if (++n < 7) return;
      n = 0;
      var on = lsGet('app.owner') !== '1';
      lsSet('app.owner', on ? '1' : '0'); SHOW_TEST = on;
      if (N.isApp) N.push.setTopic('test', on);
      N.toast(on ? 'Tryb testowy włączony (zdarzenia i powiadomienia testowe)' : 'Tryb testowy wyłączony');
      ev.sig = ''; loadEvents(true);
    });
  })();

  // ----- Wsparcie: delikatne przypomnienie (nie częściej niż co 30 dni, od 5. uruchomienia) -----
  var runs = +(lsGet('app.runs') || 0) + 1; lsSet('app.runs', String(runs));
  if (!lsGet('app.moreSeen')) $('moreBadge').hidden = false;
  document.addEventListener('app:view', function (e) { if (e.detail === 'wiecej') { lsSet('app.moreSeen', '1'); $('moreBadge').hidden = true; renderTopics(); } });
  // Prośba o wsparcie – nienachalnie: karta W TREŚCI ekranu (nigdy okno, nigdy na mapie), tylko po dobrym momencie
  // (długi nasłuch, otwarty alarm z powiadomienia, udostępnienie). Zasady: od 5. uruchomienia, najwyżej raz na 30 dni
  // (łącznie ze wszystkich miejsc), nie w trakcie alarmu; „Już wsparłem 💜” wycisza prośby na 7 dni.
  var COFFEE_EVERY = 30 * 24 * 60 * MIN, COFFEE_THANKS = 7 * 24 * 60 * MIN;
  var coffeePending = null;
  function coffeeAllowed() {
    if (runs < 5) return false;
    if (Date.now() - +(lsGet('app.coffeeAsk') || 0) < COFFEE_EVERY) return false;
    if (Date.now() - +(lsGet('app.coffeeThanks') || 0) < COFFEE_THANKS) return false;
    return $('abar').hidden;   // trwa alarm – nie prosimy
  }
  function coffeeMoment(lead) {
    if (!coffeeAllowed()) return;
    coffeePending = lead;
    if (current !== 'radar') coffeeShow();   // na Radarze czekamy, aż użytkownik przejdzie na inny ekran
  }
  function coffeeShow() {
    if (!coffeePending || current === 'radar' || !coffeeAllowed()) return;
    var lead = coffeePending; coffeePending = null;
    lsSet('app.coffeeAsk', String(Date.now()));
    var old = document.querySelector('.cask'); if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'cask'; el.setAttribute('role', 'note');
    el.innerHTML = '<button type="button" class="x" data-cask="close" aria-label="Zamknij">×</button>' +
      '<p><b>' + esc(lead) + '</b> Radar EPWR jest bezpłatny i bez banerów reklamowych (w oknie lotu są tylko oznaczone linki partnerskie) – jeśli Ci się przydaje, postaw kawę na utrzymanie serwera i nasłuchu.</p>' +
      '<div class="cask-a"><a class="btn sm coffee" href="' + esc(CFG.coffee) + '" data-coffee>☕ Postaw kawę</a>' +
      '<button type="button" class="btn sm ghost" data-cask="thanks">Już wsparłem 💜</button></div>';
    var view = $('v-' + current), head = view.querySelector('.vhead');
    if (head) head.after(el); else view.prepend(el);
    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cask], [data-coffee]'); if (!b) return;
      if (b.dataset.cask === 'thanks') { lsSet('app.coffeeThanks', String(Date.now())); N.toast('Dziękujemy! 💜 Przez tydzień nie będziemy prosić.', 3500); }
      el.remove();
    });
  }
  document.addEventListener('app:view', function (e) { if (e.detail !== 'radar') coffeeShow(); });
  function coffeeAfterShare() { coffeeMoment('Dzięki za udostępnienie! 💜'); }
  // Otwarty alarm z powiadomienia → prośba przy następnym wejściu na inny ekran niż mapa
  document.addEventListener('app:pushopen', function (e) { if (/hex=/.test(String(e.detail || ''))) coffeeMoment('Dzięki, że śledzisz alarmy z EPWR 🚨'); });
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('[data-coffee]')) lsSet('app.coffeeAsk', String(Date.now())); });

  // ===================== Aktualizacja aplikacji (APK z GitHub Releases) =====================
  // Worker /appver podaje najnowszą wydaną wersję (sprawdza GitHub co 2 h i wtedy wysyła push „aktualizacje”).
  // Porównujemy z versionName zainstalowanego APK. Pasek pokazujemy też osobom bez zgody na powiadomienia.
  // Ekrany (ten plik) aktualizują się same z radar-epwr.pl – nowe APK potrzebne tylko przy zmianach natywnych.
  var upd = { latest: null, mine: null, at: 0 };
  function verNum(v) { var m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2], +m[3]] : null; }
  function newer(a, b) { var x = verNum(a), y = verNum(b); if (!x || !y) return false; for (var i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] > y[i]; } return false; }
  function updateSheet() {
    var apk = upd.latest && upd.latest.apk || CFG.apkLatest;
    var has = upd.latest && newer(upd.latest.version, upd.mine);
    openSheet(has ? 'Nowa wersja ' + upd.latest.version : 'Masz aktualną wersję',
      (has ? '<p>Dostępna jest nowa wersja aplikacji Radar EPWR (masz ' + esc(upd.mine) + ').</p>' +
        '<ol class="steps"><li>Stuknij <b>Pobierz aktualizację</b> – pobierze się plik <b>radar-epwr.apk</b>.</li><li>Otwórz pobrany plik i stuknij <b>Aktualizuj</b>.</li><li>Ustawienia i powiadomienia zostają bez zmian.</li></ol>' +
        '<div class="acts"><a class="btn" href="' + esc(apk) + '" id="upGet">Pobierz aktualizację</a><button type="button" class="btn ghost" id="upLater">Później</button></div>'
        : '<p>Masz najnowszą wersję aplikacji' + (upd.mine ? ' (' + esc(upd.mine) + ')' : '') + '. O kolejnej damy znać powiadomieniem.</p><div class="acts"><button type="button" class="btn ghost" id="upLater">OK</button></div>'),
      function (b) {
        b.querySelector('#upLater').addEventListener('click', function () { if (has) lsSet('app.updLater', upd.latest.version + '|' + Date.now()); $('upBar').hidden = true; closeSheet(); });
      });
  }
  function checkUpdate(open) {
    if (!N.isApp) return;
    var fresh = Date.now() - upd.at < 30 * MIN;
    (fresh ? Promise.resolve() : Promise.all([N.appVersion(), getJson(W + '/appver', {})]).then(function (r) { upd.mine = r[0]; upd.latest = r[1]; upd.at = Date.now(); }))
      .then(function () {
        var has = upd.latest && upd.latest.version && newer(upd.latest.version, upd.mine);
        $('upCheck').hidden = false;
        if (has) {
          var later = String(lsGet('app.updLater') || '').split('|');
          $('upTxt').textContent = 'Dostępna nowa wersja ' + upd.latest.version + ' – stuknij, aby pobrać';
          $('upBar').hidden = later[0] === upd.latest.version && Date.now() - +later[1] < 3 * 24 * 60 * MIN;
        } else $('upBar').hidden = true;
        if (open) {
          if (!upd.latest || !upd.latest.version || !upd.mine) { upd.at = 0; N.toast('Nie udało się sprawdzić aktualizacji. Spróbuj później.', 4000); return; }
          updateSheet();
        }
      })
      .catch(function () { if (open) N.toast('Nie udało się sprawdzić aktualizacji. Spróbuj później.'); });
  }
  $('upBar').addEventListener('click', updateSheet);
  $('upCheck').addEventListener('click', function () { upd.at = 0; checkUpdate(true); });
  document.addEventListener('app:resume', function () { checkUpdate(false); });

  // ===================== Pierwsze uruchomienie (tylko w aplikacji) =====================
  function onboarding() {
    if (!N.isApp || N.push.hasChoice()) return;
    $('onbTopics').innerHTML = topicRows(N.push.choice(), 'ob-');
    $('onb').hidden = false;
    function pick() { var c = {}; $('onbTopics').querySelectorAll('input').forEach(function (i) { c[i.dataset.topic] = i.checked; }); return c; }
    $('onbGo').addEventListener('click', function () {
      $('onbGo').disabled = true;
      N.push.enable(pick()).then(function (r) {
        $('onb').hidden = true;
        N.toast(r === 'granted' ? 'Gotowe! Powiadomienia włączone.' : 'Powiadomienia wyłączone – włączysz je w zakładce Więcej.', 4000);
      });
    });
    $('onbSkip').addEventListener('click', function () {
      var c = pick(); Object.keys(c).forEach(function (k) { c[k] = false; });   // „aktualizacje” i tak wraca (required) – bez zgody Androida działa tylko pasek w aplikacji
      N.push.saveChoice(c); $('onb').hidden = true;
    });
  }

  // ===================== Start i odświeżanie =====================
  function refreshAll(force) {
    loadEvents(force); load7700(); checkLive(force);
    if (current === 'loty') loadFlights(force);
  }
  setInterval(function () { refreshAll(false); }, 15000);
  setInterval(loadWx, 10 * MIN);
  document.addEventListener('visibilitychange', function () { if (active()) { refreshAll(false); if (radar.map && current === 'radar') radar.map.refresh(); } });
  document.addEventListener('app:resume', function () { refreshAll(true); });

  if (lsGet('app.startProc') === '1') radar.mode = 'proc';
  setMode(radar.mode);
  if (!location.hash) history.replaceState(null, '', '#radar');
  route();
  loadWx(); refreshAll(true); loadFlights(true);
  onboarding();
  setTimeout(function () { if (!/update=/.test(location.hash)) checkUpdate(false); }, 3000);
})();
