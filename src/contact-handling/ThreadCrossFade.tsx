import { Component } from "react";

/** `AI_CARD_ENTER`'s duration (duration-200): a tab switch takes as long as an AI card's enter. */
const CROSS_FADE_MS = 200;

interface ThreadCrossFadeProps {
  /** The thread the slot shows: a change cross-fades. */
  transitionKey: string | undefined;
  /** The card: a switch to another card isn't a tab switch, and doesn't fade. */
  groupKey: string | undefined;
}

/** A scrolled element inside the outgoing content: [top-level child, descendant index (-1: the child itself), top, left]. */
type ScrollMark = [number, number, number, number];

interface Snapshot {
  clone: HTMLElement;
  scroll: ScrollMark[];
}

/** The main column's tab switch (P-AIFIRST (k5) D): the outgoing tab's
 *  content fades out and the incoming fades in, in place — nothing slides or
 *  animates over the previous tab. Placed as the first child of the content
 *  slot (a positioned element) it cross-fades every sibling: before React
 *  commits the new tab it clones the outgoing content (an inert DOM copy,
 *  `getSnapshotBeforeUpdate`, so no second React tree and no effects), lays
 *  the copy over the slot and fades it out while the new content fades in.
 *  Nothing remounts (the transcript keeps its state across tabs). Uses the
 *  Web Animations API; without it (jsdom) the swap is immediate. */
export class ThreadCrossFade extends Component<ThreadCrossFadeProps> {
  private anchor: HTMLSpanElement | null = null;
  private outgoing: HTMLElement | null = null;

  private contentOf(slot: Element): Element[] {
    return Array.from(slot.children).filter((child) => child !== this.anchor && child !== this.outgoing);
  }

  getSnapshotBeforeUpdate(prev: ThreadCrossFadeProps): Snapshot | null {
    const slot = this.anchor?.parentElement;
    if (!slot || prev.groupKey !== this.props.groupKey || prev.transitionKey === this.props.transitionKey) return null;
    this.outgoing?.remove();
    const clone = document.createElement("div");
    const scroll: ScrollMark[] = [];
    this.contentOf(slot).forEach((child, i) => {
      clone.appendChild(child.cloneNode(true));
      [child, ...Array.from(child.querySelectorAll("*"))].forEach((el, j) => {
        if (el.scrollTop || el.scrollLeft) scroll.push([i, j - 1, el.scrollTop, el.scrollLeft]);
      });
    });
    return { clone, scroll };
  }

  componentDidUpdate(_prev: ThreadCrossFadeProps, _state: unknown, snapshot: Snapshot | null) {
    const slot = this.anchor?.parentElement;
    if (!snapshot || !slot) return;
    const incoming = this.contentOf(slot);
    const { clone, scroll } = snapshot;
    clone.className = slot.className;
    Object.assign(clone.style, { position: "absolute", inset: "0", zIndex: "1", pointerEvents: "none" });
    clone.setAttribute("aria-hidden", "true");
    clone.inert = true;
    clone.dataset.slot = "thread-crossfade-out";
    slot.appendChild(clone);
    for (const [i, j, top, left] of scroll) {
      const child = clone.children[i];
      const el = j < 0 ? child : child?.querySelectorAll("*")[j];
      if (el) Object.assign(el, { scrollTop: top, scrollLeft: left });
    }
    this.outgoing = clone;
    const timing: KeyframeAnimationOptions = { duration: CROSS_FADE_MS, easing: "ease-in-out" };
    if (typeof clone.animate !== "function") {
      this.dropOutgoing(clone);
      return;
    }
    // Nothing else animates during the switch: an AI card's enter (a slide) on the incoming tab, or the CSS
    // animations the copy replays on insertion, end at once; the cross-fade is the one motion.
    for (const el of [clone, ...incoming]) for (const running of el.getAnimations({ subtree: true })) running.finish();
    clone.animate([{ opacity: 1 }, { opacity: 0 }], { ...timing, fill: "forwards" }).finished.then(
      () => this.dropOutgoing(clone),
      () => this.dropOutgoing(clone),
    );
    for (const el of incoming) el.animate([{ opacity: 0 }, { opacity: 1 }], timing);
  }

  componentWillUnmount() {
    this.outgoing?.remove();
  }

  private dropOutgoing(clone: HTMLElement) {
    clone.remove();
    if (this.outgoing === clone) this.outgoing = null;
  }

  render() {
    return (
      <span
        ref={(el) => {
          this.anchor = el;
        }}
        hidden
        data-slot="thread-crossfade"
      />
    );
  }
}
