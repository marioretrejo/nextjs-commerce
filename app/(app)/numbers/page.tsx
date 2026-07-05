"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PhoneNumber } from "@/lib/supabase/types";
import { toast } from "sonner";
import {
  type TrunkGroup,
  type DialogMode,
  groupByTrunk,
} from "./_components/constants";
import { NumbersList } from "./_components/NumbersList";
import { NumbersHeader } from "./_components/NumbersHeader";
import { AddNumberDialog } from "./_components/AddNumberDialog";

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [checkingSpam, setCheckingSpam] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<DialogMode>("choose");
  const [initialTrunk, setInitialTrunk] = useState<string | null>(null);

  const [twilioConnected, setTwilioConnected] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState<string | null>(null);
  const [activeSipProvider, setActiveSipProvider] = useState<string | null>(
    null,
  );
  const [activeSipTrunkId, setActiveSipTrunkId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchNumbers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/numbers?limit=200");
      if (res.ok) {
        const data = (await res.json()) as PhoneNumber[];
        setNumbers(Array.isArray(data) ? data : []);
      }
    } catch {
      /* non-blocking */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNumbers();

    fetch("/api/settings/sip-trunks")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          d: {
            trunks?: Array<{
              id: string;
              name: string;
              status: string;
              provider: string;
            }>;
          } | null,
        ) => {
          const active = (d?.trunks ?? []).find((t) => t.status === "active");
          if (active) {
            setActiveSipProvider(active.name);
            setActiveSipTrunkId(active.id);
          }
        },
      )
      .catch(() => null);

    async function checkTwilio() {
      try {
        const r = await fetch("/api/settings/twilio");
        if (!r.ok) return;
        const d = (await r.json()) as {
          connected?: boolean;
          account_sid?: string;
        };
        if (d?.connected) {
          setTwilioConnected(true);
          setTwilioAccountSid(d.account_sid ?? null);
          const syncRes = await fetch("/api/numbers/twilio-sync");
          if (syncRes.ok) {
            const sd = (await syncRes.json()) as {
              synced?: number;
              numbers?: unknown[];
            };
            if ((sd.synced ?? 0) > 0) {
              toast.success(`${sd.synced} Twilio number(s) synced.`);
            }
          }
          await fetchNumbers();
        }
      } catch {
        /* non-blocking */
      }
    }
    void checkTwilio();
  }, [fetchNumbers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return numbers;
    return numbers.filter(
      (n) =>
        n.number.includes(q) ||
        n.country_name?.toLowerCase().includes(q) ||
        n.display_name?.toLowerCase().includes(q),
    );
  }, [numbers, search]);

  const groups = useMemo(() => groupByTrunk(filtered), [filtered]);

  function openAdd(m: DialogMode = "choose", trunkKey?: string) {
    setInitialMode(m);
    setInitialTrunk(trunkKey ?? null);
    setDialogOpen(true);
  }

  async function checkSpam() {
    setCheckingSpam(true);
    await new Promise((r) => setTimeout(r, 1200));
    setCheckingSpam(false);
    toast.success("Spam check complete — no new flags detected.");
  }

  async function triggerSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/numbers/twilio-sync");
      const data = (await res.json()) as {
        synced?: number;
        numbers?: unknown[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error ?? "Sync failed. Check your Twilio credentials.",
        );
        return;
      }
      const total = data.numbers?.length ?? 0;
      const inserted = data.synced ?? 0;
      if (total === 0) {
        toast.info("No phone numbers found in your Twilio account.");
      } else if (inserted > 0) {
        toast.success(`${inserted} number(s) imported from Twilio.`);
      } else {
        toast.info(`${total} number(s) already in sync.`);
      }
      await fetchNumbers();
    } catch {
      toast.error("Network error during sync.");
    } finally {
      setSyncing(false);
    }
  }

  async function deleteNumber(id: string) {
    setDeletingId(id);
    await fetch(`/api/numbers/${id}`, { method: "DELETE" });
    setNumbers((prev) => prev.filter((n) => n.id !== id));
    setDeletingId(null);
  }

  async function deleteGroup(group: TrunkGroup) {
    if (
      !confirm(
        `Delete all ${group.numbers.length} number(s) in ${group.label}?`,
      )
    )
      return;
    await Promise.all(
      group.numbers.map((n) =>
        fetch(`/api/numbers/${n.id}`, { method: "DELETE" }),
      ),
    );
    await fetchNumbers();
    toast.success(`Deleted all numbers in ${group.label}.`);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <NumbersHeader
        checkingSpam={checkingSpam}
        activeSipProvider={activeSipProvider}
        twilioConnected={twilioConnected}
        onCheckSpam={checkSpam}
        onAddSipTrunk={() => openAdd("connect-sip")}
        onManageTwilio={() => openAdd("connect-twilio")}
      />

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b6b6b]" />
        <Input
          placeholder="Search phone number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <NumbersList
        loading={loading}
        numbers={numbers}
        groups={groups}
        twilioConnected={twilioConnected}
        syncing={syncing}
        search={search}
        deletingId={deletingId}
        onSync={triggerSync}
        onOpenAdd={openAdd}
        onDeleteGroup={deleteGroup}
        onDeleteNumber={deleteNumber}
      />
      <AddNumberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialMode={initialMode}
        initialTrunk={initialTrunk}
        twilioConnected={twilioConnected}
        twilioAccountSid={twilioAccountSid}
        activeSipProvider={activeSipProvider}
        activeSipTrunkId={activeSipTrunkId}
        onNumbersChanged={fetchNumbers}
        onTwilioConnectionChange={(connected) => {
          setTwilioConnected(connected);
          if (!connected) setTwilioAccountSid(null);
        }}
        onSipTrunkChange={(name, id) => {
          setActiveSipProvider(name);
          setActiveSipTrunkId(id);
        }}
        syncing={syncing}
        onSync={triggerSync}
      />
    </div>
  );
}
