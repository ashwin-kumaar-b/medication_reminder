# MediGuard AI Smart Care

Intelligent Medication Risk Monitoring System with Patient and Caretaker roles.

## Stack

- React + Vite + TypeScript
- Tailwind + shadcn/ui
- Supabase (database persistence)
- OneSignal hook support (optional)

## Supabase Connection

The app now reads and writes users, medications, dose logs, and notifications through Supabase when environment variables are set.

1. Set environment values in `.env`:

```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ONESIGNAL_APP_ID=optional-onesignal-app-id
```

2. In Supabase SQL Editor, run: `supabase/schema.sql`

3. Install and run:

```bash
npm install
npm run dev
```

If Supabase env values are missing, the app falls back to localStorage for demo usage.

## Database Tables

- `users`
- `medications`
- `logs`
- `notifications`

Schema file: `supabase/schema.sql`

## Safety Notice

This system supports adherence tracking and does not replace medical advice.
