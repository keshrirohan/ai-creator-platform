// Server-only helpers that record Gemini API calls for the developer usage bar.
// Gemini has no usage API for API keys, so the app counts its own requests.
// Data is kept in .dev-usage.json in the project root (git-ignored).
import { promises as fs } from "fs";
import path from "path";
import { DEV_MODE_ENABLED } from "./dev-mode";

const USAGE_FILE = path.join(process.cwd(), ".dev-usage.json");

// Gemini quotas reset at midnight Pacific time
export const pacificDate = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const emptyGemini = () => ({
  date: pacificDate(),
  models: {},
  lastSuccess: null,
  lastError: null,
});

async function readFile() {
  try {
    return JSON.parse(await fs.readFile(USAGE_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function readGeminiUsage() {
  const data = await readFile();
  const gemini = data.gemini;
  // Start a fresh count on a new Pacific day
  if (!gemini || gemini.date !== pacificDate()) return emptyGemini();
  return gemini;
}

const classify = (message = "") => {
  if (/\[429|quota|rate limit/i.test(message)) return "rateLimited";
  if (/\[503|high demand|overloaded/i.test(message)) return "overloaded";
  return "failed";
};

// Record one Gemini request. Never throws: tracking must not break the app.
export async function recordGeminiCall({ model, ok, error }) {
  if (!DEV_MODE_ENABLED) return;
  try {
    const data = await readFile();
    const gemini = await readGeminiUsage();
    const entry = gemini.models[model] || {
      success: 0,
      rateLimited: 0,
      overloaded: 0,
      failed: 0,
    };

    if (ok) {
      entry.success += 1;
      gemini.lastSuccess = { model, at: Date.now() };
    } else {
      entry[classify(error?.message)] += 1;
      gemini.lastError = {
        model,
        at: Date.now(),
        message: (error?.message || "Unknown error").slice(0, 200),
      };
    }

    gemini.models[model] = entry;
    data.gemini = gemini;
    await fs.writeFile(USAGE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("Could not record Gemini usage:", e.message);
  }
}
