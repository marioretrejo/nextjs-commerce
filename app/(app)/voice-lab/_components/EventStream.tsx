import type { RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";
import type { LabEvent, Session } from "./types";
import { eventColor, formatTime } from "./helpers";

const CHECKS: { label: string; type: string }[] = [
  { label: "Worker joined", type: "livekit.room_joined" },
  { label: "LLM selected", type: "llm.provider_selected" },
  { label: "TTS selected", type: "tts.provider_selected" },
  { label: "User spoke", type: "call.answered" },
  { label: "Agent spoke", type: "assistant.speech_started" },
  { label: "Session ended clean", type: "call.ended" },
];

export function EventStream({
  events,
  session,
  eventsEndRef,
}: {
  events: LabEvent[];
  session: Session | null;
  eventsEndRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="lg:col-span-2">
      <Card className="h-[600px] flex flex-col">
        <CardHeader className="pb-2 flex-none">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span>Live Event Stream</span>
            {events.length > 0 && (
              <span className="text-xs font-normal text-[#999]">
                {events.length} events
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4">
          {events.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-[#ccc] gap-3">
              <FlaskConical className="h-10 w-10" />
              <div>
                <p className="text-sm font-medium">No events yet</p>
                <p className="text-xs mt-1">
                  {session
                    ? "Waiting for worker to join…"
                    : "Start a session to see live events here"}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1 font-mono text-[11px]">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 py-0.5 hover:bg-[#fafafa] rounded px-1"
                >
                  <span className="text-[#ccc] flex-none w-16 shrink-0 pt-px">
                    {formatTime(ev.created_at)}
                  </span>
                  <span
                    className={`font-semibold flex-none ${eventColor(ev.event_type)}`}
                  >
                    {ev.event_type}
                  </span>
                  {Object.keys(ev.payload).length > 0 && (
                    <span className="text-[#bbb] truncate">
                      {JSON.stringify(ev.payload)
                        .replace(/^{|}$/g, "")
                        .replace(/"([^"]+)":/g, "$1:")
                        .slice(0, 80)}
                    </span>
                  )}
                </div>
              ))}
              <div ref={eventsEndRef} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation checklist — shown when session active */}
      {(session || events.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {CHECKS.map(({ label, type }) => {
            const check = events.some((e) => e.event_type === type);
            return (
              <div
                key={label}
                className={`flex items-center gap-2 text-xs rounded-md px-3 py-2 border ${
                  check
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-[#fafafa] border-[#eee] text-[#999]"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full flex-none ${check ? "bg-emerald-500" : "bg-[#ddd]"}`}
                />
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
