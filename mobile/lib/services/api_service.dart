import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  // Use 10.0.2.2 to point to host's localhost on Android Emulator.
  // When deploying to device, replace this with your machine's local IP (e.g., 192.168.x.x) or domain.
  static const String baseUrl = 'http://10.0.2.2:5000';

  // Base status check
  static Future<Map<String, dynamic>> getStatus() async {
    final response = await http.get(Uri.parse('$baseUrl/api/status'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Failed to reach backend: ${response.statusCode}');
  }

  // Users API
  static Future<List<dynamic>> getUsers() async {
    final response = await http.get(Uri.parse('$baseUrl/api/users'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Failed to load users');
  }

  static Future<Map<String, dynamic>> upsertUser({
    required Map<String, dynamic> userPayload,
    Map<String, dynamic>? healthPayload,
    Map<String, dynamic>? caretakerPayload,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/users/upsert'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'userPayload': userPayload,
        'healthPayload': healthPayload,
        'caretakerPayload': caretakerPayload,
      }),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception(response.body);
  }

  // Caretaker Links
  static Future<List<dynamic>> getCaretakerPatients() async {
    final response = await http.get(Uri.parse('$baseUrl/api/caretaker-patients'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Failed to load caretaker patients');
  }

  static Future<Map<String, dynamic>> upsertCaretakerPatient(
    String caretakerId,
    String patientId,
  ) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/caretaker-patients/upsert'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'caretaker_id': caretakerId,
        'patient_id': patientId,
      }),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception(response.body);
  }

  static Future<Map<String, dynamic>> deleteCaretakerPatient(String patientId) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/caretaker-patients/delete'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'patient_id': patientId}),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception(response.body);
  }

  // Medications API
  static Future<List<dynamic>> getMedications() async {
    final response = await http.get(Uri.parse('$baseUrl/api/medications'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Failed to load medications');
  }

  static Future<Map<String, dynamic>> upsertMedication(Map<String, dynamic> medicationData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/medications/upsert'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(medicationData),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception(response.body);
  }

  static Future<Map<String, dynamic>> deleteMedication(String id) async {
    final response = await http.delete(Uri.parse('$baseUrl/api/medications/$id'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception(response.body);
  }

  // Dose Logs API
  static Future<List<dynamic>> getLogs() async {
    final response = await http.get(Uri.parse('$baseUrl/api/logs'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Failed to load logs');
  }

  static Future<Map<String, dynamic>> upsertLog(Map<String, dynamic> logData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/logs/upsert'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(logData),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception(response.body);
  }

  // Notifications API
  static Future<List<dynamic>> getNotifications() async {
    final response = await http.get(Uri.parse('$baseUrl/api/notifications'));
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception('Failed to load notifications');
  }

  static Future<Map<String, dynamic>> upsertNotification(Map<String, dynamic> notificationData) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/notifications/upsert'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(notificationData),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    throw Exception(response.body);
  }

  // USDA Food Search Proxy
  static Future<Map<String, dynamic>?> searchUsdaFood(String query) async {
    final response = await http.get(
      Uri.parse('$baseUrl/api/medication-apis/usda/search?query=${Uri.encodeComponent(query)}'),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    return null;
  }

  // Groq Chat Completions Proxy
  static Future<Map<String, dynamic>?> getGroqCompletion(Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/medication-apis/groq/chat/completions'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );
    print("getGroqCompletion status: ${response.statusCode}");
    print("getGroqCompletion body: ${response.body}");
    if (response.statusCode == 200) {
      final decoded = json.decode(response.body);
      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      } else if (decoded is String) {
        final doubleDecoded = json.decode(decoded);
        if (doubleDecoded is Map) {
          return Map<String, dynamic>.from(doubleDecoded);
        }
      }
    }
    return null;
  }

  // Gemini Content Proxy
  static Future<Map<String, dynamic>?> getGeminiContent(Map<String, dynamic> body) async {
    final response = await http.post(
      Uri.parse('$baseUrl/api/medication-apis/gemini/generateContent'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(body),
    );
    if (response.statusCode == 200) {
      return json.decode(response.body);
    }
    return null;
  }

  // RxNav API helper to resolve brand name to generic name
  static Future<String> getGenericName(String brandName) async {
    final url = Uri.parse('https://rxnav.nlm.nih.gov/REST/drugs.json?name=${Uri.encodeComponent(brandName)}');
    try {
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final conceptGroup = data['drugGroup']?['conceptGroup'];
        if (conceptGroup != null) {
          for (var group in conceptGroup) {
            final conceptProperties = group['conceptProperties'];
            if (conceptProperties != null && conceptProperties.isNotEmpty) {
              final String fullName = conceptProperties[0]['name'];
              final String genericName = fullName.split(' ')[0].toLowerCase();
              return genericName;
            }
          }
        }
      }
    } catch (e) {
      print("Error fetching generic name from RxNav: $e");
    }
    return brandName.toLowerCase();
  }

  // Fetch real-time drug suggestions using NLM RxTerms API
  static Future<List<String>> getDrugSuggestions(String query) async {
    if (query.trim().length < 2) return [];
    final url = Uri.parse('https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${Uri.encodeComponent(query)}');
    try {
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        if (data is List && data.length > 1 && data[1] is List) {
          return List<String>.from(data[1]);
        }
      }
    } catch (e) {
      print("Error fetching drug suggestions: $e");
    }
    return [];
  }
}
