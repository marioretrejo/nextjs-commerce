import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Plus,
  Trash2,
  Upload,
  Loader2,
  FileText,
  Zap,
  ChevronRight,
} from "lucide-react";
import type { KnowledgeBase } from "./types";

export function KbList({
  loading,
  bases,
  deletingId,
  onCreate,
  onUpload,
  onDelete,
}: {
  loading: boolean;
  bases: KnowledgeBase[];
  deletingId: string | null;
  onCreate: () => void;
  onUpload: (kb: KnowledgeBase) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#6b6b6b] py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (bases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#e0e0e0] py-20 text-center">
        <BookOpen className="h-12 w-12 text-[#e0e0e0] mb-4" />
        <p className="font-semibold text-[#0a0a0a]">No knowledge bases yet</p>
        <p className="text-sm text-[#6b6b6b] mt-1 mb-6 max-w-xs">
          Create a knowledge base and upload product docs, FAQs, or any text
          your agents should know.
        </p>
        <Button onClick={onCreate}>
          <Plus className="mr-2 h-4 w-4" /> Create first KB
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      {bases.map((kb) => (
        <Card key={kb.id} className="border-[#e0e0e0]">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-[#6b6b6b]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[#0a0a0a]">{kb.name}</p>
                {kb.description && (
                  <p className="text-xs text-[#6b6b6b] mt-0.5 truncate">
                    {kb.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge
                    variant={kb.chunk_count > 0 ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {kb.chunk_count > 0 ? `${kb.chunk_count} chunks` : "Empty"}
                  </Badge>
                  {kb.chunk_count > 0 && (
                    <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <Zap className="h-3 w-3" /> RAG active
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onUpload(kb)}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" /> Add Document
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-[#6b6b6b] hover:text-red-600"
                disabled={deletingId === kb.id}
                onClick={() => onDelete(kb.id)}
              >
                {deletingId === kb.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
