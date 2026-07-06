import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobsHealth, WebhookHealth } from "./types";

export function JobsWebhooks({
  jobs,
  webhooks,
}: {
  jobs: JobsHealth;
  webhooks: WebhookHealth;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Jobs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Post-Call Jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded bg-muted px-2 py-1.5">
              <div className="text-lg font-bold text-foreground">
                {jobs.pending}
              </div>
              <div className="text-muted-foreground">Pending</div>
            </div>
            <div className="rounded bg-muted px-2 py-1.5">
              <div className="text-lg font-bold text-foreground">
                {jobs.running}
              </div>
              <div className="text-muted-foreground">Running</div>
            </div>
            <div className="rounded bg-muted px-2 py-1.5">
              <div className="text-lg font-bold text-foreground">
                {jobs.retrying}
              </div>
              <div className="text-muted-foreground">Retrying</div>
            </div>
            <div
              className={`rounded px-2 py-1.5 ${jobs.dead_letter > 0 ? "bg-red-50 border border-red-100" : "bg-muted"}`}
            >
              <div
                className={`text-lg font-bold ${jobs.dead_letter > 0 ? "text-red-700" : "text-foreground"}`}
              >
                {jobs.dead_letter}
              </div>
              <div className="text-muted-foreground">Dead Letter</div>
            </div>
            <div className="rounded bg-muted px-2 py-1.5">
              <div className="text-lg font-bold text-foreground">
                {jobs.failed}
              </div>
              <div className="text-muted-foreground">Failed</div>
            </div>
            <div
              className={`rounded px-2 py-1.5 ${jobs.stale_running > 0 ? "bg-yellow-50 border border-yellow-100" : "bg-muted"}`}
            >
              <div
                className={`text-lg font-bold ${jobs.stale_running > 0 ? "text-yellow-700" : "text-foreground"}`}
              >
                {jobs.stale_running}
              </div>
              <div className="text-muted-foreground">Stale</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Webhooks</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded bg-green-50 px-2 py-1.5">
              <div className="text-lg font-bold text-green-700">
                {webhooks.sent}
              </div>
              <div className="text-muted-foreground">Sent</div>
            </div>
            <div
              className={`rounded px-2 py-1.5 ${webhooks.failed > 0 ? "bg-red-50 border border-red-100" : "bg-muted"}`}
            >
              <div
                className={`text-lg font-bold ${webhooks.failed > 0 ? "text-red-700" : "text-foreground"}`}
              >
                {webhooks.failed}
              </div>
              <div className="text-muted-foreground">Failed</div>
            </div>
            <div className="rounded bg-muted px-2 py-1.5">
              <div className="text-lg font-bold text-foreground">
                {webhooks.retrying}
              </div>
              <div className="text-muted-foreground">Retrying</div>
            </div>
            <div className="rounded bg-muted px-2 py-1.5">
              <div className="text-lg font-bold text-foreground">
                {webhooks.pending}
              </div>
              <div className="text-muted-foreground">Pending</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
