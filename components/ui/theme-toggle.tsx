"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const STORAGE_KEY = "portico-theme";

/* The live theme is the data-theme attribute the inline script in
   app/layout.tsx already stamped on <html>. That attribute is external mutable
   state, so it is read with useSyncExternalStore rather than mirrored into
   component state -- one source of truth, and the control stays correct if
   anything else flips the attribute. */
function subscribe(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.getAttribute("data-theme") === "dark"
    ? "dark"
    : "light";
}

/* The server cannot know the visitor's theme -- it lives in localStorage and a
   media query. It renders light, then hydration corrects it in one pass. */
function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    // Writing the attribute is what actually changes the theme; the
    // MutationObserver above then re-renders this control.
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private-mode Safari refuses writes. The theme still applies for this
      // session; only the preference is lost.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className={`eyebrow cursor-pointer rounded-[var(--radius-base)] border border-rule px-tight py-1 text-ink-2 transition-colors duration-200 ease-[var(--ease-standard)] hover:border-ink-muted hover:text-ink ${className}`}
    >
      {next}
    </button>
  );
}
