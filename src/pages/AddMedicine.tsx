import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicines } from '@/contexts/MedicineContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Pill, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { searchRxNavSuggestions } from '@/lib/medicationApis';

const categoryOptions = [
  { value: 'blood-pressure', label: 'Blood Pressure' },
  { value: 'diabetes', label: 'Diabetes' },
  { value: 'thyroid', label: 'Thyroid' },
  { value: 'antibiotic', label: 'Antibiotic' },
  { value: 'blood-thinner', label: 'Blood Thinner' },
  { value: 'other', label: 'Other' },
] as const;

const criticalityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const;

const dosageUnitOptions = [
  { value: 'pill', label: 'Pill(s)' },
  { value: 'mg', label: 'mg' },
  { value: 'ml', label: 'ml' },
] as const;

type DosageUnit = (typeof dosageUnitOptions)[number]['value'];

const AddMedicine = () => {
  const { addMedication } = useMedicines();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; rxcui: string }>>([]);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    dosageAmount: '',
    dosageUnit: 'pill' as DosageUnit,
    photoUrl: '',
    frequency: 'daily' as 'daily' | 'twice' | 'weekly',
    scheduleTime: '08:00',
    category: 'other' as 'blood-pressure' | 'diabetes' | 'thyroid' | 'antibiotic' | 'blood-thinner' | 'other',
    criticality: 'medium' as 'low' | 'medium' | 'high',
  });

  const formatDosage = (amount: string, unit: DosageUnit) => {
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;

    const displayAmount = Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(2).replace(/\.00$/, '').replace(/0$/, '');
    if (unit === 'pill') {
      return `${displayAmount} ${parsed === 1 ? 'pill' : 'pills'}`;
    }
    return `${displayAmount} ${unit}`;
  };

  useEffect(() => {
    const query = form.name.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSuggesting(true);
        const found = await searchRxNavSuggestions(query);
        setSuggestions(found);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggesting(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [form.name]);

  const handlePhotoSelect = async (file?: File) => {
    if (!file) {
      setForm(prev => ({ ...prev, photoUrl: '' }));
      setPhotoPreview(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Image too large', description: 'Please upload an image up to 2 MB.', variant: 'destructive' });
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read selected image.'));
      reader.readAsDataURL(file);
    });

    setForm(prev => ({ ...prev, photoUrl: dataUrl }));
    setPhotoPreview(dataUrl);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const patientId = user.role === 'patient' ? user.id : user.linkedPatientId;
    if (!patientId) {
      toast({
        title: 'No linked patient',
        description: 'Caretaker accounts need at least one linked patient before adding medications.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const dosage = formatDosage(form.dosageAmount, form.dosageUnit);
    if (!dosage) {
      toast({
        title: 'Invalid dosage',
        description: 'Enter a valid dosage amount greater than 0.',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const created = await addMedication({
      patientId,
      drugName: form.name,
      dosage,
      photoUrl: form.photoUrl || undefined,
      category: form.category,
      criticality: form.criticality,
      scheduleTime: form.scheduleTime,
      frequency: form.frequency,
    });

    if (!created) {
      toast({ title: 'Unable to add medicine', description: 'Please check your access scope and try again.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    toast({ title: 'Medicine Added', description: `${form.name} has been added with risk tracking enabled.` });
    setLoading(false);
    navigate('/medicines');
  };

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link to="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </Link>
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg gradient-primary p-2.5">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Add Medicine</h1>
            <p className="text-sm text-muted-foreground">Enter your medication details</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Drug Name (RxNav)</label>
              <div className="relative">
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="Start typing drug name"
                />
                {suggesting && <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">Searching...</span>}
              </div>
              {suggestions.length > 0 && (
                <div className="mt-1 max-h-36 overflow-auto rounded-lg border border-border bg-card">
                  {suggestions.map(option => (
                    <button
                      key={option.rxcui}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, name: option.name }));
                        setSuggestions([]);
                      }}
                      className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                    >
                      {option.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Dosage</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="number"
                  min={form.dosageUnit === 'pill' ? '0.5' : '0.1'}
                  step={form.dosageUnit === 'pill' ? '0.5' : '0.1'}
                  value={form.dosageAmount}
                  onChange={e => setForm(f => ({ ...f, dosageAmount: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                  placeholder="Amount"
                />
                <select
                  value={form.dosageUnit}
                  onChange={e => setForm(f => ({ ...f, dosageUnit: e.target.value as DosageUnit }))}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
                >
                  {dosageUnitOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Examples: 0.5 pill, 1 pill, 2 pills, 500 mg, 5 ml</p>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                void handlePhotoSelect(e.target.files?.[0]);
              }}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <p className="mt-1 text-xs text-muted-foreground">Optional. JPG/PNG/WebP up to 2 MB.</p>
            {photoPreview && (
              <div className="mt-2">
                <img
                  src={photoPreview}
                  alt="Medication preview"
                  className="h-20 w-20 rounded-lg border border-border object-cover"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Frequency</label>
            <div className="flex gap-2">
              {(['daily', 'twice', 'weekly'] as const).map(f => (
                <button key={f} type="button" onClick={() => setForm(prev => ({ ...prev, frequency: f }))}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${form.frequency === f ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {f === 'daily' ? 'Daily' : f === 'twice' ? 'Twice Daily' : 'Weekly'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Schedule Time</label>
              <input type="time" required value={form.scheduleTime} onChange={e => setForm(f => ({ ...f, scheduleTime: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Medication Category</label>
              <select
                value={form.category}
                onChange={e => setForm(prev => ({ ...prev, category: e.target.value as typeof form.category }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              >
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Criticality Level</label>
            <div className="grid grid-cols-3 gap-2">
              {criticalityOptions.map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, criticality: option.value }))}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                    form.criticality === option.value ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Consult healthcare provider if unsure. This system supports adherence tracking and does not replace medical advice.</p>
          <button type="submit" disabled={loading} className="gradient-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Medicine'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddMedicine;
