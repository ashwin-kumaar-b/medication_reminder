const OPENFDA_API_KEY = import.meta.env.VITE_OPENFDA_API_KEY as string | undefined;
const USDA_API_KEY = import.meta.env.VITE_USDA_API_KEY as string | undefined;

export interface DrugSuggestion {
  name: string;
  rxcui: string;
}

export interface RxNavInteraction {
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

const clean = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();

export const searchRxNavSuggestions = async (term: string): Promise<DrugSuggestion[]> => {
  if (!term.trim()) return [];

  const response = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(term)}`);
  const data = await response.json();
  const groups = data?.drugGroup?.conceptGroup || [];

  const suggestions: DrugSuggestion[] = [];
  groups.forEach((group: any) => {
    const concepts = group?.conceptProperties || [];
    concepts.forEach((concept: any) => {
      if (!concept?.name || !concept?.rxcui) return;
      suggestions.push({ name: concept.name, rxcui: concept.rxcui });
    });
  });

  const deduped = new Map<string, DrugSuggestion>();
  suggestions.forEach(item => {
    const key = `${item.name.toLowerCase()}-${item.rxcui}`;
    if (!deduped.has(key)) deduped.set(key, item);
  });

  return Array.from(deduped.values()).slice(0, 8);
};

export const getRxCui = async (drugName: string): Promise<string | null> => {
  const response = await fetch(`https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(drugName)}`);
  const data = await response.json();
  return data?.idGroup?.rxnormId?.[0] || null;
};

export const getRxNavInteractions = async (rxcuiA: string, rxcuiB: string): Promise<RxNavInteraction[]> => {
  const response = await fetch(`https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${rxcuiA}+${rxcuiB}`);
  const data = await response.json();

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

export const getOpenFdaSafety = async (drugName: string): Promise<OpenFdaSafety | null> => {
  if (!OPENFDA_API_KEY) return null;

  const query = `openfda.brand_name:"${drugName}"+openfda.generic_name:"${drugName}"`;
  const response = await fetch(
    `https://api.fda.gov/drug/label.json?api_key=${encodeURIComponent(OPENFDA_API_KEY)}&search=${encodeURIComponent(query)}&limit=1`,
  );

  if (!response.ok) return null;

  const data = await response.json();
  const label = data?.results?.[0];
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
      severity: 'moderate' as const,
      summary: 'OpenFDA label data was not available for this medication query.',
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
