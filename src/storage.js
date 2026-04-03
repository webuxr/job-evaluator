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

  global.JobEvaluatorStorage = {
    deleteSavedJob,
    getSavedJobs,
    setSavedJobs,
    saveJob
  };
})(globalThis);
