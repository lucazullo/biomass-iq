"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { SampleRecord, PropertyCoverage } from "@/lib/types";
import { usePropertyColors, BASIS_DISPLAY_NAMES, type Basis } from "@/lib/chartColors";
import { useUnitSystem, convertValue } from "@/lib/unitConversion";

interface PropertyHistogramModalProps {
  property: PropertyCoverage;
  observations: SampleRecord[];
  onClose: () => void;
}

const BIN_COUNT_CAP = 20;

export function PropertyHistogramModal({
  property,
  observations,
  onClose,
}: PropertyHistogramModalProps) {
  const { getColor } = usePropertyColors();
  const baseColor = getColor(property.property_code);
  const { system: unitSystem } = useUnitSystem();

  // Collect values per basis for this property (normalized where available, else original).
  const { bases, bins, stats, unit } = useMemo(() => {
    const byBasis: Record<string, number[]> = {};
    let unit = "";
    for (const rec of observations) {
      for (const m of rec.measurements) {
        if (m.property_code !== property.property_code) continue;
        const basis = m.normalized_basis || m.original_basis;
        const rawValue =
          m.normalized_value !== null && m.normalized_value !== undefined
            ? m.normalized_value
            : m.original_value;
        if (rawValue === null || rawValue === undefined || Number.isNaN(rawValue)) continue;
        const conv = convertValue(rawValue, m.original_unit, unitSystem);
        if (!byBasis[basis]) byBasis[basis] = [];
        byBasis[basis].push(conv.value);
        if (!unit) unit = conv.unit;
      }
    }
    const bases = Object.keys(byBasis).filter((b) => byBasis[b].length > 0);

    // Global min/max across all bases so the bins line up.
    const allValues = bases.flatMap((b) => byBasis[b]);
    if (allValues.length === 0) {
      return { bases, bins: [], stats: {}, unit };
    }
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const range = max - min || 1;
    const binCount = Math.min(
      Math.max(5, Math.ceil(Math.sqrt(allValues.length))),
      BIN_COUNT_CAP,
    );
    const binWidth = range / binCount;

    const decimals = binWidth < 1 ? 2 : 1;
    type Row = Record<string, number | string>;
    const rows: Row[] = [];
    for (let i = 0; i < binCount; i++) {
      const lo = min + i * binWidth;
      const hi = lo + binWidth;
      const mid = (lo + hi) / 2;
      const row: Row = {
        // Bar x-position: midpoint of the bin range.
        bin: mid.toFixed(decimals),
        binLo: lo,
        binHi: hi,
        binRange: `${lo.toFixed(decimals)} – ${hi.toFixed(decimals)}`,
      };
      for (const b of bases) {
        const values = byBasis[b];
        const count = values.filter((v) =>
          i === binCount - 1 ? v >= lo && v <= hi : v >= lo && v < hi,
        ).length;
        row[b] = count;
      }
      rows.push(row);
    }

    const stats: Record<string, { n: number; mean: number; median: number; std: number }> = {};
    for (const b of bases) {
      const vs = [...byBasis[b]].sort((a, z) => a - z);
      const n = vs.length;
      const mean = vs.reduce((s, v) => s + v, 0) / n;
      const median =
        n % 2 === 0 ? (vs[n / 2 - 1] + vs[n / 2]) / 2 : vs[Math.floor(n / 2)];
      const variance = vs.reduce((s, v) => s + (v - mean) ** 2, 0) / (n > 1 ? n - 1 : 1);
      stats[b] = { n, mean, median, std: Math.sqrt(variance) };
    }

    return { bases, bins: rows, stats, unit };
  }, [observations, property.property_code, unitSystem]);

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {property.display_name}{" "}
              {unit && <span className="text-sm font-normal text-gray-500">[{unit}]</span>}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {(() => {
                const parts = bases.map(
                  (b) => `${stats[b].n} ${BASIS_DISPLAY_NAMES[b as Basis] || b}`,
                );
                const total = bases.reduce((sum, b) => sum + stats[b].n, 0);
                if (parts.length === 0) {
                  return "No plotted observations";
                }
                return `Distribution across ${total} plotted value${total === 1 ? "" : "s"} (${parts.join(" · ")})`;
              })()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {bins.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-10">
              No measurement data available for this property in the current observation set.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={bins} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bin" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(label, payload) => {
                      const row = payload?.[0]?.payload as { binRange?: string } | undefined;
                      return row?.binRange ? `Range: ${row.binRange}${unit ? ` ${unit}` : ""}` : `Midpoint: ${label}`;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {bases.map((b, i) => {
                    // All bases share the property's base color; differentiate via opacity.
                    const opacity = bases.length === 1 ? 0.85 : 0.4 + (0.5 * i) / Math.max(1, bases.length - 1);
                    const label = BASIS_DISPLAY_NAMES[b as Basis] || b;
                    const n = stats[b]?.n ?? 0;
                    return (
                      <Bar
                        key={b}
                        dataKey={b}
                        name={`${label} (n=${n})`}
                        fill={baseColor.fill}
                        fillOpacity={opacity}
                        radius={[3, 3, 0, 0]}
                      />
                    );
                  })}
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bases.map((b, i) => {
                  const s = stats[b];
                  const c = baseColor.fill;
                  const opacity = bases.length === 1 ? 0.85 : 0.4 + (0.5 * i) / Math.max(1, bases.length - 1);
                  return (
                    <div
                      key={b}
                      className="rounded-lg border border-gray-200 p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: c, opacity }}
                        />
                        <span className="text-sm font-semibold text-gray-700">
                          {BASIS_DISPLAY_NAMES[b as Basis] || b}
                        </span>
                      </div>
                      <dl className="text-xs text-gray-600 space-y-0.5">
                        <Row label="n">{s.n}</Row>
                        <Row label="mean">{s.mean.toFixed(3)}</Row>
                        <Row label="median">{s.median.toFixed(3)}</Row>
                        <Row label="SD">{s.std.toFixed(3)}</Row>
                      </dl>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-medium text-gray-700">{children}</dd>
    </div>
  );
}
