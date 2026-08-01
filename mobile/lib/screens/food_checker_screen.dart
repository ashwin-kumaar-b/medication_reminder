import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/medicine_list.dart';

class FoodCheckerScreen extends StatefulWidget {
  const FoodCheckerScreen({super.key});

  @override
  State<FoodCheckerScreen> createState() => _FoodCheckerScreenState();
}

class _FoodCheckerScreenState extends State<FoodCheckerScreen> {
  final _foodController = TextEditingController();
  final _drugController = TextEditingController();
  final _focusNodeDrug = FocusNode();

  bool _loading = false;
  String? _error;
  String? _usdaFoodMatch;
  Map<String, dynamic>? _results;

  @override
  void dispose() {
    _foodController.dispose();
    _drugController.dispose();
    _focusNodeDrug.dispose();
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
      _results = null;
    });

    try {
      // 1. Search food via USDA database
      final usdaRes = await ApiService.searchUsdaFood(food);
      final firstFood = usdaRes != null && usdaRes['foods'] != null && usdaRes['foods'].isNotEmpty
          ? usdaRes['foods'][0]['description']
          : null;

      if (firstFood != null) {
        setState(() => _usdaFoodMatch = firstFood);
      }

      // 2. Resolve brand name to generic name using RxNav
      final genericDrug = await ApiService.getGenericName(drug);

      // 3. Generate compatibility advice
      final prompt = [
        'You are a clinical safety assistant for a medication reminder app.',
        'Analyze the food-drug compatibility between the food "$food" (USDA matched: ${firstFood ?? "N/A"}) and the medication "$drug".',
        'Our database resolved "$drug" to the generic ingredient: "$genericDrug".',
        'If either of these are brand names, please resolve them to their generic chemical names.',
        'Determine if they can be taken together and state if there are any timing restrictions (e.g. before food, after food, avoid completely).',
        'CRITICAL RULE: For moderate (medium) risk combinations, instruct the user to limit the food or follow the timing restrictions. However, explicitly add a note in the explanation stating that ONLY IF they have no other dietary options and absolutely must consume this food, they should consult their doctor or pharmacist to discuss adjusting their medication schedule or dosage to minimize the risk.',
        'Return only JSON with this exact shape:',
        '{"severity":"high|moderate|safe","directive":"AVOID COMBINATION or LIMIT INTAKE or SAFE TO TAKE","genericDrug":"resolved active ingredient of $drug","summary":"...","explanation":"..."}'
      ].join('\n');

      final aiRes = await ApiService.getGroqCompletion({
        'model': 'llama-3.3-70b-versatile',
        'temperature': 0.2,
        'max_tokens': 300,
        'response_format': {'type': 'json_object'},
        'messages': [
          {'role': 'system', 'content': 'You are a careful medication safety advisor. Return strict JSON only.'},
          {'role': 'user', 'content': prompt}
        ]
      });

      if (aiRes != null && aiRes['choices'] != null && aiRes['choices'].isNotEmpty) {
        final text = aiRes['choices'][0]['message']['content'];
        setState(() {
          if (text is String) {
            final cleaned = text.replaceAll(RegExp(r'```json|```'), '').trim();
            _results = Map<String, dynamic>.from(json.decode(cleaned));
          } else {
            _results = {};
          }
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

            RawAutocomplete<String>(
              textEditingController: _drugController,
              focusNode: _focusNodeDrug,
              optionsBuilder: (TextEditingValue textEditingValue) async {
                return await ApiService.getDrugSuggestions(textEditingValue.text);
              },
              fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                return TextField(
                  controller: controller,
                  focusNode: focusNode,
                  decoration: const InputDecoration(
                    labelText: 'Medication',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: (_) => onFieldSubmitted(),
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
              if (_results != null) ...[
                const Text(
                  'Clinical Analysis:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E3A8A)),
                ),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_results!["directive"] != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(12.0),
                            decoration: BoxDecoration(
                              color: _results!["severity"]?.toString().toLowerCase() == 'high' 
                                  ? Colors.red[50] 
                                  : (_results!["severity"]?.toString().toLowerCase() == 'moderate' ? Colors.orange[50] : Colors.green[50]),
                              borderRadius: BorderRadius.circular(8.0),
                              border: Border.all(
                                color: _results!["severity"]?.toString().toLowerCase() == 'high' 
                                    ? Colors.red 
                                    : (_results!["severity"]?.toString().toLowerCase() == 'moderate' ? Colors.orange : Colors.green),
                                width: 1.5,
                              ),
                            ),
                            child: Text(
                              _results!["directive"].toString().toUpperCase(),
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: _results!["severity"]?.toString().toLowerCase() == 'high' 
                                      ? Colors.red[900] 
                                      : (_results!["severity"]?.toString().toLowerCase() == 'moderate' ? Colors.orange[900] : Colors.green[900])),
                              textAlign: TextAlign.center,
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        if (_results!["genericDrug"] != null) ...[
                          Text(
                            'Active Ingredient: ${_results!["genericDrug"].toString().toUpperCase()}',
                            style: TextStyle(color: Colors.grey[600], fontStyle: FontStyle.italic, fontSize: 12, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 8),
                        ],
                        Text('Summary:', style: TextStyle(color: Colors.grey[700], fontWeight: FontWeight.bold)),
                        Text(_results!["summary"]?.toString() ?? 'N/A'),
                        const SizedBox(height: 12),
                        Text('Explanation:', style: TextStyle(color: Colors.grey[700], fontWeight: FontWeight.bold)),
                        Text(_results!["explanation"]?.toString() ?? 'N/A'),
                      ],
                    ),
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
