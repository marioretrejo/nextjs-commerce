"use client";

import { cn } from "@/lib/utils";
import {
  BarChart2,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Code2,
  Cpu,
  FlaskConical,
  Headphones,
  Mic,
  CreditCard,
  DollarSign,
  Globe,
  LayoutDashboard,
  Megaphone,
  Palette,
  Phone,
  PhoneCall,
  Radio,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trophy,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import { LanguageSwitcher } from "./language-switcher";

interface NavItem {
  href: string;
  labelKey: keyof ReturnType<
    ReturnType<typeof useTranslations<"nav">>["raw"]
  > extends never
    ? string
    : string;
  icon: LucideIcon;
  pulse?: boolean;
  module?: string;
  sub?: boolean; // indented sub-item
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const adminItems = [
  { href: "/admin", labelKey: "Superadmin", icon: Shield },
  { href: "/admin/workspaces", labelKey: "Workspaces", icon: Cpu },
  { href: "/admin/infrastructure", labelKey: "Infrastructure", icon: Cpu },
  { href: "/settings/workspace", labelKey: "Design", icon: Palette },
  {
    href: "/admin/marketing-finance",
    labelKey: "Marketing Finance",
    icon: TrendingUp,
  },
];

interface SidebarProps {
  isSuperadmin?: boolean;
  appName?: string;
  visibleModules?: string[];
  hasComplianceQa?: boolean;
  hasDesignAccess?: boolean;
  isQaAdmin?: boolean;
}

export function Sidebar({
  isSuperadmin = false,
  appName = "VoiceOS",
  visibleModules,
  hasComplianceQa = false,
  hasDesignAccess = false,
  isQaAdmin = false,
}: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  const navGroups: NavGroup[] = [
    {
      items: [
        {
          href: "/dashboard",
          labelKey: "dashboard",
          icon: LayoutDashboard,
          module: "dashboard",
        },
        { href: "/agents", labelKey: "agents", icon: Bot, module: "agents" },
        {
          href: "/campaigns",
          labelKey: "campaigns",
          icon: Megaphone,
          module: "campaigns",
        },
      ],
    },
    {
      label: "CALLS",
      items: [
        {
          href: "/calls",
          labelKey: "callHistory",
          icon: PhoneCall,
          module: "calls",
        },
        {
          href: "/calls/live",
          labelKey: "liveMonitor",
          icon: Radio,
          pulse: true,
          module: "calls",
        },
      ],
    },
    {
      label: "INTELLIGENCE",
      items: [
        {
          href: "/analytics",
          labelKey: "analytics",
          icon: BarChart2,
          module: "analytics",
        },
        {
          href: "/analytics/costs",
          labelKey: "usage",
          icon: DollarSign,
          module: "analytics",
        },
        {
          href: "/knowledge",
          labelKey: "knowledge",
          icon: BookOpen,
          module: "knowledge",
        },
        {
          href: "/voice-studio",
          labelKey: "voiceStudio",
          icon: Mic,
          module: "agents",
        },
        {
          href: "/voice-lab",
          labelKey: "voiceLab",
          icon: FlaskConical,
          module: "agents",
        },
        {
          href: "/quality",
          labelKey: "quality",
          icon: Star,
          module: "quality",
        },
      ],
    },
    {
      label: "WORKSPACE",
      items: [
        {
          href: "/numbers",
          labelKey: "numbers",
          icon: Phone,
          module: "numbers",
        },
        ...(isSuperadmin || hasComplianceQa
          ? [
              {
                href: "/qa-center",
                labelKey: "qaCenter",
                icon: ShieldAlert,
                module: "compliance",
              },
              {
                href: "/qa-center/leaderboard",
                labelKey: "leaderboard",
                icon: Trophy,
                module: "compliance",
                sub: true,
              },
              {
                href: "/qa-center/assist",
                labelKey: "agentAssist",
                icon: Headphones,
                module: "compliance",
                sub: true,
              },
              {
                href: "/qa-center/agents",
                labelKey: "agentProfiles",
                icon: Users,
                module: "compliance",
                sub: true,
              },
              {
                href: "/qa-center/coaching",
                labelKey: "coaching",
                icon: BookOpen,
                module: "compliance",
                sub: true,
              },
              {
                href: "/qa-center/audit",
                labelKey: "auditLog",
                icon: ShieldCheck,
                module: "compliance",
                sub: true,
              },
              ...(isQaAdmin
                ? [
                    {
                      href: "/qa-center/settings/departments",
                      labelKey: "Departamentos QA",
                      icon: Building2,
                      module: "compliance",
                      sub: true,
                    },
                  ]
                : []),
            ]
          : []),
        {
          href: "/integrations",
          labelKey: "integrations",
          icon: Globe,
          module: "integrations",
        },
        {
          href: "/integrations/webhooks",
          labelKey: "webhooks",
          icon: Bell,
          module: "integrations",
        },
        { href: "/team", labelKey: "team", icon: Users, module: "team" },
        {
          href: "/billing",
          labelKey: "billing",
          icon: CreditCard,
          module: "billing",
        },
        {
          href: "/settings",
          labelKey: "settings",
          icon: Settings,
          module: "settings",
        },
        {
          href: "/developers",
          labelKey: "developers",
          icon: Code2,
          module: "developers",
        },
      ],
    },
  ];

  function isActive(href: string) {
    if (href === "/calls") return pathname === "/calls";
    if (href === "/analytics") return pathname === "/analytics";
    if (href === "/qa-center") return pathname === "/qa-center";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-56">
      <div className="m-3 flex h-[calc(100vh-24px)] flex-col rounded-2xl bg-white sidebar-panel overflow-hidden">
        {/* Logo */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-1.5 mb-4">
            <span className="h-4 w-1 rounded-full bg-[#0a0a0a]" />
            <span className="h-3 w-1 rounded-full bg-[#d4d4d4]" />
            <span className="h-2 w-1 rounded-full bg-[#e8e8e8]" />
          </div>
          <span className="text-[13px] font-bold tracking-tight text-[#0a0a0a] leading-none">
            {appName}
          </span>
          <p className="text-[10px] text-[#9b9b9b] mt-0.5 font-medium tracking-wider uppercase">
            Voice Platform
          </p>
        </div>

        <div className="mx-4 mb-2 h-px bg-[#f0f0f0]" />

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-1 pb-4">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="px-2 mb-1 text-[9px] font-semibold tracking-widest text-[#c0c0c0] uppercase">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items
                  .filter(({ module }) => {
                    if (!module || !visibleModules) return true;
                    return visibleModules.includes(module);
                  })
                  .map(({ href, labelKey, icon: Icon, pulse, sub }) => {
                    const active = isActive(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "group relative flex items-center gap-2.5 rounded-xl py-1.5 font-medium transition-all duration-150",
                          sub
                            ? "px-2.5 ml-3 text-[11.5px]"
                            : "px-3 text-[12.5px]",
                          active
                            ? "bg-[#0a0a0a] text-white nav-active"
                            : "text-[#7a7a7a] hover:bg-[#f5f5f5] hover:text-[#0a0a0a] hover:translate-x-0.5",
                        )}
                      >
                        {sub && !active && (
                          <span className="mr-0.5 text-[#ddd]">╴</span>
                        )}
                        <Icon
                          className={cn(
                            "shrink-0 transition-transform duration-150",
                            sub ? "h-3 w-3" : "h-3.5 w-3.5",
                            active
                              ? "text-white"
                              : "text-[#b0b0b0] group-hover:text-[#0a0a0a] group-hover:scale-110",
                          )}
                        />
                        <span className="truncate">
                          {t(labelKey as Parameters<typeof t>[0])}
                        </span>
                        {pulse && !active && (
                          <span className="ml-auto flex h-1.5 w-1.5 shrink-0">
                            <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-green-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                          </span>
                        )}
                      </Link>
                    );
                  })}
              </div>
            </div>
          ))}

          {isSuperadmin && (
            <div>
              <div className="mx-0 mb-1 h-px bg-[#f0f0f0]" />
              <p className="px-2 mb-1 text-[9px] font-semibold tracking-widest text-[#c0c0c0] uppercase">
                Admin
              </p>
              <div className="space-y-0.5">
                {adminItems.map(({ href, labelKey, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[12.5px] font-medium transition-all duration-150",
                        active
                          ? "bg-[#0a0a0a] text-white nav-active"
                          : "text-[#7a7a7a] hover:bg-[#f5f5f5] hover:text-[#0a0a0a] hover:translate-x-0.5",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          active
                            ? "text-white"
                            : "text-[#b0b0b0] group-hover:text-[#0a0a0a]",
                        )}
                      />
                      {labelKey}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Bottom: language switcher + status strip */}
        <div className="px-3 pb-3 space-y-2">
          <LanguageSwitcher />
          <div className="rounded-xl bg-[#f8f8f8] px-3 py-2.5 border border-[#efefef]">
            <div className="flex items-center gap-2">
              <span className="flex h-1.5 w-1.5 rounded-full bg-green-500">
                <span className="animate-ping absolute inline-flex h-1.5 w-1.5 rounded-full bg-green-400 opacity-75" />
              </span>
              <span className="text-[10px] font-medium text-[#9b9b9b]">
                All systems operational
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
