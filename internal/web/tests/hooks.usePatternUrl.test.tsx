import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePatternUrl } from "../src/hooks/usePatternUrl";

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("usePatternUrl", () => {
  it("updates the current URL for a valid pattern without navigation", () => {
    vi.useFakeTimers();
    const { result } = renderHook(({ pattern }) => usePatternUrl(pattern, true), { initialProps: { pattern: "a#FFFFFF[a3" } });
    act(() => vi.advanceTimersByTime(200));
    expect(new URLSearchParams(window.location.search).get("pattern")).toBe("a#FFFFFF[a3");
    expect(result.current).toBeUndefined();
  });

  it("does not replace a URL with invalid source", () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?pattern=still-valid");
    renderHook(() => usePatternUrl("invalid", false));
    act(() => vi.advanceTimersByTime(200));
    expect(new URLSearchParams(window.location.search).get("pattern")).toBe("still-valid");
  });
});
