import { createPortal } from "react-dom";
import { VoiceCallControls, type VoiceCallControlsProps } from "@/components/agent-next-gen-voice-call-controls";
import type { VoiceBarCall } from "./useVoiceBarCall";
import type { VoiceCallControlProps } from "./useVoiceCallControls";

export interface VoiceBarProps
  extends Omit<
    VoiceCallControlsProps,
    "callStartTick" | "holdStartTick" | "customerLabel" | "className" | "showAddVideo" | "stacked"
  > {
  /** The call it shows (`useVoiceBarCall`): the selected card's, else the
   *  live or most recent held one. */
  call: VoiceBarCall;
  /** Provider state and handlers (`useVoiceCallControls`). */
  controls: VoiceCallControlProps;
  /** Where the bar renders (Settings → Voice controls location). "top"
   *  portals a stacked bar into `topSlot` (a slot at the top of the left
   *  nav); while there's no slot (the nav is collapsed) it falls back to the
   *  bottom. */
  placement?: "bottom" | "top";
  topSlot?: HTMLElement | null;
}

/** The persistent voice bar, shared by both pages (parity row 1): docked
 *  below the main container across the content column, outside any
 *  assignment's content, so it stays put whichever card or tab is showing.
 *  Pages pass only what differs (their transcript panel, hang-up cleanup). */
export function VoiceBar({ call, controls, placement = "bottom", topSlot, ...rest }: VoiceBarProps) {
  const atTop = placement === "top" && !!topSlot;
  const bar = (
    <div data-slot="voice-bar" data-placement={atTop ? "top" : "bottom"} className="shrink-0">
      <VoiceCallControls
        // One bar per call: a different call never inherits a hung-up bar's
        // exit animation state (P0.5d.1).
        key={`${call.card.id}:${call.thread.providerInteractionId ?? call.thread.id}`}
        // Bottom: on the page background, flush with the container's edges,
        // 8px above; animates up when a call starts. Top: stacked in the
        // left nav, 8px above the cards.
        className={
          atTop
            ? "bg-transparent px-0 pt-0 pb-2 animate-in fade-in-0 duration-200"
            : "bg-transparent px-0 pt-2 pb-0 animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
        }
        stacked={atTop}
        // Video isn't offered yet on either page.
        showAddVideo={false}
        {...controls}
        callStartTick={call.thread.startTick}
        holdStartTick={call.thread.heldSinceTick}
        customerLabel={call.card.customerName ?? call.thread.addressLabel ?? call.thread.value ?? call.card.id}
        {...rest}
      />
    </div>
  );
  return atTop ? createPortal(bar, topSlot!) : bar;
}
