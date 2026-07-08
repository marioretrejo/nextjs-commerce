import { createProviderAction, deleteProviderAction } from "../_actions";
import { QACShell, Panel } from "../_components/QACShell";
import { StatusBadge } from "../_components/StatusBadge";
import { maskSecret } from "../_components/format";
import { requireQacAccess } from "@/lib/qac/access";
import { createAdminClient } from "@/lib/supabase/admin";

interface ProviderRow {
  id: string;
  name: string;
  slug: string;
  type: string;
  webhook_secret: string | null;
  config_json: unknown;
  is_active: boolean;
  created_at: string;
}

function webhookUrl(slug: string): string {
  const base = process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const path = `/api/qa-center/webhooks/${slug}`;
  return base ? `${base}${path}` : path;
}

function firstParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export default async function QACProvidersPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const deleted = firstParam(params, "deleted");
  const access = await requireQacAccess();
  const admin = createAdminClient();

  const { data } = await admin
    .from("qac_voip_providers")
    .select(
      "id, name, slug, type, webhook_secret, config_json, is_active, created_at",
    )
    .eq("workspace_id", access.workspaceId)
    .order("created_at", { ascending: false });

  const providers = (data as ProviderRow[] | null) ?? [];

  return (
    <QACShell
      active="providers"
      title="Providers"
      description="VoIP provider adapters normalize CDR payloads into one QA Center interaction format."
    >
      {deleted && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Provider deleted.
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Panel title={`${providers.length} providers`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-[#77756d]">
                <tr className="border-b border-[#eeeeea]">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 pr-3 font-medium">Webhook</th>
                  <th className="py-2 pr-3 font-medium">Secret</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  {access.isAdmin && (
                    <th className="py-2 pr-3 font-medium">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eeeeea]">
                {providers.map((provider) => (
                  <tr key={provider.id} className="align-top">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-[#181816]">
                        {provider.name}
                      </p>
                      <p className="text-xs text-[#77756d]">{provider.slug}</p>
                    </td>
                    <td className="py-3 pr-3 capitalize">
                      {provider.type.replace(/_/g, " ")}
                    </td>
                    <td className="py-3 pr-3">
                      <code className="break-all rounded bg-[#f7f7f5] px-2 py-1 text-xs">
                        {webhookUrl(provider.slug)}
                      </code>
                    </td>
                    <td className="py-3 pr-3">
                      {maskSecret(provider.webhook_secret)}
                    </td>
                    <td className="py-3 pr-3">
                      <StatusBadge
                        value={provider.is_active ? "active" : "inactive"}
                      />
                    </td>
                    {access.isAdmin && (
                      <td className="py-3 pr-3">
                        <form action={deleteProviderAction}>
                          <input type="hidden" name="id" value={provider.id} />
                          <button className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                            Delete
                          </button>
                        </form>
                      </td>
                    )}
                  </tr>
                ))}
                {providers.length === 0 && (
                  <tr>
                    <td
                      colSpan={access.isAdmin ? 6 : 5}
                      className="py-8 text-center text-[#77756d]"
                    >
                      No providers configured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Create provider">
          <form action={createProviderAction} className="space-y-3">
            <input
              name="name"
              required
              placeholder="Provider name"
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <input
              name="slug"
              placeholder="Webhook slug"
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <select
              name="type"
              defaultValue="squaretalk"
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            >
              <option value="squaretalk">Squaretalk</option>
              <option value="twilio">Twilio</option>
              <option value="aircall">Aircall</option>
              <option value="ringcentral">RingCentral</option>
              <option value="generic">Generic CDR Provider</option>
            </select>
            <input
              name="webhook_secret"
              placeholder="Webhook secret, generated if blank"
              className="w-full rounded-md border border-[#d8d8d2] px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                name="auto_analyze"
                type="checkbox"
                defaultChecked
                className="h-4 w-4"
              />
              Auto analyze when department allows it
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                name="is_active"
                type="checkbox"
                defaultChecked
                className="h-4 w-4"
              />
              Active
            </label>
            <button className="w-full rounded-md bg-[#181816] px-3 py-2 text-sm font-medium text-white">
              Create provider
            </button>
          </form>
        </Panel>
      </div>
    </QACShell>
  );
}
