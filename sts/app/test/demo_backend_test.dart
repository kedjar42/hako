import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sts_app/core/api.dart';
import 'package:sts_app/core/demo_backend.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('parcours complet en démonstration', () async {
    final api = Api(demo: DemoBackend(delaiConfirmation: const Duration(seconds: 2)));

    // catalogue issu de assets/demo/catalogue.json
    final cats = await api.get('catalog/categories') as List;
    expect(cats.map((c) => c['nom']), ['Fibre optique', 'Réseaux informatiques', 'Téléphonie IP (VoIP)']);
    expect((await api.get('catalog/formations') as List).length, 6);
    expect((await api.get('catalog/formations?q=ipbx') as List).length, 1);
    final home = await api.get('public/home') as Map;
    expect((home['annonces'] as List).length, 2);
    expect((home['prochaines_sessions'] as List), isNotEmpty);

    // inscription + vérification
    await api.post('auth/register', {'prenom': 'Amine', 'nom': 'B', 'email': 'a@b.dz', 'mot_de_passe': 'secret123'});
    await expectLater(api.post('auth/login', {'email': 'a@b.dz', 'mot_de_passe': 'secret123'}),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 403)));
    await expectLater(api.post('auth/verify', {'email': 'a@b.dz', 'code': '000000'}), throwsA(isA<ApiException>()));
    final v = await api.post('auth/verify', {'email': 'a@b.dz', 'code': DemoBackend.codeDemo}) as Map;
    api.token = v['token'] as String;
    expect((await api.get('me'))['user']['prenom'], 'Amine');

    // demande d'inscription puis confirmation automatique
    final s = (await api.get('catalog/sessions') as List).first as Map;
    await api.post('catalog/sessions/${s['id']}/inscription', {'message': ''});
    await expectLater(api.post('catalog/sessions/${s['id']}/inscription', {}),
        throwsA(isA<ApiException>().having((e) => e.status, 'status', 409)));
    expect(((await api.get('me/inscriptions') as List).first as Map)['statut'], 'en_attente');
    await Future<void>.delayed(const Duration(seconds: 2));
    expect(((await api.get('me/inscriptions') as List).first as Map)['statut'], 'confirmee');
    expect((await api.get('notifications/non-lues'))['nombre'], 3); // bienvenue, reçue, confirmée
    await api.post('notifications/tout-lire');
    expect((await api.get('notifications/non-lues'))['nombre'], 0);

    // quiz : pas de bonne réponse envoyée, score calculé
    final tests = await api.get('tests') as List;
    expect(tests.length, 3);
    final ipv4 = tests.firstWhere((t) => t['titre'] == 'Quiz : adressage IPv4') as Map;
    final t = await api.get('tests/${ipv4['id']}') as Map;
    for (final q in t['questions'] as List) {
      expect((q as Map).containsKey('bonne_reponse'), isFalse);
    }
    final ids = [for (final q in t['questions'] as List) q['id']];
    final r = await api.post('tests/${t['id']}/tentatives', {'reponses': {'${ids[0]}': 0, '${ids[1]}': 1, '${ids[2]}': 0}}) as Map;
    expect(r['score'], 2);
    expect(r['pourcentage'], 67);
    expect(((await api.get('tests') as List).firstWhere((x) => x['id'] == ipv4['id']) as Map)['meilleur_pourcentage'], 67);

    // les données survivent à un redémarrage de l'application
    final api2 = Api(demo: DemoBackend())..token = api.token;
    expect((await api2.get('me/tentatives') as List).length, 1);
    await expectLater(api2.get('route/inconnue'), throwsA(isA<ApiException>()));
  });
}
