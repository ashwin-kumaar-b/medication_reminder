import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, UiMode } from '@/contexts/AuthContext';
import { useMedicines } from '@/contexts/MedicineContext';
import { Pill, Clock, AlertTriangle, Plus, GitCompareArrows, HelpCircle, XCircle, BellRing } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from '@/features/settings/SettingsContext';
import { getMissedDoseSeverityInsight, MissedDoseSeverityInsight } from '@/lib/medicationApis';

const Dashboard = () => {
  const { user, createPatientForCaretaker, getLinkedPatients } = useAuth();
  const { settings, t } = useAppSettings();
  const { medicines, logs, getCaretakerDashboardData, getPatientDashboardData, markDoseStatus } = useMedicines();
  const { toast } = useToast();
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [savingPatient, setSavingPatient] = useState(false);
  const [statsRange, setStatsRange] = useState<'daily' | 'weekly'>('daily');
  const [missedDoseInsight, setMissedDoseInsight] = useState<MissedDoseSeverityInsight | null>(null);
  const [loadingMissedDoseInsight, setLoadingMissedDoseInsight] = useState(false);
  const [alarmVisible, setAlarmVisible] = useState(false);
  const [alarmItemIds, setAlarmItemIds] = useState<string[]>([]);
  const [manualAlarmMode, setManualAlarmMode] = useState(false);
  const [snoozeMeta, setSnoozeMeta] = useState<Record<string, { until: number; count: number; date: string }>>(() => {
    try {
      const raw = localStorage.getItem('mediguard_alarm_snooze_meta');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
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
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
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
  const rangeLabel = statsRange === 'daily' ? t('common.today') : t('common.thisWeek');

  const cards = [
    { label: t('dashboard.activeMedicines'), value: activeMeds.length, icon: Pill, color: 'text-primary bg-accent' },
    { label: `${t('dashboard.taken')} ${rangeLabel}`, value: takenCount, icon: Clock, color: 'text-success bg-success/10' },
    { label: `${t('dashboard.missed')} ${rangeLabel}`, value: missedCount, icon: XCircle, color: 'text-destructive bg-destructive/10' },
    { label: t('dashboard.totalMedicines'), value: medicines.length, icon: AlertTriangle, color: 'text-warning bg-warning/10' },
  ];

  const actions = [
    { to: '/add-medicine', label: t('actions.addMedicine'), icon: Plus, desc: t('actions.addMedicineDesc') },
    { to: '/interaction-checker', label: t('actions.checkInteractions'), icon: GitCompareArrows, desc: t('actions.checkInteractionsDesc') },
    { to: '/can-i-take', label: t('actions.canITakeNow'), icon: HelpCircle, desc: t('actions.canITakeNowDesc') },
  ];

  const missedMedicationRows = useMemo(() => {
    const relevantMissedLogs = logs.filter(log => {
      if (log.status !== 'missed') return false;
      return statsRange === 'daily' ? log.date === todayKey : log.date >= weekStartKey && log.date <= todayKey;
    });
    const uniqueMedicationIds = Array.from(new Set(relevantMissedLogs.map(log => log.medicationId)));

    return uniqueMedicationIds
      .map(medicationId => {
        const medication = medicines.find(med => med.id === medicationId);
        if (!medication) return null;

        const medMissedLogs = relevantMissedLogs.filter(log => log.medicationId === medicationId);
        const lastMissedDate = medMissedLogs
          .map(entry => entry.date)
          .sort((a, b) => (a < b ? 1 : -1))[0] || todayKey;

        return {
          drugName: medication.name || 'Medication',
          category: 'other',
          criticality: 'medium',
          missedCount: medMissedLogs.length,
          lastMissedDate,
        };
      })
      .filter(Boolean) as Array<{
      drugName: string;
      category: string;
      criticality: string;
      missedCount: number;
      lastMissedDate: string;
    }>;
  }, [logs, medicines, statsRange, todayKey, weekStartKey]);

  const missedMedicationFingerprint = useMemo(
    () =>
      missedMedicationRows
        .map(item => `${item.drugName}|${item.category}|${item.criticality}|${item.missedCount}|${item.lastMissedDate}`)
        .sort()
        .join('::'),
    [missedMedicationRows],
  );

  const missedDrugNames = useMemo(
    () => missedMedicationRows.map(item => item.drugName).filter(Boolean).join(', '),
    [missedMedicationRows],
  );

  const missedDoseSummaryText = useMemo(() => {
    if (missedMedicationRows.length === 0) return '';

    if (missedMedicationRows.length === 1) {
      const row = missedMedicationRows[0];
      const doseLabel = row.missedCount > 1 ? 'doses' : 'dose';
      return `You missed ${row.missedCount} ${doseLabel} of ${row.drugName}.`;
    }

    const totalMissed = missedMedicationRows.reduce((sum, item) => sum + item.missedCount, 0);
    return `You missed ${totalMissed} doses across these medicines: ${missedDrugNames}.`;
  }, [missedMedicationRows, missedDrugNames]);

  const playBeep = () => {
    if (settings.notificationSound === 'cherie') {
      if (!alarmAudioRef.current) {
        alarmAudioRef.current = new Audio('/sounds/cherie-reminder.mp3');
      }
      alarmAudioRef.current.volume = settings.notificationVolume;
      alarmAudioRef.current.currentTime = 0;
      void alarmAudioRef.current.play();
      return;
    }

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
      if (settings.notificationSound === 'soft') {
        oscillator.type = 'triangle';
        oscillator.frequency.value = 620;
      } else if (settings.notificationSound === 'urgent') {
        oscillator.type = 'square';
        oscillator.frequency.value = 960;
      } else {
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
      }
      gain.gain.value = settings.notificationVolume;
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

    if (alarmAudioRef.current) {
      alarmAudioRef.current.pause();
      alarmAudioRef.current.currentTime = 0;
    }
  };

  const startAlarm = () => {
    if (alarmTimerRef.current) return;
    playBeep();
    alarmTimerRef.current = window.setInterval(() => {
      playBeep();
    }, settings.notificationSound === 'urgent' ? 800 : settings.notificationSound === 'cherie' ? 7000 : 1300);
  };

  const closeAlarm = () => {
    stopAlarm();
    setAlarmVisible(false);
    setAlarmItemIds([]);
    setManualAlarmMode(false);
  };

  const clearSnoozeForMedication = (medicationId: string) => {
    setSnoozedUntil(prev => {
      const next = { ...prev };
      delete next[medicationId];
      return next;
    });
    setSnoozeMeta(prev => {
      const next = { ...prev };
      delete next[medicationId];
      return next;
    });
  };

  const handleTestReminder = () => {
    if (!nextDoseGroup || nextDoseGroup.items.length === 0) {
      toast({ title: t('dashboard.noMedicineToTest'), description: t('dashboard.addPendingForPreview') });
      return;
    }

    setManualAlarmMode(true);
    setAlarmItemIds(nextDoseGroup.items.map(item => item.medication.id));
    setAlarmVisible(true);
    startAlarm();
  };

  const handleTakeFromAlarm = async (medicationId: string) => {
    await markDoseStatus(medicationId, 'taken');
    clearSnoozeForMedication(medicationId);
    setAlarmItemIds(prev => {
      const next = prev.filter(id => id !== medicationId);
      if (next.length === 0) {
        closeAlarm();
      }
      return next;
    });
    toast({ title: t('dashboard.doseMarkedTaken'), description: t('dashboard.greatJob') });
  };

  const handleTakeFromCard = async (medicationId: string) => {
    await markDoseStatus(medicationId, 'taken');
    clearSnoozeForMedication(medicationId);
    toast({ title: t('dashboard.doseMarkedTaken'), description: t('dashboard.medicineStatusUpdated') });
  };

  const handleSnoozeFiveMinutes = () => {
    const until = Date.now() + 5 * 60 * 1000;
    const dateKey = new Date().toISOString().slice(0, 10);

    setSnoozedUntil(prev => {
      const next = { ...prev };
      alarmItemIds.forEach(id => {
        next[id] = until;
      });
      return next;
    });

    setSnoozeMeta(prev => {
      const next = { ...prev };
      alarmItemIds.forEach(id => {
        const existing = next[id];
        const previousCount = existing?.date === dateKey ? existing.count : 0;
        next[id] = {
          until,
          count: previousCount + 1,
          date: dateKey,
        };
      });
      return next;
    });

    closeAlarm();
    toast({ title: t('dashboard.snoozed'), description: t('dashboard.remindAgainFive') });
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
    localStorage.setItem('mediguard_alarm_snooze_meta', JSON.stringify(snoozeMeta));
  }, [snoozeMeta]);

  useEffect(() => {
    if (!nextDoseGroup || !nextDoseGroup.isOverdue) {
      if (alarmVisible && !manualAlarmMode) closeAlarm();
      return;
    }

    const now = Date.now();
    const dueItems = nextDoseGroup.items.filter(item => (snoozedUntil[item.medication.id] || 0) <= now);

    if (dueItems.length === 0) {
      return;
    }

    const fingerprint = dueItems.map(item => item.medication.id).sort().join('|');
    setManualAlarmMode(false);
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
  }, [nextDoseGroup, snoozedUntil, manualAlarmMode]);

  useEffect(() => {
    return () => {
      stopAlarm();
    };
  }, [settings.notificationSound]);

  useEffect(() => {
    if (user?.role !== 'patient') return;

    if (missedMedicationRows.length === 0) {
      setMissedDoseInsight(null);
      setLoadingMissedDoseInsight(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoadingMissedDoseInsight(true);
      const insight = await getMissedDoseSeverityInsight({
        patientAge: user?.age,
        condition: user?.illness,
        language: settings.language,
        missed: missedMedicationRows,
      });
      if (cancelled) return;
      setMissedDoseInsight(insight);
      setLoadingMissedDoseInsight(false);
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [user?.role, user?.age, user?.illness, settings.language, missedMedicationFingerprint]);

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
        <h1 className="text-2xl font-bold text-foreground">{t('dashboard.welcomeBack')}, {user?.name || 'User'} 👋</h1>
        <p className="text-muted-foreground">{t('dashboard.overviewToday')}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('dashboard.age')}: {user?.age ?? 'N/A'} • {t('dashboard.condition')}: {user?.illness || t('dashboard.notSpecified')} • {t('dashboard.interface')}: {user?.uiMode || 'younger'}
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
            {t('common.daily')}
          </button>
          <button
            type="button"
            onClick={() => setStatsRange('weekly')}
            className={`rounded-full px-5 py-2 transition ${
              statsRange === 'weekly' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            {t('common.weekly')}
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

      {missedMedicationRows.length > 0 && (
        <section className="mb-8 rounded-xl border-2 border-destructive/50 bg-gradient-to-br from-destructive/10 via-card to-destructive/5 p-5 shadow-elevated">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-destructive/15 text-destructive animate-pulse">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-extrabold tracking-wide text-destructive">{t('dashboard.missedDoseSeverity')}</h2>
            </div>
            {missedDoseInsight?.severity && (
              <span
                className={`rounded-full border px-3 py-1 text-xs font-extrabold tracking-wider uppercase ${
                  missedDoseInsight.severity === 'high'
                    ? 'border-destructive/40 bg-destructive/20 text-destructive'
                    : missedDoseInsight.severity === 'moderate'
                    ? 'border-warning/40 bg-warning/20 text-warning'
                    : 'border-success/40 bg-success/15 text-success'
                }`}
              >
                {missedDoseInsight.severity === 'high'
                  ? t('risk.high')
                  : missedDoseInsight.severity === 'moderate'
                  ? t('risk.moderate')
                  : t('risk.low')}
              </span>
            )}
          </div>

          <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-bold uppercase tracking-wide text-destructive">
            {t('dashboard.immediateAdherenceWarning')}
          </p>
          {missedDrugNames && (
            <p className="mb-3 text-sm font-semibold text-foreground">
              {t('dashboard.missedMedicines')}: {missedDrugNames}
            </p>
          )}

          {loadingMissedDoseInsight ? (
            <p className="text-sm font-medium text-destructive/90">{t('dashboard.analyzingMissedDoseDanger')}</p>
          ) : missedDoseInsight ? (
            <>
              <p className="mb-2 text-base font-semibold text-foreground">{missedDoseSummaryText}</p>
              <p className="mb-2 text-sm text-foreground/90">{missedDoseInsight.guidance}</p>
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
                {missedDoseInsight.riskProgression}
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">{t('common.source')}: {missedDoseInsight.source}</p>
            </>
          ) : (
            <p className="text-sm text-destructive/90">{t('dashboard.groqDangerUnavailable')}</p>
          )}
        </section>
      )}

      <section className="mb-8 rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {nextDoseGroup?.items.length && nextDoseGroup.items.length > 1 ? t('dashboard.nextMedicinePlural') : t('dashboard.nextMedicineSingle')}
          </h2>
          <div className="flex items-center gap-2">
            {nextDoseGroup && (
              <>
                <button
                  type="button"
                  onClick={handleTestReminder}
                  className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground hover:bg-muted"
                >
                  {t('dashboard.testReminder')}
                </button>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                  {nextDoseGroup.time}
                </span>
              </>
            )}
          </div>
        </div>

        {!nextDoseGroup ? (
          <p className="text-sm text-muted-foreground">{t('dashboard.noPending')}</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {nextDoseGroup.isOverdue
                ? t('dashboard.dueNow')
                : `${t('dashboard.upcomingWindow')} ${nextDoseGroup.minutesUntil} minute(s).`}
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
                  <p className="text-xs text-muted-foreground">{t('dashboard.category')}: {item.medication.category}</p>
                  <p className="text-xs text-muted-foreground">{t('dashboard.scheduledAt')}: {item.medication.scheduleTime}</p>
                  {nextDoseGroup.isOverdue && (
                    <button
                      type="button"
                      onClick={() => void handleTakeFromCard(item.medication.id)}
                      className="mt-3 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      {t('dashboard.tookMedicine')}
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
              <h3 className="text-lg font-semibold text-foreground">{t('dashboard.medicineReminder')}</h3>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">{t('dashboard.overlayDueNowHelp')}</p>
            <div className="space-y-3">
              {alarmItemIds.map(id => {
                const item = nextDoseGroup?.items.find(entry => entry.medication.id === id);
                if (!item) return null;
                return (
                  <div key={id} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="font-semibold text-foreground">{item.medication.drugName}</p>
                    <p className="text-xs text-muted-foreground">{t('dashboard.scheduledAt')}: {item.medication.scheduleTime}</p>
                    <button
                      type="button"
                      onClick={() => void handleTakeFromAlarm(id)}
                      className="mt-2 rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      {t('dashboard.tookMedicine')}
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
                {t('dashboard.snoozeFiveMin')}
              </button>
              <button
                type="button"
                onClick={closeAlarm}
                className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground"
              >
                {t('dashboard.stop')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <h2 className="mb-4 text-lg font-semibold text-foreground">{t('dashboard.quickActions')}</h2>
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
