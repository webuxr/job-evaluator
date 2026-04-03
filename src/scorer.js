(function (global) {
  const constants = global.JobEvaluatorConstants;
  const utils = global.JobEvaluatorUtils;

  const CATEGORY_RULES = {
    remoteAuthenticity: {
      positive: [
        { phrase: "fully remote", points: 20, flag: "Fully remote stated" },
        { phrase: "100% remote", points: 20, flag: "Fully remote stated" },
        { phrase: "remote-first", points: 15, flag: "Remote-first language" },
        { phrase: "distributed team", points: 15, flag: "Remote-first language" },
        { phrase: "async", points: 10, flag: "Remote-first language" },
        { phrase: "asynchronous", points: 10, flag: "Remote-first language" },
        { phrase: "work from anywhere", points: 15, flag: "Fully remote stated" },
        { phrase: "no travel required", points: 10, flag: "Fully remote stated" }
      ],
      negative: [
        { phrase: "hybrid", points: -22, flag: "Hybrid role" },
        { phrase: "onsite", points: -30, flag: "Onsite role" },
        { phrase: "on-site", points: -30, flag: "Onsite role" },
        { phrase: "in office", points: -22, flag: "Onsite role" },
        { phrase: "must be within commuting distance", points: -18, flag: "Location-restricted remote" },
        { phrase: "must be located in", points: -10, flag: "Location-restricted remote" },
        { phrase: "local candidates only", points: -10, flag: "Location-restricted remote" },
        { phrase: "occasional onsite", points: -20, flag: "Hybrid role" },
        { phrase: "occasional on-site", points: -20, flag: "Hybrid role" },
        { phrase: "travel up to 10%", points: -10, flag: "Travel required" },
        { phrase: "travel up to 25%", points: -20, flag: "Travel required" },
        { phrase: "travel required", points: -20, flag: "Travel required" },
        { phrase: "remote during onboarding only", points: -20, flag: "Hybrid role" },
        { phrase: "relocation", points: -18, flag: "Location-restricted remote" }
      ]
    },
    uxRoleQuality: {
      positive: [
        { phrase: "user research", points: 10, flag: "Research/testing present" },
        { phrase: "usability testing", points: 10, flag: "Research/testing present" },
        { phrase: "wireframe", points: 8, flag: "Research/testing present" },
        { phrase: "wireframes", points: 8, flag: "Research/testing present" },
        { phrase: "prototype", points: 8, flag: "Research/testing present" },
        { phrase: "prototyping", points: 8, flag: "Research/testing present" },
        { phrase: "design system", points: 8, flag: "Design systems mentioned" },
        { phrase: "accessibility", points: 10, flag: "Accessibility mentioned" },
        { phrase: "wcag", points: 10, flag: "Accessibility mentioned" },
        { phrase: "cross-functional", points: 5, flag: "Research/testing present" },
        { phrase: "product team", points: 8, flag: "Research/testing present" },
        { phrase: "interaction design", points: 8, flag: "Research/testing present" },
        { phrase: "information architecture", points: 8, flag: "Research/testing present" }
      ],
      negative: [
        { phrase: "seo", points: -10, flag: "Marketing-heavy role" },
        { phrase: "paid media", points: -10, flag: "Marketing-heavy role" },
        { phrase: "marketing campaigns", points: -10, flag: "Marketing-heavy role" }
      ]
    }
  };

  const FREE_EMAIL_PATTERN = /\b(?:gmail|yahoo|hotmail|outlook|aol)\.com\b/i;
  const SUSPICIOUS_FORM_PATTERN = /\b(?:typeform|jotform|google form|google forms|airtable form|wufoo)\b/i;

  function scorePosting(extraction) {
    const normalized = extraction || {};
    const combinedText = buildHaystack(normalized);
    const flags = {
      red: [],
      green: []
    };
    const matchedSignals = {
      remoteAuthenticity: [],
      uxRoleQuality: [],
      trustLegitimacy: [],
      applicationQuality: [],
      flagTriggers: {}
    };

    const scores = {
      remoteAuthenticity: 50,
      uxRoleQuality: 50,
      trustLegitimacy: 50,
      applicationQuality: 50
    };

    applyRules(scores, flags, matchedSignals, combinedText, "remoteAuthenticity", CATEGORY_RULES.remoteAuthenticity);
    applyRules(scores, flags, matchedSignals, combinedText, "uxRoleQuality", CATEGORY_RULES.uxRoleQuality);
    applyLocationRestrictedWorkModelHeuristic(scores, flags, matchedSignals, combinedText);
    applyUxHeuristics(scores, flags, matchedSignals, normalized, combinedText);
    applyTrustHeuristics(scores, flags, matchedSignals, normalized, combinedText);
    applyApplicationHeuristics(scores, flags, matchedSignals, normalized, combinedText);
    applyPreferenceTweaks(scores, matchedSignals, combinedText, normalized);

    scores.remoteAuthenticity = utils.clamp(scores.remoteAuthenticity, 0, 100);
    scores.uxRoleQuality = utils.clamp(scores.uxRoleQuality, 0, 100);
    scores.trustLegitimacy = utils.clamp(scores.trustLegitimacy, 0, 100);
    scores.applicationQuality = utils.clamp(scores.applicationQuality, 0, 100);

    const overallScore = utils.clamp(
      Math.round(
        scores.remoteAuthenticity * constants.SCORE_WEIGHTS.remoteAuthenticity +
          scores.uxRoleQuality * constants.SCORE_WEIGHTS.uxRoleQuality +
          scores.trustLegitimacy * constants.SCORE_WEIGHTS.trustLegitimacy +
          scores.applicationQuality * constants.SCORE_WEIGHTS.applicationQuality
      ),
      0,
      100
    );

    const verdict = computeVerdict(overallScore);
    const explanation = buildExplanation(normalized, scores, matchedSignals);

    return {
      overallScore,
      verdict,
      subscores: scores,
      redFlags: utils.dedupeStrings(flags.red),
      greenFlags: utils.dedupeStrings(flags.green),
      explanation,
      matchedSignals
    };
  }

  function buildHaystack(extraction) {
    return [
      extraction.pageTitle,
      extraction.roleTitle,
      extraction.company,
      extraction.locationText,
      extraction.jobMetaText,
      extraction.salaryText,
      extraction.applyText,
      extraction.applyUrl,
      extraction.fullJobText
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
  }

  function applyRules(scores, flags, matchedSignals, combinedText, categoryName, ruleGroup) {
    ruleGroup.positive.forEach((rule) => {
      if (combinedText.includes(rule.phrase.toLowerCase())) {
        scores[categoryName] += rule.points;
        recordSignal(matchedSignals, categoryName, rule, true);
        addFlag(flags.green, matchedSignals, rule.flag, rule.phrase);
      }
    });

    ruleGroup.negative.forEach((rule) => {
      if (combinedText.includes(rule.phrase.toLowerCase())) {
        scores[categoryName] += rule.points;
        recordSignal(matchedSignals, categoryName, rule, false);
        addFlag(flags.red, matchedSignals, rule.flag, rule.phrase);
      }
    });
  }

  function applyLocationRestrictedWorkModelHeuristic(scores, flags, matchedSignals, combinedText) {
    const hasLocationLimitedPhrase =
      /\bentirely remote\b[\s\S]{0,120}\bcould be performed in\b/i.test(combinedText) ||
      /\bremote\b[\s\S]{0,120}\bcould be performed in\b/i.test(combinedText);

    if (!hasLocationLimitedPhrase) {
      return;
    }

    scores.remoteAuthenticity -= 12;
    recordSignal(matchedSignals, "remoteAuthenticity", { phrase: "location-limited remote wording", points: -12 }, false);
    addFlag(flags.red, matchedSignals, "Location-restricted remote", "could be performed in");
  }

  function applyUxHeuristics(scores, flags, matchedSignals, extraction, combinedText) {
    const strongUxLanguage = utils.countPhraseHits(combinedText, [
      "user research",
      "usability testing",
      "interaction design",
      "information architecture",
      "product designer",
      "ux designer"
    ]);

    const marketingHits = utils.countPhraseHits(combinedText, [
      "seo",
      "paid media",
      "marketing campaigns",
      "social media",
      "lead generation",
      "content calendar"
    ]);

    const devHits = utils.countPhraseHits(combinedText, [
      "frontend",
      "front-end",
      "react",
      "full stack",
      "full-stack",
      "backend",
      "html/css/javascript"
    ]);

    if (combinedText.includes("graphic design") && strongUxLanguage < 2) {
      scores.uxRoleQuality -= 10;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "graphic design", points: -10 }, false);
      addFlag(flags.red, matchedSignals, "Marketing-heavy role", "graphic design");
    }

    if (combinedText.includes("wordpress") && marketingHits >= 2) {
      scores.uxRoleQuality -= 5;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "wordpress", points: -5 }, false);
      addFlag(flags.red, matchedSignals, "Marketing-heavy role", "wordpress");
    }

    if ((combinedText.includes("html/css/javascript") || devHits >= 3) && strongUxLanguage < 2) {
      scores.uxRoleQuality -= 8;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "html/css/javascript", points: -8 }, false);
      addFlag(flags.red, matchedSignals, "Dev-heavy role", "html/css/javascript");
    }

    if (hasOverloadedRoleScope(extraction)) {
      scores.uxRoleQuality -= 20;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "overloaded role scope", points: -20 }, false);
      addFlag(flags.red, matchedSignals, "Overloaded role scope", "multiple bundled disciplines");
    }

    if (/wear many hats|jack of all trades|own everything/i.test(combinedText)) {
      scores.uxRoleQuality -= 15;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "wear many hats", points: -15 }, false);
      addFlag(flags.red, matchedSignals, "Overloaded role scope", "wear many hats");
    }

    if (/\bentry[- ]?level\b|\bjunior\b|\bnew grad\b/.test(combinedText)) {
      scores.uxRoleQuality -= 10;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "entry-level role", points: -10 }, false);
      addFlag(flags.red, matchedSignals, "Entry-level role", "entry-level");
    }

    if (hasEducationProfileMatch(extraction, combinedText)) {
      scores.uxRoleQuality += 10;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "education profile match", points: 10 }, true);
      addFlag(flags.green, matchedSignals, "Education background match", "degree or equivalent experience aligns");
    }

    const requirementText = String(extraction.fullJobText || "");
    const hasDevStackRequirement =
      /(?:requirements?|qualifications?|must have|required)[\s\S]{0,220}\b(?:react|next\.?js|typescript|node(?:\.?js)?|angular)\b/i.test(requirementText) ||
      /\b(?:react|next\.?js|typescript|node(?:\.?js)?|angular)\b[\s\S]{0,120}(?:required|requirement|must have)\b/i.test(requirementText);

    if (hasDevStackRequirement) {
      addFlag(flags.red, matchedSignals, "Dev-stack requirement", "React/Next.js/TypeScript/Node/Angular requirement");
    }
  }

  function hasEducationProfileMatch(extraction, combinedText) {
    const preferences = constants.USER_PREFERENCES || {};
    const educationKeywords = Array.isArray(preferences.educationMatchKeywords)
      ? preferences.educationMatchKeywords
      : [];
    if (!educationKeywords.length) {
      return false;
    }

    const educationText = [
      extraction.roleTitle,
      extraction.pageTitle,
      extraction.fullJobText
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    const hasEducationRequirement = /\bbachelor'?s degree\b|\bdegree\b|\bequivalent experience\b/i.test(educationText);
    if (!hasEducationRequirement) {
      return false;
    }

    const matchedKeywords = educationKeywords.filter((keyword) => combinedText.includes(String(keyword || "").toLowerCase()));
    return matchedKeywords.length >= 2;
  }

  function applyTrustHeuristics(scores, flags, matchedSignals, extraction, combinedText) {
    const hasCompanyName = Boolean(extraction.company && extraction.company !== "Unknown");
    const hasSalary = Boolean(extraction.salaryText);
    const hasResponsibilities = /\b(?:responsibilities|what you'll do|what you will do|you will|day-to-day)\b/i.test(
      extraction.fullJobText || ""
    );
    const hasProductContext = /\b(?:about us|our product|our platform|customers|mission|service|saas|platform)\b/i.test(
      extraction.fullJobText || ""
    );
    const isKnownAts = isKnownAtsPath(extraction);

    if (hasCompanyName) {
      scores.trustLegitimacy += 10;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "company name found", points: 10 }, true);
      addFlag(flags.green, matchedSignals, "Clear company identity", "company name found");
    } else {
      scores.trustLegitimacy -= 30;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "no company name", points: -30 }, false);
      addFlag(flags.red, matchedSignals, "Unclear company identity", "company name missing");
    }

    if (hasSalary) {
      scores.trustLegitimacy += 10;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "salary range found", points: 10 }, true);
      addFlag(flags.green, matchedSignals, "Salary range listed", extraction.salaryText);
    } else {
      addFlag(flags.red, matchedSignals, "No salary transparency", "salary missing");
    }

    if (hasResponsibilities) {
      scores.trustLegitimacy += 10;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "clear responsibilities", points: 10 }, true);
    }

    if (hasProductContext) {
      scores.trustLegitimacy += 10;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "clear product context", points: 10 }, true);
    }

    if (isKnownAts) {
      scores.trustLegitimacy += 10;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "known ats platform detected", points: 10 }, true);
      addFlag(flags.green, matchedSignals, "Known ATS flow", extraction.extractorUsed);
    }

    if (combinedText.includes("confidential client")) {
      scores.trustLegitimacy -= 20;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "confidential client", points: -20 }, false);
      addFlag(flags.red, matchedSignals, "Confidential client", "confidential client");
    }

    if (/\bour client\b|\brecruiter\b|\bthird[- ]party recruiter\b|\bstaffing firm\b/i.test(combinedText)) {
      scores.trustLegitimacy -= 15;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "generic recruiter language", points: -15 }, false);
    }

    if (/\bunlimited earning potential\b|\bmake six figures fast\b|\bno experience necessary\b/i.test(combinedText)) {
      scores.trustLegitimacy -= 15;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "unrealistic compensation phrasing", points: -15 }, false);
    }

    if (/!!!|urgent hiring|apply today!!!|easy money/i.test(combinedText)) {
      scores.trustLegitimacy -= 10;
      recordSignal(matchedSignals, "trustLegitimacy", { phrase: "spammy grammar", points: -10 }, false);
    }
  }

  function applyApplicationHeuristics(scores, flags, matchedSignals, extraction, combinedText) {
    const currentUrl = String(extraction.url || "");
    const applyUrl = String(extraction.applyUrl || "");
    const applyText = String(extraction.applyText || "");
    const directCareersSignal = /\/careers|\/jobs|careers\./i.test(currentUrl);
    const clearApplyFlow = Boolean(applyUrl || /apply|easy apply|submit application/i.test(applyText));
    const knownApplicationFlow = /greenhouse|workday/i.test(currentUrl) || /greenhouse|workday/i.test(applyUrl);
    const hasGreenhouseAutofill = /\bautofill with mygreenhouse\b/i.test(combinedText);

    if (knownApplicationFlow) {
      scores.applicationQuality += 10;
      recordSignal(matchedSignals, "applicationQuality", { phrase: "known ats flow", points: 10 }, true);
      addFlag(flags.green, matchedSignals, "Known ATS flow", applyUrl || currentUrl);
    }

    if (clearApplyFlow) {
      scores.applicationQuality += 10;
      recordSignal(matchedSignals, "applicationQuality", { phrase: "clear application flow", points: 10 }, true);
    }

    if (hasGreenhouseAutofill) {
      addFlag(flags.green, matchedSignals, "Greenhouse autofill available", "Autofill with MyGreenhouse");
    }

    if (extraction.hasSimplifyJobsShadowRoot) {
      addFlag(flags.green, matchedSignals, "Simplify Jobs helper detected", "div.simplify-jobs-shadow-root");
    }

    if (directCareersSignal) {
      scores.applicationQuality += 15;
      recordSignal(matchedSignals, "applicationQuality", { phrase: "direct company careers page signals", points: 15 }, true);
    }

    if (FREE_EMAIL_PATTERN.test(applyUrl) || FREE_EMAIL_PATTERN.test(applyText) || FREE_EMAIL_PATTERN.test(combinedText)) {
      scores.applicationQuality -= 35;
      recordSignal(matchedSignals, "applicationQuality", { phrase: "free email provider", points: -35 }, false);
      addFlag(flags.red, matchedSignals, "Suspicious application path", "free email provider");
    }

    if (SUSPICIOUS_FORM_PATTERN.test(applyUrl) || SUSPICIOUS_FORM_PATTERN.test(combinedText)) {
      scores.applicationQuality -= 20;
      recordSignal(matchedSignals, "applicationQuality", { phrase: "suspicious external form", points: -20 }, false);
      addFlag(flags.red, matchedSignals, "Suspicious application path", "external form");
    }

    if (/\bsocial security\b|\bssn\b|\bbank account\b|\bdriver'?s license\b/i.test(combinedText)) {
      scores.applicationQuality -= 25;
      recordSignal(matchedSignals, "applicationQuality", { phrase: "requests excessive personal info too early", points: -25 }, false);
      addFlag(flags.red, matchedSignals, "Suspicious application path", "excessive personal info");
    }
  }

  function applyPreferenceTweaks(scores, matchedSignals, combinedText, extraction) {
    const preferences = constants.USER_PREFERENCES;

    if (preferences.penalizeHybridHeavily && combinedText.includes("hybrid")) {
      scores.remoteAuthenticity -= 10;
      recordSignal(matchedSignals, "remoteAuthenticity", { phrase: "hybrid preference penalty", points: -10 }, false);
    }

    if (preferences.preferAccessibilityRoles && /\baccessibility\b|\bwcag\b/i.test(combinedText)) {
      scores.uxRoleQuality += 3;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "accessibility preference boost", points: 3 }, true);
    }

    if (preferences.preferProductUXOverMarketingUX && /\bproduct team\b|\bproduct designer\b/i.test(combinedText)) {
      scores.uxRoleQuality += 3;
      recordSignal(matchedSignals, "uxRoleQuality", { phrase: "product ux preference boost", points: 3 }, true);
    }

    if ((preferences.preferRemoteRoles || preferences.preferRemoteOnly) && /onsite|on-site|hybrid|in office/i.test(combinedText)) {
      scores.remoteAuthenticity -= 5;
      recordSignal(matchedSignals, "remoteAuthenticity", { phrase: "non-remote preference penalty", points: -5 }, false);
    }

    const commuteBoost = getCommuteFriendlyHybridBoost(extraction, preferences, combinedText);
    if (commuteBoost.points > 0) {
      scores.remoteAuthenticity += commuteBoost.points;
      recordSignal(
        matchedSignals,
        "remoteAuthenticity",
        { phrase: commuteBoost.phrase, points: commuteBoost.points },
        true
      );
    }

    if (preferences.enableCommutePlaceholderLogic) {
      maybeApplyCommutePlaceholder(extraction, scores, matchedSignals);
    }
  }

  function getCommuteFriendlyHybridBoost(extraction, preferences, combinedText) {
    const hasHybridSignal = /\bhybrid\b|\bonsite\b|\bon-site\b|\bin office\b/i.test(combinedText);
    if (!hasHybridSignal) {
      return { points: 0, phrase: "" };
    }

    const commuteZip = String(preferences.commuteZip || "").trim();
    const commuteRadiusMiles = Number(preferences.commuteRadiusMiles || 0);
    if (!commuteZip || !commuteRadiusMiles) {
      return { points: 0, phrase: "" };
    }

    const locationHaystack = [
      extraction.locationText,
      extraction.jobMetaText,
      extraction.pageTitle,
      extraction.fullJobText
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    if (/\bmadison,\s*wi\b|\bmadison,\s*wisconsin\b|\bmadison\s+wi\b|\bmadison\s+wisconsin\b/.test(locationHaystack)) {
      return { points: 15, phrase: "city-level hybrid commute boost (Madison, WI)" };
    }

    if (locationHaystack.includes(commuteZip)) {
      return { points: 12, phrase: "commute-friendly hybrid boost" };
    }

    const explicitRadiusPattern = new RegExp(
      "within\\s+" + commuteRadiusMiles + "\\s+miles?\\s+of\\s+" + commuteZip,
      "i"
    );
    if (explicitRadiusPattern.test(locationHaystack)) {
      return { points: 12, phrase: "commute-friendly hybrid boost" };
    }

    const commuteHints = constants.COMMUTE_RADIUS_HINTS || {};
    const zipHints = commuteHints[commuteZip];
    const hasZipHintMatch = Boolean(
      zipHints &&
        Array.isArray(zipHints.locationKeywords) &&
        zipHints.locationKeywords.some((keyword) => locationHaystack.includes(String(keyword || "").toLowerCase()))
    );
    if (hasZipHintMatch) {
      return { points: 12, phrase: "commute-friendly hybrid boost" };
    }

    if (/\bwisconsin\b|\bwi\b/.test(locationHaystack)) {
      return { points: 6, phrase: "state-level hybrid commute boost (Wisconsin)" };
    }

    return { points: 0, phrase: "" };
  }

  function maybeApplyCommutePlaceholder(extraction, scores, matchedSignals) {
    const haystack = String(extraction && extraction.fullJobText ? extraction.fullJobText : "").toLowerCase();

    const commutePhrases = [
      "commuting distance",
      "in office",
      "hybrid",
      "onsite",
      "on-site",
      "travel required",
      "local candidates only",
      "within driving distance",
      "must be local",
      "office-based",
      "three days per week",
      "two days per week",
      "five days per week"
    ];

    const matchedPhrase = commutePhrases.find(phrase => haystack.includes(phrase));
    if (matchedPhrase) {
      recordSignal(matchedSignals, "remoteAuthenticity", { phrase: `Requires commuting: "${matchedPhrase}"`, points: -20 }, false);
    }
  }

  function hasOverloadedRoleScope(extraction) {
    const haystack = [
      extraction.roleTitle,
      extraction.pageTitle,
      extraction.fullJobText
    ]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();

    const disciplines = [
      { name: "ux", phrases: ["ux", "user experience", "product design"] },
      { name: "ui", phrases: ["ui", "visual design", "interface design"] },
      { name: "frontend", phrases: ["frontend", "front-end", "react", "javascript engineer"] },
      { name: "pm", phrases: ["product manager", "roadmap", "project manager"] },
      { name: "seo", phrases: ["seo", "search optimization"] },
      { name: "marketing", phrases: ["marketing", "campaigns", "brand"] },
      { name: "copywriting", phrases: ["copywriting", "content writer", "messaging"] }
    ];

    const hitCount = disciplines.reduce((count, discipline) => {
      const matched = discipline.phrases.some((phrase) => haystack.includes(phrase));
      return matched ? count + 1 : count;
    }, 0);

    return hitCount >= 4;
  }

  function isKnownAtsPath(extraction) {
    const url = String(extraction.url || "");
    return constants.KNOWN_ATS_HOSTS.some((host) => url.includes(host));
  }

  function recordSignal(matchedSignals, categoryName, rule, positive) {
    matchedSignals[categoryName].push({
      phrase: rule.phrase,
      points: rule.points,
      direction: positive ? "positive" : "negative"
    });
  }

  function addFlag(target, matchedSignals, flag, phrase) {
    if (!flag) {
      return;
    }

    target.push(flag);
    if (!matchedSignals.flagTriggers[flag]) {
      matchedSignals.flagTriggers[flag] = [];
    }
    matchedSignals.flagTriggers[flag].push(phrase);
  }

  function computeVerdict(overallScore) {
    if (overallScore >= 85) {
      return "Strong Candidate";
    }
    if (overallScore >= 70) {
      return "Review Manually";
    }
    if (overallScore >= 50) {
      return "Mixed Signals";
    }
    return "Likely Misleading";
  }

  function buildExplanation(extraction, scores, matchedSignals) {
    const explanation = [];

    if (scores.remoteAuthenticity >= 70) {
      explanation.push("Work-model fit looks strong, with signals favoring flexible or remote-friendly arrangements.");
    } else {
      explanation.push("Work-model fit is reduced by onsite/hybrid constraints, travel burden, or tight location restrictions.");
    }

    if (scores.uxRoleQuality >= 70) {
      explanation.push("The role reads like a real UX-focused position with research, systems, or accessibility signals.");
    } else {
      explanation.push("The role scope appears diluted by marketing, engineering, or too many bundled responsibilities.");
    }

    if (scores.trustLegitimacy >= 65) {
      explanation.push("The posting shows several legitimacy markers such as company identity, ATS structure, or clear responsibilities.");
    } else {
      explanation.push("Trust signals are mixed because the posting hides identity, omits salary, or uses recruiter-heavy language.");
    }

    if (scores.applicationQuality >= 65) {
      explanation.push("The application path appears fairly standard and direct.");
    } else {
      explanation.push("The application path may be weaker than ideal due to suspicious forms, weak apply details, or early sensitive requests.");
    }

    if (!extraction.salaryText) {
      explanation.push("No salary text was detected, which reduces transparency for comparison shopping.");
    }

    return explanation.slice(0, 5);
  }

  global.JobEvaluatorScorer = {
    scorePosting
  };
})(globalThis);
