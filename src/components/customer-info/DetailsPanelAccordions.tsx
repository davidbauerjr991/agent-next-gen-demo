import { useState, useRef, useLayoutEffect } from "react";
import type { OverviewInfo } from "@/components/agent-next-gen-shared-utils";
import { ArtifactsSection, CustomerInfoSection, JourneySummarySection, LinkCustomerButton } from "./reference-sections";

/** "AI in panel": bottom padding that keeps the last card clear of the
 *  docked composer's top fade (`ComposerFade`, 32px). */
const AI_FEED_BOTTOM_PADDING_PX = 32;
/** Within this many px of the bottom counts as "at the bottom". */
const AI_FEED_NEAR_BOTTOM_PX = 48;
const DETAILS_SECTIONS_ALL = { customerInfo: true, journeySummary: true, artifacts: true };

/* ── DetailsPanelAccordions ──
   What the "Details" tab of the "Session Details"/"Details"/"Transcript"
   `InteriorPanel` (voice's own header tabs, and the plain non-voice panel —
   see each page's own render site) shows once a session has actually been
   picked. Originally three stacked `Accordion`s (Session Details/Customer
   Details/Files); per explicit follow-up request ("add these to the
   details tab and make session details its own tab in the view details
   panel", with a screenshot of the Customer Profile/Customer Snapshot
   cards), Session Details moved out into its own tab (see
   `useSessionDetailsTabContent` above) and Customer Details' old raw
   Phone/Contact #/Email/Balance/Address/City/State/Zip field list was
   replaced with the SAME `CustomerContextOverview` (lyra-ui) cards the
   main transcript column's own Contact Overview already shows — real,
   Contact-History-grounded content (`buildCustomerContextOverviewInfo`,
   agent-next-gen-shared-utils.ts) instead of a flat synthesized field
   list, reusing whatever the caller already computed for its own Contact
   Overview rather than a second, parallel data source. `showNextBestAction
   ={false}` — Next Best Action already has its own, more prominent home at
   the top of the main transcript column; repeating it in this side panel
   would just be noise (see that prop's own doc comment,
   lyra-ui/contact-overview.tsx). The last section stays a plain stub
   `Accordion` — still no destination defined for its own "View All" link
   — renamed "Files" → "Artifacts" per a later explicit request (see that
   item's own inline comment, and `FILES_EMPTY_TEXT`'s doc comment). */
export function DetailsPanelAccordions({
  customerName,
  customerContextOverview,
  showCustomerContextOverview = true,
  showJourneySummary = false,
  journeySummaryUpdatedAtTick,
  onViewExperienceMemory,
  onViewCustomerInfo,
  onViewInteractionHistory,
  onLinkCustomer,
  artifacts,
  onOpenArtifact,
  onViewAllArtifacts,
  aiFeed,
  aiFeedCount,
  followSignal,
  show = DETAILS_SECTIONS_ALL,
}: {
  /** Bumped by the page on an agent action outside this component (the
   *  docked Copilot composer): scroll to the bottom and keep following. */
  followSignal?: number;
  /** Which of the panel's own sections render. Default all. With AI display
   *  "In the Contact Details panel", Overview shows Customer Info (plus the
   *  AI feed) and the Session tab shows the Journey Summary and Artifacts. */
  show?: { customerInfo: boolean; journeySummary: boolean; artifacts: boolean };
  /** "AI in panel" mode: the AI cards/interstitials (see `AiActionsFeed`),
   *  shown below the original cards. */
  aiFeed?: React.ReactNode;
  /** How many items `aiFeed` holds; a change is a new AI item (card,
   *  approval, instruction row, Copilot result) to follow to the bottom. */
  aiFeedCount?: number;
  /** Fired by "View All" (only shown when more than 10 artifacts are listed). */
  onViewAllArtifacts?: () => void;
  /** Side panels the agent has opened on this interaction — listed as links in the Artifacts card; clicking re-opens one. */
  artifacts?: readonly { id: string; label: string }[];
  onOpenArtifact?: (id: string) => void;
  customerName?: string;
  /** Same object each page already builds via `buildCustomerContextOverviewInfo`
   *  for its own main-column Contact Overview — passed straight through
   *  rather than recomputed here, so the two never disagree. */
  customerContextOverview?: OverviewInfo;
  /** Shows the "Journey Summary" card (renamed from "Real-Time Summary")
   *  instead of the "Autosummary" one. The main transcript column's own
   *  Autosummary is separate and untouched. Default `false`. */
  showJourneySummary?: boolean;
  /** Page-clock tick the Journey Summary was last "updated" at. This
   *  component turns it into the `"Updated 8 seconds ago"`-style caption
   *  (`formatJourneySummaryUpdatedLabel`) inside a `<ClockValue>`, so only
   *  that card re-renders as it ticks. Only meaningful alongside
   *  `showJourneySummary`. */
  journeySummaryUpdatedAtTick?: number;
  /** Adds a "View Experience Memory" link to the Journey Summary card. */
  onViewExperienceMemory?: () => void;
  /** Per explicit request ("remove the customer details accordion from
   *  phase 1") — hides the whole Customer Profile/Snapshot section (Phase
   *  1's own call sites pass `false`). Default `true`: every other
   *  consumer (Phase 2) is unaffected. Renamed from the old
   *  `showCustomerDetails` now that this section is `CustomerContextOverview`
   *  cards rather than the old field-list "Customer Details" accordion. */
  showCustomerContextOverview?: boolean;
  /** Wired to the SAME docked Customer Information panel the main Contact
   *  Overview's own "View customer info" link opens (see each page's own
   *  `onViewCustomerInfo` render-site doc comment) — omit to hide the link
   *  (same as `CustomerContextOverview` itself already does). */
  onViewCustomerInfo?: () => void;
  onViewInteractionHistory?: () => void;
  /** Per explicit request ("contact details panel for unmatched customers
   *  should match the hover popover. add a button above auto summary that
   *  says link to existing customer and then when that is clicked slide in
   *  a panel with the search customer / create new customer panel
   *  content") — renders a "Link to existing customer" button above the
   *  Autosummary/Customer Snapshot accordion, omit to hide it (every
   *  existing call site that doesn't pass this is unaffected). The caller
   *  owns what "clicked" actually does (Advanced's own docked panel opens
   *  its `matchState` search/create flow via `CustomerInformationSidePanel`'s
   *  own `matchStateOnBack`-paired toggle — see that render site's own doc
   *  comment), this component just surfaces the entry point next to the
   *  same accordions the hover popover already always shows regardless of
   *  match status. */
  onLinkCustomer?: () => void;
}) {
  // Artifacts continues the cards' staggered entrance after Customer Profile
  // (i=0) and the snapshot (i=1), or takes the first slot when those are
  // hidden (`showCustomerContextOverview={false}`, Phase 1).
  const filesEntranceIndex = showCustomerContextOverview && customerContextOverview ? 2 : 0;
  const cardProps = {
    customerName,
    customerContextOverview,
    showJourneySummary,
    journeySummaryUpdatedAtTick,
    onViewExperienceMemory,
    onViewCustomerInfo,
    onViewInteractionHistory,
    artifacts,
    onOpenArtifact,
    onViewAllArtifacts,
  };

  // "AI in panel" (Settings → AI display): the docked Copilot composer is the
  // panel's footer, a sibling below the scroll area (lyra `SidePanel`'s
  // `PanelContent`), so it never covers the cards. The extra bottom padding
  // keeps the last card clear of the footer's scroll fade. The scroll area
  // follows the newest AI item, but only while the agent is at or near the
  // bottom; scrolled up, it's left alone.
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const stickToBottom = useRef(true);
  const aiDocked = !!aiFeed;
  /** Where our own last scroll put the body (see `onScroll` below). */
  const programmaticTop = useRef<number | null>(null);
  const followToBottom = () => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
    programmaticTop.current = scroller.scrollTop;
  };
  useLayoutEffect(() => {
    if (!aiDocked) return;
    // The panel's own scroll container (`PanelContent`), else this root.
    const scroller = rootRef.current?.parentElement?.closest<HTMLElement>(".overflow-y-auto") ?? rootRef.current;
    if (!scroller) return;
    scrollerRef.current = scroller;
    followToBottom();
    stickToBottom.current = true;
    // A scroll the agent makes sets following to "at the bottom?". The scroll
    // event of our OWN scroll (`followToBottom`, recognized by the position
    // it asked for) is ignored: it can arrive after the content has already
    // grown, and would otherwise read as "no longer at the bottom".
    const onScroll = () => {
      const top = scroller.scrollTop;
      const ours = programmaticTop.current !== null && Math.abs(top - programmaticTop.current) <= 1;
      // One event per scroll of ours: the next one is the agent's again.
      programmaticTop.current = null;
      if (ours) return;
      stickToBottom.current = scroller.scrollHeight - top - scroller.clientHeight <= AI_FEED_NEAR_BOTTOM_PX;
    };
    scroller.addEventListener("scroll", onScroll);
    // While following, keep following as the content grows after the fact
    // (an approval option's revealed content animates its height open; cards
    // expand): scrolling once, when the change commits, lands on the old
    // bottom (browser-verified, e2e/ai-panel-follow.spec.ts).
    const content = rootRef.current;
    const ro = new ResizeObserver(() => {
      if (stickToBottom.current) followToBottom();
    });
    if (content) ro.observe(content);
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      ro.disconnect();
    };
  }, [aiDocked]);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!aiDocked || !scroller || !stickToBottom.current) return;
    followToBottom();
  }, [aiDocked, aiFeedCount]);
  // An action the agent just took (a card's decision controls, marked
  // `data-ai-action`, or the docked composer: `followSignal`) always scrolls
  // to the bottom and keeps following, wherever the agent had scrolled, so
  // its result (instruction row, reply, new card, Copilot result) is in view.
  const [agentActionTick, setAgentActionTick] = useState(0);
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!aiDocked || !scroller || (agentActionTick === 0 && !followSignal)) return;
    stickToBottom.current = true;
    followToBottom();
  }, [aiDocked, agentActionTick, followSignal]);
  const onFeedClickCapture = (e: React.MouseEvent) => {
    if ((e.target as Element).closest("[data-ai-action]")) setAgentActionTick((t) => t + 1);
  };

  return (
    <div
      ref={rootRef}
      data-slot="details-panel-body"
      className="flex flex-col gap-3 p-4 overflow-y-auto"
      style={aiDocked ? { paddingBottom: AI_FEED_BOTTOM_PADDING_PX } : undefined}
    >
      <LinkCustomerButton onLinkCustomer={onLinkCustomer} />
      {/* The Overview stack: one flat column, every card spaced only by
          this root's `gap-3`. The cards are the reference sections
          (reference-sections.tsx), which the canvas also mounts one by one. */}
      {show.customerInfo && showCustomerContextOverview && <CustomerInfoSection {...cardProps} />}
      {show.journeySummary && showCustomerContextOverview && <JourneySummarySection {...cardProps} />}
      {/* Keyed per interaction by its callers, so it reopens for each new contact. */}
      {show.artifacts && <ArtifactsSection {...cardProps} entranceIndex={filesEntranceIndex} />}
      {/* Settings → AI display "In the Contact Details panel" (P-SETTINGS,
          ported from v3): the AI cards and interstitials sit below the
          original items. */}
      {aiFeed && (
        <div data-slot="ai-feed" onClickCapture={onFeedClickCapture}>
          {aiFeed}
        </div>
      )}
    </div>
  );
}
