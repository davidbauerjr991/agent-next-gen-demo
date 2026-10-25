import { useMemo, useRef } from "react";
import type { WorkspaceControllerProps, WorkspaceLate } from "./workspace-late";
import { useWsCards } from "./useWsCards";
import { useWsDetails } from "./useWsDetails";
import { useWsPanels } from "./useWsPanels";
import { useWsLaunch } from "./useWsLaunch";
import { useWsOutbound } from "./useWsOutbound";
import { useWsHeaderApps } from "./useWsHeaderApps";
import { useGuidanceFocus } from "../../reference-cards";
import { useNbaPause, useNbaSurfacing, useNbaTurns } from "../../next-best-action";
import { useCannedVoiceReplies } from "../../canned-voice-replies";
import { useListScheduleDay } from "@/provider-context";
import { useAssignmentToasts } from "../../toasts/useAssignmentToasts";
import { useSettings } from "@/settings";

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
  // P-CANVAS: the guidance's focus calls open a reference card on each contact's card; under every AI display
  // its Next Best Action surfaces in the conversation (panel mode: its AI feed) on connect, a pause or the agent's
  // request.
  useGuidanceFocus(workspace.interactions);
  // Scripted cases gate on their agent lines (`useNbaTurns`); the pause rule is for unscripted sim contacts only,
  // and an unscripted call's caller answers with canned lines.
  const scriptedContactIds = useMemo(
    () => new Set(Object.values(workspace.scenarioCases.byKey).flatMap((c) => (c?.contact ? [c.contact.id as string] : []))),
    [workspace.scenarioCases.byKey],
  );
  useNbaSurfacing(workspace.interactions, workspace.setInteractions);
  const onQuietPause = useCannedVoiceReplies(workspace.interactions, workspace.setInteractions, scriptedContactIds);
  useNbaPause(workspace.interactions, scriptedContactIds, onQuietPause);
  useNbaTurns();
  // P-HOME-1: the persona's day from the schedule source; a persona change lists (and re-seeds) another.
  useListScheduleDay(useSettings("workspace")[0].persona);
  // P-HOME-1: toasts for events on other assignments; a drawer row a toast logged opens it again.
  const assignmentToasts = useAssignmentToasts(workspace);
  late.viewToastNotification = assignmentToasts.viewFromNotification;
  return { ...workspace, assignmentToasts };
}

export type Workspace = ReturnType<typeof useWorkspaceController>;
