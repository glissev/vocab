# Vocab — a two-language word notebook

A small web app for collecting vocabulary in two languages and practising it with typing quizzes.
Sign in with Google, add words from your phone or laptop, and your list syncs everywhere — including offline.

The default language pair is Bulgarian ⇄ Korean; any pair can be chosen on first sign-in and changed later.

## Features

- **Google sign-in** via Firebase Authentication; every user has a private word list.
- **Add words from either side.** Fill in one language or both; entries missing a side show up as
  "needs translation" and are left out of quizzes until completed. Alternative translations are
  separated with `;` (`хубав; красив`) and all of them count as correct answers.
- **Automatic translation.** Type a word on either side and the other side fills in with a machine
  translation (free [MyMemory](https://mymemory.translated.net/) API, about 5,000 characters a day, no key).
  The suggestion is tinted until you edit it; extra suggestions can be added as variants with one click.
  Your own text is never overwritten. Turn it off in Settings → Adding words.
- **Duplicate check** on save, with an option to merge into the existing word.
- **Search** across both languages (case- and stress-mark-insensitive); filter by tag or by missing translation.
- **Quizzes** in either direction or both ways, drawn from words due for review, all words, a tag,
  or words added this week.
- **Forgiving answer checking:** case, punctuation, extra spaces and Cyrillic stress marks are ignored.
  An optional one-typo tolerance compares Hangul by individual jamo, so `사고` for `사과` counts as "almost".
  "I was right" lets you overrule the checker and add your answer as an accepted variant.
- **Spaced repetition** (Leitner boxes), tracked separately for each direction.
- **Works offline** as an installable PWA: Firestore caches the list locally and syncs changes later.
- **CSV import/export.** Paste rows straight from Excel or Google Sheets; exports are UTF-8 with a BOM
  so Excel shows Cyrillic and Hangul correctly.

## Stack and cost

| Part | Choice | Cost |
| --- | --- | --- |
| Frontend | React 19 + TypeScript + Vite, `vite-plugin-pwa` | — |
| Auth | Firebase Authentication (Google provider) | €0 |
| Database | Cloud Firestore with offline persistence | €0 on the Spark plan |
| Hosting | Firebase Hosting (`<project>.web.app`) | €0 |
| CI/CD | GitHub Actions | €0 for public repos (private repos have free monthly minutes) |
| Translation | MyMemory public API, called from the browser | €0 (daily character limit) |
| Custom domain | optional | ~€10–20 / year |

There is no backend server: the browser talks to Firestore directly, and `firestore.rules` makes sure
each user can only read and write `users/{their uid}/…`.

**Free-tier headroom.** The app subscribes to the whole word list once per session (one read per word,
then served from the local cache) and writes one small update per quiz answer. With 2,000 words and
several sessions a day you stay far below the Spark plan's daily read/write quotas. Don't enable Cloud
Storage: the app doesn't use it, and it requires a billing account.

## Set up your own copy

You need Node 20+ and a Google account.

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> → **Add project**. Google Analytics isn't needed.
2. **Build → Authentication → Get started → Sign-in method → Google → Enable.** Choose a support email and save.
3. **Build → Firestore Database → Create database.** Choose *production mode* and a region near you
   (for example `europe-west3`, Frankfurt). The region can't be changed later.
4. **Project settings → General → Your apps → Web (`</>`).** Register an app (no need to tick Hosting
   here) and keep the config values it shows.

### 2. Run locally

```bash
git clone https://github.com/<you>/<repo>.git
cd <repo>
npm install
cp .env.example .env.local         # fill in the four values from step 1.4
npm run dev                        # http://localhost:5173
```

`localhost` is an authorised sign-in domain by default, so Google sign-in works straight away.
Deploy the security rules (step 3) before you start adding words; until then Firestore denies all access.

### 3. Deploy the security rules and the site

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc # put your project id in it
npm run deploy:rules               # uploads firestore.rules
npm run deploy                     # builds and deploys to https://<project-id>.web.app
```

After the first deploy, set `VITE_FIREBASE_AUTH_DOMAIN` to `<project-id>.web.app` (or your custom domain)
and deploy again. Serving the sign-in handler from the same domain as the app keeps Google sign-in
working in Safari and in the app installed on an iPhone home screen.

### 4. Automatic deploys from GitHub (optional)

`.github/workflows/ci.yml` type-checks, tests and builds every push and pull request.
`.github/workflows/deploy.yml` deploys `main` to Firebase Hosting. It needs:

- **Repository variables** (Settings → Secrets and variables → Actions → Variables):
  `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.
- **Repository secret** `FIREBASE_SERVICE_ACCOUNT`: the JSON key of a service account allowed to deploy.
  The quickest way is `firebase init hosting:github`, which creates the service account and stores the
  key as a secret named `FIREBASE_SERVICE_ACCOUNT_<PROJECT_ID>`. Either change the secret name in
  `deploy.yml` to match, or create a key yourself (Google Cloud console → IAM → Service accounts,
  role *Firebase Hosting Admin*) and save it as `FIREBASE_SERVICE_ACCOUNT`. Delete any extra workflow
  files the init command generates.

The Firebase web config values are not secrets; they end up in the browser bundle anyway. Security
comes from Authentication plus `firestore.rules`. The workflow deploys hosting only, so run
`npm run deploy:rules` yourself whenever you change the rules.

### 5. Custom domain (optional)

Firebase console → **Hosting → Add custom domain**, follow the DNS instructions, then add the domain under
**Authentication → Settings → Authorized domains** and use it as `VITE_FIREBASE_AUTH_DOMAIN`.

## How it works

### Data model

```
users/{uid}                     profile
  langA: "bg", langB: "ko"
  quizSize: 20, typoTolerance: true, createdAt

users/{uid}/entries/{entryId}   one word
  a: ["хубав", "красив"]         side A variants
  b: ["예쁘다"]                   side B variants
  aNorm, bNorm                   normalised copies (duplicate detection)
  note: "adjective", tags: ["adj"]
  createdAt, updatedAt           epoch ms
  review:
    a2b: { box, dueAt, right, wrong, lastAt }
    b2a: { box, dueAt, right, wrong, lastAt }
```

### Review schedule

Each direction has its own Leitner box. A correct (or "almost") answer moves the word up one box;
a wrong answer sends it back to box 1.

| Box | Next review |
| --- | --- |
| 0 (new) | due now |
| 1 | in 1 day (10 minutes after a wrong answer) |
| 2 | in 3 days |
| 3 | in 7 days |
| 4 | in 14 days |
| 5 | in 30 days |

"Due for review" quizzes pick the most overdue words first. A word answered wrong comes back once more
at the end of the same quiz; only the first answer counts for the schedule. "Practise missed words" on the
results screen doesn't change the schedule. The green meter in the word list shows the lower of the two
directions' boxes, i.e. how well you know a word both ways.

### CSV format

| Column | Content |
| --- | --- |
| 1 | language A (variants separated by `;`) |
| 2 | language B |
| 3 | note (optional) |
| 4 | tags, separated by spaces or `\|` (optional) |

Comma-, semicolon- and tab-separated files all work. The importer detects the delimiter and whether the
first row is a header, and shows a preview before importing. Rows already in your list (same word on both
sides) are skipped.

## Project structure

```
src/
  firebase.ts              Firebase init (Auth + Firestore with IndexedDB cache)
  data/auth.tsx            Google sign-in context (popup, redirect fallback)
  data/store.ts            Firestore hooks and writes
  lib/text.ts              normalisation, variant parsing, answer checking (tested)
  lib/leitner.ts           review schedule (tested)
  lib/quiz.ts              quiz selection (tested)
  lib/csv.ts               import/export (tested)
  lib/languages.ts         language list
  lib/hooks.ts             online status, IME-safe Enter handling
  components/              screens: SignIn, Onboarding, Words, Quiz, Settings
firestore.rules            per-user access rules
firebase.json              hosting, rules and emulator config
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | local dev server |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | type-check and production build into `dist/` |
| `npm run deploy` | build and `firebase deploy` (hosting + rules) |
| `npm run deploy:rules` | deploy only `firestore.rules` |

## Troubleshooting

- **"This domain is not authorised for sign-in"**: add the domain under Authentication → Settings →
  Authorized domains.
- **Sign-in loops on iPhone or in the installed app**: set `VITE_FIREBASE_AUTH_DOMAIN` to the domain the
  app is served from (see step 3).
- **"Missing or insufficient permissions" in the console**: the rules weren't deployed; run `npm run deploy:rules`.
- **Changes on one device don't appear on another**: the other device is probably offline (the header
  shows an "Offline" pill). Changes sync as soon as it reconnects.

## License

MIT
