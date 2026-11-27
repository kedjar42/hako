# STS : application de formation et outils du technicien

Deux parties :

| Dossier | Contenu |
|---|---|
| `server/` | API (Node.js 22.13+, Express, SQLite) : comptes, formations, sessions, inscriptions, tests, ressources, annonces, notifications, administration |
| `app/` | Application mobile Flutter (Android), en français |

## 1. Lancer le serveur

```bash
cd sts/server
npm install
STS_ADMIN_EMAIL=admin@sts.dz STS_ADMIN_PASSWORD='un-mot-de-passe-solide' npm run seed
npm start
```

L'API répond sur `http://localhost:3000/api/v1`. `npm test` lance les tests automatiques.

Variables d'environnement :

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute (défaut 3000) |
| `STS_DB` | Fichier de base de données (défaut `data/sts.db`) |
| `STS_JWT_SECRET` | Secret de signature des sessions. Sinon, généré une fois dans `data/secret-jwt.txt` |
| `STS_WEB_DIR` | Dossier de la version web à servir à la racine du site (facultatif) |
| `STS_CATALOGUE` | Catalogue utilisé par `npm run seed` (défaut : `app/assets/demo/catalogue.json`) |
| `STS_DEV_CODES=1` | Développement uniquement : renvoie les codes de vérification dans les réponses |

**Codes de vérification :** pour l'instant, les codes envoyés à l'inscription et pour « mot de passe oublié » s'affichent dans la console du serveur. Avant la mise en ligne, branchez un service d'e-mail ou de SMS dans l'option `envoyerCode` de `createApp` (`src/app.js`).

## 2. Lancer l'application

Il faut [Flutter](https://docs.flutter.dev/get-started/install) et Android Studio (pour le SDK Android).

```bash
cd sts/app
flutter pub get
flutter run --dart-define=STS_API=http://10.0.2.2:3000/api/v1
```

`10.0.2.2` est l'adresse de votre ordinateur vue depuis l'émulateur Android. Sur un vrai téléphone, utilisez l'adresse de votre serveur.

**Version de démonstration (sans serveur) :** l'application embarque un faux serveur qui lit `app/assets/demo/catalogue.json` et garde les données sur le téléphone. Compte de démonstration : `demo@sts.dz` / `demo1234`, code de vérification `123456`.

```bash
flutter build apk --release --dart-define=STS_DEMO=true
```

**Catalogue :** `app/assets/demo/catalogue.json` contient les catégories, formations, sessions, tests et annonces. Il sert à la version de démonstration **et** au serveur (`npm run seed`).

**Construire l'APK :**

```bash
flutter build apk --release --dart-define=STS_API=https://api.votre-domaine.dz/api/v1
```

Le fichier se trouve dans `build/app/outputs/flutter-apk/app-release.apk`. Pour le Play Store, il faut une clé de signature : voir la [documentation Flutter](https://docs.flutter.dev/deployment/android).

## Héberger sur votre ordinateur (test)

Le dossier `serveur-portable/` contient des scripts qui lancent le serveur **et** la version web de l'application sur un ordinateur, puis lui donnent une adresse publique HTTPS grâce à un tunnel Cloudflare gratuit.

```bash
sts/serveur-portable/fabriquer.sh /chemin/de/sortie
```

Cette commande crée `sts-serveur/`, prêt à copier sur l'ordinateur (Node.js 22.13+ requis). Le mode d'emploi est dans `LISEZMOI.txt`. Dans ce mode, la version web est compilée avec `STS_API=meme-origine` : elle appelle l'API à sa propre adresse, donc elle marche quelle que soit l'adresse du tunnel.

Le serveur sert un dossier web si `STS_WEB_DIR` est défini. Sans `STS_JWT_SECRET`, il crée un secret aléatoire dans `data/secret-jwt.txt` au premier lancement.

## 3. Personnaliser

| Quoi | Où |
|---|---|
| Couleurs | `app/lib/app/theme.dart` (`StsColors`) |
| Logo | `StsLogo` dans `app/lib/app/widgets.dart` |
| Téléphone, e-mail, adresse | `StsContact` dans `app/lib/features/me/me_screens.dart` |
| Outils de calcul | `app/lib/features/tools/tools_screen.dart` (liste `outils`) et formules dans `calc.dart` |

## Contenu de l'application

- **Accueil** : annonces, prochaines sessions, formations
- **Formations** : catalogue par catégorie, recherche, détail, programme, demande d'inscription à une session
- **Outils** (hors ligne) : calcul IP et sous-réseaux, stockage vidéo, objectif de caméra, budget PoE, loi d'Ohm, chute de tension, autonomie batterie, code couleur des résistances, bilan optique, code couleur des fibres
- **Tests** : quiz chronométrés, correction détaillée, historique des résultats
- **Compte** : profil, mes inscriptions, résultats, ressources, notifications, contact

## Administration

L'administration se fait pour l'instant par l'API `/api/v1/admin/...` avec un compte administrateur : formations, sessions, tests et questions, ressources, annonces, validation des inscriptions (l'apprenant reçoit une notification) et envoi de notifications.
