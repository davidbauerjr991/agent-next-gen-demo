import { useCallback, useEffect, useMemo, useRef } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import type { NextBestActionUse } from "@/components/ai-cards/NextBestActionCard";
import { timeLabel } from "@/components/ai-cards/ai-card-icon";
import { isAiActionMessage } from "@/components/agent-next-gen-ai-messages";
import { CURRENT_AGENT_FIRST_NAME, CURRENT_AGENT_LAST_NAME } from "@/components/agent-next-gen-shared-utils";
import type { InteractionId } from "@/domain";
import { getAssistCardStore, useAssistCardsByContact, useAssistProvider, useContactAssistCards, useInteraction, useInteractions } from "@/provider-context";
import { useSettings } from "@/settings";
import { useWorkspaceUiField, useWorkspaceUiStore } from "./workspace-ui-store";
import { useWorkspace } from "./workspace/WorkspaceContext";

// The Next Best Action (P-CANVAS), inline and on demand: the assist
// provider queues suggestions per contact; one surfaces as a row in the
// conversation (the same insertion path as Copilot result rows) when the
// agent's turn comes (a new assignment's greeting, a scripted agent line),
// the agent asks ("What should I do next?") or the conversation pauses — no
// customer or agent turn for Settings → AI's pause (chat/email or voice).
// Using it (Insert into reply, Said it, Run it, an alternative) or putting it
// aside (Not now) replaces the row with a compact Used/Dismissed row and
// answers the provider. Under every AI display (panel mode: in its AI feed).

const TEXT_CHANNELS = new Set(["chat", "sms", "whatsapp"]);
const AGENT_NAME = `${CURRENT_AGENT_FIRST_NAME} ${CURRENT_AGENT_LAST_NAME}`;
const AGENT_INITIALS = `${CURRENT_AGENT_FIRST_NAME[0] ?? ""}${CURRENT_AGENT_LAST_NAME[0] ?? ""}`;

/** The Copilot chip that asks for the Next Best Action, and its link key. */
export const NBA_CHIP = "What should I do next?";
export const NBA_CHIP_LINK = "nba:next";

/** Whether an Ask Copilot question asks for the Next Best Action. */
export const asksForNextBestAction = (text: string) =>
  /\b(what should i do next|what('?s| is) next|next best action|what do i do now)\b/i.test(text.trim());

type Cards = readonly NavCard[];
type SetCards = (update: (prev: NavCard[]) => NavCard[]) => void;

const threadKeyOf = (thread: NavCard["threads"][number]) => thread.id ?? thread.type;

/** The card and thread a provider contact is on. */
function locate(cards: Cards, contactId: string) {
  for (const card of cards) {
    const thread = card.threads.find((t) => t.providerInteractionId === contactId);
    if (thread) return { card, thread, threadKey: threadKeyOf(thread) };
  }
  return undefined;
}

const row = (fields: Partial<TranscriptMessage> & Pick<TranscriptMessage, "id" | "text">): TranscriptMessage => ({
  sender: "agent",
  name: AGENT_NAME,
  initials: AGENT_INITIALS,
  timestamp: timeLabel(Date.now()),
  ...fields,
});

const appendRow = (cards: NavCard[], cardId: string, threadKey: string, message: TranscriptMessage) =>
  cards.map((c) =>
    c.id === cardId ? { ...c, liveMessages: { ...c.liveMessages, [threadKey]: [...(c.liveMessages?.[threadKey] ?? []), message] } } : c,
  );

// ── Mounted once, by the workspace controller ────────────────────────────

/** Puts each surfaced suggestion (and the "Nothing to suggest" answer to a
 *  request) into its contact's thread as a row, once per step. */
export function useNbaSurfacing(cards: Cards, setCards: SetCards) {
  const byContact = useAssistCardsByContact();
  const store = useWorkspaceUiStore();
  useEffect(() => {
    const { nbaRequested, nbaRowsShown } = store.getState();
    const added: { cardId: string; threadKey: string; message: TranscriptMessage; key: string; contactId: string }[] = [];
    for (const [contactId, { nba }] of Object.entries(byContact)) {
      if (!nba) continue;
      const surfaced = nba.frame === "suggestion";
      const answered = nba.frame === "nothing" && nbaRequested.has(contactId);
      if (!surfaced && !answered) continue;
      const key = `${contactId}:${nba.stepId}`;
      if (nbaRowsShown.has(key)) continue;
      const where = locate(cards, contactId);
      if (!where) continue;
      const message = row({
        id: `nba-${key}`,
        text: surfaced ? nba.suggestion!.title : "Nothing to suggest",
        nba: { contactId, stepId: nba.stepId, ...(surfaced ? {} : { nothing: true as const }) },
      });
      added.push({ cardId: where.card.id, threadKey: where.threadKey, message, key, contactId });
    }
    if (added.length === 0) return;
    store.update((s) => {
      const shown = new Set(s.nbaRowsShown);
      const requested = new Set(s.nbaRequested);
      for (const a of added) {
        shown.add(a.key);
        requested.delete(a.contactId);
      }
      return { ...s, nbaRowsShown: shown, nbaRequested: requested };
    });
    setCards((prev) => added.reduce((acc, a) => appendRow(acc, a.cardId, a.threadKey, a.message), prev));
  }, [byContact, cards, setCards, store]);
}

/** Asks the provider for the Next Best Action when a live thread pauses: no
 *  customer or agent turn (nor an answered suggestion) for the setting's
 *  time. A new turn restarts the clock; a bot holding the contact
 *  (review) holds it, and taking over starts it again. A pause that
 *  surfaces nothing (none queued) is `onQuietPause`'s. */
export function useNbaPause(cards: Cards, scriptedContactIds: ReadonlySet<string>, onQuietPause?: (contactId: string) => void) {
  const [ai] = useSettings("ai");
  const assist = useAssistProvider();
  const contacts = useInteractions();
  const quiet = useRef(onQuietPause);
  quiet.current = onQuietPause;
  // One entry per live unscripted contact (a scripted one's turns gate on its agent lines instead, `useNbaTurns`):
  // what counts as activity on its thread.
  const entries = useMemo(() => {
    const byId = new Map(contacts.map((c) => [c.id as string, c]));
    const out: { contactId: string; idleMs: number; signature: string }[] = [];
    for (const card of cards) {
      for (const thread of card.threads) {
        const contactId = thread.providerInteractionId;
        const contact = contactId ? byId.get(contactId) : undefined;
        if (!contactId || !contact || contact.state !== "active" || contact.review || scriptedContactIds.has(contactId)) continue;
        const messages = card.liveMessages?.[threadKeyOf(thread)] ?? [];
        const turns = messages.filter((m) => !m.event && !isAiActionMessage(m)).length;
        const answered = messages.filter((m) => m.nbaOutcome).length;
        out.push({
          contactId,
          idleMs: contact.channel === "voice" ? ai.nbaPauseVoiceMs : ai.nbaPauseChatMs,
          signature: `${turns}:${answered}`,
        });
      }
    }
    return out;
  }, [contacts, cards, ai.nbaPauseChatMs, ai.nbaPauseVoiceMs, scriptedContactIds]);

  // Since when each contact's signature has held (a ref: it outlives renders, not the controller).
  const since = useRef(new Map<string, { signature: string; at: number; asked: boolean }>());
  const key = entries.map((e) => `${e.contactId}=${e.signature}/${e.idleMs}`).join("|");
  useEffect(() => {
    const now = Date.now();
    const live = new Set(entries.map((e) => e.contactId));
    for (const id of [...since.current.keys()]) if (!live.has(id)) since.current.delete(id);
    const timers: number[] = [];
    for (const { contactId, idleMs, signature } of entries) {
      let mark = since.current.get(contactId);
      if (!mark || mark.signature !== signature) {
        mark = { signature, at: now, asked: false };
        since.current.set(contactId, mark);
      }
      if (mark.asked) continue;
      const current = mark;
      timers.push(
        window.setTimeout(() => {
          current.asked = true;
          assist
            .suggest({ interactionId: contactId as InteractionId, trigger: { kind: "pause", idleMs } })
            // The card event arrives before the reply, so the store already holds what the pause surfaced.
            .then(() => {
              if (getAssistCardStore(assist).getState()[contactId]?.nba?.frame !== "suggestion") quiet.current?.(contactId);
            })
            .catch((err) => import.meta.env.DEV && console.warn("[nba] pause suggest failed", err));
        }, Math.max(0, current.at + idleMs - now)),
      );
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
    // `key` captures every entry's contact, signature and pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, assist]);
}

/** A scripted conversation that reached the agent's turn (its nba card's
 *  `awaitingAgent`, not yet surfaced) gets that turn's suggestion after a
 *  short beat (Settings → AI's scripted delay): the provider is asked with a
 *  "turn" trigger. Once per waiting episode per contact. */
export function useNbaTurns() {
  const [ai] = useSettings("ai");
  const assist = useAssistProvider();
  const byContact = useAssistCardsByContact();
  const timers = useRef(new Map<string, number>());
  useEffect(() => {
    const waiting = new Set<string>();
    for (const [contactId, { nba }] of Object.entries(byContact)) {
      if (!nba?.awaitingAgent || nba.frame === "suggestion") continue;
      waiting.add(contactId);
      if (timers.current.has(contactId)) continue;
      timers.current.set(
        contactId,
        window.setTimeout(() => {
          timers.current.delete(contactId);
          assist
            .suggest({ interactionId: contactId as InteractionId, trigger: { kind: "turn" } })
            .catch((err) => import.meta.env.DEV && console.warn("[nba] turn suggest failed", err));
        }, ai.nbaScriptedDelayMs),
      );
    }
    // A contact no longer waiting (surfaced on request, or over) drops its beat.
    for (const [contactId, timer] of [...timers.current]) {
      if (!waiting.has(contactId)) {
        window.clearTimeout(timer);
        timers.current.delete(contactId);
      }
    }
  }, [byContact, assist, ai.nbaScriptedDelayMs]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) window.clearTimeout(timer);
      pending.clear();
    };
  }, []);
}

/** The send that is a scripted agent turn the agent inserted (Insert into
 *  reply): answers its suggestion as typed, so the script goes on without its
 *  own line. Returns whether this send was such a turn. */
export function useTypedTurnRelease() {
  const assist = useAssistProvider();
  const store = useWorkspaceUiStore();
  return useCallback(
    (cardId: string, threadKey: string): boolean => {
      const key = `${cardId}:${threadKey}`;
      const nbaCardId = store.getState().nbaAwaitingSend[key];
      if (!nbaCardId) return false;
      store.update((s) => {
        const { [key]: _sent, ...rest } = s.nbaAwaitingSend;
        return { ...s, nbaAwaitingSend: rest };
      });
      assist
        .resolveCard(nbaCardId, { outcome: "used", agentTyped: true })
        .catch((err) => import.meta.env.DEV && console.warn("[nba] typed turn failed", err));
      return true;
    },
    [assist, store],
  );
}

/** Asks for the Next Best Action now (the "What should I do next?" chip, or
 *  that question in Ask Copilot) on a card's thread. The answer surfaces as a
 *  row: the suggestion, or "Nothing to suggest". Nothing while a bot holds
 *  the contact. */
export function useRequestNextBestAction(cards: Cards) {
  const assist = useAssistProvider();
  const contacts = useInteractions();
  const store = useWorkspaceUiStore();
  return useCallback(
    (cardId: string, threadKey: string) => {
      const thread = cards.find((c) => c.id === cardId)?.threads.find((t) => threadKeyOf(t) === threadKey);
      const contactId = thread?.providerInteractionId;
      const contact = contactId ? contacts.find((c) => c.id === contactId) : undefined;
      if (!contactId || !contact || contact.review) return;
      store.update((s) => ({ ...s, nbaRequested: new Set(s.nbaRequested).add(contactId) }));
      assist
        .suggest({ interactionId: contactId as InteractionId, trigger: { kind: "next-best-action" } })
        .catch((err) => import.meta.env.DEV && console.warn("[nba] request failed", err));
    },
    [assist, cards, contacts, store],
  );
}

type CopilotChipProps = {
  copilotSuggestionLinks?: Record<string, string>;
  copilotPinnedSuggestion?: string;
  onCopilotSuggestionLink?: (link: string) => void;
  onCopilotAsk?: (text: string) => void;
};

/** A Copilot composer's chips and asks, with "What should I do next?" as a
 *  pinned chip (always shown after the rotating ones, and still there after
 *  use): the chip, or that question typed into Ask Copilot, asks for the Next
 *  Best Action (`ask`) instead of a Copilot answer. */
export function withNextBestActionChip<P extends CopilotChipProps>(props: P, ask: () => void): P {
  return {
    ...props,
    copilotPinnedSuggestion: NBA_CHIP,
    copilotSuggestionLinks: { ...props.copilotSuggestionLinks, [NBA_CHIP]: NBA_CHIP_LINK },
    // A linked chip asks at once and follows its link after its spinner; the ask is the request.
    onCopilotSuggestionLink: (link: string) => {
      if (link !== NBA_CHIP_LINK) props.onCopilotSuggestionLink?.(link);
    },
    onCopilotAsk: (text: string) => (asksForNextBestAction(text) ? ask() : props.onCopilotAsk?.(text)),
  };
}

// ── The row ──────────────────────────────────────────────────────────────

/** A surfaced suggestion's row: the live suggestion (while it's the
 *  contact's showing one) and what each button does. */
export function useNextBestActionRow(contactId: string, rowId: string, stepId: string) {
  const ws = useWorkspace();
  const assist = useAssistProvider();
  const { interactions, setInteractions } = ws;
  const { nba: card } = useContactAssistCards(contactId);
  const contact = useInteraction(contactId as InteractionId);
  const [, setPrefill] = useWorkspaceUiField("composerPrefill");
  const where = locate(interactions, contactId);
  const cardId = where?.card.id;
  const threadKey = where?.threadKey;
  const suggestion = card?.frame === "suggestion" && card.stepId === stepId ? card.suggestion : undefined;

  // A Say or Ask goes into the chat composer where the thread has one, is
  // "said" on a call, and is only copied elsewhere (email, a chat a bot still holds).
  const channel = where?.thread.type;
  const hasChatComposer = !!channel && TEXT_CHANNELS.has(channel) && !where?.card.closed && !contact?.review;
  const use: NextBestActionUse = channel === "voice" ? "said" : hasChatComposer ? "insert" : "copy";

  /** Replaces this row with the compact Used/Dismissed row. */
  const settle = useCallback(
    (outcome: "used" | "dismissed", title: string) => {
      if (!cardId || !threadKey) return;
      const at = timeLabel(Date.now());
      const outcomeRow = row({ id: `nba-${outcome}-${rowId}`, timestamp: at, text: title, nbaOutcome: { outcome, title, at } });
      setInteractions((prev) =>
        appendRow(
          prev.map((c) =>
            c.id === cardId ? { ...c, liveMessages: { ...c.liveMessages, [threadKey]: (c.liveMessages?.[threadKey] ?? []).filter((m) => m.id !== rowId) } } : c,
          ),
          cardId,
          threadKey,
          outcomeRow,
        ),
      );
    },
    [cardId, threadKey, rowId, setInteractions],
  );

  const resolve = useCallback(
    (outcome: "used" | "dismissed", alternative?: number) => {
      if (!card) return;
      assist.resolveCard(card.id, { outcome, ...(alternative !== undefined ? { alternative } : {}) }).catch((err) => {
        if (import.meta.env.DEV) console.warn("[nba] resolveCard failed", err);
      });
    },
    [assist, card],
  );

  // A scripted agent turn (the conversation waits on this suggestion): Insert waits for the send, which is the turn
  // (`useTypedTurnRelease`); Not now answers after the beat, and the script's own line then plays.
  const turn = !!card?.awaitingAgent;
  const [ai] = useSettings("ai");
  const store = useWorkspaceUiStore();
  const onUse = useCallback(() => {
    if (!suggestion || !cardId || !threadKey) return;
    if (suggestion.type === "do") {
      if (suggestion.link) ws.snapshotLinkHandlerFor(cardId)(suggestion.link);
    } else if (use === "insert" && suggestion.text) {
      setPrefill((prev) => ({ ...prev, [`${cardId}:${threadKey}`]: suggestion.text! }));
      if (turn && card) {
        store.update((s) => ({ ...s, nbaAwaitingSend: { ...s.nbaAwaitingSend, [`${cardId}:${threadKey}`]: card.id } }));
        settle("used", suggestion.title);
        return;
      }
    }
    settle("used", suggestion.title);
    resolve("used");
  }, [suggestion, cardId, threadKey, use, ws, setPrefill, settle, resolve, turn, card, store]);

  const onCopy = useCallback(() => {
    const text = suggestion?.text ?? suggestion?.action;
    if (text) void navigator.clipboard?.writeText(text).catch(() => {});
  }, [suggestion]);

  const onNotNow = useCallback(() => {
    if (!suggestion) return;
    settle("dismissed", suggestion.title);
    if (turn) window.setTimeout(() => resolve("dismissed"), ai.nbaScriptedDelayMs);
    else resolve("dismissed");
  }, [suggestion, settle, resolve, turn, ai.nbaScriptedDelayMs]);

  const onUseAlternative = useCallback(
    (index: number) => {
      const alternative = suggestion?.alt[index];
      if (!alternative) return;
      settle("used", alternative.text);
      resolve("used", index);
    },
    [suggestion, settle, resolve],
  );

  return { suggestion, use, onUse, onCopy, onNotNow, onUseAlternative };
}
