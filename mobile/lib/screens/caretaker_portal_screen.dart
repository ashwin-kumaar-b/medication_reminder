import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medicine_provider.dart';
import '../models/user.dart';
import 'add_medicine_screen.dart';
import 'create_patient_screen.dart';

class CaretakerPortalScreen extends StatefulWidget {
  const CaretakerPortalScreen({super.key});

  @override
  State<CaretakerPortalScreen> createState() => _CaretakerPortalScreenState();
}

class _CaretakerPortalScreenState extends State<CaretakerPortalScreen> {
  final _linkController = TextEditingController();

  bool _loading = false;
  String? _linkErrorMessage;
  String? _linkSuccessMessage;

  @override
  void dispose() {
    _linkController.dispose();
    super.dispose();
  }

  Future<void> _linkPatient(String caretakerId) async {
    if (_linkController.text.trim().isEmpty) return;
    setState(() {
      _loading = true;
      _linkErrorMessage = null;
      _linkSuccessMessage = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final res = await auth.linkExistingPatient(caretakerId, _linkController.text);

    setState(() {
      _loading = false;
      if (res['ok']) {
        if (res['requestSent'] == true) {
          _linkSuccessMessage = 'Request sent successfully to ${res['patient'].name}. Waiting for approval.';
        } else {
          _linkSuccessMessage = 'Successfully linked patient: ${res['patient'].name}';
        }
        _linkErrorMessage = null;
        _linkController.clear();
      } else {
        _linkErrorMessage = res['error'];
        _linkSuccessMessage = null;
      }
    });
  }

  void _confirmUnlinkPatient(BuildContext context, AuthProvider auth, User patient) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Remove Patient Link'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Are you sure you want to remove the link with ${patient.name}?', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            const Text(
              'This will stop you from monitoring their medications and logs. '
              'To connect again, you will need to send a new link request.',
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              setState(() {
                _loading = true;
              });
              final res = await auth.unlinkPatient(patient.id);
              setState(() {
                _loading = false;
              });
              if (mounted) {
                if (res['ok']) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Successfully unlinked ${patient.name}')),
                  );
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(res['error'] ?? 'Failed to unlink patient.'),
                      backgroundColor: Colors.red,
                    ),
                  );
                }
              }
            },
            child: const Text('Yes, Unlink', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final medicine = Provider.of<MedicineProvider>(context);
    final caretaker = auth.currentUser!;
    final linkedPatients = auth.getLinkedPatientsForCaretaker(caretaker.id);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Caretaker Portal'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add),
            tooltip: 'Create Patient Profile',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => CreatePatientScreen(caretakerId: caretaker.id),
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Log Out'),
                  content: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Name: ${caretaker.name}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text('Email: ${caretaker.email}'),
                      Text('Role: ${caretaker.role.toUpperCase()}'),
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
      body: RefreshIndicator(
        onRefresh: () async {
          await auth.loadUsers();
          await medicine.reloadData();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Welcome Card
              Card(
                color: const Color(0xFFF0FDFA),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Caretaker: ${caretaker.name}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                      Text('Relationship: ${caretaker.relation ?? "Caretaker"}'),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Linked Patients checklist
              const Text(
                'My Monitored Patients',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1E3A8A)),
              ),
              const SizedBox(height: 8),

              if (linkedPatients.isEmpty)
                const Card(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: Text('You are not monitoring any patients yet.', textAlign: TextAlign.center),
                  ),
                )
              else
                ListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: linkedPatients.length,
                  itemBuilder: (context, idx) {
                    final patient = linkedPatients[idx];
                    final patientMeds = medicine.medications.where((m) => m.patientId == patient.id).toList();

                    return Card(
                      child: ExpansionTile(
                        title: Text(patient.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('ID: ${patient.patientId ?? "N/A"}'),
                        children: [
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Medications:', style: TextStyle(fontWeight: FontWeight.bold)),
                                    Row(
                                      children: [
                                        TextButton.icon(
                                          onPressed: () => _confirmUnlinkPatient(context, auth, patient),
                                          icon: const Icon(Icons.link_off, size: 16, color: Colors.red),
                                          label: const Text('Unlink', style: TextStyle(fontSize: 12, color: Colors.red)),
                                        ),
                                        const SizedBox(width: 8),
                                        ElevatedButton.icon(
                                          onPressed: () {
                                            Navigator.push(
                                              context,
                                              MaterialPageRoute(
                                                builder: (_) => AddMedicineScreen(patientId: patient.id),
                                              ),
                                            );
                                          },
                                          icon: const Icon(Icons.add, size: 16),
                                          label: const Text('Add Med', style: TextStyle(fontSize: 12)),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                if (patientMeds.isEmpty)
                                  const Text('No medications listed.')
                                else
                                  ...patientMeds.map((med) {
                                    final today = DateTime.now().toIso8601String().substring(0, 10);
                                    final hasTaken = medicine.logs.any((l) =>
                                        l.medicationId == med.id &&
                                        l.date == today &&
                                        l.scheduledTime == med.scheduleTime &&
                                        l.status == 'taken');

                                    return ListTile(
                                      title: Text(med.drugName),
                                      subtitle: Text('Dosage: ${med.dosage} (${med.scheduleTime})'),
                                      trailing: Icon(
                                        hasTaken ? Icons.check_circle : Icons.radio_button_unchecked,
                                        color: hasTaken ? Colors.green : Colors.grey,
                                      ),
                                    );
                                  }),
                              ],
                            ),
                          )
                        ],
                      ),
                    );
                  },
                ),

              const Divider(height: 32),

              // Forms section
              const Text(
                'Link Patient Account',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _linkController,
                      decoration: const InputDecoration(
                        hintText: 'Enter Patient Smart Care ID (e.g. MGP-123456)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton(
                    onPressed: _loading ? null : () => _linkPatient(caretaker.id),
                    child: const Text('Link'),
                  ),
                ],
              ),
              if (_linkErrorMessage != null) ...[
                const SizedBox(height: 8),
                Text(_linkErrorMessage!, style: const TextStyle(color: Colors.red)),
              ],
              if (_linkSuccessMessage != null) ...[
                const SizedBox(height: 8),
                Text(_linkSuccessMessage!, style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
              ],

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
