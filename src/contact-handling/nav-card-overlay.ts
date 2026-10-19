// Page-owned UI state layered over store-backed nav cards (P0.5b.2). Pure.
//
// `buildNavCards` derives every card field the provider owns (threads, state,
// timers, case status). A few fields are still page UI state with no provider
// home yet: which thread the main column shows, typed live messages and the
// faked customer reply's awaiting badge (until P2.2), and a linked record id.
// This module keeps those in an overlay keyed by the card's `journeyId`, merges
// it into the derived cards, and turns a page's `card => card` update into an
// overlay patch.
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { Thread } from "@/components/agent-next-gen-interaction-dashboard";

/** Card fields the page owns. */
export const CARD_OVERLAY_FIELDS = ["currentThreadId", "startedFresh", "liveMessages", "customerId", "identity"] as const;
/** Thread fields the page owns (the faked customer reply, P2.2 replaces it). */
export const THREAD_OVERLAY_FIELDS = ["awaitingResponse", "lastCustomerMessageTick", "messageCount", "startedFresh", "draftSent"] as const;

type CardOverlayField = (typeof CARD_OVERLAY_FIELDS)[number];
type ThreadOverlayField = (typeof THREAD_OVERLAY_FIELDS)[number];

export type CardOverlay = Partial<Pick<NavCard, CardOverlayField>> & {
  /** Per thread key. A key present with `undefined` clears the derived value. */
  threads?: Record<string, Partial<Pick<Thread, ThreadOverlayField>>>;
};

export type NavCardOverlay = Readonly<Record<string, CardOverlay>>;

function own<T extends object>(obj: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/** Applies the overlay to one derived card. Fields present in the overlay win,
 *  including an explicit `undefined`. */
export function mergeCardOverlay(card: NavCard, overlay: CardOverlay | undefined): NavCard {
  if (!overlay) return card;
  const merged: NavCard = { ...card };
  for (const field of CARD_OVERLAY_FIELDS) {
    if (own(overlay, field)) (merged as unknown as Record<string, unknown>)[field] = overlay[field];
  }
  if (overlay.threads) {
    merged.threads = card.threads.map((thread) => {
      const patch = overlay.threads![thread.id];
      return patch ? { ...thread, ...patch } : thread;
    });
  }
  return merged;
}

export interface OverlayDiff {
  /** The overlay after applying the page's change. */
  overlay: CardOverlay;
  /** Provider-owned fields the page tried to change; they're dropped. */
  ignored: string[];
}

/** Diffs a page's updated card against the merged card it was given and keeps
 *  only the overlay fields that changed. Any other change is reported in
 *  `ignored`: it belongs to the provider and must go through a command. */
export function diffCardOverlay(before: NavCard, after: NavCard, overlay: CardOverlay | undefined): OverlayDiff {
  const next: CardOverlay = { ...overlay };
  const ignored: string[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (key === "threads") continue;
    const a = (before as unknown as Record<string, unknown>)[key];
    const b = (after as unknown as Record<string, unknown>)[key];
    if (Object.is(a, b)) continue;
    if ((CARD_OVERLAY_FIELDS as readonly string[]).includes(key)) {
      (next as Record<string, unknown>)[key] = b;
    } else {
      ignored.push(key);
    }
  }

  if (before.threads !== after.threads) {
    const beforeById = new Map(before.threads.map((t) => [t.id, t]));
    const threadPatches: Record<string, Partial<Pick<Thread, ThreadOverlayField>>> = { ...next.threads };
    if (after.threads.length !== before.threads.length || after.threads.some((t) => !beforeById.has(t.id))) {
      ignored.push("threads (added/removed)");
    }
    for (const thread of after.threads) {
      const prior = beforeById.get(thread.id);
      if (!prior || prior === thread) continue;
      const tKeys = new Set([...Object.keys(prior), ...Object.keys(thread)]);
      for (const key of tKeys) {
        const a = (prior as unknown as Record<string, unknown>)[key];
        const b = (thread as unknown as Record<string, unknown>)[key];
        if (Object.is(a, b)) continue;
        if ((THREAD_OVERLAY_FIELDS as readonly string[]).includes(key)) {
          threadPatches[thread.id] = { ...threadPatches[thread.id], [key]: b };
        } else {
          ignored.push(`threads[${thread.id}].${key}`);
        }
      }
    }
    next.threads = threadPatches;
  }
  return { overlay: next, ignored };
}
