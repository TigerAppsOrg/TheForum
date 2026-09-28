"use client";

import { Search } from "lucide-react";
import type * as React from "react";
import { useEffect, useRef } from "react";

import { cn } from "~/lib/utils";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Standard search field: the Figma pill (44px, pale turquoise, blue icon).
 *
 * `label` is required and rendered visually hidden — a placeholder is not an
 * accessible name. With `shortcut`, pressing "/" anywhere on the page (outside
 * another field) focuses it and Escape leaves it, like PrincetonCourses and
 * TigerJunction.
 */
export function SearchInput({
  className,
  label,
  shortcut = false,
  onKeyDown,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { label: string; shortcut?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!shortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shortcut]);

  return (
    <div
      className={cn(
        // Figma pill: pale turquoise fill, blue icon; turns white with a cerulean
        // ring while focused so the caret and text stay high-contrast.
        "flex h-11 items-center gap-2.5 rounded-full border border-forum-turquoise/60 bg-forum-turquoise-20 px-4",
        "transition-colors focus-within:border-forum-cerulean focus-within:bg-white",
        className,
      )}
    >
      <Search size={17} strokeWidth={2.2} aria-hidden className="shrink-0 text-forum-cerulean" />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        aria-keyshortcuts={shortcut ? "/" : undefined}
        className={cn(
          "min-w-0 flex-1 bg-transparent font-dm-sans text-[14px] text-black outline-none",
          "placeholder:text-forum-dark-gray/70",
          // Hide WebKit's built-in clear affordance; it clashes with the border.
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
        onKeyDown={(e) => {
          if (shortcut && e.key === "Escape") e.currentTarget.blur();
          onKeyDown?.(e);
        }}
        {...props}
      />
      {shortcut && (
        <kbd
          aria-hidden
          className="hidden shrink-0 rounded border border-forum-border bg-white px-1.5 font-dm-mono text-[11px] text-forum-light-gray sm:inline"
        >
          /
        </kbd>
      )}
    </div>
  );
}
