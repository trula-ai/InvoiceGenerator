import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

// Rendered on the server (and during hydration) as "not mobile".
function getServerSnapshot() {
  return false
}

/**
 * Returns true when the viewport is narrower than the mobile breakpoint.
 * Implemented with `useSyncExternalStore` so the media query is the single
 * source of truth and no state is set inside an effect.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
