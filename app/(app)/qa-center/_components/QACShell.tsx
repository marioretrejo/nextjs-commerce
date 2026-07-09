import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { qacHref, type QacLang } from "./i18n";
import { QacLanguageToggle } from "./QacLanguageToggle";

const NAV = [
  {
    href: "/qa-center",
    label: "Dashboard",
    labelEs: "Dashboard",
    key: "dashboard",
  },
  {
    href: "/qa-center/interactions",
    label: "Interactions",
    labelEs: "Interacciones",
    key: "interactions",
  },
  {
    href: "/qa-center/agents",
    label: "Agents",
    labelEs: "Agentes",
    key: "agents",
  },
  {
    href: "/qa-center/departments",
    label: "Departments",
    labelEs: "Departamentos",
    key: "departments",
  },
  {
    href: "/qa-center/scorecards",
    label: "Scorecards",
    labelEs: "Scorecards",
    key: "scorecards",
  },
  {
    href: "/qa-center/trackers",
    label: "Trackers",
    labelEs: "Trackers",
    key: "trackers",
  },
  {
    href: "/qa-center/providers",
    label: "Providers",
    labelEs: "Proveedores",
    key: "providers",
    superadminOnly: true,
  },
  {
    href: "/qa-center/settings",
    label: "Settings",
    labelEs: "Configuracion",
    key: "settings",
    superadminOnly: true,
  },
] as const;

export function QACShell({
  active,
  title,
  description,
  children,
  isSuperadmin = false,
  lang = "en",
}: {
  active: (typeof NAV)[number]["key"];
  title: string;
  description?: string;
  children: ReactNode;
  isSuperadmin?: boolean;
  lang?: QacLang;
}) {
  const navItems = NAV.filter(
    (item) =>
      !("superadminOnly" in item) || !item.superadminOnly || isSuperadmin,
  );

  return (
    <div className="min-h-screen bg-[#f6f6f2]">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-black/15 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#77756d]">
                QA Center
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[#181816]">
                {title}
              </h1>
              {description && (
                <p className="mt-1 max-w-3xl text-sm text-[#6f6d66]">
                  {description}
                </p>
              )}
            </div>
            <QacLanguageToggle />
          </div>
          <nav className="flex gap-1 overflow-x-auto border-t border-black/10 pt-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={qacHref(item.href, lang)}
                className={cn(
                  "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active === item.key
                    ? "bg-[#181816] text-white"
                    : "text-[#5f5d56] hover:bg-white hover:text-[#181816]",
                )}
              >
                {lang === "es" ? item.labelEs : item.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </div>
    </div>
  );
}

export function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[#d8d8d2] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[#77756d]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[#181816]">{value}</p>
      {hint && <p className="mt-1 text-xs text-[#77756d]">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#d8d8d2] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#d8d8d2] bg-[#fbfbfa] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#181816]">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
