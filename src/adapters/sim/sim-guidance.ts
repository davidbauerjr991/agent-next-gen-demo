import type { Interaction, InteractionId } from "../../domain";
import type {
  AssistCard,
  AssistCardResolution,
  AssistEvents,
  AssistRequestId,
  NextBestActionSuggestion,
  ReferenceCardFocus,
} from "../../providers";
import type { ScenarioNba, ScenarioScript, ScenarioStep } from "../../scenarios/scenario-script";
import { providerError } from "../provider-error";
import { SIM_AGENT } from "./sim-fixtures";
import { isAgentTurn } from "./sim-scenario-player";

// The simulated AI's guidance (P-CANVAS), inside the sim engine: each live
// contact's Next Best Action (an assist `nba` card) and its Real-Time Summary
// (an assist `text` card). Scripted contacts queue suggestions from the
// script's steps (`nba`); every other contact follows a small rule set —
// greet the customer (and say the contact is recorded), then ask what they
// need. A queued suggestion surfaces only when the agent asks
// (`surface("request")`; "nothing to suggest" if the queue is empty) or the
// conversation pauses (`surface("pause")`, which the agent UI times from its
// settings), one at a time, never while a bot holds the contact. The agent's
// answer (`resolveCard`) clears it, and a used suggestion with a `branch`
// starts that action branch of the script.

export interface GuidanceHost {
  now(): number;
  get(id: InteractionId): Interaction | undefined;
  /** The customer's display name. */
  customerName(id: InteractionId): string | undefined;
  /** An assist `card` event for the contact. */
  send(payload: AssistEvents["card"]): void;
  /** Starts a script's action branch (a used suggestion's `branch`). */
  startBranch(id: InteractionId, branch: string): void;
  /** Runs `run` after `ms` (engine-owned timers, cleared on dispose). */
  later(ms: number, run: () => void): void;
  /** The agent answered the suggestion a scripted run waits on: the run plays its agent line (unless the agent
   *  typed the turn, `skipLine`) and goes on. */
  releaseTurn(id: InteractionId, skipLine: boolean): void;
}

/** How long the simulated journey lookup takes on a contact with a known
 *  customer; it brings the Journey Summary forward when it completes. */
export const SIM_JOURNEY_LOOKUP_MS = 800;

export interface Guidance {
  /** A scripted contact was just routed (before it's announced). */
  startScript(id: InteractionId, script: ScenarioScript): void;
  /** Every interaction snapshot the engine emits. */
  onInteraction(interaction: Interaction): void;
  /** A scripted step just played. */
  onStep(id: InteractionId, step: ScenarioStep): void;
  /** The agent answered a card (`AssistProvider.resolveCard`). */
  resolve(cardId: string, resolution: AssistCardResolution): void;
  /** Surfaces the queue's head (`AssistProvider.suggest`): on the agent's
   *  request ("Nothing to suggest" when the queue is empty) or after a pause
   *  in the conversation (nothing when it's empty). Never while a bot holds
   *  the contact, or while a suggestion is already showing. */
  surface(id: InteractionId, reason: "request" | "pause" | "turn", requestId: AssistRequestId): void;
  dispose(): void;
}

interface Queued {
  stepId: string;
  suggestion: NextBestActionSuggestion;
  /** The agent's turn in a scripted conversation (an agent line's `nba`): the run waits on it. */
  turn?: true;
}

interface Guide {
  id: InteractionId;
  scripted: boolean;
  /** The contact went live once (the greeting and summary start then). */
  live: boolean;
  /** Wrap-up or ended: nothing more to suggest. */
  over: boolean;
  /** Suggestions not yet surfaced, oldest first. */
  queue: Queued[];
  /** The surfaced suggestion, until the agent answers it. */
  current?: Queued;
  /** The agent's turn a scripted run waits on, not yet surfaced (it goes first). */
  turn?: Queued;
  /** Bumped per card state, so a "listening" or "nothing" card has its own step id. */
  seq: number;
  summary: { lines: string[]; revealed: number };
}

const LIVE = ["active", "held"];
const nbaCardId = (id: InteractionId) => `nba:${id}`;
const summaryCardId = (id: InteractionId) => `summary:${id}`;
const requestIdOf = (id: InteractionId) => `guide:${id}` as AssistRequestId;

/** `[label](key)` links in scenario text, as plain labels. */
const plain = (text: string) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

/** A first name when the contact presented a name (not a number or an address). */
function firstName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed || /[@\d]/.test(trimmed)) return undefined;
  return trimmed.split(/\s+/)[0];
}

const AGENT_FIRST = SIM_AGENT.displayName.split(" ")[0];

/** The opening suggestion on every contact: greet by name, give the recording notice. */
export function greetingNba(channel: Interaction["channel"], name: string | undefined): ScenarioNba {
  const first = firstName(name);
  const medium = channel === "voice" ? "call" : channel === "email" ? "conversation" : "chat";
  const hello = first ? `Hi ${first}` : "Hi there";
  return {
    type: "say",
    title: first ? `Greet ${first} and say the ${medium} is recorded` : `Greet the customer and say the ${medium} is recorded`,
    why: `Every contact opens with a greeting and the recording notice.`,
    text: `${hello}, thanks for ${channel === "voice" ? "calling" : "reaching out"}. My name is ${AGENT_FIRST}. This ${medium} is recorded for quality and training.`,
    alt: [
      { type: "say", text: "Identify yourself" },
      { type: "ask", text: "Confirm the callback number" },
    ],
  };
}

/** The rule set's second suggestion: ask what the contact is about. */
export function reasonNba(name: string | undefined): ScenarioNba {
  const first = firstName(name);
  return {
    type: "ask",
    title: `Ask what ${first ?? "the customer"} is contacting us about`,
    why: "Nothing on file says why they're reaching out yet.",
    text: "How can I help you today?",
    alt: [{ type: "ask", text: "Ask for their order or case number" }],
  };
}

export function createGuidance(host: GuidanceHost): Guidance {
  const guides = new Map<InteractionId, Guide>();

  function guideFor(id: InteractionId): Guide {
    let g = guides.get(id);
    if (!g) {
      g = { id, scripted: false, live: false, over: false, queue: [], seq: 0, summary: { lines: [], revealed: 0 } };
      guides.set(id, g);
    }
    return g;
  }

  const suggestion = (nba: ScenarioNba): NextBestActionSuggestion => ({
    type: nba.type,
    title: nba.title,
    why: nba.why,
    ...(nba.text !== undefined ? { text: nba.text } : {}),
    ...(nba.action !== undefined ? { action: nba.action } : {}),
    ...(nba.link !== undefined ? { link: nba.link } : {}),
    ...(nba.branch !== undefined ? { branch: nba.branch } : {}),
    alt: (nba.alt ?? []).map((a) => ({ type: a.type, text: a.text, ...(a.branch !== undefined ? { branch: a.branch } : {}) })),
    at: host.now(),
  });

  /** The card's current state: the surfaced suggestion, else listening
   *  (nothing showing), or "nothing" (`nothing`: the answer to a request with
   *  none, or the contact is over). A focus call is a step of its own: its
   *  step id, the suggestion showing unchanged, and the card to bring forward. */
  function sendNba(g: Guide, options: { focus?: { stepId: string; card: ReferenceCardFocus }; nothing?: boolean; requestId?: AssistRequestId } = {}) {
    g.seq += 1;
    const { focus, nothing, requestId } = options;
    const frame = g.current ? "suggestion" : nothing || g.over ? "nothing" : "listening";
    const card: AssistCard = {
      id: nbaCardId(g.id),
      kind: "nba",
      title: "Next Best Action",
      status: "complete",
      provenance: { tier: 1, collections: g.scripted ? ["flow"] : ["rules"] },
      stepId: focus?.stepId ?? g.current?.stepId ?? `${frame}-${g.seq}`,
      frame,
      ...(g.current ? { suggestion: g.current.suggestion } : {}),
      ...(focus ? { focus: focus.card } : {}),
      ...(g.turn || g.current?.turn ? { awaitingAgent: true as const } : {}),
    };
    host.send({ requestId: requestId ?? requestIdOf(g.id), interactionId: g.id, card });
  }

  function sendSummary(g: Guide) {
    const { lines, revealed } = g.summary;
    if (revealed === 0) return;
    const card: AssistCard = {
      id: summaryCardId(g.id),
      kind: "text",
      purpose: "real-time-summary",
      title: "Real-Time Summary",
      status: g.over ? "complete" : "streaming",
      provenance: { tier: 2, collections: ["transcript"] },
      text: lines.slice(0, revealed).join(" "),
    };
    host.send({ requestId: requestIdOf(g.id), interactionId: g.id, card });
  }

  /** Queues a suggestion; it surfaces only on a request or a pause (`surface`). */
  function enqueue(g: Guide, stepId: string, nba: ScenarioNba) {
    if (g.over) return;
    g.queue.push({ stepId, suggestion: suggestion(nba) });
  }

  return {
    startScript(id, script) {
      const g = guideFor(id);
      g.scripted = true;
      g.summary.lines = (script.content.overview?.snapshot ?? []).map(plain);
      // Customer lines the contact arrives with are already in the summary.
      const backfilled = script.steps.filter((s) => s.at < 0 && s.kind === "say" && s.speaker === "customer").length;
      g.summary.revealed = Math.min(g.summary.lines.length, backfilled);
    },

    onInteraction(interaction) {
      const g = guideFor(interaction.id);
      if (g.over) return;
      if (interaction.state === "wrap-up" || interaction.state === "ended") {
        if (!g.live) return;
        g.over = true;
        g.queue = [];
        g.current = undefined;
        g.turn = undefined;
        sendNba(g);
        sendSummary(g);
        return;
      }
      if (g.live || !LIVE.includes(interaction.state)) return;
      g.live = true;
      if (g.scripted) {
        // A scripted contact's guidance comes from its steps.
        sendSummary(g);
        return;
      }
      // Pre-contact lines (a routed call's IVR summary) start the running summary.
      if (interaction.preContactSummary?.length) {
        g.summary.lines = [...interaction.preContactSummary];
        g.summary.revealed = g.summary.lines.length;
        sendSummary(g);
      }
      enqueue(g, "rule-greeting", greetingNba(interaction.channel, host.customerName(interaction.id) ?? interaction.contactName));
      // A known customer's journey lookup completes a moment later and brings the Journey Summary forward.
      if (interaction.entityId) {
        host.later(SIM_JOURNEY_LOOKUP_MS, () => {
          if (!g.over) sendNba(g, { focus: { stepId: `rule-journey`, card: "journey" } });
        });
      }
    },

    onStep(id, step) {
      const g = guides.get(id);
      if (!g?.scripted || g.over) return;
      // An agent line with a suggestion is the agent's turn: the run waits on it (the agent UI surfaces it after a beat).
      if (step.nba && isAgentTurn(step)) {
        g.turn = { stepId: step.id, suggestion: suggestion(step.nba), turn: true };
        sendNba(g);
      } else if (step.nba) enqueue(g, step.id, step.nba);
      if (step.focus) sendNba(g, { focus: { stepId: step.id, card: step.focus } });
      if (step.kind === "say" && step.speaker === "customer" && g.summary.revealed < g.summary.lines.length) {
        g.summary.revealed += 1;
        sendSummary(g);
      }
    },

    resolve(cardId, resolution) {
      const g = [...guides.values()].find((guide) => nbaCardId(guide.id) === cardId);
      const current = g?.current;
      if (!g || !current) throw providerError("not-found", `resolveCard: ${cardId} has nothing to answer`);
      const alternative = resolution.alternative !== undefined ? current.suggestion.alt[resolution.alternative] : undefined;
      if (resolution.alternative !== undefined && !alternative) {
        throw providerError("not-found", `resolveCard: ${cardId} has no alternative ${resolution.alternative}`);
      }
      const branch = resolution.outcome === "used" ? (alternative ? alternative.branch : current.suggestion.branch) : undefined;
      g.current = undefined;
      // The rule set: once the greeting is answered, asking the reason is next.
      if (!g.scripted && current.stepId === "rule-greeting") enqueue(g, "rule-reason", reasonNba(host.customerName(g.id)));
      sendNba(g);
      if (branch) host.startBranch(g.id, branch);
      // The agent's turn: the script goes on (its own line, unless the agent typed the turn), after any branch.
      if (current.turn) host.releaseTurn(g.id, !!resolution.agentTyped);
    },

    surface(id, reason, requestId) {
      const g = guideFor(id);
      // While a bot holds the contact (review), nothing surfaces; nor while one is already showing.
      if (host.get(id)?.review || g.current) return;
      // The agent's turn goes first; a "turn" trigger surfaces only it.
      const turn = g.over ? undefined : g.turn;
      g.turn = undefined;
      const next = turn ?? (g.over || reason === "turn" ? undefined : g.queue.shift());
      if (next) {
        g.current = next;
        sendNba(g, { requestId });
      } else if (reason === "request") {
        sendNba(g, { nothing: true, requestId });
      }
    },

    dispose() {
      guides.clear();
    },
  };
}
