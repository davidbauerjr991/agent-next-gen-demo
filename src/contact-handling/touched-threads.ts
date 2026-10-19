import { useCallback, useEffect, useMemo } from "react";
import { threadKey } from "@/adapters/legacy/nav-card-view-model";
import type { Interaction as DomainInteraction } from "@/domain";
import { NOTIFICATION_INTERACTION_ID } from "./seed-notification-ids";
import { CONTACT_CHANNELS, useSettings } from "@/settings";
import { useWorkspaceUiField } from "./workspace-ui-store";

// P-POLISH 1: an auto-accepted demo seed the agent never touched goes back to
// waiting (card and notification hidden, as before it was accepted) while its
// channel is off (Settings → Channels), and is shown again once it's on. A
// thread is touched once the agent opens it (as the main thread or in the
// docked preview), sends on it or opens its Outcome; a draft needs it open,
// so a draft touches it too. Keys are `${cardId}:${threadKey}`, the
// Outcome-draft scheme: a thread key ("email") is only unique within a card.

const SEED_IDS: ReadonlySet<string> = new Set(Object.values(NOTIFICATION_INTERACTION_ID));

export const touchedThreadKey = (cardId: string, threadId: string) => `${cardId}:${threadId}`;

/** Marks a thread touched; the same key stays touched for the session. */
export function useTouchThread(): (cardId: string, threadId: string) => void {
  const [, setTouched] = useWorkspaceUiField("touchedThreads");
  return useCallback(
    (cardId: string, threadId: string) => {
      const key = touchedThreadKey(cardId, threadId);
      setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));
    },
    [setTouched],
  );
}

/** Marks every thread key passed (a full `${cardId}:${threadKey}`) touched whenever it changes. */
export function useTouchedWhileShown(keys: readonly (string | null | undefined)[]): void {
  const [, setTouched] = useWorkspaceUiField("touchedThreads");
  const joined = keys.filter((k): k is string => !!k).join("\n");
  useEffect(() => {
    if (!joined) return;
    setTouched((prev) => {
      const missing = joined.split("\n").filter((k) => !prev.has(k));
      if (missing.length === 0) return prev;
      const next = new Set(prev);
      for (const k of missing) next.add(k);
      return next;
    });
  }, [joined, setTouched]);
}

/** The demo seeds accepted but untouched whose channel is off: shown as if still waiting. */
export function useParkedSeedIds(contacts: readonly DomainInteraction[]): ReadonlySet<string> {
  const [touched] = useWorkspaceUiField("touchedThreads");
  const [channels] = useSettings("channels");
  return useMemo(() => {
    const parked = new Set<string>();
    for (const c of contacts) {
      if (!SEED_IDS.has(c.id) || c.state !== "active" || c.channel === "voice") continue;
      if (!CONTACT_CHANNELS.includes(c.channel as (typeof CONTACT_CHANNELS)[number])) continue;
      if (channels[c.channel as (typeof CONTACT_CHANNELS)[number]]) continue;
      if (touched.has(touchedThreadKey(c.journeyId, threadKey(c)))) continue;
      parked.add(c.id);
    }
    return parked;
  }, [contacts, touched, channels]);
}
