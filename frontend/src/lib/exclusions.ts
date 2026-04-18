"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * User-marked outlier observations — per sample_record_id. Stored in
 * localStorage so the exclusion set persists across sessions and is shared
 * across all views (substance page, Compare tab) that need to honor it.
 *
 * Exclusions are global by sample_record_id (not substance-scoped) since
 * every sample has a unique id.
 */

const STORAGE_KEY = "biomassiq.excludedSamples.v1";
const CHANGE_EVENT = "biomassiq:excluded-samples-changed";

function readFromStorage(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    /* ignore */
  }
  return [];
}

function writeToStorage(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function useExcludedSamples() {
  const [excluded, setExcluded] = useState<string[]>([]);

  useEffect(() => {
    setExcluded(readFromStorage());
    const onChange = () => setExcluded(readFromStorage());
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  const persist = useCallback((next: string[]) => {
    writeToStorage(next);
    setExcluded(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const isExcluded = useCallback(
    (sampleId: string) => excluded.includes(sampleId),
    [excluded],
  );

  const exclude = useCallback(
    (sampleId: string) => {
      const current = readFromStorage();
      if (current.includes(sampleId)) return;
      persist([...current, sampleId]);
    },
    [persist],
  );

  const unexclude = useCallback(
    (sampleId: string) => {
      const current = readFromStorage();
      persist(current.filter((id) => id !== sampleId));
    },
    [persist],
  );

  const toggle = useCallback(
    (sampleId: string) => {
      const current = readFromStorage();
      if (current.includes(sampleId)) persist(current.filter((id) => id !== sampleId));
      else persist([...current, sampleId]);
    },
    [persist],
  );

  const clearAll = useCallback(() => persist([]), [persist]);

  return { excluded, isExcluded, exclude, unexclude, toggle, clearAll };
}
