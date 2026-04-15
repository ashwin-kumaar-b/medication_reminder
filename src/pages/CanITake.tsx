import { useState } from 'react';
import { useMedicines } from '@/contexts/MedicineContext';
import { HelpCircle, CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';

const CanITake = () => {
  const { medicines, doseLogs } = useMedicines();
  const [selectedId, setSelectedId] = useState('');
  const [result, setResult] = useState<{ status: 'yes' | 'wait' | 'skip'; message: string } | null>(null);

  const handleCheck = () => {
    const med = medicines.find(m => m.id === selectedId);
    if (!med) return;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Check if within ±60 min of any scheduled time
    const inWindow = med.timeSlots.some(slot => {
      const [h, m] = slot.split(':').map(Number);
      const scheduled = h * 60 + m;
      return Math.abs(currentMinutes - scheduled) <= 60;
    });

    // Check last dose
    const recentLogs = doseLogs.filter(l => l.medicineId === med.id && l.status === 'taken');
    const lastTaken = recentLogs.length > 0 ? new Date(recentLogs[recentLogs.length - 1].takenTime || '') : null;
    const hoursSinceLast = lastTaken ? (now.getTime() - lastTaken.getTime()) / (1000 * 60 * 60) : 999;

    const minGap = med.frequency === 'daily' ? 20 : med.frequency === 'twice' ? 10 : 6;

    if (hoursSinceLast < minGap) {
      setResult({ status: 'skip', message: `You took ${med.name} ${Math.round(hoursSinceLast)} hours ago. Wait at least ${minGap} hours between doses to avoid double dosing.` });
    } else if (inWindow) {
      setResult({ status: 'yes', message: `✅ It's within your scheduled time window. You can safely take ${med.name} now.` });
    } else {
      const nextSlot = med.timeSlots.reduce((closest, slot) => {
        const [h, m] = slot.split(':').map(Number);
        const mins = h * 60 + m;
        const diff = mins - currentMinutes;
        return diff > 0 && diff < closest.diff ? { time: slot, diff } : closest;
      }, { time: med.timeSlots[0], diff: 9999 });
      setResult({ status: 'wait', message: `⏰ Your next dose of ${med.name} is scheduled at ${nextSlot.time}. Wait until then for optimal timing.` });
    }
  };

  const statusConfig = {
    yes: { icon: CheckCircle, className: 'border-success/30 bg-success/5 text-success' },
    wait: { icon: AlertTriangle, className: 'border-warning/30 bg-warning/5 text-warning' },
    skip: { icon: XCircle, className: 'border-destructive/30 bg-destructive/5 text-destructive' },
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Can I Take Now?</h1>
        <p className="text-muted-foreground">Real-time safety check before taking your dose</p>
      </div>

      <div className="mb-6 animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
        {medicines.length === 0 ? (
          <p className="text-center text-muted-foreground">Add medicines first to use this feature.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Select Medicine</label>
              <select value={selectedId} onChange={e => { setSelectedId(e.target.value); setResult(null); }}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20">
                <option value="">Choose a medicine...</option>
                {medicines.filter(m => m.isActive).map(m => (
                  <option key={m.id} value={m.id}>{m.name} — {m.dosage}</option>
                ))}
              </select>
            </div>
            <button onClick={handleCheck} disabled={!selectedId} className="gradient-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <HelpCircle className="h-4 w-4" /> Check Now
            </button>
          </div>
        )}
      </div>

      {result && (() => {
        const cfg = statusConfig[result.status];
        const Icon = cfg.icon;
        return (
          <div className={`animate-fade-in rounded-xl border p-5 ${cfg.className}`}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-5 w-5" />
              <span className="font-semibold">{result.status === 'yes' ? 'Yes, Take It Now' : result.status === 'wait' ? 'Wait' : 'Skip This Dose'}</span>
            </div>
            <p className="text-sm leading-relaxed opacity-90">{result.message}</p>
          </div>
        );
      })()}
    </div>
  );
};

export default CanITake;
