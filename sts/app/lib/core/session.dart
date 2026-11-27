import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api.dart';

/// État de connexion de l'utilisateur, partagé dans toute l'application.
class Session extends ChangeNotifier {
  Session(this.api);

  final Api api;
  Map<String, dynamic>? user;
  int nonLues = 0;

  bool get connecte => api.token != null && user != null;
  String get nomComplet => user == null ? '' : '${user!['prenom']} ${user!['nom']}';

  static const _cle = 'sts_token';

  Future<void> restaurer() async {
    final prefs = await SharedPreferences.getInstance();
    final t = prefs.getString(_cle);
    if (t == null) return;
    api.token = t;
    try {
      final r = await api.get('me');
      user = Map<String, dynamic>.from(r['user']);
      await rafraichirNonLues();
    } on ApiException catch (e) {
      if (e.status == 401) await deconnecter(); // jeton expiré
      // hors ligne : on garde le jeton et on réessaiera plus tard
    }
    notifyListeners();
  }

  Future<void> ouvrir(Map<String, dynamic> reponse) async {
    api.token = reponse['token'] as String;
    user = Map<String, dynamic>.from(reponse['user']);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cle, api.token!);
    await rafraichirNonLues();
    notifyListeners();
  }

  Future<void> connecter(String email, String motDePasse) async =>
      ouvrir(await api.post('auth/login', {'email': email, 'mot_de_passe': motDePasse}));

  Future<void> rafraichirNonLues() async {
    if (api.token == null) return;
    try {
      nonLues = (await api.get('notifications/non-lues'))['nombre'] as int;
      notifyListeners();
    } catch (_) {}
  }

  void majUtilisateur(Map<String, dynamic> u) {
    user = u;
    notifyListeners();
  }

  Future<void> deconnecter() async {
    api.token = null;
    user = null;
    nonLues = 0;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_cle);
    notifyListeners();
  }
}

/// Donne accès à la [Session] depuis n'importe quel widget : `SessionScope.of(context)`.
class SessionScope extends InheritedNotifier<Session> {
  const SessionScope({super.key, required Session session, required super.child}) : super(notifier: session);

  static Session of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<SessionScope>()!.notifier!;

  static Session read(BuildContext context) =>
      (context.getElementForInheritedWidgetOfExactType<SessionScope>()!.widget as SessionScope).notifier!;
}
