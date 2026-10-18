import { createContext, useContext } from "react";
import type { Workspace } from "./controller/useWorkspaceController";

/** The workspace controller's result, for the page's regions (P-EXTRACT C8).
 *  One context: the page re-rendered every region on any change before the
 *  split, and still does; narrower contexts are P2.0's. */
export const WorkspaceContext = createContext<Workspace | null>(null);

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace: no WorkspaceContext (render inside AgentWorkspaceAdvancedPage)");
  return workspace;
}
