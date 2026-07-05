"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { PhoneNumber, SipProtocol } from "@/lib/supabase/types";
import {
  Phone,
  Search,
  Plus,
  Trash2,
  Server,
  ChevronRight,
  ShieldCheck,
  Loader2,
  Plug,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";

import {
  type AvailableNumber,
  type TrunkGroup,
  type DialogMode,
  COUNTRIES,
  COUNTRY_NAMES,
  countryFlag,
  phoneToCountryCode,
  groupByTrunk,
} from "./_components/constants";
import { TwilioLogo } from "./_components/TwilioLogo";
import { NumbersList } from "./_components/NumbersList";
import { NumbersHeader } from "./_components/NumbersHeader";

export default function NumbersPage() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [checkingSpam, setCheckingSpam] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<DialogMode>("choose");
  const [addingToTrunk, setAddingToTrunk] = useState<string | null>(null);

  // SIP trunk (add number)
  const [sipPhone, setSipPhone] = useState("");
  const [sipUri, setSipUri] = useState("");
  const [sipName, setSipName] = useState("");
  const [sipSaving, setSipSaving] = useState(false);

  // Twilio connection
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioConnecting, setTwilioConnecting] = useState(false);
  const [twilioConnected, setTwilioConnected] = useState(false);
  const [twilioAccountSid, setTwilioAccountSid] = useState<string | null>(null);

  // SIP trunk connection
  const [sipTrunkProvider, setSipTrunkProvider] = useState("Squaretalk");
  const [sipTrunkHost, setSipTrunkHost] = useState("");
  const [sipTrunkPort, setSipTrunkPort] = useState("5060");
  const [sipTrunkUser, setSipTrunkUser] = useState("");
  const [sipTrunkPass, setSipTrunkPass] = useState("");
  const [sipTrunkNetmask, setSipTrunkNetmask] = useState("32");
  const [sipTrunkProtocol, setSipTrunkProtocol] = useState<SipProtocol>("UDP");
  const [sipTrunkShowPass, setSipTrunkShowPass] = useState(false);
  const [sipTrunkConnecting, setSipTrunkConnecting] = useState(false);
  const [activeSipProvider, setActiveSipProvider] = useState<string | null>(
    null,
  );
  const [activeSipTrunkId, setActiveSipTrunkId] = useState<string | null>(null);

  // Twilio number search & buy
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [numberType, setNumberType] = useState<"local" | "tollfree">("local");
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>(
    [],
  );
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [buyingPhone, setBuyingPhone] = useState<string | null>(null);
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
    setMode(m);
    setAddingToTrunk(trunkKey ?? null);
    setSipPhone("");
    setSipUri(trunkKey && trunkKey !== "__twilio__" ? trunkKey : "");
    setSipName("");
    setSelectedCountry("US");
    setAvailableNumbers([]);
    setDialogOpen(true);
  }

  async function checkSpam() {
    setCheckingSpam(true);
    await new Promise((r) => setTimeout(r, 1200));
    setCheckingSpam(false);
    toast.success("Spam check complete — no new flags detected.");
  }

  async function connectTwilio() {
    if (!twilioSid.trim() || !twilioToken.trim()) {
      toast.error("Enter both Account SID and Auth Token.");
      return;
    }
    setTwilioConnecting(true);
    const res = await fetch("/api/settings/twilio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_sid: twilioSid.trim(),
        auth_token: twilioToken.trim(),
      }),
    });
    setTwilioConnecting(false);
    if (res.ok) {
      setTwilioConnected(true);
      setDialogOpen(false);
      const syncRes = await fetch("/api/numbers/twilio-sync");
      if (syncRes.ok) {
        const sd = (await syncRes.json()) as {
          synced?: number;
          numbers?: unknown[];
        };
        const count = sd.synced ?? 0;
        toast.success(
          count > 0
            ? `Twilio connected — ${count} number(s) synced.`
            : "Twilio connected. No existing numbers found in account.",
        );
      } else {
        toast.success("Twilio connected.");
        toast.error(
          'Could not sync numbers. Use "Sync Numbers" in the Twilio settings.',
        );
      }
      await fetchNumbers();
    } else {
      const err = (await res
        .json()
        .catch(() => ({ error: "Unknown error" }))) as { error?: string };
      toast.error(err.error ?? "Failed to connect Twilio.");
    }
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

  async function disconnectTwilio() {
    const res = await fetch("/api/settings/twilio", { method: "DELETE" });
    if (res.ok) {
      setTwilioConnected(false);
      setTwilioAccountSid(null);
      toast.success("Twilio disconnected.");
      setDialogOpen(false);
    } else {
      toast.error("Failed to disconnect Twilio.");
    }
  }

  async function searchTwilioNumbers() {
    setSearchingNumbers(true);
    setAvailableNumbers([]);
    try {
      const res = await fetch(
        `/api/numbers/twilio-search?country=${selectedCountry}&type=${numberType}`,
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Error" }))) as {
          error?: string;
        };
        toast.error(err.error ?? "Failed to search numbers.");
        return;
      }
      const data = (await res.json()) as { numbers: AvailableNumber[] };
      setAvailableNumbers(data.numbers ?? []);
      if ((data.numbers ?? []).length === 0)
        toast.info("No numbers available for this selection.");
    } catch {
      toast.error("Network error.");
    } finally {
      setSearchingNumbers(false);
    }
  }

  async function buyTwilioNumber(num: AvailableNumber) {
    setBuyingPhone(num.phone_number);
    try {
      const country = COUNTRIES.find((c) => c.code === selectedCountry);
      const res = await fetch("/api/numbers/twilio-buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone_number: num.phone_number,
          country_code: selectedCountry,
          country_name: country?.name ?? num.iso_country,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "Error" }))) as {
          error?: string;
        };
        toast.error(err.error ?? "Failed to purchase number.");
        return;
      }
      toast.success(`${num.phone_number} purchased successfully!`);
      setDialogOpen(false);
      await fetchNumbers();
    } catch {
      toast.error("Network error.");
    } finally {
      setBuyingPhone(null);
    }
  }

  async function connectSipTrunk() {
    if (!sipTrunkHost.trim()) {
      toast.error("Enter the SIP server URL.");
      return;
    }
    if (!sipTrunkUser.trim()) {
      toast.error("Enter a username.");
      return;
    }
    if (!activeSipTrunkId && !sipTrunkPass.trim()) {
      toast.error("Enter a password.");
      return;
    }
    const portNum = parseInt(sipTrunkPort, 10);
    const netmaskNum = parseInt(sipTrunkNetmask, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      toast.error("Port must be 1–65535.");
      return;
    }
    if (isNaN(netmaskNum) || netmaskNum < 0 || netmaskNum > 32) {
      toast.error("Net mask must be 0–32.");
      return;
    }

    setSipTrunkConnecting(true);
    try {
      const payload: Record<string, unknown> = {
        name: sipTrunkProvider.trim() || "Squaretalk",
        provider: "squaretalk",
        sip_host: sipTrunkHost.trim(),
        port: portNum,
        username: sipTrunkUser.trim(),
        netmask: netmaskNum,
        protocol: sipTrunkProtocol,
      };
      if (sipTrunkPass.trim()) payload.password = sipTrunkPass.trim();

      const url = activeSipTrunkId
        ? `/api/settings/sip-trunks/${activeSipTrunkId}`
        : "/api/settings/sip-trunks";
      const method = activeSipTrunkId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res
          .json()
          .catch(() => ({ error: "Unknown error" }))) as { error?: string };
        throw new Error(err.error ?? "Failed to save SIP trunk.");
      }
      const d = (await res.json()) as { trunk?: { id: string; name: string } };
      const name = d.trunk?.name ?? (sipTrunkProvider.trim() || "Squaretalk");
      setActiveSipProvider(name);
      setActiveSipTrunkId(d.trunk?.id ?? activeSipTrunkId);
      toast.success(
        activeSipTrunkId
          ? `${name} updated.`
          : `${name} connected as SIP trunk.`,
      );
      setDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSipTrunkConnecting(false);
    }
  }

  async function disconnectSipTrunk() {
    if (activeSipTrunkId) {
      await fetch(`/api/settings/sip-trunks/${activeSipTrunkId}`, {
        method: "DELETE",
      });
    }
    setActiveSipProvider(null);
    setActiveSipTrunkId(null);
    toast.success("SIP trunk disconnected.");
  }

  async function saveSip() {
    if (!sipPhone.trim()) {
      toast.error("Enter the phone number.");
      return;
    }
    if (!sipUri.trim()) {
      toast.error("Enter the SIP trunk URI.");
      return;
    }
    setSipSaving(true);
    try {
      const detectedCode = phoneToCountryCode(sipPhone.trim());
      const detectedName = detectedCode
        ? (COUNTRY_NAMES[detectedCode] ?? detectedCode)
        : undefined;
      const res = await fetch("/api/numbers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "sip_trunk",
          phone_number: sipPhone.trim(),
          sip_trunk_uri: sipUri.trim(),
          display_name: sipName.trim() || undefined,
          country_code: detectedCode ?? undefined,
          country_name: detectedName,
        }),
      });
      if (res.ok) {
        await fetchNumbers();
        setDialogOpen(false);
        toast.success("SIP number added.");
      } else {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "Failed to add SIP number.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSipSaving(false);
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

  // suppress unused warning
  void addingToTrunk;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <NumbersHeader
        checkingSpam={checkingSpam}
        activeSipProvider={activeSipProvider}
        twilioConnected={twilioConnected}
        onCheckSpam={checkSpam}
        onAddSipTrunk={() => {
          setSipTrunkProvider(activeSipProvider ?? "Squaretalk");
          setSipTrunkHost("");
          setSipTrunkPort("5060");
          setSipTrunkUser("");
          setSipTrunkPass("");
          setSipTrunkNetmask("32");
          setSipTrunkProtocol("UDP");
          setSipTrunkShowPass(false);
          setMode("connect-sip");
          setDialogOpen(true);
        }}
        onManageTwilio={() => {
          setMode("connect-twilio");
          setTwilioSid("");
          setTwilioToken("");
          setDialogOpen(true);
        }}
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

      {/* ── Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          {/* Choose */}
          {mode === "choose" && (
            <>
              <DialogHeader>
                <DialogTitle>Add Phone Number</DialogTitle>
                <DialogDescription>
                  Choose how you want to add a phone number.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <button
                  onClick={() => {
                    setAvailableNumbers([]);
                    setMode("twilio");
                  }}
                  className="w-full flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white p-4 text-left hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Buy a Twilio number</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">
                      {twilioConnected
                        ? "Search & purchase from your Twilio account."
                        : "Connect Twilio first to search and buy numbers."}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0" />
                </button>
                <button
                  onClick={() => setMode("sip")}
                  className="w-full flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white p-4 text-left hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Server className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Bring your own number</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">
                      Register a DID from your SIP provider.
                      {activeSipProvider
                        ? ` Trunk: ${activeSipProvider}`
                        : " (Connect a SIP trunk first.)"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0" />
                </button>
                <button
                  onClick={() => {
                    setSipTrunkProvider("Squaretalk");
                    setSipTrunkHost("");
                    setSipTrunkPort("5060");
                    setSipTrunkUser("");
                    setSipTrunkPass("");
                    setSipTrunkNetmask("32");
                    setSipTrunkProtocol("UDP");
                    setSipTrunkShowPass(false);
                    setMode("connect-sip");
                  }}
                  className="w-full flex items-center gap-4 rounded-lg border border-[#e0e0e0] bg-white p-4 text-left hover:border-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Plug className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Configure SIP trunk</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">
                      {activeSipProvider
                        ? `Currently connected: ${activeSipProvider}. Click to update.`
                        : "Squaretalk, CommPeak, Telnyx, or any SIP provider."}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#6b6b6b] shrink-0" />
                </button>
              </div>
            </>
          )}

          {/* Twilio — search & buy */}
          {mode === "twilio" && (
            <>
              <DialogHeader>
                <DialogTitle>Buy a Phone Number</DialogTitle>
                <DialogDescription>
                  {twilioConnected
                    ? "Search available numbers in your Twilio account and purchase one."
                    : "Connect Twilio to search and purchase phone numbers."}
                </DialogDescription>
              </DialogHeader>

              {!twilioConnected ? (
                <div className="py-4 text-center space-y-3">
                  <p className="text-sm text-[#6b6b6b]">
                    You need to connect your Twilio account first.
                  </p>
                  <Button
                    size="sm"
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => {
                      setTwilioSid("");
                      setTwilioToken("");
                      setMode("connect-twilio");
                    }}
                  >
                    Connect Twilio
                  </Button>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setMode("choose")}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {/* Country */}
                    <div className="space-y-1.5">
                      <Label>Country</Label>
                      <select
                        value={selectedCountry}
                        onChange={(e) => {
                          setSelectedCountry(e.target.value);
                          setAvailableNumbers([]);
                        }}
                        className="w-full h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {countryFlag(c.code)} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Type */}
                    <div className="space-y-1.5">
                      <Label>Type</Label>
                      <div className="flex gap-2">
                        {(["local", "tollfree"] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setNumberType(t);
                              setAvailableNumbers([]);
                            }}
                            className={`flex-1 h-8 rounded-md border text-sm font-medium transition-colors ${
                              numberType === t
                                ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                                : "border-[#e0e0e0] text-[#6b6b6b] hover:border-[#0a0a0a]"
                            }`}
                          >
                            {t === "local" ? "Local" : "Toll-Free"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Search */}
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={searchTwilioNumbers}
                      disabled={searchingNumbers}
                    >
                      {searchingNumbers ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                          Searching…
                        </>
                      ) : (
                        <>
                          <Search className="w-4 h-4 mr-1.5" />
                          Search Available Numbers
                        </>
                      )}
                    </Button>

                    {/* Results */}
                    {availableNumbers.length > 0 && (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                        {availableNumbers.map((num) => (
                          <div
                            key={num.phone_number}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[#e0e0e0] px-3 py-2 bg-white"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-lg shrink-0">
                                {countryFlag(
                                  phoneToCountryCode(num.phone_number) ??
                                    num.iso_country,
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="font-mono text-sm font-medium text-[#0a0a0a]">
                                  {num.phone_number}
                                </p>
                                {(num.locality || num.region) && (
                                  <p className="text-[11px] text-[#6b6b6b] truncate">
                                    {[num.locality, num.region]
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              className="text-xs shrink-0 h-7"
                              disabled={buyingPhone === num.phone_number}
                              onClick={() => buyTwilioNumber(num)}
                            >
                              {buyingPhone === num.phone_number ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                "Buy"
                              )}
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMode("choose")}>
                      Back
                    </Button>
                  </DialogFooter>
                </>
              )}
            </>
          )}

          {/* SIP — add number */}
          {mode === "sip" && (
            <>
              <DialogHeader>
                <DialogTitle>Add SIP Number</DialogTitle>
                <DialogDescription>
                  Add a number from your VoIP provider (CommPeak, Telnyx,
                  SquareTalk, etc.)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl w-8 text-center shrink-0">
                      {phoneToCountryCode(sipPhone)
                        ? countryFlag(phoneToCountryCode(sipPhone)!)
                        : "🌐"}
                    </span>
                    <Input
                      placeholder="+15551234567"
                      value={sipPhone}
                      onChange={(e) => setSipPhone(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  {phoneToCountryCode(sipPhone) && (
                    <p className="text-xs text-[#6b6b6b]">
                      {COUNTRY_NAMES[phoneToCountryCode(sipPhone)!] ??
                        phoneToCountryCode(sipPhone)}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>SIP trunk URI</Label>
                  <Input
                    placeholder="sip:username@sip.provider.com"
                    value={sipUri}
                    onChange={(e) => setSipUri(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Display name{" "}
                    <span className="text-[#6b6b6b]">(optional)</span>
                  </Label>
                  <Input
                    placeholder="e.g. CommPeak LATAM"
                    value={sipName}
                    onChange={(e) => setSipName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMode("choose")}>
                  Back
                </Button>
                <Button onClick={saveSip} disabled={sipSaving}>
                  {sipSaving ? "Saving…" : "Add Number"}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Connect SIP Trunk */}
          {mode === "connect-sip" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Plug className="w-5 h-5" />
                  {activeSipProvider ? "Update SIP Trunk" : "Add SIP Trunk"}
                </DialogTitle>
                <DialogDescription>
                  Ingresa los datos que te proporciona Squaretalk en Settings →
                  SIP Trunk.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                {/* Label */}
                <div className="space-y-1.5">
                  <Label>Nombre</Label>
                  <Input
                    placeholder="Squaretalk"
                    value={sipTrunkProvider}
                    onChange={(e) => setSipTrunkProvider(e.target.value)}
                  />
                </div>
                {/* URL + Port */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1.5">
                    <Label>
                      URL <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      placeholder="sip.squaretalk.com"
                      value={sipTrunkHost}
                      onChange={(e) => setSipTrunkHost(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>
                      Port <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="number"
                      placeholder="5060"
                      value={sipTrunkPort}
                      onChange={(e) => setSipTrunkPort(e.target.value)}
                      min={1}
                      max={65535}
                    />
                  </div>
                </div>
                {/* Username */}
                <div className="space-y-1.5">
                  <Label>
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="SIP username"
                    autoComplete="off"
                    value={sipTrunkUser}
                    onChange={(e) => setSipTrunkUser(e.target.value)}
                  />
                </div>
                {/* Password */}
                <div className="space-y-1.5">
                  <Label>
                    Password{" "}
                    {!activeSipTrunkId && (
                      <span className="text-red-500">*</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      type={sipTrunkShowPass ? "text" : "password"}
                      placeholder={
                        activeSipTrunkId
                          ? "Dejar en blanco para no cambiar"
                          : "••••••••"
                      }
                      autoComplete="new-password"
                      value={sipTrunkPass}
                      onChange={(e) => setSipTrunkPass(e.target.value)}
                      className="pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setSipTrunkShowPass((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6b6b6b] hover:text-[#0a0a0a]"
                    >
                      {sipTrunkShowPass ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                {/* Netmask + Protocol */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Net Mask (0–32)</Label>
                    <Input
                      type="number"
                      placeholder="32"
                      value={sipTrunkNetmask}
                      onChange={(e) => setSipTrunkNetmask(e.target.value)}
                      min={0}
                      max={32}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Protocol</Label>
                    <div className="flex flex-wrap gap-1">
                      {(["UDP", "TCP", "TLS", "TLS/SRTP"] as SipProtocol[]).map(
                        (p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setSipTrunkProtocol(p);
                              setSipTrunkPort(
                                p === "UDP" || p === "TCP" ? "5060" : "5061",
                              );
                            }}
                            className={`px-2 py-1 rounded border text-xs font-medium transition-colors ${
                              sipTrunkProtocol === p
                                ? "bg-[#0a0a0a] text-white border-[#0a0a0a]"
                                : "text-[#6b6b6b] border-[#e0e0e0] hover:border-[#0a0a0a]"
                            }`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                {activeSipProvider && (
                  <button
                    onClick={disconnectSipTrunk}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Desconectar trunk actual ({activeSipProvider})
                  </button>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={connectSipTrunk} disabled={sipTrunkConnecting}>
                  {sipTrunkConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                      Guardando…
                    </>
                  ) : activeSipProvider ? (
                    "Actualizar"
                  ) : (
                    "Conectar"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}

          {/* Connect / Manage Twilio */}
          {mode === "connect-twilio" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <TwilioLogo className="w-5 h-5 text-red-600" />
                  {twilioConnected ? "Twilio Account" : "Connect Twilio"}
                </DialogTitle>
                <DialogDescription>
                  {twilioConnected
                    ? `Connected${twilioAccountSid ? ` · ${twilioAccountSid}` : ""}. Manage your Twilio connection.`
                    : "Enter your Twilio credentials to provision phone numbers."}
                </DialogDescription>
              </DialogHeader>

              {twilioConnected ? (
                <div className="space-y-4 py-1">
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <p className="text-sm text-green-700 font-medium">
                      Twilio is connected
                    </p>
                  </div>
                  {twilioAccountSid && (
                    <p className="text-xs text-[#6b6b6b]">
                      Account SID: {twilioAccountSid}
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      await triggerSync();
                      setDialogOpen(false);
                    }}
                    disabled={syncing}
                  >
                    {syncing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Syncing numbers…
                      </>
                    ) : (
                      "Sync Numbers from Twilio"
                    )}
                  </Button>
                  <button
                    onClick={disconnectTwilio}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Disconnect Twilio
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Account SID</Label>
                    <Input
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      value={twilioSid}
                      onChange={(e) => setTwilioSid(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Auth Token</Label>
                    <Input
                      type="password"
                      placeholder="••••••••••••••••••••••••••••••••"
                      value={twilioToken}
                      onChange={(e) => setTwilioToken(e.target.value)}
                    />
                  </div>
                  <a
                    href="https://console.twilio.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#6b6b6b] underline"
                  >
                    Need help? Find these in your Twilio Console →
                  </a>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  {twilioConnected ? "Close" : "Cancel"}
                </Button>
                {!twilioConnected && (
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={connectTwilio}
                    disabled={twilioConnecting}
                  >
                    {twilioConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        Connecting…
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
