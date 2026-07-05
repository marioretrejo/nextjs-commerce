"use client";

import { ArrowLeft, Layers, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AgentTemplate } from "./constants";

interface Props {
  showGallery: boolean;
  setShowGallery: (v: boolean) => void;
  gallerySearch: string;
  setGallerySearch: (v: string) => void;
  filteredTemplates: AgentTemplate[];
  applyTemplate: (tpl: AgentTemplate) => void;
  onBackToAgents: () => void;
  onStartFromScratch: () => void;
}

export function TemplatesScreen({
  showGallery,
  setShowGallery,
  gallerySearch,
  setGallerySearch,
  filteredTemplates,
  applyTemplate,
  onBackToAgents,
  onStartFromScratch,
}: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#f5f5f5]">
      <div className="w-full max-w-2xl">
        <button
          onClick={() => onBackToAgents()}
          className="flex items-center gap-1.5 text-sm text-[#6b6b6b] hover:text-[#0a0a0a] mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Agents
        </button>

        <div className="text-center mb-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#0a0a0a] text-white mx-auto mb-4">
            <Layers className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-[#0a0a0a]">
            New Agent
          </h1>
          <p className="mt-2 text-[#6b6b6b]">
            Start from a template or build from scratch
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card
            className="cursor-pointer border-2 hover:border-[#0a0a0a] transition-all hover:shadow-md"
            onClick={() => setShowGallery(true)}
          >
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5f5f5] border border-[#e0e0e0] mb-4">
                <Layers className="h-6 w-6 text-[#0a0a0a]" />
              </div>
              <h2 className="font-bold text-[#0a0a0a] mb-1">
                Browse Templates
              </h2>
              <p className="text-xs text-[#6b6b6b] mb-4">
                12 industry-specific templates ready to deploy in seconds.
              </p>
              <div className="flex flex-wrap gap-1 justify-center">
                {["Sales", "Support", "Scheduling", "B2B"].map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className="text-[10px] border-[#e0e0e0] text-[#6b6b6b]"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-2 hover:border-[#0a0a0a] transition-all hover:shadow-md"
            onClick={() => onStartFromScratch()}
          >
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0a0a0a] mb-4">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <h2 className="font-bold text-[#0a0a0a] mb-1">
                Start from Scratch
              </h2>
              <p className="text-xs text-[#6b6b6b] mb-4">
                Full control over every setting. Choose simple or workflow mode.
              </p>
              <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">
                Simple or Workflow
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Template Gallery Modal */}
      <Dialog open={showGallery} onOpenChange={setShowGallery}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Template Gallery</DialogTitle>
          </DialogHeader>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b6b]" />
            <Input
              className="pl-9"
              placeholder="Search templates by name, category, or language…"
              value={gallerySearch}
              onChange={(e) => setGallerySearch(e.target.value)}
              autoFocus
            />
            {gallerySearch && (
              <button
                onClick={() => setGallerySearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4 text-[#6b6b6b]" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            <div className="grid grid-cols-3 gap-3 pb-2">
              {filteredTemplates.map((tpl) => (
                <Card
                  key={tpl.id}
                  className="cursor-pointer hover:border-[#0a0a0a] transition-all hover:shadow-sm"
                  onClick={() => applyTemplate(tpl)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#e0e0e0] text-[#6b6b6b]"
                      >
                        {tpl.languageLabel}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] border-[#e0e0e0] text-[#6b6b6b]"
                      >
                        {tpl.category}
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm text-[#0a0a0a] mb-1">
                      {tpl.name}
                    </p>
                    <p className="text-xs text-[#6b6b6b] line-clamp-2">
                      {tpl.first_message}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-3 text-xs"
                    >
                      Use Template
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
