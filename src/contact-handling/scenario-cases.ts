import { useCallback, useMemo } from "react";
import type { NavCard } from "@/adapters/legacy/nav-card-view-model";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";
import type { Interaction, InteractionId, Message, Participant, Utterance } from "@/domain";
import { useInteractionProvider, useInteractions, useTranscript, useTyping, type TranscriptState } from "@/provider-context";
import type { RequestResponse } from "@/providers";
import { LUCAS_THOMAS_SCRIPT, MARCUS_WEBB_SCRIPT, MAYA_CHEN_SCRIPT, SCENARIOS, TOM_LEWIS_SCRIPT, type ScenarioScript } from "@/scenarios";

// Scripted cases on the agent side (P0.5c). The engine plays the script; a
// scenario contact is an ordinary provider contact, and this module is how
// the agent UI recognizes one (by its case id, the way a CRM would find a
// case's content) and renders its transcript from the store. The content
// registry is `SCENARIOS` until P1 serves it from the active profile.

/** Each case's key: the script's entity key, which is also the id the page's
 *  case-specific content (panels, overview overrides, chips) is keyed by. */
export const MARCUS_WEBB_ID = MARCUS_WEBB_SCRIPT.entity.key;
export const LUCAS_THOMAS_ID = LUCAS_THOMAS_SCRIPT.entity.key;
export const TOM_LEWIS_CALL_ID = TOM_LEWIS_SCRIPT.entity.key;
export const MAYA_CHEN_CALL_ID = MAYA_CHEN_SCRIPT.entity.key;
/** Marcus's case id, also his customer record id on the page. */
export const MARCUS_WEBB_CUSTOMER_ID = MARCUS_WEBB_SCRIPT.entity.caseId;
export const MARCUS_WEBB_CUSTOMER_NAME = MARCUS_WEBB_SCRIPT.entity.name;

/** The script whose case `caseId` is. */
export function scenarioForCaseId(caseId: string | undefined): ScenarioScript | undefined {
  return caseId === undefined ? undefined : SCENARIOS.find((s) => s.entity.caseId === caseId);
}

/** The scripted contact of `script` in the store: the routed inbound
 *  contact filed under its case, newest first (a later outbound call into
 *  the same journey shares the case but isn't the script's). */
function scenarioContact(interactions: readonly Interaction[], script: ScenarioScript): Interaction | undefined {
  let found: Interaction | undefined;
  for (const i of interactions) {
    if (i.caseId === script.entity.caseId && i.origin === "routed" && i.direction === "inbound") {
      if (!found || i.startedAt >= found.startedAt) found = i;
    }
  }
  return found;
}

// ── Transcript rows ───────────────────────────────────────────────────────

function initialsOf(who: Participant): string {
  if (who.role === "bot" || who.role === "system") return "AI";
  return who.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

const timeOf = (atMs: number) => new Date(atMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** A row with its time, for ordering scripted lines with the page's own. */
export interface TimedRow {
  at: number;
  row: TranscriptMessage;
}

/** Maps a scripted contact's messages and utterances onto the transcript's
 *  rows: customer lines on the customer side; bot, system and agent lines on
 *  the agent side (the bot as "AI"); system events as event lines;
 *  annotations as the interstitial, approval and wrap-up rows, their payloads
 *  looked up in the script's content. */
export function toTranscriptRows(transcript: Pick<TranscriptState, "messages" | "utterances">, script: ScenarioScript): TimedRow[] {
  const bot = script.participants?.bot ?? "Virtual agent";
  const agent = script.participants?.agent ?? "John Smith";
  const rows: TimedRow[] = [];
  const side = (who: Participant) => (who.role === "customer" ? "customer" : "agent") as TranscriptMessage["sender"];
  const nameOf = (who: Participant) => (who.role === "system" ? bot : who.displayName);

  for (const m of transcript.messages as readonly Message[]) {
    const timestamp = timeOf(m.sentAt);
    const base = { id: m.id, sender: side(m.author), name: nameOf(m.author), initials: initialsOf(m.author), timestamp };
    const a = m.annotation;
    if (a?.kind === "instruction") {
      rows.push({
        at: m.sentAt,
        row: {
          ...base,
          text: m.text,
          instruction: {
            title: m.text,
            by: a.by ?? agent,
            link: a.link ?? `instruction:${a.ref}:${encodeURIComponent(m.text)}:${encodeURIComponent(timestamp)}`,
          },
        },
      });
    } else if (a?.kind === "approval") {
      const summary = script.content.approvals?.[a.ref];
      if (summary) {
        // The decision the provider recorded, so the card stays decided across a remount (tier switch).
        const decided = a.response ? { value: a.response.value, ...(a.response.note ? { note: a.response.note } : {}) } : undefined;
        rows.push({ at: m.sentAt, row: { ...base, name: bot, initials: "AI", text: "", summary, ...(decided ? { decided } : {}) } });
      }
    } else if (a?.kind === "wrap-up") {
      const wrapUp = script.content.wrapUps?.[a.ref];
      if (wrapUp) {
        rows.push({
          at: m.sentAt,
          row: {
            ...base,
            name: bot,
            initials: "AI",
            text: "",
            wrapUp: {
              title: wrapUp.title,
              summary: wrapUp.summary,
              disposition: wrapUp.disposition,
              buttonLabel: wrapUp.buttonLabel,
              ...(a.withdrawn ? { exiting: true } : {}),
            },
          },
        });
      }
    } else {
      rows.push({ at: m.sentAt, row: { ...base, text: m.text, ...(m.kind === "event" ? { event: true } : {}) } });
    }
  }
  for (const u of transcript.utterances as readonly Utterance[]) {
    rows.push({
      at: u.startedAt,
      row: { id: u.id, sender: side(u.speaker), name: nameOf(u.speaker), initials: initialsOf(u.speaker), timestamp: timeOf(u.startedAt), text: u.text },
    });
  }
  return rows.sort((x, y) => x.at - y.at);
}

/** When the page first saw each of its own rows (Ask Copilot interstitials,
 *  the agent's typed lines), so they keep their place among the scripted
 *  lines that keep arriving. Rows are immutable state objects, so identity
 *  is a stable key. */
const firstSeen = new WeakMap<TranscriptMessage, number>();

/** The scripted rows merged with the page's own rows for that thread, in
 *  time order. */
export function mergeRows(scripted: readonly TimedRow[], own: readonly TranscriptMessage[] | undefined, now = Date.now()): TranscriptMessage[] {
  if (!own || own.length === 0) return scripted.map((r) => r.row);
  const timed = own.map((row) => {
    let at = firstSeen.get(row);
    if (at === undefined) {
      at = now;
      firstSeen.set(row, at);
    }
    return { at, row };
  });
  return [...scripted, ...timed].sort((x, y) => x.at - y.at).map((r) => r.row);
}

// ── The page-facing hook ──────────────────────────────────────────────────

export interface ScenarioCase {
  key: string;
  script: ScenarioScript;
  /** The scripted contact (the store's snapshot). */
  contact: Interaction;
  /** Its nav card and thread, once the card is on screen. */
  cardId?: string;
  threadKey?: string;
  rows: TimedRow[];
  messages: readonly Message[];
  aiTyping: boolean;
  customerTyping: boolean;
  /** The bot still has it; the agent reads along. */
  reviewing: boolean;
}

export interface ScenarioCases {
  /** The live case for a key (e.g. `LUCAS_THOMAS_ID`), if one is playing. */
  byKey: Record<string, ScenarioCase | undefined>;
  /** The case key of a nav card id, if the card is a scripted case's. */
  keyOf: (cardId: string | undefined) => string | undefined;
  /** The nav card id of a case key. */
  cardIdOf: (key: string) => string | undefined;
  takeOver: (key: string, options?: { handoff?: boolean }) => void;
  /** Answers the bot. A decision value from an approval card finds its card
   *  (decision values are distinct across a script's cards); "complete"
   *  answers the open wrap-up card; anything else is an action branch. */
  respond: (key: string, response: Omit<RequestResponse, "requestId">) => void;
}

/** One `useTranscript`/`useTyping` per script in the static `SCENARIOS`
 *  list, so the hook count never changes. */
export function useScenarioCases(cards: readonly NavCard[]): ScenarioCases {
  const provider = useInteractionProvider();
  const interactions = useInteractions();
  const contacts = SCENARIOS.map((script) => scenarioContact(interactions, script));
  // eslint-disable-next-line react-hooks/rules-of-hooks -- SCENARIOS is a module constant: the same hooks, in order, every render
  const transcripts = contacts.map((contact) => useTranscript(contact?.id));
  // eslint-disable-next-line react-hooks/rules-of-hooks -- as above
  const typing = contacts.map((contact) => useTyping(contact?.id));

  const byKey = useMemo(() => {
    const result: Record<string, ScenarioCase | undefined> = {};
    SCENARIOS.forEach((script, index) => {
      const contact = contacts[index];
      if (!contact || contact.state === "ended") return;
      const card = cards.find((c) => c.threads.some((t) => t.providerInteractionId === contact.id));
      const thread = card?.threads.find((t) => t.providerInteractionId === contact.id);
      result[script.entity.key] = {
        key: script.entity.key,
        script,
        contact,
        ...(card ? { cardId: card.id } : {}),
        ...(thread ? { threadKey: thread.id } : {}),
        rows: toTranscriptRows(transcripts[index], script),
        messages: transcripts[index].messages,
        aiTyping: !!typing[index].bot,
        customerTyping: !!typing[index].customer,
        reviewing: !!contact.review,
      };
    });
    return result;
    // The per-script inputs are store references, stable until they change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, ...contacts, ...transcripts, ...typing]);

  const keyOf = useCallback(
    (cardId: string | undefined) => {
      if (cardId === undefined) return undefined;
      for (const c of Object.values(byKey)) if (c?.cardId === cardId) return c.key;
      return undefined;
    },
    [byKey],
  );
  const cardIdOf = useCallback((key: string) => byKey[key]?.cardId, [byKey]);

  const takeOver = useCallback(
    (key: string, options?: { handoff?: boolean }) => {
      const c = byKey[key];
      if (!c) return;
      provider.takeOver(c.contact.id, options).catch((error) => {
        if (import.meta.env.DEV) console.warn("[scenario] takeOver failed", error);
      });
    },
    [byKey, provider],
  );

  const respond = useCallback(
    (key: string, response: Omit<RequestResponse, "requestId">) => {
      const c = byKey[key];
      if (!c) return;
      const cards = c.messages.filter((m) => m.annotation?.kind === "approval" || m.annotation?.kind === "wrap-up");
      const request =
        response.value === "complete"
          ? [...cards].reverse().find((m) => m.annotation?.kind === "wrap-up" && !m.annotation.response && !m.annotation.withdrawn)
          : [...cards]
              .reverse()
              .find((m) => m.annotation?.kind === "approval" && c.script.content.approvals?.[m.annotation.ref]?.decisions?.some((d) => d.value === response.value));
      provider
        .respondToRequest(c.contact.id as InteractionId, { ...response, ...(request ? { requestId: request.id } : {}) })
        .catch((error) => {
          if (import.meta.env.DEV) console.warn("[scenario] respondToRequest failed", error);
        });
    },
    [byKey, provider],
  );

  return { byKey, keyOf, cardIdOf, takeOver, respond };
}
