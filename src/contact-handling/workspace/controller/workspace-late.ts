import type { Dispatch, SetStateAction } from "react";
import type { Interaction } from "@/components/agent-next-gen-interaction-dashboard";
import type { useContactCommands, useOutboundDial } from "@/contact-handling";
import type { InteractionOutcome } from "@/domain/interaction";
import type { PanelKey } from "@/contact-handling/workspace/workspace-types";
import type { Page } from "@/components/agent-next-gen-shared-utils";

/** The workspace page's props (`AgentWorkspaceAdvancedPage`). */
export interface WorkspacePageProps {
  showPageHeader?: boolean;
  showPanelToggle?: boolean;
  showInteriorPanel?: boolean;
  onNavigate?: (page: Page) => void;
  /**
   * Seeds `interactions`/`activeInteractionId` with an already-active call
   * instead of starting empty — mirrors lyra-ui's `AgentNextGenTemplate`
   * "Active Interaction" story prop of the same name (see that story's own
   * doc comment for the full rationale). Not passed anywhere in this app
   * today — kept as an opt-in capability so this component stays in sync
   * with the canonical template's shape, not to change default behavior.
   */
  initialInteraction?: Interaction;
  /**
   * Overrides the record-header toggle button's visible label for the
   * Customer Information `InteriorPanel` — mirrors lyra-ui's
   * `AgentNextGenTemplate` prop of the same name. Defaults to "Customer
   * Information" here; pass a different string to override it.
   */
  sidePanelToggleLabel?: string;
}

/** The page's props with their defaults applied, as the controller gets them. */
export type WorkspaceControllerProps = WorkspacePageProps &
  Required<Pick<WorkspacePageProps, "showPageHeader" | "showPanelToggle" | "showInteriorPanel">>;

/** Names a workspace controller slice uses before the slice that defines
 *  them has run (P-EXTRACT C8b). The page was one function, so a handler
 *  could call one declared further down: by the time it ran, that one
 *  existed. Split into slices, those calls read the latest value from here,
 *  which the controller fills in after the defining slice each render. Only
 *  ever read inside callbacks and effects (a read during render was a
 *  temporal-dead-zone error in the one-function page too). */
export interface WorkspaceLate {
  showWelcomeModal: boolean;
  sidePanelOpen: boolean;
  setSidePanelOpen: Dispatch<SetStateAction<boolean>>;
  outboundDial: ReturnType<typeof useOutboundDial>;
  handleDismissInteraction: (id: string) => void;
  switchActiveInteraction: (nextId: string | null) => void;
  handleChannelSelect: (interactionId: string, channelKey: string) => void;
  contactCommands: ReturnType<typeof useContactCommands>;
  outcomeFor: (cardId: string) => (threadKey: string) => InteractionOutcome;
  handleInteractionStatusChange: (interactionId: string, channelId: string, status: string) => void;
  handleOutcomeSaveAndDismissChannel: (interaction: Interaction, c: Interaction["threads"][number]) => void;
  handlePanelButtonClick: (key: PanelKey) => () => void;
  /** P-HOME-1: a Notifications row an assignment toast logged opens it again; false for any other row. */
  viewToastNotification: (notificationId: string) => boolean;
}
