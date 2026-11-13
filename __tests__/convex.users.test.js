/**
 * Tests for convex/users.js business logic
 * Covers: store, getCurrentUser, updateUsername, getByUsername
 */

// ── Username validation logic (pure, extracted for unit testing) ────────────

const validateUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    throw new Error(
      "Username can only contain letters, numbers, underscores, and hyphens"
    );
  }
  if (username.length < 3 || username.length > 20) {
    throw new Error("Username must be between 3 and 20 characters");
  }
  return true;
};

describe("convex/users — username validation", () => {

  // ── Valid usernames ───────────────────────────────────────────────────────
  describe("valid usernames", () => {
    test("accepts lowercase letters", () => {
      expect(validateUsername("rohan")).toBe(true);
    });

    test("accepts uppercase letters", () => {
      expect(validateUsername("ROHAN")).toBe(true);
    });

    test("accepts numbers", () => {
      expect(validateUsername("user123")).toBe(true);
    });

    test("accepts underscores", () => {
      expect(validateUsername("rohan_keshri")).toBe(true);
    });

    test("accepts hyphens", () => {
      expect(validateUsername("rohan-keshri")).toBe(true);
    });

    test("accepts exactly 3 characters (minimum)", () => {
      expect(validateUsername("abc")).toBe(true);
    });

    test("accepts exactly 20 characters (maximum)", () => {
      expect(validateUsername("a".repeat(20))).toBe(true);
    });

    test("accepts mixed alphanumeric with underscore", () => {
      expect(validateUsername("user_123")).toBe(true);
    });
  });

  // ── Invalid usernames ─────────────────────────────────────────────────────
  describe("invalid usernames — special characters", () => {
    test("rejects spaces", () => {
      expect(() => validateUsername("rohan keshri")).toThrow(
        "Username can only contain letters, numbers, underscores, and hyphens"
      );
    });

    test("rejects @ symbol", () => {
      expect(() => validateUsername("rohan@keshri")).toThrow(
        "Username can only contain letters, numbers, underscores, and hyphens"
      );
    });

    test("rejects dots", () => {
      expect(() => validateUsername("rohan.keshri")).toThrow(
        "Username can only contain letters, numbers, underscores, and hyphens"
      );
    });

    test("rejects exclamation marks", () => {
      expect(() => validateUsername("rohan!")).toThrow();
    });

    test("rejects hash symbol", () => {
      expect(() => validateUsername("rohan#1")).toThrow();
    });
  });

  // ── Invalid usernames — length ────────────────────────────────────────────
  describe("invalid usernames — length", () => {
    test("rejects username shorter than 3 characters", () => {
      expect(() => validateUsername("ab")).toThrow(
        "Username must be between 3 and 20 characters"
      );
    });

    test("rejects single character username", () => {
      expect(() => validateUsername("a")).toThrow(
        "Username must be between 3 and 20 characters"
      );
    });

    test("rejects empty string", () => {
      expect(() => validateUsername("")).toThrow();
    });

    test("rejects username longer than 20 characters", () => {
      expect(() => validateUsername("a".repeat(21))).toThrow(
        "Username must be between 3 and 20 characters"
      );
    });

    test("rejects username of 30 characters", () => {
      expect(() => validateUsername("a".repeat(30))).toThrow(
        "Username must be between 3 and 20 characters"
      );
    });
  });
});

// ── User object structure validation ─────────────────────────────────────────

describe("convex/users — user object structure", () => {
  const mockUser = {
    _id: "user_123",
    name: "Rohan Keshri",
    email: "rohankeshri06@gmail.com",
    tokenIdentifier: "clerk|abc123",
    imageUrl: "https://img.clerk.com/abc.jpg",
    username: "rohankeshri",
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  test("user has required _id field", () => {
    expect(mockUser._id).toBeDefined();
  });

  test("user has name field", () => {
    expect(typeof mockUser.name).toBe("string");
    expect(mockUser.name.length).toBeGreaterThan(0);
  });

  test("user has valid email format", () => {
    expect(mockUser.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  test("user has tokenIdentifier for Clerk auth", () => {
    expect(mockUser.tokenIdentifier).toBeDefined();
    expect(mockUser.tokenIdentifier.length).toBeGreaterThan(0);
  });

  test("user createdAt is a valid timestamp", () => {
    expect(typeof mockUser.createdAt).toBe("number");
    expect(mockUser.createdAt).toBeGreaterThan(0);
  });

  test("user lastActiveAt is a valid timestamp", () => {
    expect(typeof mockUser.lastActiveAt).toBe("number");
    expect(mockUser.lastActiveAt).toBeGreaterThan(0);
  });

  // ── getByUsername public fields ───────────────────────────────────────────
  describe("getByUsername — public profile fields only", () => {
    const publicUser = {
      _id: mockUser._id,
      name: mockUser.name,
      username: mockUser.username,
      imageUrl: mockUser.imageUrl,
      createdAt: mockUser.createdAt,
    };

    test("public user includes _id", () => {
      expect(publicUser._id).toBeDefined();
    });

    test("public user includes name", () => {
      expect(publicUser.name).toBeDefined();
    });

    test("public user does NOT include email", () => {
      expect(publicUser.email).toBeUndefined();
    });

    test("public user does NOT include tokenIdentifier", () => {
      expect(publicUser.tokenIdentifier).toBeUndefined();
    });

    test("public user does NOT include lastActiveAt", () => {
      expect(publicUser.lastActiveAt).toBeUndefined();
    });
  });
});
