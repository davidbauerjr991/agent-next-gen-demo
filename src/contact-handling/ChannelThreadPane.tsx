import type { ComponentProps, ReactNode } from "react";
import { InteractionComposer, InteractionTranscript } from "@/components/agent-next-gen-transcript";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { isAiActionMessage } from "@/components/agent-next-gen-ai-messages";
import { isDraftThread, threadKeyOf } from "./channel-thread";

/** The composer's per-thread props: Copilot's (chips, chip links, ask) and
 *  the presence block on replying (`useReplyBlockedReason`). */
export type CopilotComposerProps = Pick<
  ComponentProps<typeof InteractionComposer>,
  "copilotSuggestions" | "copilotSuggestionLinks" | "copilotSuggestionReplacements" | "onCopilotSuggestionLink" | "onCopilotAsk" | "replyBlockedReason"
>;

export interface ChannelThreadBodyProps {
  interaction: Interaction;
  thread: Thread;
  hideAiActions: boolean;
  hideMockFollowUpMessages?: boolean;
  onStatusChange: (status: string) => void;
  /** Leave the AI rows out (AI display "main": they're the main column's). */
  withoutAiActions?: boolean;
  /** The Autosummary (`AutosummaryCard`) above the transcript, AI display
   *  inline: the thread view only (Customer Info and the rest belong to
   *  Contact Details); the panel and the hover preview show the same body. */
  overview?: ReactNode;
  /** The current session's row is in the panel's header (`ChannelThreadSessionRow`, AI display "main"). */
  sessionRowInHeader?: boolean;
}

/** One thread's transcript outside the main column (the docked channel
 *  preview, the omnichannel slide-out). Email shows "Coming soon" until
 *  P-PARKED. */
export function ChannelThreadBody({
  interaction,
  thread,
  hideAiActions,
  hideMockFollowUpMessages,
  onStatusChange,
  withoutAiActions,
  overview,
  sessionRowInHeader,
}: ChannelThreadBodyProps) {
  if (thread.type === "email") {
    return (
      // `flex-1`: centered in whatever body it fills (the panel, or a preview at its min height).
      <div className="flex min-h-full flex-1 items-center justify-center px-6 text-center text-sm text-lyra-fg-secondary">Coming soon</div>
    );
  }
  const key = threadKeyOf(thread);
  const messages = interaction.liveMessages?.[key] ?? [];
  return (
    <InteractionTranscript
      hideAiActions={hideAiActions}
      hideMockFollowUpMessages={hideMockFollowUpMessages}
      channelType={thread.type}
      direction={thread.direction}
      customerName={interaction.customerName}
      contactId={thread.contactId ?? interaction.customerId}
      // The session row shows the address (phone number), not the contact id.
      channelAddressLabel={thread.addressLabel}
      skillLabel={thread.preview}
      isFreshLaunch={!!thread.startedFresh}
      liveMessages={withoutAiActions ? messages.filter((m) => !isAiActionMessage(m)) : messages}
      overview={overview}
      currentStatus={interaction.threadStatuses?.[key]}
      onCurrentStatusChange={onStatusChange}
      showSessionActionCluster={false}
      showViewDetails={false}
      hideCurrentSessionRow={sessionRowInHeader}
    />
  );
}

export interface ChannelThreadSessionRowProps {
  interaction: Interaction;
  thread: Thread;
  onStatusChange: (status: string) => void;
  onViewSessionDetails: ComponentProps<typeof InteractionTranscript>["onViewSessionDetails"];
  onCurrentSessionChange: ComponentProps<typeof InteractionTranscript>["onCurrentSessionChange"];
  /** The session row's Outcome (the page's shared draft for this thread). */
  outcome: Partial<ComponentProps<typeof InteractionTranscript>>;
  /** Discard the draft / Unassign & Dismiss this thread. */
  onDismiss?: () => void;
}

/** A panel thread's current session row (status pill, Session Details,
 *  Outcome) for the docked panel's header, under the channel name (AI
 *  display "main", P-AIFIRST (k5) B). The thread body hides its own copy
 *  (`sessionRowInHeader`). */
export function ChannelThreadSessionRow({ interaction, thread, onStatusChange, onViewSessionDetails, onCurrentSessionChange, outcome, onDismiss }: ChannelThreadSessionRowProps) {
  const key = threadKeyOf(thread);
  return (
    <div data-slot="panel-session-row">
      <InteractionTranscript
        sessionRowOnly
        channelType={thread.type}
        direction={thread.direction}
        customerName={interaction.customerName}
        contactId={thread.contactId ?? interaction.customerId}
        channelAddressLabel={thread.addressLabel}
        skillLabel={thread.preview}
        isFreshLaunch={!!thread.startedFresh}
        liveMessages={interaction.liveMessages?.[key] ?? []}
        currentStatus={interaction.threadStatuses?.[key]}
        onCurrentStatusChange={onStatusChange}
        onViewSessionDetails={onViewSessionDetails}
        onCurrentSessionChange={onCurrentSessionChange}
        dimmed={!!interaction.closed || interaction.threadStatuses?.[key] === "Closed"}
        // The same draft derivation as the nav row (k6 9): "Discard draft" until a message is sent.
        isNewThread={isDraftThread(interaction, thread)}
        onDismissChannel={onDismiss}
        {...outcome}
      />
    </div>
  );
}

export interface ChannelThreadComposerProps {
  hideAiActions: boolean;
  onSend: (text: string) => void;
  copilot: CopilotComposerProps;
  /** Only the chat input (AI display "main": Copilot is the
   *  main column's). A dock with no mount renders no Copilot part. */
  chatOnly?: boolean;
  /** Its menus float above everything (a hover preview would clip them). */
  floatingMenus?: boolean;
}

/** The composer under a thread shown outside the main column. Render it only
 *  when `threadAcceptsReplies`. No "Hide AI Actions" switch: that's only for
 *  the main column's chat. */
export function ChannelThreadComposer({ hideAiActions, onSend, copilot, chatOnly, floatingMenus }: ChannelThreadComposerProps) {
  return (
    <InteractionComposer
      hideAiActions={hideAiActions}
      onSend={onSend}
      copilotDock={chatOnly ? { mount: null } : undefined}
      floatingMenus={floatingMenus}
      {...copilot}
    />
  );
}
