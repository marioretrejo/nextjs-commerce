"use client";

import type { WorkspaceRow } from "./_command-center/types";
import { useWorkspaceCommandCenter } from "./_command-center/useWorkspaceCommandCenter";
import { WorkspaceModals } from "./_command-center/WorkspaceModals";
import { WorkspaceTable } from "./_command-center/WorkspaceTable";

interface Props {
  workspaces: WorkspaceRow[];
}

export function WorkspaceCommandCenter({ workspaces: initial }: Props) {
  const cc = useWorkspaceCommandCenter(initial);
  return (
    <>
      <WorkspaceModals cc={cc} />
      <WorkspaceTable cc={cc} />
    </>
  );
}
