import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchImageBlob, fetchRandomBackground, makeImageUrl, makeWeaveUrl } from "../src/services/weaveApi";

afterEach(() => vi.unstubAllGlobals());

describe("image endpoint URLs", () => {
  it("encodes TDF into the query and preserves format", () => {
    const url = new URL(makeImageUrl("a#FFFFFF[a1b2", "webp", "https://sett.test"));
    expect(url.pathname).toBe("/weave");
    expect(url.searchParams.get("pattern")).toBe("a#FFFFFF[a1b2");
    expect(url.searchParams.get("format")).toBe("webp");
  });
  it("omits PNG format because it is the API default", () => {
    const url = new URL(makeWeaveUrl("/weave", "a#FFFFFF[a1", "png", "https://sett.test"));
    expect(url.searchParams.has("format")).toBe(false);
  });
  it("requests random backgrounds using WebP", () => {
    const url = new URL(makeWeaveUrl("/random", null, "webp", "https://sett.test"));
    expect(url.pathname).toBe("/random");
    expect(url.searchParams.get("format")).toBe("webp");
  });

  it("fetches backgrounds without allowing a cached random tile", async () => {
    const blob = new Blob(["tile"]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => blob });
    vi.stubGlobal("fetch", fetchMock);
    await expect(fetchRandomBackground()).resolves.toBe(blob);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/random?format=webp"), expect.objectContaining({ cache: "no-store" }));
  });

  it("throws a useful error when an image endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(fetchImageBlob("https://sett.test/weave")).rejects.toThrow("Image endpoint returned 503");
  });
});
