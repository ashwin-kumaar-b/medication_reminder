import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) {
  console.error("GROQ_API_KEY is not defined in .env");
  process.exit(1);
}

async function callGroq(prompt: string): Promise<any> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      'model': 'llama-3.1-8b-instant',
      'temperature': 0.2,
      'max_tokens': 500,
      'response_format': { 'type': 'json_object' },
      'messages': [
        { 'role': 'system', 'content': 'You are a careful clinical medication safety assistant. Return strict JSON only.' },
        { 'role': 'user', 'content': prompt }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed: ${response.statusText}`);
  }

  const data = await response.json() as any;
  const content = data.choices[0].message.content;
  return JSON.parse(content.replace(/```json|```/g, '').trim());
}

async function runTests() {
  console.log("Starting automated safety tests for Patient 1 (Amit Sharma)...");

  // 1. Drug Interaction (Amlodipine + Ibuprofen) with CKD and Hypertension
  console.log("Running Test 1: Drug-Drug & Disease Interaction Checker...");
  const prompt1 = [
    'You are a clinical safety assistant for a medication reminder app.',
    'Provide a drug-to-drug interaction analysis between two medications, cross-referenced with the patient\'s health conditions.',
    'The user is taking: "Amlodipine" (for Hypertension) and "Ibuprofen" (for Pain Relief).',
    'Patient\'s chronic conditions: "Hypertension", "Chronic Kidney Disease (CKD)".',
    'Patient\'s allergies: "Sulfa Drugs".',
    'Evaluate the safety of this combination, especially in relation to the chronic kidney disease (NSAID renal risk).',
    'Return only JSON with this exact shape:',
    '{"severity":"high|moderate|low|safe|none","directive":"AVOID COMBINATION or CHOOSE ALTERNATIVE or MONITOR CLOSELY or SAFE","genericA":"Amlodipine","genericB":"Ibuprofen","summary":"...","explanation":"...","recommendations":["..."],"cautions":["..."]}'
  ].join('\n');

  let drugInteractionResult;
  try {
    drugInteractionResult = await callGroq(prompt1);
    console.log("Test 1 completed successfully.");
  } catch (e) {
    console.error("Test 1 failed:", e);
    drugInteractionResult = { error: String(e) };
  }

  // 2. Food Compatibility (Amlodipine + Grapefruit Juice)
  console.log("Running Test 2: Food Compatibility Checker...");
  const prompt2 = [
    'You are a clinical safety assistant for a medication reminder app.',
    'Analyze the food-drug compatibility between the food "Grapefruit Juice" and the medication "Amlodipine".',
    'Determine if they can be taken together and state if there are any timing restrictions.',
    'Return only JSON with this exact shape:',
    '{"severity":"high|moderate|safe","directive":"AVOID COMBINATION or LIMIT INTAKE or SAFE TO TAKE","genericDrug":"Amlodipine","summary":"...","explanation":"..."}'
  ].join('\n');

  let foodResult;
  try {
    foodResult = await callGroq(prompt2);
    console.log("Test 2 completed successfully.");
  } catch (e) {
    console.error("Test 2 failed:", e);
    foodResult = { error: String(e) };
  }

  // 3. Missed Dose Advice (Amlodipine, 8.0 hours late)
  console.log("Running Test 3: Missed Dose Recovery Advice...");
  const prompt3 = [
    'You are an expert clinical safety assistant for a medication reminder application.',
    'A patient missed their dose of Amlodipine.',
    'Medication details:',
    '- Name: Amlodipine',
    '- Dosage: 5mg',
    '- Frequency: DAILY',
    '- Criticality: HIGH',
    '- Food timing: after-food',
    '- Scheduled time: 08:00',
    '- Hours late: 8.0 hours (elapsed since scheduled time)',
    'Patient health profile:',
    '- Chronic conditions: Hypertension, Chronic Kidney Disease',
    '- Allergies: Sulfa Drugs',
    'Evaluate clinical safety to classify the recovery status as take_now, skip, or contact_doctor.',
    'Return only JSON with this exact shape:',
    '{',
    '  "status": "take_now" | "skip" | "contact_doctor",',
    '  "action": "Take Missed Dose Now" | "Skip Missed Dose & Wait" | "Contact Doctor / Pharmacist",',
    '  "rationale": "A clear, clinical explanation. It must analyze the drug, the hours late (8.0 hrs), and the patient\'s conditions/allergies. Detail the risk of missing vs double dosing.",',
    '  "doctor_warning": "Warning about when to consult a doctor." ',
    '}'
  ].join('\n');

  let missedDoseResult;
  try {
    missedDoseResult = await callGroq(prompt3);
    console.log("Test 3 completed successfully.");
  } catch (e) {
    console.error("Test 3 failed:", e);
    missedDoseResult = { error: String(e) };
  }

  // Output results to a Markdown artifact file
  const artifactContent = [
    `# Safety Agent Automated Audit Results - Patient 1`,
    ``,
    `Audit conducted for **Patient 1: Amit Sharma** (Hypertension, Chronic Kidney Disease, Sulfa Allergy).`,
    ``,
    `## 🧬 Test 1: Drug-Drug & Disease Interaction (Amlodipine + Ibuprofen)`,
    `\`\`\`json`,
    JSON.stringify(drugInteractionResult, null, 2),
    `\`\`\``,
    ``,
    `## 🍎 Test 2: Food Compatibility (Amlodipine + Grapefruit Juice)`,
    `\`\`\`json`,
    JSON.stringify(foodResult, null, 2),
    `\`\`\``,
    ``,
    `## ⏰ Test 3: Missed Dose Recovery Advice (Amlodipine - 8 Hours Late)`,
    `\`\`\`json`,
    JSON.stringify(missedDoseResult, null, 2),
    `\`\`\``
  ].join('\n');

  const artifactPath = path.join('C:', 'Users', 'deves', '.gemini', 'antigravity-ide', 'brain', 'c15d196a-165d-4687-9009-47a2fe9366d1', 'safety_test_results.md');
  fs.writeFileSync(artifactPath, artifactContent);
  console.log(`Successfully generated audit artifact at: ${artifactPath}`);
}

runTests();
