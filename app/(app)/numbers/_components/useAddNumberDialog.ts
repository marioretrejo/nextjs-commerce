"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { SipProtocol } from "@/lib/supabase/types";
import {
  type AvailableNumber,
  type DialogMode,
  COUNTRIES,
  COUNTRY_NAMES,
  phoneToCountryCode,
} from "./constants";

interface Params {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode: DialogMode;
  initialTrunk: string | null;
  activeSipProvider: string | null;
  activeSipTrunkId: string | null;
  onNumbersChanged: () => void;
  onTwilioConnectionChange: (connected: boolean) => void;
  onSipTrunkChange: (name: string | null, id: string | null) => void;
}

export function useAddNumberDialog({
  open,
  onOpenChange,
  initialMode,
  initialTrunk,
  activeSipProvider,
  activeSipTrunkId,
  onNumbersChanged,
  onTwilioConnectionChange,
  onSipTrunkChange,
}: Params) {
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

  return {
    mode,
    setMode,
    sipPhone,
    setSipPhone,
    sipUri,
    setSipUri,
    sipName,
    setSipName,
    sipSaving,
    twilioSid,
    setTwilioSid,
    twilioToken,
    setTwilioToken,
    twilioConnecting,
    sipTrunkProvider,
    setSipTrunkProvider,
    sipTrunkHost,
    setSipTrunkHost,
    sipTrunkPort,
    setSipTrunkPort,
    sipTrunkUser,
    setSipTrunkUser,
    sipTrunkPass,
    setSipTrunkPass,
    sipTrunkNetmask,
    setSipTrunkNetmask,
    sipTrunkProtocol,
    setSipTrunkProtocol,
    sipTrunkShowPass,
    setSipTrunkShowPass,
    sipTrunkConnecting,
    selectedCountry,
    setSelectedCountry,
    numberType,
    setNumberType,
    availableNumbers,
    setAvailableNumbers,
    searchingNumbers,
    buyingPhone,
    connectTwilio,
    disconnectTwilio,
    searchTwilioNumbers,
    buyTwilioNumber,
    connectSipTrunk,
    disconnectSipTrunk,
    saveSip,
  };
}
