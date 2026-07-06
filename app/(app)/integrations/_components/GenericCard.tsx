import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link2, Link2Off } from "lucide-react";
import type { Integration, IntegrationType } from "@/lib/supabase/types";
import type { IntegrationDef } from "./catalogue";
import { statusBadge } from "./StatusBadge";

export function GenericCard({
  def,
  integration,
  onConnect,
  onDisconnect,
  busy,
}: {
  def: IntegrationDef;
  integration: Integration | null;
  onConnect: (type: IntegrationType) => void;
  onDisconnect: (type: IntegrationType) => void;
  busy: boolean;
}) {
  const isConnected = integration?.status === "connected";
  const logoIsEmoji = /\p{Emoji}/u.test(def.logo);

  return (
    <Card
      className={
        isConnected ? "border-[#0a0a0a]" : def.comingSoon ? "opacity-60" : ""
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] flex items-center justify-center overflow-hidden
              ${!def.logoSrc && logoIsEmoji ? "text-xl" : "text-xs font-bold text-[#0a0a0a]"}`}
            >
              {def.logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={def.logoSrc}
                  alt={def.name}
                  className="w-7 h-7 object-contain"
                />
              ) : (
                def.logo
              )}
            </div>
            <div>
              <CardTitle className="text-sm">{def.name}</CardTitle>
              {def.comingSoon ? (
                <Badge className="text-xs border-[#e0e0e0] text-[#6b6b6b] bg-white">
                  Coming Soon
                </Badge>
              ) : (
                statusBadge(integration?.status ?? null)
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="mb-4 text-xs leading-relaxed">
          {def.description}
        </CardDescription>
        {def.comingSoon ? (
          <Button size="sm" className="w-full text-xs" disabled>
            Coming Soon
          </Button>
        ) : isConnected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            disabled={busy}
            onClick={() => onDisconnect(def.type)}
          >
            <Link2Off className="w-3.5 h-3.5 mr-1.5" />
            {busy ? "Disconnecting…" : "Disconnect"}
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full text-xs"
            disabled={busy}
            onClick={() => onConnect(def.type)}
          >
            <Link2 className="w-3.5 h-3.5 mr-1.5" />
            {busy ? "Connecting…" : "Connect"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
