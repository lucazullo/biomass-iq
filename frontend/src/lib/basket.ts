"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { bulkSubstanceSummary } from "./api";
import type { SubstanceSummary } from "./types";

const STORAGE_KEY = "biomassiq.basket.v1";
const CHANGE_EVENT = "biomassiq:basket-changed";

function readFromStorage(): SubstanceSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as SubstanceSummary[];
  } catch {
    /* ignore */
  }
  return [];
}

function writeToStorage(basket: SubstanceSummary[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(basket));
  } catch {
    /* ignore */
  }
}

/**
 * Basket hook — backed by localStorage so the selection survives tab switches,
 * page navigation, and full reloads. Multiple components using this hook stay
 * in sync via a custom window event.
 */
export function useBasket() {
  const [basket, setBasketState] = useState<SubstanceSummary[]>([]);
  // Track whether we've completed the first hydration so the initial empty
  // value doesn't overwrite a saved basket.
  const hydrated = useRef(false);

  useEffect(() => {
    const stored = readFromStorage();
    setBasketState(stored);
    hydrated.current = true;

    // Fire a background refresh so observation/source counts reflect the
    // current DB rather than whatever was cached at basket-add time. Also
    // drops entries that have been merged/removed server-side.
    if (stored.length > 0) {
      bulkSubstanceSummary(stored.map((s) => s.id))
        .then((fresh) => {
          if (fresh.length === 0) return;
          const byId = new Map(fresh.map((f) => [f.id, f]));
          const merged = stored
            // Keep items the server still knows about in the order we had them;
            // drop entries that no longer exist (e.g. deduped).
            .filter((s) => s.id.startsWith("user:") || byId.has(s.id))
            .map((s) => byId.get(s.id) ?? s);
          // Only rewrite if something actually changed.
          const changed =
            merged.length !== stored.length ||
            merged.some((m, i) =>
              m.observation_count !== stored[i].observation_count ||
              m.source_count !== stored[i].source_count ||
              m.preferred_name !== stored[i].preferred_name,
            );
          if (changed) {
            writeToStorage(merged);
            setBasketState(merged);
            window.dispatchEvent(new Event(CHANGE_EVENT));
          }
        })
        .catch(() => {
          /* offline / backend down — keep stored snapshot */
        });
    }

    const onChange = () => setBasketState(readFromStorage());
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  const persist = useCallback((next: SubstanceSummary[]) => {
    writeToStorage(next);
    setBasketState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const addToBasket = useCallback(
    (substance: SubstanceSummary) => {
      const current = readFromStorage();
      if (current.find((s) => s.id === substance.id)) return;
      persist([...current, substance]);
    },
    [persist],
  );

  const removeFromBasket = useCallback(
    (id: string) => {
      const current = readFromStorage();
      persist(current.filter((s) => s.id !== id));
    },
    [persist],
  );

  const clearBasket = useCallback(() => persist([]), [persist]);

  return { basket, addToBasket, removeFromBasket, clearBasket };
}
