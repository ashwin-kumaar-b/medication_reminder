import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'providers/medicine_provider.dart';
import 'services/notification_service.dart';
import 'screens/auth_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/caretaker_portal_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize notification engine
  final notificationService = NotificationService();
  await notificationService.init();
  await notificationService.requestPermissions();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => MedicineProvider()),
      ],
      child: const MediGuardApp(),
    ),
  );
}

class MediGuardApp extends StatelessWidget {
  const MediGuardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (context, auth, _) {
        Widget homeScreen;

        if (auth.currentUser == null) {
          homeScreen = const AuthScreen();
        } else if (auth.currentUser!.role == 'caretaker') {
          homeScreen = const CaretakerPortalScreen();
        } else {
          homeScreen = const DashboardScreen();
        }

        return MaterialApp(
          title: 'MediGuard AI Smart Care',
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            useMaterial3: true,
            colorScheme: ColorScheme.fromSeed(
              seedColor: const Color(0xFF1E3A8A), // Slate blue theme
              primary: const Color(0xFF1E3A8A),
              secondary: const Color(0xFF0D9488), // Teal secondary accent
              brightness: Brightness.light,
            ),
            textTheme: const TextTheme(
              titleLarge: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
              bodyMedium: TextStyle(color: Color(0xFF374151)),
            ),
          ),
          home: homeScreen,
        );
      },
    );
  }
}
