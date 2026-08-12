"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return <button className="icon-button" type="button" aria-label="Toggle theme" onClick={() => setTheme(dark ? "light" : "dark")}>{dark ? <Sun size={16} /> : <Moon size={16} />}</button>;
}
