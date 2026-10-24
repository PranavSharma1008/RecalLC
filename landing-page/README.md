# RecallLC — Official Landing Website

This directory (`landing-page/`) contains the static, production-ready landing website for the **RecallLC** Chrome extension.

It is completely decoupled from the Chrome extension source code and is independently deployable to any static host (Netlify, Vercel, Cloudflare Pages, GitHub Pages).

---

## Folder Structure

```
landing-page/
├── index.html            # Main homepage (Hero, Features, How It Works, Pricing, FAQ)
├── installation.html     # Comprehensive step-by-step installation guide
├── privacy.html          # Detailed, honest Privacy Policy (zero telemetry, local IndexedDB)
├── terms.html            # Terms of Service (acceptable use, local software disclaimer, IP)
├── refund.html           # Refund & Cancellation policy (transparent terms & merchant placeholders)
├── contact.html          # Contact page with developer email & safe email draft compose form
├── 404.html              # Custom 404 error page matching theme
├── styles.css            # Dark-first, responsive SaaS design system
├── script.js             # Interactions: mobile navigation, clipboard copy, mailto generator
├── config.js             # Central configuration (repo URL, developer contact, pricing)
├── favicon.svg           # Scalable SVG brand icon
├── robots.txt            # Search engine crawler instructions
├── sitemap.xml           # XML sitemap for SEO
├── netlify.toml          # Netlify security headers and 404 redirect rules
└── assets/               # Production assets (brand icon, real dashboard screenshots)
    ├── icon.png
    ├── icon32.png
    ├── dashboard-overview.png
    ├── dashboard-recall.png
    ├── dashboard-problems.png
    └── popup.png
```

---

## How to Preview Locally

No build tools or Node dependencies are required to run this website. Any local static server will work:

### Option 1: Python (Built into macOS / Linux)

```bash
cd landing-page
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

### Option 2: Node.js (npx serve)

```bash
cd landing-page
npx serve .
```

---

## How to Deploy on Netlify

### Method 1: Git Integration (Recommended for Continuous Deployment)

1. Log into your [Netlify Dashboard](https://app.netlify.com/).
2. Click **Add new site** → **Import an existing project**.
3. Select **GitHub** and authorize access to your repository: `PranavSharma1008/RecalLc`.
4. In the **Site configuration** screen:
   - **Base directory:** `landing-page` _(CRITICAL: ensure this is set to `landing-page`)_
   - **Build command:** _(Leave empty)_
   - **Publish directory:** `.` (or leave as `landing-page` / default)
5. Click **Deploy RecalLc**. Netlify will deploy your site in ~5 seconds.
6. (Optional) Set up your custom domain (e.g., `recalllc.com` or keep the free `your-site-name.netlify.app`).

### Method 2: Netlify CLI (Direct from Terminal)

```bash
cd landing-page
npx netlify deploy --prod
```

Follow the interactive prompts to link your Netlify account and deploy.

### Method 3: Netlify Drop (Drag & Drop)

1. Open [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the `landing-page` folder directly from Finder into the browser window.
3. Your site is deployed instantly.

---

## Configuration & Customization

All primary URLs and metadata are centralized in [`config.js`](config.js):

- **Repository URL:** `https://github.com/PranavSharma1008/RecalLc`
- **Developer Name:** `Pranav Sharma`
- **Developer Email:** `pranav2410991479@gmail.com`
- **LinkedIn:** `https://www.linkedin.com/in/pranavsharma1008/`
- **Pricing & Plan Roadmap:** Editable directly in the `pricing` block inside `config.js` and `index.html`.

---

## Razorpay Payment Gateway & UPI Setup Guide

RecallLC is fully pre-wired for **Razorpay** and direct **UPI QR payments** both on the landing website and inside the Chrome extension.

### How to Add Your Details:

1. **Option A: Hosted Razorpay Payment Link (Easiest — No Code)**
   - Go to [Razorpay Dashboard](https://dashboard.razorpay.com/) → **Payment Links** or **Payment Pages** → click **Create**.
   - Create a page titled _"Support RecallLC"_ (amount: ₹299 or customer decides).
   - Copy your link (e.g. `https://rzp.io/l/your-link`).
   - Paste it in [`landing-page/config.js`](config.js#L78):
     ```javascript
     paymentPageUrl: 'https://rzp.io/l/your-link',
     ```
   - And inside the extension in [`src/dashboard/screens/SupportScreen.tsx`](../src/dashboard/screens/SupportScreen.tsx#L14):
     ```typescript
     paymentLink: 'https://rzp.io/l/your-link',
     ```

2. **Option B: Embedded Razorpay Checkout JS**
   - Go to Razorpay Dashboard → **Settings** → **API Keys** → **Generate Key**.
   - Copy your **Key ID** (`rzp_live_...` or `rzp_test_...`).
   - Paste it in [`landing-page/config.js`](config.js#L74):
     ```javascript
     keyId: 'rzp_live_YOUR_KEY_HERE',
     ```
   - When visitors click _"Pay via Razorpay / UPI"_, Razorpay's native checkout popup will automatically open on the page!

3. **Option C: Direct UPI QR Scanner (GPay, PhonePe, Paytm, BHIM)**
   - Enter your personal or merchant UPI ID in [`landing-page/config.js`](config.js#L81):
     ```javascript
     upiId: 'yourname@okhdfcbank',
     ```
   - And in the extension [`SupportScreen.tsx`](../src/dashboard/screens/SupportScreen.tsx#L16):
     ```typescript
     upiId: 'yourname@okhdfcbank',
     ```
   - A scannable QR code is generated instantly.

---

## Razorpay Merchant Approval Checklist

This website satisfies all standard Razorpay website verification criteria:

1. **Product Details:** Clear explanation of RecallLC's features and utility.
2. **Contact Us:** Dedicated [Contact Page](contact.html) with active support email and LinkedIn.
3. **Terms of Service:** [Terms of Service](terms.html) detailing software usage and intellectual property.
4. **Privacy Policy:** [Privacy Policy](privacy.html) detailing zero telemetry and local IndexedDB data storage.
5. **Refund & Cancellation Policy:** [Refund Policy](refund.html) specifying a clear 14-day refund window and cancellation workflow.
6. **Transparent Pricing:** Stated in Indian Rupees (₹) on the homepage.
