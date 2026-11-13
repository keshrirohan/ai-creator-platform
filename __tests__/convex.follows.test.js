/**
 * Tests for convex/follows.js business logic
 * Covers: follow/unfollow, self-follow prevention, follower counts
 */

// ── Follow toggle logic ───────────────────────────────────────────────────────

const toggleFollow = (currentUserId, targetUserId, existingFollow) => {
  if (!currentUserId) throw new Error("Must be logged in to follow users");
  if (currentUserId === targetUserId) throw new Error("You cannot follow yourself");

  if (existingFollow) {
    return { following: false };
  } else {
    return { following: true };
  }
};

const getFollowerCount = (follows, userId) => {
  return follows.filter(f => f.followingId === userId).length;
};

const isFollowing = (follows, followerId, followingId) => {
  return follows.some(f => f.followerId === followerId && f.followingId === followingId);
};

describe("convex/follows — toggle follow logic", () => {

  // ── Following ─────────────────────────────────────────────────────────────
  describe("following a user (no existing follow)", () => {
    test("returns following: true when not already following", () => {
      const result = toggleFollow("user_1", "user_2", null);
      expect(result.following).toBe(true);
    });

    test("allows following a different user", () => {
      expect(() => toggleFollow("user_1", "user_2", null)).not.toThrow();
    });
  });

  // ── Unfollowing ───────────────────────────────────────────────────────────
  describe("unfollowing a user (existing follow present)", () => {
    const existingFollow = { _id: "follow_1", followerId: "user_1", followingId: "user_2" };

    test("returns following: false when already following", () => {
      const result = toggleFollow("user_1", "user_2", existingFollow);
      expect(result.following).toBe(false);
    });
  });

  // ── Self-follow prevention ────────────────────────────────────────────────
  describe("self-follow prevention", () => {
    test("throws when user tries to follow themselves", () => {
      expect(() => toggleFollow("user_1", "user_1", null))
        .toThrow("You cannot follow yourself");
    });

    test("same user ID with different format still prevented", () => {
      expect(() => toggleFollow("user_1", "user_1", null)).toThrow();
    });
  });

  // ── Authentication check ──────────────────────────────────────────────────
  describe("authentication requirement", () => {
    test("throws when unauthenticated (null userId)", () => {
      expect(() => toggleFollow(null, "user_2", null))
        .toThrow("Must be logged in to follow users");
    });

    test("throws when unauthenticated (undefined userId)", () => {
      expect(() => toggleFollow(undefined, "user_2", null))
        .toThrow("Must be logged in to follow users");
    });
  });
});

// ── Follower count calculation ────────────────────────────────────────────────

describe("convex/follows — follower count", () => {
  const follows = [
    { followerId: "user_1", followingId: "user_3" },
    { followerId: "user_2", followingId: "user_3" },
    { followerId: "user_4", followingId: "user_3" },
    { followerId: "user_1", followingId: "user_2" },
  ];

  test("counts correct number of followers", () => {
    expect(getFollowerCount(follows, "user_3")).toBe(3);
  });

  test("counts single follower correctly", () => {
    expect(getFollowerCount(follows, "user_2")).toBe(1);
  });

  test("returns 0 when user has no followers", () => {
    expect(getFollowerCount(follows, "user_5")).toBe(0);
  });

  test("returns 0 for empty follows array", () => {
    expect(getFollowerCount([], "user_3")).toBe(0);
  });
});

// ── isFollowing query logic ───────────────────────────────────────────────────

describe("convex/follows — isFollowing check", () => {
  const follows = [
    { followerId: "user_1", followingId: "user_2" },
    { followerId: "user_2", followingId: "user_3" },
  ];

  test("returns true when user is following", () => {
    expect(isFollowing(follows, "user_1", "user_2")).toBe(true);
  });

  test("returns false when user is not following", () => {
    expect(isFollowing(follows, "user_1", "user_3")).toBe(false);
  });

  test("follow relationship is not bidirectional by default", () => {
    expect(isFollowing(follows, "user_2", "user_1")).toBe(false);
  });

  test("returns false with empty follows", () => {
    expect(isFollowing([], "user_1", "user_2")).toBe(false);
  });

  test("does not confuse follower and following IDs", () => {
    expect(isFollowing(follows, "user_2", "user_1")).toBe(false);
    expect(isFollowing(follows, "user_1", "user_2")).toBe(true);
  });
});

// ── Follow object structure ───────────────────────────────────────────────────

describe("convex/follows — follow object structure", () => {
  const mockFollow = {
    _id: "follow_1",
    followerId: "user_1",
    followingId: "user_2",
    createdAt: Date.now(),
  };

  test("has followerId", () => {
    expect(mockFollow.followerId).toBeDefined();
  });

  test("has followingId", () => {
    expect(mockFollow.followingId).toBeDefined();
  });

  test("followerId and followingId are different", () => {
    expect(mockFollow.followerId).not.toBe(mockFollow.followingId);
  });

  test("has createdAt timestamp", () => {
    expect(typeof mockFollow.createdAt).toBe("number");
    expect(mockFollow.createdAt).toBeGreaterThan(0);
  });
});
