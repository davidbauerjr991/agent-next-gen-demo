import type { ChannelKind, Interaction, InteractionId, Message, MessageId, Participant, Utterance, UtteranceId } from "../../domain";
import type { RequestResponse } from "../../providers";
import { noteAddressesCustomer } from "../../scenarios/note-rules";
import type { ScenarioScript, ScenarioSpeaker, ScenarioStep } from "../../scenarios/scenario-script";
import { stepsFor, toCustomerAction, validateScenario, type ScenarioCustomerAction } from "../../scenarios/validate";
import { providerError } from "../provider-error";
import { SIM_AGENT } from "./sim-fixtures";
import { simId } from "./sim-util";

/** How long the simulated AI agent takes to perform an instruction (the row's "AI agent is performing this
 *  now…" step): `annotation.performedAt` = sent + this. */
const SIM_INSTRUCTION_PERFORM_MS = 1800;

// The scenario player (P0.5c). It lives inside the sim engine and plays a
// P0.7 script against one contact: setup lines are written into the
// transcript before the contact is announced (backfill), live steps fire on
// their timers, and the agent's decisions (`respondToRequest`) and takeover
// start branches. Customer lines go through the engine's own customer path,
// so a scripted customer is indistinguishable from a typed one. A run pauses
// while its contact is held and stops for good when the contact leaves
// active/held (wrap-up, ended) or the engine is disposed.

/** What the player needs from the engine. */
export interface ScenarioHost {
  now(): number;
  get(id: InteractionId): Interaction | undefined;
  /** The display name the contact's customer authors lines under. */
  customerName(id: InteractionId): string;
  /** A customer-side action, through the engine's customer path. */
  customer(action: ScenarioCustomerAction): void;
  pushMessage(message: Message): void;
  pushUtterance(utterance: Utterance): void;
  /** Writes into the transcript without an event (backfill). */
  seedMessage(message: Message): void;
  seedUtterance(utterance: Utterance): void;
  messages(id: InteractionId): readonly Message[];
  emitTyping(id: InteractionId, role: Participant["role"], isTyping: boolean): void;
  update(interaction: Interaction, patch: Partial<Interaction>): Interaction;
  /** The bot ends the contact on the agent's behalf: wrap-up (the agent's
   *  outcome closes it), or straight to ended without wrap-up support. */
  end(interaction: Interaction): void;
  /** A step just played (not skipped). */
  onStep?(id: InteractionId, step: ScenarioStep, script: ScenarioScript): void;
}

export interface ScenarioPlayer {
  /** Validates a launch and returns the script and channel to route. */
  prepare(scenarioId: string, channel: ChannelKind | undefined): { script: ScenarioScript; channel: ChannelKind };
  /** Writes the setup lines of a just-routed (not yet announced) contact. */
  backfill(interaction: Interaction, script: ScenarioScript): void;
  /** Starts playing; call once the contact has been announced. */
  start(interaction: Interaction, script: ScenarioScript): void;
  /** Every interaction snapshot the engine stores. */
  onInteraction(interaction: Interaction): void;
  onTakeOver(id: InteractionId, handoff: boolean): void;
  respond(id: InteractionId, response: RequestResponse): void;
  /** Starts an action branch (`trigger: "action"`) a used Next Best Action names, with what the agent typed into
   *  its note and the option's fixed vars; a no-op for anything else. */
  startAction(id: InteractionId, branch: string, inputs?: { note?: string; vars?: Record<string, string> }): void;
  /** The agent answered the Next Best Action the run waits on: plays its agent line (unless the agent typed the
   *  turn themselves, `skipLine`) and goes on. A no-op when the run isn't waiting. */
  releaseTurn(id: InteractionId, options: { skipLine: boolean }): void;
  isScripted(id: InteractionId): boolean;
  dispose(): void;
}

interface Pending {
  dueAt: number;
  remainingMs: number;
  fire: () => void;
  timer?: ReturnType<typeof setTimeout>;
}

/** What a playing branch was started with. */
interface Inputs {
  note?: string;
  vars?: Record<string, string>;
  /** The branch playing, if any: an instruction row's `ref`. */
  branch?: string;
}

interface Run {
  script: ScenarioScript;
  interactionId: InteractionId;
  channel: ChannelKind;
  answered: boolean;
  takenOver: boolean;
  paused: boolean;
  stopped: boolean;
  pending: Set<Pending>;
  /** The agent line the run waits on (P-CANVAS): its Next Best Action is the agent's turn. */
  gate?: { step: ScenarioStep; inputs: Inputs };
}

/** An agent line with a Next Best Action, or a guide step with one: the agent's turn, which waits on the agent
 *  (P-CANVAS; guide steps P-SHRINK). A guide turn has no line of its own. */
export const isAgentTurn = (step: ScenarioStep) => !!step.nba && ((step.kind === "say" && step.speaker === "agent") || step.kind === "guide");

/** Presence codes routing offers contacts to (every inbound, `routeInbound`). */
export const LIVE_PRESENCE = ["available", "working"];

export function createScenarioPlayer(
  host: ScenarioHost,
  scripts: readonly ScenarioScript[],
  agentPresenceCode: () => string,
): ScenarioPlayer {
  const runs = new Map<InteractionId, Run>();

  // ── Timing ──────────────────────────────────────────────────────────────

  function arm(run: Run, item: Pending) {
    item.dueAt = host.now() + item.remainingMs;
    item.timer = setTimeout(() => {
      run.pending.delete(item);
      if (!run.stopped) item.fire();
    }, item.remainingMs);
  }

  function later(run: Run, ms: number, fire: () => void) {
    if (run.stopped) return;
    const item: Pending = { dueAt: 0, remainingMs: Math.max(0, ms), fire };
    run.pending.add(item);
    if (!run.paused) arm(run, item);
  }

  function pause(run: Run) {
    if (run.paused) return;
    run.paused = true;
    const now = host.now();
    for (const item of run.pending) {
      if (item.timer !== undefined) clearTimeout(item.timer);
      item.timer = undefined;
      item.remainingMs = Math.max(0, item.dueAt - now);
    }
  }

  function resume(run: Run) {
    // A run waiting on the agent's turn stays paused (a held call's resume included) until `releaseTurn`.
    if (!run.paused || run.gate) return;
    run.paused = false;
    for (const item of run.pending) arm(run, item);
  }

  function stop(run: Run) {
    run.stopped = true;
    for (const item of run.pending) if (item.timer !== undefined) clearTimeout(item.timer);
    run.pending.clear();
  }

  // ── Authoring ───────────────────────────────────────────────────────────

  function author(script: ScenarioScript, interaction: Interaction, speaker: ScenarioSpeaker): Participant {
    if (speaker === "customer") {
      return { role: "customer", ...(interaction.entityId ? { id: interaction.entityId } : {}), displayName: host.customerName(interaction.id) };
    }
    return speaker === "bot"
      ? { role: "bot", displayName: script.participants?.bot ?? "Virtual agent" }
      : { role: "agent", id: SIM_AGENT.id, displayName: script.participants?.agent ?? SIM_AGENT.displayName };
  }

  const SYSTEM: Participant = { role: "system", displayName: "System" };

  function line(interactionId: InteractionId, channel: ChannelKind, who: Participant, text: string, at: number): Message | Utterance {
    return channel === "voice"
      ? { id: simId("utt") as UtteranceId, interactionId, speaker: who, text, startedAt: at, endedAt: at, isFinal: true }
      : { id: simId("msg") as MessageId, interactionId, author: who, kind: "text", text, sentAt: at };
  }

  function eventMessage(interactionId: InteractionId, text: string, at: number, annotation?: Message["annotation"], by?: string): Message {
    const author = by ? { ...SYSTEM, displayName: by } : SYSTEM;
    return { id: simId("msg") as MessageId, interactionId, author, kind: "event", text, sentAt: at, ...(annotation ? { annotation } : {}) };
  }

  // ── Steps ───────────────────────────────────────────────────────────────

  function fill(text: string, inputs: Inputs): string {
    return text.replace(/\{(\w+)\}/g, (_, name: string) => (name === "note" ? (inputs.note ?? "").trim() : (inputs.vars?.[name] ?? "")));
  }

  /** Whether a step is skipped by its conditions at the moment it would play. */
  function skipped(run: Run, step: ScenarioStep, inputs: Inputs): boolean {
    if (step.onlyIf === "note-addresses-customer" && !noteAddressesCustomer(inputs.note ?? "")) return true;
    if (step.kind === "beat" && step.unlessTakenOver && run.takenOver) return true;
    return false;
  }

  function play(run: Run, step: ScenarioStep, inputs: Inputs) {
    const interaction = host.get(run.interactionId);
    if (!interaction || skipped(run, step, inputs)) return;
    const id = interaction.id;
    switch (step.kind) {
      case "say": {
        const text = fill(step.text, inputs);
        if (step.speaker === "customer") {
          const action = toCustomerAction(run.script, { ...step, text }, id, run.channel);
          if (action) host.customer(action);
          return;
        }
        const entry = line(id, run.channel, author(run.script, interaction, step.speaker), text, host.now());
        if ("sentAt" in entry) host.pushMessage(entry);
        else host.pushUtterance(entry);
        return;
      }
      case "typing": {
        if (step.speaker === "customer") {
          host.customer({ kind: "typing", interactionId: id, isTyping: true });
          later(run, step.durationMs, () => host.customer({ kind: "typing", interactionId: id, isTyping: false }));
        } else {
          const role = step.speaker === "bot" ? "bot" : "agent";
          host.emitTyping(id, role, true);
          later(run, step.durationMs, () => host.emitTyping(id, role, false));
        }
        return;
      }
      case "event": {
        const disposition = step.sets?.disposition;
        host.pushMessage({ ...eventMessage(id, fill(step.text, inputs), host.now(), undefined, step.by), ...(disposition ? { suggestedDisposition: disposition } : {}) });
        const caseStatus = step.sets?.caseStatus;
        const current = host.get(id);
        if (caseStatus && current && current.caseStatus !== caseStatus) host.update(current, { caseStatus });
        return;
      }
      case "hangUp":
        host.customer({ kind: "hangUp", interactionId: id });
        return;
      case "guide":
        return;
      case "beat":
        switch (step.beat) {
          case "instruction":
            host.pushMessage(
              eventMessage(id, fill(step.text ?? "", inputs), host.now(), {
                kind: "instruction",
                // The decision that started it (the agent UI's instruction
                // panel is keyed by it), else the step.
                ref: inputs.branch ?? step.id,
                ...(step.by ? { by: step.by } : {}),
                ...(step.link ? { link: step.link } : {}),
                // The simulated AI takes this long to perform it (independent of the latency preset).
                performedAt: (host.now() + SIM_INSTRUCTION_PERFORM_MS) as Message["sentAt"],
              }),
            );
            return;
          case "approval":
          case "wrap-up": {
            const ref = step.ref ?? "";
            const title = step.beat === "approval" ? run.script.content.approvals?.[ref]?.title : run.script.content.wrapUps?.[ref]?.title;
            host.pushMessage(eventMessage(id, title ?? "", host.now(), { kind: step.beat, ref }));
            return;
          }
          case "close":
            if (interaction.caseStatus !== "Closed") host.update(interaction, { caseStatus: "Closed" });
            return;
          case "dismiss":
            host.end(interaction);
            return;
        }
    }
  }

  function schedule(run: Run, steps: ScenarioStep[], inputs: Inputs = {}) {
    for (const step of steps) {
      later(run, step.at, () => {
        if (!host.get(run.interactionId) || skipped(run, step, inputs)) return;
        // An agent line with a Next Best Action is the agent's turn (P-CANVAS): the run waits (every later step
        // keeps its remaining delay) until the agent answers the suggestion; `releaseTurn` plays the line or not.
        if (isAgentTurn(step)) {
          run.gate = { step, inputs };
          pause(run);
          host.onStep?.(run.interactionId, step, run.script);
          return;
        }
        play(run, step, inputs);
        // Guidance (the nba card, the running summary) follows what played.
        host.onStep?.(run.interactionId, step, run.script);
      });
    }
  }

  function anchored(run: Run, anchor: "launch" | "answered" | "takeover"): ScenarioStep[] {
    return stepsFor(run.script, run.channel).filter((step) => (step.anchor ?? "launch") === anchor && step.at >= 0);
  }

  // ── API ─────────────────────────────────────────────────────────────────

  return {
    prepare(scenarioId, channelOverride) {
      const script = scripts.find((s) => s.id === scenarioId);
      if (!script) throw providerError("not-found", `playScenario: no scenario "${scenarioId}"`);
      if (!LIVE_PRESENCE.includes(agentPresenceCode())) {
        throw providerError("invalid-state", `playScenario: the agent is ${agentPresenceCode()}, not available or working`);
      }
      for (const run of runs.values()) {
        const contact = host.get(run.interactionId);
        if (run.script.id === scenarioId && contact && contact.state !== "ended") {
          throw providerError("invalid-state", `playScenario: "${scenarioId}" is already playing on ${run.interactionId}`);
        }
      }
      const channel = channelOverride ?? script.channel;
      const errors = validateScenario(script, { channel });
      if (errors.length > 0) throw providerError("invalid-state", `playScenario: ${errors.join("; ")}`);
      return { script, channel };
    },

    backfill(interaction, script) {
      const channel = interaction.channel;
      const launchedAt = host.now();
      for (const step of stepsFor(script, channel)) {
        if (step.at >= 0 || (step.anchor ?? "launch") !== "launch") continue;
        const at = launchedAt + step.at;
        if (step.kind === "say") {
          const entry = line(interaction.id, channel, author(script, interaction, step.speaker), step.text, at);
          if ("sentAt" in entry) host.seedMessage(entry);
          else host.seedUtterance(entry);
        } else if (step.kind === "event") {
          host.seedMessage(eventMessage(interaction.id, step.text, at, undefined, step.by));
        }
      }
    },

    start(interaction, script) {
      const run: Run = {
        script,
        interactionId: interaction.id,
        channel: interaction.channel,
        answered: false,
        takenOver: false,
        paused: false,
        stopped: false,
        pending: new Set(),
      };
      runs.set(interaction.id, run);
      schedule(run, anchored(run, "launch"));
      this.onInteraction(host.get(interaction.id) ?? interaction);
    },

    onInteraction(interaction) {
      const run = runs.get(interaction.id);
      if (!run || run.stopped) return;
      if (interaction.state === "wrap-up" || interaction.state === "ended") {
        stop(run);
        return;
      }
      if (interaction.state === "held") pause(run);
      else if (interaction.state === "active") {
        resume(run);
        if (!run.answered) {
          run.answered = true;
          schedule(run, anchored(run, "answered"));
        }
      }
    },

    onTakeOver(id, handoff) {
      const run = runs.get(id);
      if (!run || run.takenOver) return;
      run.takenOver = true;
      // An unanswered guide turn was the bot's request to the agent; taking over withdraws it (P-SHRINK).
      const withdrawn = run.gate?.step.kind === "guide";
      if (withdrawn) run.gate = undefined;
      if (handoff) schedule(run, anchored(run, "takeover"));
      if (withdrawn && host.get(id)?.state === "active") resume(run);
    },

    respond(id, response) {
      const run = runs.get(id);
      if (!run || run.stopped) throw providerError("not-found", `respondToRequest: interaction ${id} has no request to answer`);
      const branches = run.script.branches ?? {};
      let branchKey: string | undefined;
      if (response.requestId !== undefined) {
        const card = host.messages(id).find((m) => m.id === response.requestId);
        const annotation = card?.annotation;
        if (!card || !annotation || annotation.kind === "instruction") {
          throw providerError("not-found", `respondToRequest: no request ${response.requestId} on ${id}`);
        }
        if (annotation.kind === "approval") {
          const decision = run.script.content.approvals?.[annotation.ref]?.decisions?.find((d) => d.value === response.value);
          if (!decision) throw providerError("not-found", `respondToRequest: "${response.value}" isn't a decision on ${annotation.ref}`);
          if (annotation.response && !decision.repeatable) return;
          branchKey = decision.value;
        } else {
          const wrapUp = run.script.content.wrapUps?.[annotation.ref];
          if (response.value !== "complete" || !wrapUp) throw providerError("not-found", `respondToRequest: a wrap-up card is answered "complete"`);
          if (annotation.response || annotation.withdrawn) return;
          branchKey = wrapUp.completeBranch;
        }
        host.pushMessage({
          ...card,
          annotation: { ...annotation, response: { value: response.value, ...(response.note ? { note: response.note } : {}), at: host.now() } },
        });
      } else {
        if (branches[response.value]?.trigger !== "action") {
          throw providerError("not-found", `respondToRequest: "${response.value}" isn't an action on ${id}`);
        }
        branchKey = response.value;
      }
      const branch = branchKey !== undefined ? branches[branchKey] : undefined;
      if (branch) schedule(run, stepsFor(run.script, run.channel, branch.steps), { note: response.note, vars: response.vars, branch: branchKey });
    },

    startAction(id, branchKey, inputs = {}) {
      const run = runs.get(id);
      const branch = run && !run.stopped ? run.script.branches?.[branchKey] : undefined;
      if (!run || branch?.trigger !== "action") return;
      schedule(run, stepsFor(run.script, run.channel, branch.steps), { note: inputs.note, vars: inputs.vars, branch: branchKey });
    },

    releaseTurn(id, { skipLine }) {
      const run = runs.get(id);
      const gate = run?.gate;
      if (!run || !gate || run.stopped) return;
      run.gate = undefined;
      if (!skipLine) play(run, gate.step, gate.inputs);
      if (host.get(id)?.state === "active") resume(run);
    },

    isScripted: (id) => runs.has(id),

    dispose() {
      for (const run of runs.values()) stop(run);
      runs.clear();
    },
  };
}
