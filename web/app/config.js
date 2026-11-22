/* Radar EPWR – aplikacja (radar-epwr.pl/app/): konfiguracja i rejestr funkcji.
 *
 * To jedyne miejsce, w którym włącza się i wyłącza funkcje aplikacji. Zmiana tutaj + wdrożenie strony (git push → Vercel)
 * działa od razu u wszystkich użytkowników aplikacji – BEZ wydawania nowej wersji w Google Play.
 * Nowa wersja w Play jest potrzebna tylko przy zmianach natywnych (wtyczki, ikony, uprawnienia) – patrz Aplikacja/README.md.
 *
 * Jak włączyć funkcję z planów: ustaw `enabled: true` (i ewentualnie `url`), wdroż stronę. Ekran sam pokaże przycisk/kafelek.
 */
(function () {
  'use strict';
  window.RADAR_APP_CONFIG = {
    version: '1.1.2',                      // wersja ekranów aplikacji (widać ją w „Więcej → O aplikacji”)
    worker: 'https://radar-epwr.festusus.workers.dev',
    site: 'https://radar-epwr.pl',
    coffee: 'https://buycoffee.to/radar-epwr',
    youtube: 'https://www.youtube.com/@radar-epwr-pl',
    telegram: 'https://t.me/RadarEpwr',
    telegramAlerts: 'https://t.me/alertlotniskowroclaw',
    facebook: 'https://www.facebook.com/radarepwrpl',
    alarm7700: 'https://7700.pl/api/alarm',
    playStore: 'https://play.google.com/store/apps/details?id=pl.radarepwr.app',
    playPublished: false,                  // true po publikacji w Google Play – strona /lot/ pokaże przycisk „Pobierz aplikację”
    apkLatest: 'https://github.com/GrzegorzKryszczuk/radar-epwr-app/releases/latest/download/radar-epwr.apk',   // aktualizacje poza Google Play

    // Tematy powiadomień push (FCM). Nazwy tematów MUSZĄ zgadzać się z Workerem (FCM_TOPICS w cloudflare-worker-adsb.js).
    // channel = kanał powiadomień Androida (dźwięk/ważność ustawia użytkownik w ustawieniach systemu).
    // def = stan domyślny przy pierwszym uruchomieniu. required = zawsze włączony (bez przełącznika). planned = temat przygotowany, ale serwer jeszcze go nie wysyła (ukryty).
    topics: [
      { id: 'alarmy', channel: 'alarmy', name: 'Alarmy lotniskowe', desc: 'Kod czerwony i żółty – to samo, co trafia na kanał Telegram: squawk 7700/7600/7500, przekierowania, odejścia na drugi krąg, holding.', def: true, importance: 5 },
      { id: 'zdarzenia', channel: 'zdarzenia', name: 'Co się dzieje nad lotniskiem', desc: 'Pozostałe zdarzenia z radaru: rzadcy goście, wojsko, śmigłowce, kalibracja, zmiana pasa, pogoda, podsumowanie dnia.', def: false, importance: 3 },
      { id: 'transmisja', channel: 'transmisja', name: 'Transmisja na żywo', desc: 'Gdy zaczyna się transmisja Radar EPWR na YouTube.', def: true, importance: 4 },
      { id: 'aktualizacje', channel: 'aktualizacje', name: 'Nowa wersja aplikacji', desc: 'Gdy pojawi się aktualizacja do pobrania. Zawsze włączone – bez tego aplikacja się nie zaktualizuje.', def: true, required: true, importance: 3 },
      { id: 'odbior', channel: 'odbior', name: 'Odbiór z lotniska', desc: 'Twoje śledzone przyloty: wyjedź teraz, wylądował.', def: true, importance: 4, planned: true },
      { id: 'alarm7700', channel: 'alarmy', name: 'Alarmy squawk nad Polską', desc: 'Kody 7700/7600/7500 w całej Polsce (dane 7700.pl).', def: false, importance: 5, planned: true }
    ],

    // Funkcje z planów (pomysly.md, Aplikacja/KONCEPCJA.md). enabled:false = ukryte.
    features: {
      odbior: { enabled: false, url: 'https://radar-epwr.pl/panel/', label: 'Odbieram ten lot', desc: 'Powiadomimy Cię, kiedy wyjechać po pasażera.' },
      gra: { enabled: false, url: 'https://gra.radar-epwr.pl', label: 'Wieża EPWR – gra', desc: 'Zostań kontrolerem ruchu na wrocławskim lotnisku.' },
      historia: { enabled: false, label: 'Historia lotów', desc: 'Ostatnio oglądane samoloty na urządzeniu.' },
      lotniska: { enabled: false, list: ['EPWR'], desc: 'Kolejne lotniska (skanerlotniczy.pl).' },
      widget: { enabled: false, desc: 'Widżet na ekran główny: najbliższy przylot / alarm (wymaga nowej wersji natywnej).' }
    }
  };
})();
