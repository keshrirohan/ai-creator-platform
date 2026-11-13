/**
 * Tests for hooks/use-convex-query.js
 * Covers: loading states, data resolution, error handling
 */

import { renderHook, act } from "@testing-library/react";
import { useConvexQuery, useConvexMutation } from "@/hooks/use-convex-query";

// Mock convex/react
jest.mock("convex/react", () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
}));

// Mock sonner toast
jest.mock("sonner", () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

const { useQuery, useMutation } = require("convex/react");

describe("hooks/useConvexQuery", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Loading state ─────────────────────────────────────────────────────────
  describe("loading state", () => {
    test("isLoading is true when query returns undefined", () => {
      useQuery.mockReturnValue(undefined);
      const { result } = renderHook(() => useConvexQuery("api.test.query"));
      expect(result.current.isLoading).toBe(true);
    });

    test("data is undefined while loading", () => {
      useQuery.mockReturnValue(undefined);
      const { result } = renderHook(() => useConvexQuery("api.test.query"));
      expect(result.current.data).toBeUndefined();
    });

    test("error is null while loading", () => {
      useQuery.mockReturnValue(undefined);
      const { result } = renderHook(() => useConvexQuery("api.test.query"));
      expect(result.current.error).toBeNull();
    });
  });

  // ── Successful data ───────────────────────────────────────────────────────
  describe("successful data resolution", () => {
    test("isLoading is false when data arrives", () => {
      useQuery.mockReturnValue([{ _id: "1", title: "Test" }]);
      const { result } = renderHook(() => useConvexQuery("api.test.query"));
      expect(result.current.isLoading).toBe(false);
    });

    test("data is populated when query resolves", () => {
      const mockData = [{ _id: "1", title: "Post" }];
      useQuery.mockReturnValue(mockData);
      const { result } = renderHook(() => useConvexQuery("api.test.query"));
      expect(result.current.data).toEqual(mockData);
    });

    test("handles null data result", () => {
      useQuery.mockReturnValue(null);
      const { result } = renderHook(() => useConvexQuery("api.test.query"));
      expect(result.current.data).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    test("handles empty array result", () => {
      useQuery.mockReturnValue([]);
      const { result } = renderHook(() => useConvexQuery("api.test.query"));
      expect(result.current.data).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });

    test("handles object result", () => {
      const mockData = { totalViews: 100, totalLikes: 20 };
      useQuery.mockReturnValue(mockData);
      const { result } = renderHook(() => useConvexQuery("api.test.query"));
      expect(result.current.data).toEqual(mockData);
    });
  });
});

// ── useConvexMutation ─────────────────────────────────────────────────────────

describe("hooks/useConvexMutation", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("isLoading starts as false", () => {
    useMutation.mockReturnValue(jest.fn());
    const { result } = renderHook(() => useConvexMutation("api.test.mutation"));
    expect(result.current.isLoading).toBe(false);
  });

  test("data starts as undefined", () => {
    useMutation.mockReturnValue(jest.fn());
    const { result } = renderHook(() => useConvexMutation("api.test.mutation"));
    expect(result.current.data).toBeUndefined();
  });

  test("error starts as null", () => {
    useMutation.mockReturnValue(jest.fn());
    const { result } = renderHook(() => useConvexMutation("api.test.mutation"));
    expect(result.current.error).toBeNull();
  });

  test("mutate returns resolved value on success", async () => {
    const mockFn = jest.fn().mockResolvedValue("post_id_123");
    useMutation.mockReturnValue(mockFn);
    const { result } = renderHook(() => useConvexMutation("api.test.mutation"));

    let returnValue;
    await act(async () => {
      returnValue = await result.current.mutate({ title: "Test" });
    });

    expect(returnValue).toBe("post_id_123");
  });

  test("isLoading is false after successful mutation", async () => {
    const mockFn = jest.fn().mockResolvedValue("done");
    useMutation.mockReturnValue(mockFn);
    const { result } = renderHook(() => useConvexMutation("api.test.mutation"));

    await act(async () => {
      await result.current.mutate({});
    });

    expect(result.current.isLoading).toBe(false);
  });

  test("throws and sets error on mutation failure", async () => {
    const error = new Error("Not authenticated");
    const mockFn = jest.fn().mockRejectedValue(error);
    useMutation.mockReturnValue(mockFn);
    const { result } = renderHook(() => useConvexMutation("api.test.mutation"));

    await act(async () => {
      try {
        await result.current.mutate({});
      } catch (e) {
        // expected
      }
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.isLoading).toBe(false);
  });

  test("mutate exposes a mutate function", () => {
    useMutation.mockReturnValue(jest.fn());
    const { result } = renderHook(() => useConvexMutation("api.test.mutation"));
    expect(typeof result.current.mutate).toBe("function");
  });
});
