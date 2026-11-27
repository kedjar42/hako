import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telephone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  verifie INTEGER NOT NULL DEFAULT 0,
  code_verification TEXT,
  code_reinitialisation TEXT,
  code_expire_le TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  icone TEXT
);

CREATE TABLE IF NOT EXISTS formations (
  id INTEGER PRIMARY KEY,
  categorie_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  titre TEXT NOT NULL,
  resume TEXT,
  description TEXT,
  programme TEXT,
  duree_heures INTEGER,
  niveau TEXT CHECK (niveau IN ('Débutant','Intermédiaire','Avancé')),
  prix_da INTEGER,
  image_url TEXT,
  publiee INTEGER NOT NULL DEFAULT 1,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY,
  formation_id INTEGER NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  date_debut TEXT NOT NULL,
  date_fin TEXT NOT NULL,
  lieu TEXT,
  places INTEGER NOT NULL DEFAULT 20,
  statut TEXT NOT NULL DEFAULT 'ouverte' CHECK (statut IN ('ouverte','fermee','annulee'))
);

CREATE TABLE IF NOT EXISTS inscriptions (
  id INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statut TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','confirmee','refusee','annulee')),
  message TEXT,
  cree_le TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS tests (
  id INTEGER PRIMARY KEY,
  formation_id INTEGER REFERENCES formations(id) ON DELETE SET NULL,
  titre TEXT NOT NULL,
  description TEXT,
  duree_minutes INTEGER NOT NULL DEFAULT 15,
  publie INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  enonce TEXT NOT NULL,
  choix TEXT NOT NULL,          -- tableau JSON de chaînes
  bonne_reponse INTEGER NOT NULL, -- index dans choix
  explication TEXT,
  ordre INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tentatives (
  id INTEGER PRIMARY KEY,
  test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  reponses TEXT NOT NULL,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ressources (
  id INTEGER PRIMARY KEY,
  formation_id INTEGER REFERENCES formations(id) ON DELETE SET NULL,
  titre TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'pdf' CHECK (type IN ('pdf','lien','video')),
  url TEXT NOT NULL,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS annonces (
  id INTEGER PRIMARY KEY,
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titre TEXT NOT NULL,
  contenu TEXT NOT NULL,
  lue INTEGER NOT NULL DEFAULT 0,
  cree_le TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  return db;
}
