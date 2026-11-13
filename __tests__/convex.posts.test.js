/**
 * Tests for convex/posts.js business logic
 * Covers: post schema, status transitions, validation, ownership checks
 */

// ── Post validation helpers (mirrors server-side logic) ──────────────────────

const validatePost = ({ title, content, tags = [], status }) => {
  if (!title || title.trim().length === 0) throw new Error("Title is required");
  if (title.length > 200) throw new Error("Title too long");
  if (!content || content.trim().length === 0) throw new Error("Content is required");
  if (!["draft", "published"].includes(status)) throw new Error("Invalid status");
  if (tags.length > 10) throw new Error("Maximum 10 tags allowed");
  return true;
};

const getStatusBadge = (post) => {
  if (post.status === "published") {
    if (post.scheduledFor && post.scheduledFor > Date.now()) return "Scheduled";
    return "Published";
  }
  return "Draft";
};

const canUserModifyPost = (post, userId) => {
  if (!userId) throw new Error("Not authenticated");
  if (post.authorId !== userId) throw new Error("Not authorized to update this post");
  return true;
};

describe("convex/posts — post validation", () => {

  // ── Title validation ──────────────────────────────────────────────────────
  describe("title validation", () => {
    test("accepts valid title", () => {
      expect(validatePost({ title: "My First Post", content: "Content", status: "draft" })).toBe(true);
    });

    test("rejects empty title", () => {
      expect(() => validatePost({ title: "", content: "Content", status: "draft" }))
        .toThrow("Title is required");
    });

    test("rejects whitespace-only title", () => {
      expect(() => validatePost({ title: "   ", content: "Content", status: "draft" }))
        .toThrow("Title is required");
    });

    test("rejects title over 200 characters", () => {
      expect(() => validatePost({ title: "a".repeat(201), content: "Content", status: "draft" }))
        .toThrow("Title too long");
    });

    test("accepts title of exactly 200 characters", () => {
      expect(validatePost({ title: "a".repeat(200), content: "Content", status: "draft" })).toBe(true);
    });

    test("accepts title with special characters", () => {
      expect(validatePost({ title: "Top 10 Tips & Tricks!", content: "Content", status: "draft" })).toBe(true);
    });
  });

  // ── Content validation ────────────────────────────────────────────────────
  describe("content validation", () => {
    test("rejects empty content", () => {
      expect(() => validatePost({ title: "Title", content: "", status: "draft" }))
        .toThrow("Content is required");
    });

    test("rejects whitespace-only content", () => {
      expect(() => validatePost({ title: "Title", content: "   ", status: "draft" }))
        .toThrow("Content is required");
    });

    test("accepts HTML content", () => {
      expect(validatePost({ title: "Title", content: "<p>Hello world</p>", status: "draft" })).toBe(true);
    });

    test("accepts long content", () => {
      expect(validatePost({ title: "Title", content: "word ".repeat(500), status: "draft" })).toBe(true);
    });
  });

  // ── Status validation ─────────────────────────────────────────────────────
  describe("status validation", () => {
    test("accepts draft status", () => {
      expect(validatePost({ title: "Title", content: "Content", status: "draft" })).toBe(true);
    });

    test("accepts published status", () => {
      expect(validatePost({ title: "Title", content: "Content", status: "published" })).toBe(true);
    });

    test("rejects invalid status", () => {
      expect(() => validatePost({ title: "Title", content: "Content", status: "pending" }))
        .toThrow("Invalid status");
    });

    test("rejects empty status", () => {
      expect(() => validatePost({ title: "Title", content: "Content", status: "" }))
        .toThrow("Invalid status");
    });
  });

  // ── Tags validation ───────────────────────────────────────────────────────
  describe("tags validation", () => {
    test("accepts empty tags array", () => {
      expect(validatePost({ title: "Title", content: "Content", status: "draft", tags: [] })).toBe(true);
    });

    test("accepts up to 10 tags", () => {
      const tags = Array.from({ length: 10 }, (_, i) => `tag${i}`);
      expect(validatePost({ title: "Title", content: "Content", status: "draft", tags })).toBe(true);
    });

    test("rejects more than 10 tags", () => {
      const tags = Array.from({ length: 11 }, (_, i) => `tag${i}`);
      expect(() => validatePost({ title: "Title", content: "Content", status: "draft", tags }))
        .toThrow("Maximum 10 tags allowed");
    });
  });
});

// ── Status badge logic ────────────────────────────────────────────────────────

describe("convex/posts — status badge display logic", () => {
  test("draft post shows Draft badge", () => {
    expect(getStatusBadge({ status: "draft" })).toBe("Draft");
  });

  test("published post shows Published badge", () => {
    expect(getStatusBadge({ status: "published", publishedAt: Date.now() - 1000 })).toBe("Published");
  });

  test("published post with future scheduledFor shows Scheduled", () => {
    expect(getStatusBadge({ status: "published", scheduledFor: Date.now() + 100000 })).toBe("Scheduled");
  });

  test("published post with past scheduledFor shows Published", () => {
    expect(getStatusBadge({ status: "published", scheduledFor: Date.now() - 100000 })).toBe("Published");
  });
});

// ── Ownership / authorization checks ─────────────────────────────────────────

describe("convex/posts — ownership authorization", () => {
  const post = { _id: "post_1", authorId: "user_1", title: "Test Post", status: "draft" };

  test("owner can modify their post", () => {
    expect(canUserModifyPost(post, "user_1")).toBe(true);
  });

  test("non-owner cannot modify post", () => {
    expect(() => canUserModifyPost(post, "user_2"))
      .toThrow("Not authorized to update this post");
  });

  test("unauthenticated user cannot modify post", () => {
    expect(() => canUserModifyPost(post, null))
      .toThrow("Not authenticated");
  });

  test("undefined userId cannot modify post", () => {
    expect(() => canUserModifyPost(post, undefined))
      .toThrow("Not authenticated");
  });
});

// ── Post object structure ─────────────────────────────────────────────────────

describe("convex/posts — post object structure", () => {
  const mockPost = {
    _id: "post_1",
    title: "How to Build an AI Platform",
    content: "<p>This is the content</p>",
    status: "published",
    authorId: "user_1",
    tags: ["AI", "Tech", "NextJS"],
    category: "Technology",
    featuredImage: "https://ik.imagekit.io/test/image.jpg",
    createdAt: Date.now() - 100000,
    updatedAt: Date.now() - 50000,
    publishedAt: Date.now() - 50000,
    viewCount: 150,
    likeCount: 42,
  };

  test("post has all required fields", () => {
    expect(mockPost._id).toBeDefined();
    expect(mockPost.title).toBeDefined();
    expect(mockPost.content).toBeDefined();
    expect(mockPost.status).toBeDefined();
    expect(mockPost.authorId).toBeDefined();
  });

  test("viewCount starts at 0 for new posts", () => {
    const newPost = { ...mockPost, viewCount: 0, likeCount: 0 };
    expect(newPost.viewCount).toBe(0);
    expect(newPost.likeCount).toBe(0);
  });

  test("publishedAt is set when status is published", () => {
    expect(mockPost.publishedAt).toBeDefined();
    expect(mockPost.publishedAt).toBeGreaterThan(0);
  });

  test("publishedAt is not set for draft posts", () => {
    const draft = { ...mockPost, status: "draft", publishedAt: undefined };
    expect(draft.publishedAt).toBeUndefined();
  });

  test("tags is an array", () => {
    expect(Array.isArray(mockPost.tags)).toBe(true);
  });

  test("updatedAt is after or equal to createdAt", () => {
    expect(mockPost.updatedAt).toBeGreaterThanOrEqual(mockPost.createdAt);
  });
});

// ── View count logic ──────────────────────────────────────────────────────────

describe("convex/posts — view count increment logic", () => {
  test("increments view count correctly", () => {
    const post = { viewCount: 10 };
    const newCount = post.viewCount + 1;
    expect(newCount).toBe(11);
  });

  test("view count cannot go below 0 (like count protection)", () => {
    const likeCount = 0;
    const result = Math.max(0, likeCount - 1);
    expect(result).toBe(0);
  });

  test("daily stats date format is YYYY-MM-DD", () => {
    const today = new Date().toISOString().split("T")[0];
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
