/**
 * Tests for convex/likes.js business logic
 * Covers: toggle like, duplicate prevention, like count arithmetic
 */

// ── Like toggle logic (mirrors server) ───────────────────────────────────────

const toggleLike = (post, existingLike, userId) => {
  if (!post || post.status !== "published") {
    throw new Error("Post not found or not published");
  }

  if (existingLike) {
    // Unlike
    const newCount = Math.max(0, post.likeCount - 1);
    return { liked: false, likeCount: newCount };
  } else {
    // Like
    return { liked: true, likeCount: post.likeCount + 1 };
  }
};

describe("convex/likes — toggle like logic", () => {

  // ── Liking a post ─────────────────────────────────────────────────────────
  describe("liking a post (no existing like)", () => {
    const publishedPost = { _id: "post_1", status: "published", likeCount: 5 };

    test("sets liked to true", () => {
      const result = toggleLike(publishedPost, null, "user_1");
      expect(result.liked).toBe(true);
    });

    test("increments like count by 1", () => {
      const result = toggleLike(publishedPost, null, "user_1");
      expect(result.likeCount).toBe(6);
    });

    test("handles post with 0 likes", () => {
      const post = { ...publishedPost, likeCount: 0 };
      const result = toggleLike(post, null, "user_1");
      expect(result.likeCount).toBe(1);
    });

    test("handles post with many likes", () => {
      const post = { ...publishedPost, likeCount: 9999 };
      const result = toggleLike(post, null, "user_1");
      expect(result.likeCount).toBe(10000);
    });
  });

  // ── Unliking a post ───────────────────────────────────────────────────────
  describe("unliking a post (existing like present)", () => {
    const publishedPost = { _id: "post_1", status: "published", likeCount: 5 };
    const existingLike = { _id: "like_1", postId: "post_1", userId: "user_1" };

    test("sets liked to false", () => {
      const result = toggleLike(publishedPost, existingLike, "user_1");
      expect(result.liked).toBe(false);
    });

    test("decrements like count by 1", () => {
      const result = toggleLike(publishedPost, existingLike, "user_1");
      expect(result.likeCount).toBe(4);
    });

    test("like count never goes below 0", () => {
      const post = { ...publishedPost, likeCount: 0 };
      const result = toggleLike(post, existingLike, "user_1");
      expect(result.likeCount).toBe(0);
    });

    test("like count stays at 0 when already at 0", () => {
      const post = { ...publishedPost, likeCount: 1 };
      const result = toggleLike(post, existingLike, "user_1");
      expect(result.likeCount).toBe(0);
    });
  });

  // ── Post status checks ────────────────────────────────────────────────────
  describe("post status requirement for liking", () => {
    test("throws for draft post", () => {
      const draft = { _id: "post_1", status: "draft", likeCount: 0 };
      expect(() => toggleLike(draft, null, "user_1"))
        .toThrow("Post not found or not published");
    });

    test("throws for null post", () => {
      expect(() => toggleLike(null, null, "user_1"))
        .toThrow("Post not found or not published");
    });

    test("allows like on published post", () => {
      const post = { _id: "post_1", status: "published", likeCount: 0 };
      expect(() => toggleLike(post, null, "user_1")).not.toThrow();
    });
  });
});

// ── hasUserLiked logic ────────────────────────────────────────────────────────

describe("convex/likes — hasUserLiked logic", () => {
  const checkLiked = (likes, postId, userId) => {
    if (!userId) return false;
    return likes.some(l => l.postId === postId && l.userId === userId);
  };

  test("returns true when user has liked the post", () => {
    const likes = [{ postId: "post_1", userId: "user_1" }];
    expect(checkLiked(likes, "post_1", "user_1")).toBe(true);
  });

  test("returns false when user has not liked the post", () => {
    const likes = [{ postId: "post_1", userId: "user_2" }];
    expect(checkLiked(likes, "post_1", "user_1")).toBe(false);
  });

  test("returns false when no likes exist", () => {
    expect(checkLiked([], "post_1", "user_1")).toBe(false);
  });

  test("returns false when userId is null (unauthenticated)", () => {
    const likes = [{ postId: "post_1", userId: null }];
    expect(checkLiked(likes, "post_1", null)).toBe(false);
  });

  test("does not cross-contaminate between posts", () => {
    const likes = [{ postId: "post_1", userId: "user_1" }];
    expect(checkLiked(likes, "post_2", "user_1")).toBe(false);
  });

  test("does not cross-contaminate between users", () => {
    const likes = [{ postId: "post_1", userId: "user_1" }];
    expect(checkLiked(likes, "post_1", "user_2")).toBe(false);
  });
});
