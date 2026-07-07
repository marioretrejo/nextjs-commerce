import type { ChatCompletionTool } from "groq-sdk/resources/chat/completions";
import { createAdminClient } from "@/lib/supabase/admin";

export const TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_workspace_stats",
      description:
        "Get overall workspace stats: total calls, minutes used/limit, plan, active agents count.",
      parameters: {
        type: "object" as const,
        properties: {
          period_days: {
            type: "string",
            description: 'Days to look back, e.g. "30". Default 30.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_campaign_metrics",
      description:
        "Get campaign performance: call volume, completion rate, status breakdown.",
      parameters: {
        type: "object" as const,
        properties: {
          campaign_id: {
            type: "string",
            description: "Optional specific campaign ID, or omit for all.",
          },
          period_days: {
            type: "string",
            description: 'Days to look back, e.g. "30". Default 30.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_call_durations",
      description: "Get call duration statistics: avg, p50, p95 in seconds.",
      parameters: {
        type: "object" as const,
        properties: {
          agent_id: {
            type: "string",
            description: "Optional agent ID filter.",
          },
          period_days: {
            type: "string",
            description: 'Days to look back, e.g. "30". Default 30.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_success_rates",
      description:
        "Get task-completion % and sentiment breakdown (positive/neutral/negative).",
      parameters: {
        type: "object" as const,
        properties: {
          agent_id: {
            type: "string",
            description: "Optional agent ID filter.",
          },
          period_days: {
            type: "string",
            description: 'Days to look back, e.g. "30". Default 30.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_top_agents",
      description:
        "List top-performing agents ranked by call volume or success rate.",
      parameters: {
        type: "object" as const,
        properties: {
          limit: {
            type: "string",
            description: 'Number of agents to return, e.g. "5". Default 5.',
          },
          rank_by: { type: "string", enum: ["call_volume", "success_rate"] },
        },
        required: [],
      },
    },
  },
];

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  workspaceId: string,
): Promise<string> {
  const admin = createAdminClient();
  const days = Number(args["period_days"] ?? 30) || 30;
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  try {
    switch (name) {
      case "get_workspace_stats": {
        const [callsRes, agentsRes, wsRes] = await Promise.all([
          admin
            .from("calls")
            .select("duration_seconds", { count: "exact" })
            .eq("workspace_id", workspaceId)
            .gte("created_at", since),
          admin
            .from("agents")
            .select("id", { count: "exact" })
            .eq("workspace_id", workspaceId)
            .eq("status", "active"),
          admin
            .from("workspaces")
            .select("minutes_used,minutes_limit,plan")
            .eq("id", workspaceId)
            .single(),
        ]);
        const totalSec = (callsRes.data ?? []).reduce(
          (s, c) => s + (Number(c.duration_seconds) || 0),
          0,
        );
        return JSON.stringify({
          period_days: days,
          total_calls: callsRes.count ?? 0,
          active_agents: agentsRes.count ?? 0,
          total_duration_minutes: Math.round(totalSec / 60),
          minutes_used: wsRes.data?.minutes_used ?? 0,
          minutes_limit: wsRes.data?.minutes_limit ?? 0,
          plan: wsRes.data?.plan ?? "free",
        });
      }

      case "get_campaign_metrics": {
        let q = admin
          .from("campaigns")
          .select(
            "id,name,status,total_contacts,completed_contacts,converted_contacts",
          )
          .eq("workspace_id", workspaceId);
        if (args["campaign_id"] && args["campaign_id"] !== "all") {
          q = q.eq("id", String(args["campaign_id"]));
        }
        const { data } = await q;
        return JSON.stringify(data ?? []);
      }

      case "get_call_durations": {
        let q = admin
          .from("calls")
          .select("duration_seconds")
          .eq("workspace_id", workspaceId)
          .gte("created_at", since)
          .not("duration_seconds", "is", null);
        if (args["agent_id"]) q = q.eq("agent_id", String(args["agent_id"]));
        const { data } = await q;
        const durations = (data ?? [])
          .map((c) => Number(c.duration_seconds))
          .sort((a, b) => a - b);
        const p = (arr: number[], pct: number) =>
          arr[Math.floor(arr.length * pct)] ?? 0;
        return JSON.stringify({
          count: durations.length,
          avg_seconds: durations.length
            ? Math.round(
                durations.reduce((s, d) => s + d, 0) / durations.length,
              )
            : 0,
          p50_seconds: p(durations, 0.5),
          p95_seconds: p(durations, 0.95),
        });
      }

      case "get_success_rates": {
        let q = admin
          .from("calls")
          .select("task_completed,sentiment")
          .eq("workspace_id", workspaceId)
          .gte("created_at", since);
        if (args["agent_id"]) q = q.eq("agent_id", String(args["agent_id"]));
        const { data } = await q;
        const calls = data ?? [];
        const total = calls.length;
        const done = calls.filter((c) => c.task_completed).length;
        return JSON.stringify({
          total,
          task_completed_pct: total ? Math.round((done / total) * 100) : 0,
          sentiment: {
            positive: calls.filter((c) => c.sentiment === "positive").length,
            neutral: calls.filter((c) => c.sentiment === "neutral").length,
            negative: calls.filter((c) => c.sentiment === "negative").length,
          },
        });
      }

      case "get_top_agents": {
        const { data } = await admin
          .from("agents")
          .select("id,name,total_calls,avg_qa_score")
          .eq("workspace_id", workspaceId)
          .order("total_calls", { ascending: false })
          .limit(Number(args["limit"] ?? 5) || 5);
        return JSON.stringify(data ?? []);
      }

      default:
        return JSON.stringify({ error: "Unknown tool" });
    }
  } catch {
    return JSON.stringify({ error: "Data temporarily unavailable" });
  }
}
