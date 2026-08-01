import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const groqKey = process.env.GROQ_API_KEY;
const geminiKey = process.env.GEMINI_API_KEY;

async function callGroqModel(model: string, prompt: string): Promise<any> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqKey}`,
    },
    body: JSON.stringify({
      model: model,
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
    throw new Error(`Groq ${model} request failed: ${response.statusText} - ${await response.text()}`);
  }

  const data = await response.json() as any;
  const content = data.choices[0].message.content;
  return JSON.parse(content.replace(/```json|```/g, '').trim());
}

async function callGeminiModel(model: string, prompt: string): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey!)}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 600,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini ${model} failed: ${response.statusText} - ${await response.text()}`);
  }

  const data = await response.json() as any;
  const rawText = data.candidates[0].content.parts[0].text;
  return JSON.parse(rawText.replace(/```json|```/g, '').trim());
}

async function runBenchmark() {
  console.log("==================================================================");
  console.log("BENCHMARKING HEALTH & PHARMACOLOGY AI MODELS FOR CLINICAL DEPTH");
  console.log("==================================================================\n");

  const promptInteraction = [
    'You are a clinical safety assistant for a medication reminder app.',
    'Provide a thorough drug-to-drug and drug-disease interaction analysis between two medications, cross-referenced with the patient\'s health conditions.',
    'The user is taking: "Amlodipine" (for Hypertension) and "Ibuprofen" (for Pain Relief).',
    'Patient\'s chronic conditions: "Hypertension", "Chronic Kidney Disease (CKD)".',
    'Patient\'s allergies: "Sulfa Drugs".',
    'Evaluate the clinical safety of this combination with detailed pharmacological explanations of renal hemodynamics (NSAID inhibition of prostaglandins vs CCB effects in CKD).',
    'Return only JSON with this exact shape:',
    '{"severity":"high|moderate|low|safe|none","directive":"AVOID COMBINATION or CHOOSE ALTERNATIVE or MONITOR CLOSELY or SAFE","genericA":"Amlodipine","genericB":"Ibuprofen","summary":"...","explanation":"...","recommendations":["..."],"cautions":["..."]}'
  ].join('\n');

  // Model 1: Groq Llama-3.3-70b-versatile
  console.log("Evaluating Model 1: Groq Llama-3.3-70b-versatile (70 Billion Parameters)...");
  let llama70bResult;
  try {
    llama70bResult = await callGroqModel('llama-3.3-70b-versatile', promptInteraction);
    console.log("-> Llama-3.3-70b Evaluation Complete.");
  } catch (e) {
    console.error("Llama-3.3-70b failed:", e);
    llama70bResult = { error: String(e) };
  }

  // Model 2: Google Gemini-2.0-flash
  console.log("\nEvaluating Model 2: Google Gemini-2.0-flash...");
  let geminiResult;
  try {
    geminiResult = await callGeminiModel('gemini-2.0-flash', promptInteraction);
    console.log("-> Gemini-2.0-flash Evaluation Complete.");
  } catch (e) {
    console.error("Gemini-2.0-flash failed:", e);
    geminiResult = { error: String(e) };
  }

  // Write comparison report
  const report = [
    `# Clinical AI Model Comparison Report: Healthcare & Medication Safety`,
    ``,
    `Evaluating models specifically for **Clinical Explanations**, **Pharmacological Reasoning**, and **Disease-Drug Safety Accuracy**.`,
    ``,
    `## 1. Groq Llama-3.3-70b-versatile (70 Billion Parameters)`,
    `\`\`\`json`,
    JSON.stringify(llama70bResult, null, 2),
    `\`\`\``,
    ``,
    `## 2. Google Gemini-2.0-flash (Google DeepMind)`,
    `\`\`\`json`,
    JSON.stringify(geminiResult, null, 2),
    `\`\`\``
  ].join('\n');

  const artifactPath = path.join('C:', 'Users', 'deves', '.gemini', 'antigravity-ide', 'brain', 'c15d196a-165d-4687-9009-47a2fe9366d1', 'model_comparison_report.md');
  fs.writeFileSync(artifactPath, report);
  console.log(`\nComparison Report generated at: ${artifactPath}`);
}

runBenchmark();

