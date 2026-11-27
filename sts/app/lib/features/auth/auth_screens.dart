import 'package:material_ui/material_ui.dart';
import '../../app/widgets.dart';
import '../../core/session.dart';

/// Ouvre l'écran de connexion. Renvoie true si l'utilisateur s'est connecté.
Future<bool> demanderConnexion(BuildContext context) async =>
    await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const ConnexionScreen())) ?? false;

String? validerEmail(String? v) =>
    v == null || !RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(v.trim()) ? 'Adresse e-mail invalide' : null;
String? validerMdp(String? v) => v == null || v.length < 8 ? 'Au moins 8 caractères' : null;
String? validerRequis(String? v) => v == null || v.trim().isEmpty ? 'Champ obligatoire' : null;

class _Formulaire extends StatelessWidget {
  const _Formulaire({required this.titre, required this.formKey, required this.children});
  final String titre;
  final GlobalKey<FormState> formKey;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(titre)),
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: Form(
                key: formKey,
                child: ListView(
                  padding: const EdgeInsets.all(24),
                  children: [for (final c in children) Padding(padding: const EdgeInsets.only(bottom: 16), child: c)],
                ),
              ),
            ),
          ),
        ),
      );
}

class _Bouton extends StatelessWidget {
  const _Bouton({required this.texte, required this.enCours, required this.onPressed});
  final String texte;
  final bool enCours;
  final VoidCallback onPressed;
  @override
  Widget build(BuildContext context) => FilledButton(
        onPressed: enCours ? null : onPressed,
        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        child: enCours
            ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
            : Text(texte),
      );
}

// ------------------------------------------------------------------ Connexion

class ConnexionScreen extends StatefulWidget {
  const ConnexionScreen({super.key});
  @override
  State<ConnexionScreen> createState() => _ConnexionScreenState();
}

class _ConnexionScreenState extends State<ConnexionScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _mdp = TextEditingController();
  bool _enCours = false, _masque = true;

  Future<void> _valider() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _enCours = true);
    final session = SessionScope.read(context);
    try {
      await session.connecter(_email.text.trim(), _mdp.text);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      final msg = messageErreur(e);
      afficherMessage(context, msg, erreur: true);
      if (msg.contains('pas encore vérifié')) {
        await session.api.post('auth/resend', {'email': _email.text.trim()}).catchError((_) => null);
        if (!mounted) return;
        final ok = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => VerificationScreen(email: _email.text.trim())));
        if (ok == true && mounted) Navigator.of(context).pop(true);
      }
    } finally {
      if (mounted) setState(() => _enCours = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Formulaire(titre: 'Connexion', formKey: _form, children: [
        const Center(child: StsLogo(hauteur: 110)),
        Text(stsSlogan, textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontStyle: FontStyle.italic)),
        TextFormField(
          controller: _email, validator: validerEmail, keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          decoration: const InputDecoration(labelText: 'E-mail', prefixIcon: Icon(Icons.mail_outline)),
        ),
        TextFormField(
          controller: _mdp, obscureText: _masque, validator: validerRequis,
          autofillHints: const [AutofillHints.password],
          onFieldSubmitted: (_) => _valider(),
          decoration: InputDecoration(
            labelText: 'Mot de passe', prefixIcon: const Icon(Icons.lock_outline),
            suffixIcon: IconButton(
              tooltip: _masque ? 'Afficher' : 'Masquer',
              icon: Icon(_masque ? Icons.visibility : Icons.visibility_off),
              onPressed: () => setState(() => _masque = !_masque),
            ),
          ),
        ),
        _Bouton(texte: 'Se connecter', enCours: _enCours, onPressed: _valider),
        TextButton(
          onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const MotDePasseOublieScreen())),
          child: const Text('Mot de passe oublié ?'),
        ),
        OutlinedButton(
          onPressed: () async {
            final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const InscriptionScreen()));
            if (ok == true && context.mounted) Navigator.of(context).pop(true);
          },
          child: const Text('Créer un compte'),
        ),
      ]);

}

// ------------------------------------------------------------------ Inscription

class InscriptionScreen extends StatefulWidget {
  const InscriptionScreen({super.key});
  @override
  State<InscriptionScreen> createState() => _InscriptionScreenState();
}

class _InscriptionScreenState extends State<InscriptionScreen> {
  final _form = GlobalKey<FormState>();
  final _prenom = TextEditingController(), _nom = TextEditingController(), _email = TextEditingController();
  final _tel = TextEditingController(), _mdp = TextEditingController();
  bool _enCours = false;

  Future<void> _valider() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _enCours = true);
    try {
      await SessionScope.read(context).api.post('auth/register', {
        'prenom': _prenom.text.trim(), 'nom': _nom.text.trim(), 'email': _email.text.trim(),
        'telephone': _tel.text.trim(), 'mot_de_passe': _mdp.text,
      });
      if (!mounted) return;
      final ok = await Navigator.of(context).push<bool>(
          MaterialPageRoute(builder: (_) => VerificationScreen(email: _email.text.trim())));
      if (ok == true && mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) afficherMessage(context, messageErreur(e), erreur: true);
    } finally {
      if (mounted) setState(() => _enCours = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Formulaire(titre: 'Créer un compte', formKey: _form, children: [
        TextFormField(controller: _prenom, validator: validerRequis, textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Prénom')),
        TextFormField(controller: _nom, validator: validerRequis, textCapitalization: TextCapitalization.words,
            decoration: const InputDecoration(labelText: 'Nom')),
        TextFormField(controller: _email, validator: validerEmail, keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'E-mail')),
        TextFormField(controller: _tel, keyboardType: TextInputType.phone,
            decoration: const InputDecoration(labelText: 'Téléphone (facultatif)')),
        TextFormField(controller: _mdp, validator: validerMdp, obscureText: true,
            decoration: const InputDecoration(labelText: 'Mot de passe', helperText: 'Au moins 8 caractères')),
        _Bouton(texte: 'Créer mon compte', enCours: _enCours, onPressed: _valider),
      ]);

}

// ------------------------------------------------------------------ Vérification

class VerificationScreen extends StatefulWidget {
  const VerificationScreen({super.key, required this.email});
  final String email;
  @override
  State<VerificationScreen> createState() => _VerificationScreenState();
}

class _VerificationScreenState extends State<VerificationScreen> {
  final _form = GlobalKey<FormState>();
  final _code = TextEditingController();
  bool _enCours = false;

  Future<void> _valider() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _enCours = true);
    final session = SessionScope.read(context);
    try {
      await session.ouvrir(Map<String, dynamic>.from(
          await session.api.post('auth/verify', {'email': widget.email, 'code': _code.text.trim()})));
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) afficherMessage(context, messageErreur(e), erreur: true);
    } finally {
      if (mounted) setState(() => _enCours = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Formulaire(titre: 'Vérification', formKey: _form, children: [
        Text('Saisissez le code à 6 chiffres envoyé à ${widget.email}.'),
        TextFormField(
          controller: _code, keyboardType: TextInputType.number, maxLength: 6,
          validator: (v) => v != null && RegExp(r'^\d{6}$').hasMatch(v.trim()) ? null : 'Code à 6 chiffres',
          decoration: const InputDecoration(labelText: 'Code'),
        ),
        _Bouton(texte: 'Valider', enCours: _enCours, onPressed: _valider),
        TextButton(
          onPressed: () async {
            final api = SessionScope.read(context).api;
            try {
              final r = await api.post('auth/resend', {'email': widget.email});
              if (context.mounted) afficherMessage(context, r['message'] as String);
            } catch (e) {
              if (context.mounted) afficherMessage(context, messageErreur(e), erreur: true);
            }
          },
          child: const Text('Renvoyer le code'),
        ),
      ]);
}

// ------------------------------------------------------------------ Mot de passe oublié

class MotDePasseOublieScreen extends StatefulWidget {
  const MotDePasseOublieScreen({super.key});
  @override
  State<MotDePasseOublieScreen> createState() => _MotDePasseOublieScreenState();
}

class _MotDePasseOublieScreenState extends State<MotDePasseOublieScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController(), _code = TextEditingController(), _mdp = TextEditingController();
  bool _codeEnvoye = false, _enCours = false;

  Future<void> _valider() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _enCours = true);
    final api = SessionScope.read(context).api;
    try {
      if (!_codeEnvoye) {
        final r = await api.post('auth/forgot', {'email': _email.text.trim()});
        if (!mounted) return;
        afficherMessage(context, r['message'] as String);
        setState(() => _codeEnvoye = true);
      } else {
        final r = await api.post('auth/reset',
            {'email': _email.text.trim(), 'code': _code.text.trim(), 'mot_de_passe': _mdp.text});
        if (!mounted) return;
        afficherMessage(context, r['message'] as String);
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) afficherMessage(context, messageErreur(e), erreur: true);
    } finally {
      if (mounted) setState(() => _enCours = false);
    }
  }

  @override
  Widget build(BuildContext context) => _Formulaire(titre: 'Mot de passe oublié', formKey: _form, children: [
        TextFormField(controller: _email, validator: validerEmail, enabled: !_codeEnvoye,
            keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'E-mail')),
        if (_codeEnvoye) ...[
          TextFormField(controller: _code, keyboardType: TextInputType.number, maxLength: 6, validator: validerRequis,
              decoration: const InputDecoration(labelText: 'Code reçu')),
          TextFormField(controller: _mdp, obscureText: true, validator: validerMdp,
              decoration: const InputDecoration(labelText: 'Nouveau mot de passe')),
        ],
        _Bouton(texte: _codeEnvoye ? 'Changer le mot de passe' : 'Recevoir un code', enCours: _enCours, onPressed: _valider),
      ]);

}
