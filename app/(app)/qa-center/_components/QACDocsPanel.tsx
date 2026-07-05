"use client";

import { DocsSectionsA } from "./docs-sections-a";
import { DocsSectionsB } from "./docs-sections-b";

export function QACDocsPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold text-[#111]">Developer Documentation</h3>
        <p className="text-xs text-[#6b6b6b] mt-0.5">
          Everything you need to integrate any SIP trunk or VoIP platform with
          the QA Center.
        </p>
      </div>

      <DocsSectionsA />
      <DocsSectionsB />
    </div>
  );
}
