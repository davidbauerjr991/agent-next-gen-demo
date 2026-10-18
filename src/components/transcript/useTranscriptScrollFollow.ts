// The transcript's scroll-follow behavior (P-EXTRACT: split out of `InteractionTranscript`, unchanged):
// land on the newest message, follow new content while at the bottom, the "N new" count, and the width
// breakpoints the bubbles read.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TranscriptMessage } from "./transcript-types";

export function useTranscriptScrollFollow({
  contactId,
  trailingContentKey,
  liveMessages,
  sessionMessages,
}: {
  contactId: string;
  trailingContentKey?: string;
  liveMessages: TranscriptMessage[];
  sessionMessages: Record<string, TranscriptMessage[]>;
}) {
  // Scroll container ref — see the `useLayoutEffect` further below (after
  // `isAtBottom` is declared, which it also resets) for the actual
  // scroll-to-latest-on-open/on-channel-switch behavior. Declared up here
  // since the `ResizeObserver` effect right below also needs it.
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // `trailingContent` scrolls into view once per `trailingContentKey` (the
  // first time this transcript shows it), smoothly; after that the agent's
  // own scroll position is left alone, so they can scroll back up.
  const trailingContentRef = useRef<HTMLDivElement>(null);
  const scrolledTrailingKeysRef = useRef(new Set<string>());
  useEffect(() => {
    if (!trailingContentKey || scrolledTrailingKeysRef.current.has(trailingContentKey)) return;
    scrolledTrailingKeysRef.current.add(trailingContentKey);
    trailingContentRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [trailingContentKey]);
  // Marks the true bottom of the rendered transcript content — see the
  // mount/open scroll-to-bottom effect below (`[contactId]`) for why this
  // exists: an invisible target for `scrollIntoView()` rather than relying
  // on `scrollContainerRef`'s own (sometimes-inert) `scrollHeight`.
  // Rendered once, as the very last node inside the message column (see
  // its own render site, right after the sessions `.map()` closes).
  const bottomSentinelRef = useRef<HTMLDivElement>(null);

  // Below 400px of this transcript's own rendered width: drop each
  // message's sender avatar (`transcriptNarrow`, threaded into each real
  // message bubble's own `narrow` prop as an override — see
  // `TranscriptMessageBubble`'s own doc comment). Below 768px: grow the
  // TYPING INDICATOR's own bubble to full width, matching the real message
  // bubbles' own independent 80%/full-width breakpoint — per explicit
  // request (`ChatMessage`, lyra-ui, self-measures that breakpoint
  // internally off its own root element and needs no prop from here; the
  // `TypingIndicator` below is still a local, un-ported component with no
  // measurement of its own, so it needs `transcriptBubbleFullWidth` handed
  // down explicitly to stay visually consistent with the real bubbles
  // beside it). Both measured directly off this same scroll container via
  // one shared `ResizeObserver`, same pattern `ScheduleToolbar`'s own
  // `containerRef`/`isWide`/`isCompact` already uses for its Add/Day/Week
  // collapse (SchedulePanel.tsx) — a CSS `@container` query here stopped
  // firing reliably for the agent live-testing it, even after several
  // rounds of review/hardening.
  const [transcriptNarrow, setTranscriptNarrow] = useState(false);
  const [transcriptBubbleFullWidth, setTranscriptBubbleFullWidth] = useState(false);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const applyWidth = (width: number) => {
      setTranscriptNarrow(width < 400);
      setTranscriptBubbleFullWidth(width < 768);
    };
    applyWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver(([entry]) => applyWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Total message count across every session — the one number that tells us
  // whether "new" messages have shown up since the agent last looked at the
  // bottom of the transcript. Flattened rather than tracked per-session
  // since the "N new" chip is a single count regardless of which session(s)
  // the new messages landed in.
  const totalMessageCount = useMemo(
    () => Object.values(sessionMessages).reduce((sum, messages) => sum + messages.length, 0) + liveMessages.length,
    [sessionMessages, liveMessages]
  );

  // Whether the agent is currently scrolled to (near) the bottom — drives
  // the floating "Scroll To Latest" affordance, which should only appear
  // once they've scrolled up and away from the live edge of the
  // conversation.
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  // How many total messages had arrived as of the last time the agent was
  // at the bottom — a ref (not state) since it's only ever read inside
  // effects/handlers, never rendered directly.
  const lastSeenCountRef = useRef(totalMessageCount);
  // Mirrors `isAtBottom` into a ref purely so the auto-scroll effect below
  // can read its *current* value without listing it as a dependency — see
  // that effect's own comment for why it deliberately only re-fires on
  // `totalMessageCount` changing, not on every `isAtBottom` flip.
  const isAtBottomRef = useRef(isAtBottom);
  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // Scroll to the latest message on open — every SMS/chat transcript should
  // land on the newest message (bottom of the last session) rather than the
  // very first one from potentially days ago. `useLayoutEffect` (not
  // `useEffect`) so this happens before the browser paints the first frame
  // — no visible flash of the top of the transcript before it jumps to the
  // bottom.
  // Depends on `contactId` — the ACTIVE channel's own base Contact id (see
  // that prop's own doc comment; unique per Thread, so it changes every
  // time the agent switches to a different channel tab) — not an empty
  // array. Per explicit bug report: `InteractionTranscript` is one long-
  // lived component instance for the whole interaction (never remounted as
  // the agent flips between its channel tabs — no `key` at the call site),
  // so an empty-deps effect only ever fired once, the very first time this
  // interaction's transcript opened. Every LATER channel switch left
  // `scrollContainerRef`'s raw `scrollTop` pixel value untouched while the
  // DOM underneath it was completely replaced with a different channel's
  // (usually differently-sized) content — the agent would land wherever
  // that stale pixel offset happened to fall in the new content, which
  // read as "goes to the top" for a multi-session chat/SMS thread far more
  // often than not. Re-running this on every `contactId` change re-lands on
  // the bottom every time, matching the original "land on open" intent but
  // now firing on every channel switch, not just the very first one.
  // `setIsAtBottom(true)` alongside it — same "as if they'd clicked Scroll
  // To Latest" reset `scrollToLatest`/the agent's-own-just-sent-message
  // branch below already do — so the "N new" chip/count (which otherwise
  // would've kept comparing against whatever channel was last read) starts
  // clean for the newly-viewed channel too.
  // Single scroll-to-bottom implementation every call site below shares
  // (this mount effect, the auto-scroll-on-new-message effect, and both
  // the "Scroll To Latest"/"Sync to Live" buttons' own `onClick`) — see
  // `bottomSentinelRef`'s own declaration for why this targets THAT
  // sentinel via `Element.scrollIntoView()` rather than setting
  // `scrollContainerRef.current.scrollTop`/`.scrollTo(...)` directly, which
  // is a no-op wherever this component is nested inside an ALREADY-
  // scrollable ancestor (the docked Customer Information panel's own
  // "Transcript" tab, and its hover-preview twin — see that mount effect's
  // former version, in git history, for the full "why" this replaced it):
  // `scrollIntoView()` walks up to whichever ancestor actually owns the
  // scrollbar and scrolls THAT one, so this lands correctly in every
  // context this component is mounted in, not just the main record
  // column (where `scrollContainerRef` itself happens to be the real
  // scroll container).
  // While an automatic scroll is settling (new content just landed and we're smooth-scrolling to it), the sentinel is
  // briefly below the fold; `autoScrollUntilRef` lets the "not at bottom" detection below ignore that window so the
  // "Scroll To Latest" button doesn't flash every time content is added.
  const autoScrollUntilRef = useRef(0);
  const scrollToBottom = (behavior: ScrollBehavior = "auto") => {
    autoScrollUntilRef.current = Date.now() + 900;
    bottomSentinelRef.current?.scrollIntoView({ block: "end", behavior });
  };

  useLayoutEffect(() => {
    // `useLayoutEffect` (not `useEffect`) so this happens before the
    // browser paints the first frame — no visible flash of the top of the
    // transcript before it jumps to the bottom.
    scrollToBottom();
    setIsAtBottom(true);
    // Safety net for a still-settling ancestor (the docked panel's own
    // opening transition, running in this same commit as this mount) —
    // re-applies the same scroll once that layout has settled.
    const raf = requestAnimationFrame(() => scrollToBottom());
    return () => cancelAnimationFrame(raf);
  }, [contactId]);

  // Tracks whether the agent is scrolled to the live edge of the
  // transcript — drives the floating "Scroll To Latest"/"Sync to Live"
  // affordance below. An `IntersectionObserver` on `bottomSentinelRef`,
  // not the old `onScroll`/`scrollTop` math against `scrollContainerRef`
  // (see `scrollToBottom`'s own doc comment for why that math only ever
  // reflected reality in the main record column): an `IntersectionObserver`
  // with no explicit `root` measures intersection against the viewport,
  // which is computed correctly straight through any number of clipping/
  // scrolling ancestors in between — so "is the latest message actually
  // on screen" comes out right in every context this component mounts in,
  // not just the one where `scrollContainerRef` happens to be the real
  // scroll container.
  // Whether the latest message is on screen, measured against the viewport AND every clipping ancestor (the docked and
  // hover-preview Transcript panels clip their own content, which a plain viewport-rooted observer got wrong). Polled
  // lightly rather than observed so it also catches content growth. A small bottom tolerance counts "almost at the
  // bottom" as at the bottom, and "left the bottom" must hold for a moment and outlast any automatic scroll in progress,
  // so adding content never flashes the "Scroll To Latest" button.
  useEffect(() => {
    const target = bottomSentinelRef.current;
    if (!target) return;
    const TOLERANCE = 96;
    const isNearBottom = () => {
      const top = target.getBoundingClientRect().top;
      let limit = window.innerHeight;
      for (let el = target.parentElement; el; el = el.parentElement) {
        if (getComputedStyle(el).overflowY !== "visible") limit = Math.min(limit, el.getBoundingClientRect().bottom);
      }
      return top <= limit + TOLERANCE;
    };
    let awaySince: number | null = null;
    const tick = () => {
      if (isNearBottom()) {
        awaySince = null;
        setIsAtBottom(true);
        return;
      }
      const now = Date.now();
      if (now < autoScrollUntilRef.current) {
        awaySince = null;
        return;
      }
      if (awaySince === null) awaySince = now;
      else if (now - awaySince >= 400) setIsAtBottom(false);
    };
    const id = window.setInterval(tick, 150);
    return () => window.clearInterval(id);
  }, [contactId]);

  // Keeps the "N new" count in sync with reality: while at the bottom,
  // every message is by definition "seen," so the seen-count tracks the
  // live total and the chip stays hidden; once the agent scrolls away, any
  // further growth in the total is exactly how many they've missed.
  useEffect(() => {
    if (isAtBottom) {
      lastSeenCountRef.current = totalMessageCount;
      setNewMessageCount(0);
    } else {
      setNewMessageCount(Math.max(0, totalMessageCount - lastSeenCountRef.current));
    }
  }, [totalMessageCount, isAtBottom]);

  // Auto-scroll to the newest message as new ones arrive (a sent message, or
  // the simulated customer reply that follows it a couple seconds later).
  // Two different rules for the two cases:
  //  - The agent's OWN just-sent message always scrolls to it, regardless of
  //    where they'd scrolled to — they just took an action in this
  //    conversation, so they should see it land, same as `scrollToLatest`
  //    below. Also resets `isAtBottom` to `true` (as if they'd clicked
  //    "Scroll To Latest" themselves), so the customer's reply a couple
  //    seconds later keeps auto-scrolling right along with it too.
  //  - The simulated customer reply only scrolls if the agent was already
  //    caught up to the bottom (`isAtBottomRef.current`, read fresh rather
  //    than depended on — see that ref's own comment) — if they've scrolled
  //    up to read earlier messages, an incoming reply shouldn't yank them
  //    back down; it only self-resumes once they scroll back down
  //    themselves (the `IntersectionObserver` above) or click "Scroll To
  //    Latest"/"Sync to Live".
  // Distinguished by `liveMessages`' own last entry's `sender` — the fixed
  // mock log never changes at runtime, so any growth in `liveMessages` is
  // exactly "the agent sent one" or "the customer replied," in that order.
  // Keyed on `liveMessages.length` (a primitive), not the `liveMessages`
  // array itself — that's a fresh `[]` reference every render an
  // interaction has no live messages yet (`activeInteraction.liveMessages
  // ?? []` at the call site), which would otherwise re-fire this effect on
  // every unrelated re-render (e.g. the shared clock tick).
  useEffect(() => {
    const lastLiveMessage = liveMessages[liveMessages.length - 1];
    const isOwnJustSentMessage = lastLiveMessage?.sender === "agent";
    if (!isOwnJustSentMessage && !isAtBottomRef.current) return;
    scrollToBottom("smooth");
    if (isOwnJustSentMessage) setIsAtBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveMessages.length]);

  // Auto-scroll on ANY growth of the scrollable content, not just new
  // messages — per explicit request, the Next Best Action block (an opaque
  // `nextBestActionContent`/`customerContextOverview` ReactNode this
  // component knows nothing about internally) can grow on its own terms
  // (a step list advancing, a question appearing, a photo showing up) with
  // no change to `liveMessages` at all, so the effect above alone can't
  // catch it. A `ResizeObserver` on `contentWrapperRef` (the `<div
  // className="w-full">` wrapping every session's rendered content, see
  // its own render site) fires on any such height change, generically
  // — same "only if already at bottom" rule as above (`isAtBottomRef`),
  // reusing the exact same `scrollToBottom` helper. Harmless overlap with
  // the message-specific effect above (both just call the same idempotent
  // scroll).
  const contentWrapperRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = contentWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) scrollToBottom("smooth");
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollToLatest = () => {
    scrollToBottom("smooth");
    setIsAtBottom(true);
  };

  return {
    scrollContainerRef,
    trailingContentRef,
    bottomSentinelRef,
    contentWrapperRef,
    transcriptNarrow,
    transcriptBubbleFullWidth,
    isAtBottom,
    newMessageCount,
    scrollToLatest,
  };
}
