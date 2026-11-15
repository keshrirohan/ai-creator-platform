/**
 * Tests for lib/translation.js — detection, prompt, sanitizing and parsing
 */
import {
  buildTranslationPrompt,
  collectUrls,
  defaultTargetLanguage,
  detectLanguage,
  isTranslationLanguage,
  parseTranslationReply,
  sanitizeTranslatedHtml,
} from "@/lib/translation";

describe("detectLanguage", () => {
  test.each([
    ["<p>Hello world, this is a blog.</p>", "english"],
    ["<h2>नमस्ते</h2><p>आज का दिन बहुत अच्छा है</p>", "hindi"],
    ["<p>வணக்கம் நண்பர்களே</p>", "tamil"],
    ["<p>আমি বাংলায় লিখি</p>", "bengali"],
    ["<p>Hi दोस्तों, आज हम सीखेंगे</p>", "hindi"],
  ])("%s -> %s", (html, lang) => {
    expect(detectLanguage(html)).toBe(lang);
  });

  test("ignores tags and attributes", () => {
    expect(detectLanguage('<p class="ql-align-center">नमस्ते दुनिया</p>')).toBe("hindi");
  });
});

describe("defaultTargetLanguage", () => {
  test("uses the browser language when supported and different", () => {
    expect(defaultTargetLanguage("english", ["ta-IN", "en"])).toBe("tamil");
    expect(defaultTargetLanguage("hindi", ["hi-IN", "en-US"])).toBe("english");
  });

  test("falls back to Hindi for English posts and English otherwise", () => {
    expect(defaultTargetLanguage("english", ["fr-FR"])).toBe("hindi");
    expect(defaultTargetLanguage("tamil", [])).toBe("english");
  });

  test("language whitelist", () => {
    expect(isTranslationLanguage("hindi")).toBe(true);
    expect(isTranslationLanguage("klingon")).toBe(false);
  });
});

describe("buildTranslationPrompt", () => {
  test("names the target, keeps HTML and treats content as data", () => {
    const p = buildTranslationPrompt({ title: "T", content: "<p>x</p>", language: "hindi" });
    expect(p).toMatch(/into Hindi \(Devanagari script\)/);
    expect(p).toMatch(/Keep every HTML tag and attribute/);
    expect(p).toMatch(/not instructions/);
    expect(p).toContain("<p>x</p>");
  });
});

describe("sanitizeTranslatedHtml", () => {
  const original = collectUrls(
    '<p><a href="https://example.com" target="_blank">x</a></p><img src="https://ik.imagekit.io/a.jpg">'
  );

  test("keeps Quill structure: headings, paragraphs, lists, formatting", () => {
    const html =
      '<h2>शीर्षक</h2><p class="ql-align-center"><strong>मोटा</strong> <em>तिरछा</em></p><ol><li data-list="bullet">एक</li></ol><blockquote>उद्धरण</blockquote>';
    expect(sanitizeTranslatedHtml(html, original)).toBe(html);
  });

  test("keeps links and images that exist in the original", () => {
    expect(sanitizeTranslatedHtml('<a href="https://example.com" target="_blank">लिंक</a>', original)).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">लिंक</a>'
    );
    expect(sanitizeTranslatedHtml('<img src="https://ik.imagekit.io/a.jpg">', original)).toBe(
      '<img src="https://ik.imagekit.io/a.jpg">'
    );
  });

  test("drops links and images the model invented", () => {
    expect(sanitizeTranslatedHtml('<a href="https://evil.com">x</a>', original)).toBe("<a>x</a>");
    expect(sanitizeTranslatedHtml('<img src="https://evil.com/t.png">', original)).toBe("");
  });

  test("removes scripts, event handlers, styles and javascript: URLs", () => {
    expect(sanitizeTranslatedHtml("<p>ok</p><script>alert(1)</script>", original)).toBe("<p>ok</p>");
    expect(sanitizeTranslatedHtml('<p onclick="x()" style="color:red">t</p>', original)).toBe("<p>t</p>");
    const js = collectUrls('<a href="javascript:alert(1)">x</a>');
    expect(sanitizeTranslatedHtml('<a href="javascript:alert(1)">x</a>', js)).toBe("<a>x</a>");
  });

  test("drops unknown tags but keeps their text, rejects bad class values", () => {
    expect(sanitizeTranslatedHtml("<div><marquee>t</marquee></div>", original)).toBe("t");
    expect(sanitizeTranslatedHtml('<p class="evil">t</p>', original)).toBe("<p>t</p>");
  });
});

describe("parseTranslationReply", () => {
  const originalContent = '<p><a href="https://example.com">Hi</a></p>';

  test("returns sanitized title, content and source language", () => {
    const reply = JSON.stringify({
      sourceLanguage: "English",
      title: "<b>नमस्ते</b>",
      content: '<p><a href="https://example.com">नमस्ते</a></p><script>x</script>',
    });
    expect(parseTranslationReply(reply, originalContent)).toEqual({
      title: "नमस्ते",
      content: '<p><a href="https://example.com">नमस्ते</a></p>',
      sourceLanguage: "English",
    });
  });

  test("reads the TITLE / CONTENT format, including HTML attribute quotes", () => {
    const reply =
      'SOURCE_LANGUAGE: English\nTITLE: दीपावली की शुभकामनाएं\nCONTENT:\n<h2>परिचय</h2><ol><li data-list="bullet">दीये</li></ol>\n<p>"उद्धरण" और <a href="https://example.com">लिंक</a></p>';
    expect(parseTranslationReply(reply, originalContent)).toEqual({
      sourceLanguage: "English",
      title: "दीपावली की शुभकामनाएं",
      content:
        '<h2>परिचय</h2><ol><li data-list="bullet">दीये</li></ol>\n<p>"उद्धरण" और <a href="https://example.com">लिंक</a></p>',
    });
  });

  test("handles fenced JSON", () => {
    const reply = '```json\n{"title":"t","content":"<p>c</p>"}\n```';
    expect(parseTranslationReply(reply, "")).toMatchObject({ title: "t", content: "<p>c</p>" });
  });

  test("rejects bad or empty replies", () => {
    expect(parseTranslationReply("not json", "")).toBeNull();
    expect(parseTranslationReply('{"title":"t"}', "")).toBeNull();
    expect(parseTranslationReply('{"title":"t","content":"<script>x</script>"}', "")).toBeNull();
  });
});
