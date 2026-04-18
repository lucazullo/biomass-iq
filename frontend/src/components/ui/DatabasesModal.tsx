"use client";

interface DatabasesModalProps {
  onClose: () => void;
}

const DATABASES = [
  {
    name: "PHYLIS",
    url: "https://phyllis.nl",
    status: "active" as const,
    description:
      "ECN/TNO biomass characterization database. Broad coverage of lignocellulosic biomass, agricultural residues, woody materials, and processed fuels. ~3,000 records with proximate, ultimate, heating value, and ash chemistry data.",
    notes:
      "Primary anchor dataset. Exposes the full range of data-model challenges: mixed naming, hierarchical categories, variable property coverage, and mixed analytical bases.",
  },
  {
    name: "INL Bioenergy Feedstock Library",
    url: "https://bioenergylibrary.inl.gov",
    status: "planned" as const,
    description:
      "Idaho National Laboratory feedstock characterization library. Strong U.S.-relevant feedstock coverage with potential links between composition and conversion performance.",
    notes: "Target for second integration. May materially expand sample volume and U.S. relevance.",
  },
  {
    name: "CSIRO Biomass & Waste Database",
    url: "https://www.csiro.au",
    status: "planned" as const,
    description:
      "Australian biomass and waste characterization data. Good geographic complement covering Australian feedstocks with mineral and thermal property data.",
    notes: "Planned future integration for geographic diversification.",
  },
];

export function DatabasesModal({ onClose }: DatabasesModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Databases</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {DATABASES.map((db) => (
            <div
              key={db.name}
              className="rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800">{db.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      db.status === "active"
                        ? "bg-teal-50 text-teal-700 border border-teal-200"
                        : "bg-gray-50 text-gray-500 border border-gray-200"
                    }`}
                  >
                    {db.status === "active" ? "Active" : "Planned"}
                  </span>
                </div>
                <a
                  href={db.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-600 hover:text-teal-700 transition"
                >
                  {db.url.replace("https://", "")}
                </a>
              </div>
              <p className="text-sm text-gray-600 mb-2">{db.description}</p>
              <p className="text-xs text-gray-400 italic">{db.notes}</p>
            </div>
          ))}
        </div>
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-gray-400">
            Data is sourced from public databases. Original citations and provenance are preserved for all records.
          </p>
        </div>
      </div>
    </div>
  );
}
