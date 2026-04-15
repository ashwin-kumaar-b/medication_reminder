import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UiMode } from '@/contexts/AuthContext';
import { useMedicines } from '@/contexts/MedicineContext';
import { Pill, Clock, AlertTriangle, Plus, GitCompareArrows, HelpCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { user, createPatientForCaretaker, getLinkedPatients } = useAuth();
  const { medicines, doseLogs, getCaretakerDashboardData } = useMedicines();
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);
  const [patientForm, setPatientForm] = useState({
    name: '',
    email: '',
    password: '',
    age: '',
    illness: '',
    uiMode: 'younger' as UiMode,
  });

  const linkedPatients = useMemo(() => getLinkedPatients(user?.id), [getLinkedPatients, user?.id]);
  const activePatientId = selectedPatientId || linkedPatients[0]?.id;
  const caretakerView = activePatientId ? getCaretakerDashboardData(activePatientId) : null;

  const activeMeds = medicines.filter(m => m.isActive);
  const missedDoses = doseLogs.filter(l => l.status === 'missed').length;
  const takenToday = doseLogs.filter(l => l.status === 'taken' && new Date(l.scheduledTime).toDateString() === new Date().toDateString()).length;

  const cards = [
    { label: 'Active Medicines', value: activeMeds.length, icon: Pill, color: 'text-primary bg-accent' },
    { label: 'Doses Taken Today', value: takenToday, icon: Clock, color: 'text-success bg-success/10' },
    { label: 'Missed Doses', value: missedDoses, icon: XCircle, color: 'text-destructive bg-destructive/10' },
    { label: 'Total Medicines', value: medicines.length, icon: AlertTriangle, color: 'text-warning bg-warning/10' },
  ];

  const actions = [
    { to: '/add-medicine', label: 'Add Medicine', icon: Plus, desc: 'Add a new medication to your list' },
    { to: '/interaction-checker', label: 'Check Interactions', icon: GitCompareArrows, desc: 'Verify drug safety' },
    { to: '/can-i-take', label: 'Can I Take Now?', icon: HelpCircle, desc: 'Real-time dose safety check' },
  ];

  const handleAddPatient = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    setSavingPatient(true);
    const response = await createPatientForCaretaker(user.id, {
      name: patientForm.name,
      email: patientForm.email,
      password: patientForm.password,
      age: patientForm.age ? Number(patientForm.age) : undefined,
      illness: patientForm.illness,
      uiMode: patientForm.uiMode,
    });
    setSavingPatient(false);

    if (!response.ok || !response.user) {
      toast({ title: 'Could not add patient', description: response.error, variant: 'destructive' });
      return;
    }

    setPatientForm({ name: '', email: '', password: '', age: '', illness: '', uiMode: 'younger' });
    setSelectedPatientId(response.user.id);
    toast({ title: 'Patient added', description: `${response.user.name} is now linked to your caretaker account.` });
  };

  if (user?.role === 'caretaker') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Caretaker Dashboard</h1>
          <p className="text-muted-foreground">Manage linked patients and monitor medication risk stability.</p>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Add Patient to Caretaker Account</h2>
            <form onSubmit={handleAddPatient} className="grid gap-3 sm:grid-cols-2">
              <input
                required
                value={patientForm.name}
                onChange={e => setPatientForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Patient name"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
              />
              <input
                required
                type="email"
                value={patientForm.email}
                onChange={e => setPatientForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Patient email"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
              />
              <input
                required
                type="password"
                value={patientForm.password}
                onChange={e => setPatientForm(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Temporary password"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
              />
              <input
                required
                type="number"
                min={1}
                max={120}
                value={patientForm.age}
                onChange={e => setPatientForm(prev => ({ ...prev, age: e.target.value }))}
                placeholder="Age"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground"
              />
              <input
                required
                value={patientForm.illness}
                onChange={e => setPatientForm(prev => ({ ...prev, illness: e.target.value }))}
                placeholder="Main condition"
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground sm:col-span-2"
              />
              <select
                value={patientForm.uiMode}
                onChange={e => setPatientForm(prev => ({ ...prev, uiMode: e.target.value as UiMode }))}
                className="rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground sm:col-span-2"
              >
                <option value="younger">Younger Interface (vivid)</option>
                <option value="older">Older Interface (simple)</option>
              </select>
              <button
                type="submit"
                disabled={savingPatient}
                className="gradient-primary rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground sm:col-span-2"
              >
                {savingPatient ? 'Adding Patient...' : 'Add Patient'}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Linked Patients</h2>
            {linkedPatients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No linked patients yet. Add your first patient from the form.</p>
            ) : (
              <div className="space-y-2">
                {linkedPatients.map(patient => (
                  <button
                    type="button"
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                      (selectedPatientId || linkedPatients[0]?.id) === patient.id
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border text-foreground'
                    }`}
                  >
                    <div className="font-semibold">{patient.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {patient.age ? `${patient.age} yrs` : 'Age N/A'} • {patient.illness || 'Condition N/A'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {caretakerView && (
          <section className="rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-lg font-semibold text-foreground">Patient Overview: {caretakerView.patientName}</h2>
            <div className="mb-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-muted-foreground">Stability</p>
                <p className="font-bold text-foreground">{caretakerView.adherence.label} ({caretakerView.adherence.score})</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-muted-foreground">Last Dose</p>
                <p className="font-bold uppercase text-foreground">{caretakerView.lastDoseStatus}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-muted-foreground">Missed Streak</p>
                <p className="font-bold text-foreground">{caretakerView.missedStreak}</p>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="text-muted-foreground">Risk Indicator</p>
                <p className="font-bold uppercase text-foreground">{caretakerView.riskIndicator}</p>
              </div>
            </div>
            <h3 className="mb-2 text-sm font-semibold text-foreground">Missed Medication Log</h3>
            {caretakerView.missedLog.length === 0 ? (
              <p className="text-sm text-muted-foreground">No missed medication logs for this patient.</p>
            ) : (
              <div className="space-y-2">
                {caretakerView.missedLog.slice(0, 8).map(log => (
                  <div key={`${log.medicationId}-${log.missedDate}-${log.scheduledTime}`} className="rounded-md border border-border px-3 py-2 text-sm">
                    <span className="font-semibold text-foreground">{log.drugName}</span>
                    <span className="ml-2 text-muted-foreground">{log.missedDate} at {log.scheduledTime}</span>
                    <span className="ml-2 text-destructive">{log.hoursDelayed}h delayed</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome */}
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Welcome back, {user?.name || 'User'} 👋</h1>
        <p className="text-muted-foreground">Here's your medication overview for today.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Age: {user?.age ?? 'N/A'} • Condition: {user?.illness || 'Not specified'} • Interface: {user?.uiMode || 'younger'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, color }, i) => (
          <div key={label} className="animate-fade-in rounded-xl border border-border bg-card p-5 shadow-card" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
              </div>
              <div className={`rounded-lg p-2.5 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <h2 className="mb-4 text-lg font-semibold text-foreground">Quick Actions</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {actions.map(({ to, label, icon: Icon, desc }) => (
          <Link key={to} to={to} className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated">
            <div className="rounded-lg gradient-primary p-2.5 text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground group-hover:text-primary">{label}</p>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Dashboard;
