// Calculs de la boîte à outils STS. Fonctions pures, sans Flutter, testées dans test/calc_test.dart.
import 'dart:math' as math;

class CalcException implements Exception {
  final String message;
  CalcException(this.message);
  @override
  String toString() => message;
}

// ---------------------------------------------------------------- Réseau : IPv4

class Ipv4Result {
  final String reseau, diffusion, premier, dernier, masque, masqueInverse, classe;
  final int prefixe, hotes;
  final bool privee;
  Ipv4Result({
    required this.reseau, required this.diffusion, required this.premier, required this.dernier,
    required this.masque, required this.masqueInverse, required this.classe,
    required this.prefixe, required this.hotes, required this.privee,
  });
}

int parseIpv4(String s) {
  final parts = s.trim().split('.');
  if (parts.length != 4) throw CalcException('Adresse IP invalide : 4 nombres séparés par des points.');
  var v = 0;
  for (final p in parts) {
    final n = int.tryParse(p);
    if (n == null || n < 0 || n > 255 || p.isEmpty || (p.length > 1 && p.startsWith('0'))) {
      throw CalcException('Adresse IP invalide : chaque nombre doit être entre 0 et 255.');
    }
    v = (v << 8) | n;
  }
  return v;
}

String formatIpv4(int v) => [24, 16, 8, 0].map((s) => (v >> s) & 0xff).join('.');

/// Accepte un préfixe (« 24 », « /24 ») ou un masque (« 255.255.255.0 »).
int parsePrefixe(String s) {
  final t = s.trim().replaceFirst('/', '');
  final n = int.tryParse(t);
  if (n != null) {
    if (n < 0 || n > 32) throw CalcException('Le préfixe doit être entre 0 et 32.');
    return n;
  }
  final m = parseIpv4(t);
  final p = _popcount(m);
  if (_masque(p) != m) throw CalcException('Masque invalide : les bits à 1 doivent être contigus.');
  return p;
}

int _popcount(int v) { var c = 0; while (v != 0) { c += v & 1; v >>= 1; } return c; }
int _masque(int prefixe) => prefixe == 0 ? 0 : (0xffffffff << (32 - prefixe)) & 0xffffffff;

Ipv4Result calculIpv4(String ip, String prefixeOuMasque) {
  final a = parseIpv4(ip);
  final p = parsePrefixe(prefixeOuMasque);
  final m = _masque(p);
  final reseau = a & m;
  final diffusion = reseau | (~m & 0xffffffff);
  final int hotes;
  final int premier, dernier;
  if (p == 32) { hotes = 1; premier = reseau; dernier = reseau; }
  else if (p == 31) { hotes = 2; premier = reseau; dernier = diffusion; }
  else { hotes = (1 << (32 - p)) - 2; premier = reseau + 1; dernier = diffusion - 1; }
  final o1 = a >> 24;
  final classe = o1 < 128 ? 'A' : o1 < 192 ? 'B' : o1 < 224 ? 'C' : o1 < 240 ? 'D (multicast)' : 'E (réservée)';
  final o2 = (a >> 16) & 0xff;
  final privee = o1 == 10 || (o1 == 172 && o2 >= 16 && o2 <= 31) || (o1 == 192 && o2 == 168);
  return Ipv4Result(
    reseau: formatIpv4(reseau), diffusion: formatIpv4(diffusion), premier: formatIpv4(premier),
    dernier: formatIpv4(dernier), masque: formatIpv4(m), masqueInverse: formatIpv4(~m & 0xffffffff),
    classe: classe, prefixe: p, hotes: hotes, privee: privee,
  );
}

/// Plus petit préfixe pouvant contenir [hotes] machines.
int prefixePourHotes(int hotes) {
  if (hotes < 1) throw CalcException('Il faut au moins 1 hôte.');
  for (var p = 30; p >= 1; p--) {
    if ((1 << (32 - p)) - 2 >= hotes) return p;
  }
  throw CalcException('Trop d’hôtes pour un réseau IPv4.');
}

// ---------------------------------------------------------------- Vidéosurveillance

/// Espace disque en téraoctets (To, base 10) pour l'enregistrement.
double stockageVideoTo({required int cameras, required double debitMbps, required double heuresParJour, required int jours}) {
  if (cameras <= 0 || debitMbps <= 0 || heuresParJour <= 0 || heuresParJour > 24 || jours <= 0) {
    throw CalcException('Valeurs invalides : caméras, débit et jours > 0, heures entre 0 et 24.');
  }
  final octets = cameras * debitMbps * 1e6 / 8 * 3600 * heuresParJour * jours;
  return octets / 1e12;
}

/// Nombre de jours d'enregistrement possibles avec un disque de [capaciteTo].
double joursEnregistrement({required int cameras, required double debitMbps, required double heuresParJour, required double capaciteTo}) {
  final parJour = stockageVideoTo(cameras: cameras, debitMbps: debitMbps, heuresParJour: heuresParJour, jours: 1);
  return capaciteTo / parJour;
}

/// Champ de vision horizontal (degrés) pour une focale et un capteur donnés.
double angleVisionDeg({required double focaleMm, double largeurCapteurMm = 4.8}) {
  if (focaleMm <= 0) throw CalcException('La focale doit être > 0.');
  return 2 * math.atan(largeurCapteurMm / (2 * focaleMm)) * 180 / math.pi;
}

/// Largeur de scène couverte (m) à une distance donnée.
double largeurScene({required double focaleMm, required double distanceM, double largeurCapteurMm = 4.8}) {
  if (focaleMm <= 0 || distanceM <= 0) throw CalcException('Focale et distance doivent être > 0.');
  return distanceM * largeurCapteurMm / focaleMm;
}

class PoeResult {
  final double total, reste, utilisation;
  final bool suffisant;
  PoeResult(this.total, this.reste, this.utilisation) : suffisant = reste >= 0;
}

PoeResult budgetPoe({required List<double> consommationsW, required double budgetSwitchW, double margePourcent = 20}) {
  if (budgetSwitchW <= 0) throw CalcException('Le budget du switch doit être > 0.');
  if (consommationsW.any((w) => w < 0)) throw CalcException('Les consommations doivent être positives.');
  final total = consommationsW.fold<double>(0, (a, b) => a + b) * (1 + margePourcent / 100);
  return PoeResult(total, budgetSwitchW - total, total / budgetSwitchW * 100);
}

// ---------------------------------------------------------------- Électricité

class OhmResult {
  final double tension, courant, resistance, puissance;
  OhmResult(this.tension, this.courant, this.resistance, this.puissance);
}

/// Loi d'Ohm : donner exactement deux grandeurs parmi U (V), I (A), R (Ω), P (W).
OhmResult loiOhm({double? u, double? i, double? r, double? p}) {
  final connus = [u, i, r, p].where((x) => x != null).length;
  if (connus != 2) throw CalcException('Renseignez exactement deux valeurs.');
  if ([u, i, r, p].any((x) => x != null && x <= 0)) throw CalcException('Les valeurs doivent être > 0.');
  double U, I;
  if (u != null && i != null) { U = u; I = i; }
  else if (u != null && r != null) { U = u; I = u / r; }
  else if (u != null && p != null) { U = u; I = p / u; }
  else if (i != null && r != null) { I = i; U = i * r; }
  else if (i != null && p != null) { I = i; U = p / i; }
  else { U = math.sqrt(p! * r!); I = U / r; }
  return OhmResult(U, I, U / I, U * I);
}

class ChuteTensionResult {
  final double volts, pourcent, tensionArrivee;
  ChuteTensionResult(this.volts, this.pourcent, this.tensionArrivee);
}

/// Chute de tension en courant continu ou monophasé (aller + retour).
/// Résistivité : cuivre 0,0175 Ω·mm²/m, aluminium 0,028.
ChuteTensionResult chuteTension({
  required double courantA, required double longueurM, required double sectionMm2,
  required double tensionV, double resistivite = 0.0175,
}) {
  if (courantA <= 0 || longueurM <= 0 || sectionMm2 <= 0 || tensionV <= 0) {
    throw CalcException('Toutes les valeurs doivent être > 0.');
  }
  final du = 2 * resistivite * longueurM * courantA / sectionMm2;
  return ChuteTensionResult(du, du / tensionV * 100, tensionV - du);
}

/// Plus petite section normalisée donnant une chute ≤ [maxPourcent].
double sectionMinimale({
  required double courantA, required double longueurM, required double tensionV,
  double maxPourcent = 3, double resistivite = 0.0175,
}) {
  const sections = [0.5, 0.75, 1, 1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120];
  for (final s in sections) {
    final r = chuteTension(courantA: courantA, longueurM: longueurM, sectionMm2: s.toDouble(), tensionV: tensionV, resistivite: resistivite);
    if (r.pourcent <= maxPourcent) return s.toDouble();
  }
  throw CalcException('Aucune section jusqu’à 120 mm² ne suffit : réduisez la longueur ou augmentez la tension.');
}

/// Autonomie (heures) d'une batterie alimentant une charge.
double autonomieHeures({
  required double capaciteAh, required double tensionV, required double chargeW,
  double rendement = 0.85, double profondeurDecharge = 0.8,
}) {
  if (capaciteAh <= 0 || tensionV <= 0 || chargeW <= 0) throw CalcException('Toutes les valeurs doivent être > 0.');
  if (rendement <= 0 || rendement > 1 || profondeurDecharge <= 0 || profondeurDecharge > 1) {
    throw CalcException('Rendement et profondeur de décharge entre 0 et 1.');
  }
  return capaciteAh * tensionV * rendement * profondeurDecharge / chargeW;
}

// ---------------------------------------------------------------- Électronique : résistances

const couleursResistance = ['Noir', 'Marron', 'Rouge', 'Orange', 'Jaune', 'Vert', 'Bleu', 'Violet', 'Gris', 'Blanc'];
const multiplicateurs = <String, double>{
  'Noir': 1, 'Marron': 10, 'Rouge': 100, 'Orange': 1e3, 'Jaune': 1e4, 'Vert': 1e5, 'Bleu': 1e6,
  'Violet': 1e7, 'Or': 0.1, 'Argent': 0.01,
};
const tolerances = <String, double>{
  'Marron': 1, 'Rouge': 2, 'Vert': 0.5, 'Bleu': 0.25, 'Violet': 0.1, 'Gris': 0.05, 'Or': 5, 'Argent': 10,
};

/// Valeur (Ω) d'une résistance à 4 anneaux.
double valeurResistance(String a1, String a2, String mult) {
  final c1 = couleursResistance.indexOf(a1), c2 = couleursResistance.indexOf(a2);
  if (c1 < 0 || c2 < 0 || !multiplicateurs.containsKey(mult)) throw CalcException('Couleur inconnue.');
  return (c1 * 10 + c2) * multiplicateurs[mult]!;
}

String formatOhms(double v) {
  String f(double x) => x == x.roundToDouble() ? x.toStringAsFixed(0) : x.toStringAsFixed(2).replaceFirst(RegExp(r'0+$'), '');
  if (v >= 1e6) return '${f(v / 1e6)} MΩ';
  if (v >= 1e3) return '${f(v / 1e3)} kΩ';
  return '${f(v)} Ω';
}

// ---------------------------------------------------------------- Fibre optique

/// Pertes typiques des coupleurs (splitters) PLC, en dB.
const pertesCoupleur = <String, double>{
  'Aucun': 0, '1:2': 3.7, '1:4': 7.3, '1:8': 10.5, '1:16': 13.7, '1:32': 17.1, '1:64': 20.5,
};

class BilanOptiqueResult {
  final double perteFibre, perteConnecteurs, perteSoudures, perteCoupleur, total, marge;
  final bool ok;
  BilanOptiqueResult(this.perteFibre, this.perteConnecteurs, this.perteSoudures, this.perteCoupleur, this.total, this.marge)
      : ok = marge >= 3;
}

/// Bilan de liaison optique. La marge recommandée est d'au moins 3 dB.
BilanOptiqueResult bilanOptique({
  required double longueurKm, required double attenuationDbKm, required int connecteurs, required int soudures,
  String coupleur = 'Aucun', double perteConnecteurDb = 0.5, double perteSoudureDb = 0.1,
  required double puissanceEmissionDbm, required double sensibiliteDbm,
}) {
  if (longueurKm < 0 || attenuationDbKm < 0 || connecteurs < 0 || soudures < 0) {
    throw CalcException('Les valeurs ne peuvent pas être négatives.');
  }
  final pc = pertesCoupleur[coupleur] ?? (throw CalcException('Coupleur inconnu.'));
  final pf = longueurKm * attenuationDbKm;
  final pk = connecteurs * perteConnecteurDb;
  final ps = soudures * perteSoudureDb;
  final total = pf + pk + ps + pc;
  final budget = puissanceEmissionDbm - sensibiliteDbm;
  return BilanOptiqueResult(pf, pk, ps, pc, total, budget - total);
}

/// Code couleur des fibres (norme TIA-598), position 1 à 12.
const couleursFibre = ['Bleu', 'Orange', 'Vert', 'Marron', 'Gris', 'Blanc', 'Rouge', 'Noir', 'Jaune', 'Violet', 'Rose', 'Turquoise'];

/// Numéro de tube et couleur de fibre pour la fibre n° [numero] (1-based) dans un câble.
({int tube, String couleurTube, String couleurFibre}) positionFibre(int numero, {int fibresParTube = 12}) {
  if (numero < 1) throw CalcException('Le numéro de fibre commence à 1.');
  if (fibresParTube < 1 || fibresParTube > 12) throw CalcException('Entre 1 et 12 fibres par tube.');
  final tube = (numero - 1) ~/ fibresParTube + 1;
  final pos = (numero - 1) % fibresParTube;
  return (tube: tube, couleurTube: couleursFibre[(tube - 1) % 12], couleurFibre: couleursFibre[pos]);
}
