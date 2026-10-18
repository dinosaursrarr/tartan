import { describe, expect, it } from "vitest";
import { isContiguousSelection, rangeSelection } from "../src/lib/selection";
import { parseTdf } from "../src/lib/tdf";

describe("block selection", () => {
  it("selects an inclusive range in either direction", () => {
    const thread = parseTdf("a#FFFFFFb#111111c#222222d#333333[a1b2c3d4").warp;
    expect(rangeSelection(thread, thread.blocks[0].id, thread.blocks[2].id)).toEqual(thread.blocks.slice(0, 3).map((block) => block.id));
    expect(rangeSelection(thread, thread.blocks[3].id, thread.blocks[1].id)).toEqual(thread.blocks.slice(1, 4).map((block) => block.id));
  });
  it("requires a contiguous set for mirror selection", () => {
    const thread = parseTdf("a#FFFFFFb#111111c#222222d#333333[a1b2c3d4").warp;
    expect(isContiguousSelection(thread, [thread.blocks[0].id, thread.blocks[1].id])).toBe(true);
    expect(isContiguousSelection(thread, [thread.blocks[0].id, thread.blocks[2].id])).toBe(false);
  });
});
