"use client";

import { useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";

import { THEME_SCRIPT } from "@/lib/theme";

/**
 * Emits the theme bootstrap <script> into the server-rendered <head> so the
 * saved colour theme and light/dark mode apply before first paint.
 *
 * useServerInsertedHTML writes raw HTML during server rendering only; the
 * script element is never part of React's client tree, so React 19 does not
 * warn about "a script tag while rendering a React component" when the root
 * layout is re-rendered on the client (for example by an error boundary).
 */
export function ThemeScript() {
  const inserted = useRef(false);

  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />;
  });

  return null;
}
