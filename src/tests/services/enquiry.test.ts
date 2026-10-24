import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildGmailWebUrl,
  buildMailtoUrl,
  clearEnquiries,
  deleteEnquiry,
  ENQUIRY_TARGET_EMAIL,
  formatEnquiryBody,
  listEnquiries,
  saveEnquiry,
} from '../../services/enquiry';

describe('enquiry service', () => {
  beforeEach(async () => {
    await clearEnquiries();
  });

  it('targets pranav2410991479@gmail.com', () => {
    expect(ENQUIRY_TARGET_EMAIL).toBe('pranav2410991479@gmail.com');
  });

  it('generates valid mailto: link directed to pranav2410991479@gmail.com', () => {
    const url = buildMailtoUrl({
      category: 'feature',
      senderName: 'Test User',
      senderEmail: 'test@example.com',
      subject: 'Add dark mode to graphs',
      message: 'Please add dark mode.',
      priority: 'normal',
    });

    expect(url.startsWith(`mailto:${ENQUIRY_TARGET_EMAIL}?`)).toBe(true);
    expect(url).toContain(encodeURIComponent('Add dark mode to graphs'));
  });

  it('generates valid Gmail Web compose link directed to pranav2410991479@gmail.com', () => {
    const url = buildGmailWebUrl({
      category: 'bug',
      senderName: 'Test User',
      senderEmail: 'test@example.com',
      subject: 'Extension crash on empty notes',
      message: 'Found an error when saving empty notes.',
      priority: 'high',
    });

    expect(url.startsWith(`https://mail.google.com/mail/?view=cm&fs=1&to=${ENQUIRY_TARGET_EMAIL}`)).toBe(true);
    expect(url).toContain(encodeURIComponent('Extension crash on empty notes'));
  });

  it('formats enquiry body with sender details and category', () => {
    const formatted = formatEnquiryBody({
      category: 'security',
      senderName: 'Security Researcher',
      senderEmail: 'researcher@sec.org',
      subject: 'CSP Report',
      message: 'Here is a vulnerability report.',
      priority: 'urgent',
    });

    expect(formatted).toContain('Hi Pranav,');
    expect(formatted).toContain('Security Researcher');
    expect(formatted).toContain('researcher@sec.org');
    expect(formatted).toContain('Security Vulnerability');
    expect(formatted).toContain('URGENT');
  });

  it('saves, lists, and deletes enquiries in outbox', async () => {
    const saved = await saveEnquiry({
      category: 'general',
      senderName: 'Alice',
      senderEmail: 'alice@example.com',
      subject: 'Hello',
      message: 'Nice extension!',
      priority: 'normal',
      status: 'sent_mailto',
    });

    expect(saved.id).toBeTruthy();
    expect(saved.createdAt).toBeGreaterThan(0);

    const list = await listEnquiries();
    expect(list.length).toBe(1);
    expect(list[0]?.subject).toBe('Hello');

    await deleteEnquiry(saved.id);
    const afterDelete = await listEnquiries();
    expect(afterDelete.length).toBe(0);
  });
});
