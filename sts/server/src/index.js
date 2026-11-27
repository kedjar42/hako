import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openDb } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.STS_DB ?? 'data/sts.db';
const DEV = process.env.NODE_ENV !== 'production';
const WEB_DIR = process.env.STS_WEB_DIR ? resolve(process.env.STS_WEB_DIR) : null;

/** Secret de signature des sessions : variable STS_JWT_SECRET, sinon généré une fois et gardé à côté de la base. */
function secretJwt() {
  if (process.env.STS_JWT_SECRET) return process.env.STS_JWT_SECRET;
  const fichier = resolve(dirname(DB_PATH), 'secret-jwt.txt');
  if (!existsSync(fichier)) {
    mkdirSync(dirname(fichier), { recursive: true });
    writeFileSync(fichier, randomBytes(48).toString('hex'), { mode: 0o600 });
    console.log(`Secret de session créé : ${fichier} (ne le partagez pas).`);
  }
  return readFileSync(fichier, 'utf8').trim();
}

if (WEB_DIR && !existsSync(resolve(WEB_DIR, 'index.html'))) {
  console.error(`STS_WEB_DIR ne contient pas index.html : ${WEB_DIR}`);
  process.exit(1);
}

const db = openDb(DB_PATH);
const app = createApp({
  db,
  jwtSecret: secretJwt(),
  devCodes: DEV && process.env.STS_DEV_CODES === '1',
  webDir: WEB_DIR ?? undefined,
});

app.listen(PORT, () => {
  console.log(`API STS : http://localhost:${PORT}/api/v1`);
  if (WEB_DIR) console.log(`Application web : http://localhost:${PORT}/`);
  console.log('Les codes de vérification envoyés aux utilisateurs s’affichent dans cette fenêtre.');
});
