# Changelog

## 2026-11-22
- 1.1.2: „Postaw kawę” i „Poleć aplikację” nie reagowały w aplikacji (wtyczki Browser/Share w WebView). buycoffee.to, wa.me i X otwierane przez system (jak Telegram/YouTube); „Poleć aplikację” pokazuje własne menu: WhatsApp, X, Telegram, Facebook, Inne aplikacje…, Kopiuj link.
- „Więcej” (ekrany 1.1.1): usunięty kafel „Wieża EPWR – gra” (`features.gra.enabled=false`); „Postaw kawę Radarowi” → „Postaw kawę Twórcy” (buycoffee.to); kafel „Pełna tablica” otwiera ekran Loty w aplikacji; Społeczność: tylko YouTube, Telegram – alerty, Facebook (w tej kolejności).
- „Poleć aplikację znajomym”: link w treści wiadomości (nie tylko w polu URL), do czasu publikacji w Google Play prowadzi na `radar-epwr.pl/pobierz/`; `native.js share()` ma zapasowy tor (Web Share → schowek), gdy wtyczka Share zawiedzie. Nowy APK niepotrzebny.

## 2026-11-21
- Licznik pobrań przeniesiony z GitHub Actions do n8n: usunięto `.github/workflows/pobrania.yml`; codzienny mail o 22:00 wysyła workflow n8n (szczegóły w `KONTEKST.md`). Powód: mail ma iść na wskazany adres przez SMTP, a nie przez powiadomienia GitHuba.
- `.github/workflows/pobrania.yml`: podsumowanie pobrań APK zmienione z cotygodniowego (pon. 6:00 UTC) na codzienne o 22:00 czasu polskiego (crony 20:00 i 21:00 UTC + sprawdzenie godziny `Europe/Warsaw`, żeby działało latem i zimą); przyrost liczony od poprzedniego podsumowania.
- Linki Kiwitaxi (`web/app/app.js`, `web/lot/lot.js`) prowadzą na polską wersję strony: do `kiwitaxi.tpk.lv/...` dodano `?u=https%3A%2F%2Fkiwitaxi.com%2Fpl`. AirHelp bez zmian: link `airhelp.tpk.lv` ignoruje parametr `u` i zawsze otwiera angielską stronę (`en-int`, produkt AirHelp Plus); program AirHelp nie ma w Travelpayouts opcji własnego adresu docelowego.
- POPRAWKA TEKSTÓW: usunięto nieprawdziwe „bez reklam” – teksty mówią teraz „bez banerów reklamowych” + informacja o oznaczonych linkach partnerskich (AirHelp, Kiwitaxi, „Reklama · partner”, możliwa prowizja): `web/pobierz/index.html`, `web/app/index.html`, `web/app/app.js` (okno „Postaw kawę”), `web/app/prywatnosc.html`, `README.md`, `docs/SKLEP-GOOGLE-PLAY.md` (opis sklepu + „Zawiera reklamy”).
- POPRAWKA: banery partnerskie były tylko na stronie udostępnionego lotu `/lot/`, a w aplikacji lot otwiera się w oknie `flightSheet` (`web/app/app.js`). Dodane tam: `partnerHtml()` (AirHelp przy odwołaniu lub opóźnieniu ≥ 45 min wg `leg.delay`, Kiwitaxi przy przylocie niewylądowanym), style `.pb*` w `app.css`; link otwiera się w karcie przeglądarki przez `native.js`. app.css?v=7, app.js?v=8.
- Ekran lotu (`web/lot`): warunkowy baner partnerski Travelpayouts (sub ID „app”) pod kartą lotu – AirHelp przy odwołaniu lub opóźnieniu ≥ 45 min, Kiwitaxi przy przylocie (poza wylądowanymi). Zwykły link `target=_blank` (śledzenie partnera tylko w przeglądarce), bez skryptów; logo z `https://radar-epwr.pl/partnerzy/`. Oznaczenie „Reklama · partner”. Nowy APK niepotrzebny.

## 2026-11-18
- Nasłuch: dziewięć wpisów kanałów (Tower 120,255, Delivery 121,805, Approach #1 123,040, Approach #2 128,925, FIS północ 126,300, FIS południe 127,250, Guard 121,500, ATIS 124,330, „Wszystko oprócz ATIS”); Approach #1 i FIS północ grają kanał zbiorczy (osobnych strumieni brak).
- Nasłuch: strumienie z airband.kosma.pl (OPOS) zamiast LiveATC – Tower `epwr_twr`, Approach `epwr_app2`, Delivery `epwr_del` (przez Workera `/audio`); podpis źródła i komunikat błędu bez nazwy LiveATC. Aplikacja ładuje /app/ ze strony, więc bez nowego APK.

## 2026-11-16
- Poprawka: w Pogodzie przewijane tabele wychodziły nad dolne menu (z-index kart w układzie flex) – dok izolowany, `z-index:auto`.
- Wsparcie buycoffee.to – nienachalnie: stała linijka „☕ … dzięki wspierającym · Postaw kawę” pod Nasłuchem i Lotami; karta w treści ekranu (nie okno, nigdy na mapie) po dobrym momencie: nasłuch ≥ 10 min, otwarty alarm z powiadomienia, udostępnienie. Od 5. uruchomienia, raz na 30 dni, nie w trakcie alarmu; „Już wsparłem 💜” wycisza prośby na 7 dni. Usunięty arkusz wyskakujący po 45 s.
- Powiadomienia: wybór tematów zapisywany podwójnie (localStorage + techniczne ciasteczko `radar_topics`, rok, ścieżka `/app/`) i odtwarzany z dowolnej kopii – WebView gubił wybór przy szybkim zamknięciu aplikacji. Wpis w polityce prywatności aplikacji.
- Nasłuch w aplikacji: bez Web Audio i wskaźnika poziomu (w WebView Androida wstrzymany AudioContext wyciszał dźwięk) – zwykły odtwarzacz, animowany znacznik „gra”. Limit 12 s na połączenie/ciszę, 4 próby, potem komunikat „Strumień LiveATC chwilowo niedostępny” (wcześniej Approach/Delivery wisiały na „Buforowanie…”).
- Powiadomienie o nowej wersji: temat push `aktualizacje` (zawsze włączony, bez przełącznika). Worker strony co 2 h (4–20 UTC) sprawdza najnowsze wydanie na GitHubie i raz wysyła push; w aplikacji pasek „Dostępna nowa wersja” + arkusz z pobraniem APK (także dla osób bez zgody na powiadomienia), „Więcej → Sprawdź aktualizację”, w „O aplikacji” wersja APK.
- Poprawka: mapa (warstwy Leaflet) zasłaniała ekran powitalny z wyborem powiadomień – `.mapwrap` izoluje warstwy.
- Zakładka Radar → Pogoda: tabele METAR, Opady i SIGMET pod mapą zamiast na niej (moduł pogody `opts.dock`, `pogoda.js?v=5`).
- Cotygodniowe podsumowanie pobrań APK (`.github/workflows/pobrania.yml`, poniedziałek 8:00) jako komentarz w zgłoszeniu „Statystyki pobrań aplikacji” → e-mail z GitHuba.
- Testy push: 19 (wydania, `/appver`, ponowienie nieudanej wysyłki).

## 2026-11-14
- Utworzenie repozytorium: powłoka Android, ekrany `web/app` i `web/lot`, dokumentacja, testy push.
- Podpisany APK/AAB budowany w GitHub Actions, wydania w Releases pod stałymi nazwami (`radar-epwr.apk`).
- Licencja, README, skrypt synchronizacji ekranów ze stroną.
