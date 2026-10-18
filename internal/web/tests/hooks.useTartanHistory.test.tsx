import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useTartanHistory } from "../src/hooks/useTartanHistory";

describe("useTartanHistory", () => {
  it("exposes undo and redo state from a component hook", () => {
    const { result } = renderHook(() => useTartanHistory({ count: 1 }));
    act(() => result.current.commit({ count: 2 }));
    expect(result.current.present.count).toBe(2);
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.present.count).toBe(1);
    act(() => result.current.redo());
    expect(result.current.present.count).toBe(2);
  });
});
