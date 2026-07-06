import { Mail, Phone } from "lucide-react";
import type { CustomerDetail } from "./types";
import { formatDate, sentimentColor } from "./format";

export function CustomerHeader({ customer }: { customer: CustomerDetail }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-6 py-5 mb-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-lg font-bold">
          {customer.display_name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold text-white">
            {customer.display_name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            {customer.canonical_phone && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                <Phone className="h-3.5 w-3.5" />
                {customer.canonical_phone}
              </span>
            )}
            {customer.canonical_email && (
              <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                <Mail className="h-3.5 w-3.5" />
                {customer.canonical_email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-800">
        <div>
          <p className="text-xs text-gray-500">Total Calls</p>
          <p className="text-xl font-bold text-white">{customer.total_calls}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Sentiment</p>
          <p
            className={`text-sm font-semibold capitalize ${sentimentColor(customer.lifetime_sentiment)}`}
          >
            {customer.lifetime_sentiment ?? "Unknown"}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">First Seen</p>
          <p className="text-sm text-gray-300">
            {formatDate(customer.first_seen_at)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Last Seen</p>
          <p className="text-sm text-gray-300">
            {formatDate(customer.last_seen_at)}
          </p>
        </div>
      </div>

      {customer.notes && (
        <p className="mt-4 text-sm text-gray-400 border-t border-gray-800 pt-4">
          {customer.notes}
        </p>
      )}
    </div>
  );
}
