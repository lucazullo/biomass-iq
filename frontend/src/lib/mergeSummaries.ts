import type { Summary, PropertyStatistics, ObservationFilters } from "./types";

/**
 * Pool a set of per-substance summaries into one combined Summary.
 * Property statistics are grouped by (property_code, basis) and re-pooled
 * using a weighted-mean / pooled-variance approach.
 */
export function mergeSummaries(summaries: Summary[], filters: ObservationFilters): Summary {
  if (summaries.length === 0) {
    return {
      substance_id: "empty",
      substance_name: "",
      total_observations: 0,
      total_sources: 0,
      active_filters: filters,
      statistics: [],
    };
  }
  if (summaries.length === 1) {
    return { ...summaries[0], active_filters: filters };
  }

  const totalObs = summaries.reduce((s, sm) => s + sm.total_observations, 0);
  const totalSrc = summaries.reduce((s, sm) => s + sm.total_sources, 0);
  const names = summaries.map((s) => s.substance_name).join(" + ");

  const groups = new Map<string, PropertyStatistics[]>();
  for (const sm of summaries) {
    for (const stat of sm.statistics) {
      const key = `${stat.property_code}|${stat.basis}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(stat);
    }
  }

  const mergedStats: PropertyStatistics[] = [];
  for (const [, stats] of groups) {
    if (stats.length === 1) {
      mergedStats.push(stats[0]);
      continue;
    }
    const totalN = stats.reduce((s, st) => s + st.count, 0);
    const pooledMean =
      totalN > 0 ? stats.reduce((s, st) => s + (st.mean ?? 0) * st.count, 0) / totalN : null;

    let pooledStd: number | null = null;
    if (totalN > 1 && pooledMean != null) {
      let num = 0;
      for (const st of stats) {
        if (st.count > 1 && st.std != null) num += (st.count - 1) * st.std * st.std;
        if (st.mean != null) num += st.count * (st.mean - pooledMean) ** 2;
      }
      pooledStd = Math.sqrt(num / (totalN - 1));
    }

    const mins = stats.filter((s) => s.min != null).map((s) => s.min!);
    const maxs = stats.filter((s) => s.max != null).map((s) => s.max!);

    mergedStats.push({
      ...stats[0],
      count: totalN,
      mean: pooledMean != null ? Math.round(pooledMean * 10000) / 10000 : null,
      median: null,
      std: pooledStd != null ? Math.round(pooledStd * 10000) / 10000 : null,
      min: mins.length > 0 ? Math.min(...mins) : null,
      max: maxs.length > 0 ? Math.max(...maxs) : null,
      q1: null,
      q3: null,
      source_count: stats.reduce((s, st) => s + st.source_count, 0),
      includes_derived: stats.some((s) => s.includes_derived),
    });
  }

  return {
    substance_id: summaries[0].substance_id,
    substance_name: names,
    total_observations: totalObs,
    total_sources: totalSrc,
    active_filters: filters,
    statistics: mergedStats,
  };
}
