(function () {
  const constants = JobEvaluatorConstants;
  const storage = JobEvaluatorStorage;

  const FIELD_IDS = [
    "penalizeHybridHeavily",
    "preferAccessibilityRoles",
    "preferProductUXOverMarketingUX",
    "preferRemoteRoles",
    "preferRemoteOnly",
    "enableCommutePlaceholderLogic",
    "commuteZip",
    "commuteRadiusMiles",
    "contactEmail",
    "targetSalaryText",
    "educationMatchKeywords"
  ];

  document.addEventListener("DOMContentLoaded", () => {
    initializeExtensionSettingsLink();
    bindEvents();
    loadPreferences();
  });

  function bindEvents() {
    document.getElementById("saveButton").addEventListener("click", savePreferences);
    document.getElementById("resetButton").addEventListener("click", resetPreferences);
  }

  function initializeExtensionSettingsLink() {
    const link = document.getElementById("openExtensionSettings");
    if (!link) {
      return;
    }

    const settingsUrl = "chrome://extensions/?id=" + chrome.runtime.id;
    link.href = settingsUrl;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      focusOrOpenExtensionSettings(settingsUrl);
    });
  }

  function focusOrOpenExtensionSettings(settingsUrl) {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError || !Array.isArray(tabs)) {
        chrome.tabs.create({ url: settingsUrl });
        return;
      }

      const match = tabs.find((tab) => {
        const tabUrl = String(tab.url || tab.pendingUrl || "");
        return tabUrl.startsWith("chrome://extensions");
      });

      if (!match || typeof match.id !== "number") {
        chrome.tabs.create({ url: settingsUrl });
        return;
      }

      chrome.tabs.update(match.id, { active: true }, () => {
        if (chrome.runtime.lastError) {
          chrome.tabs.create({ url: settingsUrl });
          return;
        }

        if (typeof match.windowId === "number") {
          chrome.windows.update(match.windowId, { focused: true });
        }
      });
    });
  }

  async function loadPreferences() {
    try {
      const preferences = await storage.getUserPreferences();
      applyFormValues(preferences);
      setStatus("Preferences loaded.");
    } catch (error) {
      setStatus("Could not load preferences.");
    }
  }

  async function savePreferences() {
    try {
      const preferences = readFormValues();
      await storage.setUserPreferences(preferences);
      Object.assign(constants.USER_PREFERENCES, preferences);
      setStatus("Preferences saved.");
    } catch (error) {
      setStatus("Could not save preferences.");
    }
  }

  async function resetPreferences() {
    const defaults = Object.assign({}, constants.DEFAULT_USER_PREFERENCES);
    applyFormValues(defaults);

    try {
      await storage.setUserPreferences(defaults);
      Object.assign(constants.USER_PREFERENCES, defaults);
      setStatus("Preferences reset to defaults.");
    } catch (error) {
      setStatus("Could not reset preferences.");
    }
  }

  function applyFormValues(preferences) {
    const values = Object.assign({}, constants.DEFAULT_USER_PREFERENCES, preferences || {});

    document.getElementById("penalizeHybridHeavily").checked = Boolean(values.penalizeHybridHeavily);
    document.getElementById("preferAccessibilityRoles").checked = Boolean(values.preferAccessibilityRoles);
    document.getElementById("preferProductUXOverMarketingUX").checked = Boolean(values.preferProductUXOverMarketingUX);
    document.getElementById("preferRemoteRoles").checked = Boolean(values.preferRemoteRoles);
    document.getElementById("preferRemoteOnly").checked = Boolean(values.preferRemoteOnly);
    document.getElementById("enableCommutePlaceholderLogic").checked = Boolean(values.enableCommutePlaceholderLogic);
    document.getElementById("commuteZip").value = String(values.commuteZip || "");
    document.getElementById("commuteRadiusMiles").value = String(values.commuteRadiusMiles || 0);
    document.getElementById("contactEmail").value = String(values.contactEmail || "");
    document.getElementById("targetSalaryText").value = String(values.targetSalaryText || "");
    document.getElementById("educationMatchKeywords").value = toKeywordText(values.educationMatchKeywords);
  }

  function readFormValues() {
    const preferences = {
      penalizeHybridHeavily: document.getElementById("penalizeHybridHeavily").checked,
      preferAccessibilityRoles: document.getElementById("preferAccessibilityRoles").checked,
      preferProductUXOverMarketingUX: document.getElementById("preferProductUXOverMarketingUX").checked,
      preferRemoteRoles: document.getElementById("preferRemoteRoles").checked,
      preferRemoteOnly: document.getElementById("preferRemoteOnly").checked,
      enableCommutePlaceholderLogic: document.getElementById("enableCommutePlaceholderLogic").checked,
      commuteZip: String(document.getElementById("commuteZip").value || "").trim(),
      commuteRadiusMiles: normalizeNumber(document.getElementById("commuteRadiusMiles").value, 0),
      contactEmail: String(document.getElementById("contactEmail").value || "").trim(),
      targetSalaryText: String(document.getElementById("targetSalaryText").value || "").trim(),
      educationMatchKeywords: parseKeywordText(document.getElementById("educationMatchKeywords").value || "")
    };

    return Object.assign({}, constants.DEFAULT_USER_PREFERENCES, preferences);
  }

  function parseKeywordText(text) {
    const items = String(text || "")
      .split(/[\n,]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
    return Array.from(new Set(items));
  }

  function toKeywordText(items) {
    return (Array.isArray(items) ? items : []).join("\n");
  }

  function normalizeNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function setStatus(message) {
    document.getElementById("statusMessage").textContent = String(message || "");
  }

  window.JobEvaluatorOptions = {
    FIELD_IDS
  };
})();
