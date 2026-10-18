import type { CatalogueEntry, PreparedCatalogueEntry } from "../types/catalogue";
import { normalisePattern } from "./patternMath";
import { makeWeaveUrl } from "../services/weaveApi";

export function isCatalogueEntry(value: unknown): value is CatalogueEntry {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<CatalogueEntry>;
  return typeof entry.name === "string" && typeof entry.pattern === "string";
}

export function prepareCatalogue(
  data: unknown,
  origin = typeof window === "undefined" ? "http://localhost" : window.location.origin,
): PreparedCatalogueEntry[] {
  if (!Array.isArray(data)) return [];
  const output: PreparedCatalogueEntry[] = [];
  data.forEach((candidate, index) => {
    if (!isCatalogueEntry(candidate)) return;
    try {
      const normalizedPattern = normalisePattern(candidate.pattern);
      const previewSrc = candidate.preview || makeWeaveUrl(
        "/weave", normalizedPattern, "webp", origin,
      );
      output.push({ ...candidate, index, normalizedPattern, previewSrc });
    } catch {
      // A malformed legacy catalogue item must not break the picker.
      // Skipping it is safer than letting its invalid TDF reach the renderer.
    }
  });
  return output;
}
