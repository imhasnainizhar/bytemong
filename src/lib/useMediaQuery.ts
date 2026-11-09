"use client";

import { useSyncExternalStore } from "react";

/** Live `matchMedia` result. Always false during SSR. */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const noopSubscribe = () => () => {};

/** True once hydrated on the client, which makes it safe to portal into document.body. */
export function useIsClient() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
