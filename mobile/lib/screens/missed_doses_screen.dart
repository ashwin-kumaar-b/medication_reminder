import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../providers/medicine_provider.dart';
import '../services/api_service.dart';

class MissedDosesScreen extends StatefulWidget {
  const MissedDosesScreen({super.key});

  @override
  State<MissedDosesScreen> createState() => _MissedDosesScreenState();
}

class _MissedDosesScreenState extends State<MissedDosesScreen> {
  bool _loading = false;
  String? _recoveryAdvice;

  Future<void> _fetchRecoveryAdvice(
      String drugName, String dosage, String frequency, String foodTiming, String scheduleTime) async {
    setState(() {
      _loading = true;
      _recoveryAdvice = null;
    });

    final prompt = [
      'You are a clinical safety assistant for a medication reminder app.',
      'A patient missed their dose of $drugName (dosage: $dosage, frequency: $frequency, food timing: $foodTiming, scheduled time: $scheduleTime).',
      'Provide concise, safe recovery instructions on what they should do next (e.g. should they take it now or wait for the next scheduled dose?).',
      'Ensure the tone is helpful and non-alarming.'
    ].join('\n');

    try {
      final res = await ApiService.getGroqCompletion({
        'model': 'llama-3.1-8b-instant',
        'temperature': 0.1,
        'max_tokens': 200,
        'messages': [
          {'role': 'system', 'content': 'You are a careful medication safety advisor.'},
          {'role': 'user', 'content': prompt}
        ]
      });

      if (res != null && res['choices'] != null && res['choices'].isNotEmpty) {
        setState(() {
          _recoveryAdvice = res['choices'][0]['message']['content'];
        });
      } else {
        setState(() => _recoveryAdvice = 'Unable to fetch recovery advice.');
      }
    } catch (e) {
      setState(() => _recoveryAdvice = 'Failed to load recovery advice: $e');
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
            const Card(
              color: Color(0xFFFEF2F2),
              child: Padding(
                padding: EdgeInsets.all(12.0),
                child: Row(
                  children: [
                    Icon(Icons.report_problem_outlined, color: Colors.red),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Select a medication below to retrieve clinical recovery advice on missed doses.',
                        style: TextStyle(fontSize: 13, color: Color(0xFF991B1B)),
                      ),
                    )
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            if (patientMeds.isEmpty)
              const Center(child: Text('No medications listed.'))
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: patientMeds.length,
                itemBuilder: (context, idx) {
                  final med = patientMeds[idx];
                  return Card(
                    child: ListTile(
                      title: Text(med.drugName, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('Dosage: ${med.dosage} (${med.scheduleTime})'),
                      trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                      onTap: () => _fetchRecoveryAdvice(
                        med.drugName,
                        med.dosage,
                        med.frequency,
                        med.foodTiming,
                        med.scheduleTime,
                      ),
                    ),
                  );
                },
              ),

            const SizedBox(height: 24),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (_recoveryAdvice != null) ...[
              const Text(
                'AI Recovery Advice:',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E3A8A)),
              ),
              const SizedBox(height: 8),
              Card(
                color: const Color(0xFFEFF6FF),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Text(
                    _recoveryAdvice!,
                    style: const TextStyle(height: 1.4),
                  ),
                ),
              )
            ]
          ],
        ),
      ),
    );
  }
}
