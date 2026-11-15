import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Cached translation of a published post, or null.
// Returns null for posts that are missing, unpublished or changed since translation.
export const get = query({
  args: { postId: v.id("posts"), language: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post || post.status !== "published") return null;

    const row = await ctx.db
      .query("translations")
      .withIndex("by_post_language", (q) => q.eq("postId", args.postId).eq("language", args.language))
      .unique();
    if (!row || row.sourceUpdatedAt !== post.updatedAt) return null;

    return {
      language: row.language,
      sourceLanguage: row.sourceLanguage,
      title: row.title,
      content: row.content,
    };
  },
});

// Store a translation. Only the Next.js server can call this: it must pass
// TRANSLATION_CACHE_SECRET, which is set in both Convex and Vercel and never
// sent to browsers. This stops anyone from writing fake translations.
export const save = mutation({
  args: {
    secret: v.string(),
    postId: v.id("posts"),
    language: v.string(),
    sourceLanguage: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, { secret, ...args }) => {
    const expected = process.env.TRANSLATION_CACHE_SECRET;
    if (!expected || secret !== expected) throw new Error("Not authorized");

    const post = await ctx.db.get(args.postId);
    if (!post || post.status !== "published") throw new Error("Post not found or not published");
    if (args.title.length > 500 || args.content.length > 200_000) throw new Error("Translation too large");

    const existing = await ctx.db
      .query("translations")
      .withIndex("by_post_language", (q) => q.eq("postId", args.postId).eq("language", args.language))
      .unique();

    const data = { ...args, createdAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("translations", data);
  },
});
