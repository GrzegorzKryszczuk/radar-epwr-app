# Radar EPWR – aplikacja na Androida

Aplikacja mobilna serwisu [radar-epwr.pl](https://radar-epwr.pl): radar lotów nad Wrocławiem (EPWR) na żywo,
tablica odlotów i przylotów, alarmy 7700/7600/7500 z powiadomieniami push oraz nasłuch radiowy ATC.

## Pobierz i zainstaluj (bez Google Play)

**[⬇ Pobierz radar-epwr.apk](https://github.com/GrzegorzKryszczuk/radar-epwr-app/releases/latest/download/radar-epwr.apk)** – albo wejdź na telefonie na **radar-epwr.pl/pobierz**.

1. Stuknij link na telefonie z Androidem (8.0 lub nowszym) – plik pobierze się sam.
2. Otwórz pobrany plik. Przy pierwszej instalacji Android zapyta o zgodę dla przeglądarki
   („Zezwól z tego źródła”) – zaakceptuj, potem „Zainstaluj”.
3. Ikona **Radar EPWR** pojawi się wśród aplikacji; przeciągnij ją na pulpit. Aktualizacje: pobierz nowy plik
   i zainstaluj na wierzch (dane zostają).

Chrome może ostrzec, że „ten typ pliku może zaszkodzić urządzeniu” – to standardowy komunikat dla każdego APK spoza sklepu.
Autentyczność pliku sprawdzisz sumą SHA-256 z pliku `radar-epwr.apk.sha256` w danym wydaniu.

## Co potrafi

| Ekran | Opis |
|---|---|
| Radar | samoloty na żywo, ślad lotu, kolor = wysokość, udostępnianie lotu |
| Loty | tablica odlotów/przylotów, szukanie lotu, „Pokaż na radarze” |
| Zdarzenia | alarmy 7700/7600/7500 i inne zdarzenia |
| Nasłuch | radio ATC: Tower, Approach, Delivery (gra w tle) |
| Powiadomienia | tematy: alarmy, zdarzenia, transmisje na żywo |

## Jak to jest zbudowane

- **Powłoka natywna** (`android-app/`): Capacitor 8, pakiet `pl.radarepwr.app`, Firebase Cloud Messaging (powiadomienia).
- **Ekrany** (`web/app/`, `web/lot/`): ładowane z `https://radar-epwr.pl/app/`, więc zmiany treści
  nie wymagają nowej wersji aplikacji. Skrypt `scripts/sync-do-strony.sh` kopiuje je do repozytorium strony.
- **Serwer push**: Cloudflare Worker w repozytorium strony (tematy FCM; nie przechowujemy tokenów urządzeń).
- **Budowanie**: GitHub Actions (`.github/workflows/android.yml`) – podpisany APK i AAB; tag `vX.Y.Z` publikuje wydanie.
- Dokumentacja: [`docs/`](docs/) (instrukcja właściciela, sklep Google Play, koncepcja, propozycje).

## Prywatność

Aplikacja nie ma banerów reklamowych, analityki ani kont; w oknie lotu są oznaczone linki partnerskie (AirHelp, Kiwitaxi). Powiadomienia działają przez tematy FCM bez zapisywania tokenów.
Polityka: https://radar-epwr.pl/app/prywatnosc.html

## Rozwój

```
node --test testy/worker-push.test.js     # testy push (wymaga sąsiedniego folderu „RADAR EPWR” z Workerem albo WORKER_JS=ścieżka)
git tag v1.0.1 && git push --tags         # wydanie: Actions zbuduje i opublikuje APK/AAB
```

## Licencja

Kod publiczny do wglądu, aplikacja bezpłatna do użytku własnego; kopiowanie i rozpowszechnianie tylko za zgodą autora – zob. [LICENSE](LICENSE).
Narzędzie informacyjne – nie do nawigacji i decyzji dotyczących bezpieczeństwa lotu.
