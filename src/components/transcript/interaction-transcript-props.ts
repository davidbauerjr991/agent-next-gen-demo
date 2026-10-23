// `InteractionTranscript`'s props (P-EXTRACT: split out of agent-next-gen-transcript.tsx).
import type React from "react";
import type { ChannelDirection, ChannelType, ContactOverviewInfo } from "@nicecxone/lyra-ui";
import type { TranscriptMessage, TranscriptSession } from "./transcript-types";

export interface InteractionTranscriptProps {
  /** Which channel's content to show — see this component's own doc
   *  comment above. Undefined (no active interaction/channel yet) renders
   *  the same as SMS/WhatsApp. */
  channelType?: ChannelType;
  /** Inbound/outbound direction of the active channel (`Thread.direction`) —
   *  forwarded to each `TranscriptSessionSeparator`'s direction-aware
   *  voice/SMS icon. Undefined renders the plain, direction-less icon. */
  direction?: ChannelDirection;
  /** Real customer name to substitute for every customer-sender message's
   *  hardcoded mock name in the SMS/WhatsApp transcript — see this
   *  component's own doc comment above. (Also briefly shown at the far
   *  left of every `TranscriptSessionSeparator` row alongside the active
   *  channel's own address, gated on the Customer Information panel being
   *  closed — dropped from there for good once that panel permanently
   *  docked to the right of the page, as redundant with it; this
   *  message-substitution use is unaffected.) */
  customerName?: string;
  /** Whether `customerName` above is an actual identified customer, as
   *  opposed to a raw, unidentified address standing in for one (a dialed
   *  number, a typed email/SMS/WhatsApp handle with no directory match) —
   *  same distinction `InteractionNavItem`'s own `customerIdentified` prop
   *  makes for the compact LeftNav tile's avatar (see that prop's own doc
   *  comment, lyra-ui). Per explicit bug report, with a screenshot of a
   *  message bubble showing a bare "4" avatar for an unidentified SMS
   *  number: every customer-sender message bubble (`TranscriptMessageBubble`)
   *  and the "customer is typing" indicator both showed `initialsFor`'s own
   *  fallback — the address's first character — since neither had any way
   *  to know the difference between a real name and a raw address; this
   *  threads that same distinction down to `ChatMessage`'s own `identified`
   *  prop (lyra-ui) instead, which shows a generic person icon in that case.
   *  Defaults to identified so every existing caller (none of which
   *  distinguished the two cases before this prop existed) keeps showing
   *  initials exactly as before. */
  /** Drops the shared mock follow-up session's (session-2) messages — used by scripted scenarios (Lucas Thomas) whose own transcript shouldn't show them. */
  hideMockFollowUpMessages?: boolean;
  /** Hides every message bubble (mock history + live) — used while an AI-led chat is only being reviewed, before the agent takes over. */
  hideAllMessages?: boolean;
  /** Only the current session's row (status, Session Details, Outcome, the
   *  action cluster), no conversation and no scroller: AI display "main"
   *  (P-AIFIRST), where the thread itself is in the panel and the AI
   *  workspace fills the column below this row. */
  sessionRowOnly?: boolean;
  /** The conversation without the current session's row: the caller renders
   *  that row elsewhere (`sessionRowOnly`, the docked panel's header under AI
   *  display "main", P-AIFIRST (k5)). Earlier sessions keep their rows. */
  hideCurrentSessionRow?: boolean;
  customerIdentified?: boolean;
  /** The active channel's own BASE Contact id (`Thread.contactId`) — used
   *  as the synthetic "just launched" session's Contact ID (see
   *  `isFreshLaunch` below). Previously this reused the interaction's own
   *  CUSTOMER id instead (a real, shipped bug — Session Details' "Contact
   *  ID" field literally showed the Customer ID) — now a real, distinct
   *  per-Contact id, generated once at Thread-creation time. */
  contactId: string;
  /** Per explicit request ("display the number in the session row instead
   *  of the contact ID — display email/whatsapp handle/etc. for phase
   *  2"): the active channel's own human-readable reach address
   *  (`Thread.addressLabel` — already a generic "phone number/email
   *  address/WhatsApp handle" string covering every channel type) —
   *  becomes the synthetic "just launched"/reopened session's own
   *  `TranscriptSession.addressLabel` (see that field's own doc comment), which
   *  `TranscriptSessionSeparator` shows in place of "# contactId" once
   *  set. Undefined for a channel with no known address (an ad-hoc typed
   *  contact, a redialed call) — that session's row then falls back to
   *  the plain "# contactId" display, exactly as before this prop
   *  existed. */
  channelAddressLabel?: string;
  /** The active channel's own skill preview (`Thread.preview`), if
   *  any — shown as the synthetic "just launched" session's Skill field. */
  skillLabel?: string;
  /** True only for an interaction whose card was just created this session
   *  (`Interaction.startedFresh` — see its own doc comment) — shows a
   *  single empty "Session Details" separator (today's date, no messages)
   *  for Chat/SMS/WhatsApp instead of the fixed mock chat log, since a
   *  brand-new text conversation genuinely has no history yet. Has no
   *  effect for Voice/Email — those always show their own fixed session
   *  (with its own placeholder "Coming Soon" body) regardless, since
   *  there's no "pre-existing conversation" for either to wrongly show in
   *  the first place. */
  isFreshLaunch: boolean;
  /**
   * When set, renders a `ContactOverview` block (see that component's own
   * doc comment) right at the top of the CURRENT session's message
   * content — the caller resolves this (prior-agent lookup, snapshot
   * text) and only passes it for a freshly-launched contact with actual
   * context worth surfacing; omit it (or pass `undefined`) for a genuinely
   * first-ever, no-history contact, same channels/`isFreshLaunch` already
   * gates the empty "Session Details" separator with — this is a SEPARATE
   * flag, though, not derived from `isFreshLaunch` in here, since not
   * every fresh launch has prior-agent/snapshot context to show (a
   * brand-new customer with zero history anywhere has nothing for this to
   * summarize).
   */
  contactOverview?: ContactOverviewInfo;
  /** When true, only chat bubbles show: no autosummary/context overview, interstitials, approval summaries, events or wrap-up cards. */
  hideAiActions?: boolean;
  /** The reverse (a call's "Hide Transcript", P-CANVAS): only the AI rows show — no utterances or messages. */
  hideTranscript?: boolean;
  /**
   * The overview block, rendered where the transcript places its overview
   * (above the conversation, or where `contactOverviewPosition` says): the
   * caller supplies it — the AI overview (`AutosummaryCard`, and Marcus's
   * card) in the main column with AI display inline, the Autosummary alone
   * in a thread view. Takes priority over `contactOverview`.
   */
  overview?: React.ReactNode;
  /**
   * Overrides which of the two `ContactOverview` render spots is used —
   * see either spot's own doc comment below for what each means. Only
   * needed when a caller's own `isFreshLaunch` value doesn't actually
   * match which spot its `ContactOverview` should use: the Marcus Webb
   * scripted scenario (AgentWorkspace2WithDeskPage.tsx) sets
   * `isFreshLaunch` for its OTHER effect (the empty "Session Details"
   * separator a genuinely brand-new text conversation gets) even though
   * his first message arrives instantly/scripted rather than empty — per
   * explicit bug report, his Contact Overview still needs to land AFTER
   * that first message, i.e. the "bottom" spot, not the "top" one
   * `isFreshLaunch` would otherwise pick for him. Omit to fall back to
   * the default `isFreshLaunch ? "top" : "bottom"` every other caller
   * already gets.
   */
  contactOverviewPosition?: "top" | "bottom";
  /**
   * Forwarded straight through to the rendered `ContactOverview`'s own
   * `onViewCustomerInfo`/`onViewInteractionHistory` props (see either
   * one's own doc comment, contact-overview.tsx) — the caller (each page
   * file) opens its docked Customer Information panel and jumps it to the
   * Overview/Contacts tab respectively. `undefined` for either one hides
   * that specific link (same as `ContactOverview` itself does), which
   * naturally happens whenever `contactOverview` itself is unset too since
   * neither link means anything without a panel to jump.
   */
  onViewCustomerInfo?: () => void;
  onViewInteractionHistory?: () => void;
  /**
   * Forwarded straight through to the rendered `ContactOverview`'s own
   * `onLaunchPreviousAgentInteraction` prop (see its own doc comment,
   * contact-overview.tsx) — turns that block's "already been working with
   * Agent X" name/id into a clickable link that opens a Call/Chat popover.
   * `undefined` hides the link (same as `ContactOverview` itself does).
   */
  onLaunchPreviousAgentInteraction?: (channel: "voice" | "chat") => void;
  /**
   * One entry per time this channel was reopened (via "Add Channel") while
   * closed — `Interaction`'s own `Thread.reopenedContacts`,
   * passed straight through. Rendered as one additional, empty synthetic
   * "Session Details" separator per entry, appended AFTER whichever base
   * session list this channel type otherwise shows (see this component's
   * own doc comment above and the render return below) — see that field's
   * own doc comment for the full reasoning. Text channels
   * (chat/sms/whatsapp) only; always `undefined`/ignored for voice/email,
   * which have no equivalent multi-session concept (`isTextChannel` below
   * gates this the same way it gates `isFreshLaunch`). Each entry's own
   * `messagesBeforeReopen` is what lets `liveMessagesBySessionId` below
   * slice the flat `liveMessages` prop back into per-session chunks — see
   * that field's own doc comment (on `Thread.reopenedContacts`) for
   * the full boundary reasoning.
   */
  reopenedContacts?: { id: string; date: string; startTime: string; messagesBeforeReopen: number; contactId: string }[];
  /**
   * Messages actually sent this session (`InteractionComposer`'s Send
   * button) plus the simulated customer reply that follows — this
   * interaction's own `Interaction.liveMessages`, passed straight
   * through. Rendered after whatever the branches below otherwise show (the
   * fixed mock log, or nothing yet for a fresh SMS launch), in its own
   * trailing block — see the render return below. Tag state for these
   * messages (`liveMessageTags`) is kept separate from `sessionMessages`
   * (the mock log's own tag state) rather than merged into it: merging
   * would mean re-deriving a stable `sessionMessages` entry from a prop
   * that's a fresh `[]` reference on every render an interaction has no
   * live messages yet, which'd need an effect just to keep in sync for no
   * real benefit.
   */
  liveMessages: TranscriptMessage[];
  /**
   * The status last explicitly assigned (via the status popover) to the
   * ACTIVE channel's current/most-recent session — the caller resolves this
   * from `Interaction.threadStatuses[activeChannel.id]` (see that
   * field's own doc comment for why status has to be tracked per-channel,
   * up on `Interaction`, rather than purely in this component's own
   * state) and passes the single resolved value straight through. Only ever
   * applies to the LAST entry in `sessionsToRender` below (the "current"
   * session — the freshly-launched synthetic one, the shared mock log's
   * follow-up session, or Voice/Email's single session); every earlier/
   * historical session always reads "Closed" instead, unconditionally —
   * see `getSessionStatus`'s own doc comment.
   */
  currentStatus?: string;
  /** Fires whenever the agent changes the CURRENT session's status via the
   *  popover (a plain pick, or confirming "Close") — the caller writes this
   *  back onto the active channel's own entry in `Interaction.
   *  threadStatuses` (`handleInteractionStatusChange`, main component).
   *  Never fires for any other (historical) session — those are always
   *  locked/uneditable now (see `TranscriptSessionSeparator`'s own
   *  `isCurrentSession` doc comment), so there's nothing else to change. */
  onCurrentStatusChange: (status: string) => void;
  /**
   * Real Consult/Transfer + Outcome buttons on the CURRENT session's own
   * separator bar (`TranscriptSessionSeparator`, floated right per explicit
   * request) — all of these are the exact same shared `outcomeDraftKey`/
   * `outcomeDraft` state (main component) the LeftNav's `ChannelRow`
   * Outcome button already uses for THIS channel, threaded down as plain
   * values/setters rather than one bundled object so this component (which
   * has no other reason to know about `ChannelOutcomeConfig`'s shape) only
   * takes on the individual pieces it actually forwards. All optional and
   * only meaningfully passed together — see the render-call site
   * (`showPanelToggle` gates whether Customer Information / outcome state
   * exists at all in this app). `resolution`/`onResolutionChange` aren't
   * separate props here since they're just `currentStatus`/
   * `onCurrentStatusChange` above (one underlying value, same as the
   * LeftNav's own outcome wiring).
   */
  outcomeOpen?: boolean;
  onOutcomeOpenChange?: (open: boolean) => void;
  outcomeTags?: string[];
  onOutcomeTagsChange?: (tags: string[]) => void;
  outcomeDispositionCode?: string;
  onOutcomeDispositionChange?: (value: string) => void;
  outcomeSummary?: string;
  onOutcomeSummaryChange?: (value: string) => void;
  onOutcomeSave?: () => void;
  onOutcomeCancel?: () => void;
  /** True once this channel's call has ended (voice only) — swaps the
   *  Outcome popover's footer to "Save & Redial"/"Save & Dismiss" instead
   *  of "Cancel"/"Save & Close" (`ChannelOutcomeConfig.callEnded`,
   *  outcome-panel.tsx). Unset/false leaves it exactly as today. */
  outcomeCallEnded?: boolean;
  /** Whether that footer shows "Save & Redial" (Settings → Outbound Calling); default true. */
  outcomeShowSaveAndRedial?: boolean;
  /** "Save & Redial" clicked — only meaningful while `outcomeCallEnded` is
   *  true. Called with the Outcome trigger's own DOM node (`OutcomePanel`
   *  threads this through automatically — see its own doc comment,
   *  outcome-panel.tsx) so the caller can anchor the resulting redial
   *  popover right on this row's Outcome button. */
  onOutcomeSaveAndRedial?: (anchorEl: HTMLElement | null) => void;
  /** "Save & Dismiss" clicked — only meaningful while `outcomeCallEnded`
   *  is true. */
  onOutcomeSaveAndDismiss?: () => void;
  /**
   * Real "Unassign & Dismiss" button on the CURRENT session's own separator
   * bar, immediately right of the status tag — per explicit request. Same
   * scoping as the `outcome*` props above: only meaningful for the CURRENT
   * session (the caller only ever passes this alongside a defined
   * `outcomeOpen`, mirroring that gate at the render-call site below),
   * since a historical/closed session has no live channel left to dismiss.
   * The caller wires this to the exact same `handleDismissChannel`/
   * `handleDismissInteraction` pair the LeftNav's `ChannelTab` kebab's own
   * "Unassign & Dismiss" entry already uses for this channel — same icon
   * (`UserX`), same action, just a second real trigger for it.
   */
  onDismissChannel?: () => void;
  /**
   * True once this whole conversation reads as over/read-only — either
   * `Interaction.closed` (a reopened, fully-closed historical
   * interaction) or the ACTIVE channel's own `channelStatuses` entry
   * reading `"Closed"` (still an otherwise-open assignment, just this one
   * channel closed via the status popover) — the same union of conditions
   * that already gate the "You are viewing a closed interaction."/"This
   * channel is closed." banners at the render call site, reused here
   * rather than re-derived from `currentStatus` alone so this fades for
   * BOTH closed states those two banners cover, not just one of them. Per
   * explicit request, fades every session's messages (not just the
   * current one) to 50% opacity — the whole conversation is inert now, not
   * just its most recent stretch. */
  dimmed?: boolean;
  /** Per explicit request (Agent Workspace 2.0 only): once
   *  `AgentNextGenPage.tsx`'s own record header grew an icon-button cluster
   *  covering these same per-session actions (plus a relocated status
   *  chip), passed straight through to every `TranscriptSessionSeparator`
   *  below as `showActionCluster` — see that prop's own doc comment.
   *  Defaults `true` (every other call site keeps the session row's own
   *  copy). */
  showSessionActionCluster?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `showConsultTransferAndAddParticipant` — see that prop's own doc
   *  comment. Default `true` (every other call site keeps both buttons). */
  showSessionConsultTransferAndAddParticipant?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `showKebabMenu` — see that prop's own doc comment. Default `true`
   *  (every other call site keeps the kebab). */
  showSessionKebabMenu?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `outcomeAfterStatus` — see that prop's own doc comment. Default
   *  `false` (every other call site keeps Outcome in its original
   *  position). */
  sessionOutcomeAfterStatus?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `showAddParticipant` — see that prop's own doc comment. Default `true`
   *  (every other call site keeps Add Participant). */
  showSessionAddParticipant?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `transferInKebabMenu` — see that prop's own doc comment. Default
   *  `false` (every other call site keeps Transfer as its own standalone
   *  icon). */
  sessionTransferInKebabMenu?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `statusAndKebabBeforeOutcome` — see that prop's own doc comment.
   *  Default `false` (every other call site keeps this cluster in its
   *  original DOM order). */
  sessionStatusAndKebabBeforeOutcome?: boolean;
  /** Passed straight through to every `TranscriptSessionSeparator` below as
   *  `controlsReadOnly` — see that prop's own doc comment. Default `false`
   *  (every other call site is unaffected). */
  sessionControlsReadOnly?: boolean;
  /** Passed to every `TranscriptSessionSeparator` as `showStatus`. Defaults
   *  to whether the provider stores case status (hide, don't disable). */
  showSessionStatus?: boolean;
  /** Rendered as the last item inside the scrolling content, after the
   *  conversation and Autosummary, so it scrolls with them (the voice
   *  wrap-up card, P0.5d.1). */
  trailingContent?: React.ReactNode;
  /** Identifies `trailingContent`: it scrolls into view (smoothly) the first
   *  time each key appears in this transcript, then never again. */
  trailingContentKey?: string;
  /** True for a brand-new, agent-initiated OUTBOUND thread with no real
   *  activity yet — the caller resolves this the same way as
   *  `isFreshLaunch` (`Interaction.startedFresh`), AND-ed with "the
   *  customer hasn't replied yet" (`Thread.lastCustomerMessageTick`) —
   *  same compound "still genuinely fresh, not just started-outbound"
   *  check `copilotAvailable` already uses (main component) — rather than
   *  reusing `isFreshLaunch` alone, since that flag stays `true` for the
   *  rest of the interaction's life even once real activity exists (it
   *  only controls whether the mock session log is skipped). Passed
   *  straight through to the CURRENT session's own
   *  `TranscriptSessionSeparator` as `isNewThread` — see that prop's own
   *  doc comment for the full reasoning/scoping. Defaults `false`; every
   *  existing call site is unaffected until the caller starts computing a
   *  real value. */
  isNewThread?: boolean;
  /** An outbound email draft's temporary Send (E2), under the "Coming soon" body while the thread is a draft
   *  (`isNewThread`): marks it sent, which makes it live. P-PARKED's email composer replaces it. */
  onSendDraft?: () => void;
  /** True while a simulated customer reply is pending on the ACTIVE channel
   *  (`handleSendMessage`'s 2.5s reply timeout, main component — set the
   *  instant the agent's own message is sent, cleared the moment the
   *  customer's reply actually lands) — renders a `TypingIndicator` bubble
   *  right after the live-message list of the CURRENT session (same
   *  `lastSessionId` scoping `outcomeOpen`/`showSessionActionCluster` use
   *  above; a typing indicator only ever makes sense for whichever
   *  conversation is actually live). Per explicit request, only meaningful
   *  for `isTextChannel` (chat/SMS/WhatsApp) — Voice has no message concept
   *  to "type," and Email's reply cadence isn't a live back-and-forth the
   *  way the other three are; the render check below gates on both. Defaults
   *  `false`; every existing call site is unaffected until the caller starts
   *  computing a real value. */
  isCustomerTyping?: boolean;
  /** Shows the AI agent's (purple, right-aligned) typing bubble at the end of the current session. */
  isAiTyping?: boolean;
  /** Fired when the agent picks a decision on an approval summary card — the caller plays out the follow-up in the chat. */
  onApprovalDecision?: (value: string, note: string) => void;
  /** Fired when a `callRequest` decision is picked — see `TranscriptApprovalSummary.decisions[].callRequest`. */
  onApprovalCallRequest?: (req: { value: string; anchorEl: HTMLElement; confirm: () => void }) => void;
  onApprovalSuggestionAsk?: (text: string) => void;
  /** The agent took over before deciding on the approval card. */
  approvalTakenOver?: boolean;
  /** The link key whose panel is currently open (marks the matching instruction row active). */
  activeSnapshotLink?: string;
  /** Fired when the agent clicks "Complete wrap-up" on a wrap-up card. */
  onWrapUpComplete?: () => void;
  /** Snapshot bullet links (`[label](key)`) in the inline Contact Overview — called with the key. */
  onSnapshotLink?: (key: string) => void;
  /** Fires when "View Details" is clicked on any session row (each
   *  `TranscriptSessionSeparator`'s own `onViewDetails`, per explicit
   *  request that it stop expanding `TranscriptSessionDetails` inline and
   *  open an external panel instead) — passed the specific
   *  session that was clicked. The caller (each tier page) opens a
   *  "Session Details" `InteriorPanel` for it; for a VOICE channel
   *  specifically, per that same request, the caller instead switches its
   *  existing "Transcript" panel to a "Details" tab showing this session
   *  rather than opening a second, separate panel — this component has no
   *  opinion on which; it just reports the click with the session in
   *  question. Omit for a caller with no panel to open (nothing renders
   *  differently here either way — the row's own `open`/collapse state is
   *  gone, so there's no fallback in-place behavior to fall back to). */
  onViewSessionDetails?: (session: TranscriptSession) => void;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `onToggleDetailsPanel` (see that prop's own doc comment for the full
   *  "why" — a plain open/close toggle now, no menu, no per-session
   *  content). Omit for a caller with no Details panel to toggle (nothing
   *  else renders differently either way). */
  onToggleDetailsPanel?: () => void;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `detailsPanelOpen` (see that prop's own doc comment for the full
   *  "why" — hides the `onToggleDetailsPanel` button while the caller's
   *  Details panel is already open). Defaults `false`; a caller that
   *  hasn't wired this through yet keeps rendering the button exactly as
   *  before. */
  detailsPanelOpen?: boolean;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `detailsPanelPreviewContent` (see that prop's own doc comment for the
   *  full "why" — restores the hover-preview `Popover` the record header's
   *  own Customer Information toggle used to show before this button
   *  relocated into the session row). Omit for a caller with no equivalent
   *  preview content ready to hand over (nothing else renders differently
   *  either way). */
  detailsPanelPreviewContent?: React.ReactNode;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `detailsPanelPreviewOpen` (see that prop's own doc comment). Defaults
   *  `false`. */
  detailsPanelPreviewOpen?: boolean;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `onDetailsPanelPreviewHoverStart` (see that prop's own doc comment). */
  onDetailsPanelPreviewHoverStart?: () => void;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `onDetailsPanelPreviewHoverEnd` (see that prop's own doc comment). */
  onDetailsPanelPreviewHoverEnd?: (e: React.MouseEvent | React.FocusEvent) => void;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `showViewDetails` prop (see that prop's own doc comment for the full
   *  "why" — the nested instance inside voice's "Transcript" tab passes
   *  `false`). Defaults `true`; every other call site is unaffected. */
  showViewDetails?: boolean;
  /** Forwarded straight through to every `TranscriptSessionSeparator`'s own
   *  `viewDetailsLabel` prop (see that prop's own doc comment) — Phase 1
   *  (Advanced)'s own call sites pass `"Session Details"`; every other
   *  consumer omits this and keeps the original "View Details" label. */
  viewDetailsLabel?: string;
  /** Forwarded straight through to the CURRENT session's own
   *  `TranscriptSessionSeparator` as `portalTarget` (see that prop's own
   *  doc comment for the full "why" — relocating that row out from under
   *  the "Session Details" `InteriorPanel`, which shares this same
   *  scrollable column and otherwise overlays it). Only ever applied to
   *  the session matching this component's own `lastSessionId` — any
   *  historical session (if one somehow renders) is unaffected and stays
   *  inline. Omit (every other tier/call site) to leave every session row
   *  rendering inline exactly as before. */
  sessionRowPortalTarget?: HTMLElement | null;
  /** Forwarded straight through to the CURRENT session's own
   *  `TranscriptSessionSeparator` as `hideFade` (see that prop's own doc
   *  comment) — per explicit follow-up request/screenshot, ALSO suppressed
   *  for a voice channel with its fullscreen video overlay open: that
   *  overlay is a sibling of this whole transcript (rendered by the tier
   *  page, absolutely positioned over this same content area — see
   *  `VideoCallFullScreen`'s own top doc comment), so the separator's
   *  trailing white-to-transparent fade — meant to soften real message
   *  bubbles scrolling underneath it — was instead painting a stray pale
   *  band over the top of the video. Defaults `false`; every other call
   *  site is unaffected. */
  hideSessionSeparatorFade?: boolean;
}
