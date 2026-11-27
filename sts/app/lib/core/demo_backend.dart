import 'dart:async';
import 'dart:convert';
import 'package:flutter/services.dart' show rootBundle;
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';

/// Faux serveur intégré à l'application pour la version de démonstration
/// (flutter build apk --dart-define=STS_DEMO=true). Il répond aux mêmes routes que
/// le vrai serveur, à partir de assets/demo/catalogue.json, et garde les comptes,
/// inscriptions, résultats et notifications sur le téléphone.
class DemoBackend {
  DemoBackend({this.delaiConfirmation = const Duration(seconds: 8)});

  static const codeDemo = '123456';
  static const emailDemo = 'demo@sts.dz';
  static const motDePasseDemo = 'demo1234';
  static const _cle = 'sts_demo_etat_v1';

  /// Délai avant que « STS » confirme automatiquement une inscription (simulation).
  final Duration delaiConfirmation;

  Map<String, dynamic>? _etat;
  int _seq = 1000;

  // ------------------------------------------------------------------ état

  Future<Map<String, dynamic>> _charger() async {
    if (_etat != null) return _etat!;
    final prefs = await SharedPreferences.getInstance();
    final enregistre = prefs.getString(_cle);
    if (enregistre != null) {
      _etat = jsonDecode(enregistre) as Map<String, dynamic>;
    } else {
      // aller-retour JSON : mêmes types que lors d'un rechargement depuis le téléphone
      _etat = jsonDecode(jsonEncode(await _etatInitial())) as Map<String, dynamic>;
      await _sauver();
    }
    _seq = (_etat!['seq'] as int?) ?? 1000;
    return _etat!;
  }

  Future<void> _sauver() async {
    _etat!['seq'] = _seq;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cle, jsonEncode(_etat));
  }

  int _id() => ++_seq;

  Future<Map<String, dynamic>> _etatInitial() async {
    final cat = jsonDecode(await rootBundle.loadString('assets/demo/catalogue.json')) as Map<String, dynamic>;
    var id = 0;
    final categories = <Map<String, dynamic>>[];
    final formations = <Map<String, dynamic>>[];
    final sessions = <Map<String, dynamic>>[];
    final tests = <Map<String, dynamic>>[];
    String jour(int j) => DateTime.now().add(Duration(days: j)).toIso8601String().substring(0, 10);
    for (final c in cat['categories'] as List) {
      categories.add({'id': ++id, 'nom': c['nom'], 'icone': c['icone']});
    }
    for (final f in cat['formations'] as List) {
      final categorie = categories.firstWhere((c) => c['nom'] == f['categorie'], orElse: () => {});
      final fid = ++id;
      formations.add({
        'id': fid, 'categorie_id': categorie['id'], 'categorie': categorie['nom'], 'titre': f['titre'],
        'resume': f['resume'], 'description': f['description'], 'programme': f['programme'],
        'duree_heures': f['duree_heures'], 'niveau': f['niveau'], 'prix_da': f['prix_da'], 'publiee': 1,
      });
      for (final s in (f['sessions'] as List? ?? [])) {
        final debut = s['debut_dans_jours'] as int;
        sessions.add({
          'id': ++id, 'formation_id': fid, 'date_debut': jour(debut), 'date_fin': jour(debut + ((s['duree_jours'] as int?) ?? 1) - 1),
          'lieu': s['lieu'], 'places': s['places'] ?? 20, 'statut': 'ouverte',
        });
      }
      for (final t in (f['tests'] as List? ?? [])) {
        final tid = ++id;
        tests.add({
          'id': tid, 'formation_id': fid, 'titre': t['titre'], 'description': t['description'],
          'duree_minutes': t['duree_minutes'] ?? 15,
          'questions': [
            for (final q in t['questions'] as List)
              {'id': ++id, 'enonce': q['enonce'], 'choix': q['choix'], 'bonne_reponse': q['bonne_reponse'], 'explication': q['explication']},
          ],
        });
      }
    }
    final maintenant = DateTime.now().toIso8601String();
    return {
      'seq': 1000,
      'categories': categories,
      'formations': formations,
      'sessions': sessions,
      'tests': tests,
      'annonces': [
        for (final a in (cat['annonces'] as List? ?? [])) {'id': ++id, 'titre': a['titre'], 'contenu': a['contenu'], 'active': 1, 'cree_le': maintenant},
      ],
      'users': [
        {'id': 1, 'nom': 'Démo', 'prenom': 'Compte', 'email': emailDemo, 'telephone': '', 'mot_de_passe': motDePasseDemo,
         'role': 'user', 'verifie': true, 'cree_le': maintenant},
      ],
      'inscriptions': <Map<String, dynamic>>[],
      'tentatives': <Map<String, dynamic>>[],
      'notifications': <Map<String, dynamic>>[],
    };
  }

  // ------------------------------------------------------------------ utilitaires

  Never _err(int status, String message) => throw ApiException(status, message);

  List<Map<String, dynamic>> _liste(String cle) => (_etat![cle] as List).cast<Map<String, dynamic>>();

  Map<String, dynamic>? _user(String? token) {
    final id = int.tryParse((token ?? '').replaceFirst('demo-', ''));
    return id == null ? null : _liste('users').where((u) => u['id'] == id).firstOrNull;
  }

  Map<String, dynamic> _public(Map<String, dynamic> u) => {
        for (final k in ['id', 'nom', 'prenom', 'email', 'telephone', 'role', 'verifie', 'cree_le']) k: u[k],
      };

  Map<String, dynamic> _avecPlaces(Map<String, dynamic> s) {
    final n = _liste('inscriptions').where((i) => i['session_id'] == s['id'] && ['en_attente', 'confirmee'].contains(i['statut'])).length;
    return {...s, 'places_restantes': ((s['places'] as int) - n).clamp(0, 1 << 30)};
  }

  Map<String, dynamic> _formation(int id) => _liste('formations').firstWhere((f) => f['id'] == id);

  void _notifier(int userId, String titre, String contenu) => _liste('notifications').insert(0, {
        'id': _id(), 'user_id': userId, 'titre': titre, 'contenu': contenu, 'lue': 0, 'cree_le': DateTime.now().toIso8601String(),
      });

  // ------------------------------------------------------------------ routes

  Future<dynamic> traiter(String method, String chemin, Object? body, String? token) async {
    await _charger();
    await Future<void>.delayed(const Duration(milliseconds: 250)); // comme un vrai réseau
    final uri = Uri.parse(chemin);
    final p = uri.pathSegments;
    final q = uri.queryParameters;
    final b = (body as Map?)?.cast<String, dynamic>() ?? {};
    final route = '$method ${p.join('/')}';
    final email = (b['email'] as String? ?? '').trim().toLowerCase();

    Map<String, dynamic> connecte() => _user(token) ?? _err(401, 'Connexion requise.');

    // ----- authentification
    if (route == 'POST auth/register') {
      for (final c in ['prenom', 'nom', 'email']) {
        if ((b[c] as String? ?? '').trim().isEmpty) _err(422, 'Le champ « $c » est obligatoire.');
      }
      if ((b['mot_de_passe'] as String? ?? '').length < 8) _err(422, 'Le mot de passe doit contenir au moins 8 caractères.');
      if (_liste('users').any((u) => u['email'] == email)) _err(409, 'Un compte existe déjà avec cette adresse e-mail.');
      final u = {
        'id': _id(), 'nom': (b['nom'] as String).trim(), 'prenom': (b['prenom'] as String).trim(), 'email': email,
        'telephone': b['telephone'] ?? '', 'mot_de_passe': b['mot_de_passe'], 'role': 'user', 'verifie': false,
        'cree_le': DateTime.now().toIso8601String(),
      };
      _liste('users').add(u);
      await _sauver();
      return {'message': 'Compte créé. Version de démonstration : le code est $codeDemo.', 'user': _public(u)};
    }
    if (route == 'POST auth/verify') {
      final u = _liste('users').where((u) => u['email'] == email).firstOrNull;
      if (u == null || '${b['code']}'.trim() != codeDemo) _err(400, 'Code invalide. Dans la démonstration, le code est $codeDemo.');
      u['verifie'] = true;
      _notifier(u['id'] as int, 'Bienvenue chez STS Company', 'Votre compte est activé. Bonne formation !');
      await _sauver();
      return {'message': 'Compte vérifié.', 'token': 'demo-${u['id']}', 'user': _public(u)};
    }
    if (route == 'POST auth/resend' || route == 'POST auth/forgot') {
      return {'message': 'Version de démonstration : aucun e-mail n’est envoyé, utilisez le code $codeDemo.'};
    }
    if (route == 'POST auth/reset') {
      final u = _liste('users').where((u) => u['email'] == email).firstOrNull;
      if (u == null || '${b['code']}'.trim() != codeDemo) _err(400, 'Code invalide ou expiré.');
      if ((b['mot_de_passe'] as String? ?? '').length < 8) _err(422, 'Le mot de passe doit contenir au moins 8 caractères.');
      u['mot_de_passe'] = b['mot_de_passe'];
      u['verifie'] = true;
      await _sauver();
      return {'message': 'Mot de passe modifié. Vous pouvez vous connecter.'};
    }
    if (route == 'POST auth/login') {
      final u = _liste('users').where((u) => u['email'] == email).firstOrNull;
      if (u == null || u['mot_de_passe'] != b['mot_de_passe']) _err(401, 'E-mail ou mot de passe incorrect.');
      if (u['verifie'] != true) _err(403, 'Votre compte n’est pas encore vérifié.');
      return {'token': 'demo-${u['id']}', 'user': _public(u)};
    }

    // ----- profil
    if (route == 'GET me') return {'user': _public(connecte())};
    if (route == 'PUT me') {
      final u = connecte();
      for (final c in ['nom', 'prenom', 'telephone']) {
        if (b[c] != null) u[c] = b[c];
      }
      await _sauver();
      return {'user': _public(u)};
    }

    // ----- accueil et catalogue
    if (route == 'GET public/home') {
      final aujourdhui = DateTime.now().toIso8601String().substring(0, 10);
      final prochaines = _liste('sessions').where((s) => s['statut'] == 'ouverte' && (s['date_debut'] as String).compareTo(aujourdhui) >= 0).toList()
        ..sort((a, b) => (a['date_debut'] as String).compareTo(b['date_debut'] as String));
      return {
        'annonces': _liste('annonces').where((a) => a['active'] == 1).toList(),
        'formations': _liste('formations').take(6).toList(),
        'prochaines_sessions': [for (final s in prochaines.take(5)) {...s, 'formation': _formation(s['formation_id'] as int)['titre']}],
      };
    }
    if (route == 'GET catalog/categories') return _liste('categories');
    if (route == 'GET catalog/formations') {
      final cat = int.tryParse(q['categorie'] ?? '');
      final txt = (q['q'] ?? '').toLowerCase();
      return _liste('formations').where((f) =>
          (cat == null || f['categorie_id'] == cat) &&
          (txt.isEmpty || '${f['titre']} ${f['resume']}'.toLowerCase().contains(txt))).toList();
    }
    if (method == 'GET' && p.length == 3 && p[0] == 'catalog' && p[1] == 'formations') {
      final f = _liste('formations').where((f) => f['id'] == int.tryParse(p[2])).firstOrNull ?? _err(404, 'Formation introuvable.');
      return {
        ...f,
        'sessions': [for (final s in _liste('sessions').where((s) => s['formation_id'] == f['id'])) _avecPlaces(s)],
        'ressources': <dynamic>[],
        'tests': [
          for (final t in _liste('tests').where((t) => t['formation_id'] == f['id']))
            {'id': t['id'], 'titre': t['titre'], 'duree_minutes': t['duree_minutes']},
        ],
      };
    }
    if (route == 'GET catalog/sessions') {
      final l = [for (final s in _liste('sessions')) {..._avecPlaces(s), 'formation': _formation(s['formation_id'] as int)['titre']}]
        ..sort((a, b) => (a['date_debut'] as String).compareTo(b['date_debut'] as String));
      return l;
    }
    if (method == 'POST' && p.length == 4 && p[0] == 'catalog' && p[3] == 'inscription') {
      final u = connecte();
      final s = _liste('sessions').where((s) => s['id'] == int.tryParse(p[2])).firstOrNull ?? _err(404, 'Session introuvable.');
      if (s['statut'] != 'ouverte') _err(409, 'Les inscriptions sont closes pour cette session.');
      if (_avecPlaces(s)['places_restantes'] == 0) _err(409, 'Cette session est complète.');
      final ex = _liste('inscriptions').where((i) => i['session_id'] == s['id'] && i['user_id'] == u['id']).firstOrNull;
      if (ex != null && ex['statut'] != 'annulee') _err(409, 'Vous êtes déjà inscrit(e) à cette session.');
      final titre = _formation(s['formation_id'] as int)['titre'];
      final insc = ex ?? {'id': _id(), 'session_id': s['id'], 'user_id': u['id']};
      insc.addAll({'statut': 'en_attente', 'message': b['message'], 'cree_le': DateTime.now().toIso8601String()});
      if (ex == null) _liste('inscriptions').add(insc);
      _notifier(u['id'] as int, 'Demande reçue', 'Votre demande d’inscription à « $titre » a bien été reçue.');
      await _sauver();
      // Simulation : STS confirme la place quelques secondes plus tard.
      Timer(delaiConfirmation, () async {
        if (insc['statut'] != 'en_attente') return;
        insc['statut'] = 'confirmee';
        _notifier(u['id'] as int, 'Inscription confirmée', 'Votre place pour « $titre » est confirmée. À bientôt chez STS !');
        await _sauver();
      });
      return {'message': 'Demande d’inscription envoyée. (Démonstration : elle sera confirmée dans quelques secondes.)'};
    }
    if (route == 'GET me/inscriptions') {
      final u = connecte();
      return [
        for (final i in _liste('inscriptions').where((i) => i['user_id'] == u['id']))
          () {
            final s = _liste('sessions').firstWhere((s) => s['id'] == i['session_id']);
            return {...i, 'date_debut': s['date_debut'], 'date_fin': s['date_fin'], 'lieu': s['lieu'],
                    'formation': _formation(s['formation_id'] as int)['titre'], 'formation_id': s['formation_id']};
          }(),
      ];
    }
    if (method == 'DELETE' && p.length == 3 && p[0] == 'me' && p[1] == 'inscriptions') {
      final u = connecte();
      final i = _liste('inscriptions').where((i) => i['id'] == int.tryParse(p[2]) && i['user_id'] == u['id']).firstOrNull
          ?? _err(404, 'Inscription introuvable.');
      i['statut'] = 'annulee';
      await _sauver();
      return {'message': 'Inscription annulée.'};
    }

    // ----- tests
    if (route == 'GET tests') {
      final u = connecte();
      return [
        for (final t in _liste('tests'))
          () {
            final mes = _liste('tentatives').where((a) => a['test_id'] == t['id'] && a['user_id'] == u['id']);
            return {
              'id': t['id'], 'titre': t['titre'], 'description': t['description'], 'duree_minutes': t['duree_minutes'],
              'formation_id': t['formation_id'], 'nb_questions': (t['questions'] as List).length,
              'meilleur_pourcentage': mes.isEmpty ? null : mes.map((a) => ((a['score'] as int) * 100 / (a['total'] as int)).round()).reduce((x, y) => x > y ? x : y),
            };
          }(),
      ];
    }
    if (method == 'GET' && p.length == 2 && p[0] == 'tests') {
      connecte();
      final t = _liste('tests').where((t) => t['id'] == int.tryParse(p[1])).firstOrNull ?? _err(404, 'Test introuvable.');
      return {
        ...t,
        'questions': [for (final qu in t['questions'] as List) {'id': qu['id'], 'enonce': qu['enonce'], 'choix': qu['choix']}],
      };
    }
    if (method == 'POST' && p.length == 3 && p[0] == 'tests' && p[2] == 'tentatives') {
      final u = connecte();
      final t = _liste('tests').where((t) => t['id'] == int.tryParse(p[1])).firstOrNull ?? _err(404, 'Test introuvable.');
      final rep = (b['reponses'] as Map?) ?? {};
      var score = 0;
      final correction = [
        for (final qu in t['questions'] as List)
          () {
            final choisi = rep['${qu['id']}'];
            final juste = choisi is int && choisi == qu['bonne_reponse'];
            if (juste) score++;
            return {'question_id': qu['id'], 'choisi': choisi, 'bonne_reponse': qu['bonne_reponse'], 'juste': juste, 'explication': qu['explication']};
          }(),
      ];
      final total = (t['questions'] as List).length;
      _liste('tentatives').insert(0, {
        'id': _id(), 'test_id': t['id'], 'titre': t['titre'], 'user_id': u['id'], 'score': score, 'total': total,
        'cree_le': DateTime.now().toIso8601String(),
      });
      await _sauver();
      return {'score': score, 'total': total, 'pourcentage': total == 0 ? 0 : (score * 100 / total).round(), 'correction': correction};
    }
    if (route == 'GET me/tentatives') {
      final u = connecte();
      return _liste('tentatives').where((a) => a['user_id'] == u['id']).toList();
    }

    // ----- ressources, annonces, notifications
    if (route == 'GET ressources') return <dynamic>[];
    if (route == 'GET annonces') return _liste('annonces');
    if (route == 'GET notifications') {
      final u = connecte();
      return _liste('notifications').where((n) => n['user_id'] == u['id']).toList();
    }
    if (route == 'GET notifications/non-lues') {
      final u = connecte();
      return {'nombre': _liste('notifications').where((n) => n['user_id'] == u['id'] && n['lue'] == 0).length};
    }
    if (route == 'POST notifications/tout-lire') {
      final u = connecte();
      for (final n in _liste('notifications').where((n) => n['user_id'] == u['id'])) {
        n['lue'] = 1;
      }
      await _sauver();
      return {'message': 'Notifications marquées comme lues.'};
    }
    if (method == 'POST' && p.length == 3 && p[0] == 'notifications' && p[2] == 'lire') {
      final u = connecte();
      for (final n in _liste('notifications').where((n) => n['id'] == int.tryParse(p[1]) && n['user_id'] == u['id'])) {
        n['lue'] = 1;
      }
      await _sauver();
      return {'message': 'OK'};
    }

    _err(404, 'Fonction non disponible dans la version de démonstration.');
  }

  /// Remet la démonstration à zéro (comptes, inscriptions, résultats).
  Future<void> reinitialiser() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cle);
    _etat = null;
  }
}
