// Remplit la base avec un compte administrateur et un contenu d'exemple.
// Usage : STS_ADMIN_EMAIL=... STS_ADMIN_PASSWORD=... npm run seed
// Le contenu vient de app/assets/demo/catalogue.json (ou du fichier STS_CATALOGUE).
import bcrypt from 'bcryptjs';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDb } from './db.js';

export function seed(db, { adminEmail, adminPassword, catalogue } = {}) {
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  const id = (r) => Number(r.lastInsertRowid);

  if (adminEmail && adminPassword) {
    run(`INSERT OR IGNORE INTO users (nom, prenom, email, password_hash, role, verifie)
         VALUES ('Administrateur', 'STS', ?, ?, 'admin', 1)`, adminEmail.toLowerCase(), bcrypt.hashSync(adminPassword, 10));
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM formations').get().n > 0) return;

  const cat = catalogue ?? lireCatalogue();
  const categories = {};
  for (const c of cat.categories) {
    categories[c.nom] = id(run('INSERT INTO categories (nom, icone) VALUES (?, ?)', c.nom, c.icone ?? null));
  }
  const jour = (j) => new Date(Date.now() + j * 86_400_000).toISOString().slice(0, 10);
  for (const f of cat.formations) {
    const fid = id(run(
      `INSERT INTO formations (categorie_id, titre, resume, description, programme, duree_heures, niveau, prix_da)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      categories[f.categorie] ?? null, f.titre, f.resume ?? null, f.description ?? null, f.programme ?? null,
      f.duree_heures ?? null, f.niveau ?? null, f.prix_da ?? null));
    for (const s of f.sessions ?? []) {
      run('INSERT INTO sessions (formation_id, date_debut, date_fin, lieu, places) VALUES (?, ?, ?, ?, ?)',
        fid, jour(s.debut_dans_jours), jour(s.debut_dans_jours + (s.duree_jours ?? 1) - 1), s.lieu ?? null, s.places ?? 20);
    }
    for (const t of f.tests ?? []) {
      const tid = id(run('INSERT INTO tests (formation_id, titre, description, duree_minutes) VALUES (?, ?, ?, ?)',
        fid, t.titre, t.description ?? null, t.duree_minutes ?? 15));
      t.questions.forEach((q, i) => run(
        'INSERT INTO questions (test_id, enonce, choix, bonne_reponse, explication, ordre) VALUES (?, ?, ?, ?, ?, ?)',
        tid, q.enonce, JSON.stringify(q.choix), q.bonne_reponse, q.explication ?? null, i + 1));
    }
  }
  for (const a of cat.annonces ?? []) run('INSERT INTO annonces (titre, contenu) VALUES (?, ?)', a.titre, a.contenu);
}

/** Catalogue partagé avec l'application (version de démonstration). */
export function lireCatalogue(chemin = process.env.STS_CATALOGUE
  ?? fileURLToPath(new URL('../../app/assets/demo/catalogue.json', import.meta.url))) {
  return JSON.parse(readFileSync(chemin, 'utf8'));
}

// Lancé directement (node src/seed.js) ; pathToFileURL gère aussi les chemins Windows (C:\...).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = openDb(process.env.STS_DB ?? 'data/sts.db');
  seed(db, { adminEmail: process.env.STS_ADMIN_EMAIL, adminPassword: process.env.STS_ADMIN_PASSWORD });
  console.log('Base initialisée.');
}
