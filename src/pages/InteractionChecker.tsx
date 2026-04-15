import { useState } from 'react';
import { GitCompareArrows, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getOpenFdaSafety, getRxCui, getRxNavInteractions } from '@/lib/medicationApis';

interface InteractionResult {
  severity: 'high' | 'moderate' | 'low' | 'none';
  description: string;
  drugs: string[];
  source?: 'RxNav' | 'OpenFDA';
}

const severityConfig = {
  high: { icon: XCircle, label: 'High Risk', className: 'border-destructive/30 bg-destructive/5 text-destructive' },
  moderate: { icon: AlertTriangle, label: 'Moderate Risk', className: 'border-warning/30 bg-warning/5 text-warning' },
  low: { icon: AlertTriangle, label: 'Low Risk', className: 'border-primary/30 bg-primary/5 text-primary' },
  none: { icon: CheckCircle, label: 'No Interaction', className: 'border-success/30 bg-success/5 text-success' },
};

const InteractionChecker = () => {
  const [drug1, setDrug1] = useState('');
  const [drug2, setDrug2] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InteractionResult[]>([]);
  const [checked, setChecked] = useState(false);
  const { toast } = useToast();

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drug1 || !drug2) return;
    setLoading(true);
    setResults([]);
    setChecked(false);

    try {
      const [rxcui1, rxcui2] = await Promise.all([getRxCui(drug1), getRxCui(drug2)]);

      if (!rxcui1 || !rxcui2) {
        toast({ title: 'Drug not found', description: `Could not find RxCUI for ${!rxcui1 ? drug1 : drug2}. Try a different spelling.`, variant: 'destructive' });
        setLoading(false);
        return;
      }

      const interactions: InteractionResult[] = [];
      const rxNavItems = await getRxNavInteractions(rxcui1, rxcui2);
      rxNavItems.forEach(item => {
        interactions.push({ ...item, drugs: [drug1, drug2], source: 'RxNav' });
      });

      const [openFdaA, openFdaB] = await Promise.all([getOpenFdaSafety(drug1), getOpenFdaSafety(drug2)]);
      const openFdaWarnings = [
        ...(openFdaA?.warnings || []),
        ...(openFdaA?.contraindications || []),
        ...(openFdaB?.warnings || []),
        ...(openFdaB?.contraindications || []),
      ]
        .filter(Boolean)
        .slice(0, 2);

      openFdaWarnings.forEach(warning => {
        interactions.push({
          severity: warning.toLowerCase().includes('contraindicated') ? 'high' : 'moderate',
          description: warning,
          drugs: [drug1, drug2],
          source: 'OpenFDA',
        });
      });

      if (interactions.length === 0) {
        interactions.push({ severity: 'none', description: `No known interactions found between ${drug1} and ${drug2}.`, drugs: [drug1, drug2], source: 'RxNav' });
      }

      setResults(interactions);
      setChecked(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to check interactions. Try again.', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Drug Interaction Checker</h1>
        <p className="text-muted-foreground">Check if two medications are safe to take together</p>
      </div>

      <div className="mb-6 animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
        <form onSubmit={handleCheck} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Drug 1</label>
              <input value={drug1} onChange={e => setDrug1(e.target.value)} required placeholder="e.g., Warfarin"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Drug 2</label>
              <input value={drug2} onChange={e => setDrug2(e.target.value)} required placeholder="e.g., Aspirin"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            </div>
          </div>
          <button type="submit" disabled={loading} className="gradient-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><GitCompareArrows className="h-4 w-4" /> Check Interactions</>}
          </button>
        </form>
      </div>

      {checked && (
        <div className="space-y-3">
          {results.map((r, i) => {
            const cfg = severityConfig[r.severity];
            const Icon = cfg.icon;
            return (
              <div key={i} className={`animate-fade-in rounded-xl border p-5 ${cfg.className}`} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <span className="font-semibold">{cfg.label}</span>
                </div>
                <p className="text-sm leading-relaxed opacity-90">{r.description}</p>
                <p className="mt-2 text-xs font-medium opacity-80">Source: {r.source || 'RxNav'}</p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">Consult healthcare provider if unsure. This system supports adherence tracking and does not replace medical advice.</p>
    </div>
  );
};

export default InteractionChecker;
