"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Chart color preferences — persisted per-user in localStorage.
 *
 * Each *property* has a single base "fill" color. The range chart renders two
 * visual shades from it automatically via opacity (±2 SD at 0.3, ±1 SD at 0.7),
 * which matches the Features.docx "2 shades" requirement without forcing the
 * user to pick two colors.
 */

export type Basis = "ar" | "ad" | "dry" | "daf" | "ash";

export interface BasisColor {
  fill: string;
  stroke: string;
}

/** Kept around for legend/stat-card rendering outside the range chart. */
export const BASIS_DISPLAY_NAMES: Record<Basis, string> = {
  ar: "As-received",
  ad: "Air-dried",
  dry: "Dry",
  daf: "Dry ash-free",
  ash: "Ash",
};

/** Preset swatch palette users can choose from (fill, stroke). */
export const COLOR_PRESETS: BasisColor[] = [
  { fill: "#fbbf24", stroke: "#d97706" }, // amber
  { fill: "#5eead4", stroke: "#0d9488" }, // teal
  { fill: "#a5b4fc", stroke: "#6366f1" }, // indigo
  { fill: "#fca5a5", stroke: "#dc2626" }, // red
  { fill: "#86efac", stroke: "#16a34a" }, // green
  { fill: "#93c5fd", stroke: "#2563eb" }, // blue
  { fill: "#f0abfc", stroke: "#c026d3" }, // fuchsia
  { fill: "#fdba74", stroke: "#ea580c" }, // orange
  { fill: "#d8b4fe", stroke: "#9333ea" }, // purple
  { fill: "#94a3b8", stroke: "#475569" }, // slate
  { fill: "#fde047", stroke: "#ca8a04" }, // yellow
  { fill: "#67e8f9", stroke: "#0891b2" }, // cyan
  { fill: "#f9a8d4", stroke: "#db2777" }, // pink
  { fill: "#fcd34d", stroke: "#b45309" }, // dark amber
  { fill: "#bef264", stroke: "#65a30d" }, // lime
  { fill: "#7dd3fc", stroke: "#0284c7" }, // sky
  { fill: "#c4b5fd", stroke: "#7c3aed" }, // violet
  { fill: "#6ee7b7", stroke: "#059669" }, // emerald
  { fill: "#d4d4aa", stroke: "#78716c" }, // olive
  { fill: "#fb7185", stroke: "#be123c" }, // rose
  { fill: "#a3e635", stroke: "#4d7c0f" }, // bright green
  { fill: "#2dd4bf", stroke: "#115e59" }, // deep teal
  { fill: "#60a5fa", stroke: "#1d4ed8" }, // deep blue
  { fill: "#e879f9", stroke: "#a21caf" }, // magenta
  { fill: "#facc15", stroke: "#a16207" }, // gold
];

/**
 * Default color assigned to a property when the user hasn't customized it.
 * Uses a deterministic hash of the property code so the same property always
 * gets the same default across renders and sessions.
 */
export function defaultColorForProperty(propertyCode: string): BasisColor {
  let h = 0;
  for (let i = 0; i < propertyCode.length; i++) {
    h = (h * 31 + propertyCode.charCodeAt(i)) >>> 0;
  }
  return COLOR_PRESETS[h % COLOR_PRESETS.length];
}

const STORAGE_KEY = "biomassiq.propertyColors.v1";

function readFromStorage(): Record<string, BasisColor> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    /* ignore */
  }
  return {};
}

function writeToStorage(prefs: Record<string, BasisColor>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

const CHANGE_EVENT = "biomassiq:chart-colors-changed";

/**
 * Hook that returns a resolver mapping property_code → BasisColor, plus
 * setters. Re-renders when prefs change anywhere in the app.
 */
export function usePropertyColors() {
  const [prefs, setPrefs] = useState<Record<string, BasisColor>>({});

  useEffect(() => {
    setPrefs(readFromStorage());
    const onChange = () => setPrefs(readFromStorage());
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  const getColor = useCallback(
    (propertyCode: string): BasisColor => {
      return prefs[propertyCode] || defaultColorForProperty(propertyCode);
    },
    [prefs],
  );

  const setColor = useCallback((propertyCode: string, color: BasisColor) => {
    const next = { ...readFromStorage(), [propertyCode]: color };
    writeToStorage(next);
    setPrefs(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const resetProperty = useCallback((propertyCode: string) => {
    const next = { ...readFromStorage() };
    delete next[propertyCode];
    writeToStorage(next);
    setPrefs(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const resetAll = useCallback(() => {
    writeToStorage({});
    setPrefs({});
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const isCustomized = Object.keys(prefs).length > 0;

  return { prefs, getColor, setColor, resetProperty, resetAll, isCustomized };
}
