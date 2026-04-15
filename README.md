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

## Multi-Step Registration Contract

### Frontend Schema (React/TypeScript)

```ts
type UserRole = 'patient' | 'caretaker';
type UiMode = 'younger' | 'older';

type AllergyEntry = {
	category: 'Drug' | 'Food' | 'Environmental' | string;
	trigger: string;
};

type RegisterInput = {
	name: string;
	email: string;
	password: string;
	role: UserRole;
	dateOfBirth?: string; // YYYY-MM-DD
	heightCm?: number;
	weightKg?: number;
	chronicDiseases?: string[];
	infectionHistory?: string[];
	allergies?: AllergyEntry[];
	emergencyContactEmail?: string; // required for patient
	uiMode?: UiMode;
	linkedPatientId?: string; // optional for caretaker
};
```

### Backend JSON Structure

Profile data is persisted in dedicated columns and mirrored in `users.profile_json` for flexible evolution:

```json
{
	"dateOfBirth": "1959-06-14",
	"heightCm": 165,
	"weightKg": 62,
	"chronicDiseases": ["Diabetes", "Hypertension"],
	"infectionHistory": ["TB"],
	"allergies": [
		{ "category": "Drug", "trigger": "Penicillin" },
		{ "category": "Food", "trigger": "Peanuts" }
	],
	"emergencyContactEmail": "daughter@example.com"
}
```

For secure storage: use Supabase Auth for credentials, rely on Postgres row-level security policies, and avoid storing sensitive profile data in client-side localStorage in production.

## Safety Notice

This system supports adherence tracking and does not replace medical advice.
