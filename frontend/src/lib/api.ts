import type {
  SearchResult,
  SubstanceDetail,
  SampleRecord,
  Summary,
  ObservationFilters,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        searchParams.append(key, String(v));
      }
    } else {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

// --- Search ---

export async function searchSubstances(query: string, limit = 20): Promise<SearchResult> {
  return fetchApi(`/api/search/substances${buildQueryString({ q: query, limit })}`);
}

export async function getSubstance(id: string): Promise<SubstanceDetail> {
  return fetchApi(`/api/search/substances/${id}`);
}

// --- Observations ---

export async function getObservations(
  substanceId: string,
  filters: ObservationFilters = {},
  page = 1,
  pageSize = 50,
  includeSubtypes = false,
): Promise<SampleRecord[]> {
  return fetchApi(
    `/api/observations/${substanceId}${buildQueryString({
      ...filters,
      page,
      page_size: pageSize,
      include_subtypes: includeSubtypes || undefined,
    })}`,
  );
}

// --- Summary ---

export async function getSummary(
  substanceId: string,
  filters: ObservationFilters = {},
  includeSubtypes = false,
): Promise<Summary> {
  return fetchApi(
    `/api/summary/${substanceId}${buildQueryString({
      ...filters,
      include_subtypes: includeSubtypes || undefined,
    })}`,
  );
}

// --- Compare ---

export async function compareSubstances(
  items: { substance_id: string; filters?: ObservationFilters }[],
  properties?: string[],
): Promise<Summary[]> {
  return fetchApi("/api/compare/substances", {
    method: "POST",
    body: JSON.stringify({ items, properties }),
  });
}

// --- Export ---

export function getExportUrl(
  substanceId: string,
  format: "csv" | "json",
  filters: ObservationFilters = {},
): string {
  return `${API_URL}/api/export/observations/${substanceId}/${format}${buildQueryString(filters as unknown as Record<string, unknown>)}`;
}
