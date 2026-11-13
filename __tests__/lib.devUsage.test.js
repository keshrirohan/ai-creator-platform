/**
 * @jest-environment node
 *
 * Tests for lib/dev-usage.js — local Gemini request tracking for the dev bar
 */

import fs from "fs";
import os from "os";
import path from "path";

let tmpDir;
let devUsage;

beforeEach(async () => {
  jest.resetModules();
  // Jest runs with NODE_ENV=test, so turn dev mode on explicitly
  process.env.NEXT_PUBLIC_DEV_MODE = "true";
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dev-usage-"));
  jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
  devUsage = await import("@/lib/dev-usage");
});

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.NEXT_PUBLIC_DEV_MODE;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("dev mode off", () => {
  test("does not write anything when dev mode is disabled", async () => {
    jest.resetModules();
    delete process.env.NEXT_PUBLIC_DEV_MODE;
    const offModule = await import("@/lib/dev-usage");
    await offModule.recordGeminiCall({ model: "gemini-3.8-flash", ok: true });
    expect(fs.existsSync(path.join(tmpDir, ".dev-usage.json"))).toBe(false);
  });
});

const readUsageFile = () =>
  JSON.parse(fs.readFileSync(path.join(tmpDir, ".dev-usage.json"), "utf8"));

describe("pacificDate", () => {
  test("returns YYYY-MM-DD", () => {
    expect(devUsage.pacificDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("uses Pacific time (07:00 UTC is still the previous day in LA)", () => {
    expect(devUsage.pacificDate(new Date("2026-11-13T07:00:00Z"))).toBe("2026-11-12");
    expect(devUsage.pacificDate(new Date("2026-11-13T09:00:00Z"))).toBe("2026-11-13");
  });
});

describe("readGeminiUsage", () => {
  test("returns an empty record when nothing has been tracked", async () => {
    const usage = await devUsage.readGeminiUsage();
    expect(usage.models).toEqual({});
    expect(usage.date).toBe(devUsage.pacificDate());
  });

  test("starts fresh when the stored date is a previous day", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".dev-usage.json"),
      JSON.stringify({ gemini: { date: "2000-01-01", models: { x: { success: 5 } } } })
    );
    const usage = await devUsage.readGeminiUsage();
    expect(usage.models).toEqual({});
  });

  test("handles a corrupt file without throwing", async () => {
    fs.writeFileSync(path.join(tmpDir, ".dev-usage.json"), "{not json");
    await expect(devUsage.readGeminiUsage()).resolves.toMatchObject({ models: {} });
  });
});

describe("recordGeminiCall", () => {
  test("counts successful calls per model", async () => {
    await devUsage.recordGeminiCall({ model: "gemini-3.8-flash", ok: true });
    await devUsage.recordGeminiCall({ model: "gemini-3.8-flash", ok: true });
    const data = readUsageFile();
    expect(data.gemini.models["gemini-3.8-flash"].success).toBe(2);
    expect(data.gemini.lastSuccess.model).toBe("gemini-3.8-flash");
  });

  test("classifies 503 'high demand' errors as overloaded", async () => {
    await devUsage.recordGeminiCall({
      model: "gemini-3.8-flash",
      ok: false,
      error: new Error("[503 Service Unavailable] This model is currently experiencing high demand"),
    });
    expect(readUsageFile().gemini.models["gemini-3.8-flash"].overloaded).toBe(1);
  });

  test("classifies 429 errors as rate limited", async () => {
    await devUsage.recordGeminiCall({
      model: "gemini-3.8-flash",
      ok: false,
      error: new Error("[429 Too Many Requests] quota exceeded"),
    });
    expect(readUsageFile().gemini.models["gemini-3.8-flash"].rateLimited).toBe(1);
  });

  test("classifies other errors as failed and stores the last error", async () => {
    await devUsage.recordGeminiCall({
      model: "gemini-flash-lite-latest",
      ok: false,
      error: new Error("Something else broke"),
    });
    const data = readUsageFile();
    expect(data.gemini.models["gemini-flash-lite-latest"].failed).toBe(1);
    expect(data.gemini.lastError.message).toBe("Something else broke");
  });

  test("keeps separate counts for each model", async () => {
    await devUsage.recordGeminiCall({ model: "gemini-3.8-flash", ok: true });
    await devUsage.recordGeminiCall({ model: "gemini-3.5-flash-lite", ok: true });
    await devUsage.recordGeminiCall({ model: "gemini-3.5-flash-lite", ok: true });
    const { models } = readUsageFile().gemini;
    expect(models["gemini-3.8-flash"].success).toBe(1);
    expect(models["gemini-3.5-flash-lite"].success).toBe(2);
  });

  test("never throws, even if the file can't be written", async () => {
    jest.spyOn(fs.promises, "writeFile").mockRejectedValue(new Error("disk full"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    await expect(devUsage.recordGeminiCall({ model: "m", ok: true })).resolves.toBeUndefined();
  });
});
