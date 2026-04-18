import type { PropertyStatistics } from "./types";

/**
 * A user-defined merge of multiple properties into one synthetic property.
 * e.g. combining "Ash", "Ash (550)", "Ash (850)" into one "Ash (combined)" row.
 *
 * `sourceKeys` are `property_code|basis` strings identifying rows to pool.
 */
export interface PropertyAggregation {
  id: string;
  name: string;
  sourceKeys: string[];
}

export function statKey(s: { property_code: string; basis: string }): string {
  return `${s.property_code}|${s.basis}`;
}

/**
 * Pool a set of PropertyStatistics into one using weighted mean and
 * pooled variance. Medians / quartiles can't be pooled from summaries alone,
 * so those come back as null.
 */
export function poolStats(
  stats: PropertyStatistics[],
): Omit<PropertyStatistics, "property_code" | "display_name" | "category" | "unit"> {
  const totalN = stats.reduce((s, st) => s + st.count, 0);
  if (totalN === 0) {
    return {
      basis: stats[0]?.basis ?? "dry",
      count: 0,
      mean: null,
      median: null,
      std: null,
      min: null,
      max: null,
      q1: null,
      q3: null,
      missing_count: 0,
      source_count: 0,
      includes_derived: false,
    };
  }

  const pooledMean =
    stats.reduce((s, st) => s + (st.mean ?? 0) * st.count, 0) / totalN;

  let numerator = 0;
  for (const st of stats) {
    if (st.count > 1 && st.std != null) {
      numerator += (st.count - 1) * st.std * st.std;
    }
    if (st.mean != null) {
      numerator += st.count * (st.mean - pooledMean) ** 2;
    }
  }
  const pooledStd = totalN > 1 ? Math.sqrt(numerator / (totalN - 1)) : null;

  const mins = stats.filter((s) => s.min != null).map((s) => s.min!);
  const maxs = stats.filter((s) => s.max != null).map((s) => s.max!);

  return {
    basis: stats[0]?.basis ?? "dry",
    count: totalN,
    mean: pooledMean,
    median: null,
    std: pooledStd,
    min: mins.length > 0 ? Math.min(...mins) : null,
    max: maxs.length > 0 ? Math.max(...maxs) : null,
    q1: null,
    q3: null,
    missing_count: stats.reduce((s, st) => s + st.missing_count, 0),
    source_count: stats.reduce((s, st) => s + st.source_count, 0),
    includes_derived: stats.some((s) => s.includes_derived),
  };
}

/**
 * Apply a set of aggregations to one substance/group's statistics:
 * replaces consumed source stats with pooled synthetic stats, grouped by basis.
 * Non-consumed stats pass through untouched.
 */
export function applyAggregations(
  statistics: PropertyStatistics[],
  aggregations: PropertyAggregation[],
): PropertyStatistics[] {
  if (aggregations.length === 0) return statistics;

  const consumed = new Set<string>();
  for (const a of aggregations) for (const k of a.sourceKeys) consumed.add(k);

  const out: PropertyStatistics[] = [];

  // For each aggregation, pool its source stats grouped by basis.
  for (const agg of aggregations) {
    const sources = statistics.filter((s) => agg.sourceKeys.includes(statKey(s)));
    if (sources.length === 0) continue;
    const byBasis: Record<string, PropertyStatistics[]> = {};
    for (const s of sources) {
      if (!byBasis[s.basis]) byBasis[s.basis] = [];
      byBasis[s.basis].push(s);
    }
    for (const [, basisStats] of Object.entries(byBasis)) {
      const pooled = poolStats(basisStats);
      out.push({
        ...pooled,
        property_code: `agg_${agg.id}`,
        display_name: `${agg.name} (combined)`,
        category: basisStats[0]?.category ?? "other",
        unit: basisStats[0]?.unit ?? "",
      });
    }
  }

  // Pass through non-consumed originals.
  for (const s of statistics) {
    if (!consumed.has(statKey(s))) out.push(s);
  }

  return out;
}
