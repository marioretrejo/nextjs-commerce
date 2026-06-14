"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Phone,
  Mail,
  Search,
  Users,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Customer {
  id: string;
  display_name: string;
  canonical_phone: string | null;
  canonical_email: string | null;
  total_calls: number;
  lifetime_sentiment: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

interface ListResponse {
  data: Customer[];
  total: number;
  page: number;
  pages: number;
  limit: number;
}

function sentimentBadgeVariant(
  s: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (!s) return "outline";
  const l = s.toLowerCase();
  if (l === "positive") return "default";
  if (l === "negative") return "destructive";
  return "secondary";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ListResponse | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/qac/customers?${params}`);
      if (!res.ok) throw new Error("Failed to load customers");
      setResult(await res.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  function handleExportCSV() {
    if (!result?.data.length) return;
    const headers = ["ID", "Name", "Phone", "Email", "Total Calls", "Sentiment", "First Seen", "Last Seen"];
    const rows = result.data.map((c) => [
      c.id,
      c.display_name,
      c.canonical_phone ?? "",
      c.canonical_email ?? "",
      String(c.total_calls),
      c.lifetime_sentiment ?? "",
      c.first_seen_at,
      c.last_seen_at,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/qa-center"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            QA Center
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20">
              <Users className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">Customer Profiles</h1>
              {result && (
                <p className="text-xs text-gray-500">{result.total.toLocaleString()} customers</p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!result?.data.length}
            className="gap-1.5 border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="pl-9 bg-gray-900 border-gray-800 text-white placeholder:text-gray-600 focus-visible:ring-indigo-500/30"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : !result || result.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="h-10 w-10 text-gray-700 mb-3" />
            <p className="text-sm text-gray-500">
              {debouncedSearch ? `No customers match "${debouncedSearch}"` : "No customers yet"}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {result.data.map((c) => (
                <Link
                  key={c.id}
                  href={`/qa-center/customers/${c.id}`}
                  className="flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 hover:bg-gray-900 hover:border-gray-700 transition-colors"
                >
                  {/* Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold">
                    {c.display_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Name + identifiers */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{c.display_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {c.canonical_phone && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          {c.canonical_phone}
                        </span>
                      )}
                      {c.canonical_email && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500 truncate max-w-[180px]">
                          <Mail className="h-3 w-3" />
                          {c.canonical_email}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="hidden sm:flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Calls</p>
                      <p className="text-sm font-semibold text-white">{c.total_calls}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Last seen</p>
                      <p className="text-xs text-gray-300">{formatDate(c.last_seen_at)}</p>
                    </div>
                    {c.lifetime_sentiment && (
                      <Badge variant={sentimentBadgeVariant(c.lifetime_sentiment)} className="text-[10px] capitalize shrink-0">
                        {c.lifetime_sentiment}
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {result.pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-xs text-gray-500">
                  Page {result.page} of {result.pages}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="gap-1 border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(result.pages, p + 1))}
                    disabled={page >= result.pages}
                    className="gap-1 border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800 hover:text-white"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
