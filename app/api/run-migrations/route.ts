/**
 * One-time migration runner — deploy to Vercel, call once, then delete.
 * Uses Supabase Supavisor session pooler with JWT auth (supports full DDL).
 * Auth: ?secret=<SUPABASE_SERVICE_ROLE_KEY>
 */
import { NextResponse } from 'next/server';
import { Client } from 'pg';

const MIGRATION_038 = `
-- Migration 038: Compliance QA feature flag + QA tables
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS has_compliance_qa BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS qa_evaluations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_id          UUID REFERENCES calls(id) ON DELETE SET NULL,
  risk_score       NUMERIC(4,1)  NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  analysis         JSONB         NOT NULL DEFAULT '{}',
  evaluated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qa_evaluations_workspace_idx ON qa_evaluations(workspace_id);
CREATE INDEX IF NOT EXISTS qa_evaluations_call_idx      ON qa_evaluations(call_id);
CREATE INDEX IF NOT EXISTS qa_evaluations_risk_idx      ON qa_evaluations(risk_score DESC);

CREATE TABLE IF NOT EXISTS compliance_violations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_evaluation_id    UUID NOT NULL REFERENCES qa_evaluations(id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_name           TEXT NOT NULL,
  severity            TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  transcript_fragment TEXT,
  regulation          TEXT,
  remediation_note    TEXT,
  occurred_at_second  INT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_violations_evaluation_idx  ON compliance_violations(qa_evaluation_id);
CREATE INDEX IF NOT EXISTS compliance_violations_workspace_idx   ON compliance_violations(workspace_id);
CREATE INDEX IF NOT EXISTS compliance_violations_severity_idx    ON compliance_violations(severity);

ALTER TABLE qa_evaluations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_violations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='qa_evaluations' AND policyname='workspace_read_qa_evaluations'
  ) THEN
    CREATE POLICY "workspace_read_qa_evaluations"
      ON qa_evaluations FOR SELECT
      USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='compliance_violations' AND policyname='workspace_read_compliance_violations'
  ) THEN
    CREATE POLICY "workspace_read_compliance_violations"
      ON compliance_violations FOR SELECT
      USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;
`;

const MIGRATION_039 = `
-- Migration 039: Compliance Rules table
CREATE TABLE IF NOT EXISTS compliance_rules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_name     TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'general'
                CHECK (category IN ('disclosure', 'prohibited', 'required', 'quality', 'general')),
  severity      TEXT        NOT NULL DEFAULT 'medium'
                CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_rules_workspace_idx  ON compliance_rules(workspace_id);
CREATE INDEX IF NOT EXISTS compliance_rules_active_idx     ON compliance_rules(workspace_id, is_active);

ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='compliance_rules' AND policyname='workspace_read_compliance_rules'
  ) THEN
    CREATE POLICY "workspace_read_compliance_rules"
      ON compliance_rules FOR SELECT
      USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename='compliance_rules' AND policyname='workspace_write_compliance_rules'
  ) THEN
    CREATE POLICY "workspace_write_compliance_rules"
      ON compliance_rules FOR ALL
      USING (workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      ));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='compliance_rules_updated_at'
  ) THEN
    CREATE TRIGGER compliance_rules_updated_at
      BEFORE UPDATE ON compliance_rules
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
`;

const PROJECT_REF = 'blyzfuwwxwpuihrjdpuh';

interface ConnAttempt { host: string; port: number; user: string }

// All known Supabase pooler endpoints + direct host, both ports
function buildAttempts(): ConnAttempt[] {
  const regions = [
    'aws-0-us-east-1', 'aws-0-us-east-2', 'aws-0-us-west-1', 'aws-0-us-west-2',
    'aws-0-eu-west-1', 'aws-0-eu-west-2', 'aws-0-eu-central-1',
    'aws-0-ap-southeast-1', 'aws-0-ap-northeast-1', 'aws-0-sa-east-1',
  ];
  const attempts: ConnAttempt[] = [];

  // Supabase Supavisor (new) — username format postgres.PROJECT_REF
  for (const r of regions) {
    attempts.push({ host: `${r}.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT_REF}` });
    attempts.push({ host: `${r}.pooler.supabase.com`, port: 6543, user: `postgres.${PROJECT_REF}` });
  }

  // Legacy pgBouncer — project-specific hostname, username = postgres.PROJECT_REF or postgres
  attempts.push({ host: `${PROJECT_REF}.pooler.supabase.com`, port: 6543, user: `postgres.${PROJECT_REF}` });
  attempts.push({ host: `${PROJECT_REF}.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT_REF}` });
  attempts.push({ host: `${PROJECT_REF}.pooler.supabase.com`, port: 6543, user: 'postgres' });

  // Direct connection — old Supabase infrastructure (some projects still have this)
  attempts.push({ host: `db.${PROJECT_REF}.supabase.co`, port: 5432, user: 'postgres' });
  attempts.push({ host: `db.${PROJECT_REF}.supabase.co`, port: 6543, user: 'postgres' });

  return attempts;
}

async function tryConnect(attempt: ConnAttempt, password: string): Promise<Client> {
  const client = new Client({
    host: attempt.host,
    port: attempt.port,
    database: 'postgres',
    user: attempt.user,
    password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
}

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret');
  if (!secret || secret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const password = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  let client: Client | null = null;
  let connectedAt = '';
  const errors: string[] = [];

  for (const attempt of buildAttempts()) {
    try {
      client = await tryConnect(attempt, password);
      connectedAt = `${attempt.user}@${attempt.host}:${attempt.port}`;
      break;
    } catch (err) {
      errors.push(`${attempt.host}:${attempt.port} — ${(err as Error).message.slice(0, 80)}`);
    }
  }

  if (!client) {
    return NextResponse.json({
      error: 'Could not connect to any Supabase endpoint',
      attempts: errors,
    }, { status: 503 });
  }

  const results: Record<string, string> = {};

  // Each migration runs in its own transaction so one failure doesn't block the other
  for (const [name, sql] of [['038', MIGRATION_038], ['039', MIGRATION_039]] as const) {
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      results[name] = 'ok';
    } catch (err) {
      await client.query('ROLLBACK').catch(() => null);
      results[name] = `error: ${(err as Error).message}`;
    }
  }

  await client.end().catch(() => null);

  return NextResponse.json({ ok: true, connectedAt, migrations: results });
}
