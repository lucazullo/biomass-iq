import type { SubstanceDetail } from "@/lib/types";
import { formatSubstanceType } from "@/lib/formatters";

interface SubstanceHeaderProps {
  substance: SubstanceDetail;
}

export function SubstanceHeader({ substance }: SubstanceHeaderProps) {
  return (
    <div>
      {/* Taxonomy breadcrumb */}
      <div className="text-xs text-gray-400 mb-2">
        {substance.taxonomy_path.map((segment, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1">&gt;</span>}
            <span className={i === substance.taxonomy_path.length - 1 ? "font-medium text-gray-600" : ""}>
              {segment}
            </span>
          </span>
        ))}
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{substance.preferred_name}</h1>
          {substance.scientific_name && (
            <p className="text-base text-gray-500 italic mt-0.5">{substance.scientific_name}</p>
          )}
        </div>
        <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700 border border-teal-200">
          {formatSubstanceType(substance.type)}
        </span>
      </div>

      {/* Aliases */}
      {substance.aliases.length > 0 && (
        <div className="mt-3">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Also known as:{" "}
          </span>
          <span className="text-sm text-gray-500">
            {substance.aliases.map((a) => a.label).join(", ")}
          </span>
        </div>
      )}

      {/* Relations */}
      {substance.relations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {substance.relations.map((rel) => (
            <a
              key={rel.related_id}
              href={`/substance/${rel.related_id}`}
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600 hover:bg-gray-200 transition"
            >
              <span className="text-gray-400">{rel.relation_type}:</span>
              {rel.related_name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
