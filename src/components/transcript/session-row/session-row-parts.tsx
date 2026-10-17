// Pieces of the session row that other surfaces reuse (P-EXTRACT: split out
// of agent-next-gen-transcript.tsx): the Session Details card, the transfer
// icon and the status pill with its dropdown.
import React from "react";
import { Button, Label, Menu, PanelHeader, Popover, Tag, WarningIconSolid } from "@nicecxone/lyra-ui";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { TRANSCRIPT_SESSION_STATUS_OPTIONS, TRANSCRIPT_SESSION_STATUS_VARIANT } from "../transcript-fixtures";
import type { TranscriptSession } from "../transcript-types";

/* ── TranscriptSessionDetails ──
   The "Session Details" card a session separator expands to (reference
   screenshot 2) — Contact ID/Date, Start/End, Channel/Skill, Agent/Status,
   two fields per row. Uses lyra-ui's own documented "Label Horizontal"
   pattern (`Input.stories.tsx`'s `LabelHorizontalWithSeparator` story: the
   real `Label` atom on the left, a plain `lyra-body-md text-lyra-fg-
   secondary` value span on the right, in one row) rather than `Input` —
   `Input` always stacks its label *above* the field, which read as a
   normal editable-looking form regardless of `readonly`, not the
   horizontal label/value row the reference screenshot shows. Same pattern
   minus that story's trailing `Separator` — explicitly no dividers between
   rows here, this card is one glanceable block, not a divided list. Two
   pairs per row via `.lyra-form-grid` (an existing lyra-tokens.css
   container-query family, not a bare Tailwind `grid-cols-2`) under a
   `lyra-form-grid-wrap` boundary, same mechanism `CustomerDetailTabContent`
   uses for its own 2-up field rows.

   Wrapped in the same neutral `rounded-lyra-md border border-lyra-border-
   subtle bg-lyra-bg-control-subtle` container CONTRIBUTING.md's "Composing
   panel body content" convention uses for a card-like block sitting inside
   a body area — the Overview tab's own "Latest Interaction" accordion uses
   the identical classes for the same reason (a block that reads as a
   distinct card, not flush against the transcript's own background). */
export function TranscriptSessionDetails({
  session,
  plain = false,
}: {
  session: TranscriptSession;
  /** Drops the card chrome (border/background/max-height scroll) and the
   *  internal "Session Details" heading below — for use as the BODY of an
   *  `InteriorPanel` that already supplies its own "Session Details" header
   *  and its own scroll container, rather than as an inline card embedded
   *  in the transcript (the original use this component still defaults to,
   *  `plain=false`, for anywhere else that might reuse it). Only the outer
   *  wrapper/heading are conditional — the field grid and fingerprint
   *  footer render identically either way. */
  plain?: boolean;
}) {
  const rows: Array<[string, string, string, string]> = [
    ["Contact ID", session.contactId, "Date", session.date],
    ["Start", session.startTime, "End", session.endTime],
    ["Channel", session.channel, "Skill", session.skill],
    ["Agent", session.agent, "Status", session.status],
  ];
  // "Chat fingerprint" footer (per explicit request/reference screenshot) —
  // `session.fingerprint` is populated for every channel now (see
  // `TranscriptSessionFingerprint`'s own doc comment), so this only reads
  // `undefined`/omits the footer for a session with no fingerprint data at
  // all (there currently isn't one, but the guard stays defensive).
  const fingerprintFields: Array<[string, string]> | undefined = session.fingerprint
    ? [
        ["OS", session.fingerprint.os],
        ["Browser", session.fingerprint.browser],
        ["Language", session.fingerprint.language],
        ["Device Type", session.fingerprint.deviceType],
        ["Application Type", session.fingerprint.applicationType],
      ]
    : undefined;
  return (
    // Per explicit request, capped to 225px with its own internal scroll
    // once content overflows that. Scroll/height live on THIS outer div,
    // deliberately kept separate from the inner `lyra-form-grid-wrap` div
    // below (rather than merged onto one element) — `lyra-form-grid-wrap`
    // sets `container-type: inline-size` (lyra-tokens.css) to drive the
    // `.lyra-form-grid` two-column container-query breakpoints, and
    // combining that containment context with `overflow-y-auto`/
    // `max-height` on the SAME element was clipping the fingerprint
    // footer (the row after `.map`) even while scrolled — a container-type
    // element establishes its own containment/formatting context, which
    // doesn't play well stacked with scroll-clipping on that exact box.
    // Two plain, single-purpose boxes avoids the interaction entirely.
    <div
      className={cn(
        !plain && "max-h-[225px] overflow-y-auto rounded-lyra-md border border-lyra-border-subtle bg-lyra-bg-control-subtle"
      )}
    >
      <div className={cn("flex flex-col gap-3 lyra-form-grid-wrap", !plain && "p-4")}>
        {!plain && <h3 className="lyra-body-md-emphasis text-lyra-fg-default">Session Details</h3>}
        {rows.map(([label1, value1, label2, value2]) => (
          <div key={label1} className="lyra-form-grid">
            <div className="flex items-center justify-between gap-4">
              <Label label={label1} />
              <span className="lyra-body-md text-lyra-fg-secondary">
                {value1}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label label={label2} />
              <span className="lyra-body-md text-lyra-fg-secondary">{value2}</span>
            </div>
          </div>
        ))}
        {fingerprintFields && (
          // Per explicit request: one single inline text flow, not the
          // two-per-row grid the fields above use — but wraps onto
          // additional lines rather than truncating to an ellipsis when it
          // doesn't fit on one line (an earlier version used `truncate`
          // here; per explicit follow-up request that hid fields when the
          // card narrowed, so this now just lets it wrap like normal text).
          // `border-t` sets this apart as the card's own footer, same
          // divider treatment `Popover`'s own footer slot elsewhere in this
          // file already uses between body content and a trailing row.
          <p className="border-t border-lyra-border-subtle pt-3 lyra-body-sm text-lyra-fg-secondary">
            {fingerprintFields.map(([label, value], i) => (
              <React.Fragment key={label}>
                {i > 0 && <span aria-hidden="true"> | </span>}
                <span className="lyra-body-sm-emphasis text-lyra-fg-default">{label}</span> {value}
              </React.Fragment>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}

/** Per explicit request ("update the consult/transfer icon to be 2 arrows
 *  like in screenshot 2") — was a Person + redirect-arrow composite,
 *  mirroring lyra-ui's own `ConsultTransferIcon` (channel-row.tsx), which
 *  got the identical swap; both now render Lucide's own `ArrowLeftRight`
 *  (two opposing horizontal arrows) directly, so this is a plain icon
 *  rather than a composed one, still recreated locally here since lyra-ui's
 *  copy stays a private, unexported helper in that file. */
export function TransferIcon() {
  return <ArrowLeftRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />;
}

/** Status pill + its Popover/Menu/"Close Contact?" confirm-view dropdown —
 *  extracted out of `TranscriptSessionSeparator`'s own status tag (which
 *  still uses this for its per-session row) so `AgentNextGenPage.tsx`'s
 *  record header can render the exact same control (Agent Workspace 2.0
 *  only — see that file's own `showChannelTabRow`/`showSessionActionCluster`
 *  doc comments) once the session row's own copy is hidden there, per
 *  explicit request, rather than hand-duplicating this ~100-line Popover a
 *  second time. Fully controlled, no state of its own — `menuOpen`/
 *  `menuView` (and their change handlers) are owned by whichever caller
 *  needs them: `InteractionTranscript`'s own per-session `statusMenuOpenId`/
 *  `statusMenuView` state for the session-row usage (only one status
 *  popover open across every session in a transcript at a time), a lone
 *  local `useState` pair for the header's single-instance usage. */
export function ChannelStatusTag({
  status,
  menuOpen,
  menuView,
  onMenuOpenChange,
  onSelectStatus,
  onConfirmClose,
  onCancelClose,
  disabled,
  className,
}: {
  status: string;
  menuOpen: boolean;
  menuView: "menu" | "confirm";
  onMenuOpenChange: (open: boolean) => void;
  /** A non-"Closed" status picked straight from the list — applies
   *  immediately and closes the popover. Picking "Closed" itself doesn't
   *  call this; see `onConfirmClose` below. */
  onSelectStatus: (status: string) => void;
  /** "Close" clicked on the confirm view — actually applies the "Closed"
   *  status and closes the popover. */
  onConfirmClose: () => void;
  /** "Cancel" clicked on the confirm view — closes the popover without
   *  changing anything. */
  onCancelClose: () => void;
  /** Locks the trigger once already "Closed" — same "no way back in from
   *  here" reasoning `TranscriptSessionSeparator`'s own `isClosed` doc
   *  comment covers. */
  disabled?: boolean;
  /** Merged onto the trigger `Button`'s own className — per explicit
   *  request (Agent Workspace 2.0 Phase 1 only), lets
   *  `TranscriptSessionSeparator`'s own `outcomeAfterStatus` reorder this
   *  tag via a flex `order-*` utility without moving any JSX. Omit to
   *  leave the trigger exactly as before. */
  className?: string;
}) {
  return (
    <Popover
      open={menuOpen}
      onOpenChange={onMenuOpenChange}
      placement="bottom"
      align="end"
      className="w-72"
      bodyPadding={menuView === "confirm"}
      header={
        menuView === "confirm" ? (
          <PanelHeader
            title="Close Contact?"
            icon={
              <WarningIconSolid
                className="h-5 w-5 text-lyra-status-critical-strong"
                aria-hidden="true"
              />
            }
            bordered={false}
            className="px-5 pb-0"
          />
        ) : undefined
      }
      footer={
        menuView === "confirm" ? (
          <div className="flex items-center justify-end gap-2 px-5 pb-4 pt-1">
            <Button variant="destructive" size="md" onClick={onConfirmClose}>
              Close
            </Button>
            <Button variant="outline" size="md" onClick={onCancelClose}>
              Cancel
            </Button>
          </div>
        ) : undefined
      }
      content={
        menuView === "confirm" ? (
          <p className="pb-2 pt-1 lyra-body-md text-lyra-fg-secondary">
            Closing a contact cannot be undone. Are you sure you want to close this contact?
          </p>
        ) : (
          <Menu
            bare
            items={TRANSCRIPT_SESSION_STATUS_OPTIONS.map((option) => ({
              id: option.label,
              label: option.label,
              active: option.label === status,
              icon: (
                <span
                  aria-hidden="true"
                  className="block h-2 w-2 rounded-full"
                  style={{ backgroundColor: option.dotColor }}
                />
              ),
              onClick: () => onSelectStatus(option.label),
            }))}
          />
        )
      }
    >
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={cn("h-auto shrink-0 rounded-full p-0 disabled:opacity-100", className)}
      >
        <Tag
          label={status}
          variant={TRANSCRIPT_SESSION_STATUS_VARIANT[status] ?? "neutral"}
          shape="pill"
          trailingIcon={
            !disabled && (
              <ChevronDown
                className={cn("transition-transform", menuOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            )
          }
        />
      </Button>
    </Popover>
  );
}
