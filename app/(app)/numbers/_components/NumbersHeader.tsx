"use client";

import { Loader2, Plug, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TwilioLogo } from "./TwilioLogo";

export function NumbersHeader({
  checkingSpam,
  activeSipProvider,
  twilioConnected,
  onCheckSpam,
  onAddSipTrunk,
  onManageTwilio,
}: {
  checkingSpam: boolean;
  activeSipProvider: string | null;
  twilioConnected: boolean;
  onCheckSpam: () => void;
  onAddSipTrunk: () => void;
  onManageTwilio: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Phone Numbers</h1>
        <p className="text-sm text-[#6b6b6b] mt-0.5">
          Manage your phone numbers and SIP trunk connections.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCheckSpam}
          disabled={checkingSpam}
        >
          {checkingSpam ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              Checking…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Check Spam
            </>
          )}
        </Button>

        {activeSipProvider ? (
          <Button
            size="sm"
            variant="outline"
            className="border-green-500 text-green-700 hover:bg-green-50"
            onClick={onAddSipTrunk}
          >
            <Plug className="w-4 h-4 mr-1.5" />
            {activeSipProvider}
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onAddSipTrunk}>
            <Plug className="w-4 h-4 mr-1.5" />
            Add SIP Trunk
          </Button>
        )}

        {twilioConnected ? (
          <Button
            size="sm"
            variant="outline"
            className="border-green-500 text-green-700 hover:bg-green-50"
            onClick={onManageTwilio}
          >
            <TwilioLogo className="w-4 h-4 mr-1.5" />
            Twilio Connected
            <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white"
            onClick={onManageTwilio}
          >
            <TwilioLogo className="w-4 h-4 mr-1.5" />
            Connect Twilio
          </Button>
        )}
      </div>
    </div>
  );
}
