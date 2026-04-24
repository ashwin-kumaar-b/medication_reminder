import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Loader2,
  Minus,
  Moon,
  Pill,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Sunset,
} from 'lucide-react';
import { useMedicines } from '@/contexts/MedicineContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { resolveIndianBrandToGeneric } from '@/lib/localMedicineData';
import { searchRxNavSuggestions } from '@/lib/medicationApis';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const categoryOptions = [
  { value: 'blood-pressure', label: 'Blood Pressure', description: 'Supports blood pressure regulation medicines.' },
  { value: 'diabetes', label: 'Diabetes', description: 'For insulin and glucose-control medications.' },
  { value: 'thyroid', label: 'Thyroid', description: 'Medicines for thyroid hormone balance.' },
  { value: 'antibiotic', label: 'Antibiotic', description: 'Anti-infection medicines and short courses.' },
  { value: 'blood-thinner', label: 'Blood Thinner', description: 'Anticoagulants that need strict adherence.' },
  { value: 'other', label: 'Other', description: 'Medicines not covered by above categories.' },
] as const;

const criticalityOptions = [
  {
    value: 'low',
    label: 'Low',
    description: 'Missing one dose usually has low immediate impact.',
    icon: ShieldCheck,
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Missing doses can affect treatment consistency.',
    icon: AlertTriangle,
  },
  {
    value: 'high',
    label: 'High',
    description: 'Missing this dose has serious health impact.',
    icon: ShieldAlert,
  },
] as const;

const dosageUnitOptions = [
  { value: 'pill', label: 'Pills' },
  { value: 'mg', label: 'mg' },
  { value: 'ml', label: 'ml' },
] as const;

const dosageStepMap = {
  pill: 0.5,
  mg: 50,
  ml: 1,
} as const;

const foodTimingOptions = [
  { value: 'before-food', label: 'Before Food' },
  { value: 'after-food', label: 'After Food' },
] as const;

const commonConditionSuggestions = [
  'Hypertension',
  'Diabetes',
  'Thyroid',
  'Cardiac Care',
  'Asthma',
  'Pain Management',
  'Infection',
  'Cholesterol',
];

const dayOptions = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
] as const;

const slotOptions = [
  {
    id: 'morning',
    title: 'Morning',
    range: '6:00 AM - 12:00 PM',
    time: '08:00',
    icon: Sun,
  },
  {
    id: 'afternoon',
    title: 'Afternoon',
    range: '12:00 PM - 6:00 PM',
    time: '14:00',
    icon: Clock3,
  },
  {
    id: 'evening',
    title: 'Evening',
    range: '6:00 PM - 10:00 PM',
    time: '20:00',
    icon: Sunset,
  },
  {
    id: 'night',
    title: 'Night',
    range: '10:00 PM - 12:00 AM',
    time: '22:30',
    icon: Moon,
  },
] as const;

type DosageUnit = (typeof dosageUnitOptions)[number]['value'];
type WizardStep = 1 | 2 | 3;

const AddMedicine = () => {
  const { addMedication } = useMedicines();
  const { user, getLinkedPatients } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkedPatients = useMemo(() => getLinkedPatients(user?.id), [getLinkedPatients, user?.id]);
  const requestedPatient = searchParams.get('patientId');
  const matchedLinkedPatient = linkedPatients.find(
    patient => patient.id === requestedPatient || patient.patientId === requestedPatient,
  );
  const defaultPatientId =
    user?.role === 'patient'
      ? user.id
      : matchedLinkedPatient?.id || (linkedPatients.length > 0 ? linkedPatients[0].id : null);

  const [step, setStep] = useState<WizardStep>(1);
  const [formPatientId, setFormPatientId] = useState<string | null>(defaultPatientId);

  useEffect(() => {
    if (!formPatientId && defaultPatientId) {
      setFormPatientId(defaultPatientId);
    }
  }, [defaultPatientId, formPatientId]);

  const [loading, setLoading] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ name: string; rxcui: string; type?: 'brand' | 'generic' }>>([]);
  const [resolvedGenericPreview, setResolvedGenericPreview] = useState('');
  const [conditionInput, setConditionInput] = useState('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [selectedDays, setSelectedDays] = useState<string[]>(dayOptions.map(day => day.key));
  const [selectedSlots, setSelectedSlots] = useState<string[]>(['morning']);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [nameError, setNameError] = useState('');
  const [successState, setSuccessState] = useState<{ open: boolean; nextDose: string }>({ open: false, nextDose: '' });

  const drugInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    name: '',
    dosageAmount: '1',
    dosageUnit: 'pill' as DosageUnit,
    photoUrl: '',
    foodTiming: 'before-food' as 'before-food' | 'after-food',
    category: 'other' as 'blood-pressure' | 'diabetes' | 'thyroid' | 'antibiotic' | 'blood-thinner' | 'other',
    criticality: 'medium' as 'low' | 'medium' | 'high',
  });

  const categoryDescription = useMemo(
    () => categoryOptions.find(option => option.value === form.category)?.description || '',
    [form.category],
  );

  const selectedSlotDetails = useMemo(
    () => slotOptions.filter(slot => selectedSlots.includes(slot.id)),
    [selectedSlots],
  );

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

  useEffect(() => {
    const query = form.name.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setResolvedGenericPreview('');
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSuggesting(true);
        const resolved = await resolveIndianBrandToGeneric(query, { enableFuzzy: false });
        const effectiveQuery = resolved.genericName || query;
        const found = await searchRxNavSuggestions(effectiveQuery);
        setSuggestions(found);
        setResolvedGenericPreview(
          resolved.matchType !== 'passthrough' && resolved.genericName.toLowerCase() !== query.toLowerCase()
            ? resolved.genericName
            : '',
        );
      } catch {
        setSuggestions([]);
        setResolvedGenericPreview('');
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

  const shakeDrugNameField = () => {
    if (!drugInputRef.current) return;
    drugInputRef.current.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-8px)' },
        { transform: 'translateX(8px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(5px)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 280, easing: 'ease-in-out' },
    );
  };

  const addCondition = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;

    if (conditions.some(item => item.toLowerCase() === normalized.toLowerCase())) {
      setConditionInput('');
      return;
    }

    setConditions(prev => [...prev, normalized]);
    setConditionInput('');
  };

  const toggleDay = (key: string) => {
    if (selectedDays.includes(key)) {
      setSelectedDays(selectedDays.filter(item => item !== key));
      return;
    }
    setSelectedDays([...selectedDays, key]);
  };

  const selectDayPreset = (preset: 'everyday' | 'weekdays' | 'weekends') => {
    if (preset === 'everyday') {
      setSelectedDays(dayOptions.map(day => day.key));
      return;
    }

    if (preset === 'weekdays') {
      setSelectedDays(['mon', 'tue', 'wed', 'thu', 'fri']);
      return;
    }

    setSelectedDays(['sat', 'sun']);
  };

  const toggleSlot = (slotId: string) => {
    if (selectedSlots.includes(slotId)) {
      setSelectedSlots(selectedSlots.filter(item => item !== slotId));
      return;
    }

    setSelectedSlots([...selectedSlots, slotId]);
  };

  const goToNextStep = () => {
    if (step === 1) {
      if (!form.name.trim()) {
        setNameError('Please enter a drug name');
        shakeDrugNameField();
        return;
      }

      setNameError('');
      const dosage = formatDosage(form.dosageAmount, form.dosageUnit);
      if (!dosage) {
        toast({
          title: 'Invalid dosage',
          description: 'Please set a valid dosage amount to continue.',
          variant: 'destructive',
        });
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (selectedDays.length === 0) {
        toast({
          title: 'Select schedule days',
          description: 'Pick at least one day from the week grid.',
          variant: 'destructive',
        });
        return;
      }

      if (selectedSlots.length === 0) {
        toast({
          title: 'Select time slots',
          description: 'Pick at least one preferred time slot.',
          variant: 'destructive',
        });
        return;
      }

      setStep(3);
    }
  };

  const deriveFrequency = (): 'daily' | 'twice' | 'weekly' => {
    if (selectedDays.length === 7 && selectedSlots.length >= 2) return 'twice';
    if (selectedDays.length === 7) return 'daily';
    return 'weekly';
  };

  const getNextDoseTimeLabel = () => {
    const now = new Date();

    const nextCandidates = selectedSlotDetails.map(slot => {
      const [h, m] = slot.time.split(':').map(Number);
      const candidate = new Date();
      candidate.setHours(h, m, 0, 0);
      if (candidate <= now) {
        candidate.setDate(candidate.getDate() + 1);
      }
      return candidate;
    });

    nextCandidates.sort((a, b) => a.getTime() - b.getTime());
    const next = nextCandidates[0];
    if (!next) return '--:--';

    return next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const submitMedication = async () => {
    if (!user) return;

    if (!formPatientId) {
      toast({
        title: 'No linked patient',
        description: 'Caretaker accounts need at least one linked patient before adding medications.',
        variant: 'destructive',
      });
      return;
    }

    const dosage = formatDosage(form.dosageAmount, form.dosageUnit);
    if (!dosage) {
      toast({ title: 'Invalid dosage', description: 'Enter a valid dosage amount greater than 0.', variant: 'destructive' });
      return;
    }

    if (selectedSlotDetails.length === 0) {
      toast({ title: 'No time slot selected', description: 'Please select at least one time slot.', variant: 'destructive' });
      return;
    }

    const displayName = form.name.trim();
    const resolved = await resolveIndianBrandToGeneric(displayName, { enableFuzzy: true });
    const genericName = resolved.genericName || displayName;

    setLoading(true);

    const frequency = deriveFrequency();
    const addPromises = selectedSlotDetails.map(slot =>
      addMedication({
        patientId: formPatientId,
        drugName: genericName,
        displayName,
        genericName,
        dosage,
        photoUrl: form.photoUrl || undefined,
        foodTiming: form.foodTiming,
        category: form.category,
        criticality: form.criticality,
        scheduleTime: slot.time,
        frequency,
      }),
    );

    const created = await Promise.all(addPromises);
    if (created.some(item => !item)) {
      toast({ title: 'Unable to add medicine', description: 'Please check your access scope and try again.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    if (resolved.matchType !== 'passthrough' && resolved.matchedBrand) {
      toast({
        title: 'Brand resolved',
        description: `${resolved.matchedBrand} mapped to generic: ${genericName}`,
      });
    }

    const nextDose = getNextDoseTimeLabel();
    setSuccessState({ open: true, nextDose });
    setLoading(false);

    window.setTimeout(() => {
      navigate('/medicines');
    }, 1400);
  };

  const handleWizardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      goToNextStep();
      return;
    }

    await submitMedication();
  };

  const progressPercent = (step / 3) * 100;

  return (
    <>
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Link to={user?.role === 'caretaker' ? '/caretaker' : '/dashboard'} className="mb-4 inline-flex min-h-12 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to {user?.role === 'caretaker' ? 'Portal' : 'Dashboard'}
        </Link>

        <div className="animate-fade-in rounded-xl border border-border bg-card p-6 shadow-elevated">
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-lg gradient-primary p-2.5">
                  <Pill className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Add Medicine</h1>
                  <p className="text-sm text-muted-foreground">Smarter 3-step guided setup</p>
                </div>
              </div>
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                Step {step} of 3
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <form onSubmit={handleWizardSubmit} className="space-y-5">
            {step === 1 && (
              <div className="space-y-5">
              
                {user?.role === 'caretaker' && (
                  <div className="mb-4">
                    <label className="mb-1.5 block text-sm font-medium text-foreground">Select Patient</label>
                    <Select value={formPatientId || ''} onValueChange={(val) => setFormPatientId(val)}>
                      <SelectTrigger className="min-h-[48px] w-full rounded-xl text-sm font-medium">
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
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pt-2 text-sm font-semibold text-muted-foreground">
                    <span>Medicine details</span>
                    <hr className="flex-1 border-border" />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Drug Name (RxNav)</label>
                  <div className="relative">
                    <input
                      ref={drugInputRef}
                      value={form.name}
                      onChange={e => {
                        setForm(prev => ({ ...prev, name: e.target.value }));
                        if (nameError) setNameError('');
                      }}
                      className={`min-h-12 w-full rounded-lg border bg-background px-3 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/20 ${
                        nameError ? 'border-red-500 ring-1 ring-red-500/30' : 'border-input'
                      }`}
                      placeholder="Search by brand or generic name"
                    />
                    {suggesting && <span className="absolute right-3 top-3 text-xs text-muted-foreground">Searching...</span>}
                  </div>
                  {resolvedGenericPreview && <p className="mt-1 text-xs text-primary">Resolved generic: {resolvedGenericPreview}</p>}
                  {nameError && <p className="mt-1 text-xs font-semibold text-red-600">{nameError}</p>}

                  {suggestions.length > 0 && (
                    <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-border bg-card/95 p-1 shadow-elevated backdrop-blur-sm">
                      {suggestions.map(option => (
                        <button
                          key={`${option.rxcui}-${option.name}`}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, name: option.name }));
                            setNameError('');
                            setSuggestions([]);
                          }}
                          className="mb-1 block min-h-12 w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors last:mb-0 hover:border-border hover:bg-muted/70"
                        >
                          <p className="truncate text-sm font-semibold text-foreground">{option.name}</p>
                          <p className="text-xs text-muted-foreground">{option.type === 'brand' ? 'Brand name match' : 'Generic name match'}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Dosage</label>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="flex items-center gap-2 rounded-xl border border-input bg-background p-2">
                      <button
                        type="button"
                        onClick={() => {
                          const current = Number(form.dosageAmount || 0);
                          const stepAmount = dosageStepMap[form.dosageUnit];
                          const next = Math.max(stepAmount, current - stepAmount);
                          setForm(prev => ({ ...prev, dosageAmount: `${next}` }));
                        }}
                        className="flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                        aria-label="Decrease dosage"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <input
                        value={form.dosageAmount}
                        onChange={e => setForm(prev => ({ ...prev, dosageAmount: e.target.value }))}
                        className="min-h-12 w-full rounded-lg border border-input bg-card px-3 text-center text-base font-semibold text-foreground focus:border-primary focus:outline-none"
                        inputMode="decimal"
                        placeholder="1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const current = Number(form.dosageAmount || 0);
                          const stepAmount = dosageStepMap[form.dosageUnit];
                          const next = current > 0 ? current + stepAmount : stepAmount;
                          setForm(prev => ({ ...prev, dosageAmount: `${next}` }));
                        }}
                        className="flex min-h-12 min-w-12 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted"
                        aria-label="Increase dosage"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1 rounded-xl border border-input bg-background p-1.5">
                      {dosageUnitOptions.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, dosageUnit: option.value }))}
                          className={`min-h-12 rounded-lg px-3 text-sm font-semibold transition-colors ${
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
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">What condition is this for?</label>
                  <div className="flex gap-2">
                    <input
                      value={conditionInput}
                      onChange={e => setConditionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addCondition(conditionInput);
                        }
                      }}
                      className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                      placeholder="Type a condition and press Enter"
                    />
                    <button
                      type="button"
                      onClick={() => addCondition(conditionInput)}
                      className="min-h-12 rounded-lg border border-primary px-4 text-sm font-semibold text-primary hover:bg-accent"
                    >
                      Add
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {commonConditionSuggestions.map(condition => (
                      <button
                        key={condition}
                        type="button"
                        onClick={() => addCondition(condition)}
                        className="min-h-12 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground hover:bg-muted"
                      >
                        {condition}
                      </button>
                    ))}
                  </div>

                  {conditions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {conditions.map(condition => (
                        <button
                          key={condition}
                          type="button"
                          onClick={() => setConditions(prev => prev.filter(item => item !== condition))}
                          className="min-h-12 rounded-full border border-primary bg-accent px-4 text-sm font-semibold text-accent-foreground"
                        >
                          {condition} x
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Schedule Days</label>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => selectDayPreset('everyday')} className="min-h-12 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">
                      Every day
                    </button>
                    <button type="button" onClick={() => selectDayPreset('weekdays')} className="min-h-12 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">
                      Weekdays only
                    </button>
                    <button type="button" onClick={() => selectDayPreset('weekends')} className="min-h-12 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">
                      Weekends
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                    {dayOptions.map(day => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => toggleDay(day.key)}
                        className={`min-h-12 rounded-lg border text-sm font-semibold transition-colors ${
                          selectedDays.includes(day.key)
                            ? 'border-primary bg-accent text-accent-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">Preferred Time Slots</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {slotOptions.map(slot => {
                      const Icon = slot.icon;
                      const active = selectedSlots.includes(slot.id);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => toggleSlot(slot.id)}
                          className={`min-h-12 rounded-xl border p-3 text-left transition-colors ${
                            active
                              ? 'border-primary bg-accent text-accent-foreground'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold">{slot.title}</span>
                          </div>
                          <p className="text-xs">{slot.range}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Food Timing</label>
                  <div className="grid grid-cols-2 gap-2">
                    {foodTimingOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, foodTiming: option.value }))}
                        className={`min-h-12 rounded-xl border px-4 text-base font-semibold transition-colors ${
                          form.foodTiming === option.value
                            ? 'border-primary bg-accent text-accent-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Medication Category</label>
                  <Select
                    value={form.category}
                    onValueChange={value => setForm(prev => ({ ...prev, category: value as typeof form.category }))}
                  >
                    <SelectTrigger className="min-h-12 w-full rounded-lg">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-elevated">
                      {categoryOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">{categoryDescription}</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Criticality Level</label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {criticalityOptions.map(option => {
                      const Icon = option.icon;
                      const active = form.criticality === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, criticality: option.value }))}
                          className={`min-h-12 rounded-xl border p-3 text-left transition-colors ${
                            active
                              ? 'border-primary bg-accent text-accent-foreground'
                              : 'border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm font-semibold">{option.label}</span>
                          </div>
                          <p className="text-xs">{option.description}</p>
                        </button>
                      );
                    })}
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
                    className="min-h-12 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-2 file:text-sm file:font-medium"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Optional. JPG/PNG/WebP up to 2 MB.</p>
                  {photoPreview && (
                    <div className="mt-2">
                      <img src={photoPreview} alt="Medication preview" className="h-20 w-20 rounded-lg border border-border object-cover" />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Review Summary</h3>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p><span className="font-medium text-foreground">Drug:</span> {form.name || 'Not set'}</p>
                    <p><span className="font-medium text-foreground">Dose:</span> {formatDosage(form.dosageAmount, form.dosageUnit) || 'Not set'}</p>
                    <p><span className="font-medium text-foreground">Conditions:</span> {conditions.length > 0 ? conditions.join(', ') : 'Not specified'}</p>
                    <p><span className="font-medium text-foreground">Schedule:</span> {selectedDays.length === 7 ? 'Every day' : selectedDays.map(day => day.toUpperCase()).join(', ')}</p>
                    <p><span className="font-medium text-foreground">Time Slots:</span> {selectedSlotDetails.map(slot => `${slot.title} (${slot.time})`).join(', ') || 'Not set'}</p>
                    <p><span className="font-medium text-foreground">Criticality:</span> {form.criticality}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(prev => (prev > 1 ? ((prev - 1) as WizardStep) : prev))}
                  className="min-h-12 w-full rounded-lg border border-border px-4 text-sm font-semibold text-muted-foreground hover:bg-muted"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="gradient-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === 3 ? (
                  'Add Medicine'
                ) : (
                  'Next'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {successState.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-elevated">
            <CheckCircle2 className="mx-auto mb-3 h-14 w-14 text-emerald-500 animate-pulse" />
            <p className="text-lg font-semibold text-foreground">Medicine added! Your next dose is at {successState.nextDose}.</p>
          </div>
        </div>
      )}
    </>
  );
};

export default AddMedicine;
