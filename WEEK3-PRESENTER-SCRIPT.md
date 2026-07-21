# Week 3 — Presenter Script (Firestore)

> **How to use this:** each step has a **🎤 SAY** talk-track (say it in your own words —
> don't read robotically), a **⌨️ DO** cue for what to type, and **⚠️ WATCH** for common
> trip-ups. Rough total: **45–60 min**. Times are guidance, not a stopwatch.
>
> Pair this with `WEEK3-FIRESTORE-CODELAB.md` (full code) and demo from the **`main`**
> branch. The finished answer lives on the **`solution`** branch if you get stuck.

---

## 0 · Recap & hook (3 min)

**🎤 SAY:**
"Last week we wired up **Authentication** — people can sign up, log in, and we guard the
dashboard route. But there's a catch. Watch this."

**⌨️ DO:** Run the app, log in, look at the dashboard's two jobs. **Refresh the page.**

**🎤 SAY:**
"Notice the jobs are still exactly the same two, and if I *add* a job and refresh… it's
gone. That's because right now our jobs live in a plain JavaScript **array in memory**.
Reload the tab and the array is rebuilt from scratch. Worse — every single user sees the
*same* two fake jobs. Today we fix both problems with **Cloud Firestore**, Firebase's
cloud database. By the end, your jobs will be saved to the cloud and private to *you*."

**🎤 SAY (the mental model — draw this if you have a whiteboard):**
"Here's the shape of our data. Every user gets their own little folder keyed by their
**UID** — the unique ID Auth already gives every account:
`users / {your-uid} / jobs / {jobId}`. That structure is going to make our security
rules a one-liner later. Keep that path in your head."

---

## 1 · One shared Firebase instance (6 min)

**🎤 SAY:**
"First a small but important refactor. Open `auth.ts` — see how it calls `initializeApp()`?
That boots up Firebase. The rule is: you initialize Firebase **exactly once** per app. If
our new Job service *also* calls `initializeApp()`, Firebase throws
*'app named DEFAULT already exists'*. So let's create one file that initializes Firebase and
hands out the pieces everyone shares."

**⌨️ DO:** Create `src/app/firebase.ts` → paste the `initializeApp` / `getAuth` /
`getFirestore` exports.

**🎤 SAY (while typing):**
"We initialize the app, then export three things: the app itself, `firebaseAuth`, and
`firestore` — our database handle. Any service that needs Firebase just imports from here.
One source of truth."

**⌨️ DO:** Open `auth.ts`, delete its `initializeApp` line, import `firebaseAuth` from
`../firebase`, set `private auth = firebaseAuth`.

**🎤 SAY:**
"Now Auth borrows the shared instance instead of making its own. Same behaviour, but there's
only one Firebase app in the whole system. This is the groundwork that lets Firestore and
Auth coexist."

**⚠️ WATCH:** If someone gets *'DEFAULT already exists'* later, it's because a stray
`initializeApp()` is still hanging around in `auth.ts`.

---

## 2 · Turn the Job service into a database client (14 min)

**🎤 SAY:**
"This is the heart of today. Open `job.ts`. Right now it's a hard-coded array with fake
jobs. We're going to replace the *insides* — but notice the method names stay the same:
`getJobs`, `addJob`, `updateJobStatus`, all still returning Promises. That means the
dashboard component doesn't change at all. We're swapping the engine, not the dashboard."

**⌨️ DO:** Replace the imports with the `firebase/firestore` imports + `firestore`,
`firebaseAuth` from `../firebase`.

**🎤 SAY (imports):**
"These come straight from the Firestore SDK — `collection` and `doc` build references to
where data lives; `getDocs`, `addDoc`, `updateDoc` are the read and write operations;
`arrayUnion` appends to an array safely; and `Timestamp` we'll need in a second for dates."

**⌨️ DO:** Add the private `jobsCollection()` helper.

**🎤 SAY:**
"Here's where that data model pays off. `collection(db, 'users', uid, 'jobs')` points at
*this user's* jobs folder. Quick rule of thumb: an **odd** number of path segments is a
collection, an **even** number is a single document. We grab the current user's UID from
Auth — and because the dashboard is behind our auth guard, we know someone's always logged
in when this runs."

**⌨️ DO:** Write `getJobs()`.

**🎤 SAY:**
"`getDocs` reads every document in the collection once. We map each one into our `Job`
type — `d.id` is the document's ID, `d.data()` is the fields. Simple."

**⌨️ DO:** Write `addJob()` (with the `NEW`-status seeding).

**🎤 SAY:**
"`addDoc` inserts a new document and lets Firestore generate the ID for us — we don't have
to invent one. One extra touch: a brand-new job should start at status **NEW**, so we seed
that. That also saves us from a crash later — I'll show you why in a moment."

**⌨️ DO:** Write `updateJobStatus()` with `arrayUnion`.

**🎤 SAY:**
"To move a job from, say, *applied* to *interview*, we append a new status entry.
`arrayUnion` adds to the array **without** us having to read the whole thing, change it, and
write it back — safer and less code."

**⌨️ DO:** Write the `toJob()` mapper with the `Timestamp` → `.toDate()` conversion.

**🎤 SAY (emphasise — this is the #1 gotcha):**
"Last piece, and this is the classic Firestore surprise. When you save a JavaScript `Date`,
Firestore stores it as its own `Timestamp` type. When you read it back, it's **not** a
`Date` anymore — it's a `Timestamp` object. So the dashboard's date pipe and our
date-sorting would silently break. This one line — `timestamp.toDate()` — converts it back.
Remember this; it'll bite you in every Firestore project you ever build."

**⚠️ WATCH:** Save the file — expect a red squiggle to vanish once imports resolve. If the
build errors on the bundle *size*, that's the next step, not a bug.

---

## 3 · Config cleanup + bundle budget (4 min)

**⌨️ DO:** Open `app.config.ts`, delete the misleading `@angular/fire` comment block.

**🎤 SAY:**
"These commented lines mention a package called AngularFire that we're not using — we're on
the raw SDK, which we initialize in `firebase.ts`. So there's nothing to add here. Deleting
comments that lie to future-you is real work."

**⌨️ DO:** Run `npm run build`. Let it fail on the budget error.

**🎤 SAY:**
"See this? *'bundle exceeded maximum budget.'* That's not a bug — Firebase is a big library,
and Angular warns when your app gets heavy. In `angular.json` we bump the budget so the
build passes. In a real production app you'd instead lazy-load Firebase, but for us, raising
the ceiling is fine."

**⌨️ DO:** Edit the `initial` budget in `angular.json`, rebuild → green.

---

## 4 · Create the database & lock it down (8 min)

**🎤 SAY:**
"Code's done — but we're pointing at a database that doesn't exist yet. Over to the
**Firebase Console**."

**⌨️ DO:** Console → Build → Firestore Database → Create database → location → **Production
mode**.

**🎤 SAY:**
"Pick a location close to your users. And notice I'm choosing **Production mode**, not Test
mode. Test mode leaves your database open to the entire internet for 30 days — never demo
that. We're going to write proper rules right now."

**⌨️ DO:** Rules tab → paste the `users/{userId}/jobs/{jobId}` rule → Publish.

**🎤 SAY (read the rule out loud):**
"Two conditions. `request.auth != null` — you must be **signed in**. And
`request.auth.uid == userId` — the folder you're touching must be **your own** UID. That's
it. Remember I said the data model would make this a one-liner? *This* is the payoff — because
each user's jobs live under their UID, the rule is basically 'you can only touch your own
folder.' Publish it."

**⚠️ WATCH:** If writes later fail with *'Missing or insufficient permissions,'* the rules
didn't publish or the user is signed out.

---

## 5 · Fix the empty state & test (8 min)

**⌨️ DO:** `npm start`, sign up as a brand-new user. Dashboard shows… "Loading…" forever.

**🎤 SAY:**
"Perfect teachable moment. It says *Loading* and never stops. Is Firestore broken? No — open
`dashboard.html`. See this `@empty` block? Angular's `@empty` runs whenever the list is
empty. Last week the array had two fake jobs, so it was never empty. But a real new user has
**zero** jobs — the data loads successfully as an empty list, and `@empty` shows 'Loading'
forever. It was never a loading spinner; it was mislabeled."

**⌨️ DO:** Change the `@empty` block to a real "No jobs yet" message. Save.

**🎤 SAY:**
"Now it honestly says 'No jobs yet.' Let's add one."

**⌨️ DO:** Add Job → type a description → Save. It appears with status **new**.

**🎤 SAY:**
"And *this* is why we seeded the NEW status earlier — a job with an empty updates array would
have crashed the row that shows its latest status. Now: the moment of truth — **refresh.**"

**⌨️ DO:** Refresh. Job persists.

**🎤 SAY:**
"It's still here. It came back from the cloud, not from a hard-coded array. Let me prove it —
here's the Firestore Data tab… and there's our document under `users`, your UID, `jobs`.
Real data, in the cloud."

**⌨️ DO:** Log out → sign up as a **second** user.

**🎤 SAY (the closer):**
"Brand new user… and their dashboard is empty. They can't see the first user's jobs — the
security rule makes that impossible, not just hidden. That's the whole thing: saved,
per-user, and secure."

---

## 6 · Wrap-up & challenges (4 min)

**🎤 SAY:**
"Three things to take away. One: initialize Firebase **once** and share it. Two: model your
data **per-user** and your security rules stay trivial. Three: Firestore stores dates as
**Timestamps** — always convert them back on read."

**🎤 SAY (send them off with homework):**
"Two challenges if you want to keep going. First — the CV in `UserService` is still
in-memory; migrate it to Firestore the same way, as a field on the user's document. Second,
for the ambitious: swap `getDocs` for `onSnapshot` and your job list updates in **real time**,
across tabs, with no refresh. Push your work to your repo and we'll look next week."

---

## Emergency recovery (if live coding goes sideways)

- **Grab a working file fast:** `git checkout solution -- src/app/services/job.ts`
- **See the finished version of anything:** `git show solution:src/app/firebase.ts`
- **Read the full written guide:** `git show solution:WEEK3-FIRESTORE-CODELAB.md`
- **Nuke local changes and restart a step:** `git restore <file>`

Stay calm, narrate the error, and use it as content — a debugged mistake teaches more than
clean code.
