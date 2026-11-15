/**
 * Tests for lib/voice-transcription.js — editor voice input helpers
 */
import {
  MAX_AUDIO_BYTES,
  VOICE_LANGUAGES,
  buildTranscriptionPrompt,
  normalizeAudioType,
  parseJsonReply,
  parseTranscriptionReply,
  validateAudio,
  validateLanguage,
} from "@/lib/voice-transcription";

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
    expect(validateAudio({ type: "audio/webm", size: MAX_AUDIO_BYTES + 1 })).toMatch(/too large/);
    expect(validateAudio()).toMatch(/Unsupported/);
  });
});

describe("languages", () => {
  test("English, Hindi and auto-detect are supported", () => {
    const values = VOICE_LANGUAGES.map((l) => l.value);
    expect(values).toEqual(expect.arrayContaining(["auto", "english", "hindi", "hinglish", "tamil"]));
  });

  test("validateLanguage whitelists values", () => {
    expect(validateLanguage("hindi")).toBeNull();
    expect(validateLanguage("french")).toMatch(/valid language/);
  });

  test("transcription prompt handles auto, Hinglish and specific languages", () => {
    expect(buildTranscriptionPrompt("auto")).toMatch(/Detect the spoken language/);
    expect(buildTranscriptionPrompt("hinglish")).toMatch(/Roman\/Latin script/);
    expect(buildTranscriptionPrompt("tamil")).toMatch(/using Tamil/);
    expect(buildTranscriptionPrompt("hindi")).toMatch(/Do not translate/);
  });
});

describe("reply parsing", () => {
  test("parses plain, fenced and wrapped JSON", () => {
    expect(parseJsonReply('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonReply('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonReply('Here: {"a":1} done')).toEqual({ a: 1 });
    expect(parseJsonReply("nope")).toBeNull();
  });

  test("parseTranscriptionReply returns trimmed transcript and language", () => {
    expect(parseTranscriptionReply('{"language":"Hindi","transcript":" नमस्ते दोस्तों "}')).toEqual({
      transcript: "नमस्ते दोस्तों",
      language: "Hindi",
    });
    expect(parseTranscriptionReply('{"language":""}')).toBeNull();
  });
});
