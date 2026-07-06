import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Agent, QACriteria } from "@/lib/supabase/types";

export function CriteriaBuilder({
  loading,
  agents,
  criteria,
  onAdd,
  onEdit,
  onDelete,
}: {
  loading: boolean;
  agents: Agent[];
  criteria: Record<string, QACriteria[]>;
  onAdd: (agentId: string) => void;
  onEdit: (agentId: string, c: QACriteria) => void;
  onDelete: (agentId: string, criteriaId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-[#0a0a0a]">QA Criteria</h2>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="h-24 bg-[#f5f5f5] rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-[#6b6b6b]">
            No agents found. Create an agent to define QA criteria.
          </CardContent>
        </Card>
      ) : (
        agents.map((agent) => {
          const agentCriteria = criteria[agent.id] ?? [];
          return (
            <Card key={agent.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {agent.name}
                    </CardTitle>
                    <CardDescription>
                      {agentCriteria.length} criteria defined
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onAdd(agent.id)}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Criteria
                  </Button>
                </div>
              </CardHeader>
              {agentCriteria.length > 0 && (
                <CardContent className="p-0 border-t border-[#e0e0e0]">
                  <div className="divide-y divide-[#e0e0e0]">
                    {agentCriteria.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-[#f5f5f5]"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#0a0a0a]">
                            {c.name}
                          </p>
                          {c.description && (
                            <p className="text-xs text-[#6b6b6b] mt-0.5 truncate">
                              {c.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
                            Weight: {c.weight}%
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => onEdit(agent.id, c)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-[#6b6b6b] hover:text-[#0a0a0a]"
                            onClick={() => onDelete(agent.id, c.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
