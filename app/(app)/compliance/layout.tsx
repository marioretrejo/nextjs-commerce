// Basic compliance (DNC, calling hours, data & privacy) is available to all plans.
// The QA Rules tab within the page conditionally renders based on has_compliance_qa.
// This layout is a transparent pass-through.
import type { ReactNode } from 'react';

export default function ComplianceLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
