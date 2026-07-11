class User {
  final String id;
  final String? patientId;
  final String? caretakerId;
  final String name;
  final String email;
  final String? phoneNumber;
  final String? password;
  final String role; // 'patient' | 'caretaker'
  final String? relation;
  final String? relationOther;
  final String? gender;
  final String? genderOther;
  final String? bloodGroup;
  final int? age;
  final String? illness;
  final String? dateOfBirth;
  final int? heightCm;
  final double? weightKg;
  final List<String> chronicDiseases;
  final List<String> infectionHistory;
  final List<Map<String, String>> allergies;
  final String? emergencyContactEmail;
  final String uiMode;
  final String? linkedPatientId;

  User({
    required this.id,
    this.patientId,
    this.caretakerId,
    required this.name,
    required this.email,
    this.phoneNumber,
    this.password,
    required this.role,
    this.relation,
    this.relationOther,
    this.gender,
    this.genderOther,
    this.bloodGroup,
    this.age,
    this.illness,
    this.dateOfBirth,
    this.heightCm,
    this.weightKg,
    this.chronicDiseases = const [],
    this.infectionHistory = const [],
    this.allergies = const [],
    this.emergencyContactEmail,
    this.uiMode = 'younger',
    this.linkedPatientId,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    var rawAllergies = json['allergies'];
    List<Map<String, String>> parsedAllergies = [];
    if (rawAllergies is List) {
      parsedAllergies = rawAllergies.map((item) {
        return {
          'category': item['category']?.toString() ?? 'Unknown',
          'trigger': item['trigger']?.toString() ?? '',
        };
      }).toList();
    }

    return User(
      id: json['id'] ?? '',
      patientId: json['patient_id'] ?? json['patientId'],
      caretakerId: json['caretaker_id'] ?? json['caretakerId'],
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phoneNumber: json['phone'] ?? json['phoneNumber'],
      password: json['password'],
      role: json['role'] ?? 'patient',
      relation: json['relation'],
      relationOther: json['relation_other'] ?? json['relationOther'],
      gender: json['gender'],
      genderOther: json['gender_other'] ?? json['genderOther'],
      bloodGroup: json['blood_group'] ?? json['bloodGroup'],
      age: json['age'] is int ? json['age'] : (json['age'] != null ? double.parse(json['age'].toString()).toInt() : null),
      illness: json['illness'],
      dateOfBirth: json['date_of_birth'] ?? json['dateOfBirth'],
      heightCm: json['height_cm'] is int ? json['height_cm'] : (json['height_cm'] != null ? double.parse(json['height_cm'].toString()).toInt() : null),
      weightKg: json['weight_kg'] != null ? double.tryParse(json['weight_kg'].toString()) : null,
      chronicDiseases: json['chronic_diseases'] != null ? List<String>.from(json['chronic_diseases']) : (json['chronicDiseases'] != null ? List<String>.from(json['chronicDiseases']) : []),
      infectionHistory: json['infection_history'] != null ? List<String>.from(json['infection_history']) : (json['infectionHistory'] != null ? List<String>.from(json['infectionHistory']) : []),
      allergies: parsedAllergies,
      emergencyContactEmail: json['emergency_contact_email'] ?? json['emergencyContactEmail'],
      uiMode: json['ui_mode'] ?? json['uiMode'] ?? 'younger',
      linkedPatientId: json['linked_patient_id'] ?? json['linkedPatientId'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'patientId': patientId,
      'caretakerId': caretakerId,
      'name': name,
      'email': email,
      'phoneNumber': phoneNumber,
      'password': password,
      'role': role,
      'relation': relation,
      'relationOther': relationOther,
      'gender': gender,
      'genderOther': genderOther,
      'bloodGroup': bloodGroup,
      'age': age,
      'illness': illness,
      'dateOfBirth': dateOfBirth,
      'heightCm': heightCm,
      'weightKg': weightKg,
      'chronicDiseases': chronicDiseases,
      'infectionHistory': infectionHistory,
      'allergies': allergies,
      'emergencyContactEmail': emergencyContactEmail,
      'uiMode': uiMode,
      'linkedPatientId': linkedPatientId,
    };
  }
}
