"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const MODULE_PATHS: Record<string, string[]> = {
  dashboard: ["/dashboard"],
  agents: ["/agents", "/voice-studio"],
  campaigns: ["/campaigns"],
  calls: ["/calls"],
  analytics: ["/analytics"],
  knowledge: ["/knowledge"],
  quality: ["/quality"],
  numbers: ["/numbers"],
  compliance: ["/compliance", "/qa-center"],
  integrations: ["/integrations"],
  team: ["/team"],
  billing: ["/billing"],
  settings: ["/settings"],
  developers: ["/developers"],
};

export function RouteGuard({ visibleModules }: { visibleModules?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!visibleModules) return; // show all
    for (const [mod, paths] of Object.entries(MODULE_PATHS)) {
      if (paths.some((p) => pathname.startsWith(p))) {
        if (!visibleModules.includes(mod)) {
          router.replace("/dashboard");
          return;
        }
      }
    }
  }, [pathname, visibleModules, router]);

  return null;
}
