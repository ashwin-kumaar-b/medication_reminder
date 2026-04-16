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
  if (!GROQ_API_KEY || !input.missed.length) return null;

  const prompt = [
    'You are a medication adherence risk triage assistant.',
    'Assess missed-dose severity for a patient using the provided missed medication list.',
    'Provide practical and direct wording for a patient dashboard.',
    'You MUST include a progression statement with an estimate of how many additional misses could worsen condition control.',
    'If uncertain, give a conservative estimate and mention uncertainty in guidance.',
    'Return strict JSON only with this exact shape:',
    '{"severity":"high|moderate|low","summary":"...","guidance":"...","riskProgression":"...","missesUntilWorse":number|null}',
    `Patient age: ${input.patientAge ?? 'unknown'}`,
    `Primary condition: ${input.condition || 'not specified'}`,
    `Missed meds: ${input.missed
      .map(item => `${item.drugName} [category=${item.category}, criticality=${item.criticality}, missedCount=${item.missedCount}, lastMissed=${item.lastMissedDate}]`)
      .join(' | ')}`,
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
        temperature: 0.2,
        max_tokens: 320,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a careful medication adherence risk assistant. Return strict JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    const rawText = extractGroqText(payload);
    const parsed = parseGeminiJson(rawText);
    if (!parsed) return null;

    const rawMissesUntilWorse =
      typeof parsed.missesUntilWorse === 'number'
        ? parsed.missesUntilWorse
        : typeof parsed.missesUntilWorse === 'string'
        ? Number(parsed.missesUntilWorse)
        : null;

    return {
      severity: normalizeSeverity(parsed.severity),
      summary: clean(parsed.summary) || 'Missed doses may increase your near-term health risk.',
      guidance: clean(parsed.guidance) || 'Please follow your medication schedule and contact your clinician if misses continue.',
      riskProgression: clean(parsed.riskProgression) || 'Further missed doses may worsen control of your condition.',
      missesUntilWorse:
        typeof rawMissesUntilWorse === 'number' && Number.isFinite(rawMissesUntilWorse) && rawMissesUntilWorse >= 0
          ? Math.round(rawMissesUntilWorse)
          : null,
      source: 'Groq',
    };
  } catch {
    return null;
  }
};

export const parseInputList = (csvValue: string) => splitCsv(csvValue);
