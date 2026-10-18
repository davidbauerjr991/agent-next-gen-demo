import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { Button, CustomerContextOverview, AICard, Link } from "@nicecxone/lyra-ui";
import { Paperclip } from "lucide-react";
import { formatJourneySummaryUpdatedLabel, type OverviewInfo } from "@/components/agent-next-gen-shared-utils";
import { ClockValue } from "@/components/agent-next-gen-clock-tick";
import { AI_CARD_ENTER } from "@/components/transcript/ai-rows/ai-card-enter";
import { cn } from "@/lib/utils";

/** Per explicit request ("Files gets a placeholder"); text updated to
 *  match this section's later rename ("Files" → "Artifacts" in the
 *  Details panel) — constant name kept as-is (internal identifier, not
 *  user-facing) rather than churned for no reason. */
const FILES_EMPTY_TEXT = "No artifacts on this interaction yet.";

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
  // Plain `lyra-body-md` + `text-lyra-fg-link` — this accordion's own
  // "View All" link (only consumer of this local const) per two explicit
  // requests: "increase the font size in the ... artifact ... accordion
  // content to md" (this was `-sm-emphasis`), then "make sure the view all
  // matches the link font in the view customer info" (dropped the
  // `-emphasis` weight — `CustomerContextOverview`'s own "View customer
  // info" link, lyra-ui/contact-overview.tsx, is plain `lyra-body-md`, not
  // emphasized), and finally "remove the accent tint on view all" — this
  // link never had a color explicitly requested; `text-lyra-status-info-
  // strong` was pre-existing and is replaced here with the same plain
  // `text-lyra-fg-link` every other "View ..." link in this file/
  // lyra-ui/contact-overview.tsx already uses, rather than a special tint.
  const viewAllLinkClassName = "lyra-body-md text-lyra-fg-link text-left hover:underline w-fit";

  // Files joins the same staggered fade/slide-up entrance
  // `CustomerContextOverview` drives for its own Customer Profile/
  // Snapshot cards (lyra-ui/contact-overview.tsx: 200ms + i*260ms per
  // section, 700ms duration) — continuing that sequence at the next
  // index so Files fades in right after Customer Profile (i=0) and
  // Customer Snapshot (i=1) have, or at the first slot's own timing
  // when those are hidden (`showCustomerContextOverview={false}`,
  // Phase 1) since there's nothing ahead of it to follow.
  const filesEntranceIndex = showCustomerContextOverview && customerContextOverview ? 2 : 0;
  const [filesEntered, setFilesEntered] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setFilesEntered(true), 200 + filesEntranceIndex * 260);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {onLinkCustomer && (
        <Button variant="outline" className="w-full" onClick={onLinkCustomer}>
          Link to existing customer
        </Button>
      )}
      {/* The Overview stack: one flat column, every card spaced only by
          this root's `gap-3` (no per-card margin or top padding). Customer
          Info is a plain accordion (not AI content); every AI-generated card
          (Journey Summary / Autosummary, Artifacts, and the AI feed's
          approval, wrap-up and Next Best Action) is a lyra AICard, radius
          md, compact. Customer Info is shown only when there's a customer
          record ("if a new call is made or the customer does not have any
          information, do not display the customer profile"). */}
      {show.customerInfo && showCustomerContextOverview && customerContextOverview?.customerCard && (
        <CustomerContextOverview
          customerName={customerName ?? ""}
          customerCard={customerContextOverview.customerCard}
          // Per explicit request ("put the customer summary content inside
          // the customer profile accordion") — see `detailedSummary`'s own
          // doc comment (lyra-ui/contact-overview.tsx) for what this renders.
          detailedSummary={customerContextOverview.detailedSummary}
          showCustomerProfile
          showContactSnapshot={false}
          showNextBestAction={false}
          onViewCustomerInfo={onViewCustomerInfo}
          onViewInteractionHistory={onViewInteractionHistory}
          className="pt-0"
        />
      )}
      {show.journeySummary && showCustomerContextOverview && customerContextOverview && (
        // Only this card re-renders for the "Updated N seconds ago"
        // caption, and only when the label text changes (every second for
        // the first minute, then every minute) — see
        // `journeySummaryUpdatedAtTick`'s own doc comment.
        <ClockValue
          select={(clockTick) =>
            journeySummaryUpdatedAtTick === undefined
              ? undefined
              : formatJourneySummaryUpdatedLabel(clockTick - journeySummaryUpdatedAtTick)
          }
        >
          {(journeySummaryUpdatedLabel) => (
        // lyra's `aiCards` mode (71160d3): the Journey Summary (or the
        // Autosummary) as an AICard. `customerContextOverview.journeySummary`
        // is the same per-contact facts `snapshot` carries, joined into one
        // paragraph by `buildCustomerContextOverviewInfo`. lyra's own prop
        // names still say "realTimeSummary". Enters with the other AI cards
        // (`AI_CARD_ENTER`, P-AIFIRST (k5)).
        <div className={AI_CARD_ENTER} data-slot="journey-summary">
        <CustomerContextOverview
          aiCards
          customerName={customerName ?? ""}
          snapshot={customerContextOverview.snapshot}
          showRealTimeSummary={showJourneySummary}
          showContactSnapshot={!showJourneySummary}
          realTimeSummary={customerContextOverview.journeySummary}
          realTimeSummaryUpdatedLabel={journeySummaryUpdatedLabel}
          onViewExperienceMemory={onViewExperienceMemory}
          showNextBestAction={false}
          showCustomerProfile={false}
          className="pt-0"
        />
        </div>
          )}
        </ClockValue>
      )}
      {/* Artifacts: a blue lyra AICard (as v3 since lyra 71160d3), open by
          default (`DetailsPanelAccordions` is keyed per interaction, so it
          reopens for each new contact). */}
      {show.artifacts && (
      <AICard
        title="Artifacts"
        color="blue"
        radius="md"
        density="compact"
        icon={<Paperclip className="h-4 w-4" strokeWidth={1.5} />}
        defaultOpen
        className={cn(
          "transition-[opacity,transform] duration-700 ease-out",
          filesEntered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
              <div className="flex flex-col gap-3">
                {/* lyra-body-md, not -sm — see `viewAllLinkClassName`'s own
                    comment just above for the same request. */}
                {artifacts && artifacts.length > 0 ? (
                  <ul className="flex flex-col gap-1.5">
                    {artifacts.slice(0, 10).map((a) => (
                      <li key={a.id} className="flex min-w-0 items-center gap-2">
                        <Paperclip className="h-3.5 w-3.5 shrink-0 text-lyra-fg-secondary" strokeWidth={1.5} aria-hidden="true" />
                        <Link onClick={() => onOpenArtifact?.(a.id)} className="min-w-0 truncate text-left">
                          {a.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="lyra-body-md text-lyra-fg-secondary">{FILES_EMPTY_TEXT}</p>
                )}
                {/* "View All" sits below the artifact list (here, the empty-
                    state text above) per explicit request, rather than above
                    it. */}
                {artifacts && artifacts.length > 10 && (
                  <Link onClick={onViewAllArtifacts} className="self-start">
                    View All
                  </Link>
                )}
              </div>
      </AICard>
      )}
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
