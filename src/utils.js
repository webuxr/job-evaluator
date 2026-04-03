(function (global) {
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeText(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    return text || (fallback || "");
  }

  function textFromSelectors(selectors, root) {
    const scope = root || document;
    for (const selector of selectors) {
      const element = scope.querySelector(selector);
      if (element) {
        const text = cleanText(element.innerText || element.textContent || "");
        if (text) {
          return text;
        }
      }
    }
    return "";
  }

  function firstHrefFromSelectors(selectors, root) {
    const scope = root || document;
    for (const selector of selectors) {
      const element = scope.querySelector(selector);
      if (element && element.href) {
        return element.href;
      }
    }
    return "";
  }

  function firstButtonLikeText(selectors, root) {
    const scope = root || document;
    for (const selector of selectors) {
      const element = scope.querySelector(selector);
      if (element) {
        const text = cleanText(element.innerText || element.textContent || "");
        if (text) {
          return text;
        }
      }
    }
    return "";
  }

  function cleanText(value) {
    return safeText(
      String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/\s*\n\s*/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
    );
  }

  function normalizeWhitespace(value) {
    return safeText(String(value || "").replace(/\s+/g, " "));
  }

  function dedupeStrings(items) {
    const seen = new Set();
    const result = [];

    for (const item of toArray(items)) {
      const cleaned = safeText(item);
      if (!cleaned) {
        continue;
      }

      const key = cleaned.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(cleaned);
    }

    return result;
  }

  function isElementVisible(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.opacity === "0"
    ) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function collectVisibleText(root) {
    const container = root || document.body;
    if (!container) {
      return { fullText: "", chunks: [] };
    }

    const ignoredTags = new Set([
      "SCRIPT",
      "STYLE",
      "NOSCRIPT",
      "SVG",
      "CANVAS",
      "IMG",
      "VIDEO",
      "AUDIO"
    ]);

    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node || !node.parentElement) {
            return NodeFilter.FILTER_REJECT;
          }

          if (ignoredTags.has(node.parentElement.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          if (!isElementVisible(node.parentElement)) {
            return NodeFilter.FILTER_REJECT;
          }

          const text = normalizeWhitespace(node.textContent || "");
          if (text.length < 2) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const chunks = [];
    let currentNode = walker.nextNode();

    while (currentNode) {
      const text = normalizeWhitespace(currentNode.textContent || "");
      if (text.length >= 20) {
        chunks.push(text);
      }
      currentNode = walker.nextNode();
    }

    const deduped = dedupeStrings(chunks);
    return {
      fullText: cleanText(deduped.join("\n")),
      chunks: deduped
    };
  }

  function pickBestTextContainer(selectors) {
    const candidates = [];
    const combinedSelectors = selectors || [
      "main",
      "article",
      "[role='main']",
      ".job-description",
      ".jobs-description",
      ".description",
      ".posting",
      ".content",
      "section"
    ];

    for (const selector of combinedSelectors) {
      document.querySelectorAll(selector).forEach((element) => {
        if (!isElementVisible(element)) {
          return;
        }

        const payload = collectVisibleText(element);
        const text = payload.fullText;
        if (text.length < 180) {
          return;
        }

        const keywordHits = countPhraseHits(text, [
          "responsibilities",
          "requirements",
          "qualifications",
          "about the role",
          "what you'll do",
          "user",
          "design",
          "remote",
          "benefits"
        ]);

        candidates.push({
          element,
          text,
          chunks: payload.chunks,
          score: text.length + keywordHits * 120
        });
      });
    }

    candidates.sort((left, right) => right.score - left.score);
    return candidates[0] || null;
  }

  function salaryFromText(text) {
    const haystack = String(text || "");
    if (/\bno salary listed\b|\bsalary not listed\b|\bno compensation listed\b|\bsalary not disclosed\b|\bcompensation not disclosed\b/i.test(haystack)) {
      return "";
    }

    const match =
      haystack.match(/\$\s?\d[\d,]*(?:\s?-\s?\$?\s?\d[\d,]*)?(?:\s?(?:per year|\/year|yearly|annually|per hour|\/hour|hourly))?/i) ||
      haystack.match(/\b\d{2,3}k\s?-\s?\d{2,3}k\b/i) ||
      haystack.match(/\b\d{2,3},\d{3}\s?-\s?\d{2,3},\d{3}\b/);

    if (!match) {
      return "";
    }

    const candidate = cleanText(match[0]);
    if (!candidate) {
      return "";
    }

    const hasRange = candidate.includes("-");
    const hasUnit = /per year|\/year|yearly|annually|per hour|\/hour|hourly|per week|\/week|weekly|per month|\/month|monthly/i.test(candidate);
    const hasK = /\bk\b/i.test(candidate);

    const numericValue = Number(candidate.replace(/[^0-9]/g, ""));
    const hasLargeAbsoluteAmount = Number.isFinite(numericValue) && numericValue >= 10000;

    return hasRange || hasUnit || hasK || hasLargeAbsoluteAmount ? candidate : "";
  }

  function companyFromTitle(pageTitle) {
    const title = cleanText(pageTitle || "");
    if (!title) {
      return "";
    }

    const parts = title.split(/[\-|@|•|·]/).map((part) => safeText(part));
    if (parts.length < 2) {
      return "";
    }

    return parts[1] || "";
  }

  function countPhraseHits(text, phrases) {
    const haystack = String(text || "").toLowerCase();
    return toArray(phrases).reduce((count, phrase) => {
      return haystack.includes(String(phrase || "").toLowerCase()) ? count + 1 : count;
    }, 0);
  }

  function extractApplyInfo(root) {
    const scope = root || document;
    const links = Array.from(scope.querySelectorAll("a, button"));
    const candidate = links.find((element) => {
      const text = normalizeWhitespace(element.innerText || element.textContent || "");
      return /apply|easy apply|submit application|start application|apply now/i.test(text);
    });

    return {
      applyUrl: candidate && candidate.href ? candidate.href : "",
      applyText: candidate ? normalizeWhitespace(candidate.innerText || candidate.textContent || "") : ""
    };
  }

  function detectPlatform(url) {
    const lower = String(url || "").toLowerCase();
    if (lower.includes("linkedin.com/jobs")) {
      return "linkedin";
    }
    if (lower.includes("indeed.com")) {
      return "indeed";
    }
    if (lower.includes("greenhouse.io")) {
      return "greenhouse";
    }
    if (lower.includes("jobs.lever.co")) {
      return "lever";
    }
    if (lower.includes("dice.com")) {
      return "dice";
    }
    if (lower.includes("simplify.jobs")) {
      return "simplify";
    }
    return "generic";
  }

  function splitLocationAndMeta(text) {
    const cleaned = cleanText(text || "");
    if (!cleaned) {
      return {
        locationText: "",
        jobMetaText: ""
      };
    }

    const parts = cleaned
      .split(/\s*[·•|]\s*/g)
      .map((part) => cleanText(part))
      .filter(Boolean);

    if (!parts.length) {
      return {
        locationText: cleaned,
        jobMetaText: ""
      };
    }

    const locationPart = parts[0];
    const metaParts = parts.slice(1);

    return {
      locationText: locationPart,
      jobMetaText: metaParts.join(" • ")
    };
  }

  function cleanLocationText(text) {
    const cleaned = cleanText(text || "");
    if (!cleaned) {
      return "";
    }

    const normalized = cleaned
      .replace(/^(?:job\s+address|address|location)\s*[:\-]?\s*/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!normalized) {
      return "";
    }

    if (/\bremote\b|\bhybrid\b|\bonsite\b|\bon-site\b|\bin office\b/i.test(normalized)) {
      return normalized;
    }

    const usCityStateZip = normalized.match(
      /\b([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\s*,?\s*(\d{5}(?:-\d{4})?)\b/
    );
    if (usCityStateZip) {
      return cleanText(usCityStateZip[1]) + ", " + usCityStateZip[2] + " " + usCityStateZip[3];
    }

    if (/^\d+\s+[^,]+,/.test(normalized)) {
      const addressParts = normalized.split(",").map((part) => cleanText(part)).filter(Boolean);
      if (addressParts.length >= 3) {
        const city = addressParts[addressParts.length - 3];
        const regionPostal = addressParts[addressParts.length - 2];
        const country = addressParts[addressParts.length - 1];
        const isUsCountry = /^(?:usa|us|u\.s\.a\.?|u\.s\.?|united states(?: of america)?)$/i.test(country);

        const nonUsResult = [city, regionPostal, isUsCountry ? "" : country]
          .filter(Boolean)
          .join(", ");

        if (nonUsResult) {
          return nonUsResult;
        }
      }
    }

    return normalized;
  }

  function shortSnippets(chunks, maxCount) {
    return dedupeStrings(toArray(chunks).filter(Boolean)).slice(0, maxCount || 5);
  }

  function formatDateTime(dateValue) {
    try {
      return new Date(dateValue).toLocaleString();
    } catch (error) {
      return "";
    }
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  global.RemoteUxRealityTestUtils = {
    clamp,
    cleanText,
    companyFromTitle,
    collectVisibleText,
    countPhraseHits,
    dedupeStrings,
    detectPlatform,
    escapeHtml,
    extractApplyInfo,
    firstButtonLikeText,
    firstHrefFromSelectors,
    formatDateTime,
    isElementVisible,
    normalizeWhitespace,
    pickBestTextContainer,
    salaryFromText,
    safeText,
    shortSnippets,
    cleanLocationText,
    splitLocationAndMeta,
    textFromSelectors,
    toArray
  };
})(globalThis);
