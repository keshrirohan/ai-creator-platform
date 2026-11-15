"use server";

import { auth } from "@clerk/nextjs/server";
import { generateWithFallback, geminiErrorMessage } from "@/lib/gemini";
import { buildBlogPrompt, parseBlogReply, validateLanguage, validateTranscript } from "@/lib/voice-to-blog";

export async function generateBlogFromTranscript(transcript, blogLanguage = "same") {
  const { userId } = await auth();
  if (!userId) return { success: false, error: "Please sign in to use Voice to Blog" };

  const invalid =
    validateTranscript(transcript) ||
    (blogLanguage !== "same" && blogLanguage !== "auto" ? validateLanguage(blogLanguage) : null);
  if (invalid) return { success: false, error: invalid };

  try {
    const reply = await generateWithFallback({
      contents: [
        {
          role: "user",
          parts: [{ text: buildBlogPrompt(transcript.trim(), blogLanguage === "auto" ? "same" : blogLanguage) }],
        },
      ],
      generationConfig: { responseMimeType: "application/json" },
    });

    const blog = parseBlogReply(reply);
    if (!blog) return { success: false, error: "Couldn't create the blog. Please try again." };
    return { success: true, ...blog };
  } catch (error) {
    console.error("Voice-to-blog error:", error.message);
    return { success: false, error: geminiErrorMessage(error) };
  }
}
