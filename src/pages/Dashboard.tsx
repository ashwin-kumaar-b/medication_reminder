import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UiMode } from '@/contexts/AuthContext';
import { useMedicines } from '@/contexts/MedicineContext';
import { Pill, Clock, AlertTriangle, Plus, GitCompareArrows, HelpCircle, XCircle, BellRing } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Dashboard = () => {
  const { user, createPatientForCaretaker, getLinkedPatients } = useAuth();
  const { medicines, logs, getCaretakerDashboardData, getPatientDashboardData, markDoseStatus } = useMedicines();
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);
  const [statsRange, setStatsRange] = useState<'daily' | 'weekly'>('daily');
  const [alarmVisible, setAlarmVisible] = useState(false);
  const [alarmItemIds, setAlarmItemIds] = useState<string[]>([]);
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem('mediguard_alarm_snooze');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const alarmTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastNotifiedRef = useRef<string>('');
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
  const patientView = user?.id ? getPatientDashboardData(user.id) : null;

  const nextDoseGroup = useMemo(() => {
    if (!patientView) return null;

    const actionable = patientView.today
      .filter(item => item.status === 'pending' || item.status === 'delayed')
      .map(item => ({
        ...item,
        scheduledAt: new Date(`${new Date().toISOString().slice(0, 10)}T${item.medication.scheduleTime}:00`),
      }))
      .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    if (actionable.length === 0) return null;

    const nextTime = actionable[0].medication.scheduleTime;
    const items = actionable.filter(entry => entry.medication.scheduleTime === nextTime);
    const now = new Date();

    return {
      items,
      time: nextTime,
      isOverdue: items[0].scheduledAt.getTime() <= now.getTime(),
      minutesUntil: Math.max(0, Math.floor((items[0].scheduledAt.getTime() - now.getTime()) / 60000)),
    };
  }, [patientView]);

  const activeMeds = medicines.filter(m => m.isActive);
  const todayKey = new Date().toISOString().slice(0, 10);
  const weekStartDate = new Date();
  weekStartDate.setHours(0, 0, 0, 0);
  const dayOffset = (weekStartDate.getDay() + 6) % 7;
  weekStartDate.setDate(weekStartDate.getDate() - dayOffset);
  const weekStartKey = weekStartDate.toISOString().slice(0, 10);

  const logsThisWeek = logs.filter(log => log.date >= weekStartKey && log.date <= todayKey);
  const takenToday = logs.filter(log => log.status === 'taken' && log.date === todayKey).length;
  const missedToday = logs.filter(log => log.status === 'missed' && log.date === todayKey).length;
  const takenThisWeek = logsThisWeek.filter(log => log.status === 'taken').length;
  const missedThisWeek = logsThisWeek.filter(log => log.status === 'missed').length;

  const takenCount = statsRange === 'daily' ? takenToday : takenThisWeek;
  const missedCount = statsRange === 'daily' ? missedToday : missedThisWeek;
  const rangeLabel = statsRange === 'daily' ? 'Today' : 'This Week';

  const cards = [
    { label: 'Active Medicines', value: activeMeds.length, icon: Pill, color: 'text-primary bg-accent' },
    { label: `Taken ${rangeLabel}`, value: takenCount, icon: Clock, color: 'text-success bg-success/10' },
    { label: `Missed ${rangeLabel}`, value: missedCount, icon: XCircle, color: 'text-destructive bg-destructive/10' },
    { label: 'Total Medicines', value: medicines.length, icon: AlertTriangle, color: 'text-warning bg-warning/10' },
  ];

  const actions = [
    { to: '/add-medicine', label: 'Add Medicine', icon: Plus, desc: 'Add a new medication to your list' },
    { to: '/interaction-checker', label: 'Check Interactions', icon: GitCompareArrows, desc: 'Verify drug safety' },
    { to: '/can-i-take', label: 'Can I Take Now?', icon: HelpCircle, desc: 'Real-time dose safety check' },
  ];

  const playBeep = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new window.AudioContext();
      }

      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.25);
    } catch {
      // Ignore audio autoplay or context errors; visual overlay still alerts user.
    }
  };

  const stopAlarm = () => {
    if (alarmTimerRef.current) {
      window.clearInterval(alarmTimerRef.current);
      alarmTimerRef.current = null;
    }
  };

  const startAlarm = () => {
    if (alarmTimerRef.current) return;
    playBeep();
    alarmTimerRef.current = window.setInterval(() => {
      playBeep();
    }, 1300);
  };

  const closeAlarm = () => {
    stopAlarm();
    setAlarmVisible(false);
    setAlarmItemIds([]);
  };

  const handleTakeFromAlarm = async (medicationId: string) => {
    await markDoseStatus(medicationId, 'taken');
    setAlarmItemIds(prev => {
      const next = prev.filter(id => id !== medicationId);
      if (next.length === 0) {
        closeAlarm();
      }
      return next;
    });
    toast({ title: 'Dose marked as taken', description: 'Great job staying on schedule.' });
  };

  const handleTakeFromCard = async (medicationId: string) => {
    await markDoseStatus(medicationId, 'taken');
    toast({ title: 'Dose marked as taken', description: 'Medicine status updated.' });
  };

  const handleSnoozeFiveMinutes = () => {
    const until = Date.now() + 5 * 60 * 1000;
    setSnoozedUntil(prev => {
      const next = { ...prev };
      alarmItemIds.forEach(id => {
        next[id] = until;
      });
      return next;
    });
    closeAlarm();
    toast({ title: 'Snoozed', description: 'We will remind you again in 5 minutes.' });
  };

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

  useEffect(() => {
    localStorage.setItem('mediguard_alarm_snooze', JSON.stringify(snoozedUntil));
  }, [snoozedUntil]);

  useEffect(() => {
    if (!nextDoseGroup || !nextDoseGroup.isOverdue) {
      if (alarmVisible) closeAlarm();
      return;
    }

    const now = Date.now();
    const dueItems = nextDoseGroup.items.filter(item => (snoozedUntil[item.medication.id] || 0) <= now);

    if (dueItems.length === 0) {
      return;
    }

    const fingerprint = dueItems.map(item => item.medication.id).sort().join('|');
    setAlarmItemIds(dueItems.map(item => item.medication.id));
    setAlarmVisible(true);
    startAlarm();

    if (fingerprint !== lastNotifiedRef.current && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Medicine reminder', {
        body: `Time to take: ${dueItems.map(item => item.medication.drugName).join(', ')}`,
      });
      lastNotifiedRef.current = fingerprint;
    }

    if ('Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
  }, [nextDoseGroup, snoozedUntil]);

  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, []);

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
      <div className="mb-4 flex items-center justify-center">
        <div className="inline-flex rounded-full border border-border bg-card p-1.5 text-sm font-semibold shadow-card">
          <button
            type="button"
            onClick={() => setStatsRange('daily')}
            className={`rounded-full px-5 py-2 transition ${
              statsRange === 'daily' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => setStatsRange('weekly')}
            className={`rounded-full px-5 py-2 transition ${
              statsRange === 'weekly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Weekly
          </button>
        </div>
      </div>
      <div key={statsRange} className="mb-8 grid animate-fade-in gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {nextDoseGroup?.items.length && nextDoseGroup.items.length > 1 ? 'Next Medicines to Take' : 'Next Medicine to Take'}
          </h2>
          {nextDoseGroup && (
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              {nextDoseGroup.time}
            </span>
          )}
        </div>

        {!nextDoseGroup ? (
          <p className="text-sm text-muted-foreground">You are all caught up. No pending medicines for the rest of today.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {nextDoseGroup.isOverdue
                ? 'These medicines are due now. Please take them as soon as possible.'
                : `Upcoming dose window in ${nextDoseGroup.minutesUntil} minute(s).`}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {nextDoseGroup.items.map(item => (
                <div key={item.medication.id} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {item.medication.photoUrl ? (
                        <img
                          src={item.medication.photoUrl}
                          alt={item.medication.drugName}
                          className="h-14 w-14 rounded-md border border-border object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-md border border-border bg-accent text-accent-foreground">
                          <Pill className="h-5 w-5" />
                        </div>
                      )}
                      <p className="font-semibold text-foreground">{item.medication.drugName}</p>
                    </div>
                    <span className="text-xs font-medium uppercase text-muted-foreground">{item.medication.criticality}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.medication.dosage}</p>
                  <p className="text-xs text-muted-foreground">Category: {item.medication.category}</p>
                  <p className="text-xs text-muted-foreground">Scheduled at: {item.medication.scheduleTime}</p>
                  {nextDoseGroup.isOverdue && (
                    <button
                      type="button"
                      onClick={() => void handleTakeFromCard(item.medication.id)}
                      className="mt-3 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Took medicine
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {alarmVisible && alarmItemIds.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-xl rounded-xl border border-warning/40 bg-card p-5 shadow-elevated">
            <div className="mb-3 flex items-center gap-2 text-warning">
              <BellRing className="h-5 w-5" />
              <h3 className="text-lg font-semibold text-foreground">Medicine Reminder</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">Your scheduled medicine is due now. Take it, snooze for 5 minutes, or stop the alarm.</p>
            <div className="space-y-3">
              {alarmItemIds.map(id => {
                const item = nextDoseGroup?.items.find(entry => entry.medication.id === id);
                if (!item) return null;
                return (
                  <div key={id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="font-semibold text-foreground">{item.medication.drugName}</p>
                    <p className="text-xs text-muted-foreground">Scheduled at: {item.medication.scheduleTime}</p>
                    <button
                      type="button"
                      onClick={() => void handleTakeFromAlarm(id)}
                      className="mt-2 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Took medicine
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSnoozeFiveMinutes}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              >
                Snooze 5 min
              </button>
              <button
                type="button"
                onClick={closeAlarm}
                className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground"
              >
                Stop
              </button>
            </div>
          </div>
        </div>
      )}

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
