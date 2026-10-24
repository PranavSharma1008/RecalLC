/**
 * RecallLC Enquiry & Mailbox Service.
 *
 * Direct communication channel to developer Pranav Sharma (pranav2410991479@gmail.com).
 * Supports direct 1-click Gmail composition.
 */

import type { EnquiryCategory, EnquiryPriority, EnquiryRecord } from '../types';
import { createId } from '../utils/id';

export const ENQUIRY_TARGET_EMAIL = 'pranav2410991479@gmail.com';
export const DIRECT_GMAIL_URL = `https://mail.google.com/mail/?view=cm&fs=1&to=${ENQUIRY_TARGET_EMAIL}&su=RecallLC%20Enquiry`;
export const ENQUIRIES_STORAGE_KEY = 'recalllc:enquiries';

export interface ComposeEnquiryInput {
  category: EnquiryCategory;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  priority: EnquiryPriority;
  includeDiagnostics?: boolean;
}

export const CATEGORY_LABELS: Record<EnquiryCategory, { label: string; icon: string; prefix: string }> = {
  feature: { label: 'Feature Request', icon: '💡', prefix: '[RecallLC Feature Request]' },
  bug: { label: 'Bug Report', icon: '🐛', prefix: '[RecallLC Bug Report]' },
  collab: { label: 'Collaboration / Hire', icon: '🤝', prefix: '[RecallLC Collaboration]' },
  security: { label: 'Security Vulnerability', icon: '🔒', prefix: '[RecallLC Security]' },
  general: { label: 'General Enquiry', icon: '💬', prefix: '[RecallLC Enquiry]' },
};

export const PRIORITY_LABELS: Record<EnquiryPriority, { label: string; badgeClass: string }> = {
  low: { label: 'Low', badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
  normal: { label: 'Normal', badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  high: { label: 'High', badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  urgent: { label: 'Urgent', badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-400 font-semibold' },
};

function getDiagnostics(): string {
  try {
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
    const platform = typeof navigator !== 'undefined' ? navigator.platform : 'Unknown';
    const localTime = new Date().toISOString();
    return `\n\n--- System Diagnostics (RecallLC v1.0.0) ---\nPlatform: ${platform}\nBrowser: ${userAgent}\nTimestamp: ${localTime}\n------------------------------------------`;
  } catch {
    return '';
  }
}

/** Build formatted plain text of the enquiry. */
export function formatEnquiryBody(input: ComposeEnquiryInput): string {
  const parts: string[] = [];
  parts.push(`Hi Pranav,`);
  parts.push(``);
  parts.push(input.message.trim());
  parts.push(``);
  parts.push(`--- Sender Details ---`);
  parts.push(`Name: ${input.senderName.trim() || 'Anonymous User'}`);
  parts.push(`Email: ${input.senderEmail.trim() || 'Not provided'}`);
  parts.push(`Category: ${CATEGORY_LABELS[input.category]?.label || input.category}`);
  parts.push(`Priority: ${input.priority.toUpperCase()}`);

  if (input.includeDiagnostics) {
    parts.push(getDiagnostics());
  }

  return parts.join('\n');
}

/** Build mailto: URL directed to pranav2410991479@gmail.com */
export function buildMailtoUrl(input: ComposeEnquiryInput): string {
  const subject = encodeURIComponent(input.subject.trim());
  const body = encodeURIComponent(formatEnquiryBody(input));
  return `mailto:${ENQUIRY_TARGET_EMAIL}?subject=${subject}&body=${body}`;
}

/** Build Google Web Gmail compose URL directed to pranav2410991479@gmail.com */
export function buildGmailWebUrl(input: ComposeEnquiryInput): string {
  const subject = encodeURIComponent(input.subject.trim());
  const body = encodeURIComponent(formatEnquiryBody(input));
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${ENQUIRY_TARGET_EMAIL}&su=${subject}&body=${body}`;
}

function getStorageArea(): chrome.storage.StorageArea | null {
  if (globalThis.chrome?.storage?.local) {
    return globalThis.chrome.storage.local;
  }
  return null;
}

/** List all previously sent or saved enquiries from local storage. */
export async function listEnquiries(): Promise<EnquiryRecord[]> {
  const area = getStorageArea();
  if (area) {
    try {
      const res = await area.get(ENQUIRIES_STORAGE_KEY);
      const list = res?.[ENQUIRIES_STORAGE_KEY];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  // Fallback to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(ENQUIRIES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Save an enquiry to local outbox. */
export async function saveEnquiry(entry: Omit<EnquiryRecord, 'id' | 'createdAt'>): Promise<EnquiryRecord> {
  const record: EnquiryRecord = {
    ...entry,
    id: createId('enq'),
    createdAt: Date.now(),
  };

  const existing = await listEnquiries();
  const next = [record, ...existing].slice(0, 50); // Keep last 50

  const area = getStorageArea();
  if (area) {
    await area.set({ [ENQUIRIES_STORAGE_KEY]: next });
  } else if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(ENQUIRIES_STORAGE_KEY, JSON.stringify(next));
  }

  return record;
}

/** Delete a specific enquiry from outbox. */
export async function deleteEnquiry(id: string): Promise<void> {
  const existing = await listEnquiries();
  const filtered = existing.filter((item) => item.id !== id);

  const area = getStorageArea();
  if (area) {
    await area.set({ [ENQUIRIES_STORAGE_KEY]: filtered });
  } else if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(ENQUIRIES_STORAGE_KEY, JSON.stringify(filtered));
  }
}

/** Clear all enquiries from outbox. */
export async function clearEnquiries(): Promise<void> {
  const area = getStorageArea();
  if (area) {
    await area.remove(ENQUIRIES_STORAGE_KEY);
  } else if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(ENQUIRIES_STORAGE_KEY);
  }
}
