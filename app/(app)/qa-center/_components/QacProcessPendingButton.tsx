"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { qacT, type QacLang } from "./i18n";

type ProcessResponse = {
  ok?: boolean;
  processed?: number;
  succeeded?: number;
  failed?: number;
  queued?: number;
  error?: string;
};

export function QacProcessPendingButton({
  lang,
  compact = false,
}: {
  lang: QacLang;
  compact?: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function processPending() {
    setIsPending(true);
    const toastId = toast.loading(qacT(lang, "Processing...", "Procesando..."));
    try {
      const response = await fetch("/api/qa-center/process-pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: compact ? 3 : 5 }),
      });
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? ((await response.json()) as ProcessResponse)
        : null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ??
            qacT(
              lang,
              "The processing request failed.",
              "La solicitud de procesamiento fallo.",
            ),
        );
      }

      const processed = payload.processed ?? 0;
      const succeeded = payload.succeeded ?? 0;
      const failed = payload.failed ?? 0;
      const queued = payload.queued ?? 0;
      if (processed === 0 && queued === 0) {
        toast.info(
          qacT(
            lang,
            "No processable pending calls were found.",
            "No encontre llamadas pendientes procesables.",
          ),
          { id: toastId },
        );
        router.refresh();
        return;
      }

      toast.success(
        qacT(
          lang,
          `Processed ${processed}. ${succeeded} succeeded, ${failed} failed. ${queued} queued in background.`,
          `Procesadas ${processed}. ${succeeded} correctas, ${failed} fallidas. ${queued} en cola en segundo plano.`,
        ),
        { id: toastId },
      );
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : qacT(
              lang,
              "Unexpected processing error.",
              "Error inesperado procesando llamadas.",
            ),
        { id: toastId },
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div
      className={
        compact
          ? "flex flex-col items-end gap-1"
          : "flex flex-col gap-2 sm:items-end"
      }
    >
      <button
        type="button"
        onClick={() => {
          void processPending();
        }}
        disabled={isPending}
        className={
          compact
            ? "rounded-md border border-[#181816] bg-white px-3 py-1.5 text-xs font-semibold text-[#181816] hover:bg-[#f7f7f5] disabled:cursor-wait disabled:opacity-60"
            : "w-full rounded-md bg-[#181816] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        }
      >
        {isPending
          ? qacT(lang, "Processing...", "Procesando...")
          : qacT(
              lang,
              compact ? "Process pending" : "Process pending calls",
              compact ? "Procesar pendientes" : "Procesar llamadas pendientes",
            )}
      </button>
    </div>
  );
}

export function QacProcessResultToast({
  lang,
  processed,
  succeeded,
  failed,
  cleanHref,
}: {
  lang: QacLang;
  processed: string;
  succeeded: string;
  failed: string;
  cleanHref: string;
}) {
  const router = useRouter();
  const shown = useRef(false);
  const processedCount = Number(processed || 0);

  useEffect(() => {
    if (!processedCount || shown.current) return;
    shown.current = true;
    toast.success(
      qacT(
        lang,
        `Processed ${processed} pending calls. ${succeeded || "0"} succeeded, ${failed || "0"} failed.`,
        `Se procesaron ${processed} llamadas pendientes. ${succeeded || "0"} correctas, ${failed || "0"} fallidas.`,
      ),
    );

    router.replace(cleanHref, { scroll: false });
  }, [cleanHref, failed, lang, processed, processedCount, router, succeeded]);

  return null;
}
