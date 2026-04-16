import { useMemo, useState } from 'react';
import { useMedicines } from '@/contexts/MedicineContext';
import { BarChart3, TrendingUp, AlertTriangle, Loader2, FlaskConical } from 'lucide-react';
import { useAppSettings } from '@/features/settings/SettingsContext';
import { getMissedDoseRecoveryAdvice, MissedDoseRecoveryAdvice } from '@/lib/medicationApis';

const MissedDoses = () => {
  const { medicines, doseLogs, medications } = useMedicines();
  const { settings } = useAppSettings();
  const [adviceByLogId, setAdviceByLogId] = useState<Record<string, MissedDoseRecoveryAdvice>>({});
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);

  const getMedStats = (medId: string) => {
    const logs = doseLogs.filter(l => l.medicineId === medId);
    const taken = logs.filter(l => l.status === 'taken').length;
    const missed = logs.filter(l => l.status === 'missed').length;
    const total = taken + missed;
    const adherence = total > 0 ? Math.round((taken / total) * 100) : 100;
    return { taken, missed, total, adherence };
  };

  const missedLogsByMedicine = useMemo(() => {
    const grouped: Record<string, typeof doseLogs> = {};
    doseLogs
      .filter(log => log.status === 'missed')
      .forEach(log => {
        if (!grouped[log.medicineId]) grouped[log.medicineId] = [];
        grouped[log.medicineId].push(log);
      });

    Object.keys(grouped).forEach(key => {
      grouped[key] = grouped[key]
        .slice()
        .sort((a, b) => (a.scheduledTime < b.scheduledTime ? 1 : -1));
    });

    return grouped;
  }, [doseLogs]);

  const parseFoodTiming = (text?: string): 'before-food' | 'after-food' | 'unknown' => {
    const lowered = (text || '').toLowerCase();
    if (lowered.includes('before')) return 'before-food';
    if (lowered.includes('after')) return 'after-food';
    return 'unknown';
  };

  const handleCanITakeNow = async (medicineId: string, logId: string) => {
    const med = medicines.find(item => item.id === medicineId);
    const canonicalMed = medications.find(item => item.id === medicineId);
    const missedLog = (missedLogsByMedicine[medicineId] || []).find(entry => entry.id === logId);
    if (!med || !missedLog) return;

    const recentMissedCount = (missedLogsByMedicine[medicineId] || []).length;
    setLoadingLogId(logId);
    const advice = await getMissedDoseRecoveryAdvice({
      language: settings.language,
      medication: {
        drugName: canonicalMed?.drugName || med.name,
        dosage: canonicalMed?.dosage || med.dosage,
        category: canonicalMed?.category || 'other',
        criticality: canonicalMed?.criticality || 'medium',
        frequency: canonicalMed?.frequency || med.frequency,
        foodTiming: canonicalMed?.foodTiming || parseFoodTiming(med.foodInstructions),
        scheduledTime: canonicalMed?.scheduleTime || med.timeSlots?.[0] || 'N/A',
        missedScheduledAt: missedLog.scheduledTime,
        missedCountForMedication: recentMissedCount,
        missedCountRecentWindow: recentMissedCount,
      },
    });

    if (advice) {
      setAdviceByLogId(prev => ({ ...prev, [logId]: advice }));
    }
    setLoadingLogId(null);
  };

  const actionLabelMap: Record<MissedDoseRecoveryAdvice['action'], string> = {
    'take-full-dose-now': 'Take Full Dose Now',
    'take-half-dose-now': 'Take Half Dose Now',
    'skip-and-resume-next': 'Skip And Resume Next',
    'contact-clinician-now': 'Contact Clinician Now',
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Missed Dose Analyzer</h1>
        <p className="text-muted-foreground">Track your medication adherence</p>
      </div>

      {medicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No medicines to analyze yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {medicines.map((med, i) => {
            const stats = getMedStats(med.id);
            return (
              <div key={med.id} className="animate-fade-in rounded-xl border border-border bg-card p-5 shadow-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{med.name} <span className="text-sm text-muted-foreground">({med.dosage})</span></h3>
                  <span className={`text-sm font-semibold ${stats.adherence >= 80 ? 'text-success' : stats.adherence >= 50 ? 'text-warning' : 'text-destructive'}`}>
                    {stats.adherence}% adherence
                  </span>
                </div>
                {/* Simple bar */}
                <div className="mb-3 h-3 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full transition-all ${stats.adherence >= 80 ? 'bg-success' : stats.adherence >= 50 ? 'bg-warning' : 'bg-destructive'}`}
                    style={{ width: `${stats.adherence}%` }} />
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5 text-success" /> {stats.taken} taken</span>
                  <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> {stats.missed} missed</span>
                </div>
                {stats.missed >= 3 && (
                  <p className="mt-2 text-xs font-medium text-destructive">⚠️ You've missed {stats.missed} doses — consider consulting your doctor.</p>
                )}

                {(missedLogsByMedicine[med.id] || []).length > 0 && (
                  <div className="mt-4 space-y-3 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Missed dose decisions</p>
                    {(missedLogsByMedicine[med.id] || []).slice(0, 3).map(log => {
                      const advice = adviceByLogId[log.id];
                      return (
                        <div key={log.id} className="rounded-md border border-border bg-card p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Missed at: {new Date(log.scheduledTime).toLocaleString()}</p>
                            <button
                              type="button"
                              disabled={loadingLogId === log.id}
                              onClick={() => void handleCanITakeNow(med.id, log.id)}
                              className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                            >
                              {loadingLogId === log.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                              Can I take it now?
                            </button>
                          </div>

                          {advice && (
                            <div className="space-y-1.5 text-sm">
                              <p className="font-semibold text-foreground">Action: {actionLabelMap[advice.action]}</p>
                              <p className={`text-xs font-semibold ${advice.urgency === 'high' ? 'text-destructive' : advice.urgency === 'moderate' ? 'text-warning' : 'text-success'}`}>
                                Urgency: {advice.urgency.toUpperCase()} | Confidence: {advice.confidence.toUpperCase()}
                              </p>
                              <p className="text-muted-foreground">{advice.technicalRationale}</p>
                              <p className="text-muted-foreground">Food timing: {advice.foodTimingInstruction}</p>
                              {advice.monitoringNotes.length > 0 && (
                                <ul className="list-disc pl-5 text-xs text-muted-foreground">
                                  {advice.monitoringNotes.map((note, idx) => (
                                    <li key={`${log.id}-note-${idx}`}>{note}</li>
                                  ))}
                                </ul>
                              )}
                              <p className="text-[11px] text-muted-foreground">Source: {advice.source}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MissedDoses;
