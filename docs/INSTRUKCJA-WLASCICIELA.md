# Aplikacja Android „Radar EPWR” – instrukcja

Stan: 2026-11-14. Aplikacja gotowa w kodzie i wdrożona po stronie serwera. Do publikacji brakuje kroków, które wymagają **Twojego konta Google** (Firebase, Google Play) – opisane niżej, punkt po punkcie.

## Jak to jest zbudowane

| Część | Gdzie | Co robi |
|---|---|---|
| Ekrany aplikacji | `app/` → **radar-epwr.pl/app/** | Radar · Loty · Zdarzenia · Nasłuch · Więcej. Zmiana = `git push` (Vercel), **bez nowej wersji w Google Play** |
| Rejestr funkcji | `app/config.js` | tematy powiadomień, linki, funkcje z planów (`features`) – włączanie bez przebudowy aplikacji |
| Most natywny | `app/native.js` | push (FCM, tematy), udostępnianie, przycisk Wstecz, linki do YouTube/Telegrama |
| Strona udostępnionego lotu | `lot/` → **radar-epwr.pl/lot/?hex=…** | link z „Udostępnij” – działa bez aplikacji (Messenger, WhatsApp, Facebook) |
| Polityka prywatności | `app/prywatnosc.html` | adres do Google Play: `https://radar-epwr.pl/app/prywatnosc.html` |
| Powłoka Android | `Aplikacja/android-app/` | Capacitor 8.6, pakiet `pl.radarepwr.app`, ładuje radar-epwr.pl/app/ |
| Push z serwera | `cloudflare-worker-adsb.js` (FCM_…) | nowy alert z n8n → temat `alarmy`/`zdarzenia`; start transmisji w `/live` → temat `transmisja` |
| Budowanie | `.github/workflows/android.yml` | GitHub Actions buduje APK (i AAB do Play, gdy jest klucz) |
| Testy | `Aplikacja/testy/worker-push.test.js` | `node --test Aplikacja/testy/worker-push.test.js` (12 testów) |

Powiadomienia działają przez **tematy FCM**: telefon sam zapisuje się u Google na wybrane tematy, Worker wysyła jedną wiadomość na temat.
Nie trzymamy tokenów urządzeń (mniej danych osobowych, zero zapisów KV, brak bazy).

## Co musisz zrobić (jednorazowo)

### 1. Firebase – ZROBIONE 2026-11-14 (projekt `radar-epwr`, plik w repo, sekret Workera ustawiony)
1. https://console.firebase.google.com → **Dodaj projekt** (np. „Radar EPWR”), Google Analytics: **wyłącz**.
   (Możesz też użyć projektu od aplikacji 7700.pl – jedna aplikacja więcej w tym samym projekcie.)
2. **Dodaj aplikację → Android**, nazwa pakietu: `pl.radarepwr.app`. Pobierz **google-services.json**.
3. Wgraj go do GitHub jako sekret (nie do repozytorium):
   `base64 -i google-services.json | pbcopy` → GitHub → repo `radar-epwr` → Settings → Secrets and variables → Actions →
   **New repository secret** → nazwa `GOOGLE_SERVICES_JSON_B64`, wklej.
4. **Klucz dla serwera:** Firebase → ⚙️ Ustawienia projektu → **Konta usługi** → „Wygeneruj nowy klucz prywatny” (plik JSON).
   Zapisz go jako sekret Workera (w terminalu, w katalogu `RADAR EPWR`):
   `npx wrangler secret put FCM_SERVICE_ACCOUNT --name radar-epwr` → wklej **całą** zawartość pliku JSON → Enter.
   (Albo: dash.cloudflare.com → Workers → radar-epwr → Settings → Variables and Secrets → Add → typ Secret.)
   Plik JSON potem usuń z dysku albo trzymaj poza repozytorium. Dopisz do `security.md`, że sekret istnieje (bez treści).

### 2. Klucz podpisu wydania (raz na zawsze – NIE zgub)
W terminalu (Java jest w Android Studio; bez niego zrób to na komputerze z Android Studio):
```
keytool -genkeypair -v -keystore radar-epwr.jks -alias radar -keyalg RSA -keysize 4096 -validity 10000
```
Zapisz plik `.jks` i hasła w bezpiecznym miejscu (menedżer haseł + kopia offline). Utrata = brak możliwości aktualizacji aplikacji
(chyba że włączysz „Podpisywanie aplikacji przez Google Play” – zalecane, wtedy to tylko klucz przesyłania).
Sekrety GitHub: `RADAR_KEYSTORE_B64` (`base64 -i radar-epwr.jks | pbcopy`), `RADAR_KEYSTORE_PASSWORD`, `RADAR_KEY_ALIAS` (= `radar`), `RADAR_KEY_PASSWORD`.

### 3. Zbudowanie aplikacji
GitHub → repo `radar-epwr` → **Actions** → „Android – Radar EPWR” → **Run workflow**. Po ~6 min w „Artifacts”:
- `radar-epwr-debug-apk` – zainstaluj na telefonie (Ustawienia → zezwól na instalację z tego źródła),
- `radar-epwr-release-aab` – plik do Google Play (gdy są sekrety z pkt 2).

Lokalnie (gdy zainstalujesz Android Studio): `cd Aplikacja/android-app && npm install && npx cap sync android && npx cap open android` → Run.

### 4. Test na telefonie – lista kontrolna
- [ ] start: ekran powitalny z wyborem powiadomień → zgoda Androida,
- [ ] Radar: samoloty, stuknięcie → karta, ślad i pasek „Udostępnij” → menu udostępniania z linkiem `radar-epwr.pl/lot/?hex=…`,
- [ ] Loty: wyszukiwarka, szczegóły lotu, „Pokaż na radarze”, „Udostępnij lot”,
- [ ] Zdarzenia: lista, filtr Alarmy/Zdarzenia, „Pokaż na radarze”,
- [ ] Nasłuch: Tower/Approach/Delivery; dźwięk gra dalej po przejściu na Radar (mini-odtwarzacz),
- [ ] Więcej → 7× stuknij „Wersja ekranów” = **tryb testowy** (zdarzenia testowe + temat push `test`), potem w terminalu:
      `curl -X POST -H "Authorization: Bearer <ALERTS_TOKEN>" https://radar-epwr.festusus.workers.dev/push/test` → powiadomienie „[TEST]”,
- [ ] stuknięcie w powiadomienie otwiera właściwy ekran; aplikacja zamknięta i wyczyszczona z pamięci też dostaje powiadomienie,
- [ ] przycisk Wstecz: zamyka arkusz → wraca na Radar → chowa aplikację,
- [ ] bez internetu: ekran „Brak połączenia” z przyciskiem ponowienia,
- [ ] „Ustawienia dźwięku w Androidzie” otwiera ustawienia powiadomień aplikacji.

### 5. Google Play (konto osobiste, 25 USD jednorazowo)
1. https://play.google.com/console → utwórz konto (weryfikacja tożsamości; dane muszą być prawdziwe).
2. **Utwórz aplikację**: nazwa „Radar EPWR”, język polski, aplikacja, bezpłatna.
3. Uzupełnij wg `Aplikacja/SKLEP-GOOGLE-PLAY.md`: opis, grafiki, polityka prywatności, „Bezpieczeństwo danych”, klasyfikacja treści, grupa docelowa (18+ lub 13+), reklamy: **nie**.
4. **Test zamknięty: min. 12 testerów przez 14 dni bez przerwy** (wymóg dla nowych kont osobistych – sprawdź aktualny w Play Console).
   Zbierz testerów z kanału Telegram i Facebooka **już teraz** – to najdłuższy etap. Testerzy muszą mieć konto Google i zostać w teście przez 14 dni.
5. Po teście: „Wnioskuj o dostęp do wersji produkcyjnej” → wydanie produkcyjne.
6. Po publikacji: w `app/config.js` ustaw `playPublished: true` i wdroż – strona `/lot/` pokaże „Pobierz aplikację”.

## Aktualizacje
- Ekrany, teksty, tematy, kolory, nowe funkcje w HTML/JS: zmiana w `app/` + `git push`. Użytkownicy widzą ją po ponownym otwarciu aplikacji.
- Nowa wersja w Play tylko przy zmianach natywnych (wtyczki, ikony, uprawnienia, `capacitor.config.json`): podbij `versionCode`/`versionName`
  w `Aplikacja/android-app/android/app/build.gradle`, uruchom workflow, wgraj AAB.
- Nowy temat powiadomień: dopisz w `app/config.js` (`topics`) **i** w Workerze (`FCM_TOPICS` + miejsce wysyłki). Usunięcie `planned: true` pokazuje przełącznik.

## Bezpieczeństwo (podsumowanie)
- Most natywny dostępny tylko dla radar-epwr.pl (`allowNavigation`), na `/app/` **żadnych obcych skryptów** (CSP w `app/index.html` i `vercel.json`).
  Nie dodawać tu analityki, reklam ani skryptów partnerów.
- Tylko HTTPS (`network_security_config.xml`), brak kopii zapasowej danych aplikacji, WebView bez dostępu do plików, bez lokalizacji.
- Wysyłka push tylko z serwera, po tokenie n8n (`ALERTS_TOKEN`) albo PIN-ie panelu `/live`; max 5 powiadomień na jedno wywołanie,
  powtórki tego samego zdarzenia blokowane (cache 24 h), start transmisji najwyżej raz na 30 min.
- Z powiadomienia aplikacja otwiera wyłącznie ekran `/app/` (adres sprawdzany w `native.js`).
- `google-services.json`, klucz `.jks`, `keystore.properties` – nigdy do gita (są w `.gitignore`).
