/**
 * Tests for lib/imagekit.js — buildTransformationUrl
 * These parameters were verified against the live ImageKit API.
 */

import { buildTransformationUrl } from "@/lib/imagekit";

const BASE = "https://ik.imagekit.io/demo/blog_images/photo.jpg";

describe("buildTransformationUrl", () => {
  test("returns the original URL when there are no transformations", () => {
    expect(buildTransformationUrl(BASE, [])).toBe(BASE);
  });

  test("adds resize parameters", () => {
    const url = buildTransformationUrl(BASE, [{ width: 400, height: 400, focus: "auto" }]);
    expect(url).toContain("tr:w-400,h-400,fo-auto");
    expect(url.endsWith("/photo.jpg")).toBe(true);
  });

  test("adds background removal effect", () => {
    const url = buildTransformationUrl(BASE, [{ effect: "removedotbg" }]);
    expect(url).toContain("e-removedotbg");
  });

  test("chains multiple transformations with ':'", () => {
    const url = buildTransformationUrl(BASE, [
      { width: 800, height: 450 },
      { effect: "removedotbg" },
    ]);
    expect(url).toContain("w-800,h-450:e-removedotbg");
  });

  describe("text overlay", () => {
    test("uses ImageKit's 'tg-b' for bold, not 'tg-bold'", () => {
      const url = buildTransformationUrl(BASE, [{ overlayText: "Hi", gravity: "center" }]);
      expect(url).toContain("tg-b");
      expect(url).not.toContain("tg-bold");
    });

    test("does not add lx/ly when a position is chosen (they override lfo)", () => {
      const url = buildTransformationUrl(BASE, [{ overlayText: "Hi", gravity: "south_east" }]);
      expect(url).not.toMatch(/lx-\d+/);
      expect(url).not.toMatch(/ly-\d+/);
      expect(url).toContain("lfo-bottom_right");
    });

    test("maps every position option to an ImageKit value", () => {
      const map = {
        center: "center",
        north_west: "top_left",
        north_east: "top_right",
        south_west: "bottom_left",
        south_east: "bottom_right",
        north: "top",
        south: "bottom",
        west: "left",
        east: "right",
      };
      Object.entries(map).forEach(([gravity, expected]) => {
        const url = buildTransformationUrl(BASE, [{ overlayText: "Hi", gravity }]);
        expect(url).toContain(`lfo-${expected}`);
      });
    });

    test("falls back to a fixed offset when no position is given", () => {
      const url = buildTransformationUrl(BASE, [{ overlayText: "Hi" }]);
      expect(url).toContain("lx-20");
      expect(url).toContain("ly-20");
      expect(url).not.toContain("lfo-");
    });

    test("URL-encodes the overlay text", () => {
      const url = buildTransformationUrl(BASE, [{ overlayText: "Hello World #1", gravity: "center" }]);
      expect(url).toContain("i-Hello%20World%20%231");
    });

    test("includes font size, color and padding", () => {
      const url = buildTransformationUrl(BASE, [
        {
          overlayText: "Hi",
          overlayTextFontSize: 50,
          overlayTextColor: "ffffff",
          gravity: "center",
          overlayTextPadding: 10,
        },
      ]);
      expect(url).toContain("fs-50");
      expect(url).toContain("co-ffffff");
      expect(url).toContain("pa-10");
      expect(url).toContain("l-end");
    });
  });

  test("appends to an existing transformation instead of adding a second one", () => {
    const src = "https://ik.imagekit.io/demo/tr:w-100/photo.jpg";
    const url = buildTransformationUrl(src, [{ effect: "removedotbg" }]);
    expect(url).toBe("https://ik.imagekit.io/demo/tr:e-removedotbg:w-100/photo.jpg");
    expect(url.match(/tr:/g).length).toBe(1);
  });
});
