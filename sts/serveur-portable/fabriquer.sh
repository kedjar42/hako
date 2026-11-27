#!/usr/bin/env bash
# Fabrique le dossier « sts-serveur » prêt à lancer sur un ordinateur (serveur + version web + bibliothèques).
# Usage : sts/serveur-portable/fabriquer.sh <dossier-de-sortie>     (nécessite Flutter et Node.js)
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
STS="$(dirname "$ICI")"
SORTIE="${1:?Indiquez un dossier de sortie}/sts-serveur"
[ -e "$SORTIE" ] && { echo "Le dossier $SORTIE existe déjà : supprimez-le ou choisissez un autre dossier."; exit 1; }

(cd "$STS/app" && flutter build web --no-web-resources-cdn --dart-define=STS_API=meme-origine)

mkdir -p "$SORTIE/web"
cp -r "$STS/server/src" "$STS/server/package.json" "$STS/server/package-lock.json" "$SORTIE/"
cp "$STS/app/assets/demo/catalogue.json" "$SORTIE/catalogue.json"
(cd "$STS/app/build/web" && find . -type f ! -name '*.symbols' -exec cp --parents {} "$SORTIE/web/" \;)
cp "$ICI"/*.bat "$ICI"/1-*.sh "$ICI"/2-*.sh "$ICI"/creer-*.sh "$ICI/LISEZMOI.txt" "$SORTIE/"
chmod +x "$SORTIE"/*.sh
(cd "$SORTIE" && npm ci --omit=dev --no-audit --no-fund)
echo "Dossier prêt : $SORTIE"
