/**
 * RecallLC domain types.
 *
 * The **problem slug** (e.g. "two-sum") is the stable identifier everywhere:
 * in URLs, in the database, and in messages between the extension contexts.
 */

/* ------------------------------------------------------------------ domain */

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Unknown';

export const DIFFICULTIES: readonly Difficulty[] = ['Easy', 'Medium', 'Hard', 'Unknown'];

/** How well the user recalled a problem during a revision. */
export type RecallRating = 'forgot' | 'hard' | 'good' | 'easy';

export const RECALL_RATINGS: readonly RecallRating[] = ['forgot', 'hard', 'good', 'easy'];

export const RATING_LABELS: Record<RecallRating, string> = {
  forgot: 'Forgot',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

export const RATING_HINTS: Record<RecallRating, string> = {
  forgot: 'Blanked out — show it again soon.',
  hard: 'Roughly remembered, but shaky.',
  good: 'Recalled it with a little effort.',
  easy: 'Instant recall — push it further out.',
};

export type ThemePreference = 'dark' | 'light' | 'system';

export type AttemptSource = 'import' | 'manual' | 'auto';

export type ReviewEventSource = 'review' | 'snooze' | 'dismiss' | 'manual' | 'import';

/* ----------------------------------------------------------------- records */

/**
 * A tracked problem. Aggregated from one or more {@link SubmissionAttempt}s.
 * `firstAttemptAt`/`lastAttemptAt` preserve the *real* historical timestamps —
 * they are never replaced with "now" or the extension install date.
 */
export interface Problem {
  slug: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  topics: string[];
  /** Personal notes — never shown until the user explicitly reveals them. */
  notes: string;
  firstAttemptAt: number | null;
  lastAttemptAt: number | null;
  /** Last time the user merely *opened* the problem. Not an attempt. */
  lastViewedAt: number | null;
  attemptCount: number;
  /** `null` when no attempt carried an accepted/verdict signal. */
  accepted: boolean | null;
  lastLanguage: string | null;
  /**
   * 0..1 — how much the user seems to have struggled with this problem.
   * Derived from failed attempts, repeat attempts and low recall ratings.
   */
  struggleScore: number;
  createdAt: number;
  updatedAt: number;
}

/** A single submission / attempt. Many attempts may belong to one problem. */
export interface SubmissionAttempt {
  id: string;
  slug: string;
  title: string | null;
  attemptedAt: number;
  accepted: boolean | null;
  language: string | null;
  /** LeetCode submission id when known — used for cross-import de-duplication. */
  submissionId: string | null;
  source: AttemptSource;
  createdAt: number;
}

/**
 * The single active revision schedule for a problem.
 * Kept separate from attempts: a problem can have many attempts but exactly
 * one revision record.
 */
export interface RevisionRecord {
  slug: string;
  /** Number of completed reviews. Reset to 0 after a "forgot" rating. */
  stage: number;
  lastRating: RecallRating | null;
  lastReviewedAt: number | null;
  /** Epoch ms, snapped to the start of a local calendar day. */
  dueAt: number;
  /** "Remind tomorrow" — set to the next local midnight. Never changes `dueAt`. */
  snoozedUntil: number | null;
  /** "Dismiss" — hidden for the rest of today. Never changes `dueAt`. */
  dismissedAt: number | null;
  /** Paused problems never trigger a reminder. */
  paused: boolean;
  /** True when the problem was manually rescheduled by the user (takes priority over global defaults). */
  manualSchedule?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** Immutable audit trail of every scheduling decision. */
export interface ReviewEvent {
  id: string;
  slug: string;
  rating: RecallRating | null;
  reviewedAt: number;
  previousDueAt: number;
  nextDueAt: number;
  elapsedDays: number;
  source: ReviewEventSource;
}

/** Public problem metadata, cached so the UI can render titles/difficulty offline. */
export interface CatalogEntry {
  slug: string;
  title: string;
  difficulty: Difficulty;
  topics: string[];
  paidOnly: boolean;
  updatedAt: number;
}

/* ---------------------------------------------------------------- settings */

export interface UserSettings {
  schemaVersion: number;
  theme: ThemePreference;
  /** Days until the next review, keyed by recall rating. */
  intervals: Record<RecallRating, number>;
  /**
   * Schedule mode for newly solved problems:
   * - 'weekly_sunday': Solve Mon-Sat, Sunday is the revision day (default).
   * - 'fixed_days': Review becomes due `initialIntervalDays` after the attempt.
   */
  initialScheduleMode: 'weekly_sunday' | 'fixed_days';
  /** Days after a first attempt before a never-reviewed problem becomes due (when mode is fixed_days). */
  initialIntervalDays: number;
  remindersEnabled: boolean;
  /** Delay between page load and the reminder appearing. */
  reminderDelayMs: number;
  /** Maximum number of reminders shown per browser session. */
  maxRemindersPerSession: number;
  autoTrackSubmissions: boolean;
  /** Opt-in: pull the user's own submission history from LeetCode. */
  accountSyncEnabled: boolean;
  accountSyncLimit: number;
  showTopicInReminder: boolean;
  onboardingCompleted: boolean;
  /** Security & Master Passcode Lock */
  securityAuthEnabled?: boolean;
  securityPasscodeHash?: string | null;
  securityPasscodeSalt?: string | null;
  securityAutoLockMinutes?: number;
  securityLastUnlockedAt?: number | null;
}

/* ------------------------------------------------------------------ enquiry */

export type EnquiryCategory = 'bug' | 'feature' | 'collab' | 'security' | 'general';
export type EnquiryPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface EnquiryRecord {
  id: string;
  createdAt: number;
  category: EnquiryCategory;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  priority: EnquiryPriority;
  status: 'sent_mailto' | 'sent_gmail' | 'copied' | 'draft';
}

/* ------------------------------------------------------------------ import */

export interface ImportErrorEntry {
  /** 1-based row number for CSV, array index for JSON, `null` for file-level errors. */
  row: number | null;
  message: string;
}

export interface ImportResult {
  /** Attempt records written to the store. */
  imported: number;
  /** Records skipped because they carried no usable attempt. */
  skipped: number;
  /** Records skipped because an identical attempt already exists. */
  duplicated: number;
  /** Records rejected by validation. */
  invalid: number;
  /** Records folded into an existing problem rather than creating a new one. */
  merged: number;
  problemsCreated: number;
  problemsUpdated: number;
  errors: ImportErrorEntry[];
  warnings: string[];
}

export interface ImportPreview {
  fileName: string;
  format: 'json' | 'csv' | 'unknown';
  totalRows: number;
  valid: NormalizedAttempt[];
  invalid: ImportErrorEntry[];
  duplicates: number;
  warnings: string[];
  problems: Array<{ slug: string; title: string; attempts: number; firstAttemptAt: number; lastAttemptAt: number }>;
}

/** A single attempt after validation & normalisation. */
export interface NormalizedAttempt {
  slug: string;
  title: string | null;
  url: string | null;
  attemptedAt: number;
  accepted: boolean | null;
  language: string | null;
  difficulty?: Difficulty | null;
  topics?: string[];
  submissionId: string | null;
  source: AttemptSource;
  warnings: string[];
}

/* ----------------------------------------------------------------- derived */

export interface ReminderCandidate {
  slug: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  topics: string[];
  attemptCount: number;
  lastAttemptAt: number | null;
  dueAt: number;
  overdue: boolean;
  overdueDays: number;
  accepted: boolean | null;
  language: string | null;
  manualSchedule?: boolean;
  updatedAt?: number;
}

export interface ReminderPayload {
  candidate: ReminderCandidate | null;
  remainingDue: number;
  overdueCount: number;
  dueTodayCount: number;
  theme: ThemePreference;
  enabled: boolean;
  streak: number;
}

export interface TopicStat {
  topic: string;
  count: number;
  due: number;
}

export interface DashboardStats {
  dueToday: number;
  overdue: number;
  totalProblems: number;
  totalAttempts: number;
  revisedThisWeek: number;
  streak: number;
  byTopic: TopicStat[];
  totalReviews: number;
}

export interface ProblemWithSchedule {
  problem: Problem;
  revision: RevisionRecord | null;
  dueAt: number | null;
  overdue: boolean;
  daysUntilDue: number | null;
}

export interface BackupFile {
  format: 'recalllc-backup';
  version: 1;
  exportedAt: number;
  settings: UserSettings;
  problems: Problem[];
  attempts: SubmissionAttempt[];
  revisions: RevisionRecord[];
  events: ReviewEvent[];
}

/* ---------------------------------------------------------------- protocol */

export interface ServiceError {
  ok: false;
  error: string;
}

export interface ServiceOk<T> {
  ok: true;
  data: T;
}

export type ServiceResult<T> = ServiceOk<T> | ServiceError;

export type ProblemSortKey = 'due' | 'lastAttempt' | 'topic' | 'difficulty' | 'title';

export interface ProblemQuery {
  search?: string;
  topic?: string | null;
  difficulty?: Difficulty | null;
  due?: 'all' | 'due' | 'overdue' | 'upcoming';
  sort?: ProblemSortKey;
  direction?: 'asc' | 'desc';
}
