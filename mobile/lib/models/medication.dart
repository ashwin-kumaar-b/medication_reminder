class Medication {
  final String id;
  final String patientId;
  final String drugName;
  final String? displayName;
  final String? genericName;
  final bool? whoEssential;
  final String? whoRiskTier; // 'medium' | 'high'
  final String dosage;
  final String? photoUrl;
  final String foodTiming; // 'before-food' | 'after-food'
  final String category; // 'blood-pressure' | 'diabetes' | ...
  final String criticality; // 'low' | 'medium' | 'high'
  final String scheduleTime; // '08:00'
  final String frequency; // 'daily' | 'twice' | 'weekly'
  final String createdAt;

  Medication({
    required this.id,
    required this.patientId,
    required this.drugName,
    this.displayName,
    this.genericName,
    this.whoEssential,
    this.whoRiskTier,
    required this.dosage,
    this.photoUrl,
    required this.foodTiming,
    required this.category,
    required this.criticality,
    required this.scheduleTime,
    required this.frequency,
    required this.createdAt,
  });

  factory Medication.fromJson(Map<String, dynamic> json) {
    return Medication(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? json['patientId'] ?? '',
      drugName: json['drug_name'] ?? json['drugName'] ?? '',
      displayName: json['display_name'] ?? json['displayName'],
      genericName: json['generic_name'] ?? json['genericName'],
      whoEssential: json['who_essential'] ?? json['whoEssential'],
      whoRiskTier: json['who_risk_tier'] ?? json['whoRiskTier'],
      dosage: json['dosage'] ?? '',
      photoUrl: json['photo_url'] ?? json['photoUrl'],
      foodTiming: json['food_timing'] ?? json['foodTiming'] ?? 'before-food',
      category: json['category'] ?? 'other',
      criticality: json['criticality'] ?? 'low',
      scheduleTime: json['schedule_time'] ?? json['scheduleTime'] ?? '',
      frequency: json['frequency'] ?? 'daily',
      createdAt: json['created_at'] ?? json['createdAt'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patient_id': patientId,
      'drug_name': drugName,
      'display_name': displayName,
      'generic_name': genericName,
      'who_essential': whoEssential,
      'who_risk_tier': whoRiskTier,
      'dosage': dosage,
      'photo_url': photoUrl,
      'food_timing': foodTiming,
      'category': category,
      'criticality': criticality,
      'schedule_time': scheduleTime,
      'frequency': frequency,
      'created_at': createdAt,
    };
  }
}
