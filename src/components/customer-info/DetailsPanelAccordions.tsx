import { useState, useRef, useLayoutEffect } from "react";

/** "AI in panel": bottom padding that keeps the last card clear of the
 *  docked composer's top fade (`ComposerFade`, 32px). */
const AI_FEED_BOTTOM_PADDING_PX = 32;
/** Within this many px of the bottom counts as "at the bottom". */
const AI_FEED_NEAR_BOTTOM_PX = 48;

/* ── DetailsPanelAccordions ──
   An AI column's body: the Agentic reference cards (Real-Time Summary,
   Journey Summary, Customer Info: the canvas registry's reference cells, one
   implementation each; P-CANVAS) and then the AI feed (approvals,
   interstitials, Next Best Action rows, Copilot results). Contact Details'
   Overview under AI display "panel", and the main column's AI workspace
   under "main" (feed only: its reference cards are the canvas's). While it
   holds a feed it follows the newest AI item to the bottom. */
export function DetailsPanelAccordions({
  cards,
  aiFeed,
  aiFeedCount,
  followSignal,
}: {
  /** The reference cards, above the feed. */
  cards?: React.ReactNode;
  /** Bumped by the page on an agent action outside this component (the
   *  docked Copilot composer): scroll to the bottom and keep following. */
  followSignal?: number;
  /** "AI in panel" mode: the AI cards/interstitials (see `AiActionsFeed`),
   *  shown below the reference cards. */
  aiFeed?: React.ReactNode;
  /** How many items `aiFeed` holds; a change is a new AI item (card,
   *  approval, instruction row, Copilot result) to follow to the bottom. */
  aiFeedCount?: number;
}) {

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
      {/* One flat column, every card spaced only by this root's `gap-3`. */}
      {cards}
      {/* Settings → AI display "In the Contact Details panel" (P-SETTINGS,
          ported from v3): the AI cards and interstitials sit below the
          reference cards. */}
      {aiFeed && (
        <div data-slot="ai-feed" onClickCapture={onFeedClickCapture}>
          {aiFeed}
        </div>
      )}
    </div>
  );
}
