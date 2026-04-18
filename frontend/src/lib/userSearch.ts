/**
 * Merge user-contributed sample data into search results.
 *
 * Two jobs:
 * 1. Boost observation_count on PHYLIS substances that have linked user samples
 *    (records the user has added). We also expose a user_count field used by
 *    the UI to render "PHYLIS: X · User: Y" annotations.
 * 2. Surface user-defined substances (not linked to any PHYLIS entry) as
 *    standalone search results so users can find samples they've saved with
 *    custom names.
 */

import type { SearchResult, SubstanceSummary } from "./types";
import { countUserSamplesBySubstance, listUserDefinedSubstances } from "./userData";

// Extend SubstanceSummary with user_count — kept optional so existing code still works
export interface SubstanceSummaryWithUser extends SubstanceSummary {
  user_count?: number;
  is_user_defined?: boolean;
}

export function augmentSearchWithUserData(
  result: SearchResult,
  query: string,
): SearchResult {
  const counts = countUserSamplesBySubstance();

  const annotate = (s: SubstanceSummary): SubstanceSummaryWithUser => {
    const userCount = counts.get(s.id) ?? 0;
    if (userCount === 0) return s;
    return { ...s, user_count: userCount };
  };

  const augmented: SearchResult = {
    exact_matches: result.exact_matches.map(annotate),
    broader_matches: result.broader_matches.map(annotate),
    narrower_matches: result.narrower_matches.map(annotate),
    related_matches: result.related_matches.map(annotate),
  };

  // Add user-defined substances (not linked to PHYLIS) that match the query
  const q = query.trim().toLowerCase();
  if (q) {
    const userDefined = listUserDefinedSubstances().filter((s) =>
      s.name.toLowerCase().includes(q),
    );
    const userDefinedResults: SubstanceSummaryWithUser[] = userDefined.map((s) => ({
      id: s.id,
      preferred_name: s.name,
      scientific_name: null,
      type: "user_defined",
      taxonomy_path: ["User-defined", s.name],
      observation_count: s.count,
      source_count: 0,
      user_count: s.count,
      is_user_defined: true,
    }));

    // Put exact-name matches up top with other exact matches, others with narrower
    const exactUser = userDefinedResults.filter((s) => s.preferred_name.toLowerCase() === q);
    const otherUser = userDefinedResults.filter((s) => s.preferred_name.toLowerCase() !== q);
    augmented.exact_matches = [...augmented.exact_matches, ...exactUser];
    augmented.narrower_matches = [...augmented.narrower_matches, ...otherUser];
  }

  return augmented;
}
