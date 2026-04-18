"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Display-only unit conversion (Metric ↔ US).
 *
 * Source-of-truth values in the database remain in their canonical metric
 * units. This module provides conversion functions + a persistent
 * "unit system" preference so the UI can render either system, while
 * CSV exports and chart PNGs reflect whatever system is currently on screen.
 */

export type UnitSystem = "metric" | "us";

export interface ConvertedValue {
  value: number;
  unit: string;
}

interface UnitRule {
  us_unit: string;
  factor: number;
  offset?: number; // for temperatures: us = metric * factor + offset
}

/**
 * Conversions from the canonical (metric) unit to its US equivalent.
 * Keys match `property_definition.canonical_unit` and raw measurement units.
 *
 * When a unit isn't listed, it's treated as identical in both systems
 * (e.g. %, wt%, mg/kg, pH, Bq/kg, dimensionless).
 */
const CONVERSIONS: Record<string, UnitRule> = {
  "MJ/kg": { us_unit: "BTU/lb", factor: 429.9226 },
  "kJ/kg": { us_unit: "BTU/lb", factor: 0.4299226 },
  "kg/m3": { us_unit: "lb/ft³", factor: 0.0624280 },
  "kg/m³": { us_unit: "lb/ft³", factor: 0.0624280 },
  "g/cm3": { us_unit: "lb/ft³", factor: 62.4280 },
  "g/cm³": { us_unit: "lb/ft³", factor: 62.4280 },
  "m3": { us_unit: "ft³", factor: 35.3147 },
  "m³": { us_unit: "ft³", factor: 35.3147 },
  mm: { us_unit: "in", factor: 0.0393701 },
  cm: { us_unit: "in", factor: 0.393701 },
  m: { us_unit: "ft", factor: 3.28084 },
  "°C": { us_unit: "°F", factor: 1.8, offset: 32 },
  C: { us_unit: "°F", factor: 1.8, offset: 32 },
};

/** Convert a (value, unit) pair from canonical/metric to the target system. */
export function convertValue(
  value: number | null | undefined,
  unit: string,
  system: UnitSystem,
): ConvertedValue {
  if (value == null || Number.isNaN(value)) {
    return { value: value as number, unit };
  }
  if (system === "metric") return { value, unit };
  const rule = CONVERSIONS[unit];
  if (!rule) return { value, unit };
  const converted = value * rule.factor + (rule.offset ?? 0);
  return { value: converted, unit: rule.us_unit };
}

/** Return the unit label as it would be displayed under the given system. */
export function displayUnit(unit: string, system: UnitSystem): string {
  if (system === "metric") return unit;
  return CONVERSIONS[unit]?.us_unit ?? unit;
}

/** Does this unit actually change between systems? */
export function hasConversion(unit: string): boolean {
  return unit in CONVERSIONS;
}

// ---------------------------------------------------------------------------
// Bulk conversion helpers for Summary / PropertyStatistics
// ---------------------------------------------------------------------------

interface StatLike {
  unit: string;
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  q1: number | null;
  q3: number | null;
}

function convertScalar(
  value: number | null,
  factor: number,
  offset: number,
): number | null {
  if (value == null || Number.isNaN(value)) return value;
  return value * factor + offset;
}

/**
 * Return a new PropertyStatistics with all value fields converted to the
 * target system. SD scales by the factor but has no offset (it's a delta).
 * Medians/quartiles convert like the mean.
 */
export function convertStat<T extends StatLike>(stat: T, system: UnitSystem): T {
  if (system === "metric") return stat;
  const rule = CONVERSIONS[stat.unit];
  if (!rule) return stat;
  const { factor } = rule;
  const offset = rule.offset ?? 0;
  return {
    ...stat,
    mean: convertScalar(stat.mean, factor, offset),
    median: convertScalar(stat.median, factor, offset),
    // SD is a dispersion, not a point value — scales by factor only.
    std: stat.std == null ? null : Math.abs(factor) * stat.std,
    min: convertScalar(stat.min, factor, offset),
    max: convertScalar(stat.max, factor, offset),
    q1: convertScalar(stat.q1, factor, offset),
    q3: convertScalar(stat.q3, factor, offset),
    unit: rule.us_unit,
  };
}

/** Convert every stat inside a Summary-like object. */
export function convertSummary<S extends { statistics: StatLike[] }>(
  summary: S,
  system: UnitSystem,
): S {
  if (system === "metric") return summary;
  return {
    ...summary,
    statistics: summary.statistics.map((s) => convertStat(s, system)),
  };
}

// ---------------------------------------------------------------------------
// Preference hook (localStorage-backed)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "biomassiq.unitSystem.v1";
const CHANGE_EVENT = "biomassiq:unit-system-changed";

function readFromStorage(): UnitSystem {
  if (typeof window === "undefined") return "metric";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "us" || raw === "metric") return raw;
  } catch {
    /* ignore */
  }
  return "metric";
}

function writeToStorage(value: UnitSystem) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore */
  }
}

export function useUnitSystem() {
  const [system, setSystemState] = useState<UnitSystem>("metric");

  useEffect(() => {
    setSystemState(readFromStorage());
    const onChange = () => setSystemState(readFromStorage());
    window.addEventListener("storage", onChange);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  const setSystem = useCallback((next: UnitSystem) => {
    writeToStorage(next);
    setSystemState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { system, setSystem };
}
