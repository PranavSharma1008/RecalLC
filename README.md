# RecallLC

**Solve it. Remember it. Master it.**

RecallLC is a Chrome extension (Manifest V3) that helps you revise the LeetCode
problems you have already solved — at the exact moment you open a new one.

Open _Number of Islands_ and RecallLC notices that _Climbing Stairs_ was
attempted three days ago and is due for revision. A small card appears in the
bottom-right corner:

```
┌────────────────────────────────────┐
│ ↻  TIME TO REVISE!   2 days late  │
├────────────────────────────────────┤
│ Climbing Stairs                    │
│ [Medium] [Dynamic Programming]     │
│ Last attempted: 3 days ago · 2 attempts │
│ [ Revise Now ] [ Remind Tomorrow ] [ Dismiss ] │
└────────────────────────────────────┘
```

Everything runs **locally**. No account, no server, no telemetry.

---

## Table of contents

- [Features](#features)
- [Install the built extension](#install-the-built-extension)
- [Build it yourself](#build-it-yourself)
- [Importing your attempt history](#importing-your-attempt-history)
- [How the revision schedule works](#how-the-revision-schedule-works)
- [The recall-first workflow](#the-recall-first-workflow)
- [Privacy & permissions](#privacy--permissions)
- [Limitations](#limitations)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)

---

## Features

| Area                           | What RecallLC does                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| **Current problem detection**  | Recognises `leetcode.com/problems/<slug>`, follows single-page navigation, and never shows two cards at once. |
| **In-page reminder**           | One compact, keyboard-accessible card with **Revise Now**, **Remind Tomorrow** and **Dismiss**.               |
| **Automatic attempt tracking** | Records an attempt only when LeetCode reports a _verdict_. Opening a problem is never counted as an attempt.  |
| **Import**                     | JSON and CSV, with a preview, validation, de-duplication and a per-run summary.                               |
| **Revision engine**            | Configurable spaced repetition with an initial interval, overdue handling, snoozing and a review history.     |
| **Dashboard**                  | Due today, overdue, tracked, revised-this-week, streak, topics, search, filters, sorting and notes.           |
| **Recall-first workflow**      | A four-question checklist, notes that stay hidden until you reveal them, and a four-way recall rating.        |
| **Backup**                     | Export everything to JSON, restore it later, or wipe it.                                                      |

---

## Install the built extension

The repository ships without a prebuilt `dist/`, so build it first (below), or
use a release build if one is provided.

1. Build the extension:

   ```bash
   npm install
   npm run build
   ```

2. Open Chrome and go to `chrome://extensions`.

3. Turn on **Developer mode** (top-right toggle).

4. Click **Load unpacked** and select the `dist/` folder produced by the build.

5. Pin RecallLC to your toolbar (click the puzzle-piece icon → pin).

6. Visit a LeetCode problem. The onboarding page opens automatically on first
   install; you can always get back to it from **Dashboard → Settings**.

> **Tip:** after changing the extension's code, press the ⟳ (reload) button on
> the `chrome://extensions` card to pick up the new build.

---

## Build it yourself

**Requirements:** Node.js 20.19+ (developed on Node 24) and Chrome 116+.

```bash
npm install        # install dependencies
npm run dev        # development server with hot reload (chrome-extension://…/src/popup/index.html)
npm run build      # type-check + production build into dist/
npm test           # run the unit tests
npm run typecheck  # TypeScript only
npm run preview    # preview the production build
```

| Script                   | What it does                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `npm run dev`            | Vite dev server with CRXJS HMR (content scripts reload too).                                 |
| `npm run build`          | `tsc --noEmit` then `vite build` → `dist/`.                                                  |
| `npm run server`         | Starts the local backend server (port 3000) for Razorpay checkout & landing page.            |
| `npm test`               | Vitest, single run (258 unit & integration tests across 26 test suites).                     |
| `npm run test:watch`     | Vitest in watch mode.                                                                        |
| `npm run typecheck`      | Strict TypeScript check (`tsc --noEmit`).                                                    |
| `npm run verify`         | Real-Chrome E2E verification of manifest, SW restart, IndexedDB, and UI pages via CDP.       |
| `npm run verify:content` | Real-Chrome E2E verification of the in-page reminder island and verdict submission tracking. |
| `npm run package`        | Builds production extension and creates distributable `recalllc-v1.0.0.zip`.                 |
| `npm run screenshot`     | Captures popup and dashboard screenshots via headless Chrome.                                |
| `npm run format`         | Formats codebase using Prettier.                                                             |
| `npm run format:check`   | Verifies code formatting against Prettier rules.                                             |
| `npm run icons`          | Regenerates the PNG icons from `scripts/generate-icons.mjs`.                                 |

**Stack:** React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 · Vite 8 +
`@crxjs/vite-plugin` 3 · Dexie 4 (IndexedDB) · Vitest 5.

---

## Importing your attempt history

Open **Dashboard → Import**, drop in a `.json` or `.csv` file, review the
preview, and confirm. Nothing is written until you press _Import_.

A sample file is included: [`samples/sample-import.json`](samples/sample-import.json)
(and `public/sample-import.csv`, downloadable from inside the extension).

### Documented JSON format

Each object is **one attempt**:

```json
{
  "slug": "two-sum",
  "title": "Two Sum",
  "url": "https://leetcode.com/problems/two-sum/",
  "attemptedAt": 1792454400000,
  "accepted": true,
  "language": "java",
  "submissionId": "optional-id"
}
```

| Field          | Required | Notes                                                                    |
| -------------- | -------- | ------------------------------------------------------------------------ |
| `slug`         | **yes**  | `two-sum`. A full URL in this field is accepted and reduced to its slug. |
| `attemptedAt`  | **yes**  | See _Timestamps_ below.                                                  |
| `title`        | no       | Falls back to a title derived from the slug.                             |
| `url`          | no       | Falls back to `https://leetcode.com/problems/<slug>/`.                   |
| `accepted`     | no       | `true`/`false`, `1`/`0`, `"yes"`, `"Accepted"`, `"Wrong Answer"`, …      |
| `language`     | no       | Free text, e.g. `"python3"`.                                             |
| `submissionId` | no       | LeetCode submission id. Used for de-duplication across imports.          |

The file may be a bare array, or an object with an `attempts` / `problems` /
`records` / `items` / `data` / `history` array.

### Documented CSV format

The first row must be a header. Column names are matched loosely and
case/separator-insensitively:

| Logical field | Accepted header names                                                                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| slug          | `slug`, `titleSlug`, `title_slug`, `problemSlug`, `problem_slug`, `questionSlug`, `name`, `problem`, `question`                                                                                   |
| timestamp     | `attemptedAt`, `attempted_at`, `timestamp`, `time`, `date`, `datetime`, `createdAt`, `created_at`, `submittedAt`, `submitted_at`, `submissionTime`, `lastAttempted`, `last_attempted`, `solvedAt` |
| title         | `title`, `problemTitle`, `questionTitle`, `name`                                                                                                                                                  |
| url           | `url`, `problemUrl`, `link`, `href`                                                                                                                                                               |
| accepted      | `accepted`, `isAccepted`, `success`, `solved`, `status`, `result`, `verdict`, `outcome`                                                                                                           |
| language      | `language`, `lang`, `programmingLanguage`, `programming_language`                                                                                                                                 |
| submission id | `submissionId`, `submission_id`, `subId`, `id`, `submission`                                                                                                                                      |

Example:

```csv
slug,title,attemptedAt,accepted,language,submissionId
two-sum,Two Sum,1792454400000,true,java,88012301
coin-change,Coin Change,1792281600000,false,java,88014777
```

### Timestamps

| Input                              | Interpreted as                              |
| ---------------------------------- | ------------------------------------------- |
| `1792454400000` (number ≥ 1e11)    | Unix **milliseconds**                       |
| `1792454400` (number < 1e11)       | Unix **seconds**                            |
| `"1792454400000"` / `"1792454400"` | Same rule as a number                       |
| `"2026-10-21T09:00:00Z"`           | Absolute time                               |
| `"2026-10-21T09:00:00+02:00"`      | Absolute time                               |
| `"2026-10-21"`                     | **Local** midnight — flagged in the preview |
| `"2026-10-21 09:30:00"`            | **Local** time — flagged in the preview     |

The seconds/milliseconds threshold (1e11) is unambiguous: 1e11 milliseconds is
the year 1973, and 1e11 seconds is the year 5138. Ambiguous _forms_ (a bare
date, a zone-less date-time) are never silently shifted — they are interpreted
as local time and reported as a warning in the import preview.

### De-duplication and merging

- An attempt is identified by its `submissionId` when it has one, and by
  `(slug, timestamp, language)` when it does not.
- Attempts for the same problem are **merged** into one tracked problem:
  earliest attempt, latest attempt, attempt count, accepted status (any
  accepted attempt ⇒ accepted) and the most recent language.
- Importing the same file twice imports nothing the second time.

### Import summary

Every run reports `imported`, `duplicated`, `invalid` and `merged` counts, plus
the exact reason for each rejected row. Malformed JSON, a CSV without a slug
column, an empty file and files larger than 5 MB all produce a specific,
human-readable error instead of a stack trace.

---

## How the revision schedule works

### Intervals

| Rating     | Meaning                       | Default interval |
| ---------- | ----------------------------- | ---------------- |
| **Forgot** | Blanked out                   | 1 day            |
| **Hard**   | Roughly remembered, shaky     | 2 days           |
| **Good**   | Recalled with a little effort | 5 days           |
| **Easy**   | Instant recall                | 14 days          |

All four are editable in **Settings → Revision schedule**, together with the
**first review** interval (default 1 day): how long after a first attempt a
never-reviewed problem becomes due.

> A problem attempted three days ago with the default first-review interval of
> one day became due two days ago — so it is already overdue, exactly as in the
> example at the top of this file.

### Rules

- Dates are **local calendar days**, not 24-hour blocks, so a review scheduled
  "tomorrow" stays "tomorrow" across a daylight-saving change.
- **Dismiss** hides the card for the rest of today and **never** changes the
  schedule.
- **Remind Tomorrow** hides the card until the next local midnight and **never**
  changes the schedule.
- **Pause** removes a problem from reminders until you resume it.
- Every rating, snooze and dismissal is written to an immutable review history.
- A "Forgot" rating resets the repetition stage back to zero.

### Reminder priority

1. Overdue problems first (the longer they are overdue, the higher the priority).
2. Then problems due today.
3. Then problems you struggled with (repeat attempts, failed submissions and
   low recall ratings raise a per-problem _struggle score_).
4. Ties break on the oldest due date, then the slug — so the queue is stable.

The problem you currently have open is always excluded from the reminder.

---

## The recall-first workflow

Clicking **Revise Now** opens the original LeetCode problem in a new tab. The
recall panel lives in the dashboard at `#/recall/<slug>` and works in three
steps:

1. **Recall first** — answer four prompts from memory:
   - What is the main approach?
   - What data structure or algorithm is used?
   - What is the time complexity?
   - What mistake did I previously make?
2. **Your notes** — hidden behind a _Reveal my notes_ button, so you cannot
   accidentally read your own solution before trying.
3. **How well did you recall it?** — Forgot / Hard / Good / Easy. Your answer
   sets the next review date.

RecallLC never injects a solution, a hint or anything else into LeetCode's
editor, and never modifies the page.

---

## Privacy & permissions

RecallLC is **local-first**. Your attempt history, notes and revision schedule
live in your browser profile and never leave your device.

### Permissions requested

| Permission                               | Why                                                                                                                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                                | Persist your settings and revision schedule locally.                                                                                                       |
| Host permission `https://leetcode.com/*` | Read the problem page you are already on, detect the current slug, detect the submit verdict, and (only if you opt in) fetch the public problem catalogue. |

That is the complete list. RecallLC does **not** request `tabs`, `scripting`,
`cookies`, `webRequest`, `history` or `notifications`.

### What RecallLC never does

- It never asks for your LeetCode password or any other credential.
- It never reads, stores or forwards your session cookies. The optional
  account sync performs its request **from the page you are already signed in
  on**, so the browser attaches your session itself — RecallLC never sees it.
- It contains no analytics, no telemetry and no remote code. Nothing is sent to
  any server, because there is no server.
- It does not modify LeetCode's page. The content script only reads the DOM and
  adds one isolated container for its own UI.
- Imported files are treated as untrusted input: every field is validated, and
  the content is rendered as text, never as HTML.

---

## Limitations

These are honest limitations, not bugs waiting to be fixed:

- **LeetCode's GraphQL API is bot-protected.** A plain HTTP client gets
  `403 Forbidden`; the endpoint only answers requests that come from a real
  browser session on leetcode.com. RecallLC therefore performs its catalogue
  and history requests **from the page context** — you must be signed in on
  leetcode.com for the optional account sync to work. The public legacy
  endpoint (`/api/problems/all/`) works without a session but has no topic tags.
- **Automatic history retrieval is incomplete by design.** LeetCode's
  `submissionList` query is paginated and only returns a limited window of
  recent submissions. RecallLC cannot recover a complete archive of every
  submission you have ever made, and it does not claim to. The import workflow
  is the complete path for bulk history.
- **Account sync is opt-in and off by default.** It requires you to visit
  leetcode.com while signed in, and it runs at most once every six hours.
  Review LeetCode's Terms of Service before enabling it.
- **LeetCode's DOM is not a stable API.** The verdict detector watches for the
  verdict LeetCode renders and uses several fallbacks, but a redesign could
  break it. It fails silently rather than recording wrong data — an attempt is
  only recorded when a verdict is positively identified. Manual saving
  (**Problems → Add notes / Revise**) remains available as a fallback.
- **Difficulty and topics are best-effort.** They come from the public
  catalogue, so a problem you have not visited may only get a title and a
  difficulty until you open it on leetcode.com.
- **Premium problems** are only tracked by slug; their editor and submissions
  are not read.

---

## Architecture

```
┌─────────────────────┐        ┌──────────────────────┐        ┌────────────────────┐
│  LeetCode page      │        │  Extension UI        │        │  Service worker    │
│                     │        │                      │        │                    │
│ content.tsx         │        │ popup/App.tsx        │        │ serviceWorker.ts   │
│  ├ SPA detection    │        │ dashboard/*          │        │  ├ message router  │
│  ├ ReminderRoot     │        │                      │        │  ├ Dexie (IndexedDB)│
│  ├ SubmissionTracker│        │                      │        │  └ import/export   │
│  └ leetcodeApi      │        │                      │        │                    │
└──────────┬──────────┘        └───────────┬──────────┘        └─────────┬──────────┘
           │  chrome.runtime.sendMessage    │                              │
           └───────────────────────────────┴──────────────────────────────┘
                                          │
                            chrome.storage.local  →  settings (small)
                            IndexedDB            →  problems, attempts,
                                                      revisions, review events
```

**Why a single writer?** A content script's `IndexedDB` resolves to the _page's_
origin — `leetcode.com`. Storing revision history there would expose it to the
website. The service worker owns the extension origin, so every durable read
and write is funnelled through it and the content script only sends messages.

### Layers

| Layer          | Files                             | Responsibility                                                                                |
| -------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| **Types**      | `src/types/index.ts`              | The whole domain model and the message protocol.                                              |
| **Utilities**  | `src/utils/*`                     | Pure helpers: timestamps, local-day arithmetic, CSV, slugs, ids.                              |
| **Services**   | `src/services/*`                  | Revision engine, import pipeline, repository, storage, tracking, LeetCode adapter, messaging. |
| **Background** | `src/background/serviceWorker.ts` | Message router, install handling, the only writer to IndexedDB.                               |
| **Content**    | `src/content/*`                   | Current-problem detection, the React island, submission tracking, optional sync.              |
| **Components** | `src/components/*`                | Presentational React components shared by the popup, dashboard and the in-page card.          |
| **UI**         | `src/popup`, `src/dashboard`      | The two extension pages.                                                                      |

The revision engine is a set of **pure functions** — every one of them takes
`now` as an argument — which is what makes the scheduling model straightforward
to test.

---

## Data model

| Type                | Purpose                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Problem`           | The tracked problem: title, difficulty, topics, notes, first/last attempt, attempt count, accepted flag, struggle score. |
| `SubmissionAttempt` | One submission. Many per problem.                                                                                        |
| `RevisionRecord`    | The single active schedule for a problem: due date, stage, last rating, snooze, dismissal, paused flag.                  |
| `ReviewEvent`       | An immutable audit trail of every rating, snooze and dismissal.                                                          |
| `UserSettings`      | Theme, intervals, reminder behaviour, tracking and sync switches.                                                        |
| `ImportResult`      | The summary of an import run.                                                                                            |

The **problem slug** is the stable identifier everywhere. Attempts are kept
separate from revision records on purpose: a problem can have many attempts
but exactly one schedule.

**Historical timestamps are preserved.** An imported attempt from 2024 keeps
its 2024 date — it is never replaced with "now" or the install date.

**Storage & schema versioning.** IndexedDB is managed by Dexie with an
explicit version history (`v1` → `v2`, where `v2` adds the catalogue cache and
the import history and backfills fields added after `v1`). Future migrations
are added as new `version(n)` blocks; released blocks are never mutated.
Settings live in `chrome.storage.local` because they are small and need to be
read synchronously-ish from the content script.

---

## Testing

```bash
npm test
npm run verify
npm run verify:content
```

258 unit & integration tests across 26 test files plus full Chrome E2E automation suites, covering:

- **Ultra-Fast Request & Response Acceleration** — in-flight request coalescing/deduplication
  for both network and IPC messaging channels, sub-millisecond in-memory read micro-caching
  with instant mutation invalidation, IndexedDB batching (`bulkPut` and direct count queries),
  storage read caching, and fast network timeout protections (`AbortSignal.timeout`).

- **Security & Penetration Hardening** — timing-safe comparisons (`timingSafeEqual`),
  passcode cryptographic hashing (SHA-256 + salt + pepper) with pure TS FIPS fallback,
  anti-brute-force lockout and storage-backed rate limiting, safe URL validation
  against malicious schemes (`javascript:`, `data:`, `vbscript:`, protocol-relative `//`),
  and HTML sanitization.
- **IPC & Cross-Context Security** — internal extension origin validation for
  privileged service worker actions (`export`, `restore`, `clear-all`, `delete-problem`,
  `update-settings`) restricting execution strictly to `chrome.runtime.id`, preventing
  content scripts and third-party extensions from escalating privileges.
- **Backend & Razorpay Standard Checkout** — HMAC-SHA256 signature verification,
  secure order creation with parameter validation, rate limiting per IP,
  strict CORS whitelisting, and OWASP security headers.
- **CSV & Import Defense** — formula injection neutralization (CWE-1236) by prefixing
  formula characters (`=`, `+`, `-`, `@`, `\t`) with apostrophes, and prototype
  pollution immunity against `__proto__` and `constructor.prototype` in JSON imports.
- **Inline Rocket Push Button** — mounting between LeetCode "Analysis" and "Solution"
  action buttons across SPA navigations, solution code extraction, and deduplicated notes.
- **Eventual Development & State Resilience** — corrupted backup restoration,
  NaN timestamp recovery, rapid sequential attempt deduplication, and session expiration boundaries.
- **Revision engine** — interval calculations, due-today/overdue detection,
  snoozing, dismissal (and that neither reschedules), paused problems,
  current-problem exclusion, overdue and struggle prioritisation, streaks.
- **LeetCode API adapters** — verdict mapping (`statusToAccepted`), public REST
  catalogue parsing, GraphQL problemset queries, paginated submission history,
  and error boundaries.
- **Timestamps** — Unix seconds vs milliseconds, ISO 8601, local date-times,
  date-only values, invalid and impossible dates.
- **Local-day arithmetic** — midnight snapping, month/year boundaries,
  day differences.
- **Import** — JSON arrays and wrappers, malformed JSON, unrecognised
  structures, CSV with quoted fields / CRLF / BOM / blank rows / ragged rows,
  missing slug columns, aliases, duplicate detection, merging.
- **Normalisation** — slug extraction from URLs, missing required fields,
  accepted-flag parsing, unrecognised flags.
- **Repository** — merging attempts, de-duplication, scheduling, review
  events, notes, pausing, page views that are not attempts, statistics,
  backup/restore, deletion.
- **Persistence** — data survives closing and reopening the database, i.e. it
  is still there after the browser is restarted.
- **Submission tracking** — a verdict is only recorded after a _Submit_
  click, never on a plain page view, and never for a _Run Code_ click.
- **URL detection** — slugs are read from problem URLs, including SPA
  navigation.
- **Real-Chrome E2E automation** — headless Chrome via DevTools Protocol
  exercises the built extension in `dist/`, including service worker restart,
  in-page reminder React island mounting, and in-page submission tracking.

The repository tests run against a real IndexedDB implementation
(`fake-indexeddb`), so the actual database code path — including schema
versioning — is exercised. Verified on Chrome 156.

---

## Project layout

```
src/
  manifest.config.ts        MV3 manifest (defineManifest)
  types/index.ts            Domain types + message protocol
  utils/                    time, date, csv, slug, id
  services/                 db, storage, repository, revisionEngine,
                            historyNormalizer, historyImporter,
                            submissionTracker, leetcodeApi, messaging
  background/               serviceWorker.ts
  content/                  content.tsx, ReminderRoot.tsx, reminder.ts
  components/               RevisionCard, RevisionReminder, RecallRating,
                            ImportPreview, ui/*
  hooks/                    useAsync, useSettings, useTheme, useHashRoute
  popup/                    index.html, main.tsx, App.tsx
  dashboard/                index.html, main.tsx, Dashboard.tsx, screens/*
  styles/                   theme.css, palette.css, app.css, content.css
  dev/                      sampleData.ts, DevPanel.tsx  (development builds only)
  tests/                    setup.ts + 9 spec files
public/                     icons, sample-import.json, sample-import.csv
samples/                    sample-import.json
scripts/                    generate-icons.mjs
```

---

## Troubleshooting

**The reminder never appears.**
Check that the extension is enabled and that **Settings → Reminders** is on.
Remember that the problem you are looking at is excluded — you need _another_
problem that is due. If you have no history yet, import a file or solve
something on LeetCode.

**Nothing was recorded after I submitted.**
The verdict detector needs a verdict to appear on the page. LeetCode
redesigns sometimes; check the console for `[RecallLC]` warnings. You can also
save the problem manually from **Dashboard → Problems**.

**"Import complete" but the dashboard is empty.**
Check the summary: if `imported` is 0 and `invalid` is high, the file did not
match the documented format. The preview lists the exact reason per row.

**The build fails with `transformWithEsbuild`.**
Vite 8 uses Rolldown; do not pass `minify: 'esbuild'` in `vite.config.ts`.

**`npm install` fails on Node 18.**
Node 20.19+ is required.

---

## License

MIT.

# RecalLC
