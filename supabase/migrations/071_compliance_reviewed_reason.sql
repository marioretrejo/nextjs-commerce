-- Add reviewed_reason to qac_compliance_violations so auditors can trace
-- why a violation was dismissed as a false positive.
ALTER TABLE qac_compliance_violations
  ADD COLUMN IF NOT EXISTS reviewed_reason TEXT;
