// Remplit la base avec un compte administrateur et un contenu d'exemple.
// Usage : STS_ADMIN_EMAIL=... STS_ADMIN_PASSWORD=... npm run seed
import bcrypt from 'bcryptjs';
import { openDb } from './db.js';

export function seed(db, { adminEmail, adminPassword }) {
  const run = (sql, ...p) => db.prepare(sql).run(...p);
  const id = (r) => Number(r.lastInsertRowid);

  if (adminEmail && adminPassword) {
    run(`INSERT OR IGNORE INTO users (nom, prenom, email, password_hash, role, verifie)
         VALUES ('Administrateur', 'STS', ?, ?, 'admin', 1)`, adminEmail.toLowerCase(), bcrypt.hashSync(adminPassword, 10));
  }

  if (db.prepare('SELECT COUNT(*) AS n FROM formations').get().n > 0) return;

  const cat = {};
  for (const [nom, icone] of [['Vidéosurveillance', 'videocam'], ['Réseaux informatiques', 'lan'],
    ['Électricité', 'bolt'], ['Fibre optique', 'cable']]) {
    cat[nom] = id(run('INSERT INTO categories (nom, icone) VALUES (?, ?)', nom, icone));
  }

  const formation = (c, titre, resume, heures, niveau, prix, programme) => id(run(
    `INSERT INTO formations (categorie_id, titre, resume, description, programme, duree_heures, niveau, prix_da)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, cat[c], titre, resume, resume, programme, heures, niveau, prix));

  const fCctv = formation('Vidéosurveillance', 'Installateur vidéosurveillance IP',
    'Concevoir, installer et configurer un système de caméras IP avec enregistreur NVR.', 24, 'Débutant', 25000,
    '1. Caméras IP et objectifs\n2. Switch PoE et câblage\n3. Configuration du NVR\n4. Accès à distance\n5. Mise en service');
  const fRes = formation('Réseaux informatiques', 'Bases des réseaux TCP/IP',
    'Adressage IP, sous-réseaux, switchs et routeurs : les fondamentaux pour les techniciens.', 18, 'Débutant', 18000,
    '1. Modèle OSI et TCP/IP\n2. Adressage IPv4 et masques\n3. VLAN\n4. Diagnostic : ping, DNS');
  formation('Électricité', 'Électricité pour courants faibles',
    'Alimentations, sections de câble, chute de tension et protection des équipements.', 12, 'Intermédiaire', 15000,
    '1. Loi d’Ohm et puissance\n2. Alimentations 12 V / 24 V\n3. Chute de tension\n4. Onduleurs et autonomie');
  formation('Fibre optique', 'Raccordement fibre optique FTTH',
    'Soudure, connectorisation et mesures sur un réseau fibre jusqu’à l’abonné.', 30, 'Avancé', 35000,
    '1. Types de fibres\n2. Code couleur\n3. Soudure par fusion\n4. Bilan optique et mesures');

  const plus = (j) => new Date(Date.now() + j * 86_400_000).toISOString().slice(0, 10);
  run(`INSERT INTO sessions (formation_id, date_debut, date_fin, lieu, places) VALUES (?, ?, ?, ?, ?)`,
    fCctv, plus(14), plus(17), 'Centre STS', 12);
  run(`INSERT INTO sessions (formation_id, date_debut, date_fin, lieu, places) VALUES (?, ?, ?, ?, ?)`,
    fRes, plus(21), plus(23), 'Centre STS', 15);

  const test = id(run('INSERT INTO tests (formation_id, titre, description, duree_minutes) VALUES (?, ?, ?, ?)',
    fRes, 'Quiz : adressage IPv4', 'Vérifiez vos connaissances sur les adresses IP et les masques.', 10));
  const q = (enonce, choix, bonne, explication, ordre) => run(
    'INSERT INTO questions (test_id, enonce, choix, bonne_reponse, explication, ordre) VALUES (?, ?, ?, ?, ?, ?)',
    test, enonce, JSON.stringify(choix), bonne, explication, ordre);
  q('Combien d’adresses utilisables pour des hôtes dans un réseau /24 ?', ['254', '256', '255', '128'], 0,
    '2⁸ = 256 adresses, moins l’adresse réseau et l’adresse de diffusion.', 1);
  q('Quel masque correspond à /26 ?', ['255.255.255.0', '255.255.255.192', '255.255.255.224', '255.255.255.128'], 1,
    '26 bits à 1 : le dernier octet vaut 11000000 = 192.', 2);
  q('Laquelle de ces adresses est privée ?', ['8.8.8.8', '172.20.1.5', '100.1.1.1', '193.0.0.1'], 1,
    '172.16.0.0 à 172.31.255.255 est une plage privée (RFC 1918).', 3);

  run('INSERT INTO annonces (titre, contenu) VALUES (?, ?)', 'Bienvenue sur l’application STS Company',
    'Consultez nos formations, inscrivez-vous aux sessions et utilisez la boîte à outils du technicien.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const db = openDb(process.env.STS_DB ?? 'data/sts.db');
  seed(db, { adminEmail: process.env.STS_ADMIN_EMAIL, adminPassword: process.env.STS_ADMIN_PASSWORD });
  console.log('Base initialisée.');
}
