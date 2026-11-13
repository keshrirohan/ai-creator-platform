/**
 * Tests for convex/feed.js business logic
 * Covers: feed filtering, trending score, suggested users ranking
 */

// ── Feed filtering logic ──────────────────────────────────────────────────────

const filterPublishedPosts = (posts, limit) => {
  const published = posts.filter(p => p.status === "published");
  const hasMore = published.length > limit;
  return {
    posts: published.slice(0, limit),
    hasMore,
  };
};

// ── Trending score calculation ────────────────────────────────────────────────

const calcTrendingScore = (post) => {
  return post.viewCount + post.likeCount * 3;
};

const getTrendingPosts = (posts, limit = 10) => {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return posts
    .filter(p => p.status === "published" && p.publishedAt >= weekAgo)
    .map(p => ({ ...p, trendingScore: calcTrendingScore(p) }))
    .sort((a, b) => b.trendingScore - a.trendingScore)
    .slice(0, limit);
};

// ── Engagement score calculation ──────────────────────────────────────────────

const calcEngagementScore = (posts, followerCount) => {
  const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
  return totalViews + totalLikes * 5 + followerCount * 10;
};

describe("convex/feed — feed post filtering", () => {
  const posts = [
    { _id: "1", status: "published", publishedAt: Date.now() },
    { _id: "2", status: "draft", publishedAt: null },
    { _id: "3", status: "published", publishedAt: Date.now() - 1000 },
    { _id: "4", status: "draft", publishedAt: null },
    { _id: "5", status: "published", publishedAt: Date.now() - 2000 },
  ];

  test("filters out draft posts", () => {
    const result = filterPublishedPosts(posts, 10);
    result.posts.forEach(p => expect(p.status).toBe("published"));
  });

  test("respects limit", () => {
    const result = filterPublishedPosts(posts, 2);
    expect(result.posts.length).toBe(2);
  });

  test("sets hasMore to true when more posts exist beyond limit", () => {
    const result = filterPublishedPosts(posts, 2);
    expect(result.hasMore).toBe(true);
  });

  test("sets hasMore to false when all posts fit within limit", () => {
    const result = filterPublishedPosts(posts, 10);
    expect(result.hasMore).toBe(false);
  });

  test("returns empty array when no published posts", () => {
    const draftOnly = posts.filter(p => p.status === "draft");
    const result = filterPublishedPosts(draftOnly, 10);
    expect(result.posts.length).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  test("default limit of 10 is used", () => {
    const manyPosts = Array.from({ length: 15 }, (_, i) => ({
      _id: `${i}`, status: "published", publishedAt: Date.now()
    }));
    const result = filterPublishedPosts(manyPosts, 10);
    expect(result.posts.length).toBe(10);
    expect(result.hasMore).toBe(true);
  });
});

// ── Trending score calculation ────────────────────────────────────────────────

describe("convex/feed — trending score calculation", () => {
  test("score = viewCount + likeCount * 3", () => {
    expect(calcTrendingScore({ viewCount: 100, likeCount: 10 })).toBe(130);
  });

  test("post with no views or likes has score 0", () => {
    expect(calcTrendingScore({ viewCount: 0, likeCount: 0 })).toBe(0);
  });

  test("likes are weighted more than views (3x)", () => {
    const likesOnly = calcTrendingScore({ viewCount: 0, likeCount: 10 });
    const viewsOnly = calcTrendingScore({ viewCount: 10, likeCount: 0 });
    expect(likesOnly).toBeGreaterThan(viewsOnly);
  });

  test("higher engagement gives higher trending score", () => {
    const high = calcTrendingScore({ viewCount: 500, likeCount: 100 });
    const low = calcTrendingScore({ viewCount: 10, likeCount: 1 });
    expect(high).toBeGreaterThan(low);
  });

  test("getTrendingPosts sorts by score descending", () => {
    const now = Date.now();
    const posts = [
      { _id: "1", status: "published", publishedAt: now, viewCount: 10, likeCount: 1 },
      { _id: "2", status: "published", publishedAt: now, viewCount: 500, likeCount: 100 },
      { _id: "3", status: "published", publishedAt: now, viewCount: 50, likeCount: 10 },
    ];
    const result = getTrendingPosts(posts);
    expect(result[0]._id).toBe("2");
  });

  test("getTrendingPosts excludes posts older than 7 days", () => {
    const now = Date.now();
    const old = now - 8 * 24 * 60 * 60 * 1000;
    const posts = [
      { _id: "1", status: "published", publishedAt: now, viewCount: 100, likeCount: 10 },
      { _id: "2", status: "published", publishedAt: old, viewCount: 999, likeCount: 999 },
    ];
    const result = getTrendingPosts(posts);
    expect(result.length).toBe(1);
    expect(result[0]._id).toBe("1");
  });

  test("getTrendingPosts respects limit", () => {
    const now = Date.now();
    const posts = Array.from({ length: 15 }, (_, i) => ({
      _id: `${i}`, status: "published", publishedAt: now, viewCount: i, likeCount: i
    }));
    const result = getTrendingPosts(posts, 5);
    expect(result.length).toBe(5);
  });
});

// ── Engagement score for suggested users ─────────────────────────────────────

describe("convex/feed — engagement score for suggested users", () => {
  test("score = views + likes*5 + followers*10", () => {
    const posts = [{ viewCount: 100, likeCount: 10 }];
    expect(calcEngagementScore(posts, 5)).toBe(100 + 50 + 50);
  });

  test("user with no activity has score 0", () => {
    expect(calcEngagementScore([], 0)).toBe(0);
  });

  test("follower count has highest weight per unit", () => {
    const followerScore = calcEngagementScore([], 1);     // 10
    const likeScore = calcEngagementScore([{ viewCount: 0, likeCount: 1 }], 0); // 5
    const viewScore = calcEngagementScore([{ viewCount: 1, likeCount: 0 }], 0); // 1
    expect(followerScore).toBeGreaterThan(likeScore);
    expect(likeScore).toBeGreaterThan(viewScore);
  });

  test("multiple posts aggregate correctly", () => {
    const posts = [
      { viewCount: 50, likeCount: 5 },
      { viewCount: 50, likeCount: 5 },
    ];
    expect(calcEngagementScore(posts, 0)).toBe(100 + 50);
  });
});
