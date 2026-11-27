import { openDb } from './db.js';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3000);
const DB_PATH = process.env.STS_DB ?? 'data/sts.db';
const JWT_SECRET = process.env.STS_JWT_SECRET;
const DEV = process.env.NODE_ENV !== 'production';

if (!JWT_SECRET) {
  if (!DEV) {
    console.error('STS_JWT_SECRET doit être défini en production.');
    process.exit(1);
  }
  console.warn('⚠ STS_JWT_SECRET non défini : secret de développement utilisé.');
}

const db = openDb(DB_PATH);
const app = createApp({
  db,
  jwtSecret: JWT_SECRET ?? 'dev-secret-a-changer',
  devCodes: DEV && process.env.STS_DEV_CODES === '1',
});

app.listen(PORT, () => console.log(`API STS sur http://localhost:${PORT}/api/v1`));
