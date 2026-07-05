"use client";

import { Phone, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { PhoneNumber } from "@/lib/supabase/types";
import {
  type TrunkGroup,
  type DialogMode,
  COUNTRY_NAMES,
  countryFlag,
  phoneToCountryCode,
} from "./constants";

export function NumbersList({
  loading,
  numbers,
  groups,
  twilioConnected,
  syncing,
  search,
  deletingId,
  onSync,
  onOpenAdd,
  onDeleteGroup,
  onDeleteNumber,
}: {
  loading: boolean;
  numbers: PhoneNumber[];
  groups: TrunkGroup[];
  twilioConnected: boolean;
  syncing: boolean;
  search: string;
  deletingId: string | null;
  onSync: () => void;
  onOpenAdd: (mode?: DialogMode, trunk?: string) => void;
  onDeleteGroup: (group: TrunkGroup) => void;
  onDeleteNumber: (id: string) => void;
}) {
  return (
    <>
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border border-[#e0e0e0] p-5 space-y-3"
            >
              <div className="w-48 h-4 bg-[#f5f5f5] rounded animate-pulse" />
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, j) => (
                  <div
                    key={j}
                    className="h-12 bg-[#f5f5f5] rounded animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : numbers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#e0e0e0] flex flex-col items-center justify-center py-20 text-center">
          <Phone className="w-12 h-12 text-[#e0e0e0] mb-4" />
          <p className="font-semibold text-[#0a0a0a]">No phone numbers yet</p>
          {twilioConnected ? (
            <>
              <p className="text-sm text-[#6b6b6b] mb-4">
                Twilio is connected — sync your existing numbers or buy a new
                one.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Syncing…
                    </>
                  ) : (
                    "Sync from Twilio"
                  )}
                </Button>
                <Button size="sm" onClick={() => onOpenAdd("twilio")}>
                  <Plus className="w-4 h-4 mr-1" />
                  Buy Number
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[#6b6b6b] mb-4">
                Add a number to start making calls.
              </p>
              <Button size="sm" onClick={() => onOpenAdd()}>
                <Plus className="w-4 h-4 mr-1" />
                Add Number
              </Button>
            </>
          )}
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-[#6b6b6b] py-8 text-center">
          No numbers match &ldquo;{search}&rdquo;.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.key} className="rounded-lg border border-[#e0e0e0]">
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#e0e0e0]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6b6b6b] tracking-wider uppercase">
                  <Phone className="w-3.5 h-3.5" />
                  {group.label}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      onOpenAdd(
                        "sip",
                        group.provider === "sip_trunk" ? group.key : undefined,
                      )
                    }
                    className="flex items-center gap-1 text-xs text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add SIP Numbers
                  </button>
                  <button
                    onClick={() => onDeleteGroup(group)}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors ml-3"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete All
                  </button>
                </div>
              </div>

              {group.numbers.length === 0 ? (
                <p className="px-5 py-4 text-sm text-[#6b6b6b]">
                  No phone numbers added
                </p>
              ) : (
                <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {group.numbers.map((num) => {
                    const detectedCode =
                      phoneToCountryCode(num.number) ?? num.country_code;
                    const displayName = detectedCode
                      ? (COUNTRY_NAMES[detectedCode] ?? num.country_name)
                      : num.country_name;
                    return (
                      <div
                        key={num.id}
                        className="group relative flex items-center gap-2.5 rounded-lg border border-[#e0e0e0] bg-white px-3 py-2.5 hover:border-[#0a0a0a] transition-colors"
                      >
                        <span className="text-xl leading-none shrink-0">
                          {countryFlag(detectedCode ?? "")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-sm font-medium text-[#0a0a0a] truncate">
                              {num.number}
                            </span>
                            {num.status === "suspended" && (
                              <Badge className="text-[10px] px-1 py-0 bg-red-100 text-red-700 border-transparent">
                                SPAM
                              </Badge>
                            )}
                          </div>
                          {displayName && (
                            <p className="text-[11px] text-[#6b6b6b] truncate mt-0.5">
                              {displayName}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => onDeleteNumber(num.id)}
                          disabled={deletingId === num.id}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-[#6b6b6b] hover:text-red-600 shrink-0"
                        >
                          {deletingId === num.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {!loading && numbers.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => onOpenAdd()}>
            <Plus className="w-4 h-4 mr-1" />
            Add Number
          </Button>
        </div>
      )}{" "}
    </>
  );
}
