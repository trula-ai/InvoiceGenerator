"use client";

import { useState } from "react";
import { Monitor, Moon, Palette, Sun, SunMoon } from "lucide-react";

import {
  DropdownMenuGroup,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  applyAppearance,
  DEFAULT_MODE,
  DEFAULT_THEME,
  isThemeId,
  isThemeMode,
  MODES,
  readAppearance,
  saveAppearance,
  THEMES,
  type ThemeId,
  type ThemeMode,
} from "@/lib/theme";

const MODE_ICONS = { light: Sun, dark: Moon, system: Monitor } as const;

/**
 * Theme and appearance pickers rendered as two submenus inside the account
 * dropdown. Colour swatches are only shown once the "Theme" submenu is opened.
 * Only mounts when the menu is open, so the stored preference can be read
 * synchronously.
 */
export function AppearanceMenuSection() {
  const [{ theme, mode }, setState] = useState<{ theme: ThemeId; mode: ThemeMode }>(() =>
    typeof window === "undefined" ? { theme: DEFAULT_THEME, mode: DEFAULT_MODE } : readAppearance(),
  );

  function choose(nextTheme: ThemeId, nextMode: ThemeMode) {
    setState({ theme: nextTheme, mode: nextMode });
    applyAppearance(nextTheme, nextMode);
    saveAppearance(nextTheme, nextMode);
  }

  const currentTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const currentMode = MODES.find((m) => m.id === mode) ?? MODES[0];

  return (
    <DropdownMenuGroup>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Palette />
          Theme
          <span className="ml-auto flex items-center gap-1.5 pl-4 text-xs text-muted-foreground">
            <span
              className="size-2.5 rounded-full ring-1 ring-foreground/15"
              style={{ backgroundColor: currentTheme.swatch }}
              aria-hidden
            />
            {currentTheme.name}
          </span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-40">
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => {
              if (isThemeId(value)) choose(value, mode);
            }}
          >
            {THEMES.map((t) => (
              <DropdownMenuRadioItem key={t.id} value={t.id}>
                <span
                  className="size-3.5 rounded-full ring-1 ring-foreground/15"
                  style={{ backgroundColor: t.swatch }}
                  aria-hidden
                />
                {t.name}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <SunMoon />
          Appearance
          <span className="ml-auto pl-4 text-xs text-muted-foreground">{currentMode.name}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="min-w-36">
          <DropdownMenuRadioGroup
            value={mode}
            onValueChange={(value) => {
              if (isThemeMode(value)) choose(theme, value);
            }}
          >
            {MODES.map((m) => {
              const Icon = MODE_ICONS[m.id];
              return (
                <DropdownMenuRadioItem key={m.id} value={m.id}>
                  <Icon />
                  {m.name}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </DropdownMenuGroup>
  );
}
