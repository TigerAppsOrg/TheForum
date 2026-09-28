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
 * Standard search field: 40px, icon inside, border reacts to focus.
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
        "flex h-10 items-center gap-2.5 rounded-lg border border-forum-border bg-white px-3.5",
        "transition-colors focus-within:border-forum-cerulean",
        className,
      )}
    >
      <Search size={15} aria-hidden className="shrink-0 text-forum-placeholder" />
      <input
        ref={inputRef}
        type="search"
        aria-label={label}
        aria-keyshortcuts={shortcut ? "/" : undefined}
        className={cn(
          "min-w-0 flex-1 bg-transparent font-dm-sans text-[14px] text-black outline-none",
          "placeholder:text-forum-placeholder",
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
          className="hidden shrink-0 rounded border border-forum-border px-1.5 font-dm-mono text-[11px] text-forum-light-gray sm:inline"
        >
          /
        </kbd>
      )}
    </div>
  );
}
