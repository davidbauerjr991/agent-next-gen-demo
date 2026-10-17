import { useEffect, useRef, useState } from "react";

// Which trigger shows an open Outcome popover (P-EXTRACT, Bug 1). The store
// says which channel's Outcome is open (`outcomeOpenFor`, one app-wide); a
// channel can have several triggers on screen at once (its nav row, its
// session row), so each trigger also remembers whether it's the one that
// opened it. Open = the store names this channel AND this trigger claimed it.
// That is the anchor, and it is component-local by design: two triggers of
// the same kind (two session rows showing the same thread) can never both
// open, and a trigger that unmounts while showing it closes it.

interface OpenableOutcome {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** One trigger's Outcome config, open only while this trigger holds the claim. */
export function useOutcomeClaim<T extends OpenableOutcome>(outcome: T | undefined): T | undefined {
  const [claimed, setClaimed] = useState(false);
  const open = !!outcome?.open;
  // Closed in the store (saved, cancelled, another channel opened): the claim lapses.
  useEffect(() => {
    if (!open && claimed) setClaimed(false);
  }, [open, claimed]);
  const latest = useRef({ outcome, claimed });
  latest.current = { outcome, claimed };
  // Unmounted while showing it: nothing shows it any more, so close it.
  useEffect(
    () => () => {
      const { outcome: current, claimed: mine } = latest.current;
      if (mine && current?.open) current.onOpenChange(false);
    },
    [],
  );
  if (!outcome) return undefined;
  return {
    ...outcome,
    open: open && claimed,
    onOpenChange: (next: boolean) => {
      setClaimed(next);
      outcome.onOpenChange(next);
    },
  };
}

/** The same for a list of triggers in one component (a nav card's channel
 *  rows), claimed by item key: at most one of them holds the claim. */
export function useOutcomeClaims<T extends { outcome?: OpenableOutcome }>(items: readonly T[], keyOf: (item: T, index: number) => string): T[] {
  const [claimedKey, setClaimedKey] = useState<string | null>(null);
  const claimedItem = claimedKey === null ? undefined : items.find((item, i) => keyOf(item, i) === claimedKey);
  const claimedOpen = !!claimedItem?.outcome?.open;
  useEffect(() => {
    if (claimedKey !== null && !claimedOpen) setClaimedKey(null);
  }, [claimedKey, claimedOpen]);
  const latest = useRef({ claimedItem, claimedOpen });
  latest.current = { claimedItem, claimedOpen };
  useEffect(
    () => () => {
      const { claimedItem: item, claimedOpen: showing } = latest.current;
      if (showing) item?.outcome?.onOpenChange(false);
    },
    [],
  );
  return items.map((item, i) => {
    const outcome = item.outcome;
    if (!outcome) return item;
    const key = keyOf(item, i);
    return {
      ...item,
      outcome: {
        ...outcome,
        open: outcome.open && claimedKey === key,
        onOpenChange: (next: boolean) => {
          setClaimedKey(next ? key : null);
          outcome.onOpenChange(next);
        },
      },
    };
  });
}
