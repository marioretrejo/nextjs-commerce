"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  type AvailableNumber,
  type DialogMode,
  phoneToCountryCode,
  countryFlag,
  COUNTRIES,
} from "./constants";

interface Props {
  setAvailableNumbers: Dispatch<SetStateAction<AvailableNumber[]>>;
  setMode: Dispatch<SetStateAction<DialogMode>>;
  setTwilioSid: Dispatch<SetStateAction<string>>;
  setTwilioToken: Dispatch<SetStateAction<string>>;
  twilioConnected: boolean;
  selectedCountry: string;
  setSelectedCountry: Dispatch<SetStateAction<string>>;
  numberType: "local" | "tollfree";
  setNumberType: Dispatch<SetStateAction<"local" | "tollfree">>;
  availableNumbers: AvailableNumber[];
  searchTwilioNumbers: () => void;
  searchingNumbers: boolean;
  buyTwilioNumber: (num: AvailableNumber) => void;
  buyingPhone: string | null;
}

export function TwilioBuyMode({
  setAvailableNumbers,
  setMode,
  setTwilioSid,
  setTwilioToken,
  twilioConnected,
  selectedCountry,
  setSelectedCountry,
  numberType,
  setNumberType,
  availableNumbers,
  searchTwilioNumbers,
  searchingNumbers,
  buyTwilioNumber,
  buyingPhone,
}: Props) {
  return (
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
  );
}
