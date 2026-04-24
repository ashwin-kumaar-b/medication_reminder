const OPENFDA_API_KEY = import.meta.env.VITE_OPENFDA_API_KEY as string | undefined;
const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY as string | undefined;
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const DDINTER_API_URL = import.meta.env.VITE_DDINTER_API_URL as string | undefined;
const DAILYMED_BASE_URL = 'https://dailymed.nlm.nih.gov/dailymed/services/v2';
const FAERS_BASE_URL = 'https://api.fda.gov/drug/event.json';
const MEDLINEPLUS_CONNECT_URL = 'https://connect.medlineplus.gov/service';

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

export interface MedlinePlusDrugInfo {
  rxcui: string;
  foodInteractionLines: string[];
  plainEnglishLines: string[];
  sourceUrl?: string;
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
  source: 'DailyMed' | 'DailyMed + Groq';
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
  source: 'DailyMed' | 'DailyMed + Groq' | 'Schedule Rule' | 'Schedule Rule + Groq';
}

export interface DrugAllergyProfileInput {
  language?: 'en' | 'es' | 'fr' | 'ta' | 'te' | 'hi';
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
  }>;
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
  contextNote?: string;
  source: 'Groq';
}

export interface FoodNutritionProfileInput {
  language?: 'en' | 'es' | 'fr' | 'ta' | 'te' | 'hi';
  medicines: string[];
  medicineUses?: string[];
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

const toLines = (value: unknown): string[] => {
  if (typeof value === 'string') {
    const normalized = clean(value);
    return normalized ? [normalized] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(item => toLines(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(item => toLines(item));
  }

  return [];
};

const getDailyMedSectionLines = (payload: unknown, sectionAliases: string[], maxItems = 3): string[] => {
  const normalizedAliases = new Set(sectionAliases.map(alias => alias.toLowerCase().replace(/[^a-z0-9]/g, '')));
  const lines: string[] = [];

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object' || lines.length >= maxItems) return;

    if (Array.isArray(node)) {
      node.forEach(item => visit(item));
      return;
    }

    const record = node as Record<string, unknown>;
    Object.entries(record).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedAliases.has(normalizedKey) && lines.length < maxItems) {
        toLines(value).forEach(line => {
          if (lines.length < maxItems && !lines.includes(line)) {
            lines.push(line);
          }
        });
      }

      if (value && typeof value === 'object') {
        visit(value);
      }
    });
  };

  visit(payload);
  return lines.slice(0, maxItems);
};

const fetchDailyMedLabelPayload = async (drugName: string): Promise<unknown | null> => {
  const terms = getOpenFdaSearchTerms(drugName);

  for (const term of terms) {
    const encodedTerm = encodeURIComponent(term);
    try {
      const [splsResponse, drugsResponse] = await Promise.all([
        fetch(`${DAILYMED_BASE_URL}/spls.json?drug_name=${encodedTerm}`),
        fetch(`${DAILYMED_BASE_URL}/drugs.json?drug_name=${encodedTerm}`),
      ]);

      const candidates: unknown[] = [];
      if (splsResponse.ok) {
        const spls = await splsResponse.json();
        candidates.push(spls);
      }
      if (drugsResponse.ok) {
        const drugs = await drugsResponse.json();
        candidates.push(drugs);
      }

      const best = candidates.find(payload => {
        const warnings = getDailyMedSectionLines(payload, ['warnings', 'warnings_and_cautions', 'warningsandcautions', 'boxed_warning', 'boxedwarning'], 1);
        const contraindications = getDailyMedSectionLines(payload, ['contraindications'], 1);
        const dosage = getDailyMedSectionLines(payload, ['dosage_and_administration', 'dosageandadministration'], 1);
        return warnings.length > 0 || contraindications.length > 0 || dosage.length > 0;
      });

      if (best) return best;
      if (candidates.length > 0) return candidates[0];
    } catch {
      continue;
    }
  }

  return null;
};

const fetchFaersReactionSignals = async (drugName: string): Promise<Array<{ reaction: string; count: number }>> => {
  const baseTerms = getOpenFdaSearchTerms(drugName);
  const terms = new Set<string>(baseTerms);

  try {
    const rxcui = await getRxCui(drugName);
    if (rxcui) {
      const related = await fetchRxNormAllRelated(rxcui);
      const conceptGroups = Array.isArray(related?.allRelatedGroup?.conceptGroup) ? related.allRelatedGroup.conceptGroup : [];
      const genericGroups = conceptGroups.filter((group: any) => ['IN', 'PIN', 'MIN'].includes(clean(group?.tty)));
      genericGroups.forEach((group: any) => {
        const concepts = Array.isArray(group?.conceptProperties) ? group.conceptProperties : [];
        concepts.forEach((concept: any) => {
          const name = clean(concept?.name);
          if (name) terms.add(name);
        });
      });
    }
  } catch {
    // Continue with best-effort base terms if RxNorm generic enrichment fails.
  }

  const reactionCounts = new Map<string, number>();

  for (const term of Array.from(terms)) {
    const escaped = term.replace(/"/g, '');
    const query = `patient.drug.medicinalproduct:"${escaped}"`;
    const keyPart = OPENFDA_API_KEY ? `&api_key=${encodeURIComponent(OPENFDA_API_KEY)}` : '';
    const url = `${FAERS_BASE_URL}?search=${encodeURIComponent(query)}&count=${encodeURIComponent('patient.reaction.reactionmeddrapt.exact')}${keyPart}`;

    if (/azithromycin/i.test(drugName) || /azithromycin/i.test(term)) {
      console.info('[FAERS DEBUG] drug=', drugName, 'term=', term, 'query=', query, 'url=', url);
    }

    try {
      const response = await fetch(url);
      const rawText = await response.text();
      if (/azithromycin/i.test(drugName) || /azithromycin/i.test(term)) {
        console.info('[FAERS DEBUG] status=', response.status, 'term=', term, 'raw=', rawText.slice(0, 1200));
      }
      if (!response.ok) continue;

      const payload = JSON.parse(rawText);
      const results = Array.isArray(payload?.results) ? payload.results : [];
      results.slice(0, 20).forEach((entry: any) => {
        const reaction = clean(entry?.term || entry?.name);
        const count = Number(entry?.count || 0);
        if (!reaction || !Number.isFinite(count) || count <= 0) return;
        reactionCounts.set(reaction, (reactionCounts.get(reaction) || 0) + count);
      });
    } catch {
      if (/azithromycin/i.test(drugName) || /azithromycin/i.test(term)) {
        console.info('[FAERS DEBUG] request failed for term=', term);
      }
      continue;
    }
  }

  return Array.from(reactionCounts.entries())
    .map(([reaction, count]) => ({ reaction, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
};

const OVERDOSE_RELATED_REACTION_PATTERNS = [
  /overdose/i,
  /intentional/i,
  /self[-\s]?harm/i,
  /suicid/i,
  /poison/i,
  /drug abuse/i,
  /substance abuse/i,
  /dependence/i,
  /withdrawal/i,
  /misuse/i,
  /toxicity/i,
];

const isOverdoseRelatedReaction = (reaction: string) => {
  const normalized = clean(reaction);
  if (!normalized) return false;
  return OVERDOSE_RELATED_REACTION_PATTERNS.some(pattern => pattern.test(normalized));
};

const parseNumericDoseInMg = (dosageText?: string) => {
  const normalized = clean(dosageText).toLowerCase();
  if (!normalized) return null;

  const mgMatch = normalized.match(/(\d+(?:\.\d+)?)\s*mg\b/);
  if (mgMatch) {
    const value = Number(mgMatch[1]);
    return Number.isFinite(value) ? value : null;
  }

  const gMatch = normalized.match(/(\d+(?:\.\d+)?)\s*g\b/);
  if (gMatch) {
    const value = Number(gMatch[1]);
    return Number.isFinite(value) ? value * 1000 : null;
  }

  return null;
};

const parseAdministrationsPerDay = (frequency?: string) => {
  const normalized = clean(frequency).toLowerCase();
  if (!normalized) return 1;
  if (normalized.includes('thrice') || normalized.includes('three')) return 3;
  if (normalized.includes('twice') || normalized.includes('two')) return 2;
  if (normalized.includes('weekly')) return 1 / 7;
  if (normalized.includes('every') && normalized.includes('hour')) {
    const everyHourMatch = normalized.match(/every\s*(\d+(?:\.\d+)?)\s*(hour|hours|hr|hrs)/);
    if (everyHourMatch) {
      const hours = Number(everyHourMatch[1]);
      if (Number.isFinite(hours) && hours > 0) return 24 / hours;
    }
  }
  const xPerDayMatch = normalized.match(/(\d+)\s*(x|times?)\s*(a|per)?\s*day/);
  if (xPerDayMatch) {
    const count = Number(xPerDayMatch[1]);
    if (Number.isFinite(count) && count > 0) return count;
  }
  return 1;
};

const parseDailyMedMaxDailyMg = (dosageLines: string[]) => {
  const patterns = [
    /do\s+not\s+exceed\s*(\d+(?:\.\d+)?)\s*mg\b/i,
    /maximum(?:\s+recommended)?(?:\s+daily)?\s+dose(?:\s+is|:)?\s*(\d+(?:\.\d+)?)\s*mg\b/i,
    /max(?:imum)?\s*(\d+(?:\.\d+)?)\s*mg\s*(?:\/\s*day|per\s*day|in\s*24\s*hours|\/\s*24\s*h)/i,
  ];

  for (const line of dosageLines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (!match) continue;
      const value = Number(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  return null;
};

const parseDailyMedPerDoseRangeMg = (dosageLines: string[]) => {
  for (const line of dosageLines) {
    const match = line.match(/(\d+(?:\.\d+)?)\s*(?:to|-|–)\s*(\d+(?:\.\d+)?)\s*mg\b/i);
    if (!match) continue;
    const min = Number(match[1]);
    const max = Number(match[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max >= min) {
      return { min, max };
    }
  }
  return null;
};

const classifyDoseRange = (params: {
  dosage?: string;
  frequency?: string;
  dosageLines: string[];
}) => {
  const patientDoseMg = parseNumericDoseInMg(params.dosage);
  const administrationsPerDay = parseAdministrationsPerDay(params.frequency);
  const patientDailyDoseMg =
    patientDoseMg !== null && Number.isFinite(administrationsPerDay) ? patientDoseMg * administrationsPerDay : null;
  const maxDailyMg = parseDailyMedMaxDailyMg(params.dosageLines);
  const perDoseRange = parseDailyMedPerDoseRangeMg(params.dosageLines);

  let status: 'within-range' | 'above-range' | 'unknown' = 'unknown';
  if (patientDailyDoseMg !== null && maxDailyMg !== null) {
    status = patientDailyDoseMg <= maxDailyMg ? 'within-range' : 'above-range';
  } else if (patientDoseMg !== null && perDoseRange) {
    status = patientDoseMg >= perDoseRange.min && patientDoseMg <= perDoseRange.max ? 'within-range' : 'above-range';
  }

  return {
    status,
    patientDoseMg,
    patientDailyDoseMg,
    maxDailyMg,
    perDoseRange,
  };
};

const toPercent = (part: number, total: number) => {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
};

const isDeathReaction = (reaction: string) => /\b(death|fatal|mortality)\b/i.test(clean(reaction));

const getFaersReactionDisplayLabel = (reaction: string) => {
  const normalized = clean(reaction).toUpperCase();
  if (normalized === 'PAIN') return 'Inadequate Pain Control';
  return clean(reaction);
};

const stripPercentages = (text: string) => clean(text).replace(/\b\d+(?:\.\d+)?%\b/g, '').replace(/\s{2,}/g, ' ').trim();

const stripExactPercentageUnavailableText = (text: string) =>
  clean(text)
    .replace(/exact\s+percentage\s+is\s+not\s+available\.?/gi, '')
    .replace(/percentage\s+is\s+not\s+available\.?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const normalizeIneffectiveEvidenceSentence = (text: string) => {
  const normalized = clean(text);
  if (!normalized) return normalized;

  const percentage = normalized.match(/(\d+(?:\.\d+)?)%/i)?.[1];
  const looksTruncated = /involved\s+the\.?$/i.test(normalized) || /reported\s+the\.?$/i.test(normalized);
  const isIneffectiveText = /(drug ineffective|ineffective|lack of effect|treatment failure)/i.test(normalized);

  if (looksTruncated && percentage && isIneffectiveText) {
    return `${percentage}% of reported cases reported the drug as ineffective.`;
  }

  return normalized;
};

const normalizePainLabelText = (text: string) =>
  clean(text)
    .replace(/\bPain\s+relief\b/gi, 'Inadequate Pain Control')
    .replace(/\bPAIN\b/g, 'Inadequate Pain Control');

const classifyFindingCategory = (finding: { title: string; detail: string; evidence: string }) => {
  const blob = `${finding.title} ${finding.detail} ${finding.evidence}`.toLowerCase();
  if (/(overdose|intentional|misuse|poison|drug abuse|substance abuse|dependence|toxicity)/i.test(blob)) return 'overdose';
  if (/(inadequate pain control|drug ineffective|ineffective|lack of effect|treatment failure|pain persisted|pain not controlled)/i.test(blob)) return 'ineffective';
  if (/(death|fatal|mortality)/i.test(blob)) return 'death';
  return 'other';
};

const isOverdoseAssociatedDependenceFinding = (finding: { title: string; detail: string; evidence: string }) => {
  const blob = `${finding.title} ${finding.detail} ${finding.evidence}`.toLowerCase();
  const hasDependenceTerm = /(dependence|addiction|withdrawal|substance use disorder)/i.test(blob);
  const hasMisuseContext = /(misuse|overdose|abuse|intentional|poison)/i.test(blob);
  return hasDependenceTerm && hasMisuseContext;
};

const buildFallbackFindingsFromEvidence = (
  grounding: Array<{
    medName: string;
    warningLines: string[];
    contraindicationLines: string[];
    filteredSignals: Array<{ reaction: string; count: number }>;
    faersSignals: Array<{ reaction: string; count: number }>;
    totalFaersCount: number;
  }>,
) => {
  const fallbackFindings: DrugAllergyProfileInsight['findings'] = [];

  grounding.forEach(entry => {
    const selectedSignals = entry.filteredSignals.length > 0 ? entry.filteredSignals : entry.faersSignals;
    selectedSignals.slice(0, 3).forEach(signal => {
      const reactionLabel = getFaersReactionDisplayLabel(signal.reaction);
      const reactionType = isOverdoseRelatedReaction(signal.reaction) ? 'overdose/misuse-associated' : 'non-overdose signal';
      const evidence = isDeathReaction(signal.reaction)
        ? `${entry.medName} | FAERS reaction category: ${reactionLabel} | signal_type: ${reactionType} | reported in retrieved FAERS lifetime submissions`
        : `${entry.medName} | FAERS reaction category: ${reactionLabel} | signal_type: ${reactionType} | reporting share among retrieved FAERS lifetime submissions: ${toPercent(signal.count, entry.totalFaersCount || 0)}`;

      fallbackFindings.push({
        severity: reactionType === 'overdose/misuse-associated' ? 'low' : 'moderate',
        title: reactionLabel,
        detail:
          reactionType === 'overdose/misuse-associated'
            ? `${reactionLabel} is mainly reported in misuse or overdose scenarios rather than normal prescribed use.`
            : `${reactionLabel} has been reported in post-marketing FDA reports and should be monitored clinically when symptoms appear.`,
        evidence,
      });
    });

    if (fallbackFindings.length === 0) {
      const warningEvidence = [...entry.warningLines, ...entry.contraindicationLines].filter(Boolean);
      if (warningEvidence.length > 0) {
        fallbackFindings.push({
          severity: 'low',
          title: 'Label-Based Caution',
          detail: 'DailyMed warning and contraindication text indicates routine caution and monitoring.',
          evidence: `${entry.medName} | ${warningEvidence[0]}`,
        });
      }
    }
  });

  return fallbackFindings.slice(0, 6);
};

export const getMedlinePlusDrugInfoByRxCui = async (rxcui: string): Promise<MedlinePlusDrugInfo | null> => {
  const normalizedRxCui = clean(rxcui);
  if (!normalizedRxCui) return null;

  const url = `${MEDLINEPLUS_CONNECT_URL}?mainSearchCriteria.v.cs=${encodeURIComponent('2.16.840.1.113883.6.88')}&mainSearchCriteria.v.c=${encodeURIComponent(normalizedRxCui)}&knowledgeResponseType=${encodeURIComponent('application/json')}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const payload = await response.json();
    const entries = Array.isArray(payload?.feed?.entry)
      ? payload.feed.entry
      : payload?.feed?.entry
      ? [payload.feed.entry]
      : [];

    const allTextLines = entries
      .flatMap((entry: any) => {
        const titleLines = toLines(entry?.title);
        const summaryLines = toLines(entry?.summary);
        const contentLines = toLines(entry?.content);
        return [...titleLines, ...summaryLines, ...contentLines];
      })
      .map(line => clean(line))
      .filter(Boolean)
      .filter(line => line.length >= 20)
      .slice(0, 40);

    const uniqueLines: string[] = Array.from(new Set<string>(allTextLines));
    const foodInteractionLines = uniqueLines
      .filter(line => /(food|meal|eat|diet|drink|alcohol|grapefruit|empty stomach|with food|without food)/i.test(line))
      .slice(0, 4);

    const plainEnglishLines = uniqueLines.slice(0, 5);
    const sourceUrl = entries
      .flatMap((entry: any) => toLines(entry?.link))
      .find((value: string) => value.startsWith('http'));

    if (foodInteractionLines.length === 0 && plainEnglishLines.length === 0) return null;

    return {
      rxcui: normalizedRxCui,
      foodInteractionLines,
      plainEnglishLines,
      sourceUrl,
    };
  } catch {
    return null;
  }
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

const RXNORM_RELATED_TTY_PRIORITY = ['IN', 'PIN', 'MIN', 'SCD', 'SBD', 'SCDC', 'SBDC'];

const extractPreferredRelatedRxCui = (payload: any): string | null => {
  const groups = Array.isArray(payload?.allRelatedGroup?.conceptGroup) ? payload.allRelatedGroup.conceptGroup : [];

  for (const tty of RXNORM_RELATED_TTY_PRIORITY) {
    const match = groups.find((group: any) => group?.tty === tty && Array.isArray(group?.conceptProperties) && group.conceptProperties.length > 0);
    const rxcui = clean(match?.conceptProperties?.[0]?.rxcui);
    if (rxcui) return rxcui;
  }

  return null;
};

const fetchRxNormAllRelated = async (rxcui: string): Promise<any | null> => {
  try {
    const response = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui/${encodeURIComponent(rxcui)}/allrelated.json`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const getOncHighPairInteractions = async (rxcuiA: string, rxcuiB: string): Promise<RxNavInteraction[]> => {
  const seen = new Set<string>();
  const output: RxNavInteraction[] = [];

  const collectFor = async (anchor: string, other: string) => {
    try {
      const response = await fetch(
        `https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui=${encodeURIComponent(anchor)}&sources=ONCHigh`,
      );
      if (!response.ok) return;

      const payload = await response.json();
      const groups = Array.isArray(payload?.interactionTypeGroup) ? payload.interactionTypeGroup : [];

      groups.forEach((group: any) => {
        (Array.isArray(group?.interactionType) ? group.interactionType : []).forEach((item: any) => {
          (Array.isArray(item?.interactionPair) ? item.interactionPair : []).forEach((pair: any) => {
            const concepts = Array.isArray(pair?.interactionConcept) ? pair.interactionConcept : [];
            const rxcuis = concepts.map((concept: any) => clean(concept?.minConceptItem?.rxcui)).filter(Boolean);
            if (!rxcuis.includes(anchor) || !rxcuis.includes(other)) return;

            const description = clean(pair?.description || item?.comment);
            if (!description) return;

            const severity = normalizeSeverity(pair?.severity || item?.severity || item?.minConcept?.tty);
            const key = `${severity}:${description}`;
            if (seen.has(key)) return;
            seen.add(key);
            output.push({ severity, description });
          });
        });
      });
    } catch {
      // Ignore ONCHigh enrichment errors and keep core RxNav output.
    }
  };

  await Promise.all([collectFor(rxcuiA, rxcuiB), collectFor(rxcuiB, rxcuiA)]);
  return output.slice(0, 6);
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
  const normalizedDrugName = clean(drugName);
  if (!normalizedDrugName) return null;

  const getRawRxCui = async (name: string, includeApproximate: boolean) => {
    try {
      const query = includeApproximate
        ? `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}&search=1`
        : `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`;
      const response = await fetch(query);
      if (!response.ok) return null;
      const data = await response.json();
      return clean(data?.idGroup?.rxnormId?.[0]) || null;
    } catch {
      return null;
    }
  };

  const rawRxCui = (await getRawRxCui(normalizedDrugName, true)) || (await getRawRxCui(normalizedDrugName, false));
  if (!rawRxCui) return null;

  const related = await fetchRxNormAllRelated(rawRxCui);
  const preferred = extractPreferredRelatedRxCui(related);
  return preferred || rawRxCui;
};

export const getRxNormAllRelatedInfo = async (rxcui: string): Promise<Array<{ tty: string; rxcui: string; name: string }>> => {
  const normalizedRxCui = clean(rxcui);
  if (!normalizedRxCui) return [];

  const related = await fetchRxNormAllRelated(normalizedRxCui);
  const groups = Array.isArray(related?.allRelatedGroup?.conceptGroup) ? related.allRelatedGroup.conceptGroup : [];

  return groups
    .flatMap((group: any) => {
      const tty = clean(group?.tty);
      if (!tty || !Array.isArray(group?.conceptProperties)) return [];

      return group.conceptProperties
        .map((entry: any) => ({
          tty,
          rxcui: clean(entry?.rxcui),
          name: clean(entry?.name),
        }))
        .filter((entry: { tty: string; rxcui: string; name: string }) => !!entry.rxcui && !!entry.name);
    })
    .slice(0, 40);
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

  const onchighItems = await getOncHighPairInteractions(rxcuiA, rxcuiB);
  const merged = [...onchighItems, ...output];
  const deduped = new Map<string, RxNavInteraction>();
  merged.forEach(item => {
    const key = `${item.severity}:${item.description.toLowerCase()}`;
    if (!deduped.has(key)) deduped.set(key, item);
  });

  return Array.from(deduped.values()).slice(0, 12);
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
  const label = await fetchDailyMedLabelPayload(drugName);
  if (!label) return null;

  return {
    warnings: getDailyMedSectionLines(label, ['warnings', 'warnings_and_cautions', 'warningsandcautions', 'boxed_warning', 'boxedwarning'], 3),
    contraindications: getDailyMedSectionLines(label, ['contraindications'], 3),
    foodInteractions: getDailyMedSectionLines(label, ['food_interactions', 'foodinteractions', 'drug_and_food_interactions', 'drugfoodinteractions'], 3),
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
      summary: 'DailyMed label data was not available for this medication query, so no warning-level classification was applied.',
      evidence: [],
    };
  }

  const combined = [...safety.foodInteractions, ...safety.warnings, ...safety.contraindications];
  const normalizedFood = foodQuery.toLowerCase();
  const hits = combined.filter(item => item.toLowerCase().includes(normalizedFood));

  if (hits.length === 0) {
    return {
      severity: 'safe' as const,
      summary: 'No direct food-specific warnings matched your query in DailyMed label sections.',
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
  if (!input.missed.length) return null;

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
      const label = await fetchDailyMedLabelPayload(medName);
      const boxedWarnings = getDailyMedSectionLines(label, ['boxed_warning', 'boxedwarning'], 2);
      const warnings = getDailyMedSectionLines(label, ['warnings', 'warnings_and_cautions', 'warningsandcautions'], 2);

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
      source: 'DailyMed',
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
        source: 'DailyMed',
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
      source: 'DailyMed + Groq',
    };
  } catch {
    return {
      severity,
      summary,
      guidance: defaultGuidance,
      riskProgression,
      missesUntilWorse,
      source: 'DailyMed',
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

  {
    const label = await fetchDailyMedLabelPayload(input.medication.drugName);
    const dosageLines = getDailyMedSectionLines(label, ['dosage_and_administration', 'dosageandadministration', 'dosage', 'administration'], 3);

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
      source = 'DailyMed';
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
      source: source === 'DailyMed' ? 'DailyMed + Groq' : 'Schedule Rule + Groq',
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

  const normalizedMedicines = input.medicines
    .map(item => ({
      name: clean(item.name),
      dosage: clean(item.dosage),
      frequency: clean(item.frequency),
    }))
    .filter(item => item.name)
    .slice(0, 6);

  if (normalizedMedicines.length === 0) return null;

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

  const fdaGroundingByMedicine = await Promise.all(
    normalizedMedicines.map(async med => {
      const label = await fetchDailyMedLabelPayload(med.name);
      const boxedWarningLines = getDailyMedSectionLines(label, ['boxed_warning', 'boxedwarning'], 2);
      const warningLines = getDailyMedSectionLines(label, ['warnings_and_cautions', 'warningsandcautions', 'warnings'], 2);
      const contraindicationLines = getDailyMedSectionLines(label, ['contraindications'], 2);
      const dosageLines = getDailyMedSectionLines(label, ['dosage_and_administration', 'dosageandadministration', 'dosage', 'administration'], 4);
      const faersSignals = await fetchFaersReactionSignals(med.name);
      const totalFaersCount = faersSignals.reduce((sum, signal) => sum + signal.count, 0);
      const overdoseSignals = faersSignals.filter(signal => isOverdoseRelatedReaction(signal.reaction));
      const nonOverdoseSignals = faersSignals.filter(signal => !isOverdoseRelatedReaction(signal.reaction));
      const overdoseShare =
        totalFaersCount > 0
          ? overdoseSignals.reduce((sum, signal) => sum + signal.count, 0) / totalFaersCount
          : 0;

      const doseContext = classifyDoseRange({
        dosage: med.dosage,
        frequency: med.frequency,
        dosageLines,
      });

      const filteredSignals =
        doseContext.status === 'within-range'
          ? nonOverdoseSignals
          : faersSignals;

      return {
        medName: med.name,
        dosage: med.dosage,
        frequency: med.frequency,
        boxedWarningLines,
        warningLines,
        contraindicationLines,
        dosageLines,
        faersSignals,
        filteredSignals,
        totalFaersCount,
        overdoseShare,
        doseContext,
      };
    }),
  );

  const hasBoxedWarning = fdaGroundingByMedicine.some(entry => entry.boxedWarningLines.length > 0);
  const hasWarningsNoBoxed = fdaGroundingByMedicine.some(
    entry => entry.boxedWarningLines.length === 0 && (entry.warningLines.length > 0 || entry.contraindicationLines.length > 0),
  );
  const hasTherapeuticSignals = fdaGroundingByMedicine.some(
    entry => entry.doseContext.status === 'within-range' && entry.filteredSignals.length > 0,
  );
  const faersPrimarilyOverdose = fdaGroundingByMedicine.some(entry => entry.overdoseShare >= 0.6);

  const riskFromRule: DrugAllergyProfileInsight['overallRisk'] =
    hasBoxedWarning && hasTherapeuticSignals
      ? 'high'
      : hasWarningsNoBoxed || faersPrimarilyOverdose
      ? 'moderate'
      : hasBoxedWarning
      ? 'moderate'
      : 'low';

  const fdaEvidenceLines = fdaGroundingByMedicine
    .flatMap(entry => [
      ...entry.boxedWarningLines.map(line => `${entry.medName} | boxed_warning: ${line}`),
      ...entry.warningLines.map(line => `${entry.medName} | warnings_and_cautions: ${line}`),
      ...entry.contraindicationLines.map(line => `${entry.medName} | contraindications: ${line}`),
    ])
    .slice(0, 16);

  const doseEvidenceLines = fdaGroundingByMedicine
    .map(entry => {
      const doseStatusText =
        entry.doseContext.status === 'within-range'
          ? 'Patient dose appears within DailyMed therapeutic range.'
          : entry.doseContext.status === 'above-range'
          ? 'Patient dose may exceed DailyMed therapeutic range and needs clinician review.'
          : 'Therapeutic range could not be confirmed from available DailyMed dosage text.';

      const patientDoseText = entry.dosage
        ? `Recorded dose: ${entry.dosage}${entry.frequency ? `, frequency: ${entry.frequency}` : ''}.`
        : 'Recorded dose not provided.';

      const referenceText =
        entry.doseContext.maxDailyMg !== null
          ? `DailyMed reference: max ${entry.doseContext.maxDailyMg} mg/day.`
          : entry.doseContext.perDoseRange
          ? `DailyMed reference: ${entry.doseContext.perDoseRange.min}-${entry.doseContext.perDoseRange.max} mg per dose.`
          : 'DailyMed reference: explicit numeric therapeutic range not detected.';

      return `${entry.medName} | dose_context: ${patientDoseText} ${referenceText} ${doseStatusText}`;
    })
    .slice(0, 12);

  const faersEvidenceLines = fdaGroundingByMedicine
    .flatMap(entry =>
      (entry.filteredSignals.length > 0 ? entry.filteredSignals : entry.faersSignals).map(signal => {
        const reactionClass = isOverdoseRelatedReaction(signal.reaction) ? 'overdose/misuse-associated' : 'non-overdose signal';
        const reactionLabel = getFaersReactionDisplayLabel(signal.reaction);
        if (isDeathReaction(signal.reaction)) {
          return `${entry.medName} | FAERS reaction category: ${reactionLabel} | signal_type: ${reactionClass} | reported in retrieved FAERS lifetime submissions`;
        }
        const shareText = toPercent(signal.count, entry.totalFaersCount || 0);
        return `${entry.medName} | FAERS reaction category: ${reactionLabel} | signal_type: ${reactionClass} | reporting share among retrieved FAERS lifetime submissions: ${shareText}`;
      }),
    )
    .slice(0, 18);

  const prompt = [
    'You are a calm medication safety explainer focused on allergy and comorbidity-aware checks.',
    'Use only FDA evidence lines as medical grounding: DailyMed label sections, dose-context lines, and filtered FAERS reaction categories.',
    'Do not invent adverse effects or contraindications not present in FDA lines.',
    'Interpret FAERS as lifetime spontaneous-reporting signal frequency, not proven causality and not personal risk.',
    'Never present raw FAERS counts as absolute risk scores.',
    'Keep language reassuring, practical, and non-alarming for normal prescribed use.',
    'If FDA evidence is unavailable for a medicine, clearly state evidence limitation instead of speculating.',
    `Overall risk is already pre-classified as ${riskFromRule}. Do not change it.`,
    'When dose context is within therapeutic range, deprioritize overdose-only reactions.',
    `Write summary, findings[].title, findings[].detail, findings[].evidence, and recommendations in ${outputLanguage}.`,
    'Keep medication names and medical terminology in English.',
    'Explain in simple patient language while staying faithful to FDA evidence text.',
    'Return strict JSON only with this exact shape:',
    '{"overallRisk":"high|moderate|low|none","summary":"...","findings":[{"severity":"high|moderate|low","title":"...","detail":"...","evidence":"..."}],"recommendations":["..."]}',
    `Current medicines: ${normalizedMedicines.map(item => item.name).join(', ')}`,
    `Patient profile: gender=${normalizedGender || 'Not specified'}, blood_group=${normalizedBloodGroup || 'Not specified'}`,
    `Chronic diseases: ${normalizedChronic.join(', ') || 'None'}`,
    `Infection history: ${normalizedInfections.join(', ') || 'None'}`,
    `Allergies: ${normalizedAllergies.map(item => `${item.category}${item.trigger ? `(${item.trigger})` : ''}`).join(', ') || 'None'}`,
    `DailyMed label evidence lines: ${fdaEvidenceLines.length > 0 ? fdaEvidenceLines.join(' | ') : 'No DailyMed warnings_and_cautions/contraindications evidence available for these medicines.'}`,
    `Dose context evidence lines: ${doseEvidenceLines.length > 0 ? doseEvidenceLines.join(' | ') : 'No usable DailyMed dosage context lines available.'}`,
    `FDA FAERS evidence lines: ${faersEvidenceLines.length > 0 ? faersEvidenceLines.join(' | ') : 'No FAERS reaction category evidence available for these medicines.'}`,
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

    const overallRisk: DrugAllergyProfileInsight['overallRisk'] = riskFromRule;

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

    const normalizedFindings = (findings.length > 0 ? findings : buildFallbackFindingsFromEvidence(fdaGroundingByMedicine))
      .map(item => {
        const category = classifyFindingCategory(item);
        const title = stripExactPercentageUnavailableText(normalizePainLabelText(item.title));
        const detail = stripExactPercentageUnavailableText(normalizePainLabelText(item.detail));
        const evidence = normalizeIneffectiveEvidenceSentence(
          stripExactPercentageUnavailableText(normalizePainLabelText(item.evidence)),
        );
        if (category === 'death') {
          return {
            ...item,
            title: stripPercentages(title),
            detail: stripPercentages(detail),
            evidence: stripPercentages(evidence),
          };
        }
        return {
          ...item,
          title,
          detail,
          evidence,
        };
      })
      .filter(item => item.title || item.detail || item.evidence);

    const hasAnyDeathSignal = fdaGroundingByMedicine.some(entry =>
      (entry.filteredSignals.length > 0 ? entry.filteredSignals : entry.faersSignals).some(signal => isDeathReaction(signal.reaction)),
    );

    const shouldSuppressStandaloneDeath = !hasBoxedWarning && hasAnyDeathSignal;

    const misuseDependenceNote = 'Note: Dependence risk is associated with misuse or overdose, not normal prescribed use.';

    let findingsWithoutMisuseDependence = normalizedFindings;
    if (!hasBoxedWarning) {
      const hasMisuseDependenceCard = normalizedFindings.some(item => isOverdoseAssociatedDependenceFinding(item));
      if (hasMisuseDependenceCard) {
        findingsWithoutMisuseDependence = normalizedFindings.filter(item => !isOverdoseAssociatedDependenceFinding(item));
      }
    }

    let filteredAndOrderedFindings = findingsWithoutMisuseDependence
      .filter(item => !(shouldSuppressStandaloneDeath && classifyFindingCategory(item) === 'death'))
      .sort((a, b) => {
        if (hasBoxedWarning) return 0;
        const priority = (kind: string) => {
          if (kind === 'overdose') return 0;
          if (kind === 'ineffective') return 1;
          if (kind === 'other') return 2;
          return 3;
        };
        return priority(classifyFindingCategory(a)) - priority(classifyFindingCategory(b));
      })
      .slice(0, 6);

    if (!hasBoxedWarning && normalizedFindings.some(item => isOverdoseAssociatedDependenceFinding(item))) {
      const overdoseIndex = filteredAndOrderedFindings.findIndex(item => classifyFindingCategory(item) === 'overdose');
      if (overdoseIndex >= 0) {
        const target = filteredAndOrderedFindings[overdoseIndex];
        if (!target.detail.includes(misuseDependenceNote)) {
          filteredAndOrderedFindings[overdoseIndex] = {
            ...target,
            detail: `${target.detail} ${misuseDependenceNote}`.trim(),
          };
        }
      }
    }

    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map((item: string) => clean(item)).filter(Boolean).slice(0, 5)
      : [];

    const contextNotes: string[] = [];
    if (shouldSuppressStandaloneDeath) {
      contextNotes.push('Serious outcomes including hospitalisation have been reported rarely, typically in patients with pre-existing conditions or complex health situations.');
    }
    if (!hasBoxedWarning && normalizedFindings.some(item => isOverdoseAssociatedDependenceFinding(item))) {
      const hasOverdoseCard = filteredAndOrderedFindings.some(item => classifyFindingCategory(item) === 'overdose');
      if (!hasOverdoseCard) contextNotes.push(misuseDependenceNote);
    }
    const contextNote = contextNotes.length > 0 ? contextNotes.join(' ') : undefined;

    return {
      overallRisk,
      summary:
        clean(parsed.summary) ||
        (overallRisk === 'high'
          ? 'Some higher-priority label-based concerns need clinician review, even when doses are recorded as prescribed.'
          : overallRisk === 'moderate'
          ? 'Current evidence suggests caution and routine monitoring, with focus on label warnings and dose context.'
          : 'Current evidence suggests low risk for normal prescribed use, with routine monitoring advised.'),
      findings: filteredAndOrderedFindings,
      recommendations,
      contextNote,
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
  const medicineUses = (input.medicineUses || []).map(item => clean(item)).filter(Boolean);

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
    'Only claim direct medicine-food interaction if supported by DailyMed evidence lines.',
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
    `Known medicine uses from local medicine dataset: ${medicineUses.join(', ') || 'None available'}`,
    `DailyMed evidence lines: ${evidenceLines.length > 0 ? evidenceLines.join(' | ') : 'None available'}`,
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
