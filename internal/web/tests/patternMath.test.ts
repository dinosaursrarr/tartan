import { describe, expect, it } from "vitest";
import { parseTdf, serialiseTdf } from "../src/lib/tdf";
import { commonLengthFactor, doubleModelLengths, greatestCommonDivisor, normalisePattern, reduceModelToUnit } from "../src/lib/patternMath";

describe("pattern scale helpers", () => {
  it("computes GCD for positive integers", () => {
    expect(greatestCommonDivisor(18, 12)).toBe(6);
    expect(greatestCommonDivisor(7, 3)).toBe(1);
  });
  it("reduces all lengths by the common factor across both threads", () => {
    const model = parseTdf("a#FFFFFFb#000000[a6b12]b18a24");
    expect(commonLengthFactor(model)).toBe(6);
    expect(serialiseTdf(reduceModelToUnit(model))).toBe("a#FFFFFFb#000000[a1b2]b3a4");
  });
  it("normalises catalogue patterns and leaves relatively-prime lengths intact", () => {
    expect(normalisePattern("a#FFFFFF[a4a8")).toBe("a#FFFFFF[a1a2");
    expect(normalisePattern("a#FFFFFF[a2a3")).toBe("a#FFFFFF[a2a3");
  });
  it("doubling then reducing returns the same proportions", () => {
    const model = parseTdf("a#FFFFFFb#000000[a2b5(a3)b1");
    const restored = reduceModelToUnit(doubleModelLengths(model));
    expect(serialiseTdf(restored)).toBe(serialiseTdf(model));
  });
});
