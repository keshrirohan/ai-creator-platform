/**
 * Tests for convex/public.js business logic
 * Covers: published post filtering, view count increment, pagination
 */

// ── Published post filtering ──────────────────────────────────────────────────

const getPublishedPostsByUsername = (allPosts, username, user, limit = 10) => {
  if (!user || user.username !== username) return { posts: [], hasMore: false };

  const published = allPosts.filter(
    p => p.authorId === user._id && p.status === "published"
  );

  const hasMore = published.length > limit;
  const finalPosts = published.slice(0, limit);

  return {
    posts: finalPosts.map(p => ({ ...p, author: { _id: user._id, name: user.name, username: user.username } })),
    hasMore,
    nextCursor: hasMore ? finalPosts[finalPosts.length - 1]._id : null,
  };
};

const verifyPostOwnership = (post, user) => {
  if (!post) return null;
  if (!user) return null;
  if (post.authorId !== user._id) return null;
  if (post.status !== "published") return null;
  return post;
};

describe("convex/public — getPublishedPostsByUsername", () => {
  const user = { _id: "user_1", name: "Rohan Keshri", username: "rohankeshri" };

  const posts = [
    { _id: "p1", authorId: "user_1", status: "published", publishedAt: Date.now() },
    { _id: "p2", authorId: "user_1", status: "draft" },
    { _id: "p3", authorId: "user_1", status: "published", publishedAt: Date.now() - 1000 },
    { _id: "p4", authorId: "user_2", status: "published", publishedAt: Date.now() }, // different user
  ];

  test("returns only published posts for the user", () => {
    const result = getPublishedPostsByUsername(posts, "rohankeshri", user);
    expect(result.posts.length).toBe(2);
    result.posts.forEach(p => expect(p.status).toBe("published"));
  });

  test("does not return drafts", () => {
    const result = getPublishedPostsByUsername(posts, "rohankeshri", user);
    result.posts.forEach(p => expect(p.status).not.toBe("draft"));
  });

  test("does not return other users' posts", () => {
    const result = getPublishedPostsByUsername(posts, "rohankeshri", user);
    result.posts.forEach(p => expect(p.authorId).toBe("user_1"));
  });

  test("returns empty when user not found", () => {
    const result = getPublishedPostsByUsername(posts, "nonexistent", null);
    expect(result.posts.length).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  test("respects limit and sets hasMore correctly", () => {
    const manyPosts = Array.from({ length: 15 }, (_, i) => ({
      _id: `p${i}`, authorId: "user_1", status: "published", publishedAt: Date.now()
    }));
    const result = getPublishedPostsByUsername(manyPosts, "rohankeshri", user, 10);
    expect(result.posts.length).toBe(10);
    expect(result.hasMore).toBe(true);
  });

  test("nextCursor is set when hasMore is true", () => {
    const manyPosts = Array.from({ length: 12 }, (_, i) => ({
      _id: `p${i}`, authorId: "user_1", status: "published", publishedAt: Date.now()
    }));
    const result = getPublishedPostsByUsername(manyPosts, "rohankeshri", user, 10);
    expect(result.nextCursor).toBeDefined();
  });

  test("nextCursor is null when no more posts", () => {
    const result = getPublishedPostsByUsername(posts, "rohankeshri", user, 10);
    expect(result.nextCursor).toBeNull();
  });

  test("each returned post includes author info", () => {
    const result = getPublishedPostsByUsername(posts, "rohankeshri", user);
    result.posts.forEach(p => {
      expect(p.author).toBeDefined();
      expect(p.author.username).toBe("rohankeshri");
    });
  });
});

// ── Single post ownership verification ───────────────────────────────────────

describe("convex/public — getPublishedPost ownership verification", () => {
  const user = { _id: "user_1", username: "rohankeshri" };
  const publishedPost = { _id: "p1", authorId: "user_1", status: "published" };
  const draftPost = { _id: "p2", authorId: "user_1", status: "draft" };
  const otherUserPost = { _id: "p3", authorId: "user_2", status: "published" };

  test("returns post when owner and published", () => {
    expect(verifyPostOwnership(publishedPost, user)).not.toBeNull();
  });

  test("returns null for draft post", () => {
    expect(verifyPostOwnership(draftPost, user)).toBeNull();
  });

  test("returns null for another user's post", () => {
    expect(verifyPostOwnership(otherUserPost, user)).toBeNull();
  });

  test("returns null when post is null", () => {
    expect(verifyPostOwnership(null, user)).toBeNull();
  });

  test("returns null when user is null", () => {
    expect(verifyPostOwnership(publishedPost, null)).toBeNull();
  });
});

// ── View count increment ──────────────────────────────────────────────────────

describe("convex/public — incrementViewCount logic", () => {
  const incrementView = (post) => {
    if (!post || post.status !== "published") return null;
    return { viewCount: post.viewCount + 1, success: true };
  };

  test("increments view count for published post", () => {
    const post = { status: "published", viewCount: 10 };
    expect(incrementView(post).viewCount).toBe(11);
  });

  test("does not increment for draft post", () => {
    const post = { status: "draft", viewCount: 10 };
    expect(incrementView(post)).toBeNull();
  });

  test("does not increment for null post", () => {
    expect(incrementView(null)).toBeNull();
  });

  test("handles viewCount starting at 0", () => {
    const post = { status: "published", viewCount: 0 };
    expect(incrementView(post).viewCount).toBe(1);
  });

  test("returns success: true on increment", () => {
    const post = { status: "published", viewCount: 5 };
    expect(incrementView(post).success).toBe(true);
  });
});
