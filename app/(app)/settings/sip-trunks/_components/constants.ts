import type { SipProtocol } from "@/lib/supabase/types";

export const PROTOCOLS: SipProtocol[] = ["UDP", "TCP", "TLS", "TLS/SRTP"];

export const DEFAULT_PORT: Record<SipProtocol, number> = {
  UDP: 5060,
  TCP: 5060,
  TLS: 5061,
  "TLS/SRTP": 5061,
};

export interface TrunkForm {
  name: string;
  sip_host: string;
  port: string;
  username: string;
  password: string;
  netmask: string;
  protocol: SipProtocol;
}

export const EMPTY_FORM: TrunkForm = {
  name: "Squaretalk",
  sip_host: "",
  port: "5060",
  username: "",
  password: "",
  netmask: "32",
  protocol: "UDP",
};
