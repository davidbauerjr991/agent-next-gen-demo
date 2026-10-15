import { useRef } from "react";
import { CheckCircle2 } from "lucide-react";
import { buildOutcomePopoverSlots, useOutcomePopoverState, type ChannelOutcomeConfig } from "@nicecxone/lyra-ui";

// The inline wrap-up card (P0.5d.1), rendered in a card's content area while
// its voice call is in wrap-up, on both pages. The same shell as Lucas's
// "Wrap up" card (success-subtle header), filled with the Outcome popover's
// own fields and footer from lyra (`buildOutcomePopoverSlots`): tags,
// disposition, summary notes, and Save & Redial / Save & Dismiss (enabled
// once a disposition is picked). The page passes the channel's Outcome
// config with `callEnded`, so it edits the same per-channel draft the nav
// row's Outcome shortcut does.

export function VoiceWrapUpCard({ outcome }: { outcome: ChannelOutcomeConfig }) {
  const popoverState = useOutcomePopoverState();
  // Anchors Save & Redial's dial pad on the card.
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { content, footer } = buildOutcomePopoverSlots(outcome, popoverState, cardRef);
  return (
    <div
      ref={cardRef}
      role="region"
      aria-label="Wrap up"
      className="animate-in fade-in-0 slide-in-from-bottom-2 duration-200 overflow-hidden rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-surface-base"
    >
      <div className="flex items-center gap-2 bg-lyra-status-success-subtle px-4 py-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-lyra-status-success-strong" strokeWidth={1.5} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate lyra-body-md-emphasis text-lyra-fg-default">Wrap up</span>
        <span className="shrink-0 lyra-body-sm text-lyra-fg-secondary">Call ended</span>
      </div>
      <div className="px-4 pt-3">{content}</div>
      {footer}
    </div>
  );
}
