/**
 * RecallLC Landing Page Configuration
 *
 * Central source of truth for repository URLs, contact information,
 * and future payment gateway / plan settings.
 */

const RECALLC_CONFIG = {
  // Brand & Metadata
  appName: 'RecallLC',
  tagline: 'Solve it. Remember it. Master it.',
  subtitle: 'The private, local-first spaced repetition revision assistant for LeetCode.',

  // Official Links
  repoUrl: 'https://github.com/PranavSharma1008/RecalLc',
  downloadZipUrl: 'https://github.com/PranavSharma1008/RecalLc/archive/refs/heads/main.zip',
  issuesUrl: 'https://github.com/PranavSharma1008/RecalLc/issues',
  releasesUrl: 'https://github.com/PranavSharma1008/RecalLc/releases',

  // Developer & Support Contact
  developerName: 'Pranav Sharma',
  supportEmail: 'pranav2410991479@gmail.com',
  linkedInUrl: 'https://www.linkedin.com/in/pranavsharma1008/',
  githubSponsorsUrl: 'https://github.com/sponsors/PranavSharma1008',

  // Version
  currentVersion: 'v1.0.0',
  manifestVersion: 'MV3',
  minChromeVersion: '116+',

  // Pricing & Payment Gateway Readiness (PhonePe Integration Preparation)
  pricing: {
    freeTier: {
      name: 'Core Extension',
      price: 'Free',
      period: 'Forever',
      description: '100% of local-first revision features are free and open-source.',
      features: [
        'Automatic LeetCode submission & verdict tracking',
        'Deterministic spaced-repetition revision algorithm',
        'Floating in-page reminder on leetcode.com',
        'Inline Rocket Push Button for 1-click scheduling',
        'Recall-first 3-step flashcard workflow',
        'Full IndexedDB dashboard with inline notes editor',
        'Master passcode security lock screen',
        'CSV/JSON RFC-4180 bulk import & export',
        '100% offline, zero cloud tracking, zero ads',
      ],
      ctaText: 'Download on GitHub',
      ctaUrl: '#install',
    },
    proTier: {
      name: 'Pro / Supporter Cloud',
      price: '₹299',
      period: 'One-Time / Supporter',
      description: 'Optional cloud sync across devices and automated cloud backups.',
      status: 'Active via Razorpay',
      badge: 'Supporter Tier',
      features: [
        'Everything in Core Extension',
        'End-to-end encrypted multi-device sync',
        'Automated cloud revision backups',
        'Cross-browser sync support',
        'Priority feature requests & developer support',
      ],
      ctaText: 'Pay via Razorpay / UPI',
      ctaUrl: '#pay-razorpay',
    },
  },

  // Razorpay Gateway Configuration
  // Loaded dynamically from /api/config or environment variables
  razorpay: {
    keyId: '',
    merchantName: 'RecalLC',
    merchantDescription: 'Support RecalLC Development',
    currency: 'INR',
    themeColor: '#7c5cff',
  },
};

// Export for module environments if needed, while remaining available in globalThis for static scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RECALLC_CONFIG;
}
