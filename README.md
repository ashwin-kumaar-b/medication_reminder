# MediGuard AI Smart Care

Intelligent Medication Risk Monitoring System with Patient & Caretaker portals, powered by Meta Llama-3.3 70B Clinical AI, Flutter Mobile Client, Express TypeScript Backend, and Supabase Database integration.

---

## 📱 Project Architecture

The project is structured into three main components:

1. **`mobile/`**: The Flutter mobile application containing screens for authentication, patient dashboard, caretaker portal, drug-to-drug & disease interactions, food compatibility checker, missed dose recovery advice, and timezone-safe alarm scheduling.
2. **`backend/`**: An Express + TypeScript proxy server interfacing with NLM RxNav/RxTerms, USDA FoodData Central, Groq AI (Llama 3.3 70B), Google Gemini 2.0 Flash, and Supabase Postgres.
3. **`supabase/`**: Contains SQL schema declarations, RLS security policies, and indexes for database storage.

---

## ✨ Features & Recent System Upgrades

- **🧠 Medical-Grade Clinical AI Engine**: Upgraded to **Meta Llama-3.3 70B Versatile** (`llama-3.3-70b-versatile`) via Groq hardware acceleration. Provides high-precision pharmacological reasoning covering CYP3A4 enzymes, renal hemodynamics, GFR impact, and Vitamin K clotting factor antagonism.
- **♊ Dual-AI Architecture**: Groq Llama-3.3 70B as primary clinical engine with **Google Gemini 2.0 Flash** fallback proxy.
- **💊 Dosage & Unit Precision**: Input parsing for both numeric values and dosage units (e.g. `400mg`, `1 tablet`, `10ml`, `2 pills`), ensuring exact concentration context for AI clinical evaluations.
- **⏰ Multi-Schedule Dosing (TWICE Daily Support)**: Dynamic UI and data model supporting multiple schedule times per day (e.g. `08:00, 20:00` for TWICE daily dosing).
- **🎯 Purpose & Treated Condition Mapping**: Optional dropdown/input allowing medications to be mapped directly to a patient's documented chronic conditions/illnesses from their Health Profile.
- **📱 10-Digit Mobile Auth & Automatic Country Code Normalization**: Simplified login and registration allowing users to enter 10-digit mobile numbers without typing `+91` manually.
- **🔑 Multi-Role Portals**: Dedicated, real-time views for Patients and Caretakers with request/accept linkage workflow.
- **🍎 Food-Drug Compatibility Checker**: Evaluates foods via USDA FoodData Central and medications via RxNav against Llama 3.3 70B for Medscape-style risk guidance.
- **⚠️ Drug-Drug & Disease Interaction Checker**: Evaluates interactions between primary and secondary medications cross-referenced with chronic kidney disease, hypertension, and allergies.
- **⏰ Local Offline Alarms**: Timezone-safe local background reminders using native device alarm managers.
- **👩‍⚕️ Caretaker Portal**: Allows caretakers to monitor patient compliance timelines, drug lists, missed doses, and health profiles.
- **🧪 Automated 3x3 Clinical Audit Suite**: Built-in test script (`backend/src/test-safety-agents.ts`) for running automated matrix audits across Low (Normal), Medium, and High (Serious) criticality tiers.

---

## 🛠️ Tech Stack

### Mobile Client
* **Framework**: Flutter (Dart)
* **State Management**: Provider
* **Notifications**: `flutter_local_notifications` (with timezone-safe inexact background alarm scheduling)
* **Local Storage**: `shared_preferences`

### Backend Server
* **Framework**: Express (Node.js + TypeScript)
* **Primary AI Service**: Groq Hardware Acceleration (Meta Llama 3.3 70B Versatile)
* **Fallback AI Service**: Google AI (Gemini 2.0 Flash)
* **APIs**: National Library of Medicine (RxNav, RxTerms), USDA FoodData Central
* **Database Client**: `@supabase/supabase-js`

---

## 🚀 Setup & Execution Guide

### 1. Database Setup (Supabase)
1. Create a project in [Supabase](https://supabase.com/).
2. Open the SQL Editor in your Supabase dashboard.
3. Run the SQL script located in `supabase/schema.sql` to initialize all tables (`users`, `user_health_profiles`, `caretakers`, `caretaker_patients`, `medications`, `logs`, `notifications`).

### 2. Backend Server Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create a `.env` file with your configuration:
   ```env
   PORT=5000
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   GROQ_API_KEY=your-groq-api-key
   GEMINI_API_KEY=your-gemini-api-key
   USDA_API_KEY=your-usda-food-database-api-key
   ```
3. Install dependencies and start the dev server:
   ```bash
   npm install
   npm run dev
   ```

### 3. Running Automated Clinical Safety Tests
To run the automated 3x3 clinical safety matrix audit across Low, Medium, and High criticality tiers:
```bash
cd backend
npx tsx src/test-safety-agents.ts
```

### 4. Mobile Client Setup (Flutter)
1. Start an Android/iOS emulator or connect a physical device.
2. Navigate to the `mobile/` directory:
   ```bash
   cd mobile
   ```
3. Fetch dependencies:
   ```bash
   flutter pub get
   ```
4. Start the application:
   ```bash
   flutter run -d <your-device-id>
   ```

---

## 📁 Key Files & Directories

- **[`mobile/lib/screens/add_medicine_screen.dart`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/mobile/lib/screens/add_medicine_screen.dart)**: Form for medication registration, unit input, dual-schedule time pickers, and purpose mapping.
- **[`mobile/lib/screens/interaction_checker_screen.dart`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/mobile/lib/screens/interaction_checker_screen.dart)**: Interfaces with Llama 3.3 70B for Drug-Drug & Disease interaction analysis.
- **[`mobile/lib/screens/food_checker_screen.dart`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/mobile/lib/screens/food_checker_screen.dart)**: Interfaces with USDA FoodData API & Llama 3.3 70B for food-drug compatibility analysis.
- **[`mobile/lib/screens/missed_doses_screen.dart`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/mobile/lib/screens/missed_doses_screen.dart)**: AI-driven recovery advice for missed medication doses.
- **[`backend/src/test-safety-agents.ts`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/backend/src/test-safety-agents.ts)**: Programmatic 3x3 clinical test matrix runner.
- **[`backend/src/server.ts`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/backend/src/server.ts)**: Express backend proxy server.
