import { useState } from 'react';
import { Apple, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useMedicines } from '@/contexts/MedicineContext';

// Rule-based drug-food interactions
const drugFoodRules: { drug: RegExp; food: RegExp; severity: 'high' | 'moderate'; desc: string; alt: string }[] = [
  { drug: /warfarin/i, food: /spinach|kale|broccoli|lettuce|vitamin k/i, severity: 'high', desc: 'Warfarin interacts with Vitamin K-rich foods, reducing its blood-thinning effect.', alt: 'Choose low Vitamin K foods like carrots, corn, or potatoes.' },
  { drug: /statin|atorvastatin|simvastatin|lovastatin/i, food: /grapefruit/i, severity: 'high', desc: 'Grapefruit inhibits CYP3A4, increasing statin levels and risk of side effects.', alt: 'Try oranges, apples, or berries instead.' },
  { drug: /maoi|phenelzine|tranylcypromine/i, food: /cheese|wine|beer|soy sauce|tyramine/i, severity: 'high', desc: 'MAOIs with tyramine-rich foods can cause dangerous blood pressure spikes.', alt: 'Choose fresh foods, avoid fermented or aged products.' },
  { drug: /antibiotic|amoxicillin|ciprofloxacin|tetracycline/i, food: /milk|dairy|yogurt|cheese/i, severity: 'moderate', desc: 'Dairy can reduce absorption of certain antibiotics.', alt: 'Take the antibiotic 2 hours before or after dairy.' },
  { drug: /metformin/i, food: /alcohol|beer|wine/i, severity: 'high', desc: 'Alcohol with Metformin increases risk of lactic acidosis.', alt: 'Avoid alcohol or limit to minimal amounts.' },
  { drug: /ace inhibitor|lisinopril|enalapril/i, food: /banana|potato|tomato|potassium/i, severity: 'moderate', desc: 'ACE inhibitors raise potassium levels; high-potassium foods may cause hyperkalemia.', alt: 'Moderate intake of high-potassium foods.' },
];

const FoodCheck = () => {
  const { medicines } = useMedicines();
  const [selectedMed, setSelectedMed] = useState('');
  const [food, setFood] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ severity: 'high' | 'moderate' | 'safe'; desc: string; alt: string } | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const medName = selectedMed || '';
    if (!medName || !food) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));

    const match = drugFoodRules.find(rule => rule.drug.test(medName) && rule.food.test(food));
    if (match) {
      setResult({ severity: match.severity, desc: match.desc, alt: match.alt });
    } else {
      setResult({ severity: 'safe', desc: `No known interactions between ${medName} and ${food}.`, alt: 'You should be fine to consume this food with your medication.' });
    }
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
          </div>
        );
      })()}
    </div>
  );
};

export default FoodCheck;
