import 'package:material_ui/material_ui.dart';
import '../core/api.dart';

void afficherMessage(BuildContext context, String message, {bool erreur = false}) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(message),
    backgroundColor: erreur ? Theme.of(context).colorScheme.error : null,
  ));
}

String messageErreur(Object e) =>
    e is ApiException ? e.message : 'Une erreur inattendue est survenue.';

/// Charge des données depuis l'API, avec écrans de chargement, d'erreur et « tirer pour actualiser ».
class Chargement<T> extends StatefulWidget {
  const Chargement({super.key, required this.charger, required this.builder, this.vide});

  final Future<T> Function() charger;
  final Widget Function(BuildContext context, T data, Future<void> Function() recharger) builder;
  final bool Function(T data)? vide;

  @override
  State<Chargement<T>> createState() => _ChargementState<T>();
}

class _ChargementState<T> extends State<Chargement<T>> {
  late Future<T> _future = widget.charger();

  Future<void> _recharger() async {
    final f = widget.charger();
    setState(() => _future = f);
    try { await f; } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return EtatVide(
              icone: Icons.cloud_off,
              texte: messageErreur(snap.error!),
              action: FilledButton.tonal(onPressed: _recharger, child: const Text('Réessayer')),
            );
          }
          return RefreshIndicator(onRefresh: _recharger, child: widget.builder(context, snap.data as T, _recharger));
        },
      );
}

class EtatVide extends StatelessWidget {
  const EtatVide({super.key, required this.icone, required this.texte, this.action});
  final IconData icone;
  final String texte;
  final Widget? action;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icone, size: 56, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            Text(texte, textAlign: TextAlign.center),
            if (action != null) ...[const SizedBox(height: 16), action!],
          ]),
        ),
      );
}

String dateFr(String? iso) {
  if (iso == null || iso.length < 10) return '';
  const mois = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  final d = DateTime.tryParse(iso.substring(0, 10));
  return d == null ? iso : '${d.day} ${mois[d.month - 1]} ${d.year}';
}

String prixDa(Object? v) {
  if (v is! num) return '';
  final s = v.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ' ');
  return '$s DA';
}

/// Logo officiel STS Company. [surFondSombre] : version blanche pour la barre du haut.
class StsLogo extends StatelessWidget {
  const StsLogo({super.key, this.hauteur = 48, this.surFondSombre = false});
  final double hauteur;
  final bool surFondSombre;
  @override
  Widget build(BuildContext context) => Image.asset(
        surFondSombre ? 'assets/brand/logo-sombre.png' : 'assets/brand/logo-clair.png',
        height: hauteur,
        semanticLabel: 'STS Company',
        fit: BoxFit.contain,
      );
}

const stsSlogan = 'Experts du terrain, passionnés de transmission.';
