@echo off
chcp 65001 >nul
title Serveur STS Company
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js n'est pas installe. Installez la version LTS depuis https://nodejs.org puis relancez. & pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" || (echo Node.js est trop ancien : il faut la version 22.13 ou plus recente. Installez la version LTS depuis https://nodejs.org & pause & exit /b 1)
set NODE_ENV=production
set PORT=3000
set STS_DB=data\sts.db
set STS_WEB_DIR=web
set STS_CATALOGUE=catalogue.json
if not exist data\sts.db node --disable-warning=ExperimentalWarning src\seed.js
echo.
echo  Application STS : http://localhost:3000
echo  Laissez cette fenetre ouverte. Fermez-la pour arreter le serveur.
echo.
node --disable-warning=ExperimentalWarning src\index.js
pause
