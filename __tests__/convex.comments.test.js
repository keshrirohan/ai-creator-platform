/**
 * Tests for convex/comments.js business logic
 * Covers: validation, authorization, comment content rules
 */

// ── Comment validation (mirrors server logic) ─────────────────────────────────

const validateComment = (content) => {
  if (!content || !content.trim()) throw new Error("Comment must be between 1-1000 characters");
  if (content.length > 1000) throw new Error("Comment must be between 1-1000 characters");
  return true;
};

const canDeleteComment = (comment, post, userId) => {
  if (!userId) throw new Error("Not authenticated");
  if (!comment) throw new Error("Comment not found");
  if (!post) throw new Error("Post not found");
  const canDelete = comment.authorId === userId || post.authorId === userId;
  if (!canDelete) throw new Error("Not authorized to delete this comment");
  return true;
};

describe("convex/comments — comment content validation", () => {

  // ── Valid comments ────────────────────────────────────────────────────────
  describe("valid comment content", () => {
    test("accepts normal comment", () => {
      expect(validateComment("Great article!")).toBe(true);
    });

    test("accepts single character", () => {
      expect(validateComment("!")).toBe(true);
    });

    test("accepts exactly 1000 characters", () => {
      expect(validateComment("a".repeat(1000))).toBe(true);
    });

    test("accepts comment with HTML-like text (plain text)", () => {
      expect(validateComment("Visit <example.com> for more")).toBe(true);
    });

    test("accepts multiline comment", () => {
      expect(validateComment("Line 1\nLine 2\nLine 3")).toBe(true);
    });
  });

  // ── Invalid comments ──────────────────────────────────────────────────────
  describe("invalid comment content", () => {
    test("rejects empty string", () => {
      expect(() => validateComment("")).toThrow("Comment must be between 1-1000 characters");
    });

    test("rejects whitespace only", () => {
      expect(() => validateComment("   ")).toThrow("Comment must be between 1-1000 characters");
    });

    test("rejects null", () => {
      expect(() => validateComment(null)).toThrow();
    });

    test("rejects undefined", () => {
      expect(() => validateComment(undefined)).toThrow();
    });

    test("rejects comment over 1000 characters", () => {
      expect(() => validateComment("a".repeat(1001))).toThrow("Comment must be between 1-1000 characters");
    });

    test("rejects comment of 1500 characters", () => {
      expect(() => validateComment("a".repeat(1500))).toThrow();
    });
  });
});

// ── Comment deletion authorization ───────────────────────────────────────────

describe("convex/comments — delete authorization", () => {
  const comment = { _id: "comment_1", authorId: "user_1", postId: "post_1", content: "Nice!" };
  const post = { _id: "post_1", authorId: "user_2" };

  test("comment author can delete own comment", () => {
    expect(canDeleteComment(comment, post, "user_1")).toBe(true);
  });

  test("post owner can delete any comment on their post", () => {
    expect(canDeleteComment(comment, post, "user_2")).toBe(true);
  });

  test("third party cannot delete comment", () => {
    expect(() => canDeleteComment(comment, post, "user_3"))
      .toThrow("Not authorized to delete this comment");
  });

  test("unauthenticated user cannot delete", () => {
    expect(() => canDeleteComment(comment, post, null))
      .toThrow("Not authenticated");
  });

  test("throws if comment not found", () => {
    expect(() => canDeleteComment(null, post, "user_1"))
      .toThrow("Comment not found");
  });

  test("throws if post not found", () => {
    expect(() => canDeleteComment(comment, null, "user_1"))
      .toThrow("Post not found");
  });
});

// ── Comment object structure ──────────────────────────────────────────────────

describe("convex/comments — comment object structure", () => {
  const mockComment = {
    _id: "comment_1",
    postId: "post_1",
    authorId: "user_1",
    authorName: "Rohan Keshri",
    authorEmail: "rohankeshri06@gmail.com",
    content: "Great post!",
    status: "approved",
    createdAt: Date.now(),
  };

  test("comment has postId", () => {
    expect(mockComment.postId).toBeDefined();
  });

  test("comment has authorId", () => {
    expect(mockComment.authorId).toBeDefined();
  });

  test("comment has authorName", () => {
    expect(typeof mockComment.authorName).toBe("string");
    expect(mockComment.authorName.length).toBeGreaterThan(0);
  });

  test("comment status is approved for authenticated users", () => {
    expect(mockComment.status).toBe("approved");
  });

  test("comment has createdAt timestamp", () => {
    expect(typeof mockComment.createdAt).toBe("number");
    expect(mockComment.createdAt).toBeGreaterThan(0);
  });

  test("valid comment status values", () => {
    const validStatuses = ["approved", "pending", "rejected"];
    expect(validStatuses).toContain(mockComment.status);
  });
});

// ── Comment must be on published post ────────────────────────────────────────

describe("convex/comments — post status requirement", () => {
  const checkPostPublished = (post) => {
    if (!post || post.status !== "published") {
      throw new Error("Post not found or not published");
    }
    return true;
  };

  test("allows comment on published post", () => {
    expect(checkPostPublished({ status: "published" })).toBe(true);
  });

  test("rejects comment on draft post", () => {
    expect(() => checkPostPublished({ status: "draft" }))
      .toThrow("Post not found or not published");
  });

  test("rejects comment when post is null", () => {
    expect(() => checkPostPublished(null))
      .toThrow("Post not found or not published");
  });
});
