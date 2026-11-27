import 'dart:async';
import 'package:material_ui/material_ui.dart';
import '../../app/widgets.dart';
import '../../core/session.dart';
import '../auth/auth_screens.dart';

Future<void> ouvrirTest(BuildContext context, int id) async {
  final session = SessionScope.read(context);
  if (!session.connecte && !await demanderConnexion(context)) return;
  if (context.mounted) {
    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => TestRunScreen(id: id)));
  }
}

class TestsScreen extends StatelessWidget {
  const TestsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    if (!session.connecte) {
      return EtatVide(
        icone: Icons.quiz_outlined,
        texte: 'Connectez-vous pour passer les tests et suivre vos résultats.',
        action: FilledButton(onPressed: () => demanderConnexion(context), child: const Text('Se connecter')),
      );
    }
    return Chargement<List>(
      charger: () async => await session.api.get('tests') as List,
      builder: (context, list, recharger) => list.isEmpty
          ? ListView(children: const [SizedBox(height: 80), EtatVide(icone: Icons.quiz_outlined, texte: 'Aucun test disponible.')])
          : ListView(padding: const EdgeInsets.all(12), children: [
              for (final t in list)
                Card(
                  child: ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.quiz_outlined)),
                    title: Text(t['titre'] as String),
                    subtitle: Text('${t['nb_questions']} questions · ${t['duree_minutes']} min'
                        '${t['meilleur_pourcentage'] != null ? ' · Meilleur score : ${t['meilleur_pourcentage']} %' : ''}'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () async {
                      await ouvrirTest(context, t['id'] as int);
                      await recharger();
                    },
                  ),
                ),
            ]),
    );
  }
}

class TestRunScreen extends StatefulWidget {
  const TestRunScreen({super.key, required this.id});
  final int id;
  @override
  State<TestRunScreen> createState() => _TestRunScreenState();
}

class _TestRunScreenState extends State<TestRunScreen> {
  Map<String, dynamic>? _test;
  Object? _erreur;
  final _reponses = <int, int>{};
  int _index = 0;
  int _restant = 0;
  Timer? _timer;
  Map<String, dynamic>? _resultat;
  bool _envoi = false;

  @override
  void initState() {
    super.initState();
    _charger();
  }

  Future<void> _charger() async {
    try {
      final t = Map<String, dynamic>.from(await SessionScope.read(context).api.get('tests/${widget.id}'));
      setState(() {
        _test = t;
        _restant = (t['duree_minutes'] as int) * 60;
      });
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (_restant <= 1) {
          _timer?.cancel();
          if (mounted) afficherMessage(context, 'Temps écoulé : vos réponses ont été envoyées.');
          _envoyer();
        } else {
          setState(() => _restant--);
        }
      });
    } catch (e) {
      setState(() => _erreur = e);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _envoyer() async {
    if (_envoi || _resultat != null) return;
    _timer?.cancel();
    setState(() => _envoi = true);
    try {
      final r = await SessionScope.read(context).api.post('tests/${widget.id}/tentatives', {
        'reponses': {for (final e in _reponses.entries) '${e.key}': e.value},
      });
      setState(() => _resultat = Map<String, dynamic>.from(r));
    } catch (e) {
      if (mounted) afficherMessage(context, messageErreur(e), erreur: true);
    } finally {
      if (mounted) setState(() => _envoi = false);
    }
  }

  Future<bool> _confirmerSortie() async {
    if (_resultat != null || _test == null) return true;
    return await showDialog<bool>(
          context: context,
          builder: (c) => AlertDialog(
            title: const Text('Quitter le test ?'),
            content: const Text('Vos réponses ne seront pas enregistrées.'),
            actions: [
              TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Continuer')),
              TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Quitter')),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    final t = _test;
    return PopScope(
      canPop: _resultat != null || t == null,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmerSortie() && context.mounted) Navigator.of(context).pop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(t?['titre'] as String? ?? 'Test'),
          actions: [
            if (t != null && _resultat == null)
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Center(child: Text('${_restant ~/ 60}:${(_restant % 60).toString().padLeft(2, '0')}',
                    style: const TextStyle(fontFeatures: [FontFeature.tabularFigures()], fontSize: 18))),
              ),
          ],
        ),
        body: _erreur != null
            ? EtatVide(icone: Icons.error_outline, texte: messageErreur(_erreur!))
            : t == null
                ? const Center(child: CircularProgressIndicator())
                : _resultat != null
                    ? _Resultat(test: t, resultat: _resultat!)
                    : _question(t),
      ),
    );
  }

  Widget _question(Map<String, dynamic> t) {
    final qs = t['questions'] as List;
    if (qs.isEmpty) return const EtatVide(icone: Icons.quiz_outlined, texte: 'Ce test ne contient pas encore de questions.');
    final q = qs[_index] as Map;
    final id = q['id'] as int;
    final choix = (q['choix'] as List).cast<String>();
    final dernier = _index == qs.length - 1;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      LinearProgressIndicator(value: (_index + 1) / qs.length),
      Expanded(
        child: ListView(padding: const EdgeInsets.all(20), children: [
          Text('Question ${_index + 1} sur ${qs.length}', style: Theme.of(context).textTheme.labelLarge),
          const SizedBox(height: 8),
          Text(q['enonce'] as String, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          RadioGroup<int>(
            groupValue: _reponses[id],
            onChanged: (v) => setState(() => _reponses[id] = v!),
            child: Column(children: [
              for (var i = 0; i < choix.length; i++)
                Card(child: RadioListTile<int>(value: i, title: Text(choix[i]))),
            ]),
          ),
        ]),
      ),
      SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            if (_index > 0) OutlinedButton(onPressed: () => setState(() => _index--), child: const Text('Précédent')),
            const Spacer(),
            FilledButton(
              onPressed: _envoi
                  ? null
                  : dernier
                      ? _envoyer
                      : () => setState(() => _index++),
              child: Text(dernier ? 'Terminer (${_reponses.length}/${qs.length})' : 'Suivant'),
            ),
          ]),
        ),
      ),
    ]);
  }
}

class _Resultat extends StatelessWidget {
  const _Resultat({required this.test, required this.resultat});
  final Map<String, dynamic> test, resultat;

  @override
  Widget build(BuildContext context) {
    final th = Theme.of(context);
    final pct = resultat['pourcentage'] as int;
    final qs = {for (final q in test['questions'] as List) q['id'] as int: q as Map};
    return ListView(padding: const EdgeInsets.all(20), children: [
      Center(
        child: Column(children: [
          Icon(pct >= 50 ? Icons.emoji_events : Icons.replay, size: 64,
              color: pct >= 50 ? th.colorScheme.secondary : th.colorScheme.outline),
          const SizedBox(height: 8),
          Text('$pct %', style: th.textTheme.displaySmall),
          Text('${resultat['score']} bonne(s) réponse(s) sur ${resultat['total']}'),
        ]),
      ),
      const SizedBox(height: 24),
      Text('Correction', style: th.textTheme.titleMedium),
      for (final c in resultat['correction'] as List)
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(c['juste'] == true ? Icons.check_circle : Icons.cancel,
                    color: c['juste'] == true ? Colors.green : th.colorScheme.error),
                const SizedBox(width: 8),
                Expanded(child: Text(qs[c['question_id']]?['enonce'] as String? ?? '', style: th.textTheme.titleSmall)),
              ]),
              const SizedBox(height: 6),
              Text('Bonne réponse : ${(qs[c['question_id']]?['choix'] as List?)?[c['bonne_reponse'] as int] ?? ''}'),
              if (c['explication'] != null) Text(c['explication'] as String, style: th.textTheme.bodySmall),
            ]),
          ),
        ),
      const SizedBox(height: 16),
      FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Terminer')),
    ]);
  }
}
