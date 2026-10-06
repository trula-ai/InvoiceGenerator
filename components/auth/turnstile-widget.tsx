"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useTheme } from "next-themes";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileRenderOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  action?: string;
  callback: (token: string) => void;
  "expired-callback"?: () => void;
  /** Receives a Cloudflare error code such as "110200" (hostname not allowed). */
  "error-callback"?: (code?: string) => void;
  "timeout-callback"?: () => void;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileWidgetProps {
  siteKey: string;
  /** Receives the fresh token, or null when it expires, errors or is reset. */
  onToken: (token: string | null) => void;
  /** Called with Cloudflare's error code when the challenge cannot run. */
  onError?: (code: string) => void;
  /** Bump to force a new challenge (e.g. after a failed sign-in). */
  resetSignal?: number;
  /** Shown to Cloudflare analytics as the action name. */
  action?: string;
  className?: string;
}

/**
 * Cloudflare Turnstile challenge rendered explicitly so the token can be
 * passed to a Server Action. Follows the app's light/dark theme.
 */
export function TurnstileWidget({ siteKey, onToken, onError, resetSignal = 0, action = "login", className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const onErrorRef = useRef(onError);
  const [scriptReady, setScriptReady] = useState(() => typeof window !== "undefined" && !!window.turnstile);
  const { resolvedTheme } = useTheme();
  const theme: "light" | "dark" | "auto" = resolvedTheme === "dark" ? "dark" : resolvedTheme === "light" ? "light" : "auto";

  useEffect(() => {
    onTokenRef.current = onToken;
    onErrorRef.current = onError;
  }, [onToken, onError]);

  // Render once the script is available; re-render when the theme changes.
  useEffect(() => {
    const container = containerRef.current;
    const turnstile = window.turnstile;
    if (!scriptReady || !container || !turnstile) return;

    widgetId.current = turnstile.render(container, {
      sitekey: siteKey,
      theme,
      size: "flexible",
      action,
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": (code) => {
        onTokenRef.current(null);
        onErrorRef.current?.(code ? String(code) : "unknown");
      },
      "timeout-callback": () => onTokenRef.current(null),
    });

    return () => {
      if (widgetId.current) {
        try {
          turnstile.remove(widgetId.current);
        } catch {
          // Widget already gone (e.g. hot reload); nothing to clean up.
        }
        widgetId.current = null;
      }
      onTokenRef.current(null);
    };
  }, [scriptReady, siteKey, theme, action]);

  // Explicit reset requested by the parent (after a failed attempt).
  useEffect(() => {
    if (resetSignal > 0 && widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
      onTokenRef.current(null);
    }
  }, [resetSignal]);

  return (
    <>
      <Script src={SCRIPT_SRC} strategy="afterInteractive" onReady={() => setScriptReady(true)} />
      <div ref={containerRef} className={className} aria-label="Human verification" />
    </>
  );
}
