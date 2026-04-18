"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Summary, SampleRecord } from "@/lib/types";
import { formatBasis } from "@/lib/formatters";
import { useUnitSystem, convertValue } from "@/lib/unitConversion";

interface DistributionChartsProps {
  summary: Summary;
  observations: SampleRecord[];
}

const BASIS_COLORS: Record<string, string> = {
  ar: "#f59e0b",
  dry: "#14b8a6",
  daf: "#6366f1",
};

export function DistributionCharts({ summary, observations }: DistributionChartsProps) {
  const { system: unitSystem } = useUnitSystem();
  const chartableStats = summary.statistics.filter((s) => s.count >= 3);

  if (chartableStats.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm text-center text-sm text-gray-400">
        Not enough observations for distribution charts (need at least 3).
      </div>
    );
  }

  // Flatten all measurements by property, converted to the active unit system.
  const measurementsByProperty: Record<string, { value: number; basis: string; source: string }[]> = {};
  for (const record of observations) {
    for (const m of record.measurements) {
      const key = m.property_code;
      if (!measurementsByProperty[key]) measurementsByProperty[key] = [];
      const conv = convertValue(m.original_value, m.original_unit, unitSystem);
      measurementsByProperty[key].push({
        value: conv.value,
        basis: m.original_basis,
        source: record.source_dataset,
      });
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {chartableStats.slice(0, 8).map((stat) => {
        const data = measurementsByProperty[stat.property_code] || [];
        const basisData = data.filter((d) => d.basis === stat.basis);
        if (basisData.length < 3) return null;

        // Create histogram bins
        const values = basisData.map((d) => d.value);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const binCount = Math.min(Math.ceil(Math.sqrt(values.length)), 15);
        const binWidth = range / binCount;

        const bins: { label: string; count: number }[] = [];
        for (let i = 0; i < binCount; i++) {
          const lo = min + i * binWidth;
          const hi = lo + binWidth;
          const count = values.filter((v) => (i === binCount - 1 ? v >= lo && v <= hi : v >= lo && v < hi)).length;
          bins.push({ label: lo.toFixed(1), count });
        }

        const color = BASIS_COLORS[stat.basis] || "#14b8a6";

        return (
          <div key={`${stat.property_code}-${stat.basis}`} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-sm font-semibold text-gray-700">{stat.display_name}</h4>
              <span
                className="rounded px-1.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: `${color}20`, color }}
              >
                {formatBasis(stat.basis)}
              </span>
            </div>
            <div className="text-[10px] text-gray-400 mb-3">
              n={stat.count} &middot; mean={stat.mean?.toFixed(2)} &middot; SD={stat.std?.toFixed(2)}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={bins} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
}
