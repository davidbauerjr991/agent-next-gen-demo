import { InlineNotification } from "@nicecxone/lyra-ui";
import { Minimize2 } from "lucide-react";
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
import { HistoryConversationView } from "@/components/agent-next-gen-customer-info-panel";
import { InteractionComposer, InteractionTranscript } from "@/components/agent-next-gen-transcript";
import type { TomLewisCallPanelKey } from "@/components/agent-next-gen-lucas-thomas-panels";
import { VideoCallFullScreen } from "@/components/agent-next-gen-video-window";
import damagedHeadphonesImg from "@/assets/headphones.jpg";
import {
  MAYA_CHEN_CALL_COPILOT_LINKS,
  MAYA_CHEN_CALL_COPILOT_SUGGESTIONS,
  TOM_LEWIS_CALL_COPILOT_LINKS,
  TOM_LEWIS_CALL_COPILOT_SUGGESTIONS,
} from "./workspace-constants";

/** The active interaction's body (P-EXTRACT C8, from the page): the SLA and
 *  closed notices, the main transcript (or the AI workspace column under
 *  AI display "main"), full-screen video and Marcus's photo, his question
 *  slot, and the composers. */
export function InteractionBody() {
  const {
    activeChannel, activeChannelAwaitingSeverity, activeChannelHoldSeverity, activeChannelIsNewOutboundThread,
    activeChannelKey, activeChannelStatus, activeChannelType, activeInteraction, activeInteractionIsRealCustomer,
    activeWrapUpThread, aiFeedCount, aiFollowSignal, aiInPanel, aiWorkspaceMain, assignmentsSettings, calling,
    confirmDismiss, contactStateById, copilotComposerProps, copilotDock, copilotHost, copilotSlot,
    customerContextOverviewInfo, customerTyping, focusCustomerPanelTab, handleCopilotAsk, handleDismissChannel,
    handleDismissInteraction, handleInteractionStatusChange, handleLucasApprovalDecision, handleLucasCallRequest,
    handleLucasTakeover, handleMarcusCopilotAsk, handleSendEmailDraft, handleSendMessage, hideAiActions, historyConversationForActive,
    isColdCallId, isHistoryConversationView, liveVoiceCallInteraction, lucasActiveLinkKey, lucasThomasReviewing,
    marcusCopilotRequestsRef, marcusQuestionHost, marcusWebbPhotoExpanded, marcusWebbReviewing,
    openDetailPanelContent, outcomeConfigFor, outcomeDrafts, panelPlacement, renderAiOverview, renderAiPanelFeed,
    scenarioCases, scenarioKeyOf, scenarioThreadOf, setHideAiActions, setMarcusWebbPhotoExpanded,
    setVoiceVideoFullScreen, setVoiceVideoWindowOpen, snapshotLinkHandlerFor, stripAiInPanel, threadOutcomeProps,
    viewSessionDetails, voiceVideoFullScreen, voiceVideoWindowOpen,
  } = useWorkspace();
  if (!activeInteraction) return null;
  return (
                  <div className="relative flex flex-1 overflow-hidden">
                      <div className="relative flex flex-1 flex-col min-w-0 overflow-hidden" data-main-thread={panelPlacement ? "ai" : activeChannelType}>
                        <ThreadCrossFade transitionKey={panelPlacement ? undefined : activeChannelKey} groupKey={activeInteraction.id} />
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
                          hideMockFollowUpMessages={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID}
                          // Voice wrap-up (P0.5d.1): while this card's call is
                          // in wrap-up (agent or customer hang-up), its
                          // wrap-up card is the last item in the scrolling
                          // content, whichever channel is selected; it
                          // scrolls into view once, then scrolls with the
                          // conversation. It leaves once the outcome is saved.
                          trailingContent={
                            activeWrapUpThread ? (
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
                          // The AI overview (the Autosummary card, then Marcus's
                          // card), the same as the AI feed's; an unknown caller
                          // gets it when the call carried a pre-contact summary
                          // (P0.5d.1). AI display "panel" moves it to the panel.
                          overview={!aiInPanel ? renderAiOverview() : undefined}
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
                          sessionControlsReadOnly={
                            (scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID && marcusWebbReviewing) ||
                            (scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID && lucasThomasReviewing)
                          }
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
                            feed={renderAiPanelFeed()}
                            feedCount={aiFeedCount}
                            followSignal={aiFollowSignal}
                            customerName={activeInteraction.customerName}
                            customerContextOverview={customerContextOverviewInfo}
                            trailing={activeWrapUpThread && <VoiceWrapUpCard outcome={outcomeConfigFor(activeInteraction, activeWrapUpThread, "inline")} />}
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
                        {/* Reject flow's customer-provided photo "takes
                            over" the MAIN interaction column, same
                            mechanic as the video call full-screen just
                            above — see `marcusWebbPhotoExpanded`'s own doc
                            comment. Never rendered inside the transcript
                            column itself (an earlier pass got this
                            backwards — see `MarcusWebbNextBestActionCard`'s
                            own top doc comment). Per a later explicit
                            request, this is now the real photo
                            (`src/assets/headphones.jpg`) — `object-contain`
                            (not `-cover`, unlike the small thumbnail on the
                            card itself) so the whole image is visible in
                            this larger, full-screen context rather than
                            cropped to fill it.

                            No explicit z-index on the root, and the close
                            button pushed down to `top-14` instead of
                            `top-4` — same fix `VideoCallFullScreen`'s own
                            doc comment already documents for this identical
                            problem (an earlier pass here covered the
                            transcript's own sticky session separator,
                            `TranscriptSessionSeparator`, `sticky top-0
                            z-[1]`, per explicit bug report: "have the full
                            screen image appear under the session row").
                            Leaving this root at z-index:auto lets that
                            separator's own explicit `z-[1]` win any
                            overlap, and `top-14` (56px, past the
                            separator's own single-row height) keeps the
                            close button from ever landing in that same
                            strip in the first place. */}
                        {marcusWebbPhotoExpanded && scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-lyra-bg-surface-inverse">
                            <button
                              type="button"
                              onClick={() => setMarcusWebbPhotoExpanded(false)}
                              aria-label="Exit full screen"
                              className="absolute right-4 top-14 flex h-8 w-8 items-center justify-center rounded-lyra-sm text-lyra-fg-on-primary transition-colors hover:bg-white/10"
                            >
                              <Minimize2 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
                            </button>
                            <img
                              src={damagedHeadphonesImg}
                              alt="Photo of the damaged headphone ear cup"
                              className="max-h-[80%] max-w-[80%] object-contain"
                            />
                          </div>
                        )}
                        </div>
                        {/* Marcus Webb's currently-active question (and the
                            Contact Overview accordion, while one's pending)
                            portal here (see `MarcusWebbNextBestActionCard`'s
                            own `questionSlotElement` doc comment). A real
                            `shrink-0` flex sibling of the transcript wrapper
                            above — NOT `absolute` — per explicit bug report:
                            floating it over the transcript (an earlier
                            attempt, chosen to avoid "scrunching" the
                            transcript's scroll height) instead covered real
                            content behind it (the customer's photo) and, with
                            no scroll mechanism of its own inside an
                            `overflow-hidden` ancestor, silently clipped a
                            tall options list with no way to reach the last
                            option. `max-h-[50vh] overflow-y-auto` is the
                            fix: bounded so the transcript above always keeps
                            a fair share of the column, but scrollable so a
                            tall card is always fully reachable instead of
                            clipped. `empty:hidden` collapses it to nothing
                            (matching the old "costs nothing while idle"
                            behavior) whenever nothing's actually portaled
                            into it. `max-w-[768px] mx-auto px-6` matches the
                            transcript's own centered message column exactly
                            (agent-next-gen-transcript.tsx). */}
                        <HostSlot host={marcusQuestionHost} />
                          {/* Per explicit follow-up request ("remove the
                              AI ask a question from the contact main
                              containers for all interactions"): every
                              interaction OTHER than Marcus Webb used to get
                              an inert "ask a question" field here — fully
                              uncontrolled/inert (no `value`/`onChange`/
                              `onSubmit`), never wired to anything real —
                              instead of this slot just collapsing to
                              nothing. That's gone now; this node exists
                              purely as Marcus Webb's own portal target
                              (`questionSlotElement`, the stable
                              `marcusQuestionHost` this slot holds) for his
                              scripted questions AND his own real ask-flow,
                              elsewhere in this same return when he's
                              active — every other interaction now leaves
                              this slot genuinely empty (the host's
                              `empty:hidden` collapses it to nothing, same as
                              before). */}
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
                              copilotDock={copilotDock}
                              copilotOnly={
                                // Placement "panel": the chat input lives with the thread in the panel.
                                panelPlacement ||
                                activeChannelType === "voice" ||
                                activeChannelType === "email" ||
                                (scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID && lucasThomasReviewing)
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
                            onSend={() => {}}
                            copilotSuggestions={scenarioKeyOf(activeInteraction.id) === MAYA_CHEN_CALL_ID ? MAYA_CHEN_CALL_COPILOT_SUGGESTIONS : TOM_LEWIS_CALL_COPILOT_SUGGESTIONS}
                            copilotSuggestionLinks={scenarioKeyOf(activeInteraction.id) === MAYA_CHEN_CALL_ID ? MAYA_CHEN_CALL_COPILOT_LINKS : TOM_LEWIS_CALL_COPILOT_LINKS}
                            onCopilotSuggestionLink={(key: string) =>
                              openDetailPanelContent({ kind: "tom-call", panel: key as TomLewisCallPanelKey })
                            }
                            onCopilotAsk={(text: string) => handleCopilotAsk(activeInteraction.id, activeChannelKey, text)}
                          />
                        )}
                        {scenarioKeyOf(activeInteraction.id) === MARCUS_WEBB_ID && (
                          // Stays after takeover (Ask Copilot only — a voice call has no chat input); the Takeover Call button only while reviewing.
                          <InteractionComposer
                            copilotOnly
                            copilotDock={copilotDock}
                            takeoverLabel="Takeover Call"
                            takeoverDisabled={!!liveVoiceCallInteraction && scenarioKeyOf(liveVoiceCallInteraction.id) !== MARCUS_WEBB_ID}
                            takeoverDisabledReason="A call is already in progress"
                            onTakeover={marcusWebbReviewing ? () => scenarioCases.takeOver(MARCUS_WEBB_ID, { handoff: false }) : undefined}
                            onSend={() => {}}
                            copilotSuggestions={["Summarize this call", "Show purchase history", "What did the AI agent try?"]}
                            copilotSuggestionLinks={{
                              "Summarize this call": "Summarize this call",
                              "Show purchase history": "Show purchase history",
                              "What did the AI agent try?": "What did the AI agent try?",
                            }}
                            onCopilotAsk={(text: string) =>
                              handleMarcusCopilotAsk(
                                text,
                                ["Summarize this call", "Show purchase history", "What did the AI agent try?"].includes(text) ? undefined : 1800
                              )
                            }
                            onCopilotSuggestionLink={(text: string) => {
                              const req = marcusCopilotRequestsRef.current[marcusCopilotRequestsRef.current.length - 1];
                              if (req) openDetailPanelContent({ kind: "marcus-copilot", ...req });
                            }}
                          />
                        )}
                        </>
                        )}
                      </div>
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
