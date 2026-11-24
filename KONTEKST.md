# KONTEKST – radar-epwr-app (aplikacja Android Radar EPWR)
Aktualizacja: 2026-11-16

## Co to jest
- Publiczne repo https://github.com/GrzegorzKryszczuk/radar-epwr-app: powłoka Capacitor `pl.radarepwr.app` + ekrany `web/app`, `web/lot`. Od teraz to TU robię commit/push/deploy wszystkiego o aplikacji (stała zgoda właściciela).
- Strona/Worker/n8n: osobne repo prywatne `radar-epwr` (folder „RADAR EPWR”); ekrany tam serwuje Vercel z `app/` i `lot/`.

## Mapa
- `android-app/` – Capacitor (www/, android/); `web/app`, `web/lot`, `web/pobierz` (strona instalacji APK) – ekrany (źródło prawdy); `docs/` – instrukcje; `testy/worker-push.test.js`; `scripts/sync-do-strony.sh` – kopiuje web/ → repo strony i pushuje (deploy ekranów).
- `.github/workflows/android.yml` – podpisany APK+AAB; tag `vX.Y.Z` → Release (`radar-epwr.apk`, `.sha256`, `.aab`). Link stały: `.../releases/latest/download/radar-epwr.apk`.

## Wydanie / wdrożenie
- Zmiana ekranów: edytuj `web/`, commit+push tu, potem `scripts/sync-do-strony.sh`.
- Nowa wersja APK: podbij tag (`git tag v1.0.X && git push --tags`); versionCode = nr uruchomienia Actions.
- Sekrety Actions (ustawione): RADAR_KEYSTORE_B64, RADAR_KEYSTORE_PASSWORD, RADAR_KEY_ALIAS, RADAR_KEY_PASSWORD, GOOGLE_SERVICES_JSON_B64.
- Klucz podpisu (PKCS12) + hasło: `~/Desktop/Kodowanie/klucze-podpisu/` (poza gitem; właściciel ma zrobić kopię). Utrata = brak aktualizacji.

## Aktualizacje i statystyki (2026-11-16)
- Nowe APK = tag `vX.Y.Z` → Release. Worker (repo strony, cron co 2 h 4–20 UTC) wykrywa nowy tag przez HEAD `releases/latest/download/radar-epwr.apk`, zapisuje w KV `app:release` i wysyła RAZ push na temat `aktualizacje` (wymagany w `config.js`). `GET /appver` → pasek aktualizacji w aplikacji (porównanie z versionName z `App.getInfo()`).
- Wersja tagu MUSI być wyższa od poprzedniej (semver), inaczej brak push. Zmiany samych ekranów (`web/`) nie wymagają APK.
- Licznik pobrań APK: workflow n8n „Radar EPWR - licznik pobrań aplikacji (22:00)” (konrad284, id `mz4b9Oh0jzuDL39V`): codziennie o 22:00 (strefa Europe/Warsaw) pobiera GitHub Releases, sumuje `download_count` pliku `radar-epwr.apk`, liczy przyrost (staticData workflow) i wysyła mail przez credential „SMTP account 2” na adres właściciela. Workflow GitHub Actions `pobrania.yml` usunięty 2026-11-21. Zmiana adresu/godziny: edycja w n8n.

- Nasłuch w aplikacji: zwykły <audio> BEZ Web Audio/crossOrigin (AudioContext poza gestem wyciszał dźwięk w WebView); Worker przepuszcza po Referer. Od 18.11 źródłem strumieni jest airband.kosma.pl (OPOS; epwr_twr/app2/del) zamiast LiveATC (od 16.11 nie odpowiadał przez nasz Worker); powłoka Capacitor ładuje https://radar-epwr.pl/app/, więc nowy APK nie jest potrzebny.
- Wybór tematów push: localStorage `app.topics` + ciasteczko `radar_topics` (native.js loadChoice/saveChoice).

## Reklamy partnerskie (2026-11-21)
- `web/app/app.js` `partnerHtml()` (okno lotu w aplikacji) i `web/lot/lot.js` `partner()` (udostępniony lot): Compensair (odwołany/opóźniony ≥45 min) lub Kiwitaxi (przylot) pod kartą lotu; linki tpk.lv z sub ID „app”. Nie dawać na radar/nasłuch ani jako okna pełnoekranowe (zasady Play). Aplikacji jeszcze nie ma w Google Play – przy publikacji w opisie sklepu MUSI być zapis o linkach partnerskich/reklamach (treść w pamięci asystenta: „Aplikacja zawiera linki partnerskie (Compensair, Kiwitaxi)… oznaczone «Reklama · partner»”) i zaznaczyć „zawiera reklamy”.

## Pułapki
- `google-services.json` NIE w repo (publiczne) – tylko sekret.
- Nie dodawać obcych skryptów na `/app/` (most natywny, CSP).
- Konto Google Play + test 12×14 dni: kroki właściciela w `docs/INSTRUKCJA-WLASCICIELA.md`.
