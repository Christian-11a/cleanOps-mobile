# CleanOps Mobile

A production-ready React Native mobile application for the CleanOps cleaning services marketplace, built with **Expo** and **Supabase**. This app provides dedicated interfaces for Customers, Employees, and Administrators to manage cleaning jobs in real-time.

## 🚀 Tech Stack

- **Framework:** [Expo](https://expo.dev/) (React Native)
- **Routing:** [Expo Router](https://docs.expo.dev/router/introduction/) (File-based navigation)
- **Backend:** [Supabase](https://supabase.com/) (Auth, Database, Real-time)
- **State Management:** [Zustand](https://github.com/pmndrs/zustand) (Stores)
- **Styling:** React Native StyleSheet (Theme-aware)

## 📂 Project Structure

```text
cleanOps-mobile/
├── actions/              # Supabase API calls & business logic
│   ├── auth.ts           # Authentication & Session management
│   ├── jobs.ts           # Job lifecycle (create, claim, complete)
│   ├── payments.ts       # Wallet & Transaction processing
│   └── ...               # Disputes, Reviews, Notifications, etc.
├── app/                  # File-based Routing (Expo Router)
│   ├── (tabs)/           # Shared Tab Navigation
│   ├── customer/         # Customer-specific screens & workflows
│   ├── employee/         # Employee-specific screens & workflows
│   ├── admin/            # Administrative dashboard
│   └── (auth)/           # Login & Signup flows
├── components/           # Reusable UI Components
│   ├── shared/           # Cross-app components (JobCard, StatCard)
│   ├── booking/          # Multi-step booking forms
│   └── chat/             # Real-time messaging interface
├── lib/                  # Core Utilities & Contexts
│   ├── supabase.ts       # Supabase client configuration
│   ├── authContext.tsx   # Global Auth & Role state
│   ├── themeContext.tsx  # Dynamic Dark/Light mode support
│   └── ...               # Toast, Notifications, Validations
├── stores/               # Zustand state management
│   ├── bookingStore.ts   # Temporary booking state
│   ├── paymentStore.ts   # Transaction & Balance state
│   └── settingsStore.ts  # Persisted user preferences
└── constants/            # Design tokens & color palettes
```

## 🛠️ Getting Started

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Ensure your `.env` file is configured with your Supabase credentials.

3. **Start the Development Server**
   ```bash
   npx expo start
   ```

## 👥 User Roles & Navigation

The app uses a role-based access control system that automatically directs users after authentication:

| Role | Primary Navigation | Key Features |
| :--- | :--- | :--- |
| **Customer** | `/customer/(tabs)` | Book cleanings, track jobs, manage wallet. |
| **Employee** | `/employee/(tabs)` | Claim jobs, track earnings, manage schedule. |
| **Admin** | `/admin/dashboard` | System-wide oversight and job management. |

## 📱 Key Features

- **Real-time Updates:** Live job status tracking and instant messaging.
- **Dynamic Theming:** Built-in support for light and dark modes via `themeContext`.
- **Offline Support:** Strategic state management using Zustand for smooth performance.
- **Secure Payments:** Integrated wallet system for seamless service transactions.
