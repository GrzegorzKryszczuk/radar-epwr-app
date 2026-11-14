# Google Play – teksty i formularze (do wklejenia w Play Console)

## Karta sklepu
**Nazwa (max 30):** Radar EPWR – samoloty Wrocław
**Krótki opis (max 80):** Samoloty nad Wrocławiem na żywo, alarmy z lotniska, tablica lotów i nasłuch wieży.

**Pełny opis (max 4000):**
```
Radar EPWR to bezpłatny radar lotniska Wrocław (EPWR) – stworzony z pasji przez miłośnika lotnictwa, bez reklam i bez zakładania konta.

✈️ RADAR NA ŻYWO
Samoloty w promieniu ok. 110 km od Wrocławia: znak wywoławczy, wysokość, prędkość, kurs, typ i zdjęcie maszyny. Stuknij samolot – zobaczysz jego ślad w kolorach wysokości, trasę i szczegóły.

🗺️ PROCEDURY SID/STAR
Trasy odlotów i przylotów z AIP Polska dla pasa w użyciu – zobacz, którą procedurą leci samolot.

🌦️ POGODA LOTNICZA
METAR, TAF, wiatr i pas w użyciu, mapa opadów i burz, SIGMET i ostrzeżenia IMGW.

🛫 ODLOTY I PRZYLOTY
Tablica lotów Port Lotniczy Wrocław z opóźnieniami, bramkami i taśmami bagażowymi. Wyszukaj lot i jednym stuknięciem pokaż go na radarze.

🚨 ALARMY I ZDARZENIA
Powiadomienia push o tym, co dzieje się nad lotniskiem: squawk 7700/7600/7500, przekierowania, odejścia na drugi krąg, holding, a także rzadcy goście, wojsko, śmigłowce, kalibracje i podsumowanie dnia. Sam wybierasz, o czym chcesz wiedzieć.

🎧 NASŁUCH ATC
Wieża, zbliżanie i Delivery na żywo – dźwięk gra dalej, gdy oglądasz radar.

🔴 TRANSMISJE NA ŻYWO
Powiadomienie, gdy Radar EPWR zaczyna transmisję na YouTube.

📤 UDOSTĘPNIJ LOT
Wyślij znajomym link do lotu – otworzą go w przeglądarce, bez instalowania aplikacji.

☕ Aplikacja jest bezpłatna. Jeśli Ci się przydaje, możesz wesprzeć projekt na buycoffee.to/radar-epwr.

Ważne: dane pochodzą z publicznych źródeł (ADS-B: adsb.lol, ODbL) i automatycznej analizy – mogą zawierać błędy. Aplikacja nie służy do nawigacji ani celów operacyjnych. Projekt niezależny, niezwiązany z Portem Lotniczym Wrocław ani PAŻP.
```

**Kategoria:** Podróże i informacje lokalne (alternatywa: Pogoda). **Tagi:** lotnictwo, radar, loty.
**Kontakt:** e-mail (wymagany, widoczny publicznie – rozważ osobny adres), strona `https://radar-epwr.pl`.
**Polityka prywatności:** `https://radar-epwr.pl/app/prywatnosc.html`

## Grafiki
- Ikona 512×512: `Aplikacja/android-app/ikona-sklep-512.png` (gotowa).
- Grafika funkcji 1024×500: do zrobienia (np. z `Promocja/` – radar + napis „Radar EPWR”).
- Zrzuty ekranu telefonu (min. 2, zalecane 4–8, 9:16): Radar z kartą samolotu, Loty, Zdarzenia, Nasłuch, Pogoda. Zrób na telefonie po instalacji APK.
- Bez logo Portu Lotniczego Wrocław i logotypów linii (ryzyko zgłoszenia naruszenia znaku).

## Bezpieczeństwo danych (Data safety) – odpowiedzi
- Czy aplikacja zbiera lub udostępnia dane użytkownika? **Tak** (tylko identyfikatory urządzenia dla powiadomień).
- Czy wszystkie dane są szyfrowane podczas przesyłania? **Tak** (tylko HTTPS).
- Czy użytkownik może poprosić o usunięcie danych? **Tak** (wyłączenie powiadomień / odinstalowanie; opis w polityce).
- Typy danych:
  - **Identyfikatory urządzenia lub inne identyfikatory** – zbierane: tak; udostępniane: nie; cel: **funkcje aplikacji** (powiadomienia push); przetwarzanie efemeryczne: nie; wymagane: nie (opcjonalne – użytkownik może wyłączyć).
  - Lokalizacja, dane osobowe, finansowe, zdrowie, wiadomości, zdjęcia, audio, pliki, kalendarz, kontakty, aktywność w aplikacji, historia przeglądania, informacje o aplikacji i wydajności: **nie**.
- Uwaga: Firebase Messaging jest SDK Google – Google traktuje token FCM jako „Identyfikator urządzenia”. Analytics/Crashlytics: **nie używamy** (wyłączone w manifeście).

## Pozostałe formularze
- **Reklamy:** nie zawiera reklam.
- **Dostęp do aplikacji:** wszystkie funkcje dostępne bez logowania.
- **Klasyfikacja treści (IARC):** brak przemocy/treści wrażliwych → PEGI 3 / „Dla wszystkich”.
- **Grupa docelowa:** 13+ (nie kierowana do dzieci).
- **Aplikacja informacyjna/rządowa:** nie. **Aplikacja finansowa:** nie. **Zdrowie:** nie.
- **Uprawnienia:** INTERNET, POST_NOTIFICATIONS (powiadomienia) – bez lokalizacji, kamery, mikrofonu.
- **Treści generowane przez użytkowników:** nie.
- **Zasada „minimalnej funkcjonalności / webview”:** aplikacja ma natywne powiadomienia z kanałami, natywne udostępnianie, obsługę przycisku Wstecz,
  ustawienia powiadomień i ekran offline; ekrany zaprojektowano pod telefon (inne niż strona WWW). Gdyby recenzja to zakwestionowała – patrz
  `Aplikacja/PROPOZYCJE.md` (widżet ekranu głównego, natywna mapa).
