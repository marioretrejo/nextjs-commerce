import { Bot, Info } from "lucide-react";
import { DEFAULT_SYSTEM_PROMPT } from "./constants";

export function SystemPromptSection({
  systemPrompt,
  setSystemPrompt,
}: {
  systemPrompt: string;
  setSystemPrompt: (v: string) => void;
}) {
  return (
    <section className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#f0f0f0]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a0a0a]">
          <Bot className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">System Prompt</p>
          <p className="text-xs text-[#9b9b9b]">
            The AI's persona, rules, and base instructions. Injected at the
            start of every conversation.
          </p>
        </div>
      </div>
      <div className="p-6">
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={14}
          placeholder="Write the system prompt for the Analytics Copilot…"
          className="w-full rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-sm font-mono leading-relaxed text-[#1a1a1a] outline-none resize-y transition-colors focus:border-[#0a0a0a] focus:bg-white"
        />
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#9b9b9b]">
          <Info className="w-3 h-3 shrink-0" />
          <span>
            The current date is injected automatically at runtime. RAG documents
            are appended below the system prompt.
          </span>
        </div>
        <button
          onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
          className="mt-3 text-xs text-[#9b9b9b] underline underline-offset-2 hover:text-[#0a0a0a] transition-colors"
        >
          Reset to default
        </button>
      </div>
    </section>
  );
}
