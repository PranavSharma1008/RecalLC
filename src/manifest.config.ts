import { defineManifest } from '@crxjs/vite-plugin';

/**
 * RecallLC — Manifest V3.
 *
 * Permission rationale (see README.md § Privacy & Permissions):
 *  - "storage"                 -> persist user settings + revision schedule locally.
 *  - host_permissions leetcode -> read the problem page the user is already on, and
 *                                 (opt-in) fetch the public problem catalogue.
 * No "tabs", "scripting", "cookies" or "notifications" permission is requested:
 * the extension never reads tab URLs, never injects code into other origins,
 * never touches cookies, and never sends OS notifications.
 */
export default defineManifest({
  manifest_version: 3,
  name: 'RecalLC — Smart LeetCode Revision',
  short_name: 'RecalLC',
  version: '1.0.2',
  description:
    'Revise the LeetCode problems you already solved — RecalLC nudges you to review an older problem, at the moment you open a new one.',
  minimum_chrome_version: '116',

  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'RecalLC — Smart LeetCode Revision',
    default_icon: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
  },

  icons: {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  },

  background: {
    service_worker: 'src/background/serviceWorker.ts',
    type: 'module',
  },

  content_scripts: [
    {
      matches: [
        'https://leetcode.com/problems/*',
        'https://*.geeksforgeeks.org/problems/*',
        'https://geeksforgeeks.org/problems/*',
      ],
      js: ['src/content/content.tsx'],
      run_at: 'document_idle',
      all_frames: false,
    },
  ],

  options_ui: {
    page: 'src/dashboard/index.html',
    open_in_tab: true,
  },

  permissions: ['storage'],
  host_permissions: ['https://leetcode.com/*', 'https://*.geeksforgeeks.org/*', 'https://geeksforgeeks.org/*'],
  content_security_policy: {
    extension_pages:
      "script-src 'self'; object-src 'none'; frame-src 'self' https://*.razorpay.com https://api.razorpay.com;",
  },
});
