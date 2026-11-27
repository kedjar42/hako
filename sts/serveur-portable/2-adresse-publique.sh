#!/usr/bin/env bash
command -v cloudflared >/dev/null || { echo "cloudflared n'est pas installé. Mac : brew install cloudflared"; exit 1; }
echo "Le serveur doit déjà tourner. L'adresse publique (https://....trycloudflare.com) s'affiche ci-dessous."
exec cloudflared tunnel --url http://localhost:3000
