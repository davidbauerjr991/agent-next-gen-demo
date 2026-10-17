// The session row's left half (P-EXTRACT: split out of
// `TranscriptSessionSeparator`): channel, message count and address/contact
// id, then the "View Details"/"Session Details" link.
import { Button, SmsDirectionIcon, VoiceDirectionIcon, formatPhoneForDisplay } from "@nicecxone/lyra-ui";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TranscriptSessionSeparatorProps } from "./session-row-props";

type SessionDetailsLinkProps = Pick<
  TranscriptSessionSeparatorProps,
  "session" | "onViewDetails" | "messageCount" | "channelType" | "direction" | "compactHeader" | "showViewDetails" | "viewDetailsLabel"
>;

export function SessionDetailsLink({
  session,
  onViewDetails,
  messageCount,
  channelType,
  direction,
  compactHeader = false,
  showViewDetails = true,
  viewDetailsLabel = "View Details",
}: SessionDetailsLinkProps) {
  return (
          <div className="flex flex-wrap items-center gap-1.5 lyra-body-sm text-lyra-fg-secondary">
            {/* "# contactId · date" + "View Details" + the expand/collapse
                chevron — per explicit request, stays a real, always-
                toggleable `Button` regardless of `isClosed`: a closed
                session's own Session Details can still be opened/collapsed
                to review it, same as an open one — only the status chip/
                composer/etc. actually lock down once closed, not this.
                (Previously swapped to plain, non-interactive text here once
                `isClosed` — that's been removed.)

                Per a later explicit request, "View Details" is now real,
                always-visible text (a link-styled span, `text-lyra-fg-link`
                — same token `DesktopDesignsPage.tsx`'s own inline text link
                uses) between the date and the chevron, not just a hover
                tooltip — the `Tooltip` that used to carry this exact same
                string on hover was removed as redundant once the text
                itself is always on-screen. The "{n} Messages | # contactId ·
                date" portion is now its own inner `span` (its own
                `inline-flex items-center gap-1.5` to keep that internal
                spacing once it's no longer a set of direct flex children of
                the outer `Button`) so it can be hidden as one unit via
                `compactHeader` (that prop's own doc comment) — leaving just
                "View Details" + the chevron once the container narrows
                below 768px, which is the whole point: less content on this
                side means the right-hand action cluster has room to stay on
                this same row instead of wrapping under it. */}
            {/* The "{n} Messages | # contactId · date" cluster — shared
                between the interactive `Button` below (the normal case)
                and the plain, non-interactive `span` `showViewDetails`
                (this prop's own doc comment) falls back to once "View
                Details" itself is hidden — same content either way, just a
                different wrapper. */}
            {(() => {
              const dateCluster = (
                <span className={cn("inline-flex items-center gap-1.5", compactHeader && "hidden")}>
                  {/* Per explicit follow-up request ("add the channel type
                      to the summary row at the left (voice, sms, webchat,
                      chat, whatsapp, etc.)") — `session.channel` is already
                      a real, populated display label on every session
                      this row ever renders (`freshSessionChannelLabel`/the
                      historical mock arrays all set it), so this just
                      surfaces it rather than adding a new field. Grouped
                      inside this same collapsible span (not a separate
                      always-visible one) so it hides together with the
                      rest of this cluster under `compactHeader`, same
                      reasoning as every other piece here. */}
                  {/* Direction icon — per explicit request (Agent Workspace
                      2.0 Phase 1 & Phase 2 only): voice/sms sessions get a
                      `VoiceDirectionIcon`/`SmsDirectionIcon` (lyra-ui,
                      channel-row.tsx) right before the text label, the same
                      icon Contact History/`InteractionNavItem` render for
                      this same channel. Every other `channelType` (and
                      voice/sms with no `channelType`/`direction` passed at
                      all) renders no icon here, exactly as before this
                      feature existed. */}
                  {channelType === "voice" && (
                    <VoiceDirectionIcon direction={direction} className="h-3 w-3" />
                  )}
                  {channelType === "sms" && (
                    <SmsDirectionIcon direction={direction} className="h-3 w-3" />
                  )}
                  <span>{session.channel}</span>
                  <span aria-hidden="true">|</span>
                  {messageCount != null && (
                    <>
                      <span>{messageCount} Message{messageCount === 1 ? "" : "s"}</span>
                      <span aria-hidden="true">|</span>
                    </>
                  )}
                  {/* Per explicit request ("display the number in the
                      session row instead of the contact ID — display
                      email/whatsapp handle/etc. for phase 2"):
                      `session.addressLabel` (set from the live channel's
                      own `Thread.addressLabel` — already a generic "phone
                      number/email address/WhatsApp handle" string, so this
                      one field covers every channel type with no extra
                      per-type branching needed) takes over from the "#
                      contactId" display whenever it's known. The bare "#"
                      glyph only makes sense ahead of an actual ID, not a
                      phone number/email/handle, so it's dropped along with
                      `contactId` rather than kept as a stray leading
                      character. Falls back to the exact original "#
                      contactId" display whenever no address is known
                      (every historical mock session, an ad-hoc/redialed
                      channel with nothing stored) — see `TranscriptSession.
                      addressLabel`'s own doc comment. */}
                  {session.addressLabel ? (
                    <>
                      {/* `formatPhoneForDisplay` normalizes this regardless
                          of whether the raw `Thread.addressLabel` this came
                          from was ever actually formatted upstream — a
                          no-op for a non-phone-shaped address
                          (email/WhatsApp handle), see that function's own
                          doc comment. */}
                      <span>{formatPhoneForDisplay(session.addressLabel)}</span>
                      {/* Per explicit request: the trailing slot after the
                          address now shows the Contact ID instead of the
                          date — the date no longer appears in this summary
                          row at all (it's still shown in the expanded
                          Session Details panel, see
                          `TranscriptSessionDetails`). Only rendered
                          here when `addressLabel` is set — when it isn't,
                          the contactId is already the leading slot (else
                          branch below), so repeating it here would just
                          duplicate it. */}
                      <span aria-hidden="true">·</span>
                      <span aria-hidden="true">#</span>
                      <span>{session.contactId}</span>
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">#</span>
                      <span>{session.contactId}</span>
                    </>
                  )}
                </span>
              );
              return showViewDetails ? (
                <Button
                  variant="ghost"
                  onClick={onViewDetails}
                  // Same `hover:bg-transparent active:bg-transparent`
                  // override as the status-tag `Button`, and for the
                  // same reason — the wrapping pill div owns the one,
                  // whole-pill hover now.
                  className="h-auto shrink-0 gap-1.5 p-0 hover:bg-transparent active:bg-transparent lyra-body-sm text-lyra-fg-secondary"
                >
                  {dateCluster}
                  {/* Divider between the date cluster and "View Details" —
                      same plain "|" glyph this row already uses for the
                      messageCount/contactId divider above, for visual
                      consistency. Hidden together with the date cluster
                      under `compactHeader` (rather than its own separate
                      condition) since it only means anything as a
                      separator BETWEEN two visible things — once the date
                      cluster hides, there's nothing left of "View Details"
                      for a leading divider to separate it from. */}
                  {!compactHeader && <span aria-hidden="true">|</span>}
                  {/* Per explicit follow-up request, Phase 1 (Advanced)
                      only ("rename the view details link 'Session
                      Details'") — `viewDetailsLabel` (default "View
                      Details") lets that one tier's own label read
                      "Session Details" without touching Premium/Agent
                      Workspace 2.0's identical link. Everything else about
                      this link (styling, the external panel it opens via
                      `onViewDetails`, the `showViewDetails`/`compactHeader`
                      gating above) is unchanged. Every doc comment
                      elsewhere still says "View Details" when describing
                      this feature's own history — left as-is, since
                      they're accurately describing what was true when
                      written, not the current label. */}
                  <span className="text-lyra-fg-link hover:underline">{viewDetailsLabel}</span>
                  {/* Static now — was a `ChevronDown`/`ChevronRight` toggle
                      mirroring the old inline-expand `open` state; "View
                      Details" is a one-way navigation trigger now (opens an
                      external panel), not an expand/collapse control, so a
                      single non-animating disclosure chevron is the correct
                      affordance. */}
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
                </Button>
              ) : (
                <span className="inline-flex h-auto shrink-0 items-center gap-1.5 p-0 lyra-body-sm text-lyra-fg-secondary">
                  {dateCluster}
                </span>
              );
            })()}
          </div>
  );
}
