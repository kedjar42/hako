import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

/**
 * Crée l'application Express de l'API STS.
 * @param {object} opts
 * @param {import('node:sqlite').DatabaseSync} opts.db
 * @param {string} opts.jwtSecret
 * @param {(user: object, type: 'verification'|'reinitialisation', code: string) => void} [opts.envoyerCode]
 *        Envoie un code par e-mail ou SMS. Par défaut, l'affiche dans la console.
 * @param {boolean} [opts.devCodes] Renvoie les codes dans les réponses (développement uniquement).
 */
export function createApp({ db, jwtSecret, envoyerCode, devCodes = false }) {
  if (!jwtSecret) throw new Error('jwtSecret manquant');
  envoyerCode ??= (u, type, code) => console.log(`[code ${type}] ${u.email} : ${code}`);

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();
  app.use('/api/v1', api);

  // ---------- utilitaires ----------
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const all = (sql, ...p) => db.prepare(sql).all(...p);
  const run = (sql, ...p) => db.prepare(sql).run(...p);

  class HttpError extends Error {
    constructor(status, message) { super(message); this.status = status; }
  }
  const fail = (status, message) => { throw new HttpError(status, message); };
  const h = (fn) => (req, res, next) => {
    try { const r = fn(req, res); if (r !== undefined) res.json(r); }
    catch (e) { next(e); }
  };

  const nouveauCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
  const dansMinutes = (m) => new Date(Date.now() + m * 60_000).toISOString();
  const emailValide = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const texte = (v, champ, { requis = true, max = 5000 } = {}) => {
    if (v === undefined || v === null || v === '') {
      if (requis) fail(422, `Le champ « ${champ} » est obligatoire.`);
      return null;
    }
    if (typeof v !== 'string' || v.length > max) fail(422, `Le champ « ${champ} » est invalide.`);
    return v.trim();
  };
  const motDePasse = (p) => {
    if (typeof p !== 'string' || p.length < 8) fail(422, 'Le mot de passe doit contenir au moins 8 caractères.');
    return p;
  };

  const publicUser = (u) => u && ({
    id: u.id, nom: u.nom, prenom: u.prenom, email: u.email,
    telephone: u.telephone, role: u.role, verifie: !!u.verifie, cree_le: u.cree_le,
  });
  const jeton = (u) => jwt.sign({ sub: u.id, role: u.role }, jwtSecret, { expiresIn: '30d' });

  function auth(req, _res, next) {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (!m) return next(new HttpError(401, 'Connexion requise.'));
    try {
      const { sub } = jwt.verify(m[1], jwtSecret);
      const u = one('SELECT * FROM users WHERE id = ?', sub);
      if (!u) return next(new HttpError(401, 'Compte introuvable.'));
      req.user = u;
      next();
    } catch {
      next(new HttpError(401, 'Session expirée, reconnectez-vous.'));
    }
  }
  const admin = (req, _res, next) =>
    req.user?.role === 'admin' ? next() : next(new HttpError(403, 'Accès réservé aux administrateurs.'));

  const avecCode = (base, code) => (devCodes ? { ...base, code_dev: code } : base);

  // ---------- authentification ----------
  api.post('/auth/register', h((req, res) => {
    const b = req.body ?? {};
    const nom = texte(b.nom, 'nom', { max: 100 });
    const prenom = texte(b.prenom, 'prénom', { max: 100 });
    const email = texte(b.email, 'e-mail', { max: 200 }).toLowerCase();
    if (!emailValide(email)) fail(422, 'Adresse e-mail invalide.');
    const telephone = texte(b.telephone, 'téléphone', { requis: false, max: 30 });
    const pwd = motDePasse(b.mot_de_passe);
    if (one('SELECT id FROM users WHERE email = ?', email)) fail(409, 'Un compte existe déjà avec cette adresse e-mail.');
    const code = nouveauCode();
    const r = run(
      `INSERT INTO users (nom, prenom, email, telephone, password_hash, code_verification, code_expire_le)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      nom, prenom, email, telephone, bcrypt.hashSync(pwd, 10), code, dansMinutes(30));
    const u = one('SELECT * FROM users WHERE id = ?', r.lastInsertRowid);
    envoyerCode(u, 'verification', code);
    res.status(201);
    return avecCode({ message: 'Compte créé. Un code de vérification vous a été envoyé.', user: publicUser(u) }, code);
  }));

  api.post('/auth/verify', h((req) => {
    const { email, code } = req.body ?? {};
    const u = one('SELECT * FROM users WHERE email = ?', String(email ?? '').toLowerCase());
    if (!u || !u.code_verification || u.code_verification !== String(code) || u.code_expire_le < new Date().toISOString())
      fail(400, 'Code invalide ou expiré.');
    run('UPDATE users SET verifie = 1, code_verification = NULL, code_expire_le = NULL WHERE id = ?', u.id);
    const v = one('SELECT * FROM users WHERE id = ?', u.id);
    return { message: 'Compte vérifié.', token: jeton(v), user: publicUser(v) };
  }));

  api.post('/auth/resend', h((req) => {
    const u = one('SELECT * FROM users WHERE email = ?', String(req.body?.email ?? '').toLowerCase());
    const base = { message: 'Si ce compte existe et n’est pas vérifié, un nouveau code a été envoyé.' };
    if (!u || u.verifie) return base;
    const code = nouveauCode();
    run('UPDATE users SET code_verification = ?, code_expire_le = ? WHERE id = ?', code, dansMinutes(30), u.id);
    envoyerCode(u, 'verification', code);
    return avecCode(base, code);
  }));

  api.post('/auth/login', h((req) => {
    const { email, mot_de_passe } = req.body ?? {};
    const u = one('SELECT * FROM users WHERE email = ?', String(email ?? '').toLowerCase());
    if (!u || !bcrypt.compareSync(String(mot_de_passe ?? ''), u.password_hash))
      fail(401, 'E-mail ou mot de passe incorrect.');
    if (!u.verifie) fail(403, 'Votre compte n’est pas encore vérifié.');
    return { token: jeton(u), user: publicUser(u) };
  }));

  api.post('/auth/forgot', h((req) => {
    const u = one('SELECT * FROM users WHERE email = ?', String(req.body?.email ?? '').toLowerCase());
    const base = { message: 'Si ce compte existe, un code de réinitialisation a été envoyé.' };
    if (!u) return base;
    const code = nouveauCode();
    run('UPDATE users SET code_reinitialisation = ?, code_expire_le = ? WHERE id = ?', code, dansMinutes(15), u.id);
    envoyerCode(u, 'reinitialisation', code);
    return avecCode(base, code);
  }));

  api.post('/auth/reset', h((req) => {
    const { email, code, mot_de_passe } = req.body ?? {};
    const u = one('SELECT * FROM users WHERE email = ?', String(email ?? '').toLowerCase());
    if (!u || !u.code_reinitialisation || u.code_reinitialisation !== String(code) || u.code_expire_le < new Date().toISOString())
      fail(400, 'Code invalide ou expiré.');
    const pwd = motDePasse(mot_de_passe);
    run(`UPDATE users SET password_hash = ?, code_reinitialisation = NULL, code_expire_le = NULL, verifie = 1
         WHERE id = ?`, bcrypt.hashSync(pwd, 10), u.id);
    return { message: 'Mot de passe modifié. Vous pouvez vous connecter.' };
  }));

  // ---------- profil ----------
  api.get('/me', auth, h((req) => ({ user: publicUser(req.user) })));

  api.put('/me', auth, h((req) => {
    const b = req.body ?? {};
    const nom = b.nom !== undefined ? texte(b.nom, 'nom', { max: 100 }) : req.user.nom;
    const prenom = b.prenom !== undefined ? texte(b.prenom, 'prénom', { max: 100 }) : req.user.prenom;
    const telephone = b.telephone !== undefined ? texte(b.telephone, 'téléphone', { requis: false, max: 30 }) : req.user.telephone;
    run('UPDATE users SET nom = ?, prenom = ?, telephone = ? WHERE id = ?', nom, prenom, telephone, req.user.id);
    return { user: publicUser(one('SELECT * FROM users WHERE id = ?', req.user.id)) };
  }));

  api.post('/me/password', auth, h((req) => {
    const { ancien, nouveau } = req.body ?? {};
    if (!bcrypt.compareSync(String(ancien ?? ''), req.user.password_hash)) fail(400, 'Mot de passe actuel incorrect.');
    run('UPDATE users SET password_hash = ? WHERE id = ?', bcrypt.hashSync(motDePasse(nouveau), 10), req.user.id);
    return { message: 'Mot de passe modifié.' };
  }));

  // ---------- accueil public ----------
  api.get('/public/home', h(() => ({
    annonces: all('SELECT * FROM annonces WHERE active = 1 ORDER BY cree_le DESC, id DESC LIMIT 5'),
    formations: all(`SELECT f.*, c.nom AS categorie FROM formations f LEFT JOIN categories c ON c.id = f.categorie_id
                     WHERE f.publiee = 1 ORDER BY f.cree_le DESC, f.id DESC LIMIT 6`),
    prochaines_sessions: all(`SELECT s.*, f.titre AS formation FROM sessions s JOIN formations f ON f.id = s.formation_id
                              WHERE s.statut = 'ouverte' AND s.date_debut >= date('now') AND f.publiee = 1
                              ORDER BY s.date_debut LIMIT 5`),
  })));

  // ---------- catalogue ----------
  const sessionAvecPlaces = (s) => {
    const n = one(`SELECT COUNT(*) AS n FROM inscriptions WHERE session_id = ? AND statut IN ('en_attente','confirmee')`, s.id).n;
    return { ...s, places_restantes: Math.max(0, s.places - n) };
  };

  api.get('/catalog/categories', h(() => all('SELECT * FROM categories ORDER BY nom')));

  api.get('/catalog/formations', h((req) => {
    const { categorie, q } = req.query;
    let sql = `SELECT f.*, c.nom AS categorie FROM formations f LEFT JOIN categories c ON c.id = f.categorie_id WHERE f.publiee = 1`;
    const p = [];
    if (categorie) { sql += ' AND f.categorie_id = ?'; p.push(Number(categorie)); }
    if (q) { sql += ' AND (f.titre LIKE ? OR f.resume LIKE ?)'; p.push(`%${q}%`, `%${q}%`); }
    return all(sql + ' ORDER BY f.titre', ...p);
  }));

  api.get('/catalog/formations/:id', h((req) => {
    const f = one(`SELECT f.*, c.nom AS categorie FROM formations f LEFT JOIN categories c ON c.id = f.categorie_id
                   WHERE f.id = ? AND f.publiee = 1`, Number(req.params.id));
    if (!f) fail(404, 'Formation introuvable.');
    const sessions = all(`SELECT * FROM sessions WHERE formation_id = ? AND statut != 'annulee' ORDER BY date_debut`, f.id)
      .map(sessionAvecPlaces);
    const ressources = all('SELECT * FROM ressources WHERE formation_id = ? ORDER BY titre', f.id);
    const tests = all('SELECT id, titre, duree_minutes FROM tests WHERE formation_id = ? AND publie = 1', f.id);
    return { ...f, sessions, ressources, tests };
  }));

  api.get('/catalog/sessions', h(() =>
    all(`SELECT s.*, f.titre AS formation FROM sessions s JOIN formations f ON f.id = s.formation_id
         WHERE s.statut != 'annulee' AND s.date_fin >= date('now') AND f.publiee = 1 ORDER BY s.date_debut`)
      .map(sessionAvecPlaces)));

  api.post('/catalog/sessions/:id/inscription', auth, h((req, res) => {
    const s = one('SELECT * FROM sessions WHERE id = ?', Number(req.params.id));
    if (!s) fail(404, 'Session introuvable.');
    if (s.statut !== 'ouverte') fail(409, 'Les inscriptions sont closes pour cette session.');
    if (sessionAvecPlaces(s).places_restantes <= 0) fail(409, 'Cette session est complète.');
    const existante = one('SELECT * FROM inscriptions WHERE session_id = ? AND user_id = ?', s.id, req.user.id);
    if (existante && existante.statut !== 'annulee') fail(409, 'Vous êtes déjà inscrit(e) à cette session.');
    const message = texte(req.body?.message, 'message', { requis: false, max: 1000 });
    if (existante) run(`UPDATE inscriptions SET statut = 'en_attente', message = ?, cree_le = datetime('now') WHERE id = ?`, message, existante.id);
    else run('INSERT INTO inscriptions (session_id, user_id, message) VALUES (?, ?, ?)', s.id, req.user.id, message);
    res.status(201);
    return { message: 'Demande d’inscription envoyée. STS vous contactera pour la confirmer.' };
  }));

  api.get('/me/inscriptions', auth, h((req) =>
    all(`SELECT i.*, s.date_debut, s.date_fin, s.lieu, f.titre AS formation, f.id AS formation_id
         FROM inscriptions i JOIN sessions s ON s.id = i.session_id JOIN formations f ON f.id = s.formation_id
         WHERE i.user_id = ? ORDER BY s.date_debut DESC`, req.user.id)));

  api.delete('/me/inscriptions/:id', auth, h((req) => {
    const r = run(`UPDATE inscriptions SET statut = 'annulee' WHERE id = ? AND user_id = ? AND statut IN ('en_attente','confirmee')`,
      Number(req.params.id), req.user.id);
    if (!r.changes) fail(404, 'Inscription introuvable.');
    return { message: 'Inscription annulée.' };
  }));

  // ---------- tests / quiz ----------
  api.get('/tests', auth, h((req) =>
    all(`SELECT t.id, t.titre, t.description, t.duree_minutes, t.formation_id,
                (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS nb_questions,
                (SELECT CAST(ROUND(MAX(score * 100.0 / total)) AS INTEGER) FROM tentatives a WHERE a.test_id = t.id AND a.user_id = ? AND total > 0) AS meilleur_pourcentage
         FROM tests t WHERE t.publie = 1 ORDER BY t.titre`, req.user.id)));

  api.get('/tests/:id', auth, h((req) => {
    const t = one('SELECT * FROM tests WHERE id = ? AND publie = 1', Number(req.params.id));
    if (!t) fail(404, 'Test introuvable.');
    const questions = all('SELECT id, enonce, choix FROM questions WHERE test_id = ? ORDER BY ordre, id', t.id)
      .map((q) => ({ ...q, choix: JSON.parse(q.choix) }));
    return { ...t, questions };
  }));

  api.post('/tests/:id/tentatives', auth, h((req, res) => {
    const t = one('SELECT * FROM tests WHERE id = ? AND publie = 1', Number(req.params.id));
    if (!t) fail(404, 'Test introuvable.');
    const reponses = req.body?.reponses;
    if (!reponses || typeof reponses !== 'object' || Array.isArray(reponses))
      fail(422, 'Format des réponses invalide : { "id_question": index_choisi }.');
    const qs = all('SELECT * FROM questions WHERE test_id = ? ORDER BY ordre, id', t.id);
    let score = 0;
    const correction = qs.map((q) => {
      const choisi = reponses[q.id] ?? reponses[String(q.id)];
      const juste = Number.isInteger(choisi) && choisi === q.bonne_reponse;
      if (juste) score++;
      return { question_id: q.id, choisi: Number.isInteger(choisi) ? choisi : null, bonne_reponse: q.bonne_reponse, juste, explication: q.explication };
    });
    const r = run('INSERT INTO tentatives (test_id, user_id, score, total, reponses) VALUES (?, ?, ?, ?, ?)',
      t.id, req.user.id, score, qs.length, JSON.stringify(reponses));
    res.status(201);
    return { id: Number(r.lastInsertRowid), score, total: qs.length,
             pourcentage: qs.length ? Math.round((score * 100) / qs.length) : 0, correction };
  }));

  api.get('/me/tentatives', auth, h((req) =>
    all(`SELECT a.id, a.test_id, t.titre, a.score, a.total, a.cree_le FROM tentatives a JOIN tests t ON t.id = a.test_id
         WHERE a.user_id = ? ORDER BY a.cree_le DESC, a.id DESC`, req.user.id)));

  // ---------- ressources ----------
  api.get('/ressources', auth, h((req) => {
    const { formation } = req.query;
    return formation
      ? all('SELECT * FROM ressources WHERE formation_id = ? ORDER BY titre', Number(formation))
      : all('SELECT * FROM ressources ORDER BY cree_le DESC, id DESC');
  }));

  // ---------- annonces & notifications ----------
  api.get('/annonces', h(() => all('SELECT * FROM annonces WHERE active = 1 ORDER BY cree_le DESC, id DESC')));

  api.get('/notifications', auth, h((req) =>
    all('SELECT * FROM notifications WHERE user_id = ? ORDER BY cree_le DESC, id DESC LIMIT 100', req.user.id)));
  api.get('/notifications/non-lues', auth, h((req) =>
    ({ nombre: one('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND lue = 0', req.user.id).n })));
  api.post('/notifications/tout-lire', auth, h((req) => {
    run('UPDATE notifications SET lue = 1 WHERE user_id = ?', req.user.id);
    return { message: 'Notifications marquées comme lues.' };
  }));
  api.post('/notifications/:id/lire', auth, h((req) => {
    run('UPDATE notifications SET lue = 1 WHERE id = ? AND user_id = ?', Number(req.params.id), req.user.id);
    return { message: 'OK' };
  }));

  // ---------- administration ----------
  const adm = express.Router();
  api.use('/admin', auth, admin, adm);

  const notifier = (userIds, titre, contenu) => {
    const st = db.prepare('INSERT INTO notifications (user_id, titre, contenu) VALUES (?, ?, ?)');
    for (const id of userIds) st.run(id, titre, contenu);
  };

  /** CRUD générique sur une table avec une liste blanche de colonnes. */
  function crud(chemin, table, colonnes, { obligatoires = [], json = [] } = {}) {
    const lire = (b) => {
      const v = {};
      for (const c of colonnes) if (b[c] !== undefined) v[c] = json.includes(c) ? JSON.stringify(b[c]) : b[c];
      return v;
    };
    adm.get(`/${chemin}`, h(() => all(`SELECT * FROM ${table} ORDER BY id DESC`)));
    adm.get(`/${chemin}/:id`, h((req) => one(`SELECT * FROM ${table} WHERE id = ?`, Number(req.params.id)) ?? fail(404, 'Introuvable.')));
    adm.post(`/${chemin}`, h((req, res) => {
      const v = lire(req.body ?? {});
      for (const c of obligatoires) if (v[c] === undefined || v[c] === '') fail(422, `Le champ « ${c} » est obligatoire.`);
      const cols = Object.keys(v);
      const r = run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...Object.values(v));
      res.status(201);
      return one(`SELECT * FROM ${table} WHERE id = ?`, r.lastInsertRowid);
    }));
    adm.put(`/${chemin}/:id`, h((req) => {
      const v = lire(req.body ?? {});
      const cols = Object.keys(v);
      if (!cols.length) fail(422, 'Aucun champ à modifier.');
      const r = run(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, ...Object.values(v), Number(req.params.id));
      if (!r.changes) fail(404, 'Introuvable.');
      return one(`SELECT * FROM ${table} WHERE id = ?`, Number(req.params.id));
    }));
    adm.delete(`/${chemin}/:id`, h((req) => {
      const r = run(`DELETE FROM ${table} WHERE id = ?`, Number(req.params.id));
      if (!r.changes) fail(404, 'Introuvable.');
      return { message: 'Supprimé.' };
    }));
  }

  crud('categories', 'categories', ['nom', 'icone'], { obligatoires: ['nom'] });
  crud('formations', 'formations',
    ['categorie_id', 'titre', 'resume', 'description', 'programme', 'duree_heures', 'niveau', 'prix_da', 'image_url', 'publiee'],
    { obligatoires: ['titre'] });
  crud('sessions', 'sessions', ['formation_id', 'date_debut', 'date_fin', 'lieu', 'places', 'statut'],
    { obligatoires: ['formation_id', 'date_debut', 'date_fin'] });
  crud('tests', 'tests', ['formation_id', 'titre', 'description', 'duree_minutes', 'publie'], { obligatoires: ['titre'] });
  crud('questions', 'questions', ['test_id', 'enonce', 'choix', 'bonne_reponse', 'explication', 'ordre'],
    { obligatoires: ['test_id', 'enonce', 'choix', 'bonne_reponse'], json: ['choix'] });
  crud('ressources', 'ressources', ['formation_id', 'titre', 'description', 'type', 'url'], { obligatoires: ['titre', 'url'] });
  crud('annonces', 'annonces', ['titre', 'contenu', 'active'], { obligatoires: ['titre', 'contenu'] });

  adm.get('/users', h(() => all('SELECT * FROM users ORDER BY id DESC').map(publicUser)));
  adm.put('/users/:id/role', h((req) => {
    const role = req.body?.role;
    if (!['user', 'admin'].includes(role)) fail(422, 'Rôle invalide.');
    run('UPDATE users SET role = ? WHERE id = ?', role, Number(req.params.id));
    return { user: publicUser(one('SELECT * FROM users WHERE id = ?', Number(req.params.id))) };
  }));

  adm.get('/inscriptions', h(() =>
    all(`SELECT i.*, u.nom, u.prenom, u.email, u.telephone, f.titre AS formation, s.date_debut
         FROM inscriptions i JOIN users u ON u.id = i.user_id JOIN sessions s ON s.id = i.session_id
         JOIN formations f ON f.id = s.formation_id ORDER BY i.cree_le DESC, i.id DESC`)));

  adm.put('/inscriptions/:id', h((req) => {
    const statut = req.body?.statut;
    if (!['en_attente', 'confirmee', 'refusee', 'annulee'].includes(statut)) fail(422, 'Statut invalide.');
    const i = one(`SELECT i.*, f.titre FROM inscriptions i JOIN sessions s ON s.id = i.session_id
                   JOIN formations f ON f.id = s.formation_id WHERE i.id = ?`, Number(req.params.id));
    if (!i) fail(404, 'Inscription introuvable.');
    run('UPDATE inscriptions SET statut = ? WHERE id = ?', statut, i.id);
    const libelle = { confirmee: 'confirmée', refusee: 'refusée', annulee: 'annulée', en_attente: 'en attente' }[statut];
    notifier([i.user_id], 'Inscription mise à jour', `Votre inscription à « ${i.titre} » est ${libelle}.`);
    return { message: 'Statut mis à jour.' };
  }));

  adm.post('/notifications', h((req, res) => {
    const titre = texte(req.body?.titre, 'titre', { max: 200 });
    const contenu = texte(req.body?.contenu, 'contenu', { max: 2000 });
    const ids = Array.isArray(req.body?.user_ids)
      ? req.body.user_ids.map(Number)
      : all('SELECT id FROM users').map((u) => u.id);
    notifier(ids, titre, contenu);
    res.status(201);
    return { message: `Notification envoyée à ${ids.length} utilisateur(s).` };
  }));

  // ---------- erreurs ----------
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Route introuvable.')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ erreur: err.message });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ erreur: 'JSON invalide.' });
    if (String(err?.message).includes('constraint')) return res.status(422).json({ erreur: 'Données invalides : ' + err.message });
    console.error(err);
    res.status(500).json({ erreur: 'Erreur interne du serveur.' });
  });

  return app;
}
