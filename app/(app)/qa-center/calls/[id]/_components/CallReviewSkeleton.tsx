import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CallReviewSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-7 w-64" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>

      {/* Gauges */}
      <Card>
        <CardContent className="py-6">
          <div className="flex justify-around">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                <Skeleton className="h-[88px] w-[88px] rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two columns */}
      <div className="grid grid-cols-5 gap-5">
        <div className="col-span-3">
          <Skeleton className="h-[480px] rounded-xl" />
        </div>
        <div className="col-span-2 space-y-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// ─── Review Status Panel ──────────────────────────────────────────────────────

const REVIEW_STATUSES = [
  "pending_review",
  "in_review",
  "reviewed",
  "approved",
  "disputed",
] as const;

const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  in_review: "In Review",
  reviewed: "Reviewed",
  approved: "Approved",
  disputed: "Disputed",
};

const REVIEW_STATUS_COLOR: Record<string, string> = {
  pending_review: "text-gray-500 bg-gray-100 border-gray-200",
  in_review: "text-blue-700 bg-blue-50 border-blue-200",
  reviewed: "text-indigo-700 bg-indigo-50 border-indigo-200",
  approved: "text-green-700 bg-green-50 border-green-200",
  disputed: "text-red-700 bg-red-50 border-red-200",
};
