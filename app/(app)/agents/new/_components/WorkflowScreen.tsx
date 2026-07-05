"use client";

import { ArrowLeft, GitBranch, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "./constants";

interface Props {
  workflowName: string;
  setWorkflowName: (v: string) => void;
  workflowLanguage: string;
  setWorkflowLanguage: (v: string) => void;
  workflowSaving: boolean;
  onBack: () => void;
  onCreate: () => void;
}

export function WorkflowScreen({
  workflowName,
  setWorkflowName,
  workflowLanguage,
  setWorkflowLanguage,
  workflowSaving,
  onBack,
  onCreate,
}: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f5]">
      <div className="w-full max-w-md">
        <button
          onClick={() => onBack()}
          className="flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#f5f5f5] border border-[#e0e0e0] mx-auto mb-4">
            <GitBranch className="h-7 w-7 text-[#0a0a0a]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Workflow Agent</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Name your agent, then design its conversation flow visually.
          </p>
        </div>
        <Card>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-1.5">
              <Label>Agent Name *</Label>
              <Input
                placeholder="e.g. Sales Flow Agent"
                value={workflowName}
                onChange={(e) => setWorkflowName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Select
                value={workflowLanguage}
                onValueChange={setWorkflowLanguage}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              onClick={onCreate}
              disabled={workflowSaving || !workflowName.trim()}
            >
              {workflowSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <GitBranch className="mr-2 h-4 w-4" /> Create & Open Flow
                  Builder
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
