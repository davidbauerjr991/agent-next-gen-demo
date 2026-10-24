import { useEffect, useMemo, useRef, useState } from "react";
import type { ReferenceCardFocus } from "@/providers";
import { useAssistCardsByContact, useContactAssistCards } from "@/provider-context";
import { useSettings } from "@/settings";
import { journeySummaryFor } from "./journey-summary";
import { useWorkspaceUiField, useWorkspaceUiStore, type ReferenceFocusState, type WorkspaceUiStore } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

/** How long a contact's Journey Summary reads "Looking up" after it arrives. */
const JOURNEY_LOOKUP_MS = 800;

/** How long a card the AI brings forward stays highlighted. */
const REFERENCE_HIGHLIGHT_MS = 1200;


/** A card's reference column before anything was opened: the Real-Time Summary, opened by the AI. */
const INITIAL: ReferenceFocusState = { open: { summary: "ai" } };

const focusOf = (store: WorkspaceUiStore, cardId: string) => store.getState().referenceFocusByCard[cardId] ?? INITIAL;

function write(store: WorkspaceUiStore, cardId: string, next: ReferenceFocusState) {
  store.update((s) => ({ ...s, referenceFocusByCard: { ...s.referenceFocusByCard, [cardId]: next } }));
}

/** The AI brings `card` forward on `cardId` (P-CANVAS): it opens and is
 *  highlighted briefly, and the cards the AI opened earlier collapse — never
 *  ones the agent opened. Unless the agent opened or closed a card by hand on
 *  this same guidance step, which wins until the step advances. */
export function focusReferenceCard(store: WorkspaceUiStore, cardId: string, card: ReferenceCardFocus, stepId: string, now = Date.now()) {
  const current = focusOf(store, cardId);
  if (current.manualStepId !== undefined && current.manualStepId === stepId) return;
  const open: Partial<Record<ReferenceCardFocus, "ai" | "user">> = {};
  for (const [id, by] of Object.entries(current.open) as [ReferenceCardFocus, "ai" | "user"][]) if (by === "user") open[id] = by;
  open[card] = current.open[card] === "user" ? "user" : "ai";
  write(store, cardId, { open, highlight: { card, at: now } });
}

/** The agent opens or closes a card by hand on guidance step `stepId`. Opens
 *  are additive (the others stay open); a close, even of a card the AI
 *  opened, counts as the agent's choice for that step. */
export function setReferenceCardOpen(store: WorkspaceUiStore, cardId: string, card: ReferenceCardFocus, open: boolean, stepId: string | undefined) {
  const current = focusOf(store, cardId);
  const next = { ...current.open };
  if (open) next[card] = "user";
  else delete next[card];
  write(store, cardId, { open: next, ...(stepId !== undefined ? { manualStepId: stepId } : {}) });
}

/** A reference card's header on the active card: whether it's open, the
 *  setter its header uses (a manual click), and whether the AI just brought
 *  it forward (highlighted). */
export function useReferenceAccordion(id: ReferenceCardFocus) {
  const { activeInteraction, activeChannel } = useWorkspace();
  const store = useWorkspaceUiStore();
  const [byCard] = useWorkspaceUiField("referenceFocusByCard");
  const { nba } = useContactAssistCards(activeChannel?.providerInteractionId);
  const cardId = activeInteraction?.id;
  const state = (cardId && byCard[cardId]) || INITIAL;
  const highlightAt = state.highlight?.card === id ? state.highlight.at : undefined;
  const [now, setNow] = useState(() => Date.now());
  const remaining = highlightAt !== undefined ? highlightAt + REFERENCE_HIGHLIGHT_MS - now : 0;
  useEffect(() => {
    if (highlightAt === undefined) return;
    setNow(Date.now());
  }, [highlightAt]);
  useEffect(() => {
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setNow(Date.now()), remaining);
    return () => window.clearTimeout(timer);
  }, [remaining]);
  return {
    open: !!state.open[id],
    onOpenChange: (open: boolean) => {
      if (cardId) setReferenceCardOpen(store, cardId, id, open, nba?.stepId);
    },
    highlighted: remaining > 0,
  };
}

/** Applies the guidance's focus calls (an nba card step with `focus`) to the
 *  card each contact is on, once per step. Mounted once, by the workspace
 *  controller, so a card that isn't showing still gets its focus. */
export function useGuidanceFocus(cards: readonly { id: string; threads: readonly { providerInteractionId?: string }[] }[]) {
  const store = useWorkspaceUiStore();
  const byContact = useAssistCardsByContact();
  const applied = useRef(new Map<string, string>());
  useEffect(() => {
    for (const card of cards) {
      for (const thread of card.threads) {
        const contactId = thread.providerInteractionId;
        const focus = contactId ? byContact[contactId]?.focus : undefined;
        if (!contactId || !focus || applied.current.get(contactId) === focus.stepId) continue;
        applied.current.set(contactId, focus.stepId);
        focusReferenceCard(store, card.id, focus.card, focus.stepId);
      }
    }
  }, [byContact, cards, store]);
}

/** The active thread's contact and its Real-Time Summary card. */
export function useActiveContactSummary() {
  const { activeChannel } = useWorkspace();
  return useContactAssistCards(activeChannel?.providerInteractionId).summary;
}

/** The active card's journey (its script's, else its Contact History; null:
 *  No history) and whether its lookup is still "running": the first
 *  `JOURNEY_LOOKUP_MS` after the workspace first showed this contact. Timed
 *  from that moment (kept per contact in the workspace UI store), never from
 *  the contact's own timestamps, so every contact resolves. */
export function useActiveJourney() {
  const { activeChannel, activeInteraction, scenarioCases, scenarioKeyOf } = useWorkspace();
  const store = useWorkspaceUiStore();
  const [lookups] = useWorkspaceUiField("journeyLookupStartedAt");
  const lookupKey = activeChannel?.providerInteractionId ?? activeInteraction?.id;
  const key = activeInteraction ? scenarioKeyOf(activeInteraction.id) : undefined;
  const script = key ? scenarioCases.byKey[key]?.script : undefined;
  const [channels] = useSettings("channels");
  const journey = useMemo(
    () => journeySummaryFor({ script, customerName: activeInteraction?.customerName, customerId: activeInteraction?.customerId, channels }),
    [script, activeInteraction?.customerName, activeInteraction?.customerId, channels],
  );
  const startedAt = lookupKey ? lookups[lookupKey] : undefined;
  useEffect(() => {
    if (!lookupKey || store.getState().journeyLookupStartedAt[lookupKey] !== undefined) return;
    store.update((s) => ({ ...s, journeyLookupStartedAt: { ...s.journeyLookupStartedAt, [lookupKey]: Date.now() } }));
  }, [lookupKey, store]);
  const [now, setNow] = useState(() => Date.now());
  const remaining = startedAt === undefined ? (lookupKey ? JOURNEY_LOOKUP_MS : 0) : startedAt + JOURNEY_LOOKUP_MS - now;
  useEffect(() => {
    if (startedAt === undefined) return;
    const left = startedAt + JOURNEY_LOOKUP_MS - Date.now();
    if (left <= 0) {
      setNow(Date.now());
      return;
    }
    const timer = window.setTimeout(() => setNow(Date.now()), left);
    return () => window.clearTimeout(timer);
  }, [startedAt]);
  return { journey, lookingUp: remaining > 0 };
}
