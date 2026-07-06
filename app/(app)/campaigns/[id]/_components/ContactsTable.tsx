"use client";

import { Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "./export-csv";
import { STATUS_META, type Campaign, type Contact } from "./types";

export function ContactsTable({
  contacts,
  filteredContacts,
  search,
  setSearch,
  campaign,
}: {
  contacts: Contact[];
  filteredContacts: Contact[];
  search: string;
  setSearch: (v: string) => void;
  campaign: Campaign;
}) {
  return (
    <div className="border border-[#e0e0e0] rounded-xl overflow-hidden">
      {/* Table header with search + export */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e0e0e0] bg-white">
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6b6b6b]" />
          <input
            placeholder="Search Contacts"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 h-8 text-xs border border-[#e0e0e0] rounded-lg bg-[#fafafa] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="text-xs shrink-0"
          onClick={() => exportToCsv(contacts, campaign.name)}
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export contacts
        </Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e0e0e0] bg-[#fafafa]">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                Name and Phone Number
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                Attempts
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                Last Attempt
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                Status
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-[#6b6b6b]">
                Variables
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.slice(0, 200).map((c) => {
              const meta = STATUS_META[c.status];
              const varEntries = c.variables
                ? Object.entries(c.variables).slice(0, 3)
                : [];
              return (
                <tr
                  key={c.id}
                  className="border-b border-[#e0e0e0] hover:bg-[#fafafa]"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#0a0a0a] text-xs">
                      {c.name ?? "—"}
                    </p>
                    <p className="text-xs text-[#6b6b6b] font-mono">
                      {c.phone}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#0a0a0a]">
                    {c.attempts}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b]">
                    {c.last_called_at
                      ? new Date(c.last_called_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${meta?.color ?? "bg-[#f5f5f5] text-[#6b6b6b]"}`}
                    >
                      {meta?.label ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#6b6b6b] max-w-xs">
                    {varEntries.length > 0
                      ? varEntries.map(([k, v]) => (
                          <span key={k} className="mr-2">
                            <span className="text-[#0a0a0a] font-medium">
                              {k}:
                            </span>{" "}
                            {String(v)}
                          </span>
                        ))
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {filteredContacts.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-xs text-[#6b6b6b]"
                >
                  {search ? `No contacts match "${search}"` : "No contacts yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredContacts.length > 200 && (
        <div className="px-4 py-2.5 border-t border-[#e0e0e0] bg-[#fafafa] text-xs text-[#6b6b6b]">
          Showing 200 of {filteredContacts.length} contacts
        </div>
      )}
    </div>
  );
}
