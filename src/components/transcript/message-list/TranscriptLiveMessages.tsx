// One session's live messages (sent and received this visit, AI rows, events) and the typing indicators
// (P-EXTRACT: split out of `InteractionTranscript`'s per-session render, unchanged).
import type React from "react";
import type { ChannelType } from "@nicecxone/lyra-ui";
import { AiActionCard, AiActionCollapse, type AiActionCardHandlers } from "../ai-rows/ai-action-cards";
import type { TranscriptMessage, TranscriptTag } from "../transcript-types";
import { TranscriptMessageBubble, TranscriptPlainLine, TypingIndicator } from "./transcript-bubbles";

export function TranscriptLiveMessages({
  existingLiveMessages,
  newLiveMessages,
  overviewBlock,
  approvalOverview,
  showTypingIndicator,
  showAiTypingIndicator,
  channelType,
  displayName,
  displayInitials,
  customerIdentified,
  liveMessageTags,
  tagPickerOpenId,
  onTagPickerOpenIdChange,
  onAddTag,
  onRemoveTag,
  onClearTags,
  onCopy,
  narrow,
  bubbleFullWidth,
  initialMessageIds,
  hideAiActions,
  aiCardHandlers,
}: {
  /** The session's live messages that already existed when the contact loaded (above the overview). */
  existingLiveMessages: TranscriptMessage[];
  /** Live messages after that boundary (below the overview). */
  newLiveMessages: TranscriptMessage[];
  /** The overview block between the two, for a transfer/existing-conversation pickup. */
  overviewBlock?: React.ReactNode;
  /** The overview placed directly above the first approval request: that message's id and the block. */
  approvalOverview?: { messageId: string; node: React.ReactNode };
  showTypingIndicator: boolean;
  showAiTypingIndicator: boolean;
  channelType?: ChannelType;
  displayName: string;
  displayInitials: string;
  customerIdentified: boolean;
  liveMessageTags: Record<string, TranscriptTag[]>;
  tagPickerOpenId: string | null;
  onTagPickerOpenIdChange: (id: string | null) => void;
  onAddTag: (messageId: string, option: Omit<TranscriptTag, "id">) => void;
  onRemoveTag: (messageId: string, tagId: string) => void;
  onClearTags: (messageId: string) => void;
  onCopy: (text: string) => void;
  narrow: boolean;
  bubbleFullWidth: boolean;
  /** Ids present at first render: those render without the entrance animation. */
  initialMessageIds: Set<string> | null;
  hideAiActions: boolean;
  aiCardHandlers: AiActionCardHandlers;
}) {
  const renderBubble = (message: TranscriptMessage) => (
    <TranscriptMessageBubble
      key={message.id}
      message={{
        ...message,
        ...(message.sender === "customer" ? { name: displayName, initials: displayInitials } : {}),
        tags: liveMessageTags[message.id] ?? message.tags,
      }}
      customerIdentified={customerIdentified}
      tagPickerOpen={tagPickerOpenId === message.id}
      onTagPickerOpenChange={(open) => onTagPickerOpenIdChange(open ? message.id : null)}
      onAddTag={(option) => onAddTag(message.id, option)}
      onRemoveTag={(tagId) => onRemoveTag(message.id, tagId)}
      onClearTags={() => onClearTags(message.id)}
      onCopy={() => onCopy(message.text)}
      narrow={narrow}
    />
  );
  // Per explicit request ("style the transcript like the
  // contact history call transcripts") — see
  // `TranscriptPlainLine`'s own doc comment for the full
  // "why voice only, why a separate component from
  // `ContactHistoryTranscriptLine`". Same customer-identity
  // override `renderBubble` applies above (`displayName`),
  // just fed to the plain line instead of `ChatMessage`.
  const renderPlainLine = (message: TranscriptMessage) => (
    <TranscriptPlainLine
      key={message.id}
      name={message.sender === "customer" ? displayName : message.name}
      timestamp={message.timestamp}
      text={message.text}
    />
  );
  const renderLiveMessage = (message: TranscriptMessage) => {
    const rendered = message.instruction || message.wrapUp || message.saveAddress ? (
      <AiActionCard key={message.id} message={message} {...aiCardHandlers} />
    ) : message.summary ? (
      <div key={message.id} className="flex flex-col gap-5">
        {approvalOverview?.messageId === message.id && approvalOverview.node}
        <AiActionCard message={message} {...aiCardHandlers} />
      </div>
    ) : message.event ? (
      <div key={message.id} className="flex flex-col gap-0.5">
        <span className="lyra-body-sm text-lyra-fg-secondary">
          {message.timestamp} · {message.name}
        </span>
        <span className="lyra-body-md-emphasis text-lyra-fg-default">{message.text}</span>
      </div>
    ) : channelType === "voice" ? (
      renderPlainLine(message)
    ) : (
      renderBubble(message)
    );
    const isAiAction = !!(message.instruction || message.wrapUp || message.summary || message.saveAddress || message.event);
    const entered = initialMessageIds?.has(message.id) ? (
      rendered
    ) : (
      <div key={message.id} className="animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
        {rendered}
      </div>
    );
    return isAiAction ? (
      <AiActionCollapse key={message.id} hidden={hideAiActions} gap>
        {entered}
      </AiActionCollapse>
    ) : (
      entered
    );
  };
  return (
    <>
      {existingLiveMessages.length > 0 && (
        <div className="flex flex-col gap-5 pb-4">
          {existingLiveMessages.map(renderLiveMessage)}
        </div>
      )}
      {overviewBlock}
      {(newLiveMessages.length > 0 || showTypingIndicator || showAiTypingIndicator) && (
        <div className="flex flex-col gap-5 pb-4">
          {newLiveMessages.map(renderLiveMessage)}
          {showTypingIndicator && (
            <div className="animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
            <TypingIndicator
              initials={displayInitials}
              identified={customerIdentified}
              narrow={narrow}
              bubbleFullWidth={bubbleFullWidth}
            />
            </div>
          )}
          {showAiTypingIndicator && (
            <div className="animate-in slide-in-from-bottom-4 fade-in-0 duration-200">
            <TypingIndicator
              ai
              initials="AI"
              narrow={narrow}
              bubbleFullWidth={bubbleFullWidth}
            />
            </div>
          )}
        </div>
      )}
    </>
  );
}
