"use client";

import type { Dispatch, SetStateAction } from "react";
import { ChevronRight, Phone, Plug, Server } from "lucide-react";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { SipProtocol } from "@/lib/supabase/types";
import { type DialogMode, type AvailableNumber } from "./constants";

interface Props {
  setAvailableNumbers: Dispatch<SetStateAction<AvailableNumber[]>>;
  setMode: Dispatch<SetStateAction<DialogMode>>;
  twilioConnected: boolean;
  setSipTrunkProvider: Dispatch<SetStateAction<string>>;
  setSipTrunkHost: Dispatch<SetStateAction<string>>;
  setSipTrunkPort: Dispatch<SetStateAction<string>>;
  setSipTrunkUser: Dispatch<SetStateAction<string>>;
  setSipTrunkPass: Dispatch<SetStateAction<string>>;
  setSipTrunkNetmask: Dispatch<SetStateAction<string>>;
  setSipTrunkProtocol: Dispatch<SetStateAction<SipProtocol>>;
  setSipTrunkShowPass: Dispatch<SetStateAction<boolean>>;
  activeSipProvider: string | null;
}

export function ChooseMode({
  setAvailableNumbers,
  setMode,
  twilioConnected,
  setSipTrunkProvider,
  setSipTrunkHost,
  setSipTrunkPort,
  setSipTrunkUser,
  setSipTrunkPass,
  setSipTrunkNetmask,
  setSipTrunkProtocol,
  setSipTrunkShowPass,
  activeSipProvider,
}: Props) {
  return (
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
  );
}
