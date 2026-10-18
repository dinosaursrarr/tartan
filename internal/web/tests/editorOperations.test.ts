import { describe, expect, it } from "vitest";
import { parseTdf, serialiseTdf, type TartanModel } from "../src/lib/tdf";
import { createIndependentWeft, insertThreadBlock, linkWeftToWarp, mirrorThreadBlocks, removeThreadBlocks, renamePaletteColour, setThreadBlockToken, shiftThreadBlock } from "../src/lib/editorOperations";

const base = () => parseTdf("a#FFFFFFb#000000c#222222[a2b4c3]b5a6");

describe("immutable editor operations", () => {
  it("links and unlinks the weft by cloning the current warp", () => {
    const linked = linkWeftToWarp(base());
    expect(linked.weft).toBeNull();
    const split = createIndependentWeft(linked);
    expect(split.weft).not.toBeNull();
    expect(split.weft?.blocks.map((block) => [block.colourId, block.length])).toEqual(split.warp.blocks.map((block) => [block.colourId, block.length]));
    expect(split.weft?.blocks[0].id).not.toBe(split.warp.blocks[0].id);
  });
  it("inserts blocks at a thread boundary", () => {
    const model = base();
    const next = insertThreadBlock(model, "warp", 1, "b");
    expect(next.warp.blocks).toHaveLength(model.warp.blocks.length + 1);
    expect(next.warp.blocks[1].colourId).toBe("b");
  });
  it("edits block tokens and rejects missing palette colours", () => {
    const model = base();
    const first = model.warp.blocks[0];
    expect(serialiseTdf(setThreadBlockToken(model, "warp", first.id, "b12"))).toContain("b12");
    expect(() => setThreadBlockToken(model, "warp", first.id, "z12")).toThrow(/not in the palette/i);
    expect(() => setThreadBlockToken(model, "warp", first.id, "a0")).toThrow(/positive integer/i);
  });
  it("renames a palette id in every thread", () => {
    const next = renamePaletteColour(base(), "a", "z");
    expect(serialiseTdf(next)).toContain("z#FFFFFF");
    expect(next.warp.blocks.some((block) => block.colourId === "z")).toBe(true);
    expect(next.weft?.blocks.some((block) => block.colourId === "z")).toBe(true);
  });
  it("deletes multiple blocks but prevents an empty thread", () => {
    const model = base();
    const next = removeThreadBlocks(model, "warp", model.warp.blocks.slice(0, 2).map((block) => block.id));
    expect(next.warp.blocks).toHaveLength(1);
    expect(() => removeThreadBlocks(next, "warp", next.warp.blocks.map((block) => block.id))).toThrow(/at least one block/i);
  });
  it("can mark a contiguous block selection as the mirrored range", () => {
    const model = base();
    const ids = model.warp.blocks.slice(0, 2).map((block) => block.id);
    const next: TartanModel = mirrorThreadBlocks(model, "warp", ids);
    expect(next.warp.mirrorIds).toEqual(ids);
  });
  it("supports arrow-button reorder", () => {
    const model = base();
    const id = model.warp.blocks[1].id;
    const next = shiftThreadBlock(model, "warp", id, -1);
    expect(next.warp.blocks[0].id).toBe(id);
  });
});
