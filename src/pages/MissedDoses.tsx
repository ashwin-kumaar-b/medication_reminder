import { useMemo, useState } from 'react';
import { useMedicines } from '@/contexts/MedicineContext';
import { BarChart3, TrendingUp, AlertTriangle, Loader2, FlaskConical } from 'lucide-react';
import { useAppSettings } from '@/features/settings/SettingsContext';
import { getMissedDoseRecoveryAdvice, MissedDoseRecoveryAdvice } from '@/lib/medicationApis';
import { parseMedicineName } from '@/utils/medicineUtils';

// Deterministic color palette
const MED_COLORS = ["#1D9E75", "#D85A30", "#378ADD", "#BA7517", "#7F77DD", "#D4537E"];

const getWeekStart = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return date;
};

const hexToRgbA = (hex: string, alpha: number) => {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const MissedDoses = () => {
  const { medicines, doseLogs, medications } = useMedicines();
  const { settings } = useAppSettings();
  const [adviceByLogId, setAdviceByLogId] = useState<Record<string, MissedDoseRecoveryAdvice>>({});
  const [loadingLogId, setLoadingLogId] = useState<string | null>(null);

  const uniqueMedicines = useMemo(() => {
    const map = new Map<string, typeof medicines[0] & { sourceIds: string[] }>();
    medicines.forEach(med => {
      const nameKey = parseMedicineName(med.name).brandName.toLowerCase();
      const key = `${nameKey}|${med.dosage || ''}`;
      const existing = map.get(key);
      if (existing) {
        existing.sourceIds.push(med.id);
      } else {
        map.set(key, { ...med, sourceIds: [med.id] });
      }
    });
    return Array.from(map.values());
  }, [medicines]);

  const weekStart = useMemo(() => getWeekStart(), []);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return {
          key: date.toISOString().slice(0, 10),
          label: ['S', 'M', 'T', 'W', 'T', 'F', 'S'][(date.getDay()) % 7], // standard S M T W T F S alignment
        };
      }),
    [weekStart],
  );

  const weeklyLogs = useMemo(
    () =>
      doseLogs.filter(log => {
        const date = new Date(log.scheduledTime);
        return !Number.isNaN(date.getTime()) && date >= weekStart;
      }),
    [doseLogs, weekStart],
  );

  const weeklyTaken = weeklyLogs.filter(log => log.status === 'taken').length;
  const weeklyScheduled = weeklyLogs.length;
  const weeklyAdherence = weeklyScheduled > 0 ? Math.round((weeklyTaken / weeklyScheduled) * 100) : 0;
  const ringProgress = Math.max(0, Math.min(100, weeklyAdherence));

  const getMedStats = (sourceIds: string[]) => {
    const logs = doseLogs.filter(l => sourceIds.includes(l.medicineId));
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

      <div className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Adherence Ring */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="grid h-40 w-40 place-items-center rounded-full"
              style={{
                background: `conic-gradient(#1D9E75 ${ringProgress * 3.6}deg, hsl(var(--muted)) 0deg)`,
              }}
            >
              <div className="grid h-32 w-32 place-items-center rounded-full bg-card text-center">
                <p className="text-4xl font-bold text-foreground">{weeklyAdherence}%</p>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mt-1">This week</p>
              </div>
            </div>
            <div className="text-center mt-3">
              <p className="text-[13px] font-semibold text-foreground">Weekly Overview</p>
              <p className="text-[12px] text-muted-foreground">Taken {weeklyTaken} of {weeklyScheduled} scheduled</p>
            </div>
          </div>

          {/* Stacked Bar Chart */}
          <div className="flex-1 w-full flex flex-col justify-end min-w-[240px]">
            {/* Legend row */}
            <div className="flex flex-wrap gap-x-4 gap-y-2 mb-4">
              {uniqueMedicines.map((med, idx) => {
                const color = MED_COLORS[idx % MED_COLORS.length];
                return (
                  <div key={`legend-${med.id}`} className="flex items-center gap-1.5">
                    <div className="w-[10px] h-[10px] rounded-[2px]" style={{ backgroundColor: color }} />
                    <span className="text-[13px] text-muted-foreground font-medium whitespace-nowrap">{parseMedicineName(med.name).brandName}</span>
                  </div>
                );
              })}
            </div>

            {/* Chart */}
            <div className="h-[180px] w-full flex items-end justify-between px-2 gap-2">
              {weekDays.map((day, dIdx) => {
                // Determine heights basically stacking them
                // We'll give equal height share to all scheduled medicines for that day.
                // Or flex-1 for each scheduled medicine.
                return (
                  <div key={day.key} className="flex-1 flex flex-col items-center justify-end h-full">
                    <div className="flex flex-col justify-end w-full max-w-[24px] h-[150px] gap-1 shrink-0 overflow-hidden">
                      {uniqueMedicines.map((med, mIdx) => {
                        const logsForDay = weeklyLogs.filter(l => med.sourceIds.includes(l.medicineId) && l.scheduledTime.startsWith(day.key));
                        if (logsForDay.length === 0) return null;
                        
                        const color = MED_COLORS[mIdx % MED_COLORS.length];
                        const allTaken = logsForDay.every(l => l.status === 'taken');
                        
                        return (
                          <div 
                            key={`segment-${day.key}-${med.id}`}
                            className="w-full flex-1 rounded-[4px] relative"
                            style={{
                              backgroundColor: allTaken ? color : hexToRgbA(color, 0.35),
                            }}
                          >
                            {!allTaken && (
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_2px_rgba(0,0,0,0.5)]" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <span className="text-[12px] font-medium text-muted-foreground mt-2 uppercase">{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {uniqueMedicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
          <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">No medicines to analyze yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground mb-3 mt-8">Your Medicines</h2>
          <div className="flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            {uniqueMedicines.map((med, i) => {
              const stats = getMedStats(med.sourceIds);
              const color = MED_COLORS[i % MED_COLORS.length];
              
              return (
                <div key={med.id} className="animate-fade-in border-b border-border/50 last:border-b-0 p-4 min-h-[48px] flex items-center justify-between" style={{ animationDelay: `${i * 0.05}s` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-[15px] text-foreground">{parseMedicineName(med.name).brandName}</span>
                      <span className="text-[12px] text-muted-foreground">{stats.taken} taken / {stats.missed} missed</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-right">
                    <span className="font-semibold text-[14px] text-foreground">{med.dosage}</span>
                    <span className={`text-[12px] font-bold ${stats.adherence === 100 ? 'text-[#1D9E75]' : stats.adherence >= 50 ? 'text-[#D85A30]' : 'text-destructive'}`}>
                      {stats.adherence}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 space-y-4">
            {uniqueMedicines.map(med => {
              const missedLogs = med.sourceIds.flatMap(id => missedLogsByMedicine[id] || [])
                .sort((a, b) => (a.scheduledTime < b.scheduledTime ? 1 : -1));
              
              if (missedLogs.length === 0) return null;

              return (
                <div key={`decisions-${med.id}`} className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <h3 className="font-semibold text-destructive uppercase tracking-wide text-xs">Missed Dose Decisions: {parseMedicineName(med.name).brandName}</h3>
                  </div>

                  <div className="space-y-3">
                    {missedLogs.slice(0, 3).map(log => {
                      const advice = adviceByLogId[log.id];
                      return (
                        <div key={log.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-y-2">
                            <p className="text-[13px] font-medium text-foreground">Missed at: {new Date(log.scheduledTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                            <button
                              type="button"
                              disabled={loadingLogId === log.id}
                              onClick={() => void handleCanITakeNow(log.medicineId, log.id)}
                              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60 transition-colors hover:bg-primary/90"
                            >
                              {loadingLogId === log.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                              Can I take it now?
                            </button>
                          </div>

                          {advice && (
                            <div className="mt-3 space-y-2 rounded-md bg-muted/50 p-3 text-sm">
                              <p className="font-semibold text-foreground">Action: <span className="text-primary">{actionLabelMap[advice.action]}</span></p>
                              <p className={`text-xs font-bold ${advice.urgency === 'high' ? 'text-destructive' : advice.urgency === 'moderate' ? 'text-warning' : 'text-[#1D9E75]'}`}>
                                Urgency: {advice.urgency.toUpperCase()} | Confidence: {advice.confidence.toUpperCase()}
                              </p>
                              <p className="text-muted-foreground text-[13px] leading-relaxed">{advice.technicalRationale}</p>
                              <p className="text-muted-foreground text-[13px]"><strong>Food timing:</strong> {advice.foodTimingInstruction}</p>
                              {advice.monitoringNotes.length > 0 && (
                                <ul className="list-disc pl-5 text-[13px] text-muted-foreground mt-1 space-y-0.5">
                                  {advice.monitoringNotes.map((note, idx) => (
                                    <li key={`${log.id}-note-${idx}`}>{note}</li>
                                  ))}
                                </ul>
                              )}
                              <div className="mt-3 pt-2 border-t border-border/50">
                                <p className="text-[11px] text-muted-foreground/80 leading-tight">
                                  This advice is based on your dosing schedule and FDA label guidance for <strong>{med.name}</strong>. Consult your pharmacist for personalized advice.
                                </p>
                                <p className="text-[10px] text-muted-foreground/60 mt-1">Source: {advice.source}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MissedDoses;
