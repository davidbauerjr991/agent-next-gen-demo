import type { ComponentProps, ReactNode } from "react";
import { InteractionComposer, InteractionTranscript } from "@/components/agent-next-gen-transcript";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { isAiActionMessage } from "@/components/agent-next-gen-ai-messages";
import { threadKeyOf } from "./channel-thread";

/** The composer's Copilot props (chips, chip links, ask). */
export type CopilotComposerProps = Pick<
  ComponentProps<typeof InteractionComposer>,
  "copilotSuggestions" | "copilotSuggestionLinks" | "copilotSuggestionReplacements" | "onCopilotSuggestionLink" | "onCopilotAsk"
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
    />
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
