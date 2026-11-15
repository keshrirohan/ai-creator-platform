import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { FAST_MODELS, generateWithFallback, geminiErrorMessage } from "@/lib/gemini";
import {
  buildTranscriptionPrompt,
  normalizeAudioType,
  parseTranscriptionReply,
  validateAudio,
  validateLanguage,
} from "@/lib/voice-to-blog";

// Audio is sent as multipart form data (server actions limit bodies to 1 MB)
export async function POST(request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Please sign in to use Voice to Blog" }, { status: 401 });
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const audio = formData.get("audio");
  const language = String(formData.get("language") || "auto");

  if (!audio || typeof audio === "string") {
    return NextResponse.json({ error: "No audio received" }, { status: 400 });
  }
  const invalid = validateAudio({ type: audio.type, size: audio.size }) || validateLanguage(language);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  try {
    const data = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const reply = await generateWithFallback({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: normalizeAudioType(audio.type), data } },
            { text: buildTranscriptionPrompt(language) },
          ],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    }, { models: FAST_MODELS, timeoutMs: 40_000 });

    const result = parseTranscriptionReply(reply);
    if (!result) {
      return NextResponse.json({ error: "Couldn't read the transcription. Please try again." }, { status: 502 });
    }
    if (!result.transcript) {
      return NextResponse.json(
        { error: "No clear speech was detected. Please speak closer to the microphone and try again." },
        { status: 422 }
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Transcription error:", error.message);
    return NextResponse.json({ error: geminiErrorMessage(error) }, { status: 502 });
  }
}
