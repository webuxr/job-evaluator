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
      try {
        const extractors = global.RemoteUxRealityTestExtractors;
        if (!extractors || typeof extractors.extractJobPosting !== "function") {
          sendResponse({
            ok: false,
            error: "Extraction system was not available on this page."
          });
          return;
        }

        const result = extractors.extractJobPosting();
        if (!result.fullJobText) {
          sendResponse({
            ok: false,
            error: "No visible job text was detected on this page.",
            data: result
          });
          return;
        }

        sendResponse({ ok: true, data: result });
      } catch (error) {
        sendResponse({
          ok: false,
          error: error && error.message ? error.message : "Unknown extraction failure."
        });
      }
    }
  });
})(globalThis);
