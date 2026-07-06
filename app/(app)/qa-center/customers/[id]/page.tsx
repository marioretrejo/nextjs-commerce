"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CustomerDetail } from "./_components/types";
import { CustomerHeader } from "./_components/CustomerHeader";
import { HealthSection } from "./_components/HealthSection";
import { InsightsSection } from "./_components/InsightsSection";
import { JourneySection } from "./_components/JourneySection";
import { CommitmentsSection } from "./_components/CommitmentsSection";
import { InteractionsSection } from "./_components/InteractionsSection";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/qac/customers/${id}`);
        if (!res.ok) throw new Error("Failed to load customer");
        setCustomer(await res.json());
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load customer",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-3">
        <p className="text-gray-400">Customer not found.</p>
        <Link
          href="/qa-center/customers"
          className="text-indigo-400 text-sm hover:underline"
        >
          Back to Customers
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back */}
        <div className="mb-6">
          <Link
            href="/qa-center/customers"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Customers
          </Link>
        </div>

        <CustomerHeader customer={customer} />

        <HealthSection
          scores={customer.scores}
          totalCalls={customer.total_calls}
        />

        {customer.insights.length > 0 && (
          <InsightsSection insights={customer.insights} />
        )}

        {customer.journey.length > 0 && (
          <JourneySection journey={customer.journey} />
        )}

        {customer.commitments.length > 0 && (
          <CommitmentsSection commitments={customer.commitments} />
        )}

        <InteractionsSection interactions={customer.recent_interactions} />
      </div>
    </div>
  );
}
