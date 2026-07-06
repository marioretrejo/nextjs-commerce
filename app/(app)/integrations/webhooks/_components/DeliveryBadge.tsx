import { CheckCircle2, XCircle } from "lucide-react";

export function DeliveryBadge({
  status,
  code,
}: {
  status: string | null;
  code: number | null;
}) {
  if (!status)
    return <span className="text-xs text-[#a0a0a0]">Never delivered</span>;
  if (status === "success") {
    return (
      <span className="flex items-center gap-1 text-xs text-green-700">
        <CheckCircle2 className="h-3.5 w-3.5" /> {code ?? 200}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-red-700">
      <XCircle className="h-3.5 w-3.5" /> {code ? `Error ${code}` : "Failed"}
    </span>
  );
}
