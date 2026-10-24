import { VoiceBar, voiceBarCalls } from "@/contact-handling";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { MARCUS_WEBB_ID } from "@/contact-handling/scenario-cases";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { initialsFor } from "@/components/agent-next-gen-shared-utils";
import { useActiveTranscriptMenu } from "./useActiveTranscriptMenu";

/** The live call's voice bar and its bottom host slot (P-EXTRACT C8, from the
 *  page). The bar portals into `voiceBarHost`, whichever slot holds it. */
export function WorkspaceVoiceBar() {
  const {
    addToast, contactCommands, interactions, isViewingLiveVoiceCallInteraction,
    liveVoiceCallControls, liveVoiceCallInteraction, liveVoiceCallInteractionIsRealCustomer, liveVoiceCallThread,
    marcusWebbReviewing, scenarioKeyOf,
    setVoiceVideoFullScreen, setVoiceVideoWindowOpen, switchActiveInteraction, voiceBarCall,
    voiceBarCallOf, voiceBarHost, voiceNavSlotMounted, voiceSettings, voiceVideoWindowOpen,
  } = useWorkspace();
  const transcriptMenu = useActiveTranscriptMenu(liveVoiceCallInteraction ?? undefined, liveVoiceCallThread ?? undefined);
  return (
    <>
          {voiceBarCall &&
          liveVoiceCallInteraction &&
          liveVoiceCallThread &&
          !(marcusWebbReviewing && scenarioKeyOf(liveVoiceCallInteraction.id) === MARCUS_WEBB_ID) ? (
            // The shared voice bar (VoiceBar, same as Desk): placement,
            // look, which call, and the provider's Hold/Mute/Record/Mask/
            // Keypad come from it; this page passes its own panels.
            <VoiceBar
              call={voiceBarCall}
              // More than one call: the label is a switcher; choosing selects that card (k8 5).
              calls={voiceBarCalls(interactions, voiceBarCallOf)}
              onSelectCall={switchActiveInteraction}
              controls={liveVoiceCallControls}
              // Settings → Voice controls location; the slot at the top of
              // the left nav exists only while the nav is open. The bar
              // portals into one host either way, so moving never remounts it.
              placement={voiceSettings.controlsLocation === "top" && voiceNavSlotMounted ? "top" : "bottom"}
              host={voiceBarHost}
              onHangUp={() => {
                setVoiceVideoWindowOpen(false);
                setVoiceVideoFullScreen(false);
                // Every call, scripted ones included (P0.5c), ends through
                // `end()`. Once it's in wrap-up the call's card shows its
                // inline wrap-up card, and the main column stays on whatever
                // the agent is viewing (P0.5d.1).
                contactCommands.hangUp(liveVoiceCallThread);
              }}
              onAddToast={addToast}
              transcriptMenu={transcriptMenu}
              onToggleVideo={
                isViewingLiveVoiceCallInteraction
                  ? () =>
                      setVoiceVideoWindowOpen((v) => {
                        const next = !v;
                        if (!next) setVoiceVideoFullScreen(false);
                        return next;
                      })
                  : undefined
              }
              videoOpen={isViewingLiveVoiceCallInteraction && voiceVideoWindowOpen}
              // Per explicit follow-up request/reference screenshot ("add
              // the customer avatar. Add the name / number/email above the
              // timer"): same fallback order `activeUnknownContactIdentifier`
              // above already uses for "whatever we can display for this
              // customer" — a real name first, then the human-readable
              // address, then the raw dialed/typed value, then this card's
              // own stable id as the last resort (there's always SOME
              // string). `customerInitials` is intentionally left unpassed
              // here — deriving real initials would duplicate lyra-ui's own
              // unexported `getInitials` (interaction-nav-item.tsx) rather
              // than reuse it, so for now every live call shows the generic
              // white `User` fallback glyph the component already falls
              // back to without it, matching the reference screenshot's own
              // unmatched-quickdial-number example. Per explicit follow-up
              // request ("avatars within the contact and call details
              // should be the initials of the customer OR a customer
              // avatar if no customer name is known"): now reuses this
              // file's own `initialsFor` (already imported for the current
              // agent's own avatar, above) the same way
              // `buildCustomerContextOverviewInfo` derives
              // `customerCard.avatarInitials` — gated on
              // `liveVoiceCallInteractionIsRealCustomer` (just above) so an
              // unidentified/ad-hoc caller's raw dialed number still falls
              // back to the generic glyph instead of nonsense initials
              // derived from digits.
              customerInitials={
                liveVoiceCallInteractionIsRealCustomer && liveVoiceCallInteraction.customerName
                  ? initialsFor(liveVoiceCallInteraction.customerName)
                  : undefined
              }
            />
          ) : null}
          {/* The voice bar's bottom slot (`voiceBarHost`), unless the left nav's holds it. */}
          <HostSlot host={voiceBarHost} active={!(voiceSettings.controlsLocation === "top" && voiceNavSlotMounted)} data-slot="voice-bar-bottom" />
    </>
  );
}
