"use client";

import type { Dispatch, SetStateAction } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { TwilioLogo } from "./TwilioLogo";

interface Props {
  onOpenChange: (open: boolean) => void;
  twilioSid: string;
  setTwilioSid: Dispatch<SetStateAction<string>>;
  twilioToken: string;
  setTwilioToken: Dispatch<SetStateAction<string>>;
  twilioConnecting: boolean;
  connectTwilio: () => void;
  disconnectTwilio: () => void;
  twilioConnected: boolean;
  twilioAccountSid: string | null;
  syncing: boolean;
  onSync: () => void;
}

export function ConnectTwilioMode({
  onOpenChange,
  twilioSid,
  setTwilioSid,
  twilioToken,
  setTwilioToken,
  twilioConnecting,
  connectTwilio,
  disconnectTwilio,
  twilioConnected,
  twilioAccountSid,
  syncing,
  onSync,
}: Props) {
  return (
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
  );
}
