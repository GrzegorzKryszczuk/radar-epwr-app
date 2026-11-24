/* Strona udostępnionego lotu: radar-epwr.pl/lot/?hex=<adres ICAO>&cs=<znak>  albo  ?nr=<numer rejsu>&k=dep|arr&s=<planowo>
 * Pokazuje samolot na radarze (ten sam moduł co strona główna) i podstawowe dane. Treści tylko przez textContent.
 */
(function () {
  'use strict';
  var CFG = window.RADAR_APP_CONFIG, W = CFG.worker;
  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var hex = String(q.get('hex') || '').toLowerCase(); if (!/^[0-9a-f]{6}$/.test(hex)) hex = '';
  var cs = String(q.get('cs') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10);
  var nr = String(q.get('nr') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  var kind = q.get('k') === 'dep' ? 'dep' : 'arr';
  var sched = String(q.get('s') || '').replace(/[^0-9T:-]/g, '').slice(0, 16);
  var map = null, found = false, flight = null, tries = 0, timer = null;

  function toast(t) { var e = $('toast'); e.textContent = t; e.hidden = false; setTimeout(function () { e.hidden = true; }, 3000); }
  function fhm(iso) { var m = /T(\d{2}:\d{2})/.exec(iso || ''); return m ? m[1] : ''; }
  function city(s) { return String(s || '').replace(/\s*\([A-Z]{3,4}\)\s*$/, ''); }
  function alt(a) {
    if (a.alt_baro === 'ground') return 'na ziemi';
    var v = a.alt_baro; if (typeof v !== 'number') return '–';
    return v >= 6500 ? 'FL' + String(Math.round(v / 100)).padStart(3, '0') : Math.round(v / 50) * 50 + ' ft';
  }
  function kv(rows) {
    var dl = $('lKv'); dl.innerHTML = ''; dl.hidden = !rows.length;
    rows.forEach(function (r) {
      var d = document.createElement('div'), t = document.createElement('dt'), v = document.createElement('dd');
      t.textContent = r[0]; v.textContent = r[1]; d.appendChild(t); d.appendChild(v); dl.appendChild(d);
    });
  }
  function title(t, sub) { $('lTitle').textContent = t; $('lSub').textContent = sub || ''; document.title = t + ' – Radar EPWR'; }

  if (CFG.playPublished) { $('getApp').href = CFG.playStore; $('getApp').textContent = 'Pobierz aplikację'; }
  $('lShare').addEventListener('click', function () {
    var t = $('lTitle').textContent;
    if (navigator.share) navigator.share({ title: t, text: '✈️ ' + t + ' – na żywo w Radar EPWR', url: location.href }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(function () { toast('Link skopiowany'); });
  });

  function onSelect(a) {
    if (!a) return;
    found = true;
    var c = String(a.flight || '').trim() || cs || a.hex.toUpperCase();
    var vr = a.baro_rate || a.geom_rate || 0;
    title('✈️ ' + c, flight ? routeTxt() : 'Samolot nad Wrocławiem – pozycja na żywo, ślad w kolorze wysokości.');
    kv([['Wysokość', alt(a)], ['Pionowo', Math.abs(vr) >= 300 ? (vr > 0 ? '↑ ' : '↓ ') + Math.abs(Math.round(vr / 50) * 50) + ' ft/min' : 'poziomo'],
      ['Prędkość', typeof a.gs === 'number' ? Math.round(a.gs) + ' kt (' + Math.round(a.gs * 1.852) + ' km/h)' : '–'],
      ['Typ', a.t || '–'], ['Rejestracja', a.r || '–'], ['Squawk', a.squawk || '–']]);
  }
  function routeTxt() {
    var f = flight, other = (kind === 'dep' ? f.arrival : f.departure) || {}, leg = (kind === 'dep' ? f.departure : f.arrival) || {};
    var place = city(other.airport) || other.iata || '?';
    return (kind === 'dep' ? 'Wrocław → ' + place : place + ' → Wrocław') + ' · planowo ' + (fhm(leg.scheduled) || '–') + ((leg.actual || leg.estimated) ? ' · ' + (leg.actual ? 'rzeczywiście ' : 'szacowany ') + fhm(leg.actual || leg.estimated) : '');
  }

  // Lot z tablicy: dane z rozkładu, potem szukamy samolotu w /live po znaku ATC, numerze ICAO lub rejestracji
  function findByFlight() {
    if (!flight || found || !map || document.hidden) return;
    if (++tries > 40) { clearInterval(timer); return; }   // ok. 10 min – potem samolot raczej poza zasięgiem
    var keys = [flight.flight && flight.flight.atc, flight.flight && flight.flight.icao].filter(Boolean).map(function (x) { return String(x).replace(/\s/g, '').toUpperCase(); });
    var reg = String((flight.aircraft && flight.aircraft.registration) || '').replace(/-/g, '').toUpperCase();
    fetch(W + '/live', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      var hit = (d.ac || []).filter(function (a) {
        var c = String(a.flight || '').trim().toUpperCase(), r = String(a.r || '').replace(/-/g, '').toUpperCase();
        return (c && keys.indexOf(c) >= 0) || (reg && r === reg);
      })[0];
      if (hit) map.select(hit.hex);
    }).catch(function () {});
  }
  // Baner partnerski (Travelpayouts, sub ID „app”): Compensair przy odwołaniu lub opóźnieniu >= 45 min, Kiwitaxi przy przylocie.
  // Zwykły link otwierany w przeglądarce (śledzenie partnera działa tylko w przeglądarce), bez skryptów.
  var COMPENSAIR = 'https://compensair.tpk.lv/8on4alU5', KIWITAXI = 'https://kiwitaxi.tpk.lv/WQGwGVIb?u=https%3A%2F%2Fkiwitaxi.com%2Fpl';
  function partner(f) {
    var box = $('lPartner'); if (!box || !f) return;
    var leg = (kind === 'dep' ? f.departure : f.arrival) || {};
    var sch = Date.parse(leg.scheduled), est = Date.parse(leg.actual || leg.estimated);
    var late = sch && est ? (est - sch) / 60000 : 0;
    var p = null;
    if (f.flight_status === 'cancelled' || late >= 45) {
      p = { cls: 'compensair', href: COMPENSAIR, logo: '/partnerzy/compensair-logo.svg', alt: 'Compensair', w: 115, h: 26,
        t: f.flight_status === 'cancelled' ? 'Lot odwołany?' : 'Lot opóźniony?',
        s: 'Sprawdź, czy należy Ci się odszkodowanie do 600 € za lot w UE. Kilka minut i bez ryzyka.', c: 'Sprawdź lot za darmo' };
    } else if (kind === 'arr' && f.flight_status !== 'landed') {
      p = { cls: 'kiwitaxi', href: KIWITAXI, logo: '/partnerzy/kiwitaxi-logo.svg', alt: 'Kiwitaxi', w: 30, h: 26,
        t: 'Odbierasz kogoś z lotniska?', s: 'Zamów transfer z góry po stałej cenie. Kierowca czeka po przylocie.', c: 'Zamów transfer' };
    }
    if (!p) { box.hidden = true; return; }
    var a = document.createElement('a');
    a.className = 'pb pb-' + p.cls; a.href = p.href; a.target = '_blank'; a.rel = 'sponsored noopener';
    a.setAttribute('aria-label', p.t + ' ' + p.s + ' (reklama, otwiera się w przeglądarce)');
    var lab = document.createElement('span'); lab.className = 'pb-label'; lab.textContent = 'Reklama · partner';
    var img = document.createElement('img'); img.className = 'pb-logo'; img.src = p.logo; img.alt = p.alt; img.width = p.w; img.height = p.h;
    var t = document.createElement('strong'); t.className = 'pb-title'; t.textContent = p.t;
    var s = document.createElement('span'); s.className = 'pb-sub'; s.textContent = p.s;
    var c = document.createElement('span'); c.className = 'pb-cta'; c.textContent = p.c + ' →';
    [lab, img, t, s, c].forEach(function (e) { a.appendChild(e); });
    box.textContent = ''; box.appendChild(a); box.hidden = false;
  }
  function loadFlight() {
    fetch(W + '/flights').then(function (r) { return r.json(); }).then(function (d) {
      window.radarEpwrFids = { departures: d.departures || [], arrivals: d.arrivals || [] };
      var list = (kind === 'dep' ? d.departures : d.arrivals) || [];
      var cand = list.filter(function (f) {
        var n = [f.flight && f.flight.iata, f.flight && f.flight.icao].concat((f.flight && f.flight.codeshares) || []).map(function (x) { return String(x || '').toUpperCase(); });
        return n.indexOf(nr) >= 0;
      });
      flight = cand.filter(function (f) { var leg = (kind === 'dep' ? f.departure : f.arrival) || {}; return sched && String(leg.scheduled || '').slice(0, 16) === sched; })[0] || cand[0] || null;
      if (!flight) { title('Lot ' + nr, 'Nie ma go już w rozkładzie lotniska Wrocław (pokazujemy loty z ostatnich godzin i najbliższej doby).'); return; }
      var st = { scheduled: kind === 'dep' ? 'Planowy' : 'Oczekiwany', active: kind === 'dep' ? 'Odleciał' : 'W powietrzu', landed: kind === 'dep' ? 'Odleciał' : 'Wylądował', cancelled: 'Odwołany', diverted: 'Przekierowany' }[flight.flight_status] || '–';
      title((kind === 'dep' ? '🛫 ' : '🛬 ') + nr, routeTxt());
      kv([['Status', st], ['Linia', (flight.airline && flight.airline.name) || '–'], [kind === 'dep' ? 'Bramka' : 'Taśma', ((kind === 'dep' ? flight.departure : flight.arrival) || {})[kind === 'dep' ? 'gate' : 'baggage'] || '–']]);
      partner(flight);
      findByFlight();
    }).catch(function () { title('Lot ' + nr, 'Rozkład chwilowo niedostępny.'); });
  }

  function load(src, css) {
    return new Promise(function (ok, fail) {
      var el = document.createElement(css ? 'link' : 'script');
      if (css) { el.rel = 'stylesheet'; el.href = src; } else { el.src = src; }
      el.onload = ok; el.onerror = fail; document.head.appendChild(el);
    });
  }
  Promise.all([load('/vendor/leaflet/leaflet.css', true), load('/vendor/leaflet/leaflet.js')])
    .then(function () { return load('/procedury/epwr-procedury.js?v=15'); })
    .then(function () {
      $('map').textContent = '';
      map = window.radarEpwrProcedury($('map'), { mode: 'radar', onSelect: onSelect, focusHex: hex });
      if (nr) { loadFlight(); timer = setInterval(findByFlight, 15000); }
    })
    .catch(function () { $('map').textContent = 'Nie udało się wczytać radaru.'; });

  if (hex) title('✈️ ' + (cs || hex.toUpperCase()), 'Szukam samolotu na radarze…');
  else if (!nr) title('Radar EPWR', 'Samoloty nad Wrocławiem na żywo. Stuknij samolot, żeby zobaczyć szczegóły.');
  setTimeout(function () {
    if (!found && hex) title('✈️ ' + (cs || hex.toUpperCase()), 'Samolotu nie ma teraz w zasięgu radaru – wylądował, odleciał dalej albo chwilowo nie nadaje. Na mapie widać pozostały ruch nad Wrocławiem.');
  }, 25000);
})();
