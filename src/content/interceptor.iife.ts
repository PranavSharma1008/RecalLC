/**
 * RecallLC — MAIN world network interceptor.
 *
 * Runs directly in the webpage's JavaScript execution context (world: "MAIN").
 * Intercepts LeetCode & GeeksforGeeks network requests to detect 100% genuine
 * submissions with absolute certainty.
 *
 * Why this is crucial:
 *   - "Run Code" (sample testcases) calls /interpret/ -> NEVER triggers an accepted submission!
 *   - "Submit" calls /submit/ and polls /check/ -> When status_msg is "Accepted", ALL testcases passed!
 *   - Completely eliminates DOM scraping timing issues, Next.js hydration issues, and sample run confusion.
 */

(function initRecallLCInterceptor() {
  if (typeof window === 'undefined') return;
  // Prevent duplicate initialization
  if ((window as unknown as Record<string, unknown>).__RECALLC_INTERCEPTOR_ACTIVE__) return;
  (window as unknown as Record<string, unknown>).__RECALLC_INTERCEPTOR_ACTIVE__ = true;

  interface SubmissionInfo {
    slug: string;
    code?: string;
    lang?: string;
    timestamp: number;
  }

  const pendingSubmissions = new Map<string, SubmissionInfo>();
  let latestSubmitPayload: { slug: string; code: string; lang: string; timestamp: number } | null = null;

  function getSlugFromUrl(): string | null {
    try {
      const match = window.location.pathname.match(/\/problems\/([^/]+)/);
      return match && match[1] ? match[1] : null;
    } catch {
      return null;
    }
  }

  function notifySubmissionStarted(slug: string, code?: string, lang?: string, submissionId?: string): void {
    try {
      window.dispatchEvent(
        new CustomEvent('recalllc:submit-started', {
          detail: { slug, code, lang, submissionId },
        }),
      );
    } catch {
      // ignore
    }
  }

  function notifySubmissionAccepted(data: {
    slug: string;
    code?: string;
    lang?: string;
    submissionId?: string;
    totalCorrect?: number;
    totalTestcases?: number;
    runtime?: string;
    memory?: string;
    runtimePercentile?: number;
    memoryPercentile?: number;
  }): void {
    try {
      window.dispatchEvent(
        new CustomEvent('recalllc:submission-accepted', {
          detail: data,
        }),
      );
    } catch {
      // ignore
    }
  }

  function notifySubmissionRejected(slug: string, verdict: string, submissionId?: string): void {
    try {
      window.dispatchEvent(
        new CustomEvent('recalllc:submission-rejected', {
          detail: { slug, verdict, submissionId },
        }),
      );
    } catch {
      // ignore
    }
  }

  /* ------------------------------------------------------------- Fetch Hook */

  const originalFetch = window.fetch;

  window.fetch = async function (...args: Parameters<typeof fetch>): Promise<Response> {
    const input = args[0];
    const init = args[1];
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // 1. Intercept LeetCode Submission POST: /problems/{slug}/submit/
    if (url.includes('/submit') && method === 'POST') {
      try {
        let bodyText = '';
        if (typeof init?.body === 'string') {
          bodyText = init.body;
        } else if (input instanceof Request) {
          try {
            bodyText = await input.clone().text();
          } catch {
            // ignore
          }
        }

        if (bodyText) {
          const parsed = JSON.parse(bodyText);
          const slugMatch = url.match(/\/problems\/([^/]+)\/submit/);
          const slug = slugMatch ? slugMatch[1] : getSlugFromUrl() || '';
          const code = parsed.typed_code || '';
          const lang = parsed.lang || '';

          if (slug) {
            latestSubmitPayload = { slug, code, lang, timestamp: Date.now() };
            notifySubmissionStarted(slug, code, lang);
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    // Call native fetch
    const response = await originalFetch.apply(this, args);

    // 2. Read submission_id from submit response
    if (url.includes('/submit') && method === 'POST' && response.ok) {
      try {
        const clone = response.clone();
        clone.json().then((data) => {
          if (data && data.submission_id && latestSubmitPayload) {
            const subId = String(data.submission_id);
            pendingSubmissions.set(subId, {
              slug: latestSubmitPayload.slug,
              code: latestSubmitPayload.code,
              lang: latestSubmitPayload.lang,
              timestamp: Date.now(),
            });
            notifySubmissionStarted(latestSubmitPayload.slug, latestSubmitPayload.code, latestSubmitPayload.lang, subId);
          }
        }).catch(() => undefined);
      } catch {
        // ignore
      }
    }

    // 3. Intercept LeetCode Submit Check GET: /submissions/detail/{id}/check/
    if (url.includes('/submissions/detail/') && url.includes('/check')) {
      try {
        const idMatch = url.match(/\/submissions\/detail\/([^/]+)\/check/);
        const subId = idMatch ? idMatch[1] : '';

        const clone = response.clone();
        clone.json().then((data) => {
          if (!data || data.state !== 'SUCCESS') return;

          const isAccepted =
            data.status_msg === 'Accepted' ||
            data.status_code === 10 ||
            (typeof data.total_correct === 'number' &&
              typeof data.total_testcases === 'number' &&
              data.total_correct > 0 &&
              data.total_correct === data.total_testcases);

          const pending = subId ? pendingSubmissions.get(subId) : null;
          const fallback = latestSubmitPayload && Date.now() - latestSubmitPayload.timestamp < 120_000
            ? latestSubmitPayload
            : null;
          const slug = pending?.slug || fallback?.slug || getSlugFromUrl();

          if (!slug) return;

          if (isAccepted) {
            notifySubmissionAccepted({
              slug,
              code: pending?.code || fallback?.code,
              lang: pending?.lang || fallback?.lang || data.lang,
              submissionId: subId || undefined,
              totalCorrect: data.total_correct,
              totalTestcases: data.total_testcases,
              runtime: data.status_runtime,
              memory: data.status_memory,
              runtimePercentile: data.runtime_percentile,
              memoryPercentile: data.memory_percentile,
            });
            if (subId) pendingSubmissions.delete(subId);
          } else if (data.status_msg) {
            notifySubmissionRejected(slug, data.status_msg, subId || undefined);
            if (subId) pendingSubmissions.delete(subId);
          }
        }).catch(() => undefined);
      } catch {
        // ignore
      }
    }

    // 4. Intercept GeeksforGeeks submission response
    if (
      url.includes('geeksforgeeks.org') &&
      (url.includes('/submit') || url.includes('/solution/compile') || url.includes('/user-solution')) &&
      method === 'POST'
    ) {
      try {
        const clone = response.clone();
        clone.json().then((data) => {
          if (!data) return;
          const isGfgSuccess =
            data.is_correct === 1 ||
            data.result === 'Correct Answer' ||
            data.message === 'Problem Solved Successfully' ||
            data.status === 'SUCCESS';

          const slug = getSlugFromUrl();
          if (slug && isGfgSuccess) {
            notifySubmissionAccepted({
              slug,
              submissionId: data.submission_id ? String(data.submission_id) : undefined,
            });
          }
        }).catch(() => undefined);
      } catch {
        // ignore
      }
    }

    return response;
  };

  /* -------------------------------------------------------- XMLHttpRequest Hook */

  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (
    method: string,
    url: string | URL,
    ...rest: [boolean?, string?, string?]
  ): void {
    (this as unknown as Record<string, unknown>).__recallc_url__ = String(url);
    (this as unknown as Record<string, unknown>).__recallc_method__ = method.toUpperCase();
    return originalXHROpen.apply(this, [method, url, ...(rest as [boolean, string, string])]);
  };

  XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null): void {
    const xhr = this;
    const url = ((xhr as unknown as Record<string, unknown>).__recallc_url__ as string) || '';
    const method = ((xhr as unknown as Record<string, unknown>).__recallc_method__ as string) || '';

    // If submit POST
    if (url.includes('/submit') && method === 'POST' && typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        const slugMatch = url.match(/\/problems\/([^/]+)\/submit/);
        const slug = slugMatch ? slugMatch[1] : getSlugFromUrl() || '';
        if (slug) {
          latestSubmitPayload = {
            slug,
            code: parsed.typed_code || '',
            lang: parsed.lang || '',
            timestamp: Date.now(),
          };
          notifySubmissionStarted(slug, parsed.typed_code, parsed.lang);
        }
      } catch {
        // ignore
      }
    }

    xhr.addEventListener('load', () => {
      try {
        // Submit response with submission_id
        if (url.includes('/submit') && method === 'POST' && xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText || '{}');
          if (data?.submission_id && latestSubmitPayload) {
            const subId = String(data.submission_id);
            pendingSubmissions.set(subId, {
              slug: latestSubmitPayload.slug,
              code: latestSubmitPayload.code,
              lang: latestSubmitPayload.lang,
              timestamp: Date.now(),
            });
            notifySubmissionStarted(latestSubmitPayload.slug, latestSubmitPayload.code, latestSubmitPayload.lang, subId);
          }
        }

        // Submit check response
        if (url.includes('/submissions/detail/') && url.includes('/check') && xhr.status >= 200 && xhr.status < 300) {
          const idMatch = url.match(/\/submissions\/detail\/([^/]+)\/check/);
          const subId = idMatch ? idMatch[1] : '';
          const data = JSON.parse(xhr.responseText || '{}');

          if (data && data.state === 'SUCCESS') {
            const isAccepted =
              data.status_msg === 'Accepted' ||
              data.status_code === 10 ||
              (typeof data.total_correct === 'number' &&
                typeof data.total_testcases === 'number' &&
                data.total_correct > 0 &&
                data.total_correct === data.total_testcases);

            const pending = subId ? pendingSubmissions.get(subId) : null;
            const fallback = latestSubmitPayload && Date.now() - latestSubmitPayload.timestamp < 120_000
              ? latestSubmitPayload
              : null;
            const slug = pending?.slug || fallback?.slug || getSlugFromUrl();

            if (slug) {
              if (isAccepted) {
                notifySubmissionAccepted({
                  slug,
                  code: pending?.code || fallback?.code,
                  lang: pending?.lang || fallback?.lang || data.lang,
                  submissionId: subId || undefined,
                  totalCorrect: data.total_correct,
                  totalTestcases: data.total_testcases,
                  runtime: data.status_runtime,
                  memory: data.status_memory,
                  runtimePercentile: data.runtime_percentile,
                  memoryPercentile: data.memory_percentile,
                });
                if (subId) pendingSubmissions.delete(subId);
              } else if (data.status_msg) {
                notifySubmissionRejected(slug, data.status_msg, subId || undefined);
                if (subId) pendingSubmissions.delete(subId);
              }
            }
          }
        }
      } catch {
        // ignore
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalXHRSend.apply(this, [body as any]);
  };
})();
