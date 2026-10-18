import { createPortal } from "react-dom";
import { VoiceCallControls, type VoiceCallControlsProps } from "@/components/agent-next-gen-voice-call-controls";
import type { VoiceBarCall } from "./useVoiceBarCall";
import { CallSwitcher, callLabel } from "./CallSwitcher";
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
  /** How the bar renders where it is: "top" is the stacked bar at the top of
   *  the left nav (Settings → Voice controls location, while the nav is
   *  open), "bottom" the docked one. */
  placement?: "bottom" | "top";
  /** The page's stable host for the bar (`usePortalHost`): the bar always
   *  portals into it, and the page's `HostSlot`s move it between the left
   *  nav and the bottom, so moving never remounts the bar. Without one it
   *  renders in place. */
  host?: HTMLElement;
  /** Every call the agent has (live or held, `voiceBarCalls`). More than
   *  one: the customer label is the call switcher (k8 5). */
  calls?: readonly VoiceBarCall[];
  /** Selects a call's card (the switcher; selection only, never hold/resume). */
  onSelectCall?: (cardId: string) => void;
}

/** The persistent voice bar, shared by both pages (parity row 1): docked
 *  below the main container across the content column, outside any
 *  assignment's content, so it stays put whichever card or tab is showing.
 *  Pages pass only what differs (their transcript panel, hang-up cleanup). */
export function VoiceBar({ call, controls, placement = "bottom", host, calls = [], onSelectCall, ...rest }: VoiceBarProps) {
  const atTop = placement === "top";
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
        customerLabel={
          calls.length > 1 && onSelectCall ? <CallSwitcher calls={calls} current={call} onSelect={onSelectCall} /> : callLabel(call)
        }
        {...rest}
      />
    </div>
  );
  return host ? createPortal(bar, host) : bar;
}
