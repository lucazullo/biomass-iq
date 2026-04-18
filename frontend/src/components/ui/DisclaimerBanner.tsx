"use client";

import { useEffect, useState } from "react";
import { TermsModal } from "./TermsModal";

const STORAGE_KEY = "biomassiq.disclaimerDismissed.v1";

export function DisclaimerBanner() {
  const [visible, setVisible] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) {
    return showTerms ? <TermsModal onClose={() => setShowTerms(false)} /> : null;
  }

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50">
        <div className="mx-auto max-w-6xl px-4 py-2 flex items-start gap-3 text-xs text-amber-900">
          <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="flex-1 leading-relaxed">
            <span className="font-semibold">Use at your own risk.</span>{" "}
            This site aggregates technical information from public and third-party sources and
            provides derived analyses for informational purposes only. Content may be
            incomplete, inconsistent, outdated, or incorrect, and is provided without warranty.
            Verify against original sources.{" "}
            <button
              onClick={() => setShowTerms(true)}
              className="underline font-medium hover:text-amber-700"
            >
              Full Terms of Use
            </button>
            .
          </p>
          <button
            onClick={dismiss}
            className="flex-shrink-0 rounded-md border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 transition"
            aria-label="Dismiss disclaimer"
          >
            Got it
          </button>
        </div>
      </div>
      {showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
    </>
  );
}
