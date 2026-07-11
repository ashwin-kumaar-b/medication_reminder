import 'package:flutter/material.dart';
import '../services/api_service.dart';

class FoodCheckerScreen extends StatefulWidget {
  const FoodCheckerScreen({super.key});

  @override
  State<FoodCheckerScreen> createState() => _FoodCheckerScreenState();
}

class _FoodCheckerScreenState extends State<FoodCheckerScreen> {
  final _foodController = TextEditingController();
  final _drugController = TextEditingController();

  bool _loading = false;
  String? _error;
  String? _usdaFoodMatch;
  String? _aiFeedback;

  @override
  void dispose() {
    _foodController.dispose();
    _drugController.dispose();
    super.dispose();
  }

  Future<void> _checkFoodCompatibility() async {
    final food = _foodController.text.trim();
    final drug = _drugController.text.trim();

    if (food.isEmpty || drug.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please fill both fields')),
      );
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _usdaFoodMatch = null;
      _aiFeedback = null;
    });

    try {
      // 1. Search food via USDA
      final usdaRes = await ApiService.searchUsdaFood(food);
      final firstFood = usdaRes != null && usdaRes['foods'] != null && usdaRes['foods'].isNotEmpty
          ? usdaRes['foods'][0]['description']
          : null;

      if (firstFood != null) {
        setState(() => _usdaFoodMatch = firstFood);
      }

      // 2. Generate compatibility advice
      final prompt = [
        'You are a clinical safety assistant for a medication reminder app.',
        'Analyze the food-drug compatibility between the food "$food" (USDA matched: ${firstFood ?? "N/A"}) and the medication "$drug".',
        'Determine if they can be taken together and state if there are any timing restrictions.',
        'Provide your response in a short, patient-friendly paragraph.'
      ].join('\n');

      final aiRes = await ApiService.getGroqCompletion({
        'model': 'llama-3.1-8b-instant',
        'temperature': 0.2,
        'max_tokens': 200,
        'messages': [
          {'role': 'system', 'content': 'You are a concise medication safety advisor.'},
          {'role': 'user', 'content': prompt}
        ]
      });

      if (aiRes != null && aiRes['choices'] != null && aiRes['choices'].isNotEmpty) {
        setState(() {
          _aiFeedback = aiRes['choices'][0]['message']['content'];
        });
      } else {
        setState(() => _error = 'Failed to fetch compatibility details.');
      }
    } catch (e) {
      setState(() => _error = 'Analysis failed: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Food Compatibility Checker'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _foodController,
              decoration: const InputDecoration(
                labelText: 'Food Product (e.g. Grapefruit Juice)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),

            TextField(
              controller: _drugController,
              decoration: const InputDecoration(
                labelText: 'Medication (e.g. Simvastatin)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 20),

            ElevatedButton(
              onPressed: _loading ? null : _checkFoodCompatibility,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1E3A8A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    )
                  : const Text('Check Compatibility'),
            ),
            const SizedBox(height: 24),

            if (_error != null)
              Text(_error!, style: const TextStyle(color: Colors.red))
            else ...[
              if (_usdaFoodMatch != null) ...[
                Text(
                  'USDA Food Match: $_usdaFoodMatch',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.blueGrey),
                ),
                const SizedBox(height: 12),
              ],
              if (_aiFeedback != null) ...[
                const Text(
                  'Clinical Analysis:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E3A8A)),
                ),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Text(_aiFeedback!),
                  ),
                )
              ]
            ]
          ],
        ),
      ),
    );
  }
}
