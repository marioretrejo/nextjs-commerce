import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { headers } from "next/headers";
import { ReactNode } from "react";
import { Toaster } from "sonner";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WorkspaceBranding } from "@/lib/supabase/types";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VoiceOS — AI Voice Agent Platform",
    template: "%s | VoiceOS",
  },
  description: "The AI Voice Agent Platform That Closes Deals While You Sleep.",
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
  ),
};

async function getWhiteLabelBranding(): Promise<WorkspaceBranding | null> {
  try {
    const hdrs = await headers();
    const host = hdrs.get("host") ?? "";
    const appDomain = new URL(
      process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000",
    ).hostname;
    if (
      !host ||
      host === appDomain ||
      host.includes("localhost") ||
      host.includes("vercel.app")
    )
      return null;

    const admin = createAdminClient();
    const { data } = await admin
      .from("workspaces")
      .select("branding")
      .eq("custom_domain", host)
      .single();
    return (
      (data as { branding: WorkspaceBranding | null } | null)?.branding ?? null
    );
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [locale, messages, branding] = await Promise.all([
    getLocale(),
    getMessages(),
    getWhiteLabelBranding(),
  ]);

  const faviconUrl = branding?.favicon_url ?? null;
  const customCss = branding?.custom_css ?? null;

  return (
    <html lang={locale} className={GeistSans.variable}>
      <head>
        {faviconUrl && <link rel="icon" href={faviconUrl} />}
        {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}
      </head>
      <body className="bg-white text-[#0a0a0a] antialiased">
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#0a0a0a",
              color: "#ffffff",
              border: "1px solid #262626",
            },
          }}
        />
      </body>
    </html>
  );
}
