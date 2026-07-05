"use client";

import { ArrowLeft, GitBranch, Layers, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AgentTemplate } from "./constants";

interface Props {
  fromTemplate: AgentTemplate | null;
  onBack: () => void;
  onSimple: () => void;
  onWorkflow: () => void;
  onClearTemplate: () => void;
}

export function ModeScreen({
  fromTemplate,
  onBack,
  onSimple,
  onWorkflow,
  onClearTemplate,
}: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f5]">
      <div className="w-full max-w-2xl">
        <button
          onClick={() => onBack()}
          className="flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {fromTemplate && (
          <div className="flex items-center gap-2 rounded-md border border-[#e0e0e0] bg-white px-4 py-2.5 text-sm text-[#6b6b6b] mb-6">
            <Layers className="w-4 h-4 shrink-0" />
            Template:{" "}
            <span className="font-medium text-[#0a0a0a]">
              {fromTemplate.name}
            </span>
            <button onClick={onClearTemplate} className="ml-auto">
              <X className="h-3.5 w-3.5 hover:text-[#0a0a0a]" />
            </button>
          </div>
        )}

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-[#0a0a0a]">
            Choose Your Mode
          </h1>
          <p className="mt-2 text-[#6b6b6b]">
            How do you want to build your agent?
          </p>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <Card
            className="cursor-pointer border-2 hover:border-[#0a0a0a] transition-all hover:shadow-md"
            onClick={() => onSimple()}
          >
            <CardContent className="p-7 flex flex-col items-start">
              <div className="flex items-center justify-between w-full mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0a0a0a] text-white">
                  <Zap className="h-6 w-6" />
                </div>
                <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">
                  Recommended
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-[#0a0a0a] mb-2">
                Simple Mode
              </h2>
              <p className="text-sm text-[#6b6b6b] mb-1 font-medium">
                Create your agent in 2 minutes
              </p>
              <p className="text-sm text-[#6b6b6b] mb-6">
                Write what your agent should do in plain language. Perfect for
                beginners.
              </p>
              <Button className="w-full mt-auto" onClick={() => onSimple()}>
                Start Simple
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-2 hover:border-[#0a0a0a] transition-all hover:shadow-md"
            onClick={() => onWorkflow()}
          >
            <CardContent className="p-7 flex flex-col items-start">
              <div className="flex items-center justify-between w-full mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f5f5] border border-[#e0e0e0]">
                  <GitBranch className="h-6 w-6 text-[#0a0a0a]" />
                </div>
                <Badge
                  variant="outline"
                  className="text-xs border-[#e0e0e0] text-[#6b6b6b]"
                >
                  Advanced
                </Badge>
              </div>
              <h2 className="text-lg font-bold text-[#0a0a0a] mb-2">
                Workflow Mode
              </h2>
              <p className="text-sm text-[#6b6b6b] mb-1 font-medium">
                Build complex conversation flows
              </p>
              <p className="text-sm text-[#6b6b6b] mb-6">
                Design multi-step conversations with branches, conditions, and
                specialized sub-agents.
              </p>
              <Button
                variant="outline"
                className="w-full mt-auto"
                onClick={() => onWorkflow()}
              >
                Open Workflow Builder
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
