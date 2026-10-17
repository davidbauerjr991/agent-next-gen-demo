// `TranscriptSessionSeparator`'s props (P-EXTRACT: split out of
// agent-next-gen-transcript.tsx with the session row).
import type React from "react";
import type { ChannelDirection, ChannelOutcomeConfig, ChannelType } from "@nicecxone/lyra-ui";
import type { TranscriptSession } from "../transcript-types";

export interface TranscriptSessionSeparatorProps {
  session: TranscriptSession;
  /** Per explicit request, "View Details" no longer expands this session's
   *  own `TranscriptSessionDetails` inline below (the old `open`/`onToggle`
   *  boolean pair this replaces) — it now opens an external `InteriorPanel`
   *  instead (`InteractionTranscript`'s own `onViewSessionDetails` prop,
   *  which each page threads to a real "Session Details" panel, or, for
   *  voice, a tab on the existing "Transcript" panel — see that prop's own
   *  doc comment). This component owns no open/closed state of its own
   *  anymore for this row; it's just a trigger.
   *
   *  Per further explicit follow-up request ("View Details should no
   *  longer toggle the panel open closed but just display the details in
   *  the side panel"): each caller's own handler behind this no longer
   *  closes an already-open panel showing this same session — it always
   *  opens (or stays open on) the panel and shows this session's details,
   *  full stop. The toggle-open/closed behavior moved to the new
   *  `onToggleDetailsPanel` button below instead. */
  onViewDetails: () => void;
  /** Per explicit follow-up request ("customer information, details and
   *  customer summary are all opening in separate panels, they should all
   *  open in one side panel and just replace the current information...
   *  you may need to add a panel icon button to the right of the outcome /
   *  dismiss and unassign buttons in the session row"): a new icon button,
   *  right of Unassign & Dismiss/Delete Draft. Per explicit follow-up
   *  request ("this should say 'Open Details Panel' and just open/close -
   *  the panel not list the options. View Details should no longer toggle
   *  the panel open closed but just display the details in the side
   *  panel"): this used to open a small menu offering a choice of
   *  destinations (Session Details/Customer Information/AI Summary) — that
   *  menu is gone. This is now a single plain toggle: the caller's own
   *  open/closed boolean for the whole Details panel, flipped as-is,
   *  regardless of WHICH content that panel currently shows (this button
   *  has no opinion on that — same "just report the click, no opinion on
   *  what it means" split `onViewDetails` already draws). `onViewDetails`
   *  itself (above) is no longer a toggle either — see its own doc comment
   *  — so this button is now the ONLY thing on a session row that can
   *  close an already-open panel. Omit to skip rendering the button
   *  entirely (nothing else about this row changes either way). */
  onToggleDetailsPanel?: () => void;
  /** Per explicit follow-up request ("hide the toggle icon button when the
   *  session details are open"): hides the `onToggleDetailsPanel` button
   *  above entirely while the caller's Details panel is already open,
   *  rather than leaving it sitting there only able to close the very panel
   *  it's rendered inside the row of — the panel itself is now this row's
   *  own "session details are open" indicator, so the button stays out of
   *  the way until there's actually something for it to open again.
   *  Reflects the caller's real open/closed state (the same state
   *  `onToggleDetailsPanel` flips). Defaults `false`, so a caller that
   *  hasn't wired its own open state through here yet still renders the
   *  button exactly as before, unconditionally, whenever
   *  `onToggleDetailsPanel` is provided. */
  detailsPanelOpen?: boolean;
  /** Per explicit bug report ("when you moved the session detail panel
   *  toggle to the session row line you lost the overlay of the session
   *  details panel itself — now it just shows a tooltip"): before the move,
   *  hovering the record header's own Customer Information toggle showed a
   *  rich preview `Popover` (`CustomerInfoHoverPreview`, still live in
   *  `AgentNextGenPage.tsx`) of the panel's own content, not just a plain
   *  text tooltip — that hover-preview never got carried over when this
   *  button relocated into the session row. Restores the same idea here:
   *  supply this button's own Details-panel content (whatever the caller's
   *  real docked panel would show) and hovering (or focusing) the button
   *  now pops it open right below the button, exactly as before. Omit to
   *  keep the old plain-tooltip-only behavior (nothing else about this row
   *  changes either way) — e.g. a caller with no equivalent preview content
   *  ready to hand over. The caller owns open/close timing itself (see
   *  `detailsPanelPreviewOpen`/`onDetailsPanelPreviewHoverStart`/
   *  `onDetailsPanelPreviewHoverEnd` below), same "parent owns the hover
   *  timer, child just reports hover in/out" split
   *  `CustomerInfoHoverPreview`'s own former call site used. */
  detailsPanelPreviewContent?: React.ReactNode;
  /** Whether `detailsPanelPreviewContent` above is currently showing —
   *  purely a controlled reflection of the caller's own hover-preview state
   *  (see that prop's own doc comment); this component owns none of the
   *  open/close timing itself. Defaults `false`, so a caller that hasn't
   *  wired the preview through yet renders exactly as before. */
  detailsPanelPreviewOpen?: boolean;
  /** Fired on hover-in (`onMouseEnter`) or keyboard focus (`onFocus`) of the
   *  "Open Details Panel" button — the caller's own cue to open
   *  `detailsPanelPreviewContent` (typically after clearing any pending
   *  close timer, same "open immediately" half of the hover-intent pattern
   *  `CustomerInfoHoverPreview`'s own former trigger used). No-op (button
   *  still renders as a plain tooltip-only toggle) when
   *  `detailsPanelPreviewContent` is omitted. */
  onDetailsPanelPreviewHoverStart?: () => void;
  /** Fired on hover-out (`onMouseLeave`) or blur (`onBlur`) of the same
   *  button — the caller's own cue to schedule closing the preview (a short
   *  delay, so the pointer can cross into the portaled preview content
   *  itself without it flickering shut — see `CustomerInfoHoverPreview`'s
   *  own former close handler for the exact shape). Receives the raw
   *  mouse/focus event so a caller that needs to inspect `relatedTarget`
   *  (e.g. to not close into its own nested overflow menu) still can. */
  onDetailsPanelPreviewHoverEnd?: (e: React.MouseEvent | React.FocusEvent) => void;
  /** This session's own message (chat bubble) count — shown as "{n}
   *  Messages | " right before "# contactId · date", same "Messages | #id"
   *  format `ChannelTab`'s own tooltip line already uses (channel-row.tsx)
   *  for the identical fact. Omit entirely (not `0`) for a channel with no
   *  real per-message transcript to count — Voice/Email's sessions only
   *  ever hold a placeholder `messages: []` (see `TRANSCRIPT_SESSIONS_VOICE`/
   *  `_EMAIL`'s own doc comment), so "0 Messages" there would misreport a
   *  call/email as an empty chat rather than just not applying. Only passed
   *  for chat/SMS/WhatsApp (`InteractionTranscript`'s own call site checks
   *  `channelType`), where `messages.length` is a real, meaningful count. */
  messageCount?: number;
  /** Whether THIS session's status popover is the one currently open —
   *  `InteractionTranscript`'s `statusMenuOpenId` only ever names one
   *  session at a time, same pattern as `tagPickerOpenId` for message tag
   *  pickers. */
  statusMenuOpen: boolean;
  /** Which body the (currently open) popover shows: the Open/Pending/
   *  Escalated/Resolved/Closed list, or the "Close Contact?" confirm.
   *  Meaningless while `statusMenuOpen` is false. */
  statusMenuView: "menu" | "confirm";
  onStatusMenuOpenChange: (open: boolean) => void;
  /** A non-"Closed" status was picked straight from the list — applies
   *  immediately and closes the popover. Picking "Closed" itself doesn't
   *  call this; see `onConfirmClose` below. */
  onSelectStatus: (status: string) => void;
  /** "Close" clicked on the confirm view — actually applies the "Closed"
   *  status and closes the popover. */
  onConfirmClose: () => void;
  /** "Cancel" clicked on the confirm view — closes the popover without
   *  changing anything (the status stays whatever it was before "Closed"
   *  was picked from the list). */
  onCancelClose: () => void;
  /** Real Consult/Transfer + Outcome buttons, floated right of the "#
   *  contactId · date" pill — per explicit request. Only meaningful/passed
   *  for the CURRENT session (`InteractionTranscript`'s `lastSessionId`)
   *  since it's the same live `ChannelOutcomeConfig` shape (and, via
   *  `resolution`/`onResolutionChange`, the exact same underlying value)
   *  the LeftNav's own `ChannelRow` Outcome button already uses for this
   *  same channel — opening either one shows the identical popover/draft.
   *  Historical sessions get the Transfer icon too (purely decorative,
   *  same as everywhere else in this app — see rule #30) but no working
   *  Outcome popover, since there's no real per-historical-session outcome
   *  state to back one. */
  outcome?: ChannelOutcomeConfig;
  /** Real "Unassign & Dismiss" button, immediately right of the status tag
   *  — per explicit request. Same "current session only" scoping as
   *  `outcome` above (see `InteractionTranscript`'s own `onDismissChannel`
   *  doc comment): a historical session has no live channel left to
   *  dismiss, so this is `undefined` there and the button doesn't render
   *  at all (no decorative/disabled version — unlike Transfer, this is a
   *  real destructive action, not a static icon, so there's nothing
   *  meaningful to show non-functionally). */
  onDismiss?: () => void;
  /** True once the whole CHANNEL/interaction this session belongs to reads
   *  as closed/read-only — same union of conditions `InteractionTranscript`'s
   *  own `dimmed` prop is already built from (`Interaction.closed` OR
   *  this channel's own `threadStatuses` entry reading "Closed" — see that
   *  prop's own doc comment for the full picture). */
  channelClosed?: boolean;
  /** True only for the CURRENT session — `InteractionTranscript`'s own
   *  `lastSessionId` check, passed down rather than re-derived here. Per
   *  explicit request/bug report: `isClosed` below used to read THIS
   *  session's own `status` field ("Closed" or not) instead of this — a
   *  real, confirmed bug, since a Thread can accumulate more than one
   *  historical session whose own logged status was never literally
   *  "Closed" (e.g. two "Resolved" mock sessions stacked in
   *  `TRANSCRIPT_SESSIONS`), which showed as two simultaneously "open"
   *  looking rows, both with a seemingly-live Consult/Transfer + Outcome
   *  cluster. There should never be more than one non-Closed session in a
   *  Thread — only the current one is ever actually live — so `isClosed`
   *  now derives purely from POSITION (is this the current session, or
   *  not) rather than trusting each session's own possibly-stale `status`
   *  field. See `InteractionTranscript`'s own `getSessionStatus` for the
   *  matching fix on the DISPLAYED status label (every non-current session
   *  now always reads "Closed", regardless of what it was logged with). */
  isCurrentSession: boolean;
  /** Per explicit request (Agent Workspace 2.0 only — see
   *  `AgentNextGenPage.tsx`'s own `showSessionActionCluster` doc comment at
   *  its `InteractionTranscript` call site): once that record header grew
   *  its own icon-button cluster covering these exact same actions (plus a
   *  relocated copy of the status tag itself), this row's own copy became
   *  redundant. Defaults `true` (Premium/Advanced, and every other call
   *  site, keep the cluster exactly as before — only the one 2.0 call site
   *  threads `false` through). */
  showActionCluster?: boolean;
  /** Hides just the "Add Participant" and "Consult / Transfer" icon
   *  buttons within this cluster, leaving the status tag, Outcome, and
   *  "Unassign & Dismiss" untouched — per explicit request (Agent Workspace
   *  2.0 Phase 1 only). Independent of `showActionCluster` above (which
   *  hides the whole cluster): a consumer can hide just these two buttons
   *  while keeping everything else in the cluster exactly as before.
   *  Default `true` (every other call site keeps both buttons). */
  showConsultTransferAndAddParticipant?: boolean;
  /** Hides just the "More Options" kebab (Send/Download Transcript,
   *  Translate Messages) within this cluster, leaving the status tag,
   *  Consult/Transfer, and Outcome untouched — per explicit request (Agent
   *  Workspace 2.0 Phase 1 only). Independent of `showActionCluster` and
   *  `showConsultTransferAndAddParticipant` above. Default `true` (every
   *  other call site keeps the kebab). */
  showKebabMenu?: boolean;
  /** Reorders just this session row's Outcome button to render AFTER the
   *  status tag (and, once a session reads "Closed," after the collapse/
   *  expand chevron and Unassign & Dismiss/close button too — this moves
   *  Outcome to the very end of the visible cluster) — via flex `order-*`
   *  utilities on each element, not by physically reordering the JSX, so
   *  every element's OWN gating logic (isClosed/isNewThread/etc., right
   *  above each one) stays untouched. Per explicit request (Agent
   *  Workspace 2.0 Phase 1 only). Default `false` (every other call site
   *  keeps Outcome in its original, leading position). */
  outcomeAfterStatus?: boolean;
  /** Hides just the "Add Participant" icon button within this cluster,
   *  leaving Consult/Transfer, the status tag, Outcome, and "Unassign &
   *  Dismiss" untouched — per explicit follow-up request (Advanced only).
   *  ANDed with `showConsultTransferAndAddParticipant` above (both must be
   *  true for Add Participant to render) rather than a replacement for it,
   *  so 2.0 Phase 1's existing "hide both together" usage is unaffected.
   *  Default `true` (every other call site keeps Add Participant). */
  showAddParticipant?: boolean;
  /** Per explicit follow-up request (Advanced only, same request as
   *  `showAddParticipant` above): hides the standalone "Consult / Transfer"
   *  icon button and instead adds a "Consult / Transfer" row to the kebab
   *  ("More Options") menu just below, reusing the same `TransferIcon` and
   *  sitting first in that menu's item list. Purely decorative/unwired,
   *  same as the standalone button it replaces (see that button's own doc
   *  comment/rule #30) — clicking it does nothing yet either. Has no effect
   *  while `showKebabMenu` is false (nowhere to add the row to) or while
   *  `showConsultTransferAndAddParticipant` is false (Transfer already
   *  hidden outright). Default `false` (every other call site keeps
   *  Transfer as its own standalone icon). */
  transferInKebabMenu?: boolean;
  /** Reorders this session row's status tag, kebab, and Outcome button to
   *  render in that exact sequence (status tag first, then kebab, then
   *  Outcome) — via flex `order-*` utilities on each element, same
   *  technique `outcomeAfterStatus` above already uses, not by physically
   *  reordering the JSX, so every element's own gating logic stays
   *  untouched. Collapse/Unassign & Dismiss/"Open Details Panel" keep
   *  their existing relative order, just pushed after Outcome. Independent
   *  of `outcomeAfterStatus` above (which only reorders status-then-
   *  outcome, leaving the kebab in its default position) — the two are
   *  never combined at the same call site today, but use distinct `order-*`
   *  values regardless so nothing would collide if they ever were. Per
   *  explicit follow-up request (Advanced only). Default `false` (every
   *  other call site keeps this cluster in its original DOM order). */
  statusAndKebabBeforeOutcome?: boolean;
  /** Locks the status tag, kebab, and Outcome button — visibly present but
   *  non-interactive (`disabled`), NOT hidden — while leaving everything
   *  else in this row (including "Open Details Panel") untouched. Distinct
   *  from `isClosed` (below), which additionally hides Consult/Transfer/
   *  Add Participant/Unassign & Dismiss entirely for a session that's
   *  genuinely over; this is for a temporary, still-open state where the
   *  agent just shouldn't be able to change status/outcome/reach kebab
   *  actions yet — e.g. while reviewing an AI agent's still-live
   *  conversation before deciding whether to take it over. Per explicit
   *  request. Default `false` (every other call site is unaffected). */
  controlsReadOnly?: boolean;
  /** Hides the status pill when the provider doesn't store case status
   *  (hide, don't disable — P0.5d.1). Default `true`. */
  showStatus?: boolean;
  /** This channel's real, typed channel — passed straight through from
   *  `InteractionTranscript`'s own `channelType` prop (one instance renders
   *  every historical session for a single channel, so this is the same
   *  value for all of them). Only actually used to pick an icon (voice/sms
   *  — see `direction` right below) next to the `session.channel` display
   *  label already rendered in the date cluster; every other channel type
   *  renders that label with no icon at all, same as before this feature
   *  existed. Per explicit request (Agent Workspace 2.0 Phase 1 & Phase 2
   *  only) — omit entirely to render with no icon, exactly as before. */
  channelType?: ChannelType;
  /** Whether this channel was customer-initiated ("inbound") or agent-
   *  initiated ("outbound") — passed straight through from
   *  `InteractionTranscript`'s own prop of the same name. Combined with
   *  `channelType` right above to render `VoiceDirectionIcon`/
   *  `SmsDirectionIcon` (lyra-ui, channel-row.tsx) next to the
   *  `session.channel` label — the exact same icon treatment Contact
   *  History and `InteractionNavItem` use for this same channel, so all
   *  three surfaces read as one consistent system. Per explicit request
   *  (Agent Workspace 2.0 Phase 1 & Phase 2 only) — omit to render with no
   *  icon, exactly as before. */
  direction?: ChannelDirection;
  /** True for a brand-new, agent-initiated OUTBOUND thread with no real
   *  history yet (`Interaction.startedFresh` — passed straight through
   *  from `InteractionTranscript`'s own prop of the same name; see that
   *  prop's own doc comment for the full "outbound vs. customer-initiated"
   *  reasoning). Per explicit request: a thread in this state hasn't
   *  earned Consult/Transfer, Outcome, or Unassign & Dismiss yet — there's
   *  no one to transfer to, no outcome to log, and nothing to unassign
   *  from — so all three are hidden here (current session only; a
   *  historical session already hides them via `isClosed`, `isNewThread`
   *  doesn't change that). The status tag stays (still meaningful — a
   *  fresh thread is genuinely "Open", not blank), and in place of the
   *  red Unassign & Dismiss button, a red trash-icon "Delete Draft" button
   *  takes over `onDismiss`'s wiring — same delete-draft markup lyra-ui's
   *  own `ChannelRow`/`ChannelTab` already fall back to once THEIR kebab is
   *  similarly hidden (`removable`/`removeVariant`/`showMenu`, channel-
   *  row.tsx), reused here for visual consistency across all three "new
   *  thread" surfaces.
   *  Per an explicit clarifying follow-up, only ever `true` for outbound —
   *  a new thread opened BY the customer keeps the full normal cluster,
   *  same as any other live thread with real history. Defaults `false`;
   *  every existing call site is unaffected until `InteractionTranscript`
   *  starts threading a real value through. */
  isNewThread?: boolean;
  /** Whether this CLOSED session's transcript content — this session's own
   *  message bubbles, rendered by `InteractionTranscript` as a sibling of
   *  this whole component, not a child of it — is currently collapsed
   *  away. Purely a display flag here: this component owns no message
   *  content itself, so `collapsed` only drives which icon
   *  (`ChevronsDownUp`/`ChevronsUpDown`) the collapse button next to the
   *  status tag shows; `InteractionTranscript` is what actually animates
   *  its own message-content wrapper open/shut off this same session's
   *  `collapsedSessionIds` entry. */
  collapsed?: boolean;
  /** Toggles `collapsed` for this session. Passing this is what renders the
   *  collapse icon at all, immediately right of the status tag — same
   *  "which direction does the next click applies" idiom lyra-ui's own
   *  `AssignmentsExpandCollapseAllButton` uses. Only ever shown for a
   *  session whose status reads "Closed" (`session.status`, via
   *  `InteractionTranscript`'s own `getSessionStatus`) — an in-progress
   *  session has nothing to collapse away yet. */
  onToggleCollapsed?: () => void;
  /** Per explicit request: below 768px of the transcript's own container
   *  width, the left-hand "{n} Messages | # contactId · date" cluster hides
   *  entirely, leaving only "View Details" + the expand/collapse chevron —
   *  the goal being to keep the right-hand action cluster (Consult/
   *  Transfer, Outcome, status tag, Unassign & Dismiss) pinned on the same
   *  row instead of wrapping onto its own line (`flex-wrap` on the row
   *  above) as the container narrows. `InteractionTranscript`'s own call
   *  site passes its already-measured `transcriptBubbleFullWidth` (see that
   *  state's own doc comment — the SAME `<768px` ResizeObserver reading
   *  the chat-bubble-width breakpoint already uses, off the same scroll
   *  container this row lives in) rather than this component measuring its
   *  own width a second time. Defaults `false` — every other call site (if
   *  any are ever added) keeps the full label. */
  compactHeader?: boolean;
  /** Suppresses this separator's own trailing bottom fade (see that div's
   *  doc comment for what it normally does). Only ever needed
   *  for a session whose FIRST piece of scrolling content underneath is
   *  the `ContactOverview` block (`InteractionTranscript`'s own
   *  `contactOverview` prop) — that block sits flush against this
   *  separator, so the fade's `-bottom-8` band was painting straight over
   *  its "Contact Overview" heading instead of just softening real
   *  message bubbles further down. Every other session (fade landing on
   *  actual messages, which is the whole point) leaves this `false`. */
  hideFade?: boolean;
  /** Per explicit request: the "Transcript" tab of voice's own combo
   *  "Session Details"/"Transcript" `InteriorPanel` renders a second,
   *  nested `InteractionTranscript` instance (see that panel's own render
   *  site) — its own session rows no longer need a "View Details" trigger,
   *  since clicking it would just jump to the SAME panel's own "Details"
   *  tab, one tab over from where the agent already clicked from. `false`
   *  there (via `InteractionTranscript`'s own `showViewDetails` prop)
   *  drops the "View Details" text + chevron entirely, leaving the plain
   *  "{n} Messages | # contactId · date" cluster as inert (non-`Button`)
   *  text — every other call site keeps the default `true`. */
  showViewDetails?: boolean;
  /** Per explicit follow-up request, Phase 1 (Advanced) only ("rename the
   *  view details link 'Session Details'") — overrides this link's own
   *  text. Defaults to "View Details", unchanged for every other consumer
   *  (Premium, Agent Workspace 2.0) that doesn't pass this. */
  viewDetailsLabel?: string;
  /** Per explicit request ("move the session row into the page header
   *  container so when the details are opened they look like the attached
   *  screenshot, instead of overlaying the session row"): when a real DOM
   *  node is passed, this row's entire rendered content (the "{n} Messages
   *  | # contactId · date | View Details" cluster AND the Consult/
   *  Transfer/Outcome/status-tag/Unassign & Dismiss cluster alongside it)
   *  is rendered via `createPortal` into THAT node instead of inline here
   *  — physically relocating it out of the scrollable transcript column
   *  (and out from underneath the "Session Details" `InteriorPanel`, which
   *  shares that same column and outranks this row's own `z-[1]` sticky
   *  separator with its own `z-[3]`, hence "overlaying") and into the
   *  record header's own container instead, which sits structurally
   *  outside/above that whole column and is never covered by the panel
   *  regardless of z-index. The caller (each tier page) renders a plain,
   *  unstyled `<div ref={...}>` inside its own record header for this to
   *  portal into, and threads the resulting node down through
   *  `InteractionTranscript`'s own `sessionRowPortalTarget` prop (see that
   *  prop's own doc comment) — only ever supplied for the CURRENT session
   *  at that call site, so a historical session (if one somehow renders)
   *  is unaffected. Omit (the default, every other tier/call site) to
   *  render this row inline exactly as before — this component has zero
   *  behavior change with no target supplied. */
  portalTarget?: HTMLElement | null;
}
