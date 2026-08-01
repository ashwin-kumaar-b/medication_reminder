import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medicine_provider.dart';
import '../models/medication.dart';
import '../services/api_service.dart';

class MissedDosesScreen extends StatefulWidget {
  const MissedDosesScreen({super.key});

  @override
  State<MissedDosesScreen> createState() => _MissedDosesScreenState();
}

class _MissedDosesScreenState extends State<MissedDosesScreen> {
  bool _loading = false;
  Medication? _selectedMedication;
  double _customHoursOverdue = 1.0;
  Map<String, dynamic>? _adviceJson;

  double _calculateHoursOverdue(String scheduleTime) {
    try {
      final now = DateTime.now();
      final parts = scheduleTime.split(':');
      if (parts.length != 2) return 1.0;

      final schedHour = int.parse(parts[0]);
      final schedMin = int.parse(parts[1]);

      var schedTimeToday = DateTime(now.year, now.month, now.day, schedHour, schedMin);

      // If the scheduled time is in the future today, they missed the dose from yesterday
      if (schedTimeToday.isAfter(now)) {
        schedTimeToday = schedTimeToday.subtract(const Duration(days: 1));
      }

      final diff = now.difference(schedTimeToday);
      final hours = diff.inMinutes / 60.0;
      // Round and clamp between 0.5 and 24.0 hours
      final roundedHours = double.parse(hours.toStringAsFixed(1));
      return roundedHours.clamp(0.5, 24.0);
    } catch (e) {
      debugPrint('Failed to calculate hours overdue: $e');
      return 1.0;
    }
  }

  void _onMedicationSelected(Medication med) {
    final computedHours = _calculateHoursOverdue(med.scheduleTime);
    setState(() {
      _selectedMedication = med;
      _customHoursOverdue = computedHours;
      _adviceJson = null;
    });
  }

  Future<void> _fetchRecoveryAdvice(Medication med) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final user = auth.currentUser!;

    setState(() {
      _loading = true;
      _adviceJson = null;
    });

    final prompt = [
      'You are an expert clinical safety assistant for a medication reminder application.',
      'A patient missed their dose of ${med.drugName}.',
      'Medication details:',
      '- Name: ${med.drugName} (generic: ${med.genericName ?? "not specified"})',
      '- Dosage: ${med.dosage}',
      '- Frequency: ${med.frequency}',
      '- Criticality: ${med.criticality}',
      '- Food timing: ${med.foodTiming}',
      '- Scheduled time: ${med.scheduleTime}',
      '- Hours late: $_customHoursOverdue hours (elapsed since scheduled time)',
      'Patient health profile:',
      '- Chronic conditions: ${user.chronicDiseases.join(", ")}',
      '- Allergies: ${user.allergies.map((a) => "${a['category']}: ${a['trigger']}").join(", ")}',
      '',
      'You must evaluate the clinical safety using these rules and criteria:',
      '1. COMBINED ANALYSIS: Analyze the specific drug class (e.g. anticoagulant, beta-blocker, hypoglycemic, vitamin) in relation to the patient\'s actual chronic diseases, allergies, and the delay duration ($_customHoursOverdue hours late).',
      '2. NO HALLUCINATION: Only connect the patient\'s chronic diseases to the medication if there is a direct clinical relationship (e.g. Warfarin is not for diabetes, so do not claim it treats diabetes or that diabetes is the main reason to skip it. Metformin or Insulin, however, are directly for diabetes). Do not state that a medication treats or affects a condition unless it is medically true.',
      '3. INTERVAL & DELAY RULE:',
      '   - Use your medical knowledge of the specific drug class (e.g. anticoagulants, insulin, beta-blockers, vitamins, etc.) to determine the clinical grace period (safe delay window) for this specific frequency and medication.',
      '   - For non-critical medications (e.g., vitamins, standard allergy meds, mild symptom relievers), the grace period is typically wide. If the delay is well within the clinically accepted safe window for this specific drug, recommend "take_now".',
      '   - For critical medications (e.g., blood thinners, insulin, cardiac medications) or where the patient has severe chronic conditions, the safety window is narrow. A delay of even a few hours may exceed the safe window.',
      '4. CRITICALITY & ACTION CLASSIFICATION (status):',
      '   - "take_now": Recommend this if the delay is within the medically accepted safe window for this specific drug, and taking it now will not cause dangerous drug accumulation or toxicity before the next dose.',
      '   - "contact_doctor": Recommend this if the delay is borderline (near the boundary of the safe window for this specific drug), or if the drug is highly critical and the delay creates clinical uncertainty, or if the patient\'s underlying chronic conditions make a missed dose high risk. DO NOT bypass this and jump to a simple "skip" or "take_now" if consulting a professional is the safest choice.',
      '   - "skip": Recommend this if the delay has exceeded the safe grace period for this specific drug (typically when it is close to the next scheduled dose) and taking it now would create a dangerous risk of double-dosing, toxicity, or adverse accumulation.',
      '5. EXPLAIN THE RISK OF MISSING: If the medication is critical or the condition is serious, you MUST explicitly explain in the "rationale" and "doctor_warning" what specific physical dangers result from MISSING the dose (e.g., increased risk of stroke/blood clots for blood thinners like Warfarin, severe blood sugar spikes for insulin, sudden blood pressure rebound/stroke for cardiac meds). Do not just focus on the risks of taking it late.',
      '6. ALLERGY CHECK: Check if any patient allergy category/trigger matches or cross-reacts with the drug. If an allergy exists, recommend "skip" or "contact_doctor" and explain the allergy risk clearly.',
      '',
      'You must return a JSON object with this exact shape:',
      '{',
      '  "status": "take_now" | "skip" | "contact_doctor",',
      '  "action": "Take Missed Dose Now" | "Skip Missed Dose & Wait" | "Contact Doctor / Pharmacist",',
      '  "rationale": "A clear, clinical explanation. It must analyze the specific drug, the hours late ($_customHoursOverdue hrs), and the patient\'s medical conditions/allergies. It must detail the specific risk of MISSING the dose (e.g. stroke risk for blood thinners) as well as the safety of the current timing, avoiding any false/hallucinated connections between unrelated conditions.",',
      '  "next_dose_instructions": "Specific guidance on when and how to take the next scheduled dose, which must be calculated based on the medication\'s scheduled time (${med.scheduleTime}) and frequency (${med.frequency}) (e.g. if frequency is Daily and scheduled time is ${med.scheduleTime}, the next dose is at ${med.scheduleTime} tomorrow; do not fabricate a random time), emphasizing not to double the dose.",',
      '  "precautions": [',
      '    "First clinical safety precaution or guideline.",',
      '    "Second precaution or guideline."',
      '  ],',
      '  "doctor_warning": "Urgent warning signs or symptoms to watch out for due to missing this dose (e.g., signs of blood clots/stroke for Warfarin, hyperglycemia for insulin), and when to seek emergency care."',
      '}'
    ].join('\n');

    try {
      final res = await ApiService.getGroqCompletion({
        'model': 'llama-3.3-70b-versatile',
        'temperature': 0.15,
        'max_tokens': 450,
        'response_format': {'type': 'json_object'},
        'messages': [
          {'role': 'system', 'content': 'You are a careful clinical safety assistant. You must return strict JSON.'},
          {'role': 'user', 'content': prompt}
        ]
      });

      if (res != null && res['choices'] != null && res['choices'].isNotEmpty) {
        final content = res['choices'][0]['message']['content'];
        if (content is String) {
          final cleaned = content.replaceAll(RegExp(r'```json|```'), '').trim();
          setState(() {
            _adviceJson = Map<String, dynamic>.from(json.decode(cleaned));
          });
        } else {
          throw Exception('Invalid API response structure');
        }
      } else {
        throw Exception('No response choices returned');
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to load clinical advice: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final medicine = Provider.of<MedicineProvider>(context);
    final user = auth.currentUser!;
    final patientMeds = medicine.medications.where((m) => m.patientId == user.id).toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Missed Dose Advice'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Clinical warning guide banner
            Container(
              padding: const EdgeInsets.all(12.0),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFDE68A), width: 1),
              ),
              child: Row(
                children: [
                  Icon(Icons.report_problem_rounded, color: Colors.amber[700]),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'AI clinical recovery advice is determined based on how overdue the medication is. Enter details below carefully.',
                      style: TextStyle(fontSize: 12.5, color: Color(0xFF78350F), fontWeight: FontWeight.w500),
                    ),
                  )
                ],
              ),
            ),
            const SizedBox(height: 16),

            const Text(
              'Select Medication:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E3A8A)),
            ),
            const SizedBox(height: 8),

            if (patientMeds.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(24.0),
                  child: Text('No medications registered yet.', textAlign: TextAlign.center),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: patientMeds.length,
                itemBuilder: (context, idx) {
                  final med = patientMeds[idx];
                  final isSelected = _selectedMedication?.id == med.id;

                  return Card(
                    color: isSelected ? const Color(0xFFEFF6FF) : Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(
                        color: isSelected ? const Color(0xFF2563EB) : Colors.grey[200]!,
                        width: isSelected ? 1.5 : 1,
                      ),
                    ),
                    child: ListTile(
                      title: Text(med.drugName, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('Dosage: ${med.dosage} (${med.scheduleTime}) • ${med.frequency}'),
                      trailing: Icon(
                        isSelected ? Icons.check_circle_rounded : Icons.radio_button_off_rounded,
                        color: isSelected ? const Color(0xFF2563EB) : Colors.grey[400],
                      ),
                      onTap: () => _onMedicationSelected(med),
                    ),
                  );
                },
              ),

            // Delay Details & Form Input
            if (_selectedMedication != null) ...[
              const SizedBox(height: 24),
              Card(
                elevation: 1,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: Colors.grey[100]!),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Time Overdue Analysis: ${_selectedMedication!.drugName}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Color(0xFF1E3A8A)),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Scheduled Time:'),
                          Text(
                            _selectedMedication!.scheduleTime,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Hours Overdue:'),
                          Text(
                            '${_customHoursOverdue.toStringAsFixed(1)} hours late',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueAccent),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Adjust delay hours (if you remembered earlier):',
                        style: TextStyle(fontSize: 12.5, color: Colors.grey),
                      ),
                      Row(
                        children: [
                          Text('0.5 hr', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                          Expanded(
                            child: Slider(
                              value: _customHoursOverdue,
                              min: 0.5,
                              max: 24.0,
                              divisions: 47,
                              label: '${_customHoursOverdue.toStringAsFixed(1)} hrs',
                              onChanged: (val) {
                                setState(() {
                                  _customHoursOverdue = val;
                                  _adviceJson = null; // Clear old advice when parameters change
                                });
                              },
                            ),
                          ),
                          Text('24.0 hrs', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ElevatedButton(
                        onPressed: _loading ? null : () => _fetchRecoveryAdvice(_selectedMedication!),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1E3A8A),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: _loading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Text('Get AI Recovery Advice', style: TextStyle(fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
              ),
            ],

            // Display AI structured JSON Advice Card
            if (_adviceJson != null) ...[
              const SizedBox(height: 24),
              _buildAdviceCard(context),
            ],
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildAdviceCard(BuildContext context) {
    final status = _adviceJson!['status']?.toString() ?? 'skip';
    final action = _adviceJson!['action']?.toString() ?? 'Skip Missed Dose';
    final rationale = _adviceJson!['rationale']?.toString() ?? '';
    final nextDose = _adviceJson!['next_dose_instructions']?.toString() ?? '';
    final precautions = List<String>.from(_adviceJson!['precautions'] ?? []);
    final warning = _adviceJson!['doctor_warning']?.toString() ?? '';

    Color accentColor = Colors.orange;
    Color bgColor = const Color(0xFFFFF7ED);
    IconData icon = Icons.warning_amber_rounded;

    if (status == 'take_now') {
      accentColor = Colors.green[600]!;
      bgColor = const Color(0xFFF0FDF4);
      icon = Icons.check_circle_outline_rounded;
    } else if (status == 'contact_doctor') {
      accentColor = Colors.red[600]!;
      bgColor = const Color(0xFFFEF2F2);
      icon = Icons.local_hospital_rounded;
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: Colors.grey[200]!, width: 1),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(width: 6, color: accentColor),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header action row
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: accentColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Icon(icon, color: accentColor, size: 24),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'RECOMMENDED ACTION',
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.grey),
                                ),
                                Text(
                                  action,
                                  style: TextStyle(
                                    fontSize: 16.5,
                                    fontWeight: FontWeight.bold,
                                    color: accentColor,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),

                      // Rationale
                      const Text(
                        'Clinical Rationale:',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF1E293B)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        rationale,
                        style: TextStyle(fontSize: 13, color: Colors.grey[700], height: 1.45),
                      ),
                      const SizedBox(height: 14),

                      // Next Dose
                      const Text(
                        'Next Dose Instructions:',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF1E293B)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        nextDose,
                        style: TextStyle(fontSize: 13, color: Colors.grey[700], height: 1.45),
                      ),
                      const SizedBox(height: 14),

                      // Precautions Bullet Points
                      if (precautions.isNotEmpty) ...[
                        const Text(
                          'Safety Guidelines & Precautions:',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13.5, color: Color(0xFF1E293B)),
                        ),
                        const SizedBox(height: 6),
                        ...precautions.map((p) => Padding(
                              padding: const EdgeInsets.only(bottom: 6.0),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(Icons.shield_outlined, size: 14, color: Colors.blue[600]),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      p,
                                      style: TextStyle(fontSize: 12.5, color: Colors.grey[700], height: 1.35),
                                    ),
                                  ),
                                ],
                              ),
                            )),
                        const SizedBox(height: 14),
                      ],

                      // Urgent Warning
                      if (warning.trim().isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: bgColor,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: accentColor.withOpacity(0.2), width: 1),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.emergency_rounded, color: accentColor, size: 16),
                                  const SizedBox(width: 8),
                                  Text(
                                    'When to seek urgent care:',
                                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5, color: accentColor),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(
                                warning,
                                style: TextStyle(fontSize: 12, color: Colors.grey[800], height: 1.4),
                              ),
                            ],
                          ),
                        ),
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
