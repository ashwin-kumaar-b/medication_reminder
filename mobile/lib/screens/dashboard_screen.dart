import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medicine_provider.dart';
import '../models/medication.dart';
import 'add_medicine_screen.dart';
import 'interaction_checker_screen.dart';
import 'food_checker_screen.dart';
import 'missed_doses_screen.dart';

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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Patient Dashboard'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
          ),
        ],
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
              if (patientNotifs.isNotEmpty) ...[
                const Text(
                  'Critical Alerts',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.redAccent),
                ),
                const SizedBox(height: 8),
                ...patientNotifs.map((notif) {
                  Color alertColor = Colors.green;
                  Color bgColor = const Color(0xFFEFFDF5);
                  if (notif.level == 'yellow') {
                    alertColor = Colors.amber[800]!;
                    bgColor = const Color(0xFFFEFCE8);
                  }
                  if (notif.level == 'red') {
                    alertColor = Colors.red;
                    bgColor = const Color(0xFFFEF2F2);
                  }
                  return Card(
                    color: bgColor,
                    elevation: 1,
                    shape: RoundedRectangleBorder(
                      side: BorderSide(color: alertColor.withOpacity(0.3), width: 1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: ListTile(
                      leading: Icon(Icons.warning_amber_rounded, color: alertColor),
                      title: Text(notif.title, style: TextStyle(fontWeight: FontWeight.bold, color: alertColor)),
                      subtitle: Text(notif.message),
                      trailing: Text(
                        notif.createdAt.length > 10 ? notif.createdAt.substring(11, 16) : '',
                        style: TextStyle(color: Colors.grey[500], fontSize: 12),
                      ),
                    ),
                  );
                }).toList(),
                const SizedBox(height: 16),
              ],

              // 2. Action Grid for AI / Health Utilities
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.5,
                children: [
                  _utilityButton(
                    context,
                    title: 'Drug Interaction',
                    icon: Icons.biotech_outlined,
                    color: const Color(0xFF0D9488),
                    page: const InteractionCheckerScreen(),
                  ),
                  _utilityButton(
                    context,
                    title: 'Food Compatibility',
                    icon: Icons.restaurant_outlined,
                    color: const Color(0xFFD97706),
                    page: const FoodCheckerScreen(),
                  ),
                  _utilityButton(
                    context,
                    title: 'Missed Dose Advice',
                    icon: Icons.warning_amber_rounded,
                    color: const Color(0xFFDC2626),
                    page: const MissedDosesScreen(),
                  ),
                  _utilityButton(
                    context,
                    title: 'Add Medicine',
                    icon: Icons.add_circle_outline,
                    color: const Color(0xFF2563EB),
                    page: AddMedicineScreen(patientId: user.id),
                  ),
                ],
              ),
              const SizedBox(height: 24),

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
              const Text(
                'Care Alerts Feed',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
              ),
              const SizedBox(height: 8),
              if (patientNotifs.isEmpty)
                const Text('No alerts or notifications recorded.')
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: patientNotifs.length > 5 ? 5 : patientNotifs.length,
                  itemBuilder: (context, index) {
                    final notif = patientNotifs[index];
                    Color alertColor = Colors.green;
                    if (notif.level == 'yellow') alertColor = Colors.amber[700]!;
                    if (notif.level == 'red') alertColor = Colors.red;

                    return Card(
                      child: ListTile(
                        leading: CircleAvatar(
                          backgroundColor: alertColor.withOpacity(0.1),
                          child: Icon(Icons.notification_important, color: alertColor),
                        ),
                        title: Text(notif.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(notif.message),
                        trailing: Text(
                          notif.createdAt.length > 10 ? notif.createdAt.substring(11, 16) : '',
                          style: TextStyle(color: Colors.grey[500], fontSize: 12),
                        ),
                      ),
                    );
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
}
