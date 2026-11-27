import 'package:material_ui/material_ui.dart';

/// Couleurs de la marque STS. Remplacez-les par celles de votre charte graphique.
class StsColors {
  static const bleu = Color(0xFF0B3D91);
  static const orange = Color(0xFFF28C28);
}

ThemeData stsTheme(Brightness b) {
  final scheme = ColorScheme.fromSeed(
    seedColor: StsColors.bleu,
    secondary: StsColors.orange,
    brightness: b,
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    appBarTheme: AppBarTheme(
      backgroundColor: b == Brightness.light ? StsColors.bleu : scheme.surface,
      foregroundColor: b == Brightness.light ? Colors.white : scheme.onSurface,
      centerTitle: false,
    ),
    inputDecorationTheme: const InputDecorationTheme(border: OutlineInputBorder()),
    cardTheme: const CardThemeData(clipBehavior: Clip.antiAlias),
  );
}
