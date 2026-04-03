(function () {
  const scorer = window.JobEvaluatorScorer;
  const constants = window.JobEvaluatorConstants;
  Object.assign(constants.USER_PREFERENCES, {
    commuteZip: "53925",
    commuteRadiusMiles: 50,
    enableCommutePlaceholderLogic: true
  });

  const FIXTURES = {
    linkedin: `Senior Product Designer, Remote
Northstar Health
United States (Remote)
$135,000 - $165,000 per year

Northstar Health is a remote-first digital care platform helping patients access specialty support from anywhere.

We are hiring a Senior Product Designer to join our distributed team. This is a fully remote role with no travel required.

What you'll do
- Lead user research and usability testing for core care journeys
- Create wireframes, prototypes, and polished interaction design flows
- Partner cross-functionally with product team and engineering
- Improve our design system and accessibility posture across patient-facing experiences
- Translate insights into information architecture and UX strategy

Qualifications
- Strong product design or UX background
- Experience with accessibility and WCAG-informed design
- Comfortable collaborating asynchronously across time zones

Apply through our careers site to continue the Greenhouse application flow.`,

    greenhouse: `Product Designer
Signal Harbor
Remote within the United States

Signal Harbor builds workflow software for customer success teams.

This role is remote-first, but candidates must be located in the United States and should expect occasional onsite planning sessions twice a year.

Responsibilities
- Run user research for new dashboard concepts
- Build wireframes and prototypes
- Collaborate cross-functionally with the product team
- Support our design system

Compensation
$110,000 - $130,000 annually

Application
This role is posted on Greenhouse and includes a direct application flow.`,

    misleading: `Remote UX / UI / Frontend / Marketing Wizard
Confidential Client
Chicago, IL

Our client is seeking a rockstar who can own UX, UI, SEO, paid media, branding, front-end engineering, copywriting, and product management.

This is a hybrid opportunity with in office collaboration three days per week. Local candidates only and must be within commuting distance. Travel required up to 25%.

The ideal candidate can wear many hats, manage marketing campaigns, update WordPress, write HTML/CSS/JavaScript, and produce graphic design assets.

Compensation is unlimited earning potential for the right person.

To apply, send your resume and social security number to bestremotejob@gmail.com or fill out our external Google Form.`
,

    hybridLocal: `Senior UX Designer
Midwest Product Co.
Hybrid in Madison, WI

This role is hybrid and requires two days per week in office collaboration with the design and product team.

Candidates should be located within 50 miles of 53925 for occasional on-site workshops.

Responsibilities
- Lead user research and usability testing
- Build wireframes and prototypes
- Improve accessibility and WCAG outcomes
- Partner cross-functionally with product and engineering
`,

    hybridWisconsinOnly: `UX Designer
Lakeside Experiences
Hybrid in Wisconsin

This role is hybrid with occasional in office collaboration.
Candidates must currently reside in Wisconsin.

Responsibilities
- Support product design and wireframing
- Collaborate with engineering and product partners
`,

    educationAligned: `UX Designer
Design Systems Studio
Remote in United States

Qualifications
- Bachelor's degree or equivalent experience in graphic design, industrial design, human computer interaction, architecture, multidisciplinary design, user experience, psychology, English, computer science, or a related field.
- Experience with user research and usability testing.
`,

    entryLevelRole: `UX Designer
Starter Product Co.
Hybrid in Wisconsin

This is an entry-level UX role for new grads and junior candidates.
The role is full-time and includes in office collaboration.

Responsibilities
- Support wireframes and prototypes
- Work with product and engineering teams
`,

    greenhouseAutofill: `Senior Product Designer
Outside Interactive
Boulder, CO

This role includes standard application details and a dedicated Greenhouse autofill path.
Click the button labeled "Autofill with MyGreenhouse" to speed up the application process.
`,

    restrictedRemote: `Staff Product Designer
Example Co.
Remote

This is one of our entirely remote jobs that could be performed in Colorado.
Candidates must be legally authorized to work in the United States.
`,

    devStackRequirements: `Product Designer
Productive Labs
Remote

Requirements
- 5+ years of UX design experience
- React and Next.js experience required
- Strong TypeScript and Node.js understanding
- Angular familiarity is a plus
`,

    simplifyExtensionDetected: `Senior Product Designer
Trail Works
Remote

Application details and helper UI are available on this page.
`
  };

  const TEST_CASES = [
    {
      name: "Strong remote UX role stays high-confidence",
      input: makeExtraction({
        url: "https://boards.greenhouse.io/northstarhealth/jobs/123",
        roleTitle: "Senior Product Designer",
        company: "Northstar Health",
        locationText: "United States (Remote)",
        salaryText: "$135,000 - $165,000 per year",
        applyUrl: "https://boards.greenhouse.io/northstarhealth/jobs/123/apply",
        applyText: "Apply",
        extractorUsed: "linkedin",
        fullJobText: FIXTURES.linkedin
      }),
      assertions: [
        expectVerdict("Strong Candidate"),
        expectScoreAtLeast(80),
        expectSubscoreAtLeast("remoteAuthenticity", 80),
        expectGreenFlag("Fully remote stated"),
        expectGreenFlag("Accessibility mentioned")
      ]
    },
    {
      name: "Mixed remote constraints stay manual-review territory",
      input: makeExtraction({
        url: "https://boards.greenhouse.io/signalharbor/jobs/999",
        roleTitle: "Product Designer",
        company: "Signal Harbor",
        locationText: "Remote within the United States",
        salaryText: "$110,000 - $130,000 annually",
        applyUrl: "https://boards.greenhouse.io/signalharbor/jobs/999/apply",
        applyText: "Apply",
        extractorUsed: "greenhouse",
        fullJobText: FIXTURES.greenhouse
      }),
      assertions: [
        expectVerdictOneOf(["Review Manually", "Mixed Signals"]),
        expectFlag("redFlags", "Location-restricted remote"),
        expectFlag("redFlags", "Hybrid role"),
        expectSubscoreBelow("remoteAuthenticity", 70)
      ]
    },
    {
      name: "Fake-remote overloaded role is scored harshly",
      input: makeExtraction({
        url: "https://jobs.example.com/listing/remote-marketing-wizard",
        roleTitle: "Remote UX / UI / Frontend / Marketing Wizard",
        company: "Confidential Client",
        locationText: "Chicago, IL",
        salaryText: "",
        applyUrl: "mailto:bestremotejob@gmail.com",
        applyText: "Apply by email",
        extractorUsed: "generic",
        fullJobText: FIXTURES.misleading
      }),
      assertions: [
        expectVerdict("Likely Misleading"),
        expectScoreBelow(45),
        expectFlag("redFlags", "Suspicious application path"),
        expectFlag("redFlags", "Overloaded role scope"),
        expectFlag("redFlags", "Hybrid role")
      ]
    },
    {
      name: "Score stays weighted, not simple average",
      input: makeExtraction({
        url: "https://boards.greenhouse.io/northstarhealth/jobs/123",
        roleTitle: "Senior Product Designer",
        company: "Northstar Health",
        locationText: "United States (Remote)",
        salaryText: "$135,000 - $165,000 per year",
        applyUrl: "https://boards.greenhouse.io/northstarhealth/jobs/123/apply",
        applyText: "Apply",
        extractorUsed: "greenhouse",
        fullJobText: FIXTURES.linkedin
      }),
      assertions: [
        expectWeightedOverall()
      ]
    },
    {
      name: "Hybrid Madison role gets stronger city-level commute boost",
      input: makeExtraction({
        url: "https://www.indeed.com/viewjob?jk=commuteboost",
        roleTitle: "Senior UX Designer",
        company: "Midwest Product Co.",
        locationText: "Hybrid in Madison, WI",
        salaryText: "$120,000 - $145,000 per year",
        applyUrl: "https://www.indeed.com/apply/start",
        applyText: "Apply now",
        extractorUsed: "indeed",
        fullJobText: FIXTURES.hybridLocal
      }),
      assertions: [
        expectWorkModelSignal("city-level hybrid commute boost (Madison, WI)")
      ]
    },
    {
      name: "Hybrid Wisconsin-only role gets smaller commute boost",
      input: makeExtraction({
        url: "https://www.indeed.com/viewjob?jk=wisconsinboost",
        roleTitle: "UX Designer",
        company: "Lakeside Experiences",
        locationText: "Hybrid in Wisconsin",
        salaryText: "",
        applyUrl: "https://www.indeed.com/apply/start",
        applyText: "Apply now",
        extractorUsed: "indeed",
        fullJobText: FIXTURES.hybridWisconsinOnly
      }),
      assertions: [
        expectWorkModelSignal("state-level hybrid commute boost (Wisconsin)")
      ]
    },
    {
      name: "Education profile match is recognized as a positive hit",
      input: makeExtraction({
        url: "https://www.indeed.com/viewjob?jk=educationmatch",
        roleTitle: "UX Designer",
        company: "Design Systems Studio",
        locationText: "Remote in United States",
        salaryText: "",
        applyUrl: "https://www.indeed.com/apply/start",
        applyText: "Apply now",
        extractorUsed: "indeed",
        fullJobText: FIXTURES.educationAligned
      }),
      assertions: [
        expectGreenFlag("Education background match"),
        expectUxSignal("education profile match")
      ]
    },
    {
      name: "Entry-level role applies UX quality penalty",
      input: makeExtraction({
        url: "https://www.indeed.com/viewjob?jk=entrylevelpenalty",
        roleTitle: "UX Designer",
        company: "Starter Product Co.",
        locationText: "Hybrid in Wisconsin",
        salaryText: "",
        applyUrl: "https://www.indeed.com/apply/start",
        applyText: "Apply now",
        extractorUsed: "indeed",
        fullJobText: FIXTURES.entryLevelRole
      }),
      assertions: [
        expectFlag("redFlags", "Entry-level role"),
        expectUxSignalNegative("entry-level role")
      ]
    },
    {
      name: "Greenhouse autofill CTA adds a positive application flag",
      input: makeExtraction({
        url: "https://www.outsideinc.com/openings/?gh_jid=5022834008",
        roleTitle: "Senior Product Designer",
        company: "Outside Interactive",
        locationText: "Boulder, CO",
        salaryText: "",
        applyUrl: "",
        applyText: "Autofill with MyGreenhouse",
        extractorUsed: "generic",
        fullJobText: FIXTURES.greenhouseAutofill
      }),
      assertions: [
        expectGreenFlag("Greenhouse autofill available")
      ]
    },
    {
      name: "Location-limited remote wording is flagged as restricted remote",
      input: makeExtraction({
        url: "https://jobs.example.com/role/restricted-remote",
        roleTitle: "Staff Product Designer",
        company: "Example Co.",
        locationText: "Remote",
        salaryText: "",
        applyUrl: "",
        applyText: "Apply now",
        extractorUsed: "generic",
        fullJobText: FIXTURES.restrictedRemote
      }),
      assertions: [
        expectFlag("redFlags", "Location-restricted remote")
      ]
    },
    {
      name: "Dev-stack terms in requirements trigger red flag",
      input: makeExtraction({
        url: "https://jobs.example.com/role/dev-stack",
        roleTitle: "Product Designer",
        company: "Productive Labs",
        locationText: "Remote",
        salaryText: "",
        applyUrl: "",
        applyText: "Apply",
        extractorUsed: "generic",
        fullJobText: FIXTURES.devStackRequirements
      }),
      assertions: [
        expectFlag("redFlags", "Dev-stack requirement")
      ]
    },
    {
      name: "Simplify extension marker adds a positive helper flag",
      input: makeExtraction({
        url: "https://jobs.example.com/role/simplify",
        roleTitle: "Senior Product Designer",
        company: "Trail Works",
        locationText: "Remote",
        salaryText: "",
        applyUrl: "",
        applyText: "Apply",
        fullJobText: FIXTURES.simplifyExtensionDetected,
        hasSimplifyJobsShadowRoot: true,
        extractorUsed: "generic"
      }),
      assertions: [
        expectGreenFlag("Simplify Jobs helper detected")
      ]
    }
  ];

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("runTestsButton").addEventListener("click", runTests);
    runTests();
  });

  function runTests() {
    const root = document.getElementById("resultsRoot");
    root.innerHTML = "";

    let totalAssertions = 0;
    let passedAssertions = 0;
    let passedCases = 0;

    TEST_CASES.forEach((testCase) => {
      const result = scorer.scorePosting(testCase.input);
      const assertions = testCase.assertions.map((assertion) => assertion(result));
      const casePassed = assertions.every((item) => item.pass);

      totalAssertions += assertions.length;
      passedAssertions += assertions.filter((item) => item.pass).length;
      passedCases += casePassed ? 1 : 0;

      root.appendChild(renderCase(testCase, result, assertions, casePassed));
    });

    renderSummary(passedCases, TEST_CASES.length, passedAssertions, totalAssertions);
    console.clear();
    console.log("Job Evaluator scorer tests complete", {
      passedCases,
      totalCases: TEST_CASES.length,
      passedAssertions,
      totalAssertions,
      weights: constants.SCORE_WEIGHTS
    });
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

  function renderCase(testCase, result, assertions, casePassed) {
    const section = document.createElement("section");
    section.className = "card";

    const assertionMarkup = assertions
      .map((item) => {
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
      '<p class="muted">' +
      "Score: " + result.overallScore +
      " | Verdict: " + escapeHtml(result.verdict) +
      "</p>" +
      "</div>" +
      '<span class="pill ' + (casePassed ? "pill--pass" : "pill--fail") + '">' +
      (casePassed ? "Pass" : "Fail") +
      "</span>" +
      "</div>" +
      '<ul class="assertions">' + assertionMarkup + "</ul>" +
      "<pre>" + escapeHtml(JSON.stringify({
        overallScore: result.overallScore,
        verdict: result.verdict,
        subscores: result.subscores,
        redFlags: result.redFlags,
        greenFlags: result.greenFlags
      }, null, 2)) + "</pre>";

    return section;
  }

  function makeExtraction(overrides) {
    return Object.assign(
      {
        url: "",
        pageTitle: "",
        roleTitle: "",
        company: "",
        locationText: "",
        salaryText: "",
        applyUrl: "",
        applyText: "",
        fullJobText: "",
        hasSimplifyJobsShadowRoot: false,
        reasoningSnippets: [],
        extractorUsed: "generic"
      },
      overrides || {}
    );
  }

  function expectVerdict(expected) {
    return function (result) {
      return {
        pass: result.verdict === expected,
        message: 'Expected verdict "' + expected + '" and got "' + result.verdict + '".'
      };
    };
  }

  function expectVerdictOneOf(expectedValues) {
    return function (result) {
      const pass = expectedValues.includes(result.verdict);
      return {
        pass,
        message:
          "Expected verdict in [" +
          expectedValues.join(", ") +
          '] and got "' + result.verdict + '".'
      };
    };
  }

  function expectScoreAtLeast(minimum) {
    return function (result) {
      return {
        pass: result.overallScore >= minimum,
        message: "Expected overall score >= " + minimum + " and got " + result.overallScore + "."
      };
    };
  }

  function expectScoreBelow(maximum) {
    return function (result) {
      return {
        pass: result.overallScore < maximum,
        message: "Expected overall score < " + maximum + " and got " + result.overallScore + "."
      };
    };
  }

  function expectSubscoreAtLeast(key, minimum) {
    return function (result) {
      return {
        pass: result.subscores[key] >= minimum,
        message: "Expected " + key + " >= " + minimum + " and got " + result.subscores[key] + "."
      };
    };
  }

  function expectSubscoreBelow(key, maximum) {
    return function (result) {
      return {
        pass: result.subscores[key] < maximum,
        message: "Expected " + key + " < " + maximum + " and got " + result.subscores[key] + "."
      };
    };
  }

  function expectGreenFlag(flag) {
    return expectFlag("greenFlags", flag);
  }

  function expectFlag(listKey, flag) {
    return function (result) {
      return {
        pass: Array.isArray(result[listKey]) && result[listKey].includes(flag),
        message: "Expected " + listKey + ' to include "' + flag + '".'
      };
    };
  }

  function expectWorkModelSignal(phrase) {
    return function (result) {
      const workModelSignals = result.matchedSignals && Array.isArray(result.matchedSignals.remoteAuthenticity)
        ? result.matchedSignals.remoteAuthenticity
        : [];
      const pass = workModelSignals.some((signal) => signal && signal.phrase === phrase && signal.direction === "positive");
      return {
        pass,
        message: 'Expected remoteAuthenticity signals to include positive phrase "' + phrase + '".'
      };
    };
  }

  function expectUxSignal(phrase) {
    return function (result) {
      const uxSignals = result.matchedSignals && Array.isArray(result.matchedSignals.uxRoleQuality)
        ? result.matchedSignals.uxRoleQuality
        : [];
      const pass = uxSignals.some((signal) => signal && signal.phrase === phrase && signal.direction === "positive");
      return {
        pass,
        message: 'Expected uxRoleQuality signals to include positive phrase "' + phrase + '".'
      };
    };
  }

  function expectUxSignalNegative(phrase) {
    return function (result) {
      const uxSignals = result.matchedSignals && Array.isArray(result.matchedSignals.uxRoleQuality)
        ? result.matchedSignals.uxRoleQuality
        : [];
      const pass = uxSignals.some((signal) => signal && signal.phrase === phrase && signal.direction === "negative" && signal.points === -10);
      return {
        pass,
        message: 'Expected uxRoleQuality signals to include negative -10 phrase "' + phrase + '".'
      };
    };
  }

  function expectWeightedOverall() {
    return function (result) {
      const expected = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            result.subscores.remoteAuthenticity * constants.SCORE_WEIGHTS.remoteAuthenticity +
              result.subscores.uxRoleQuality * constants.SCORE_WEIGHTS.uxRoleQuality +
              result.subscores.trustLegitimacy * constants.SCORE_WEIGHTS.trustLegitimacy +
              result.subscores.applicationQuality * constants.SCORE_WEIGHTS.applicationQuality
          )
        )
      );

      return {
        pass: result.overallScore === expected,
        message: "Expected weighted overall score " + expected + " and got " + result.overallScore + "."
      };
    };
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
