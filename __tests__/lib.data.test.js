/**
 * Tests for lib/data.js
 * Static content used on the landing page
 */

import { features, socialProofStats, testimonials, platformTabs } from "@/lib/data";

describe("lib/data — landing page static content", () => {

  // ── features ──────────────────────────────────────────────────────────────
  describe("features array", () => {
    test("exports an array", () => {
      expect(Array.isArray(features)).toBe(true);
    });

    test("has at least 1 feature", () => {
      expect(features.length).toBeGreaterThan(0);
    });

    test("every feature has a title string", () => {
      features.forEach((f) => {
        expect(typeof f.title).toBe("string");
        expect(f.title.length).toBeGreaterThan(0);
      });
    });

    test("every feature has a desc string", () => {
      features.forEach((f) => {
        expect(typeof f.desc).toBe("string");
        expect(f.desc.length).toBeGreaterThan(0);
      });
    });

    test("every feature has a color string for gradient", () => {
      features.forEach((f) => {
        expect(typeof f.color).toBe("string");
        expect(f.color).toMatch(/^from-/);
      });
    });

    test("every feature has an icon component (React component)", () => {
      features.forEach((f) => {
        expect(f.icon).toBeDefined();
        expect(f.icon).not.toBeNull();
      });
    });

    test("contains AI Writing Assistant feature", () => {
      const ai = features.find((f) => f.title === "AI Writing Assistant");
      expect(ai).toBeDefined();
    });

    test("contains Analytics & Insights feature", () => {
      const analytics = features.find((f) => f.title.includes("Analytics"));
      expect(analytics).toBeDefined();
    });
  });

  // ── socialProofStats ─────────────────────────────────────────────────────
  describe("socialProofStats array", () => {
    test("exports an array", () => {
      expect(Array.isArray(socialProofStats)).toBe(true);
    });

    test("has exactly 4 stats", () => {
      expect(socialProofStats.length).toBe(4);
    });

    test("every stat has a metric string", () => {
      socialProofStats.forEach((s) => {
        expect(typeof s.metric).toBe("string");
        expect(s.metric.length).toBeGreaterThan(0);
      });
    });

    test("every stat has a label string", () => {
      socialProofStats.forEach((s) => {
        expect(typeof s.label).toBe("string");
      });
    });

    test("every stat has an icon component", () => {
      socialProofStats.forEach((s) => {
        expect(s.icon).toBeDefined();
        expect(s.icon).not.toBeNull();
      });
    });
  });

  // ── testimonials ─────────────────────────────────────────────────────────
  describe("testimonials array", () => {
    test("exports an array", () => {
      expect(Array.isArray(testimonials)).toBe(true);
    });

    test("has 3 testimonials", () => {
      expect(testimonials.length).toBe(3);
    });

    test("every testimonial has a name", () => {
      testimonials.forEach((t) => {
        expect(typeof t.name).toBe("string");
        expect(t.name.length).toBeGreaterThan(0);
      });
    });

    test("every testimonial has a role", () => {
      testimonials.forEach((t) => {
        expect(typeof t.role).toBe("string");
      });
    });

    test("every testimonial has a rating between 1 and 5", () => {
      testimonials.forEach((t) => {
        expect(t.rating).toBeGreaterThanOrEqual(1);
        expect(t.rating).toBeLessThanOrEqual(5);
      });
    });

    test("every testimonial has non-empty content", () => {
      testimonials.forEach((t) => {
        expect(typeof t.content).toBe("string");
        expect(t.content.length).toBeGreaterThan(10);
      });
    });

    test("every testimonial has an imageId for Unsplash", () => {
      testimonials.forEach((t) => {
        expect(typeof t.imageId).toBe("string");
        expect(t.imageId.length).toBeGreaterThan(0);
      });
    });
  });

  // ── platformTabs ─────────────────────────────────────────────────────────
  describe("platformTabs array", () => {
    test("exports an array", () => {
      expect(Array.isArray(platformTabs)).toBe(true);
    });

    test("has 3 tabs", () => {
      expect(platformTabs.length).toBe(3);
    });

    test("every tab has a title", () => {
      platformTabs.forEach((tab) => {
        expect(typeof tab.title).toBe("string");
        expect(tab.title.length).toBeGreaterThan(0);
      });
    });

    test("every tab has a description", () => {
      platformTabs.forEach((tab) => {
        expect(typeof tab.description).toBe("string");
      });
    });

    test("every tab has a features array with at least 1 item", () => {
      platformTabs.forEach((tab) => {
        expect(Array.isArray(tab.features)).toBe(true);
        expect(tab.features.length).toBeGreaterThan(0);
      });
    });

    test("every tab feature item is a non-empty string", () => {
      platformTabs.forEach((tab) => {
        tab.features.forEach((f) => {
          expect(typeof f).toBe("string");
          expect(f.length).toBeGreaterThan(0);
        });
      });
    });

    test("every tab has an icon component", () => {
      platformTabs.forEach((tab) => {
        expect(tab.icon).toBeDefined();
        expect(tab.icon).not.toBeNull();
      });
    });

    test("contains Content Creation tab", () => {
      const tab = platformTabs.find((t) => t.title === "Content Creation");
      expect(tab).toBeDefined();
    });

    test("contains Audience Growth tab", () => {
      const tab = platformTabs.find((t) => t.title === "Audience Growth");
      expect(tab).toBeDefined();
    });
  });
});
