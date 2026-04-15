import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Medicine {
  id: string;
  name: string;
  rxcui?: string;
  dosage: string;
  frequency: 'daily' | 'twice' | 'thrice';
  timeSlots: string[];
  startDate: string;
  endDate: string;
  foodInstructions: string;
  isActive: boolean;
}

export interface DoseLog {
  id: string;
  medicineId: string;
  scheduledTime: string;
  takenTime?: string;
  status: 'taken' | 'missed' | 'skipped';
}

interface MedicineContextType {
  medicines: Medicine[];
  doseLogs: DoseLog[];
  addMedicine: (med: Omit<Medicine, 'id'>) => void;
  removeMedicine: (id: string) => void;
  updateMedicine: (id: string, med: Partial<Medicine>) => void;
  logDose: (log: Omit<DoseLog, 'id'>) => void;
}

const MedicineContext = createContext<MedicineContextType | null>(null);

export const useMedicines = () => {
  const ctx = useContext(MedicineContext);
  if (!ctx) throw new Error('useMedicines must be used within MedicineProvider');
  return ctx;
};

export const MedicineProvider = ({ children }: { children: ReactNode }) => {
  const [medicines, setMedicines] = useState<Medicine[]>(() => {
    const stored = localStorage.getItem('mediguard_medicines');
    return stored ? JSON.parse(stored) : [];
  });
  const [doseLogs, setDoseLogs] = useState<DoseLog[]>(() => {
    const stored = localStorage.getItem('mediguard_doselogs');
    return stored ? JSON.parse(stored) : [];
  });

  const save = (meds: Medicine[], logs: DoseLog[]) => {
    localStorage.setItem('mediguard_medicines', JSON.stringify(meds));
    localStorage.setItem('mediguard_doselogs', JSON.stringify(logs));
  };

  const addMedicine = (med: Omit<Medicine, 'id'>) => {
    const newMed = { ...med, id: crypto.randomUUID() };
    const updated = [...medicines, newMed];
    setMedicines(updated);
    save(updated, doseLogs);
  };

  const removeMedicine = (id: string) => {
    const updated = medicines.filter(m => m.id !== id);
    setMedicines(updated);
    save(updated, doseLogs);
  };

  const updateMedicine = (id: string, partial: Partial<Medicine>) => {
    const updated = medicines.map(m => m.id === id ? { ...m, ...partial } : m);
    setMedicines(updated);
    save(updated, doseLogs);
  };

  const logDose = (log: Omit<DoseLog, 'id'>) => {
    const newLog = { ...log, id: crypto.randomUUID() };
    const updated = [...doseLogs, newLog];
    setDoseLogs(updated);
    save(medicines, updated);
  };

  return (
    <MedicineContext.Provider value={{ medicines, doseLogs, addMedicine, removeMedicine, updateMedicine, logDose }}>
      {children}
    </MedicineContext.Provider>
  );
};
