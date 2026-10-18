import { useEffect, useState } from "react";
import { fetchImageBlob, fetchRandomBackground, makeImageUrl } from "../services/weaveApi";

type PreviewState = { url: string | null; error: string | null; width: number; height: number };

export function useWeavePreview(pattern: string, valid: boolean) {
  const [state, setState] = useState<PreviewState>({ url: null, error: null, width: 0, height: 0 });
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!valid) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    const timer = window.setTimeout(() => {
      fetchImageBlob(makeImageUrl(pattern, "webp"), controller.signal)
        .then((blob) => {
          if (controller.signal.aborted) return;
          objectUrl = URL.createObjectURL(blob);
          const image = new Image();
          image.onload = () => {
            if (controller.signal.aborted) return;
            setState((old) => {
              if (old.url) URL.revokeObjectURL(old.url);
              return { url: objectUrl, error: null, width: image.naturalWidth, height: image.naturalHeight };
            });
          };
          image.onerror = () => setState((old) => ({ ...old, error: "The renderer returned an image that could not be displayed." }));
          image.src = objectUrl;
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setState((old) => ({ ...old, error: error instanceof Error ? error.message : "Unable to render the pattern." }));
        });
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [pattern, valid, refreshKey]);
  return { ...state, refresh: () => setRefreshKey((value) => value + 1) };
}

export function useTartanBackground() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | null = null;
    fetchRandomBackground(controller.signal)
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);
  return url;
}
