# Privacy Policy for RecalLC

**Effective Date:** October 25, 2026  
**Last Updated:** October 25, 2026  
**Developer:** Pranav Sharma ([pranav2410991479@gmail.com](mailto:pranav2410991479@gmail.com))  
**Repository:** [https://github.com/PranavSharma1008/RecalLC](https://github.com/PranavSharma1008/RecalLC)

---

## 1. Single Purpose & Overview

**RecalLC** is a free, open-source, local-first Chrome Extension and Dashboard designed to help software engineers retain and master LeetCode problem patterns using spaced repetition (SM-2 algorithm).

RecalLC is built with a strict **privacy-first and zero-telemetry** architecture. We believe your study habits, problem-solving history, and code notes belong exclusively to you. **We do not collect, track, store, transmit, or sell any personal data.**

---

## 2. Core Privacy Guarantees

* **Zero Remote Servers:** RecalLC does not transmit your problem attempts, revision queues, notes, or schedules to any external server.
* **Zero Telemetry or Analytics:** No Google Analytics, tracking pixels, cookies, or user telemetry scripts are included or loaded.
* **Zero Account or Credentials Required:** RecalLC never asks for, reads, accesses, or stores your LeetCode password or session cookies.
* **100% Local Storage:** All problem metadata, flashcard intervals, and personal notes remain entirely on your local machine inside browser-isolated storage (`IndexedDB` and `chrome.storage.local`).

---

## 3. Chrome Permissions Requested & Justifications

RecalLC adheres to the principle of least privilege. The extension manifest requests only two permissions:

| Permission | Type | Exact Justification |
| :--- | :--- | :--- |
| `storage` | API Permission | Used strictly to store user preferences (theme, passcode settings) and spaced repetition schedules locally on the user's browser via `chrome.storage.local`. |
| `https://leetcode.com/*` | Host Permission | Enables the content script on `leetcode.com/problems/*` to detect problem submissions in real-time and display in-page revision reminders when the user is actively practicing problems. |

RecalLC explicitly does **not** request permissions such as `tabs`, `cookies`, `webRequest`, `history`, `notifications`, or `<all_urls>`.

---

## 4. No Remote Code Execution

RecalLC complies fully with **Manifest V3** security standards:
* **No Remote Code:** All scripts, stylesheets, and assets are packaged directly within the extension package.
* RecalLC does not execute `eval()`, inject external scripts, or load code dynamically from remote servers.

---

## 5. What Data is Handled Locally

When you use RecalLC, the following data is generated and stored exclusively within your local browser:
1. **Problem Data:** LeetCode problem slugs (e.g. `two-sum`), titles, difficulty ratings, and topic tags.
2. **Revision Records:** Dates of attempts, user recall ratings (*Forgot*, *Hard*, *Good*, *Easy*), and SM-2 interval calculations.
3. **Local Notes:** Any notes or complexity reminders you write for a problem.
4. **Local Passcode:** If you enable the optional dashboard passcode, it is hashed locally using Web Crypto SHA-256 with a unique salt. Plain-text passcodes are never stored.

---

## 6. Third-Party Disclosures & Certifications

In accordance with Google Chrome Web Store Developer Program Policies:
* **No Sale of Data:** We do not sell or transfer user data to third parties under any circumstances.
* **Single Purpose Only:** We do not use or transfer user data for purposes unrelated to the extension's single purpose.
* **No Credit/Lending Use:** We do not use or transfer user data to determine creditworthiness or for lending purposes.
* **No Ads:** RecalLC is completely ad-free.

---

## 7. Data Portability & Deletion

Because all your data is stored on your local computer, you have total control over it at all times:
* **Export Anytime:** You can export your entire problem history and revision logs to standard JSON or CSV files at any time via **Dashboard > Settings > Export**.
* **One-Click Deletion:** You can erase all stored data instantly via **Dashboard > Settings > Clear All Data**.
* **Extension Removal:** Uninstalling the extension from `chrome://extensions` immediately removes all extension-origin local storage and IndexedDB databases.

---

## 8. Contact & Support

If you have any questions or inquiries regarding this Privacy Policy, please contact:

* **Developer:** Pranav Sharma
* **Email:** [pranav2410991479@gmail.com](mailto:pranav2410991479@gmail.com)
* **GitHub Repository:** [https://github.com/PranavSharma1008/RecalLC](https://github.com/PranavSharma1008/RecalLC)
* **Issues & Feedback:** [https://github.com/PranavSharma1008/RecalLC/issues](https://github.com/PranavSharma1008/RecalLC/issues)
