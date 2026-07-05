"use client";

import type { Dispatch, SetStateAction } from "react";
import { Eye, EyeOff, Loader2, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { SipProtocol } from "@/lib/supabase/types";

interface Props {
  onOpenChange: (open: boolean) => void;
  sipTrunkProvider: string;
  setSipTrunkProvider: Dispatch<SetStateAction<string>>;
  sipTrunkHost: string;
  setSipTrunkHost: Dispatch<SetStateAction<string>>;
  sipTrunkPort: string;
  setSipTrunkPort: Dispatch<SetStateAction<string>>;
  sipTrunkUser: string;
  setSipTrunkUser: Dispatch<SetStateAction<string>>;
  sipTrunkPass: string;
  setSipTrunkPass: Dispatch<SetStateAction<string>>;
  sipTrunkNetmask: string;
  setSipTrunkNetmask: Dispatch<SetStateAction<string>>;
  sipTrunkProtocol: SipProtocol;
  setSipTrunkProtocol: Dispatch<SetStateAction<SipProtocol>>;
  sipTrunkShowPass: boolean;
  setSipTrunkShowPass: Dispatch<SetStateAction<boolean>>;
  sipTrunkConnecting: boolean;
  connectSipTrunk: () => void;
  disconnectSipTrunk: () => void;
  activeSipProvider: string | null;
  activeSipTrunkId: string | null;
}

export function ConnectSipMode({
  onOpenChange,
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
  connectSipTrunk,
  disconnectSipTrunk,
  activeSipProvider,
  activeSipTrunkId,
}: Props) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plug className="w-5 h-5" />
          {activeSipProvider ? "Update SIP Trunk" : "Add SIP Trunk"}
        </DialogTitle>
        <DialogDescription>
          Ingresa los datos que te proporciona Squaretalk en Settings → SIP
          Trunk.
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
              {(["UDP", "TCP", "TLS", "TLS/SRTP"] as SipProtocol[]).map((p) => (
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
              ))}
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
  );
}
