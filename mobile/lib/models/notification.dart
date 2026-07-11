class NotificationEvent {
  final String id;
  final String patientId;
  final String? caretakerId;
  final String? medicationId;
  final String level; // 'green' | 'yellow' | 'red'
  final String type; // 'patient-reminder' | 'patient-risk' | 'caretaker-alert'
  final String title;
  final String message;
  final String dedupeKey;
  final String createdAt;

  NotificationEvent({
    required this.id,
    required this.patientId,
    this.caretakerId,
    this.medicationId,
    required this.level,
    required this.type,
    required this.title,
    required this.message,
    required this.dedupeKey,
    required this.createdAt,
  });

  factory NotificationEvent.fromJson(Map<String, dynamic> json) {
    return NotificationEvent(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? json['patientId'] ?? '',
      caretakerId: json['caretaker_id'] ?? json['caretakerId'],
      medicationId: json['medication_id'] ?? json['medicationId'],
      level: json['level'] ?? 'green',
      type: json['type'] ?? 'patient-reminder',
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      dedupeKey: json['dedupe_key'] ?? json['dedupeKey'] ?? '',
      createdAt: json['created_at'] ?? json['createdAt'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patient_id': patientId,
      'caretaker_id': caretakerId,
      'medication_id': medicationId,
      'level': level,
      'type': type,
      'title': title,
      'message': message,
      'dedupe_key': dedupeKey,
      'created_at': createdAt,
    };
  }
}
