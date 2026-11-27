import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seed } from '../src/seed.js';

let server, base;
const codes = [];

before(async () => {
  const db = openDb(':memory:');
  seed(db, { adminEmail: 'admin@sts.test', adminPassword: 'motdepasse-admin' });
  const app = createApp({ db, jwtSecret: 'test', envoyerCode: (u, type, code) => codes.push({ email: u.email, type, code }) });
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}/api/v1`;
});
after(() => server.close());

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}
const dernierCode = (email, type) => codes.filter((c) => c.email === email && c.type === type).at(-1).code;

let userToken, adminToken;

test('inscription, vérification et connexion', async () => {
  const email = 'amine@exemple.dz';
  let r = await call('POST', '/auth/register', { nom: 'Benali', prenom: 'Amine', email, mot_de_passe: 'secret123' });
  assert.equal(r.status, 201);
  assert.equal(r.body.code_dev, undefined, 'le code ne doit pas fuiter hors mode dev');

  r = await call('POST', '/auth/register', { nom: 'X', prenom: 'Y', email, mot_de_passe: 'secret123' });
  assert.equal(r.status, 409);

  r = await call('POST', '/auth/login', { email, mot_de_passe: 'secret123' });
  assert.equal(r.status, 403, 'compte non vérifié');

  r = await call('POST', '/auth/verify', { email, code: '000000x' });
  assert.equal(r.status, 400);

  r = await call('POST', '/auth/verify', { email, code: dernierCode(email, 'verification') });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);

  r = await call('POST', '/auth/login', { email, mot_de_passe: 'mauvais' });
  assert.equal(r.status, 401);
  r = await call('POST', '/auth/login', { email: 'AMINE@exemple.dz', mot_de_passe: 'secret123' });
  assert.equal(r.status, 200);
  userToken = r.body.token;

  r = await call('POST', '/auth/login', { email: 'admin@sts.test', mot_de_passe: 'motdepasse-admin' });
  adminToken = r.body.token;
  assert.equal(r.body.user.role, 'admin');
});

test('mot de passe oublié', async () => {
  const email = 'amine@exemple.dz';
  await call('POST', '/auth/forgot', { email });
  let r = await call('POST', '/auth/reset', { email, code: dernierCode(email, 'reinitialisation'), mot_de_passe: 'nouveau123' });
  assert.equal(r.status, 200);
  r = await call('POST', '/auth/login', { email, mot_de_passe: 'nouveau123' });
  assert.equal(r.status, 200);
  userToken = r.body.token;
});

test('catalogue public et inscription à une session', async () => {
  let r = await call('GET', '/public/home');
  assert.equal(r.status, 200);
  assert.ok(r.body.formations.length >= 4);
  assert.equal(r.body.annonces.length, 2);

  r = await call('GET', '/catalog/formations?q=IPBX');
  assert.equal(r.body.length, 1);
  assert.equal((await call('GET', '/catalog/categories')).body.length, 3);

  const sessions = (await call('GET', '/catalog/sessions')).body;
  assert.ok(sessions.length >= 1);
  const s = sessions[0];

  r = await call('POST', `/catalog/sessions/${s.id}/inscription`, {});
  assert.equal(r.status, 401);
  r = await call('POST', `/catalog/sessions/${s.id}/inscription`, { message: 'Disponible le matin' }, userToken);
  assert.equal(r.status, 201);
  r = await call('POST', `/catalog/sessions/${s.id}/inscription`, {}, userToken);
  assert.equal(r.status, 409);

  const after = (await call('GET', '/catalog/sessions')).body.find((x) => x.id === s.id);
  assert.equal(after.places_restantes, s.places_restantes - 1);

  const mes = (await call('GET', '/me/inscriptions', null, userToken)).body;
  assert.equal(mes.length, 1);
  assert.equal(mes[0].statut, 'en_attente');

  // l'admin confirme → l'utilisateur reçoit une notification
  r = await call('PUT', `/admin/inscriptions/${mes[0].id}`, { statut: 'confirmee' }, adminToken);
  assert.equal(r.status, 200);
  r = await call('GET', '/notifications/non-lues', null, userToken);
  assert.equal(r.body.nombre, 1);
  await call('POST', '/notifications/tout-lire', null, userToken);
  r = await call('GET', '/notifications/non-lues', null, userToken);
  assert.equal(r.body.nombre, 0);
});

test('quiz : les réponses ne sont pas envoyées, le score est calculé', async () => {
  const liste = (await call('GET', '/tests', null, userToken)).body;
  const t = (await call('GET', `/tests/${liste[0].id}`, null, userToken)).body;
  assert.equal(t.questions.length, 3);
  for (const q of t.questions) assert.equal(q.bonne_reponse, undefined);

  const reponses = { [t.questions[0].id]: 0, [t.questions[1].id]: 1, [t.questions[2].id]: 0 };
  const r = await call('POST', `/tests/${t.id}/tentatives`, { reponses }, userToken);
  assert.equal(r.status, 201);
  assert.equal(r.body.score, 2);
  assert.equal(r.body.pourcentage, 67);

  const l2 = (await call('GET', '/tests', null, userToken)).body;
  assert.equal(l2[0].meilleur_pourcentage, 67);
});

test('administration protégée', async () => {
  let r = await call('GET', '/admin/users', null, userToken);
  assert.equal(r.status, 403);
  r = await call('POST', '/admin/formations', { titre: 'Nouvelle formation', niveau: 'Avancé' }, adminToken);
  assert.equal(r.status, 201);
  r = await call('POST', '/admin/formations', { titre: 'X', niveau: 'Expert' }, adminToken);
  assert.equal(r.status, 422);
  r = await call('POST', '/admin/questions', { test_id: 1, enonce: 'Q ?', choix: ['a', 'b'], bonne_reponse: 1 }, adminToken);
  assert.equal(r.status, 201);
  assert.equal(r.body.choix, '["a","b"]');
});
