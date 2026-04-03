(function (global) {
  if (global.__REMOTE_UX_REALITY_TEST_CONTENT_LOADED__) {
    return;
  }

  global.__REMOTE_UX_REALITY_TEST_CONTENT_LOADED__ = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) {
      return;
    }

    if (message.type === "PING_REMOTE_UX") {
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "ANALYZE_JOB_PAGE") {
      (async () => {
        try {
          const extractors = global.JobEvaluatorExtractors;
          if (!extractors || typeof extractors.extractJobPosting !== "function") {
            sendResponse({
              ok: false,
              error: "Extraction system was not available on this page."
            });
            return;
          }

          const result = extractors.extractJobPosting();
          const enriched = await maybeEnrichWithGreenhouseApi(result);
          if (!enriched.fullJobText) {
            sendResponse({
              ok: false,
              error: "No visible job text was detected on this page.",
              data: enriched
            });
            return;
          }

          sendResponse({ ok: true, data: enriched });
        } catch (error) {
          sendResponse({
            ok: false,
            error: error && error.message ? error.message : "Unknown extraction failure."
          });
        }
      })();

      return true;
    }
  });

  async function maybeEnrichWithGreenhouseApi(result) {
    const base = Object.assign({}, result || {});
    const context = getGreenhouseEmbedContext();
    if (!context.jobId) {
      return base;
    }

    let apiJob;
    const boardTokenCandidates = getGreenhouseBoardTokenCandidates(context.boardToken);
    for (const candidate of boardTokenCandidates) {
      try {
        apiJob = await fetchGreenhouseApiJob(candidate, context.jobId);
      } catch (error) {
        apiJob = null;
      }
      if (isValidGreenhouseApiJob(apiJob)) {
        break;
      }
    }

    if (!isValidGreenhouseApiJob(apiJob)) {
      return base;
    }

    const utils = global.JobEvaluatorUtils;
    const apiFullText = extractReadableGreenhouseContent(apiJob.content || "");
    const apiSalary = utils && typeof utils.salaryFromText === "function"
      ? utils.salaryFromText(apiFullText)
      : "";

    const apiMeta = buildGreenhouseMetaFromApi(apiJob);
    const apiLocation =
      (apiJob.location && apiJob.location.name) ||
      firstOfficeName(apiJob.offices) ||
      "";
    const apiApplyUrl = apiJob.absolute_url || "";
    const hasAutofillSignal = /autofill with mygreenhouse/i.test(apiFullText);

    return Object.assign({}, base, {
      roleTitle: cleanText(apiJob.title) || base.roleTitle,
      company: cleanText(apiJob.company_name) || base.company,
      locationText: cleanText(apiLocation) || base.locationText,
      jobMetaText: cleanText(apiMeta) || base.jobMetaText,
      salaryText: cleanText(apiSalary) || base.salaryText,
      applyUrl: cleanText(apiApplyUrl) || base.applyUrl,
      applyText:
        cleanText(base.applyText) ||
        (hasAutofillSignal ? "Autofill with MyGreenhouse" : ""),
      fullJobText: cleanText(apiFullText) || base.fullJobText,
      extractorUsed: "greenhouse"
    });
  }

  function getGreenhouseEmbedContext() {
    const boardScript = document.querySelector("script[src*='boards.greenhouse.io/embed/job_board/js']");
    let boardToken = "";

    if (boardScript) {
      const rawSrc = String(boardScript.getAttribute("src") || "");
      try {
        const parsed = new URL(rawSrc, window.location.href);
        boardToken = cleanText(parsed.searchParams.get("for"));
      } catch (error) {
        const tokenMatch = rawSrc.match(/[?&]for=([^&]+)/i);
        boardToken = tokenMatch ? cleanText(decodeURIComponent(tokenMatch[1])) : "";
      }
    }

    if (!boardToken) {
      const iframe = document.querySelector("iframe[src*='job-boards.greenhouse.io/embed/job_']");
      if (iframe) {
        const rawSrc = String(iframe.getAttribute("src") || "");
        try {
          const parsed = new URL(rawSrc, window.location.href);
          boardToken = cleanText(parsed.searchParams.get("for"));
        } catch (error) {
          const tokenMatch = rawSrc.match(/[?&]for=([^&]+)/i);
          boardToken = tokenMatch ? cleanText(decodeURIComponent(tokenMatch[1])) : "";
        }
      }
    }

    let jobId = "";
    try {
      const currentUrl = new URL(window.location.href);
      jobId = cleanText(currentUrl.searchParams.get("gh_jid"));
    } catch (error) {
      jobId = "";
    }

    return {
      boardToken,
      jobId
    };
  }

  async function fetchGreenhouseApiJob(boardToken, jobId) {
    const token = encodeURIComponent(String(boardToken || "").trim());
    const id = encodeURIComponent(String(jobId || "").trim());
    if (!token || !id) {
      return null;
    }

    const endpoint =
      "https://boards-api.greenhouse.io/v1/boards/" +
      token +
      "/jobs/" +
      id +
      "?content=true";

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "omit"
      });
      if (response.ok) {
        const payload = await response.json();
        if (isValidGreenhouseApiJob(payload)) {
          return payload;
        }
      }
    } catch (error) {
      // Fall back to JSONP when fetch is blocked by runtime/browser policies.
    }

    const callbackName = "__jobEvaluatorGhCb_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
    const jsonpEndpoint = endpoint + "&callback=" + encodeURIComponent(callbackName);

    return new Promise((resolve) => {
      let settled = false;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => {
        cleanup();
        resolve(null);
      }, 10000);

      function cleanup() {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        try {
          delete window[callbackName];
        } catch (error) {
          window[callbackName] = undefined;
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      }

      window[callbackName] = (payload) => {
        const result = isValidGreenhouseApiJob(payload) ? payload : null;
        cleanup();
        resolve(result);
      };

      script.async = true;
      script.src = jsonpEndpoint;
      script.onerror = () => {
        cleanup();
        resolve(null);
      };

      (document.head || document.documentElement).appendChild(script);
    });
  }

  function isValidGreenhouseApiJob(payload) {
    if (!payload || typeof payload !== "object") {
      return false;
    }
    if (payload.error || payload.status >= 400) {
      return false;
    }
    const hasJobIdentity =
      Number.isFinite(Number(payload.id)) ||
      cleanText(payload.title) ||
      cleanText(payload.content);
    return Boolean(hasJobIdentity);
  }

  function getGreenhouseBoardTokenCandidates(initialToken) {
    const candidates = [];
    const addCandidate = (value) => {
      const normalized = normalizeBoardToken(value);
      if (!normalized) {
        return;
      }
      if (!candidates.includes(normalized)) {
        candidates.push(normalized);
      }
    };

    addCandidate(initialToken);

    const host = String(window.location.hostname || "").toLowerCase().replace(/^www\./, "");
    addCandidate(host);

    const hostLabels = host.split(".").filter(Boolean);
    const nonGenericLabels = hostLabels.filter((label) => !/^(www|jobs|job|careers|career)$/.test(label));
    if (nonGenericLabels.length) {
      addCandidate(nonGenericLabels[0]);
      addCandidate(nonGenericLabels.slice(0, 2).join(""));
      addCandidate(nonGenericLabels.slice(0, 2).join("-"));
    }

    const ogSiteName = document.querySelector("meta[property='og:site_name']")?.content;
    const appName = document.querySelector("meta[name='application-name']")?.content;
    addCandidate(ogSiteName);
    addCandidate(appName);
    addCandidate(document.title || "");

    return candidates.slice(0, 8);
  }

  function normalizeBoardToken(value) {
    const raw = cleanText(value);
    if (!raw) {
      return "";
    }
    return raw
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function extractReadableGreenhouseContent(rawContent) {
    const entityDecoded = decodeHtmlEntities(rawContent);
    const wrapper = document.createElement("div");
    wrapper.innerHTML = String(entityDecoded || "");
    return cleanText(wrapper.innerText || wrapper.textContent || "");
  }

  function decodeHtmlEntities(text) {
    const parser = document.createElement("textarea");
    parser.innerHTML = String(text || "");
    return parser.value;
  }

  function buildGreenhouseMetaFromApi(apiJob) {
    const pieces = [];

    const departments = Array.isArray(apiJob.departments) ? apiJob.departments : [];
    departments.forEach((department) => {
      const name = cleanText(department && department.name);
      if (name) {
        pieces.push(name);
      }
    });

    const offices = Array.isArray(apiJob.offices) ? apiJob.offices : [];
    offices.forEach((office) => {
      const name = cleanText(office && office.name);
      if (name && !/^remote$/i.test(name)) {
        pieces.push(name);
      }
    });

    const metadata = Array.isArray(apiJob.metadata) ? apiJob.metadata : [];
    metadata.forEach((item) => {
      const name = cleanText(item && item.name);
      const value = cleanText(item && item.value);
      if (name && value) {
        pieces.push(name + ": " + value);
      }
    });

    return dedupeStrings(pieces).join(" • ");
  }

  function firstOfficeName(offices) {
    const list = Array.isArray(offices) ? offices : [];
    for (const office of list) {
      const name = cleanText(office && office.name);
      if (name) {
        return name;
      }
    }
    return "";
  }

  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function dedupeStrings(items) {
    const seen = new Set();
    const output = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
      const value = cleanText(item);
      if (!value) {
        return;
      }
      const key = value.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      output.push(value);
    });
    return output;
  }
})(globalThis);
