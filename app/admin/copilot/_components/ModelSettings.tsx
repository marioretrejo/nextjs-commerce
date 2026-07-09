import { Sliders } from "lucide-react";
import { MODELS } from "./constants";

export function ModelSettings({
  model,
  setModel,
  temperature,
  setTemperature,
  maxTokens,
  setMaxTokens,
}: {
  model: string;
  setModel: (v: string) => void;
  temperature: number;
  setTemperature: (v: number) => void;
  maxTokens: number;
  setMaxTokens: (v: number) => void;
}) {
  return (
    <section className="bg-white border border-[#e5e5e5] rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#f0f0f0]">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0a0a0a]">
          <Sliders className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#0a0a0a]">Model Settings</p>
          <p className="text-xs text-[#9b9b9b]">
            Controls which AI model is used and how deterministic the responses
            are.
          </p>
        </div>
      </div>
      <div className="p-6 space-y-6">
        {/* Model picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#404040]">Model</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {MODELS.map((m) => (
              <button
                key={m.value}
                onClick={() => setModel(m.value)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                  model === m.value
                    ? "border-[#0a0a0a] bg-[#0a0a0a] text-white"
                    : "border-[#e5e5e5] text-[#404040] hover:border-[#0a0a0a]"
                }`}
              >
                <span className="font-medium block leading-tight">
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Temperature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[#404040]">
              Temperature
            </label>
            <span className="text-xs font-mono text-[#0a0a0a] bg-[#f5f5f5] px-2 py-0.5 rounded-md">
              {temperature.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full accent-[#0a0a0a]"
          />
          <div className="flex justify-between text-[10px] text-[#9b9b9b]">
            <span>0.0 — deterministic</span>
            <span>1.0 — creative</span>
          </div>
        </div>

        {/* Max tokens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-[#404040]">
              Max Tokens
            </label>
            <span className="text-xs font-mono text-[#0a0a0a] bg-[#f5f5f5] px-2 py-0.5 rounded-md">
              {maxTokens.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={256}
            max={4096}
            step={256}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full accent-[#0a0a0a]"
          />
          <div className="flex justify-between text-[10px] text-[#9b9b9b]">
            <span>256 — short replies</span>
            <span>4096 — detailed analysis</span>
          </div>
        </div>
      </div>
    </section>
  );
}
