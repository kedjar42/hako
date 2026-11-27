import 'package:material_ui/material_ui.dart';
import 'calc.dart';

// ------------------------------------------------------------------ Définition générique d'un outil

class Champ {
  const Champ(this.cle, this.label, {this.unite, this.defaut = '', this.choix, this.texte = false, this.facultatif = false});
  final String cle, label, defaut;
  final String? unite;
  final List<String>? choix; // liste déroulante
  final bool texte; // saisie libre (sinon nombre)
  final bool facultatif;
}

typedef Ligne = (String label, String valeur);

class Outil {
  const Outil({required this.titre, required this.categorie, required this.icone, required this.description,
      required this.champs, required this.calculer, this.note});
  final String titre, categorie, description;
  final IconData icone;
  final List<Champ> champs;

  /// Reçoit les valeurs saisies (texte). Lève [CalcException] en cas d'erreur de saisie.
  final List<Ligne> Function(Map<String, String> v) calculer;
  final String? note;
}

String nb(num v, [int dec = 2]) {
  final s = v.toStringAsFixed(dec);
  final t = s.contains('.') ? s.replaceFirst(RegExp(r'\.?0+$'), '') : s;
  return t.replaceAll('.', ',');
}

double d(Map<String, String> v, String k, String label) {
  final x = double.tryParse(v[k]!.trim().replaceAll(',', '.').replaceAll(' ', ''));
  if (x == null) throw CalcException('« $label » doit être un nombre.');
  return x;
}

double? dOpt(Map<String, String> v, String k, String label) => v[k]!.trim().isEmpty ? null : d(v, k, label);
int e(Map<String, String> v, String k, String label) {
  final x = d(v, k, label);
  if (x != x.roundToDouble()) throw CalcException('« $label » doit être un nombre entier.');
  return x.round();
}

// ------------------------------------------------------------------ Catalogue des outils

final outils = <Outil>[
  // ----- Réseau
  Outil(
    titre: 'Calcul IP / sous-réseau', categorie: 'Réseau', icone: Icons.lan,
    description: 'Adresse réseau, diffusion, plage d’hôtes et masque.',
    champs: const [
      Champ('ip', 'Adresse IP', defaut: '192.168.1.10', texte: true),
      Champ('masque', 'Préfixe ou masque', defaut: '24', texte: true),
    ],
    calculer: (v) {
      final r = calculIpv4(v['ip']!, v['masque']!);
      return [
        ('Réseau', '${r.reseau}/${r.prefixe}'),
        ('Masque', r.masque),
        ('Masque inverse (wildcard)', r.masqueInverse),
        ('Première adresse', r.premier),
        ('Dernière adresse', r.dernier),
        ('Diffusion (broadcast)', r.diffusion),
        ('Hôtes utilisables', '${r.hotes}'),
        ('Classe', r.classe),
        ('Type', r.privee ? 'Adresse privée' : 'Adresse publique'),
      ];
    },
  ),
  Outil(
    titre: 'Taille de sous-réseau', categorie: 'Réseau', icone: Icons.account_tree_outlined,
    description: 'Préfixe nécessaire pour un nombre de machines.',
    champs: const [Champ('n', 'Nombre de machines', defaut: '50')],
    calculer: (v) {
      final p = prefixePourHotes(e(v, 'n', 'Nombre de machines'));
      final r = calculIpv4('0.0.0.0', '$p');
      return [('Préfixe', '/$p'), ('Masque', r.masque), ('Hôtes disponibles', '${r.hotes}')];
    },
  ),

  // ----- Vidéosurveillance
  Outil(
    titre: 'Stockage vidéo', categorie: 'Vidéosurveillance', icone: Icons.storage,
    description: 'Capacité disque nécessaire pour l’enregistreur (NVR/DVR).',
    champs: const [
      Champ('cam', 'Nombre de caméras', defaut: '8'),
      Champ('debit', 'Débit par caméra', unite: 'Mb/s', defaut: '4'),
      Champ('heures', 'Heures d’enregistrement par jour', unite: 'h', defaut: '24'),
      Champ('jours', 'Durée de conservation', unite: 'jours', defaut: '30'),
    ],
    note: 'Débits indicatifs en H.265 : 2 Mpx ≈ 2 Mb/s, 4 Mpx ≈ 4 Mb/s, 8 Mpx (4K) ≈ 8 Mb/s.',
    calculer: (v) {
      final cam = e(v, 'cam', 'Nombre de caméras');
      final debit = d(v, 'debit', 'Débit');
      final h = d(v, 'heures', 'Heures');
      final j = e(v, 'jours', 'Durée');
      final to = stockageVideoTo(cameras: cam, debitMbps: debit, heuresParJour: h, jours: j);
      return [
        ('Espace nécessaire', '${nb(to)} To'),
        ('Par jour', '${nb(to / j * 1000, 1)} Go'),
        ('Débit total réseau', '${nb(cam * debit, 1)} Mb/s'),
      ];
    },
  ),
  Outil(
    titre: 'Objectif de caméra', categorie: 'Vidéosurveillance', icone: Icons.camera_outlined,
    description: 'Angle de vision et largeur de scène selon la focale.',
    champs: const [
      Champ('f', 'Focale', unite: 'mm', defaut: '2.8'),
      Champ('dist', 'Distance de la scène', unite: 'm', defaut: '10'),
      Champ('capteur', 'Capteur', choix: ['1/3" (4,8 mm)', '1/2,7" (5,4 mm)', '1/2,8" (5,1 mm)', '1/1,8" (7,2 mm)'], defaut: '1/2,7" (5,4 mm)'),
    ],
    calculer: (v) {
      const largeurs = {'1/3" (4,8 mm)': 4.8, '1/2,7" (5,4 mm)': 5.4, '1/2,8" (5,1 mm)': 5.1, '1/1,8" (7,2 mm)': 7.2};
      final w = largeurs[v['capteur']]!;
      final f = d(v, 'f', 'Focale');
      final l = largeurScene(focaleMm: f, distanceM: d(v, 'dist', 'Distance'), largeurCapteurMm: w);
      return [('Angle horizontal', '${nb(angleVisionDeg(focaleMm: f, largeurCapteurMm: w), 1)}°'), ('Largeur couverte', '${nb(l, 1)} m')];
    },
  ),
  Outil(
    titre: 'Budget PoE', categorie: 'Vidéosurveillance', icone: Icons.power_outlined,
    description: 'Le switch PoE peut-il alimenter toutes les caméras ?',
    champs: const [
      Champ('n', 'Nombre de caméras', defaut: '8'),
      Champ('w', 'Consommation par caméra', unite: 'W', defaut: '6.5'),
      Champ('autres', 'Autres équipements PoE (total)', unite: 'W', defaut: '0'),
      Champ('budget', 'Budget PoE du switch', unite: 'W', defaut: '120'),
      Champ('marge', 'Marge de sécurité', unite: '%', defaut: '20'),
    ],
    calculer: (v) {
      final n = e(v, 'n', 'Nombre de caméras');
      final r = budgetPoe(
        consommationsW: [...List.filled(n, d(v, 'w', 'Consommation')), d(v, 'autres', 'Autres équipements')],
        budgetSwitchW: d(v, 'budget', 'Budget'),
        margePourcent: d(v, 'marge', 'Marge'),
      );
      return [
        ('Puissance nécessaire (avec marge)', '${nb(r.total, 1)} W'),
        ('Utilisation du switch', '${nb(r.utilisation, 0)} %'),
        (r.suffisant ? 'Puissance restante' : 'Manque', '${nb(r.reste.abs(), 1)} W'),
        ('Verdict', r.suffisant ? '✅ Budget suffisant' : '❌ Budget insuffisant'),
      ];
    },
  ),

  // ----- Électricité
  Outil(
    titre: 'Loi d’Ohm', categorie: 'Électricité', icone: Icons.functions,
    description: 'Renseignez deux valeurs, l’outil calcule les deux autres.',
    champs: const [
      Champ('u', 'Tension U', unite: 'V', facultatif: true),
      Champ('i', 'Courant I', unite: 'A', facultatif: true),
      Champ('r', 'Résistance R', unite: 'Ω', facultatif: true),
      Champ('p', 'Puissance P', unite: 'W', facultatif: true),
    ],
    calculer: (v) {
      final r = loiOhm(u: dOpt(v, 'u', 'Tension'), i: dOpt(v, 'i', 'Courant'), r: dOpt(v, 'r', 'Résistance'), p: dOpt(v, 'p', 'Puissance'));
      return [
        ('Tension', '${nb(r.tension, 3)} V'), ('Courant', '${nb(r.courant, 3)} A'),
        ('Résistance', '${nb(r.resistance, 3)} Ω'), ('Puissance', '${nb(r.puissance, 3)} W'),
      ];
    },
  ),
  Outil(
    titre: 'Chute de tension', categorie: 'Électricité', icone: Icons.trending_down,
    description: 'Courant continu ou monophasé, aller et retour.',
    champs: const [
      Champ('u', 'Tension de départ', unite: 'V', defaut: '12'),
      Champ('i', 'Courant', unite: 'A', defaut: '2'),
      Champ('l', 'Longueur du câble', unite: 'm', defaut: '50'),
      Champ('s', 'Section', unite: 'mm²', defaut: '1.5'),
      Champ('metal', 'Conducteur', choix: ['Cuivre', 'Aluminium'], defaut: 'Cuivre'),
    ],
    note: 'Pour les caméras en 12 V, visez une chute inférieure à 5 %.',
    calculer: (v) {
      final rho = v['metal'] == 'Aluminium' ? 0.028 : 0.0175;
      final u = d(v, 'u', 'Tension'), i = d(v, 'i', 'Courant'), l = d(v, 'l', 'Longueur');
      final r = chuteTension(courantA: i, longueurM: l, sectionMm2: d(v, 's', 'Section'), tensionV: u, resistivite: rho);
      String conseil;
      try {
        conseil = '${nb(sectionMinimale(courantA: i, longueurM: l, tensionV: u, maxPourcent: 5, resistivite: rho))} mm²';
      } on CalcException catch (ex) {
        conseil = ex.message;
      }
      return [
        ('Chute de tension', '${nb(r.volts)} V (${nb(r.pourcent, 1)} %)'),
        ('Tension à l’arrivée', '${nb(r.tensionArrivee)} V'),
        ('Section minimale pour ≤ 5 %', conseil),
      ];
    },
  ),
  Outil(
    titre: 'Autonomie batterie', categorie: 'Électricité', icone: Icons.battery_charging_full,
    description: 'Durée de fonctionnement sur batterie ou onduleur.',
    champs: const [
      Champ('ah', 'Capacité de la batterie', unite: 'Ah', defaut: '7'),
      Champ('v', 'Tension de la batterie', unite: 'V', defaut: '12'),
      Champ('w', 'Consommation de la charge', unite: 'W', defaut: '10'),
      Champ('rend', 'Rendement', unite: '%', defaut: '85'),
      Champ('dod', 'Profondeur de décharge', unite: '%', defaut: '80'),
    ],
    calculer: (v) {
      final h = autonomieHeures(
        capaciteAh: d(v, 'ah', 'Capacité'), tensionV: d(v, 'v', 'Tension'), chargeW: d(v, 'w', 'Consommation'),
        rendement: d(v, 'rend', 'Rendement') / 100, profondeurDecharge: d(v, 'dod', 'Profondeur de décharge') / 100,
      );
      return [('Autonomie', '${h.floor()} h ${((h - h.floor()) * 60).round().toString().padLeft(2, '0')} min')];
    },
  ),

  // ----- Électronique
  Outil(
    titre: 'Code couleur des résistances', categorie: 'Électronique', icone: Icons.palette_outlined,
    description: 'Valeur d’une résistance à 4 anneaux.',
    champs: [
      const Champ('a1', '1er anneau', choix: couleursResistance, defaut: 'Marron'),
      const Champ('a2', '2e anneau', choix: couleursResistance, defaut: 'Noir'),
      Champ('m', 'Multiplicateur', choix: multiplicateurs.keys.toList(), defaut: 'Rouge'),
      Champ('t', 'Tolérance', choix: tolerances.keys.toList(), defaut: 'Or'),
    ],
    calculer: (v) {
      final val = valeurResistance(v['a1']!, v['a2']!, v['m']!);
      final tol = tolerances[v['t']]!;
      return [
        ('Valeur', formatOhms(val)),
        ('Tolérance', '± ${nb(tol)} %'),
        ('Plage', '${formatOhms(val * (1 - tol / 100))} à ${formatOhms(val * (1 + tol / 100))}'),
      ];
    },
  ),

  // ----- Fibre optique
  Outil(
    titre: 'Bilan optique', categorie: 'Fibre optique', icone: Icons.cable,
    description: 'Pertes totales de la liaison et marge disponible.',
    champs: [
      const Champ('l', 'Longueur', unite: 'km', defaut: '10'),
      const Champ('lambda', 'Longueur d’onde', choix: ['1310 nm (0,35 dB/km)', '1490 nm (0,25 dB/km)', '1550 nm (0,22 dB/km)'],
          defaut: '1310 nm (0,35 dB/km)'),
      const Champ('c', 'Connecteurs', defaut: '2'),
      const Champ('s', 'Soudures', defaut: '4'),
      Champ('cp', 'Coupleur', choix: pertesCoupleur.keys.toList(), defaut: '1:32'),
      const Champ('tx', 'Puissance d’émission', unite: 'dBm', defaut: '3'),
      const Champ('rx', 'Sensibilité du récepteur', unite: 'dBm', defaut: '-28'),
    ],
    note: 'Hypothèses : 0,5 dB par connecteur, 0,1 dB par soudure. Marge recommandée ≥ 3 dB.',
    calculer: (v) {
      const att = {'1310 nm (0,35 dB/km)': 0.35, '1490 nm (0,25 dB/km)': 0.25, '1550 nm (0,22 dB/km)': 0.22};
      final r = bilanOptique(
        longueurKm: d(v, 'l', 'Longueur'), attenuationDbKm: att[v['lambda']]!,
        connecteurs: e(v, 'c', 'Connecteurs'), soudures: e(v, 's', 'Soudures'), coupleur: v['cp']!,
        puissanceEmissionDbm: d(v, 'tx', 'Puissance d’émission'), sensibiliteDbm: d(v, 'rx', 'Sensibilité'),
      );
      final tx = d(v, 'tx', 'Puissance d’émission');
      return [
        ('Perte fibre', '${nb(r.perteFibre)} dB'),
        ('Connecteurs + soudures', '${nb(r.perteConnecteurs + r.perteSoudures)} dB'),
        ('Coupleur', '${nb(r.perteCoupleur)} dB'),
        ('Perte totale', '${nb(r.total)} dB'),
        ('Puissance reçue estimée', '${nb(tx - r.total)} dBm'),
        ('Marge', '${nb(r.marge)} dB ${r.ok ? '✅' : '⚠️ insuffisante'}'),
      ];
    },
  ),
  Outil(
    titre: 'Code couleur des fibres', categorie: 'Fibre optique', icone: Icons.format_color_fill,
    description: 'Tube et couleur d’une fibre à partir de son numéro.',
    champs: const [
      Champ('n', 'Numéro de la fibre', defaut: '14'),
      Champ('pt', 'Fibres par tube', choix: ['12', '6', '4', '2'], defaut: '12'),
    ],
    calculer: (v) {
      final p = positionFibre(e(v, 'n', 'Numéro'), fibresParTube: int.parse(v['pt']!));
      return [('Tube', 'n° ${p.tube} (${p.couleurTube})'), ('Couleur de la fibre', p.couleurFibre)];
    },
  ),
];

// ------------------------------------------------------------------ Écrans

class OutilsScreen extends StatefulWidget {
  const OutilsScreen({super.key});
  @override
  State<OutilsScreen> createState() => _OutilsScreenState();
}

class _OutilsScreenState extends State<OutilsScreen> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final q = _q.toLowerCase();
    final liste = outils.where((o) => q.isEmpty || '${o.titre} ${o.categorie} ${o.description}'.toLowerCase().contains(q)).toList();
    final categories = <String, List<Outil>>{};
    for (final o in liste) {
      categories.putIfAbsent(o.categorie, () => []).add(o);
    }
    return ListView(padding: const EdgeInsets.all(16), children: [
      TextField(
        decoration: const InputDecoration(hintText: 'Rechercher un outil', prefixIcon: Icon(Icons.search), isDense: true),
        onChanged: (v) => setState(() => _q = v.trim()),
      ),
      if (liste.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Aucun outil ne correspond.'))),
      for (final c in categories.entries) ...[
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
          child: Text(c.key, style: Theme.of(context).textTheme.titleMedium),
        ),
        for (final o in c.value)
          Card(
            child: ListTile(
              leading: CircleAvatar(child: Icon(o.icone)),
              title: Text(o.titre),
              subtitle: Text(o.description),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => OutilScreen(outil: o))),
            ),
          ),
      ],
    ]);
  }
}

class OutilScreen extends StatefulWidget {
  const OutilScreen({super.key, required this.outil});
  final Outil outil;
  @override
  State<OutilScreen> createState() => _OutilScreenState();
}

class _OutilScreenState extends State<OutilScreen> {
  late final _ctrl = {for (final c in widget.outil.champs.where((c) => c.choix == null)) c.cle: TextEditingController(text: c.defaut)};
  late final _choix = {for (final c in widget.outil.champs.where((c) => c.choix != null)) c.cle: c.defaut};
  List<Ligne>? _resultat;
  String? _erreur;

  @override
  void initState() {
    super.initState();
    _calculer();
  }

  @override
  void dispose() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    super.dispose();
  }

  void _calculer() {
    final v = {for (final e in _ctrl.entries) e.key: e.value.text, ..._choix};
    final manquant = widget.outil.champs.where((c) => !c.facultatif && c.choix == null && v[c.cle]!.trim().isEmpty);
    setState(() {
      if (manquant.isNotEmpty) {
        _resultat = null;
        _erreur = 'Renseignez « ${manquant.first.label} ».';
        return;
      }
      try {
        _resultat = widget.outil.calculer(v);
        _erreur = null;
      } on CalcException catch (ex) {
        _resultat = null;
        _erreur = ex.message;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.outil;
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(o.titre)),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Text(o.description, style: t.textTheme.bodyMedium),
        const SizedBox(height: 16),
        for (final c in o.champs)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: c.choix != null
                ? DropdownButtonFormField<String>(
                    initialValue: _choix[c.cle],
                    decoration: InputDecoration(labelText: c.label),
                    items: [for (final x in c.choix!) DropdownMenuItem(value: x, child: Text(x))],
                    onChanged: (x) { _choix[c.cle] = x!; _calculer(); },
                  )
                : TextField(
                    controller: _ctrl[c.cle],
                    keyboardType: c.texte ? TextInputType.text : const TextInputType.numberWithOptions(decimal: true, signed: true),
                    decoration: InputDecoration(labelText: c.label, suffixText: c.unite, hintText: c.facultatif ? 'Facultatif' : null),
                    onChanged: (_) => _calculer(),
                  ),
          ),
        const SizedBox(height: 8),
        if (_erreur != null)
          Card(
            color: t.colorScheme.errorContainer,
            child: ListTile(leading: const Icon(Icons.info_outline), title: Text(_erreur!)),
          ),
        if (_resultat != null)
          Card(
            color: t.colorScheme.primaryContainer,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Column(children: [
                for (final (label, valeur) in _resultat!)
                  ListTile(
                    dense: true,
                    title: Text(label),
                    trailing: Text(valeur, style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  ),
              ]),
            ),
          ),
        if (o.note != null) Padding(padding: const EdgeInsets.all(8), child: Text(o.note!, style: t.textTheme.bodySmall)),
      ]),
    );
  }
}
