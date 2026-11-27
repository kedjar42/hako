#!/usr/bin/env bash
cd "$(dirname "$0")" || exit 1
command -v node >/dev/null || { echo "Node.js n'est pas installé : installez la version LTS depuis https://nodejs.org"; exit 1; }
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || { echo "Node.js 22.13 ou plus récent est nécessaire (version LTS sur https://nodejs.org)"; exit 1; }
export NODE_ENV=production PORT=3000 STS_DB=data/sts.db STS_WEB_DIR=web STS_CATALOGUE=catalogue.json
read -r -p "E-mail de l'administrateur : " STS_ADMIN_EMAIL
read -r -s -p "Mot de passe (8 caractères minimum) : " STS_ADMIN_PASSWORD; echo
STS_ADMIN_EMAIL="$STS_ADMIN_EMAIL" STS_ADMIN_PASSWORD="$STS_ADMIN_PASSWORD" node --disable-warning=ExperimentalWarning src/seed.js
echo "Compte administrateur prêt (s'il n'existait pas déjà)."
