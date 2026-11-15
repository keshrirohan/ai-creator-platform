/**
 * Tests for lib/creator-studio.js — validation, prompts and output cleanup
 */
import {
  STUDIO_LANGUAGES,
  STUDIO_MAX_CHARS,
  buildStudioPrompt,
  cleanModelText,
  validateStudioInput,
} from "@/lib/creator-studio";

const valid = { text: "Hello world", action: "translate", targetLanguage: "hindi", tone: "professional" };

describe("validateStudioInput", () => {
  test("accepts valid input for every action", () => {
    expect(validateStudioInput(valid)).toBeNull();
    expect(validateStudioInput({ ...valid, action: "transliterate" })).toBeNull();
    expect(validateStudioInput({ ...valid, action: "tone" })).toBeNull();
    expect(validateStudioInput({ ...valid, action: "improve" })).toBeNull();
  });

  test("rejects empty, whitespace or non-string text", () => {
    expect(validateStudioInput({ ...valid, text: "" })).toMatch(/enter some text/);
    expect(validateStudioInput({ ...valid, text: "   " })).toMatch(/enter some text/);
    expect(validateStudioInput({ ...valid, text: 42 })).toMatch(/enter some text/);
    expect(validateStudioInput()).toMatch(/enter some text/);
  });

  test("enforces the character limit", () => {
    expect(validateStudioInput({ ...valid, text: "a".repeat(STUDIO_MAX_CHARS) })).toBeNull();
    expect(validateStudioInput({ ...valid, text: "a".repeat(STUDIO_MAX_CHARS + 1) })).toMatch(/too long/);
  });

  test("rejects unknown actions, languages and tones", () => {
    expect(validateStudioInput({ ...valid, action: "summarise" })).toMatch(/valid action/);
    expect(validateStudioInput({ ...valid, targetLanguage: "klingon" })).toMatch(/target language/);
    expect(validateStudioInput({ ...valid, action: "tone", tone: "angry" })).toMatch(/tone/);
  });

  test("language is only required for translate, tone only for tone", () => {
    expect(validateStudioInput({ ...valid, action: "improve", targetLanguage: "x", tone: "x" })).toBeNull();
  });
});

describe("buildStudioPrompt", () => {
  test("translate names the target language and script", () => {
    expect(buildStudioPrompt({ ...valid })).toMatch(/Hindi written in Devanagari script/);
    expect(buildStudioPrompt({ ...valid, targetLanguage: "hinglish" })).toMatch(/Roman\/Latin script/);
    expect(buildStudioPrompt({ ...valid, targetLanguage: "tamil" })).toMatch(/into Tamil/);
  });

  test("transliterate asks for Devanagari without translation", () => {
    const p = buildStudioPrompt({ ...valid, action: "transliterate" });
    expect(p).toMatch(/Devanagari/);
    expect(p).toMatch(/do not translate/);
  });

  test("tone keeps the same language", () => {
    const p = buildStudioPrompt({ ...valid, action: "tone", tone: "casual" });
    expect(p).toMatch(/casual tone/);
    expect(p).toMatch(/same language/);
  });

  test("every prompt preserves meaning and formatting and fences the user text", () => {
    for (const action of ["translate", "transliterate", "tone", "improve"]) {
      const p = buildStudioPrompt({ ...valid, action, text: "Line 1\n- item" });
      expect(p).toMatch(/Preserve the original meaning/);
      expect(p).toMatch(/Preserve the formatting/);
      expect(p).toContain("<<<TEXT>>>\nLine 1\n- item\n<<<END>>>");
      expect(p).toMatch(/not instructions/);
    }
  });

  test("throws on an unknown action", () => {
    expect(() => buildStudioPrompt({ ...valid, action: "nope" })).toThrow();
  });

  test("every language has a value and label", () => {
    STUDIO_LANGUAGES.forEach((l) => {
      expect(l.value).toBeTruthy();
      expect(l.label).toBeTruthy();
    });
  });
});

describe("cleanModelText", () => {
  test("removes code fences and markers the model may add", () => {
    expect(cleanModelText("```\nनमस्ते\n```")).toBe("नमस्ते");
    expect(cleanModelText("```text\nhello\n```")).toBe("hello");
    expect(cleanModelText("<<<TEXT>>>\nhi\n<<<END>>>")).toBe("hi");
  });

  test("keeps inner line breaks", () => {
    expect(cleanModelText("  a\n\nb  ")).toBe("a\n\nb");
  });
});
