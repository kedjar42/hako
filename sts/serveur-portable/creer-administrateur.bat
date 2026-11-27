@echo off
chcp 65001 >nul
title Creer un compte administrateur STS
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe. Installez la version LTS depuis https://nodejs.org puis relancez. & pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || (echo Node.js est trop ancien : il faut la version 22.13 ou plus recente. Installez la version LTS depuis https://nodejs.org & pause & exit /b 1)
set NODE_ENV=production
set PORT=3000
set STS_DB=data\sts.db
set STS_WEB_DIR=web
set STS_CATALOGUE=catalogue.json
set /p STS_ADMIN_EMAIL=E-mail de l'administrateur : 
set /p STS_ADMIN_PASSWORD=Mot de passe (8 caracteres minimum, visible a l'ecran) : 
node --disable-warning=ExperimentalWarning src\seed.js
set STS_ADMIN_PASSWORD=
echo Compte administrateur pret (s'il n'existait pas deja).
pause
