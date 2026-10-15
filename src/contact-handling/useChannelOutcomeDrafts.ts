import { useCallback, useMemo, useState } from "react";
import type { InteractionOutcome } from "@/domain";

// One Outcome draft per channel (P0.5d.1), shared by both pages: the inline
// voice wrap-up card and every Outcome popover for a channel read and write
// the same draft, keyed `${cardId}:${threadKey}`. A draft starts empty and is
// kept until the page unmounts; `completeWrapUp` gets it via `outcomeOf`.
// Page state only: the provider stores an outcome once wrap-up completes.

export interface OutcomeDraft {
  tags: string[];
  dispositionCode: string;
  summary: string;
}

const EMPTY: OutcomeDraft = Object.freeze({ tags: [], dispositionCode: "", summary: "" }) as OutcomeDraft;

export function outcomeDraftKey(cardId: string, threadKey: string): string {
  return `${cardId}:${threadKey}`;
}

/** The outcome a draft completes wrap-up with (empty fields left out). */
export function toOutcome(draft: OutcomeDraft): InteractionOutcome {
  return {
    ...(draft.tags.length > 0 ? { tags: draft.tags } : {}),
    ...(draft.dispositionCode ? { dispositionCode: draft.dispositionCode } : {}),
    ...(draft.summary ? { summary: draft.summary } : {}),
  };
}

export function useChannelOutcomeDrafts() {
  const [drafts, setDrafts] = useState<Readonly<Record<string, OutcomeDraft>>>({});

  const draftFor = useCallback((key: string | null | undefined) => (key ? drafts[key] : undefined) ?? EMPTY, [drafts]);

  const update = useCallback((key: string | null | undefined, change: (draft: OutcomeDraft) => OutcomeDraft) => {
    if (!key) return;
    setDrafts((prev) => ({ ...prev, [key]: change(prev[key] ?? EMPTY) }));
  }, []);

  /** Starts the channel over with an empty draft (e.g. a restarted call). */
  const clear = useCallback((key: string) => {
    setDrafts((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  /** The outcome to complete one thread's wrap-up with. */
  const outcomeOf = useCallback((key: string) => toOutcome(drafts[key] ?? EMPTY), [drafts]);

  return useMemo(() => ({ drafts, draftFor, update, clear, outcomeOf }), [drafts, draftFor, update, clear, outcomeOf]);
}
