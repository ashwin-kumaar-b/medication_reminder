import { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMedicines } from '@/contexts/MedicineContext';
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
  const { medicines } = useMedicines();
  const [drug1, setDrug1] = useState('');
  const [drug2, setDrug2] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<InteractionResult[]>([]);
  const [checked, setChecked] = useState(false);
  const { toast } = useToast();

  const activeMedicineNames = useMemo(() => {
    const unique = new Map<string, string>();
    medicines
      .filter(med => med.isActive)
      .forEach(med => {
        const normalized = med.name.trim().toLowerCase();
        if (!normalized || unique.has(normalized)) return;
        unique.set(normalized, med.name.trim());
      });
    return Array.from(unique.values());
  }, [medicines]);

  const buildPairs = (drugs: string[]) => {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < drugs.length; i += 1) {
      for (let j = i + 1; j < drugs.length; j += 1) {
        pairs.push([drugs[i], drugs[j]]);
      }
    }
    return pairs;
  };

  const checkPair = async (leftDrug: string, rightDrug: string): Promise<InteractionResult[]> => {
    const [rxcui1, rxcui2] = await Promise.all([getRxCui(leftDrug), getRxCui(rightDrug)]);

    if (!rxcui1 || !rxcui2) {
      return [
        {
          severity: 'moderate',
          description: `Could not fully resolve RxNorm IDs for ${leftDrug} and ${rightDrug}. Please verify spellings.`,
          drugs: [leftDrug, rightDrug],
          source: 'RxNav',
        },
      ];
    }

    const interactions: InteractionResult[] = [];
    const rxNavItems = await getRxNavInteractions(rxcui1, rxcui2);
    rxNavItems.forEach(item => {
      interactions.push({ ...item, drugs: [leftDrug, rightDrug], source: 'RxNav' });
    });

    const [openFdaA, openFdaB] = await Promise.all([getOpenFdaSafety(leftDrug), getOpenFdaSafety(rightDrug)]);
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
        drugs: [leftDrug, rightDrug],
        source: 'OpenFDA',
      });
    });

    if (interactions.length === 0) {
      interactions.push({
        severity: 'none',
        description: `No known interactions found between ${leftDrug} and ${rightDrug}.`,
        drugs: [leftDrug, rightDrug],
        source: 'RxNav',
      });
    }

    return interactions;
  };

  const handleCheckMyMedicines = async () => {
    if (activeMedicineNames.length < 2) {
      toast({ title: 'Not enough medicines', description: 'Add at least two active medicines to check interactions.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    setResults([]);
    setChecked(false);

    try {
      const pairs = buildPairs(activeMedicineNames);
      const interactions: InteractionResult[] = [];

      for (const [leftDrug, rightDrug] of pairs) {
        const pairResults = await checkPair(leftDrug, rightDrug);
        interactions.push(...pairResults);
      }

      setResults(interactions);
      setChecked(true);
    } catch {
      toast({ title: 'Error', description: 'Failed to auto-check medicine interactions. Try again.', variant: 'destructive' });
    }

    setLoading(false);
  };

  useEffect(() => {
    if (activeMedicineNames.length >= 2 && !checked && !loading) {
      void handleCheckMyMedicines();
    }
  }, [activeMedicineNames]);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drug1 || !drug2) return;
    setLoading(true);
    setResults([]);
    setChecked(false);

    try {
      const interactions = await checkPair(drug1, drug2);
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
        <p className="text-muted-foreground">Auto-checks your active medicines and shows all interaction pairs</p>
      </div>

      <div className="mb-6 animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Your Active Medicines</h2>
          <button
            type="button"
            onClick={() => void handleCheckMyMedicines()}
            disabled={loading || activeMedicineNames.length < 2}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            Recheck All
          </button>
        </div>
        {activeMedicineNames.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active medicines found. Add medicines first to enable automatic interaction checks.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeMedicineNames.map(name => (
              <span key={name} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{name}</span>
            ))}
          </div>
        )}
        {activeMedicineNames.length === 1 && (
          <p className="mt-3 text-xs text-muted-foreground">At least two active medicines are needed for interaction checks.</p>
        )}
      </div>

      <div className="mb-6 animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual pair check</p>
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
