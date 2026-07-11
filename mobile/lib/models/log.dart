class DoseLog {
  final String id;
  final String medicationId;
  final String patientId;
  final String date; // YYYY-MM-DD
  final String scheduledTime;
  final String status; // 'pending' | 'taken' | 'delayed' | 'missed' | 'skipped'
  final String? timestampMarked;
  final int delayCount;
  final String markedBy; // 'user' | 'system' | 'caretaker' | 'ai'
  final String? statusReason;
  final Map<String, dynamic> statusMeta;
  final String createdAt;

  DoseLog({
    required this.id,
    required this.medicationId,
    required this.patientId,
    required this.date,
    required this.scheduledTime,
    required this.status,
    this.timestampMarked,
    required this.delayCount,
    required this.markedBy,
    this.statusReason,
    this.statusMeta = const {},
    required this.createdAt,
  });

  factory DoseLog.fromJson(Map<String, dynamic> json) {
    return DoseLog(
      id: json['id'] ?? '',
      medicationId: json['medication_id'] ?? json['medicationId'] ?? '',
      patientId: json['patient_id'] ?? json['patientId'] ?? '',
      date: json['date'] ?? '',
      scheduledTime: json['scheduled_time'] ?? json['scheduledTime'] ?? '',
      status: json['status'] ?? 'pending',
      timestampMarked: json['timestamp_marked'] ?? json['timestampMarked'],
      delayCount: json['delay_count'] is int ? json['delay_count'] : (json['delayCount'] is int ? json['delayCount'] : 0),
      markedBy: json['marked_by'] ?? json['markedBy'] ?? 'system',
      statusReason: json['status_reason'] ?? json['statusReason'],
      statusMeta: json['status_meta'] ?? json['statusMeta'] ?? {},
      createdAt: json['created_at'] ?? json['createdAt'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'medication_id': medicationId,
      'patient_id': patientId,
      'date': date,
      'scheduled_time': scheduledTime,
      'status': status,
      'timestamp_marked': timestampMarked,
      'delay_count': delayCount,
      'marked_by': markedBy,
      'status_reason': statusReason,
      'status_meta': statusMeta,
      'created_at': createdAt,
    };
  }
}
