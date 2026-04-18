"use client";

interface TermsModalProps {
  onClose: () => void;
}

export function TermsModal({ onClose }: TermsModalProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 px-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Terms of Use</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto text-sm text-gray-700 space-y-4 leading-relaxed">
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">
              No Warranty; Third-Party Data; Use at Your Own Risk
            </h3>
            <p>
              BiomassIQ aggregates, normalizes, and presents technical information sourced from
              public and third-party databases, together with derived analyses such as summary
              statistics, charts, and comparative views. This content is provided for general
              informational purposes only.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Accuracy &amp; Completeness</h3>
            <p>
              Data on this site is compiled from external sources and may be incomplete,
              inconsistent, outdated, or incorrect. Unit and basis conversions (as-received,
              dry, dry ash-free) are derived calculations and may introduce rounding or
              interpretation differences. Summary statistics depend on which samples fall under
              a given canonical material and on filters applied by the user.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">No Warranty</h3>
            <p>
              BiomassIQ is provided <em>“as is”</em> and <em>“as available”</em>, without any
              warranty of any kind, express or implied, including but not limited to warranties
              of merchantability, fitness for a particular purpose, non-infringement, accuracy,
              or availability. No promise is made that the site will be error-free, complete,
              up-to-date, or uninterrupted.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Third-Party Data</h3>
            <p>
              Source databases (e.g. PHYLIS, INL, CSIRO) remain the property of their
              respective owners and are subject to their own terms of use. BiomassIQ preserves
              original citations and provenance where available, but does not endorse, verify,
              or control the underlying data. Where a dataset is not under BiomassIQ’s control,
              any changes, withdrawals, or corrections to the original source may not be
              immediately reflected.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Verify Against Original Sources</h3>
            <p>
              Before relying on any value for engineering design, procurement, regulatory,
              commercial, or safety-critical decisions, users should verify the data against
              the original citation and, where appropriate, against their own measurements or
              qualified expert judgment.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, neither BiomassIQ nor its
              operators or contributors shall be liable for any direct, indirect, incidental,
              consequential, special, exemplary, or punitive damages arising out of or in
              connection with the use of, or inability to use, the site or its content,
              including but not limited to decisions, analyses, or actions based on any value
              or statistic presented here.
            </p>
          </section>
          <section>
            <h3 className="font-semibold text-gray-800 mb-1">Use at Your Own Risk</h3>
            <p>
              By using this site you acknowledge and accept the above, and agree that any
              reliance on the content is solely at your own risk.
            </p>
          </section>
        </div>
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-teal-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
