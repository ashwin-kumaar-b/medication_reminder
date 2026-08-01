import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const groqKey = process.env.GROQ_API_KEY;
if (!groqKey) {
  console.error("GROQ_API_KEY is not defined in .env");
  process.exit(1);
}

async function callGroq70B(prompt: string): Promise<any> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a careful clinical medication safety assistant. Return strict JSON only.' },
        { role: 'user', content: prompt }
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq 70B request failed: ${response.statusText} - ${await response.text()}`);
  }

  const data = await response.json() as any;
  const content = data.choices[0].message.content;
  return JSON.parse(content.replace(/```json|```/g, '').trim());
}

interface TestCase {
  tier: string; // 'LOW (Normal)' | 'MEDIUM' | 'HIGH (Serious)'
  patientName: string;
  age: number;
  conditions: string[];
  allergies: string[];
  drugA: { name: string; dosage: string; frequency: string; time: string; criticality: string; purpose: string };
  drugB: { name: string; dosage: string; frequency: string; time: string; criticality: string; purpose: string };
  foodItem: string;
  missedDoseHoursLate: number;
}

const testCases: TestCase[] = [
  // TIER 1: LOW / NORMAL CRITICALITY
  {
    tier: 'LOW (Normal)',
    patientName: 'Suresh Kumar',
    age: 32,
    conditions: ['Seasonal Allergies'],
    allergies: ['Dust / Pollen'],
    drugA: { name: 'Cetirizine', dosage: '10mg (1 tablet)', frequency: 'DAILY', time: '22:00', criticality: 'low', purpose: 'Seasonal Allergies' },
    drugB: { name: 'Vitamin C', dosage: '500mg (1 tablet)', frequency: 'DAILY', time: '09:00', criticality: 'low', purpose: 'Immunity' },
    foodItem: 'Orange Juice',
    missedDoseHoursLate: 4.0,
  },
  // TIER 2: MEDIUM CRITICALITY
  {
    tier: 'MEDIUM',
    patientName: 'Sunita Sharma',
    age: 48,
    conditions: ['Osteoarthritis', 'Mild Gastritis'],
    allergies: ['Aspirin'],
    drugA: { name: 'Ibuprofen', dosage: '400mg (1 tablet)', frequency: 'TWICE', time: '08:00, 20:00', criticality: 'medium', purpose: 'Osteoarthritis' },
    drugB: { name: 'Omeprazole', dosage: '20mg (1 capsule)', frequency: 'DAILY', time: '07:00', criticality: 'medium', purpose: 'Mild Gastritis' },
    foodItem: 'Coffee / Caffeine',
    missedDoseHoursLate: 6.0,
  },
  // TIER 3: HIGH / SERIOUS CRITICALITY
  {
    tier: 'HIGH (Serious)',
    patientName: 'Rajesh Varma',
    age: 64,
    conditions: ['Atrial Fibrillation', 'Type 2 Diabetes', 'Hypertension'],
    allergies: ['Penicillin'],
    drugA: { name: 'Warfarin', dosage: '5mg (1 tablet)', frequency: 'DAILY', time: '21:00', criticality: 'high', purpose: 'Atrial Fibrillation' },
    drugB: { name: 'Metformin', dosage: '500mg (1 tablet)', frequency: 'TWICE', time: '08:00, 20:00', criticality: 'high', purpose: 'Type 2 Diabetes' },
    foodItem: 'Spinach',
    missedDoseHoursLate: 14.0,
  }
];

async function runComprehensiveMatrix() {
  console.log("==========================================================================");
  console.log("COMPREHENSIVE CLINICAL SAFETY TEST MATRIX ACROSS ALL 3 CRITICALITY TIERS");
  console.log("==========================================================================\n");

  const matrixResults: any[] = [];

  for (const tc of testCases) {
    console.log(`\n------------------------------------------------------------------`);
    console.log(`RUNNING TEST SUITE FOR: ${tc.patientName} [Criticality Tier: ${tc.tier}]`);
    console.log(`------------------------------------------------------------------`);

    // 1. Drug-Drug & Disease Interaction
    console.log(`1. Testing Drug-Drug & Disease Interaction (${tc.drugA.name} + ${tc.drugB.name})...`);
    const promptInteraction = [
      'You are a clinical safety assistant for a medication reminder app.',
      'Provide a drug-to-drug and drug-disease interaction analysis between two medications.',
      `The patient is taking: "${tc.drugA.name}" (Dosage: ${tc.drugA.dosage}, Criticality: ${tc.drugA.criticality}) and "${tc.drugB.name}" (Dosage: ${tc.drugB.dosage}, Criticality: ${tc.drugB.criticality}).`,
      `Patient Details: Name: ${tc.patientName}, Age: ${tc.age}.`,
      `Patient's chronic conditions: ${tc.conditions.join(', ')}.`,
      `Patient's allergies: ${tc.allergies.join(', ')}.`,
      'Evaluate clinical safety and potential interactions cross-referenced with chronic conditions.',
      'Return only JSON with this exact shape:',
      '{"severity":"high|moderate|low|safe|none","directive":"AVOID COMBINATION or CHOOSE ALTERNATIVE or MONITOR CLOSELY or SAFE","genericA":"...","genericB":"...","summary":"...","explanation":"...","recommendations":["..."],"cautions":["..."]}'
    ].join('\n');

    let interactionRes;
    try {
      interactionRes = await callGroq70B(promptInteraction);
      console.log(`   -> Interaction Test Passed.`);
    } catch (e) {
      console.error(`   -> Interaction Test Failed:`, e);
      interactionRes = { error: String(e) };
    }

    // 2. Food Compatibility
    console.log(`2. Testing Food Compatibility (${tc.drugA.name} + ${tc.foodItem})...`);
    const promptFood = [
      'You are a clinical safety assistant for a medication reminder app.',
      `Analyze the food-drug compatibility between the food "${tc.foodItem}" and the medication "${tc.drugA.name}" (Dosage & Unit: ${tc.drugA.dosage}).`,
      'Determine if they can be taken together and state if there are any timing restrictions.',
      'Return only JSON with this exact shape:',
      '{"severity":"high|moderate|safe","directive":"AVOID COMBINATION or LIMIT INTAKE or SAFE TO TAKE","genericDrug":"...","summary":"...","explanation":"..."}'
    ].join('\n');

    let foodRes;
    try {
      foodRes = await callGroq70B(promptFood);
      console.log(`   -> Food Compatibility Test Passed.`);
    } catch (e) {
      console.error(`   -> Food Compatibility Test Failed:`, e);
      foodRes = { error: String(e) };
    }

    // 3. Missed Dose Advice
    console.log(`3. Testing Missed Dose Advice (${tc.drugA.name} - ${tc.missedDoseHoursLate} Hours Late)...`);
    const promptMissed = [
      'You are an expert clinical safety assistant for a medication reminder application.',
      `A patient missed their dose of ${tc.drugA.name}.`,
      'Medication details:',
      `- Name: ${tc.drugA.name}`,
      `- Dosage & Unit: ${tc.drugA.dosage}`,
      `- Frequency: ${tc.drugA.frequency}`,
      `- Criticality: ${tc.drugA.criticality}`,
      `- Scheduled time: ${tc.drugA.time}`,
      `- Hours late: ${tc.missedDoseHoursLate} hours late`,
      'Patient health profile:',
      `- Chronic conditions: ${tc.conditions.join(', ')}`,
      `- Allergies: ${tc.allergies.join(', ')}`,
      'Evaluate clinical safety to classify the recovery status as take_now, skip, or contact_doctor.',
      'Return only JSON with this exact shape:',
      '{',
      '  "status": "take_now" | "skip" | "contact_doctor",',
      '  "action": "Take Missed Dose Now" | "Skip Missed Dose & Wait" | "Contact Doctor / Pharmacist",',
      '  "rationale": "...",',
      '  "doctor_warning": "..." ',
      '}'
    ].join('\n');

    let missedRes;
    try {
      missedRes = await callGroq70B(promptMissed);
      console.log(`   -> Missed Dose Advice Test Passed.`);
    } catch (e) {
      console.error(`   -> Missed Dose Advice Test Failed:`, e);
      missedRes = { error: String(e) };
    }

    matrixResults.push({
      testCase: tc,
      interactionRes,
      foodRes,
      missedRes,
    });
  }

  // Generate Report
  const reportLines = [
    `# 🏥 Comprehensive Clinical AI Testing Matrix Report`,
    ``,
    `Tested across **All 3 Criticality Tiers** (Low/Normal, Medium, High/Serious) using **Meta Llama-3.3-70B-Versatile**.`,
    ``,
    `---`,
    ``
  ];

  for (const item of matrixResults) {
    const tc: TestCase = item.testCase;
    reportLines.push(`## Tier: ${tc.tier} - Patient: ${tc.patientName} (Age ${tc.age})`);
    reportLines.push(`- **Chronic Conditions**: ${tc.conditions.join(', ')}`);
    reportLines.push(`- **Allergies**: ${tc.allergies.join(', ')}`);
    reportLines.push(`- **Primary Medication**: ${tc.drugA.name} (${tc.drugA.dosage}, ${tc.drugA.frequency}, Criticality: ${tc.drugA.criticality.toUpperCase()})`);
    reportLines.push(`- **Secondary Medication**: ${tc.drugB.name} (${tc.drugB.dosage}, ${tc.drugB.frequency}, Criticality: ${tc.drugB.criticality.toUpperCase()})`);
    reportLines.push(``);
    reportLines.push(`### 1. Drug Interaction (${tc.drugA.name} + ${tc.drugB.name})`);
    reportLines.push(`\`\`\`json\n${JSON.stringify(item.interactionRes, null, 2)}\n\`\`\``);
    reportLines.push(``);
    reportLines.push(`### 2. Food Compatibility (${tc.drugA.name} + ${tc.foodItem})`);
    reportLines.push(`\`\`\`json\n${JSON.stringify(item.foodRes, null, 2)}\n\`\`\``);
    reportLines.push(``);
    reportLines.push(`### 3. Missed Dose Advice (${tc.drugA.name} - ${tc.missedDoseHoursLate} Hours Late)`);
    reportLines.push(`\`\`\`json\n${JSON.stringify(item.missedRes, null, 2)}\n\`\`\``);
    reportLines.push(``);
    reportLines.push(`---`);
    reportLines.push(``);
  }

  const artifactPath = path.join('C:', 'Users', 'deves', '.gemini', 'antigravity-ide', 'brain', 'c15d196a-165d-4687-9009-47a2fe9366d1', 'criticality_testing_matrix.md');
  fs.writeFileSync(artifactPath, reportLines.join('\n'));
  console.log(`\n==========================================================================`);
  console.log(`Full Matrix Audit Report successfully saved at:\n${artifactPath}`);
  console.log(`==========================================================================`);
}

runComprehensiveMatrix();
