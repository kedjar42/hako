@echo off
chcp 65001 >nul
title Adresse publique STS (tunnel Cloudflare)
where cloudflared >nul 2>nul || (echo cloudflared n'est pas installe. Ouvrez PowerShell et tapez : winget install --id Cloudflare.cloudflared & echo Puis fermez et relancez ce fichier. & pause & exit /b 1)
echo.
echo  Le serveur (1-demarrer-serveur.bat) doit deja etre lance.
echo  Cherchez ci-dessous une ligne en https://....trycloudflare.com : c'est l'adresse a ouvrir sur les telephones.
echo  Laissez cette fenetre ouverte. L'adresse change a chaque lancement.
echo.
cloudflared tunnel --url http://localhost:3000
pause
