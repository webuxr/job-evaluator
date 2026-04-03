(function () {
  const appName = JobEvaluatorConstants.APP_NAME;
  const utils = JobEvaluatorUtils;
  const scorer = JobEvaluatorScorer;
  const storage = JobEvaluatorStorage;

  let latestAnalysis = null;
  let savedJobsState = [];

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    loadSavedJobs();
    analyzeCurrentPage();
  });

  function bindEvents() {
    document.getElementById("analyzeButton").addEventListener("click", analyzeCurrentPage);
    document.getElementById("copyButton").addEventListener("click", copySummary);
    document.getElementById("copyDescriptionButton").addEventListener("click", copyJobDescription);
    document.getElementById("saveButton").addEventListener("click", saveCurrentResult);
    document.getElementById("savedJobsList").addEventListener("click", handleSavedListClick);
  }

  async function analyzeCurrentPage() {
    setStatus("Analyzing the current page...", "loading");

    try {
      const tab = await getActiveTab();
      const response = await sendRuntimeMessage(
        tab && tab.id
          ? {
              type: "ANALYZE_ACTIVE_TAB",
              tabId: tab.id
            }
          : {
              type: "ANALYZE_ACTIVE_TAB"
            }
      );

      if (!response || !response.ok || !response.data) {
        throw new Error(
          response && response.error
            ? response.error
            : "This page did not look like a readable job posting."
        );
      }

      const extraction = normalizeExtraction(response.data);
      if (!extraction.fullJobText) {
        throw new Error("No visible job description text was detected.");
      }

      const scored = scorer.scorePosting(extraction);
      latestAnalysis = Object.assign({}, extraction, scored);
      renderAnalysis(latestAnalysis);
      setStatus("Analysis complete.", "success");
    } catch (error) {
      latestAnalysis = null;
      showError(error && error.message ? error.message : "Unable to analyze this page.");
    }
  }

  function normalizeExtraction(extraction) {
    return {
      url: extraction.url || "",
      pageTitle: extraction.pageTitle || "",
      roleTitle: extraction.roleTitle || "Unknown",
      company: extraction.company || "Unknown",
      locationText: extraction.locationText || "",
      jobMetaText: extraction.jobMetaText || "",
      salaryText: extraction.salaryText || "",
      applyUrl: extraction.applyUrl || "",
      applyText: extraction.applyText || "",
      fullJobText: extraction.fullJobText || "",
      hasSimplifyJobsShadowRoot: Boolean(extraction.hasSimplifyJobsShadowRoot),
      reasoningSnippets: Array.isArray(extraction.reasoningSnippets) ? extraction.reasoningSnippets : [],
      extractorUsed: extraction.extractorUsed || "generic"
    };
  }

  function renderAnalysis(result) {
    const savedMatch = findSavedMatch(result.url);

    document.getElementById("resultCard").classList.remove("hidden");
    document.getElementById("roleTitle").textContent = result.roleTitle || "Unknown role";
    document.getElementById("companyLine").textContent = result.company || "Unknown company";
    renderJobPostUrl(result.url || "");
    document.getElementById("overallScore").textContent = String(result.overallScore);
    renderOverallScoreTone(result.overallScore);
    document.getElementById("locationText").textContent = result.locationText || "—";
    document.getElementById("salaryText").textContent = result.salaryText || "—";
    renderMetaChips(result.jobMetaText);

    renderVerdictBadge(result.verdict);

    document.getElementById("remoteAuthenticityScore").textContent = result.subscores.remoteAuthenticity;
    document.getElementById("uxRoleQualityScore").textContent = result.subscores.uxRoleQuality;
    document.getElementById("trustLegitimacyScore").textContent = result.subscores.trustLegitimacy;
    document.getElementById("applicationQualityScore").textContent = result.subscores.applicationQuality;

    renderList("redFlagsList", result.redFlags, "No major red flags detected.", "flag-list flag-list--red");
    renderList("greenFlagsList", result.greenFlags, "No strong positive flags detected.", "flag-list flag-list--green");
    renderList("explanationList", result.explanation, "No explanation available.", "explanation-list");
    renderDifferences(result, savedMatch);
    updateSaveButtonState(savedMatch);
    renderSavedJobs(savedJobsState);
  }

  function renderVerdictBadge(verdict) {
    const badge = document.getElementById("verdictBadge");
    badge.textContent = verdict || "Unknown";
    badge.className = "badge";

    if (/strong candidate/i.test(verdict)) {
      badge.classList.add("badge--good");
      return;
    }

    if (/review manually|mixed signals/i.test(verdict)) {
      badge.classList.add("badge--mixed");
      return;
    }

    badge.classList.add("badge--bad");
  }

  function renderOverallScoreTone(score) {
    const scorePill = document.querySelector(".score-pill");
    scorePill.className = "score-pill";
    scorePill.classList.add(getScoreToneClass(score, "score-pill"));
  }

  function renderList(elementId, items, emptyMessage, className) {
    const list = document.getElementById(elementId);
    list.className = className;
    list.innerHTML = "";

    const values = Array.isArray(items) && items.length ? items : [emptyMessage];
    values.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      list.appendChild(li);
    });
  }

  function renderDifferences(result, savedMatch) {
    const differencesBlock = document.getElementById("differencesBlock");

    if (!savedMatch || !savedMatch.payload) {
      differencesBlock.classList.add("hidden");
      document.getElementById("differencesList").innerHTML = "";
      return;
    }

    const previous = savedMatch.payload;
    const differences = [];
    const scoreDelta = result.overallScore - Number(savedMatch.overallScore || 0);

    if (scoreDelta > 0) {
      differences.push("Overall score increased by " + scoreDelta + " point" + (scoreDelta === 1 ? "" : "s") + ".");
    } else if (scoreDelta < 0) {
      const absoluteDelta = Math.abs(scoreDelta);
      differences.push("Overall score decreased by " + absoluteDelta + " point" + (absoluteDelta === 1 ? "" : "s") + ".");
    }

    addDifference(differences, "Verdict", previous.verdict, result.verdict);
    addDifference(differences, "Role title", previous.roleTitle, result.roleTitle);
    addDifference(differences, "Company", previous.company, result.company);
    addDifference(differences, "Location", previous.locationText, result.locationText);
    addDifference(differences, "Salary", previous.salaryText, result.salaryText);
    addDifference(differences, "Extractor", previous.extractorUsed, result.extractorUsed);
    addDifference(differences, "Remote score", previous.subscores && previous.subscores.remoteAuthenticity, result.subscores.remoteAuthenticity);
    addDifference(differences, "UX score", previous.subscores && previous.subscores.uxRoleQuality, result.subscores.uxRoleQuality);
    addDifference(differences, "Trust score", previous.subscores && previous.subscores.trustLegitimacy, result.subscores.trustLegitimacy);
    addDifference(differences, "Application score", previous.subscores && previous.subscores.applicationQuality, result.subscores.applicationQuality);
    addArrayDifferences(differences, "Red flags", previous.redFlags, result.redFlags);
    addArrayDifferences(differences, "Green flags", previous.greenFlags, result.greenFlags);

    if (!differences.length) {
      differencesBlock.classList.add("hidden");
      document.getElementById("differencesList").innerHTML = "";
      return;
    }

    differencesBlock.classList.remove("hidden");
    renderList("differencesList", differences, "", "explanation-list");
  }

  function renderMetaChips(jobMetaText) {
    const container = document.getElementById("jobMetaList");
    container.innerHTML = "";

    const chips = String(jobMetaText || "")
      .split(/\s*[•·|]\s*/g)
      .map((part) => part.trim())
      .filter(Boolean);

    if (!chips.length) {
      const emptyItem = document.createElement("li");
      emptyItem.textContent = "—";
      container.appendChild(emptyItem);
      return;
    }

    chips.forEach((chipText) => {
      const item = document.createElement("li");
      item.textContent = chipText;
      container.appendChild(item);
    });
  }

  function renderJobPostUrl(rawUrl) {
    const link = document.getElementById("jobPostUrlLink");
    const empty = document.getElementById("jobPostUrlEmpty");
    if (!link || !empty) {
      return;
    }

    if (!rawUrl) {
      link.classList.add("hidden");
      link.removeAttribute("href");
      link.textContent = "";
      empty.classList.remove("hidden");
      empty.textContent = "—";
      return;
    }

    link.classList.remove("hidden");
    link.href = rawUrl;
    link.textContent = rawUrl;
    empty.classList.add("hidden");
  }

  async function copySummary() {
    if (!latestAnalysis) {
      setStatus("Analyze a page before copying a summary.");
      return;
    }

    const summary = buildSummary(latestAnalysis);

    try {
      await navigator.clipboard.writeText(summary);
      setStatus("Summary copied to clipboard.", "success");
    } catch (error) {
      setStatus("Clipboard copy failed. Chrome may require an active popup interaction.", "error");
    }
  }

  async function copyJobDescription() {
    if (!latestAnalysis || !latestAnalysis.fullJobText) {
      setStatus("Analyze a page before copying the job description.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(latestAnalysis.fullJobText);
      setStatus("Job description copied to clipboard.", "success");
    } catch (error) {
      setStatus("Job description copy failed. Chrome may require an active popup interaction.", "error");
    }
  }

  async function saveCurrentResult() {
    if (!latestAnalysis) {
      setStatus("Analyze a page before saving a result.");
      return;
    }

    if (findSavedMatch(latestAnalysis.url)) {
      setStatus("This job is already saved.", "error");
      return;
    }

    try {
      await storage.saveJob(latestAnalysis);
      setStatus("Result saved.", "success");
      await loadSavedJobs();
    } catch (error) {
      setStatus(error && error.message ? error.message : "Saving failed.", "error");
    }
  }

  async function loadSavedJobs() {
    try {
      const items = await storage.getSavedJobs();
      savedJobsState = sortSavedJobs(normalizeSavedJobs(items));
      renderSavedJobs(savedJobsState);
      refreshSavedMatchUi();
    } catch (error) {
      setStatus("Saved jobs could not be loaded.", "error");
    }
  }

  function renderSavedJobs(items) {
    const list = document.getElementById("savedJobsList");
    const empty = document.getElementById("savedJobsEmpty");
    list.innerHTML = "";

    if (!items.length) {
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");

    items.forEach((item) => {
      const li = document.createElement("li");
      li.className = "saved-item";
      if (latestAnalysis && item.url === latestAnalysis.url) {
        li.classList.add("saved-item--current");
      }
      li.setAttribute("data-job-id", item.id);
      const safeUrl = utils.escapeHtml(item.url || "#");
      const extractorUsed = utils.escapeHtml(
        (item.payload && item.payload.extractorUsed) || "generic"
      );
      const savedScoreClass = getScoreToneClass(item.overallScore || 0, "saved-score");
      const starred = Boolean(item.starred);
      li.innerHTML =
        '<div class="saved-item__meta">' +
        '<div class="saved-item__top">' +
        '<a class="saved-job-link" href="' + safeUrl + '" target="_blank" rel="noreferrer">' +
        utils.escapeHtml(item.roleTitle || "Unknown role") +
        "</a>" +
        '<span class="saved-score ' + savedScoreClass + '">' + utils.escapeHtml(String(item.overallScore || 0)) + "/100</span>" +
        "</div>" +
        "<span>" + utils.escapeHtml(item.company || "Unknown company") + "</span>" +
        '<span class="muted">' + utils.escapeHtml(utils.formatDateTime(item.savedAt)) + "</span>" +
        '<div class="saved-item__bottom-row">' +
        '<span class="muted">' + utils.escapeHtml(item.verdict || "Unknown") + "</span>" +
        '<span class="muted saved-extractor">Extractor: ' + extractorUsed + "</span>" +
        '<button class="delete-link" data-delete-id="' + utils.escapeHtml(item.id) + '" type="button">Delete</button>' +
        "</div>" +
        "</div>" +
        '<div class="saved-item__actions">' +
        '<button class="star-toggle' + (starred ? " star-toggle--active" : "") + '" type="button" data-star-id="' + utils.escapeHtml(item.id) + '" aria-label="' + (starred ? "Unstar saved result" : "Star saved result") + '" title="' + (starred ? "Unstar" : "Star") + '">' + (starred ? "★" : "☆") + "</button>" +
        "</div>";
      list.appendChild(li);
    });
  }

  async function handleSavedListClick(event) {
    const starId = event.target && event.target.getAttribute("data-star-id");
    if (starId) {
      await toggleSavedStar(starId);
      return;
    }

    const deleteId = event.target && event.target.getAttribute("data-delete-id");
    if (!deleteId) {
      return;
    }

    try {
      await storage.deleteSavedJob(deleteId);
      setStatus("Saved result deleted.", "success");
      await loadSavedJobs();
    } catch (error) {
      setStatus("Delete failed.", "error");
    }
  }

  async function toggleSavedStar(jobId) {
    const previousState = savedJobsState.slice();
    savedJobsState = applyStarToggle(savedJobsState, jobId);
    renderSavedJobs(savedJobsState);
    refreshSavedMatchUi();

    try {
      await storage.setSavedJobs(savedJobsState);
      setStatus("Saved result updated.", "success");
    } catch (error) {
      savedJobsState = previousState;
      renderSavedJobs(savedJobsState);
      refreshSavedMatchUi();
      setStatus("Could not update the saved result.", "error");
    }
  }

  function normalizeSavedJobs(items) {
    return (Array.isArray(items) ? items : []).map((item) => {
      const score = Number(item && item.overallScore);
      return Object.assign({}, item, {
        overallScore: Number.isFinite(score) ? score : 0,
        starred: Boolean(item && item.starred)
      });
    });
  }

  function sortSavedJobs(items) {
    return items.slice().sort((left, right) => {
      const scoreDelta = Number(right.overallScore || 0) - Number(left.overallScore || 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      const leftTime = Date.parse(left.savedAt || "") || 0;
      const rightTime = Date.parse(right.savedAt || "") || 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }

      return String(left.roleTitle || "").localeCompare(String(right.roleTitle || ""));
    });
  }

  function applyStarToggle(items, jobId) {
    const toggled = (Array.isArray(items) ? items : []).map((job) => {
      if (job.id !== jobId) {
        return job;
      }
      return Object.assign({}, job, { starred: !job.starred });
    });

    return sortSavedJobs(normalizeSavedJobs(toggled));
  }

  function buildSummary(result) {
    return [
      appName,
      "Role: " + (result.roleTitle || "Unknown"),
      "Company: " + (result.company || "Unknown"),
      "URL: " + (result.url || ""),
      "",
      "Overall Score: " + result.overallScore + "/100",
      "Verdict: " + (result.verdict || "Unknown"),
      "",
      "Subscores",
      "- Work Model Fit: " + result.subscores.remoteAuthenticity,
      "- UX Role Quality: " + result.subscores.uxRoleQuality,
      "- Trust / Legitimacy: " + result.subscores.trustLegitimacy,
      "- Application Quality: " + result.subscores.applicationQuality,
      "",
      "Red Flags",
      ...(result.redFlags.length ? result.redFlags.map((item) => "- " + item) : ["- None"]),
      "",
      "Green Flags",
      ...(result.greenFlags.length ? result.greenFlags.map((item) => "- " + item) : ["- None"]),
      "",
      "Why",
      ...(result.explanation.length ? result.explanation.map((item) => "- " + item) : ["- No explanation available"])
    ].join("\n");
  }

  function findSavedMatch(url) {
    if (!url) {
      return null;
    }

    return savedJobsState.find((job) => job.url === url) || null;
  }

  function updateSaveButtonState(savedMatch) {
    const saveButton = document.getElementById("saveButton");
    if (!saveButton) {
      return;
    }

    if (savedMatch) {
      saveButton.disabled = true;
      saveButton.textContent = "Already Saved";
      saveButton.title = "This job is already in Saved Results";
      return;
    }

    saveButton.disabled = false;
    saveButton.textContent = "Save Result";
    saveButton.title = "";
  }

  function refreshSavedMatchUi() {
    const savedMatch = findSavedMatch(latestAnalysis && latestAnalysis.url);
    updateSaveButtonState(savedMatch);

    if (latestAnalysis) {
      renderDifferences(latestAnalysis, savedMatch);
    }
  }

  function addDifference(differences, label, previousValue, currentValue) {
    const previousText = normalizeDiffValue(previousValue);
    const currentText = normalizeDiffValue(currentValue);

    if (previousText === currentText) {
      return;
    }

    differences.push(label + ': "' + previousText + '" -> "' + currentText + '"');
  }

  function addArrayDifferences(differences, label, previousItems, currentItems) {
    const previous = Array.isArray(previousItems) ? previousItems : [];
    const current = Array.isArray(currentItems) ? currentItems : [];
    const added = current.filter((item) => !previous.includes(item));
    const removed = previous.filter((item) => !current.includes(item));

    if (added.length) {
      differences.push(label + " added: " + added.join(", "));
    }

    if (removed.length) {
      differences.push(label + " removed: " + removed.join(", "));
    }
  }

  function normalizeDiffValue(value) {
    if (value === null || value === undefined || value === "") {
      return "—";
    }

    return String(value);
  }

  function getScoreToneClass(score, baseClass) {
    if (score >= 90) {
      return baseClass + "--green";
    }

    if (score >= 70) {
      return baseClass + "--orange";
    }

    if (score >= 60) {
      return baseClass + "--yellow";
    }

    return baseClass + "--red";
  }

  function showError(message) {
    document.getElementById("resultCard").classList.add("hidden");
    setStatus(message || "Unable to analyze this page.", "error");
  }

  function setStatus(message, state) {
    document.getElementById("statusMessage").textContent = message;
    const dot = document.getElementById("statusDot");
    dot.className = "status-dot";

    if (state === "success") {
      dot.classList.add("status-dot--success");
      return;
    }

    if (state === "error") {
      dot.classList.add("status-dot--error");
      return;
    }

    if (state === "loading") {
      dot.classList.add("status-dot--loading");
      return;
    }

    dot.classList.add("status-dot--idle");
  }

  function getActiveTab() {
    return new Promise((resolve) => {
      const queryCandidates = [
        { active: true, currentWindow: true },
        { active: true, lastFocusedWindow: true },
        { active: true }
      ];

      function runQuery(index) {
        if (index >= queryCandidates.length) {
          resolve(null);
          return;
        }

        chrome.tabs.query(queryCandidates[index], (tabs) => {
          if (chrome.runtime.lastError) {
            runQuery(index + 1);
            return;
          }

          if (tabs && tabs[0]) {
            resolve(tabs[0]);
            return;
          }

          runQuery(index + 1);
        });
      }

      runQuery(0);
    });
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    });
  }

  if (typeof window !== "undefined") {
    window.JobEvaluatorPopupTestHooks = {
      applyStarToggle,
      normalizeSavedJobs,
      sortSavedJobs
    };
  }
})();
