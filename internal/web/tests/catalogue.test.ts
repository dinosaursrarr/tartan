import { describe, expect, it } from "vitest";
import { prepareCatalogue } from "../src/lib/catalogue";

describe("catalogue preparation", () => {
  it("normalises entries", () => {
    const input = [
      { name: "Sixes", pattern: "a#FFFFFF[a6a12" },
      { name: "Invalid", pattern: "not tdf" },
      { name: "Missing fields" },
    ];
    const items = prepareCatalogue(input, "https://sett.test");
    expect(items).toHaveLength(1);
    expect(items[0].normalizedPattern).toBe("a#FFFFFF[a1a2");
    expect(items[0].previewSrc).toContain("https://sett.test/weave?");
  });
  it("falls back to the weave endpoint for thumbnails", () => {
    const items = prepareCatalogue([{ name: "Simple", pattern: "a#FFFFFF[a1" }], "https://sett.test");
    expect(items[0].previewSrc).toContain("https://sett.test/weave?");
    expect(items[0].previewSrc).toContain("format=webp");
  });
});
