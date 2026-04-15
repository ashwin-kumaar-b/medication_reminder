import { useMedicines } from '@/contexts/MedicineContext';
import { useToast } from '@/hooks/use-toast';
import { Pill, Trash2, Clock, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

const Medicines = () => {
  const { medicines, removeMedicine } = useMedicines();
  const { toast } = useToast();

  const handleDelete = (id: string, name: string) => {
    removeMedicine(id);
    toast({ title: 'Removed', description: `${name} has been removed.` });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Medicines</h1>
          <p className="text-muted-foreground">Manage your medication list</p>
        </div>
        <Link to="/add-medicine" className="gradient-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Add New
        </Link>
      </div>

      {medicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
          <Pill className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="mb-2 text-lg font-semibold text-muted-foreground">No medicines yet</p>
          <p className="mb-4 text-sm text-muted-foreground">Add your first medication to get started.</p>
          <Link to="/add-medicine" className="gradient-primary rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Add Medicine</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {medicines.map((med, i) => (
            <div key={med.id} className="animate-fade-in rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated" style={{ animationDelay: `${i * 0.05}s` }}>
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {med.photoUrl ? (
                    <img
                      src={med.photoUrl}
                      alt={`${med.name} photo`}
                      className="h-10 w-10 rounded-lg border border-border object-cover"
                    />
                  ) : (
                    <div className={`rounded-lg p-2 ${med.isActive ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Pill className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-semibold text-foreground">{med.name}</h3>
                    <p className="text-sm text-muted-foreground">{med.dosage}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${med.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {med.isActive ? 'Active' : 'Completed'}
                </span>
              </div>
              <div className="mb-3 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {med.frequency} — {med.timeSlots.join(', ')}</div>
                {med.foodInstructions && <p className="italic">📋 {med.foodInstructions}</p>}
              </div>
              <div className="flex justify-end">
                <button onClick={() => handleDelete(med.id, med.name)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Medicines;
