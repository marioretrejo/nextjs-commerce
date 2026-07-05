"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Phone,
  Plug,
  Search,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SipProtocol } from "@/lib/supabase/types";
import {
  type AvailableNumber,
  type DialogMode,
  COUNTRIES,
  COUNTRY_NAMES,
  countryFlag,
  phoneToCountryCode,
} from "./constants";
import { toast } from "sonner";
import { TwilioLogo } from "./TwilioLogo";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode: DialogMode;
  initialTrunk: string | null;
  twilioConnected: boolean;
  twilioAccountSid: string | null;
  activeSipProvider: string | null;
  activeSipTrunkId: string | null;
  onNumbersChanged: () => void;
  onTwilioConnectionChange: (connected: boolean) => void;
  onSipTrunkChange: (name: string | null, id: string | null) => void;
  syncing: boolean;
  onSync: () => void;
}

export function AddNumberDialog({
  open,
  onOpenChange,
  initialMode,
  initialTrunk,
  twilioConnected,
  twilioAccountSid,
  activeSipProvider,
  activeSipTrunkId,
  onNumbersChanged,
  onTwilioConnectionChange,
  onSipTrunkChange,
  syncing,
  onSync,
}: Props) {
  const [mode, setMode] = useState<DialogMode>(initialMode);
  const [sipPhone, setSipPhone] = useState("");
  const [sipUri, setSipUri] = useState("");
  const [sipName, setSipName] = useState("");
  const [sipSaving, setSipSaving] = useState(false);
  const [twilioSid, setTwilioSid] = useState("");
  const [twilioToken, setTwilioToken] = useState("");
  const [twilioConnecting, setTwilioConnecting] = useState(false);
  const [sipTrunkProvider, setSipTrunkProvider] = useState("Squaretalk");
  const [sipTrunkHost, setSipTrunkHost] = useState("");
  const [sipTrunkPort, setSipTrunkPort] = useState("5060");
  const [sipTrunkUser, setSipTrunkUser] = useState("");
  const [sipTrunkPass, setSipTrunkPass] = useState("");
  const [sipTrunkNetmask, setSipTrunkNetmask] = useState("32");
  const [sipTrunkProtocol, setSipTrunkProtocol] = useState<SipProtocol>("UDP");
  const [sipTrunkShowPass, setSipTrunkShowPass] = useState(false);
  const [sipTrunkConnecting, setSipTrunkConnecting] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("US");
  const [numberType, setNumberType] = useState<"local" | "tollfree">("local");
  const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>(
    [],
  );
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [buyingPhone, setBuyingPhone] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setSipPhone("");
    setSipUri(
      initialTrunk && initialTrunk !== "__twilio__" ? initialTrunk : "",
    );
    setSipName("");
    setSelectedCountry("US");
    setAvailableNumbers([]);
    if (initialMode === "connect-sip") {
      setSipTrunkProvider(activeSipProvider ?? "Squaretalk");
      setSipTrunkHost("");
      setSipTrunkPort("5060");
      setSipTrunkUser("");
      setSipTrunkPass("");
      setSipTrunkNetmask("32");
      setSipTrunkProtocol("UDP");
      setSipTrunkShowPass(false);
    }
    if (initialMode === "connect-twilio") {
      setTwilioSid("");
      setTwilioToken("");
    }
  }, [open, initialMode, initialTrunk, activeSipProvider]);

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
      onTwilioConnectionChange(true);
      onOpenChange(false);
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
      onNumbersChanged();
    } else {
      const err = (await res
        .json()
        .catch(() => ({ error: "Unknown error" }))) as { error?: string };
      toast.error(err.error ?? "Failed to connect Twilio.");
    }
  }

  async function disconnectTwilio() {
    const res = await fetch("/api/settings/twilio", { method: "DELETE" });
    if (res.ok) {
      onTwilioConnectionChange(false);
      toast.success("Twilio disconnected.");
      onOpenChange(false);
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
      onOpenChange(false);
      onNumbersChanged();
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
      onSipTrunkChange(name, d.trunk?.id ?? activeSipTrunkId);
      toast.success(
        activeSipTrunkId
          ? `${name} updated.`
          : `${name} connected as SIP trunk.`,
      );
      onOpenChange(false);
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
    onSipTrunkChange(null, null);
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
        onNumbersChanged();
        onOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  {!activeSipTrunkId && <span className="text-red-500">*</span>}
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>
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
                    await onSync();
                    onOpenChange(false);
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>
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
  );
}
