export interface ReminderRootProps {
  /** Slug of the problem currently open, or `null` off a problem page. */
  currentSlug: string | null;
}

/**
 * The React island for in-page reminders.
 *
 * In-page revision reminder popups on problem platforms have been permanently removed.
 * Reminders are handled exclusively via the RecallLC popup and dashboard.
 */
export function ReminderRoot(_props: ReminderRootProps) {
  return null;
}
