import { useEffect, useRef, useState, type ReactNode } from "react";
import { useProviders } from "@/provider-context";
import { t } from "@/i18n";
import type { ChannelKind } from "@/domain";
import { CREATE_NEW_CUSTOMERS } from "@nicecxone/lyra-ui/customers-data";
import { getHoldSeverity, type InteractionChannel } from "@nicecxone/lyra-ui";
import {
  IncomingOfferActions,
  VoiceHoldChip,
  answerSeverity,
  isDraftThread,
  offerRowAnswerSeverity,
  omnichannelMainKey,
  outcomeDraftKey as outcomeDraftKeyOf,
  panelDefaultKey,
  tabMainKey,
} from "@/contact-handling";
import { LUCAS_THOMAS_ID, MARCUS_WEBB_ID } from "@/contact-handling/scenario-cases";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { NeedsOutcomeBadge } from "@/components/OnHoldBadge";
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import { formatElapsedTime, getAwaitingSeverity } from "@/components/agent-next-gen-shared-utils";
import { InteractionNavCard } from "./left-nav-parts";

/** One assignment card in the left nav (P-EXTRACT C8, from the page): the
 *  body of the card's `ClockTick` callback, so a tick re-renders this card
 *  and not the page. `slotExpanded` is the overlay hover's `expanded`, from
 *  `LeftNavSlot`. */
export function NavCardItem({
  interaction,
  slotExpanded,
  clockTick,
  hideChip = false,
  kind,
}: {
  interaction: Interaction;
  slotExpanded: boolean | undefined;
  clockTick: number;
  /** Hides the channel chip on the card's rows (`assignments.channelChips`, P-PROFILES). */
  hideChip?: boolean;
  /** P-HOME-1e: this card is a schedule item's, with the call as its leg (KindNavCard): the item's name, and its
   *  kind row in place of the "+" and the offer actions. */
  kind?: { name: string; identified: boolean; row: ReactNode };
}) {
  const {
    activeInteractionId, addChannelActionFor, answerSla, assignmentsSettings, channelPreviewThreadKey,
    channelsAllExpanded, channelsExpandedOverrideVersion, clock, confirmDismiss, contactCommands,
    contactStateById, createdCustomerRecords, findLiveVoiceThread, handleCallHoldChip, handleDismissChannel,
    handleDismissInteraction, incomingOffer, isNewAssignment, lucasThomasReviewing, mainPins,
    marcusWebbReviewing, navOpen, noInteractionCollapse, omnichannel, outcomeConfigFor, outcomeDrafts,
    panelPlacement, scenarioKeyOf, selectPanel, setChannelsExpandedById, setInteractions, setPanelFullScreen,
    setVoiceVideoFullScreen, setVoiceVideoWindowOpen, switchActiveInteraction, channelsExpandedById, botHolds,
  } = useWorkspace();
  const consultChannels = useProviders().capabilities.interaction.transfer.consultChannels ?? [];
  const cardHeldByBot = botHolds(interaction.id);
  /** A voice leg is live until the call ends or the card closes; its timer follows the leg, not the case status. */
  const legLive = (c: Thread) => !interaction.closed && !interaction.voiceCallEnded && c.wrapUpSinceTick === undefined;
  // A remounted card (nav collapsed to the rail and back, the placement swap) restores the expanded state the
  // store kept for it: lyra's card starts open and applies an override only when its version changes, so the
  // restore is a version bump after mount, and the card's first report (its default) isn't taken as the agent's.
  const [restoredExpanded] = useState(() => channelsExpandedById[interaction.id]);
  const restoring = restoredExpanded !== undefined;
  const [mounted, setMounted] = useState(false);
  const firstReportSkipped = useRef(!restoring);
  useEffect(() => setMounted(true), []);
  const overrideLow = !channelsAllExpanded && interaction.id === activeInteractionId ? 1 : 0;
  const overrideBase = channelsExpandedOverrideVersion * 2 + overrideLow;
  const [baseAtMount] = useState(overrideBase);
  // Until the next bulk click or active-card change, the restored state stands in for the bulk one.
  const overrideExpanded = restoring && mounted && overrideBase === baseAtMount ? restoredExpanded : channelsAllExpanded || interaction.id === activeInteractionId;
                const mostRecentId = interaction.threads[interaction.threads.length - 1]?.id;
                // For the active card specifically, an open channel preview
                // (`channelPreviewThreadKey`) takes over which channel this
                // card highlights as "current" - `currentThreadId` itself
                // no longer changes when a channel's selected (see
                // `handleChannelSelect`'s own doc comment), so without this
                // the card's highlight would never move off whichever
                // channel happened to be current when it was added.
                // The card's current row is its main-column thread; a thread
                // open in the right panel is highlighted too (`alwaysHighlighted`).
                const requestedId = interaction.currentThreadId ?? mostRecentId;
                // Placement "panel": the current row is the thread in the panel.
                const currentId = panelPlacement
                  ? (interaction.id === activeInteractionId && channelPreviewThreadKey) || panelDefaultKey(interaction.threads) || requestedId
                  : (omnichannel ? omnichannelMainKey(interaction.threads, requestedId, mainPins.pinned(interaction.id)) : tabMainKey(interaction.threads, requestedId)) ?? requestedId;
                // Seconds since the CUSTOMER last wrote on this channel —
                // only meaningful (and only ever read) for a channel that's
                // actually awaiting, which per `hasCustomerResponded` below
                // can't be true without `lastCustomerMessageTick` also being
                // set, so this never actually falls back to `startTick` in
                // practice — kept as `?? c.startTick` only to satisfy the
                // type (`lastCustomerMessageTick` is optional).
                const channelAwaitingWaitSeconds = (c: Thread) =>
                  clockTick - (c.lastCustomerMessageTick ?? c.startTick);
                // Per explicit request: none of this card's timers (this
                // per-channel `elapsed` below, and the compact-tile
                // `elapsed`/`earliestStart` further down) should start
                // counting until the CUSTOMER has actually said something on
                // that channel — an agent-initiated channel that's still
                // waiting on the customer's very first reply has nothing to
                // measure yet ("since it opened" was a misleading reading
                // there: it made a freshly-dialed outbound channel look like
                // it'd already been waiting on someone). Once the customer
                // has responded at least once, `lastCustomerMessageTick` is
                // set for good (see its own doc comment) and every one of
                // these readings resumes exactly as before.
                const hasCustomerResponded = (c: Thread) => c.lastCustomerMessageTick !== undefined;
                const channels: InteractionChannel[] = interaction.threads.map((c) => {
                  // Per explicit request: a channel that's been explicitly
                  // closed (via the status popover), OR the whole interaction
                  // this card represents (a reopened-from-history, read-only
                  // one — `interaction.closed`), stops counting toward SLA/
                  // awaiting-response entirely — same union of conditions the
                  // record-header `ChannelTab` call site's own `channelClosed`
                  // now applies (channel-row.tsx). There's no reply pending on
                  // something that's already been closed out, so it shouldn't
                  // keep escalating amber/red (or green) no matter how long
                  // it's sat since. Drives the READ-ONLY lockdown below
                  // (`removable`) — NOT the SLA timer directly (see
                  // `slaSuppressed` just below for that) — since "Resolved"
                  // needs to affect one without the other (next paragraph).
                  const isClosed = interaction.threadStatuses?.[c.id] === "Closed" || !!interaction.closed;
                  // Per explicit request/follow-up clarification: a brand-new
                  // AGENT-INITIATED OUTBOUND channel — this channel's OWN
                  // `c.startedFresh` (see `Thread.startedFresh`'s own doc
                  // comment for why per-Thread, not `interaction.startedFresh`),
                  // reused straight from the same signal `isFreshLaunch`/
                  // `copilotAvailable` already key off — hasn't earned
                  // Consult/Transfer, Outcome, or Unassign & Dismiss yet, so
                  // this card's kebab collapses to a plain close ("×") button
                  // just like a closed one (`removable` below).
                  // `!hasCustomerResponded(c)` matters too: the moment the
                  // customer actually replies, this is a real, live
                  // conversation like any other — same "still fresh vs.
                  // already has real activity" split `copilotAvailable`
                  // already draws — so the lockdown lifts automatically
                  // rather than persisting for the rest of the interaction's
                  // life just because it happened to start as an outbound
                  // dial. Never true for a customer-initiated thread
                  // (notification/table-row opens deliberately don't set
                  // `startedFresh` — see those call sites' own doc comments),
                  // matching the explicit "not outbound" clarification.
                  // Voice never reads as a draft here either — same
                  // exclusion/reasoning as `activeChannelIsNewOutboundThread`
                  // above (its own doc comment has the full "no per-message
                  // model for voice" explanation) — per explicit request.
                  // Since k6 9: the shared `isDraftThread` (nothing sent yet), the same derivation the session row reads.
                  const isNewOutboundThread = isDraftThread(interaction, c);
                  // Per explicit request: a "Resolved" channel ALSO stops
                  // counting toward SLA/awaiting-response — same treatment
                  // `isClosed` above already gets — WITHOUT closing the
                  // thread: `isClosed` alone (not this) still drives
                  // `removable`/the composer/kebab lockdown below, so a
                  // Resolved channel stays a completely normal, repliable,
                  // dismissable channel; only its timer/dot goes quiet, per
                  // explicit follow-up ("don't close the thread"). A
                  // channel can't be both interaction-`closed` (read-only)
                  // and still accepting a status change to "Resolved" at
                  // the same time in practice, so this simple OR is safe —
                  // it's not trying to distinguish those two cases.
                  const slaSuppressed = isClosed || interaction.threadStatuses?.[c.id] === "Resolved";
                  const effectiveAwaitingResponse = !slaSuppressed && (c.awaitingResponse ?? false);
                  const offerSeverity = offerRowAnswerSeverity(interaction, c, clockTick, answerSla);
                  return {
                    id: c.id,
                    type: c.type,
                    // Per `hasCustomerResponded`'s own doc comment above: no
                    // reading at all until the customer has said something on
                    // this channel at least once — an agent-initiated channel
                    // still waiting on a first reply has nothing to count yet.
                    // Per explicit follow-up, also blank once `slaSuppressed`
                    // (closed OR Resolved) — there's nothing left to time on
                    // a channel that's already closed out or wrapped up, so
                    // the timer disappears there too rather than freezing
                    // on/continuing to show "how long since this channel
                    // opened". Once neither of those applies: awaiting: "how
                    // long since the CUSTOMER last wrote" — the metric that
                    // actually matters for a digital SLA. Not awaiting: "how
                    // long since this channel opened" — still the useful
                    // reading once there's nothing pending (but the channel
                    // isn't closed/resolved either). See
                    // `lastCustomerMessageTick`'s own doc comment for why
                    // these two diverge after more than one exchange.
                    //
                    // Voice is a deliberate exception to the "not
                    // `hasCustomerResponded` ⇒ blank" rule above — per
                    // explicit request ("when a voice call starts - add a
                    // timer to the interactionNavItem"): a call has no
                    // "waiting on the customer's first reply" ambiguity the
                    // way an agent-initiated text channel does (there's no
                    // message model to wait on at all, same reasoning
                    // `isNewOutboundThread` above already carves voice out
                    // for), so it should just always show its own running
                    // "since it started" duration the instant it's dialed.
                    // Still blanked once `slaSuppressed` (closed/resolved)
                    // — same "nothing left to time" reasoning as every
                    // other channel type.
                    elapsed: c.type === "voice"
                      ? // The leg's timer: counts while the call is live (whatever the case status), freezes at hang-up.
                        legLive(c) || (c.wrapUpSinceTick !== undefined && !interaction.closed)
                        ? formatElapsedTime((legLive(c) ? clockTick : c.wrapUpSinceTick!) - c.startTick)
                        : ""
                      : slaSuppressed
                      ? ""
                      : !hasCustomerResponded(c)
                      ? ""
                      : effectiveAwaitingResponse
                      ? formatElapsedTime(channelAwaitingWaitSeconds(c))
                      : formatElapsedTime(clockTick - c.startTick),
                    // Recording (the provider's state): the timer's clock
                    // becomes a pulsing red dot, still counting (P0.5d.1).
                    recording: c.recording,
                    // The call's own line below the skill (P0.5d.1), one of:
                    // in wrap-up → "Needs outcome · mm:ss"; held → an
                    // "On hold · mm:ss" chip that resumes it (and selects
                    // this card); live → a "Hold" chip. The call timer
                    // stays put. Not while Marcus's call is under AI review
                    // (his controls are locked).
                    statusBadge:
                      c.wrapUpSinceTick !== undefined ? (
                        <NeedsOutcomeBadge elapsed={formatElapsedTime(clockTick - c.wrapUpSinceTick)} />
                      ) : c.type === "voice" &&
                        findLiveVoiceThread(interaction)?.id === c.id &&
                        !(scenarioKeyOf(interaction.id) === MARCUS_WEBB_ID && marcusWebbReviewing) ? (
                        <VoiceHoldChip
                          held={!!c.heldByAgent}
                          heldSeconds={c.heldSinceTick !== undefined ? clockTick - c.heldSinceTick : 0}
                          heldLabel={c.heldSinceTick !== undefined ? formatElapsedTime(clockTick - c.heldSinceTick) : undefined}
                          callerName={interaction.customerName ?? c.addressLabel ?? c.value ?? "caller"}
                          onClick={() => handleCallHoldChip(interaction, c)}
                        />
                      ) : undefined,
                    preview: c.preview,
                    current: c.id === currentId,
                    // See `effectiveAwaitingResponse` above — not read
                    // straight off `c.awaitingResponse` any more, since a
                    // closed channel should never render red/amber/green
                    // just because it happened to be awaiting right before
                    // it was closed.
                    // A ringing offer's row is on its answer SLA instead,
                    // selected or not (offerRowAnswerSeverity).
                    awaitingResponse: offerSeverity !== undefined || effectiveAwaitingResponse,
                    // Amber-vs-red-vs-green escalation (see
                    // `getAwaitingSeverity`'s own doc comment) — `undefined`
                    // (not computed at all) when this channel isn't
                    // effectively awaiting (not awaiting at all, OR closed),
                    // so `ChannelRow`/`InteractionNavItem` (lyra-ui) fall
                    // back to their own "nothing pending" look rather than a
                    // stray severity value with no `awaitingResponse` to go
                    // with it.
                    awaitingSeverity:
                      offerSeverity ?? (effectiveAwaitingResponse ? getAwaitingSeverity(channelAwaitingWaitSeconds(c)) : undefined),
                    // Closed (either the whole reopened-from-history
                    // interaction, or just this one channel via the status
                    // popover — same `isClosed` above) is read-only — no
                    // kebab, so there's no way to Unassign & Dismiss/Consult/
                    // Transfer/change Outcome on a conversation that's
                    // already over. `ChannelRow` (lyra-ui) replaces the
                    // kebab with a real close ("×") button in that case
                    // instead of just hiding it — see `removable`'s own doc
                    // comment on `InteractionChannel` for that wiring.
                    // Same collapsed/close-only treatment for a brand-new
                    // outbound thread (`isNewOutboundThread`, above) — per
                    // explicit request, it hasn't earned a working kebab
                    // yet either.
                    removable: isClosed || isNewOutboundThread ? false : undefined,
                    // Per explicit follow-up request: the `removable={false}`
                    // fallback above reads as a red trash icon/"Delete Draft"
                    // for a genuine, never-launched draft thread specifically
                    // (`isNewOutboundThread`), NOT for an already-closed
                    // channel/interaction — those still get the plain
                    // neutral "×"/"Close" treatment (`ChannelRow`'s own
                    // `removeVariant` default). See `InteractionChannel.
                    // removeVariant`'s own doc comment, channel-row.tsx.
                    removeVariant: isNewOutboundThread ? "delete-draft" : "close",
                    // Per explicit request ("update the voice assignment
                    // tiles to only display the end call and outcome
                    // buttons and then show the dismiss button when the
                    // call is ended (mirror phase 1 but not the hold state
                    // yet)") — `showKebab` stays scoped to voice only, unlike
                    // `AgentNextGenPage.tsx`'s own identical values (which
                    // it applies to every channel type; see that file's own
                    // doc comments on these same four props for the fuller
                    // "why" each one exists). `undefined` for every other
                    // type falls back to `ChannelRow`'s own default
                    // (`showKebab` true, `showDismissButton` false — and,
                    // per a later explicit follow-up request ("always
                    // display the outcome button in the interactionNavItems
                    // - no longer have them display on hover only... this
                    // can be a component level update"), `alwaysShowOutcome`
                    // now ALSO true, `ChannelRow`'s own default having been
                    // flipped for every consumer — see that prop's own doc
                    // comment, channel-row.tsx). While the
                    // call is live (`removable` above still `undefined`,
                    // i.e. `showMenu` true): no Consult/Transfer, no kebab,
                    // Outcome permanently visible (not hover-only), plus a
                    // standalone always-visible "Unassign & Dismiss" —
                    // together the only two actions on the tile. Once the
                    // call ends (`isClosed` above flips `removable` to
                    // `false`, i.e. `showMenu` false), `ChannelRow` replaces
                    // this whole cluster with its own single plain "×"
                    // Close/Dismiss button regardless of these four props —
                    // same shared fallback Phase 1 gets, nothing extra
                    // needed here for that transition. Deliberately NOT
                    // porting Phase 1's `onHold`/`findLiveVoiceThread`/
                    // `OnHoldPill` hold-state visuals — per this request,
                    // "not the hold state yet".
                    //
                    // `showDismissButton` — per a later explicit follow-up
                    // ("also remove the unassign and dismiss icon button
                    // while the call is on"), Unassign & Dismiss is now
                    // hidden while the call is still live and only appears
                    // once the agent has hung up (`voiceCallEnded` true) —
                    // mirroring `AgentNextGenPage.tsx`'s own identical
                    // formula exactly. Outcome (above) stays visible the
                    // whole time regardless, per the original request.
                    // Consult / Transfer sits in the row's hover cluster, not the kebab.
                    showConsultTransfer: true,
                    // Per explicit follow-up request ("always have the more
                    // options available in the interactionNavItem") — the
                    // kebab was made unconditional for every row for a
                    // while, superseding an earlier Marcus-only exception
                    // to a "hide kebab for every voice channel" rule (a
                    // reopened Contact History voice assignment, e.g.
                    // Nathan Cole, used to have no kebab at all — that's
                    // the bug report that fixed). Reversed by a LATER
                    // explicit request ("remove the more options for phase
                    // 1 - these will not be available until phase 2"):
                    // `false` hides it outright for every row/channel type
                    // here again — there's currently nothing behind it this
                    // page actually wants exposed yet (Consult/Transfer is
                    // hidden too, `showConsultTransfer: false` just above,
                    // and "Unassign & Dismiss" is stripped from every kebab
                    // dropdown regardless — see that prop's own doc comment
                    // right below), so an always-present kebab was just a
                    // dead-end trigger. `AgentWorkspace2WithDeskPage.tsx`
                    // ("Phase 2") keeps its own identical prop wired
                    // however it already had it — this change is scoped to
                    // this page's own channel-row mapping only.
                    showKebab: false,
                    alwaysShowOutcome: c.type === "voice" ? true : undefined,
                    // "Unassign & Dismiss" is stripped from every row's
                    // kebab dropdown outright (`ChannelRow`'s own
                    // `stripPromotedChannelRowActions`, channel-row.tsx), so
                    // the standalone icon is this action's only path from
                    // the left nav now — unconditional for every non-voice
                    // channel (chat/email/sms/etc. can be dismissed any
                    // time), but per explicit follow-up request ("calls
                    // cannot be dismissed until they are ended"), still
                    // gated for voice on `interaction.closed`/
                    // `voiceCallEnded` for every voice channel EXCEPT
                    // Marcus. Per a later, explicit follow-up request
                    // ("once the action is taken by the agent in the marcus
                    // webb contact then add the dismiss and unassign icon
                    // so the agent can remove it from their assignments"),
                    // Marcus's own tile is a deliberate, scoped exception to
                    // that general rule — once his one channel reads
                    // "Resolved" (`handleMarcusWebbResolved`, fired by both
                    // the Approve path AND the reject-then-remedy path's
                    // `onRemedyIssued`), the agent can dismiss the
                    // assignment without first hanging up the call. Every
                    // OTHER voice channel still needs `closed`/
                    // `voiceCallEnded` — this isn't a reversal of the
                    // general rule, just a named carve-out for this one
                    // scripted scenario.
                    // Per explicit follow-up request: once a voice call has
                    // ended, "Save & Dismiss" in the Outcome popover below
                    // replaces this standalone icon entirely (rather than
                    // both being shown) — so the "show once
                    // closed/voiceCallEnded" half of this condition is
                    // dropped; the Marcus Webb pre-hangup exception (a
                    // distinct, unrelated carve-out — see doc comment
                    // above) is preserved unchanged.
                    // Settings → Assignments → "Allow Unassign & Dismiss" off hides it outright.
                    showDismissButton: assignmentsSettings.allowUnassignDismiss && (
                      c.type === "voice"
                        ? !interaction.closed &&
                          !interaction.voiceCallEnded &&
                          scenarioKeyOf(interaction.id) === MARCUS_WEBB_ID &&
                          interaction.threadStatuses?.[c.id] === "Resolved"
                        : // A chat (or other digital) row's Unassign & Dismiss shows only once its contact has ended or
                          // its outcome is saved — hidden, not disabled, before that. Covers Lucas's AI-led chat too
                          // (live while the bot or the agent has it; his wrap-up closes it).
                          isClosed ||
                          ["wrap-up", "ended"].includes(contactStateById.get(c.providerInteractionId ?? "") ?? "") ||
                          outcomeDrafts.isSaved(outcomeDraftKeyOf(interaction.id, c.id))),
                    // Locks the kebab and Outcome — visibly present but
                    // non-interactive — for as long as the agent is only
                    // reviewing Marcus's still-live AI-agent call
                    // (`marcusWebbReviewing`), same "hasn't taken over yet"
                    // gate `onEndCall` used to use below. Scoped to Marcus
                    // only; every other channel's cluster is unaffected
                    // (`undefined`). Deliberately doesn't cover the standalone
                    // Dismiss icon above — dismissing was never part of this
                    // lock, on either this left-nav copy or the transcript
                    // header's own identical `controlsReadOnly` idea.
                    // Locked while the bot holds the card, and on an incoming call until it is accepted.
                    controlsDisabled: cardHeldByBot || interaction.offered || undefined,
                    // A consult is only for live legs (voice, chat); the other rows offer Transfer alone.
                    consultTransferLabel: consultChannels.includes(c.type as ChannelKind) ? undefined : t("Transfer"),
                    // While the bot holds the assignment (the review state), both are disabled with the reason.
                    consultTransferDisabledReason: cardHeldByBot ? t("Take over to transfer") : undefined,
                    endCallDisabledReason: cardHeldByBot ? t("Take over to end the call") : undefined,
                    // End call on a live voice leg; with Close confirmation on it asks first.
                    onEndCall:
                      c.type === "voice" &&
                      !interaction.closed &&
                      !interaction.voiceCallEnded &&
                      !interaction.offered
                        ? () => confirmDismiss(() => {
                            // A provider call ends through `end()` (to
                            // wrap-up, where the card shows its wrap-up card);
                            // a scripted scenario call ends locally.
                            if (!contactCommands.hangUp(c)) {
                              const endedAt = clock.now();
                              setInteractions((prev) =>
                                prev.map((i) =>
                                  i.id === interaction.id
                                    ? {
                                        ...i,
                                        voiceCallEnded: true,
                                        threads: i.threads.map((t) => (t.id === c.id ? { ...t, wrapUpSinceTick: endedAt } : t)),
                                      }
                                    : i
                                )
                              );
                            }
                            if (interaction.id === activeInteractionId) {
                              setVoiceVideoWindowOpen(false);
                              setVoiceVideoFullScreen(false);
                            }
                          })
                        : undefined,
                    // Forwarded straight from `Thread.direction` — drives
                    // `VoiceDirectionIcon`/`SmsDirectionIcon` at this row's
                    // own channel icon (lyra-ui, channel-row.tsx). Per
                    // explicit request ("update the voice directions to
                    // indicate inbound or outbound like in Phase 1") — see
                    // `AgentNextGenPage.tsx`'s own identical assignment.
                    direction: c.direction,
                    // Wires "Outcome" to a real popover (see
                    // `ChannelOutcomeConfig`'s own doc comment,
                    // channel-row.tsx) — harmless to always pass even on a
                    // closed/read-only card, since `showMenu={removable !==
                    // false}` already hides the whole button (and this along
                    // with it) there.
                    outcome: outcomeConfigFor(interaction, c, "popover"),
                    // A live call stays blue-highlighted alongside the open chat (Lucas: John on the call).
                    alwaysHighlighted:
                      (scenarioKeyOf(interaction.id) === LUCAS_THOMAS_ID && c.type === "voice" && !interaction.voiceCallEnded && !interaction.closed) ||
                      // The thread open in the right panel is highlighted too, next to the main one.
                      (interaction.id === activeInteractionId && (c.id ?? c.type) === channelPreviewThreadKey),
                  };
                });
                // Closed OR Resolved channels drop out of every card-level
                // SLA/timer computation below — per explicit request, once a
                // channel is closed OR resolved it should stop counting
                // toward the card's own dot/color/timer entirely, not just
                // stop escalating (Resolved doesn't touch anything else —
                // the card stays a normal, open, dismissable card; see
                // `slaSuppressed`'s own doc comment above for the same split
                // at the per-channel level). A card whose only channel(s)
                // are all closed/resolved ends up with an empty
                // `cardOpenChannels`, which is exactly what makes
                // `earliestStart` (and so `elapsed`, at the render call site
                // below) `undefined` — the counter itself disappears rather
                // than falling back to "time since it was opened," same as
                // the dot disappearing once `awaitingSeverity` has nothing
                // left to compute from. (Despite the name, "open" here means
                // "still counts toward the SLA timer," not "not closed" —
                // this is a timer-only list, not the read-only-lockdown one.)
                //
                // Marcus's own voice channel is a deliberate, scoped
                // exception to the "Resolved drops out" half of this rule —
                // per explicit follow-up request ("the timer should be
                // visible in the marcus webb collapsed interactionNavItem").
                // `handleMarcusWebbResolved` (above) flips his channel's
                // session status to "Resolved" the moment the agent
                // approves the refund, but the CALL ITSELF is still live at
                // that point (same "resolved disposition, still-connected
                // call" gap `showDismissButton`'s own doc comment already
                // documents for this exact channel) — the collapsed tile's
                // timer disappearing right as the agent approves would read
                // as the call having ended, when it hasn't. Gated on
                // `!interaction.voiceCallEnded` so this exception itself
                // switches off, same as every other card, the moment the
                // call actually does end.
                const cardOpenChannels = interaction.threads.filter(
                  (c) =>
                    // The status is the case's and the timer is the leg's: a live call counts while Resolved.
                    (c.type === "voice" && legLive(c)) ||
                    (interaction.threadStatuses?.[c.id] !== "Closed" &&
                      interaction.threadStatuses?.[c.id] !== "Resolved")
                );
                // Per explicit request: an open channel that's never actually
                // heard from the customer yet (`hasCustomerResponded` above)
                // doesn't count toward "since it opened" either — an
                // agent-initiated channel still waiting on a first reply has
                // nothing to time, same reasoning as the per-channel
                // `elapsed` above. A card whose only open channel(s) are all
                // still waiting on that first reply ends up with an empty
                // `respondedOpenChannels`, which is what makes `earliestStart`
                // (and so `elapsed`, at the render call site below)
                // `undefined` — the counter disappears rather than starting
                // to tick the moment the channel was created. Voice channels
                // are exempt from the `hasCustomerResponded` check here too
                // — same reasoning as the per-channel `elapsed` above (a
                // call always has something to time, "waiting on a first
                // reply" doesn't apply to it) — so a voice-only card still
                // gets a running compact-tile timer the instant it's dialed.
                const respondedOpenChannels = cardOpenChannels.filter(
                  (c) => c.type === "voice" || hasCustomerResponded(c)
                );
                const earliestStart =
                  respondedOpenChannels.length > 0
                    ? Math.min(...respondedOpenChannels.map((c) => c.startTick))
                    : undefined;
                // Card-level awaiting wait: the WORST (longest) of this
                // card's own awaiting, still-OPEN channels — not the
                // earliest-opened channel's own elapsed time — a card with
                // one fresh channel and one long-overdue one should read as
                // overdue, not average out to something in between.
                // `undefined` when nothing still-open on this card is
                // awaiting at all, so the card falls back to
                // `earliestStart`'s plain "since it opened" reading below
                // (itself `undefined`, and so blank, once every channel is
                // closed) — same as before this feature existed.
                const cardAwaitingChannels = cardOpenChannels.filter((c) => c.awaitingResponse);
                const cardAwaitingWaitSeconds =
                  cardAwaitingChannels.length > 0
                    ? Math.max(...cardAwaitingChannels.map(channelAwaitingWaitSeconds))
                    : undefined;
                // The card's SLA tier: a ringing offer on its answer SLA
                // (profile thresholds), else the longest awaiting reply.
                // Drives the outline/timer and the new-assignment dot.
                const cardSlaSeverity =
                  interaction.offered && earliestStart !== undefined
                    ? answerSeverity(clockTick - earliestStart, answerSla)
                    : cardAwaitingWaitSeconds !== undefined
                      ? getAwaitingSeverity(cardAwaitingWaitSeconds)
                      : undefined;
                // PROTOTYPE (CollapsedChannelBadge, local-only): the same
                // channel this card's `currentChannelKey` prop below already
                // resolves to — falls back to the most-recent channel when
                // nothing's explicitly current yet, same fallback `currentId`
                // itself uses. Only actually rendered by `InteractionNavCard`
                // itself once collapsed — see that component's own doc
                // comment (above `AgentNextGenPage`) for why this whole card
                // is built through it now, rather than this `.map()`
                // returning two structurally different shapes depending on
                // `navOpen` the way it originally did.
                const currentChannelType =
                  channels.find((c) => c.id === currentId)?.type ?? channels[channels.length - 1]?.type;
                // Same `heldByAgent` field the expanded card's own
                // `onHoldElapsed` line above already reads directly off
                // Per bug report ("when an unknown customer is dialed,
                // the collapsed interactionNavItem should display a user
                // icon - this was fixed a while ago not sure why it's
                // back"): the collapsed tile's own `customerIdentified`
                // (below, at this card's `InteractionNavCard`) used to
                // check only `!interaction.id.startsWith("adhoc:")` — but
                // a fresh quick-dial to an unmatched number gets a
                // `quickdial:`-prefixed id (`handleStartCall`, above), and
                // a redial with no real contact gets `redial:` (`handleRedial`,
                // above), neither of which is `adhoc:` — so both silently
                // read as "identified" and showed meaningless
                // phone-number-derived initials instead of the generic
                // `User` fallback. Same general, precise "is this a real
                // customer" signal `activeInteractionIsRealCustomer`
                // (above) already established for the record header/etc.,
                // just re-derived per-card here since this loop iterates
                // every interaction, not only the active one.
                const cardIsRealCustomer =
                  CREATE_NEW_CUSTOMERS.some((c) => c.id === interaction.entityId) ||
                  createdCustomerRecords.some((c) => c.id === interaction.entityId) ||
                  !!interaction.entityId?.startsWith("history:") ||
                  scenarioKeyOf(interaction.id) === LUCAS_THOMAS_ID;
                // `interaction.threads` — re-derived here (not from
                // `cardOpenChannels`, which a closed/resolved held call
                // would already have dropped out of) since a collapsed
                // card's badge should keep showing "on hold" for as long as
                // the live call controls bar itself would.
                const cardOnHold = interaction.threads.some((c) => c.type === "voice" && c.heldByAgent);
                // Per explicit follow-up request ("when a call is put on
                // hold use the hold time in the collapsed
                // interactionNavItem") — the same `c.heldSinceTick` the
                // expanded card's own `onHoldElapsed` line reads (above),
                // re-derived here for whichever thread `cardOnHold` just
                // found. `undefined` whenever nothing's actually held,
                // which is exactly when the plain `elapsed` computation
                // below should be used instead (see that prop's own call
                // site further down).
                const cardHeldSinceTick = interaction.threads.find(
                  (c) => c.type === "voice" && c.heldByAgent
                )?.heldSinceTick;
                return (
                  <InteractionNavCard
                    hideChip={hideChip}
                    // While the call is unanswered and the nav is collapsed, show the hover preview automatically.
                    forceHoverOpen={!!interaction.offered}
                    key={interaction.id}
                    currentChannelType={currentChannelType}
                    showChannelBadge={channels.length <= 1}
                    cardOnHold={cardOnHold}
                    cardHoldSeverity={cardHeldSinceTick !== undefined ? getHoldSeverity(clockTick - cardHeldSinceTick) : undefined}
                    // `InteractionNavItem`'s OWN `onHold` prop (lyra-ui) —
                    // distinct from `cardOnHold` just above (this file's
                    // own wrapper prop, forwarded only to
                    // `CollapsedChannelBadge`). Flows through `itemProps`
                    // to `InteractionNavItem` itself, which per explicit
                    // follow-up request ("make the hold counter red in the
                    // collapsed interactionNavItem") now also recolors the
                    // collapsed tile's own elapsed-time text red while
                    // true — see that prop's own doc comment
                    // (interaction-nav-item.tsx) — on top of the
                    // border/background treatment it already drove on the
                    // EXPANDED card.
                    onHold={cardOnHold}
                    // Same `cardAwaitingWaitSeconds`/`getAwaitingSeverity`
                    // this card's own `awaitingSeverity` prop below already
                    // resolves — reused, not recomputed, so a single-channel
                    // card's collapsed badge escalates in lockstep with
                    // everything else reading this card's severity (the
                    // avatar/border, the elapsed timer, the corner dot).
                    badgeSeverity={cardAwaitingWaitSeconds !== undefined ? getAwaitingSeverity(cardAwaitingWaitSeconds) : undefined}
                    customerName={kind?.name ?? interaction.customerName}
                    // `cardIsRealCustomer` (just above, in this same
                    // `.map()`) — was a narrow `!id.startsWith("adhoc:")`
                    // check that missed the `quickdial:`/`redial:`
                    // synthetic-id cases (see that const's own doc
                    // comment for the bug this fixes). Tells the compact
                    // tile to show a generic `User` icon in its avatar
                    // instead of deriving meaningless initials off a raw
                    // dialed number — `customerName` itself is untouched,
                    // so the card's title text still reads as the address.
                    customerIdentified={kind?.identified ?? cardIsRealCustomer}
                    // Per explicit request ("add the new badge to any
                    // unread assignments (assignments that haven't been
                    // clicked on yet)") — see `useNewAssignments` for what
                    // counts as "clicked".
                    isNewAssignment={isNewAssignment(interaction.id)}
                    active={activeInteractionId === interaction.id}
                    // Exits fullscreen directly here (not just via the
                    // `activeInteractionId`-keyed effect near
                    // `panelFullScreen`'s own declaration) because clicking
                    // the ALREADY-active card sets the same id — no value
                    // change, so that effect wouldn't fire, and the click
                    // would otherwise silently do nothing while the shared
                    // panel is covering the content the agent just clicked
                    // to see. Harmless/redundant on a real switch, where
                    // the effect would already handle it.
                    onClick={() => {
                      switchActiveInteraction(interaction.id);
                      setPanelFullScreen(false);
                    }}
                    // A ringing offer gets the awaiting-reply look on its
                    // answer SLA (profile thresholds): timer and border turn
                    // warning, then critical, while it goes unanswered.
                    awaitingResponse={!!interaction.offered || cardAwaitingChannels.length > 0}
                    awaitingSeverity={cardSlaSeverity}
                    // The new-assignment dot takes the same answer/awaiting
                    // SLA tier as the chip and outline: green within target,
                    // amber at warning, red once breached. When it shows is
                    // unchanged (`isNewAssignment`).
                    newAssignmentSeverity={cardSlaSeverity ?? "success"}
                    // "" (not a fallback duration) once every channel on
                    // this card is closed — see `cardOpenChannels`'s own doc
                    // comment above for why `earliestStart` is `undefined`
                    // in that case. `InteractionNavItem` (lyra-ui) skips
                    // rendering the elapsed span entirely for an empty
                    // string, so the counter itself disappears rather than
                    // showing a stale/frozen time.
                    // While on hold, the collapsed tile's own timer
                    // switches to counting the HOLD time (same reasoning
                    // as `cardHeldSinceTick`'s own doc comment above) —
                    // matching what the docked call-controls footer
                    // already shows ("On hold 00:04") instead of the
                    // total call duration the plain `elapsed` computation
                    // below would otherwise keep showing. Falls back to
                    // that plain computation whenever nothing's held
                    // (`cardHeldSinceTick === undefined`), exactly as
                    // before this feature existed.
                    elapsed={
                      cardHeldSinceTick !== undefined
                        ? formatElapsedTime(clockTick - cardHeldSinceTick)
                        : earliestStart !== undefined
                        ? formatElapsedTime(cardAwaitingWaitSeconds ?? clockTick - earliestStart)
                        : ""
                    }
                    expanded={slotExpanded ?? navOpen}
                    channels={channels}
                    onDismiss={() => confirmDismiss(() => handleDismissInteraction(interaction.id))}
                    onDismissChannel={(channel) => confirmDismiss(() => handleDismissChannel(interaction.id, channel))}
                    footerAction={
                      kind ? (
                        kind.row
                      ) : interaction.offered ? (
                        // A ringing offer: a call (P0.5d.1, P0.5c's Tom) or a digital one with Auto-accept off.
                        <IncomingOfferActions
                          onAccept={() => void incomingOffer.accept(interaction)}
                          onDecline={incomingOffer.canDecline ? () => void incomingOffer.decline(interaction) : undefined}
                        />
                      ) : undefined
                    }
                    // The card's "+" (add channel): the same control as the record header's (k6 1).
                    headerAction={kind ? undefined : addChannelActionFor(interaction)}
                    // Renders side by side with `collapsible`'s own
                    // expand/collapse chevron, rather than being replaced
                    // by it — see `InteractionNavItem`'s own `collapsible`
                    // doc comment (interaction-nav-item.tsx) for the shared
                    // slot's current behavior. Off with Settings →
                    // "Don't allow interactions to collapse".
                    collapsible={!noInteractionCollapse}
                    // "Collapse all"/"Expand all" (`AssignmentsExpandCollapseAllButton`
                    // above) — see `channelsAllExpanded`'s own doc comment
                    // near its declaration for why this is a one-shot
                    // `{ expanded, version }` override object rather than a
                    // plain controlled boolean.
                    // While collapsed (after "Collapse all") only the active
                    // card stays open: the version's low bit flips when this
                    // card gains or loses the active slot, which re-applies
                    // the override. Expanded keeps the plain even version.
                    channelsExpandedOverride={{ expanded: overrideExpanded, version: overrideBase * 2 + (restoring && mounted ? 1 : 0) }}
                    // Mirrors this card's own expanded state up into
                    // `channelsExpandedById` — see that state's own doc
                    // comment for why (catching up
                    // `AssignmentsExpandCollapseAllButton`'s own label once
                    // every card happens to agree by hand).
                    onChannelsExpandedChange={(expanded) => {
                      if (!firstReportSkipped.current) {
                        firstReportSkipped.current = true;
                        return;
                      }
                      setChannelsExpandedById((prev) =>
                        prev[interaction.id] === expanded ? prev : { ...prev, [interaction.id]: expanded }
                      );
                    }}
                    // Kept in sync with the ChannelToggle bar in this
                    // interaction's record-header PageHeader — see
                    // Interaction.currentChannelId's own doc comment.
                    currentChannelKey={currentId}
                    onCurrentChannelChange={(key) => selectPanel({ kind: "thread", cardId: interaction.id, key })}
                  />
                );
}
