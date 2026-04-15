export type MedicationCategory =
  | 'blood-pressure'
  | 'diabetes'
  | 'thyroid'
  | 'antibiotic'
  | 'blood-thinner'
  | 'other';

export type CriticalityLevel = 'low' | 'medium' | 'high';
export type MedicationFrequency = 'daily' | 'twice' | 'weekly';
export type DoseStatus = 'pending' | 'taken' | 'delayed' | 'missed' | 'skipped';
export type RiskLevel = 'green' | 'yellow' | 'red';
export type RiskImpact = 'low' | 'moderate' | 'high';

const categoryEscalation: Record<MedicationCategory, RiskImpact[]> = {
  'blood-pressure': ['low', 'moderate', 'high'],
  diabetes: ['low', 'moderate', 'high'],
  thyroid: ['low', 'moderate', 'high'],
  antibiotic: ['moderate', 'high', 'high'],
  'blood-thinner': ['high', 'high', 'high'],
  other: ['low', 'moderate', 'high'],
};

const impactToRisk: Record<RiskImpact, RiskLevel> = {
  low: 'green',
  moderate: 'yellow',
  high: 'red',
};

export const getCategoryImpact = (category: MedicationCategory, missedCount: number): RiskImpact => {
  if (missedCount <= 0) return 'low';
  const thresholds = categoryEscalation[category];
  const index = Math.min(missedCount, thresholds.length) - 1;
  return thresholds[index];
};

export const getCategoryRiskLevel = (category: MedicationCategory, missedCount: number): RiskLevel => {
  return impactToRisk[getCategoryImpact(category, missedCount)];
};

export const getTimelineMilestones = (category: MedicationCategory) => {
  if (category === 'blood-thinner') {
    return [
      { label: 'Immediate attention', hours: 1, impact: 'high' as RiskImpact },
      { label: 'Escalated concern', hours: 6, impact: 'high' as RiskImpact },
      { label: 'Urgent follow-up', hours: 24, impact: 'high' as RiskImpact },
    ];
  }

  if (category === 'antibiotic') {
    return [
      { label: 'Low impact window', hours: 6, impact: 'low' as RiskImpact },
      { label: 'Moderate risk window', hours: 24, impact: 'moderate' as RiskImpact },
      { label: 'Elevated risk window', hours: 48, impact: 'high' as RiskImpact },
    ];
  }

  return [
    { label: 'Low impact window', hours: 6, impact: 'low' as RiskImpact },
    { label: 'Moderate risk window', hours: 24, impact: 'moderate' as RiskImpact },
    { label: 'Elevated risk window', hours: 48, impact: 'high' as RiskImpact },
  ];
};

export const getStabilityBand = (score: number): RiskLevel => {
  if (score >= 75) return 'green';
  if (score >= 45) return 'yellow';
  return 'red';
};

export const formatRiskLabel = (risk: RiskLevel) => {
  if (risk === 'green') return 'Stable';
  if (risk === 'yellow') return 'Fluctuating';
  return 'Unstable';
};
