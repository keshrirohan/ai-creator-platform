/**
 * Tests for lib/utils.js
 * cn() utility — class merging helper used throughout all components
 */

import { cn } from "@/lib/utils";

describe("cn() — className utility", () => {
  // ── Basic usage ──────────────────────────────────────────────────────────
  describe("basic merging", () => {
    test("returns a single class unchanged", () => {
      expect(cn("foo")).toBe("foo");
    });

    test("joins multiple class strings with a space", () => {
      expect(cn("foo", "bar")).toBe("foo bar");
    });

    test("returns empty string when called with no arguments", () => {
      expect(cn()).toBe("");
    });

    test("ignores undefined values", () => {
      expect(cn("foo", undefined, "bar")).toBe("foo bar");
    });

    test("ignores null values", () => {
      expect(cn("foo", null, "bar")).toBe("foo bar");
    });

    test("ignores false values", () => {
      expect(cn("foo", false, "bar")).toBe("foo bar");
    });
  });

  // ── Conditional classes ──────────────────────────────────────────────────
  describe("conditional classes", () => {
    test("includes class when condition is true", () => {
      expect(cn("base", true && "active")).toBe("base active");
    });

    test("excludes class when condition is false", () => {
      expect(cn("base", false && "active")).toBe("base");
    });

    test("handles object syntax — includes truthy keys", () => {
      expect(cn({ foo: true, bar: false })).toBe("foo");
    });

    test("handles object syntax — excludes falsy keys", () => {
      expect(cn({ foo: false, bar: false })).toBe("");
    });

    test("handles mixed string and object syntax", () => {
      expect(cn("base", { active: true, disabled: false })).toBe("base active");
    });
  });

  // ── Tailwind conflict resolution ─────────────────────────────────────────
  describe("Tailwind class conflict resolution (twMerge)", () => {
    test("later padding overrides earlier padding", () => {
      expect(cn("p-4", "p-8")).toBe("p-8");
    });

    test("later text color overrides earlier text color", () => {
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    test("later background overrides earlier background", () => {
      expect(cn("bg-white", "bg-black")).toBe("bg-black");
    });

    test("non-conflicting classes are both kept", () => {
      expect(cn("p-4", "m-4")).toBe("p-4 m-4");
    });

    test("handles complex real-world component class merging", () => {
      const result = cn(
        "rounded-md bg-purple-500 text-white px-4 py-2",
        "bg-blue-500"
      );
      expect(result).toContain("bg-blue-500");
      expect(result).not.toContain("bg-purple-500");
    });

    test("conditional Tailwind override works correctly", () => {
      const isActive = true;
      const result = cn("text-slate-400", isActive && "text-white");
      expect(result).toBe("text-white");
    });
  });

  // ── Arrays ───────────────────────────────────────────────────────────────
  describe("array support", () => {
    test("flattens array of class names", () => {
      expect(cn(["foo", "bar"])).toBe("foo bar");
    });

    test("flattens nested arrays", () => {
      expect(cn(["foo", ["bar", "baz"]])).toBe("foo bar baz");
    });
  });
});
