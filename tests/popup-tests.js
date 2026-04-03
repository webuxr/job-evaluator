(function () {
  const popupHooks = window.RemoteUxRealityTestPopupTestHooks;

  const TEST_CASES = [
    {
      name: "Saved jobs are auto-sorted by score descending",
      run: function () {
        const input = [
          makeSavedJob({ id: "a", roleTitle: "Role A", overallScore: 72, savedAt: "2026-04-02T10:00:00.000Z" }),
          makeSavedJob({ id: "b", roleTitle: "Role B", overallScore: 91, savedAt: "2026-04-02T09:00:00.000Z" }),
          makeSavedJob({ id: "c", roleTitle: "Role C", overallScore: 65, savedAt: "2026-04-02T11:00:00.000Z" })
        ];
        const sorted = popupHooks.sortSavedJobs(popupHooks.normalizeSavedJobs(input));
        return [
          expectArrayOrder(sorted.map((job) => job.id), ["b", "a", "c"], "Expected score-descending sort order.")
        ];
      }
    },
    {
      name: "Tie score falls back to savedAt descending",
      run: function () {
        const input = [
          makeSavedJob({ id: "older", roleTitle: "Role Older", overallScore: 88, savedAt: "2026-04-02T09:00:00.000Z" }),
          makeSavedJob({ id: "newer", roleTitle: "Role Newer", overallScore: 88, savedAt: "2026-04-02T10:00:00.000Z" })
        ];
        const sorted = popupHooks.sortSavedJobs(popupHooks.normalizeSavedJobs(input));
        return [
          expectArrayOrder(sorted.map((job) => job.id), ["newer", "older"], "Expected newer saved item first for equal scores.")
        ];
      }
    },
    {
      name: "Star toggle updates selected item and preserves score ordering",
      run: function () {
        const input = [
          makeSavedJob({ id: "top", roleTitle: "Top Role", overallScore: 95, starred: false }),
          makeSavedJob({ id: "mid", roleTitle: "Mid Role", overallScore: 82, starred: false }),
          makeSavedJob({ id: "low", roleTitle: "Low Role", overallScore: 61, starred: false })
        ];
        const toggled = popupHooks.applyStarToggle(input, "mid");
        const mid = toggled.find((job) => job.id === "mid");
        return [
          expectBoolean(Boolean(mid && mid.starred), true, "Expected selected job to be starred after toggle."),
          expectArrayOrder(toggled.map((job) => job.id), ["top", "mid", "low"], "Expected score sorting to remain unchanged after star toggle.")
        ];
      }
    },
    {
      name: "Star toggle is reversible",
      run: function () {
        const input = [
          makeSavedJob({ id: "job-1", roleTitle: "Role One", overallScore: 77, starred: true }),
          makeSavedJob({ id: "job-2", roleTitle: "Role Two", overallScore: 60, starred: false })
        ];
        const toggled = popupHooks.applyStarToggle(input, "job-1");
        const target = toggled.find((job) => job.id === "job-1");
        return [
          expectBoolean(Boolean(target && target.starred), false, "Expected second toggle to unstar the job.")
        ];
      }
    }
  ];

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("runTestsButton").addEventListener("click", runTests);
    runTests();
  });

  function runTests() {
    const root = document.getElementById("resultsRoot");
    root.innerHTML = "";

    if (!popupHooks || typeof popupHooks.sortSavedJobs !== "function") {
      renderSummary(0, TEST_CASES.length, 0, TEST_CASES.length);
      root.appendChild(renderHarnessFailure());
      return;
    }

    let totalAssertions = 0;
    let passedAssertions = 0;
    let passedCases = 0;

    TEST_CASES.forEach(function (testCase) {
      const assertions = toAssertions(testCase.run());
      const casePassed = assertions.every(function (item) {
        return item.pass;
      });

      totalAssertions += assertions.length;
      passedAssertions += assertions.filter(function (item) {
        return item.pass;
      }).length;
      passedCases += casePassed ? 1 : 0;

      root.appendChild(renderCase(testCase, assertions, casePassed));
    });

    renderSummary(passedCases, TEST_CASES.length, passedAssertions, totalAssertions);
  }

  function toAssertions(value) {
    return Array.isArray(value) ? value : [value];
  }

  function makeSavedJob(overrides) {
    return Object.assign(
      {
        id: "job-default",
        savedAt: "2026-04-02T00:00:00.000Z",
        url: "https://example.com/job/default",
        roleTitle: "Unknown role",
        company: "Unknown company",
        overallScore: 0,
        verdict: "Unknown",
        payload: {},
        starred: false
      },
      overrides || {}
    );
  }

  function expectArrayOrder(actual, expected, message) {
    const actualText = JSON.stringify(actual || []);
    const expectedText = JSON.stringify(expected || []);
    return {
      pass: actualText === expectedText,
      message: message + " Expected " + expectedText + " and got " + actualText + "."
    };
  }

  function expectBoolean(actual, expected, message) {
    return {
      pass: Boolean(actual) === Boolean(expected),
      message: message + " Expected " + String(expected) + " and got " + String(actual) + "."
    };
  }

  function renderSummary(passedCases, totalCases, passedAssertions, totalAssertions) {
    const card = document.getElementById("summaryCard");
    const allPassed = passedCases === totalCases;

    card.innerHTML =
      "<div>" +
      "<strong>" + passedCases + " / " + totalCases + " cases passed</strong>" +
      '<p class="muted">' + passedAssertions + " / " + totalAssertions + " assertions passed.</p>" +
      "</div>" +
      '<span class="pill ' + (allPassed ? "pill--pass" : "pill--fail") + '">' +
      (allPassed ? "Passing" : "Needs Attention") +
      "</span>";
  }

  function renderCase(testCase, assertions, casePassed) {
    const section = document.createElement("section");
    section.className = "card";

    const assertionMarkup = assertions
      .map(function (item) {
        return (
          '<li class="' + (item.pass ? "assertion-pass" : "assertion-fail") + '">' +
          (item.pass ? "PASS" : "FAIL") +
          " - " +
          escapeHtml(item.message) +
          "</li>"
        );
      })
      .join("");

    section.innerHTML =
      '<div class="case-header">' +
      "<div>" +
      "<strong>" + escapeHtml(testCase.name) + "</strong>" +
      "</div>" +
      '<span class="pill ' + (casePassed ? "pill--pass" : "pill--fail") + '">' +
      (casePassed ? "Pass" : "Fail") +
      "</span>" +
      "</div>" +
      '<ul class="assertions">' + assertionMarkup + "</ul>";

    return section;
  }

  function renderHarnessFailure() {
    const section = document.createElement("section");
    section.className = "card";
    section.innerHTML =
      "<strong>Test harness unavailable</strong>" +
      '<p class="muted">Popup test hooks were not loaded. Ensure <code>popup.js</code> is included before this file.</p>';
    return section;
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
