(function (global) {
  const APP_NAME = "Job Evaluator";
  const STORAGE_KEY = "jobEvaluator.savedJobs";
  const PREFERENCES_STORAGE_KEY = "jobEvaluator.userPreferences";
  const MAX_SAVED_JOBS = 50;

  const SCORE_WEIGHTS = {
    remoteAuthenticity: 0.35,
    uxRoleQuality: 0.3,
    trustLegitimacy: 0.2,
    applicationQuality: 0.15
  };

  const DEFAULT_USER_PREFERENCES = {
    penalizeHybridHeavily: true,
    preferAccessibilityRoles: true,
    preferProductUXOverMarketingUX: true,
    preferRemoteRoles: true,
    preferRemoteOnly: false,
    commuteZip: "",
    commuteRadiusMiles: 25,
    enableCommutePlaceholderLogic: true,
    contactEmail: "",
    targetSalaryText: "",
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
  const USER_PREFERENCES = Object.assign({}, DEFAULT_USER_PREFERENCES);

  const KNOWN_ATS_HOSTS = [
    "boards.greenhouse.io",
    "greenhouse.io",
    "boards.eu.greenhouse.io",
    "myworkdayjobs.com",
    "workday.com",
    "linkedin.com",
    "indeed.com",
    "dice.com",
    "simplify.jobs"
  ];

  const COMMUTE_RADIUS_HINTS = {};

  const SITE_KEYS = {
    linkedin: "linkedin",
    indeed: "indeed",
    greenhouse: "greenhouse",
    dice: "dice",
    simplify: "simplify",
    generic: "generic"
  };

  global.JobEvaluatorConstants = {
    APP_NAME,
    STORAGE_KEY,
    PREFERENCES_STORAGE_KEY,
    MAX_SAVED_JOBS,
    SCORE_WEIGHTS,
    DEFAULT_USER_PREFERENCES,
    USER_PREFERENCES,
    KNOWN_ATS_HOSTS,
    COMMUTE_RADIUS_HINTS,
    SITE_KEYS
  };
})(globalThis);
