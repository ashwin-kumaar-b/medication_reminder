const OPENFDA_API_KEY = import.meta.env.VITE_OPENFDA_API_KEY as string | undefined;
const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY as string | undefined;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const DDINTER_API_URL = import.meta.env.VITE_DDINTER_API_URL as string | undefined;

const ALLOWED_RXNAV_TTYS = new Set(['IN', 'PIN', 'MIN', 'SCD', 'SBD', 'SCDC', 'SBDC']);

export interface DrugSuggestion {
  name: string;
  rxcui: string;
  type?: 'brand' | 'generic';
}

export interface RxNavInteraction {
  severity: 'high' | 'moderate' | 'low';
  description: string;
}

export interface DdinterInteraction {
  severity: 'high' | 'moderate' | 'low';
  description: string;
}

export interface OpenFdaSafety {
  warnings: string[];
  contraindications: string[];
  foodInteractions: string[];
}

export interface UsdaFoodMatch {
  name: string;
  category?: string;
}

export interface GeminiMedicalAdvice {
  severity: 'high' | 'moderate' | 'low' | 'safe' | 'none';
  summary: string;
  explanation: string;
  recommendations: string[];
  cautions: string[];
  source: 'Gemini' | 'Groq';
}

interface GeminiMedicalInput {
  context: 'drug-interaction' | 'food-compatibility' | 'supplement-check' | 'symptom-check' | 'dose-advice';
  drugA?: string;
  drugB?: string;
  medication?: string;
  food?: string;
  supplements?: string[];
  symptoms?: string[];
  evidence?: string[];
}

export interface MissedDoseSeverityInput {
  patientAge?: number;
  condition?: string;
  language?: 'en' | 'es' | 'fr' | 'ta' | 'te' | 'hi';
  missed: Array<{
    drugName: string;
    category: string;
    criticality: string;
    missedCount: number;
    lastMissedDate: string;
  }>;
}

export interface MissedDoseSeverityInsight {
  severity: 'high' | 'moderate' | 'low';
  summary: string;
  guidance: string;
  riskProgression: string;
  missesUntilWorse: number | null;
  source: 'OpenFDA' | 'OpenFDA + Groq';
}

export interface MissedDoseRecoveryInput {
  language?: 'en' | 'es' | 'fr' | 'ta' | 'te' | 'hi';
  nowIso?: string;
  medication: {
    drugName: string;
    dosage: string;
    category: string;
    criticality: string;
    frequency: string;
    foodTiming: 'before-food' | 'after-food' | 'unknown';
    scheduledTime: string;
    missedScheduledAt: string;
    missedCountForMedication: number;
    missedCountRecentWindow: number;
  };
}

export interface MissedDoseRecoveryAdvice {
  action: 'take-full-dose-now' | 'take-half-dose-now' | 'skip-and-resume-next' | 'contact-clinician-now';
  urgency: 'high' | 'moderate' | 'low';
  technicalRationale: string;
  foodTimingInstruction: string;
  monitoringNotes: string[];
  confidence: 'high' | 'medium' | 'low';
  source: 'OpenFDA' | 'OpenFDA + Groq' | 'Schedule Rule' | 'Schedule Rule + Groq';
}

export interface DrugAllergyProfileInput {
  language?: 'en' | 'es' | 'fr' | 'ta' | 'te' | 'hi';
  medicines: string[];
  gender?: string;
  bloodGroup?: string;
  chronicDiseases?: string[];
  infectionHistory?: string[];
  allergies?: Array<{ category: string; trigger?: string }>;
}

export interface DrugAllergyProfileInsight {
  overallRisk: 'high' | 'moderate' | 'low' | 'none';
  summary: string;
  findings: Array<{
    severity: 'high' | 'moderate' | 'low';
    title: string;
    detail: string;
    evidence: string;
  }>;
  recommendations: string[];
  source: 'Groq';
}

export interface FoodNutritionProfileInput {
  language?: 'en' | 'es' | 'fr' | 'ta' | 'te' | 'hi';
  medicines: string[];
  illness?: string[];
  chronicDiseases?: string[];
  infectionHistory?: string[];
  allergies?: string[];
}

export interface FoodNutritionProfileInsight {
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  evidenceBasis: string[];
  foodTypesToPrioritize: Array<{
    type: string;
    reason: string;
    examples: string[];
    confidence: 'high' | 'medium' | 'low';
  }>;
  foodTypesToLimit: Array<{
    type: string;
    reason: string;
    examples: string[];
    confidence: 'high' | 'medium' | 'low';
  }>;
  timingTips: string[];
  source: 'Groq';
}

const clean = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();

const splitCsv = (value?: string) =>
  (value || '')
    .split(',')
    .map(item => clean(item))
    .filter(Boolean);

const normalizeGeminiSeverity = (value?: string): GeminiMedicalAdvice['severity'] => {
  const normalized = (value || '').toLowerCase().trim();
  if (normalized === 'high') return 'high';
  if (normalized === 'moderate') return 'moderate';
  if (normalized === 'low') return 'low';
  if (normalized === 'safe') return 'safe';
  return 'none';
};

const extractGeminiText = (payload: any) => {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map(part => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
};

const extractGroqText = (payload: any) => clean(payload?.choices?.[0]?.message?.content);

const parseGeminiJson = (raw: string) => {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
};

const normalizeSeverity = (value?: string): 'high' | 'moderate' | 'low' => {
  const normalized = (value || '').toLowerCase();
  if (normalized.includes('high') || normalized.includes('major') || normalized.includes('severe')) return 'high';
  if (normalized.includes('moderate') || normalized.includes('medium')) return 'moderate';
  return 'low';
};

const buildEvidenceTokenSet = (evidence: string[]) => {
  const tokens = new Set<string>();
  const joined = evidence.join(' ').toLowerCase();
  const raw = joined.match(/[a-z][a-z0-9-]{3,}/g) || [];
  raw.forEach(token => tokens.add(token));
  return tokens;
};

const isGenericSafetyLine = (text: string) => {
  const lower = text.toLowerCase();
  return (
    lower.includes('consult') ||
    lower.includes('healthcare provider') ||
    lower.includes('pharmacist') ||
    lower.includes('monitor') ||
    lower.includes('seek medical')
  );
};

const hasEvidenceOverlap = (text: string, evidenceTokens: Set<string>) => {
  if (!text) return false;
  if (isGenericSafetyLine(text)) return true;

  const tokens = (text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) || []).filter(token => !['risk', 'dose', 'drug', 'drugs', 'interaction'].includes(token));
  if (tokens.length === 0) return false;

  let matches = 0;
  for (const token of tokens) {
    if (evidenceTokens.has(token)) {
      matches += 1;
      if (matches >= 2) return true;
    }
  }
  return false;
};

const buildDdinterUrl = (drugA: string, drugB: string) => {
  if (!DDINTER_API_URL) return null;
  if (DDINTER_API_URL.includes('{drugA}') || DDINTER_API_URL.includes('{drugB}')) {
    return DDINTER_API_URL
      .replace('{drugA}', encodeURIComponent(drugA))
      .replace('{drugB}', encodeURIComponent(drugB));
  }

  const separator = DDINTER_API_URL.includes('?') ? '&' : '?';
  return `${DDINTER_API_URL}${separator}drug1=${encodeURIComponent(drugA)}&drug2=${encodeURIComponent(drugB)}`;
};

const normalizeDrugName = (name: string) => clean(name).replace(/^\{+/, '').replace(/\}+$/, '').trim();

const getOpenFdaSearchTerms = (drugName: string) => {
  const cleaned = clean(drugName)
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^\)]*\)/g, ' ');

  const parts = cleaned
    .split(/\/|,| and | with /i)
    .map(part => clean(part))
    .filter(Boolean);

  const normalized = [cleaned, ...parts]
    .map(term =>
      clean(
        term
          .replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?)\b/gi, ' ')
          .replace(/\b(oral|tablet|capsule|solution|suspension|injection|extended release|er|xr|sr)\b/gi, ' '),
      ),
    )
    .filter(Boolean);

  const unique = new Set<string>();
  normalized.forEach(item => unique.add(item));
  return Array.from(unique).slice(0, 4);
};

const isNoisySuggestion = (name: string) => {
  const lower = name.toLowerCase();
  return lower.includes('{') || lower.includes('}') || lower.includes(' pack') || lower.length > 90;
};

const getSuggestionScore = (name: string, term: string) => {
  const normalizedName = name.toLowerCase();
  const normalizedTerm = term.toLowerCase();

  if (normalizedName === normalizedTerm) return 100;
  if (normalizedName.startsWith(normalizedTerm)) return 80;
  if (normalizedName.includes(` ${normalizedTerm}`)) return 60;
  if (normalizedName.includes(normalizedTerm)) return 40;
  return 10;
};

export const searchRxNavSuggestions = async (term: string): Promise<DrugSuggestion[]> => {
  if (!term.trim()) return [];

  let data: any = null;
  try {
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(term)}`);
    if (!response.ok) return [];
    data = await response.json();
  } catch {
    return [];
  }
  const groups = data?.drugGroup?.conceptGroup || [];

  const suggestions: DrugSuggestion[] = [];
  groups.forEach((group: any) => {
    if (group?.tty && !ALLOWED_RXNAV_TTYS.has(group.tty)) {
      return;
    }

    const suggestionType: DrugSuggestion['type'] =
      group?.tty === 'SBD' || group?.tty === 'SBDC' ? 'brand' : 'generic';

    const concepts = group?.conceptProperties || [];
    concepts.forEach((concept: any) => {
      if (!concept?.name || !concept?.rxcui) return;
      const normalizedName = normalizeDrugName(concept.name);
      if (!normalizedName || isNoisySuggestion(normalizedName)) return;
      suggestions.push({ name: normalizedName, rxcui: concept.rxcui, type: suggestionType });
    });
  });

  const deduped = new Map<string, DrugSuggestion>();
  suggestions.forEach(item => {
    const key = item.name.toLowerCase();
    if (!deduped.has(key)) deduped.set(key, item);
  });

  return Array.from(deduped.values())
    .sort((a, b) => getSuggestionScore(b.name, term) - getSuggestionScore(a.name, term))
    .slice(0, 8);
};

export const getRxCui = async (drugName: string): Promise<string | null> => {
  try {
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drugName)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data?.idGroup?.rxnormId?.[0] || null;
  } catch {
    return null;
  }
};

export const getRxNavInteractions = async (rxcuiA: string, rxcuiB: string): Promise<RxNavInteraction[]> => {
  let data: any = null;
  try {
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuiA}+${rxcuiB}`);
    if (!response.ok) return [];
    data = await response.json();
  } catch {
    return [];
  }

  const pairs = data?.fullInteractionTypeGroup?.[0]?.fullInteractionType || [];
  const output: RxNavInteraction[] = [];

  pairs.forEach((pair: any) => {
    (pair?.interactionPair || []).forEach((item: any) => {
      const rawSeverity = (item?.severity || '').toLowerCase();
      const severity: RxNavInteraction['severity'] =
        rawSeverity.includes('high') || rawSeverity.includes('major')
          ? 'high'
          : rawSeverity.includes('moderate')
          ? 'moderate'
          : 'low';

      output.push({
        severity,
        description: clean(item?.description) || 'Interaction details unavailable from RxNav.',
      });
    });
  });

  return output.slice(0, 10);
};

export const getDdinterInteractions = async (drugA: string, drugB: string): Promise<DdinterInteraction[]> => {
  const url = buildDdinterUrl(drugA, drugB);
  if (!url) return [];

  let payload: any = null;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    payload = await response.json();
  } catch {
    return [];
  }

  const rawList =
    (Array.isArray(payload) && payload) ||
    (Array.isArray(payload?.interactions) && payload.interactions) ||
    (Array.isArray(payload?.results) && payload.results) ||
    (Array.isArray(payload?.data) && payload.data) ||
    [];

  return rawList
    .map((item: any) => ({
      severity: normalizeSeverity(item?.severity || item?.risk || item?.level || item?.importance),
      description: clean(item?.description || item?.interaction || item?.comment || item?.evidence),
    }))
    .filter((item: DdinterInteraction) => !!item.description)
    .slice(0, 8);
};

export const getOpenFdaSafety = async (drugName: string): Promise<OpenFdaSafety | null> => {
  if (!OPENFDA_API_KEY) return null;

  const terms = getOpenFdaSearchTerms(drugName);
  let label: any = null;

  for (const term of terms) {
    const escaped = term.replace(/"/g, '');
    const query = [
      `openfda.brand_name:"${escaped}"`,
      `openfda.generic_name:"${escaped}"`,
      `openfda.substance_name:"${escaped}"`,
    ].join('+OR+');

    try {
      const response = await fetch(
        `https://api.fda.gov/drug/label.json?api_key=${encodeURIComponent(OPENFDA_API_KEY)}&search=${encodeURIComponent(query)}&limit=1`,
      );
      if (!response.ok) continue;

      const data = await response.json();
      label = data?.results?.[0] || null;
      if (label) break;
    } catch {
      continue;
    }
  }

  if (!label) return null;

  return {
    warnings: (label.warnings || []).map((item: string) => clean(item)).filter(Boolean).slice(0, 3),
    contraindications: (label.contraindications || []).map((item: string) => clean(item)).filter(Boolean).slice(0, 3),
    foodInteractions: (label.food_interactions || []).map((item: string) => clean(item)).filter(Boolean).slice(0, 3),
  };
};

export const searchUsdaFood = async (foodTerm: string): Promise<UsdaFoodMatch | null> => {
  if (!USDA_API_KEY || !foodTerm.trim()) return null;

  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(USDA_API_KEY)}&query=${encodeURIComponent(foodTerm)}&pageSize=1`,
  );

  if (!response.ok) return null;
  const data = await response.json();
  const first = data?.foods?.[0];
  if (!first) return null;

  return {
    name: first.description,
    category: first.foodCategory,
  };
};

export const inferFoodRiskFromOpenFda = (safety: OpenFdaSafety | null, foodQuery: string) => {
  if (!safety) {
    return {
      severity: 'safe' as const,
      summary: 'OpenFDA label data was not available for this medication query, so no warning-level classification was applied.',
      evidence: [],
    };
  }

  const combined = [...safety.foodInteractions, ...safety.warnings, ...safety.contraindications];
  const normalizedFood = foodQuery.toLowerCase();
  const hits = combined.filter(item => item.toLowerCase().includes(normalizedFood));

  if (hits.length === 0) {
    return {
      severity: 'safe' as const,
      summary: 'No direct food-specific warnings matched your query in OpenFDA label sections.',
      evidence: combined.slice(0, 2),
    };
  }

  const hitText = hits.join(' ').toLowerCase();
  const severity =
    hitText.includes('contraindicated') || hitText.includes('avoid') || hitText.includes('serious')
      ? 'high'
      : 'moderate';

  return {
    severity,
    summary: 'Medication label contains food-related warning text matching your food query.',
    evidence: hits.slice(0, 3),
  };
};

export const getGeminiMedicalAdvice = async (input: GeminiMedicalInput): Promise<GeminiMedicalAdvice | null> => {
  const evidenceList = (input.evidence || []).map(item => clean(item)).filter(Boolean);
  const evidenceTokens = buildEvidenceTokenSet(evidenceList);

  const prompt = [
    'You are a clinical safety assistant for a medication reminder app.',
    'Use Evidence lines as the primary source for your risk assessment.',
    'Do NOT invent specific side effects, contraindications, or cautions that are absent from Evidence.',
    'If evidence is sparse, use conservative wording and explicitly say evidence is limited.',
    'Do not output specific adverse effects unless grounded in the Evidence text.',
    'Use severity "none" only when there is genuinely no plausible interaction risk.',
    'Return only JSON with this exact shape:',
    '{"severity":"high|moderate|low|safe|none","summary":"...","explanation":"...","recommendations":["..."],"cautions":["..."]}',
    `Context: ${input.context}`,
    `Drug A: ${input.drugA || 'N/A'}`,
    `Drug B: ${input.drugB || 'N/A'}`,
    `Medication: ${input.medication || 'N/A'}`,
    `Food: ${input.food || 'N/A'}`,
    `Supplements: ${(input.supplements || []).join(', ') || 'N/A'}`,
    `Symptoms: ${(input.symptoms || []).join(', ') || 'N/A'}`,
    `Evidence: ${evidenceList.join(' | ') || 'N/A'}`,
    'Keep explanation concise and practical for patients.',
  ].join('\n');

  if (GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          temperature: 0.2,
          max_tokens: 400,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are a careful medication safety assistant. Return strict JSON only.' },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        const rawText = extractGroqText(payload);
        const parsed = parseGeminiJson(rawText);
        if (parsed) {
          const recommendations = Array.isArray(parsed.recommendations)
            ? parsed.recommendations.map((item: string) => clean(item)).filter(Boolean)
            : [];
          const cautions = Array.isArray(parsed.cautions)
            ? parsed.cautions.map((item: string) => clean(item)).filter(Boolean)
            : [];

          const evidenceBoundRecommendations = recommendations.filter(item => hasEvidenceOverlap(item, evidenceTokens));
          const evidenceBoundCautions = cautions.filter(item => hasEvidenceOverlap(item, evidenceTokens));

          return {
            severity: normalizeGeminiSeverity(parsed.severity),
            summary: clean(parsed.summary) || 'No summary was returned by Groq.',
            explanation: clean(parsed.explanation) || 'No additional explanation available.',
            recommendations:
              evidenceBoundRecommendations.length > 0
                ? evidenceBoundRecommendations
                : ['Follow prescribed timing and confirm any concern with your healthcare provider.'],
            cautions:
              evidenceBoundCautions.length > 0
                ? evidenceBoundCautions
                : ['No evidence-confirmed specific side effect was retrieved from current sources.'],
            source: 'Groq',
          };
        }
      }
    } catch {
      // Fall back to Gemini when Groq is unavailable.
    }
  }

  if (!GEMINI_API_KEY) return null;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 400,
          },
        }),
      },
    );

    if (!response.ok) return null;
    const payload = await response.json();
    const rawText = extractGeminiText(payload);
    const parsed = parseGeminiJson(rawText);
    if (!parsed) return null;

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map((item: string) => clean(item)).filter(Boolean)
      : [];
    const cautions = Array.isArray(parsed.cautions)
      ? parsed.cautions.map((item: string) => clean(item)).filter(Boolean)
      : [];

    const evidenceBoundRecommendations = recommendations.filter(item => hasEvidenceOverlap(item, evidenceTokens));
    const evidenceBoundCautions = cautions.filter(item => hasEvidenceOverlap(item, evidenceTokens));

    return {
      severity: normalizeGeminiSeverity(parsed.severity),
      summary: clean(parsed.summary) || 'No summary was returned by Gemini.',
      explanation: clean(parsed.explanation) || 'No additional explanation available.',
      recommendations:
        evidenceBoundRecommendations.length > 0
          ? evidenceBoundRecommendations
          : ['Follow prescribed timing and confirm any concern with your healthcare provider.'],
      cautions:
        evidenceBoundCautions.length > 0
          ? evidenceBoundCautions
          : ['No evidence-confirmed specific side effect was retrieved from current sources.'],
      source: 'Gemini',
    };
  } catch {
    return null;
  }
};

export const getMissedDoseSeverityInsight = async (
  input: MissedDoseSeverityInput,
): Promise<MissedDoseSeverityInsight | null> => {
  if (!input.missed.length || !OPENFDA_API_KEY) return null;

  const languageNameByCode: Record<NonNullable<MissedDoseSeverityInput['language']>, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    ta: 'Tamil',
    te: 'Telugu',
    hi: 'Hindi',
  };
  const languageCode = input.language || 'en';
  const outputLanguage = languageNameByCode[languageCode] || 'English';

  const uniqueMedicines = Array.from(new Set(input.missed.map(item => clean(item.drugName)).filter(Boolean))).slice(0, 6);

  const fdaByMedicine = await Promise.all(
    uniqueMedicines.map(async medName => {
      const terms = getOpenFdaSearchTerms(medName);
      let label: any = null;

      for (const term of terms) {
        const escaped = term.replace(/"/g, '');
        const query = [
          `openfda.brand_name:"${escaped}"`,
          `openfda.generic_name:"${escaped}"`,
          `openfda.substance_name:"${escaped}"`,
        ].join('+OR+');

        try {
          const response = await fetch(
            `https://api.fda.gov/drug/label.json?api_key=${encodeURIComponent(OPENFDA_API_KEY)}&search=${encodeURIComponent(query)}&limit=1`,
          );
          if (!response.ok) continue;

          const data = await response.json();
          label = data?.results?.[0] || null;
          if (label) break;
        } catch {
          continue;
        }
      }

      const boxedWarnings = (label?.boxed_warning || [])
        .map((item: string) => clean(item))
        .filter(Boolean)
        .slice(0, 2);
      const warnings = (label?.warnings || [])
        .map((item: string) => clean(item))
        .filter(Boolean)
        .slice(0, 2);

      return {
        medName,
        boxedWarnings,
        warnings,
      };
    }),
  );

  const hasBoxedWarning = fdaByMedicine.some(entry => entry.boxedWarnings.length > 0);
  const hasWarningsOnly = fdaByMedicine.some(entry => entry.boxedWarnings.length === 0 && entry.warnings.length > 0);

  const severity: MissedDoseSeverityInsight['severity'] = hasBoxedWarning ? 'high' : hasWarningsOnly ? 'moderate' : 'low';

  const fdaEvidenceLines = fdaByMedicine
    .flatMap(entry => [
      ...entry.boxedWarnings.map(line => `${entry.medName} | boxed_warning: ${line}`),
      ...entry.warnings.map(line => `${entry.medName} | warnings: ${line}`),
    ])
    .slice(0, 12);

  const medsWithBoxed = fdaByMedicine.filter(entry => entry.boxedWarnings.length > 0).map(entry => entry.medName);
  const medsWithWarnings = fdaByMedicine
    .filter(entry => entry.boxedWarnings.length === 0 && entry.warnings.length > 0)
    .map(entry => entry.medName);

  const summary =
    severity === 'high'
      ? `High severity based on FDA boxed warnings for: ${medsWithBoxed.join(', ')}.`
      : severity === 'moderate'
      ? `Moderate severity based on FDA warnings for: ${medsWithWarnings.join(', ')}.`
      : 'Low severity because FDA boxed warning and warning text were not found for the missed medicines queried.';

  const riskProgression =
    severity === 'high'
      ? 'FDA boxed warning present: further missed doses can quickly raise risk. Seek clinician guidance promptly.'
      : severity === 'moderate'
      ? 'FDA warnings are present: repeated missed doses may worsen condition control in the near term.'
      : 'No FDA boxed warning/warning text detected for queried labels; continue strict adherence and monitor symptoms.';

  const missesUntilWorse = severity === 'high' ? 1 : severity === 'moderate' ? 2 : 3;

  const defaultGuidance =
    fdaEvidenceLines[0] ||
    'No FDA warning text was found for these medicine label queries. Continue prescribed adherence and consult your clinician if symptoms worsen.';

  if (!GROQ_API_KEY) {
    return {
      severity,
      summary,
      guidance: defaultGuidance,
      riskProgression,
      missesUntilWorse,
      source: 'OpenFDA',
    };
  }

  const prompt = [
    'You are a medical text simplifier for a patient dashboard.',
    'Do NOT determine severity. Severity has already been determined from FDA classification.',
    'Using only the FDA label evidence below, produce one plain-language sentence about concern when doses are missed.',
    'Do not invent facts that are not present in the FDA evidence.',
    `Write the sentence in ${outputLanguage}.`,
    'Keep medication names in English.',
    'Return strict JSON only with this exact shape: {"sentence":"..."}',
    `Missed medicines: ${uniqueMedicines.join(', ')}`,
    `FDA evidence: ${fdaEvidenceLines.length > 0 ? fdaEvidenceLines.join(' | ') : 'No FDA warning evidence found.'}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        max_tokens: 140,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You simplify FDA label text into one patient-friendly sentence. Return strict JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      return {
        severity,
        summary,
        guidance: defaultGuidance,
        riskProgression,
        missesUntilWorse,
        source: 'OpenFDA',
      };
    }
    const payload = await response.json();
    const rawText = extractGroqText(payload);
    const parsed = parseGeminiJson(rawText);
    const simplifiedSentence = clean(parsed?.sentence);

    return {
      severity,
      summary,
      guidance: simplifiedSentence || defaultGuidance,
      riskProgression,
      missesUntilWorse,
      source: 'OpenFDA + Groq',
    };
  } catch {
    return {
      severity,
      summary,
      guidance: defaultGuidance,
      riskProgression,
      missesUntilWorse,
      source: 'OpenFDA',
    };
  }
};

export const getMissedDoseRecoveryAdvice = async (
  input: MissedDoseRecoveryInput,
): Promise<MissedDoseRecoveryAdvice | null> => {
  const languageNameByCode: Record<NonNullable<MissedDoseRecoveryInput['language']>, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    ta: 'Tamil',
    te: 'Telugu',
    hi: 'Hindi',
  };
  const outputLanguage = languageNameByCode[input.language || 'en'] || 'English';
  const nowIso = input.nowIso || new Date().toISOString();

  const parseIntervalHoursFromFrequency = (frequency: string) => {
    const lowered = clean(frequency).toLowerCase();
    const everyHoursMatch = lowered.match(/every\s*(\d+)\s*(hour|hours|hr|hrs)/);
    if (everyHoursMatch) {
      const parsed = Number(everyHoursMatch[1]);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    const perDayMatch = lowered.match(/(\d+)\s*(x|times?)\s*(a|per)?\s*day/);
    if (perDayMatch) {
      const times = Number(perDayMatch[1]);
      if (Number.isFinite(times) && times > 0) return 24 / times;
    }

    if (lowered.includes('twice') || lowered.includes('bid')) return 12;
    if (lowered.includes('three') || lowered.includes('thrice') || lowered.includes('tid')) return 8;
    if (lowered.includes('four') || lowered.includes('qid')) return 6;
    if (lowered.includes('weekly')) return 24 * 7;
    if (lowered.includes('daily') || lowered.includes('once') || lowered.includes('qd') || lowered.includes('every day')) return 24;

    return 24;
  };

  const getFoodTimingInstruction = (
    action: MissedDoseRecoveryAdvice['action'],
    foodTiming: MissedDoseRecoveryInput['medication']['foodTiming'],
  ) => {
    const actionText =
      action === 'take-full-dose-now'
        ? 'If you take it now, '
        : action === 'skip-and-resume-next'
        ? 'For your next scheduled dose, '
        : 'Follow label timing and ';

    if (foodTiming === 'before-food') return `${actionText}take it before food as prescribed.`;
    if (foodTiming === 'after-food') return `${actionText}take it after food as prescribed.`;
    return `${actionText}follow the medicine label for food timing.`;
  };

  const missedAt = new Date(input.medication.missedScheduledAt).getTime();
  const nowAt = new Date(nowIso).getTime();
  const elapsedMs = Number.isFinite(missedAt) && Number.isFinite(nowAt) ? Math.max(0, nowAt - missedAt) : 0;
  const intervalMs = parseIntervalHoursFromFrequency(input.medication.frequency) * 60 * 60 * 1000;
  const lessThanHalfWindow = elapsedMs < intervalMs / 2;

  let action: MissedDoseRecoveryAdvice['action'] = lessThanHalfWindow ? 'take-full-dose-now' : 'skip-and-resume-next';
  let urgency: MissedDoseRecoveryAdvice['urgency'] = input.medication.criticality === 'high' ? 'high' : 'moderate';
  let confidence: MissedDoseRecoveryAdvice['confidence'] = 'medium';
  let technicalRationale =
    action === 'take-full-dose-now'
      ? 'Rule-based schedule guidance: less than half the dosing interval has passed, so taking the missed dose now is generally safer than skipping.'
      : 'Rule-based schedule guidance: more than half the dosing interval has passed, so skip the missed dose and resume the next scheduled dose.';
  let source: MissedDoseRecoveryAdvice['source'] = 'Schedule Rule';

  if (OPENFDA_API_KEY) {
    const terms = getOpenFdaSearchTerms(input.medication.drugName);
    let label: any = null;

    for (const term of terms) {
      const escaped = term.replace(/"/g, '');
      const query = [
        `openfda.brand_name:"${escaped}"`,
        `openfda.generic_name:"${escaped}"`,
        `openfda.substance_name:"${escaped}"`,
      ].join('+OR+');

      try {
        const response = await fetch(
          `https://api.fda.gov/drug/label.json?api_key=${encodeURIComponent(OPENFDA_API_KEY)}&search=${encodeURIComponent(query)}&limit=1`,
        );
        if (!response.ok) continue;

        const data = await response.json();
        label = data?.results?.[0] || null;
        if (label) break;
      } catch {
        continue;
      }
    }

    const dosageLines = (label?.dosage_and_administration || [])
      .map((item: string) => clean(item))
      .filter(Boolean)
      .slice(0, 3);

    if (dosageLines.length > 0) {
      const missedDoseLine = dosageLines.find(line => /missed dose|as soon as|next dose|skip|double/i.test(line)) || dosageLines[0];
      const normalizedLine = missedDoseLine.toLowerCase();

      if (/(contact|doctor|clinician|provider|pharmacist)/i.test(normalizedLine) && !/(take as soon as|skip)/i.test(normalizedLine)) {
        action = 'contact-clinician-now';
        urgency = 'high';
        confidence = 'high';
      } else if (/(skip).*(next dose)|(next dose).*(skip)/i.test(normalizedLine)) {
        action = 'skip-and-resume-next';
        urgency = 'moderate';
        confidence = 'high';
      } else if (/(take as soon as|take it as soon as|as soon as possible|immediately)/i.test(normalizedLine)) {
        action = 'take-full-dose-now';
        urgency = input.medication.criticality === 'high' ? 'high' : 'moderate';
        confidence = 'high';
      }

      technicalRationale = `FDA dosage and administration guidance: ${missedDoseLine}`;
      source = 'OpenFDA';
    }
  }

  const baseFoodTimingInstruction = getFoodTimingInstruction(action, input.medication.foodTiming);
  const baseMonitoringNotes = [
    'Never double the next dose unless your FDA label guidance explicitly says it is safe.',
    'Seek pharmacist or clinician advice for personalized adjustments.',
  ];

  if (!GROQ_API_KEY) {
    return {
      action,
      urgency,
      technicalRationale,
      foodTimingInstruction: baseFoodTimingInstruction,
      monitoringNotes: baseMonitoringNotes,
      confidence,
      source,
    };
  }

  const phrasingPrompt = [
    'You are a patient-language medical wording assistant.',
    'Action has already been determined and must not be changed.',
    'Do not invent medical facts or new dosing rules.',
    'Use the provided grounding text only, and keep wording short and clear.',
    `Write output in ${outputLanguage}.`,
    'Return strict JSON only with this exact shape:',
    '{"foodTimingInstruction":"...","monitoringNotes":["...","..."]}',
    `Chosen action: ${action}`,
    `Grounding text: ${technicalRationale}`,
    `Base food timing instruction: ${baseFoodTimingInstruction}`,
    `Base monitoring notes: ${baseMonitoringNotes.join(' | ')}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        max_tokens: 220,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You rewrite grounded medication guidance for readability. Return strict JSON only.' },
          { role: 'user', content: phrasingPrompt },
        ],
      }),
    });

    if (!response.ok) {
      return {
        action,
        urgency,
        technicalRationale,
        foodTimingInstruction: baseFoodTimingInstruction,
        monitoringNotes: baseMonitoringNotes,
        confidence,
        source,
      };
    }
    const payload = await response.json();
    const rawText = extractGroqText(payload);
    const parsed = parseGeminiJson(rawText);
    const friendlyFoodTiming = clean(parsed?.foodTimingInstruction) || baseFoodTimingInstruction;
    const friendlyMonitoring = Array.isArray(parsed?.monitoringNotes)
      ? parsed.monitoringNotes.map((item: string) => clean(item)).filter(Boolean).slice(0, 4)
      : baseMonitoringNotes;

    return {
      action,
      urgency,
      technicalRationale,
      foodTimingInstruction: friendlyFoodTiming,
      monitoringNotes: friendlyMonitoring,
      confidence,
      source: source === 'OpenFDA' ? 'OpenFDA + Groq' : 'Schedule Rule + Groq',
    };
  } catch {
    return {
      action,
      urgency,
      technicalRationale,
      foodTimingInstruction: baseFoodTimingInstruction,
      monitoringNotes: baseMonitoringNotes,
      confidence,
      source,
    };
  }
};

export const getDrugAllergyProfileInsight = async (
  input: DrugAllergyProfileInput,
): Promise<DrugAllergyProfileInsight | null> => {
  if (!GROQ_API_KEY || input.medicines.length === 0) return null;

  const languageNameByCode: Record<NonNullable<DrugAllergyProfileInput['language']>, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    ta: 'Tamil',
    te: 'Telugu',
    hi: 'Hindi',
  };
  const outputLanguage = languageNameByCode[input.language || 'en'] || 'English';

  const normalizedChronic = (input.chronicDiseases || []).filter(Boolean);
  const normalizedInfections = (input.infectionHistory || []).filter(Boolean);
  const normalizedAllergies = (input.allergies || [])
    .map(item => ({
      category: clean(item.category) || 'Unknown',
      trigger: clean(item.trigger),
    }))
    .filter(item => item.category);
  const normalizedGender = clean(input.gender);
  const normalizedBloodGroup = clean(input.bloodGroup);

  if (!OPENFDA_API_KEY) {
    return null;
  }

  const fdaGroundingByMedicine = await Promise.all(
    input.medicines.slice(0, 6).map(async medName => {
      const terms = getOpenFdaSearchTerms(medName);
      let label: any = null;

      for (const term of terms) {
        const escaped = term.replace(/"/g, '');
        const query = [
          `openfda.brand_name:"${escaped}"`,
          `openfda.generic_name:"${escaped}"`,
          `openfda.substance_name:"${escaped}"`,
        ].join('+OR+');

        try {
          const response = await fetch(
            `https://api.fda.gov/drug/label.json?api_key=${encodeURIComponent(OPENFDA_API_KEY)}&search=${encodeURIComponent(query)}&limit=1`,
          );
          if (!response.ok) continue;

          const data = await response.json();
          label = data?.results?.[0] || null;
          if (label) break;
        } catch {
          continue;
        }
      }

      const warningLines = (label?.warnings_and_cautions || [])
        .map((item: string) => clean(item))
        .filter(Boolean)
        .slice(0, 2);
      const contraindicationLines = (label?.contraindications || [])
        .map((item: string) => clean(item))
        .filter(Boolean)
        .slice(0, 2);

      return {
        medName,
        warningLines,
        contraindicationLines,
      };
    }),
  );

  const fdaEvidenceLines = fdaGroundingByMedicine
    .flatMap(entry => [
      ...entry.warningLines.map(line => `${entry.medName} | warnings_and_cautions: ${line}`),
      ...entry.contraindicationLines.map(line => `${entry.medName} | contraindications: ${line}`),
    ])
    .slice(0, 16);

  const prompt = [
    'You are a medication safety explainer focused on allergy and comorbidity-aware checks.',
    'Use only FDA label evidence lines for warnings_and_cautions and contraindications as medical grounding.',
    'Do not invent adverse effects or contraindications not present in FDA lines.',
    'If FDA evidence is unavailable for a medicine, clearly state evidence limitation instead of speculating.',
    `Write summary, findings[].title, findings[].detail, findings[].evidence, and recommendations in ${outputLanguage}.`,
    'Keep medication names and medical terminology in English.',
    'Explain in simple patient language while staying faithful to FDA evidence text.',
    'Return strict JSON only with this exact shape:',
    '{"overallRisk":"high|moderate|low|none","summary":"...","findings":[{"severity":"high|moderate|low","title":"...","detail":"...","evidence":"..."}],"recommendations":["..."]}',
    `Current medicines: ${input.medicines.join(', ')}`,
    `Patient profile: gender=${normalizedGender || 'Not specified'}, blood_group=${normalizedBloodGroup || 'Not specified'}`,
    `Chronic diseases: ${normalizedChronic.join(', ') || 'None'}`,
    `Infection history: ${normalizedInfections.join(', ') || 'None'}`,
    `Allergies: ${normalizedAllergies.map(item => `${item.category}${item.trigger ? `(${item.trigger})` : ''}`).join(', ') || 'None'}`,
    `FDA label evidence lines: ${fdaEvidenceLines.length > 0 ? fdaEvidenceLines.join(' | ') : 'No FDA warnings_and_cautions/contraindications evidence available for these medicines.'}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        max_tokens: 520,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a conservative drug safety assistant. Return strict JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const rawText = extractGroqText(payload);
    const parsed = parseGeminiJson(rawText);
    if (!parsed) return null;

    const overallRisk: DrugAllergyProfileInsight['overallRisk'] =
      parsed.overallRisk === 'high' || parsed.overallRisk === 'moderate' || parsed.overallRisk === 'low' || parsed.overallRisk === 'none'
        ? parsed.overallRisk
        : 'none';

    const findings = Array.isArray(parsed.findings)
      ? parsed.findings
          .map((item: any) => ({
            severity:
              item?.severity === 'high' || item?.severity === 'moderate' || item?.severity === 'low'
                ? item.severity
                : 'low',
            title: clean(item?.title) || 'Potential profile interaction',
            detail: clean(item?.detail) || 'Review this profile-specific interaction with your clinician.',
            evidence: clean(item?.evidence) || 'Model-derived profile assessment with limited direct source lines.',
          }))
          .slice(0, 6)
      : [];

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map((item: string) => clean(item)).filter(Boolean).slice(0, 5)
      : [];

    return {
      overallRisk,
      summary: clean(parsed.summary) || 'No major profile-based interaction signal was detected from provided data.',
      findings,
      recommendations,
      source: 'Groq',
    };
  } catch {
    return null;
  }
};

export const getFoodNutritionProfileInsight = async (
  input: FoodNutritionProfileInput,
): Promise<FoodNutritionProfileInsight | null> => {
  if (!GROQ_API_KEY || input.medicines.length === 0) return null;

  const languageNameByCode: Record<NonNullable<FoodNutritionProfileInput['language']>, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    ta: 'Tamil',
    te: 'Telugu',
    hi: 'Hindi',
  };
  const outputLanguage = languageNameByCode[input.language || 'en'] || 'English';

  const illnesses = (input.illness || []).map(item => clean(item)).filter(Boolean);
  const chronicDiseases = (input.chronicDiseases || []).map(item => clean(item)).filter(Boolean);
  const infectionHistory = (input.infectionHistory || []).map(item => clean(item)).filter(Boolean);
  const allergies = (input.allergies || []).map(item => clean(item)).filter(Boolean);

  const confidenceFromValue = (value: unknown): 'high' | 'medium' | 'low' => {
    const normalized = clean(String(value || '')).toLowerCase();
    if (normalized === 'high') return 'high';
    if (normalized === 'medium' || normalized === 'moderate') return 'medium';
    return 'low';
  };

  const evidenceSources = await Promise.all(
    input.medicines.slice(0, 6).map(async medName => {
      const safety = await getOpenFdaSafety(medName);
      const lines = safety
        ? [...(safety.foodInteractions || []), ...(safety.warnings || []), ...(safety.contraindications || [])]
            .map(item => clean(item))
            .filter(Boolean)
            .slice(0, 2)
        : [];

      return {
        medName,
        lines,
      };
    }),
  );

  const evidenceLines = evidenceSources.flatMap(item => item.lines.map(line => `${item.medName}: ${line}`)).slice(0, 10);

  const prompt = [
    'You are a medication-aware clinical nutrition assistant.',
    'Task: provide practical food-type recommendations based on current medicines and disease profile.',
    'Focus on food categories and nutrition strategy (for example: complex carbohydrates, fiber, vitamin E-rich foods, potassium-rich foods, protein quality, hydration).',
    'Avoid fabricated contraindications. If uncertain, state uncertainty conservatively.',
    'Only claim direct medicine-food interaction if supported by OpenFDA evidence lines.',
    'If evidence for direct interaction is weak, provide general disease-supportive nutrition advice and set confidence to low or medium.',
    'Do not prescribe drug dose changes. Keep medication names in English.',
    `Write summary, reasons, and timing tips in ${outputLanguage}.`,
    'Return strict JSON only with this exact shape:',
    '{"summary":"...","confidence":"high|medium|low","evidenceBasis":["..."],"foodTypesToPrioritize":[{"type":"...","reason":"...","examples":["..."],"confidence":"high|medium|low"}],"foodTypesToLimit":[{"type":"...","reason":"...","examples":["..."],"confidence":"high|medium|low"}],"timingTips":["..."]}',
    `Current medicines: ${input.medicines.join(', ')}`,
    `Illness: ${illnesses.join(', ') || 'None specified'}`,
    `Chronic diseases: ${chronicDiseases.join(', ') || 'None specified'}`,
    `Infection history: ${infectionHistory.join(', ') || 'None specified'}`,
    `Allergies: ${allergies.join(', ') || 'None specified'}`,
    `OpenFDA evidence lines: ${evidenceLines.length > 0 ? evidenceLines.join(' | ') : 'None available'}`,
  ].join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        temperature: 0.1,
        max_tokens: 620,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a conservative nutrition safety assistant. Return strict JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const rawText = extractGroqText(payload);
    const parsed = parseGeminiJson(rawText);
    if (!parsed) return null;

    const mapFoodItem = (item: any) => ({
      type: clean(item?.type) || 'General nutrition balance',
      reason: clean(item?.reason) || 'Profile-based nutrition support may help treatment stability.',
      examples: Array.isArray(item?.examples)
        ? item.examples.map((example: string) => clean(example)).filter(Boolean).slice(0, 5)
        : [],
      confidence: confidenceFromValue(item?.confidence),
    });

    const prioritize = Array.isArray(parsed.foodTypesToPrioritize)
      ? parsed.foodTypesToPrioritize.map((item: any) => mapFoodItem(item)).slice(0, 5)
      : [];

    const limit = Array.isArray(parsed.foodTypesToLimit)
      ? parsed.foodTypesToLimit.map((item: any) => mapFoodItem(item)).slice(0, 5)
      : [];

    const timingTips = Array.isArray(parsed.timingTips)
      ? parsed.timingTips.map((item: string) => clean(item)).filter(Boolean).slice(0, 6)
      : [];

    return {
      summary: clean(parsed.summary) || 'Medication and profile-based diet pattern can support safer long-term control.',
      confidence: confidenceFromValue(parsed.confidence),
      evidenceBasis: Array.isArray(parsed.evidenceBasis)
        ? parsed.evidenceBasis.map((item: string) => clean(item)).filter(Boolean).slice(0, 5)
        : evidenceLines.slice(0, 3),
      foodTypesToPrioritize: prioritize,
      foodTypesToLimit: limit,
      timingTips,
      source: 'Groq',
    };
  } catch {
    return null;
  }
};

export const parseInputList = (csvValue: string) => splitCsv(csvValue);
