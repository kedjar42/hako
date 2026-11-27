import 'package:material_ui/material_ui.dart';
import 'app/theme.dart';
import 'app/widgets.dart';
import 'core/api.dart';
import 'core/session.dart';
import 'features/catalog/catalog_screens.dart';
import 'features/home/home_screen.dart';
import 'features/me/me_screens.dart';
import 'features/tests/tests_screens.dart';
import 'features/tools/tools_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = Session(Api());
  await session.restaurer();
  runApp(StsApp(session: session));
}

class StsApp extends StatelessWidget {
  const StsApp({super.key, required this.session});
  final Session session;

  @override
  Widget build(BuildContext context) => SessionScope(
        session: session,
        child: MaterialApp(
          title: 'STS',
          debugShowCheckedModeBanner: false,
          theme: stsTheme(Brightness.light),
          darkTheme: stsTheme(Brightness.dark),
          locale: const Locale('fr'),
          supportedLocales: const [Locale('fr')],
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          home: const Coquille(),
        ),
      );
}

/// Écran principal avec la barre de navigation du bas.
class Coquille extends StatefulWidget {
  const Coquille({super.key});
  @override
  State<Coquille> createState() => _CoquilleState();
}

class _CoquilleState extends State<Coquille> {
  int _onglet = 0;
  static const _titres = ['Accueil', 'Formations', 'Boîte à outils', 'Tests', 'Mon compte'];

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final pages = [
      AccueilScreen(allerA: (i) => setState(() => _onglet = i)),
      const FormationsScreen(),
      const OutilsScreen(),
      const TestsScreen(),
      const CompteScreen(),
    ];
    return Scaffold(
      appBar: AppBar(
        title: _onglet == 0 ? const StsLogo(taille: 30, clair: true) : Text(_titres[_onglet]),
        actions: [
          if (session.connecte)
            IconButton(
              tooltip: 'Notifications',
              icon: Badge(
                isLabelVisible: session.nonLues > 0,
                label: Text('${session.nonLues}'),
                child: const Icon(Icons.notifications_outlined),
              ),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
            ),
        ],
      ),
      body: IndexedStack(index: _onglet, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _onglet,
        onDestinationSelected: (i) {
          setState(() => _onglet = i);
          session.rafraichirNonLues();
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Accueil'),
          NavigationDestination(icon: Icon(Icons.school_outlined), selectedIcon: Icon(Icons.school), label: 'Formations'),
          NavigationDestination(icon: Icon(Icons.handyman_outlined), selectedIcon: Icon(Icons.handyman), label: 'Outils'),
          NavigationDestination(icon: Icon(Icons.quiz_outlined), selectedIcon: Icon(Icons.quiz), label: 'Tests'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Compte'),
        ],
      ),
    );
  }
}
