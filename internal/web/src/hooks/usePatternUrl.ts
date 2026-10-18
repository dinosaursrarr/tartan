import { useEffect } from "react";

export function usePatternUrl(pattern: string, valid: boolean) {
  useEffect(() => {
    if (!valid) return;
    const timer = window.setTimeout(() => {
      const next = new URL(window.location.href);
      next.searchParams.set("pattern", pattern);
      window.history.replaceState({}, "", `${next.pathname}${next.search}${next.hash}`);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [pattern, valid]);
}
