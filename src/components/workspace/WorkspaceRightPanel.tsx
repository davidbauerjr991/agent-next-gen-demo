import { PanelFooter } from "@nicecxone/lyra-ui";
import { OverviewBody } from "./contact-details-tab-bodies";
import {
  ChannelThreadBody,
  ChannelThreadComposer,
  ChannelThreadSessionRow,
  isDraftThread,
  outcomeDraftKey as outcomeDraftKeyOf,
  threadAcceptsReplies,
} from "@/contact-handling";
import { HostSlot } from "@/contact-handling/portal-hosts";
import { LUCAS_THOMAS_ID } from "@/contact-handling/scenario-cases";
import { useWorkspace } from "@/contact-handling/workspace/WorkspaceContext";
import { AGENT_WORKSPACE_CUSTOMER_PANEL_TABS, CustomerInformationSidePanel } from "@/components/customer-info";
import { ComposerFade } from "@/components/transcript/InteractionTranscript";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/** The right panel (P-EXTRACT C8, from the page): the thread open in it (AI display "main"), or panel mode's AI
 *  Overview, in `CustomerInformationSidePanel` (P-HOME-1n: Contact Details moved to the reference slide-over). Its
 *  wrapper is the slide-over's host in the panel (`rightPanelRef`). */
export function WorkspaceRightPanel() {
  const {
    activeCustomerOverviewEditing, activeCustomerRecordDraft, activeInteraction, contactSubject,
    activeInteractionIsAgentCall, activeInteractionIsRealCustomer, addToast, aiInPanel, channelPreviewMeta, channelPreviewThread,
    channelPreviewThreadKey, channelPreviewThreadStableKey, confirmDismiss, copilotComposerProps,
    copilotDockConcealed, copilotDockShown, copilotHost, copilotSlot,
    effectiveSidePanelPinned, focusCustomerPanelTab,
    handleInteractionStatusChange, handleOutcomeSaveAndDismissChannel,
    handleSendEmailDraft, handleSendMessage, handleSidePanelClose, handleStartCall,
    botHolds, hideAiActions, isSidePanelAtMinimalThreshold,
    onSidePanelHoverEnd, onSidePanelHoverStart, outcomeDrafts,
    panelPlacement,
    rightPanelRef, scenarioKeyOf, setActiveCustomerOverviewEditing,
    setHistoryConversationTab,
    setSidePanelFullScreen, setSidePanelResizing, setSidePanelWidth, showPanelToggle, sidePanelContainerWidth,
    sidePanelFullScreen, sidePanelOpen, sidePanelResizing, sidePanelWidth, threadOutcomeProps,
    viewSessionDetails,
  } = useWorkspace();
  return (
    <>
              {/* Contact Details' subject: a conversation, or a kind cell's customer (P-HOME-1m). */}
              {!activeInteractionIsAgentCall && showPanelToggle && contactSubject && (
                // `key`ed on the assignment's own id, same "force a full
                // remount on every genuine switch" technique the content
                // column further down already uses (see that div's own
                // `animate-in fade-in-0 duration-200 delay-150 fill-mode-
                // backwards` doc comment for the full explanation) —
                // applied here too per explicit follow-up report: an
                // earlier fix suppressed `SidePanel`'s own width/opacity
                // transition instead (a briefly-toggled `!important` CSS
                // class), which stopped it sliding open/shut but replaced
                // that with a different problem — the panel then just
                // snapped into view with no animation at all while the
                // content column beside it was still doing its own soft
                // fade, so the two read as out of sync ("not fading, just
                // appearing").
                //
                // Remounting fixes both at once: a freshly-inserted DOM
                // node has no PRIOR width/opacity value on that same node
                // for `SidePanel`'s own `transition` to animate FROM, so
                // its width-slide never plays (no suppression hack
                // needed) — but a CSS *animation* (unlike a *transition*)
                // still runs from its keyframes at mount regardless, which
                // is exactly what `animate-in fade-in-0` on this wrapper
                // is, so the panel now genuinely fades in, on the same
                // `duration-200 delay-150` timing as the content column,
                // instead of either sliding open or hard-cutting into
                // place.
                //
                // Side effect, expected rather than a regression: this
                // panel's own internal `activeTab` (Overview/Interactions/
                // Detail/Directory — `CustomerInformationSidePanel`'s own
                // `useState(0)`), and the Interactions tab's own
                // `selectedHistoryIndex` (`CustomerInformationPanelBody`),
                // now reset to their defaults on every genuine assignment
                // switch too, since remounting discards them along with
                // everything else in the subtree. Landing on a different
                // customer's Overview tab first, rather than wherever the
                // PREVIOUS customer's panel happened to be left, matches the
                // same "genuinely new context should start from the top"
                // reasoning the outer interaction detail page's own
                // `key={`interaction-${id}`}` remount already establishes.
                //
                // `z-[5]` here (on THIS wrapper, not just relying on
                // `SidePanel`'s own internal `z-[5]`) — per explicit
                // follow-up report: a full-screen restore (this panel
                // unpinned/`position: absolute`, meant to overlay the
                // whole content column) briefly flashed with the
                // transcript visible on top instead of properly
                // underneath. Root cause is a well-known CSS gotcha: ANY
                // element with a live `animation-name` (which `animate-in`
                // sets, permanently, for as long as the class stays on the
                // element — not just while actually mid-play) forms its
                // OWN stacking context, same as `opacity`/`transform`/
                // `filter` do. Before this wrapper existed, `SidePanel`'s
                // own `position: absolute; z-index: 5` sat DIRECTLY in
                // `Container`'s stacking context, at the same explicit-
                // positive-z-index tier as the record header's sticky
                // separator (`z-[1]`), `InteriorPanel` (`z-[3]`), and the
                // shared panel's fullscreen overlay (`z-[9]`) — see those
                // components' own doc comments for this whole tier system.
                // Once wrapped, `z-[5]` on `SidePanel` only orders things
                // INSIDE this new stacking context (nothing else is in
                // here to compete with) — this wrapper itself, having NO
                // z-index of its own, instead got silently pushed down to
                // the plain "z-index: auto" tier alongside the content
                // column sibling next to it, so the two started competing
                // by DOM ORDER instead of by their intended z-index
                // values. Setting `z-[5]` explicitly on this wrapper (a
                // flex item of the `flex flex-1 overflow-hidden min-h-0`
                // row above — z-index applies to flex items without
                // needing `position` set) restores the exact same tier
                // this whole subtree occupied before the wrapper was
                // introduced.
                <div
                  key={`side-panel-${contactSubject.key}`}
                  // `h-full` — explicit, not left to this flex item's own
                  // default cross-axis `align-items: stretch` from its
                  // parent row (`flex flex-1 overflow-hidden min-h-0`,
                  // "Row: Customer Information panel + everything else"
                  // above) — confirmed live as the actual root cause of
                  // the docked panel's own internal scrolling never
                  // engaging (while full-screen/unpinned mode, which
                  // reaches its height via `position: absolute` against
                  // `Container` instead — an unambiguous MAIN-axis
                  // flex-grow box, not cross-axis stretch — worked fine
                  // the whole time). Mirrored one level down on
                  // `SidePanel`'s own pinned-branch outer div
                  // (side-panel.tsx), which had the identical gap.
                  ref={rightPanelRef}
                  className="relative shrink-0 h-full z-[5] animate-in fade-in-0 duration-200 delay-150 fill-mode-backwards"
                  data-slot="right-panel"
                  data-open={sidePanelOpen || !!channelPreviewThreadKey}
                  data-thread={channelPreviewThread?.type ?? "details"}
                >
                <CustomerInformationSidePanel
                  open={sidePanelOpen || !!channelPreviewThreadKey}
                  // Always unpinned (floating overlay) while full-screen —
                  // per explicit request this should overlay the parent
                  // Container, not push the tab row/transcript column over
                  // via docked mode.
                  pinned={sidePanelFullScreen ? false : effectiveSidePanelPinned}
                  // Always shown, even in the narrow-container overlay mode
                  // — per explicit request, an agent who's opened it as a
                  // floating overlay still needs a way to close it again
                  // from inside the panel itself, not just the (now-hidden
                  // while open) header toggle icon.
                  onClose={handleSidePanelClose}
                  fullScreen={sidePanelFullScreen}
                  // Hidden below 350px of container width — see
                  // `isSidePanelAtMinimalThreshold`'s own doc comment.
                  onToggleFullScreen={
                    isSidePanelAtMinimalThreshold ? undefined : () => setSidePanelFullScreen((v) => !v)
                  }
                  onMouseEnter={onSidePanelHoverStart}
                  onMouseLeave={sidePanelResizing ? undefined : onSidePanelHoverEnd}
                  customerName={contactSubject.customerName}
                  recordId={contactSubject.customerId}
                  channels={contactSubject.threads}
                  startedFresh={activeInteraction?.startedFresh}
                  // Per explicit request: a brand-new outbound assignment
                  // NOT associated with a real customer record shows ONLY
                  // the Detail tab (no Overview/Copilot/Notes/etc.) — for
                  // its whole lifetime, based purely on customer identity
                  // (`activeInteractionIsRealCustomer`, see that const's own
                  // doc comment above). An interaction WITH a real customer
                  // record keeps this tier's normal reduced tab set
                  // (`AGENT_WORKSPACE_CUSTOMER_PANEL_TABS` — unlike
                  // Premium, this tier never used the full `CUSTOMER_PANEL_TABS`
                  // set here, so that's what "real customer" keeps, not the
                  // full set).
                  tabs={activeInteractionIsRealCustomer ? AGENT_WORKSPACE_CUSTOMER_PANEL_TABS : (["Detail"] as const)}
                  onOpenHistoryConversation={(entry) =>
                    activeInteraction && setHistoryConversationTab({ interactionId: activeInteraction.id, entry, active: true })
                  }
                  // Full-screen substitutes the parent Container's own
                  // measured width (`sidePanelContainerWidth` — already
                  // tracked for the narrow-container guard) for the normal
                  // drag-resized width, so the panel's unpinned/absolute
                  // rendering covers the whole container edge to edge.
                  width={sidePanelFullScreen ? sidePanelContainerWidth : sidePanelWidth}
                  containerWidth={sidePanelContainerWidth}
                  onWidthChange={setSidePanelWidth}
                  onResizeStateChange={setSidePanelResizing}
                  onAddToast={addToast}
                  recordDraft={activeCustomerRecordDraft}
                  overviewEditing={activeCustomerOverviewEditing}
                  onOverviewEditingChange={setActiveCustomerOverviewEditing}
                  // The old "only open the customer information
                  // automatically if a NEW message appears in the copilot
                  // window" behavior (`onCopilotFirstAvailable`) is gone
                  // along with Copilot itself — see `CustomerInformationSidePanel`'s
                  // own doc comment (agent-next-gen-customer-info-panel.tsx)
                  // for the "stop launching copilot - hide it completely"
                  // fix this prop was removed as part of.
                  onStartInteraction={(contact, channel, phone, skillId) =>
                    handleStartCall({ contact, channel, phone, skillId })
                  }
                  // (No `matchState`: linking an unmatched customer is the reference slide-over's `link-customer`
                  // content, P-HOME-1m/1n; the docked panel holds no Contact Details since P-HOME-1n.)
                  // Per explicit request ("swap the actual content
                  // rendered inside each panel", then later "put the
                  // transcript and session tabs into the new customer
                  // information side panel and rename the side panel
                  // Session Details"): this docked panel now shows the same
                  // Customer Profile/Contact Snapshot/Files accordion
                  // content (`DetailsPanelAccordions`) the voice "Details"
                  // tab used to show exclusively, instead of its own normal
                  // Overview/Detail/Notes tabs — see `bodyOverride`'s own
                  // doc comment (agent-next-gen-customer-info-panel.tsx)
                  // for the fuller "why" — AND, per the later request, the
                  // Transcript (voice only)/Session Details tabs that used
                  // to live in a totally separate "Session Details"
                  // `InteriorPanel` overlay are merged in here too, via
                  // `headerTitleOverride`/`headerTabsOverride` (same
                  // override pattern as `bodyOverride` itself — see each
                  // prop's own doc comment). "View customer info" (both
                  // from the main transcript's Contact Overview and from
                  // this panel's own embedded accordions) just makes sure
                  // this ONE panel is open and on its "Details" tab now
                  // (`focusCustomerPanelTab`, redesigned alongside this
                  // change) — there's no separate surface left to open.
                  // Per explicit follow-up request ("put the content of
                  // the channels IN the side panel (where the contact
                  // details content is now)" / "so a chat opens in that
                  // side panel"): while `channelPreviewThread` is set, it
                  // takes over the title, tabs, body, AND footer below —
                  // this whole panel becomes that channel's preview
                  // instead of Contact Details, exactly like switching
                  // interactions/tabs already replaces this same panel's
                  // content in place (no second panel).
                  // P-HOME-1n: without a thread, the docked panel is panel mode's AI Overview (Contact Details, its
                  // Experience Memory, Artifacts and Customer Info drill-in are in the reference slide-over).
                  headerTitleOverride={channelPreviewThread ? channelPreviewMeta?.label : t("Overview")}
                  // Per explicit request ("move the customer information
                  // content back to the side panel... have a back arrow
                  // next to the Customer's name"): while
                  // `customerPanelActiveTab === "Customer Info"`, this
                  // panel shows the exact same back arrow/record-id
                  // subhead the old floating overlay used to, now routed
                  // through these two new override props instead — see
                  // `headerIconOverride`/`headerSubheadOverride`'s own doc
                  // comments (agent-next-gen-customer-info-panel.tsx).
                  // Guarded on `!channelPreviewThread` explicitly since
                  // neither prop has a pre-existing ternary of its own to
                  // slot into (unlike `headerTitleOverride` above).
                  // The customer's name (the panel's subhead) opens the Customer Info drill-in, now in the slide-over.
                  onViewCustomerInfo={!channelPreviewThread && activeInteractionIsRealCustomer ? focusCustomerPanelTab : undefined}
                  headerTabsOverride={
                    channelPreviewThread && activeInteraction
                      ? panelPlacement && (
                        // AI display "main": the panel thread's session row under the channel name (k5 B).
                        <ChannelThreadSessionRow
                          interaction={activeInteraction}
                          thread={channelPreviewThread}
                          onStatusChange={(status) => handleInteractionStatusChange(activeInteraction.id, channelPreviewThreadStableKey!, status)}
                          onViewSessionDetails={(session) => viewSessionDetails(channelPreviewThreadStableKey!, session)}
                          outcome={threadOutcomeProps(activeInteraction, channelPreviewThread)}
                          controlsReadOnly={botHolds(activeInteraction.id)}
                          // A draft's "Discard draft", or Unassign & Dismiss once its outcome is saved (k6 9).
                          onDismiss={
                            isDraftThread(activeInteraction, channelPreviewThread) ||
                            outcomeDrafts.isSaved(outcomeDraftKeyOf(activeInteraction.id, channelPreviewThreadStableKey!))
                              ? () => confirmDismiss(() => handleOutcomeSaveAndDismissChannel(activeInteraction, channelPreviewThread))
                              : undefined
                          }
                        />
                      )
                      : <></>
                  }
                  // A channel preview's own composer lives here, in
                  // `footerOverride` — same "fixed footer outside the
                  // scrollable body" treatment the Session tab's own
                  // `sessionDetailsTabContent.footer` already gets just
                  // below, rather than being hand-stacked inside
                  // `bodyOverride` itself. No composer at all for email
                  // (its body is just a "Coming soon" placeholder), for
                  // voice (per explicit follow-up request — a voice
                  // preview is just the transcript, same as the main
                  // column's own voice view never gets a composer either
                  // — see `activeChannelType !== "voice"` at that render
                  // site), or once this specific thread has actually
                  // closed.
                  footerOverride={
                    channelPreviewThread && activeInteraction
                      ? threadAcceptsReplies(activeInteraction, channelPreviewThread) &&
                        // An AI-led chat under review has no chat input until the agent takes over.
                        !botHolds(activeInteraction.id)
                        ? (
                          <ChannelThreadComposer
                            hideAiActions={hideAiActions}
                            onSend={(text) => handleSendMessage(activeInteraction.id, text, channelPreviewThreadStableKey!)}
                            copilot={copilotComposerProps(activeInteraction.id, channelPreviewThreadStableKey!)}
                            chatOnly={panelPlacement}
                          />
                        )
                        : undefined
                      : copilotDockShown
                      ? (
                        // "AI in panel": the docked Copilot composer's slot
                        // (the main composer portals into it). Only on the
                        // Details overview; every other tab or sub-page
                        // gives the body the full height.
                        // The inline composer's own top fade (`ComposerFade`),
                        // into the panel's background, so the cards scroll
                        // under it instead of stopping at a hard edge.
                        <PanelFooter
                          align="full"
                          scrollShadow={false}
                          className={cn("relative", copilotDockConcealed && "invisible")}
                          inert={copilotDockConcealed || undefined}
                        >
                          <ComposerFade toClassName="to-lyra-bg-surface-container-subtle" />
                          <div data-slot="copilot-dock" className="w-full">
                            <HostSlot host={copilotHost} active={copilotSlot === "panel-footer"} />
                          </div>
                        </PanelFooter>
                      )
                      : undefined
                  }
                  bodyOverride={
                    channelPreviewThread && activeInteraction ? (
                      <ChannelThreadBody
                        interaction={activeInteraction}
                        thread={channelPreviewThread}
                        hideAiActions={hideAiActions}
                        withoutAiActions={panelPlacement}
                        sessionRowInHeader={panelPlacement}
                        onSendDraft={() => handleSendEmailDraft(activeInteraction.id, channelPreviewThreadStableKey!)}
                        hideMockFollowUpMessages={scenarioKeyOf(activeInteraction.id) === LUCAS_THOMAS_ID}
                        onStatusChange={(status) =>
                          handleInteractionStatusChange(activeInteraction.id, channelPreviewThreadStableKey!, status)
                        }
                      />
                    ) : aiInPanel ? (
                      // Panel mode's AI Overview: the reference cards above the AI feed.
                      <OverviewBody inPreview={false} />
                    ) : null
                  }
                />
                </div>
              )}
    </>
  );
}
