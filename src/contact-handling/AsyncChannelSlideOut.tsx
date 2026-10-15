import { CHANNEL_TYPE_META, SidePanel } from "@nicecxone/lyra-ui";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { threadAcceptsReplies } from "./channel-thread";
import { ChannelThreadBody, ChannelThreadComposer, type CopilotComposerProps } from "./ChannelThreadPane";

export interface AsyncChannelSlideOutProps {
  interaction: Interaction;
  /** The async thread to show; `null` keeps the panel closed. */
  thread: Thread | null;
  onClose: () => void;
  hideAiActions: boolean;
  onHideAiActionsChange: (hide: boolean) => void;
  onStatusChange: (status: string) => void;
  onSend: (text: string) => void;
  copilot: CopilotComposerProps;
}

/** The omnichannel layout's async slide-out: an email, SMS or WhatsApp
 *  thread over the right side of the interaction view (lyra `SidePanel`,
 *  unpinned, so it overlays instead of pushing the main column). Its parent
 *  must be positioned. Email shows "Coming soon" until P-PARKED. */
export function AsyncChannelSlideOut({
  interaction,
  thread,
  onClose,
  hideAiActions,
  onHideAiActionsChange,
  onStatusChange,
  onSend,
  copilot,
}: AsyncChannelSlideOutProps) {
  const meta = thread ? CHANNEL_TYPE_META[thread.type] : undefined;
  return (
    <div data-slot="async-slideout" data-thread={thread?.type} className="contents">
      <SidePanel
        side="right"
        open={!!thread}
        showCloseButton
        onClose={onClose}
        headerTitle={meta?.label ?? ""}
        headerSubhead={thread ? [interaction.customerName, thread.addressLabel].filter(Boolean).join(" · ") : undefined}
        footer={
          thread && threadAcceptsReplies(interaction, thread) ? (
            <ChannelThreadComposer hideAiActions={hideAiActions} onHideAiActionsChange={onHideAiActionsChange} onSend={onSend} copilot={copilot} />
          ) : undefined
        }
      >
        {thread && (
          <ChannelThreadBody interaction={interaction} thread={thread} hideAiActions={hideAiActions} onStatusChange={onStatusChange} />
        )}
      </SidePanel>
    </div>
  );
}
