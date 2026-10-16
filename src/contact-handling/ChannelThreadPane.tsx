import type { ComponentProps } from "react";
import { InteractionComposer, InteractionTranscript } from "@/components/agent-next-gen-transcript";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
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
}

/** One thread's transcript outside the main column (the docked channel
 *  preview, the omnichannel slide-out). Email shows "Coming soon" until
 *  P-PARKED. */
export function ChannelThreadBody({ interaction, thread, hideAiActions, hideMockFollowUpMessages, onStatusChange }: ChannelThreadBodyProps) {
  if (thread.type === "email") {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-lyra-fg-secondary">Coming soon</div>
    );
  }
  const key = threadKeyOf(thread);
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
      liveMessages={interaction.liveMessages?.[key] ?? []}
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
}

/** The composer under a thread shown outside the main column. Render it only
 *  when `threadAcceptsReplies`. No "Hide AI Actions" switch: that's only for
 *  the main column's chat. */
export function ChannelThreadComposer({ hideAiActions, onSend, copilot }: ChannelThreadComposerProps) {
  return <InteractionComposer hideAiActions={hideAiActions} onSend={onSend} {...copilot} />;
}
