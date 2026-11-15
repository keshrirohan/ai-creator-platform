// Server-only Gemini helper shared by every AI feature.
// Import this only from server actions or API routes: it uses GEMINI_API_KEY.
import { GoogleGenerativeAI } from "@google/generative-ai";
import { recordGeminiCall } from "./dev-usage";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Models tried in order. If one is overloaded (503), rate-limited (429)
// or retired (404), the next one is used.
const MODEL_FALLBACKS = [
  "gemini-3.8-flash",
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.7-flash",
  "gemini-flash-latest",
];
const RETRY_PASSES = 2;
const RETRY_DELAY_MS = 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Fastest models first, for tasks like transcription where speed matters more
// than writing quality. Flash-Lite transcribes ~20 s of audio in ~3 s.
export const FAST_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3.8-flash",
];

export const isRetryableModelError = (error) => {
  const msg = error?.message || "";
  return (
    /\[(503|429|404)/.test(msg) ||
    /high demand|overloaded|no longer available|not found|abort|timed? ?out/i.test(msg)
  );
};

// `request` is anything model.generateContent accepts: a prompt string,
// an array of parts (e.g. audio + text), or a full request object.
// Options: `models` (order to try) and `timeoutMs` (limit per attempt, so a
// slow or stuck model is skipped instead of blocking the request).
export async function generateWithFallback(request, { models = MODEL_FALLBACKS, timeoutMs } = {}) {
  let lastError;
  for (let pass = 0; pass < RETRY_PASSES; pass++) {
    if (pass > 0) await sleep(RETRY_DELAY_MS);
    for (const modelName of models) {
      try {
        const model = genAI.getGenerativeModel(
          { model: modelName },
          timeoutMs ? { timeout: timeoutMs } : undefined
        );
        const result = await model.generateContent(request);
        const text = result.response.text();
        await recordGeminiCall({ model: modelName, ok: true });
        return text;
      } catch (error) {
        lastError = error;
        await recordGeminiCall({ model: modelName, ok: false, error });
        console.warn(`Gemini model ${modelName} failed: ${error.message}`);
        if (!isRetryableModelError(error)) throw error;
      }
    }
  }
  throw lastError;
}

// User-facing message for a Gemini failure (never includes keys or raw details)
export function geminiErrorMessage(error) {
  const msg = error?.message || "";
  if (/API key/i.test(msg)) return "AI service configuration error. Please try again later.";
  if (/quota|limit|high demand|503|429/i.test(msg)) {
    return "AI service is temporarily unavailable. Please try again in a minute.";
  }
  return "AI request failed. Please try again.";
}
