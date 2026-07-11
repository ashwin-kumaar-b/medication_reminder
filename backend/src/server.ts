import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("WARNING: Supabase URL or Anon Key is missing from backend environment variables!");
}

const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Base route to check API status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    supabaseConfigured: !!supabase
  });
});

// Users APIs
app.get('/api/users', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/upsert', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  const { userPayload, healthPayload, caretakerPayload } = req.body;

  try {
    // 1. Upsert User
    const { error: userError } = await supabase
      .from('users')
      .upsert(userPayload, { onConflict: 'id' });

    if (userError) throw userError;

    // 2. Upsert Health Profile if exists
    if (healthPayload) {
      const { error: healthError } = await supabase
        .from('user_health_profiles')
        .upsert(healthPayload, { onConflict: 'user_id' });

      if (healthError) throw healthError;
    }

    // 3. Upsert Caretaker Profile if exists
    if (caretakerPayload) {
      const { error: caretakerError } = await supabase
        .from('caretakers')
        .upsert(caretakerPayload, { onConflict: 'user_id' });

      if (caretakerError) throw caretakerError;
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error upserting user profiles:', err);
    res.status(500).json({ error: err.message });
  }
});

// Caretaker Links
app.get('/api/caretaker-patients', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    const { data, error } = await supabase.from('caretaker_patients').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/caretaker-patients/upsert', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  const { caretaker_id, patient_id } = req.body;
  try {
    const { data, error } = await supabase
      .from('caretaker_patients')
      .upsert({ caretaker_id, patient_id }, { onConflict: 'caretaker_id,patient_id' });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/caretaker-patients/delete', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  const { patient_id } = req.body;
  try {
    const { error } = await supabase
      .from('caretaker_patients')
      .delete()
      .eq('patient_id', patient_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Medications APIs
app.get('/api/medications', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    const { data, error } = await supabase
      .from('medications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/medications/upsert', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  const medicationRow = req.body;
  try {
    const { data, error } = await supabase
      .from('medications')
      .upsert(medicationRow, { onConflict: 'id' });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/medications/:id', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  const { id } = req.params;
  try {
    const { error } = await supabase
      .from('medications')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dose Logs APIs
app.get('/api/logs', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    const { data, error } = await supabase
      .from('logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/logs/upsert', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  const logData = req.body;
  try {
    const { data, error } = await supabase
      .from('logs')
      .upsert(logData, { onConflict: 'medication_id,date,scheduled_time' });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Notifications APIs
app.get('/api/notifications', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/upsert', async (req, res) => {
  if (!supabase) return res.status(503).json({ error: 'Supabase is not configured' });
  const notificationRow = req.body;
  try {
    const { data, error } = await supabase
      .from('notifications')
      .upsert(notificationRow, { onConflict: 'dedupe_key' });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// USDA Food Search Proxy
app.get('/api/medication-apis/usda/search', async (req, res) => {
  const query = req.query.query;
  const usdaKey = process.env.USDA_API_KEY;
  if (!usdaKey) return res.status(503).json({ error: 'USDA API key is not configured' });
  if (!query) return res.status(400).json({ error: 'Query parameter is required' });

  try {
    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaKey)}&query=${encodeURIComponent(query as string)}&pageSize=1`
    );
    if (!response.ok) {
      return res.status(response.status).send(await response.text());
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Groq Completions Proxy
app.post('/api/medication-apis/groq/chat/completions', async (req, res) => {
  const groqKey = process.env.GROQ_API_KEY;
  if (!groqKey) return res.status(503).json({ error: 'Groq API key is not configured' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify(req.body),
    });
    if (!response.ok) {
      return res.status(response.status).send(await response.text());
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Gemini Generate Content Proxy
app.post('/api/medication-apis/gemini/generateContent', async (req, res) => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return res.status(503).json({ error: 'Gemini API key is not configured' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      }
    );
    if (!response.ok) {
      return res.status(response.status).send(await response.text());
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
