import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { MouseEvent as ReactMouseEvent } from "react";
import { expandThread } from "../src/lib/tdf";
import { useTartanEditor } from "../src/hooks/useTartanEditor";

describe("useTartanEditor", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("starts with the MacKenzie starter pattern and a valid structured model", () => {
    const { result } = renderHook(() => useTartanEditor());
    expect(result.current.parseError).toBeNull();
    expect(result.current.serialisedModel).toContain("r#AA0000b#000052k#000000w#AAAAAAg#11450D[");
    expect(result.current.serialisedModel).toContain("b12(");
    expect(result.current.model.weft).toBeNull();
  });

  it("treats shift-click as selection only, including when establishing the first anchor", () => {
    const { result } = renderHook(() => useTartanEditor());
    const entries = expandThread(result.current.model.warp);
    const shiftClick = { shiftKey: true, ctrlKey: false, metaKey: false } as ReactMouseEvent<HTMLButtonElement>;
    act(() => result.current.selectBlock("warp", entries[0], shiftClick));
    expect(result.current.selectedIds).toEqual([entries[0].block.id]);
    expect(result.current.editing).toBeNull();
    act(() => result.current.selectBlock("warp", entries[1], shiftClick));
    expect(result.current.selectedIds).toEqual([entries[0].block.id, entries[1].block.id]);
    expect(result.current.editing).toBeNull();
    expect(result.current.canMirrorSelection).toBe(true);
  });

  it("clears stale selection when direct source edits replace the model", () => {
    const { result } = renderHook(() => useTartanEditor());
    const first = expandThread(result.current.model.warp)[0];
    const click = { shiftKey: false, ctrlKey: false, metaKey: false } as ReactMouseEvent<HTMLButtonElement>;
    act(() => result.current.selectBlock("warp", first, click));
    expect(result.current.editing).not.toBeNull();
    act(() => result.current.onCodeChange("a#FFFFFF[a2"));
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.editing).toBeNull();
  });

  it("loads catalogue patterns at their smallest shared unit", () => {
    const { result } = renderHook(() => useTartanEditor());
    act(() => {
      expect(result.current.loadPattern("a#FFFFFFb#000000[a8b4")).toBe(true);
    });
    expect(result.current.serialisedModel).toBe("a#FFFFFFb#000000[a2b1");
  });

  it("retains invalid source text without changing the last valid model", () => {
    const { result } = renderHook(() => useTartanEditor());
    const original = result.current.serialisedModel;
    act(() => result.current.onCodeChange("a#FFFFFF[a0"));
    expect(result.current.parseError).toBeTruthy();
    expect(result.current.code).toBe("a#FFFFFF[a0");
    expect(result.current.serialisedModel).toBe(original);
  });

  it("supports undo after a valid source edit", () => {
    const { result } = renderHook(() => useTartanEditor());
    act(() => result.current.onCodeChange("a#FFFFFF[a2"));
    expect(result.current.serialisedModel).toBe("a#FFFFFF[a2");
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.serialisedModel).toContain("r#AA0000");
    expect(result.current.code).toBe(result.current.serialisedModel);
  });

  it("initialises from a pattern query parameter", () => {
    window.history.replaceState({}, "", `/?pattern=${encodeURIComponent("a#FFFFFF[a3")}`);
    const { result } = renderHook(() => useTartanEditor());
    expect(result.current.serialisedModel).toBe("a#FFFFFF[a3");
    expect(result.current.parseError).toBeNull();
  });
});
