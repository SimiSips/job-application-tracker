# Week 3 · Cloud Firestore — Facilitator Codelab

<p class="lead">Everything in one place: the <strong>big lines are what you SAY</strong> out loud;
the code blocks are what you TYPE; the small grey cues are what you DO or WATCH for. Code live
from the <code>main</code> branch. If you get stuck, the finished answer is on the
<code>solution</code> branch. Target time ≈ <strong>45–60 min</strong>.</p>

<p class="do">⌨️ DO cue &nbsp;·&nbsp; ⚠️ WATCH-out cue &nbsp;·&nbsp; 🎤 = say it in your own words, don't read robotically.</p>

---

## 0 · Before you start

<p class="do">⌨️ Confirm: you're on the <code>main</code> branch, app runs with <code>npm start</code>, and you're logged into the Firebase console for project <code>gdg-job-tracker-week3</code>.</p>

<p class="say">🎤 "Last week we added <strong>login and signup</strong>. Today we make the app actually
<strong>remember your data</strong> — in the cloud, and private to each user — using Cloud Firestore."</p>

---

## 1 · The hook — why in-memory fails

<p class="do">⌨️ Log in → show the two jobs on the dashboard → <strong>add a job</strong> → <strong>refresh the page</strong>.</p>

<p class="say">🎤 "Watch — I add a job, I refresh… and it's gone. Every user also sees the same two
fake jobs. That's because our jobs live in a plain <strong>array in memory</strong>. Reload the tab and
the array is rebuilt from scratch. Let's fix that today."</p>

<p class="say">🎤 "Here's the shape of our data — keep this picture in your head:
<strong>users / {your-uid} / jobs / {jobId}</strong>. Every user gets their own folder, keyed by the
unique ID that Auth already gives them. That one decision makes our security rules trivial later."</p>

---

## 2 · Initialize Firebase once

<p class="say">🎤 "Small but important refactor first. Firebase must be initialized <strong>exactly once</strong>
per app. Our <code>auth.ts</code> already calls <code>initializeApp()</code>. If the Job service calls it
<em>again</em>, Firebase throws 'app named DEFAULT already exists.' So let's make one file that
initializes Firebase and shares the pieces."</p>

<p class="do">⌨️ Create a new file: <code>src/app/firebase.ts</code></p>

```ts
// src/app/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { environment } from './environment/environment';

// Initialize Firebase ONCE for the whole app.
export const firebaseApp  = initializeApp(environment);
export const firebaseAuth = getAuth(firebaseApp);
export const firestore    = getFirestore(firebaseApp);
```

<p class="say">🎤 "We boot Firebase, then export three things: the app, <code>firebaseAuth</code>, and
<code>firestore</code> — our database handle. Anyone who needs Firebase imports from here. One
source of truth."</p>

<p class="do">⌨️ Open <code>src/app/services/auth.ts</code>. Remove its own <code>initializeApp</code> and borrow the shared auth.</p>

```ts
// change the imports at the top:
import { Auth, createUserWithEmailAndPassword, onAuthStateChanged,
         signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { firebaseAuth } from "../firebase";

// inside the class, replace the two lines with just:
private auth: Auth = firebaseAuth;
```

<p class="say">🎤 "Now Auth uses the shared instance instead of creating its own. Same behaviour —
but there's only <strong>one</strong> Firebase app in the whole system. That's what lets Firestore and
Auth live together."</p>

<p class="watch">⚠️ If you later see 'DEFAULT already exists', a stray <code>initializeApp()</code> is still in <code>auth.ts</code>.</p>

---

## 3 · Turn the Job service into a database client

<p class="say">🎤 "This is the heart of today. We're replacing the <em>insides</em> of <code>job.ts</code> — but
the method names stay the same: <code>getJobs</code>, <code>addJob</code>, <code>updateJobStatus</code>, all
still Promises. So the dashboard doesn't change at all. We're swapping the engine, not the car."</p>

<p class="do">⌨️ Open <code>src/app/services/job.ts</code>. Replace the top imports:</p>

```ts
import { Injectable } from '@angular/core';
import {
  collection, doc, getDocs, addDoc, updateDoc,
  arrayUnion, Timestamp, DocumentData
} from 'firebase/firestore';
import { firestore, firebaseAuth } from '../firebase';
import { Job, JobStatus, JobUpdate } from '../models/job.model';
```

<p class="say">🎤 "These come from the Firestore SDK: <code>collection</code> and <code>doc</code> point at where
data lives; <code>getDocs</code>, <code>addDoc</code>, <code>updateDoc</code> read and write;
<code>arrayUnion</code> appends to an array safely; <code>Timestamp</code> we'll need for dates in a second."</p>

<p class="do">⌨️ Delete the in-memory <code>jobs</code> array. Add the class body:</p>

```ts
@Injectable({ providedIn: 'root' })
export class JobService {
  private db = firestore;

  // Points at THIS user's jobs: users/{uid}/jobs
  private jobsCollection() {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) throw new Error('Cannot access jobs: no user is signed in.');
    return collection(this.db, 'users', uid, 'jobs');
  }
```

<p class="say">🎤 "Here's where the data model pays off. This builds a reference to <em>this</em> user's
jobs folder. Quick rule: an <strong>odd</strong> number of path segments is a collection, an
<strong>even</strong> number is one document. And because the dashboard is behind our auth guard,
someone is always logged in when this runs."</p>

```ts
  async getJobs(): Promise<Job[]> {
    const snapshot = await getDocs(this.jobsCollection());
    return snapshot.docs.map((d) => this.toJob(d.id, d.data()));
  }
```

<p class="say">🎤 "<code>getDocs</code> reads every document once. We turn each into our Job type —
<code>d.id</code> is the document's ID, <code>d.data()</code> is the fields."</p>

```ts
  async addJob(job: Job): Promise<Job> {
    // A new job starts at NEW so it always has at least one update.
    const jobUpdates = job.jobUpdates.length > 0
      ? job.jobUpdates
      : [{ status: JobStatus.NEW, updatedAt: new Date() }];

    const docRef = await addDoc(this.jobsCollection(), {
      company: job.company ?? '',
      role: job.role ?? '',
      jobDescription: job.jobDescription ?? '',
      jobUpdates: jobUpdates.map((u) => ({ status: u.status, updatedAt: u.updatedAt }))
    });
    return { ...job, id: docRef.id, jobUpdates };
  }
```

<p class="say">🎤 "<code>addDoc</code> inserts a new document and lets Firestore generate the ID — we
don't invent one. And we seed the status <strong>NEW</strong>, because a brand-new job should start
somewhere. That also dodges a crash I'll show you in a minute."</p>

```ts
  async updateJobStatus(jobId: string, newStatus: JobStatus): Promise<Job | undefined> {
    const uid = firebaseAuth.currentUser?.uid;
    if (!uid) return undefined;
    const jobRef = doc(this.db, 'users', uid, 'jobs', jobId);
    await updateDoc(jobRef, {
      jobUpdates: arrayUnion({ status: newStatus, updatedAt: new Date() })
    });
    return undefined;
  }
```

<p class="say">🎤 "To move a job from 'applied' to 'interview' we append a new status entry.
<code>arrayUnion</code> adds to the array <strong>without</strong> us reading the whole thing, editing it,
and writing it back. Safer, less code."</p>

```ts
  // Firestore returns dates as Timestamps — convert them back to JS Dates.
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

<p class="say">🎤 "Last piece — the classic Firestore surprise. When you <strong>save</strong> a JavaScript
Date, Firestore stores it as a <strong>Timestamp</strong>. When you <strong>read</strong> it back, it's NOT a
Date anymore. So the dashboard's date pipe and our sorting silently break. This one line —
<code>.toDate()</code> — fixes it. Remember this; it bites everyone, in every Firestore project."</p>

<p class="watch">⚠️ If the build now fails on bundle <em>size</em>, that's the next step — not a bug.</p>

---

## 4 · Clean up config + raise the bundle budget

<p class="do">⌨️ Open <code>src/app/app.config.ts</code> — delete the commented <code>@angular/fire</code> block.</p>

<p class="say">🎤 "Those comments mention a package called AngularFire that we're not using — we're
on the raw SDK, initialized in <code>firebase.ts</code>. Nothing to add here. Deleting comments that
lie to future-you is real work."</p>

<p class="do">⌨️ Run <code>npm run build</code> → it fails: 'bundle exceeded maximum budget.'</p>

<p class="say">🎤 "That's not a bug — Firebase is a big library, and Angular warns when the app
gets heavy. In a real product you'd lazy-load Firebase; for us we just raise the ceiling."</p>

<p class="do">⌨️ In <code>angular.json</code>, bump the <code>initial</code> budget, then rebuild → green.</p>

```json
{ "type": "initial", "maximumWarning": "1MB", "maximumError": "2MB" }
```

---

## 5 · Create the database & lock it down

<p class="say">🎤 "Code's done — but we're pointing at a database that doesn't exist yet. Over to the
Firebase console."</p>

<p class="do">⌨️ Console → <strong>Build → Firestore Database → Create database</strong> → pick a location → <strong>Production mode</strong>.</p>

<p class="say">🎤 "Pick a location near your users. And notice I choose <strong>Production mode</strong>, not
Test mode — Test mode leaves your database open to the whole internet for 30 days. We're
writing real rules right now instead."</p>

<p class="do">⌨️ Go to the <strong>Rules</strong> tab → replace everything → <strong>Publish</strong>.</p>

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/jobs/{jobId} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

<p class="say">🎤 "Read it with me. <code>request.auth != null</code> — you must be <strong>signed in</strong>.
<code>request.auth.uid == userId</code> — the folder you're touching must be <strong>your own</strong>. That's
it. Remember I said the data model makes rules a one-liner? This is the payoff — 'you can only
touch your own folder.' Publish."</p>

<p class="watch">⚠️ Later 'Missing or insufficient permissions' = rules didn't publish, or the user is signed out.</p>

---

## 6 · Fix the empty state, then test it live

<p class="do">⌨️ <code>npm start</code> → sign up a <strong>brand-new</strong> user → dashboard shows "Loading…" forever.</p>

<p class="say">🎤 "Perfect teachable moment — it says Loading and never stops. Is Firestore broken?
No. Open <code>dashboard.html</code>. See this <code>@empty</code> block? It runs whenever the list is
<strong>empty</strong>. Last week the array had two fake jobs, so it was never empty. A real new user has
<strong>zero</strong> jobs — the data loads fine as an empty list, and <code>@empty</code> shows 'Loading'
forever. It was never a spinner; it was mislabeled."</p>

<p class="do">⌨️ In <code>dashboard.html</code>, change the <code>@empty</code> block:</p>

```html
} @empty {
  <tr>
    <td colspan="4" class="text-center text-muted">
      No jobs yet — click "Add Job" to create your first one.
    </td>
  </tr>
}
```

<p class="say">🎤 "Now it honestly says 'No jobs yet.' Let's add one."</p>

<p class="do">⌨️ Add Job → type a description → Save. It appears with status <strong>new</strong>.</p>

<p class="say">🎤 "And <em>this</em> is why we seeded the NEW status — a job with no updates would've
crashed the row that shows its latest status. Now — the moment of truth: <strong>refresh.</strong>"</p>

<p class="do">⌨️ Refresh → the job persists. Open Firestore → Data → show <code>users/{uid}/jobs/{doc}</code>.</p>

<p class="say">🎤 "Still here — it came back from the cloud, not a hard-coded array. And there's
the real document in the console."</p>

<p class="do">⌨️ Log out → sign up as a <strong>second</strong> user.</p>

<p class="say">🎤 "Brand-new user, empty dashboard. They <strong>cannot</strong> see the first user's jobs —
the security rule makes it impossible, not just hidden. That's the whole lesson: saved,
per-user, and secure."</p>

---

## 7 · Wrap-up & challenges

<p class="say">🎤 "Three takeaways. One — initialize Firebase <strong>once</strong> and share it. Two — model
data <strong>per-user</strong> and your rules stay trivial. Three — Firestore stores dates as
<strong>Timestamps</strong>; always convert them back on read."</p>

<p class="say">🎤 "Two challenges. First — the CV in <code>UserService</code> is still in memory; migrate it
to Firestore the same way, as a field on the user's document. Second, for the ambitious — swap
<code>getDocs</code> for <code>onSnapshot</code> and your list updates in <strong>real time</strong>, no refresh.
Push it to your repo and we'll review next week."</p>

---

## Troubleshooting cheat-sheet

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Firebase App named '[DEFAULT]' already exists` | Two `initializeApp()` calls | Only `firebase.ts` initializes; `auth.ts` imports `firebaseAuth` |
| `Missing or insufficient permissions` | Rules block it, or signed out | Publish rules (§5); confirm logged in |
| Dashboard stuck on "Loading…" | `@empty` used as a spinner | Show real empty message (§6) |
| Date shows wrong / crashes sorting | Missing `Timestamp.toDate()` | Check `toJob()` (§3) |
| Build: *bundle exceeded budget* | Firebase is large | Raise budget in `angular.json` (§4) |
| `auth/operation-not-allowed` on signup | Email/Password provider off | Console → Authentication → enable it |
| Row crashes for a new job | Empty `jobUpdates` array | `addJob` seeds NEW status (§3) |

## Emergency recovery (if live coding wobbles)

```bash
git checkout solution -- src/app/services/job.ts   # grab a working file fast
git show solution:src/app/firebase.ts              # peek at the finished version
git restore <file>                                 # undo local edits and redo a step
```

<p class="say">🎤 Stay calm, narrate the error out loud, and use it as content — a debugged mistake
teaches more than clean code ever will.</p>
