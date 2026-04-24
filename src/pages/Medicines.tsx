import { useEffect, useMemo, useState } from 'react';
import { useMedicines } from '@/contexts/MedicineContext';
import { useToast } from '@/hooks/use-toast';
import { Pill, Trash2, Clock, Plus, Pencil } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getMedicineDetailsByName } from '@/lib/localMedicineData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const Medicines = () => {
  const { removeMedicine, medications } = useMedicines();
  const { user, getLinkedPatients } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const linkedPatients = useMemo(() => getLinkedPatients(user?.id), [getLinkedPatients, user?.id]);
  const defaultPatientId = user?.role === 'patient' ? user.id : (searchParams.get('patientId') || (linkedPatients.length > 0 ? linkedPatients[0].id : ''));
  const [selectedPatientId, setSelectedPatientId] = useState<string>(defaultPatientId);
  const [substituteById, setSubstituteById] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (user?.role === 'caretaker' && !selectedPatientId && defaultPatientId) {
      setSelectedPatientId(defaultPatientId);
    }
  }, [user?.role, selectedPatientId, defaultPatientId]);

  const displayedMedicines = useMemo(() => {
    const scoped =
      user?.role === 'caretaker'
        ? medications.filter(med => med.patientId === selectedPatientId)
        : medications;

    const grouped = new Map<
      string,
      {
        id: string;
        sourceIds: string[];
        name: string;
        dosage: string;
        photoUrl?: string;
        frequency: 'daily' | 'twice' | 'thrice';
        timeSlots: string[];
        foodInstructions: string;
        isActive: boolean;
        genericName?: string;
      }
    >();

    scoped.forEach(med => {
      const displayName = med.displayName || med.drugName;
      const key = [
        med.patientId,
        displayName.toLowerCase(),
        med.dosage.toLowerCase(),
        med.foodTiming,
        med.category,
        med.criticality,
      ].join('|');

      const existing = grouped.get(key);
      if (existing) {
        existing.sourceIds.push(med.id);
        if (!existing.timeSlots.includes(med.scheduleTime)) {
          existing.timeSlots.push(med.scheduleTime);
          existing.timeSlots.sort();
        }
        return;
      }

      grouped.set(key, {
        id: med.id,
        sourceIds: [med.id],
        name: displayName,
        dosage: med.dosage,
        photoUrl: med.photoUrl,
        frequency: med.frequency === 'weekly' ? 'daily' : med.frequency,
        timeSlots: [med.scheduleTime],
        foodInstructions: med.foodTiming === 'after-food' ? 'Take after food' : 'Take before food',
        isActive: true,
        genericName: med.genericName || med.drugName,
      });
    });

    return Array.from(grouped.values());
  }, [medications, user?.role, selectedPatientId]);

  useEffect(() => {
    let active = true;

    const loadSubstitutes = async () => {
      const pairs = await Promise.all(
        displayedMedicines.map(async groupedMed => {
          const lookupName = groupedMed.genericName || groupedMed.name;
          const details = await getMedicineDetailsByName(lookupName);
          return [groupedMed.id, details?.substitutes?.slice(0, 3) || []] as const;
        }),
      );

      if (!active) return;

      setSubstituteById(Object.fromEntries(pairs));
    };

    void loadSubstitutes();

    return () => {
      active = false;
    };
  }, [displayedMedicines, medications]);

  const handleDelete = async (sourceIds: string[], name: string) => {
    await Promise.all(sourceIds.map(id => removeMedicine(id)));
    toast({ title: 'Removed', description: `${name} has been removed.` });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {user?.role === 'caretaker' && (
        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-foreground">Select Patient</label>
          <Select value={selectedPatientId} onValueChange={(val) => setSelectedPatientId(val)}>
            <SelectTrigger className="w-full sm:w-64 rounded-xl text-sm font-medium">
              <SelectValue placeholder="Select patient" />
            </SelectTrigger>
            <SelectContent>
              {linkedPatients.map(patient => (
                <SelectItem key={patient.id} value={patient.id}>{patient.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Medicines</h1>
          <p className="text-muted-foreground">Manage your medication list</p>
        </div>
        <Link to={`/add-medicine${user?.role === 'caretaker' ? `?patientId=${selectedPatientId}` : ''}`} className="gradient-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Add New
        </Link>
      </div>

      {displayedMedicines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
          <Pill className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="mb-2 text-lg font-semibold text-muted-foreground">No medicines yet</p>
          <p className="mb-4 text-sm text-muted-foreground">Add your first medication to get started.</p>
          <Link to={`/add-medicine${user?.role === 'caretaker' ? `?patientId=${selectedPatientId}` : ''}`} className="gradient-primary rounded-lg px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Add Medicine</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedMedicines.map((med, i) => (
            <div key={med.id} className="animate-fade-in rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated" style={{ animationDelay: `${i * 0.05}s` }}>
              {(() => {
                const genericName = med.genericName;
                const substitutes = substituteById[med.id] || [];

                return (
                  <>
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
                    {genericName && genericName.toLowerCase() !== med.name.toLowerCase() && (
                      <p className="text-xs text-muted-foreground">Generic: {genericName}</p>
                    )}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${med.isActive ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {med.isActive ? 'Active' : 'Completed'}
                </span>
              </div>
              <div className="mb-3 space-y-1 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {med.frequency} — {med.timeSlots.join(', ')}</div>
                {med.foodInstructions && <p className="italic">📋 {med.foodInstructions}</p>}
                {substitutes.length > 0 && <p className="text-xs">Similar medicines: {substitutes.join(', ')}</p>}
              </div>
              <div className="flex justify-end gap-2">
                <Link to={`/edit-medicine/${med.id}`} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
                <button onClick={() => void handleDelete(med.sourceIds, med.name)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
                  </>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Medicines;
