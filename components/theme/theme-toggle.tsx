"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

const STORAGE_KEY = "basescope:theme";
type Theme = "dark" | "light";

/** Alterna --bg/--surface/--fg/etc. entre os dois blocos definidos em app/globals.css. Estado inicial assume "dark" (default do produto) até ler o valor real aplicado pelo ThemeScript, para bater com a SSR. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const applied = document.documentElement.getAttribute("data-theme");
    if (applied === "light") setTheme("light");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
      title={theme === "light" ? "Tema claro" : "Tema escuro"}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-sm text-fg-muted hover:text-fg hover:bg-surface-2",
        className,
      )}
    >
      <span aria-hidden="true">{theme === "light" ? "☀" : "☾"}</span>
    </button>
  );
}
