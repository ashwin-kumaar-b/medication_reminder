import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest_all.dart' as tz;
import 'package:timezone/timezone.dart' as tz;
import 'package:intl/intl.dart';
import 'package:flutter_timezone/flutter_timezone.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
      FlutterLocalNotificationsPlugin();

  Future<void> init() async {
    // 1. Initialize timezone databases
    tz.initializeTimeZones();
    try {
      final timeZoneInfo = await FlutterTimezone.getLocalTimezone();
      String timeZoneName = _normalizeTimeZoneName(timeZoneInfo.identifier);
      tz.setLocalLocation(tz.getLocation(timeZoneName));
    } catch (e) {
      print('Failed to set local timezone ($e), trying offset-based location...');
      try {
        final String fallbackLocation = _getLocationFromOffset();
        tz.setLocalLocation(tz.getLocation(fallbackLocation));
      } catch (ex) {
        print('Offset fallback failed, falling back to UTC: $ex');
        tz.setLocalLocation(tz.getLocation('UTC'));
      }
    }

    // 2. Setup Android initialization settings
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/ic_launcher');

    // 3. Setup iOS initialization settings
    const DarwinInitializationSettings initializationSettingsDarwin =
        DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const InitializationSettings initializationSettings = InitializationSettings(
      android: initializationSettingsAndroid,
      iOS: initializationSettingsDarwin,
    );

    // 4. Initialize notifications plugin
    await flutterLocalNotificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse details) async {
        // Handle notification click if needed
      },
    );
  }

  // Request permissions
  Future<void> requestPermissions() async {
    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();

    await flutterLocalNotificationsPlugin
        .resolvePlatformSpecificImplementation<
            IOSFlutterLocalNotificationsPlugin>()
        ?.requestPermissions(
          alert: true,
          badge: true,
          sound: true,
        );
  }

  // Schedule a daily medication reminder notification
  Future<void> scheduleDailyNotification({
    required int id,
    required String title,
    required String body,
    required String timeString, // e.g. "08:00"
  }) async {
    final DateFormat formatter = DateFormat("HH:mm");
    final DateTime now = DateTime.now();
    final DateTime parsedTime = formatter.parse(timeString);

    DateTime scheduleDate = DateTime(
      now.year,
      now.month,
      now.day,
      parsedTime.hour,
      parsedTime.minute,
    );

    if (scheduleDate.isBefore(now)) {
      scheduleDate = scheduleDate.add(const Duration(days: 1));
    }

    final scheduledTzTime = tz.TZDateTime.from(scheduleDate, tz.local);

    // Print logs to verify exact time and timezone
    print('--- Notification Scheduling Debug ---');
    print('Drug: $title (ID Hash: $id)');
    print('Parsed time string: $timeString');
    print('Current system local time: $now');
    print('Resolved local timezone: ${tz.local.name}');
    print('Scheduled target local time: $scheduleDate');
    print('Scheduled target TZ time: $scheduledTzTime');
    print('--------------------------------------');

    final details = const NotificationDetails(
      android: AndroidNotificationDetails(
        'medication_reminders_channel_v2',
        'Medication Reminders',
        channelDescription: 'Alarms to remind patients to take their medications.',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
      ),
      iOS: DarwinNotificationDetails(
        presentSound: true,
        presentAlert: true,
        presentBadge: true,
      ),
    );

    try {
      print('Calling zonedSchedule with AndroidScheduleMode.exactAllowWhileIdle for ID: $id...');
      await flutterLocalNotificationsPlugin.zonedSchedule(
        id,
        title,
        body,
        scheduledTzTime,
        details,
        androidScheduleMode: AndroidScheduleMode.exactAllowWhileIdle,
        uiLocalNotificationDateInterpretation:
            UILocalNotificationDateInterpretation.absoluteTime,
        matchDateTimeComponents: DateTimeComponents.time,
      );
      print('Successfully scheduled exact alarm for ID: $id');
    } catch (e) {
      print('Exact alarm scheduling failed (likely permission denied), falling back to inexact: $e');
      try {
        print('Calling zonedSchedule with AndroidScheduleMode.inexactAllowWhileIdle for ID: $id...');
        await flutterLocalNotificationsPlugin.zonedSchedule(
          id,
          title,
          body,
          scheduledTzTime,
          details,
          androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
          uiLocalNotificationDateInterpretation:
              UILocalNotificationDateInterpretation.absoluteTime,
          matchDateTimeComponents: DateTimeComponents.time,
        );
        print('Successfully scheduled inexact alarm (fallback) for ID: $id');
      } catch (ex) {
        print('Inexact alarm scheduling fallback also failed: $ex');
        rethrow;
      }
    }
  }

  // Show an immediate notification
  Future<void> showImmediateNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    await flutterLocalNotificationsPlugin.show(
      id,
      title,
      body,
      const NotificationDetails(
        android: AndroidNotificationDetails(
          'immediate_alerts_channel',
          'Immediate Alerts',
          channelDescription: 'High priority immediate alerts and notifications.',
          importance: Importance.max,
          priority: Priority.high,
          playSound: true,
        ),
        iOS: DarwinNotificationDetails(
          presentSound: true,
          presentAlert: true,
          presentBadge: true,
        ),
      ),
    );
  }

  // Cancel specific notification
  Future<void> cancelNotification(int id) async {
    await flutterLocalNotificationsPlugin.cancel(id);
  }

  // Cancel all notifications
  Future<void> cancelAllNotifications() async {
    await flutterLocalNotificationsPlugin.cancelAll();
  }

  // Normalize ambiguous or short names
  String _normalizeTimeZoneName(String name) {
    name = name.trim();
    if (name.toLowerCase() == 'ist') return 'Asia/Kolkata';
    if (name.toLowerCase() == 'est') return 'America/New_York';
    if (name.toLowerCase() == 'cst') return 'America/Chicago';
    if (name.toLowerCase() == 'mst') return 'America/Denver';
    if (name.toLowerCase() == 'pst') return 'America/Los_Angeles';
    return name;
  }

  // Get valid IANA location based on system timezone offset
  String _getLocationFromOffset() {
    final offset = DateTime.now().timeZoneOffset;
    final hours = offset.inHours;
    final minutes = (offset.inMinutes % 60).abs();

    if (hours == 5 && minutes == 30) return 'Asia/Kolkata';
    if (hours == 5 && minutes == 45) return 'Asia/Kathmandu';
    if (hours == 6 && minutes == 0) return 'Asia/Dhaka';
    if (hours == 8 && minutes == 0) return 'Asia/Singapore';
    if (hours == 9 && minutes == 0) return 'Asia/Tokyo';
    if (hours == 10 && minutes == 0) return 'Australia/Sydney';
    if (hours == 0 && minutes == 0) return 'UTC';
    if (hours == 1 && minutes == 0) return 'Europe/London';
    if (hours == 2 && minutes == 0) return 'Europe/Paris';
    if (hours == 3 && minutes == 0) return 'Europe/Moscow';
    if (hours == -5 && minutes == 0) return 'America/New_York';
    if (hours == -6 && minutes == 0) return 'America/Chicago';
    if (hours == -7 && minutes == 0) return 'America/Denver';
    if (hours == -8 && minutes == 0) return 'America/Los_Angeles';

    if (hours == -4) return 'America/Halifax';
    if (hours == -9) return 'America/Anchorage';
    if (hours == -10) return 'Pacific/Honolulu';
    if (hours == 11) return 'Pacific/Auckland';
    if (hours == 4) return 'Asia/Dubai';

    return 'UTC';
  }
}
