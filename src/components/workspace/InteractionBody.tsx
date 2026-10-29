import { InlineNotification } from "@nicecxone/lyra-ui";
import {
  AiWorkspaceColumn,
  ThreadCrossFade,
  VoiceWrapUpCard,
  outcomeDraftKey as outcomeDraftKeyOf,
  showsSessionControls,
} from "@/contact-handling";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { LUCAS_THOMAS_ID, MARCUS_WEBB_ID, MAYA_CHEN_CALL_ID } from "@/contact-handling/scenario-cases";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { useCanvasRegions } from "@/contact-handling/useCanvasRegions";
import { copilotChipsFor, withNextBestActionChip } from "@/contact-handling/next-best-action";
import { ReferenceSlot } from "./ReferenceSlot";
import { HistoryConversationView } from "@/components/customer-info";
import { InteractionComposer, InteractionTranscript } from "@/components/transcript/InteractionTranscript";
import type { TomLewisCallPanelKey } from "@/components/agent-next-gen-lucas-thomas-panels";
import { VideoCallFullScreen } from "@/components/agent-next-gen-video-window";
import { MARCUS_WEBB_SCRIPT } from "@/scenarios/scripts/marcus-webb";
import {
  MAYA_CHEN_CALL_COPILOT_LINKS,
  MAYA_CHEN_CALL_COPILOT_SUGGESTIONS,
  TOM_LEWIS_CALL_COPILOT_LINKS,
  TOM_LEWIS_CALL_COPILOT_SUGGESTIONS,
} from "./workspace-constants";

/** The active interaction's body (P-EXTRACT C8, from the page): the SLA and
 *  closed notices, the main transcript (or the AI workspace column under
 *  AI display "main"), full-screen video, and the composers. */
export function InteractionBody() {
  const {
    activeChannel, activeChannelAwaitingSeverity, activeChannelHoldSeverity, activeChannelIsNewOutboundThread,
    activeChannelKey, activeChannelStatus, activeChannelType, activeInteraction, activeInteractionIsRealCustomer,
    activeWrapUpThread, aiFeedCount, aiFollowSignal, aiInPanel, aiWorkspaceMain, assignmentsSettings, calling,
    confirmDismiss, contactStateById, copilotComposerProps, copilotDock, copilotHost, copilotSlot,
    customerTyping, focusCustomerPanelTab, handleCopilotAsk, handleDismissChannel,
    handleDismissInteraction, handleInteractionStatusChange, handleLucasApprovalDecision, handleLucasCallRequest,
    handleLucasTakeover, handleSendEmailDraft, handleSendMessage, hideAiActions, historyConversationForActive,
    isColdCallId, isHistoryConversationView, liveVoiceCallInteraction, lucasActiveLinkKey, lucasThomasReviewing,
    marcusWebbReviewing, botHolds,
    openDetailPanelContent, outcomeConfigFor, outcomeDrafts, panelPlacement, renderAiPanelFeed, requestNextBestAction,
    scenarioCases, scenarioKeyOf, scenarioThreadOf, setHideAiActions,
    setVoiceVideoFullScreen, setVoiceVideoWindowOpen, snapshotLinkHandlerFor, stripAiInPanel, threadOutcomeProps,
    viewSessionDetails, voiceVideoFullScreen, voiceVideoWindowOpen, sessionRowHost, sessionRowInHeader,
    transcriptHidden, setTranscriptHidden, transcriptToggleShown,
  } = useWorkspace();
  // A call's "Hide Transcript" switch (AI display inline, voice; P-CANVAS), beside "Hide AI Actions".
  const transcriptSwitch = { hideTranscript: transcriptHidden, onHideTranscriptChange: transcriptToggleShown ? setTranscriptHidden : undefined };
  // P-CANVAS: under AI display inline and main, the action cells around the
  // conversation and the reference column come from the canvas registry.
  const canvas = useCanvasRegions();
  if (!activeInteraction) return null;
  return (
                  <div className="relative flex flex-1 overflow-hidden">
                      <div
                        className="relative flex flex-1 flex-col min-w-0 overflow-hidden"
                        data-main-thread={panelPlacement ? "ai" : activeChannelType}
                        data-canvas-region={canvas.enabled ? "action" : undefined}
                      >
                        <ThreadCrossFade transitionKey={panelPlacement ? undefined : activeChannelKey} groupKey={activeInteraction.id} />                        {/* P-CANVAS: the pinned action cells (the Next Best Action), above the conversation's scroll. */}
                        {canvas.pinned && (
                          <div className="mx-auto flex w-full max-w-[768px] shrink-0 flex-col gap-3 px-6 pt-4" data-slot="canvas-pinned">
                            {canvas.pinned}
                          </div>
                        )}
                        {isHistoryConversationView && historyConversationForActive ? (
                          /* Past-session conversation, opened as its own tab in
                             this record area (see the history `Tab` in the
                             header row above) — replaces the live transcript/
                             composer while active. Read-only by nature: it's
                             an archived session, so no composer renders. */
                          <HistoryConversationView entry={historyConversationForActive.entry} />
                        ) : (
                        <>
                        {/* Wraps just the notices + transcript — see
                            AgentNextGenPage.tsx's identical wrapper for the
                            full "why `relative`, why NOT the composer/
                            VoiceCallControls bar too" reasoning. */}
                        <div className="relative flex flex-1 flex-col min-w-0 overflow-hidden">
                        {/* Reopened-from-history, closed interaction — read-only
                            notice. See `Interaction.closed`'s own doc
                            comment for the full picture (also drives hiding
                            `InteractionComposer` below and every channel's
                            kebab, both in this column and in the LeftNav
                            card/ChannelToggleGroup above). */}
                        {activeInteraction.closed && (
                          <div className="shrink-0 px-6 pt-4">
                            <InlineNotification variant="info">
                              You are viewing a closed interaction.
                            </InlineNotification>
                          </div>
                        )}
                        {/* Distinct from the read-only "closed interaction" notice
                            above — this is for a still-open assignment where just
                            THIS ONE channel has been set to "Closed" via the status
                            popover (see `Interaction.channelStatuses`'s own
                            doc comment). The agent can still switch to any other
                            (open, or not-yet-opened) channel on this same card
                            normally; only this specific channel's own composer
                            hides, per explicit request. */}
                        {!activeInteraction.closed && activeChannelStatus === "Closed" && (
                          <div className="shrink-0 px-6 pt-4">
                            <InlineNotification variant="info">
                              This channel is closed. Click Add Channel above and select the
                              appropriate channel to re-open the conversation.
                            </InlineNotification>
                          </div>
                        )}
                        {/* SLA banner — same `activeChannelAwaitingSeverity`
                            signal the record-header tab's own icon/color and
                            the LeftNav card's own dot already reflect for
                            this exact channel (see that derived value's own
                            doc comment above), just surfaced here as an
                            actual message too instead of relying on color
                            alone. Only for "warning"/"critical" — the green
                            "success" tier (customer just responded, still
                            well within SLA) isn't something worth an actual
                            banner over, same as "not awaiting at all"
                            (`undefined`) isn't. Also gated on "Resolved",
                            not just "Closed"/`activeInteraction.closed` —
                            per explicit request, a resolved channel stops
                            counting toward SLA (this banner included)
                            without being closed out: `activeChannel.
                            awaitingResponse` itself is never cleared by a
                            status change (see `handleInteractionStatusChange`'s
                            own doc comment — it only ever writes
                            `threadStatuses`), so without this explicit
                            check the banner could still fire for a channel
                            that was awaiting right up until the agent
                            marked it Resolved. */}
                        {!activeInteraction.closed &&
                          activeChannelStatus !== "Closed" &&
                          activeChannelStatus !== "Resolved" &&
                          (activeChannelAwaitingSeverity === "warning" || activeChannelAwaitingSeverity === "critical") && (
                          <div className="shrink-0 px-6 pt-4">
                            <InlineNotification variant={activeChannelAwaitingSeverity === "critical" ? "error" : "warning"}>
                              {activeChannelAwaitingSeverity === "critical"
                                ? "Agent has breached SLA time."
                                : "Agent is nearing SLA breach."}
                            </InlineNotification>
                          </div>
                        )}
                        {/* Hold SLA banner — voice calls on hold: same inline
                            alert style as the chat SLA banner above, warning
                            at 15s on hold, error at 30s. */}
                        {!activeInteraction.closed &&
                          !activeInteraction.voiceCallEnded &&
                          (activeChannelHoldSeverity === "warning" || activeChannelHoldSeverity === "critical") && (
                          <div className="shrink-0 px-6 pt-4">
                            <InlineNotification variant={activeChannelHoldSeverity === "critical" ? "error" : "warning"}>
                              {activeChannelHoldSeverity === "critical"
                                ? "Agent has breached hold time SLA."
                                : "Agent is nearing hold time SLA breach."}
                            </InlineNotification>
                          </div>
                        )}
                        {/* AI display "main": the session row is the panel thread's, in the panel's header (k5 B), and the
                            main column has no transcript. Contact Details' Session tab derives the thread's current session
                            (`currentSessionOf`) instead of a hidden copy of this transcript reporting it (P-EXTRACT, Bug 1). */}
                        {!aiWorkspaceMain && (
                        <InteractionTranscript
                          hideAiActions={hideAiActions}
                          hideTranscript={transcriptHidden}
                          hideMockFollowUpMessages={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID}
                          // The current session's row is the record header's second line (its own host there).
                          sessionRowPortalTarget={sessionRowInHeader ? sessionRowHost : undefined}
                          // Voice wrap-up (P0.5d.1): while this card's call is
                          // in wrap-up (agent or customer hang-up), its
                          // wrap-up card is the last item in the scrolling
                          // content, whichever channel is selected; it
                          // scrolls into view once, then scrolls with the
                          // conversation. It leaves once the outcome is saved.
                          // Under inline it's the canvas's bottom cells (the wrap-up card is one).
                          trailingContent={
                            canvas.enabled ? (
                              canvas.bottom
                            ) : activeWrapUpThread ? (
                              <VoiceWrapUpCard outcome={outcomeConfigFor(activeInteraction, activeWrapUpThread, "inline")} />
                            ) : undefined
                          }
                          trailingContentKey={
                            activeWrapUpThread
                              ? `wrap-up:${activeInteraction.id}:${activeWrapUpThread.providerInteractionId ?? activeWrapUpThread.id}`
                              : undefined
                          }
                          channelType={activeChannelType}
                          // Feeds `TranscriptSessionSeparator`'s
                          // direction-aware voice/SMS icon. Per explicit
                          // request ("update the voice directions to
                          // indicate inbound or outbound like in Phase 1")
                          // — see `InteractionTranscript`'s own `direction`
                          // prop doc comment (agent-next-gen-transcript.tsx)
                          // and `AgentNextGenPage.tsx`'s identical call site.
                          direction={activeChannel?.direction}
                          customerName={activeInteraction.customerName}
                          // The active Thread's own base Contact id — falls
                          // back to the Customer ID only for the handful of
                          // non-outbound-originated flows whose Thread never
                          // set `contactId` (see that field's own doc
                          // comment on `Thread`) — a real Contact id is
                          // always preferred when one exists.
                          contactId={activeChannel?.contactId ?? activeInteraction.customerId}
                          // Per explicit request ("display the phone
                          // number instead of the contact ID in the
                          // session row") — see `InteractionTranscript`'s
                          // own `channelAddressLabel` prop doc comment
                          // (agent-next-gen-transcript.tsx) and
                          // AgentWorkspace2WithDeskPage.tsx's identical
                          // wiring.
                          channelAddressLabel={activeChannel?.addressLabel}
                          // Per explicit request ("rename the view details
                          // link 'Session Details'") — see
                          // `InteractionTranscript`'s own
                          // `viewDetailsLabel` prop doc comment
                          // (agent-next-gen-transcript.tsx). The only Phase
                          // 1 call site that actually renders this link at
                          // all (`showViewDetails` defaults `true` here,
                          // unlike every other call site on this page).
                          viewDetailsLabel="Session Details"
                          skillLabel={activeChannel?.preview}
                          // Per-Thread — see `Thread.startedFresh`'s own doc
                          // comment for why this reads the ACTIVE channel's
                          // own flag, not `activeInteraction.startedFresh`.
                          isFreshLaunch={!!activeChannel?.startedFresh}
                          // Per explicit request: mirrors `isFreshLaunch`'s
                          // own gating just above — see AgentNextGenPage.tsx's
                          // identical wiring for the full reasoning. Gated on
                          // `activeInteractionIsRealCustomer` (above) so a
                          // contact with no backing `CREATE_NEW_CUSTOMERS`/
                          // `createdCustomerRecords`/Contact History entry
                          // never gets fabricated content — a genuinely
                          // brand-new contact reads as a plain first contact
                          // instead. No longer ALSO gated on
                          // `activeChannel?.startedFresh` — see
                          // AgentNextGenPage.tsx's identical gate for the
                          // full reasoning (a real customer's overview now
                          // shows for an existing-conversation/transfer
                          // pickup too, just repositioned by
                          // `InteractionTranscript`'s own `isFreshLaunch`
                          // check).
                          // Per explicit request ("display the AI accordions
                          // in the place of the Context Overview... mirror
                          // Phase 1 functionality"): replaces the old plain
                          // `contactOverview` block with the same
                          // `customerContextOverview` prop AgentNextGenPage.tsx
                          // ("Phase 1") already passes at its own three
                          // `<InteractionTranscript>` call sites — renders the
                          // Customer Profile / Customer Snapshot / Next Best
                          // Action accordion cards (lyra-ui's
                          // `CustomerContextOverview`) instead of the original
                          // `ContactOverview` block. `undefined` for an
                          // unknown contact (`customerContextOverviewInfo`'s
                          // own `!isKnownCustomer` branch never sets
                          // `customerCard`, but the whole prop still needs to
                          // be present/absent to select the right branch in
                          // `renderContactOverviewBlock`, agent-next-gen-
                          // transcript.tsx) — matches this file's own prior
                          // `activeInteractionIsRealCustomer` gate.
                          //
                          // NOTE: this drops the bespoke "Journey Summary"
                          // card the old block added via `buildCopilotSummary`
                          // — Phase 1's `CustomerContextOverviewInfo` shape has
                          // no equivalent slot for it, and fully mirroring
                          // Phase 1 (as explicitly requested) means this
                          // content no longer renders here.
                          // The AI overview: under inline the canvas's top cells (P-CANVAS: Marcus's card, and under
                          // "stacked" the reference cards). AI display "panel" moves it to the panel.
                          overview={canvas.enabled ? canvas.top : undefined}
                          // "View customer info" — per explicit request
                          // ("match the customer info side panel content
                          // to what is currently in phase 1 (clicking
                          // view customer info opens the customer
                          // information within the side panel)"): now
                          // gated on `activeInteractionIsRealCustomer`
                          // (previously unconditional), mirroring
                          // AgentNextGenPage.tsx's identical gate on its
                          // own equivalent call site — see
                          // `focusCustomerPanelTab`'s own doc comment for
                          // what it now does. No `onViewInteractionHistory`
                          // here (this page's panel tabs never include
                          // "Contacts" either, whether the interaction is
                          // a real customer or not — see the `tabs` prop
                          // at this page's own `CustomerInformationSidePanel`
                          // call site).
                          onViewCustomerInfo={
                            activeInteractionIsRealCustomer ? focusCustomerPanelTab : undefined
                          }
                          // Per explicit request/follow-up clarification —
                          // see `activeChannelIsNewOutboundThread`'s own
                          // doc comment above for the full reasoning.
                          isNewThread={activeChannelIsNewOutboundThread}
                          // An outbound email draft's temporary Send (E2; P-PARKED's composer replaces it).
                          onSendDraft={activeChannelType === "email" ? () => handleSendEmailDraft(activeInteraction.id, activeChannelKey) : undefined}
                          // Per explicit follow-up request ("let's update
                          // the channel controls to always be in the
                          // session row - even if there is only one channel
                          // open (no tabs) - moving them around is
                          // confusing"): was `showChannelTabRow` — this
                          // cluster used to relocate up into the record
                          // header whenever there was only 1 channel open
                          // and only live here once a 2nd channel made the
                          // real tab row appear. Now always on — this
                          // session row is the single, permanent home for
                          // these controls regardless of channel count; the
                          // header's own now-removed copy is gone (see the
                          // record-header `actions` call site above).
                          // Hidden while the call is still ringing.
                          showSessionActionCluster={showsSessionControls(activeInteraction)}
                          // Per explicit follow-up request ("hide the add
                          // participant icon button and for all interactions
                          // move the transfer inside the 3 dots menu - move
                          // the 3 dots to the left of the outcome button and
                          // move the status chip to the left of the 3 dots
                          // button") — three new, Advanced-only props on the
                          // shared `agent-next-gen-transcript.tsx` component
                          // (see each one's own doc comment there): Add
                          // Participant hidden outright, Consult/Transfer
                          // folded into the kebab's own menu instead of its
                          // own icon, and the status tag/kebab/Outcome
                          // reordered to render in that sequence. Applied
                          // unconditionally here (not gated by channel type)
                          // per "for all interactions".
                          showSessionAddParticipant={false}
                          sessionTransferInKebabMenu
                          sessionStatusAndKebabBeforeOutcome
                          // Per explicit follow-up request ("remove the
                          // more options for phase 1 - these will not be
                          // available until phase 2") — `showSessionKebabMenu`
                          // defaults to `true` (`InteractionTranscript`'s own
                          // default, agent-next-gen-transcript.tsx); `false`
                          // hides this session row's own kebab outright,
                          // mirroring the identical `showKebab: false` change
                          // at the LeftNav's own `ChannelRow` channel mapping
                          // above (same request, same reasoning — nothing
                          // behind either kebab is ready for this phase yet).
                          // `sessionTransferInKebabMenu` just above is left
                          // as-is rather than removed too — with the kebab
                          // itself hidden it's simply inert (nothing left to
                          // fold Consult/Transfer into), so Phase 2 (which
                          // still wants this exact prop combination) doesn't
                          // need it re-added later.
                          showSessionKebabMenu={false}
                          // Per explicit request: while reviewing Marcus
                          // Webb's still-live AI-agent conversation, the
                          // status chip/kebab/Outcome button are locked
                          // (visible but non-interactive) until the agent
                          // takes over — same `MARCUS_WEBB_ID &&
                          // marcusWebbReviewing` guard already used
                          // elsewhere in this file for this exact state
                          // (e.g. the hang-up button, the review `ActionBar`
                          // itself).
                          reopenedContacts={activeChannel?.reopenedContacts}
                          // Per explicit follow-up request ("do not have the
                          // transcript appear in the main content area"):
                          // this is the main record column's own
                          // `InteractionTranscript` instance, always
                          // mounted here regardless of channel type — unlike
                          // the two Transcript-tab instances (session
                          // details panel + its hover-preview twin, both
                          // explicitly gated on `customerPanelActiveTab ===
                          // "Transcript" && activeChannelType === "voice"`),
                          // this one has no such gate, so a voice thread's
                          // `liveMessages` (e.g. Marcus's call transcript, from
                          // the store under his voice thread's key) would
                          // otherwise leak into the main column too. Excluded here for voice
                          // specifically — chat/sms/whatsapp still get their
                          // live messages here same as before, since that's
                          // the exact mechanism this column's own
                          // conversation view is built on.
                          sessionControlsReadOnly={botHolds(activeInteraction.id)}
                          // Every thread, a call included (k5): its transcript, with its AI rows inline (AI display inline) or in Contact Details (panel).
                          liveMessages={stripAiInPanel(activeInteraction.liveMessages?.[activeChannelKey] ?? [])}
                          // See `customerTyping`'s own doc comment above —
                          // scoped to whichever channel is ACTIVE right now,
                          // same reasoning `applyToChannel` itself already
                          // uses for `channelKeyAtSend`.
                          // A scripted case's typing comes from the store (P0.5c).
                          isCustomerTyping={
                            !!customerTyping[`${activeInteraction.id}:${activeChannelKey}`] ||
                            !!scenarioThreadOf(activeInteraction.id, activeChannelKey)?.customerTyping
                          }
                          isAiTyping={!!scenarioThreadOf(activeInteraction.id, activeChannelKey)?.aiTyping}
                          onApprovalDecision={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID ? handleLucasApprovalDecision : undefined}
                          onApprovalCallRequest={
                            scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID && calling.elevation ? handleLucasCallRequest : undefined
                          }
                          onWrapUpComplete={
                            scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID
                              ? () => scenarioCases.respond(LUCAS_THOMAS_ID, { value: "complete" })
                              : undefined
                          }
                          approvalTakenOver={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID && !lucasThomasReviewing}
                          onApprovalSuggestionAsk={
                            scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID
                              ? (text: string) => handleCopilotAsk(activeInteraction.id, activeChannelKey, text)
                              : undefined
                          }
                          // AI-led cases always keep the Autosummary above the conversation, even when the transcript remounts with messages already present.
                          contactOverviewPosition={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID || scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID || isColdCallId(activeInteraction.id) ? "top" : undefined}
                          activeSnapshotLink={lucasActiveLinkKey}
                          onSnapshotLink={snapshotLinkHandlerFor(activeInteraction.id)}
                          // Same union of conditions the "closed
                          // interaction"/"channel closed" banners just above
                          // this transcript already gate on — see `dimmed`'s
                          // own doc comment for why both, not just one.
                          dimmed={!!activeInteraction.closed || activeChannelStatus === "Closed"}
                          currentStatus={activeChannelStatus}
                          onCurrentStatusChange={(status) =>
                            activeChannel && handleInteractionStatusChange(activeInteraction.id, activeChannel.id, status)
                          }
                          // The session row's Outcome: the same shared draft the LeftNav's `ChannelRow` uses for this channel.
                          {...threadOutcomeProps(activeInteraction, activeChannel)}
                          // Same dismiss logic `ChannelTab`'s own kebab
                          // "Unassign & Dismiss" entry uses for this exact
                          // channel — dismiss just the channel while others
                          // remain open, or the whole interaction once this
                          // is the last one. Per explicit follow-up request
                          // ("also remove the unassign and dismiss icon
                          // button while the call is on") — hidden
                          // (`undefined`) while a voice call is still live,
                          // same as the LeftNav `ChannelRow` config's own
                          // `showDismissButton` just above; mirrors
                          // `AgentNextGenPage.tsx`'s own identical gating.
                          // Same Marcus-only exception as that LeftNav copy
                          // too — once his channel reads "Resolved," this
                          // icon (here, "the top right of the contact")
                          // doesn't have to wait for the call to actually be
                          // hung up either. Per a later explicit follow-up
                          // request: once the call has actually ended,
                          // "Save & Dismiss" in the Outcome popover replaces
                          // this icon entirely — so unlike before, this no
                          // longer shows again once `voiceCallEnded` is true
                          // (the `closed`-reopened-from-history branch, i.e.
                          // "Remove from Queue", and the live Marcus
                          // exception are both preserved unchanged).
                          onDismissChannel={
                            assignmentsSettings.allowUnassignDismiss &&
                            activeChannel &&
                            // A draft can always be discarded (k6 9). Otherwise the nav row's rule: a digital channel is
                            // removable by hand only once its contact has ended (or it's Closed) or its outcome is saved.
                            (activeChannelIsNewOutboundThread || ((activeChannelType === "voice" ||
                              activeChannelStatus === "Closed" ||
                              !!activeInteraction.closed ||
                              ["wrap-up", "ended"].includes(contactStateById.get(activeChannel.providerInteractionId ?? "") ?? "") ||
                              outcomeDrafts.isSaved(outcomeDraftKeyOf(activeInteraction.id, activeChannelKey))) &&
                            (activeChannelType !== "voice" ||
                              activeInteraction.closed ||
                              (!activeInteraction.voiceCallEnded &&
                                scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID &&
                                activeChannelStatus === "Resolved"))))
                              ? () =>
                                  confirmDismiss(() => {
                                    if (activeInteraction.threads.length > 1) {
                                      handleDismissChannel(activeInteraction.id, activeChannel);
                                    } else {
                                      handleDismissInteraction(activeInteraction.id);
                                    }
                                  })
                              : undefined
                          }
                          // See AgentNextGenPage.tsx's identical prop for
                          // the full rationale.
                          hideSessionSeparatorFade={
                            activeChannelType === "voice" && voiceVideoWindowOpen && voiceVideoFullScreen
                          }
                          // Per later explicit request ("put the transcript
                          // and session tabs into the new customer
                          // information side panel"): "View Details" now
                          // targets that ONE docked panel's own "Session
                          // Details" tab (`customerPanelActiveTab`/
                          // `sidePanelOpen`) instead of a dedicated,
                          // separate overlay — same toggle semantics as
                          // before (already showing this exact session ->
                          // close; otherwise switch to it and open), minus
                          // the old "close instead of switching tabs when
                          // open on a different tab" quirk, which made
                          // sense for a panel that ONLY ever showed
                          // Details/Transcript/Session but would now also
                          // close the shared Customer Information panel out
                          // from under an agent who simply had it open on
                          // its "Details" accordions for an unrelated
                          // reason.
                          onViewSessionDetails={(session) => viewSessionDetails(activeChannelKey, session)}
                          // Per explicit follow-up request ("move the
                          // details side panel toggle to above the session
                          // row to the right of the voice + button group"),
                          // the "Open Details Panel" toggle (button +
                          // hover-preview `Popover`) moved from this session
                          // row up to the record header's own `actions`
                          // block (`PageHeader`'s call site, above) —
                          // `onToggleDetailsPanel`/`detailsPanelOpen`/
                          // `detailsPanelPreviewContent`/
                          // `detailsPanelPreviewOpen`/
                          // `onDetailsPanelPreviewHoverStart`/
                          // `onDetailsPanelPreviewHoverEnd` are no longer
                          // passed here at all; see that `actions` block's
                          // own doc comment for the full history/reasoning.
                        />
                        )}
                        {aiWorkspaceMain && (
                          <AiWorkspaceColumn
                            // `null`, not undefined, when the canvas has no top cells: undefined would fall back to panel mode's overview.
                            feed={renderAiPanelFeed(canvas.top ?? null)}
                            feedCount={aiFeedCount}
                            followSignal={aiFollowSignal}
                            trailing={canvas.bottom}
                            dock={<HostSlot host={copilotHost} active={copilotSlot === "main"} />}
                          />
                        )}
                        {/* Full-screen video — see AgentNextGenPage.tsx's
                            identical render site for the full rationale. */}
                        {voiceVideoWindowOpen && voiceVideoFullScreen && activeChannelType === "voice" && (
                          <VideoCallFullScreen
                            customerName={activeInteraction.customerName}
                            onExitFullScreen={() => setVoiceVideoFullScreen(false)}
                            // See AgentNextGenPage.tsx's identical prop for
                            // the full rationale.
                            onClose={() => {
                              setVoiceVideoWindowOpen(false);
                              setVoiceVideoFullScreen(false);
                            }}
                            customerIdentified={activeInteractionIsRealCustomer}
                          />
                        )}
                        </div>
                        {/* Every live assignment gets the composer, whatever its
                            channel or script: inline at the bottom of the main
                            column, or (AI display "panel") its Copilot part in
                            the Contact Details footer. Voice and email have no
                            customer chat here, so they get Copilot only. Hidden
                            once the interaction or this thread is closed. The
                            cold calls and Marcus Webb render their own below. */}
                        {activeInteraction &&
                          activeChannelType &&
                          !isColdCallId(activeInteraction.id) &&
                          scenarioKeyOf(activeInteraction.id) !== MARCUS_WEBB_ID &&
                          !activeInteraction.closed &&
                          activeInteraction.threadStatuses?.[activeChannelKey] !== "Closed" &&
                          (
                            <InteractionComposer
                              hideAiActions={hideAiActions}
                              // Only where AI rows interleave with a chat transcript.
                              // Every digital thread in the main column with AI display inline; not voice, panel or "main".
                              onHideAiActionsChange={activeChannelType !== "voice" && !aiInPanel && !panelPlacement ? setHideAiActions : undefined}
                              {...transcriptSwitch}
                              copilotDock={copilotDock}
                              copilotOnly={
                                // Placement "panel": the chat input lives with the thread in the panel.
                                panelPlacement ||
                                activeChannelType === "voice" ||
                                activeChannelType === "email" ||
                                botHolds(activeInteraction.id)
                              }
                              // Only while the AI holds the chat (gone once taken over, in every mode).
                              onTakeover={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID && lucasThomasReviewing ? () => handleLucasTakeover() : undefined}
                              onSend={(text) => handleSendMessage(activeInteraction.id, text, activeChannelKey)}
                              {...copilotComposerProps(activeInteraction.id, activeChannelKey)}
                            />
                          )}
                        {/* Cold call from Tom Lewis: just the Ask Copilot footer (no AI agent to take over from). */}
                        {isColdCallId(activeInteraction.id) && !activeInteraction.offered && (
                          <InteractionComposer
                            copilotOnly
                            copilotDock={copilotDock}
                            {...transcriptSwitch}
                            onSend={() => {}}
                            {...(() => {
                              const chips = {
                                copilotSuggestions: scenarioKeyOf(activeInteraction.id) === MAYA_CHEN_CALL_ID ? MAYA_CHEN_CALL_COPILOT_SUGGESTIONS : TOM_LEWIS_CALL_COPILOT_SUGGESTIONS,
                                copilotSuggestionLinks: scenarioKeyOf(activeInteraction.id) === MAYA_CHEN_CALL_ID ? MAYA_CHEN_CALL_COPILOT_LINKS : TOM_LEWIS_CALL_COPILOT_LINKS,
                                onCopilotSuggestionLink: (key: string) => openDetailPanelContent({ kind: "tom-call", panel: key as TomLewisCallPanelKey }),
                                onCopilotAsk: (text: string) => handleCopilotAsk(activeInteraction.id, activeChannelKey, text),
                              };
                              // The Next Best Action on request (P-CANVAS; every AI display).
                              return withNextBestActionChip(chips, () => requestNextBestAction(activeInteraction.id, activeChannelKey));
                            })()}
                          />
                        )}
                        {scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID && (
                          // Stays after takeover (Ask Copilot only — a voice call has no chat input); the Takeover Call button only while
                          // reviewing. Taking over plays his script's takeover steps (P-SHRINK). Questions and chips are Copilot rows in the
                          // transcript; "Something else" is a free-form question.
                          <InteractionComposer
                            copilotOnly
                            copilotDock={copilotDock}
                            {...transcriptSwitch}
                            takeoverLabel="Takeover Call"
                            takeoverDisabled={!!liveVoiceCallInteraction && scenarioKeyOf(liveVoiceCallInteraction.id) !== MARCUS_WEBB_ID}
                            takeoverDisabledReason="A call is already in progress"
                            onTakeover={marcusWebbReviewing ? () => scenarioCases.takeOver(MARCUS_WEBB_ID, { handoff: true }) : undefined}
                            onSend={() => {}}
                            {...copilotChipsFor(
                              {
                                copilotSuggestions: MARCUS_WEBB_SCRIPT.content.copilot?.suggestions,
                                copilotSuggestionLinks: MARCUS_WEBB_SCRIPT.content.copilot?.links,
                                onCopilotSuggestionLink: (key: string) => snapshotLinkHandlerFor(activeInteraction.id)(key),
                                onCopilotAsk: (text: string) => handleCopilotAsk(activeInteraction.id, activeChannelKey, text),
                              },
                              botHolds(activeInteraction.id),
                              () => requestNextBestAction(activeInteraction.id, activeChannelKey),
                            )}
                          />
                        )}
                        </>
                        )}
                      </div>
                      {/* P-CANVAS: the reference slot — the reference column (two-column canvas only) or a slide-over.
                          Under AI display "panel" there's no column, but Contact Details and Session Details still
                          open here (P-HOME-1n). */}
                      {(canvas.enabled || aiInPanel) && <ReferenceSlot reference={canvas.reference} />}
                      {/* The separate voice/non-voice "Session Details"
                          `InteriorPanel` overlay that used to render here
                          (portaled beside `CustomerInformationSidePanel`)
                          is gone — per later explicit request ("put the
                          transcript and session tabs into the new customer
                          information side panel and rename the side panel
                          Session Details"), its Transcript/Session Details
                          tabs moved INTO that docked panel itself (see its
                          own render site's doc comment, several hundred
                          lines down) instead of living in a second, parallel
                          panel. */}
                  </div>
  );
}
