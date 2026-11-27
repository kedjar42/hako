import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../app/widgets.dart';
import '../../core/session.dart';
import '../auth/auth_screens.dart';

/// Coordonnées de STS Company (Sarl Telecom Space).
class StsContact {
  static const raisonSociale = 'Sarl Telecom Space';
  static const telephone = '+213698589401';
  static const telephoneAffiche = '0698 58 94 01';
  static const email = 'kedjarabdelhak@gmail.com';
  static const facebook = 'https://www.facebook.com/profile.php?id=61596040366859';
  static const tiktok = 'https://www.tiktok.com/@abdelhak_kedjar';
  static const String? adresse = null; // à compléter : adresse du centre
}

Future<void> ouvrirRessource(BuildContext context, Map<String, dynamic> r) async {
  final uri = Uri.tryParse(r['url'] as String? ?? '');
  if (uri == null || !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
    if (context.mounted) afficherMessage(context, 'Impossible d’ouvrir ce document.', erreur: true);
  }
}

class CompteScreen extends StatelessWidget {
  const CompteScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    void ouvrir(Widget w) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));
    return ListView(children: [
      if (session.connecte)
        ListTile(
          contentPadding: const EdgeInsets.all(16),
          leading: CircleAvatar(radius: 28, child: Text(_initiales(session), style: const TextStyle(fontSize: 20))),
          title: Text(session.nomComplet, style: Theme.of(context).textTheme.titleLarge),
          subtitle: Text(session.user!['email'] as String),
          trailing: IconButton(icon: const Icon(Icons.edit_outlined), tooltip: 'Modifier', onPressed: () => ouvrir(const ProfilScreen())),
        )
      else
        Padding(
          padding: const EdgeInsets.all(24),
          child: Column(children: [
            const Text('Connectez-vous pour vous inscrire aux formations, passer les tests et recevoir vos notifications.',
                textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: () => demanderConnexion(context), child: const Text('Se connecter ou créer un compte')),
          ]),
        ),
      const Divider(),
      if (session.connecte) ...[
        ListTile(leading: const Icon(Icons.event_available), title: const Text('Mes inscriptions'),
            trailing: const Icon(Icons.chevron_right), onTap: () => ouvrir(const MesInscriptionsScreen())),
        ListTile(leading: const Icon(Icons.bar_chart), title: const Text('Mes résultats'),
            trailing: const Icon(Icons.chevron_right), onTap: () => ouvrir(const MesResultatsScreen())),
        ListTile(leading: const Icon(Icons.folder_open), title: const Text('Ressources pédagogiques'),
            trailing: const Icon(Icons.chevron_right), onTap: () => ouvrir(const RessourcesScreen())),
        ListTile(
          leading: Badge(isLabelVisible: session.nonLues > 0, label: Text('${session.nonLues}'), child: const Icon(Icons.notifications_outlined)),
          title: const Text('Notifications'), trailing: const Icon(Icons.chevron_right),
          onTap: () => ouvrir(const NotificationsScreen()),
        ),
      ],
      ListTile(leading: const Icon(Icons.support_agent), title: const Text('Contacter STS'),
          trailing: const Icon(Icons.chevron_right), onTap: () => ouvrir(const ContactScreen())),
      if (session.connecte)
        ListTile(
          leading: const Icon(Icons.logout),
          title: const Text('Se déconnecter'),
          onTap: () async {
            final ok = await showDialog<bool>(
              context: context,
              builder: (c) => AlertDialog(
                title: const Text('Se déconnecter ?'),
                actions: [
                  TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Annuler')),
                  TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Se déconnecter')),
                ],
              ),
            );
            if (ok == true) await session.deconnecter();
          },
        ),
      const SizedBox(height: 24),
      Center(child: Text('STS Company · ${StsContact.raisonSociale} · version 1.0.0', style: Theme.of(context).textTheme.bodySmall)),
      const SizedBox(height: 24),
    ]);
  }

  static String _initiales(Session s) =>
      '${(s.user!['prenom'] as String).characters.firstOrNull ?? ''}${(s.user!['nom'] as String).characters.firstOrNull ?? ''}'.toUpperCase();
}

class ProfilScreen extends StatefulWidget {
  const ProfilScreen({super.key});
  @override
  State<ProfilScreen> createState() => _ProfilScreenState();
}

class _ProfilScreenState extends State<ProfilScreen> {
  final _form = GlobalKey<FormState>();
  late final Session _s = SessionScope.read(context);
  late final _prenom = TextEditingController(text: _s.user!['prenom'] as String);
  late final _nom = TextEditingController(text: _s.user!['nom'] as String);
  late final _tel = TextEditingController(text: _s.user!['telephone'] as String? ?? '');
  bool _enCours = false;

  Future<void> _enregistrer() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _enCours = true);
    try {
      final r = await _s.api.put('me', {'prenom': _prenom.text.trim(), 'nom': _nom.text.trim(), 'telephone': _tel.text.trim()});
      _s.majUtilisateur(Map<String, dynamic>.from(r['user']));
      if (mounted) {
        afficherMessage(context, 'Profil enregistré.');
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) afficherMessage(context, messageErreur(e), erreur: true);
    } finally {
      if (mounted) setState(() => _enCours = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Mon profil')),
        body: Form(
          key: _form,
          child: ListView(padding: const EdgeInsets.all(24), children: [
            TextFormField(controller: _prenom, validator: validerRequis, decoration: const InputDecoration(labelText: 'Prénom')),
            const SizedBox(height: 16),
            TextFormField(controller: _nom, validator: validerRequis, decoration: const InputDecoration(labelText: 'Nom')),
            const SizedBox(height: 16),
            TextFormField(controller: _tel, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Téléphone')),
            const SizedBox(height: 24),
            FilledButton(onPressed: _enCours ? null : _enregistrer, child: const Text('Enregistrer')),
          ]),
        ),
      );
}

class MesInscriptionsScreen extends StatelessWidget {
  const MesInscriptionsScreen({super.key});
  static const _libelles = {
    'en_attente': ('En attente de confirmation', Icons.hourglass_top),
    'confirmee': ('Confirmée', Icons.check_circle),
    'refusee': ('Refusée', Icons.cancel),
    'annulee': ('Annulée', Icons.block),
  };

  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Scaffold(
      appBar: AppBar(title: const Text('Mes inscriptions')),
      body: Chargement<List>(
        charger: () async => await api.get('me/inscriptions') as List,
        builder: (context, list, recharger) => list.isEmpty
            ? ListView(children: const [SizedBox(height: 80), EtatVide(icone: Icons.event_note, texte: 'Vous n’êtes inscrit(e) à aucune session.')])
            : ListView(padding: const EdgeInsets.all(12), children: [
                for (final i in list)
                  Card(
                    child: ListTile(
                      leading: Icon(_libelles[i['statut']]?.$2 ?? Icons.event),
                      title: Text(i['formation'] as String),
                      subtitle: Text('Du ${dateFr(i['date_debut'] as String?)} au ${dateFr(i['date_fin'] as String?)}\n'
                          '${_libelles[i['statut']]?.$1 ?? i['statut']}'),
                      isThreeLine: true,
                      trailing: ['en_attente', 'confirmee'].contains(i['statut'])
                          ? IconButton(
                              tooltip: 'Annuler l’inscription',
                              icon: const Icon(Icons.close),
                              onPressed: () async {
                                try {
                                  await api.delete('me/inscriptions/${i['id']}');
                                  await recharger();
                                } catch (e) {
                                  if (context.mounted) afficherMessage(context, messageErreur(e), erreur: true);
                                }
                              },
                            )
                          : null,
                    ),
                  ),
              ]),
      ),
    );
  }
}

class MesResultatsScreen extends StatelessWidget {
  const MesResultatsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Scaffold(
      appBar: AppBar(title: const Text('Mes résultats')),
      body: Chargement<List>(
        charger: () async => await api.get('me/tentatives') as List,
        builder: (context, list, _) => list.isEmpty
            ? ListView(children: const [SizedBox(height: 80), EtatVide(icone: Icons.bar_chart, texte: 'Vous n’avez encore passé aucun test.')])
            : ListView(children: [
                for (final a in list)
                  ListTile(
                    leading: const Icon(Icons.quiz_outlined),
                    title: Text(a['titre'] as String),
                    subtitle: Text(dateFr(a['cree_le'] as String?)),
                    trailing: Text('${a['score']}/${a['total']}', style: Theme.of(context).textTheme.titleMedium),
                  ),
              ]),
      ),
    );
  }
}

class RessourcesScreen extends StatelessWidget {
  const RessourcesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final api = SessionScope.of(context).api;
    return Scaffold(
      appBar: AppBar(title: const Text('Ressources')),
      body: Chargement<List>(
        charger: () async => await api.get('ressources') as List,
        builder: (context, list, _) => list.isEmpty
            ? ListView(children: const [SizedBox(height: 80), EtatVide(icone: Icons.folder_open, texte: 'Aucune ressource disponible.')])
            : ListView(children: [
                for (final r in list)
                  ListTile(
                    leading: Icon(r['type'] == 'video' ? Icons.play_circle_outline : r['type'] == 'pdf' ? Icons.picture_as_pdf_outlined : Icons.link),
                    title: Text(r['titre'] as String),
                    subtitle: r['description'] != null ? Text(r['description'] as String) : null,
                    onTap: () => ouvrirRessource(context, Map<String, dynamic>.from(r)),
                  ),
              ]),
      ),
    );
  }
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications'), actions: [
        TextButton(
          style: TextButton.styleFrom(foregroundColor: Theme.of(context).appBarTheme.foregroundColor),
          onPressed: () async {
            await session.api.post('notifications/tout-lire');
            await session.rafraichirNonLues();
          },
          child: const Text('Tout lire'),
        ),
      ]),
      body: Chargement<List>(
        key: ValueKey(session.nonLues),
        charger: () async => await session.api.get('notifications') as List,
        builder: (context, list, _) => list.isEmpty
            ? ListView(children: const [SizedBox(height: 80), EtatVide(icone: Icons.notifications_none, texte: 'Aucune notification.')])
            : ListView(children: [
                for (final n in list)
                  ListTile(
                    leading: Icon(n['lue'] == 1 ? Icons.notifications_none : Icons.notifications_active,
                        color: n['lue'] == 1 ? null : Theme.of(context).colorScheme.secondary),
                    title: Text(n['titre'] as String, style: n['lue'] == 1 ? null : const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Text('${n['contenu']}\n${dateFr(n['cree_le'] as String?)}'),
                    isThreeLine: true,
                    onTap: () async {
                      if (n['lue'] == 1) return;
                      await session.api.post('notifications/${n['id']}/lire');
                      await session.rafraichirNonLues();
                    },
                  ),
              ]),
      ),
    );
  }
}

class ContactScreen extends StatelessWidget {
  const ContactScreen({super.key});

  Future<void> _ouvrir(BuildContext context, String url, {bool externe = false}) async {
    final ok = await launchUrl(Uri.parse(url), mode: externe ? LaunchMode.externalApplication : LaunchMode.platformDefault);
    if (!ok && context.mounted) afficherMessage(context, 'Impossible d’ouvrir ce lien.', erreur: true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Contacter STS')),
        body: ListView(children: [
          const Padding(padding: EdgeInsets.fromLTRB(24, 24, 24, 4), child: Center(child: StsLogo(hauteur: 90))),
          Text(stsSlogan, textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
          const SizedBox(height: 12),
          ListTile(leading: const Icon(Icons.phone), title: const Text('Appeler'), subtitle: const Text(StsContact.telephoneAffiche),
              onTap: () => _ouvrir(context, 'tel:${StsContact.telephone}')),
          ListTile(leading: const Icon(Icons.chat), title: const Text('WhatsApp'), subtitle: const Text(StsContact.telephoneAffiche),
              onTap: () => _ouvrir(context, 'https://wa.me/${StsContact.telephone.replaceAll('+', '')}', externe: true)),
          ListTile(leading: const Icon(Icons.mail_outline), title: const Text('E-mail'), subtitle: const Text(StsContact.email),
              onTap: () => _ouvrir(context, 'mailto:${StsContact.email}')),
          ListTile(leading: const Icon(Icons.facebook), title: const Text('Facebook'), subtitle: const Text('STS Company'),
              onTap: () => _ouvrir(context, StsContact.facebook, externe: true)),
          ListTile(leading: const Icon(Icons.music_note), title: const Text('TikTok'), subtitle: const Text('@abdelhak_kedjar'),
              onTap: () => _ouvrir(context, StsContact.tiktok, externe: true)),
          if (StsContact.adresse != null)
            ListTile(leading: const Icon(Icons.place_outlined), title: const Text('Adresse'), subtitle: Text(StsContact.adresse!),
                onTap: () => _ouvrir(context, 'https://maps.google.com/?q=${Uri.encodeQueryComponent(StsContact.adresse!)}', externe: true)),
          const SizedBox(height: 24),
          Center(child: Text('STS Company · ${StsContact.raisonSociale}', style: Theme.of(context).textTheme.bodySmall)),
          const SizedBox(height: 24),
        ]),
      );
}
