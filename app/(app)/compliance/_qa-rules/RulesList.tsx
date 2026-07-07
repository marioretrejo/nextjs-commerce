import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, ShieldCheck } from "lucide-react";
import {
  type ComplianceRule,
  SEVERITY_CONFIG,
  CATEGORY_CONFIG,
} from "./config";

export function RulesList({
  rules,
  loading,
  active,
  inactive,
  deleting,
  onToggle,
  onEdit,
  onDelete,
  onCreate,
}: {
  rules: ComplianceRule[];
  loading: boolean;
  active: number;
  inactive: number;
  deleting: string | null;
  onToggle: (rule: ComplianceRule) => void;
  onEdit: (rule: ComplianceRule) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[#0a0a0a]">
            QA Compliance Rules
          </h3>
          <p className="text-xs text-[#6b6b6b] mt-0.5">
            {rules.length === 0
              ? "No rules yet. Create your first rule to start evaluating calls."
              : `${active} active · ${inactive} inactive — applied to every post-call analysis`}
          </p>
        </div>
        <Button
          size="sm"
          onClick={onCreate}
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-3.5 w-3.5" /> Add Rule
        </Button>
      </div>

      {/* Stats */}
      {rules.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {Object.entries(
            rules.reduce(
              (acc, r) => {
                acc[r.severity] = (acc[r.severity] ?? 0) + 1;
                return acc;
              },
              {} as Record<string, number>,
            ),
          ).map(([sev, count]) => (
            <div
              key={sev}
              className={`rounded-lg border px-3 py-2.5 ${SEVERITY_CONFIG[sev as keyof typeof SEVERITY_CONFIG]?.class ?? "bg-gray-100"}`}
            >
              <p className="text-[11px] font-medium uppercase tracking-wider opacity-70">
                {sev}
              </p>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      )}

      {/* Rules list */}
      {loading ? (
        <div className="py-8 text-center text-sm text-[#a0a0a0]">
          Loading rules…
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#e5e5e5] py-14 text-center">
          <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-[#d0d0d0]" />
          <p className="text-sm font-medium text-[#6b6b6b]">
            No compliance rules yet
          </p>
          <p className="mt-1 text-xs text-[#a0a0a0]">
            Rules define what the AI evaluator checks after each call
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onCreate}
            className="mt-4 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Create first rule
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-[#f0f0f0] rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
          {rules.map((rule) => {
            const catCfg = CATEGORY_CONFIG[rule.category];
            const sevCfg = SEVERITY_CONFIG[rule.severity];
            const CatIcon = catCfg.icon;
            return (
              <div
                key={rule.id}
                className={`flex items-start gap-4 px-4 py-3.5 transition-colors ${!rule.is_active ? "opacity-50" : ""}`}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e5e5e5] bg-[#f9f9f9]">
                  <CatIcon className="h-4 w-4 text-[#9b9b9b]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-[#0a0a0a]">
                      {rule.rule_name}
                    </span>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${catCfg.class}`}
                    >
                      {catCfg.label}
                    </span>
                    <span
                      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${sevCfg.class}`}
                    >
                      {sevCfg.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#6b6b6b] line-clamp-2">
                    {rule.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 ml-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={() => onToggle(rule)}
                    className="data-[state=checked]:bg-emerald-600"
                  />
                  <button
                    onClick={() => onEdit(rule)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] text-[#9b9b9b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => onDelete(rule.id)}
                    disabled={deleting === rule.id}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e5e5e5] text-[#9b9b9b] hover:border-red-400 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Evaluator note */}
      {rules.length > 0 && (
        <p className="text-xs text-[#a0a0a0] leading-relaxed">
          <strong className="text-[#6b6b6b]">How it works:</strong> After each
          call, the QA engine checks the transcript against all active rules and
          generates a risk score (0–100) with detailed violation reports.
          Critical violations score 50 pts each; high = 30, medium = 15, low =
          5.
        </p>
      )}
    </div>
  );
}
