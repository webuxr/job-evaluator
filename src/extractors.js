(function (global) {
  const utils = global.RemoteUxRealityTestUtils;

  function makeBaseResult() {
    return {
      url: window.location.href,
      pageTitle: utils.cleanText(document.title || ""),
      roleTitle: "",
      company: "",
      locationText: "",
      jobMetaText: "",
      salaryText: "",
      applyUrl: "",
      applyText: "",
      fullJobText: "",
      reasoningSnippets: [],
      extractorUsed: "generic"
    };
  }

  function finalizeResult(partial, extractorUsed) {
    const merged = Object.assign(makeBaseResult(), partial || {});
    const fullText = utils.cleanText(merged.fullJobText || "");
    const bodyText = utils.collectVisibleText(document.body);
    const inferredLocation = merged.locationText || guessLocationText(bodyText.fullText);
    const resolvedLocation = resolveSpecificLocation(
      inferredLocation,
      [merged.locationText, merged.jobMetaText, fullText, bodyText.fullText].filter(Boolean).join("\n")
    );
    const fallbackSalary = utils.salaryFromText(
      [merged.salaryText, fullText, bodyText.fullText].filter(Boolean).join("\n")
    );
    const fallbackApply = utils.extractApplyInfo(document);
    const snippets = buildReasoningSnippets(
      merged.reasoningSnippets && merged.reasoningSnippets.length
        ? merged.reasoningSnippets
        : bodyText.chunks
    );

    return {
      url: merged.url || window.location.href,
      pageTitle: merged.pageTitle || utils.cleanText(document.title || ""),
      roleTitle: merged.roleTitle || guessRoleTitle(),
      company: merged.company || guessCompanyName(),
      locationText: resolvedLocation,
      jobMetaText: merged.jobMetaText || "",
      salaryText: merged.salaryText || fallbackSalary || "",
      applyUrl: merged.applyUrl || fallbackApply.applyUrl || "",
      applyText: merged.applyText || fallbackApply.applyText || "",
      fullJobText: fullText || bodyText.fullText || "",
      reasoningSnippets: snippets,
      extractorUsed: extractorUsed || merged.extractorUsed || "generic"
    };
  }

  function resolveSpecificLocation(locationText, sourceText) {
    const cleaned = utils.cleanLocationText(locationText || "");
    if (!cleaned) {
      return "";
    }

    const genericLocationPattern = /^(?:usa|united states|us|u\.s\.a\.?|u\.s\.)$/i;
    if (!genericLocationPattern.test(cleaned)) {
      return cleaned;
    }

    const haystack = String(sourceText || "");
    const cityStateCountryMatch = haystack.match(
      /\b[A-Z][a-z]+(?: [A-Z][a-z]+)*,\s?[A-Z]{2},\s?(?:USA|United States)\b/
    );
    if (cityStateCountryMatch) {
      return utils.cleanLocationText(cityStateCountryMatch[0]);
    }

    const cityStateMatch = haystack.match(/\b[A-Z][a-z]+(?: [A-Z][a-z]+)*,\s?[A-Z]{2}\b/);
    if (cityStateMatch) {
      return utils.cleanLocationText(cityStateMatch[0]);
    }

    return cleaned;
  }

  function buildReasoningSnippets(chunks) {
    const preferred = utils.toArray(chunks).filter((chunk) => {
      return /remote|hybrid|onsite|salary|research|accessibility|design|travel|apply/i.test(chunk);
    });

    return utils.shortSnippets(preferred.length ? preferred : chunks, 5);
  }

  function guessRoleTitle() {
    const selectorText = utils.textFromSelectors([
      "h1",
      "[data-testid='jobsearch-JobInfoHeader-title']",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".job-card-list__title",
      ".artdeco-entity-lockup__title",
      ".app-title"
    ]);

    if (selectorText) {
      return selectorText;
    }

    const title = utils.cleanText(document.title || "");
    const titleMatch = title.match(/^(.+?)(?:\s[-|@]\s.+)?(?:\s\|\sLinkedIn)?$/i);
    if (titleMatch) {
      const normalizedTitle = utils.cleanText(titleMatch[1]);
      if (normalizedTitle) {
        return normalizedTitle;
      }
    }

    const linkedInFallback = getLinkedInFallbackRoleTitle(window.location.href);
    return linkedInFallback || "Unknown";
  }

  function getLinkedInFallbackRoleTitle(url) {
    const currentUrl = String(url || "");
    if (!/linkedin\.com\/jobs/i.test(currentUrl)) {
      return "";
    }

    try {
      const parsed = new URL(currentUrl);
      const currentJobId = parsed.searchParams.get("currentJobId");
      if (currentJobId) {
        return "LinkedIn Job #" + currentJobId;
      }

      const viewMatch = parsed.pathname.match(/\/jobs\/view\/(\d+)/i);
      if (viewMatch) {
        return "LinkedIn Job #" + viewMatch[1];
      }
    } catch (error) {
      return "";
    }

    return "";
  }

  function guessCompanyName() {
    const metaCompany =
      document.querySelector("meta[property='og:site_name']")?.content ||
      document.querySelector("meta[name='application-name']")?.content;

    return (
      utils.cleanText(metaCompany || "") ||
      utils.companyFromTitle(document.title) ||
      "Unknown"
    );
  }

  function guessLocationText(fullText) {
    const text =
      utils.textFromSelectors([
        "[data-testid='job-location']",
        "#jobLocationText",
        ".location",
        ".job-search-card__location",
        ".posting-categories .location"
      ]) || "";

    if (text) {
      return text;
    }

    const haystack = String(fullText || "");
    const match =
      haystack.match(/\b(remote(?: within [a-z ,]+)?|united states|usa|us remote|hybrid in [a-z ,]+)\b/i) ||
      haystack.match(/\b[A-Z][a-z]+,\s?[A-Z]{2}\b/);

    return match ? utils.cleanText(match[0]) : "";
  }

  function buildFromContainer(container, overrides, extractorUsed) {
    const payload = container
      ? utils.collectVisibleText(container)
      : utils.collectVisibleText(document.body);

    return finalizeResult(
      Object.assign(
        {
          fullJobText: payload.fullText,
          reasoningSnippets: payload.chunks
        },
        overrides || {}
      ),
      extractorUsed
    );
  }

  function extractLinkedIn() {
    const rawPrimaryDescription = utils.textFromSelectors([
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".jobs-unified-top-card__primary-description",
      ".job-details-jobs-unified-top-card__primary-description",
      ".topcard__flavor-row"
    ]);
    const linkedInMeta = utils.splitLocationAndMeta(rawPrimaryDescription);
    const container =
      document.querySelector(".jobs-description__content") ||
      document.querySelector(".show-more-less-html__markup") ||
      document.querySelector(".description__text") ||
      document.querySelector(".jobs-box__html-content");

    return buildFromContainer(
      container,
      {
        roleTitle: utils.textFromSelectors([
          ".job-details-jobs-unified-top-card__job-title",
          ".jobs-unified-top-card__job-title",
          ".t-24.job-details-jobs-unified-top-card__job-title",
          ".job-card-list__title",
          ".top-card-layout__title",
          "h1"
        ]),
        company: utils.textFromSelectors([
          ".job-details-jobs-unified-top-card__company-name a",
          ".jobs-unified-top-card__company-name a",
          ".job-details-jobs-unified-top-card__company-name",
          ".artdeco-entity-lockup__subtitle",
          ".job-card-container__company-name",
          ".topcard__org-name-link",
          ".topcard__flavor"
        ]),
        locationText:
          linkedInMeta.locationText ||
          utils.textFromSelectors([
            ".job-details-jobs-unified-top-card__bullet",
            ".tvm__text.tvm__text--low-emphasis",
            ".topcard__flavor--bullet"
          ]),
        jobMetaText: linkedInMeta.jobMetaText,
        salaryText:
          utils.textFromSelectors([
            ".salary",
            ".compensation__salary",
            "[class*='salary']"
          ]) || utils.salaryFromText(document.body.innerText),
        applyUrl: utils.firstHrefFromSelectors([
          "a[href*='easy-apply']",
          "a[href*='/jobs/view/']"
        ]),
        applyText: utils.firstButtonLikeText([
          "button[aria-label*='Apply']",
          "a[href*='easy-apply']",
          "button"
        ])
      },
      "linkedin"
    );
  }

  function extractIndeed() {
    const indeedTitleParts = parseIndeedTitle();
    const rawSubtitle = utils.textFromSelectors([
      ".jobsearch-JobInfoHeader-subtitle",
      "[data-testid='jobsearch-JobInfoHeader-companyLocation']",
      "[data-testid='inlineHeader-companyLocation']"
    ]);
    const indeedMeta = utils.splitLocationAndMeta(rawSubtitle);
    const container =
      document.querySelector("#jobDescriptionText") ||
      document.querySelector("[data-testid='jobsearch-JobComponent-description']") ||
      document.querySelector("[data-testid='viewJobBodyJobFullDescriptionContent']") ||
      document.querySelector("main");

    return buildFromContainer(
      container,
      {
        roleTitle: sanitizeIndeedRoleTitle(
          utils.textFromSelectors([
            "[data-testid='jobsearch-JobInfoHeader-title']",
            ".jobsearch-JobInfoHeader-title",
            "h1[data-testid]",
            "h2[data-testid='jobsearch-JobInfoHeader-title']",
            "h1"
          ]) || indeedTitleParts.roleTitle
        ),
        company:
          utils.textFromSelectors([
            "[data-testid='inlineHeader-companyName']",
            "[data-testid='jobsearch-JobInfoHeader-companyName']",
            "[data-company-name='true']",
            ".jobsearch-InlineCompanyRating div",
            ".jobsearch-JobInfoHeader-subtitle > div:first-child"
          ]) || indeedTitleParts.company,
        locationText:
          utils.textFromSelectors([
            "#jobLocationText",
            "[data-testid='job-location']",
            "[data-testid='inlineHeader-companyLocation']",
            "[data-testid='jobsearch-JobInfoHeader-companyLocation']"
          ]) || indeedMeta.locationText,
        jobMetaText: indeedMeta.jobMetaText,
        salaryText:
          utils.textFromSelectors([
            "#salaryInfoAndJobType",
            "[data-testid='salaryInfo']",
            "[data-testid='attribute_snippet_testid']",
            "[data-testid='viewJobDetailSalary']",
            ".js-match-insights-provider-tvvxwd"
          ]) || utils.salaryFromText(document.body.innerText),
        applyUrl: utils.firstHrefFromSelectors([
          "#indeedApplyButtonContainer a",
          "[data-testid='apply-button'] a",
          "a[href*='apply']"
        ]),
        applyText: utils.firstButtonLikeText([
          "#indeedApplyButtonContainer",
          "[data-testid='apply-button']",
          "button",
          "a[href*='apply']"
        ])
      },
      "indeed"
    );
  }

  function parseIndeedTitle() {
    const candidates = [
      document.querySelector("meta[property='og:title']")?.content,
      document.querySelector("meta[name='twitter:title']")?.content,
      document.title
    ]
      .map((value) => utils.cleanText(value || ""))
      .filter(Boolean);

    for (const candidate of candidates) {
      const parsed = parseIndeedTitleString(candidate);
      if (parsed.roleTitle || parsed.company) {
        return parsed;
      }
    }

    return {
      roleTitle: "",
      company: ""
    };
  }

  function parseIndeedTitleString(titleText) {
    const title = utils.cleanText(titleText || "");
    if (!title) {
      return { roleTitle: "", company: "" };
    }

    const normalized = sanitizeIndeedRoleTitle(title)
      .replace(/\s*\|\s*Indeed.*$/i, "")
      .trim();

    const atMatch = normalized.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) {
      return {
        roleTitle: utils.cleanText(atMatch[1]),
        company: utils.cleanText(atMatch[2])
      };
    }

    const dashParts = normalized.split(/\s[-|•]\s/).map((part) => utils.cleanText(part)).filter(Boolean);
    if (dashParts.length >= 2) {
      return {
        roleTitle: dashParts[0],
        company: dashParts[1]
      };
    }

    return {
      roleTitle: normalized,
      company: ""
    };
  }

  function sanitizeIndeedRoleTitle(titleText) {
    return utils.cleanText(String(titleText || "")).replace(/\s*-\s*job post.*$/i, "").trim();
  }

  function extractGreenhouse() {
    const greenhouseTitleParts = parseGreenhouseTitle();
    const container =
      document.querySelector("#content") ||
      document.querySelector(".opening") ||
      document.querySelector(".content") ||
      document.querySelector("main");

    return buildFromContainer(
      container,
      {
        roleTitle:
          utils.textFromSelectors([
            "h3.section-header",
            ".app-title",
            ".opening h1",
            ".application-header h1",
            "[data-testid='job-title']",
            "[class*='job-title']",
            "[class*='jobTitle']",
            "h1"
          ]) || greenhouseTitleParts.roleTitle,
        company:
          utils.textFromSelectors([
            "h4.section-title",
            ".company-name",
            ".heading .company",
            ".app-header",
            ".application-header__company",
            "[data-testid='company-name']",
            "[class*='company-name']",
            "[class*='companyName']"
          ]) || greenhouseTitleParts.company || utils.companyFromTitle(document.title),
        locationText: utils.textFromSelectors([
          ".location",
          ".opening .location",
          "#header .location",
          ".application-header .location",
          "[data-testid='job-location']"
        ]),
        salaryText: utils.salaryFromText(container ? container.innerText : document.body.innerText),
        applyUrl: utils.firstHrefFromSelectors([
          "a[href*='grnh.se']",
          "a[href*='greenhouse']",
          "a[href*='application']"
        ]),
        applyText: utils.firstButtonLikeText([
          "a[href*='application']",
          "button[type='submit']",
          "a[href*='greenhouse']"
        ])
      },
      "greenhouse"
    );
  }

  function parseGreenhouseTitle() {
    const candidates = [
      document.querySelector("meta[property='og:title']")?.content,
      document.querySelector("meta[name='twitter:title']")?.content,
      document.title
    ]
      .map((value) => utils.cleanText(value || ""))
      .filter(Boolean);

    for (const candidate of candidates) {
      const parsed = parseGreenhouseTitleString(candidate);
      if (parsed.roleTitle || parsed.company) {
        return parsed;
      }
    }

    return {
      roleTitle: "",
      company: ""
    };
  }

  function parseGreenhouseTitleString(titleText) {
    const title = utils.cleanText(titleText || "");
    if (!title) {
      return { roleTitle: "", company: "" };
    }

    const normalized = title.replace(/\s*\|\s*Greenhouse.*$/i, "").trim();
    const applyMatch = normalized.match(/^(?:apply to|application for)\s+(.+?)\s+at\s+(.+)$/i);
    if (applyMatch) {
      return {
        roleTitle: utils.cleanText(applyMatch[1]),
        company: utils.cleanText(applyMatch[2])
      };
    }

    const atMatch = normalized.match(/^(.+?)\s+at\s+(.+)$/i);
    if (atMatch) {
      return {
        roleTitle: utils.cleanText(atMatch[1]),
        company: utils.cleanText(atMatch[2])
      };
    }

    return {
      roleTitle: normalized,
      company: ""
    };
  }

  function extractLever() {
    const container =
      document.querySelector(".posting-page") ||
      document.querySelector(".content-wrapper") ||
      document.querySelector(".section-wrapper");

    return buildFromContainer(
      container,
      {
        roleTitle: utils.textFromSelectors([
          ".posting-headline h2",
          ".posting-headline h1",
          "h1"
        ]),
        company:
          utils.textFromSelectors([
            ".main-header-logo img[alt]",
            ".main-header-logo",
            ".posting-categories .team"
          ]) || utils.companyFromTitle(document.title),
        locationText: utils.textFromSelectors([
          ".posting-categories .sort-by-location",
          ".posting-categories .location",
          ".posting-categories"
        ]),
        salaryText: utils.salaryFromText(container ? container.innerText : document.body.innerText),
        applyUrl: utils.firstHrefFromSelectors([
          "a[href*='lever.co']",
          "a[href*='application']",
          ".postings-btn-wrapper a"
        ]),
        applyText: utils.firstButtonLikeText([
          ".postings-btn-wrapper a",
          "a[href*='application']",
          "button"
        ])
      },
      "lever"
    );
  }

  function extractDice() {
    const container =
      document.querySelector("[data-testid='jobDescription']") ||
      document.querySelector(".job-description") ||
      document.querySelector("main");

    return buildFromContainer(
      container,
      {
        roleTitle: utils.textFromSelectors([
          "[data-cy='jobTitle']",
          "[data-testid='jobTitle']",
          "h1"
        ]),
        company: utils.textFromSelectors([
          "[data-cy='companyNameLink']",
          "[data-testid='companyName']",
          ".employer"
        ]),
        locationText: utils.textFromSelectors([
          "[data-cy='location']",
          "[data-testid='location']",
          ".job-location"
        ]),
        salaryText:
          utils.textFromSelectors([
            "[data-cy='payRate']",
            "[data-testid='payRate']",
            ".pay-rate"
          ]) || utils.salaryFromText(document.body.innerText),
        applyUrl: utils.firstHrefFromSelectors([
          "a[href*='apply']",
          "[data-cy='applyButton']",
          "a[data-testid='applyButton']"
        ]),
        applyText: utils.firstButtonLikeText([
          "[data-cy='applyButton']",
          "[data-testid='applyButton']",
          "button",
          "a[href*='apply']"
        ])
      },
      "dice"
    );
  }

  function extractSimplify() {
    const simplifyTitleParts = parseSimplifyTitle();
    const locationMetaText = utils.textFromSelectors([
      "[data-testid='job-location']",
      "[data-testid='location']",
      "[class*='location']",
      "main p",
      "main div"
    ]);
    const simplifyMeta = utils.splitLocationAndMeta(locationMetaText);
    const container =
      document.querySelector("main article") ||
      document.querySelector("article") ||
      document.querySelector("[data-testid='job-description']") ||
      document.querySelector("[class*='job-description']") ||
      document.querySelector("main");
    const containerText = utils.cleanText(container ? container.innerText : document.body.innerText);
    const inferredMeta = inferSimplifyJobMeta([
      simplifyMeta.jobMetaText,
      locationMetaText,
      utils.textFromSelectors([
        "[data-testid='job-type']",
        "[data-testid='employment-type']",
        "[data-testid='seniority']",
        "[class*='employment']",
        "[class*='seniority']",
        "[class*='level']"
      ]),
      containerText
    ]);

    return buildFromContainer(
      container,
      {
        roleTitle:
          utils.textFromSelectors([
            "main h1",
            "[data-testid='job-title']",
            "[class*='job-title']",
            "h1"
          ]) || simplifyTitleParts.roleTitle,
        company:
          utils.textFromSelectors([
            "main h2",
            "[data-testid='company-name']",
            "[class*='company-name']",
            "[class*='companyName']"
          ]) || simplifyTitleParts.company,
        locationText:
          simplifyMeta.locationText ||
          utils.textFromSelectors([
            "[data-testid='job-location']",
            "[data-testid='location']",
            "[class*='location']"
          ]),
        jobMetaText: inferredMeta,
        salaryText:
          utils.textFromSelectors([
            "[data-testid='salary']",
            "[class*='salary']",
            "[class*='compensation']"
          ]) || utils.salaryFromText(container ? container.innerText : document.body.innerText),
        applyUrl: utils.firstHrefFromSelectors([
          "a[href*='apply']",
          "a[href*='greenhouse']",
          "a[href*='lever.co']",
          "a[href*='workdayjobs']",
          "a[href*='boards.greenhouse']"
        ]),
        applyText: utils.firstButtonLikeText([
          "a[href*='apply']",
          "button",
          "a[href*='greenhouse']",
          "a[href*='lever.co']"
        ])
      },
      "simplify"
    );
  }

  function inferSimplifyJobMeta(textSources) {
    const haystack = utils
      .cleanText(utils.toArray(textSources).filter(Boolean).join("\n"))
      .toLowerCase();
    if (!haystack) {
      return "";
    }

    const meta = [];

    if (/\bhybrid\b/.test(haystack)) {
      meta.push("Hybrid");
    } else if (/\bremote\b/.test(haystack)) {
      meta.push("Remote");
    } else if (/\bonsite\b|\bon-site\b|\bin office\b/.test(haystack)) {
      meta.push("Onsite");
    }

    if (/\bfull[- ]?time\b/.test(haystack)) {
      meta.push("Full-time");
    } else if (/\bpart[- ]?time\b/.test(haystack)) {
      meta.push("Part-time");
    } else if (/\bcontract\b|\bcontractor\b/.test(haystack)) {
      meta.push("Contract");
    } else if (/\binternship\b|\bintern\b/.test(haystack)) {
      meta.push("Internship");
    } else if (/\btemporary\b|\btemp\b/.test(haystack)) {
      meta.push("Temporary");
    }

    if (/\bentry[- ]?level\b|\bjunior\b|\bnew grad\b/.test(haystack)) {
      meta.push("Entry level");
    } else if (/\bmid[- ]?level\b/.test(haystack)) {
      meta.push("Mid level");
    } else if (/\bsenior\b/.test(haystack)) {
      meta.push("Senior");
    } else if (/\bstaff\b/.test(haystack)) {
      meta.push("Staff");
    } else if (/\bprincipal\b/.test(haystack)) {
      meta.push("Principal");
    }

    return utils.dedupeStrings(meta).join(" • ");
  }

  function parseSimplifyTitle() {
    const candidates = [
      document.querySelector("meta[property='og:title']")?.content,
      document.querySelector("meta[name='twitter:title']")?.content,
      document.title
    ]
      .map((value) => utils.cleanText(value || ""))
      .filter(Boolean);

    for (const candidate of candidates) {
      const parsed = parseSimplifyTitleString(candidate);
      if (parsed.roleTitle || parsed.company) {
        return parsed;
      }
    }

    return {
      roleTitle: "",
      company: ""
    };
  }

  function parseSimplifyTitleString(titleText) {
    const title = utils.cleanText(titleText || "");
    if (!title) {
      return { roleTitle: "", company: "" };
    }

    const normalized = title.replace(/\s*\|\s*Simplify(?: Jobs)?\s*$/i, "").trim();
    const atMatch = normalized.match(/^(.+?)\s*@\s*(.+)$/i);
    if (atMatch) {
      return {
        roleTitle: utils.cleanText(atMatch[1]),
        company: utils.cleanText(atMatch[2])
      };
    }

    const dashParts = normalized.split(/\s[-|•]\s/).map((part) => utils.cleanText(part)).filter(Boolean);
    if (dashParts.length >= 2) {
      return {
        roleTitle: dashParts[0],
        company: dashParts[1]
      };
    }

    return {
      roleTitle: normalized,
      company: ""
    };
  }

  function extractGeneric() {
    const bestContainer = utils.pickBestTextContainer();
    const payload = bestContainer || utils.collectVisibleText(document.body);
    const applyInfo = utils.extractApplyInfo(document);

    return finalizeResult(
      {
        roleTitle: guessRoleTitle(),
        company: guessCompanyName(),
        locationText: guessLocationText(payload.text || payload.fullText),
        salaryText: utils.salaryFromText(payload.text || payload.fullText),
        applyUrl: applyInfo.applyUrl,
        applyText: applyInfo.applyText,
        fullJobText: payload.text || payload.fullText,
        reasoningSnippets: payload.chunks || []
      },
      "generic"
    );
  }

  function extractJobPosting() {
    const platform = utils.detectPlatform(window.location.href);

    try {
      if (platform === "linkedin") {
        return extractLinkedIn();
      }
      if (platform === "indeed") {
        return extractIndeed();
      }
      if (platform === "greenhouse") {
        return extractGreenhouse();
      }
      if (platform === "lever") {
        return extractLever();
      }
      if (platform === "dice") {
        return extractDice();
      }
      if (platform === "simplify") {
        return extractSimplify();
      }
      return extractGeneric();
    } catch (error) {
      const fallback = extractGeneric();
      fallback.reasoningSnippets = buildReasoningSnippets(
        fallback.reasoningSnippets.concat("Extractor fallback used because site-specific parsing failed.")
      );
      fallback.extractorUsed = platform === "generic" ? "generic" : platform + "-fallback";
      return fallback;
    }
  }

  global.RemoteUxRealityTestExtractors = {
    extractJobPosting
  };
})(globalThis);
