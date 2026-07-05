"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquare, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QACComment } from "./types";

export function CommentsPanel({ interactionId }: { interactionId: string }) {
  const [comments, setComments] = useState<QACComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/qac/interactions/${interactionId}/comments`,
      );
      if (!res.ok) return;
      setComments(await res.json());
    } finally {
      setLoadingComments(false);
    }
  }, [interactionId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  async function submit() {
    const text = newComment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/qac/interactions/${interactionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: text }),
        },
      );
      if (!res.ok) throw new Error("Failed to add comment");
      setNewComment("");
      await fetchComments();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  }

  function fmtRelative(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <Card className="border-[#efefef]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#6b6b6b]" />
          QA Comments
          {comments.length > 0 && (
            <span className="text-xs font-normal text-[#9b9b9b]">
              ({comments.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loadingComments ? (
          <div className="py-4 text-center">
            <Loader2 className="h-4 w-4 animate-spin text-[#9b9b9b] mx-auto" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-xs text-[#9b9b9b] text-center py-3">
            No comments yet
          </p>
        ) : (
          <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
            {comments.map((c) => (
              <div
                key={c.id}
                className="rounded-xl bg-[#f8f8f8] border border-[#efefef] p-3 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-[#e0e0e0] flex items-center justify-center">
                    <User className="h-3 w-3 text-[#6b6b6b]" />
                  </div>
                  <span className="text-[10px] text-[#9b9b9b]">
                    {fmtRelative(c.created_at)}
                  </span>
                </div>
                <p className="text-xs text-[#444] leading-relaxed">
                  {c.comment}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Add comment */}
        <div className="space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            rows={2}
            maxLength={2000}
            placeholder="Add a QA comment… (⌘↵ to submit)"
            className="w-full rounded-lg border border-[#e0e0e0] bg-white px-3 py-2 text-xs text-[#111] focus:outline-none focus:ring-1 focus:ring-[#111] resize-none placeholder:text-[#9b9b9b]"
          />
          <button
            onClick={() => void submit()}
            disabled={!newComment.trim() || submitting}
            className="flex items-center gap-1.5 rounded-lg bg-[#111] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#333] disabled:opacity-40 transition-colors"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Add Comment
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
