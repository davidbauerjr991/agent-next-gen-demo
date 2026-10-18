import { useRef } from "react";
import type { WorkspaceControllerProps, WorkspaceLate } from "./workspace-late";
import { useWsCards } from "./useWsCards";
import { useWsDetails } from "./useWsDetails";
import { useWsPanels } from "./useWsPanels";
import { useWsLaunch } from "./useWsLaunch";
import { useWsOutbound } from "./useWsOutbound";
import { useWsHeaderApps } from "./useWsHeaderApps";

/** The agent workspace's controller (P-EXTRACT C8b): everything the page's
 *  body computed, in the same order (so the hooks run in the same order),
 *  split into six slices. Each slice takes what the earlier ones built and
 *  adds its own; a name a slice needs from a later one is read through
 *  `late` (see `WorkspaceLate`), filled in right after its slice runs. The
 *  result is what the workspace's regions read (`useWorkspace`). One
 *  object, as the page was one function: narrower contexts are P2.0's. */
export function useWorkspaceController(props: WorkspaceControllerProps) {
  const late = useRef({} as WorkspaceLate).current;
  const cards = useWsCards(props, late);
  const details = useWsDetails(cards, late);
  late.showWelcomeModal = details.showWelcomeModal;
  const panels = useWsPanels(details, late);
  late.sidePanelOpen = panels.sidePanelOpen;
  late.setSidePanelOpen = panels.setSidePanelOpen;
  late.switchActiveInteraction = panels.switchActiveInteraction;
  const launch = useWsLaunch(panels, late);
  late.outboundDial = launch.outboundDial;
  late.handleDismissInteraction = launch.handleDismissInteraction;
  late.handleChannelSelect = launch.handleChannelSelect;
  const outbound = useWsOutbound(launch, late);
  late.contactCommands = outbound.contactCommands;
  late.outcomeFor = outbound.outcomeFor;
  late.handleInteractionStatusChange = outbound.handleInteractionStatusChange;
  late.handleOutcomeSaveAndDismissChannel = outbound.handleOutcomeSaveAndDismissChannel;
  const workspace = useWsHeaderApps(outbound);
  late.handlePanelButtonClick = workspace.handlePanelButtonClick;
  return workspace;
}

export type Workspace = ReturnType<typeof useWorkspaceController>;
