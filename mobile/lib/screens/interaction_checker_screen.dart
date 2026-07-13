import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../utils/medicine_list.dart';


class InteractionCheckerScreen extends StatefulWidget {
  const InteractionCheckerScreen({super.key});

  @override
  State<InteractionCheckerScreen> createState() => _InteractionCheckerScreenState();
}

class _InteractionCheckerScreenState extends State<InteractionCheckerScreen> {
  final _drugAController = TextEditingController();
  final _drugBController = TextEditingController();
  final _focusNodeA = FocusNode();
  final _focusNodeB = FocusNode();

  bool _loading = false;
  String? _error;
  Map<String, dynamic>? _results;

  @override
  void dispose() {
    _drugAController.dispose();
    _drugBController.dispose();
    _focusNodeA.dispose();
    _focusNodeB.dispose();
    super.dispose();
  }

  Future<void> _checkInteractions() async {
    final drugA = _drugAController.text.trim();
    final drugB = _drugBController.text.trim();

    if (drugA.isEmpty || drugB.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter both drug names')),
      );
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
      _results = null;
    });

    try {
      // 1. Resolve brand names to generic names using RxNav database helper
      final genericA = await ApiService.getGenericName(drugA);
      final genericB = await ApiService.getGenericName(drugB);

      // 2. Prepare AI prompt instructing it to resolve and analyze
      final prompt = [
        'You are a clinical safety assistant for a medication reminder app.',
        'Provide a drug-to-drug interaction analysis between two medications.',
        'The user entered: "$drugA" and "$drugB".',
        'Our database mapped these to active ingredients: "$genericA" and "$genericB".',
        'If either of these are brand names (including local brand names from other countries like India, e.g. Dolo 650, Crocin, Calpol, Combiflam), please resolve them to their active generic chemical names.',
        'Return only JSON with this exact shape:',
        '{"severity":"high|moderate|low|safe|none","directive":"AVOID COMBINATION or CHOOSE ALTERNATIVE or MONITOR CLOSELY or SAFE","genericA":"resolved active chemical of $drugA","genericB":"resolved active chemical of $drugB","summary":"...","explanation":"...","recommendations":["..."],"cautions":["..."]}'
      ].join('\n');

      // Dispatch request to backend Groq completion proxy
      final res = await ApiService.getGroqCompletion({
        'model': 'llama-3.1-8b-instant',
        'temperature': 0.2,
        'max_tokens': 400,
        'response_format': {'type': 'json_object'},
        'messages': [
          {'role': 'system', 'content': 'You are a careful medication safety assistant. Return strict JSON only.'},
          {'role': 'user', 'content': prompt}
        ]
      });

      if (res != null && res['choices'] != null && res['choices'].isNotEmpty) {
        final text = res['choices'][0]['message']['content'];
        setState(() {
          if (text is String) {
            final cleaned = text.replaceAll(RegExp(r'```json|```'), '').trim();
            _results = Map<String, dynamic>.from(json.decode(cleaned));
          } else {
            _results = {};
          }
        });
      } else {
        setState(() => _error = 'No response received from AI safety engine.');
      }
    } catch (e) {
      setState(() => _error = 'Failed to analyze: $e');
    } finally {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('AI Interaction Checker'),
        backgroundColor: const Color(0xFF1E3A8A),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Card(
              color: Color(0xFFF0FDF4),
              child: Padding(
                padding: EdgeInsets.all(12.0),
                child: Row(
                  children: [
                    Icon(Icons.shield_outlined, color: Colors.green),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Check potential drug-drug conflicts using our secure AI Risk Evaluator.',
                        style: TextStyle(fontSize: 13, color: Color(0xFF166534)),
                      ),
                    )
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            RawAutocomplete<String>(
              textEditingController: _drugAController,
              focusNode: _focusNodeA,
              optionsBuilder: (TextEditingValue textEditingValue) async {
                return await ApiService.getDrugSuggestions(textEditingValue.text);
              },
              fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                return TextField(
                  controller: controller,
                  focusNode: focusNode,
                  decoration: const InputDecoration(
                    labelText: 'Primary Medication',
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
            const SizedBox(height: 16),

            RawAutocomplete<String>(
              textEditingController: _drugBController,
              focusNode: _focusNodeB,
              optionsBuilder: (TextEditingValue textEditingValue) async {
                return await ApiService.getDrugSuggestions(textEditingValue.text);
              },
              fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
                return TextField(
                  controller: controller,
                  focusNode: focusNode,
                  decoration: const InputDecoration(
                    labelText: 'Secondary Medication',
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
              onPressed: _loading ? null : _checkInteractions,
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
                  : const Text('Analyze Potential Risks'),
            ),
            const SizedBox(height: 24),

            if (_error != null)
              Text(_error!, style: const TextStyle(color: Colors.red))
            else if (_results != null) ...[
              const Text('Analysis Result:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
              const SizedBox(height: 12),
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
                                : (_results!["severity"]?.toString().toLowerCase() == 'moderate' ? Colors.orange[50] : Colors.blue[50]),
                            borderRadius: BorderRadius.circular(8.0),
                            border: Border.all(
                              color: _results!["severity"]?.toString().toLowerCase() == 'high' 
                                  ? Colors.red 
                                  : (_results!["severity"]?.toString().toLowerCase() == 'moderate' ? Colors.orange : Colors.blue),
                              width: 1.5,
                            ),
                          ),
                          child: Text(
                            _results!["directive"].toString().toUpperCase(),
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: _results!["severity"]?.toString().toLowerCase() == 'high' 
                                  ? Colors.red[900] 
                                  : (_results!["severity"]?.toString().toLowerCase() == 'moderate' ? Colors.orange[900] : Colors.blue[900]),
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      if (_results!["genericA"] != null && _results!["genericB"] != null) ...[
                        Text(
                          'Active Ingredients: ${_results!["genericA"].toString().toUpperCase()} + ${_results!["genericB"].toString().toUpperCase()}',
                          style: TextStyle(color: Colors.grey[600], fontStyle: FontStyle.italic, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 12),
                      ],
                      Text('Severity: ${_results!["severity"]?.toString().toUpperCase() ?? "UNKNOWN"}',
                          style: TextStyle(
                            fontWeight: FontWeight.bold, 
                            color: _results!["severity"]?.toString().toLowerCase() == 'high' ? Colors.red : Colors.orange
                          )),
                      const SizedBox(height: 8),
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
          ],
        ),
      ),
    );
  }
}
