"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { Summary } from "@/lib/types";
import { PROPERTY_CATEGORIES } from "@/lib/types";
import { formatBasis, formatValue } from "@/lib/formatters";

interface ComparisonViewProps {
  summaries: Summary[];
}

const COLORS = ["#14b8a6", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function ComparisonView({ summaries }: ComparisonViewProps) {
  // Collect all unique (property, basis) pairs
  const allKeys = new Set<string>();
  for (const summary of summaries) {
    for (const stat of summary.statistics) {
      allKeys.add(`${stat.property_code}|${stat.basis}`);
    }
  }

  const rows = Array.from(allKeys)
    .map((key) => {
      const [propCode, basis] = key.split("|");
      const values: Record<string, { mean: number | null; count: number; displayName: string; category: string }> = {};
      let displayName = propCode;
      let category = "other";

      for (const summary of summaries) {
        const stat = summary.statistics.find((s) => s.property_code === propCode && s.basis === basis);
        if (stat) {
          displayName = stat.display_name;
          category = stat.category;
          values[summary.substance_id] = {
            mean: stat.mean,
            count: stat.count,
            displayName: stat.display_name,
            category: stat.category,
          };
        }
      }

      return { propCode, basis, displayName, category, values };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName));

  // Group by category
  const grouped: Record<string, typeof rows> = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  // Chart data
  const chartProperties = rows.filter((r) =>
    summaries.every((s) => r.values[s.substance_id]?.mean != null),
  );

  return (
    <div className="space-y-4">
      {/* Comparison chart */}
      {chartProperties.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Property Comparison</h3>
          <ResponsiveContainer width="100%" height={Math.max(300, chartProperties.length * 35)}>
            <BarChart
              data={chartProperties.map((r) => {
                const point: Record<string, string | number | null> = {
                  name: `${r.displayName} (${r.basis})`,
                };
                for (const s of summaries) {
                  point[s.substance_name] = r.values[s.substance_id]?.mean ?? null;
                }
                return point;
              })}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
              <Tooltip />
              <Legend />
              {summaries.map((s, i) => (
                <Bar key={s.substance_id} dataKey={s.substance_name} fill={COLORS[i % COLORS.length]} radius={[0, 3, 3, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* Comparison tables */}
      {Object.entries(grouped).map(([category, categoryRows]) => (
        <section key={category} className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-3 border-b border-gray-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-gray-700">
              {PROPERTY_CATEGORIES[category as keyof typeof PROPERTY_CATEGORIES] || category}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">Property</th>
                  <th className="px-3 py-2 text-left font-medium">Basis</th>
                  {summaries.map((s) => (
                    <th key={s.substance_id} className="px-3 py-2 text-right font-medium">
                      {s.substance_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {categoryRows.map((row) => (
                  <tr key={`${row.propCode}-${row.basis}`} className="hover:bg-gray-50 transition">
                    <td className="px-3 py-2 font-medium text-gray-800">{row.displayName}</td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                        {formatBasis(row.basis as "ar" | "dry" | "daf")}
                      </span>
                    </td>
                    {summaries.map((s) => {
                      const v = row.values[s.substance_id];
                      return (
                        <td key={s.substance_id} className="px-3 py-2 text-right tabular-nums">
                          {v ? (
                            <span>
                              {formatValue(v.mean)}
                              <span className="text-gray-400 text-xs ml-1">(n={v.count})</span>
                            </span>
                          ) : (
                            <span className="text-gray-300">&mdash;</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
