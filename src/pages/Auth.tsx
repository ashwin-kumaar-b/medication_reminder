import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader2 } from 'lucide-react';
import { useAuth, UiMode, UserRole } from '@/contexts/AuthContext';
import { attachOneSignalIdentity } from '@/lib/onesignal';
import { useToast } from '@/hooks/use-toast';

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: 'patient', label: 'Patient' },
  { value: 'caretaker', label: 'Caretaker' },
];

const uiModes: Array<{ value: UiMode; label: string }> = [
  { value: 'younger', label: 'Younger Interface (vivid)' },
  { value: 'older', label: 'Older Interface (simple)' },
];

const Auth = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [age, setAge] = useState<string>('');
  const [illness, setIllness] = useState('');
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
    setAge('');
    setIllness('');
    setUiMode('younger');
    setLinkedPatientId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const response =
      mode === 'register'
        ? await register({
            name,
            email,
            password,
            role,
            age: age ? Number(age) : undefined,
            illness: role === 'patient' ? illness : undefined,
            uiMode,
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
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="Full name"
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Age</label>
                <input
                  value={age}
                  onChange={e => {
                    const nextAge = e.target.value;
                    setAge(nextAge);
                    if (nextAge && Number(nextAge) >= 55) setUiMode('older');
                  }}
                  type="number"
                  min={1}
                  max={120}
                  required
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="e.g. 67"
                />
              </div>
              {role === 'patient' && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Main Illness / Condition</label>
                  <input
                    value={illness}
                    onChange={e => setIllness(e.target.value)}
                    required
                    className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                    placeholder="e.g. Diabetes"
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
                  onClick={() => {
                    setRole(option.value);
                    if (option.value === 'caretaker') {
                      setIllness('');
                    }
                  }}
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

          {mode === 'register' && role === 'caretaker' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Link Existing Patient ID (optional)</label>
              <input
                value={linkedPatientId}
                onChange={e => setLinkedPatientId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                placeholder="Enter patient ID if already created"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="gradient-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === 'register' ? 'Create Account' : 'Login'}
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
