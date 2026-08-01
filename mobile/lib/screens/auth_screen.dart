import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _formKey = GlobalKey<FormState>();
  bool _isLogin = true;
  
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  
  String _selectedRole = 'patient'; // 'patient' | 'caretaker'
  String _selectedRelation = 'Family';
  final _relationOtherController = TextEditingController();
  final _linkedPatientIdController = TextEditingController();
  
  bool _loading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _relationOtherController.dispose();
    _linkedPatientIdController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _loading = true;
      _errorMessage = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    Map<String, dynamic> result;

    if (_isLogin) {
      result = await auth.login(
        _phoneController.text,
        _passwordController.text,
      );
    } else {
      result = await auth.register(
        name: _nameController.text,
        phone: _phoneController.text,
        password: _passwordController.text,
        role: _selectedRole,
        relation: _selectedRole == 'caretaker' ? _selectedRelation : null,
        relationOther: _selectedRole == 'caretaker' && _selectedRelation == 'Other' ? _relationOtherController.text : null,
        linkedPatientId: _selectedRole == 'caretaker' && _linkedPatientIdController.text.isNotEmpty ? _linkedPatientIdController.text : null,
      );
    }

    if (mounted) {
      setState(() => _loading = false);
      if (!result['ok']) {
        setState(() => _errorMessage = result['error']);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(
                  Icons.health_and_safety_outlined,
                  size: 80,
                  color: Color(0xFF1E3A8A),
                ),
                const SizedBox(height: 12),
                Text(
                  'MediGuard Smart Care',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF1E3A8A),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _isLogin ? 'Sign in to monitor medication risk' : 'Register to get started',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey[600]),
                ),
                const SizedBox(height: 32),
                
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red[100]!),
                    ),
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                if (!_isLogin) ...[
                  TextFormField(
                    controller: _nameController,
                    decoration: const InputDecoration(
                      labelText: 'Full Name',
                      prefixIcon: Icon(Icons.person_outline),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) => v == null || v.trim().isEmpty ? 'Enter your name' : null,
                  ),
                  const SizedBox(height: 16),
                ],

                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Mobile Number',
                    prefixIcon: Icon(Icons.phone_outlined),
                    helperText: 'Enter 10-digit mobile number (e.g. 9876543210)',
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Enter mobile number' : null,
                ),
                const SizedBox(height: 16),

                TextFormField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Password',
                    prefixIcon: Icon(Icons.lock_outline),
                    border: OutlineInputBorder(),
                  ),
                  validator: (v) => v == null || v.trim().isEmpty ? 'Enter password' : null,
                ),
                const SizedBox(height: 16),

                if (!_isLogin) ...[
                  const Text('Select Your Role:', style: TextStyle(fontWeight: FontWeight.bold)),
                  Row(
                    children: [
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text('Patient'),
                          value: 'patient',
                          groupValue: _selectedRole,
                          onChanged: (v) => setState(() => _selectedRole = v!),
                        ),
                      ),
                      Expanded(
                        child: RadioListTile<String>(
                          title: const Text('Caretaker'),
                          value: 'caretaker',
                          groupValue: _selectedRole,
                          onChanged: (v) => setState(() => _selectedRole = v!),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  
                  if (_selectedRole == 'caretaker') ...[
                    DropdownButtonFormField<String>(
                      value: _selectedRelation,
                      decoration: const InputDecoration(
                        labelText: 'Relationship to Patient',
                        border: OutlineInputBorder(),
                      ),
                      items: ['Family', 'Nurse', 'Doctor', 'Other']
                          .map((val) => DropdownMenuItem(value: val, child: Text(val)))
                          .toList(),
                      onChanged: (v) => setState(() => _selectedRelation = v!),
                    ),
                    const SizedBox(height: 16),

                    if (_selectedRelation == 'Other') ...[
                      TextFormField(
                        controller: _relationOtherController,
                        decoration: const InputDecoration(
                          labelText: 'Please specify relationship',
                          border: OutlineInputBorder(),
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    TextFormField(
                      controller: _linkedPatientIdController,
                      decoration: const InputDecoration(
                        labelText: 'Linked Patient ID (Optional)',
                        helperText: 'e.g. MGP-123456',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ]
                ],

                ElevatedButton(
                  onPressed: _loading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: const Color(0xFF1E3A8A),
                    foregroundColor: Colors.white,
                  ),
                  child: _loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Text(_isLogin ? 'Login' : 'Register'),
                ),
                const SizedBox(height: 24),
                
                TextButton(
                  onPressed: () {
                    setState(() {
                      _isLogin = !_isLogin;
                      _errorMessage = null;
                    });
                  },
                  child: Text(
                    _isLogin ? "Don't have an account? Register" : "Already have an account? Login",
                  ),
                )
              ],
            ),
          ),
        ),
      ),
    );
  }
}
