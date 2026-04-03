# Job Evaluator

Job Evaluator is a local-only Chrome extension MVP that inspects any current job posting page, extracts visible posting details, scores the role with a transparent ruleset, and lets you save results for later review. It evaluates all job types, while still giving remote-friendly roles a scoring advantage over hybrid/onsite roles.

## Install

1. Open Chrome and go to `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select the folder [job-evaluator](job-evaluator).
5. Open a supported job posting page and click the extension icon.

## How It Works

1. The popup opens and asks the background service worker to analyze the active tab.
2. The background worker injects the extractor/content scripts into the current page only when needed.
3. The content script reads visible page data and returns a normalized payload.
4. The popup applies a deterministic local rubric to compute category scores, flags, verdict, and explanation.
5. You can copy the summary, copy the extracted job description, and save the full result in `chrome.storage.local`.
6. Saved results can be reopened, auto-sorted by score, starred, highlighted when they match the current page, and compared against the current analysis through `Differences Found`.

Everything runs locally:

- No backend
- No external APIs
- No LLM calls
- No build step

## File Structure

```text
job-evaluator/
  manifest.json
  README.md
  icons/
    icon16.png
    icon32.png
    icon48.png
    icon128.png
  src/
    background.js
    content.js
    popup.html
    popup.css
    popup.js
    scorer.js
    extractors.js
    storage.js
    utils.js
    constants.js
  test-data/
    linkedin-sample.txt
    greenhouse-sample.txt
    misleading-remote-sample.txt
  tests/
    run-tests.html
    run-popup-tests.html
    run-utils-tests.html
    popup-tests.js
    scorer-tests.js
    utils-tests.js
```

## Popup UX

The popup is intentionally compact:

- header with status dot and re-analyze control
- current page analysis card with a color-coded overall score
- verdict, location, salary, and optional job-meta list
- `Differences Found` shown only when a saved version of the same job has actually changed
- weighted score breakdown
- red flags, green flags, and short explanation
- actions for `Copy Summary`, `Copy Job Description`, and `Save Result`
- `Saved Results` list with direct links, score badges, extractor labels, delete action, and star toggle
- saved jobs are auto-sorted by score (`highest -> lowest`)

When the current page URL already exists in `Saved Results`:

- the matching saved row receives a soft highlight
- `Save Result` is disabled and relabeled as `Already Saved`

## Scoring Rubric

The extension computes four category scores, each starting at `50` and then moving up or down based on phrase matches and simple heuristics. Each category is clamped to `0-100`, and the final score is a weighted score, not a plain average.

- Work Model Fit (Remote Preferred): `35%`
- UX Role Quality: `30%`
- Trust / Legitimacy: `20%`
- Application Quality: `15%`

Verdict thresholds:

- `85-100`: Strong Candidate
- `70-84`: Review Manually
- `50-69`: Mixed Signals
- `0-49`: Likely Misleading

### Work Model Fit (Remote Preferred)

Positive signals include:

- `fully remote`
- `100% remote`
- `remote-first`
- `distributed team`
- `async` / `asynchronous`
- `work from anywhere`
- `no travel required`

Negative signals include:

- `hybrid`
- `onsite` / `on-site`
- `in office`
- `must be within commuting distance`
- `must be located in`
- `local candidates only`
- `occasional onsite`
- `travel required`
- `remote during onboarding only`
- `relocation`

### UX Role Quality

Positive signals include:

- `user research`
- `usability testing`
- `wireframes`
- `prototyping`
- `design system`
- `accessibility`
- `wcag`
- `cross-functional`
- `product team`
- `interaction design`
- `information architecture`

Negative signals include:

- `seo`
- `paid media`
- `marketing campaigns`
- `graphic design` when stronger UX signals are absent
- `wordpress` combined with marketing-heavy language
- `html/css/javascript` when the role reads dev-first
- overloaded blended roles across UX, UI, engineering, PM, marketing, and copy

### Trust / Legitimacy

Positive signals include:

- company name found
- salary range found
- clear responsibilities
- product or service context
- known ATS platform

Negative signals include:

- no company name
- `confidential client`
- generic recruiter language
- unrealistic compensation phrasing
- spammy grammar

### Application Quality

Positive signals include:

- Greenhouse / Lever / Workday detected
- clear application flow
- direct company careers page signals

Negative signals include:

- free-email application path
- suspicious external form
- excessive personal info too early

## Personal Tuning

Personal preferences live in [constants.js](job-evaluator/src/constants.js) in the `USER_PREFERENCES` object:

```js
const USER_PREFERENCES = {
  penalizeHybridHeavily: true,
  preferAccessibilityRoles: true,
  preferProductUXOverMarketingUX: true,
  preferRemoteRoles: true,
  preferRemoteOnly: false,
  commuteZip: "53925",
  commuteRadiusMiles: 50,
  enableCommutePlaceholderLogic: true
};
```

When `enableCommutePlaceholderLogic` is enabled, hybrid roles can receive a small `work model fit` boost when the posting text appears commute-friendly for your configured home ZIP and radius (for example, `53925` within `50` miles).
The keyword hints used for this matching live in [constants.js](job-evaluator/src/constants.js) under `COMMUTE_RADIUS_HINTS`.

## Extractor Coverage

### Primary Extractors

These are the currently prioritized extractor paths because they represent the most important real-world user flows tested so far:

- LinkedIn Jobs
- Indeed
- Greenhouse
- Dice

### Secondary Extractors

These are still supported, but currently lower priority for QA and iteration:

- Lever
- Simplify Jobs

### Generic Fallback

Unknown job pages fall back to a generic extractor that uses:

- visible headings
- likely content containers
- salary regex detection
- apply-link detection
- visible text snippet harvesting

## Known Extraction Notes By Site

- LinkedIn often hides some description content behind progressive disclosure or logged-in UI states. Collection URLs can also be noisier than direct job URLs.
- Indeed supports both `?vjk=` and `viewjob?jk=` URLs. The extractor now cleans location labels such as `Job address`.
- Greenhouse supports both standard posting pages and `my.greenhouse.io/applications/...` style application pages.
- Lever is a platform-style job-hosting path rather than a mainstream destination board, so it is kept as secondary coverage.
- Dice can mix recruiter language and platform chrome into the description, so noise filtering still matters.
- Glassdoor does not currently have a dedicated extractor. It would use the generic fallback until a site-specific extractor is added.

## Limitations

- The extension only sees the current page's visible DOM content.
- It does not click hidden accordions or paginate descriptions.
- It does not guarantee the listing is genuine; it only scores observable signals.
- It does not fully interpret commute distance or geo-fencing yet.
- Some sites may render content late enough that a second analyze click helps.
- Saved-job matching currently keys off the job URL, so materially different URLs for the same job may not compare automatically.

## How To Tweak The Scoring

1. Open [scorer.js](job-evaluator/src/scorer.js).
2. Adjust phrase rules or flag heuristics.
3. Open [constants.js](job-evaluator/src/constants.js) to change weights or preferences.
4. Reload the unpacked extension in Chrome and test again.

## Testing

### Lightweight Scorer Tests

A simple browser-based scorer regression runner is included at [tests/run-tests.html](job-evaluator/tests/run-tests.html).

How to use it:

1. Open [run-tests.html](job-evaluator/tests/run-tests.html) in Chrome.
2. Click `Run Tests`.
3. Review pass/fail output for each scoring scenario.
4. Re-run after changing [scorer.js](job-evaluator/src/scorer.js) or [constants.js](job-evaluator/src/constants.js).

What it covers:

- strong remote UX role behavior
- mixed-signal remote behavior
- low work-model-fit / overloaded role behavior
- weighted overall-score calculation

This test runner is intentionally lightweight and framework-free. It does not test live DOM extraction, popup rendering, or Chrome extension messaging flows.

### Popup Saved-Results Tests

A browser-based popup logic runner is included at [tests/run-popup-tests.html](job-evaluator/tests/run-popup-tests.html).

What it covers:

- saved-results auto-sorting by score (`highest -> lowest`)
- score tie-break behavior by latest saved timestamp
- star toggle state updates
- star toggle preserving score-based ordering

### Utility Location Tests

A utility-focused runner is included at [tests/run-utils-tests.html](job-evaluator/tests/run-utils-tests.html).

What it covers:

- reducing US street addresses to `City, ST ZIP` (for example, `Middleton, WI 53562`)
- preserving country for non-US addresses
- preserving explicit remote/hybrid location labels

### Manual QA Recommendation

For extractor QA, test at least one live page for each supported source:

- LinkedIn
- Indeed
- Greenhouse
- Dice
- Lever
- Simplify Jobs
- one generic fallback page

For each page, verify:

- role title
- company
- location
- salary
- job meta cleanliness
- extracted description quality
- score / flags reasonableness
- copy actions
- save, star/unstar, open, and delete actions
- score-based auto-sorting behavior in `Saved Results`

## Icons

The included icon files are tiny placeholder PNGs so the extension loads cleanly as an unpacked project. Replace them with production icons later using the same filenames:

- [icon16.png](job-evaluator/icons/icon16.png)
- [icon32.png](job-evaluator/icons/icon32.png)
- [icon48.png](job-evaluator/icons/icon48.png)
- [icon128.png](job-evaluator/icons/icon128.png)

## TODO

- [x] Created [authors.md](job-evaluator/authors.md) with:
  - CC BY 4.0 license
  - copyright holder name: @webuxr
  - copyright year: 2026
  - attribution/ownership notes for code and assets
- [ ] [P5] Create a text-blob extractor that accepts a pasted/raw job posting text block and returns normalized extraction fields.
- [ ] [P3] Clean up saved job post URLs so the full canonical job post URL appears in the tooltip.
- [ ] [P4] Convert analysis section layout into a tabbed UI so results are easier to review.
- [x] [P1] Pick improved green/yellow/orange/red colors for overall score indicators and labels (`#198754`, `#b02a37`, `#fd7e14`, `#ffc107`).
- [ ] [P2] Increase popup width for a more comfortable viewing experience.

## Sample Test Data

The text fixtures in [test-data](job-evaluator/test-data) are useful for scoring experiments:

- [linkedin-sample.txt](job-evaluator/test-data/linkedin-sample.txt)
- [greenhouse-sample.txt](job-evaluator/test-data/greenhouse-sample.txt)
- [misleading-remote-sample.txt](job-evaluator/test-data/misleading-remote-sample.txt)
