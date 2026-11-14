# Aplikacja „Odbierz z lotniska” – koncepcja (Android + iOS)

Stan na 2026-10-17. Rozwinięcie punktu 1 z `pomysly.md` („Zarabianie na stronie” → odbierający z lotniska).
Ceny i zasady sklepów są orientacyjne – przed decyzją sprawdzić aktualne cenniki i regulaminy (lista na końcu).

> **Aktualizacja 2026-10-17:** zaczynamy od wersji WWW (etap 0), ale w zmienionym kształcie: **bez kanału Telegram**, z własnym panelem klienta
> (`panel/`, logowanie e-mailem), powiadomieniami web push + SMS i płatnościami **HotPay** (jednorazowe: 4,99 / 14,99 / 59,99 zł; Stripe odpada).
> Szczegóły: `Panel odbioru/INSTRUKCJA.md`. Aplikacja mobilna – dopiero gdy panel pokaże popyt.

---

## 1. W skrócie

**Dla kogo:** osoba, która jedzie odebrać kogoś z lotniska (rodzina, znajomi, kierowca, firma transferowa).
**Problem:** „Kiedy wyjechać z domu, żeby nie czekać godzinę na parkingu i nie spóźnić się?” Strona lotniska pokazuje tylko planową godzinę i „wylądował”. FlightRadar pokazuje samolot, ale nie mówi, kiedy pasażer wyjdzie z hali i kiedy trzeba wsiąść do auta.

**Co robi aplikacja:**
1. Wpisujesz numer lotu (np. `FR 3021`) albo wybierasz go z tablicy przylotów.
2. Aplikacja śledzi samolot od startu (cały świat, nie tylko okolice Wrocławia).
3. Mówi, **kiedy wyjechać** (Twój czas dojazdu + przewidywany czas wyjścia pasażera z hali).
4. Wysyła powiadomienia: wystartował, opóźnienie, „wyjedź teraz”, ląduje za 10 min, wylądował, „pasażer wychodzi za ok. 15 min”.
5. Na ekranie blokady pokazuje pasek postępu lotu (iOS Live Activity, Android 16 Live Update).
6. Pozwala wysłać link „śledź ten lot” drugiej osobie, która nie ma aplikacji (strona WWW). To główny kanał, którym aplikacja zdobywa nowych użytkowników.

**Czego nie ma konkurencja:** prognozy wyjścia z hali i komunikatu „wyjedź teraz” dopasowanych do jednego lotniska. Do tego realne dane ADS-B z naszego radaru, polski język i lokalne informacje (parkingi, Kiss & Fly, gdzie stanąć).

**Wniosek strategiczny:** robimy **jedną aplikację dla wszystkich polskich lotnisk** (marka skanerlotniczy.pl / Radar), zaczynamy od EPWR. Osobna aplikacja na każde lotnisko łamie zasadę 4.3 App Store (spam – wiele prawie identycznych aplikacji) i dzieli użytkowników.

---

## 2. Najpierw wersja WWW, potem aplikacja

Aplikacja w sklepach to konta deweloperskie, przegląd w App Store, testy zamknięte w Google Play (patrz pkt 7) i kilka tygodni pracy. Popyt warto sprawdzić taniej:

| Etap | Co | Po co |
|---|---|---|
| **0. Web MVP** (2–3 tyg.) | Strona `radar-epwr.pl/lot/FR3021`: status, mapa, przewidywane wyjście z hali, przycisk „powiadom mnie na Telegramie” (bot już jest), link do udostępnienia. Na tablicy przylotów przycisk „Odbieram ten lot”. | Mierzymy: ile osób kliknie „Odbieram”, ile zapisze się na powiadomienia, ile udostępni link. Bez sklepów i bez kosztów. |
| **1. Aplikacja MVP** (6–8 tyg.) | Android + iOS: śledzenie lotu, powiadomienia push, „wyjedź teraz”, Live Activity / Live Update, udostępnianie linku. | Właściwy produkt. Strona WWW z etapu 0 zostaje jako widok dla osób bez aplikacji. |
| **2. Zarabianie** | Plus (subskrypcja / bilet na lot), afiliacje (parking, taxi), SMS do drugiej osoby. | Patrz pkt 6. |
| **3. Rozszerzenie** | Kolejne lotniska ze skanerlotniczy.pl, odloty („kiedy wyjść na lotnisko”), konto firmowe dla transferów. | Skala. |

**Próg do przejścia z etapu 0 do 1:** np. ≥ 30 zapisów na powiadomienia tygodniowo przez miesiąc. Poniżej tego aplikacja się nie zwróci.

---

## 3. Funkcje

### 3.1 MVP (etap 1)
| Funkcja | Szczegóły |
|---|---|
| Dodanie lotu | numer lotu (IATA/ICAO) + data albo wybór z tablicy przylotów EPWR; rozpoznawanie numeru z wklejonego tekstu (SMS / mail od linii) |
| Ekran lotu | trasa, mapa z pozycją samolotu, planowo / szacowany przylot, opóźnienie, typ i rejestracja (model z linkiem do adsb.lol, jak w alertach), pas, METAR EPWR |
| **„Wyjedź o…”** | czas dojazdu: ręcznie (np. 25 min) albo z GPS przy uruchomieniu; + bufor parkowania; aplikacja liczy godzinę wyjazdu i aktualizuje ją przy zmianie ETA |
| **Prognoza wyjścia z hali** | model z pkt 4.3; pokazywana jako przedział („wyjdzie ok. 14:35–14:45”) |
| Powiadomienia | wystartował · opóźnienie > 15 min · **wyjedź teraz** · 10 min do lądowania · wylądował (z ADS-B, zwykle szybciej niż tablica) · przekierowanie na inne lotnisko (mamy `/divcheck`) |
| Live Activity (iOS) / Live Update (Android 16+) | na ekranie blokady: pasek postępu lotu, ETA, „wyjedź o 14:05”; na starszym Androidzie zwykłe trwałe powiadomienie z postępem |
| Udostępnij | link `radar-epwr.pl/lot/<id>` – strona WWW z tym samym widokiem, bez instalacji, z przyciskiem „pobierz aplikację” |
| Na miejscu | gdzie stanąć: Kiss & Fly (limit czasu), parkingi P1/P2, strefa oczekiwania, wyjście z hali – statyczna mapka EPWR |
| Bez konta | identyfikator urządzenia zamiast logowania; konto (Apple / Google) dopiero przy zakupie Plus lub synchronizacji |

### 3.2 Później
- **Tryb „Odlot”** – „kiedy wyjechać na lotnisko” (odwrotny rachunek: odprawa, kontrola bezpieczeństwa, kolejki).
- **Widżety** na ekran główny (najbliższy śledzony lot).
- **Apple Watch / Wear OS** – powiadomienia i tak trafiają na zegarek, osobna aplikacja niepotrzebna na start.
- **CarPlay / Android Auto** – tylko powiadomienia głosowe; pełna aplikacja samochodowa wymaga zgody Apple (kategorie) – nie na start.
- **Konto firmowe** (transfery, hotele): wiele lotów naraz, lista klientów, eksport.
- **Kalibracja społecznościowa**: przycisk „Pasażer już wyszedł” → poprawia model z pkt 4.3 (patrz niżej).

---

## 4. Dane i logika

### 4.1 Skąd dane
| Dane | Źródło | Uwagi |
|---|---|---|
| Numer lotu → znak ATC, rejestracja, hex ICAO24, planowe godziny, lotnisko wylotu | **AeroDataBox** (RapidAPI) – `/flights/number/{numer}/{data}` | już planujemy go dla rozkładu (`pomysly.md`, 2–6.11.2026); jeden klucz, wspólny budżet. Darmowy próg ok. 600 jednostek/mies., płatne plany od ok. 5 USD/mies. – sprawdzić koszt jednostkowy endpointu (TIER) i czy plan pozwala na użycie komercyjne |
| Pozycja samolotu w locie (cały świat) | **adsb.lol** `/v2/hex/{hex}` lub `/v2/callsign/{znak}` przez Worker | licencja ODbL (zwykle dopuszcza użycie komercyjne z przypisaniem – **potwierdzić u adsb.lol**); limity dynamiczne, w przyszłości klucz API za feedowanie → kolejny argument za własną anteną RTL-SDR (plan w `pomysly.md`) |
| Pozycja przy EPWR (podejście, lądowanie, kołowanie) | adsb.lol + docelowo własny odbiornik | `on_ground` + prędkość < 40 kt na terenie lotniska = „wylądował” |
| Przekierowanie | `/divcheck` (FlightAware) | już działa |
| Pogoda | `/metar` | już działa |
| Czas dojazdu | ręcznie albo OSRM (darmowy, bez korków); z korkami Google Routes API (płatne) – dopiero w Plus | na start wystarczy ręcznie + GPS |

### 4.2 Statusy lotu (maszyna stanów)
`zaplanowany → opóźniony? → wystartował → w locie → podejście (< 40 km od EPWR) → wylądował → na stanowisku → pasażer wychodzi → zakończony (2 h po lądowaniu)`
plus `przekierowany`, `odwołany`. Każde przejście = jedno powiadomienie (bez spamu: min. odstęp, łączenie zmian ETA < 5 min).

### 4.3 Prognoza wyjścia z hali
`wyjście = lądowanie + kołowanie + wysiadka + kontrola + bagaż`

| Składnik | Start modelu (EPWR) | Skąd korekta |
|---|---|---|
| Kołowanie | 4–7 min | ADS-B: od przyziemienia do zatrzymania |
| Wysiadka | rękaw 5 min / autobus 10 min | typ samolotu, stanowisko (jeśli znane) |
| Kontrola paszportowa | Schengen 0 · spoza Schengen (UK, Turcja, Egipt…) 10–25 min | lotnisko wylotu → lista krajów Schengen |
| Bagaż rejestrowany | pytanie w aplikacji: „ma bagaż?” → +15–25 min | — |
| Szczyt | +5–10 min, gdy w ciągu 30 min ląduje 3+ samolotów | nasz rozkład |

**Kalibracja:** przycisk „Pasażer już wyszedł” zbiera rzeczywiste czasy. Po kilkuset przylotach mamy własne statystyki według kraju wylotu i godziny, których nikt inny nie ma. To jest przewaga, której nie da się łatwo skopiować.

### 4.4 „Wyjedź teraz”
`godzina wyjazdu = prognoza wyjścia − czas dojazdu − bufor parkowania (domyślnie 5 min)`
Powiadomienie, gdy do tej godziny zostaje 10 min, i drugie „wyjedź teraz”. Jeśli ETA się przesunie o > 10 min po wysłaniu, wysyłamy nowe („możesz wyjechać 20 min później”).

---

## 5. Technologia

### 5.1 Wybór technologii aplikacji

| Opcja | Plusy | Minusy | Werdykt |
|---|---|---|---|
| **PWA** (sama strona, instalowana z przeglądarki) | zero sklepów, zero opłat, web push działa też na iOS (od 16.4, po dodaniu do ekranu głównego) | brak Live Activity / Live Update, słaba widoczność, na iOS mało kto „dodaje do ekranu” | dobra na **etap 0**, nie jako produkt docelowy |
| **Capacitor** (strona w natywnej ramce) | wykorzystuje istniejący HTML/JS | ryzyko odrzucenia w App Store za zasadę **4.2 (minimum functionality)** – „przepakowana strona WWW”; samo push i lokalizacja zwykle nie wystarczą; Live Activity i tak trzeba pisać natywnie | odpada |
| **Expo (React Native)** | jedna baza kodu na Android + iOS; budowanie w chmurze (EAS), więc bez ręcznej konfiguracji Xcode i Android Studio; push przez `expo-notifications`; **`expo-widgets`** (stabilne od SDK 56, czerwiec 2026) daje widżety i Live Activities jako komponenty React, bez SwiftUI; aktualizacje OTA bez przeglądu sklepu (drobne poprawki JS) | Android 16 Live Updates wymaga małego modułu natywnego (Kotlin, `Notification.ProgressStyle`); trzeba nauczyć się React/TypeScript | **wybór** |
| Natywnie (Swift + Kotlin) | najlepsza integracja | dwie osobne aplikacje, podwójna praca | za drogo dla jednej osoby |

**Decyzja: Expo + TypeScript.** Mapa: `react-native-maps` (Apple Maps / Google Maps) albo MapLibre z kafelkami OSM (spójnie z planowanym radarem Leaflet). Ikona samolotu i paleta kolorów jak na radar-epwr.pl.

### 5.2 Zaplecze (backend) – rozbudowa istniejącego Workera
Wszystko zostaje na Cloudflare (już tam jest Worker, KV, cron) – bez VPS.

| Element | Rola |
|---|---|
| Worker (nowe ścieżki `/app/...`) | `POST /app/track` (dodaj lot + token push), `DELETE /app/track/{id}`, `GET /app/flight/{id}` (stan lotu dla aplikacji i strony udostępniania) |
| **D1** (baza SQL Cloudflare) | tabele: `devices` (token push, platforma, język), `trackings` (urządzenie, lot, data, czas dojazdu, bagaż, wysłane powiadomienia), `flights` (wspólny stan lotu – jeden lot śledzony przez 50 osób = jedno zapytanie do API), `exit_reports` (kalibracja 4.3) |
| **Cron co 1 min** | dla lotów „aktywnych” (od 1 h przed startem do 2 h po lądowaniu): adsb.lol po hexie, przejścia stanów, kolejka powiadomień. AeroDataBox tylko: przy dodaniu lotu + co 30–60 min przed startem (opóźnienia) → kilka jednostek na lot |
| Wysyłka push | **Expo Push Service** (darmowy, zwykłe HTTPS/JSON – działa z Workera). Live Activity na iOS wymaga osobnych pushy APNs typu `liveactivity` – **do sprawdzenia**: APNs wymaga HTTP/2 i JWT (ES256); jeśli Worker nie da rady wprost, pośrednik FCM HTTP v1 albo mała funkcja na Vercel. Live Activity ma godzinowy budżet aktualizacji – wysyłamy tylko przy zmianie stanu/ETA (priorytet 5), „wyjedź teraz” i „wylądował” z priorytetem 10 |
| Strona `/lot/<id>` | statyczny HTML w repo strony (Vercel), dane z `GET /app/flight/{id}`; podgląd OG (obrazek z trasą) do udostępnień na Messengerze/WhatsAppie |
| Bezpieczeństwo | limit lotów na urządzenie, limit zapytań (jest już `ratelimit` w Workerze), losowe ID udostępnień (nie numer lotu – prywatność), sekrety w Workerze + wpis w `security.md` |

Koszt Cloudflare: płatny plan Workers (ok. 5 USD/mies.) przy cronie co minutę i D1. Darmowy plan prawdopodobnie wystarczy na etap 0.

### 5.3 Struktura w repo
```
Aplikacja/
  KONCEPCJA.md        ← ten plik
  app/                ← projekt Expo (osobne repo przy publikacji? – do decyzji)
  web-lot/            ← strona udostępniania /lot/<id>
cloudflare-worker-adsb.js  ← nowe ścieżki /app/*
```

---

## 6. Model zarabiania

### 6.1 Darmowe vs Plus
| | Za darmo | **Plus** |
|---|---|---|
| Śledzone loty | 1 aktywny naraz | bez limitu |
| Powiadomienia push | tak (wszystkie podstawowe) | tak |
| „Wyjedź teraz” | tak, z ręcznym czasem dojazdu | z dojazdem z korkami (Google Routes) |
| Live Activity / Live Update | tak – to „efekt wow”, który ludzie pokazują innym; nie chowamy go za płatnością | tak |
| SMS do osoby bez aplikacji/smartfona (np. dziadek) | — | 5 SMS/mies. w cenie |
| Historia lotów, statystyki | — | tak |
| Reklamy / afiliacje | dyskretne, kontekstowe | bez reklam (afiliacje parkingów zostają – to usługa, nie reklama) |

**Ceny (propozycja do testu):**
- **Bilet na jeden lot** (zakup jednorazowy, consumable): 3,99 zł – dla okazjonalnych; najprostsza decyzja zakupowa.
- **Plus miesięcznie:** 9,99 zł · **rocznie:** 49,99 zł (dla kierowców, transferów, częstych odbiorców).
- **Firmowy** (etap 3): 49–99 zł/mies., wiele lotów, eksport, logo firmy na stronie udostępniania.

### 6.2 Prowizje sklepów
- Zakupy cyfrowe (Plus, bilet) w aplikacji **muszą** iść przez płatności Apple / Google.
- Apple: **Small Business Program** (przychody < 1 mln USD rocznie) – **15%**. W UE od 1.10.2026 nowe zasady: link do zakupu na stronie (10% dla członków programu) albo alternatywny procesor płatności. Na start zwykły zakup w aplikacji, 15%.
- Google Play: 15% od pierwszego 1 mln USD rocznie; subskrypcje 15%.
- Narzędzie: **RevenueCat** (darmowy do określonego progu przychodu) – jedna obsługa subskrypcji dla obu sklepów, bez własnej weryfikacji paragonów.

### 6.3 Afiliacje i partnerzy (bez prowizji sklepu – to usługi fizyczne)
- **Parking przy EPWR** – „Zarezerwuj parking” w ekranie lotu (prywatne parkingi, porównywarki z programem partnerskim).
- **Taxi / Bolt / Uber** – kod polecający; **transfery** – umowa z lokalną firmą (prowizja od kursu).
- **Odszkodowanie EC 261** – gdy przylot ma > 3 h opóźnienia: „pasażer może dostać do 600 €” → AirHelp / Flightright (prowizja od sprawy). Odbierający przekazuje info pasażerowi.
- **Kwiaty / balony na powitanie** – lokalna kwiaciarnia przy lotnisku (niszowe, ale pasuje do kontekstu).

### 6.4 Szacunek (bardzo zgrubny, do weryfikacji danymi z etapu 0)
EPWR obsługuje kilka mln pasażerów rocznie, a większość z nich ktoś odbiera. Przy 1000 aktywnych użytkowników miesięcznie i 3% konwersji na Plus to ok. 30 × 9,99 zł ≈ 300 zł/mies. z subskrypcji, plus bilety i afiliacje (parking ok. 10–20 zł prowizji od rezerwacji). Na samym Wrocławiu to dodatek. Realne pieniądze pojawią się przy wszystkich lotniskach ze skanerlotniczy.pl i kontach firmowych. Dlatego aplikacja ma być wielolotniskowa od pierwszego dnia (struktura danych, nie funkcje).

---

## 7. Publikacja w sklepach

| | Google Play | App Store |
|---|---|---|
| Konto | 25 USD jednorazowo | 99 USD rocznie |
| Osoba prywatna vs firma | konto osobiste: przed publikacją **test zamknięty z min. 12 testerami przez 14 dni bez przerwy** (testerzy muszą faktycznie się zapisać i zostać) – zebrać ich z kanału Telegram / radaru | konto osobiste pokazuje imię i nazwisko jako sprzedawcę; konto firmowe wymaga numeru D-U-N-S (czyli działalności) |
| Przegląd | zwykle kilka dni | 1–3 dni; ryzyko: 4.2 (za mało funkcji natywnych – u nas mapa, Live Activity, push, offline → OK), 5.1 (prywatność – opis zbieranych danych), 4.3 (nie mnożyć aplikacji per lotnisko) |
| Wymagane | polityka prywatności (URL), formularz „Data safety”, zrzuty ekranu, ikona | polityka prywatności, „App Privacy” (etykiety), zrzuty ekranu dla iPhone, konto testowe dla recenzenta (u nas niepotrzebne – działa bez logowania) |

Budowanie: **EAS Build** (chmura Expo, darmowy limit buildów miesięcznie) – Mac jest, ale nie jest konieczny; do testów potrzebny realny iPhone i telefon z Androidem 16 (Live Updates).

---

## 8. Prawo i formalności
- **Działalność:** sprzedaż Plus = przychód. Działalność nierejestrowana – limit kwartalny 225% minimalnego wynagrodzenia (patrz `Gra/KONCEPCJA.md`); przychody ze sklepów wpływają od Apple/Google (wypłaty z zagranicy) – potwierdzić z księgową rozliczenie VAT (sklep jest pośrednikiem i rozlicza VAT od konsumenta w UE).
- **RODO:** zbieramy token push, numer lotu, opcjonalnie lokalizację (tylko w chwili liczenia dojazdu, bez zapisu) i numer telefonu do SMS (tylko Plus, za zgodą odbiorcy). Usuwanie danych lotu 7 dni po przylocie. Regulamin + polityka prywatności na radar-epwr.pl.
- **Dane lotów:** potwierdzić licencję komercyjną: AeroDataBox (plan RapidAPI), adsb.lol (ODbL – przypisanie w aplikacji „Dane: adsb.lol, ODbL”), FlightAware (plan Personal = niekomercyjny → `/divcheck` w płatnej aplikacji wymaga zmiany planu albo zastąpienia).
- **LiveATC:** **nie** w aplikacji (zakaz komercyjnego użycia strumieni).
- **Nazwa i znaki:** bez logo Portu Lotniczego Wrocław i logotypów linii; nazwa aplikacji bez „Wrocław Airport” (ryzyko sporu o znak towarowy).
- **Hosting strony:** Vercel Hobby jest tylko do użytku niekomercyjnego – przy płatnej aplikacji strona `/lot/` → Vercel Pro albo Cloudflare Pages (jak w koncepcji gry).

---

## 9. Koszty startu (orientacyjnie)
| Pozycja | Koszt |
|---|---|
| Konto Google Play | 25 USD jednorazowo |
| Konto Apple Developer | 99 USD/rok |
| AeroDataBox | 0–30 USD/mies. (zależnie od liczby śledzonych lotów) |
| Cloudflare Workers Paid (cron co minutę, D1) | ok. 5 USD/mies. |
| SMS (np. SMSAPI, OVH) | ok. 0,11–0,17 zł netto za SMS (tylko Plus) |
| Expo EAS, RevenueCat, Expo Push | 0 na start (darmowe progi) |
| Telefon z Androidem 16 do testów | jeśli brak – używany Pixel |
| **Razem na start** | ok. **600–800 zł** w pierwszym roku + czas |

---

## 10. Plan prac (etap 0 → 1)

**Etap 0 – Web MVP (ok. 2–3 tyg.)**
1. Worker: AeroDataBox `/flights/number` (wspólny klucz z planem rozkładu), D1 z tabelą `trackings`, `GET /app/flight/{id}`.
2. Strona `/lot/<id>` + przycisk „Odbieram ten lot” na tablicy przylotów w `index.html` (+ szablon skanerlotniczy).
3. Powiadomienia przez istniejącego bota Telegram (`/start <id>` → subskrypcja lotu).
4. Prognoza wyjścia z hali (4.3) w wersji „start modelu” + przycisk „Pasażer już wyszedł”.
5. Licznik: kliknięcia „Odbieram”, zapisy, udostępnienia → decyzja o etapie 1.

**Etap 1 – Aplikacja (ok. 6–8 tyg.)**
1. Projekt Expo, ekrany: lista lotów, dodaj lot, ekran lotu, ustawienia.
2. Push (Expo Push) + cron co minutę w Workerze.
3. Live Activity (`expo-widgets`) + Android Live Update (moduł Kotlin) + zwykłe powiadomienie z postępem dla starszego Androida.
4. Udostępnianie linku, mapka „gdzie stanąć”.
5. Konta w sklepach, test zamknięty Google (12 osób × 14 dni – zacząć **równolegle** z pkt 1, bo to blokuje publikację), TestFlight.
6. Polityka prywatności, regulamin, etykiety prywatności.
7. Publikacja → potem etap 2 (Plus przez RevenueCat, afiliacje).

---

## 11. Otwarte pytania (do decyzji)
1. **Marka:** „Radar EPWR” (rozpoznawalna lokalnie) czy wspólna dla Polski (np. „Skaner Lotniczy – odbierz z lotniska”)? Rekomendacja: wspólna, bo aplikacja ma obsługiwać wiele lotnisk.
2. **Forma prawna:** działalność nierejestrowana na start czy od razu firma (konto Apple jako organizacja, faktury dla firm transferowych)?
3. **Pierwsze kroki nauki:** React + TypeScript (Expo) – nowa technologia względem obecnego czystego HTML/JS.
4. Czy etap 0 zrobić razem z wdrożeniem AeroDataBox (2–6.11.2026), skoro to ten sam klucz i podobna praca w Workerze?

---

## Źródła (stan wiedzy z 2026-10-17 – sprawdzić przed wdrożeniem)
- App Store 4.2 a aplikacje-„ramki” na stronę WWW: https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper
- Google Play – test zamknięty dla nowych kont osobistych: https://support.google.com/googleplay/android-developer/answer/14151465
- Live Activities przez push (ActivityKit): https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications · budżet aktualizacji: https://developer.apple.com/forums/thread/731715
- Android 16 Live Updates: https://proandroiddev.com/live-updates-in-android-16-exploring-the-next-evolution-of-notifications-1a5cf5de2068
- Expo – widżety i Live Activities (`expo-widgets`, SDK 56): https://expo.dev/blog/ios-widgets-and-live-activities-in-expo
- Prowizje Apple w UE od 1.10.2026: https://macrumors.com/2026/08/18/eu-app-store-fee-change
- AeroDataBox – ceny (zgrubnie): https://geekflare.com/dev/flight-data-api/
- adsb.lol – licencja i limity (źródła pośrednie): https://flyitalyadsb.com/en/dati/confronto/
- Ceny SMS (OVH, punkt odniesienia): https://www.ovhcloud.com/pl/sms/prices/
