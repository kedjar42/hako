import 'package:flutter_test/flutter_test.dart';
import 'package:sts_app/features/tools/calc.dart';

void main() {
  group('IPv4', () {
    test('réseau /24', () {
      final r = calculIpv4('192.168.1.130', '24');
      expect(r.reseau, '192.168.1.0');
      expect(r.diffusion, '192.168.1.255');
      expect(r.premier, '192.168.1.1');
      expect(r.dernier, '192.168.1.254');
      expect(r.hotes, 254);
      expect(r.masque, '255.255.255.0');
      expect(r.privee, isTrue);
      expect(r.classe, 'C');
    });
    test('masque écrit en clair et /26', () {
      final r = calculIpv4('10.0.0.70', '255.255.255.192');
      expect(r.prefixe, 26);
      expect(r.reseau, '10.0.0.64');
      expect(r.diffusion, '10.0.0.127');
      expect(r.hotes, 62);
      expect(r.masqueInverse, '0.0.0.63');
    });
    test('/31 et /32', () {
      expect(calculIpv4('1.2.3.4', '/31').hotes, 2);
      expect(calculIpv4('1.2.3.4', '32').premier, '1.2.3.4');
    });
    test('/0', () => expect(calculIpv4('8.8.8.8', '0').reseau, '0.0.0.0'));
    test('erreurs', () {
      expect(() => calculIpv4('256.1.1.1', '24'), throwsA(isA<CalcException>()));
      expect(() => calculIpv4('1.2.3', '24'), throwsA(isA<CalcException>()));
      expect(() => calculIpv4('1.2.3.4', '33'), throwsA(isA<CalcException>()));
      expect(() => calculIpv4('1.2.3.4', '255.0.255.0'), throwsA(isA<CalcException>()));
    });
    test('privée 172.16/12 uniquement', () {
      expect(calculIpv4('172.31.0.1', '16').privee, isTrue);
      expect(calculIpv4('172.32.0.1', '16').privee, isFalse);
    });
    test('préfixe pour N hôtes', () {
      expect(prefixePourHotes(50), 26);
      expect(prefixePourHotes(62), 26);
      expect(prefixePourHotes(63), 25);
      expect(prefixePourHotes(2), 30);
    });
  });

  group('Vidéosurveillance', () {
    test('stockage', () {
      // 8 caméras à 4 Mb/s, 24 h, 30 jours = 8*4e6/8*86400*30 = 10,368 To
      expect(stockageVideoTo(cameras: 8, debitMbps: 4, heuresParJour: 24, jours: 30), closeTo(10.368, 1e-9));
      expect(joursEnregistrement(cameras: 8, debitMbps: 4, heuresParJour: 24, capaciteTo: 10.368), closeTo(30, 1e-9));
    });
    test('objectif', () {
      expect(angleVisionDeg(focaleMm: 2.8), closeTo(81.2, 0.1));
      expect(largeurScene(focaleMm: 4.8, distanceM: 10), closeTo(10, 1e-9));
    });
    test('PoE', () {
      final r = budgetPoe(consommationsW: [6, 6, 6, 12.95], budgetSwitchW: 60, margePourcent: 0);
      expect(r.total, closeTo(30.95, 1e-9));
      expect(r.suffisant, isTrue);
      expect(budgetPoe(consommationsW: [30, 30], budgetSwitchW: 60).suffisant, isFalse);
    });
  });

  group('Électricité', () {
    test('loi d’Ohm, toutes les combinaisons', () {
      for (final r in [
        loiOhm(u: 12, i: 2), loiOhm(u: 12, r: 6), loiOhm(u: 12, p: 24),
        loiOhm(i: 2, r: 6), loiOhm(i: 2, p: 24), loiOhm(r: 6, p: 24),
      ]) {
        expect(r.tension, closeTo(12, 1e-9));
        expect(r.courant, closeTo(2, 1e-9));
        expect(r.resistance, closeTo(6, 1e-9));
        expect(r.puissance, closeTo(24, 1e-9));
      }
      expect(() => loiOhm(u: 12), throwsA(isA<CalcException>()));
      expect(() => loiOhm(u: 12, i: 1, r: 12), throwsA(isA<CalcException>()));
    });
    test('chute de tension', () {
      // 2 * 0,0175 * 50 * 2 / 1,5 = 2,333 V sur 12 V
      final r = chuteTension(courantA: 2, longueurM: 50, sectionMm2: 1.5, tensionV: 12);
      expect(r.volts, closeTo(2.3333, 1e-4));
      expect(r.pourcent, closeTo(19.44, 0.01));
      expect(sectionMinimale(courantA: 2, longueurM: 50, tensionV: 12, maxPourcent: 5), 6);
    });
    test('autonomie', () {
      // 7 Ah * 12 V * 0,85 * 0,8 / 10 W = 5,712 h
      expect(autonomieHeures(capaciteAh: 7, tensionV: 12, chargeW: 10), closeTo(5.712, 1e-9));
    });
  });

  group('Résistances', () {
    test('valeurs', () {
      expect(valeurResistance('Marron', 'Noir', 'Rouge'), 1000);
      expect(formatOhms(valeurResistance('Marron', 'Noir', 'Rouge')), '1 kΩ');
      expect(formatOhms(valeurResistance('Jaune', 'Violet', 'Orange')), '47 kΩ');
      expect(formatOhms(valeurResistance('Rouge', 'Rouge', 'Or')), '2.2 Ω');
      expect(formatOhms(4.7e6), '4.7 MΩ');
    });
  });

  group('Fibre', () {
    test('bilan optique', () {
      final r = bilanOptique(longueurKm: 10, attenuationDbKm: 0.35, connecteurs: 2, soudures: 4,
          coupleur: '1:32', puissanceEmissionDbm: 3, sensibiliteDbm: -28);
      expect(r.total, closeTo(3.5 + 1 + 0.4 + 17.1, 1e-9));
      expect(r.marge, closeTo(31 - 22, 1e-9));
      expect(r.ok, isTrue);
    });
    test('position de fibre', () {
      final p = positionFibre(14);
      expect(p.tube, 2);
      expect(p.couleurTube, 'Orange');
      expect(p.couleurFibre, 'Orange');
      expect(positionFibre(1).couleurFibre, 'Bleu');
      expect(positionFibre(12).couleurFibre, 'Turquoise');
    });
  });
}
