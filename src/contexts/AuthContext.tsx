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
  name: string;
  email: string;
  password?: string;
  role: UserRole;
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
  email: string;
  password: string;
  role: UserRole;
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
  email: string;
  password: string;
  role?: UserRole;
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
  getLinkedPatients: (caretakerId?: string) => User[];
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<User[]>(() => {
    const stored = localStorage.getItem('mediguard_users');
    if (stored) return JSON.parse(stored);

    const seedPatient: User = {
      id: crypto.randomUUID(),
      name: 'Demo Patient',
      email: 'patient@mediguard.demo',
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
      name: row.name,
      email: row.email,
      password: row.password || undefined,
      role: row.role,
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
    age: entry.age ?? null,
    illness: entry.illness ?? null,
    date_of_birth: entry.dateOfBirth ?? null,
    height_cm: entry.heightCm ?? null,
    weight_kg: entry.weightKg ?? null,
    chronic_diseases: entry.chronicDiseases ?? null,
    infection_history: entry.infectionHistory ?? null,
    allergies: entry.allergies ?? null,
    emergency_contact_email: entry.emergencyContactEmail ?? null,
    ui_mode: entry.uiMode,
    linked_patient_id: entry.linkedPatientId ?? null,
    profile_json: {
      dateOfBirth: entry.dateOfBirth ?? null,
      heightCm: entry.heightCm ?? null,
      weightKg: entry.weightKg ?? null,
      chronicDiseases: entry.chronicDiseases ?? [],
      infectionHistory: entry.infectionHistory ?? [],
      allergies: entry.allergies ?? [],
      emergencyContactEmail: entry.emergencyContactEmail ?? null,
    },
  });

  const upsertUserRow = async (entry: User, passwordFallback?: string) => {
    if (!isSupabaseConfigured || !supabase) return undefined;

    const { error } = await supabase
      .from('users')
      .upsert(buildUserRowPayload(entry, passwordFallback), { onConflict: 'id' });

    return error?.message;
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
    const normalizedEmail = input.email.trim().toLowerCase();
    if (!input.name.trim() || !normalizedEmail || !input.password.trim()) {
      return { ok: false, error: 'Please fill all required fields.' };
    }

    if (users.some(existing => existing.email.toLowerCase() === normalizedEmail)) {
      return { ok: false, error: 'Email already registered.' };
    }

    if (input.role === 'caretaker' && input.linkedPatientId?.trim()) {
      const linkedPatient = users.find(existing => existing.id === input.linkedPatientId && existing.role === 'patient');
      if (!linkedPatient) return { ok: false, error: 'Invalid Patient ID. Please verify and try again.' };
    }

    const profileMode = input.uiMode || inferUiMode(input.age, input.dateOfBirth);
    const normalizedChronicDiseases = normalizeStringArray(input.chronicDiseases) || ['None'];
    const normalizedInfectionHistory = normalizeStringArray(input.infectionHistory) || ['None'];
    const normalizedAllergies = normalizeAllergies(input.allergies) || [];
    const normalizedEmergencyContactEmail = input.emergencyContactEmail?.trim() || undefined;

    const resolvedAge =
      typeof input.age === 'number' ? input.age : inferAgeFromDob(input.dateOfBirth);
    const resolvedIllness =
      input.illness?.trim() || normalizedChronicDiseases.find(item => item !== 'None') || undefined;

    if (isSupabaseConfigured && supabase) {
      const signupRes = await supabase.auth.signUp({
        email: normalizedEmail,
        password: input.password,
      });

      if (signupRes.error || !signupRes.data.user) {
        return { ok: false, error: signupRes.error?.message || 'Unable to create account.' };
      }

      const authUser = signupRes.data.user;
      const newUser: User = {
        id: authUser.id,
        name: input.name.trim(),
        email: normalizedEmail,
        role: input.role,
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

      const profileSaveError = await upsertUserRow(newUser, '__supabase_auth__');
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

      if (!signupRes.data.session) {
        return {
          ok: true,
          user: newUser,
          needsEmailVerification: true,
        };
      }

      persistUserSession(newUser);
      return { ok: true, user: newUser };
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      email: normalizedEmail,
      password: input.password,
      role: input.role,
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
    const normalizedEmail = input.email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const signInRes = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password: input.password,
      });

      if (signInRes.error || !signInRes.data.user) {
        return { ok: false, error: signInRes.error?.message || 'Invalid credentials.' };
      }

      const authUser = signInRes.data.user;
      const { data: profile } = await supabase.from('users').select('*').eq('id', authUser.id).maybeSingle();

      const userProfile: User = profile
        ? mapUserRow(profile)
        : {
            id: authUser.id,
            name: (authUser.user_metadata?.name as string | undefined) || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            role: ((authUser.user_metadata?.role as UserRole | undefined) || 'patient'),
            age: typeof authUser.user_metadata?.age === 'number' ? authUser.user_metadata.age : undefined,
            illness: authUser.user_metadata?.illness as string | undefined,
            dateOfBirth: authUser.user_metadata?.date_of_birth as string | undefined,
            heightCm: authUser.user_metadata?.height_cm as number | undefined,
            weightKg: authUser.user_metadata?.weight_kg as number | undefined,
            chronicDiseases: normalizeStringArray(authUser.user_metadata?.chronic_diseases),
            infectionHistory: normalizeStringArray(authUser.user_metadata?.infection_history),
            allergies: normalizeAllergies(authUser.user_metadata?.allergies),
            emergencyContactEmail: authUser.user_metadata?.emergency_contact_email as string | undefined,
            uiMode: ((authUser.user_metadata?.ui_mode as UiMode | undefined) || 'younger'),
          };

      if (!profile) {
        const profileSaveError = await upsertUserRow(userProfile, '__supabase_auth__');
        if (profileSaveError) {
          return {
            ok: false,
            error:
              `Logged in but profile sync failed: ${profileSaveError}. ` +
              'Please run supabase/schema.sql in your Supabase SQL editor and retry.',
          };
        }
      }

      if (input.role && input.role !== userProfile.role) {
        await supabase.auth.signOut();
        return {
          ok: false,
          error: `Role mismatch. This account is registered as ${userProfile.role}.`,
        };
      }

      persistUserSession(userProfile);
      await loadUsersFromSupabase();
      return { ok: true, user: userProfile };
    }

    const matched = users.find(
      existing =>
        existing.email.toLowerCase() === normalizedEmail &&
        existing.password === input.password &&
        (!input.role || existing.role === input.role),
    );

    if (!matched) {
      return { ok: false, error: 'Invalid credentials or role selection.' };
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

  const getPatientById = (id?: string) => {
    if (!id) return undefined;
    return users.find(existing => existing.id === id && existing.role === 'patient');
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
      getLinkedPatients,
    }),
    [user, users, loadingUsers, caretakerLinks],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
