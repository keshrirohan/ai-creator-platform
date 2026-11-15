// Server-only Gemini service shared by every AI feature (blog generation,
// content improvement, voice transcription, blog translation).
// Import this only from server actions or API routes. Keys never leave the server
// and are never logged; log lines refer to keys as "key #1", "key #2", ...
import { GoogleGenerativeAI } from "@google/generative-ai";
import { recordGeminiCall } from "./dev-usage";

// Blog writing. gemini-3.6-flash is what the deprecated gemini-3.5-flash name now
// routes to (Google deprecations page). Free tier on both. Flash-Lite as fallback.
export const GENERATION_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];

// Translation: Flash-Lite is Google's model for translation (~2 s first token, no thinking).
export const TRANSLATION_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];

// Fastest models first, for transcription.
export const FAST_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"];

export const MODEL_FALLBACKS = GENERATION_MODELS; // default

const DEFAULT_TIMEOUT_MS = 30_000; // per attempt (non-streaming)
const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 15_000; // streaming: give up on a project if nothing arrives
const DEFAULT_DEADLINE_MS = 55_000; // whole request (Vercel functions stop at 60 s)
const MAX_ATTEMPTS = 6;
const INVALID_KEY_COOLDOWN_MS = 10 * 60 * 1000;
const TRANSIENT_COOLDOWN_MS = 30 * 1000; // skip a project briefly after a timeout / 5xx
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
const DAILY_QUOTA_COOLDOWN_MS = 60 * 60 * 1000; // re-check hourly; daily quotas reset at midnight PT
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// One key per Google project. Key 1 is primary, keys 2-4 are fallbacks used in
// order. GEMINI_API_KEY is accepted as key 1 for older setups.
export function getConfiguredKeys(env = process.env) {
  return [env.GEMINI_API_KEY_1 || env.GEMINI_API_KEY, env.GEMINI_API_KEY_2, env.GEMINI_API_KEY_3, env.GEMINI_API_KEY_4]
    .map((key) => (typeof key === "string" ? key.trim() : ""))
    .map((key, index) => ({ key, index: index + 1 }))
    .filter(({ key }) => key);
}

const clients = new Map(); // key -> GoogleGenerativeAI
const disabledUntil = new Map(); // key index -> timestamp (invalid / blocked key)
const rateLimitedUntil = new Map(); // "keyIndex:model" -> timestamp (that project's quota for that model)
const unhealthyUntil = new Map(); // "keyIndex:model" -> timestamp (recent timeout / server error)

const clientFor = (key) => {
  if (!clients.has(key)) clients.set(key, new GoogleGenerativeAI(key));
  return clients.get(key);
};

const until = (map, id, now) => (map.get(id) || 0) > now;

// Keys to try for this model, in priority order (so the primary is used again
// as soon as it is healthy). Rate-limited and invalid keys are skipped. Keys in a
// short "unhealthy" cooldown are skipped too, unless no healthy key is left, in
// which case they are tried as a last resort instead of failing outright.
function keysFor(modelName, now = Date.now()) {
  const usable = getConfiguredKeys().filter(
    ({ index }) => !until(disabledUntil, index, now) && !until(rateLimitedUntil, `${index}:${modelName}`, now)
  );
  const healthy = usable.filter(({ index }) => !until(unhealthyUntil, `${index}:${modelName}`, now));
  return healthy.length ? healthy : usable;
}

// How long Google asks us to wait after a 429, from the RetryInfo / QuotaFailure details
export function rateLimitCooldownMs(error) {
  const details = JSON.stringify(error?.errorDetails || "") + String(error?.message || "");
  const retry = details.match(/retryDelay\\?"?:\s*\\?"?(\d+(?:\.\d+)?)s/);
  let ms = retry ? Math.ceil(parseFloat(retry[1]) * 1000) : DEFAULT_RATE_LIMIT_COOLDOWN_MS;
  if (/PerDay/i.test(details)) ms = Math.max(ms, DAILY_QUOTA_COOLDOWN_MS);
  return Math.min(Math.max(ms, 1000), MAX_COOLDOWN_MS);
}

// Remove anything that looks like an API key before a message is logged or stored
export const redactSecrets = (text = "") =>
  String(text)
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/AQ\.[0-9A-Za-z_-]{20,}/g, "[redacted]")
    .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]");

// What to do after a failed attempt:
//   "invalid_key" -> key wrong, expired or not allowed: disable it for 10 min, try the next key
//   "rate_limit"  -> that project's quota for this model is used up: pause that project +
//                    model for as long as Google asks, then try the next key
//   "transient"   -> server error, timeout or network problem: pause that project + model
//                    for 30 s, then try the next key
//   "model"       -> model retired, unknown or setting unsupported: try the next model
//   "fatal"       -> bad request or anything else: stop
export function classifyGeminiError(error) {
  const status = Number(error?.status) || Number(String(error?.message).match(/\[(\d{3})/)?.[1]) || 0;
  const msg = String(error?.message || "");
  const details = JSON.stringify(error?.errorDetails || "");

  if (/API_KEY_INVALID|API key not valid|API key expired|API_KEY_SERVICE_BLOCKED/i.test(msg + details)) {
    return "invalid_key";
  }
  if (status === 401 || status === 403) return "invalid_key";
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return "rate_limit";
  if (status === 404 || /no longer available|is not found|not supported for generateContent/i.test(msg)) {
    return "model";
  }
  if (status === 400 && /thinking|generation_?config/i.test(msg + details)) return "model";
  if (status >= 500 || /high demand|overloaded|abort|timed? ?out|fetch failed|ECONNRESET|ETIMEDOUT|network/i.test(msg)) {
    return "transient";
  }
  return "fatal";
}

// Kept for existing callers and tests
export const isRetryableModelError = (error) => classifyGeminiError(error) !== "fatal";

// Build the request for one model: single-turn content (no history), output limit,
// and minimal thinking on full Flash models (Flash-Lite doesn't think by default).
// Minimal thinking cut first-token time from ~5.6 s to ~3.5 s and ~800 billed tokens.
export function buildRequest(request, modelName, { maxOutputTokens, thinking } = {}) {
  const base =
    typeof request === "string"
      ? { contents: [{ role: "user", parts: [{ text: request }] }] }
      : Array.isArray(request)
        ? { contents: [{ role: "user", parts: request }] }
        : request;
  const generationConfig = { ...(base.generationConfig || {}) };
  if (maxOutputTokens) generationConfig.maxOutputTokens = maxOutputTokens;
  if (thinking && !/lite/i.test(modelName)) generationConfig.thinkingConfig = { thinkingLevel: thinking };
  return Object.keys(generationConfig).length ? { ...base, generationConfig } : base;
}

// Shared fallback loop. `attempt` performs one call and returns its result or throws.
async function runWithFallback(models, deadlineMs, attempt) {
  if (getConfiguredKeys().length === 0) {
    throw new Error("Gemini API key not configured (set GEMINI_API_KEY_1)");
  }
  const deadline = Date.now() + deadlineMs;
  let attempts = 0;
  let lastError = new Error("No Gemini API key available");

  for (const modelName of models) {
    const keys = keysFor(modelName);
    if (keys.length === 0) {
      lastError = Object.assign(new Error(`All projects are rate limited for ${modelName}`), { kind: "rate_limit" });
      continue;
    }
    for (const { key, index } of keys) {
      if (attempts >= MAX_ATTEMPTS || Date.now() >= deadline) throw lastError;
      attempts++;
      try {
        const result = await attempt({ client: clientFor(key), modelName, remainingMs: deadline - Date.now() });
        unhealthyUntil.delete(`${index}:${modelName}`);
        await recordGeminiCall({ model: modelName, ok: true });
        return result;
      } catch (error) {
        const kind = classifyGeminiError(error);
        const safeMessage = redactSecrets(error?.message);
        lastError = Object.assign(new Error(safeMessage), { kind });
        await recordGeminiCall({ model: modelName, ok: false, error: lastError });
        console.warn(`Gemini ${modelName} (key #${index}) failed [${kind}]: ${safeMessage.slice(0, 200)}`);

        if (kind === "fatal") throw lastError;
        if (kind === "invalid_key") {
          disabledUntil.set(index, Date.now() + INVALID_KEY_COOLDOWN_MS);
          continue;
        }
        if (kind === "rate_limit") {
          rateLimitedUntil.set(`${index}:${modelName}`, Date.now() + rateLimitCooldownMs(error));
          continue;
        }
        if (kind === "transient") {
          unhealthyUntil.set(`${index}:${modelName}`, Date.now() + TRANSIENT_COOLDOWN_MS);
          continue;
        }
        break; // "model": next model
      }
    }
  }
  throw lastError;
}

/**
 * One Gemini request with project/model fallback. Returns the full text.
 * @param request  prompt string, parts array, or request object
 * @param options  { models, timeoutMs (per attempt), deadlineMs (total), maxOutputTokens, thinking }
 */
export function generateWithFallback(
  request,
  { models = MODEL_FALLBACKS, timeoutMs = DEFAULT_TIMEOUT_MS, deadlineMs = DEFAULT_DEADLINE_MS, maxOutputTokens, thinking } = {}
) {
  return runWithFallback(models, deadlineMs, async ({ client, modelName, remainingMs }) => {
    const model = client.getGenerativeModel(
      { model: modelName },
      { timeout: Math.max(1000, Math.min(timeoutMs, remainingMs)) }
    );
    const result = await model.generateContent(buildRequest(request, modelName, { maxOutputTokens, thinking }));
    return result.response.text();
  });
}

/**
 * Streaming Gemini request with project/model fallback.
 * Fallback happens only before the first text arrives; if a project sends nothing
 * within `firstTokenTimeoutMs`, the next one is tried. Returns an async iterator of
 * text chunks. Resolves as soon as the first chunk is available.
 */
export async function streamWithFallback(
  request,
  {
    models = MODEL_FALLBACKS,
    firstTokenTimeoutMs = DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
    deadlineMs = DEFAULT_DEADLINE_MS,
    maxOutputTokens,
    thinking,
  } = {}
) {
  const started = Date.now();

  const opened = await runWithFallback(models, deadlineMs, async ({ client, modelName, remainingMs }) => {
    const controller = new AbortController();
    const firstTimer = setTimeout(() => controller.abort(), Math.min(firstTokenTimeoutMs, remainingMs));
    try {
      const model = client.getGenerativeModel({ model: modelName });
      const result = await model.generateContentStream(
        buildRequest(request, modelName, { maxOutputTokens, thinking }),
        { signal: controller.signal }
      );
      const iterator = result.stream[Symbol.asyncIterator]();
      // Wait for the first non-empty chunk before committing to this project
      let first = "";
      while (!first) {
        const { value, done } = await iterator.next();
        if (done) throw new Error("[503] Empty response from model");
        first = value.text();
      }
      return { controller, iterator, first, modelName };
    } catch (error) {
      const timedOut = controller.signal.aborted;
      controller.abort(); // stop the request in every case
      if (timedOut && !error?.status) {
        throw Object.assign(new Error(`Request aborted: no response within ${firstTokenTimeoutMs} ms`), { status: 504 });
      }
      throw error;
    } finally {
      clearTimeout(firstTimer);
    }
  });

  // Overall limit for the rest of the stream
  const deadlineTimer = setTimeout(() => opened.controller.abort(), Math.max(1000, deadlineMs - (Date.now() - started)));

  return (async function* () {
    try {
      yield opened.first;
      while (true) {
        const { value, done } = await opened.iterator.next();
        if (done) break;
        const text = value.text();
        if (text) yield text;
      }
    } finally {
      clearTimeout(deadlineTimer);
    }
  })();
}

// User-facing message for a Gemini failure (never includes keys or raw details)
export function geminiErrorMessage(error) {
  const kind = error?.kind || classifyGeminiError(error);
  const msg = error?.message || "";
  if (kind === "invalid_key" || /not configured/i.test(msg)) {
    return "AI service configuration error. Please try again later.";
  }
  if (kind === "rate_limit") return "The AI usage limit has been reached. Please try again later.";
  if (kind === "transient") return "AI service is temporarily unavailable. Please try again in a minute.";
  return "AI request failed. Please try again.";
}

// Test-only: reset cooldowns and cached clients
export function __resetGeminiState() {
  clients.clear();
  disabledUntil.clear();
  rateLimitedUntil.clear();
  unhealthyUntil.clear();
}
