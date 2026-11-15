/**
 * Tests for lib/blog-ai.js — prompts, validation, output caps, stream cleanup
 */
import {
  buildGeneratePrompt,
  buildImprovePrompt,
  cleanStreamedHtml,
  htmlTextLength,
  maxOutputTokensFor,
  validateBlogRequest,
} from "@/lib/blog-ai";

describe("prompts", () => {
  test("generate prompt keeps every requirement in a short prompt", () => {
    const p = buildGeneratePrompt({ title: "Learn to code", category: "Education", tags: ["coding", "students"] });
    for (const s of ["Learn to code", "Category: Education", "Tags: coding, students", "800-1200 words", "<h2>", "3-5 sections", "Do not repeat the title"]) {
      expect(p).toContain(s);
    }
    expect(p.length).toBeLessThan(600);
  });

  test("generate prompt omits empty category and tags", () => {
    const p = buildGeneratePrompt({ title: "T", tags: [] });
    expect(p).not.toMatch(/Category|Tags/);
  });

  test("improve prompts fence the content and keep language and structure", () => {
    for (const type of ["enhance", "expand", "simplify"]) {
      const p = buildImprovePrompt({ content: "<p>x</p>", improvementType: type });
      expect(p).toContain("<<<BLOG>>>\n<p>x</p>\n<<<END>>>");
      expect(p).toMatch(/original language and HTML structure/);
    }
  });
});

describe("maxOutputTokensFor", () => {
  test("generation has a fixed cap", () => {
    expect(maxOutputTokensFor({ mode: "generate" })).toBe(4096);
  });
  test("improve scales with input, more for expand, within 1024-8192", () => {
    const content = "a".repeat(6000);
    expect(maxOutputTokensFor({ mode: "improve", content, improvementType: "expand" })).toBe(5000);
    expect(maxOutputTokensFor({ mode: "improve", content, improvementType: "simplify" })).toBe(3000);
    expect(maxOutputTokensFor({ mode: "improve", content: "short", improvementType: "enhance" })).toBe(1024);
    expect(maxOutputTokensFor({ mode: "improve", content: "a".repeat(40000), improvementType: "expand" })).toBe(8192);
  });
});

describe("validateBlogRequest", () => {
  test("accepts valid generate and improve requests", () => {
    expect(validateBlogRequest({ mode: "generate", title: "T", tags: ["a"] })).toBeNull();
    expect(validateBlogRequest({ mode: "improve", content: "<p>x</p>", improvementType: "expand" })).toBeNull();
  });
  test("rejects bad input", () => {
    expect(validateBlogRequest(null)).toMatch(/Invalid/);
    expect(validateBlogRequest({ mode: "chat" })).toMatch(/Invalid/);
    expect(validateBlogRequest({ mode: "generate", title: " " })).toMatch(/Title is required/);
    expect(validateBlogRequest({ mode: "generate", title: "a".repeat(201) })).toMatch(/too long/);
    expect(validateBlogRequest({ mode: "generate", title: "T", tags: Array(11).fill("x") })).toMatch(/tags/);
    expect(validateBlogRequest({ mode: "improve", content: "x", improvementType: "rewrite" })).toMatch(/improvement type/);
    expect(validateBlogRequest({ mode: "improve", content: "a".repeat(50001), improvementType: "enhance" })).toMatch(/too long/);
  });
});

describe("cleanStreamedHtml", () => {
  test("removes code fences and a half-written trailing tag", () => {
    expect(cleanStreamedHtml("```html\n<h2>Intro</h2><p>Hel")).toBe("<h2>Intro</h2><p>Hel");
    expect(cleanStreamedHtml("<p>Done</p><h")).toBe("<p>Done</p>");
    expect(cleanStreamedHtml("<p>x</p>\n```")).toBe("<p>x</p>");
  });
  test("htmlTextLength counts visible text only", () => {
    expect(htmlTextLength("<h2>Ab</h2> <p>cd</p>")).toBe(5);
  });
});
