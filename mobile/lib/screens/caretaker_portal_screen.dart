import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medicine_provider.dart';
import '../models/user.dart';
import 'add_medicine_screen.dart';

class CaretakerPortalScreen extends StatefulWidget {
  const CaretakerPortalScreen({super.key});

  @override
  State<CaretakerPortalScreen> createState() => _CaretakerPortalScreenState();
}

class _CaretakerPortalScreenState extends State<CaretakerPortalScreen> {
  final _linkController = TextEditingController();
  final _pNameController = TextEditingController();
  final _pEmailController = TextEditingController();
  final _pPassController = TextEditingController();
  final _pAgeController = TextEditingController();
  final _pIllnessController = TextEditingController();

  bool _loading = false;
  String? _linkErrorMessage;
  String? _linkSuccessMessage;
  String? _createErrorMessage;
  String? _createSuccessMessage;

  @override
  void dispose() {
    _linkController.dispose();
    _pNameController.dispose();
    _pEmailController.dispose();
    _pPassController.dispose();
    _pAgeController.dispose();
    _pIllnessController.dispose();
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

  Future<void> _createPatient(String caretakerId) async {
    setState(() {
      _loading = true;
      _createErrorMessage = null;
      _createSuccessMessage = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final res = await auth.createPatientForCaretaker(
      caretakerId,
      _pNameController.text,
      _pEmailController.text,
      _pPassController.text,
      int.tryParse(_pAgeController.text) ?? 50,
      _pIllnessController.text,
    );

    setState(() {
      _loading = false;
      if (res['ok']) {
        _createSuccessMessage = 'Patient profile created successfully!';
        _pNameController.clear();
        _pEmailController.clear();
        _pPassController.clear();
        _pAgeController.clear();
        _pIllnessController.clear();
        _createErrorMessage = null;
      } else {
        _createErrorMessage = res['error'];
        _createSuccessMessage = null;
      }
    });
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
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
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

              const SizedBox(height: 24),
              const Text(
                'Create New Patient Profile',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextField(
                        controller: _pNameController,
                        decoration: const InputDecoration(labelText: 'Patient Name'),
                      ),
                      TextField(
                        controller: _pEmailController,
                        decoration: const InputDecoration(labelText: 'Login Email'),
                      ),
                      TextField(
                        controller: _pPassController,
                        obscureText: true,
                        decoration: const InputDecoration(labelText: 'Login Password'),
                      ),
                      TextField(
                        controller: _pAgeController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Patient Age'),
                      ),
                      TextField(
                        controller: _pIllnessController,
                        decoration: const InputDecoration(labelText: 'Primary Chronic Disease / Condition'),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loading ? null : () => _createPatient(caretaker.id),
                        child: const Text('Create Profile'),
                      ),
                      if (_createErrorMessage != null) ...[
                        const SizedBox(height: 8),
                        Text(_createErrorMessage!, style: const TextStyle(color: Colors.red)),
                      ],
                      if (_createSuccessMessage != null) ...[
                        const SizedBox(height: 8),
                        Text(_createSuccessMessage!, style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                      ],
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
