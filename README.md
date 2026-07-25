# MediGuard AI Smart Care

Intelligent Medication Risk Monitoring System with Patient and Caretaker portals. MediGuard features a Flutter mobile app, an Express TypeScript backend, and a Supabase database integration.

---

## 📱 Project Architecture

The project is structured into three main directories:

1. **`mobile/`**: The Flutter mobile application containing screens for authentication, patient dashboard, caretaker portal, drug-to-drug interactions, food compatibility checker, and alarm scheduling.
2. **`backend/`**: An Express + TypeScript server that proxies third-party health APIs (NLM RxNav, RxTerms, USDA FoodData Central, Groq AI) and connects to Supabase.
3. **`supabase/`**: Contains the SQL schema and RLS security policies for database storage.

---

## ✨ Features

- **🔑 Multi-Role Authentication**: Dedicated portals for both Patients and Caretakers.
- **💊 Autocomplete Medication Search**: Real-time generic/brand search powered by NLM RxTerms API to prevent spelling mistakes.
- **🔄 Edit & Manage Medications**: Ability to add, edit, and delete medications with customized timing, category, frequency, and criticality.
- **🍎 Food Compatibility Checker**: Resolves food items via USDA FoodData Central and medications via RxNav, using Llama-3.1 on Groq to evaluate risks and provide Medscape-style warning banners.
- **⚠️ Drug-Drug Interaction Checker**: Evaluates interaction risks between primary and secondary medications.
- **⏰ Local Offline Alarms**: Schedules daily dose reminders directly on the device using native alarm managers, featuring local-first fallback mechanisms to work completely offline.
- **👩‍⚕️ Caretaker Portal**: Allows caretakers to link with patients, view their daily schedules, see adherence logs, and monitor missed dose alerts.

---

## 🛠️ Tech Stack

### Mobile Client
* **Framework**: Flutter (Dart)
* **State Management**: Provider
* **Notifications**: `flutter_local_notifications` (with timezone-safe inexact background alarm scheduling)
* **Local Storage**: `shared_preferences`

### Backend Server
* **Framework**: Express (Node.js + TypeScript)
* **AI Service**: Groq SDK (Llama 3.1 8B Instant)
* **APIs**: National Library of Medicine (RxNav, RxTerms), USDA FoodData Central
* **Database client**: `@supabase/supabase-js`

---

## 🚀 Setup & Execution Guide

### 1. Database Setup (Supabase)
1. Create a project in [Supabase](https://supabase.com/).
2. Open the SQL Editor in the Supabase dashboard.
3. Run the SQL script located in `supabase/schema.sql` to initialize all tables (`users`, `user_health_profiles`, `caretakers`, `caretaker_patients`, `medications`, `logs`, `notifications`).

### 2. Backend Server Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create a `.env` file based on the environment configuration:
   ```env
   PORT=5000
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-supabase-anon-key
   GROQ_API_KEY=your-groq-api-key
   USDA_API_KEY=your-usda-food-database-api-key
   ```
3. Install dependencies and start the developer server:
   ```bash
   npm install
   npm run dev
   ```

### 3. Mobile Client Setup (Flutter)
1. Ensure you have an Android/iOS emulator running or a physical device connected with USB debugging enabled.
2. Navigate to the `mobile/` directory:
   ```bash
   cd mobile
   ```
3. Fetch dependencies:
   ```bash
   flutter pub get
   ```
4. Run the application:
   ```bash
   # Find your device ID
   flutter devices
   
   # Start the app
   flutter run -d <your-device-id>
   ```

---

## 📁 Key Files & Directories

- **[`mobile/lib/services/notification_service.dart`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/mobile/lib/services/notification_service.dart)**: Manages OS alarms and timezone conversions.
- **[`mobile/lib/providers/medicine_provider.dart`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/mobile/lib/providers/medicine_provider.dart)**: Handles local-first medication state, local caching, and offline notification scheduling.
- **[`mobile/lib/screens/food_checker_screen.dart`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/mobile/lib/screens/food_checker_screen.dart)**: Interfaces with the Food Checker AI.
- **[`backend/src/server.ts`](file:///c:/Users/deves/OneDrive/project_main/PROJECTS/medication_reminder/backend/src/server.ts)**: Express backend proxy server.
