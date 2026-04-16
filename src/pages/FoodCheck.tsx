import { useEffect, useMemo, useState } from 'react';
import { Apple, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useMedicines } from '@/contexts/MedicineContext';
import {
  getFoodNutritionProfileInsight,
  getGeminiMedicalAdvice,
  getOpenFdaSafety,
  inferFoodRiskFromOpenFda,
  parseInputList,
  searchUsdaFood,
  FoodNutritionProfileInsight,
} from '@/lib/medicationApis';
import { useAppSettings } from '@/features/settings/SettingsContext';
import { useAuth } from '@/contexts/AuthContext';

const FoodCheck = () => {
  const { medicines } = useMedicines();
  const { user } = useAuth();
  const [selectedMed, setSelectedMed] = useState('');
  const [food, setFood] = useState('');
  const [supplements, setSupplements] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingNutrition, setLoadingNutrition] = useState(false);
  const [result, setResult] = useState<{ severity: 'high' | 'moderate' | 'safe'; desc: string; alt: string; source: string } | null>(null);
  const [nutritionInsight, setNutritionInsight] = useState<FoodNutritionProfileInsight | null>(null);
  const [nutritionMessage, setNutritionMessage] = useState('');
  const { t, settings } = useAppSettings();

  const activeMedicineNames = useMemo(
    () => Array.from(new Set(medicines.filter(item => item.isActive).map(item => item.name).filter(Boolean))),
    [medicines],
  );

  useEffect(() => {
    let cancelled = false;

    const loadAutomaticNutrition = async () => {
      const illnessList = user?.illness ? parseInputList(user.illness) : [];
      const chronicDiseases = (user?.chronicDiseases || []).filter(Boolean);
      const infectionHistory = (user?.infectionHistory || []).filter(Boolean);
      const allergyLabels = (user?.allergies || [])
        .map(entry => `${entry.category}${entry.trigger ? `: ${entry.trigger}` : ''}`)
        .filter(Boolean);

      const medicinePool = activeMedicineNames.length > 0 ? activeMedicineNames : Array.from(new Set(medicines.map(item => item.name).filter(Boolean)));

      if (medicinePool.length === 0) {
        if (!cancelled) {
          setNutritionInsight(null);
          setNutritionMessage('Add at least one medicine to get automatic nutrition suggestions.');
          setLoadingNutrition(false);
        }
        return;
      }

      if (!cancelled) {
        setLoadingNutrition(true);
        setNutritionMessage('');
      }

      const advice = await getFoodNutritionProfileInsight({
        language: settings.language,
        medicines: medicinePool,
        illness: illnessList,
        chronicDiseases,
        infectionHistory,
        allergies: allergyLabels,
      });

      if (cancelled) return;

      setNutritionInsight(advice);
      setLoadingNutrition(false);
      if (!advice) {
        setNutritionMessage('Automatic nutrition suggestions are currently unavailable. Please verify Groq API configuration.');
      }
    };

    void loadAutomaticNutrition();

    return () => {
      cancelled = true;
    };
  }, [activeMedicineNames, medicines, settings.language, user]);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const medName = selectedMed || '';
    if (!medName || !food) return;
    setLoading(true);
    setNutritionInsight(null);

    const [foodMatch, openFda] = await Promise.all([
      searchUsdaFood(food),
      getOpenFdaSafety(medName),
    ]);

    const inferred = inferFoodRiskFromOpenFda(openFda, food);
    const foodLabel = foodMatch ? `${foodMatch.name}${foodMatch.category ? ` (${foodMatch.category})` : ''}` : food;
    const supplementsList = parseInputList(supplements);
    const symptomList = parseInputList(symptoms);

    const illnessList = user?.illness ? parseInputList(user.illness) : [];
    const chronicDiseases = (user?.chronicDiseases || []).filter(Boolean);
    const infectionHistory = (user?.infectionHistory || []).filter(Boolean);
    const allergyLabels = (user?.allergies || [])
      .map(entry => `${entry.category}${entry.trigger ? `: ${entry.trigger}` : ''}`)
      .filter(Boolean);

    const nutritionPromise = getFoodNutritionProfileInsight({
      language: settings.language,
      medicines: activeMedicineNames.length > 0 ? activeMedicineNames : [medName],
      illness: illnessList,
      chronicDiseases,
      infectionHistory,
      allergies: allergyLabels,
    });

    const geminiAdvice = await getGeminiMedicalAdvice({
      context: 'food-compatibility',
      medication: medName,
      food,
      supplements: supplementsList,
      symptoms: symptomList,
      evidence: [inferred.summary, ...(inferred.evidence || [])],
    });

    const nutritionAdvice = await nutritionPromise;
    setNutritionInsight(nutritionAdvice);

    const mappedSeverity = geminiAdvice
      ? geminiAdvice.severity === 'high'
        ? 'high'
        : geminiAdvice.severity === 'moderate'
          ? 'moderate'
          : 'safe'
      : inferred.severity;

    const recommendations = geminiAdvice?.recommendations?.filter(Boolean) || [];
    const cautions = geminiAdvice?.cautions?.filter(Boolean) || [];

    setResult({
      severity: mappedSeverity,
      desc: geminiAdvice
        ? `${geminiAdvice.summary} ${geminiAdvice.explanation}`.trim()
        : `${inferred.summary} USDA match: ${foodLabel}.`,
      alt: recommendations[0] || cautions[0] ||
        (mappedSeverity === 'high'
          ? 'Avoid this combination until discussed with your healthcare provider.'
          : mappedSeverity === 'moderate'
            ? 'Use caution and verify timing with your provider or pharmacist.'
            : 'No direct match found, but continue following prescribed guidance.'),
      source: geminiAdvice ? `${geminiAdvice.source} + USDA + OpenFDA${foodMatch ? '' : ' (food match unavailable)'}` : `USDA + OpenFDA${foodMatch ? '' : ' (food match unavailable)'}`,
    });

    setLoading(false);
  };

  const config = {
    high: { icon: XCircle, label: 'High Risk — Avoid', className: 'border-destructive/30 bg-destructive/5 text-destructive' },
    moderate: { icon: AlertTriangle, label: 'Moderate Risk — Caution', className: 'border-warning/30 bg-warning/5 text-warning' },
    safe: { icon: CheckCircle, label: 'Safe — No Issue', className: 'border-success/30 bg-success/5 text-success' },
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">Food Compatibility Check</h1>
        <p className="text-muted-foreground">Check if a food is safe with your medication</p>
      </div>

      <div className="mb-6 animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
        <form onSubmit={handleCheck} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t('food.fieldMedicine')}</label>
            <input value={selectedMed} onChange={e => setSelectedMed(e.target.value)} required placeholder="e.g., Warfarin"
              list="med-list"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            <datalist id="med-list">
              {medicines.map(m => <option key={m.id} value={m.name} />)}
            </datalist>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t('food.fieldFoodItem')}</label>
            <input value={food} onChange={e => setFood(e.target.value)} required placeholder="e.g., Grapefruit, Milk, Spinach"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t('food.fieldSupplements')}</label>
            <input
              value={supplements}
              onChange={e => setSupplements(e.target.value)}
              placeholder="e.g., Fish oil, Vitamin K"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t('food.fieldSymptoms')}</label>
            <input
              value={symptoms}
              onChange={e => setSymptoms(e.target.value)}
              placeholder="e.g., nausea, dizziness"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <button type="submit" disabled={loading} className="gradient-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Apple className="h-4 w-4" /> Check Compatibility</>}
          </button>
        </form>
      </div>

      {result && (() => {
        const cfg = config[result.severity];
        const Icon = cfg.icon;
        return (
          <div className={`animate-fade-in rounded-xl border p-5 ${cfg.className}`}>
            <div className="mb-2 flex items-center gap-2">
              <Icon className="h-5 w-5" />
              <span className="font-semibold">{cfg.label}</span>
            </div>
            <p className="mb-2 text-sm leading-relaxed opacity-90">{result.desc}</p>
            <p className="text-sm font-medium opacity-80">💡 {result.alt}</p>
            <p className="mt-2 text-xs font-medium opacity-80">Source: {result.source}</p>
          </div>
        );
      })()}

      {nutritionInsight && (
        <div className="mt-5 animate-fade-in rounded-xl border border-primary/25 bg-primary/5 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Apple className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Medication + Disease Nutrition Guidance</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${
                nutritionInsight.confidence === 'high'
                  ? 'bg-success/20 text-success'
                  : nutritionInsight.confidence === 'medium'
                    ? 'bg-warning/20 text-warning'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {nutritionInsight.confidence} confidence
            </span>
          </div>
          <p className="mb-4 text-sm text-foreground/90">{nutritionInsight.summary}</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="mb-2 text-sm font-semibold text-success">Food types to prioritize</p>
              <ul className="space-y-2 text-sm text-foreground/90">
                {nutritionInsight.foodTypesToPrioritize.slice(0, 4).map((item, index) => (
                  <li key={`${item.type}-${index}`}>
                    <p className="font-semibold">{item.type} <span className="text-xs font-medium opacity-70">({item.confidence})</span></p>
                    <p>{item.reason}</p>
                    {item.examples.length > 0 && <p className="text-xs opacity-80">Examples: {item.examples.join(', ')}</p>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
              <p className="mb-2 text-sm font-semibold text-warning">Food types to limit</p>
              <ul className="space-y-2 text-sm text-foreground/90">
                {nutritionInsight.foodTypesToLimit.slice(0, 4).map((item, index) => (
                  <li key={`${item.type}-${index}`}>
                    <p className="font-semibold">{item.type} <span className="text-xs font-medium opacity-70">({item.confidence})</span></p>
                    <p>{item.reason}</p>
                    {item.examples.length > 0 && <p className="text-xs opacity-80">Examples: {item.examples.join(', ')}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {nutritionInsight.evidenceBasis.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-sm font-semibold text-foreground">Evidence basis</p>
              <ul className="space-y-1 text-xs text-foreground/85">
                {nutritionInsight.evidenceBasis.slice(0, 4).map((line, index) => (
                  <li key={`${line}-${index}`}>- {line}</li>
                ))}
              </ul>
            </div>
          )}

          {nutritionInsight.timingTips.length > 0 && (
            <div className="mt-4 rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-sm font-semibold text-foreground">Meal timing tips with medicines</p>
              <ul className="space-y-1 text-sm text-foreground/90">
                {nutritionInsight.timingTips.slice(0, 5).map((tip, index) => (
                  <li key={`${tip}-${index}`}>- {tip}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">Source: {nutritionInsight.source}</p>
            </div>
          )}
        </div>
      )}

      {!nutritionInsight && (loadingNutrition || nutritionMessage) && (
        <div className="mt-5 animate-fade-in rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="mb-2 flex items-center gap-2">
            <Apple className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Medication + Disease Nutrition Guidance</h2>
          </div>
          {loadingNutrition ? (
            <p className="text-sm text-foreground/90">Analyzing medicines and profile to prepare automatic food suggestions...</p>
          ) : (
            <p className="text-sm text-foreground/90">{nutritionMessage}</p>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">Consult healthcare provider if unsure. This system supports adherence tracking and does not replace medical advice.</p>
    </div>
  );
};

export default FoodCheck;
