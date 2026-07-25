import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/medication.dart';
import '../models/log.dart';
import '../models/notification.dart';
import '../services/api_service.dart';
import '../services/notification_service.dart';

class MedicineProvider extends ChangeNotifier {
  List<Medication> _medications = [];
  List<DoseLog> _logs = [];
  List<NotificationEvent> _notifications = [];
  bool _loading = false;

  List<Medication> get medications => _medications;
  List<DoseLog> get logs => _logs;
  List<NotificationEvent> get notifications => _notifications;
  bool get loading => _loading;

  final NotificationService _notificationService = NotificationService();

  MedicineProvider() {
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final prefs = await SharedPreferences.getInstance();
    final String? medsJson = prefs.getString('mediguard_medications');
    if (medsJson != null) {
      final List<dynamic> decoded = json.decode(medsJson);
      _medications = decoded.map((item) => Medication.fromJson(item)).toList();
    }
    final String? logsJson = prefs.getString('mediguard_logs');
    if (logsJson != null) {
      final List<dynamic> decoded = json.decode(logsJson);
      _logs = decoded.map((item) => DoseLog.fromJson(item)).toList();
    }
    final String? notifsJson = prefs.getString('mediguard_notifications');
    if (notifsJson != null) {
      final List<dynamic> decoded = json.decode(notifsJson);
      _notifications = decoded.map((item) => NotificationEvent.fromJson(item)).toList();
    }
    notifyListeners();
    await _syncScheduledNotifications();
    await reloadData();
  }

  Future<void> reloadData() async {
    _loading = true;
    notifyListeners();

    try {
      final remoteMeds = await ApiService.getMedications();
      _medications = remoteMeds.map((item) => Medication.fromJson(item)).toList();

      final remoteLogs = await ApiService.getLogs();
      _logs = remoteLogs.map((item) => DoseLog.fromJson(item)).toList();

      final remoteNotifs = await ApiService.getNotifications();
      _notifications = remoteNotifs.map((item) => NotificationEvent.fromJson(item)).toList();

      await _saveLocalCache();
      await _syncScheduledNotifications();

      // Automatically scan for interactions on reload
      final patientIds = _medications.map((m) => m.patientId).toSet();
      for (final pId in patientIds) {
        await _checkAndNotifyInteractions(pId);
      }
    } catch (e) {
      debugPrint('Failed to sync medical data from backend: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> _saveLocalCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('mediguard_medications', json.encode(_medications.map((m) => m.toJson()).toList()));
    await prefs.setString('mediguard_logs', json.encode(_logs.map((l) => l.toJson()).toList()));
    await prefs.setString('mediguard_notifications', json.encode(_notifications.map((n) => n.toJson()).toList()));
  }

  // Sync Android/iOS alarms with current medications list
  Future<void> _syncScheduledNotifications() async {
    print('--- Starting _syncScheduledNotifications ---');
    print('Total medications to schedule: ${_medications.length}');
    try {
      print('Cancelling all existing scheduled alarms...');
      await _notificationService.cancelAllNotifications();
      print('All existing scheduled alarms cancelled successfully.');
    } catch (e) {
      print('Failed to cancel existing notifications: $e');
    }

    for (int i = 0; i < _medications.length; i++) {
      final med = _medications[i];
      final int notifId = med.id.hashCode;
      print('Processing medication [$i]: "${med.drugName}" (ID Hash: $notifId, Time: ${med.scheduleTime})');
      try {
        await _notificationService.scheduleDailyNotification(
          id: notifId,
          title: 'Medication Alert: ${med.drugName}',
          body: 'Time to take your dosage of ${med.dosage} (${med.foodTiming})',
          timeString: med.scheduleTime,
        );
        print('Successfully processed medication "$notifId"');
      } catch (e) {
        print('Error occurred while scheduling alarm for "${med.drugName}" (ID Hash: $notifId): $e');
      }
    }
    print('--- Finished _syncScheduledNotifications ---');
  }

  // Add medication
  Future<Medication> addMedication({
    required String patientId,
    required String drugName,
    String? displayName,
    String? genericName,
    bool? whoEssential,
    String? whoRiskTier,
    required String dosage,
    String? photoUrl,
    required String foodTiming,
    required String category,
    required String criticality,
    required String scheduleTime,
    required String frequency,
  }) async {
    final String medId = const HtmlCrypto().randomUuid();
    final String createdAt = DateTime.now().toIso8601String();

    // Resolve generic name from API
    String resolvedGeneric = genericName ?? drugName;
    try {
      resolvedGeneric = await ApiService.getGenericName(drugName);
    } catch (e) {
      debugPrint('Failed to resolve generic name: $e');
    }

    final Medication newMed = Medication(
      id: medId,
      patientId: patientId,
      drugName: drugName,
      displayName: displayName ?? drugName,
      genericName: resolvedGeneric,
      whoEssential: whoEssential,
      whoRiskTier: whoRiskTier,
      dosage: dosage,
      photoUrl: photoUrl,
      foodTiming: foodTiming,
      category: category,
      criticality: criticality,
      scheduleTime: scheduleTime,
      frequency: frequency,
      createdAt: createdAt,
    );

    _medications.add(newMed);
    notifyListeners();
    await _saveLocalCache();
    await _syncScheduledNotifications();

    try {
      await ApiService.upsertMedication(newMed.toJson());
      // Trigger interaction checks automatically in the background
      _checkAndNotifyInteractions(patientId);
    } catch (e) {
      debugPrint('Offline mode or failed to save medication to server: $e');
    }
    return newMed;
  }

  // Remove medication
  Future<void> removeMedication(String id) async {
    _medications.removeWhere((med) => med.id == id);
    _logs.removeWhere((log) => log.medicationId == id);
    // Remove local notifications related to this medication
    _notifications.removeWhere((notif) => notif.medicationId == id || notif.dedupeKey.contains(id));
    notifyListeners();
    await _saveLocalCache();
    await _syncScheduledNotifications();

    try {
      await ApiService.deleteMedication(id);
      await ApiService.deleteNotificationsByMedication(id);
    } catch (e) {
      debugPrint('Failed to delete medication or its notifications from server: $e');
    }
  }

  // Update Medication
  Future<void> updateMedication(Medication updatedMed) async {
    final index = _medications.indexWhere((m) => m.id == updatedMed.id);
    if (index != -1) {
      // Resolve generic name if it changed or is missing
      Medication medToSave = updatedMed;
      if (updatedMed.drugName != _medications[index].drugName || updatedMed.genericName == null) {
        try {
          final resolvedGeneric = await ApiService.getGenericName(updatedMed.drugName);
          medToSave = Medication(
            id: updatedMed.id,
            patientId: updatedMed.patientId,
            drugName: updatedMed.drugName,
            displayName: updatedMed.displayName ?? updatedMed.drugName,
            genericName: resolvedGeneric,
            whoEssential: updatedMed.whoEssential,
            whoRiskTier: updatedMed.whoRiskTier,
            dosage: updatedMed.dosage,
            photoUrl: updatedMed.photoUrl,
            foodTiming: updatedMed.foodTiming,
            category: updatedMed.category,
            criticality: updatedMed.criticality,
            scheduleTime: updatedMed.scheduleTime,
            frequency: updatedMed.frequency,
            createdAt: updatedMed.createdAt,
          );
        } catch (e) {
          debugPrint('Failed to resolve generic name on update: $e');
        }
      }

      _medications[index] = medToSave;
      notifyListeners();
      await _saveLocalCache();
      await _syncScheduledNotifications();

      try {
        await ApiService.upsertMedication(medToSave.toJson());
        _checkAndNotifyInteractions(medToSave.patientId);
      } catch (e) {
        debugPrint('Failed to update medication on server: $e');
      }
    }
  }

  // Mark dose log status
  Future<void> markDoseStatus(Medication medication, String status, String markedBy) async {
    final String today = DateTime.now().toIso8601String().substring(0, 10);
    final String timestamp = DateTime.now().toIso8601String();

    // Check existing log in local memory to compute delay count
    final existingLocalIndex = _logs.indexWhere((l) =>
        l.medicationId == medication.id &&
        l.date == today &&
        l.scheduledTime == medication.scheduleTime);

    int delayCount = 0;
    if (existingLocalIndex != -1) {
      final existing = _logs[existingLocalIndex];
      delayCount = status == 'delayed' ? existing.delayCount + 1 : existing.delayCount;
    } else {
      delayCount = status == 'delayed' ? 1 : 0;
    }

    final DoseLog newLog = DoseLog(
      id: const HtmlCrypto().randomUuid(),
      medicationId: medication.id,
      patientId: medication.patientId,
      date: today,
      scheduledTime: medication.scheduleTime,
      status: status,
      timestampMarked: timestamp,
      delayCount: delayCount,
      markedBy: markedBy,
      createdAt: timestamp,
    );

    if (existingLocalIndex != -1) {
      _logs[existingLocalIndex] = newLog;
    } else {
      _logs.add(newLog);
    }
    notifyListeners();
    await _saveLocalCache();

    try {
      await ApiService.upsertLog(newLog.toJson());
      await reloadData();
    } catch (e) {
      debugPrint('Failed to upsert dose log on server: $e');
    }
  }

  // Add custom notification event
  Future<void> addNotification({
    required String patientId,
    String? caretakerId,
    String? medicationId,
    required String level,
    required String type,
    required String title,
    required String message,
    required String dedupeKey,
  }) async {
    final isDeduplicated = _notifications.any((n) => n.dedupeKey == dedupeKey);
    if (isDeduplicated) return;

    final String id = const HtmlCrypto().randomUuid();
    final String createdAt = DateTime.now().toIso8601String();

    final NotificationEvent newNotification = NotificationEvent(
      id: id,
      patientId: patientId,
      caretakerId: caretakerId,
      medicationId: medicationId,
      level: level,
      type: type,
      title: title,
      message: message,
      dedupeKey: dedupeKey,
      createdAt: createdAt,
    );

    _notifications.insert(0, newNotification);
    notifyListeners();
    await _saveLocalCache();

    // Trigger local push notification popup banner at the top of the device screen
    try {
      await _notificationService.showImmediateNotification(
        id: dedupeKey.hashCode,
        title: title,
        body: message,
      );
    } catch (e) {
      debugPrint('Failed to display local system notification popup: $e');
    }

    try {
      await ApiService.upsertNotification(newNotification.toJson());
    } catch (e) {
      debugPrint('Failed to save notification event to server: $e');
    }
  }

  // Automatic Drug-to-Drug Interaction Checking and Notification Generation
  Future<void> _checkAndNotifyInteractions(String patientId) async {
    final patientMeds = _medications.where((m) => m.patientId == patientId).toList();
    if (patientMeds.length < 2) return;

    for (int i = 0; i < patientMeds.length; i++) {
      for (int j = i + 1; j < patientMeds.length; j++) {
        final medA = patientMeds[i];
        final medB = patientMeds[j];

        // Deduplication key
        final ids = [medA.id, medB.id]..sort();
        final dedupeKey = 'interaction_${patientId}_${ids[0]}_${ids[1]}';

        // Check if already processed
        final isAlreadyNotified = _notifications.any((n) => n.dedupeKey == dedupeKey);
        if (isAlreadyNotified) continue;

        try {
          // Resolve generic names
          final genericA = medA.genericName ?? await ApiService.getGenericName(medA.drugName);
          final genericB = medB.genericName ?? await ApiService.getGenericName(medB.drugName);

          final prompt = [
            'You are a clinical safety assistant for a medication reminder app.',
            'Provide a drug-to-drug interaction analysis between two medications.',
            'The user is taking: "${medA.drugName}" and "${medB.drugName}".',
            'Our database mapped these to active ingredients: "$genericA" and "$genericB".',
            'If either of these are brand names (including local brand names from other countries like India, e.g. Dolo 650, Crocin, Calpol, Combiflam), please resolve them to their active generic chemical names.',
            'Return only JSON with this exact shape:',
            '{"severity":"high|moderate|low|safe|none","directive":"AVOID COMBINATION or CHOOSE ALTERNATIVE or MONITOR CLOSELY or SAFE","genericA":"...","genericB":"...","summary":"...","explanation":"...","recommendations":["..."],"cautions":["..."]}'
          ].join('\n');

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
            if (text is String) {
              final cleaned = text.replaceAll(RegExp(r'```json|```'), '').trim();
              final results = Map<String, dynamic>.from(json.decode(cleaned));
              final severity = results['severity']?.toString().toLowerCase();

              if (severity == 'high' || severity == 'moderate') {
                final level = severity == 'high' ? 'red' : 'yellow';
                final type = 'patient-risk';
                final title = 'Drug Risk: ${medA.drugName} + ${medB.drugName}';
                final message = results['summary'] ?? results['explanation'] ?? 'Potential interaction detected.';

                await addNotification(
                  patientId: patientId,
                  medicationId: medA.id,
                  level: level,
                  type: type,
                  title: title,
                  message: message,
                  dedupeKey: dedupeKey,
                );
              }
            }
          }
        } catch (e) {
          debugPrint('Failed to run interaction check for ${medA.drugName} and ${medB.drugName}: $e');
        }
      }
    }

    // Refresh database view
    try {
      final remoteNotifs = await ApiService.getNotifications();
      _notifications = remoteNotifs.map((item) => NotificationEvent.fromJson(item)).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('Failed to update local notifications list: $e');
    }
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
