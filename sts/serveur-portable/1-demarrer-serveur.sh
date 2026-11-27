#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Node.js n'est pas installé : installez la version LTS depuis https://nodejs.org"; exit 1; }
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || { echo "Node.js 22.13 ou plus récent est nécessaire (version LTS sur https://nodejs.org)"; exit 1; }
export NODE_ENV=production PORT=3000 STS_DB=data/sts.db STS_WEB_DIR=web STS_CATALOGUE=catalogue.json
[ -f data/sts.db ] || node --disable-warning=ExperimentalWarning src/seed.js
echo
echo "  Application STS : http://localhost:3000"
echo "  Laissez cette fenêtre ouverte. Ctrl+C pour arrêter le serveur."
echo
exec node --disable-warning=ExperimentalWarning src/index.js
