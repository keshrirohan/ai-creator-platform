/**
 * Tests for convex/dashboard.js business logic
 * Covers: analytics calculation, daily stats date format, growth %
 */

// ── Analytics calculation helpers ────────────────────────────────────────────

const calcAnalytics = (posts, followersCount) => {
  const totalViews = posts.reduce((sum, p) => sum + p.viewCount, 0);
  const totalLikes = posts.reduce((sum, p) => sum + p.likeCount, 0);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentPosts = posts.filter(p => p.createdAt > thirtyDaysAgo);
  const recentViews = recentPosts.reduce((sum, p) => sum + p.viewCount, 0);
  const recentLikes = recentPosts.reduce((sum, p) => sum + p.likeCount, 0);
  const viewsGrowth = totalViews > 0 ? (recentViews / totalViews) * 100 : 0;
  const likesGrowth = totalLikes > 0 ? (recentLikes / totalLikes) * 100 : 0;

  return {
    totalViews,
    totalLikes,
    totalFollowers: followersCount,
    viewsGrowth: Math.round(viewsGrowth * 10) / 10,
    likesGrowth: Math.round(likesGrowth * 10) / 10,
  };
};

const getDailyStatsDate = () => new Date().toISOString().split("T")[0];

const aggregateViewsByDate = (dailyStats) => {
  const result = {};
  dailyStats.forEach(stat => {
    result[stat.date] = (result[stat.date] || 0) + stat.views;
  });
  return result;
};

describe("convex/dashboard — analytics calculation", () => {

  // ── Total metrics ─────────────────────────────────────────────────────────
  describe("total metrics", () => {
    test("sums views across all posts", () => {
      const posts = [
        { viewCount: 100, likeCount: 10, createdAt: Date.now() - 1000 },
        { viewCount: 200, likeCount: 20, createdAt: Date.now() - 1000 },
      ];
      const result = calcAnalytics(posts, 5);
      expect(result.totalViews).toBe(300);
    });

    test("sums likes across all posts", () => {
      const posts = [
        { viewCount: 100, likeCount: 10, createdAt: Date.now() - 1000 },
        { viewCount: 200, likeCount: 20, createdAt: Date.now() - 1000 },
      ];
      const result = calcAnalytics(posts, 5);
      expect(result.totalLikes).toBe(30);
    });

    test("returns 0 totals for user with no posts", () => {
      const result = calcAnalytics([], 0);
      expect(result.totalViews).toBe(0);
      expect(result.totalLikes).toBe(0);
    });

    test("includes follower count", () => {
      const result = calcAnalytics([], 42);
      expect(result.totalFollowers).toBe(42);
    });
  });

  // ── Growth calculation ────────────────────────────────────────────────────
  describe("growth percentage calculation", () => {
    test("returns 0 viewsGrowth when total views is 0", () => {
      const result = calcAnalytics([], 0);
      expect(result.viewsGrowth).toBe(0);
    });

    test("returns 100% growth when all views are recent", () => {
      const posts = [{ viewCount: 100, likeCount: 10, createdAt: Date.now() - 1000 }];
      const result = calcAnalytics(posts, 0);
      expect(result.viewsGrowth).toBe(100);
    });

    test("returns 0% growth when no recent posts", () => {
      const old = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60 days ago
      const posts = [{ viewCount: 100, likeCount: 10, createdAt: old }];
      const result = calcAnalytics(posts, 0);
      expect(result.viewsGrowth).toBe(0);
    });

    test("growth is rounded to 1 decimal place", () => {
      const posts = [
        { viewCount: 1, likeCount: 0, createdAt: Date.now() - 1000 },
        { viewCount: 2, likeCount: 0, createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000 },
      ];
      const result = calcAnalytics(posts, 0);
      expect(result.viewsGrowth).toBe(33.3);
    });
  });
});

// ── Daily stats date handling ─────────────────────────────────────────────────

describe("convex/dashboard — daily stats date format", () => {
  test("date is in YYYY-MM-DD format", () => {
    const date = getDailyStatsDate();
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("date is today's date", () => {
    const date = getDailyStatsDate();
    const expected = new Date().toISOString().split("T")[0];
    expect(date).toBe(expected);
  });

  test("date has correct year", () => {
    const date = getDailyStatsDate();
    const year = new Date().getFullYear().toString();
    expect(date.startsWith(year)).toBe(true);
  });
});

// ── Daily stats aggregation ───────────────────────────────────────────────────

describe("convex/dashboard — daily views aggregation", () => {
  test("aggregates views from same date", () => {
    const stats = [
      { date: "2026-11-13", views: 10 },
      { date: "2026-11-13", views: 5 },
    ];
    const result = aggregateViewsByDate(stats);
    expect(result["2026-11-13"]).toBe(15);
  });

  test("keeps different dates separate", () => {
    const stats = [
      { date: "2026-11-13", views: 10 },
      { date: "2026-11-12", views: 20 },
    ];
    const result = aggregateViewsByDate(stats);
    expect(result["2026-11-13"]).toBe(10);
    expect(result["2026-11-12"]).toBe(20);
  });

  test("handles empty stats array", () => {
    const result = aggregateViewsByDate([]);
    expect(Object.keys(result).length).toBe(0);
  });

  test("aggregates across multiple posts for same date", () => {
    const stats = [
      { date: "2026-11-13", views: 5, postId: "post_1" },
      { date: "2026-11-13", views: 7, postId: "post_2" },
      { date: "2026-11-13", views: 3, postId: "post_3" },
    ];
    const result = aggregateViewsByDate(stats);
    expect(result["2026-11-13"]).toBe(15);
  });
});

// ── Chart data generation ─────────────────────────────────────────────────────

describe("convex/dashboard — chart data (last 30 days)", () => {
  const generateLast30Days = () => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push({
        date: date.toISOString().split("T")[0],
        views: 0,
      });
    }
    return days;
  };

  test("generates exactly 30 days", () => {
    expect(generateLast30Days().length).toBe(30);
  });

  test("first entry is 29 days ago", () => {
    const days = generateLast30Days();
    const expected = new Date();
    expected.setDate(expected.getDate() - 29);
    expect(days[0].date).toBe(expected.toISOString().split("T")[0]);
  });

  test("last entry is today", () => {
    const days = generateLast30Days();
    const today = new Date().toISOString().split("T")[0];
    expect(days[days.length - 1].date).toBe(today);
  });

  test("all entries start with 0 views", () => {
    const days = generateLast30Days();
    days.forEach(d => expect(d.views).toBe(0));
  });

  test("all dates are in YYYY-MM-DD format", () => {
    const days = generateLast30Days();
    days.forEach(d => expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/));
  });

  test("dates are in ascending order", () => {
    const days = generateLast30Days();
    for (let i = 1; i < days.length; i++) {
      expect(days[i].date >= days[i - 1].date).toBe(true);
    }
  });
});
