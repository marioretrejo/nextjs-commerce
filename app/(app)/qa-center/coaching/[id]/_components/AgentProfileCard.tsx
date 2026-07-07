import { ChevronRight } from "lucide-react";
import type { CoachingDetail } from "./types";

export function AgentProfileCard({
  profile,
  onViewProfile,
}: {
  profile: NonNullable<CoachingDetail["agent_profile"]>;
  onViewProfile: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
      <h2 className="mb-3 text-sm font-medium text-gray-400">Agent</h2>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
          {profile.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-gray-200">{profile.name}</p>
          <p className="text-sm text-gray-500">
            {profile.role ?? "Agent"}
            {profile.team ? ` · ${profile.team}` : ""}
            {profile.email ? ` · ${profile.email}` : ""}
          </p>
        </div>
        <button
          onClick={() => onViewProfile(profile.id)}
          className="ml-auto flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
        >
          View Profile <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
