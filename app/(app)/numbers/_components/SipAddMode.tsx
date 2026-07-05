"use client";

import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  type DialogMode,
  phoneToCountryCode,
  COUNTRY_NAMES,
  countryFlag,
} from "./constants";

interface Props {
  setMode: Dispatch<SetStateAction<DialogMode>>;
  sipPhone: string;
  setSipPhone: Dispatch<SetStateAction<string>>;
  sipUri: string;
  setSipUri: Dispatch<SetStateAction<string>>;
  sipName: string;
  setSipName: Dispatch<SetStateAction<string>>;
  sipSaving: boolean;
  saveSip: () => void;
}

export function SipAddMode({
  setMode,
  sipPhone,
  setSipPhone,
  sipUri,
  setSipUri,
  sipName,
  setSipName,
  sipSaving,
  saveSip,
}: Props) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add SIP Number</DialogTitle>
        <DialogDescription>
          Add a number from your VoIP provider (CommPeak, Telnyx, SquareTalk,
          etc.)
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
            Display name <span className="text-[#6b6b6b]">(optional)</span>
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
  );
}
