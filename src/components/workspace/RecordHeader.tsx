import {
  Avatar,
  Badge,
  Button,
  CHANNEL_TYPE_META,
  type ChannelOutcomeConfig,
  ChannelToggle,
  ChannelToggleGroup,
  PageHeader,
  PanelHeader,
  PlainToggleTab,
  Popover,
  Tooltip,
} from "@nicecxone/lyra-ui";
import { Check, Headphones, History, X } from "lucide-react";
import {
  ChannelThreadBody,
  ChannelThreadComposer,
  ChannelThreadMenu,
  HOVER_PREVIEW_POPOVER_CLASS,
  HoverPreviewFrame,
  callBadge,
  channelHeaderEntries,
  isDraftThread,
  panelToggleClass,
  threadAcceptsReplies,
} from "@/contact-handling";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { LUCAS_THOMAS_ID } from "@/contact-handling/scenario-cases";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { ClockTick } from "@/components/agent-next-gen-clock-tick";
import {
  OUTCOME_DISPOSITION_OPTIONS,
  OUTCOME_TAG_OPTIONS,
  TRANSCRIPT_SESSION_STATUS_OPTIONS,
} from "@/components/transcript/InteractionTranscript";
import { formatElapsedTime, getAwaitingSeverity, initialsFor } from "@/components/agent-next-gen-shared-utils";
import { cn } from "@/lib/utils";
import { SHOW_CHANNEL_TOGGLE_GROUP } from "./workspace-constants";
import { SummariesToggle } from "./SummariesToggle";
import { ContactDetailsControl } from "./ContactDetailsControl";

/** The active interaction's record header (P-EXTRACT C8, from the page):
 *  the avatar, call badge, add-channel "+", one icon per channel with its
 *  hover preview, and the Contact Details toggle with its own. */
export function RecordHeader() {
  const {
    SHOW_RECORD_HEADER_SUBTITLE, activeChannelDateTime, activeChannelKey,
    activeChannelType, activeInteraction, activeInteractionIsAgentCall, activeInteractionIsRealCustomer,
    addChannelActionFor, caseStatusCapable, channelHoverPreviewKey, channelPreviewThreadKey,
    handleChannelSelect, handleDismissChannel, handleDismissInteraction,
    handleInteractionStatusChange, handleOutcomeCancel, handleOutcomeOpenChange, handleOutcomeSave,
    handleSendMessage, hasOpenChatThread, hideAiActions, historyConversationForActive, isHistoryConversationView,
    lastCustomerResponseLabel, lucasThomasReviewing, omni, openChannelHoverPreview,
    outcomeDraft, outcomeDraftKey, panelPlacement, recordHeaderRef, recordHeaderWidth,
    replyBlockedReason, scenarioKeyOf, scheduleCloseChannelHoverPreview,
    selectPanel, setChannelHoverPreviewKey,
    setHistoryConversationTab, setOutcomeDraft, showChannelTabRow,
    storeContacts, tabs, threadMenu, sessionRowHost, sessionRowInHeader,
  } = useWorkspace();
  if (!activeInteraction) return null;
  return (
                    <>
                    {/* ── Record header ──
                        `PageHeader` is back (per explicit follow-up
                        request — it had been removed entirely in favor of
                        just this row's own tab bar; see this file's git
                        history for that earlier removal's own reasoning),
                        now as its own row ABOVE the channel tabs instead of
                        the tabs being this whole area's only content.
                        Title/subtitle show the customer's name/id
                        (`recordId`) directly again — no longer only
                        reachable via the Customer Information panel's own
                        header — with an "Active"/"Closed" status badge
                        alongside, mirroring `activeInteraction.closed`.

                        `actions` holds the header-level buttons, per
                        explicit request: at full width, one small outline
                        icon button PER channel this contact can still add
                        (Call/Email/SMS/…, via `getAvailableChannels` below)
                        instead of a single combined "Add Channel" trigger —
                        each one is still the exact same `AddChannelButton`
                        every other "+" in this app uses (`getHeaderAction`,
                        create-new.tsx), just locked to one channel via its
                        new `initialChannel` option (skips straight to the
                        phone/skill picker, no redundant "Select Channel"
                        step) and wearing that channel's own icon via
                        `icon` instead of the default "+". Below the
                        `recordHeaderWidth < 768` breakpoint, this whole row
                        collapses down to the single combined "+" trigger
                        instead (the original, unrestricted `getHeaderAction`
                        call — every channel back in one "Select Channel"
                        picker) — there isn't room for one button per
                        channel once the header itself gets this tight.
                        Customer Information is deliberately LAST in
                        `actions` — a plain flex row, so whichever child
                        renders last just naturally lands at the far right
                        of it, no extra positioning prop needed.

                        Customer Information collapses to icon-only at the
                        SAME `recordHeaderWidth < 768` breakpoint (per
                        explicit follow-up request) — drops its "Customer
                        Information" label down to a bare id-card glyph
                        exactly when the channel buttons above collapse to
                        their own single icon trigger, so the whole row
                        changes shape together instead of one side
                        collapsing before the other.
                        `ref={recordHeaderRef}` — a dedicated measurement of
                        THIS header's own width (see that ref's own doc
                        comment for why `sidePanelContainerWidth` stopped
                        being a safe stand-in for it once this button
                        started rendering unconditionally, not just while
                        the docked panel is closed). */}
                    {/* One header, one bottom border (P-CANVAS browser pass, lyra's PageHeader "Agent" story): line one
                        is the PageHeader; line two, under AI display inline and panel, is the main transcript's
                        current session row (`sessionRowHost`), whose own bottom border closes the header. Without a
                        second line (AI display "main": the session row is the panel thread's, k5 B) the PageHeader
                        carries the border. */}
                    <div data-slot="record-header" className="shrink-0">
                    <PageHeader
                      ref={recordHeaderRef}
                      bordered={false}
                      compact
                      className={sessionRowInHeader ? undefined : "border-b border-lyra-border-subtle pb-3"}
                      // Per explicit request ("add an icon indicating
                      // whether the interaction is an agent or a customer
                      // to the left of the name"): `Headphones` for
                      // `activeInteractionIsAgentCall` (defined above —
                      // the same "is this interaction's own `id` one of
                      // `OUTBOUND_AGENTS`'s ids" check that already gates
                      // Customer Information/the status chip for agent-
                      // to-agent calls), `User` otherwise. Matches the
                      // exact glyphs the New Outbound "Choose group"
                      // Select already shows for these two categories
                      // (`agentCategoryIcon`/`customerCategoryIcon`,
                      // agent-next-gen-outbound-data.tsx) so the same icon
                      // means the same thing in both places.
                      //
                      // Per explicit follow-up request ("use the avatar
                      // variant in a circle and remove the divider"):
                      // wrapped in `Icon` (icon.tsx) with `shape="circle"`
                      // — a colored circle avatar shell rather than a bare
                      // glyph, matching lyra-ui's own `PageHeader` "Record
                      // Header (Circle Avatar, No Divider)" story
                      // (PageHeader.stories.tsx). Once the icon is a
                      // self-contained circle like this, the divider
                      // `icon` renders by default between itself and the
                      // title just doubles up on separation the circle's
                      // own background already provides — dropped via
                      // `iconDivider={false}` (see that prop's own doc
                      // comment, page-header.tsx).
                      //
                      // `background` is driven by `activeInteractionIsAgentCall`
                      // per a further explicit follow-up ("use a different
                      // accent color for customer vs. agent avatar") —
                      // "active" (blue) for an agent call, "shell" (neutral
                      // gray) for a real customer. Not new colors: these are
                      // the EXACT SAME `Icon` `background` values —
                      // `agentCategoryLeadingIcon`/`customerCategoryLeadingIcon`
                      // (agent-next-gen-outbound-data.tsx) already build by
                      // hand for the New Outbound picker's own "Agents"/
                      // "Customers" category rows (`bg-lyra-bg-active-subtle`/
                      // `text-lyra-fg-active-strong` and `bg-lyra-bg-surface-
                      // shell`/`text-lyra-fg-secondary` respectively — see
                      // that file's own doc comment on the category color
                      // pairing) — so the record header now reads as the
                      // same category-to-color mapping the picker already
                      // established, not a one-off purple used for both.
                      // Per explicit follow-up request ("display the status
                      // in the avatar as a badge"), the record header's own
                      // "Online"/"Closed" pill (that used to sit inline
                      // after the customer's name, see `badge`/`badgeColor`
                      // below — now removed) has moved onto this avatar's
                      // own bottom-right corner instead, matching the
                      // exact `AgentPresenceBadge` corner treatment the
                      // Outbound picker's own contact rows already use
                      // (create-new.tsx) — a `size="sm"` circle `Badge`
                      // with `px-0`/`border-lyra-bg-surface-base`.
                      //
                      // Per a further explicit follow-up request ("customer
                      // statuses should only be visible in chats"), this
                      // now only renders at all when `hasOpenChatThread` is
                      // true — the ORIGINAL "idle" (amber, for voice/SMS/
                      // email/WhatsApp with no live signal) branch is gone
                      // entirely rather than just recolored, since a
                      // non-chat interaction shouldn't show ANY presence
                      // indicator, matching the OLD pill's own original
                      // reasoning that those channels have no way to
                      // honestly know whether the customer is still there.
                      // Once a chat thread IS open, it's just two states:
                      // "online" (green) normally, "offline" (gray) once
                      // the interaction is closed — and per a further
                      // follow-up request ("it should be a green check
                      // like other available statuses"), each renders a
                      // real Check/X glyph as the Badge's content rather
                      // than a plain dot, matching `AgentPresenceBadge`'s
                      // own `available`/`offline` treatment exactly. Only
                      // for a real customer, not an agent call
                      // (`!activeInteractionIsAgentCall`) — presence is a
                      // customer concept here; an agent's own status
                      // already has its own dedicated surface elsewhere
                      // (the status menu).
                      icon={
                        <span className="relative inline-flex">
                          {/* Per explicit follow-up request ("avatars
                              within the contact and call details should be
                              the initials of the customer OR a customer
                              avatar if no customer name is known", then
                              "add a story to the avatar component ... use
                              it in agent-next-gen-v3"): now built on
                              lyra-ui's shared `Avatar` (avatar.tsx) instead
                              of the hand-rolled `Icon`/purple-circle split
                              this block used right after the first request
                              — that hand-rolled version is exactly what
                              `Avatar` generalizes (see its own doc
                              comment). `color="active"` for an agent call
                              (was `Icon background="active"`), `color=
                              "primary"` (this app's purple "identified
                              customer" chip, same as `VoiceCallControls`'s
                              own) once a real match's name is known, else
                              `color="shell"` with no `initials` — `Avatar`
                              itself falls back to a generic `User` glyph
                              whenever `initials` is omitted, so that
                              branch no longer needs its own explicit
                              `icon={User}`. `size="md"` matches this
                              header's prior `Icon size="md"` exactly (both
                              are the same 36px circle). */}
                          {activeInteractionIsAgentCall ? (
                            <Avatar icon={Headphones} color="active" size="md" />
                          ) : activeInteractionIsRealCustomer && activeInteraction.customerName ? (
                            <Avatar initials={initialsFor(activeInteraction.customerName)} color="primary" size="md" />
                          ) : (
                            <Avatar color="shell" size="md" />
                          )}
                          {!activeInteractionIsAgentCall && hasOpenChatThread && (
                            // Per explicit request ("add a tooltip to the
                            // user status badge"), wrapped in a real
                            // `Tooltip` on hover — same "Online"/"Offline"
                            // wording as this badge's own `aria-label`
                            // just below (not "Available"/"Unavailable":
                            // this is customer CHAT presence, a distinct
                            // concept from the agent's own Available/
                            // Unavailable status elsewhere in this app —
                            // see `AgentStatus`, agent-profile.tsx). No
                            // `asLabel`: the Badge already sets its own
                            // `aria-label` below, so this stays purely a
                            // visual hover affordance on top of that, not
                            // a second/duplicate accessible name.
                            <Tooltip
                              content={activeInteraction.closed ? "Offline" : "Online"}
                              placement="bottom"
                            >
                              <Badge
                                shape="circle"
                                variant={activeInteraction.closed ? "neutral" : "success"}
                                size="sm"
                                aria-label={activeInteraction.closed ? "Offline" : "Online"}
                                className="absolute bottom-[-2px] right-[-2px] px-0 border border-lyra-bg-surface-base"
                              >
                                {activeInteraction.closed ? (
                                  <X className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
                                ) : (
                                  <Check className="h-2 w-2" strokeWidth={3} aria-hidden="true" />
                                )}
                              </Badge>
                            </Tooltip>
                          )}
                        </span>
                      }
                      iconDivider={false}
                      title={activeInteraction.customerName ?? "Customer"}
                      // Per explicit request ("a badge to the left of the
                      // customer name ... that says 'Active Call' for
                      // active call contacts so people don't get lost
                      // visually"): `PageHeader`'s own built-in `badge`
                      // prop (see `PageHeader.stories.tsx`'s "With Badge"
                      // story) — no new prop needed, this one was just
                      // unused at this call site since the "Online"/
                      // "Closed" presence pill moved onto the avatar's own
                      // corner (see that badge's own doc comment above).
                      // `isViewingLiveVoiceCallInteraction` is already
                      // exactly "the interaction THIS header belongs to has
                      // a live voice call" (this header only ever renders
                      // for `activeInteraction`).
                      // Since k6 7: the call's state (Active Call, Call On Hold, Ringing, Wrap-up), `callBadge`.
                      badge={callBadge(activeInteraction, storeContacts)}
                      // Per explicit follow-up request (mockup's own 4
                      // states — even State 2/4, with the full tab row
                      // showing, still read the ACTIVE tab's own "{icon}
                      // {Channel label} | {Draft/date}" subtitle, e.g.
                      // "Email | Draft" — not the plain customer-ID text):
                      // this is now UNCONDITIONAL, every customer
                      // interaction, regardless of `showChannelTabRow`/
                      // channel count. Previously gated on
                      // `!showChannelTabRow` (back when that const meant
                      // "unknown contact," not "channel count") — now that
                      // it's channel-count-based, gating this on it too
                      // would have made the subtitle flip back to the
                      // plain customer ID the moment a second channel
                      // opened, which the mockup explicitly does NOT want.
                      // Same "{icon} {Channel label} | {date/time or
                      // Draft}" format Agent Workspace 2.0 always shows
                      // (AgentNextGenPage.tsx — see `CHANNEL_TYPE_META`/
                      // `resolveActiveChannelDateTimeLabel`'s own doc
                      // comments above for where each half comes from).
                      // `undefined` (not a bare channel label with nothing
                      // after it) whenever either half is missing —
                      // `PageHeader`'s own `{subtitle && ...}` guard
                      // (page-header.tsx) then skips the subtitle row
                      // entirely, same fallback 2.0 uses. Falls back to the
                      // plain customer ID only when there's genuinely no
                      // active channel to describe (shouldn't normally
                      // happen while `activeInteraction` is set, but keeps
                      // this defensive rather than rendering nothing).
                      //
                      // Per a later explicit follow-up request: once 2+
                      // channels are open (`showChannelTabRow`), the single
                      // active tab's own "{icon} {label} | {date}" line
                      // above stops answering the question that actually
                      // matters with several channels live at once — this
                      // branch takes over instead, reading "{N} channels
                      // open | Last Customer Response: {date/time}" (count =
                      // `activeInteraction.threads.length`, matching
                      // `showChannelTabRow`'s own threshold/definition; see
                      // `resolveInteractionLastCustomerResponseLabel`'s own
                      // doc comment for how that timestamp is resolved
                      // across every thread, not just the active one). If
                      // NO thread has a qualifying response yet, the
                      // trailing clause is simply omitted rather than
                      // printing a broken "Last Customer Response:" with
                      // nothing after it.
                      subtitle={
                        // See `SHOW_RECORD_HEADER_SUBTITLE`'s own doc
                        // comment above — hidden per explicit request, the
                        // rest of this ternary untouched underneath.
                        !SHOW_RECORD_HEADER_SUBTITLE ? undefined :
                        showChannelTabRow && activeInteraction.threads.length >= 2 ? (
                          <span className="truncate">
                            {activeInteraction.threads.length} channels open
                            {lastCustomerResponseLabel ? ` | Last Customer Response: ${lastCustomerResponseLabel}` : ""}
                          </span>
                        ) : activeChannelType && activeChannelDateTime ? (
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="shrink-0 text-lyra-fg-secondary" aria-hidden="true">
                              {CHANNEL_TYPE_META[activeChannelType].icon}
                            </span>
                            <span className="truncate">
                              {CHANNEL_TYPE_META[activeChannelType].label} | {activeChannelDateTime}
                            </span>
                          </span>
                        ) : (
                          activeInteraction.customerId
                        )
                      }
                      // Per later explicit follow-up request ("float the
                      // channel toggles to the right where the current
                      // toggle icon is"): `ChannelToggleGroup`/`ChannelToggle`
                      // moved out of this `titleSuffix` slot (right after the
                      // customer name) into `actions` below instead — see
                      // that prop's own doc comment for the full "why" and
                      // what it replaced there. `titleSuffix` is omitted
                      // entirely now (nothing left to put in it) rather than
                      // left passing an empty/`false` value.
                      // `badge`/`badgeColor` (the old inline "Online"/
                      // "Closed" pill) are gone — see the `icon` prop's own
                      // doc comment above for where that signal moved to
                      // (the avatar's own corner badge, three states now
                      // instead of two). `hasOpenChatThread` still checks
                      // whether ANY thread on this interaction is chat, not
                      // just whichever tab is currently selected — per the
                      // ORIGINAL explicit follow-up request behind that
                      // check ("leave the active badge visible if the
                      // agent switches between chat/other channels"),
                      // switching tabs away from chat shouldn't make the
                      // presence signal disappear when a chat thread is
                      // still open elsewhere on the same card.
                      // Per later explicit follow-up request ("float the
                      // channel toggles to the right where the current
                      // toggle icon is; move the toggle icon to the session
                      // row to the right of the outcome icon button"): this
                      // slot used to hold the Customer Information panel's
                      // own hover-preview `Popover` + toggle `ActionIconButton`
                      // — moved down to the session row instead, via
                      // `TranscriptSessionSeparator`'s own pre-existing
                      // `onToggleDetailsPanel` "Open Details Panel" icon,
                      // which dropped the hover-preview convenience (that
                      // button had no equivalent for it) down to a plain
                      // click-to-toggle.
                      //
                      // Per a LATER explicit follow-up request ("move the
                      // details side panel toggle to above the session row
                      // to the right of the voice + button group"), it's
                      // back here again — same spot it originally occupied,
                      // one full circle. Per explicit follow-up when THAT
                      // move was scoped ("keep the hover-preview, hand-roll
                      // the new button instead" of lyra-ui's `PageHeader`
                      // own built-in `panelToggle="right"` slot, which can't
                      // wrap its internal button in custom Popover content),
                      // this is a real `Button`/`Popover` pair rendered
                      // directly in this `actions` block — not
                      // `panelToggle`/`onInnerPanelToggle` — specifically so
                      // the hover-preview mechanism (`customerInfoPreviewOpen`/
                      // `openCustomerInfoPreview`/
                      // `scheduleCloseCustomerInfoPreview`, still declared
                      // above) can keep wrapping it, moved verbatim from
                      // `TranscriptSessionSeparator`'s own former render of
                      // it (`detailsPanelPreviewContent` and friends,
                      // formerly passed to the OTHER `<InteractionTranscript>`
                      // call site below — no longer passed there at all now
                      // that this is the button rendering it). Gated on
                      // `!sidePanelOpen` — same "hide once the real panel is
                      // already open" reasoning `detailsPanelOpen` used to
                      // give `TranscriptSessionSeparator`.
                      //
                      // `ChannelToggleGroup`/`ChannelToggle` — was this
                      // header's own `titleSuffix` (right after the customer
                      // name; see that (now-removed) slot's own doc comment
                      // above) — now renders here instead, so it floats at
                      // the row's far right. The wrapping `<div className=
                      // "flex items-center gap-1">` below is what lets the
                      // panel-toggle button sit beside it as a sibling,
                      // rather than needing its own separate `actions` slot.
                      actions={
                        <div className="flex items-center gap-1">
                        {/* Per explicit request ("add an icon representing
                            the channel to the right of the '+' ... and
                            open a side panel ... with the channel
                            content"), later broadened by an explicit
                            follow-up ("the chat icon should be visible ...
                            all open channels should display"): one small
                            icon per Thread on this interaction — ALL of
                            them, including whichever one is currently
                            `currentThreadId`/shown in the main transcript
                            column, not just the non-active ones (that
                            channel's own panel-based preview, toggled by
                            this same icon, is a genuinely separate view
                            from the main column — see this whole icon
                            row's shared `channelPreviewThreadKey` doc
                            comment further up — so it still needs its own
                            toggle here too, same as every other channel).
                            With the pill row above hidden, this is now the
                            only way to reach a channel's own preview.
                            Reuses `CHANNEL_TYPE_META` (lyra-ui,
                            channel-row.tsx) for the icon/label rather than
                            inventing a second mapping — the same one this
                            header's own active-channel icon already uses a
                            few hundred lines up. Toggle-open, same
                            semantics `openDetailPanelContent`'s own doc
                            comment established: clicking the icon for
                            whatever's ALREADY showing closes the panel
                            instead of re-opening it — mutually exclusive
                            with every other channel icon AND the Contact
                            Details button (see `handleSidePanelIconToggle`'s
                            own doc comment) since they all share this one
                            `channelPreviewThreadKey` state. */}
                        {/* Add channel, first in the group (k8 1; k6 1): the nav card's "+", every mode. */}
                        <span data-slot="header-add-channel" className="inline-flex">{addChannelActionFor(activeInteraction)}</span>
                        {/* One icon per channel, never one per thread; several threads: its menu, on hover or click (k6 4, k8 10). */}
                        <ChannelThreadMenu
                          open={!!threadMenu.channel}
                          onOpenChange={(open) => !open && threadMenu.close()}
                          anchorRef={threadMenu.anchorRef}
                          onMouseEnter={threadMenu.cancelClose}
                          onMouseLeave={threadMenu.scheduleClose}
                          threads={activeInteraction.threads.filter((t) => t.type === threadMenu.channel).map((t) => ({
                            key: t.id ?? t.type,
                            label: t.addressLabel ?? t.value ?? CHANNEL_TYPE_META[t.type].label,
                            time: activeInteraction.liveMessages?.[t.id ?? t.type]?.slice(-1)[0]?.timestamp,
                            unread: omni.unread(activeInteraction.id, t.id ?? t.type, activeInteraction.liveMessages?.[t.id ?? t.type]),
                          }))}
                          activeKey={panelPlacement ? channelPreviewThreadKey ?? undefined : activeChannelKey}
                          onSelect={(key) => selectPanel({ kind: "thread", cardId: activeInteraction.id, key })}
                        />
                        {channelHeaderEntries(activeInteraction.threads).map(({ thread: latest, count: threadCount, keys: channelKeys }) => {
                          // Every thread, voice and scripted cases included, has an icon: a tab for the main column
                          // (AI display inline/panel; shown while the card has more than one thread) or the panel's ("main").
                          if (tabs && activeInteraction.threads.length < 2) return null;
                          // The channel's active thread (on screen), else its latest: what the icon previews and selects.
                          const shownKey = channelKeys.find((k) => k === channelPreviewThreadKey || (!panelPlacement && k === activeChannelKey));
                          const c = activeInteraction.threads.find((t) => (t.id ?? t.type) === shownKey) ?? latest;
                          const key = c.id ?? c.type;
                          const meta = CHANNEL_TYPE_META[c.type];
                          // Active (the selected look, `panelToggleClass`) = on screen: the panel's thread,
                          // and the main column's outside AI display "main" (clicking that one is a no-op).
                          // Pressed = what the panel shows; with tabs, the main tab (exactly one).
                          const isOpen = channelKeys.includes(channelPreviewThreadKey ?? "");
                          const inMain = !isOpen && !panelPlacement && channelKeys.includes(activeChannelKey);
                          // Unread: customer messages on a thread that isn't on screen (an inactive tab, or not the panel's).
                          const unreadCount =
                            c.type !== "voice" && !isOpen && !inMain ? omni.unread(activeInteraction.id, key, activeInteraction.liveMessages?.[key]) : 0;
                          // This tab is the main column's: its "{channel} active" `Tooltip` below.
                          const isActiveChannel = !panelPlacement && key === activeChannelKey;
                          // The voice icon is labeled "Voice Transcript": its preview is the transcript.
                          const previewLabel = c.type === "voice" ? "Voice Transcript" : meta.label;
                          // No hover preview for a channel already open in the panel (`openChannelHoverPreview`).
                          const hoverOpen = channelHoverPreviewKey === key;
                          // Hover previews the channel's thread; with several threads it opens the thread
                          // menu instead, the active channel's too (k8 10). Keyed by channel, so the element
                          // the menu hangs from stays put while its threads change (k8 7).
                          return (
                            <div
                              key={c.type}
                              data-channel-icon={c.type}
                              onMouseEnter={(e) => {
                                if (threadCount < 2) {
                                  threadMenu.close();
                                  return openChannelHoverPreview(key);
                                }
                                setChannelHoverPreviewKey(null);
                                threadMenu.openFor(c.type, e.currentTarget);
                              }}
                              onMouseLeave={threadCount < 2 ? scheduleCloseChannelHoverPreview : threadMenu.scheduleClose}
                            >
                              {/* `Tooltip` wraps `Popover` through a plain
                                  `span` rather than directly — `Popover`
                                  doesn't spread arbitrary extra props
                                  through to its own trigger, so `Tooltip`'s
                                  `asChild`/Slot injection silently drops
                                  without that intervening real DOM node.
                                  Same fix as Phase 2's own copy of this
                                  exact composition; see lyra-ui's
                                  `popover.tsx` top-of-file comment. */}
                              <Tooltip content={`${meta.label} active`} placement="bottom" disabled={!isActiveChannel}>
                              <span className="inline-flex">
                              <Popover
                                open={hoverOpen}
                                placement="bottom"
                                align="end"
                                showArrow={false}
                                bodyPadding={false}
                                className={HOVER_PREVIEW_POPOVER_CLASS}
                                onOpenAutoFocus={(e: Event) => e.preventDefault()}
                                onCloseAutoFocus={(e: Event) => e.preventDefault()}
                                onInteractOutside={(e: Event) => {
                                  if ((e.target as Element)?.closest?.("[data-radix-popper-content-wrapper], [data-floating-layer]")) {
                                    e.preventDefault();
                                  }
                                }}
                                content={
                                  // The panel's own thread body and composer (read-mostly: the
                                  // chat input only), so the preview shows what selecting this
                                  // icon puts in the panel, in the shared preview frame.
                                  <HoverPreviewFrame
                                    onMouseEnter={() => openChannelHoverPreview(key)}
                                    onMouseLeave={scheduleCloseChannelHoverPreview}
                                    header={<PanelHeader title={previewLabel} subhead={activeInteraction.customerName} />}
                                    footer={
                                      threadAcceptsReplies(activeInteraction, c) &&
                                      !(scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID && lucasThomasReviewing) && (
                                        <ChannelThreadComposer
                                          hideAiActions={hideAiActions}
                                          onSend={(text) => handleSendMessage(activeInteraction.id, text, key)}
                                          copilot={{ replyBlockedReason: replyBlockedReason(c.type) }}
                                          chatOnly
                                          floatingMenus
                                        />
                                      )
                                    }
                                  >
                                    <div className="flex min-h-0 flex-1 flex-col" data-slot="thread-preview">
                                      {/* The conversation only: no Autosummary or AI rows in a channel preview (k6 5). */}
                                      <ChannelThreadBody
                                        interaction={activeInteraction}
                                        thread={c}
                                        hideAiActions={hideAiActions}
                                        withoutAiActions
                                        hideMockFollowUpMessages={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID}
                                        onStatusChange={(status) => handleInteractionStatusChange(activeInteraction.id, key, status)}
                                      />
                                    </div>
                                  </HoverPreviewFrame>
                                }
                              >
                                <Button
                                  variant="outline"
                                  size="icon-sm"
                                  aria-pressed={tabs ? inMain : isOpen}
                                  aria-label={`${isOpen ? "Close" : "Open"} ${previewLabel} preview`}
                                  className={cn("ml-0.5 h-8 w-8 px-0", panelToggleClass({ active: isOpen || inMain, previewOpen: hoverOpen }))}
                                  data-preview-open={hoverOpen || undefined}
                                  data-in-main={inMain || undefined}
                                  // Several threads on the channel: their count; else its unread count.
                                  badge={threadCount > 1 ? threadCount : unreadCount > 0 ? unreadCount : undefined}
                                  // Several threads on the channel: its thread picker (k6 4); one: select it.
                                  onClick={(e) => {
                                    if (threadCount < 2) return selectPanel({ kind: "thread", cardId: activeInteraction.id, key });
                                    setChannelHoverPreviewKey(null);
                                    threadMenu.openFor(c.type, e.currentTarget.closest<HTMLElement>("[data-channel-icon]") ?? e.currentTarget);
                                  }}
                                >
                                  {meta.icon}
                                </Button>
                              </Popover>
                              </span>
                              </Tooltip>
                            </div>
                          );
                        })}
                        {/* Hidden for now per that same explicit request —
                            `false &&` rather than deleting the block, so
                            the pill row (channel switching/outcome/history
                            tab UI) comes back with a one-line flip once
                            it's wanted again. */}
                        {SHOW_CHANNEL_TOGGLE_GROUP && activeInteraction.threads.length > 0 && (
                          <ChannelToggleGroup>
                            {activeInteraction.threads.map((c) => {
                              const key = c.id ?? c.type;
                              const outcomeKey = `${activeInteraction.id}:${key}`;
                              const isNewOutboundThread = isDraftThread(activeInteraction, c);
                              // Own `<ClockTick>`: only this tab re-renders
                              // for its last-contact/awaiting timers.
                              return (
                                <ClockTick key={key}>
                                  {(clockTick) => (
                                <ChannelToggle
                                  type={c.type}
                                  address={c.addressLabel}
                                  statusLabel={activeInteraction.threadStatuses?.[c.id] ?? "Open"}
                                  lastCustomerContactLabel={
                                    c.lastCustomerMessageTick !== undefined
                                      ? formatElapsedTime(clockTick - c.lastCustomerMessageTick)
                                      : undefined
                                  }
                                  interactionId={c.reopenedContacts?.[c.reopenedContacts.length - 1]?.contactId ?? c.contactId}
                                  active={
                                    !isHistoryConversationView &&
                                    (activeInteraction.currentThreadId ?? activeInteraction.threads[activeInteraction.threads.length - 1]?.id) === key
                                  }
                                  awaitingResponse={
                                    activeInteraction.threadStatuses?.[c.id] !== "Closed" &&
                                    activeInteraction.threadStatuses?.[c.id] !== "Resolved" &&
                                    (c.awaitingResponse ?? false)
                                  }
                                  awaitingSeverity={
                                    activeInteraction.threadStatuses?.[c.id] !== "Closed" &&
                                    activeInteraction.threadStatuses?.[c.id] !== "Resolved" &&
                                    c.awaitingResponse
                                      ? getAwaitingSeverity(clockTick - (c.lastCustomerMessageTick ?? c.startTick))
                                      : undefined
                                  }
                                  onClick={() => {
                                    setHistoryConversationTab((t) => (t && t.active ? { ...t, active: false } : t));
                                    handleChannelSelect(activeInteraction.id, key);
                                  }}
                                  onDismiss={() => {
                                    if (activeInteraction.threads.length > 1) handleDismissChannel(activeInteraction.id, c);
                                    else handleDismissInteraction(activeInteraction.id);
                                  }}
                                  showMenu={
                                    !activeInteraction.closed &&
                                    activeInteraction.threadStatuses?.[c.id] !== "Closed" &&
                                    !isNewOutboundThread
                                  }
                                  removeVariant={isNewOutboundThread ? "delete-draft" : "close"}
                                  outcome={{
                                    open: outcomeDraftKey === outcomeKey,
                                    onOpenChange: (open) => handleOutcomeOpenChange(outcomeKey, open),
                                    resolutionOptions: TRANSCRIPT_SESSION_STATUS_OPTIONS,
                                    resolution: activeInteraction.threadStatuses?.[c.id] ?? "Open",
                                    onResolutionChange: (value) =>
                                      handleInteractionStatusChange(activeInteraction.id, c.id, value),
                                    voice: c.type === "voice" || !caseStatusCapable,
                                    tagOptions: OUTCOME_TAG_OPTIONS,
                                    selectedTags: outcomeDraft.tags,
                                    onTagsChange: (tags) => setOutcomeDraft((d) => ({ ...d, tags })),
                                    dispositionOptions: OUTCOME_DISPOSITION_OPTIONS,
                                    dispositionCode: outcomeDraft.dispositionCode,
                                    onDispositionChange: (value) => setOutcomeDraft((d) => ({ ...d, dispositionCode: value })),
                                    summary: outcomeDraft.summary,
                                    onSummaryChange: (value) => setOutcomeDraft((d) => ({ ...d, summary: value })),
                                    onSave: handleOutcomeSave,
                                    onCancel: handleOutcomeCancel,
                                  } satisfies ChannelOutcomeConfig}
                                />
                                  )}
                                </ClockTick>
                              );
                            })}
                            {historyConversationForActive && (
                              <PlainToggleTab
                                active={historyConversationForActive.active}
                                icon={<History className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />}
                                onClick={() =>
                                  setHistoryConversationTab((t) => (t ? { ...t, active: true } : t))
                                }
                                menuItems={[
                                  {
                                    id: "close-history-conversation-tab",
                                    label: "Close Tab",
                                    onClick: () => setHistoryConversationTab(null),
                                  },
                                ]}
                              >
                                {historyConversationForActive.entry.timestampDisplay}
                              </PlainToggleTab>
                            )}
                          </ChannelToggleGroup>
                        )}
                        {/* Contact Details (the shared control, a kind cell's too, P-HOME-1m): always visible, in
                            every AI display mode, selected while the panel shows Contact Details (clicking it then
                            closes the panel), with its hover preview. */}
                        {activeInteraction && <ContactDetailsControl compact={recordHeaderWidth < 768} />}
                        {/* Outside the wrapper above: hovering it must not open the Contact Details preview. */}
                        <SummariesToggle />
                        </div>
                      }
                    />
                    {sessionRowInHeader && <HostSlot host={sessionRowHost} data-slot="record-session-row" />}
                    </div>
                    {/* Per the latest explicit follow-up request ("float the
                        channel toggles to the right..."): the
                        `ChannelToggleGroup`/`ChannelToggle` pills now render
                        in this record header's own `actions` slot above
                        (floated right), not `titleSuffix` (inline after the
                        name) anymore — see that slot's own doc comment for
                        the full history/reasoning. */}
                    </>
  );
}
