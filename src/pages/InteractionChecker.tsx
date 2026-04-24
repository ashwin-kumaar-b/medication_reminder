import { useCallback, useEffect, useMemo, useState } from 'react';
import { GitCompareArrows, Loader2, AlertTriangle, CheckCircle, XCircle, ShieldAlert, ChevronDown, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMedicines } from '@/contexts/MedicineContext';
import {
  getDrugAllergyProfileInsight,
  getGeminiMedicalAdvice,
  getRxCui,
  getRxNavInteractions,
  parseInputList,
  DrugAllergyProfileInsight,
} from '@/lib/medicationApis';
import { useAppSettings } from '@/features/settings/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import { getMedicineDetailsByName } from '@/lib/localMedicineData';
import { parseMedicineName } from '@/utils/medicineUtils';

interface InteractionResult {
  severity: 'high' | 'moderate' | 'low' | 'none';
  description: string;
  drugs: string[];
  source?: 'RxNav' | 'DailyMed' | 'Gemini' | 'DDInter';
}

const toNormalSentenceCase = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return 'Medicine';
  if (trimmed === trimmed.toUpperCase()) {
    return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
  }
  return trimmed;
};

const normalizeSeverity = (severity: InteractionResult['severity']) => {
  if (severity === 'high') return 'high';
  if (severity === 'none') return 'none';
  return 'moderate';
};

const severityRowConfig = {
  high: {
    icon: ShieldAlert,
    iconClass: 'text-destructive',
    badge: 'Major',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/30',
    container: 'border-destructive/25 bg-destructive/[0.03]',
  },
  moderate: {
    icon: AlertTriangle,
    iconClass: 'text-warning',
    badge: 'Moderate',
    badgeClass: 'bg-warning/15 text-warning border-warning/30',
    container: 'border-warning/25 bg-warning/[0.03]',
  },
  none: {
    icon: CheckCircle,
    iconClass: 'text-[#1D9E75]',
    badge: 'No interaction',
    badgeClass: 'bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/30',
    container: 'border-[#1D9E75]/20 bg-[#1D9E75]/[0.03]',
  },
} as const;

const InteractionChecker = () => {
  const { medicines, medications } = useMedicines();
  const { user } = useAuth();
  const [drug1, setDrug1] = useState('');
  const [drug2, setDrug2] = useState('');
  const [supplements, setSupplements] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileInsights, setProfileInsights] = useState<Array<{ medicineName: string; insight: DrugAllergyProfileInsight }>>([]);
  const [localSideEffects, setLocalSideEffects] = useState<Array<{ medicine: string; effects: string[] }>>([]);
  const [results, setResults] = useState<InteractionResult[]>([]);
  const [checked, setChecked] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { t, settings } = useAppSettings();

  const activeMedicineProfiles = useMemo(() => {
    const merged = new Map<string, { name: string; dosage?: string; frequency?: string }>();

    medicines
      .filter(med => med.isActive)
      .forEach(med => {
        const normalized = med.name.trim().toLowerCase();
        if (!normalized || merged.has(normalized)) return;
        merged.set(normalized, {
          name: med.name.trim(),
          dosage: med.dosage,
          frequency: med.frequency,
        });
      });

    medications.forEach(med => {
      const resolvedName = (med.displayName || med.drugName || '').trim();
      const normalized = resolvedName.toLowerCase();
      if (!normalized || merged.has(normalized)) return;
      merged.set(normalized, {
        name: resolvedName,
        dosage: med.dosage,
        frequency: med.frequency,
      });
    });

    return Array.from(merged.values());
  }, [medicines, medications]);

  const activeMedicineNames = useMemo(() => activeMedicineProfiles.map(item => item.name), [activeMedicineProfiles]);

  const groupedInteractionResults = useMemo(() => {
    const normalized = results.map((row, index) => {
      const severity = normalizeSeverity(row.severity);
      const shortDrugA = toNormalSentenceCase(parseMedicineName(row.drugs[0] || 'Medicine A').brandName);
      const shortDrugB = toNormalSentenceCase(parseMedicineName(row.drugs[1] || 'Medicine B').brandName);
      const summary = `${row.description.replace(/\s+/g, ' ').trim()} - Source: ${row.source === 'RxNav' ? 'NLM RxNav' : row.source || 'RxNav'}`;
      return {
        key: `${row.drugs.join('-')}-${index}`,
        severity,
        shortDrugA,
        shortDrugB,
        fullDrugA: shortDrugA,
        fullDrugB: shortDrugB,
        summary,
        fullDescription: row.description,
        source: row.source === 'RxNav' ? 'NLM RxNav' : row.source || 'RxNav',
      };
    });

    const interactionsDetected = normalized.filter(item => item.severity !== 'none');
    const noInteractions = normalized.filter(item => item.severity === 'none');
    return { interactionsDetected, noInteractions };
  }, [results]);

  const buildPairs = (drugs: string[]) => {
    const pairs: Array<[string, string]> = [];
    for (let i = 0; i < drugs.length; i += 1) {
      for (let j = i + 1; j < drugs.length; j += 1) {
        pairs.push([drugs[i], drugs[j]]);
      }
    }
    return pairs;
  };

  const checkPair = useCallback(async (leftDrug: string, rightDrug: string): Promise<InteractionResult[]> => {
    const supplementsList = parseInputList(supplements);
    const symptomList = parseInputList(symptoms);
    const [rxcui1, rxcui2] = await Promise.all([
      getRxCui(leftDrug),
      getRxCui(rightDrug),
    ]);

    if (!rxcui1 || !rxcui2) {
      return [
        {
          severity: 'moderate',
          description: `Could not fully resolve RxNorm IDs for ${leftDrug} and ${rightDrug}. RxNav coverage is limited; verify spellings and cross-check with a pharmacist.`,
          drugs: [leftDrug, rightDrug],
          source: 'RxNav',
        },
      ];
    }

    const rxNavItems = await getRxNavInteractions(rxcui1, rxcui2);
    if (rxNavItems.length === 0) {
      return [
        {
          severity: 'none',
          description: `No known interaction found between ${leftDrug} and ${rightDrug}.`,
          drugs: [leftDrug, rightDrug],
          source: 'RxNav',
        },
      ];
    }

    const severityRank: Record<Exclude<InteractionResult['severity'], 'none'>, number> = {
      high: 3,
      moderate: 2,
      low: 1,
    };
    const topSeverity = rxNavItems.reduce<'high' | 'moderate' | 'low'>(
      (current, item) => (severityRank[item.severity] > severityRank[current] ? item.severity : current),
      'low',
    );

    const rxNavDescriptions = rxNavItems.map(item => item.description).filter(Boolean);
    const baseDescription = rxNavDescriptions.slice(0, 2).join(' ');

    const apiEvidence = [
      `RxNorm lookup ${leftDrug}: ${rxcui1}`,
      `RxNorm lookup ${rightDrug}: ${rxcui2}`,
      ...rxNavItems.map(item => `RxNav: ${item.description}`),
    ].slice(0, 10);

    let description = baseDescription;
    const geminiAdvice = await getGeminiMedicalAdvice({
      context: 'drug-interaction',
      drugA: leftDrug,
      drugB: rightDrug,
      supplements: supplementsList,
      symptoms: symptomList,
      evidence: apiEvidence,
    });

    if (geminiAdvice && baseDescription) {
      const rewritten = `${geminiAdvice.summary} ${geminiAdvice.explanation}`.trim();
      if (rewritten) description = rewritten;
    }

    return [
      {
        severity: topSeverity,
        description: description || baseDescription || 'Interaction details available from NLM RxNav.',
        drugs: [leftDrug, rightDrug],
        source: 'RxNav',
      },
    ];
  }, [supplements, symptoms]);

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
    let active = true;

    const runAutoInteractionCheck = async () => {
      if (activeMedicineNames.length < 2) {
        if (!active) return;
        setResults([]);
        setChecked(false);
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

        if (!active) return;
        setResults(interactions);
        setChecked(true);
      } catch {
        if (!active) return;
        toast({ title: 'Error', description: 'Failed to auto-check medicine interactions. Try again.', variant: 'destructive' });
      }

      if (active) setLoading(false);
    };

    void runAutoInteractionCheck();

    return () => {
      active = false;
    };
  }, [activeMedicineNames, checkPair, toast]);

  useEffect(() => {
    setExpandedRows({});
  }, [results]);

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
    if (activeMedicineProfiles.length === 0) {
      toast({ title: 'No active medicines', description: 'Add active medicines to run drug-allergy profile analysis.', variant: 'destructive' });
      return;
    }

    setProfileLoading(true);
    const insightsByMedicine = await Promise.all(
      activeMedicineProfiles.map(async medicine => {
        const insight = await getDrugAllergyProfileInsight({
          language: settings.language,
          medicines: [medicine],
          gender: user?.gender ? `${user.gender}${user?.genderOther ? ` (${user.genderOther})` : ''}` : undefined,
          bloodGroup: user?.bloodGroup,
          chronicDiseases: user?.chronicDiseases,
          infectionHistory: user?.infectionHistory,
          allergies: user?.allergies,
        });

        return insight ? { medicineName: medicine.name, insight } : null;
      }),
    );

    setProfileInsights(insightsByMedicine.filter((item): item is { medicineName: string; insight: DrugAllergyProfileInsight } => !!item));
    setProfileLoading(false);

    if (insightsByMedicine.every(item => !item)) {
      toast({ title: 'Profile analysis unavailable', description: 'Could not generate profile interaction analysis right now.', variant: 'destructive' });
    }
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-semibold text-foreground">Drug Interaction Checker</h1>
        <p className="text-muted-foreground">Auto-checks your active medicines and shows all interaction pairs</p>
      </div>

      <div className="mb-6 animate-fade-in rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
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
              <span key={name} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                {toNormalSentenceCase(parseMedicineName(name).brandName)}
              </span>
            ))}
          </div>
        )}
        {activeMedicineNames.length === 1 && (
          <p className="mt-3 text-xs text-muted-foreground">At least two active medicines are needed for interaction checks.</p>
        )}

        {checked && (
          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Auto interaction pair results</p>
            {groupedInteractionResults.interactionsDetected.length > 0 && (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Interactions Detected</p>
                <div className="space-y-2">
                  {groupedInteractionResults.interactionsDetected.map(item => {
                    const cfg = severityRowConfig[item.severity];
                    const Icon = cfg.icon;
                    const open = !!expandedRows[item.key];
                    return (
                      <div key={item.key} className={`rounded-xl border ${cfg.container}`}>
                        <button
                          type="button"
                          onClick={() => setExpandedRows(prev => ({ ...prev, [item.key]: !open }))}
                          className="flex min-h-11 w-full items-start gap-3 p-3 text-left"
                        >
                          <Icon className={`mt-1 h-5 w-5 shrink-0 ${cfg.iconClass}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <span className="truncate">{item.shortDrugA}</span>
                              <span className="text-muted-foreground">+</span>
                              <span className="truncate">{item.shortDrugB}</span>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{item.summary}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.badgeClass}`}>{cfg.badge}</span>
                          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <div className="border-t border-border/60 px-3 pb-3 pt-2 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">{item.fullDrugA} + {item.fullDrugB}</p>
                            <p className="mt-1 leading-relaxed">{item.fullDescription}</p>
                            <p className="mt-1">Source: {item.source}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {groupedInteractionResults.noInteractions.length > 0 && (
              <>
                {groupedInteractionResults.interactionsDetected.length > 0 && <div className="my-1 h-px w-full bg-border" />}
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">No Interactions Found</p>
                <div className="space-y-2">
                  {groupedInteractionResults.noInteractions.map(item => {
                    const cfg = severityRowConfig.none;
                    const Icon = cfg.icon;
                    const open = !!expandedRows[item.key];
                    return (
                      <div key={item.key} className={`rounded-xl border ${cfg.container}`}>
                        <button
                          type="button"
                          onClick={() => setExpandedRows(prev => ({ ...prev, [item.key]: !open }))}
                          className="flex min-h-11 w-full items-start gap-3 p-3 text-left"
                        >
                          <Icon className={`mt-1 h-5 w-5 shrink-0 ${cfg.iconClass}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                              <span className="truncate">{item.shortDrugA}</span>
                              <span className="text-muted-foreground">+</span>
                              <span className="truncate">{item.shortDrugB}</span>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{item.summary}</p>
                          </div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${cfg.badgeClass}`}>{cfg.badge}</span>
                          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <div className="border-t border-border/60 px-3 pb-3 pt-2 text-xs text-muted-foreground">
                            <p className="font-medium text-foreground">{item.fullDrugA} + {item.fullDrugB}</p>
                            <p className="mt-1 leading-relaxed">{item.fullDescription}</p>
                            <p className="mt-1">Source: {item.source}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {profileInsights.length > 0 && (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/5 p-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">Drug-Allergy & Profile Interaction Insight</h3>
            <div className="space-y-2">
              {profileInsights.map((entry, insightIndex) => (
                <details key={`${entry.medicineName}-${insightIndex}`} className="rounded-md border border-border bg-card p-3" open={insightIndex === 0}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{entry.medicineName}</span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase ${
                        entry.insight.overallRisk === 'high'
                          ? 'bg-destructive/15 text-destructive'
                          : entry.insight.overallRisk === 'moderate'
                          ? 'bg-warning/20 text-warning'
                          : entry.insight.overallRisk === 'low'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-success/15 text-success'
                      }`}
                    >
                      {entry.insight.overallRisk}
                    </span>
                  </summary>

                  <p className="mt-2 text-sm text-foreground">{entry.insight.summary}</p>
                  {entry.insight.findings.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {entry.insight.findings.map((finding, findingIndex) => (
                        <div key={`${finding.title}-${findingIndex}`} className="rounded-md border border-border bg-background p-3">
                          <p className="text-sm font-semibold text-foreground">{finding.title}</p>
                          <p className="text-sm text-muted-foreground">{finding.detail}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Evidence: {finding.evidence}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {entry.insight.recommendations.length > 0 && (
                    <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
                      {entry.insight.recommendations.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {entry.insight.contextNote && (
                    <p className="mt-3 text-xs text-muted-foreground">{entry.insight.contextNote}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Source: {entry.insight.source}</p>
                </details>
              ))}
            </div>
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
          </div>
        )}
      </div>

      <div className="mb-6 animate-fade-in rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Manual pair check</p>
        <form onSubmit={handleCheck} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('interaction.fieldDrug1')}</label>
              <input value={drug1} onChange={e => setDrug1(e.target.value)} required placeholder="e.g., Warfarin"
                className="w-full rounded-t-lg border-0 border-b-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-foreground focus:border-[#008080] focus:outline-none focus:ring-0" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('interaction.fieldDrug2')}</label>
              <input value={drug2} onChange={e => setDrug2(e.target.value)} required placeholder="e.g., Aspirin"
                className="w-full rounded-t-lg border-0 border-b-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-foreground focus:border-[#008080] focus:outline-none focus:ring-0" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('interaction.fieldSupplements')}</label>
              <input
                value={supplements}
                onChange={e => setSupplements(e.target.value)}
                placeholder="e.g., Fish oil, St. John's wort"
                className="w-full rounded-t-lg border-0 border-b-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-foreground focus:border-[#008080] focus:outline-none focus:ring-0"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t('interaction.fieldSymptoms')}</label>
              <input
                value={symptoms}
                onChange={e => setSymptoms(e.target.value)}
                placeholder="e.g., dizziness, nausea"
                className="w-full rounded-t-lg border-0 border-b-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-foreground focus:border-[#008080] focus:outline-none focus:ring-0"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#008080] px-6 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><GitCompareArrows className="h-4 w-4" /> Check Interactions <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        </form>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Consult healthcare provider if unsure. This system supports adherence tracking and does not replace medical advice.</p>
    </div>
  );
};

export default InteractionChecker;
