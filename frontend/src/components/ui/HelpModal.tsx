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
              BiomassIQ lets you search, compare, and analyze biomass property data pooled from multiple
              public databases. Currently integrated: <strong>PHYLIS</strong> (TNO, phyllis.nl) and the
              <strong> CSIRO Database of chemical properties of Australian biomass and waste</strong>
              {" "}(CC BY 4.0). Additional sources are planned.
            </p>
            <ol className="list-decimal list-inside space-y-1 mt-2 text-gray-600">
              <li>Type a material name in the search bar (e.g. <em>wheat straw</em>, <em>hardwood</em>, <em>bagasse</em>).</li>
              <li>Tick the materials you&rsquo;re interested in — they collect in the floating <strong>basket</strong> at the bottom of the page.</li>
              <li>Click <strong>View all</strong> on the basket (or <strong>View</strong> on a single result) to open the analysis page.</li>
            </ol>
          </Section>

          {/* Design principles */}
          <Section title="Design Principles">
            <ul className="space-y-2">
              <Principle icon="✓" text="Never aggregate incompatible analytical bases. As-received (ar), air-dried (ad), dry (db), and dry ash-free (daf) values are always kept separate in statistics." />
              <Principle icon="✓" text="Preserve provenance at the measurement level. Every value traces back to its source dataset, original sample, citation, and remarks." />
              <Principle icon="✓" text="Disclose what you're looking at. Observation count, source count, active filters, and derivation status are always visible." />
              <Principle icon="✓" text="Never auto-merge similar materials. The user explicitly selects what to aggregate." />
              <Principle icon="✓" text="Display-only conversions. Underlying values never change when you flip unit system or basis filter — only the rendering." />
            </ul>
          </Section>

          {/* Search & disambiguation */}
          <Section title="Search &amp; Disambiguation">
            <p>
              Search returns <strong>canonical materials</strong>, not individual source records. Same-named
              materials from different sources (e.g. PHYLIS and CSIRO) are merged under one canonical row so
              cross-source analysis just works.
            </p>
            <p className="mt-2">
              Each row shows the material name, taxonomy path, type, and the total observation count. A small
              teal <strong>N×</strong> pill indicates a material with data from multiple sources — e.g.
              <em> 45 2×</em> means 45 observations pooled across 2 databases.
            </p>
            <p className="mt-2">
              When different materials share the same name (e.g. <em>wheat straw</em> under biochar vs under
              cereal straw), an amber badge shows the parent category to disambiguate.
            </p>
            <p className="mt-2">
              Tick materials to add them to the <strong>basket</strong>. Use <strong>Select all</strong> to
              grab every result in a group, or switch to the <strong>Compare</strong> tab for side-by-side analysis.
            </p>
          </Section>

          {/* The basket */}
          <Section title="The Selection Basket">
            <p>
              The floating panel at the bottom of every page is your <strong>basket</strong> — everything you
              tick during a session accumulates here, even across multiple searches, and persists across
              navigation and browser reloads.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li>Click the upward arrow on the basket to expand it and see every item.</li>
              <li>The <strong>N×</strong> pill on a basket chip indicates a multi-source substance.</li>
              <li>Click <strong>View all</strong> to open the multi-substance analysis page.</li>
              <li>The <strong>Compare</strong> tab at the top reads directly from the basket.</li>
              <li>Use <strong>Empty basket</strong> in the header (top-right) to clear everything — a confirmation prompts first.</li>
            </ul>
          </Section>

          {/* Substance detail */}
          <Section title="Substance / Analysis Page">
            <p>Collapsible sections from top to bottom:</p>
            <dl className="space-y-2 mt-2">
              <Term
                label="Basis selection"
                def="Choose which analytical bases to include (ar / ad / db / daf), plus derivation filter (observed / converted / imputed), toggles for grouped averages and subtype inclusion."
              />
              <Term
                label="Property Coverage"
                def="Every property available for this material, grouped by category (proximate, ultimate, heating, ash chemistry, trace elements). Click a tile to exclude it; hover for a small bar-chart icon that opens the property's distribution histogram."
              />
              <Term
                label="Mode toggle (multi-substance only)"
                def="Merged pools all substances into one combined dataset. Compare keeps each substance's statistics separate for side-by-side display."
              />
              <Term
                label="Summary Statistics"
                def="Per-property per-basis means, SDs, mins, and maxes. Tick rows to graph only a subset, or to combine multiple related properties into a user-named aggregate."
              />
              <Term
                label="Raw Observations"
                def="Every individual measurement with source, derivation, sample name, year, and a provenance link back to the original record. Sort by any column. Per-row 'Use' checkmark lets you exclude outliers from statistics."
              />
            </dl>
          </Section>

          {/* Units */}
          <Section title="Metric / US Unit System">
            <p>
              The <strong>Metric / US</strong> toggle in the header switches all displayed values between SI
              and US customary units. Conversions are <em>display-only</em> — the underlying database is
              always metric.
            </p>
            <p className="mt-2">
              MJ/kg → BTU/lb, kg/m³ → lb/ft³, mm → in, °C → °F, etc. Percentages, pH, and mg/kg are
              dimensionless and pass through unchanged.
            </p>
            <p className="mt-2">
              CSV exports and chart PNGs reflect whichever system is on screen at export time. The CSV header
              block records which system was used.
            </p>
          </Section>

          {/* Visualizations */}
          <Section title="Charts &amp; Histograms">
            <p>
              Click <strong>Graph</strong> in the Summary Statistics panel to visualize property ranges:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Mean</strong> as a dark dot</li>
              <li><strong>±1 SD</strong> as the darker shade of the property&rsquo;s color</li>
              <li><strong>±2 SD</strong> as the lighter shade of the same color</li>
              <li><strong>Min / Max</strong> as dashed whiskers</li>
            </ul>
            <p className="mt-2">
              The <strong>Colors</strong> button in the chart header opens a palette picker with 25 preset
              swatches. Each property can be assigned its own color; the two SD shades are derived
              automatically. Selections persist in your browser.
            </p>
            <p className="mt-2">
              From the Property Coverage tiles, click the small bar-chart icon on any tile to open a
              full <strong>histogram modal</strong> for that property — binned by value, with one
              series per basis and per-basis mini-stats (n, mean, median, SD).
            </p>
            <p className="mt-2">
              Charts are grouped by unit so scales stay comparable. Use <strong>Export PNG</strong> to save
              the chart; the export respects your current Metric/US selection and omits UI chrome.
            </p>
          </Section>

          {/* Property aggregation */}
          <Section title="Property Aggregation">
            <p>
              In the Summary Statistics (single substance <em>or</em> in the Compare tab), tick two or more
              related property rows and click <strong>Aggregate N into one property</strong>. Name the
              combined property (e.g. <em>Ash</em>) and it replaces the source rows with one synthetic row
              per basis.
            </p>
            <p className="mt-2">
              Example: combine <em>Ash</em>, <em>Ash (550°C)</em>, <em>Ash (815°C)</em> into a single
              <em> Ash (combined)</em>. The combined row uses <strong>pooled statistics</strong> —
              weighted mean, pooled SD, combined min/max.
            </p>
            <p className="mt-2">
              Click the <strong>↺</strong> icon next to an aggregated row to restore the original properties.
            </p>
          </Section>

          {/* Outlier exclusion */}
          <Section title="Outlier Exclusion">
            <p>
              In the Raw Observations table, the rightmost <strong>Use</strong> column has a per-row
              checkmark. Click it to mark an observation as an outlier — the row goes red and struck-through,
              and the value is dropped from all statistics, charts, and exports for any substance view
              anywhere in the app.
            </p>
            <p className="mt-2">
              Exclusions are stored per browser and persist across sessions. Click the same button again to
              re-include, or <strong>Restore all excluded</strong> in the table header to undo every
              exclusion in one go.
            </p>
          </Section>

          {/* Multi-substance / compare */}
          <Section title="Multi-Substance &amp; Compare">
            <p>
              With two or more materials in the basket, the <strong>Compare</strong> tab unlocks. It reads
              directly from the basket and shows:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Group editor</strong> — organize basket substances into N groups. Each group&rsquo;s members are pooled before comparison.</li>
              <li><strong>Property filter</strong> — select which property categories (proximate, ultimate, &hellip;) to include.</li>
              <li><strong>Comparison table</strong> — one column per group showing N, mean, SD for every property.</li>
              <li><strong>Range chart</strong> — one colored bar per group per property row.</li>
              <li><strong>Property aggregation</strong> — same mechanism as single-substance mode; works across groups.</li>
            </ul>
            <p className="mt-2">
              The substance detail page also offers a <strong>Merged</strong> vs <strong>Compare</strong>
              toggle when you&rsquo;ve opened more than one substance at once.
            </p>
          </Section>

          {/* Grouping */}
          <Section title="Comparison Groups">
            <p>Default behavior is one group per substance. Quick actions from the group editor:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>One group per substance</strong> — resets to default.</li>
              <li><strong>Merge all into one group</strong> — pool every basket item into a single aggregate.</li>
              <li><strong>First vs. rest</strong> — isolates the first substance and merges the others (handy for comparing one material against an aggregate reference).</li>
              <li><strong>+ New empty group</strong> — opens the rename prompt right away so you can name it.</li>
            </ul>
            <p className="mt-2">
              On each group: click the group name (pencil icon) to rename it. Use the <strong>→</strong> dropdown on each
              substance chip to move it to another group, or the <strong>↗</strong> split-out icon to move it
              to its own fresh group. The per-group <strong>Unmerge</strong> button explodes a multi-substance
              group back into its original members.
            </p>
            <p className="mt-2">
              When a group collapses to a single substance, its name auto-reverts to that substance&rsquo;s
              preferred name — so renaming a merged group and then splitting it doesn&rsquo;t leave orphan labels.
            </p>
          </Section>

          {/* My Data */}
          <Section title="My Data (User Samples)">
            <p>
              Use the <strong>My Data</strong> button in the header to add your own biomass samples. Everything
              stays in your browser&rsquo;s local storage — nothing is sent to any server.
            </p>
            <p className="mt-2">Each user sample can be:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Linked to a canonical substance</strong> — your sample appears tagged as &ldquo;user&rdquo; alongside PHYLIS/CSIRO data.</li>
              <li><strong>User-defined</strong> — for materials with no canonical match, type a custom name; a user-defined substance is created and appears in search with an amber badge.</li>
            </ul>
            <p className="mt-2">
              Properties cover all measurements found in the ingested sources, grouped into five categories:
              Proximate, Ultimate, Heating, Ash Chemistry, and Trace Elements.
            </p>
            <p className="mt-2">
              <strong>Quick contribution</strong>: from any substance detail page, click <strong>+ Add my data</strong>
              to open a pre-filled form linked to that substance.
            </p>
            <p className="mt-2"><strong>Import / Export</strong>:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Export JSON</strong> — roundtrip-safe; preserves all fields and can be re-imported.</li>
              <li><strong>Export CSV</strong> — flat table for spreadsheets.</li>
              <li><strong>Import</strong> — merge a previously-saved JSON file into your current samples.</li>
            </ul>
          </Section>

          {/* Export */}
          <Section title="Exporting Data">
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li><strong>Observation CSV</strong> — raw measurements with full provenance columns and citations. Reflects the current Metric/US selection; label on the button shows which system is baked in.</li>
              <li><strong>Observation JSON</strong> — structured data for programmatic use, always in source (metric) units.</li>
              <li><strong>Summary CSV</strong> — statistics table as displayed (including any aggregations and Metric/US conversion).</li>
              <li><strong>Comparison CSV</strong> — one row per property with per-group columns.</li>
              <li><strong>Chart PNG</strong> — high-resolution chart rendering, reflecting your current display state.</li>
            </ul>
            <p className="mt-2 text-xs text-gray-500 italic">
              All exports include a header comment with the substance name, total observations, active
              filters, unit system, and export timestamp for reproducibility. Citations from every
              contributing source are preserved.
            </p>
          </Section>

          {/* Interpreting data */}
          <Section title="Interpreting Data Responsibly">
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Moisture on dry or dry-ash-free basis is excluded (definitionally zero).</li>
              <li>Derived values (converted or imputed) are flagged. Filter to <em>Observed</em> only if you need direct measurements.</li>
              <li>Summary statistics are computed <strong>per basis</strong>. Never compare an AR mean to a dry mean directly.</li>
              <li>Low sample counts (N&lt;5) should be treated with caution; SD and quartiles may be unreliable.</li>
              <li>Multi-source means are <strong>pooled</strong> via weighted-mean and pooled-variance formulas. Inspect per-source counts in the Observations table if you need to sanity-check outliers between datasets.</li>
              <li>Read the <strong>Terms of Use</strong> (linked at the bottom of the landing page) for the full disclaimer about third-party data and limitation of liability.</li>
            </ul>
          </Section>

          {/* Data sources */}
          <Section title="Data Sources &amp; Drift Detection">
            <p>
              Click the <strong>Databases</strong> button in the header to see every integrated source, with
              live status:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li><strong>Last ingested</strong> — when the source was last pulled into our DB.</li>
              <li><strong>Last checked</strong> — when we last probed upstream for changes.</li>
              <li><strong>Baseline vs upstream</strong> — PHYLIS compares record counts; CSIRO compares DAP version numbers.</li>
              <li><strong>Needs update</strong> — set automatically when upstream has drifted; an amber banner appears and the admin receives an email alert. The flag clears on the next ingest.</li>
            </ul>
            <p className="mt-2">Currently integrated:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-gray-600">
              <li>
                <strong>PHYLIS</strong> (active) — ECN/TNO biomass characterization database (phyllis.nl).
                Primary anchor dataset.
              </li>
              <li>
                <strong>CSIRO</strong> (active) — &ldquo;Database of chemical properties of Australian biomass
                and waste&rdquo; (<a className="underline text-teal-600" href="https://doi.org/10.25919/3yhq-8a44" target="_blank" rel="noopener noreferrer">DOI 10.25919/3yhq-8a44</a>), CC BY 4.0.
              </li>
              <li>
                <strong>INL Bioenergy Feedstock Library</strong> (planned) — access pending.
              </li>
            </ul>
          </Section>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl text-xs text-gray-400">
          BiomassIQ is an evidence-preserving analytical workbench. When in doubt, inspect the raw
          observations and cite the original sources.
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
