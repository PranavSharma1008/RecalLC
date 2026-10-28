# RecallLC

**Solve it. Remember it. Master it.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Published-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/recallc-%E2%80%94-smart-leetcode/jdpadmceoelmbpmanhcagdnbooceclpo)
[![Version](https://img.shields.io/badge/version-1.0.3-brightgreen.svg)](https://chromewebstore.google.com/detail/recallc-%E2%80%94-smart-leetcode/jdpadmceoelmbpmanhcagdnbooceclpo)
[![Tests](https://img.shields.io/badge/tests-343%20passed-success)](https://github.com/PranavSharma1008/RecalLc)
[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-GitHub%20Sponsors-ea4aaa?logo=github&logoColor=white)](https://github.com/sponsors/PranavSharma1008)
[![Razorpay](https://img.shields.io/badge/Donate-Razorpay-0c2340?logo=razorpay&logoColor=white)](https://razorpay.me/@recallc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

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

- [Support & Sponsorship (India & Outside India)](#support--sponsorship-india--outside-india)
- [Install from Chrome Web Store](#install-from-chrome-web-store)
- [Features](#features)
- [Manual Rocket Push Flow (LeetCode & GeeksforGeeks)](#manual-rocket-push-flow-leetcode--geeksforgeeks)
- [Loading the Extension Locally on Your Monitor](#loading-the-extension-locally-on-your-monitor)
- [Packaging & Sole Distributable final.zip](#packaging--sole-distributable-finalzip)
- [Build it yourself](#build-it-yourself)
- [Complete Backup, Transfer & Importing](#complete-backup-transfer--importing)
- [How the revision schedule works](#how-the-revision-schedule-works)
- [The recall-first workflow](#the-recall-first-workflow)
- [Security & Anti-Hacking Architecture](#security--anti-hacking-architecture)
- [Privacy & permissions](#privacy--permissions)
- [Limitations](#limitations)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Support & Sponsorship (India & Outside India)

RecalLC is 100% free, private, and open-source. Two official payment and sponsorship options are available depending on your location:

| Region                       | Payment Platform    | Supported Methods                                                                  | Direct Contribution Link                                                                 |
| :--------------------------- | :------------------ | :--------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| **Inside India** (Option 1)  | **Razorpay**        | UPI (GPay, PhonePe, Paytm), RuPay / Visa / Mastercard, NetBanking (INR ₹)          | 👉 **[Pay with Razorpay (India)](https://razorpay.me/@recallc)**                         |
| **Outside India** (Option 2) | **GitHub Sponsors** | International Credit/Debit Cards, PayPal, Monthly or One-Time sponsorships (USD $) | 👉 **[Sponsor on GitHub (Outside India)](https://github.com/sponsors/PranavSharma1008)** |

- **GitHub Sponsors Dashboard**: Manage or review sponsorships at `https://github.com/sponsors/PranavSharma1008/dashboard`.
- **Developer**: Pranav Sharma ([pranav2410991479@gmail.com](mailto:pranav2410991479@gmail.com)) • [LinkedIn](https://www.linkedin.com/in/pranavsharma1008/).

---

---

## Install from Chrome Web Store

RecallLC is published and available on the official **Google Chrome Web Store**:

👉 **[Install RecallLC on Chrome Web Store](https://chromewebstore.google.com/detail/recallc-%E2%80%94-smart-leetcode/jdpadmceoelmbpmanhcagdnbooceclpo)**

Direct store link:  
`https://chromewebstore.google.com/detail/recallc-%E2%80%94-smart-leetcode/jdpadmceoelmbpmanhcagdnbooceclpo`

1. Click **"Add to Chrome"**.
2. Click the puzzle-piece icon 🧩 on your toolbar and pin 📌 **RecallLC**.
3. Visit any problem on [leetcode.com](https://leetcode.com/problemset/all/) or [geeksforgeeks.org](https://practice.geeksforgeeks.org/) — RecallLC will automatically begin tracking your problem verdicts and scheduling spaced repetition reminders!

---

## Features

| Area                                | What RecallLC does                                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Manual Rocket Push (100% Reliable)** | Dedicated **🚀 Push to RecallLC** rocket button integrated into LeetCode and GeeksforGeeks headers for on-demand, verified push. |
| **In-Page Banner Prompt**           | Displays a non-intrusive 5-second in-page banner prompt (`🚀 Click rocket to push question to RecallLC`) upon opening any problem.     |
| **Current problem detection**       | Recognises `leetcode.com/problems/<slug>` and `geeksforgeeks.org/problems/<slug>`, follows SPA navigation without duplicate cards.   |
| **In-page reminder island**         | One compact, keyboard-accessible card with **Revise Now**, **Remind Tomorrow** and **Dismiss**.                                       |
| **Complete Backup & Transfer**      | Single-click **📦 Download Complete Backup (JSON)** exports 100% of problems, notes, code, and schedules for seamless multi-device transfer. |
| **Import**                          | Drop any `.json` or `.csv` attempt export or complete backup file with instant preview, validation, and de-duplication.                |
| **Revision engine**                 | Spaced repetition intervals with custom day selection (Mon–Sun + exact days), overdue handling, snoozing, and review history.         |
| **Master Security Passcode**        | Optional master lock passcode of any length (numbers or text) with clear backup recovery warnings.                                    |
| **Built-in User Guide**             | Direct **📖 User Manual & Guide** button in the dashboard navigation explaining the rocket push workflow step-by-step.               |
| **Dashboard**                       | Due today, overdue, tracked, revised-this-week, streak, topics, search, filters, sorting and notes.                                   |
| **Recall-first workflow**           | Four-question checklist, notes that stay hidden until revealed, and a four-way recall rating.                                        |

---

## Manual Rocket Push Flow (LeetCode & GeeksforGeeks)

To prevent unwanted sample testcase submissions or half-finished code from accidentally cluttering your revision schedule, RecallLC puts you in total control with a **100% manual rocket push button**:

1. **2-Second In-Page Prompt**:
   - Whenever you navigate to any problem page on [LeetCode](https://leetcode.com/problems/) or [GeeksforGeeks](https://practice.geeksforgeeks.org/), a clean floating banner appears for 5-6 seconds:
     > `🚀 Click rocket to push question to RecallLC`
   - It automatically fades away without disrupting your coding or layout.

2. **The Rocket Button (`🚀 Push to RecallLC`)**:
   - Located conveniently directly next to the editor controls / header bar on LeetCode and GeeksforGeeks.
   - When all your testcases pass (or whenever you decide your solution is ready to be tracked):
     - Click the **🚀 Rocket** button.
     - RecallLC captures the problem title, slug, topic tags, difficulty, programming language, your solution code, and notes.
     - The rocket triggers a smooth CSS launch animation 🚀💨 and morphs into a green badge: **`✓ Added`**.
     - The problem is immediately committed to your local IndexedDB and scheduled for spaced repetition revision.

3. **No Accidental Submissions**:
   - Running sample cases or clicking preliminary buttons will **never** push data into your extension database.
   - Only your explicit click on the rocket button pushes the question.

---

## Loading the Extension Locally on Your Monitor

You can load and run RecalLC directly on your local monitor in any Chromium-based browser (Google Chrome, Microsoft Edge, Brave, Arc, Opera, Vivaldi) without relying on the web store.

### Method 1: Instant Load via `final.zip` (No Node.js Required)

1. **Extract `final.zip`**: Unzip `final.zip` into a local directory on your machine.
2. **Open Extensions Page**: In your browser address bar, navigate to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. **Turn on Developer Mode**: Toggle the **"Developer mode"** switch located at the top-right corner of the window.
4. **Load Unpacked**: Click the **"Load unpacked"** button in the top-left toolbar.
5. **Select Folder**: Choose the folder where you extracted `final.zip` (it contains `manifest.json` right at its root).
6. **Pin to Toolbar**: Click the extensions puzzle icon (🧩) on your browser toolbar and pin 📌 **RecalLC**.

---

### Method 2: Build From Source with Live Monitor & HMR

1. **Install dependencies and build**:
   ```bash
   npm install
   npm run build
   ```
2. **Load the extension**:
   - Go to `chrome://extensions` and enable **Developer mode**.
   - Click **"Load unpacked"** and select the `dist/` directory (or the project root).
3. **Live HMR Development Mode**:
   - Run `npm run dev` to start Vite with CRXJS hot-module-replacement.
   - Edit any component or script in `src/` — changes immediately reload in your browser!

---

### How to Inspect & Monitor RecalLC via DevTools on Your Monitor

When running locally, you can monitor and debug every context of the extension in real time using Chrome DevTools:

1. **Inspect Background Service Worker**:
   - Go to `chrome://extensions`.
   - Find the **RecalLC** card and click the blue link: `service worker` (or `Inspect views: background page`).
   - A dedicated DevTools window opens to view service worker logs, indexedDB queries, and lifecycle events.
2. **Inspect the Extension Popup**:
   - Right-click the RecalLC icon in your browser toolbar and select **"Inspect popup"**.
   - DevTools opens docked to the popup, allowing you to debug UI states, local storage, and styles.
3. **Inspect the Full Dashboard**:
   - Open the Dashboard (`chrome-extension://<id>/src/dashboard/index.html` or click Dashboard in popup).
   - Right-click anywhere and select **Inspect** (`Cmd+Option+I` on Mac, `Ctrl+Shift+I` on Windows/Linux).
   - Under the **Application** tab → **Storage** → **IndexedDB**, view the `recallc_db` database containing your problems, attempts, and revisions.
4. **Inspect In-Page Content Scripts on LeetCode / GeeksforGeeks**:
   - Navigate to any problem on `leetcode.com/problems/<slug>/` or `geeksforgeeks.org/problems/<slug>/`.
   - Open DevTools (`F12`), switch to the **Console** tab, and filter by `[RecallLC]` to monitor in-page verdict detection, submission captures, and floating reminder cards.
5. **Reloading after edits**:
   - Whenever you re-run `npm run build`, simply click the circular **⟳ (Reload)** icon on the RecalLC card in `chrome://extensions`.

---

## Packaging & Sole Distributable final.zip

The project distributes code strictly via a single, self-contained zip file: `final.zip`.

```bash
npm run package
```

**Packaging guarantees**:

- **Sole Distributable Archive**: Before and after packaging, the script actively purges any temporary or secondary `.zip` files (such as `final(1).zip` or competing archives) to guarantee `final.zip` is the sole distributable file.
- **Dual Entrypoint Structure**: `final.zip` overlays compiled production assets (`manifest.json`, `service-worker-loader.js`, and compiled bundles) directly at the root level for instant **"Load unpacked"** loading, while also preserving the complete source code and `dist/` directory.
- **Exclusion of Junk**: Automatically excludes `node_modules`, `.git`, `.DS_Store`, build caches, and test artifacts.

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
| `npm test`               | Vitest, single run (307 unit, integration & penetration tests across 32 test suites).        |
| `npm run test:watch`     | Vitest in watch mode.                                                                        |
| `npm run typecheck`      | Strict TypeScript check (`tsc --noEmit`).                                                    |
| `npm run verify`         | Real-Chrome E2E verification of manifest, SW restart, IndexedDB, and UI pages via CDP.       |
| `npm run verify:content` | Real-Chrome E2E verification of the in-page reminder island and verdict submission tracking. |
| `npm run package`        | Builds production extension and creates distributable `final.zip`.                           |
| `npm run screenshot`     | Captures popup and dashboard screenshots via headless Chrome.                                |
| `npm run format`         | Formats codebase using Prettier.                                                             |
| `npm run format:check`   | Verifies code formatting against Prettier rules.                                             |
| `npm run icons`          | Regenerates the PNG icons from `scripts/generate-icons.mjs`.                                 |

**Stack:** React 19 · TypeScript 5.9 (strict) · Tailwind CSS 4 · Vite 8 +
`@crxjs/vite-plugin` 3 · Dexie 4 (IndexedDB) · Vitest 5.

---

## Complete Backup, Transfer & Importing

RecallLC makes backing up and transferring your data between devices and browsers seamless, private, and 100% loss-free.

### 📦 1-Click Complete Backup & Cross-Device Transfer

To move all your solved questions, notes, solution code, and revision schedules to a friend's laptop or another browser:

1. In the Dashboard, open the **Import** tab.
2. Click **📦 Download Complete Backup (JSON)**.
   - RecallLC generates a timestamped `recalllc-backup-YYYY-MM-DD.json` file containing your complete A-to-Z data: every tracked problem, code solution, custom notes, historical submission attempts, and current spaced repetition intervals.
3. On the new laptop or browser:
   - Install RecallLC and navigate to the **Import** tab.
   - Drag and drop your downloaded `recalllc-backup-YYYY-MM-DD.json` file into the upload zone.
   - Click **🚀 Restore All Data & Schedules**.
   - 100% of your problems, solution code, and spaced repetition revision schedules are instantly restored!

---

### Importing your attempt history (JSON / CSV)

Open **Dashboard → Import**, drop in a `.json` or `.csv` file, review the
preview, and confirm. Nothing is written until you press _Import_.

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
   sets the next review date (or choose an exact manual schedule like 1, 3, 5, or 7 days).
   Upon clicking **Save rating & schedule** or any manual schedule option, RecallLC
   automatically navigates back to your **Revision Reminders** queue without requiring
   you to manually scroll back up or click the Back button.

RecallLC never injects a solution, a hint or anything else into LeetCode's
editor, and never modifies the page.

---

## Security & Anti-Hacking Architecture

RecalLC is built with a multi-layered defense-in-depth security model to ensure that the extension cannot be hacked, hijacked, or compromised:

### 1. Zero-Telemetry Local-First Isolation

- **100% Client-Side**: All problem attempt logs, spaced repetition intervals, study notes, and personal code snippets are stored exclusively inside your browser's private `IndexedDB` (`recallc_db`) and `chrome.storage.local`.
- **No Remote Attack Surface**: There are no remote user databases, tracking pixels, or third-party telemetry servers to breach.

### 2. Manifest V3 Sandbox & Strict Content Security Policy (CSP)

- **Strict CSP Enforced**: `script-src 'self'; object-src 'none'; frame-src 'self' https://*.razorpay.com https://api.razorpay.com;`
- **Zero Remote Code**: No `unsafe-eval`, no `unsafe-inline` scripts, and no execution of code strings or remote CDN scripts.
- **Isolated Extension Origin**: Content scripts execute in an isolated world and communicate strictly through typed message passing.

### 3. Principle of Least Privilege (Minimal Chrome Permissions)

- **Only `storage` requested**: RecalLC does **not** request invasive permissions like `tabs`, `cookies`, `webRequest`, `webRequestBlocking`, `debugger`, or `<all_urls>`.
- **Strictly Scoped Host Permissions**: Limited exclusively to `https://leetcode.com/*` and `https://*.geeksforgeeks.org/*` solely for detecting problem URLs and verdict submissions.

### 4. IPC Message Authentication & Privilege Escalation Defense

- **Sender Verification**: The background service worker strictly checks `sender.id === chrome.runtime.id`, rejecting any rogue third-party extensions immediately with 401 Unauthorized.
- **Context Privilege Separation**: Privileged methods (`export`, `restore`, `clear-all`, `delete-problem`, `update-settings`, `purge-sample-data`, `import-commit`) are quarantined in `PRIVILEGED_METHODS`. In-page content scripts running on web pages are blocked from ever invoking these methods.
- **Input Sanitization on Messages**: All IPC payloads enforce strict validation (whitelisted rating strings, bounded note byte limits, and sanitized timestamps) preventing memory exhaustion or buffer attacks.

### 5. Safe DOM Rendering & XSS Neutralization

- **React Virtual DOM**: All dynamic user data (problem titles, user notes, tag lists) is rendered as safe text nodes. No raw or unsanitized `innerHTML` is executed.
- **HTML Sanitization**: All user strings pass through `sanitizeInput()` converting `<`, `>`, `&`, `"`, `'` to safe HTML entities.
- **Safe URL Openers**: All outbound URLs are verified with `isSafeUrl()` and opened with `target="_blank" rel="noopener noreferrer"` to protect against tab-nabbing and `window.opener` attacks. Malicious schemes like `javascript:`, `data:`, `vbscript:`, and URLs with embedded credentials (`user:pass@`) are blocked.

### 6. CSV Formula Injection & Prototype Pollution Defense

- **CSV Injection (CWE-1236)**: Any cell beginning with `=`, `+`, `-`, `@`, or `\t` is automatically prefixed with an apostrophe during CSV export, preventing command execution in Microsoft Excel or Google Sheets.
- **Prototype Pollution Immunity**: JSON importers and server request parsers specifically filter out `__proto__`, `constructor`, and `prototype` keys.

### 7. Backend & Payment Gateway Security

- **HMAC-SHA256 Verification**: Server payment verification uses timing-safe comparisons (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
- **Payment Replay Defense**: Verified payments are stored in an expiring cache to reject duplicate/replay verification attempts.
- **Strict Format Regex**: Order IDs, payment IDs, and signatures must match strict regex patterns (`order_[a-zA-Z0-9_]{5,60}`, `pay_[a-zA-Z0-9_]{5,60}`, `^[a-f0-9]{64}$`).
- **IP Rate Limiting**: In-memory sliding window rate limiters protect API endpoints against brute-force and DoS attacks.

---

## Privacy & permissions

RecallLC is **local-first**. Your attempt history, notes and revision schedule
live in your browser profile and never leave your device.

### Permissions requested

| Permission                      | Type            | Why                                                                                                                                                        |
| :------------------------------ | :-------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                       | API Permission  | Persist your settings and revision schedule locally.                                                                                                       |
| `https://leetcode.com/*`        | Host Permission | Read the problem page you are already on, detect the current slug, detect the submit verdict, and (only if you opt in) fetch the public problem catalogue. |
| `https://*.geeksforgeeks.org/*` | Host Permission | Read GeeksforGeeks problem practice pages to detect problem titles and submit verdicts.                                                                    |

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

317 unit, integration, and penetration tests across 33 test suites plus full Chrome E2E automation suites, covering:

- **Packaging & Monitor Load Verification** — verifies strict creation of sole distributable `final.zip`, exclusion of duplicate archives, and presence of unpacked entry points for direct monitor loading.
- **Payment & Sponsorship Verification** — verifies Option 1 (Razorpay for India) and Option 2 (GitHub Sponsors for Outside India) external URL safety, protocol validation, and tab-nabbing defenses.

- **Ultra-Fast Request & Response Acceleration** — in-flight request coalescing/deduplication
  for both network and IPC messaging channels, sub-millisecond in-memory read micro-caching
  with instant mutation invalidation, IndexedDB batching (`bulkPut` and direct count queries),
  storage read caching, and fast network timeout protections (`AbortSignal.timeout`).

- **Security & Penetration Hardening** — timing-safe comparisons (`timingSafeEqual`),
  passcode cryptographic hashing (SHA-256 + salt + pepper) with pure TS FIPS fallback,
  anti-brute-force lockout and storage-backed rate limiting, safe URL validation
  against malicious schemes (`javascript:`, `data:`, `vbscript:`, userinfo credentials, protocol-relative `//`),
  and HTML sanitization.
- **IPC & Cross-Context Security** — internal extension origin validation for
  privileged service worker actions (`export`, `restore`, `clear-all`, `delete-problem`,
  `update-settings`) restricting execution strictly to `chrome.runtime.id`, preventing
  content scripts and third-party extensions from escalating privileges. All service worker
  message handlers enforce strict runtime bounds and input sanitization (reschedule timestamp checks,
  recall rating whitelisting, note byte-capping against storage exhaustion DoS).
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
  tests/                    setup.ts + spec files
public/                     icons, logo.png
scripts/                    generate-icons.mjs, verify-extension.mjs, create-final-zip.mjs
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
