/**
 * Tests for lib/voice-to-blog.js — audio validation, prompts, parsing, sanitizing
 */
import {
  MAX_AUDIO_BYTES,
  MAX_TRANSCRIPT_CHARS,
  buildBlogPrompt,
  buildTranscriptionPrompt,
  normalizeAudioType,
  parseBlogReply,
  parseJsonReply,
  parseTranscriptionReply,
  sanitizeBlogHtml,
  validateAudio,
  validateLanguage,
  validateTranscript,
} from "@/lib/voice-to-blog";

describe("normalizeAudioType", () => {
  test("strips codec parameters and maps aliases", () => {
    expect(normalizeAudioType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioType("audio/ogg; codecs=opus")).toBe("audio/ogg");
    expect(normalizeAudioType("audio/x-wav")).toBe("audio/wav");
    expect(normalizeAudioType("audio/mpeg")).toBe("audio/mp3");
    expect(normalizeAudioType("AUDIO/MP4")).toBe("audio/mp4");
  });

  test("rejects non-audio types", () => {
    expect(normalizeAudioType("video/mp4")).toBeNull();
    expect(normalizeAudioType("image/png")).toBeNull();
    expect(normalizeAudioType("")).toBeNull();
    expect(normalizeAudioType()).toBeNull();
  });
});

describe("validateAudio", () => {
  test("accepts a normal recording", () => {
    expect(validateAudio({ type: "audio/webm;codecs=opus", size: 200_000 })).toBeNull();
  });

  test("rejects wrong type, empty and oversized files", () => {
    expect(validateAudio({ type: "text/plain", size: 5000 })).toMatch(/Unsupported/);
    expect(validateAudio({ type: "audio/webm", size: 100 })).toMatch(/empty/);
    expect(validateAudio({ type: "audio/webm", size: 0 })).toMatch(/empty/);
    expect(validateAudio({ type: "audio/webm", size: MAX_AUDIO_BYTES + 1 })).toMatch(/too large/);
    expect(validateAudio()).toMatch(/Unsupported/);
  });
});

describe("validateLanguage / validateTranscript", () => {
  test("languages are whitelisted", () => {
    expect(validateLanguage("auto")).toBeNull();
    expect(validateLanguage("hindi")).toBeNull();
    expect(validateLanguage("french")).toMatch(/valid language/);
    expect(validateLanguage(undefined)).toMatch(/valid language/);
  });

  test("transcript length limits", () => {
    expect(validateTranscript("short")).toMatch(/too short/);
    expect(validateTranscript("   ".repeat(20))).toMatch(/too short/);
    expect(validateTranscript(null)).toMatch(/too short/);
    expect(validateTranscript("a".repeat(MAX_TRANSCRIPT_CHARS + 1))).toMatch(/too long/);
    expect(validateTranscript("This is a long enough transcript.")).toBeNull();
  });
});

describe("prompts", () => {
  test("transcription prompt handles auto, Hinglish and specific languages", () => {
    expect(buildTranscriptionPrompt("auto")).toMatch(/Detect the spoken language/);
    expect(buildTranscriptionPrompt("hinglish")).toMatch(/Roman\/Latin script/);
    expect(buildTranscriptionPrompt("tamil")).toMatch(/using Tamil/);
    expect(buildTranscriptionPrompt("auto")).toMatch(/Do not translate/);
  });

  test("blog prompt asks for structure and fences the transcript", () => {
    const p = buildBlogPrompt("my spoken words", "same");
    expect(p).toMatch(/same language/);
    expect(p).toMatch(/introduction/);
    expect(p).toMatch(/conclusion/);
    expect(p).toMatch(/<h2>/);
    expect(p).toContain("<<<TRANSCRIPT>>>\nmy spoken words\n<<<END>>>");
    expect(buildBlogPrompt("x", "hindi")).toMatch(/Hindi \(Devanagari script\)/);
  });
});

describe("sanitizeBlogHtml", () => {
  test("keeps allowed formatting tags", () => {
    const html = "<h2>Title</h2><p>Some <strong>bold</strong> and <em>italic</em></p><ul><li>one</li></ul>";
    expect(sanitizeBlogHtml(html)).toBe(html);
  });

  test("removes scripts, styles, iframes and their content", () => {
    expect(sanitizeBlogHtml('<p>ok</p><script>alert("x")</script>')).toBe("<p>ok</p>");
    expect(sanitizeBlogHtml("<style>p{}</style><p>ok</p>")).toBe("<p>ok</p>");
    expect(sanitizeBlogHtml('<iframe src="evil"></iframe><p>ok</p>')).toBe("<p>ok</p>");
  });

  test("strips all attributes, including event handlers and links", () => {
    expect(sanitizeBlogHtml('<p onclick="steal()" class="x">hi</p>')).toBe("<p>hi</p>");
    expect(sanitizeBlogHtml('<h2 style="color:red">t</h2>')).toBe("<h2>t</h2>");
  });

  test("drops disallowed tags but keeps their text", () => {
    expect(sanitizeBlogHtml('<p><a href="javascript:x">link</a></p>')).toBe("<p>link</p>");
    expect(sanitizeBlogHtml('<img src=x onerror="alert(1)"><p>t</p>')).toBe("<p>t</p>");
    expect(sanitizeBlogHtml("<div><span>t</span></div>")).toBe("t");
  });

  test("normalises br and removes comments", () => {
    expect(sanitizeBlogHtml("<p>a<br/>b</p><!-- note -->")).toBe("<p>a<br>b</p>");
  });
});

describe("JSON reply parsing", () => {
  test("parses plain JSON, fenced JSON and JSON with extra text", () => {
    expect(parseJsonReply('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonReply('Here you go: {"a":1} thanks')).toEqual({ a: 1 });
    expect(parseJsonReply("not json")).toBeNull();
  });

  test("parseTranscriptionReply returns transcript and language", () => {
    expect(parseTranscriptionReply('{"language":"Hindi","transcript":" नमस्ते दोस्तों "}')).toEqual({
      transcript: "नमस्ते दोस्तों",
      language: "Hindi",
    });
    expect(parseTranscriptionReply('{"language":""}')).toBeNull();
    expect(parseTranscriptionReply("garbage")).toBeNull();
  });

  test("parseBlogReply sanitizes content and cleans the title", () => {
    const reply = JSON.stringify({
      title: "<b>My Blog</b>",
      content: '<p onclick="x">Intro</p><script>bad()</script><h2>Section</h2>',
    });
    expect(parseBlogReply(reply)).toEqual({ title: "My Blog", content: "<p>Intro</p><h2>Section</h2>" });
  });

  test("parseBlogReply rejects missing or empty fields", () => {
    expect(parseBlogReply('{"title":"t"}')).toBeNull();
    expect(parseBlogReply('{"title":"","content":"<p>x</p>"}')).toBeNull();
    expect(parseBlogReply('{"title":"t","content":"<script>x</script>"}')).toBeNull();
  });

  test("parseBlogReply caps the title at 200 characters", () => {
    const reply = JSON.stringify({ title: "a".repeat(300), content: "<p>x</p>" });
    expect(parseBlogReply(reply).title.length).toBe(200);
  });
});
