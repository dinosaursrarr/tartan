import { describe, expect, it } from "vitest";
import { createStarterModel, expandThread, parseTdf, serialiseTdf, STARTER_TDF } from "../src/lib/tdf";

describe("TDF grammar and model", () => {
  it("parses the classic MacKenzie starter pattern", () => {
    const model = createStarterModel();
    expect(model.colours.map((colour) => colour.id)).toEqual(["r", "b", "k", "w", "g"]);
    expect(model.warp.blocks.length).toBeGreaterThan(1);
    expect(model.weft).toBeNull();
    expect(serialiseTdf(model)).toBe(STARTER_TDF.replace(/#[a-fA-F0-9]{6}/g, (hex) => hex.toUpperCase()));
  });

  it("expands the mirrored source after the suffix, matching the Go parser", () => {
    const model = parseTdf("a#FFFFFFb#000000c#222222d#333333[a1(b2c3)d4");
    expect(expandThread(model.warp).map((entry) => `${entry.block.colourId}${entry.block.length}`))
      .toEqual(["a1", "b2", "c3", "d4", "c3", "b2"]);
  });

  it("round-trips definitions, warp, weft, and one mirrored range", () => {
    const source = "a#FFFFFFb#000000c#AAAAAAd#333333[a2(b3c4)d5]b1(a2)b3";
    expect(serialiseTdf(parseTdf(source))).toBe(source);
  });

  it("rejects duplicate colours, undefined block colours, and unmatched parentheses", () => {
    expect(() => parseTdf("a#FFFFFFa#000000[a1")).toThrow(/defined more than once/i);
    expect(() => parseTdf("a#FFFFFF[b1")).toThrow(/undefined colour/i);
    expect(() => parseTdf("a#FFFFFF[a1(b2")).toThrow(/parentheses/i);
  });
});
