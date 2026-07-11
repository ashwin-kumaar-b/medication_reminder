import dotenv from 'dotenv';

dotenv.config();

const groqKey = process.env.GROQ_API_KEY!;

async function test() {
  const prompt = [
    'You are a clinical safety assistant for a medication reminder app.',
    'Provide a drug-to-drug interaction analysis between Aspirin and Warfarin.',
    'Return only JSON with this exact shape:',
    '{"severity":"high|moderate|low|safe|none","summary":"...","explanation":"...","recommendations":["..."],"cautions":["..."]}'
  ].join('\n');

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        'model': 'llama-3.1-8b-instant',
        'temperature': 0.2,
        'max_tokens': 400,
        'response_format': { 'type': 'json_object' },
        'messages': [
          { 'role': 'system', 'content': 'You are a careful medication safety assistant. Return strict JSON only.' },
          { 'role': 'user', 'content': prompt }
        ]
      }),
    });
    const data = await response.json() as any;
    console.log(data.choices[0].message.content);
  } catch (err) {
    console.error("Error testing:", err);
  }
}

test();
