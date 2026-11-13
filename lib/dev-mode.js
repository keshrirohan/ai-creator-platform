// Developer mode shows the API usage bar at the top of the site.
// On automatically in `npm run dev`. To turn it on in a deployed build,
// set NEXT_PUBLIC_DEV_MODE=true (this exposes account usage to anyone
// who can open the site, so only do that for private deployments).
export const DEV_MODE_ENABLED =
  process.env.NODE_ENV === "development" ||
  process.env.NEXT_PUBLIC_DEV_MODE === "true";

// Free-plan limits, checked on 13 Nov 2026 against each provider's pricing page.
export const FREE_PLAN_LIMITS = {
  imagekit: {
    bandwidthBytes: 20 * 1024 ** 3, // 20 GB / month
    storageBytes: 3 * 1024 ** 3, // 3 GB fixed
    extensionUnits: 650, // AI units / month
    resets: "1st of each month",
  },
  gemini: {
    // Requests per day on the free tier (reset midnight Pacific).
    // Google sets these per project; check AI Studio for exact values.
    requestsPerDay: {
      "gemini-3.8-flash": 20,
      "gemini-3.6-flash": 20,
      "gemini-3.5-flash-lite": 500,
      "gemini-3.1-flash-lite": 500,
    },
    resets: "midnight Pacific time",
  },
  clerk: {
    monthlyRetainedUsers: 50000,
  },
  convex: {
    functionCalls: "1M / month",
    databaseStorage: "0.5 GB",
    databaseIO: "1 GB / month",
    fileStorage: "1 GB",
    egress: "1 GB / month",
    actionCompute: "20 GB-hours / month",
  },
};
