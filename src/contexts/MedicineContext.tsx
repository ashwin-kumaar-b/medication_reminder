import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  CriticalityLevel,
  DoseStatus,
  MedicationCategory,
  MedicationFrequency,
  RiskLevel,
  formatRiskLabel,
  getCategoryImpact,
  getCategoryRiskLevel,
  getStabilityBand,
  getTimelineMilestones,
} from '@/lib/risk';

export interface Medication {
  id: string;
  patientId: string;
  drugName: string;
  dosage: string;
  photoUrl?: string;
  category: MedicationCategory;
  criticality: CriticalityLevel;
  scheduleTime: string;
  frequency: MedicationFrequency;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  medicationId: string;
  patientId: string;
  date: string;
  scheduledTime: string;
  status: DoseStatus;
  timestampMarked?: string;
  delayCount: number;
}

export interface NotificationEvent {
  id: string;
  patientId: string;
  caretakerId?: string;
  medicationId?: string;
  level: RiskLevel;
  type: 'patient-reminder' | 'patient-risk' | 'caretaker-alert';
  title: string;
  message: string;
  createdAt: string;
  dedupeKey: string;
}

export interface LegacyMedicine {
  id: string;
  name: string;
  dosage: string;
  photoUrl?: string;
  frequency: 'daily' | 'twice' | 'thrice';
  timeSlots: string[];
  startDate: string;
  endDate: string;
  foodInstructions: string;
  isActive: boolean;
}

export interface LegacyDoseLog {
  id: string;
  medicineId: string;
  scheduledTime: string;
  takenTime?: string;
  status: 'taken' | 'missed' | 'skipped';
}

export interface InteractionWarning {
  id: string;
  severity: 'low' | 'moderate' | 'high';
  description: string;
  medications: string[];
}

interface TodayMedicationItem {
  medication: Medication;
  log?: MedicationLog;
  status: DoseStatus;
  minutesLate: number;
}

interface RiskTimelineItem {
  medicationId: string;
  drugName: string;
  category: MedicationCategory;
  status: DoseStatus;
  missedAt?: string;
  hoursSinceMissed: number;
  currentImpact: 'low' | 'moderate' | 'high';
  milestones: Array<{ label: string; hours: number; impact: 'low' | 'moderate' | 'high' }>;
}

interface AdherenceStability {
  score: number;
  status: RiskLevel;
  label: string;
  takenPercent: number;
  timingDeviation: number;
  missedStreak: number;
}

interface PatientDashboardData {
  today: TodayMedicationItem[];
  riskTimeline: RiskTimelineItem[];
  adherence: AdherenceStability;
  interactionWarnings: InteractionWarning[];
  riskIndicator: RiskLevel;
}

interface CaretakerDashboardData {
  patientName: string;
  adherence: AdherenceStability;
  missedLog: Array<{
    medicationId: string;
    drugName: string;
    missedDate: string;
    scheduledTime: string;
    hoursDelayed: number;
  }>;
  lastDoseStatus: DoseStatus;
  missedStreak: number;
  riskIndicator: RiskLevel;
}

interface MedicineContextType {
  medications: Medication[];
  logs: MedicationLog[];
  notifications: NotificationEvent[];
  medicines: LegacyMedicine[];
  doseLogs: LegacyDoseLog[];
  addMedication: (med: Omit<Medication, 'id' | 'createdAt'>) => Promise<Medication | null>;
  updateMedication: (
    id: string,
    updates: Partial<Pick<Medication, 'drugName' | 'dosage' | 'photoUrl' | 'category' | 'criticality' | 'scheduleTime' | 'frequency'>>,
  ) => Promise<Medication | null>;
  removeMedication: (id: string) => Promise<void>;
  markDoseStatus: (medicationId: string, status: Extract<DoseStatus, 'taken' | 'delayed' | 'skipped'>) => Promise<void>;
  refreshMonitoring: (patientId?: string) => Promise<void>;
  getPatientDashboardData: (patientId: string) => PatientDashboardData;
  getCaretakerDashboardData: (patientId: string) => CaretakerDashboardData;
  addMedicine: (med: Omit<LegacyMedicine, 'id' | 'isActive'> & { isActive?: boolean }) => Promise<void>;
  removeMedicine: (id: string) => Promise<void>;
}

const MedicineContext = createContext<MedicineContextType | null>(null);

export const useMedicines = () => {
  const ctx = useContext(MedicineContext);
  if (!ctx) throw new Error('useMedicines must be used within MedicineProvider');
  return ctx;
};

const toDateKey = (value: Date) => value.toISOString().slice(0, 10);
const parseDateTime = (date: string, time: string) => new Date(`${date}T${time}:00`);
const minutesBetween = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 60000);

const interactionMatrix: Array<{
  categories: [MedicationCategory, MedicationCategory];
  severity: 'low' | 'moderate' | 'high';
  description: string;
}> = [
  {
    categories: ['blood-thinner', 'antibiotic'],
    severity: 'high',
    description: 'Blood thinner + antibiotic regimens may require closer schedule adherence monitoring.',
  },
  {
    categories: ['blood-pressure', 'diabetes'],
    severity: 'moderate',
    description: 'Blood pressure and diabetes medications should be tracked carefully to avoid cumulative misses.',
  },
  {
    categories: ['thyroid', 'antibiotic'],
    severity: 'low',
    description: 'Thyroid and antibiotic schedules can overlap and should be logged consistently.',
  },
];

const mapMedicationRow = (row: any): Medication => ({
  id: row.id,
  patientId: row.patient_id,
  drugName: row.drug_name,
  dosage: row.dosage,
  photoUrl: row.photo_url || undefined,
  category: row.category,
  criticality: row.criticality,
  scheduleTime: row.schedule_time,
  frequency: row.frequency,
  createdAt: row.created_at,
});

const mapLogRow = (row: any): MedicationLog => ({
  id: row.id,
  medicationId: row.medication_id,
  patientId: row.patient_id,
  date: row.date,
  scheduledTime: row.scheduled_time,
  status: row.status,
  timestampMarked: row.timestamp_marked || undefined,
  delayCount: row.delay_count ?? 0,
});

const mapNotificationRow = (row: any): NotificationEvent => ({
  id: row.id,
  patientId: row.patient_id,
  caretakerId: row.caretaker_id || undefined,
  medicationId: row.medication_id || undefined,
  level: row.level,
  type: row.type,
  title: row.title,
  message: row.message,
  dedupeKey: row.dedupe_key,
  createdAt: row.created_at,
});

export const MedicineProvider = ({ children }: { children: ReactNode }) => {
  const { user, users, getLinkedPatients } = useAuth();
  const [medications, setMedications] = useState<Medication[]>(() => {
    const stored = localStorage.getItem('mediguard_medications');
    return stored ? JSON.parse(stored) : [];
  });
  const [logs, setLogs] = useState<MedicationLog[]>(() => {
    const stored = localStorage.getItem('mediguard_logs');
    return stored ? JSON.parse(stored) : [];
  });
  const [notifications, setNotifications] = useState<NotificationEvent[]>(() => {
    const stored = localStorage.getItem('mediguard_notifications');
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem('mediguard_medications', JSON.stringify(medications));
  }, [medications]);

  useEffect(() => {
    localStorage.setItem('mediguard_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('mediguard_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const reloadFromSupabase = async () => {
    if (!isSupabaseConfigured || !supabase) return;

    const [medRes, logRes, notifRes] = await Promise.all([
      supabase.from('medications').select('*').order('created_at', { ascending: false }),
      supabase.from('logs').select('*').order('created_at', { ascending: false }),
      supabase.from('notifications').select('*').order('created_at', { ascending: false }),
    ]);

    if (!medRes.error && medRes.data) setMedications(medRes.data.map(mapMedicationRow));
    if (!logRes.error && logRes.data) setLogs(logRes.data.map(mapLogRow));
    if (!notifRes.error && notifRes.data) setNotifications(notifRes.data.map(mapNotificationRow));
  };

  useEffect(() => {
    void reloadFromSupabase();
  }, []);

  const visiblePatientIds = useMemo(() => {
    if (!user) return [] as string[];
    if (user.role === 'patient') return [user.id];

    const linkedPatients = getLinkedPatients(user.id).map(patient => patient.id);
    if (user.linkedPatientId && !linkedPatients.includes(user.linkedPatientId)) {
      linkedPatients.push(user.linkedPatientId);
    }
    return linkedPatients;
  }, [user, users, getLinkedPatients]);

  const isPatientVisible = (patientId: string) => visiblePatientIds.includes(patientId);

  const addNotification = async (notification: Omit<NotificationEvent, 'id' | 'createdAt'>) => {
    setNotifications(prev => {
      if (prev.some(existing => existing.dedupeKey === notification.dedupeKey)) {
        return prev;
      }
      return [
        {
          ...notification,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });

    if (!isSupabaseConfigured || !supabase) return;
    await supabase.from('notifications').upsert(
      {
        patient_id: notification.patientId,
        caretaker_id: notification.caretakerId ?? null,
        medication_id: notification.medicationId ?? null,
        level: notification.level,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        dedupe_key: notification.dedupeKey,
      },
      { onConflict: 'dedupe_key' },
    );
  };

  const upsertLog = async (medication: Medication, status: DoseStatus) => {
    const today = toDateKey(new Date());
    const timestamp = new Date().toISOString();

    setLogs(prev => {
      const existing = prev.find(entry => entry.medicationId === medication.id && entry.date === today);
      if (existing) {
        return prev.map(entry =>
          entry.id === existing.id
            ? {
                ...entry,
                status,
                timestampMarked: timestamp,
                delayCount: status === 'delayed' ? entry.delayCount + 1 : entry.delayCount,
              }
            : entry,
        );
      }

      return [
        ...prev,
        {
          id: crypto.randomUUID(),
          medicationId: medication.id,
          patientId: medication.patientId,
          date: today,
          scheduledTime: medication.scheduleTime,
          status,
          timestampMarked: timestamp,
          delayCount: status === 'delayed' ? 1 : 0,
        },
      ];
    });

    if (!isSupabaseConfigured || !supabase) return;

    const { data: existing } = await supabase
      .from('logs')
      .select('*')
      .eq('medication_id', medication.id)
      .eq('date', today)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('logs')
        .update({
          status,
          timestamp_marked: timestamp,
          delay_count: status === 'delayed' ? (existing.delay_count ?? 0) + 1 : existing.delay_count ?? 0,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('logs').insert({
        medication_id: medication.id,
        patient_id: medication.patientId,
        date: today,
        scheduled_time: medication.scheduleTime,
        status,
        timestamp_marked: timestamp,
        delay_count: status === 'delayed' ? 1 : 0,
      });
    }
  };

  const getMedicationMissedStreak = (medicationId: string) => {
    const medLogs = logs
      .filter(entry => entry.medicationId === medicationId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    let streak = 0;
    for (const entry of medLogs) {
      if (entry.status === 'missed') streak += 1;
      else break;
    }
    return streak;
  };

  const notifyCaretakersIfNeeded = async (medication: Medication, reason: 'critical' | 'consecutive-miss') => {
    const linkedCaretakers = users.filter(
      existing => existing.role === 'caretaker' && existing.linkedPatientId === medication.patientId,
    );

    for (const caretaker of linkedCaretakers) {
      const dedupeKey = `${reason}-${medication.id}-${toDateKey(new Date())}-${caretaker.id}`;
      await addNotification({
        patientId: medication.patientId,
        caretakerId: caretaker.id,
        medicationId: medication.id,
        level: 'red',
        type: 'caretaker-alert',
        title: 'Risk Escalation Alert',
        message:
          reason === 'critical'
            ? `${medication.drugName} was missed and is marked high criticality.`
            : `${medication.drugName} has been missed in consecutive doses.`,
        dedupeKey,
      });
    }
  };

  const refreshMonitoring = async (patientId?: string) => {
    const now = new Date();
    const today = toDateKey(now);
    const scoped = medications.filter(entry =>
      patientId ? entry.patientId === patientId : isPatientVisible(entry.patientId),
    );

    for (const medication of scoped) {
      const scheduledAt = parseDateTime(today, medication.scheduleTime);
      const lateMinutes = minutesBetween(now, scheduledAt);
      const currentLog = logs.find(entry => entry.medicationId === medication.id && entry.date === today);

      if (lateMinutes >= 0) {
        await addNotification({
          patientId: medication.patientId,
          medicationId: medication.id,
          level: 'green',
          type: 'patient-reminder',
          title: 'Medication Reminder',
          message: `Time to take ${medication.drugName} (${medication.dosage}).`,
          dedupeKey: `reminder-0-${medication.id}-${today}`,
        });
      }

      if (lateMinutes >= 20) {
        await addNotification({
          patientId: medication.patientId,
          medicationId: medication.id,
          level: 'yellow',
          type: 'patient-reminder',
          title: 'Second Reminder',
          message: `${medication.drugName} is still pending 20 minutes after schedule.`,
          dedupeKey: `reminder-20-${medication.id}-${today}`,
        });
      }

      if (lateMinutes >= 60 && (!currentLog || currentLog.status === 'pending' || currentLog.status === 'delayed')) {
        await upsertLog(medication, 'missed');

        await addNotification({
          patientId: medication.patientId,
          medicationId: medication.id,
          level: getCategoryRiskLevel(medication.category, 1),
          type: 'patient-risk',
          title: 'Dose Marked Missed',
          message: `${medication.drugName} was automatically marked as missed after 60 minutes.`,
          dedupeKey: `auto-missed-${medication.id}-${today}`,
        });

        const streak = getMedicationMissedStreak(medication.id) + 1;
        if (medication.criticality === 'high') {
          await notifyCaretakersIfNeeded(medication, 'critical');
        }
        if (streak >= 2) {
          await notifyCaretakersIfNeeded(medication, 'consecutive-miss');
        }
      }
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshMonitoring();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [medications, logs, users]);

  const addMedication = async (med: Omit<Medication, 'id' | 'createdAt'>) => {
    if (!isPatientVisible(med.patientId)) return null;

    const newMedication: Medication = {
      ...med,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };
    setMedications(prev => [...prev, newMedication]);

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('medications')
        .insert({
          patient_id: med.patientId,
          drug_name: med.drugName,
          dosage: med.dosage,
          photo_url: med.photoUrl ?? null,
          category: med.category,
          criticality: med.criticality,
          schedule_time: med.scheduleTime,
          frequency: med.frequency,
        })
        .select()
        .single();

      if (!error && data) {
        const mapped = mapMedicationRow(data);
        setMedications(prev => prev.map(item => (item.id === newMedication.id ? mapped : item)));
        return mapped;
      }
    }

    return newMedication;
  };

  const removeMedication = async (id: string) => {
    const foundMedication = medications.find(entry => entry.id === id);
    if (!foundMedication || !isPatientVisible(foundMedication.patientId)) return;

    setMedications(prev => prev.filter(entry => entry.id !== id));
    setLogs(prev => prev.filter(entry => entry.medicationId !== id));

    if (!isSupabaseConfigured || !supabase) return;
    await Promise.all([
      supabase.from('logs').delete().eq('medication_id', id),
      supabase.from('medications').delete().eq('id', id),
    ]);
  };

  const updateMedication = async (
    id: string,
    updates: Partial<Pick<Medication, 'drugName' | 'dosage' | 'photoUrl' | 'category' | 'criticality' | 'scheduleTime' | 'frequency'>>,
  ) => {
    const existing = medications.find(entry => entry.id === id);
    if (!existing || !isPatientVisible(existing.patientId)) return null;

    const next: Medication = {
      ...existing,
      ...updates,
    };

    setMedications(prev => prev.map(entry => (entry.id === id ? next : entry)));

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('medications')
        .update({
          drug_name: next.drugName,
          dosage: next.dosage,
          photo_url: next.photoUrl ?? null,
          category: next.category,
          criticality: next.criticality,
          schedule_time: next.scheduleTime,
          frequency: next.frequency,
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        const mapped = mapMedicationRow(data);
        setMedications(prev => prev.map(entry => (entry.id === id ? mapped : entry)));
        return mapped;
      }
    }

    return next;
  };

  const markDoseStatus = async (
    medicationId: string,
    status: Extract<DoseStatus, 'taken' | 'delayed' | 'skipped'>,
  ) => {
    const medication = medications.find(entry => entry.id === medicationId && isPatientVisible(entry.patientId));
    if (!medication) return;
    await upsertLog(medication, status);
  };

  const getInteractionWarnings = (patientId: string) => {
    const meds = medications.filter(entry => entry.patientId === patientId);
    const warnings: InteractionWarning[] = [];

    for (let i = 0; i < meds.length; i += 1) {
      for (let j = i + 1; j < meds.length; j += 1) {
        const left = meds[i];
        const right = meds[j];
        const match = interactionMatrix.find(rule => {
          const [a, b] = rule.categories;
          return (left.category === a && right.category === b) || (left.category === b && right.category === a);
        });

        if (match) {
          warnings.push({
            id: `${left.id}-${right.id}`,
            severity: match.severity,
            description: match.description,
            medications: [left.drugName, right.drugName],
          });
        }
      }
    }

    return warnings;
  };

  const getPatientMissedStreak = (patientId: string) => {
    const patientLogs = logs
      .filter(entry => entry.patientId === patientId)
      .sort((a, b) => ((a.timestampMarked || a.date) < (b.timestampMarked || b.date) ? 1 : -1));

    let streak = 0;
    for (const entry of patientLogs) {
      if (entry.status === 'missed') streak += 1;
      else if (entry.status === 'taken') break;
    }
    return streak;
  };

  const getAdherenceStability = (patientId: string): AdherenceStability => {
    const patientLogs = logs.filter(entry => entry.patientId === patientId);
    const evaluatedLogs = patientLogs.filter(entry => entry.status !== 'pending');
    if (evaluatedLogs.length === 0) {
      return { score: 100, status: 'green', label: formatRiskLabel('green'), takenPercent: 100, timingDeviation: 0, missedStreak: 0 };
    }

    const taken = evaluatedLogs.filter(entry => entry.status === 'taken').length;
    const delayed = evaluatedLogs.filter(entry => entry.status === 'delayed').length;
    const missed = evaluatedLogs.filter(entry => entry.status === 'missed').length;
    const skipped = evaluatedLogs.filter(entry => entry.status === 'skipped').length;
    const takenPercent = Math.round((taken / evaluatedLogs.length) * 100);
    const timingDeviation = Math.min(100, delayed * 8 + missed * 20 + skipped * 12);
    const missedStreak = getPatientMissedStreak(patientId);
    const score = Math.max(0, Math.min(100, takenPercent - timingDeviation - missedStreak * 6));
    const status = getStabilityBand(score);

    return { score, status, label: formatRiskLabel(status), takenPercent, timingDeviation, missedStreak };
  };

  const getRiskIndicator = (patientId: string): RiskLevel => {
    const patientMeds = medications.filter(entry => entry.patientId === patientId);
    let worst: RiskLevel = 'green';

    patientMeds.forEach(medication => {
      const missed = getMedicationMissedStreak(medication.id);
      const risk = getCategoryRiskLevel(medication.category, missed);
      if (risk === 'red') worst = 'red';
      else if (risk === 'yellow' && worst !== 'red') worst = 'yellow';
    });

    return worst;
  };

  const getPatientDashboardData = (patientId: string): PatientDashboardData => {
    if (!isPatientVisible(patientId)) {
      return {
        today: [],
        riskTimeline: [],
        adherence: { score: 100, status: 'green', label: formatRiskLabel('green'), takenPercent: 100, timingDeviation: 0, missedStreak: 0 },
        interactionWarnings: [],
        riskIndicator: 'green',
      };
    }

    const today = toDateKey(new Date());
    const now = new Date();
    const patientMeds = medications
      .filter(entry => entry.patientId === patientId)
      .sort((a, b) => a.scheduleTime.localeCompare(b.scheduleTime));

    const todayItems = patientMeds.map(medication => {
      const log = logs.find(entry => entry.medicationId === medication.id && entry.date === today);
      const scheduled = parseDateTime(today, medication.scheduleTime);
      const late = Math.max(0, minutesBetween(now, scheduled));
      return { medication, log, status: log?.status || 'pending', minutesLate: late };
    });

    const riskTimeline = todayItems
      .filter(item => item.status === 'missed')
      .map(item => {
        const missedAt = item.log?.timestampMarked || parseDateTime(today, item.medication.scheduleTime).toISOString();
        const elapsed = Math.max(0, Math.floor((Date.now() - new Date(missedAt).getTime()) / 3600000));
        return {
          medicationId: item.medication.id,
          drugName: item.medication.drugName,
          category: item.medication.category,
          status: item.status,
          missedAt,
          hoursSinceMissed: elapsed,
          currentImpact: getCategoryImpact(item.medication.category, 1),
          milestones: getTimelineMilestones(item.medication.category),
        };
      });

    return {
      today: todayItems,
      riskTimeline,
      adherence: getAdherenceStability(patientId),
      interactionWarnings: getInteractionWarnings(patientId),
      riskIndicator: getRiskIndicator(patientId),
    };
  };

  const getCaretakerDashboardData = (patientId: string): CaretakerDashboardData => {
    if (!isPatientVisible(patientId)) {
      return {
        patientName: 'Linked Patient',
        adherence: { score: 100, status: 'green', label: formatRiskLabel('green'), takenPercent: 100, timingDeviation: 0, missedStreak: 0 },
        missedLog: [],
        lastDoseStatus: 'pending',
        missedStreak: 0,
        riskIndicator: 'green',
      };
    }

    const patientName = users.find(entry => entry.id === patientId)?.name || 'Linked Patient';
    const patientLogs = logs
      .filter(entry => entry.patientId === patientId)
      .sort((a, b) => ((a.timestampMarked || a.date) < (b.timestampMarked || b.date) ? 1 : -1));

    const missedLog = patientLogs
      .filter(entry => entry.status === 'missed')
      .slice(0, 12)
      .map(entry => {
        const medication = medications.find(med => med.id === entry.medicationId);
        const missedTime = entry.timestampMarked ? new Date(entry.timestampMarked) : parseDateTime(entry.date, entry.scheduledTime);
        const hoursDelayed = Math.max(1, Math.floor((Date.now() - missedTime.getTime()) / 3600000));
        return {
          medicationId: entry.medicationId,
          drugName: medication?.drugName || 'Medication',
          missedDate: entry.date,
          scheduledTime: entry.scheduledTime,
          hoursDelayed,
        };
      });

    return {
      patientName,
      adherence: getAdherenceStability(patientId),
      missedLog,
      lastDoseStatus: patientLogs[0]?.status || 'pending',
      missedStreak: getPatientMissedStreak(patientId),
      riskIndicator: getRiskIndicator(patientId),
    };
  };

  const scopedMedications = useMemo(
    () => medications.filter(medication => isPatientVisible(medication.patientId)),
    [medications, visiblePatientIds],
  );

  const scopedLogs = useMemo(
    () => logs.filter(log => isPatientVisible(log.patientId)),
    [logs, visiblePatientIds],
  );

  const scopedNotifications = useMemo(
    () =>
      notifications.filter(
        notification =>
          isPatientVisible(notification.patientId) ||
          (!!user && notification.caretakerId === user.id),
      ),
    [notifications, visiblePatientIds, user],
  );

  const medicines = useMemo<LegacyMedicine[]>(() => {
    return scopedMedications.map(med => ({
      id: med.id,
      name: med.drugName,
      dosage: med.dosage,
      photoUrl: med.photoUrl,
      frequency: med.frequency === 'weekly' ? 'daily' : med.frequency,
      timeSlots: [med.scheduleTime],
      startDate: med.createdAt?.slice(0, 10) || toDateKey(new Date()),
      endDate: '',
      foodInstructions: '',
      isActive: true,
    }));
  }, [scopedMedications]);

  const doseLogs = useMemo<LegacyDoseLog[]>(() => {
    return scopedLogs
      .filter(log => log.status === 'taken' || log.status === 'missed' || log.status === 'skipped')
      .map(log => ({
        id: log.id,
        medicineId: log.medicationId,
        scheduledTime: `${log.date}T${log.scheduledTime}:00`,
        takenTime: log.timestampMarked,
        status: log.status as LegacyDoseLog['status'],
      }));
  }, [scopedLogs]);

  const addMedicine = async (med: Omit<LegacyMedicine, 'id' | 'isActive'> & { isActive?: boolean }) => {
    const userPatientId = user?.role === 'patient' ? user.id : user?.linkedPatientId;
    if (!userPatientId) return;

    await addMedication({
      patientId: userPatientId,
      drugName: med.name,
      dosage: med.dosage,
      category: 'other',
      criticality: 'medium',
      scheduleTime: med.timeSlots[0] || '08:00',
      frequency: med.frequency === 'thrice' ? 'twice' : med.frequency,
    });
  };

  const value = useMemo(
    () => ({
      medications: scopedMedications,
      logs: scopedLogs,
      notifications: scopedNotifications,
      medicines,
      doseLogs,
      addMedication,
      updateMedication,
      removeMedication,
      markDoseStatus,
      refreshMonitoring,
      getPatientDashboardData,
      getCaretakerDashboardData,
      addMedicine,
      removeMedicine: removeMedication,
    }),
    [
      scopedMedications,
      scopedLogs,
      scopedNotifications,
      medicines,
      doseLogs,
      addMedication,
      updateMedication,
      removeMedication,
      markDoseStatus,
      refreshMonitoring,
      getPatientDashboardData,
      getCaretakerDashboardData,
      addMedicine,
      users,
      user,
      visiblePatientIds,
    ],
  );

  return <MedicineContext.Provider value={value}>{children}</MedicineContext.Provider>;
};
