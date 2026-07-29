import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../providers/medicine_provider.dart';

class HealthProfileScreen extends StatefulWidget {
  const HealthProfileScreen({super.key});

  @override
  State<HealthProfileScreen> createState() => _HealthProfileScreenState();
}

class _HealthProfileScreenState extends State<HealthProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _saving = false;

  static const List<String> _predefinedConditions = [
    'Diabetes',
    'Diabetes Type 1',
    'Diabetes Type 2',
    'Hypertension',
    'Cardiovascular Disease',
    'Asthma',
    'Chronic Kidney Disease',
    'Arthritis',
    'COPD',
    'Depression',
    'Anxiety',
    'Hyperthyroidism',
    'Hypothyroidism',
    'Hyperlipidemia',
    'Cancer',
    'Epilepsy',
    'Alzheimer\'s Disease',
    'Parkinson\'s Disease',
    'Multiple Sclerosis',
    'Migraine',
    'Crohn\'s Disease',
    'Celiac Disease',
    'Osteoporosis',
    'Gout',
    'Liver Disease',
    'Sleep Apnea',
  ];

  List<String> _filteredSuggestions = [];

  // Controllers
  late TextEditingController _dobController;
  late TextEditingController _heightController;
  late TextEditingController _weightController;
  late TextEditingController _emergencyEmailController;
  late TextEditingController _diseaseInputController;
  late TextEditingController _allergyTriggerController;

  // Dropdown states
  String? _selectedGender;
  String? _selectedBloodGroup;
  String _selectedAllergyCategory = 'Drug';

  // Lists
  List<String> _chronicDiseases = [];
  List<Map<String, String>> _allergies = [];

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final user = auth.currentUser;

    _dobController = TextEditingController(text: user?.dateOfBirth ?? '');
    _heightController = TextEditingController(text: user?.heightCm != null ? user!.heightCm.toString() : '');
    _weightController = TextEditingController(text: user?.weightKg != null ? user!.weightKg.toString() : '');
    _emergencyEmailController = TextEditingController(text: user?.emergencyContactEmail ?? '');
    _diseaseInputController = TextEditingController();
    _allergyTriggerController = TextEditingController();

    _selectedGender = user?.gender ?? 'Male';
    _selectedBloodGroup = user?.bloodGroup ?? 'O+';
    _chronicDiseases = List<String>.from(user?.chronicDiseases ?? []);
    _allergies = List<Map<String, String>>.from(user?.allergies ?? []);

    _diseaseInputController.addListener(_onDiseaseInputChange);
  }

  void _onDiseaseInputChange() {
    final query = _diseaseInputController.text.toLowerCase().trim();
    if (query.isEmpty) {
      setState(() {
        _filteredSuggestions = [];
      });
    } else {
      setState(() {
        _filteredSuggestions = _predefinedConditions
            .where((condition) => condition.toLowerCase().contains(query))
            .toList();
      });
    }
  }

  @override
  void dispose() {
    _diseaseInputController.removeListener(_onDiseaseInputChange);
    _dobController.dispose();
    _heightController.dispose();
    _weightController.dispose();
    _emergencyEmailController.dispose();
    _diseaseInputController.dispose();
    _allergyTriggerController.dispose();
    super.dispose();
  }

  Future<void> _selectDateOfBirth(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 30)),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _dobController.text = DateFormat('yyyy-MM-dd').format(picked);
      });
    }
  }

  void _addDisease() {
    final text = _diseaseInputController.text.trim();
    if (text.isNotEmpty) {
      if (!_chronicDiseases.contains(text)) {
        setState(() {
          _chronicDiseases.add(text);
          _diseaseInputController.clear();
          _filteredSuggestions = [];
        });
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Condition already added.')),
        );
      }
    }
  }

  void _removeAllergy(int index) {
    setState(() {
      _allergies.removeAt(index);
    });
  }

  void _addAllergy() {
    final trigger = _allergyTriggerController.text.trim();
    if (trigger.isNotEmpty) {
      setState(() {
        _allergies.add({
          'category': _selectedAllergyCategory,
          'trigger': trigger,
        });
        _allergyTriggerController.clear();
      });
    }
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _saving = true);
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final medicine = Provider.of<MedicineProvider>(context, listen: false);

    final res = await auth.updatePatientHealthProfile(
      userId: auth.currentUser!.id,
      gender: _selectedGender ?? 'Male',
      bloodGroup: _selectedBloodGroup ?? 'O+',
      dateOfBirth: _dobController.text.trim(),
      heightCm: int.tryParse(_heightController.text.trim()) ?? 170,
      weightKg: double.tryParse(_weightController.text.trim()) ?? 70.0,
      chronicDiseases: _chronicDiseases,
      allergies: _allergies,
      emergencyContactEmail: _emergencyEmailController.text.trim(),
    );

    setState(() => _saving = false);

    if (res['ok'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Health profile updated successfully!'), backgroundColor: Colors.green),
      );
      // Reload provider data to re-evaluate AI risks
      await medicine.reloadData();
      if (mounted) Navigator.pop(context);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res['error'] ?? 'Failed to update profile'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Health Profile'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Welcome / Instruction Banner
              Card(
                color: const Color(0xFFF0FDF4),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: Color(0xFFBBF7D0), width: 1),
                ),
                child: const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      Icon(Icons.health_and_safety, color: Color(0xFF16A34A), size: 28),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Update your medical information to enable personalized, safe AI clinical advice.',
                          style: TextStyle(color: Color(0xFF15803D), fontSize: 13.5, fontWeight: FontWeight.w500),
                        ),
                      )
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Personal Health Metrics Card
              _buildSectionCard(
                title: 'Personal Metrics',
                icon: Icons.person_outline,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _selectedGender,
                          decoration: const InputDecoration(labelText: 'Gender'),
                          items: const [
                            DropdownMenuItem(value: 'Male', child: Text('Male')),
                            DropdownMenuItem(value: 'Female', child: Text('Female')),
                            DropdownMenuItem(value: 'Other', child: Text('Other')),
                          ],
                          onChanged: (val) => setState(() => _selectedGender = val),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _selectedBloodGroup,
                          decoration: const InputDecoration(labelText: 'Blood Group'),
                          items: const [
                            DropdownMenuItem(value: 'A+', child: Text('A+')),
                            DropdownMenuItem(value: 'A-', child: Text('A-')),
                            DropdownMenuItem(value: 'B+', child: Text('B+')),
                            DropdownMenuItem(value: 'B-', child: Text('B-')),
                            DropdownMenuItem(value: 'AB+', child: Text('AB+')),
                            DropdownMenuItem(value: 'AB-', child: Text('AB-')),
                            DropdownMenuItem(value: 'O+', child: Text('O+')),
                            DropdownMenuItem(value: 'O-', child: Text('O-')),
                          ],
                          onChanged: (val) => setState(() => _selectedBloodGroup = val),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _dobController,
                    readOnly: true,
                    decoration: const InputDecoration(
                      labelText: 'Date of Birth',
                      suffixIcon: Icon(Icons.calendar_today_rounded, size: 20),
                    ),
                    onTap: () => _selectDateOfBirth(context),
                    validator: (v) => v == null || v.isEmpty ? 'DOB is required' : null,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _heightController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Height (cm)'),
                          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: TextFormField(
                          controller: _weightController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Weight (kg)'),
                          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Chronic Conditions / Diseases Card
              _buildSectionCard(
                title: 'Chronic Diseases & Conditions',
                icon: Icons.healing_outlined,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _diseaseInputController,
                          decoration: const InputDecoration(
                            hintText: 'e.g., Hypertension, Diabetes',
                            labelText: 'Add Chronic Condition',
                          ),
                          onSubmitted: (_) => _addDisease(),
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: _addDisease,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1E3A8A),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text('Add'),
                      ),
                    ],
                  ),
                  if (_filteredSuggestions.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Container(
                      constraints: const BoxConstraints(maxHeight: 180),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.grey[200]!),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.04),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: _filteredSuggestions.length,
                        itemBuilder: (context, idx) {
                          final suggestion = _filteredSuggestions[idx];
                          return ListTile(
                            dense: true,
                            title: Text(suggestion, style: const TextStyle(fontWeight: FontWeight.w500)),
                            trailing: const Icon(Icons.add_rounded, size: 16, color: Color(0xFF1E3A8A)),
                            onTap: () {
                              if (!_chronicDiseases.contains(suggestion)) {
                                setState(() {
                                  _chronicDiseases.add(suggestion);
                                  _diseaseInputController.clear();
                                  _filteredSuggestions = [];
                                });
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Condition already added.')),
                                );
                              }
                            },
                          );
                        },
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  if (_chronicDiseases.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8.0),
                      child: Text(
                        'No conditions listed. Add any to calculate medication risks.',
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                    )
                  else
                    Wrap(
                      spacing: 8.0,
                      runSpacing: 4.0,
                      children: _chronicDiseases.map((disease) {
                        return InputChip(
                          label: Text(disease),
                          backgroundColor: const Color(0xFFEFF6FF),
                          labelStyle: const TextStyle(color: Color(0xFF1E40AF), fontWeight: FontWeight.w500),
                          deleteIconColor: const Color(0xFF1E40AF),
                          onDeleted: () {
                            setState(() {
                              _chronicDiseases.remove(disease);
                            });
                          },
                        );
                      }).toList(),
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // Allergies Card
              _buildSectionCard(
                title: 'Allergies',
                icon: Icons.warning_amber_rounded,
                children: [
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: DropdownButtonFormField<String>(
                          value: _selectedAllergyCategory,
                          decoration: const InputDecoration(labelText: 'Category'),
                          items: const [
                            DropdownMenuItem(value: 'Drug', child: Text('Drug')),
                            DropdownMenuItem(value: 'Food', child: Text('Food')),
                            DropdownMenuItem(value: 'Environmental', child: Text('Env')),
                            DropdownMenuItem(value: 'Other', child: Text('Other')),
                          ],
                          onChanged: (val) => setState(() => _selectedAllergyCategory = val ?? 'Drug'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 3,
                        child: TextField(
                          controller: _allergyTriggerController,
                          decoration: const InputDecoration(
                            hintText: 'e.g. Penicillin',
                            labelText: 'Trigger/Substance',
                          ),
                          onSubmitted: (_) => _addAllergy(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        onPressed: _addAllergy,
                        style: IconButton.styleFrom(backgroundColor: const Color(0xFF1E3A8A)),
                        icon: const Icon(Icons.add, color: Colors.white),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_allergies.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8.0),
                      child: Text(
                        'No allergies listed.',
                        style: TextStyle(color: Colors.grey, fontSize: 13),
                      ),
                    )
                  else
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _allergies.length,
                      itemBuilder: (context, idx) {
                        final allergy = _allergies[idx];
                        return Card(
                          color: const Color(0xFFFFF5F5),
                          elevation: 0,
                          margin: const EdgeInsets.only(bottom: 6),
                          child: ListTile(
                            dense: true,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                            title: Text(
                              '${allergy['trigger']}',
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF991B1B)),
                            ),
                            subtitle: Text('Category: ${allergy['category']}'),
                            trailing: IconButton(
                              icon: const Icon(Icons.delete_outline, color: Color(0xFFEF4444), size: 18),
                              onPressed: () => _removeAllergy(idx),
                            ),
                          ),
                        );
                      },
                    ),
                ],
              ),
              const SizedBox(height: 16),

              // Emergency & Safety Details Card
              _buildSectionCard(
                title: 'Safety & Emergency Contacts',
                icon: Icons.emergency_outlined,
                children: [
                  TextFormField(
                    controller: _emergencyEmailController,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(
                      labelText: 'Emergency Contact Email',
                      hintText: 'e.g., doctor@clinic.com or kin@family.com',
                    ),
                    validator: (v) {
                      if (v == null || v.isEmpty) return 'Required';
                      final emailRegex = RegExp(r'^[^@]+@[^@]+\.[^@]+$');
                      if (!emailRegex.hasMatch(v)) return 'Enter a valid email';
                      return null;
                    },
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Save Action Button
              ElevatedButton(
                onPressed: _saving ? null : _saveProfile,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E3A8A),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text(
                        'Save Health Profile',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Card(
      elevation: 0.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey[200]!, width: 1),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: const Color(0xFF1E3A8A), size: 22),
                const SizedBox(width: 8),
                Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14.5, color: Color(0xFF1E3A8A)),
                ),
              ],
            ),
            const Divider(height: 20),
            ...children,
          ],
        ),
      ),
    );
  }
}
