import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/medicine_provider.dart';

class AddMedicineScreen extends StatefulWidget {
  final String patientId;
  const AddMedicineScreen({super.key, required this.patientId});

  @override
  State<AddMedicineScreen> createState() => _AddMedicineScreenState();
}

class _AddMedicineScreenState extends State<AddMedicineScreen> {
  final _formKey = GlobalKey<FormState>();
  final _drugNameController = TextEditingController();
  final _dosageController = TextEditingController();
  
  String _selectedFoodTiming = 'before-food'; // 'before-food' | 'after-food'
  String _selectedCategory = 'other';
  String _selectedCriticality = 'low';
  String _selectedFrequency = 'daily';
  
  TimeOfDay _selectedTime = const TimeOfDay(hour: 8, minute: 0);
  bool _submitting = false;

  @override
  void dispose() {
    _drugNameController.dispose();
    _dosageController.dispose();
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
      await provider.addMedication(
        patientId: widget.patientId,
        drugName: _drugNameController.text,
        dosage: _dosageController.text,
        foodTiming: _selectedFoodTiming,
        category: _selectedCategory,
        criticality: _selectedCriticality,
        scheduleTime: formattedTime,
        frequency: _selectedFrequency,
      );
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to add medicine: $e')),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  String get formattedMinute => _selectedTime.minute.toString().padLeft(2, '0');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add Medication'),
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
              TextFormField(
                controller: _drugNameController,
                decoration: const InputDecoration(
                  labelText: 'Drug Name (e.g. Metformin)',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => v == null || v.trim().isEmpty ? 'Please enter drug name' : null,
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _dosageController,
                decoration: const InputDecoration(
                  labelText: 'Dosage (e.g. 500mg)',
                  border: OutlineInputBorder(),
                ),
                validator: (v) => v == null || v.trim().isEmpty ? 'Please enter dosage info' : null,
              ),
              const SizedBox(height: 16),

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
                    : const Text('Add Medication'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
