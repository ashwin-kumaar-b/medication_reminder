import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicines } from '@/contexts/MedicineContext';
import { useToast } from '@/hooks/use-toast';
import { Pill, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const AddMedicine = () => {
  const { addMedicine } = useMedicines();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', dosage: '', frequency: 'daily' as const,
    timeSlots: ['08:00'], startDate: new Date().toISOString().split('T')[0],
    endDate: '', foodInstructions: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 500));
    addMedicine({ ...form, isActive: true });
    toast({ title: 'Medicine Added', description: `${form.name} has been added to your list.` });
    setLoading(false);
    navigate('/medicines');
  };

  const updateTimeSlots = (freq: string) => {
    const slots = freq === 'daily' ? ['08:00'] : freq === 'twice' ? ['08:00', '20:00'] : ['08:00', '14:00', '20:00'];
    setForm(f => ({ ...f, frequency: freq as any, timeSlots: slots }));
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
              <label className="mb-1.5 block text-sm font-medium text-foreground">Medicine Name</label>
              <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" placeholder="e.g., Metformin" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Dosage</label>
              <input required value={form.dosage} onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" placeholder="e.g., 500mg" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Frequency</label>
            <div className="flex gap-2">
              {(['daily', 'twice', 'thrice'] as const).map(f => (
                <button key={f} type="button" onClick={() => updateTimeSlots(f)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium capitalize transition-colors ${form.frequency === f ? 'border-primary bg-accent text-accent-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {f === 'daily' ? 'Once Daily' : f === 'twice' ? 'Twice Daily' : 'Thrice Daily'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {form.timeSlots.map((slot, i) => (
              <div key={i}>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Time Slot {i + 1}</label>
                <input type="time" value={slot} onChange={e => { const s = [...form.timeSlots]; s[i] = e.target.value; setForm(f => ({ ...f, timeSlots: s })); }}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Start Date</label>
              <input type="date" required value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">Food Instructions</label>
            <textarea value={form.foodInstructions} onChange={e => setForm(f => ({ ...f, foodInstructions: e.target.value }))} rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20" placeholder="e.g., Take after meals" />
          </div>
          <button type="submit" disabled={loading} className="gradient-primary flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Medicine'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddMedicine;
