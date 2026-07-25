import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class AuthProvider extends ChangeNotifier {
  List<User> _users = [];
  User? _currentUser;
  List<Map<String, String>> _caretakerLinks = [];
  bool _loadingUsers = false;

  List<User> get users => _users;
  User? get currentUser => _currentUser;
  List<Map<String, String>> get caretakerLinks => _caretakerLinks;
  bool get loadingUsers => _loadingUsers;

  AuthProvider() {
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final String? userJson = prefs.getString('mediguard_user');
    if (userJson != null) {
      _currentUser = User.fromJson(json.decode(userJson));
      notifyListeners();
    }
    await loadUsers();
  }

  Future<void> loadUsers() async {
    _loadingUsers = true;
    notifyListeners();

    try {
      final remoteUsers = await ApiService.getUsers();
      _users = remoteUsers.map((u) => User.fromJson(u)).toList();

      final remoteLinks = await ApiService.getCaretakerPatients();
      _caretakerLinks = remoteLinks.map<Map<String, String>>((item) {
        return {
          'caretakerId': item['caretaker_id']?.toString() ?? '',
          'patientId': item['patient_id']?.toString() ?? '',
        };
      }).toList();
    } catch (e) {
      debugPrint('Failed to load users from backend: $e');
    } finally {
      _loadingUsers = false;
      notifyListeners();
    }
  }

  Future<void> _persistUserSession(User user) async {
    _currentUser = user;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('mediguard_user', json.encode(user.toJson()));
    notifyListeners();
  }

  // Registration
  Future<Map<String, dynamic>> register({
    required String name,
    required String phone,
    required String password,
    required String role,
    String? dateOfBirth,
    int? heightCm,
    double? weightKg,
    List<String> chronicDiseases = const [],
    List<String> infectionHistory = const [],
    List<Map<String, String>> allergies = const [],
    String? emergencyContactEmail,
    String? relation,
    String? relationOther,
    String? linkedPatientId,
  }) async {
    // Basic validations
    if (name.trim().isEmpty || phone.trim().isEmpty || password.trim().isEmpty) {
      return {'ok': false, 'error': 'Please fill all required fields.'};
    }

    final normalizedPhone = _normalizePhoneNumber(phone);
    final authEmail = _buildAuthEmailFromPhone(normalizedPhone);

    final String userId = const HtmlCrypto().randomUuid();
    final String? patientId = role == 'patient' ? _generatePatientId() : null;
    final String? caretakerId = role == 'caretaker' ? _generateCaretakerId() : null;

    final User newUser = User(
      id: userId,
      patientId: patientId,
      caretakerId: caretakerId,
      name: name.trim(),
      email: authEmail,
      phoneNumber: normalizedPhone,
      password: password,
      role: role,
      relation: relation,
      relationOther: relationOther,
      chronicDiseases: chronicDiseases,
      infectionHistory: infectionHistory,
      allergies: allergies,
      emergencyContactEmail: emergencyContactEmail,
      linkedPatientId: linkedPatientId,
    );

    try {
      final userPayload = {
        'id': newUser.id,
        'name': newUser.name,
        'email': newUser.email,
        'phone': newUser.phoneNumber,
        'password': newUser.password,
        'role': newUser.role,
        'ui_mode': newUser.uiMode,
        'patient_id': newUser.patientId,
        'caretaker_id': newUser.caretakerId,
      };

      Map<String, dynamic>? healthPayload;
      if (role == 'patient') {
        healthPayload = {
          'user_id': newUser.id,
          'gender': newUser.gender ?? 'Not specified',
          'blood_group': newUser.bloodGroup ?? 'O+',
          'date_of_birth': dateOfBirth ?? '1990-01-01',
          'height_cm': heightCm ?? 170,
          'weight_kg': weightKg ?? 70.0,
          'chronic_diseases': chronicDiseases,
          'infection_history': infectionHistory,
          'allergies': allergies,
          'emergency_contact_email': emergencyContactEmail ?? '',
        };
      }

      Map<String, dynamic>? caretakerPayload;
      if (role == 'caretaker') {
        caretakerPayload = {
          'user_id': newUser.id,
          'relation': relation ?? 'Other',
          'relation_other': relationOther,
          'linked_patient_id': linkedPatientId,
        };
      }

      await ApiService.upsertUser(
        userPayload: userPayload,
        healthPayload: healthPayload,
        caretakerPayload: caretakerPayload,
      );

      if (role == 'caretaker' && linkedPatientId != null && linkedPatientId.trim().isNotEmpty) {
        await ApiService.upsertCaretakerPatient(newUser.id, linkedPatientId);
      }

      await loadUsers();
      await _persistUserSession(newUser);
      return {'ok': true, 'user': newUser};
    } catch (e) {
      return {'ok': false, 'error': 'Signup failed: $e'};
    }
  }

  // Create Patient for Caretaker
  Future<Map<String, dynamic>> createPatientForCaretaker(
    String caretakerId,
    String patientName,
    String patientEmail,
    String patientPassword,
    int patientAge,
    String? patientIllness,
  ) async {
    if (patientName.trim().isEmpty || patientEmail.trim().isEmpty || patientPassword.trim().isEmpty) {
      return {'ok': false, 'error': 'Please fill all required patient fields.'};
    }

    final String userId = const HtmlCrypto().randomUuid();
    final String pId = _generatePatientId();

    final User newPatient = User(
      id: userId,
      patientId: pId,
      name: patientName.trim(),
      email: patientEmail.trim().toLowerCase(),
      password: patientPassword,
      role: 'patient',
      age: patientAge,
      illness: patientIllness,
      chronicDiseases: patientIllness != null && patientIllness.trim().isNotEmpty ? [patientIllness.trim()] : ['None'],
    );

    try {
      final userPayload = {
        'id': newPatient.id,
        'name': newPatient.name,
        'email': newPatient.email,
        'password': newPatient.password,
        'role': newPatient.role,
        'ui_mode': newPatient.uiMode,
        'patient_id': newPatient.patientId,
      };

      final healthPayload = {
        'user_id': newPatient.id,
        'gender': 'Not specified',
        'blood_group': 'O+',
        'date_of_birth': '1990-01-01',
        'height_cm': 170,
        'weight_kg': 70.0,
        'chronic_diseases': newPatient.chronicDiseases,
        'infection_history': const ['None'],
        'allergies': const [],
        'emergency_contact_email': '',
      };

      await ApiService.upsertUser(userPayload: userPayload, healthPayload: healthPayload);
      await ApiService.upsertCaretakerPatient(caretakerId, newPatient.id);

      await loadUsers();
      return {'ok': true, 'user': newPatient};
    } catch (e) {
      return {'ok': false, 'error': 'Failed to add patient: $e'};
    }
  }

  // Login
  Future<Map<String, dynamic>> login(String phone, String password) async {
    final normalizedPhone = _normalizePhoneNumber(phone);
    final authEmail = _buildAuthEmailFromPhone(normalizedPhone);

    try {
      await loadUsers();
      final matched = _users.firstWhere(
        (u) =>
            (_normalizePhoneNumber(u.phoneNumber ?? '') == normalizedPhone || u.email.toLowerCase() == authEmail) &&
            u.password == password,
        orElse: () => throw Exception('User not found'),
      );

      await _persistUserSession(matched);
      return {'ok': true, 'user': matched};
    } catch (e) {
      return {'ok': false, 'error': 'Mobile number is not registered or password is incorrect.'};
    }
  }

  // Logout
  Future<void> logout() async {
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('mediguard_user');
    notifyListeners();
  }

  // Link existing patient by ID
  Future<Map<String, dynamic>> linkExistingPatient(String caretakerId, String patientMgpId) async {
    final mgpId = patientMgpId.trim().toUpperCase();
    if (!mgpId.startsWith('MGP-')) {
      return {'ok': false, 'error': 'Invalid ID. It should start with MGP-'};
    }

    try {
      final targetPatient = _users.firstWhere(
        (u) => u.patientId == mgpId && u.role == 'patient',
        orElse: () => throw Exception('Patient not found'),
      );

      final caretaker = _currentUser;
      if (caretaker == null) throw Exception('Caretaker session not found');

      final isAlreadyLinked = _caretakerLinks.any(
        (link) => link['caretakerId'] == caretakerId && link['patientId'] == targetPatient.id,
      );
      if (isAlreadyLinked) {
        return {'ok': false, 'error': 'Patient is already linked to your account.'};
      }

      final String notifId = const HtmlCrypto().randomUuid();
      final String timestamp = DateTime.now().toIso8601String();
      final String caretakerPhone = caretaker.phoneNumber ?? 'None';

      final notificationPayload = {
        'id': notifId,
        'patient_id': targetPatient.id,
        'caretaker_id': caretakerId,
        'level': 'yellow',
        'type': 'caretaker-alert',
        'title': 'Caretaker Link Request',
        'message': '${caretaker.name} (Phone: $caretakerPhone, Email: ${caretaker.email}) wants to link as your caretaker.',
        'dedupe_key': 'caretaker-request-$caretakerId-${targetPatient.id}',
        'created_at': timestamp,
      };

      await ApiService.upsertNotification(notificationPayload);
      return {'ok': true, 'requestSent': true, 'patient': targetPatient};
    } catch (e) {
      return {'ok': false, 'error': 'Failed to link: $e'};
    }
  }

  // Disconnect links & change patient ID
  Future<String> regeneratePatientId(String userId) async {
    final newPId = _generatePatientId();
    try {
      await ApiService.deleteCaretakerPatient(userId);
      
      final matchedIndex = _users.indexWhere((u) => u.id == userId);
      if (matchedIndex != -1) {
        final current = _users[matchedIndex];
        final updatedUser = User(
          id: current.id,
          patientId: newPId,
          name: current.name,
          email: current.email,
          phoneNumber: current.phoneNumber,
          password: current.password,
          role: current.role,
          uiMode: current.uiMode,
        );

        final userPayload = {
          'id': updatedUser.id,
          'name': updatedUser.name,
          'email': updatedUser.email,
          'phone': updatedUser.phoneNumber,
          'password': updatedUser.password,
          'role': updatedUser.role,
          'patient_id': newPId,
        };

        await ApiService.upsertUser(userPayload: userPayload);
        if (_currentUser?.id == userId) {
          await _persistUserSession(updatedUser);
        }
      }
      await loadUsers();
    } catch (e) {
      debugPrint('Failed to regenerate patient ID: $e');
    }
    return newPId;
  }

  // Get linked patients for caretaker
  List<User> getLinkedPatientsForCaretaker(String caretakerId) {
    final List<String> linkedIds = _caretakerLinks
        .where((link) => link['caretakerId'] == caretakerId)
        .map((link) => link['patientId']!)
        .toList();

    return _users.where((u) => linkedIds.contains(u.id)).toList();
  }

  // Helper utils
  String _normalizePhoneNumber(String phone) {
    String cleaned = phone.replaceAll(RegExp(r'\s+'), '');
    if (cleaned.startsWith('0')) {
      cleaned = '+91${cleaned.substring(1)}'; // Default to +91 country code fallback
    }
    if (!cleaned.startsWith('+')) {
      cleaned = '+$cleaned';
    }
    return cleaned;
  }

  String _buildAuthEmailFromPhone(String phone) {
    return '${phone.replaceAll('+', '')}@mediguard.phone';
  }

  String _generatePatientId() {
    final rng = Random();
    final code = rng.nextInt(900000) + 100000;
    return 'MGP-$code';
  }

  String _generateCaretakerId() {
    final rng = Random();
    final code = rng.nextInt(900000) + 100000;
    return 'MGC-$code';
  }
}

class HtmlCrypto {
  const HtmlCrypto();
  String randomUuid() {
    final rng = Random();
    final bytes = List<int>.generate(16, (i) => rng.nextInt(256));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    
    final buffer = StringBuffer();
    for (int i = 0; i < 16; i++) {
      if (i == 4 || i == 6 || i == 8 || i == 10) {
        buffer.write('-');
      }
      buffer.write(bytes[i].toRadixString(16).padLeft(2, '0'));
    }
    return buffer.toString();
  }
}
