import { useMedicines } from '@/contexts/MedicineContext';
import { BarChart3, TrendingUp, AlertTriangle } from 'lucide-react';

const MissedDoses = () => {
  const { medicines, doseLogs } = useMedicines();

  const getMedStats = (medId: string) => {
    const logs = doseLogs.filter(l => l.medicineId === medId);
    const taken = logs.filter(l => l.status === 'taken').length;
    const missed = logs.filter(l => l.status === 'missed').length;
    const total = taken + missed;
    const adherence = total > 0 ? Math.round((taken / total) * 100) : 100;
    return { taken, missed, total, adherence };
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MissedDoses;
