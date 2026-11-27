import 'package:material_ui/material_ui.dart';

/// Couleurs de la marque STS. Remplacez-les par celles de votre charte graphique.
class StsColors {
  static const marine = Color(0xFF0B2545); // fond du logo, barre du haut
  static const marineClair = Color(0xFF13335E);
  static const cyan = Color(0xFF00C2E8);
  static const bleu = Color(0xFF0077B6); // « COMPANY »
  static const orange = Color(0xFFF5A524);
}

ThemeData stsTheme(Brightness b) {
  final scheme = ColorScheme.fromSeed(
    seedColor: StsColors.bleu,
    primary: b == Brightness.light ? StsColors.bleu : StsColors.cyan,
    secondary: StsColors.orange,
    tertiary: StsColors.cyan,
    brightness: b,
  );
  return ThemeData(
    fontFamily: 'StsRoboto',
    colorScheme: scheme,
    useMaterial3: true,
    appBarTheme: AppBarTheme(
      backgroundColor: StsColors.marine,
      foregroundColor: Colors.white,
      centerTitle: false,
    ),
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
    cardTheme: const CardThemeData(clipBehavior: Clip.antiAlias),
  );
}
