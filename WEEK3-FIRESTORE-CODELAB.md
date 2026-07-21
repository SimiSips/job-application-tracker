# Week 3 — Adding Cloud Firestore to the Job Tracker

> **GDG Codelab Series · Week 3**
> Goal: replace the in-memory job list with **Cloud Firestore** so job applications are
> saved to the cloud and scoped to each signed-in user.
>
> **Prerequisites:** Week 2 is done — Firebase **Auth** (email/password) already works
> (`src/app/services/auth.ts`), route guards protect `/dashboard`, and login/signup pages exist.

---

## 0. The mental model (read this before touching code)

Right now every job lives in a plain JavaScript array inside `JobService`. Two problems:

1. **Nothing is saved** — refresh the page and everything resets.
2. **No per-user data** — every visitor sees the same two hard-coded jobs.

**Cloud Firestore** is a cloud NoSQL document database. We fix both problems by storing
each user's jobs under their own **UID** (the unique id Firebase Auth gives every account):

```
users/{uid}/jobs/{jobId}
  ├─ company:        "ACME Corp"
  ├─ role:           "Software Engineer"
  ├─ jobDescription: "Develop and maintain web apps."
  └─ jobUpdates:     [ { status: "new",     updatedAt: <Timestamp> },
                       { status: "applied", updatedAt: <Timestamp> } ]
```

`users/{uid}/jobs` is a **subcollection**. Storing data this way means our security rules
become one simple sentence: *"you may only read/write documents under your own uid."*

**Three ideas to leave the session with:**
1. Initialize Firebase **once** and share it everywhere.
2. Model data **per-user** so security rules stay simple.
3. Firestore stores JS `Date`s as **`Timestamp`s** — convert them back when you read.

---

## 1. Files we touch (map)

| # | File | What happens |
|---|------|--------------|
| 1 | `src/app/firebase.ts` | **NEW** — initialize Firebase once, export `firebaseApp`, `firebaseAuth`, `firestore` |
| 2 | `src/app/services/auth.ts` | use the shared `firebaseAuth` instead of its own `initializeApp()` |
| 3 | `src/app/services/job.ts` | swap the in-memory array for Firestore reads/writes |
| 4 | `src/app/app.config.ts` | remove the misleading `@angular/fire` comments |
| 5 | `angular.json` | raise the bundle-size budget (Firebase is a big library) |
| 6 | `src/app/environment/environment.ts` | paste **your** project's Firebase config |
| — | Firebase Console | create the database + publish security rules |

---

## 2. Create ONE shared Firebase instance

**File:** `src/app/firebase.ts` — **create this new file.**

Why: `auth.ts` already calls `initializeApp()`. If `JobService` calls it a *second* time,
Firebase throws **`Firebase App named '[DEFAULT]' already exists`**. So we initialize in one
place and every service imports from here.

```ts
// src/app/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from './environment/environment';

// Initialize Firebase ONCE for the whole app.
// Every service imports these instead of calling initializeApp() again.
export const firebaseApp = initializeApp(environment);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore = getFirestore(firebaseApp);
```

---

## 3. Point AuthService at the shared instance

**File:** `src/app/services/auth.ts`

Change the **imports** and the two fields at the top of the class. Everything below
(`signUp`, `signIn`, `logOut`, `currentUser$`) stays exactly the same.

**Before:**
```ts
import { initializeApp } from "firebase/app";
import { Auth, createUserWithEmailAndPassword, getAuth, onAuthStateChanged,
         signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { environment } from "../environment/environment";
// ...
export class AuthService {
    private app = initializeApp(environment);
    private auth: Auth = getAuth(this.app);
```

**After:**
```ts
import { Auth, createUserWithEmailAndPassword, onAuthStateChanged,
         signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { firebaseAuth } from "../firebase";
// ...
export class AuthService {
    private auth: Auth = firebaseAuth;
```

> We removed `initializeApp`, `getAuth`, and the `environment` import — they now live in
> `firebase.ts`. The service just borrows the already-built `firebaseAuth`.

---

## 4. Rewrite JobService to use Firestore

**File:** `src/app/services/job.ts` — **replace the whole file** with the code below.

The method **signatures are identical** to the old ones (`getJobs`, `addJob`,
`updateJobStatus` all still return Promises), so the dashboard component and its HTML need
**no changes at all**. Only the *inside* of the service changes.

```ts
// src/app/services/job.ts
import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  arrayUnion,
  Timestamp,
  DocumentData
} from 'firebase/firestore';
import { firestore, firebaseAuth } from '../firebase';
import { Job, JobStatus, JobUpdate } from '../models/job.model';

@Injectable({ providedIn: 'root' })
export class JobService {
  private db = firestore;

  // Every user gets their own subcollection: users/{uid}/jobs/{jobId}.
  // Returns the collection reference for the CURRENT signed-in user.
  private jobsCollection() {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) {
      throw new Error('Cannot access jobs: no user is signed in.');
    }
    return collection(this.db, 'users', uid, 'jobs');
  }

  async getJobs(): Promise<Job[]> {
    const snapshot = await getDocs(this.jobsCollection());
    // Each Firestore document -> a Job. The document id becomes job.id.
    return snapshot.docs.map((d) => this.toJob(d.id, d.data()));
  }

  async addJob(job: Job): Promise<Job> {
    // addDoc lets Firestore generate the document id for us.
    const docRef = await addDoc(this.jobsCollection(), {
      company: job.company ?? '',
      role: job.role ?? '',
      jobDescription: job.jobDescription ?? '',
      jobUpdates: job.jobUpdates.map((u) => ({
        status: u.status,
        updatedAt: u.updatedAt
      }))
    });
    return { ...job, id: docRef.id };
  }

  async updateJobStatus(jobId: string, newStatus: JobStatus): Promise<Job | undefined> {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) return undefined;

    const jobRef = doc(this.db, 'users', uid, 'jobs', jobId);
    // arrayUnion appends the new status update without overwriting the array.
    await updateDoc(jobRef, {
      jobUpdates: arrayUnion({ status: newStatus, updatedAt: new Date() })
    });
    return undefined;
  }

  // Firestore stores JS Dates as Timestamps. Convert them back so the
  // dashboard's DatePipe and date comparisons keep working.
  private toJob(id: string, data: DocumentData): Job {
    const jobUpdates: JobUpdate[] = (data['jobUpdates'] ?? []).map((u: any) => ({
      status: u.status,
      updatedAt: u.updatedAt instanceof Timestamp ? u.updatedAt.toDate() : u.updatedAt
    }));

    return {
      id,
      company: data['company'],
      role: data['role'],
      jobDescription: data['jobDescription'] ?? '',
      jobUpdates
    };
  }
}
```

### Line-by-line notes (say these out loud in the session)

- **`collection(db, 'users', uid, 'jobs')`** — builds a reference to the path
  `users/{uid}/jobs`. Odd number of segments = a *collection*; even = a *document*.
- **`getDocs(...)`** — reads every document in that collection once and returns a snapshot.
- **`snapshot.docs.map(d => ...)`** — `d.id` is the auto-generated document id, `d.data()`
  is the stored fields. We turn each into our `Job` type via `toJob()`.
- **`addDoc(...)`** — inserts a new document and lets Firestore pick the id (contrast with
  `setDoc`, where *you* choose the id).
- **`updateDoc` + `arrayUnion(...)`** — appends to the `jobUpdates` array **without**
  reading-then-rewriting the whole array. Safer under concurrent edits.
- **`Timestamp` → `.toDate()`** — the single most common Firestore "gotcha". Dates come
  back as `Timestamp` objects, not JS `Date`s. If you skip the conversion, the dashboard's
  `| date` pipe and the `updatedAt > latest.updatedAt` comparison silently break.
- **`firebaseAuth.currentUser?.uid`** — because `/dashboard` is behind `authGuard`, a user
  is always signed in by the time these methods run, so `currentUser` is populated.

---

## 5. Clean up app.config.ts

**File:** `src/app/app.config.ts`

The old commented lines referenced `@angular/fire` (a package we never installed) and a
config path that doesn't exist. With the raw SDK there are **no Firebase providers to add**
— initialization lives in `firebase.ts`. Delete the comment block:

**Remove:**
```ts
// Firebase providers will be added here:
// import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
// import { provideFirestore, getFirestore } from '@angular/fire/firestore';
// import { environment } from '../environments/environment';
```
and the two commented `provideFirebaseApp(...)` / `provideFirestore(...)` lines inside the
`providers` array. The final file just keeps the four real providers.

---

## 6. Raise the bundle-size budget

**File:** `angular.json`

Adding Firestore pushes the initial JS bundle over Angular's default 1 MB error limit, so
the production build fails with *"bundle initial exceeded maximum budget."* This is normal
for Firebase. Find the `"type": "initial"` budget and bump it:

**Before:**
```json
{ "type": "initial", "maximumWarning": "500kB", "maximumError": "1MB" }
```
**After:**
```json
{ "type": "initial", "maximumWarning": "1MB", "maximumError": "2MB" }
```

> Real-world alternative: reduce the bundle by lazy-loading Firestore only where it's used.
> For a codelab, raising the budget is fine.

---

## 7. Get YOUR Firebase project config

**File:** `src/app/environment/environment.ts`

1. In the [Firebase Console](https://console.firebase.google.com), open your project.
2. Click the **⚙️ gear → Project settings**.
3. Scroll to **Your apps**. If there's no web app yet, click the **`</>`** (web) icon,
   give it a nickname (e.g. `job-tracker-web`), and register it (skip Hosting).
4. Copy the `firebaseConfig` values into `environment.ts`. **Keep the flat shape** this
   project already uses (the config object *is* the export — not nested under `firebase`):

```ts
// src/app/environment/environment.ts
export const environment = {
  apiKey: "PASTE_YOURS",
  authDomain: "PASTE_YOURS.firebaseapp.com",
  projectId: "PASTE_YOURS",
  storageBucket: "PASTE_YOURS.firebasestorage.app",
  messagingSenderId: "PASTE_YOURS",
  appId: "PASTE_YOURS",
  measurementId: "PASTE_YOURS"
};
```

> These values are **not secrets** — they identify your project to Firebase's servers.
> Your data is protected by **security rules** (next step), not by hiding these keys.

---

## 8. Turn on Auth + create the database (Console)

**Enable Email/Password sign-in** (needed for Week 2 login to work on the new project):
`Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save`.

**Create the Firestore database:**
`Build → Firestore Database → Create database → pick a location → start in Production mode`.

> Do **not** pick "Test mode" — it lets *anyone on the internet* read and write your data
> for 30 days. We write real rules next.

---

## 9. Security rules — the heart of Week 3

In the Firebase Console: `Firestore Database → Rules` tab. Replace everything with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // A user may only read/write documents inside THEIR OWN uid subtree.
    match /users/{userId}/jobs/{jobId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

Click **Publish**. Read it out loud:
- `request.auth != null` → the caller must be **signed in**.
- `request.auth.uid == userId` → the `{userId}` folder in the path must be **their own** uid.

This is *why* we stored jobs at `users/{uid}/jobs` in step 4 — the rule is one line because
the data model did the hard work.

---

## 10. Run and verify

```bash
npm start
```

Then in the browser (http://localhost:4200):

1. **Sign up** with a new email/password → you land on `/dashboard`.
2. **Add a job** → fill it in and save.
3. **Refresh the page** → the job is still there (it came from Firestore, not the array).
4. In the Console → `Firestore Database → Data`, watch `users → {your uid} → jobs → {doc}`
   appear in real time.
5. **Log out**, sign up as a *second* user → they see **none** of the first user's jobs.
   That's the security rule working.

---

## Troubleshooting cheat-sheet

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `Firebase App named '[DEFAULT]' already exists` | Two `initializeApp()` calls | Make sure only `firebase.ts` calls it; `auth.ts` imports `firebaseAuth` |
| `Missing or insufficient permissions` in console | Security rules block the write, or you're signed out | Confirm rules published (step 9) and you're logged in |
| Jobs save but the date shows as `[object Object]` or wrong order | Forgot the `Timestamp` → `.toDate()` conversion | Check `toJob()` in `job.ts` (step 4) |
| Build fails: *"bundle initial exceeded maximum budget"* | Firebase is large | Raise the budget in `angular.json` (step 6) |
| `auth/operation-not-allowed` on signup | Email/Password provider off | Enable it (step 8) |
| `getJobs` throws *"no user is signed in"* | Called before auth resolved | The dashboard is guarded, so this shouldn't happen — check you didn't call it from an unguarded page |
| Config/`projectId` mismatch, blank data | `environment.ts` still points at the old project | Paste the new project's config (step 7) |

---

## Stretch goals (if there's time)

- **Migrate `UserService`** (`src/app/services/user.ts`) the same way: store the CV as a
  field on the `users/{uid}` document (`setDoc` / `getDoc`).
- **Live updates:** swap `getDocs` for `onSnapshot` in `getJobs()` so the list updates in
  real time across tabs — great "wow" demo.
