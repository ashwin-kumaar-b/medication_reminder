import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type UserRole = 'patient' | 'caretaker';
export type UiMode = 'younger' | 'older';

export interface AllergyEntry {
  category: string;
  trigger: string;
}

export interface User {
  id: string;
  patientId?: string;
  caretakerId?: string;
  name: string;
  email: string;
  phoneNumber?: string;
  password?: string;
  role: UserRole;
  relation?: string;
  relationOther?: string;
  gender?: string;
  genderOther?: string;
  bloodGroup?: string;
  age?: number;
  illness?: string;
  dateOfBirth?: string;
  heightCm?: number;
  weightKg?: number;
  chronicDiseases?: string[];
  infectionHistory?: string[];
  allergies?: AllergyEntry[];
  emergencyContactEmail?: string;
  uiMode: UiMode;
  linkedPatientId?: string;
}

interface RegisterInput {
  name: string;
  phoneNumber: string;
  password: string;
  role: UserRole;
  relation?: string;
  relationOther?: string;
  gender?: string;
  genderOther?: string;
  bloodGroup?: string;
  age?: number;
  illness?: string;
  dateOfBirth?: string;
  heightCm?: number;
  weightKg?: number;
  chronicDiseases?: string[];
  infectionHistory?: string[];
  allergies?: AllergyEntry[];
  emergencyContactEmail?: string;
  uiMode?: UiMode;
  linkedPatientId?: string;
}

interface CreatePatientInput {
  name: string;
  email: string;
  password: string;
  age?: number;
  illness?: string;
  uiMode?: UiMode;
}

interface LoginInput {
  phoneNumber: string;
  password: string;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  user?: User;
  needsEmailVerification?: boolean;
}

interface AuthContextType {
  user: User | null;
  users: User[];
  loadingUsers: boolean;
  isAuthenticated: boolean;
  register: (input: RegisterInput) => Promise<AuthResult>;
  createPatientForCaretaker: (caretakerId: string, input: CreatePatientInput) => Promise<AuthResult>;
  login: (input: LoginInput) => Promise<AuthResult>;
  logout: () => void;
  getPatientById: (id?: string) => User | undefined;
  linkExistingPatient: (caretakerId: string, patientMgpId: string) => Promise<{ ok: boolean; error?: string; patient?: User }>;
  getLinkedPatients: (caretakerId?: string) => User[];
  regeneratePatientId: (userId: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const normalizePhoneNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  return `+${trimmed.replace(/\D/g, '')}`;
};

const buildAuthEmailFromPhone = (phoneNumber: string) => `phone_${phoneNumber.replace('+', '')}@mediguard.local`;

const extractPhoneNumberFromAuthEmail = (email?: string) => {
  if (!email) return undefined;
  const matched = email.match(/^phone_(\d+)@mediguard\.local$/i);
  if (!matched) return undefined;
  return `+${matched[1]}`;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const generatePatientId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'MGP-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateCaretakerId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'MGC-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const stored = localStorage.getItem('mediguard_users');
    if (stored) return JSON.parse(stored);

    const seedPatient: User = {
      id: crypto.randomUUID(),
      patientId: 'MGP-DEMO01',
      name: 'Demo Patient',
      email: 'patient@mediguard.demo',
      phoneNumber: '+919999000001',
      password: 'demo1234',
      role: 'patient',
      age: 58,
      illness: 'Hypertension',
      dateOfBirth: '1968-01-20',
      heightCm: 168,
      weightKg: 74,
      chronicDiseases: ['Hypertension'],
      infectionHistory: ['None'],
      allergies: [{ category: 'Drug', trigger: 'Penicillin' }],
      emergencyContactEmail: 'caretaker@mediguard.demo',
      uiMode: 'older',
    };
    const seedCaretaker: User = {
      id: crypto.randomUUID(),
      name: 'Demo Caretaker',
      email: 'caretaker@mediguard.demo',
      phoneNumber: '+919999000002',
      password: 'demo1234',
      role: 'caretaker',
      age: 31,
      illness: '',
      dateOfBirth: '1995-03-12',
      heightCm: 173,
      weightKg: 69,
      chronicDiseases: ['None'],
      infectionHistory: ['None'],
      allergies: [],
      uiMode: 'younger',
      linkedPatientId: seedPatient.id,
    };
    return [seedPatient, seedCaretaker];
  });
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('mediguard_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [caretakerLinks, setCaretakerLinks] = useState<Array<{ caretakerId: string; patientId: string }>>([]);

  const inferAgeFromDob = (dateOfBirth?: string): number | undefined => {
    if (!dateOfBirth) return undefined;
    const date = new Date(dateOfBirth);
    if (Number.isNaN(date.getTime())) return undefined;

    const now = new Date();
    let age = now.getFullYear() - date.getFullYear();
    const monthGap = now.getMonth() - date.getMonth();
    if (monthGap < 0 || (monthGap === 0 && now.getDate() < date.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : undefined;
  };

  const inferUiMode = (age?: number, dateOfBirth?: string): UiMode => {
    const resolvedAge = typeof age === 'number' ? age : inferAgeFromDob(dateOfBirth);
    if (typeof resolvedAge === 'number' && resolvedAge >= 55) return 'older';
    return 'younger';
  };

  const normalizeStringArray = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  };

  const normalizeAllergies = (value: unknown): AllergyEntry[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const cleaned = value
      .map(item => {
        if (!item || typeof item !== 'object') return null;
        const category = typeof (item as any).category === 'string' ? (item as any).category.trim() : '';
        const trigger = typeof (item as any).trigger === 'string' ? (item as any).trigger.trim() : '';
        if (!category || !trigger) return null;
        return { category, trigger };
      })
      .filter((item): item is AllergyEntry => !!item);
    return cleaned.length > 0 ? cleaned : undefined;
  };

  const mapUserRow = (row: any): User => {
    const profile = (row.profile_json || {}) as Record<string, unknown>;
    const dateOfBirth =
      (typeof row.date_of_birth === 'string' ? row.date_of_birth : undefined) ||
      (typeof profile.dateOfBirth === 'string' ? profile.dateOfBirth : undefined);
    const ageFromDob = inferAgeFromDob(dateOfBirth);

    return {
      id: row.id,
      patientId: typeof profile.patientId === 'string' ? profile.patientId : undefined,
      caretakerId: typeof profile.caretakerId === 'string' ? profile.caretakerId : undefined,
      name: row.name,
      email: row.email,
      phoneNumber:
        (typeof profile.phoneNumber === 'string' ? normalizePhoneNumber(profile.phoneNumber) : undefined) ||
        (typeof row.phone === 'string' ? normalizePhoneNumber(row.phone) : undefined) ||
        extractPhoneNumberFromAuthEmail(row.email),
      password: row.password || undefined,
      role: row.role,
      relation: typeof profile.relation === 'string' ? profile.relation : undefined,
      relationOther: typeof profile.relationOther === 'string' ? profile.relationOther : undefined,
      gender:
        (typeof row.gender === 'string' ? row.gender : undefined) ||
        (typeof profile.gender === 'string' ? profile.gender : undefined),
      genderOther:
        (typeof row.gender_other === 'string' ? row.gender_other : undefined) ||
        (typeof profile.genderOther === 'string' ? profile.genderOther : undefined),
      bloodGroup:
        (typeof row.blood_group === 'string' ? row.blood_group : undefined) ||
        (typeof profile.bloodGroup === 'string' ? profile.bloodGroup : undefined),
      age: typeof row.age === 'number' ? row.age : ageFromDob,
      illness:
        (typeof row.illness === 'string' ? row.illness : undefined) ||
        (typeof profile.illness === 'string' ? profile.illness : undefined),
      dateOfBirth,
      heightCm:
        typeof row.height_cm === 'number'
          ? row.height_cm
          : typeof profile.heightCm === 'number'
            ? profile.heightCm
            : undefined,
      weightKg:
        typeof row.weight_kg === 'number'
          ? row.weight_kg
          : typeof profile.weightKg === 'number'
            ? profile.weightKg
            : undefined,
      chronicDiseases: normalizeStringArray(row.chronic_diseases ?? profile.chronicDiseases),
      infectionHistory: normalizeStringArray(row.infection_history ?? profile.infectionHistory),
      allergies: normalizeAllergies(row.allergies ?? profile.allergies),
      emergencyContactEmail:
        (typeof row.emergency_contact_email === 'string' ? row.emergency_contact_email : undefined) ||
        (typeof profile.emergencyContactEmail === 'string' ? profile.emergencyContactEmail : undefined),
      uiMode: row.ui_mode || inferUiMode(row.age, dateOfBirth),
      linkedPatientId: row.linked_patient_id || undefined,
    };
  };

  const buildUserRowPayload = (entry: User, passwordFallback?: string) => ({
    id: entry.id,
    name: entry.name,
    email: entry.email,
    // Backward-compatible with current schema where password is required.
    password: passwordFallback ?? entry.password ?? '__supabase_auth__',
    role: entry.role,
    phone: entry.phoneNumber ?? null,
    ui_mode: entry.uiMode,
    linked_patient_id: entry.linkedPatientId ?? null,
  });

  const buildHealthProfilePayload = (entry: User) => {
    if (entry.role !== 'patient') return null;

    if (
      !entry.gender ||
      !entry.bloodGroup ||
      !entry.dateOfBirth ||
      typeof entry.heightCm !== 'number' ||
      typeof entry.weightKg !== 'number' ||
      !entry.chronicDiseases?.length ||
      !entry.infectionHistory?.length ||
      !entry.emergencyContactEmail
    ) {
      return null;
    }

    return {
      user_id: entry.id,
      gender: entry.gender,
      gender_other: entry.genderOther ?? null,
      blood_group: entry.bloodGroup,
      date_of_birth: entry.dateOfBirth,
      height_cm: entry.heightCm,
      weight_kg: entry.weightKg,
      chronic_diseases: entry.chronicDiseases,
      infection_history: entry.infectionHistory,
      allergies: entry.allergies ?? [],
      emergency_contact_email: entry.emergencyContactEmail,
      profile_json: {
        patientId: entry.patientId ?? null,
      },
      updated_at: new Date().toISOString(),
    };
  };

  const buildCaretakerProfilePayload = (entry: User) => {
    if (entry.role !== 'caretaker' || !entry.relation) return null;

    return {
      user_id: entry.id,
      relation: entry.relation,
      relation_other: entry.relationOther ?? null,
      linked_patient_id: entry.linkedPatientId ?? null,
      profile_json: {
        caretakerId: entry.caretakerId ?? null,
        linkedPatientId: entry.linkedPatientId ?? null,
      },
      updated_at: new Date().toISOString(),
    };
  };

  const upsertUserRow = async (entry: User, passwordFallback?: string) => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    const { error } = await supabase
      .from('users')
      .upsert(buildUserRowPayload(entry, passwordFallback), { onConflict: 'id' });

    if (error) return error.message;

    const healthPayload = buildHealthProfilePayload(entry);
    if (healthPayload) {
      const { error: healthError } = await supabase
        .from('user_health_profiles')
        .upsert(healthPayload, { onConflict: 'user_id' });

      if (healthError) return healthError.message;
    }

    const caretakerPayload = buildCaretakerProfilePayload(entry);
    if (caretakerPayload) {
      const { error: caretakerError } = await supabase
        .from('caretakers')
        .upsert(caretakerPayload, { onConflict: 'user_id' });

      if (caretakerError) return caretakerError.message;
    }

    return undefined;
  };

  const loadUsersFromSupabase = async () => {
    if (!isSupabaseConfigured || !supabase) return;
    setLoadingUsers(true);
    const [{ data, error }, linksRes] = await Promise.all([
      supabase.from('users').select('*').order('created_at', { ascending: true }),
      supabase.from('caretaker_patients').select('*'),
    ]);

    if (!error && data) setUsers(data.map(mapUserRow));
    if (!linksRes.error && linksRes.data) {
      setCaretakerLinks(
        linksRes.data.map((item: any) => ({
          caretakerId: item.caretaker_id,
          patientId: item.patient_id,
        })),
      );
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    const bootstrap = async () => {
      await loadUsersFromSupabase();

      if (!isSupabaseConfigured || !supabase) return;

      const { data } = await supabase.auth.getUser();
      const authUser = data.user;
      if (!authUser) return;

      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();
      if (profile) {
        persistUserSession(mapUserRow(profile));
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    localStorage.setItem('mediguard_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    const activeMode = user?.uiMode || 'younger';
    document.documentElement.setAttribute('data-ui-mode', activeMode);
  }, [user]);

  const persistUsers = async (nextUsers: User[]) => {
    setUsers(nextUsers);
    localStorage.setItem('mediguard_users', JSON.stringify(nextUsers));

    if (!isSupabaseConfigured || !supabase) return;

    const payload = nextUsers.map(entry => buildUserRowPayload(entry, '__supabase_auth__'));
    const { error } = await supabase.from('users').upsert(payload, { onConflict: 'id' });
    if (error) {
      throw new Error(`Unable to persist users in Supabase: ${error.message}`);
    }
  };

  const persistUserSession = (userData: User) => {
    setUser(userData);
    localStorage.setItem('mediguard_user', JSON.stringify(userData));
    localStorage.setItem('mediguard_token', 'demo-jwt-token');
  };

  const register = async (input: RegisterInput) => {
    const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
    const authEmail = buildAuthEmailFromPhone(normalizedPhoneNumber);

    if (!input.name.trim() || !normalizedPhoneNumber || !input.password.trim()) {
      return { ok: false, error: 'Please fill all required fields.' };
    }

    if (!/^\+\d{10,15}$/.test(normalizedPhoneNumber)) {
      return { ok: false, error: 'Please enter a valid mobile number with country code.' };
    }

    if (
      users.some(existing => {
        const existingPhone = normalizePhoneNumber(existing.phoneNumber || extractPhoneNumberFromAuthEmail(existing.email) || '');
        return existingPhone === normalizedPhoneNumber || existing.email.toLowerCase() === authEmail;
      })
    ) {
      return { ok: false, error: 'Mobile number already registered.' };
    }

    if (input.role === 'caretaker' && input.linkedPatientId?.trim()) {
      const linkedPatient = users.find(existing => existing.id === input.linkedPatientId && existing.role === 'patient');
      if (!linkedPatient) return { ok: false, error: 'Invalid Patient ID. Please verify and try again.' };
    }

    const profileMode = input.uiMode || inferUiMode(input.age, input.dateOfBirth);
    const normalizedGender = input.gender?.trim();
    const normalizedGenderOther = input.genderOther?.trim();
    const normalizedBloodGroup = input.bloodGroup?.trim();

    if (input.role === 'patient' && !normalizedGender) {
      return { ok: false, error: 'Please select your gender.' };
    }

    const normalizedChronicDiseases = normalizeStringArray(input.chronicDiseases) || ['None'];
    const normalizedInfectionHistory = normalizeStringArray(input.infectionHistory) || ['None'];
    const normalizedAllergies = normalizeAllergies(input.allergies) || [];
    const normalizedEmergencyContactEmail = input.emergencyContactEmail?.trim() || undefined;

    const resolvedAge =
      typeof input.age === 'number' ? input.age : inferAgeFromDob(input.dateOfBirth);
    const resolvedIllness =
      input.illness?.trim() || normalizedChronicDiseases.find(item => item !== 'None') || undefined;

    if (isSupabaseConfigured && supabase) {
      const newUser: User = {
        id: crypto.randomUUID(),
        patientId: input.role === 'patient' ? generatePatientId() : undefined,
        caretakerId: input.role === 'caretaker' ? generateCaretakerId() : undefined,
        name: input.name.trim(),
        email: authEmail,
        phoneNumber: normalizedPhoneNumber,
        password: input.password,
        role: input.role,
        relation: input.role === 'caretaker' ? input.relation : undefined,
        relationOther: input.role === 'caretaker' && input.relation === 'Other' ? input.relationOther : undefined,
        gender: input.role === 'patient' ? normalizedGender : undefined,
        genderOther: input.role === 'patient' && normalizedGender === 'Other' ? normalizedGenderOther : undefined,
        bloodGroup: input.role === 'patient' ? normalizedBloodGroup || undefined : undefined,
        age: resolvedAge,
        illness: resolvedIllness,
        dateOfBirth: input.dateOfBirth,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        chronicDiseases: normalizedChronicDiseases,
        infectionHistory: normalizedInfectionHistory,
        allergies: normalizedAllergies,
        emergencyContactEmail: input.role === 'patient' ? normalizedEmergencyContactEmail : undefined,
        uiMode: profileMode,
        linkedPatientId: input.role === 'caretaker' ? input.linkedPatientId?.trim() : undefined,
      };

      const nextUsers = [...users.filter(existing => existing.id !== newUser.id), newUser];
      setUsers(nextUsers);
      localStorage.setItem('mediguard_users', JSON.stringify(nextUsers));

      const profileSaveError = await upsertUserRow(newUser, input.password);
      if (profileSaveError) {
        return {
          ok: false,
          error:
            `Signup succeeded but profile save failed: ${profileSaveError}. ` +
            'Please run supabase/schema.sql in your Supabase SQL editor and retry.',
        };
      }

      if (newUser.role === 'caretaker' && newUser.linkedPatientId) {
        const nextLinks = [...caretakerLinks, { caretakerId: newUser.id, patientId: newUser.linkedPatientId }];
        setCaretakerLinks(nextLinks);
        await supabase.from('caretaker_patients').upsert(
          {
            caretaker_id: newUser.id,
            patient_id: newUser.linkedPatientId,
          },
          { onConflict: 'caretaker_id,patient_id' },
        );
      }

      persistUserSession(newUser);
      return { ok: true, user: newUser };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      patientId: input.role === 'patient' ? generatePatientId() : undefined,
      caretakerId: input.role === 'caretaker' ? generateCaretakerId() : undefined,
      name: input.name.trim(),
      email: authEmail,
      phoneNumber: normalizedPhoneNumber,
      password: input.password,
      role: input.role,
      relation: input.role === 'caretaker' ? input.relation : undefined,
      relationOther: input.role === 'caretaker' && input.relation === 'Other' ? input.relationOther : undefined,
      gender: input.role === 'patient' ? normalizedGender : undefined,
      genderOther: input.role === 'patient' && normalizedGender === 'Other' ? normalizedGenderOther : undefined,
      bloodGroup: input.role === 'patient' ? normalizedBloodGroup || undefined : undefined,
      age: resolvedAge,
      illness: resolvedIllness,
      dateOfBirth: input.dateOfBirth,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      chronicDiseases: normalizedChronicDiseases,
      infectionHistory: normalizedInfectionHistory,
      allergies: normalizedAllergies,
      emergencyContactEmail: input.role === 'patient' ? normalizedEmergencyContactEmail : undefined,
      uiMode: profileMode,
      linkedPatientId: input.role === 'caretaker' ? input.linkedPatientId?.trim() : undefined,
    };
    const nextUsers = [...users, newUser];
    await persistUsers(nextUsers);

    if (newUser.role === 'caretaker' && newUser.linkedPatientId) {
      const nextLinks = [...caretakerLinks, { caretakerId: newUser.id, patientId: newUser.linkedPatientId }];
      setCaretakerLinks(nextLinks);
      if (isSupabaseConfigured && supabase) {
        await supabase.from('caretaker_patients').upsert(
          {
            caretaker_id: newUser.id,
            patient_id: newUser.linkedPatientId,
          },
          { onConflict: 'caretaker_id,patient_id' },
        );
      }
    }

    persistUserSession(newUser);
    return { ok: true, user: newUser };
  };

  const createPatientForCaretaker = async (caretakerId: string, input: CreatePatientInput) => {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (!input.name.trim() || !normalizedEmail || !input.password.trim()) {
      return { ok: false, error: 'Please fill patient name, email, and password.' };
    }
    if (users.some(existing => existing.email.toLowerCase() === normalizedEmail)) {
      return { ok: false, error: 'A user with this email already exists.' };
    }

    const newPatient: User = {
      id: crypto.randomUUID(),
      patientId: generatePatientId(),
      name: input.name.trim(),
      email: normalizedEmail,
      password: input.password,
      role: 'patient',
      age: input.age,
      illness: input.illness?.trim(),
      uiMode: input.uiMode || inferUiMode(input.age),
      chronicDiseases: input.illness?.trim() ? [input.illness.trim()] : ['None'],
      infectionHistory: ['None'],
      allergies: [],
    };

    const nextUsers = [...users, newPatient];
    await persistUsers(nextUsers);

    const nextLinks = [...caretakerLinks, { caretakerId, patientId: newPatient.id }];
    setCaretakerLinks(nextLinks);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('caretaker_patients').upsert(
        {
          caretaker_id: caretakerId,
          patient_id: newPatient.id,
        },
        { onConflict: 'caretaker_id,patient_id' },
      );
    }

    return { ok: true, user: newPatient };
  };

  const login = async (input: LoginInput) => {
    const normalizedPhoneNumber = normalizePhoneNumber(input.phoneNumber);
    const authEmail = buildAuthEmailFromPhone(normalizedPhoneNumber);

    if (!/^\+\d{10,15}$/.test(normalizedPhoneNumber)) {
      return { ok: false, error: 'Please enter a valid mobile number with country code.' };
    }

    if (isSupabaseConfigured && supabase) {
      const { data: profile, error } = await supabase.from('users').select('*').eq('email', authEmail).maybeSingle();

      if (error) {
        return { ok: false, error: error.message || 'Unable to log in. Please try again.' };
      }

      if (!profile || profile.password !== input.password) {
        return { ok: false, error: 'Mobile number is not registered or password is incorrect.' };
      }

      const userProfile = mapUserRow(profile);

      persistUserSession(userProfile);
      await loadUsersFromSupabase();
      return { ok: true, user: userProfile };
    }

    const matched = users.find(
      existing =>
        (normalizePhoneNumber(existing.phoneNumber || extractPhoneNumberFromAuthEmail(existing.email) || '') ===
          normalizedPhoneNumber ||
          existing.email.toLowerCase() === authEmail) &&
        existing.password === input.password,
    );

    if (!matched) {
      return { ok: false, error: 'Mobile number is not registered or password is incorrect.' };
    }

    persistUserSession(matched);
    return { ok: true, user: matched };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('mediguard_user');
    localStorage.removeItem('mediguard_token');

    if (isSupabaseConfigured && supabase) {
      void supabase.auth.signOut();
    }
  };

  const regeneratePatientId = async (userId: string) => {
    const newPatientId = generatePatientId();

    setUsers(prev =>
      prev.map(u => (u.id === userId ? { ...u, patientId: newPatientId } : u)),
    );

    if (user?.id === userId) {
      persistUserSession({ ...user, patientId: newPatientId });
    }

    // Disconnect old linked caretakers
    setCaretakerLinks(prev => prev.filter(link => link.patientId !== userId));

    if (isSupabaseConfigured && supabase) {
      await supabase.from('caretaker_patients').delete().eq('patient_id', userId);
      const userToUpdate = users.find(u => u.id === userId);
      if (userToUpdate) {
        await upsertUserRow({ ...userToUpdate, patientId: newPatientId }, '__supabase_auth__');
      }
    }
    
    return newPatientId;
  };

  const getPatientById = (id?: string) => {
    if (!id) return undefined;
    return users.find(existing => existing.id === id && existing.role === 'patient');
  };

  const linkExistingPatient = async (caretakerId: string, patientMgpId: string) => {
    const mgpId = patientMgpId.trim().toUpperCase();
    if (!mgpId.startsWith('MGP-')) {
      return { ok: false, error: 'Invalid ID. It should start with MGP-' };
    }

    const targetPatient = users.find(existing => existing.patientId === mgpId && existing.role === 'patient');
    if (!targetPatient) {
      return { ok: false, error: 'Patient with this ID not found.' };
    }

    // Check if already linked
    if (caretakerLinks.some(link => link.caretakerId === caretakerId && link.patientId === targetPatient.id)) {
      return { ok: false, error: 'Patient is already linked to your account.' };
    }

    const nextLinks = [...caretakerLinks, { caretakerId, patientId: targetPatient.id }];
    setCaretakerLinks(nextLinks);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('caretaker_patients').upsert(
        {
          caretaker_id: caretakerId,
          patient_id: targetPatient.id,
        },
        { onConflict: 'caretaker_id,patient_id' },
      );
    }

    return { ok: true, patient: targetPatient };
  };

  const getLinkedPatients = (caretakerId?: string) => {
    if (!caretakerId) return [];
    const linkedIds = caretakerLinks
      .filter(link => link.caretakerId === caretakerId)
      .map(link => link.patientId);

    if (linkedIds.length === 0) {
      const caretaker = users.find(existing => existing.id === caretakerId);
      if (caretaker?.linkedPatientId) {
        return users.filter(existing => existing.id === caretaker.linkedPatientId && existing.role === 'patient');
      }
      return [];
    }

    return users.filter(existing => linkedIds.includes(existing.id) && existing.role === 'patient');
  };

  const value = useMemo(
    () => ({
      user,
      users,
      loadingUsers,
      isAuthenticated: !!user,
      register,
      createPatientForCaretaker,
      login,
      logout,
      getPatientById,
      linkExistingPatient,
      getLinkedPatients,
      regeneratePatientId,
    }),
    [user, users, loadingUsers, caretakerLinks],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
