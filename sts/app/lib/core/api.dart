import 'dart:convert';
import 'package:http/http.dart' as http;
import 'demo_backend.dart';

/// Adresse de l'API. À la compilation : flutter build apk --dart-define=STS_API=https://api.votre-domaine.dz/api/v1
const apiBaseUrl = String.fromEnvironment('STS_API', defaultValue: 'http://10.0.2.2:3000/api/v1');

/// Version de démonstration sans serveur : flutter build apk --dart-define=STS_DEMO=true
const modeDemo = bool.fromEnvironment('STS_DEMO');

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class Api {
  Api({String? baseUrl, http.Client? client, DemoBackend? demo})
      : baseUrl = baseUrl ?? apiBaseUrl,
        _client = client ?? http.Client(),
        demo = demo ?? (modeDemo ? DemoBackend() : null);

  final String baseUrl;
  final http.Client _client;

  /// Faux serveur intégré (version de démonstration), sinon null.
  final DemoBackend? demo;
  String? token;

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body);
  Future<dynamic> put(String path, [Object? body]) => _send('PUT', path, body);
  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(String method, String path, [Object? body]) async {
    if (demo != null) return demo!.traiter(method, path, body, token);
    final req = http.Request(method, Uri.parse('$baseUrl/$path'));
    req.headers['content-type'] = 'application/json';
    if (token != null) req.headers['authorization'] = 'Bearer $token';
    if (body != null) req.body = jsonEncode(body);
    final http.Response res;
    try {
      res = await http.Response.fromStream(await _client.send(req).timeout(const Duration(seconds: 20)));
    } catch (_) {
      throw ApiException(0, 'Impossible de joindre le serveur STS. Vérifiez votre connexion Internet.');
    }
    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      throw ApiException(res.statusCode, 'Réponse inattendue du serveur.');
    }
    if (res.statusCode >= 400) {
      final msg = data is Map && data['erreur'] is String ? data['erreur'] as String : 'Erreur ${res.statusCode}.';
      throw ApiException(res.statusCode, msg);
    }
    return data;
  }
}
