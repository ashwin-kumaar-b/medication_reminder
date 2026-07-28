import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medicine_provider.dart';
import '../models/medication.dart';
import 'add_medicine_screen.dart';
import 'interaction_checker_screen.dart';
import 'food_checker_screen.dart';
import 'missed_doses_screen.dart';
import 'health_profile_screen.dart';

import '../services/api_service.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final medicine = Provider.of<MedicineProvider>(context);
    final user = auth.currentUser!;

    // Filter medications for this patient
    final patientMeds = medicine.medications.where((m) => m.patientId == user.id).toList();
    final patientNotifs = medicine.notifications.where((n) => n.patientId == user.id).toList();
    
    // Critical notifications: Caretaker requests and High Severity (red) alerts
    final criticalNotifs = patientNotifs.where((n) => 
      (n.type == 'caretaker-alert' && n.title == 'Caretaker Link Request') || 
      n.level == 'red'
    ).toList();

    // Feed notifications: everything else (excluding caretaker requests and red level alerts to avoid duplication)
    final feedNotifs = patientNotifs.where((n) => 
      !((n.type == 'caretaker-alert' && n.title == 'Caretaker Link Request') || 
      n.level == 'red')
    ).toList();

    final bool isProfileEmpty = user.chronicDiseases.isEmpty ||
        user.dateOfBirth == null ||
        user.dateOfBirth!.isEmpty ||
        user.chronicDiseases.contains('None') ||
        user.chronicDiseases.contains('');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Patient Dashboard'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(
                color: Color(0xFF1E3A8A),
              ),
              currentAccountPicture: CircleAvatar(
                backgroundColor: Colors.white,
                child: Text(
                  user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                  style: const TextStyle(
                    fontSize: 24.0,
                    color: Color(0xFF1E3A8A),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              accountName: Text(
                user.name,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
              accountEmail: Text(user.email),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Smart Care ID: ${user.patientId ?? "N/A"}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Chronic Diseases: ${user.chronicDiseases.join(", ")}',
                    style: TextStyle(color: Colors.grey[700], fontSize: 13),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Allergies: ${user.allergies.map((a) => "${a['category']}: ${a['trigger']}").join(", ")}',
                    style: TextStyle(color: Colors.grey[700], fontSize: 13),
                  ),
                  const Divider(),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.biotech_outlined, color: Color(0xFF0D9488)),
              title: const Text('Drug Interaction'),
              onTap: () {
                Navigator.pop(context); // Close drawer
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const InteractionCheckerScreen()),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.restaurant_outlined, color: Color(0xFFD97706)),
              title: const Text('Food Compatibility'),
              onTap: () {
                Navigator.pop(context); // Close drawer
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const FoodCheckerScreen()),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.warning_amber_rounded, color: Color(0xFFDC2626)),
              title: const Text('Missed Dose Advice'),
              onTap: () {
                Navigator.pop(context); // Close drawer
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const MissedDosesScreen()),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.health_and_safety_outlined, color: Color(0xFF16A34A)),
              title: const Text('My Health Profile'),
              onTap: () {
                Navigator.pop(context); // Close drawer
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const HealthProfileScreen()),
                );
              },
            ),
            ListTile(
              leading: const Icon(Icons.add_circle_outline, color: Color(0xFF2563EB)),
              title: const Text('Add Medicine'),
              onTap: () {
                Navigator.pop(context); // Close drawer
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => AddMedicineScreen(patientId: user.id)),
                );
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.grey),
              title: const Text('Logout'),
              onTap: () {
                Navigator.pop(context); // Close drawer
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Log Out'),
                    content: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Name: ${user.name}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text('Email: ${user.email}'),
                        Text('Role: ${user.role.toUpperCase()}'),
                        const SizedBox(height: 16),
                        const Text('Are you sure you want to log out of your account?'),
                      ],
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.pop(context);
                          auth.logout();
                        },
                        child: const Text('Log Out', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await medicine.reloadData();
          await auth.loadUsers();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (isProfileEmpty) ...[
                Card(
                  color: const Color(0xFFFFFBEB),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                    side: const BorderSide(color: Color(0xFFFDE68A), width: 1.5),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.warning_amber_rounded, color: Colors.amber[800], size: 24),
                            const SizedBox(width: 10),
                            const Text(
                              'Complete Your Health Profile',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 15,
                                color: Color(0xFF78350F),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Your chronic conditions and medical details are empty. Set them up now to enable precise, personalized AI clinical safety alerts on drug interactions and missed doses.',
                          style: TextStyle(fontSize: 13, color: Color(0xFF92400E), height: 1.4),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const HealthProfileScreen()),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFD97706),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            icon: const Icon(Icons.arrow_forward_rounded, size: 16),
                            label: const Text('Set Up Profile Now', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              // 1. Profile Welcome Card
              Card(
                color: const Color(0xFFEFF6FF),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Welcome, ${user.name}!',
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E3A8A),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Your Smart Care ID: ${user.patientId ?? "N/A"}',
                        style: TextStyle(color: Colors.grey[700], fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Role: Patient | Health Profile: ${user.chronicDiseases.join(", ")}',
                        style: TextStyle(color: Colors.grey[600]),
                      ),
                    ],
                  ),
                ),
              ),
              // Care Alerts (Shown prominently at the top if there are active alerts)
              if (criticalNotifs.isNotEmpty) ...[
                Row(
                  children: [
                    const Icon(Icons.crisis_alert_rounded, color: Colors.redAccent, size: 20),
                    const SizedBox(width: 6),
                    const Text(
                      'Critical Alerts',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.redAccent),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ...criticalNotifs.map((notif) => _buildCriticalAlertCard(context, notif, auth, medicine)).toList(),
                const SizedBox(height: 16),
              ],
              const SizedBox(height: 8),

              // 3. Today's Schedule Checklist
              const Text(
                'Today\'s Medication Schedule',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
              ),
              const SizedBox(height: 8),
              if (patientMeds.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      children: [
                        Icon(Icons.medical_services_outlined, size: 48, color: Colors.grey[400]),
                        const SizedBox(height: 12),
                        const Text('No medications registered yet.'),
                        TextButton(
                          onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(builder: (context) => AddMedicineScreen(patientId: user.id)),
                          ),
                          child: const Text('Add your first medication'),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: patientMeds.length,
                  itemBuilder: (context, index) {
                    final med = patientMeds[index];
                    return _medicationItemCard(context, med, medicine);
                  },
                ),
              const SizedBox(height: 24),

              // 4. Alert & Notification Feed
              Row(
                children: [
                  const Icon(Icons.history_toggle_off_rounded, color: Color(0xFF1E3A8A), size: 20),
                  const SizedBox(width: 6),
                  const Text(
                    'Care Alerts Feed',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (feedNotifs.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16.0),
                  child: Text('No alerts or notifications recorded.', style: TextStyle(color: Colors.grey)),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: feedNotifs.length > 5 ? 5 : feedNotifs.length,
                  itemBuilder: (context, index) {
                    final notif = feedNotifs[index];
                    return _buildFeedAlertCard(context, notif, medicine);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _utilityButton(
    BuildContext context, {
    required String title,
    required IconData icon,
    required Color color,
    required Widget page,
  }) {
    return Card(
      elevation: 2,
      child: InkWell(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => page)),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 28, color: color),
              const SizedBox(height: 8),
              Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _medicationItemCard(BuildContext context, Medication med, MedicineProvider provider) {
    // Check if taken today
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final hasTaken = provider.logs.any((l) =>
        l.medicationId == med.id &&
        l.date == today &&
        l.scheduledTime == med.scheduleTime &&
        l.status == 'taken');

    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    med.drugName,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                  const SizedBox(height: 2),
                  Text('Dosage: ${med.dosage} (${med.foodTiming})'),
                  Text(
                    'Time: ${med.scheduleTime} | ${med.frequency}',
                    style: const TextStyle(fontSize: 12, color: Colors.blueGrey),
                  ),
                ],
              ),
            ),
            Checkbox(
              value: hasTaken,
              onChanged: (val) {
                if (val == true) {
                  provider.markDoseStatus(med, 'taken', 'user');
                } else {
                  provider.markDoseStatus(med, 'pending', 'user');
                }
              },
            ),
            IconButton(
              icon: const Icon(Icons.edit_outlined, color: Colors.blue),
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => AddMedicineScreen(
                      patientId: med.patientId,
                      medication: med,
                    ),
                  ),
                );
              },
            ),
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => AlertDialog(
                    title: const Text('Delete Medication'),
                    content: Text('Are you sure you want to delete ${med.drugName}?'),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Cancel'),
                      ),
                      TextButton(
                        onPressed: () {
                          provider.removeMedication(med.id);
                          Navigator.pop(context);
                        },
                        child: const Text('Delete', style: TextStyle(color: Colors.red)),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCriticalAlertCard(BuildContext context, dynamic notif, AuthProvider auth, MedicineProvider medicine) {
    final user = auth.currentUser!;
    if (notif.type == 'caretaker-alert' && notif.title == 'Caretaker Link Request') {
      return Container(
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF5F7FF),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFC7D2FE), width: 1),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF4F46E5).withOpacity(0.06),
              blurRadius: 12,
              offset: const Offset(0, 4),
            )
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  width: 6,
                  color: const Color(0xFF4F46E5),
                ),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEEF2FF),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.people_alt_rounded, color: Color(0xFF4F46E5), size: 20),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    notif.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15,
                                      color: Color(0xFF312E81),
                                    ),
                                  ),
                                  Text(
                                    notif.createdAt.length > 10 ? notif.createdAt.substring(11, 16) : '',
                                    style: TextStyle(color: Colors.grey[500], fontSize: 11),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          notif.message,
                          style: TextStyle(fontSize: 13.5, color: Colors.grey[800], height: 1.4),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            TextButton(
                              onPressed: () async {
                                try {
                                  await ApiService.deleteNotification(notif.id);
                                  await medicine.reloadData();
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(content: Text('Request rejected.')),
                                  );
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Failed to reject: $e')),
                                  );
                                }
                              },
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.red[700],
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              child: const Text('Reject', style: TextStyle(fontWeight: FontWeight.w600)),
                            ),
                            const SizedBox(width: 8),
                            ElevatedButton(
                              onPressed: () async {
                                try {
                                  if (notif.caretakerId != null) {
                                    await ApiService.upsertCaretakerPatient(notif.caretakerId!, user.id);
                                    await ApiService.deleteNotification(notif.id);
                                    await auth.loadUsers();
                                    await medicine.reloadData();
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      const SnackBar(content: Text('Successfully linked caretaker!')),
                                    );
                                  }
                                } catch (e) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(content: Text('Failed to accept: $e')),
                                  );
                                }
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF4F46E5),
                                foregroundColor: Colors.white,
                                elevation: 0,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              ),
                              child: const Text('Accept', style: TextStyle(fontWeight: FontWeight.bold)),
                            ),
                          ],
                        )
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // Critical Medical Alerts (red level)
    final Color alertColor = Colors.red[700]!;
    final Color bgColor = const Color(0xFFFFF5F5);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red[100]!, width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.red.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 6,
                color: alertColor,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: Colors.red[100]!.withOpacity(0.5),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: Icon(Icons.warning_amber_rounded, color: alertColor, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        notif.title,
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14.5,
                                          color: Colors.red[900],
                                        ),
                                      ),
                                      Text(
                                        notif.createdAt.length > 10 ? notif.createdAt.substring(11, 16) : '',
                                        style: TextStyle(color: Colors.grey[500], fontSize: 11),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: Icon(Icons.close_rounded, size: 18, color: Colors.red[300]),
                            onPressed: () async {
                              try {
                                await ApiService.deleteNotification(notif.id);
                                await medicine.reloadData();
                              } catch (e) {
                                debugPrint('Failed to delete notification: $e');
                              }
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        notif.message,
                        style: TextStyle(fontSize: 13.5, color: Colors.red[950], height: 1.4),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFeedAlertCard(BuildContext context, dynamic notif, MedicineProvider medicine) {
    Color alertColor = Colors.green[600]!;
    Color iconBg = const Color(0xFFDCFCE7);
    IconData icon = Icons.check_circle_outline_rounded;

    if (notif.level == 'yellow') {
      alertColor = Colors.amber[700]!;
      iconBg = const Color(0xFFFEF9C3);
      icon = Icons.warning_amber_rounded;
    } else if (notif.level == 'red') {
      alertColor = Colors.red[600]!;
      iconBg = const Color(0xFFFEE2E2);
      icon = Icons.error_outline_rounded;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
        border: Border.all(color: Colors.grey[100]!, width: 1),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 5,
                color: alertColor,
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: iconBg,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(icon, color: alertColor, size: 22),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    notif.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: Color(0xFF1E293B),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Text(
                                  notif.createdAt.length > 10 ? notif.createdAt.substring(11, 16) : '',
                                  style: TextStyle(color: Colors.grey[400], fontSize: 11),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              notif.message,
                              style: TextStyle(fontSize: 12.5, color: Colors.grey[600], height: 1.3),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        icon: Icon(Icons.delete_outline_rounded, size: 18, color: Colors.grey[400]),
                        onPressed: () async {
                          try {
                            await ApiService.deleteNotification(notif.id);
                            await medicine.reloadData();
                          } catch (e) {
                            debugPrint('Failed to delete notification: $e');
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
