# KONTEKST – radar-epwr-app (aplikacja Android Radar EPWR)
Aktualizacja: 2026-11-14

## Co to jest
- Publiczne repo https://github.com/GrzegorzKryszczuk/radar-epwr-app: powłoka Capacitor `pl.radarepwr.app` + ekrany `web/app`, `web/lot`. Od teraz to TU robię commit/push/deploy wszystkiego o aplikacji (stała zgoda właściciela).
- Strona/Worker/n8n: osobne repo prywatne `radar-epwr` (folder „RADAR EPWR”); ekrany tam serwuje Vercel z `app/` i `lot/`.

## Mapa
- `android-app/` – Capacitor (www/, android/); `web/app`, `web/lot` – ekrany (źródło prawdy); `docs/` – instrukcje; `testy/worker-push.test.js`; `scripts/sync-do-strony.sh` – kopiuje web/ → repo strony i pushuje (deploy ekranów).
- `.github/workflows/android.yml` – podpisany APK+AAB; tag `vX.Y.Z` → Release (`radar-epwr.apk`, `.sha256`, `.aab`). Link stały: `.../releases/latest/download/radar-epwr.apk`.

## Wydanie / wdrożenie
- Zmiana ekranów: edytuj `web/`, commit+push tu, potem `scripts/sync-do-strony.sh`.
- Nowa wersja APK: podbij tag (`git tag v1.0.X && git push --tags`); versionCode = nr uruchomienia Actions.
- Sekrety Actions (ustawione): RADAR_KEYSTORE_B64, RADAR_KEYSTORE_PASSWORD, RADAR_KEY_ALIAS, RADAR_KEY_PASSWORD, GOOGLE_SERVICES_JSON_B64.
- Klucz podpisu (PKCS12) + hasło: `~/Desktop/Kodowanie/klucze-podpisu/` (poza gitem; właściciel ma zrobić kopię). Utrata = brak aktualizacji.

## Pułapki
- `google-services.json` NIE w repo (publiczne) – tylko sekret.
- Nie dodawać obcych skryptów na `/app/` (most natywny, CSP).
- Konto Google Play + test 12×14 dni: kroki właściciela w `docs/INSTRUKCJA-WLASCICIELA.md`.
