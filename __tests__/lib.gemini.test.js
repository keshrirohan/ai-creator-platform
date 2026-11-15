/**
 * @jest-environment node
 */
// Tests for lib/gemini.js: project fallback, cooldowns, streaming, request building

const mockGenerate = jest.fn();
const mockStream = jest.fn();
const mockGetModel = jest.fn(() => ({ generateContent: mockGenerate, generateContentStream: mockStream }));

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn((key) => ({ getGenerativeModel: (...args) => mockGetModel(key, ...args) })),
}));
jest.mock("@/lib/dev-usage", () => ({ recordGeminiCall: jest.fn() }));

const ok = (text) => ({ response: { text: () => text } });
const err = (status, message = "") => Object.assign(new Error(`[${status}] ${message}`), { status });

// A fake streamed response: yields chunks, optionally waiting first; honours the abort signal
const streamOf = (chunks, { delayMs = 0 } = {}) =>
  (request, { signal } = {}) =>
    Promise.resolve({
      stream: (async function* () {
        if (delayMs) {
          await new Promise((resolve, reject) => {
            const t = setTimeout(resolve, delayMs);
            signal?.addEventListener("abort", () => {
              clearTimeout(t);
              reject(new Error("Request aborted when fetching"));
            });
          });
        }
        for (const c of chunks) yield { text: () => c };
      })(),
    });

const KEYS = { GEMINI_API_KEY_1: "key-one", GEMINI_API_KEY_2: "key-two", GEMINI_API_KEY_3: "key-three" };
let gemini;
let savedEnv;

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  savedEnv = { ...process.env };
  delete process.env.GEMINI_API_KEY;
  Object.assign(process.env, KEYS);
  gemini = await import("@/lib/gemini");
  gemini.__resetGeminiState();
});
afterEach(() => {
  process.env = savedEnv;
  jest.restoreAllMocks();
});

const keysUsed = () => mockGetModel.mock.calls.map((c) => c[0]);
const calls = () => mockGetModel.mock.calls.map((c) => `${c[0]}:${c[1].model}`);
const collect = async (it) => {
  let out = "";
  for await (const c of it) out += c;
  return out;
};

describe("models", () => {
  test("blog generation uses gemini-3.6-flash (what gemini-3.5-flash routes to), then Flash-Lite", () => {
    expect(gemini.GENERATION_MODELS).toEqual(["gemini-3.6-flash", "gemini-3.5-flash-lite"]);
  });
  test("translation uses gemini-3.5-flash-lite first", () => {
    expect(gemini.TRANSLATION_MODELS[0]).toBe("gemini-3.5-flash-lite");
  });
});

describe("getConfiguredKeys", () => {
  test("reads keys 1-4 in order and skips empty ones", () => {
    expect(gemini.getConfiguredKeys({ GEMINI_API_KEY_1: "a", GEMINI_API_KEY_3: " c ", GEMINI_API_KEY_4: "d" })).toEqual([
      { key: "a", index: 1 },
      { key: "c", index: 3 },
      { key: "d", index: 4 },
    ]);
  });
  test("falls back to GEMINI_API_KEY as key 1", () => {
    expect(gemini.getConfiguredKeys({ GEMINI_API_KEY: "legacy" })).toEqual([{ key: "legacy", index: 1 }]);
  });
  test("throws a config error when no key is set", async () => {
    for (const k of Object.keys(KEYS)) delete process.env[k];
    await expect(gemini.generateWithFallback("p")).rejects.toThrow(/not configured/);
  });
});

describe("buildRequest", () => {
  test("wraps a prompt as one user turn (no conversation history)", () => {
    expect(gemini.buildRequest("hi", "m")).toEqual({ contents: [{ role: "user", parts: [{ text: "hi" }] }] });
  });
  test("adds the output cap and minimal thinking on Flash, not on Flash-Lite", () => {
    expect(gemini.buildRequest("hi", "gemini-3.6-flash", { maxOutputTokens: 4096, thinking: "minimal" }).generationConfig).toEqual({
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: "minimal" },
    });
    expect(gemini.buildRequest("hi", "gemini-3.5-flash-lite", { thinking: "minimal" }).generationConfig).toBeUndefined();
  });
  test("keeps an existing request object and its generationConfig", () => {
    const req = { contents: [{ parts: [{ inlineData: { mimeType: "audio/webm", data: "x" } }] }], generationConfig: { responseMimeType: "application/json" } };
    expect(gemini.buildRequest(req, "m", { maxOutputTokens: 100 })).toEqual({
      ...req,
      generationConfig: { responseMimeType: "application/json", maxOutputTokens: 100 },
    });
  });
});

describe("classifyGeminiError", () => {
  test.each([
    [err(400, "API key not valid. Please pass a valid API key."), "invalid_key"],
    [err(403, "Permission denied"), "invalid_key"],
    [err(429, "Resource has been exhausted"), "rate_limit"],
    [err(503, "high demand"), "transient"],
    [err(504, "Request aborted"), "transient"],
    [new Error("fetch failed"), "transient"],
    [err(404, "model is not found"), "model"],
    [err(400, "Thinking level is not supported for this model"), "model"],
    [err(400, "Invalid argument"), "fatal"],
  ])("%s -> %s", (error, kind) => {
    expect(gemini.classifyGeminiError(error)).toBe(kind);
  });
});

describe("generateWithFallback", () => {
  test("uses only the primary when it works (does not touch other projects)", async () => {
    mockGenerate.mockResolvedValueOnce(ok("hello"));
    await expect(gemini.generateWithFallback("prompt")).resolves.toBe("hello");
    expect(calls()).toEqual(["key-one:gemini-3.6-flash"]);
  });

  test("passes the per-attempt timeout and the built request", async () => {
    mockGenerate.mockResolvedValueOnce(ok("x"));
    await gemini.generateWithFallback("p", { models: ["gemini-3.6-flash"], timeoutMs: 30000, maxOutputTokens: 4096, thinking: "minimal" });
    expect(mockGetModel.mock.calls[0][2].timeout).toBeLessThanOrEqual(30000);
    expect(mockGenerate.mock.calls[0][0].generationConfig).toEqual({ maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "minimal" } });
  });

  test("timeouts and server errors move to the next project and return its first success", async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error("Request aborted due to timeout"))
      .mockRejectedValueOnce(err(503, "high demand"))
      .mockResolvedValueOnce(ok("third"));
    await expect(gemini.generateWithFallback("p", { models: ["m"] })).resolves.toBe("third");
    expect(keysUsed()).toEqual(["key-one", "key-two", "key-three"]);
  });

  test("a project that just failed is skipped for 30 s, then the primary is tried again", async () => {
    const t0 = 5_000_000;
    const now = jest.spyOn(Date, "now").mockReturnValue(t0);
    mockGenerate.mockRejectedValueOnce(err(503, "high demand")).mockResolvedValue(ok("ok"));
    await gemini.generateWithFallback("p", { models: ["m"] }); // key1 fails -> key2
    await gemini.generateWithFallback("p", { models: ["m"] }); // key1 cooling -> key2 directly
    now.mockReturnValue(t0 + 31_000);
    await gemini.generateWithFallback("p", { models: ["m"] }); // cooldown over -> primary
    expect(keysUsed()).toEqual(["key-one", "key-two", "key-two", "key-one"]);
  });

  test("if every project is cooling down after errors, they are still tried rather than failing", async () => {
    mockGenerate.mockRejectedValueOnce(err(503)).mockRejectedValueOnce(err(503)).mockRejectedValueOnce(err(503));
    await expect(gemini.generateWithFallback("p", { models: ["m"] })).rejects.toThrow();
    mockGenerate.mockResolvedValueOnce(ok("recovered"));
    await expect(gemini.generateWithFallback("p", { models: ["m"] })).resolves.toBe("recovered");
  });

  test("429 moves to the next project; that project stays paused for Google's retryDelay", async () => {
    const t0 = 1_000_000;
    const now = jest.spyOn(Date, "now").mockReturnValue(t0);
    const limited = Object.assign(err(429, "quota"), { errorDetails: [{ retryDelay: "30s" }] });
    mockGenerate.mockRejectedValueOnce(limited).mockResolvedValue(ok("ok"));
    await gemini.generateWithFallback("p", { models: ["a"] });
    await gemini.generateWithFallback("p", { models: ["a"] });
    now.mockReturnValue(t0 + 31_000);
    await gemini.generateWithFallback("p", { models: ["a"] });
    expect(keysUsed()).toEqual(["key-one", "key-two", "key-two", "key-one"]);
  });

  test("rate-limit pauses are per model", async () => {
    mockGenerate.mockRejectedValueOnce(err(429, "quota")).mockResolvedValue(ok("ok"));
    await gemini.generateWithFallback("p", { models: ["a"] });
    await gemini.generateWithFallback("p", { models: ["b"] });
    expect(calls()).toEqual(["key-one:a", "key-two:a", "key-one:b"]);
  });

  test("all four projects rate limited: next model, then fail fast without new calls", async () => {
    process.env.GEMINI_API_KEY_4 = "key-four";
    mockGenerate.mockRejectedValue(err(429, "quota"));
    const error = await gemini.generateWithFallback("p", { models: ["a"] }).catch((e) => e);
    expect(error.kind).toBe("rate_limit");
    expect(keysUsed()).toEqual(["key-one", "key-two", "key-three", "key-four"]);
    mockGetModel.mockClear();
    expect((await gemini.generateWithFallback("p", { models: ["a"] }).catch((e) => e)).kind).toBe("rate_limit");
    expect(mockGetModel).not.toHaveBeenCalled();
  });

  test("an invalid key is skipped and stays disabled", async () => {
    mockGenerate.mockRejectedValueOnce(err(400, "API key not valid")).mockResolvedValue(ok("ok"));
    await gemini.generateWithFallback("p", { models: ["m"] });
    await gemini.generateWithFallback("p", { models: ["m"] });
    expect(keysUsed()).toEqual(["key-one", "key-two", "key-two"]);
  });

  test("an unsupported thinking setting falls back to the next model", async () => {
    mockGenerate.mockRejectedValueOnce(err(400, "thinking_level is not supported")).mockResolvedValueOnce(ok("lite"));
    await expect(gemini.generateWithFallback("p", { models: ["gemini-3.6-flash", "gemini-3.5-flash-lite"], thinking: "minimal" })).resolves.toBe("lite");
    expect(calls()).toEqual(["key-one:gemini-3.6-flash", "key-one:gemini-3.5-flash-lite"]);
  });

  test("a bad request stops immediately", async () => {
    mockGenerate.mockRejectedValueOnce(err(400, "Invalid argument"));
    await expect(gemini.generateWithFallback("p", { models: ["a", "b"] })).rejects.toThrow("Invalid argument");
    expect(mockGetModel).toHaveBeenCalledTimes(1);
  });

  test("attempts are capped (no endless retrying)", async () => {
    process.env.GEMINI_API_KEY_4 = "key-four";
    mockGenerate.mockRejectedValue(err(503, "high demand"));
    await expect(gemini.generateWithFallback("p", { models: ["a", "b", "c"] })).rejects.toThrow();
    expect(mockGetModel.mock.calls.length).toBeLessThanOrEqual(6);
  });

  test("error messages and logs never contain key values", async () => {
    mockGenerate.mockRejectedValueOnce(err(400, "bad AIzaSyA1234567890abcdefghijklmnop and ?key=secret123"));
    const error = await gemini.generateWithFallback("p", { models: ["a"] }).catch((e) => e);
    expect(error.message).not.toMatch(/AIzaSy|secret123/);
    for (const [line] of console.warn.mock.calls) expect(line).not.toMatch(/AIzaSy|secret123|key-one/);
  });
});

describe("streamWithFallback", () => {
  test("streams chunks from the primary", async () => {
    mockStream.mockImplementation(streamOf(["<p>Hello", " world</p>"]));
    const it = await gemini.streamWithFallback("p", { models: ["m"] });
    expect(await collect(it)).toBe("<p>Hello world</p>");
    expect(keysUsed()).toEqual(["key-one"]);
  });

  test("an error before the first token falls back to the next project", async () => {
    mockStream.mockRejectedValueOnce(err(503, "high demand")).mockImplementation(streamOf(["from key two"]));
    expect(await collect(await gemini.streamWithFallback("p", { models: ["m"] }))).toBe("from key two");
    expect(keysUsed()).toEqual(["key-one", "key-two"]);
  });

  test("no first token within the limit: aborts and uses the next project", async () => {
    mockStream.mockImplementationOnce(streamOf(["too slow"], { delayMs: 5000 })).mockImplementation(streamOf(["fast"]));
    const start = Date.now();
    expect(await collect(await gemini.streamWithFallback("p", { models: ["m"], firstTokenTimeoutMs: 100 }))).toBe("fast");
    expect(Date.now() - start).toBeLessThan(2000);
    expect(keysUsed()).toEqual(["key-one", "key-two"]);
  });

  test("an empty stream counts as a failure and falls back", async () => {
    mockStream.mockImplementationOnce(streamOf([])).mockImplementation(streamOf(["ok"]));
    expect(await collect(await gemini.streamWithFallback("p", { models: ["m"] }))).toBe("ok");
  });

  test("sends the abort signal and the built request", async () => {
    mockStream.mockImplementation(streamOf(["x"]));
    await collect(await gemini.streamWithFallback("p", { models: ["gemini-3.6-flash"], thinking: "minimal", maxOutputTokens: 4096 }));
    const [req, opts] = mockStream.mock.calls[0];
    expect(req.generationConfig).toEqual({ maxOutputTokens: 4096, thinkingConfig: { thinkingLevel: "minimal" } });
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("rateLimitCooldownMs", () => {
  test("uses Google's retryDelay", () => {
    expect(gemini.rateLimitCooldownMs({ errorDetails: [{ retryDelay: "37s" }] })).toBe(37000);
  });
  test("daily quotas pause for at least an hour", () => {
    expect(gemini.rateLimitCooldownMs({ errorDetails: [{ violations: [{ quotaId: "GenerateRequestsPerDay" }] }, { retryDelay: "20s" }] })).toBe(3600000);
  });
  test("defaults to 60 s", () => {
    expect(gemini.rateLimitCooldownMs(err(429, "quota"))).toBe(60000);
  });
});

describe("geminiErrorMessage", () => {
  test("friendly messages by error kind", () => {
    expect(gemini.geminiErrorMessage(err(400, "API key not valid"))).toMatch(/configuration/);
    expect(gemini.geminiErrorMessage(err(429, "quota"))).toMatch(/usage limit/);
    expect(gemini.geminiErrorMessage(err(503, "high demand"))).toMatch(/temporarily unavailable/);
    expect(gemini.geminiErrorMessage(new Error("weird"))).toBe("AI request failed. Please try again.");
  });
});
