const INJECTION_FILES = [
  "src/constants.js",
  "src/utils.js",
  "src/extractors.js",
  "src/content.js"
];

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== "ANALYZE_ACTIVE_TAB") {
    return;
  }

  analyzeActiveTab(message.tabId)
    .then((payload) => sendResponse(payload))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : "Failed to analyze the active page."
      });
    });

  return true;
});

async function analyzeActiveTab(optionalTabId) {
  const tab = optionalTabId ? await getTabById(optionalTabId) : await getActiveTab();
  if (!tab || !tab.id) {
    throw new Error("No active tab was available.");
  }

  if (!/^https?:/i.test(tab.url || "")) {
    throw new Error("This page cannot be analyzed. Open a standard job posting tab first.");
  }

  const alreadyReady = await pingContentScript(tab.id);
  if (!alreadyReady) {
    await injectAnalyzer(tab.id);
  }

  const response = await sendMessage(tab.id, { type: "ANALYZE_JOB_PAGE" });
  if (!response || !response.ok) {
    const message = response && response.error ? response.error : "The page did not return analyzable job content.";
    throw new Error(message);
  }

  return response;
}

function getActiveTab() {
  return new Promise((resolve, reject) => {
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

function getTabById(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab);
    });
  });
}

function pingContentScript(tabId) {
  return sendMessage(tabId, { type: "PING_REMOTE_UX" })
    .then((response) => Boolean(response && response.ok))
    .catch(() => false);
}

function injectAnalyzer(tabId) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: INJECTION_FILES
      },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      }
    );
  });
}

function sendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }
      resolve(response);
    });
  });
}
