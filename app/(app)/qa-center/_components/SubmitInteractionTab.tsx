"use client";

import type { Dispatch, SetStateAction } from "react";
import { Loader2, PlayCircle, ShieldAlert } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  agentName: string;
  setAgentName: Dispatch<SetStateAction<string>>;
  agentId: string;
  setAgentId: Dispatch<SetStateAction<string>>;
  channel: string;
  setChannel: Dispatch<SetStateAction<string>>;
  transcript: string;
  setTranscript: Dispatch<SetStateAction<string>>;
  durationMin: string;
  setDurationMin: Dispatch<SetStateAction<string>>;
  submitting: boolean;
  handleSubmit: () => void;
}

export function SubmitInteractionTab({
  agentName,
  setAgentName,
  agentId,
  setAgentId,
  channel,
  setChannel,
  transcript,
  setTranscript,
  durationMin,
  setDurationMin,
  submitting,
  handleSubmit,
}: Props) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>New Interaction Evaluation</CardTitle>
          <CardDescription>
            Paste the transcript of a human agent interaction. The AI auditor
            will score it across 5 dimensions, flag violations with regulation
            references, and generate coaching notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>
                Agent Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Maria González"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
              />
              <p className="text-xs text-[#9b9b9b]">
                Name of the human call center agent
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>
                Agent ID{" "}
                <span className="text-[#9b9b9b] font-normal">(optional)</span>
              </Label>
              <Input
                placeholder="e.g. EMP-0042"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              />
              <p className="text-xs text-[#9b9b9b]">
                Internal HR or CRM identifier
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Phone Call</SelectItem>
                  <SelectItem value="chat">Live Chat</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Duration (minutes){" "}
                <span className="text-[#9b9b9b] font-normal">(optional)</span>
              </Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 8"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              Transcript <span className="text-red-500">*</span>
            </Label>
            <Textarea
              rows={16}
              placeholder={`Agent: Thank you for calling collections, this is Maria. May I speak with John Smith?\nCustomer: This is John.\nAgent: Hi John, I'm calling regarding your account ending in 4521 with ABC Collections...\n...`}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className="font-mono text-xs resize-none"
            />
            <p className="text-xs text-[#9b9b9b]">
              {transcript.length} chars — the AI processes up to 8,000
              characters
            </p>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-[#f8f8f8] border border-[#efefef] p-3.5">
            <ShieldAlert className="h-4 w-4 text-[#9b9b9b] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-[#555] font-medium mb-0.5">
                AI auditor uses your active QA Rules
              </p>
              <p className="text-xs text-[#9b9b9b]">
                Configure rules in the QA Rules tab to customize what gets
                flagged — required disclosures, prohibited phrases, quality
                criteria, regulation references (FDCPA, TCPA, GDPR…).
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSubmit}
              disabled={
                submitting || !agentName.trim() || transcript.trim().length < 20
              }
              className="gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading &amp; Analyzing…
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Upload &amp; Analyze
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setAgentName("");
                setAgentId("");
                setTranscript("");
                setDurationMin("");
                setChannel("call");
              }}
              disabled={submitting}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
