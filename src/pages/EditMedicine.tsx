import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Pill, Save } from 'lucide-react';
import { useMedicines } from '@/contexts/MedicineContext';
import { useToast } from '@/hooks/use-toast';
import { searchRxNavSuggestions } from '@/lib/medicationApis';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  { value: 'pill', label: 'Pills' },
  { value: 'mg', label: 'mg' },
  { value: 'ml', label: 'ml' },
] as const;

type DosageUnit = (typeof dosageUnitOptions)[number]['value'];

const parseDosage = (value: string): { amount: string; unit: DosageUnit } => {
  const normalized = value.trim().toLowerCase();
  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*(pill|pills|mg|ml)$/i);
  if (!match) return { amount: '', unit: 'pill' };

  const rawUnit = match[2].toLowerCase();
  const unit: DosageUnit = rawUnit === 'pills' ? 'pill' : (rawUnit as DosageUnit);
  return { amount: match[1], unit };
};

const formatDosage = (amount: string, unit: DosageUnit) => {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;

  const displayAmount = Number.isInteger(parsed)
    ? String(parsed)
    : parsed.toFixed(2).replace(/\.00$/, '').replace(/0$/, '');

  if (unit === 'pill') {
    return `${displayAmount} ${parsed === 1 ? 'pill' : 'pills'}`;
  }

  return `${displayAmount} ${unit}`;
};

const EditMedicine = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { medications, updateMedication } = useMedicines();

  const medication = useMemo(() => medications.find(item => item.id === id), [id, medications]);

  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; rxcui: string }>>([]);
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

  useEffect(() => {
    if (!medication) return;

    const dosage = parseDosage(medication.dosage);
    setForm({
      name: medication.drugName,
      dosageAmount: dosage.amount,
      dosageUnit: dosage.unit,
      photoUrl: medication.photoUrl || '',
      frequency: medication.frequency,
      scheduleTime: medication.scheduleTime,
      category: medication.category,
      criticality: medication.criticality,
    });
  }, [medication]);

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medication) return;

    const dosage = formatDosage(form.dosageAmount, form.dosageUnit);
    if (!dosage) {
      toast({
        title: 'Invalid dosage',
        description: 'Enter a valid dosage amount greater than 0.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    const updated = await updateMedication(medication.id, {
      drugName: form.name.trim(),
      dosage,
      photoUrl: form.photoUrl || undefined,
      category: form.category,
      criticality: form.criticality,
      scheduleTime: form.scheduleTime,
      frequency: form.frequency,
    });

    if (!updated) {
      toast({ title: 'Update failed', description: 'Unable to update medication right now.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    toast({ title: 'Medicine updated', description: `${updated.drugName} was saved successfully.` });
    setLoading(false);
    navigate('/medicines');
  };

  if (!medication) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Link to="/medicines" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Medicines
        </Link>
        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-center shadow-card">
          <p className="text-sm text-muted-foreground">Medicine not found or no longer accessible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <Link to="/medicines" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Medicines
      </Link>
      <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-lg gradient-primary p-2.5">
            <Pill className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Edit Medicine</h1>
            <p className="text-sm text-muted-foreground">Update medication details</p>
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
                <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-card/95 p-1 shadow-elevated backdrop-blur-sm animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200">
                  {suggestions.map(option => (
                    <button
                      key={option.rxcui}
                      type="button"
                      onClick={() => {
                        setForm(prev => ({ ...prev, name: option.name }));
                        setSuggestions([]);
                      }}
                      className="mb-1 flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2.5 text-left text-sm text-foreground transition-colors last:mb-0 hover:border-border hover:bg-muted/70"
                      title={option.name}
                    >
                      <span className="mr-3 flex-1 truncate font-medium">{option.name}</span>
                      <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">RxNorm</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Dosage</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
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
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-input bg-background p-1.5 shadow-card">
                  {dosageUnitOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, dosageUnit: option.value }))}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                        form.dosageUnit === option.value
                          ? 'bg-primary text-primary-foreground shadow-card'
                          : 'text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
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
            {form.photoUrl && (
              <div className="mt-2 flex items-center gap-3">
                <img src={form.photoUrl} alt="Medication preview" className="h-20 w-20 rounded-lg border border-border object-cover" />
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, photoUrl: '' }))}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                >
                  Remove Photo
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Frequency</label>
            <div className="flex gap-2">
              {(['daily', 'twice', 'weekly'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, frequency: f }))}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${
                    form.frequency === f ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {f === 'daily' ? 'Daily' : f === 'twice' ? 'Twice Daily' : 'Weekly'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Schedule Time</label>
              <input
                type="time"
                required
                value={form.scheduleTime}
                onChange={e => setForm(f => ({ ...f, scheduleTime: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Medication Category</label>
              <Select value={form.category} onValueChange={value => setForm(prev => ({ ...prev, category: value as typeof form.category }))}>
                <SelectTrigger className="w-full rounded-lg">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border shadow-elevated data-[side=bottom]:slide-in-from-top-3">
                  {categoryOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

          <button
            type="submit"
            disabled={loading}
            className="gradient-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditMedicine;
