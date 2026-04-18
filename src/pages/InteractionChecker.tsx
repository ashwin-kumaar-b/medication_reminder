import { useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMedicines } from '@/contexts/MedicineContext';
import {
  getDdinterInteractions,
  getDrugAllergyProfileInsight,
  getGeminiMedicalAdvice,
  getOpenFdaSafety,
  getRxCui,
  getRxNavInteractions,
  parseInputList,
  DrugAllergyProfileInsight,
} from '@/lib/medicationApis';
import { useAppSettings } from '@/features/settings/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getMedicineDetailsByName } from '@/lib/localMedicineData';

interface InteractionResult {
  severity: 'high' | 'moderate' | 'low' | 'none';
  description: string;
  drugs: string[];
  source?: 'RxNav' | 'DailyMed' | 'Gemini' | 'DDInter' | 'Groq';
}

const severityConfig = {
  high: { icon: XCircle, label: 'High Risk', className: 'border-destructive/30 bg-destructive/5 text-destructive' },
  moderate: { icon: AlertTriangle, label: 'Moderate Risk', className: 'border-warning/30 bg-warning/5 text-warning' },
  low: { icon: AlertTriangle, label: 'Low Risk', className: 'border-primary/30 bg-primary/5 text-primary' },
  none: { icon: CheckCircle, label: 'No Interaction', className: 'border-success/30 bg-success/5 text-success' },
};

const InteractionChecker = () => {
  const { medicines } = useMedicines();
  const { user } = useAuth();
  const [drug1, setDrug1] = useState('');
  const [drug2, setDrug2] = useState('');
  const [supplements, setSupplements] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileInsight, setProfileInsight] = useState<DrugAllergyProfileInsight | null>(null);
  const [localSideEffects, setLocalSideEffects] = useState<Array<{ medicine: string; effects: string[] }>>([]);
  const [results, setResults] = useState<InteractionResult[]>([]);
  const [checked, setChecked] = useState(false);
  const { toast } = useToast();
  const { t, settings } = useAppSettings();

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
    const supplementsList = parseInputList(supplements);
    const symptomList = parseInputList(symptoms);
    const [rxcui1, rxcui2, ddinterItems, openFdaA, openFdaB] = await Promise.all([
      getRxCui(leftDrug),
      getRxCui(rightDrug),
      getDdinterInteractions(leftDrug, rightDrug),
      getOpenFdaSafety(leftDrug),
      getOpenFdaSafety(rightDrug),
    ]);

    const interactions: InteractionResult[] = [];
    const rxNavItems = rxcui1 && rxcui2 ? await getRxNavInteractions(rxcui1, rxcui2) : [];
    rxNavItems.forEach(item => {
      interactions.push({ ...item, drugs: [leftDrug, rightDrug], source: 'RxNav' });
    });

    ddinterItems.forEach(item => {
      interactions.push({ ...item, drugs: [leftDrug, rightDrug], source: 'DDInter' });
    });

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
        source: 'DailyMed',
      });
    });

    const apiEvidence = [
      `RxNorm lookup ${leftDrug}: ${rxcui1 || 'not found'}`,
      `RxNorm lookup ${rightDrug}: ${rxcui2 || 'not found'}`,
      ...(rxNavItems.length > 0 ? rxNavItems.map(item => `RxNav: ${item.description}`) : ['RxNav: no interaction records found or RxCUI unavailable.']),
      ...(ddinterItems.length > 0 ? ddinterItems.map(item => `DDInter: ${item.description}`) : ['DDInter: no interaction records returned.']),
      ...(openFdaWarnings.length > 0 ? openFdaWarnings.map(warning => `DailyMed: ${warning}`) : ['DailyMed: no warning or contraindication text returned.']),
    ].slice(0, 12);

    const geminiAdvice = await getGeminiMedicalAdvice({
      context: 'drug-interaction',
      drugA: leftDrug,
      drugB: rightDrug,
      supplements: supplementsList,
      symptoms: symptomList,
      evidence: apiEvidence,
    });

    if (geminiAdvice) {
      interactions.unshift({
        severity: geminiAdvice.severity === 'safe' || geminiAdvice.severity === 'none' ? 'none' : geminiAdvice.severity,
        description: `${geminiAdvice.summary} ${geminiAdvice.explanation}`.trim(),
        drugs: [leftDrug, rightDrug],
        source: geminiAdvice.source,
      });
    }

    if (interactions.length === 0) {
      interactions.push({
        severity: !rxcui1 || !rxcui2 ? 'moderate' : 'none',
        description: !rxcui1 || !rxcui2
          ? `Could not fully resolve RxNorm IDs for ${leftDrug} and ${rightDrug}. RxNav coverage is limited; verify spellings and cross-check with a pharmacist.`
          : `No known interactions found between ${leftDrug} and ${rightDrug}.`,
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
    if (activeMedicineNames.length >= 2) {
      void handleCheckMyMedicines();
      return;
    }

    setResults([]);
    setChecked(false);
  }, [activeMedicineNames]);

  useEffect(() => {
    let active = true;

    const loadLocalDetails = async () => {
      const detailRows = await Promise.all(
        activeMedicineNames.map(async medicine => {
          const details = await getMedicineDetailsByName(medicine);
          return {
            medicine,
            effects: details?.sideEffects?.slice(0, 3) || [],
          };
        }),
      );

      if (!active) return;
      setLocalSideEffects(detailRows.filter(row => row.effects.length > 0));
    };

    void loadLocalDetails();

    return () => {
      active = false;
    };
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

  const handleAnalyzeProfileRisk = async () => {
    if (activeMedicineNames.length === 0) {
      toast({ title: 'No active medicines', description: 'Add active medicines to run drug-allergy profile analysis.', variant: 'destructive' });
      return;
    }

    setProfileLoading(true);
    const insight = await getDrugAllergyProfileInsight({
      language: settings.language,
      medicines: activeMedicineNames,
      gender: user?.gender ? `${user.gender}${user?.genderOther ? ` (${user.genderOther})` : ''}` : undefined,
      bloodGroup: user?.bloodGroup,
      chronicDiseases: user?.chronicDiseases,
      infectionHistory: user?.infectionHistory,
      allergies: user?.allergies,
    });
    setProfileInsight(insight);
    setProfileLoading(false);

    if (!insight) {
      toast({ title: 'Profile analysis unavailable', description: 'Could not generate profile interaction analysis right now.', variant: 'destructive' });
    }
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleAnalyzeProfileRisk()}
              disabled={profileLoading || activeMedicineNames.length === 0}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              {profileLoading ? 'Analyzing Profile...' : 'Analyze Drug-Allergy Risk'}
            </button>
            <button
              type="button"
              onClick={() => void handleCheckMyMedicines()}
              disabled={loading || activeMedicineNames.length < 2}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              Recheck All
            </button>
          </div>
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

        {profileInsight && (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">Drug-Allergy & Profile Interaction Insight</h3>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${
                  profileInsight.overallRisk === 'high'
                    ? 'bg-destructive/15 text-destructive'
                    : profileInsight.overallRisk === 'moderate'
                    ? 'bg-warning/20 text-warning'
                    : profileInsight.overallRisk === 'low'
                    ? 'bg-primary/15 text-primary'
                    : 'bg-success/15 text-success'
                }`}
              >
                {profileInsight.overallRisk}
              </span>
            </div>
            <p className="mb-2 text-sm text-foreground">{profileInsight.summary}</p>
            {profileInsight.findings.length > 0 && (
              <div className="space-y-2">
                {profileInsight.findings.map((finding, index) => (
                  <div key={`${finding.title}-${index}`} className="rounded-md border border-border bg-card p-3">
                    <p className="text-sm font-semibold text-foreground">{finding.title}</p>
                    <p className="text-sm text-muted-foreground">{finding.detail}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Evidence: {finding.evidence}</p>
                  </div>
                ))}
              </div>
            )}
            {profileInsight.recommendations.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
                {profileInsight.recommendations.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Based on FDA drug label data.</p>
            {localSideEffects.length > 0 && (
              <div className="mt-3 rounded-md border border-border bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medicine details side effects</p>
                <div className="mt-2 space-y-1">
                  {localSideEffects.map(row => (
                    <p key={row.medicine} className="text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{row.medicine}:</span> {row.effects.join(', ')}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">Source: {profileInsight.source}</p>
          </div>
        )}
      </div>

      <div className="mb-6 animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manual pair check</p>
        <form onSubmit={handleCheck} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('interaction.fieldDrug1')}</label>
              <input value={drug1} onChange={e => setDrug1(e.target.value)} required placeholder="e.g., Warfarin"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('interaction.fieldDrug2')}</label>
              <input value={drug2} onChange={e => setDrug2(e.target.value)} required placeholder="e.g., Aspirin"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('interaction.fieldSupplements')}</label>
              <input
                value={supplements}
                onChange={e => setSupplements(e.target.value)}
                placeholder="e.g., Fish oil, St. John's wort"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('interaction.fieldSymptoms')}</label>
              <input
                value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
                placeholder="e.g., dizziness, nausea"
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
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
