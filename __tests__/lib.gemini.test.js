/**
 * @jest-environment node
 *
 * Tests for lib/gemini.js — model fallback order, per-attempt timeout, retries
 */

const mockGenerate = jest.fn();
const mockGetModel = jest.fn(() => ({ generateContent: mockGenerate }));

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: mockGetModel })),
}));
jest.mock("@/lib/dev-usage", () => ({ recordGeminiCall: jest.fn() }));

const ok = (text) => ({ response: { text: () => text } });

let gemini;
beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  gemini = await import("@/lib/gemini");
});
afterEach(() => jest.restoreAllMocks());

describe("isRetryableModelError", () => {
  test.each([
    "[503 Service Unavailable] high demand",
    "[429 Too Many Requests]",
    "[404 Not Found] no longer available",
    "Request aborted when fetching",
    "The operation timed out",
  ])("retries on %s", (msg) => {
    expect(gemini.isRetryableModelError(new Error(msg))).toBe(true);
  });

  test("does not retry on a bad request", () => {
    expect(gemini.isRetryableModelError(new Error("[400 Bad Request] invalid argument"))).toBe(false);
  });
});

describe("generateWithFallback", () => {
  test("uses the default model order and returns the first success", async () => {
    mockGenerate.mockResolvedValueOnce(ok("hello"));
    await expect(gemini.generateWithFallback("prompt")).resolves.toBe("hello");
    expect(mockGetModel).toHaveBeenCalledTimes(1);
    expect(mockGetModel.mock.calls[0][0]).toEqual({ model: "gemini-3.8-flash" });
    expect(mockGetModel.mock.calls[0][1]).toBeUndefined();
  });

  test("FAST_MODELS puts Flash-Lite first and passes the timeout", async () => {
    mockGenerate.mockResolvedValueOnce(ok("fast"));
    await gemini.generateWithFallback("p", { models: gemini.FAST_MODELS, timeoutMs: 40000 });
    expect(mockGetModel.mock.calls[0]).toEqual([{ model: "gemini-flash-lite-latest" }, { timeout: 40000 }]);
  });

  test("skips an overloaded or timed-out model and tries the next", async () => {
    mockGenerate
      .mockRejectedValueOnce(new Error("[503 Service Unavailable] high demand"))
      .mockRejectedValueOnce(new Error("Request aborted due to timeout"))
      .mockResolvedValueOnce(ok("third"));
    await expect(gemini.generateWithFallback("p", { models: ["a", "b", "c"] })).resolves.toBe("third");
    expect(mockGetModel.mock.calls.map((c) => c[0].model)).toEqual(["a", "b", "c"]);
  });

  test("stops immediately on a non-retryable error", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("[400 Bad Request] invalid"));
    await expect(gemini.generateWithFallback("p", { models: ["a", "b"] })).rejects.toThrow("400");
    expect(mockGetModel).toHaveBeenCalledTimes(1);
  });

  test("passes the request object through unchanged (audio + config)", async () => {
    mockGenerate.mockResolvedValueOnce(ok("{}"));
    const request = { contents: [{ parts: [{ inlineData: { mimeType: "audio/webm", data: "x" } }] }] };
    await gemini.generateWithFallback(request, { models: ["a"] });
    expect(mockGenerate).toHaveBeenCalledWith(request);
  });
});

describe("geminiErrorMessage", () => {
  test("maps errors to friendly messages without raw details", () => {
    expect(gemini.geminiErrorMessage(new Error("API key not valid"))).toMatch(/configuration/);
    expect(gemini.geminiErrorMessage(new Error("[503] high demand"))).toMatch(/temporarily unavailable/);
    expect(gemini.geminiErrorMessage(new Error("weird internal thing"))).toBe("AI request failed. Please try again.");
  });
});
