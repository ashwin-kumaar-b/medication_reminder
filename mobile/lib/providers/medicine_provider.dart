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
    await _notificationService.cancelAllNotifications();
    for (int i = 0; i < _medications.length; i++) {
      final med = _medications[i];
      await _notificationService.scheduleDailyNotification(
        id: med.id.hashCode,
        title: 'Medication Alert: ${med.drugName}',
        body: 'Time to take your dosage of ${med.dosage} (${med.foodTiming})',
        timeString: med.scheduleTime,
      );
    }
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

    final Medication newMed = Medication(
      id: medId,
      patientId: patientId,
      drugName: drugName,
      displayName: displayName,
      genericName: genericName,
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

    try {
      await ApiService.upsertMedication(newMed.toJson());
      await reloadData();
    } catch (e) {
      debugPrint('Offline mode or failed to save medication to server: $e');
    }
    return newMed;
  }

  // Remove medication
  Future<void> removeMedication(String id) async {
    _medications.removeWhere((med) => med.id == id);
    _logs.removeWhere((log) => log.medicationId == id);
    notifyListeners();
    await _saveLocalCache();

    try {
      await ApiService.deleteMedication(id);
      await reloadData();
    } catch (e) {
      debugPrint('Failed to delete medication from server: $e');
    }
  }

  // Update Medication
  Future<void> updateMedication(Medication updatedMed) async {
    final index = _medications.indexWhere((m) => m.id == updatedMed.id);
    if (index != -1) {
      _medications[index] = updatedMed;
      notifyListeners();
      await _saveLocalCache();

      try {
        await ApiService.upsertMedication(updatedMed.toJson());
        await reloadData();
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

    try {
      await ApiService.upsertNotification(newNotification.toJson());
      await reloadData();
    } catch (e) {
      debugPrint('Failed to save notification event to server: $e');
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
