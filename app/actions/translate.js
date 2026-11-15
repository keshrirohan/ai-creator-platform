"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { TRANSLATION_MODELS, generateWithFallback, geminiErrorMessage } from "@/lib/gemini";

// Requests already running on this server, so readers who ask for the same
// post + language at the same time share one Gemini call.
const inFlight = new Map();
import {
  MAX_TRANSLATE_CHARS,
  buildTranslationPrompt,
  isTranslationLanguage,
  parseTranslationReply,
} from "@/lib/translation";

/**
 * Translate a published post for a reader. Open to signed-out readers.
 * Each post + language is translated by Gemini at most once, then served from
 * the Convex cache until the author edits the post.
 */
export async function translatePost({ username, postId, language } = {}) {
  if (!isTranslationLanguage(language)) return { success: false, error: "Please choose a supported language" };
  if (typeof username !== "string" || username.length > 40 || typeof postId !== "string" || postId.length > 64) {
    return { success: false, error: "Post not found" };
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);

  let post;
  try {
    post = await convex.query(api.public.getPublishedPost, { username, postId });
  } catch {
    post = null; // invalid id format
  }
  if (!post) return { success: false, error: "Post not found" };

  const cached = await convex.query(api.translations.get, { postId, language }).catch(() => null);
  if (cached) return { success: true, cached: true, ...cached };

  if (post.content.length > MAX_TRANSLATE_CHARS) {
    return { success: false, error: "This post is too long to translate" };
  }

  const flightKey = `${postId}:${language}:${post.updatedAt}`;
  if (inFlight.has(flightKey)) return inFlight.get(flightKey);

  const run = translateAndCache({ convex, post, postId, language });
  inFlight.set(flightKey, run);
  try {
    return await run;
  } finally {
    inFlight.delete(flightKey);
  }
}

async function translateAndCache({ convex, post, postId, language }) {
  let result;
  try {
    // Flash-Lite: Google's translation model (~1.3 s first token, ~8 s for a long post).
    // Output cap sized to the post so nothing is cut off.
    const reply = await generateWithFallback(
      buildTranslationPrompt({ title: post.title, content: post.content, language }),
      {
        models: TRANSLATION_MODELS,
        timeoutMs: 30_000,
        maxOutputTokens: Math.min(16384, Math.max(1024, Math.ceil(post.content.length * 0.9))),
      }
    );
    result = parseTranslationReply(reply, post.content);
  } catch (error) {
    console.error("Translation error:", error.message);
    return { success: false, error: geminiErrorMessage(error) };
  }
  if (!result) return { success: false, error: "Couldn't translate this post. Please try again." };

  // Cache for every future reader. A failed save doesn't block this reader.
  const secret = process.env.TRANSLATION_CACHE_SECRET;
  if (secret) {
    try {
      await convex.mutation(api.translations.save, {
        secret,
        postId,
        language,
        sourceLanguage: result.sourceLanguage || undefined,
        title: result.title,
        content: result.content,
        sourceUpdatedAt: post.updatedAt,
      });
    } catch (error) {
      console.warn("Could not cache translation:", error.message);
    }
  } else {
    console.warn("TRANSLATION_CACHE_SECRET is not set; translations are not cached");
  }

  return { success: true, cached: false, language, ...result };
}
