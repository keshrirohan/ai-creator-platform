import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { GENERATION_MODELS, geminiErrorMessage, streamWithFallback } from "@/lib/gemini";
import { buildGeneratePrompt, buildImprovePrompt, maxOutputTokensFor, validateBlogRequest } from "@/lib/blog-ai";

export const maxDuration = 60;

// Streams AI-written blog HTML to the post editor as plain text chunks.
export async function POST(request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Please sign in to use AI writing" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const invalid = validateBlogRequest(body);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const prompt =
    body.mode === "generate"
      ? buildGeneratePrompt({ title: body.title.trim(), category: body.category, tags: body.tags || [] })
      : buildImprovePrompt({ content: body.content, improvementType: body.improvementType });

  let chunks;
  try {
    // Resolves as soon as the first text arrives (fallback only happens before that)
    chunks = await streamWithFallback(prompt, {
      models: GENERATION_MODELS,
      thinking: "minimal",
      maxOutputTokens: maxOutputTokensFor(body),
    });
  } catch (error) {
    console.error("AI writing error:", error.message);
    return NextResponse.json({ error: geminiErrorMessage(error) }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await chunks.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (error) {
        console.error("AI writing stream error:", error.message);
        controller.error(error);
      }
    },
    async cancel() {
      await chunks.return?.(); // reader left: stop the Gemini request
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
