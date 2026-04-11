"use client";

import { useEffect } from "react";

export default function ThemeToggle({ className = "", shortOnMobile = false, iconOnlyOnMobile = false }) {
  useEffect(() => {
    const storedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = storedTheme ?? (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  const toggleTheme = () => {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("theme", nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`rounded-full border border-border-custom bg-secondary px-5 py-2 text-sm font-semibold text-foreground transition hover:opacity-90 ${className}`}
      aria-label="Toggle dark and light mode"
    >
      {iconOnlyOnMobile ? (
        <>
          <span className="sm:hidden" aria-hidden="true">🌗</span>
          <span className="hidden sm:inline">🌗 Toggle Theme</span>
        </>
      ) : shortOnMobile ? (
        <>
          <span className="sm:hidden">🌗 Theme</span>
          <span className="hidden sm:inline">🌗 Toggle Theme</span>
        </>
      ) : (
        "🌗 Toggle Theme"
      )}
    </button>
  );
}
