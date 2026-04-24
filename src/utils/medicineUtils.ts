export interface ParsedMedicineName {
  brandName: string;
  genericName: string;
}

export const parseMedicineName = (fullName: string): ParsedMedicineName => {
  const value = (fullName || '').trim();
  if (!value) {
    return { brandName: 'Medicine', genericName: '' };
  }

  const openIndex = value.lastIndexOf('[');
  const closeIndex = value.lastIndexOf(']');

  if (openIndex >= 0 && closeIndex > openIndex) {
    const brandName = value.slice(openIndex + 1, closeIndex).trim() || value;
    const genericName = value.slice(0, openIndex).trim();
    return { brandName, genericName };
  }

  return { brandName: value, genericName: '' };
};

export const trimGenericFormDescriptor = (genericName: string): string => {
  const value = (genericName || '').trim();
  if (!value) return '';

  // Keep active ingredient + strength, remove dosage-form tail like
  // "Oral Solution", "Extended Release Suspension", "Tablet", etc.
  return value
    .replace(/\s+((extended|immediate|delayed)\s+release\s+)?(oral\s+)?(tablet|solution|suspension|injection|capsule)\b.*$/i, '')
    .trim();
};
