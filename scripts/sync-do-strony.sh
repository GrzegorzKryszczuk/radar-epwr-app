#!/bin/bash
# Kopiuje ekrany aplikacji (web/app, web/lot) do repozytorium strony i wdraża (commit + push → Vercel).
# Użycie: scripts/sync-do-strony.sh ["opis zmiany"]   (strona domyślnie: ../RADAR EPWR albo SITE_REPO=ścieżka)
set -euo pipefail
cd "$(dirname "$0")/.."
SITE="${SITE_REPO:-$(cd .. && pwd)/RADAR EPWR}"
[ -d "$SITE/.git" ] || { echo "Brak repozytorium strony: $SITE"; exit 1; }
rsync -a --delete --exclude .DS_Store web/app/ "$SITE/app/"
rsync -a --delete --exclude .DS_Store web/lot/ "$SITE/lot/"
rsync -a --delete --exclude .DS_Store web/pobierz/ "$SITE/pobierz/"
cd "$SITE"
if [ -z "$(git status --porcelain app lot pobierz)" ]; then echo "Strona już aktualna."; exit 0; fi
git add app lot pobierz
git commit -m "${1:-Aplikacja: synchronizacja ekranów z radar-epwr-app}

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push
