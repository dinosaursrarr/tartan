import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWeavePreview } from "../src/hooks/useWeavePreview";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useWeavePreview", () => {
  it("does not request an image while the TDF source is invalid", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useWeavePreview("not valid TDF", false));
    expect(result.current.url).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces renderer HTTP errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502 }));
    const { result } = renderHook(() => useWeavePreview("a#FFFFFF[a1", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(result.current.error).toBe("Image endpoint returned 502");
  });
});
