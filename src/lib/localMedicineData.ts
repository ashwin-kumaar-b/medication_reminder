type IndianBrandEntry = [brand: string, genericPrimary: string, genericSecondary: string];

type IndianBrandIndexPayload = {
  generatedAt: string;
  source: string;
  totalEntries: number;
  entries: IndianBrandEntry[];
};

type MedicineDetailsEntry = [
  medicineName: string,
  composition: string,
  uses: string[],
  sideEffects: string[],
  substitutes: string[],
];

type MedicineDetailsIndexPayload = {
  generatedAt: string;
  source: string;
  totalEntries: number;
  entries: MedicineDetailsEntry[];
};

export type BrandResolutionMatchType = 'exact' | 'normalized' | 'fuzzy' | 'passthrough';

export interface BrandResolution {
  input: string;
  genericName: string;
  displayName: string;
  matchedBrand?: string;
  matchType: BrandResolutionMatchType;
}

export interface MedicineDetailsInfo {
  medicineName: string;
  composition: string;
  uses: string[];
  sideEffects: string[];
  substitutes: string[];
}

const clean = (value?: string) => (value || '').replace(/\s+/g, ' ').trim();

const normalizeName = (value: string) => clean(value).toLowerCase().replace(/[^a-z0-9]/g, '');

const buildGenericName = (primary?: string, secondary?: string) => {
  const one = clean(primary);
  const two = clean(secondary);

  if (one && two && one.toLowerCase() !== two.toLowerCase()) {
    return `${one} + ${two}`;
  }

  return one || two;
};

let indianIndexPromise: Promise<IndianBrandIndexPayload | null> | null = null;
let detailsIndexPromise: Promise<MedicineDetailsIndexPayload | null> | null = null;

let indianEntriesCache: Array<{ brand: string; brandLower: string; brandNorm: string; generic: string }> | null = null;
let indianExactMapCache: Map<string, { brand: string; generic: string; brandNorm: string }> | null = null;
let indianNormMapCache: Map<string, { brand: string; generic: string }> | null = null;
let indianPrefixBucketCache: Map<string, Array<{ brand: string; generic: string; brandNorm: string }>> | null = null;

let detailsMapCache: Map<string, MedicineDetailsInfo> | null = null;
let detailsNormMapCache: Map<string, MedicineDetailsInfo> | null = null;

const loadIndianIndex = () => {
  if (!indianIndexPromise) {
    indianIndexPromise = fetch('/data/processed/indian_brand_index.json')
      .then(response => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return indianIndexPromise;
};

const loadDetailsIndex = () => {
  if (!detailsIndexPromise) {
    detailsIndexPromise = fetch('/data/processed/medicine_details_index.json')
      .then(response => (response.ok ? response.json() : null))
      .catch(() => null);
  }
  return detailsIndexPromise;
};

const initIndianLookup = async () => {
  if (indianEntriesCache && indianExactMapCache && indianNormMapCache && indianPrefixBucketCache) {
    return;
  }

  const payload = await loadIndianIndex();
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];

  const prepared: Array<{ brand: string; brandLower: string; brandNorm: string; generic: string }> = [];
  const exact = new Map<string, { brand: string; generic: string; brandNorm: string }>();
  const norm = new Map<string, { brand: string; generic: string }>();
  const prefixBuckets = new Map<string, Array<{ brand: string; generic: string; brandNorm: string }>>();

  entries.forEach(raw => {
    const brand = clean(raw[0]);
    if (!brand) return;

    const generic = buildGenericName(raw[1], raw[2]);
    if (!generic) return;

    const brandLower = brand.toLowerCase();
    const brandNorm = normalizeName(brand);
    if (!brandNorm) return;

    const entry = { brand, brandLower, brandNorm, generic };
    prepared.push(entry);

    if (!exact.has(brandLower)) {
      exact.set(brandLower, { brand, generic, brandNorm });
    }

    if (!norm.has(brandNorm)) {
      norm.set(brandNorm, { brand, generic });
    }

    const prefix = brandNorm.slice(0, 3) || brandNorm;
    if (!prefixBuckets.has(prefix)) {
      prefixBuckets.set(prefix, []);
    }
    prefixBuckets.get(prefix)?.push(entry);
  });

  indianEntriesCache = prepared;
  indianExactMapCache = exact;
  indianNormMapCache = norm;
  indianPrefixBucketCache = prefixBuckets;
};

const initDetailsLookup = async () => {
  if (detailsMapCache && detailsNormMapCache) return;

  const payload = await loadDetailsIndex();
  const entries = Array.isArray(payload?.entries) ? payload.entries : [];

  const exact = new Map<string, MedicineDetailsInfo>();
  const norm = new Map<string, MedicineDetailsInfo>();

  entries.forEach(raw => {
    const medicineName = clean(raw[0]);
    if (!medicineName) return;

    const info: MedicineDetailsInfo = {
      medicineName,
      composition: clean(raw[1]),
      uses: Array.isArray(raw[2]) ? raw[2].map(item => clean(item)).filter(Boolean) : [],
      sideEffects: Array.isArray(raw[3]) ? raw[3].map(item => clean(item)).filter(Boolean) : [],
      substitutes: Array.isArray(raw[4]) ? raw[4].map(item => clean(item)).filter(Boolean) : [],
    };

    const lower = medicineName.toLowerCase();
    const normalized = normalizeName(medicineName);

    if (!exact.has(lower)) {
      exact.set(lower, info);
    }
    if (normalized && !norm.has(normalized)) {
      norm.set(normalized, info);
    }
  });

  detailsMapCache = exact;
  detailsNormMapCache = norm;
};

const levenshteinDistance = (a: string, b: string, maxDistance = 2) => {
  const lenA = a.length;
  const lenB = b.length;

  if (Math.abs(lenA - lenB) > maxDistance) return maxDistance + 1;

  const prev = new Array(lenB + 1);
  const curr = new Array(lenB + 1);

  for (let j = 0; j <= lenB; j += 1) prev[j] = j;

  for (let i = 1; i <= lenA; i += 1) {
    curr[0] = i;
    let minInRow = curr[0];

    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      if (curr[j] < minInRow) minInRow = curr[j];
    }

    if (minInRow > maxDistance) return maxDistance + 1;

    for (let j = 0; j <= lenB; j += 1) prev[j] = curr[j];
  }

  return prev[lenB];
};

export const resolveIndianBrandToGeneric = async (
  input: string,
  options?: { enableFuzzy?: boolean },
): Promise<BrandResolution> => {
  const raw = clean(input);
  if (!raw) {
    return {
      input,
      displayName: input,
      genericName: input,
      matchType: 'passthrough',
    };
  }

  await initIndianLookup();
  const exactMap = indianExactMapCache || new Map();
  const normMap = indianNormMapCache || new Map();
  const prefixBuckets = indianPrefixBucketCache || new Map();

  const lower = raw.toLowerCase();
  const normalized = normalizeName(raw);

  const exact = exactMap.get(lower);
  if (exact) {
    return {
      input,
      displayName: raw,
      genericName: exact.generic,
      matchedBrand: exact.brand,
      matchType: 'exact',
    };
  }

  const normalizedMatch = normalized ? normMap.get(normalized) : null;
  if (normalizedMatch) {
    return {
      input,
      displayName: raw,
      genericName: normalizedMatch.generic,
      matchedBrand: normalizedMatch.brand,
      matchType: 'normalized',
    };
  }

  if (options?.enableFuzzy !== false && normalized) {
    const prefix = normalized.slice(0, 3) || normalized;
    const candidates = prefixBuckets.get(prefix) || [];

    let best: { brand: string; generic: string; brandNorm: string; distance: number } | null = null;

    candidates.forEach(candidate => {
      if (Math.abs(candidate.brandNorm.length - normalized.length) > 2) return;
      const distance = levenshteinDistance(normalized, candidate.brandNorm, 2);
      if (distance > 2) return;

      if (!best || distance < best.distance || (distance === best.distance && candidate.brandNorm.length < best.brandNorm.length)) {
        best = { ...candidate, distance };
      }
    });

    if (best) {
      return {
        input,
        displayName: raw,
        genericName: best.generic,
        matchedBrand: best.brand,
        matchType: 'fuzzy',
      };
    }
  }

  return {
    input,
    displayName: raw,
    genericName: raw,
    matchType: 'passthrough',
  };
};

export const getMedicineDetailsByName = async (name: string): Promise<MedicineDetailsInfo | null> => {
  const raw = clean(name);
  if (!raw) return null;

  await initDetailsLookup();
  const exact = detailsMapCache || new Map();
  const norm = detailsNormMapCache || new Map();

  const direct = exact.get(raw.toLowerCase());
  if (direct) return direct;

  const normalized = normalizeName(raw);
  if (!normalized) return null;

  const normalizedMatch = norm.get(normalized);
  if (normalizedMatch) return normalizedMatch;

  const reduced = normalized.replace(/\d+mg|\d+ml|\d+mcg|\d+iu/g, '');
  if (reduced && reduced !== normalized) {
    const reducedMatch = norm.get(reduced);
    if (reducedMatch) return reducedMatch;
  }

  return null;
};

export const preloadLocalMedicineData = async () => {
  await Promise.all([initIndianLookup(), initDetailsLookup()]);
};
