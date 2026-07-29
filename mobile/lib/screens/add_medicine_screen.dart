import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/medicine_provider.dart';
import '../providers/auth_provider.dart';
import '../services/api_service.dart';
import '../models/medication.dart';
import '../models/user.dart';
import 'health_profile_screen.dart';

class AddMedicineScreen extends StatefulWidget {
  final String patientId;
  final Medication? medication;
  const AddMedicineScreen({super.key, required this.patientId, this.medication});

  @override
  State<AddMedicineScreen> createState() => _AddMedicineScreenState();
}

class _AddMedicineScreenState extends State<AddMedicineScreen> {
  final _formKey = GlobalKey<FormState>();
  final _drugNameController = TextEditingController();
  final _dosageController = TextEditingController();
  final _focusNodeDrugName = FocusNode();
  
  String _selectedFoodTiming = 'before-food'; // 'before-food' | 'after-food'
  String _selectedCategory = 'other';
  String _selectedCriticality = 'low';
  String _selectedFrequency = 'daily';
  String? _selectedCondition;
  
  TimeOfDay _selectedTime = const TimeOfDay(hour: 8, minute: 0);
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.medication != null) {
      final med = widget.medication!;
      _drugNameController.text = med.drugName;
      _dosageController.text = med.dosage;
      _selectedFoodTiming = med.foodTiming;
      _selectedCategory = med.category;
      _selectedCriticality = med.criticality;
      _selectedFrequency = med.frequency;
      _selectedCondition = med.targetCondition;

      try {
        final parts = med.scheduleTime.split(':');
        if (parts.length == 2) {
          final hour = int.parse(parts[0]);
          final minute = int.parse(parts[1]);
          _selectedTime = TimeOfDay(hour: hour, minute: minute);
        }
      } catch (e) {
        debugPrint('Failed to parse schedule time: $e');
      }
    }
  }

  @override
  void dispose() {
    _drugNameController.dispose();
    _dosageController.dispose();
    _focusNodeDrugName.dispose();
    super.dispose();
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
    );
    if (picked != null) {
      setState(() => _selectedTime = picked);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _submitting = true);

    final provider = Provider.of<MedicineProvider>(context, listen: false);

    // Format timeOfDay to HH:mm
    final hour = _selectedTime.hour.toString().padLeft(2, '0');
    final minute = _selectedTime.minute.toString().padLeft(2, '0');
    final formattedTime = '$hour:$formattedMinute';

    try {
      if (widget.medication != null) {
        final updated = Medication(
          id: widget.medication!.id,
          patientId: widget.medication!.patientId,
          drugName: _drugNameController.text,
          dosage: _dosageController.text,
          foodTiming: _selectedFoodTiming,
          category: _selectedCategory,
          criticality: _selectedCriticality,
          scheduleTime: formattedTime,
          frequency: _selectedFrequency,
          createdAt: widget.medication!.createdAt,
          displayName: widget.medication!.displayName,
          genericName: widget.medication!.genericName,
          whoEssential: widget.medication!.whoEssential,
          whoRiskTier: widget.medication!.whoRiskTier,
          photoUrl: widget.medication!.photoUrl,
          targetCondition: _selectedCondition,
        );
        await provider.updateMedication(updated);
      } else {
        await provider.addMedication(
          patientId: widget.patientId,
          drugName: _drugNameController.text,
          dosage: _dosageController.text,
          foodTiming: _selectedFoodTiming,
          category: _selectedCategory,
          criticality: _selectedCriticality,
          scheduleTime: formattedTime,
          frequency: _selectedFrequency,
          targetCondition: _selectedCondition ?? '',
        );
      }
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to save medicine: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String get formattedMinute => _selectedTime.minute.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.medication != null;
    final auth = Provider.of<AuthProvider>(context);

    // Resolve matching patient
    User? patientUser;
    try {
      patientUser = auth.users.firstWhere((u) => u.id == widget.patientId);
    } catch (_) {}

    final List<String> conditionOptions = [];
    if (patientUser != null) {
      if (patientUser.illness != null && patientUser.illness!.trim().isNotEmpty) {
        conditionOptions.add(patientUser.illness!.trim());
      }
      for (final c in patientUser.chronicDiseases) {
        if (c.trim().isNotEmpty && c.toLowerCase() != 'none') {
          conditionOptions.add(c.trim());
        }
      }
    }
    final distinctOptions = conditionOptions.toSet().toList();

    return Scaffold(
      appBar: AppBar(
        title: Text(isEditing ? 'Edit Medication' : 'Add Medication'),
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
              RawAutocomplete<String>(
                textEditingController: _drugNameController,
                focusNode: _focusNodeDrugName,
                optionsBuilder: (TextEditingValue textEditingValue) async {
                  return await ApiService.getDrugSuggestions(textEditingValue.text);
                },
                fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                  return TextFormField(
                    controller: controller,
                    focusNode: focusNode,
                    decoration: const InputDecoration(
                      labelText: 'Drug Name',
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => v == null || v.trim().isEmpty ? 'Please enter drug name' : null,
                    onFieldSubmitted: (_) => onFieldSubmitted(),
                  );
                },
                optionsViewBuilder: (context, onSelected, options) {
                  return Align(
                    alignment: Alignment.topLeft,
                    child: Material(
                      elevation: 4.0,
                      borderRadius: BorderRadius.circular(8.0),
                      child: Container(
                        width: MediaQuery.of(context).size.width - 32,
                        color: Colors.white,
                        constraints: const BoxConstraints(maxHeight: 200),
                        child: ListView.builder(
                          padding: EdgeInsets.zero,
                          shrinkWrap: true,
                          itemCount: options.length,
                          itemBuilder: (context, index) {
                            final option = options.elementAt(index);
                            return InkWell(
                              onTap: () => onSelected(option),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 16.0),
                                child: Text(
                                  option,
                                  style: const TextStyle(fontSize: 14),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _dosageController,
                decoration: const InputDecoration(
                  labelText: 'Dosage (e.g. 500mg or 1 tablet)',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => v == null || v.trim().isEmpty ? 'Please enter dosage info' : null,
              ),
              const SizedBox(height: 16),

              // Treated Condition Selector (Optional)
              if (distinctOptions.isEmpty) ...[
                TextFormField(
                  initialValue: _selectedCondition,
                  decoration: const InputDecoration(
                    labelText: 'Purpose / Treated Condition (Optional)',
                    border: OutlineInputBorder(),
                    helperText: 'Enter the illness/condition this medicine treats',
                  ),
                  onChanged: (v) => setState(() => _selectedCondition = v),
                ),
                const SizedBox(height: 16),
              ] else ...[
                DropdownButtonFormField<String>(
                  value: (distinctOptions.contains(_selectedCondition) || _selectedCondition == '') ? _selectedCondition : null,
                  decoration: const InputDecoration(
                    labelText: 'Purpose / Treated Condition (Optional)',
                    border: OutlineInputBorder(),
                    helperText: 'Select the condition this medicine treats',
                  ),
                  items: [
                    const DropdownMenuItem(value: '', child: Text('None / General')),
                    ...distinctOptions.map((cond) => DropdownMenuItem(value: cond, child: Text(cond))),
                  ],
                  onChanged: (v) => setState(() => _selectedCondition = v),
                ),
                const SizedBox(height: 16),
              ],

              // Time Picker
              ListTile(
                title: const Text('Schedule Time', style: TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('${_selectedTime.hour.toString().padLeft(2, '0')}:$formattedMinute'),
                trailing: const Icon(Icons.access_time),
                shape: RoundedRectangleBorder(
                  side: BorderSide(color: Colors.grey[400]!),
                  borderRadius: BorderRadius.circular(4),
                ),
                onTap: _pickTime,
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _selectedFoodTiming,
                decoration: const InputDecoration(labelText: 'Food Relation', border: OutlineInputBorder()),
                items: [
                  const DropdownMenuItem(value: 'before-food', child: Text('Before Food')),
                  const DropdownMenuItem(value: 'after-food', child: Text('After Food')),
                ],
                onChanged: (v) => setState(() => _selectedFoodTiming = v!),
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _selectedCategory,
                decoration: const InputDecoration(labelText: 'Therapeutic Category', border: OutlineInputBorder()),
                items: ['blood-pressure', 'diabetes', 'thyroid', 'antibiotic', 'blood-thinner', 'other']
                    .map((val) => DropdownMenuItem(value: val, child: Text(val.replaceAll('-', ' ').toUpperCase())))
                    .toList(),
                onChanged: (v) => setState(() => _selectedCategory = v!),
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _selectedCriticality,
                decoration: const InputDecoration(labelText: 'Criticality Level', border: OutlineInputBorder()),
                items: ['low', 'medium', 'high']
                    .map((val) => DropdownMenuItem(value: val, child: Text(val.toUpperCase())))
                    .toList(),
                onChanged: (v) => setState(() => _selectedCriticality = v!),
              ),
              const SizedBox(height: 16),

              DropdownButtonFormField<String>(
                value: _selectedFrequency,
                decoration: const InputDecoration(labelText: 'Frequency', border: OutlineInputBorder()),
                items: ['daily', 'twice', 'weekly']
                    .map((val) => DropdownMenuItem(value: val, child: Text(val.toUpperCase())))
                    .toList(),
                onChanged: (v) => setState(() => _selectedFrequency = v!),
              ),
              const SizedBox(height: 24),

              ElevatedButton(
                onPressed: _submitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1E3A8A),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: _submitting
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Text(isEditing ? 'Update Medication' : 'Add Medication'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
