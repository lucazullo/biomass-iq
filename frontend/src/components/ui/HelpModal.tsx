"use client";

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-lg font-semibold text-gray-800">User Guide</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-6 max-h-[70vh] overflow-y-auto text-sm text-gray-700 leading-relaxed">
          {/* Getting started */}
          <Section title="Getting Started">
            <p>
              BiomassIQ lets you search, compare, and analyze biomass property data from public databases —
              starting with <strong>PHYLIS</strong> (phyllis.nl).
            </p>
            <ol className="list-decimal list-inside space-y-1 mt-2 text-gray-600">
              <li>Type a material name in the search bar (e.g. <em>wheat straw</em>, <em>pine</em>).</li>
              <li>Select one or more materials from the disambiguation list.</li>
              <li>Click <strong>View</strong> to open the detail page with all observations and statistics.</li>
            </ol>
          </Section>

          {/* Design principles */}
          <Section title="Design Principles">
            <ul className="space-y-2">
              <Principle icon="✓" text="Never aggregate incompatible analytical bases. As-received, dry, and dry ash-free values are always kept separate in statistics." />
              <Principle icon="✓" text="Preserve provenance at the measurement level. Every value traces back to its source dataset, original sample, citation, and remarks." />
              <Principle icon="✓" text="Disclose what you're looking at. Observation count, source count, active filters, and derivation status are always visible." />
              <Principle icon="✓" text="Never auto-merge similar materials. The user explicitly selects what to aggregate." />
            </ul>
          </Section>

          {/* Search & disambiguation */}
          <Section title="Search &amp; Disambiguation">
            <p>
              Search returns <strong>canonical materials</strong>, not individual source records. Each row shows the
              material name, its taxonomy path, per-source sample counts (e.g. <em>74 PHYLIS</em>), and type.
            </p>
            <p className="mt-2">
              When different materials share the same name (e.g. <em>wheat straw</em> under biochar vs under cereal straw),
              an amber badge shows the parent category to disambiguate.
            </p>
            <p className="mt-2">
              Select multiple materials via checkboxes to view their combined data. Use <strong>Select all</strong> to
              grab every result, or <strong>Compare</strong> tab for side-by-side comparison.
            </p>
          </Section>

          {/* Substance detail */}
          <Section title="Substance Detail Page">
            <p>The detail page has four collapsible sections:</p>
            <dl className="space-y-2 mt-2">
              <Term
                label="Property Coverage"
                def="Shows every property available for this material, grouped by category (proximate, ultimate, heating, ash chemistry, trace elements). Click any property to exclude it from the data views. Click 'deselect group' to remove a whole category."
              />
              <Term
                label="Filters"
                def="Basis filter (AR / Dry / DAF), derivation filter (observed / converted / imputed), and toggles for grouped averages and subtypes."
              />
              <Term
                label="Summary Statistics"
                def="Per-property per-basis statistics (N, mean, SD, min, max). Select rows to aggregate multiple properties into a user-named combined property, or to graph only selected rows."
              />
              <Term
                label="Raw Observations"
                def="Every individual measurement with source, derivation, sample name, and year. Sortable by any column."
              />
            </dl>
          </Section>

          {/* Visualizations */}
          <Section title="Visualizations">
            <p>
              Click <strong>Graph</strong> in the Summary Statistics panel to visualize property ranges.
              The chart shows:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Mean</strong> as a dark dot</li>
              <li><strong>±1 SD</strong> as a darker teal band</li>
              <li><strong>±2 SD</strong> as a lighter teal band</li>
              <li><strong>Min / Max</strong> as dashed whiskers</li>
            </ul>
            <p className="mt-2">
              Charts are grouped by unit so scales are comparable. Use <strong>Export PNG</strong> to save the chart as an image.
            </p>
          </Section>

          {/* Property aggregation */}
          <Section title="Property Aggregation">
            <p>
              In the Summary Statistics, you can combine related properties into a single aggregated entry.
              Example: combine <em>Ash</em>, <em>Ash (550°C)</em>, and <em>Ash (815°C)</em> (all on dry basis) into a user-named
              <em> Ash Content (combined)</em> row.
            </p>
            <p className="mt-2">
              Aggregations use <strong>pooled statistics</strong>: weighted mean, pooled SD, combined min/max.
              Click the disaggregate icon to restore the original properties.
            </p>
          </Section>

          {/* Multi-substance analysis */}
          <Section title="Multi-Substance Analysis">
            <p>
              Use the <strong>selection basket</strong> at the bottom of the search page to accumulate
              substances across multiple searches (e.g. search &quot;waste&quot; and add 2, then search
              &quot;MSW&quot; and add 3 more — all 5 go into one basket).
            </p>
            <p className="mt-2">
              Click <strong>View all</strong> to open the combined analysis. You can then switch between:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Merged mode</strong> — all substances pooled into a single dataset, one set of statistics.</li>
              <li><strong>Compare mode</strong> — each substance keeps its own identity, shown side-by-side with color coding in the stats table and the range chart.</li>
            </ul>
            <p className="mt-2">
              The <strong>✕</strong> button on each substance removes it from the view without going back to search.
              The URL updates so you can share the exact multi-substance view.
            </p>
          </Section>

          {/* Grouping */}
          <Section title="Comparison Groups">
            <p>
              When comparing <strong>more than two</strong> substances, you can form groups to create &quot;supersets&quot; —
              useful for comparing your data against aggregated PHYLIS data, or grouping related materials.
            </p>
            <p className="mt-2">
              In Compare mode, the <strong>Comparison Groups</strong> panel appears. By default each substance is its own group.
              Use the dropdown on each substance chip to move it into another group, or click <strong>+ New empty group</strong>
              and assign substances to it. Quick buttons:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>One group per substance</strong> — resets to the default (each separate).</li>
              <li><strong>First vs. rest</strong> — isolates the first substance and merges the others into one group (useful for comparing your sample against aggregate reference data).</li>
            </ul>
            <p className="mt-2">
              Within each group, member statistics are <strong>pooled</strong> (weighted mean, pooled SD). The stats table and
              range chart then compare <em>groups</em> rather than individual substances.
              Click a group name to rename it.
            </p>
          </Section>

          {/* My Data */}
          <Section title="My Data (User Samples)">
            <p>
              Use the <strong>My Data</strong> button in the header to add your own biomass samples.
              Everything stays in your browser&apos;s local storage — nothing is sent to any server.
            </p>
            <p className="mt-2">
              Each user sample can be:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Linked to a PHYLIS substance</strong> — pick from the dropdown as you type. Your sample appears in that substance&apos;s detail page tagged as &quot;user&quot;, alongside PHYLIS data.</li>
              <li><strong>User-defined</strong> — if no PHYLIS match fits, type a custom name. A user-defined substance is created (e.g. <em>MSW Organics</em>) and searchable alongside PHYLIS results with an amber user-defined badge.</li>
            </ul>
            <p className="mt-2">
              Properties cover all 47 measurements found in PHYLIS, grouped into five categories:
              Proximate, Ultimate, Heating, Ash Chemistry, and Trace Elements.
            </p>
            <p className="mt-2">
              <strong>Quick contribution</strong>: from any substance detail page, click <strong>+ Add my data</strong>
              to open a pre-filled form linked to that substance.
            </p>
            <p className="mt-2">
              <strong>Import / Export</strong>:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Export JSON</strong> — roundtrip-safe; preserves all fields and can be re-imported.</li>
              <li><strong>Export CSV</strong> — flat table for spreadsheets.</li>
              <li><strong>Import</strong> — merge a previously-saved JSON file into your current samples.</li>
            </ul>
          </Section>

          {/* Export */}
          <Section title="Exporting Data">
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li><strong>Observation CSV</strong> — raw measurements with full provenance columns and citations.</li>
              <li><strong>Observation JSON</strong> — structured data for programmatic use.</li>
              <li><strong>Summary CSV</strong> — statistics reflecting what is displayed (including aggregations).</li>
              <li><strong>Chart PNG</strong> — high-resolution range chart for reports.</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500 italic">
              All exports include a header comment with the substance name, total observations, active filters,
              and export timestamp for reproducibility.
            </p>
          </Section>

          {/* Interpreting data */}
          <Section title="Interpreting Data Responsibly">
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Moisture on dry or dry-ash-free basis is excluded (definitionally zero).</li>
              <li>Derived values (converted or imputed) are flagged. Filter to <em>Observed</em> only if you need direct measurements.</li>
              <li>Summary statistics are computed <strong>per basis</strong>. Never compare an AR mean to a dry mean directly.</li>
              <li>Low sample counts (N&lt;5) should be treated with caution; std and quartiles may be unreliable.</li>
            </ul>
          </Section>

          {/* Data sources */}
          <Section title="Data Sources">
            <p>
              Click the <strong>Databases</strong> button in the header to see all integrated sources,
              their status, and contact links. Current sources:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>PHYLIS</strong> (active) — 3,284 samples, 397 canonical materials</li>
              <li><strong>INL Bioenergy Feedstock Library</strong> (planned)</li>
              <li><strong>CSIRO Biomass &amp; Waste Database</strong> (planned)</li>
            </ul>
          </Section>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl text-xs text-gray-400">
          BiomassIQ is an evidence-preserving analytical workbench. When in doubt, inspect the raw observations and cite the original sources.
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <span className="h-1 w-4 bg-teal-500 rounded-full" />
        {title}
      </h3>
      <div className="text-sm text-gray-600 pl-6">{children}</div>
    </section>
  );
}

function Principle({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-teal-600 font-bold shrink-0 mt-0.5">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function Term({ label, def }: { label: string; def: string }) {
  return (
    <div>
      <dt className="font-medium text-gray-800">{label}</dt>
      <dd className="text-xs text-gray-500 mt-0.5 ml-1">{def}</dd>
    </div>
  );
}
