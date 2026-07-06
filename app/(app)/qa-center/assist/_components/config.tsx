import { AlertTriangle, Info, Lightbulb } from "lucide-react";

export const ALERT_CFG = {
  danger: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
    subtext: "text-red-600",
    icon: <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />,
    badge: "bg-red-100 text-red-700 border-red-200",
    label: "Danger",
    dot: "bg-red-500",
  },
  warning: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-900",
    subtext: "text-yellow-700",
    icon: <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0" />,
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200",
    label: "Warning",
    dot: "bg-yellow-500",
  },
  info: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-900",
    subtext: "text-blue-700",
    icon: <Info className="h-4 w-4 text-blue-600 shrink-0" />,
    badge: "bg-blue-100 text-blue-800 border-blue-200",
    label: "Info",
    dot: "bg-blue-500",
  },
  opportunity: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-900",
    subtext: "text-green-700",
    icon: <Lightbulb className="h-4 w-4 text-green-600 shrink-0" />,
    badge: "bg-green-100 text-green-800 border-green-200",
    label: "Opportunity",
    dot: "bg-green-500",
  },
};

export const RISK_CFG = {
  none: {
    label: "No Risk",
    dot: "bg-gray-400",
    text: "text-gray-600",
    pill: "bg-gray-100 text-gray-700 border-gray-200",
  },
  low: {
    label: "Low Risk",
    dot: "bg-green-500",
    text: "text-green-700",
    pill: "bg-green-50 text-green-700 border-green-200",
  },
  medium: {
    label: "Medium Risk",
    dot: "bg-yellow-500",
    text: "text-yellow-700",
    pill: "bg-yellow-50 text-yellow-800 border-yellow-200",
  },
  high: {
    label: "High Risk",
    dot: "bg-red-500",
    text: "text-red-700",
    pill: "bg-red-50 text-red-800 border-red-200",
  },
};

export const DEBOUNCE_MS = 3000;

export function relativeTime(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}
