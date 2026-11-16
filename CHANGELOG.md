# Changelog

## 2026-11-16
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
