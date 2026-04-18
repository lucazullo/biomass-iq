import type { Summary } from "@/lib/types";
import { PROPERTY_CATEGORIES } from "@/lib/types";
import { formatBasis, formatValue } from "@/lib/formatters";

interface StatisticsPanelProps {
  summary: Summary;
}

export function StatisticsPanel({ summary }: StatisticsPanelProps) {
  if (summary.statistics.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No statistics available for the current filters.
      </div>
    );
  }

  // Group by category
  const grouped: Record<string, typeof summary.statistics> = {};
  for (const stat of summary.statistics) {
    if (!grouped[stat.category]) grouped[stat.category] = [];
    grouped[stat.category].push(stat);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Summary Statistics</h3>

      {Object.entries(grouped).map(([category, stats]) => (
        <div key={category}>
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
            {PROPERTY_CATEGORIES[category as keyof typeof PROPERTY_CATEGORIES] || category}
          </h4>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-slate-50">
                <tr className="text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">Property</th>
                  <th className="px-3 py-2 text-left font-medium">Basis</th>
                  <th className="px-3 py-2 text-right font-medium">N</th>
                  <th className="px-3 py-2 text-right font-medium">Mean</th>
                  <th className="px-3 py-2 text-right font-medium">Median</th>
                  <th className="px-3 py-2 text-right font-medium">SD</th>
                  <th className="px-3 py-2 text-right font-medium">Min</th>
                  <th className="px-3 py-2 text-right font-medium">Q1</th>
                  <th className="px-3 py-2 text-right font-medium">Q3</th>
                  <th className="px-3 py-2 text-right font-medium">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.map((stat) => (
                  <tr key={`${stat.property_code}-${stat.basis}`} className="hover:bg-gray-50 transition">
                    <td className="px-3 py-2 font-medium text-gray-800">
                      {stat.display_name}
                      {stat.includes_derived && (
                        <span className="ml-1 text-xs text-amber-500" title="Includes converted/imputed values">
                          *
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                        {formatBasis(stat.basis)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-600">{stat.count}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatValue(stat.mean)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatValue(stat.median)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatValue(stat.std)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-400">{formatValue(stat.min)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-400">{formatValue(stat.q1)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-400">{formatValue(stat.q3)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-400">{formatValue(stat.max)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {stats.some((s) => s.includes_derived) && (
            <p className="text-xs text-gray-400 mt-1">* Includes converted or imputed values</p>
          )}
        </div>
      ))}
    </div>
  );
}
