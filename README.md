# Job Application Tracker

A job application tracker built with Angular and Firebase.

## Prerequisites

- Node.js (v24+)
- npm

## Setup

```bash
npm install
```

## Running the App

```bash
npm start
```

Navigate to `http://localhost:4200`.

## Build

```bash
npm run build
```

Output is in the `dist/` folder.

## Project Structure

```
src/app/
├── models/         # Interfaces (Job)
├── pages/
│   ├── home/       # Landing page
│   └── dashboard/  # Applications table
└── services/       # JobService (Firebase-ready)
```

## Adding Firebase

1. Install AngularFire: `npm install @angular/fire firebase`
2. Add your Firebase config to `src/environments/environment.ts`
3. Uncomment the Firebase providers in `src/app/app.config.ts`
4. Replace the in-memory array in `JobService` with Firestore calls
