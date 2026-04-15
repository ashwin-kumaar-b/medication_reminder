import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2, Search } from 'lucide-react';
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

const Auth = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registerStep, setRegisterStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [heightCm, setHeightCm] = useState<string>('');
  const [weightKg, setWeightKg] = useState<string>('');
  const [chronicSearch, setChronicSearch] = useState('');
  const [chronicDiseases, setChronicDiseases] = useState<string[]>([]);
  const [infectionHistory, setInfectionHistory] = useState<string[]>([]);
  const [allergyCategory, setAllergyCategory] = useState<(typeof allergyCategories)[number]>('Drug');
  const [allergyTrigger, setAllergyTrigger] = useState('');
  const [allergies, setAllergies] = useState<Array<{ category: string; trigger: string }>>([]);
  const [emergencyContactEmail, setEmergencyContactEmail] = useState('');
  const [uiMode, setUiMode] = useState<UiMode>('younger');
  const [linkedPatientId, setLinkedPatientId] = useState('');
  const { register, login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const clearForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('patient');
    setDateOfBirth('');
    setHeightCm('');
    setWeightKg('');
    setChronicSearch('');
    setChronicDiseases([]);
    setInfectionHistory([]);
    setAllergyCategory('Drug');
    setAllergyTrigger('');
    setAllergies([]);
    setEmergencyContactEmail('');
    setUiMode('younger');
    setLinkedPatientId('');
    setRegisterStep(1);
  };

  const toggleSelect = (value: string, selectedItems: string[], setter: (items: string[]) => void) => {
    if (selectedItems.includes(value)) {
      setter(selectedItems.filter(item => item !== value));
      return;
    }

    if (value === 'None') {
      setter(['None']);
      return;
    }

    setter([...selectedItems.filter(item => item !== 'None'), value]);
  };

  const addAllergy = () => {
    const normalized = allergyTrigger.trim();
    if (!normalized) return;
    const entry = { category: allergyCategory, trigger: normalized };
    const exists = allergies.some(
      item => item.category.toLowerCase() === entry.category.toLowerCase() && item.trigger.toLowerCase() === entry.trigger.toLowerCase(),
    );
    if (!exists) setAllergies([...allergies, entry]);
    setAllergyTrigger('');
  };

  const filteredChronicDiseases = chronicDiseaseOptions.filter(option =>
    option.toLowerCase().includes(chronicSearch.toLowerCase()),
  );

  const derivedAge = toAgeFromDob(dateOfBirth);
  const effectiveUiMode = getAgeAwareUiMode(dateOfBirth, uiMode);
  const isOlderLayout = mode === 'register' && effectiveUiMode === 'older';
  const registerFieldClass =
    'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20';
  const registerFieldSizeClass = isOlderLayout ? 'text-[18px] leading-7' : 'text-base';

  const canGoToStepTwo =
    name.trim().length > 1 &&
    email.trim().length > 3 &&
    /.+@.+\..+/.test(email) &&
    password.trim().length >= 8 &&
    dateOfBirth.trim().length > 0 &&
    !!role;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'register' && registerStep === 1) {
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

    if (mode === 'register' && role === 'patient' && !emergencyContactEmail.trim()) {
      toast({
        title: 'Caretaker email is required',
        description: 'Please add an emergency contact email for escalation alerts.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const response =
      mode === 'register'
        ? await register({
            name,
            email,
            password,
            role,
            dateOfBirth,
            heightCm: heightCm ? Number(heightCm) : undefined,
            weightKg: weightKg ? Number(weightKg) : undefined,
            chronicDiseases,
            infectionHistory,
            allergies,
            emergencyContactEmail: role === 'patient' ? emergencyContactEmail.trim() : undefined,
            age: derivedAge,
            illness: role === 'patient' ? chronicDiseases.find(item => item !== 'None') : undefined,
            uiMode: effectiveUiMode,
            linkedPatientId: role === 'caretaker' && linkedPatientId ? linkedPatientId : undefined,
          })
        : await login({ email, password, role });

    if (response.ok && response.needsEmailVerification) {
      toast({
        title: 'Account created',
        description: 'Please verify your email, then log in.',
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
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email Address</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  required
                  className={`${registerFieldClass} ${registerFieldSizeClass}`}
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type="password"
                  required
                  minLength={8}
                  className={`${registerFieldClass} ${registerFieldSizeClass}`}
                  placeholder="At least 8 characters"
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

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {roleOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={`rounded-lg border px-3 py-2.5 font-semibold transition-colors ${
                        isOlderLayout ? 'text-[18px] leading-7' : 'text-sm'
                      } ${
                        role === option.value
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
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
                <div className="mb-2 flex items-center rounded-lg border border-input bg-background px-3">
                  <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                  <input
                    value={chronicSearch}
                    onChange={e => setChronicSearch(e.target.value)}
                    className={`w-full bg-transparent py-2.5 focus:outline-none ${registerFieldSizeClass}`}
                    placeholder="Search condition (example: Diabetes)"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {filteredChronicDiseases.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleSelect(option, chronicDiseases, setChronicDiseases)}
                      className={`rounded-full border px-3 py-1.5 transition-colors ${
                        chronicDiseases.includes(option)
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
                <div className="flex flex-wrap gap-2">
                  {infectionHistoryOptions.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleSelect(option, infectionHistory, setInfectionHistory)}
                      className={`rounded-full border px-3 py-1.5 transition-colors ${
                        infectionHistory.includes(option)
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
                <div className={`grid gap-2 ${isOlderLayout ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-[160px_1fr_auto]'}`}>
                  <select
                    value={allergyCategory}
                    onChange={e => setAllergyCategory(e.target.value as (typeof allergyCategories)[number])}
                    className={`${registerFieldClass} ${registerFieldSizeClass}`}
                  >
                    {allergyCategories.map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                  <input
                    value={allergyTrigger}
                    onChange={e => setAllergyTrigger(e.target.value)}
                    className={`${registerFieldClass} ${registerFieldSizeClass}`}
                    placeholder="Example: Penicillin or Peanuts"
                  />
                  <button
                    type="button"
                    onClick={addAllergy}
                    className={`rounded-lg border border-primary px-4 py-2.5 font-semibold text-primary hover:bg-accent ${
                      isOlderLayout ? 'text-[18px] leading-7' : 'text-sm'
                    }`}
                  >
                    Add
                  </button>
                </div>
                {allergies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {allergies.map(item => (
                      <button
                        key={`${item.category}-${item.trigger}`}
                        type="button"
                        onClick={() =>
                          setAllergies(
                            allergies.filter(
                              existing =>
                                !(existing.category === item.category && existing.trigger === item.trigger),
                            ),
                          )
                        }
                        className={`rounded-full border border-border bg-muted px-3 py-1.5 text-foreground hover:bg-accent ${
                          isOlderLayout ? 'text-[18px] leading-7' : 'text-xs font-semibold'
                        }`}
                      >
                        {item.category}: {item.trigger} x
                      </button>
                    ))}
                  </div>
                )}
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
                    required
                    className={`${registerFieldClass} ${registerFieldSizeClass}`}
                    placeholder="Who should we alert? (example: daughter@email.com)"
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
                <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type="password"
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="Minimum 8 characters"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {roleOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                        role === option.value
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
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
          Demo accounts: patient@mediguard.demo / demo1234 and caretaker@mediguard.demo / demo1234
        </div>
      </div>
    </div>
  );
};

export default Auth;
