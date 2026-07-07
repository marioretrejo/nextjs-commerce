import { ShieldCheck, AlertTriangle, Zap, Info } from "lucide-react";

export interface ComplianceRule {
  id: string;
  rule_name: string;
  description: string;
  category: "disclosure" | "prohibited" | "required" | "quality" | "general";
  severity: "low" | "medium" | "high" | "critical";
  is_active: boolean;
  created_at: string;
}

export const SEVERITY_CONFIG = {
  low: { label: "Low", class: "bg-gray-100 text-gray-600 border-gray-200" },
  medium: {
    label: "Medium",
    class: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  high: {
    label: "High",
    class: "bg-orange-100 text-orange-700 border-orange-200",
  },
  critical: {
    label: "Critical",
    class: "bg-red-100 text-red-700 border-red-200",
  },
};

export const CATEGORY_CONFIG = {
  disclosure: {
    label: "Disclosure",
    icon: Info,
    class: "bg-blue-50 text-blue-700 border-blue-200",
  },
  prohibited: {
    label: "Prohibited",
    icon: AlertTriangle,
    class: "bg-red-50 text-red-700 border-red-200",
  },
  required: {
    label: "Required",
    icon: ShieldCheck,
    class: "bg-green-50 text-green-700 border-green-200",
  },
  quality: {
    label: "Quality",
    icon: Zap,
    class: "bg-purple-50 text-purple-700 border-purple-200",
  },
  general: {
    label: "General",
    icon: ShieldCheck,
    class: "bg-gray-50 text-gray-700 border-gray-200",
  },
};

export type Category = ComplianceRule["category"];
export type Severity = ComplianceRule["severity"];
export type RuleForm = {
  rule_name: string;
  description: string;
  category: Category;
  severity: Severity;
};
export const EMPTY_FORM: RuleForm = {
  rule_name: "",
  description: "",
  category: "general",
  severity: "medium",
};
