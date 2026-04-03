(function (global) {
  const APP_NAME = "Job Evaluator";
  const STORAGE_KEY = "jobEvaluator.savedJobs";
  const MAX_SAVED_JOBS = 50;

  const SCORE_WEIGHTS = {
    remoteAuthenticity: 0.35,
    uxRoleQuality: 0.3,
    trustLegitimacy: 0.2,
    applicationQuality: 0.15
  };

  const USER_PREFERENCES = {
    penalizeHybridHeavily: true,
    preferAccessibilityRoles: true,
    preferProductUXOverMarketingUX: true,
    preferRemoteRoles: true,
    preferRemoteOnly: false,
    commuteZip: "53925",
    commuteRadiusMiles: 50,
    enableCommutePlaceholderLogic: true,
    educationMatchKeywords: [
      "graphic design",
      "industrial design",
      "human computer interaction",
      "hci",
      "architecture",
      "multidisciplinary design",
      "user experience",
      "ux",
      "psychology",
      "english",
      "computer science"
    ]
  };

  const KNOWN_ATS_HOSTS = [
    "boards.greenhouse.io",
    "greenhouse.io",
    "jobs.lever.co",
    "boards.eu.greenhouse.io",
    "myworkdayjobs.com",
    "workday.com",
    "linkedin.com",
    "indeed.com",
    "dice.com",
    "simplify.jobs"
  ];

  const COMMUTE_RADIUS_HINTS = {
    "53925": {
      locationKeywords: [
        "columbus, wi",
        "madison, wi",
        "sun prairie, wi",
        "de forest, wi",
        "deforest, wi",
        "beaver dam, wi",
        "watertown, wi",
        "portage, wi",
        "juneau, wi",
        "lake mills, wi",
        "cambridge, wi",
        "johnson creek, wi",
        "marshall, wi",
        "middleton, wi",
        "waunakee, wi",
        "fitchburg, wi",
        "verona, wi",
        "fort atkinson, wi",
        "windsor, wi",
        "wisconsin dells, wi",
        "oshkosh, wi",
        "fond du lac, wi",
        "oconomowoc, wi",
        "peawaukee, wi",
        "janesville, wi"
      ]
    }
  };

  const SITE_KEYS = {
    linkedin: "linkedin",
    indeed: "indeed",
    greenhouse: "greenhouse",
    lever: "lever",
    dice: "dice",
    simplify: "simplify",
    generic: "generic"
  };

  global.RemoteUxRealityTestConstants = {
    APP_NAME,
    STORAGE_KEY,
    MAX_SAVED_JOBS,
    SCORE_WEIGHTS,
    USER_PREFERENCES,
    KNOWN_ATS_HOSTS,
    COMMUTE_RADIUS_HINTS,
    SITE_KEYS
  };
})(globalThis);
