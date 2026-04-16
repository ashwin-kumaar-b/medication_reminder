import { useState } from 'react';
import { Apple, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useMedicines } from '@/contexts/MedicineContext';
import { getGeminiMedicalAdvice, getOpenFdaSafety, inferFoodRiskFromOpenFda, parseInputList, searchUsdaFood } from '@/lib/medicationApis';

const FoodCheck = () => {
  const { medicines } = useMedicines();
  const [selectedMed, setSelectedMed] = useState('');
  const [food, setFood] = useState('');
  const [supplements, setSupplements] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ severity: 'high' | 'moderate' | 'safe'; desc: string; alt: string; source: string } | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const medName = selectedMed || '';
    if (!medName || !food) return;
    setLoading(true);

    const [foodMatch, openFda] = await Promise.all([
      searchUsdaFood(food),
      getOpenFdaSafety(medName),
    ]);

    const inferred = inferFoodRiskFromOpenFda(openFda, food);
    const foodLabel = foodMatch ? `${foodMatch.name}${foodMatch.category ? ` (${foodMatch.category})` : ''}` : food;
    const supplementsList = parseInputList(supplements);
    const symptomList = parseInputList(symptoms);

    const geminiAdvice = await getGeminiMedicalAdvice({
      context: 'food-compatibility',
      medication: medName,
      food,
      supplements: supplementsList,
      symptoms: symptomList,
      evidence: [inferred.summary, ...(inferred.evidence || [])],
    });

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
            <label className="mb-1.5 block text-sm font-medium text-foreground">Medicine</label>
            <input value={selectedMed} onChange={e => setSelectedMed(e.target.value)} required placeholder="e.g., Warfarin"
              list="med-list"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            <datalist id="med-list">
              {medicines.map(m => <option key={m.id} value={m.name} />)}
            </datalist>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Food Item</label>
            <input value={food} onChange={e => setFood(e.target.value)} required placeholder="e.g., Grapefruit, Milk, Spinach"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Supplements (optional)</label>
            <input
              value={supplements}
              onChange={e => setSupplements(e.target.value)}
              placeholder="e.g., Fish oil, Vitamin K"
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Current Symptoms (optional)</label>
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

      <p className="mt-6 text-xs text-muted-foreground">Consult healthcare provider if unsure. This system supports adherence tracking and does not replace medical advice.</p>
    </div>
  );
};

export default FoodCheck;
