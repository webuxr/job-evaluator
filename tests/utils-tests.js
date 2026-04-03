(function () {
  const utils = window.RemoteUxRealityTestUtils;

  const TEST_CASES = [
    {
      name: "US street address is reduced to city/state/zip",
      input: "2224 Pleasant View Road, Middleton, WI 53562",
      expected: "Middleton, WI 53562"
    },
    {
      name: "Non-US address preserves country",
      input: "10 Downing Street, London, SW1A 2AA, United Kingdom",
      expected: "London, SW1A 2AA, United Kingdom"
    },
    {
      name: "Remote/hybrid location labels are preserved",
      input: "Hybrid in United States",
      expected: "Hybrid in United States"
    }
  ];

  document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("runTestsButton").addEventListener("click", runTests);
    runTests();
  });

  function runTests() {
    const root = document.getElementById("resultsRoot");
    root.innerHTML = "";

    let totalAssertions = 0;
    let passedAssertions = 0;
    let passedCases = 0;

    TEST_CASES.forEach(function (testCase) {
      const actual = utils.cleanLocationText(testCase.input);
      const assertion = {
        pass: actual === testCase.expected,
        message: 'Expected "' + testCase.expected + '" and got "' + actual + '".'
      };
      const casePassed = assertion.pass;

      totalAssertions += 1;
      passedAssertions += casePassed ? 1 : 0;
      passedCases += casePassed ? 1 : 0;

      root.appendChild(renderCase(testCase, assertion, casePassed));
    });

    renderSummary(passedCases, TEST_CASES.length, passedAssertions, totalAssertions);
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

  function renderCase(testCase, assertion, casePassed) {
    const section = document.createElement("section");
    section.className = "card";

    section.innerHTML =
      '<div class="case-header">' +
      "<div>" +
      "<strong>" + escapeHtml(testCase.name) + "</strong>" +
      "</div>" +
      '<span class="pill ' + (casePassed ? "pill--pass" : "pill--fail") + '">' +
      (casePassed ? "Pass" : "Fail") +
      "</span>" +
      "</div>" +
      '<ul class="assertions">' +
      '<li class="' + (assertion.pass ? "assertion-pass" : "assertion-fail") + '">' +
      (assertion.pass ? "PASS" : "FAIL") +
      " - " +
      escapeHtml(assertion.message) +
      "</li>" +
      "</ul>";

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
