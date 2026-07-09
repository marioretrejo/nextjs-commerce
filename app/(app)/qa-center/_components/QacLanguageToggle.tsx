"use client";

import { usePathname, useSearchParams } from "next/navigation";

function hrefFor(pathname: string, paramsText: string, lang: "en" | "es") {
  const next = new URLSearchParams(paramsText);
  next.set("lang", lang);
  return `${pathname}?${next.toString()}`;
}

export function QacLanguageToggle() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramsText = searchParams.toString();
  const current = searchParams.get("lang") === "es" ? "es" : "en";

  return (
    <div className="flex shrink-0 rounded-md border border-black/20 bg-white p-1 text-sm">
      <a
        href={hrefFor(pathname, paramsText, "en")}
        className={`rounded px-3 py-1.5 ${
          current === "en" ? "bg-[#181816] text-white" : "text-[#5f5d56]"
        }`}
      >
        English
      </a>
      <a
        href={hrefFor(pathname, paramsText, "es")}
        className={`rounded px-3 py-1.5 ${
          current === "es" ? "bg-[#181816] text-white" : "text-[#5f5d56]"
        }`}
      >
        Español
      </a>
    </div>
  );
}
