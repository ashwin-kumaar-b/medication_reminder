import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth, UiMode, UserRole } from '@/contexts/AuthContext';
import { attachOneSignalIdentity } from '@/lib/onesignal';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'patient', label: 'Patient' },
  { value: 'caretaker', label: 'Caretaker' },
];

const uiModes: Array<{ value: UiMode; label: string }> = [
  { value: 'younger', label: 'Younger Interface (vivid)' },
  { value: 'older', label: 'Older Interface (simple)' },
];

const chronicDiseaseOptions = [
  'Diabetes',
  'Hypertension',
  'CKD',
  'Asthma',
  'Heart Disease',
  'Thyroid',
  'Arthritis',
  'COPD',
  'Epilepsy',
  'None',
];

const infectionHistoryOptions = ['Hepatitis', 'TB', 'Recurring UTIs', 'None'];
const allergyCategories = ['Drug', 'Food', 'Environmental'] as const;
type AllergyCategory = (typeof allergyCategories)[number];

const toAgeFromDob = (dob: string): number | undefined => {
  if (!dob) return undefined;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return undefined;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthGap = today.getMonth() - birth.getMonth();
  if (monthGap < 0 || (monthGap === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age >= 0 ? age : undefined;
};

const getAgeAwareUiMode = (dob: string, selectedMode: UiMode): UiMode => {
  const age = toAgeFromDob(dob);
  if (typeof age === 'number' && age >= 55) return 'older';
  return selectedMode;
};

const normalizePhoneNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  return `+${trimmed.replace(/\D/g, '')}`;
};

const Auth = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [role, setRole] = useState<UserRole>('patient');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [chronicDiseaseInput, setChronicDiseaseInput] = useState('');
  const [infectionHistoryInput, setInfectionHistoryInput] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState<string[]>([]);
  const [infectionHistory, setInfectionHistory] = useState<string[]>([]);
  const [selectedAllergyCategories, setSelectedAllergyCategories] = useState<AllergyCategory[]>([]);
  const [allergyInputs, setAllergyInputs] = useState<Record<AllergyCategory, string>>({
    Drug: '',
    Food: '',
    Environmental: '',
  });
  const [emergencyContactEmail, setEmergencyContactEmail] = useState('');
  const [uiMode, setUiMode] = useState<UiMode>('younger');
  const [linkedPatientId, setLinkedPatientId] = useState('');
  const { register, login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const clearForm = () => {
    setName('');
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setOtpInput('');
    setGeneratedOtp('');
    setIsOtpSent(false);
    setIsOtpVerified(false);
    setRole('patient');
    setDateOfBirth('');
    setHeightCm('');
    setWeightKg('');
    setChronicDiseaseInput('');
    setInfectionHistoryInput('');
    setChronicDiseases([]);
    setInfectionHistory([]);
    setSelectedAllergyCategories([]);
    setAllergyInputs({
      Drug: '',
      Food: '',
      Environmental: '',
    });
    setEmergencyContactEmail('');
    setUiMode('younger');
    setLinkedPatientId('');
    setRegisterStep(1);
  };

  const toggleAllergyCategory = (category: AllergyCategory) => {
    if (selectedAllergyCategories.includes(category)) {
      setSelectedAllergyCategories(selectedAllergyCategories.filter(item => item !== category));
      setAllergyInputs(prev => ({ ...prev, [category]: '' }));
      return;
    }

    setSelectedAllergyCategories([...selectedAllergyCategories, category]);
  };

  const filteredChronicDiseases = chronicDiseaseOptions.filter(option =>
    option.toLowerCase().includes(chronicDiseaseInput.toLowerCase()),
  );

  const filteredInfectionHistory = infectionHistoryOptions.filter(option =>
    option.toLowerCase().includes(infectionHistoryInput.toLowerCase()),
  );

  const sendOtp = () => {
    const normalized = normalizePhoneNumber(phoneNumber);
    if (!/^\+\d{10,15}$/.test(normalized)) {
      toast({
        title: 'Invalid mobile number',
        description: 'Enter a valid mobile number with country code, like +919876543210.',
        variant: 'destructive',
      });
      return;
    }

    const nextOtp = `${Math.floor(100000 + Math.random() * 900000)}`;
    setGeneratedOtp(nextOtp);
    setIsOtpSent(true);
    setIsOtpVerified(false);
    setOtpInput('');

    toast({
      title: 'OTP sent',
      description: 'Development mode: OTP is shown below the field on this page.',
    });
  };

  const verifyOtp = () => {
    if (!isOtpSent || !generatedOtp) {
      toast({
        title: 'Send OTP first',
        description: 'Please send an OTP to your mobile number before verifying.',
        variant: 'destructive',
      });
      return;
    }

    if (otpInput.trim() !== generatedOtp) {
      setIsOtpVerified(false);
      toast({
        title: 'Invalid OTP',
        description: 'The OTP entered is incorrect. Please check and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsOtpVerified(true);
    toast({
      title: 'OTP verified',
      description: 'Mobile number verified successfully.',
    });
  };

  const derivedAge = toAgeFromDob(dateOfBirth);
  const effectiveUiMode = getAgeAwareUiMode(dateOfBirth, uiMode);
  const isOlderLayout = mode === 'register' && effectiveUiMode === 'older';
  const registerFieldClass =
    'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20';
  const registerFieldSizeClass = isOlderLayout ? 'text-[18px] leading-7' : 'text-base';

  const canGoToStepTwo =
    name.trim().length > 1 &&
    /^\+\d{10,15}$/.test(normalizePhoneNumber(phoneNumber)) &&
    isOtpVerified &&
    password.trim().length >= 8 &&
    password === confirmPassword &&
    dateOfBirth.trim().length > 0 &&
    !!role;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const isPhoneValid = /^\+\d{10,15}$/.test(normalizedPhoneNumber);

    if (mode === 'login' && !isPhoneValid) {
      toast({
        title: 'Invalid mobile number',
        description: 'Please enter a valid mobile number with country code.',
        variant: 'destructive',
      });
      return;
    }

    if (mode === 'register' && registerStep === 1) {
      if (!isPhoneValid) {
        toast({
          title: 'Invalid mobile number',
          description: 'Please enter a valid mobile number with country code.',
          variant: 'destructive',
        });
        return;
      }

      if (!isOtpVerified) {
        toast({
          title: 'Verify mobile number',
          description: 'Please verify your OTP before continuing.',
          variant: 'destructive',
        });
        return;
      }

      if (password !== confirmPassword) {
        toast({
          title: 'Passwords do not match',
          description: 'Please enter the same password in both password fields.',
          variant: 'destructive',
        });
        return;
      }

      if (!canGoToStepTwo) {
        toast({
          title: 'Complete step 1',
          description: 'Please fill identity details before continuing.',
          variant: 'destructive',
        });
        return;
      }
      setRegisterStep(2);
      return;
    }

    setLoading(true);

    const normalizedChronicDiseases = chronicDiseaseInput.trim() ? [chronicDiseaseInput.trim()] : ['None'];
    const normalizedInfectionHistory = infectionHistoryInput.trim() ? [infectionHistoryInput.trim()] : ['None'];
    const normalizedAllergies = selectedAllergyCategories
      .map(category => ({
        category,
        trigger: allergyInputs[category].trim(),
      }))
      .filter(item => item.trigger.length > 0);

    const response =
      mode === 'register'
        ? await register({
            name,
            phoneNumber: normalizedPhoneNumber,
            password,
            role,
            dateOfBirth,
            heightCm: heightCm ? Number(heightCm) : undefined,
            weightKg: weightKg ? Number(weightKg) : undefined,
            chronicDiseases: normalizedChronicDiseases,
            infectionHistory: normalizedInfectionHistory,
            allergies: normalizedAllergies,
            emergencyContactEmail: emergencyContactEmail.trim() || undefined,
            age: derivedAge,
            illness: normalizedChronicDiseases.find(item => item !== 'None'),
            uiMode: effectiveUiMode,
            linkedPatientId: role === 'caretaker' && linkedPatientId ? linkedPatientId : undefined,
          })
        : await login({ phoneNumber: normalizedPhoneNumber, password });

    if (response.ok && response.needsEmailVerification) {
      toast({
        title: 'Account created',
        description: 'Please complete verification, then log in.',
      });
      setMode('login');
      setPassword('');
      setRegisterStep(1);
      setLoading(false);
      return;
    }

    if (!response.ok || !response.user) {
      toast({ title: 'Authentication failed', description: response.error, variant: 'destructive' });
      setLoading(false);
      return;
    }

    await attachOneSignalIdentity(response.user.id);
    toast({
      title: mode === 'register' ? 'Account created' : 'Welcome back',
      description: `${response.user.name} signed in as ${response.user.role}.`,
    });
    clearForm();
    navigate('/dashboard');
    setLoading(false);
  };

  return (
    <div className="gradient-hero flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-7 shadow-elevated">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex rounded-xl gradient-primary p-3">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">MediGuard Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">Role-based login for Patients and Caretakers</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Supabase is not configured. Accounts created here are saved only on this browser and will not appear in Supabase Authentication until environment keys are added.
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded-md py-2 text-sm font-semibold transition-colors ${
              mode === 'login' ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground'
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded-md py-2 text-sm font-semibold transition-colors ${
              mode === 'register' ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="rounded-lg border border-border bg-muted/40 p-2 text-center text-sm font-semibold text-muted-foreground">
              Step {registerStep} of 2
            </div>
          )}

          {mode === 'register' && registerStep === 1 && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Full Name</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  className={`${registerFieldClass} ${registerFieldSizeClass}`}
                  placeholder="Enter your full legal name"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Mobile Number</label>
                <div className="flex gap-2">
                  <input
                    value={phoneNumber}
                    onChange={e => {
                      setPhoneNumber(e.target.value);
                      setIsOtpVerified(false);
                    }}
                    type="tel"
                    required
                    className={`${registerFieldClass} ${registerFieldSizeClass}`}
                    placeholder="+919876543210"
                  />
                  <button
                    type="button"
                    onClick={sendOtp}
                    className="whitespace-nowrap rounded-lg border border-primary px-3 py-2.5 text-sm font-semibold text-primary hover:bg-accent"
                  >
                    Send OTP
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Use international format with country code.</p>
                {isOtpSent && (
                  <p className="mt-1 text-xs text-muted-foreground">Development OTP (on website): {generatedOtp}</p>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Enter OTP</label>
                <div className="flex gap-2">
                  <input
                    value={otpInput}
                    onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    className={`${registerFieldClass} ${registerFieldSizeClass}`}
                    placeholder="6-digit OTP"
                  />
                  <button
                    type="button"
                    onClick={verifyOtp}
                    className="whitespace-nowrap rounded-lg border border-primary px-3 py-2.5 text-sm font-semibold text-primary hover:bg-accent"
                  >
                    Verify OTP
                  </button>
                </div>
                {isOtpVerified && <p className="mt-1 text-xs font-semibold text-emerald-600">Mobile number verified.</p>}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Create New Password</label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    className={`${registerFieldClass} ${registerFieldSizeClass} pr-10`}
                    placeholder="Minimum 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Confirm Password</label>
                <input
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  className={`${registerFieldClass} ${registerFieldSizeClass}`}
                  placeholder="Re-enter same password"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Date of Birth</label>
                <input
                  value={dateOfBirth}
                  onChange={e => setDateOfBirth(e.target.value)}
                  type="date"
                  required
                  className={`${registerFieldClass} ${registerFieldSizeClass}`}
                />
                <p className="mt-1 text-xs text-muted-foreground">Format: YYYY-MM-DD</p>
              </div>

            </>
          )}

          {mode === 'register' && registerStep === 2 && (
            <div className={`grid gap-4 ${isOlderLayout ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">How tall are you? (cm)</label>
                <input
                  value={heightCm}
                  onChange={e => setHeightCm(e.target.value)}
                  type="number"
                  min={50}
                  max={250}
                  className={`${registerFieldClass} ${registerFieldSizeClass}`}
                  placeholder="Example: 165"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">What is your weight? (kg)</label>
                <input
                  value={weightKg}
                  onChange={e => setWeightKg(e.target.value)}
                  type="number"
                  min={20}
                  max={300}
                  className={`${registerFieldClass} ${registerFieldSizeClass}`}
                  placeholder="Example: 62"
                />
              </div>

              <div className={isOlderLayout ? '' : 'sm:col-span-2'}>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Chronic Diseases</label>
                <input
                  value={chronicDiseaseInput}
                  onChange={e => {
                    const nextValue = e.target.value;
                    setChronicDiseaseInput(nextValue);
                    setChronicDiseases(nextValue.trim() ? [nextValue.trim()] : []);
                  }}
                  className={`${registerFieldClass} ${registerFieldSizeClass} mb-2`}
                  placeholder="Type or select a condition"
                />
                <div className="flex flex-wrap gap-2">
                  {filteredChronicDiseases.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setChronicDiseaseInput(option);
                        setChronicDiseases([option]);
                      }}
                      className={`rounded-full border px-3 py-1.5 transition-colors ${
                        chronicDiseaseInput.toLowerCase() === option.toLowerCase()
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      } ${isOlderLayout ? 'text-[18px] leading-7' : 'text-xs font-semibold'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className={isOlderLayout ? '' : 'sm:col-span-2'}>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Infection History</label>
                <input
                  value={infectionHistoryInput}
                  onChange={e => {
                    const nextValue = e.target.value;
                    setInfectionHistoryInput(nextValue);
                    setInfectionHistory(nextValue.trim() ? [nextValue.trim()] : []);
                  }}
                  className={`${registerFieldClass} ${registerFieldSizeClass} mb-2`}
                  placeholder="Type or select infection history"
                />
                <div className="flex flex-wrap gap-2">
                  {filteredInfectionHistory.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setInfectionHistoryInput(option);
                        setInfectionHistory([option]);
                      }}
                      className={`rounded-full border px-3 py-1.5 transition-colors ${
                        infectionHistoryInput.toLowerCase() === option.toLowerCase()
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      } ${isOlderLayout ? 'text-[18px] leading-7' : 'text-xs font-semibold'}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className={isOlderLayout ? '' : 'sm:col-span-2'}>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Allergies</label>
                <p className="mb-2 text-xs text-muted-foreground">Select none, one, or multiple allergy types.</p>
                <div className="mb-2 flex flex-wrap gap-2">
                  {allergyCategories.map(category => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleAllergyCategory(category)}
                      className={`rounded-full border px-3 py-1.5 transition-colors ${
                        selectedAllergyCategories.includes(category)
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      } ${isOlderLayout ? 'text-[18px] leading-7' : 'text-xs font-semibold'}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {selectedAllergyCategories.map(category => (
                  <div key={category} className="mb-2">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">{category} Allergy Details</label>
                    <input
                      value={allergyInputs[category]}
                      onChange={e =>
                        setAllergyInputs(prev => ({
                          ...prev,
                          [category]: e.target.value,
                        }))
                      }
                      className={`${registerFieldClass} ${registerFieldSizeClass}`}
                      placeholder={`Enter ${category.toLowerCase()} allergy details (optional)`}
                    />
                  </div>
                ))}
              </div>

              {role === 'patient' && (
                <div className={isOlderLayout ? '' : 'sm:col-span-2'}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Emergency Contact / Caretaker Email
                  </label>
                  <input
                    value={emergencyContactEmail}
                    onChange={e => setEmergencyContactEmail(e.target.value)}
                    type="email"
                    className={`${registerFieldClass} ${registerFieldSizeClass}`}
                    placeholder="Who should we alert? (optional)"
                  />
                </div>
              )}

              {role === 'caretaker' && (
                <div className={isOlderLayout ? '' : 'sm:col-span-2'}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Link Existing Patient ID (optional)</label>
                  <input
                    value={linkedPatientId}
                    onChange={e => setLinkedPatientId(e.target.value)}
                    className={`${registerFieldClass} ${registerFieldSizeClass}`}
                    placeholder="Enter patient ID if already created"
                  />
                </div>
              )}
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Preferred Interface</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {uiModes.map(modeOption => (
                  <button
                    key={modeOption.value}
                    type="button"
                    onClick={() => setUiMode(modeOption.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                      uiMode === modeOption.value
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {modeOption.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'login' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Mobile Number</label>
                <input
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  type="tel"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="+919876543210"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
                <div className="relative">
                  <input
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 pr-10"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

            </>
          )}

          {mode === 'register' && registerStep === 2 && (
            <button
              type="button"
              onClick={() => setRegisterStep(1)}
              className="w-full rounded-lg border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Back to Step 1
            </button>
          )}

          <button
            type="submit"
            disabled={loading}
            className="gradient-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : mode === 'register' ? (
              registerStep === 1 ? 'Continue to Step 2' : 'Create Account'
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="mt-5 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Demo login (mobile / password): +919999000001 / demo1234 and +919999000002 / demo1234
        </div>
      </div>
    </div>
  );
};

export default Auth;
