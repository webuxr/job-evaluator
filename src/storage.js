(function (global) {
  const constants = global.JobEvaluatorConstants;

  function getSavedJobs() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([constants.STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const items = Array.isArray(result[constants.STORAGE_KEY])
          ? result[constants.STORAGE_KEY]
          : [];

        resolve(items);
      });
    });
  }

  function getUserPreferences() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([constants.PREFERENCES_STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const defaults = constants.DEFAULT_USER_PREFERENCES || {};
        const stored = result[constants.PREFERENCES_STORAGE_KEY];
        const merged = Object.assign({}, defaults, isObject(stored) ? stored : {});
        merged.educationMatchKeywords = normalizeEducationKeywords(merged.educationMatchKeywords, defaults.educationMatchKeywords);
        resolve(merged);
      });
    });
  }

  function setUserPreferences(preferences) {
    const defaults = constants.DEFAULT_USER_PREFERENCES || {};
    const merged = Object.assign({}, defaults, isObject(preferences) ? preferences : {});
    merged.educationMatchKeywords = normalizeEducationKeywords(merged.educationMatchKeywords, defaults.educationMatchKeywords);

    return new Promise((resolve, reject) => {
      chrome.storage.local.set(
        {
          [constants.PREFERENCES_STORAGE_KEY]: merged
        },
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(merged);
        }
      );
    });
  }

  async function saveJob(result) {
    const savedJobs = await getSavedJobs();
    const id = result.id || buildJobId(result.url);
    const payload = {
      id,
      savedAt: result.savedAt || new Date().toISOString(),
      url: result.url || "",
      roleTitle: result.roleTitle || "Unknown",
      company: result.company || "Unknown",
      overallScore: result.overallScore || 0,
      verdict: result.verdict || "Unknown",
      payload: result
    };

    const filtered = savedJobs.filter((job) => job.url !== payload.url && job.id !== payload.id);
    filtered.unshift(payload);

    const trimmed = filtered.slice(0, constants.MAX_SAVED_JOBS);
    await writeSavedJobs(trimmed);
    return payload;
  }

  async function deleteSavedJob(id) {
    const savedJobs = await getSavedJobs();
    const filtered = savedJobs.filter((job) => job.id !== id);
    await writeSavedJobs(filtered);
    return filtered;
  }

  function setSavedJobs(items) {
    return writeSavedJobs(Array.isArray(items) ? items : []);
  }

  function writeSavedJobs(items) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(
        {
          [constants.STORAGE_KEY]: items
        },
        () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(items);
        }
      );
    });
  }

  function buildJobId(url) {
    const source = String(url || "job-" + Date.now());
    return source.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
  }

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeEducationKeywords(value, fallback) {
    const base = Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];
    const cleaned = base
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    return Array.from(new Set(cleaned));
  }

  global.JobEvaluatorStorage = {
    deleteSavedJob,
    getSavedJobs,
    getUserPreferences,
    setSavedJobs,
    setUserPreferences,
    saveJob
  };
})(globalThis);
