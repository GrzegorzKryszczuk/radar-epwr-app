# Propozycje rozwoju aplikacji Radar EPWR (2026-11-14)

Kolejność = mój szacunek „wartość dla użytkowników / nakład pracy”. Infrastruktura pod część z nich już jest (`app/config.js` → `features`, `topics`).

## Szybkie (same ekrany, bez nowej wersji w Play)
1. **„Obserwuj lot”** – gwiazdka przy locie z tablicy; powiadomienie lokalne „wystartował / ląduje za 10 min / wylądował”. Dla rodzin odbierających
   pasażerów to najczęstsza potrzeba. Etap 1 bez serwera (sprawdzanie przy otwarciu aplikacji), etap 2 = temat FCM per lot (Worker już umie tematy).
2. **Filtry zdarzeń w powiadomieniach** – zamiast jednego przełącznika „Co się dzieje…” wybór kategorii (wojsko, rzadcy goście, śmigłowce, pogoda,
   podsumowanie dnia). Wystarczą tematy `zd_military` itd. w Workerze i lista w `config.js`.
3. **Licznik wsparcia / cel miesięczny** w zakładce Więcej („Serwer na listopad: 70% opłacone”) – przejrzystość zwykle zwiększa wpłaty.
4. **Ostatnio oglądane samoloty** (`features.historia`) – lokalnie na telefonie, bez serwera.
5. **Statystyki dnia** (liczba operacji, najrzadszy typ, najwyżej przelatujący) – dane są już w podsumowaniu dnia z n8n.

## Średnie (wymagają nowej wersji natywnej)
6. **Widżet na ekran główny** – stan alarmu 7700 + najbliższy przylot/odlot. Wzmacnia też aplikację w ocenie Google („więcej niż strona WWW”).
7. **Skróty aplikacji** (długie przytrzymanie ikony: Radar / Loty / Nasłuch) i kafelek szybkich ustawień „Nasłuch wieży”.
8. **Nasłuch w tle z powiadomieniem multimedialnym** (usługa pierwszoplanowa) – dziś dźwięk zależy od WebView po zablokowaniu ekranu.
9. **Android Auto / Wear OS** – tylko powiadomienia (działają już same, bez kodu).

## Większe
10. **Odbiór z lotniska** (`features.odbior`, temat `odbior`) – panel już istnieje na serwerze; po włączeniu `PANEL_URL` w stronie
    i `features.odbior.enabled` w aplikacji przycisk „Odbieram ten lot” pojawi się w szczegółach przylotu.
11. **Alarmy squawk nad całą Polską** (temat `alarm7700`) – źródło jest na 7700.pl; wymaga, by serwer 7700.pl wysyłał też na ten temat FCM
    (albo wspólny projekt Firebase dla obu aplikacji).
12. **iPhone** – ten sam kod Capacitor (`npx cap add ios`), konto Apple 99 USD/rok, APNs przez Firebase. Uwaga: Apple ostrzej ocenia aplikacje
    oparte na stronie (zasada 4.2) – przed tym warto zrobić pkt 6 i 8.
13. **Kolejne lotniska** (`features.lotniska`) – jedna aplikacja dla wielu lotnisk zamiast osobnych (zasady sklepów zabraniają klonów).

## Promocja
- Kod QR „Pobierz aplikację” w transmisjach na YouTube i w nakładkach OBS.
- Baner „Mamy aplikację” na radar-epwr.pl dla użytkowników Androida (po publikacji, `playPublished: true`).
- Testerzy do testu zamkniętego (12 osób × 14 dni): ogłoszenie na Telegramie i Facebooku już teraz – w zamian wzmianka w „O aplikacji”.
