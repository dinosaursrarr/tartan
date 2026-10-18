export type OutputFormat = "png" | "webp" | "gif";

export function makeWeaveUrl(
  path: "/weave" | "/random",
  pattern: string | null,
  format: OutputFormat = "png",
  origin = typeof window === "undefined" ? "http://localhost" : window.location.origin,
): string {
  const url = new URL(path, origin);
  if (pattern !== null) url.searchParams.set("pattern", pattern);
  if (format !== "png" || path === "/random") url.searchParams.set("format", format);
  return url.toString();
}

export function makeImageUrl(pattern: string, format: OutputFormat, origin?: string): string {
  return makeWeaveUrl("/weave", pattern, format, origin);
}

export async function fetchImageBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Image endpoint returned ${response.status}`);
  return response.blob();
}

export async function fetchRandomBackground(signal?: AbortSignal): Promise<Blob> {
  const response = await fetch(makeWeaveUrl("/random", null, "webp"), { signal, cache: "no-store" });
  if (!response.ok) throw new Error(`Background endpoint returned ${response.status}`);
  return response.blob();
}
