/** CSV export helper for campaign contacts. */

import { toast } from "sonner";
import { type Contact, STATUS_META } from "./types";

export function exportToCsv(contacts: Contact[], campaignName: string) {
  if (!contacts.length) {
    toast.error("No contacts to export");
    return;
  }
  const varKeys = Array.from(
    new Set(
      contacts.flatMap((c) => (c.variables ? Object.keys(c.variables) : [])),
    ),
  );
  const headers = [
    "Name",
    "Phone",
    "Email",
    "Status",
    "Attempts",
    "Last Called",
    ...varKeys,
  ];
  const rows = contacts.map((c) => [
    c.name ?? "",
    c.phone,
    c.email ?? "",
    STATUS_META[c.status]?.label ?? c.status,
    c.attempts,
    c.last_called_at ? new Date(c.last_called_at).toLocaleString() : "",
    ...varKeys.map((k) => String(c.variables?.[k] ?? "")),
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    )
    .join("\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${campaignName}-contacts.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Test Call Modal ────────────────────────────────────────────────────────────
