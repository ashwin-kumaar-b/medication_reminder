import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';

const projectRoot = process.cwd();
const rawDir = path.join(projectRoot, 'data', 'raw');
const processedDir = path.join(projectRoot, 'data', 'processed');

const indianCsvPath = path.join(rawDir, 'updated_indian_medicine_data.csv');
const detailsCsvPath = path.join(rawDir, 'Medicine_Details.csv');

const ensureDir = dirPath => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

const normalizeName = value =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const parseCsv = filePath =>
  new Promise((resolve, reject) => {
    const rows = [];
    fs.createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          relax_column_count: true,
          bom: true,
        }),
      )
      .on('data', row => rows.push(row))
      .on('error', reject)
      .on('end', () => resolve(rows));
  });

const splitTextList = value =>
  clean(value)
    .split(/\||,|;/)
    .map(item => clean(item))
    .filter(Boolean)
    .slice(0, 8);

const writeJson = (filePath, data) => {
  fs.writeFileSync(filePath, JSON.stringify(data));
};

const buildIndianBrandIndex = async () => {
  if (!fs.existsSync(indianCsvPath)) {
    throw new Error(`Missing file: ${indianCsvPath}`);
  }

  const rows = await parseCsv(indianCsvPath);
  const entries = [];
  const seenByNorm = new Set();

  rows.forEach(row => {
    const brand = clean(row.name);
    if (!brand) return;

    const brandNorm = normalizeName(brand);
    if (!brandNorm || seenByNorm.has(brandNorm)) return;

    const genericPrimary = clean(row.short_composition1 || row.salt_composition);
    const genericSecondary = clean(row.short_composition2);
    if (!genericPrimary && !genericSecondary) return;

    entries.push([brand, genericPrimary, genericSecondary]);
    seenByNorm.add(brandNorm);
  });

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'updated_indian_medicine_data.csv',
    totalEntries: entries.length,
    entries,
  };

  writeJson(path.join(processedDir, 'indian_brand_index.json'), output);
  return output.totalEntries;
};

const buildMedicineDetailsIndex = async () => {
  if (!fs.existsSync(detailsCsvPath)) {
    throw new Error(`Missing file: ${detailsCsvPath}`);
  }

  const rows = await parseCsv(detailsCsvPath);
  const entries = [];
  const seen = new Set();

  rows.forEach(row => {
    const medicineName = clean(row['Medicine Name']);
    if (!medicineName) return;

    const norm = normalizeName(medicineName);
    if (!norm || seen.has(norm)) return;

    const composition = clean(row['Composition']);
    const uses = splitTextList(row['Uses']);
    const sideEffects = splitTextList(row['Side_effects']);

    const substituteFieldKey = Object.keys(row).find(key => /substitute/i.test(key));
    const substitutes = substituteFieldKey ? splitTextList(row[substituteFieldKey]) : [];

    entries.push([medicineName, composition, uses, sideEffects, substitutes]);
    seen.add(norm);
  });

  const output = {
    generatedAt: new Date().toISOString(),
    source: 'Medicine_Details.csv',
    totalEntries: entries.length,
    entries,
  };

  writeJson(path.join(processedDir, 'medicine_details_index.json'), output);
  return output.totalEntries;
};

const run = async () => {
  ensureDir(processedDir);
  const indianCount = await buildIndianBrandIndex();
  const detailsCount = await buildMedicineDetailsIndex();

  console.log(`Built indian_brand_index.json with ${indianCount} entries.`);
  console.log(`Built medicine_details_index.json with ${detailsCount} entries.`);
};

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
