import 'package:material_ui/material_ui.dart';
import '../../app/theme.dart';
import '../../app/widgets.dart';
import '../../core/session.dart';
import '../catalog/catalog_screens.dart';

class AccueilScreen extends StatelessWidget {
  const AccueilScreen({super.key, required this.allerA});

  /// Change d'onglet : 1 = Formations, 2 = Outils, 3 = Tests.
  final void Function(int onglet) allerA;

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final t = Theme.of(context);
    return Chargement<Map>(
      charger: () async => await session.api.get('public/home') as Map,
      builder: (context, data, _) {
        final annonces = data['annonces'] as List;
        final formations = data['formations'] as List;
        final sessions = data['prochaines_sessions'] as List;
        return ListView(padding: const EdgeInsets.all(16), children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [StsColors.bleu, Color(0xFF1C5BC8)]),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(session.connecte ? 'Bonjour ${session.user!['prenom']} 👋' : 'Bienvenue chez STS',
                  style: t.textTheme.headlineSmall?.copyWith(color: Colors.white)),
              const SizedBox(height: 6),
              Text('Formations techniques et outils de terrain pour les installateurs.',
                  style: t.textTheme.bodyMedium?.copyWith(color: Colors.white70)),
              const SizedBox(height: 16),
              Wrap(spacing: 8, runSpacing: 8, children: [
                FilledButton(
                  style: FilledButton.styleFrom(backgroundColor: StsColors.orange, foregroundColor: Colors.white),
                  onPressed: () => allerA(1), child: const Text('Voir les formations')),
                OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.white, side: const BorderSide(color: Colors.white54)),
                  onPressed: () => allerA(2), child: const Text('Boîte à outils')),
              ]),
            ]),
          ),
          for (final a in annonces) ...[
            const SizedBox(height: 12),
            Card(
              color: t.colorScheme.secondaryContainer,
              child: ListTile(
                leading: const Icon(Icons.campaign_outlined),
                title: Text(a['titre'] as String),
                subtitle: Text(a['contenu'] as String),
              ),
            ),
          ],
          if (sessions.isNotEmpty) ...[
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: Text('Prochaines sessions', style: t.textTheme.titleMedium)),
              TextButton(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SessionsScreen())),
                child: const Text('Tout voir'),
              ),
            ]),
            for (final s in sessions)
              Card(
                child: ListTile(
                  leading: const Icon(Icons.event),
                  title: Text(s['formation'] as String),
                  subtitle: Text('À partir du ${dateFr(s['date_debut'] as String?)}${s['lieu'] != null ? ' · ${s['lieu']}' : ''}'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(builder: (_) => FormationDetailScreen(id: s['formation_id'] as int))),
                ),
              ),
          ],
          if (formations.isNotEmpty) ...[
            const SizedBox(height: 20),
            Text('Nos formations', style: t.textTheme.titleMedium),
            const SizedBox(height: 4),
            for (final f in formations) CarteFormation(f: Map<String, dynamic>.from(f)),
          ],
        ]);
      },
    );
  }
}
