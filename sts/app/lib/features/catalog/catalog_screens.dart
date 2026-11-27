import 'package:material_ui/material_ui.dart';
import '../../app/widgets.dart';
import '../../core/session.dart';
import '../auth/auth_screens.dart';
import '../tests/tests_screens.dart';
import '../me/me_screens.dart' show ouvrirRessource;

// ------------------------------------------------------------------ Liste des formations

class FormationsScreen extends StatefulWidget {
  const FormationsScreen({super.key});
  @override
  State<FormationsScreen> createState() => _FormationsScreenState();
}

class _FormationsScreenState extends State<FormationsScreen> {
  int? _categorie;
  String _q = '';
  Key _cle = UniqueKey();

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Column(children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: TextField(
          decoration: const InputDecoration(hintText: 'Rechercher une formation', prefixIcon: Icon(Icons.search), isDense: true),
          textInputAction: TextInputAction.search,
          onSubmitted: (v) => setState(() { _q = v.trim(); _cle = UniqueKey(); }),
        ),
      ),
      SizedBox(
        height: 48,
        child: Chargement<List>(
          charger: () async => await api.get('catalog/categories') as List,
          builder: (context, cats, _) => ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              _puce('Toutes', null),
              for (final c in cats) _puce(c['nom'] as String, c['id'] as int),
            ],
          ),
        ),
      ),
      Expanded(
        child: Chargement<List>(
          key: _cle,
          charger: () async {
            final p = <String>[
              if (_categorie != null) 'categorie=$_categorie',
              if (_q.isNotEmpty) 'q=${Uri.encodeQueryComponent(_q)}',
            ];
            return await api.get('catalog/formations${p.isEmpty ? '' : '?${p.join('&')}'}') as List;
          },
          builder: (context, list, _) => list.isEmpty
              ? ListView(children: const [SizedBox(height: 80), EtatVide(icone: Icons.school_outlined, texte: 'Aucune formation trouvée.')])
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: list.length,
                  itemBuilder: (context, i) => CarteFormation(f: Map<String, dynamic>.from(list[i])),
                ),
        ),
      ),
    ]);
  }

  Widget _puce(String label, int? id) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4),
        child: ChoiceChip(
          label: Text(label),
          selected: _categorie == id,
          onSelected: (_) => setState(() { _categorie = id; _cle = UniqueKey(); }),
        ),
      );
}

class CarteFormation extends StatelessWidget {
  const CarteFormation({super.key, required this.f});
  final Map<String, dynamic> f;

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Card(
      child: InkWell(
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => FormationDetailScreen(id: f['id'] as int))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (f['categorie'] != null)
              Text((f['categorie'] as String).toUpperCase(),
                  style: t.textTheme.labelSmall?.copyWith(color: t.colorScheme.secondary, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(f['titre'] as String, style: t.textTheme.titleMedium),
            if (f['resume'] != null) ...[
              const SizedBox(height: 6),
              Text(f['resume'] as String, maxLines: 2, overflow: TextOverflow.ellipsis, style: t.textTheme.bodyMedium),
            ],
            const SizedBox(height: 10),
            Wrap(spacing: 8, runSpacing: 4, children: [
              if (f['duree_heures'] != null) _Info(Icons.schedule, '${f['duree_heures']} h'),
              if (f['niveau'] != null) _Info(Icons.signal_cellular_alt, f['niveau'] as String),
              if (f['prix_da'] != null) _Info(Icons.payments_outlined, prixDa(f['prix_da'])),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _Info extends StatelessWidget {
  const _Info(this.icone, this.texte);
  final IconData icone;
  final String texte;
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icone, size: 16, color: Theme.of(context).colorScheme.outline),
        const SizedBox(width: 4),
        Text(texte, style: Theme.of(context).textTheme.bodySmall),
      ]);
}

// ------------------------------------------------------------------ Détail d'une formation

class FormationDetailScreen extends StatelessWidget {
  const FormationDetailScreen({super.key, required this.id});
  final int id;

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Scaffold(
      appBar: AppBar(title: const Text('Formation')),
      body: Chargement<Map>(
        charger: () async => await api.get('catalog/formations/$id') as Map,
        builder: (context, f, recharger) {
          final t = Theme.of(context);
          final sessions = f['sessions'] as List;
          final ressources = f['ressources'] as List;
          final tests = f['tests'] as List;
          return ListView(padding: const EdgeInsets.all(16), children: [
            if (f['categorie'] != null)
              Text((f['categorie'] as String).toUpperCase(),
                  style: t.textTheme.labelMedium?.copyWith(color: t.colorScheme.secondary, fontWeight: FontWeight.bold)),
            Text(f['titre'] as String, style: t.textTheme.headlineSmall),
            const SizedBox(height: 12),
            Wrap(spacing: 16, runSpacing: 6, children: [
              if (f['duree_heures'] != null) _Info(Icons.schedule, '${f['duree_heures']} heures'),
              if (f['niveau'] != null) _Info(Icons.signal_cellular_alt, f['niveau'] as String),
              if (f['prix_da'] != null) _Info(Icons.payments_outlined, prixDa(f['prix_da'])),
            ]),
            if (f['description'] != null) ...[const SizedBox(height: 16), Text(f['description'] as String)],
            if (f['programme'] != null) ...[
              const SizedBox(height: 20),
              Text('Programme', style: t.textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(f['programme'] as String),
            ],
            const SizedBox(height: 20),
            Text('Sessions', style: t.textTheme.titleMedium),
            if (sessions.isEmpty)
              const Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Aucune session programmée pour le moment.')),
            for (final s in sessions) CarteSession(s: Map<String, dynamic>.from(s), apresInscription: recharger),
            if (tests.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text('Tests', style: t.textTheme.titleMedium),
              for (final q in tests)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.quiz_outlined),
                  title: Text(q['titre'] as String),
                  subtitle: Text('${q['duree_minutes']} min'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => ouvrirTest(context, q['id'] as int),
                ),
            ],
            if (ressources.isNotEmpty) ...[
              const SizedBox(height: 20),
              Text('Ressources', style: t.textTheme.titleMedium),
              for (final r in ressources)
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(r['type'] == 'video' ? Icons.play_circle_outline : r['type'] == 'pdf' ? Icons.picture_as_pdf_outlined : Icons.link),
                  title: Text(r['titre'] as String),
                  onTap: () => ouvrirRessource(context, Map<String, dynamic>.from(r)),
                ),
            ],
          ]);
        },
      ),
    );
  }
}

class CarteSession extends StatelessWidget {
  const CarteSession({super.key, required this.s, this.afficherFormation = false, this.apresInscription});
  final Map<String, dynamic> s;
  final bool afficherFormation;
  final Future<void> Function()? apresInscription;

  @override
  Widget build(BuildContext context) {
    final restantes = s['places_restantes'] as int? ?? 0;
    final ouverte = s['statut'] == 'ouverte' && restantes > 0;
    final etat = s['statut'] != 'ouverte' ? 'Inscriptions closes' : restantes == 0 ? 'Complet' : '$restantes place(s) restante(s)';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          const Icon(Icons.event),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              if (afficherFormation && s['formation'] != null)
                Text(s['formation'] as String, style: Theme.of(context).textTheme.titleSmall),
              Text('Du ${dateFr(s['date_debut'] as String?)} au ${dateFr(s['date_fin'] as String?)}'),
              if (s['lieu'] != null) Text(s['lieu'] as String, style: Theme.of(context).textTheme.bodySmall),
              Text(etat, style: Theme.of(context).textTheme.bodySmall),
            ]),
          ),
          FilledButton.tonal(
            onPressed: ouverte ? () => _inscrire(context) : null,
            child: const Text('S’inscrire'),
          ),
        ]),
      ),
    );
  }

  Future<void> _inscrire(BuildContext context) async {
    final session = SessionScope.read(context);
    if (!session.connecte && !await demanderConnexion(context)) return;
    if (!context.mounted) return;
    final message = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + MediaQuery.of(ctx).viewInsets.bottom),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('Demande d’inscription', style: Theme.of(ctx).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text('Session du ${dateFr(s['date_debut'] as String?)}. STS vous contactera pour confirmer votre place.'),
          const SizedBox(height: 16),
          TextField(controller: message, maxLines: 3, maxLength: 1000,
              decoration: const InputDecoration(labelText: 'Message (facultatif)')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Envoyer la demande')),
        ]),
      ),
    );
    if (ok != true || !context.mounted) return;
    try {
      final r = await session.api.post('catalog/sessions/${s['id']}/inscription', {'message': message.text.trim()});
      if (context.mounted) afficherMessage(context, r['message'] as String);
      await apresInscription?.call();
    } catch (e) {
      if (context.mounted) afficherMessage(context, messageErreur(e), erreur: true);
    }
  }
}

// ------------------------------------------------------------------ Calendrier des sessions

class SessionsScreen extends StatelessWidget {
  const SessionsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Scaffold(
      appBar: AppBar(title: const Text('Prochaines sessions')),
      body: Chargement<List>(
        charger: () async => await api.get('catalog/sessions') as List,
        builder: (context, list, recharger) => list.isEmpty
            ? ListView(children: const [SizedBox(height: 80), EtatVide(icone: Icons.event_busy, texte: 'Aucune session programmée.')])
            : ListView(padding: const EdgeInsets.all(12), children: [
                for (final s in list)
                  CarteSession(s: Map<String, dynamic>.from(s), afficherFormation: true, apresInscription: recharger),
              ]),
      ),
    );
  }
}
