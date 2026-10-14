import type {
  AgentState,
  Interaction,
  InteractionId,
  InteractionState,
  JourneyId,
  Message,
  MessageId,
  Participant,
  Utterance,
} from "../../domain";
import type { EndReason, InteractionCapabilities, ProviderError } from "../../providers";
import { isProviderError, providerError } from "../provider-error";
import { SIM_AGENT, SIM_OUTBOUND_SKILLS, SIM_PRESENCE_OPTIONS, type SimSeedContact, type SimTimings } from "./sim-fixtures";
import {
  SIM_PROTOCOL_VERSION,
  type SimCommand,
  type SimCommandResults,
  type SimCustomerAction,
  type SimEnvelope,
  type SimMessage,
  type SimEvent,
} from "./sim-protocol";
import type { SimTransport } from "./sim-transport";
import { caseNumber, contactNumber, journeyNumber, sampleMs, simId, unsupportedReason } from "./sim-util";

// The simulated contact-center "switch" (P0.4). It owns all interaction and
// agent state, answers commands from its session's provider over the bus,
// takes customer actions from the console side, and runs the scripted
// delays (ringing, leg connect, delivery). The provider is a pure client of
// it, the same shape a WebSocket adapter talking to a server will have.

export interface SimEngineOptions {
  transport: SimTransport;
  sessionId: string;
  capabilities: InteractionCapabilities;
  timings: SimTimings;
  /** Contacts present from the start (offered, routed). Loaded once, when
   *  the engine is created. */
  seed?: readonly SimSeedContact[];
  now?: () => number;
}

export interface SimEngine {
  /** Clears timers and closes the transport. Safe to call twice. */
  dispose(): void;
}

const DIGITAL_CHANNELS = new Set(["chat", "sms", "whatsapp", "email"]);
const LIVE: InteractionState[] = ["active", "held"];

type Transcript = { messages: Message[]; utterances: Utterance[] };

export function createSimEngine(options: SimEngineOptions): SimEngine {
  const { transport, sessionId, capabilities, timings } = options;
  const now = options.now ?? Date.now;

  const firstPresence = SIM_PRESENCE_OPTIONS[0];
  let agent: AgentState = {
    agentId: SIM_AGENT.id,
    presence: { ...firstPresence, since: now() },
    leg: "connected",
    legChangedAt: now(),
  };
  const interactions = new Map<InteractionId, Interaction>();
  const transcripts = new Map<InteractionId, Transcript>();
  /** Who ended a contact that's still in wrap-up; `ended` reports it later. */
  const endReasons = new Map<InteractionId, EndReason>();
  /** Customer display names, for authoring their messages. */
  const customerNames = new Map<InteractionId, string>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let disposed = false;

  // ── Output ──────────────────────────────────────────────────────────────

  function send(message: SimMessage) {
    if (!disposed) transport.send({ v: SIM_PROTOCOL_VERSION, sessionId, ...message } as SimEnvelope);
  }

  /** Events raised while a command runs wait until its reply has gone out,
   *  so the ack always precedes the state it caused. */
  let deferred: SimEvent[] | null = null;
  function emit(event: SimEvent) {
    if (deferred) deferred.push(event);
    else send({ type: "event", event });
  }

  function schedule(range: { minMs: number; maxMs: number }, run: () => void) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!disposed) run();
    }, sampleMs(range));
    timers.add(timer);
  }

  // ── State helpers ───────────────────────────────────────────────────────

  function get(id: InteractionId): Interaction {
    const interaction = interactions.get(id);
    if (!interaction) throw providerError("not-found", `no interaction ${id}`);
    return interaction;
  }

  function requireState(interaction: Interaction, allowed: InteractionState[], action: string) {
    if (!allowed.includes(interaction.state)) {
      throw providerError("invalid-state", `${action}: interaction ${interaction.id} is ${interaction.state}`);
    }
  }

  function requireVoice(interaction: Interaction, action: string) {
    if (interaction.channel !== "voice") {
      throw providerError("invalid-state", `${action}: voice only, interaction ${interaction.id} is ${interaction.channel}`);
    }
  }

  function requireDigital(interaction: Interaction, action: string) {
    if (!DIGITAL_CHANNELS.has(interaction.channel)) {
      throw providerError("invalid-state", `${action}: digital channels only, interaction ${interaction.id} is ${interaction.channel}`);
    }
  }

  /** Stores a new snapshot (keys set to `undefined` are removed) and emits it. */
  function update(interaction: Interaction, patch: Partial<Interaction>): Interaction {
    const next = { ...interaction, ...patch } as Interaction;
    for (const key of Object.keys(next) as (keyof Interaction)[]) {
      if (next[key] === undefined) delete next[key];
    }
    interactions.set(next.id, next);
    emit({ name: "stateChanged", payload: { kind: "interaction", interaction: next } });
    return next;
  }

  function setAgent(patch: Partial<AgentState>) {
    agent = { ...agent, ...patch };
    emit({ name: "stateChanged", payload: { kind: "agent", agent } });
  }

  function add(interaction: Interaction) {
    interactions.set(interaction.id, interaction);
    transcripts.set(interaction.id, { messages: [], utterances: [] });
  }

  function newJourney(): JourneyId {
    return journeyNumber() as JourneyId;
  }

  /** The case number of a journey's existing contacts, if any. */
  function journeyCase(journeyId: JourneyId): string | undefined {
    for (const i of interactions.values()) if (i.journeyId === journeyId && i.caseId) return i.caseId;
    return undefined;
  }

  function externalRef(atMs: number) {
    return { system: "sim", id: contactNumber(atMs) };
  }

  // ── One active call ─────────────────────────────────────────────────────
  // With hold support, whichever voice contact becomes active holds the
  // others. Without it, a second live voice contact is refused up front.

  function otherLiveVoice(exceptId: InteractionId | undefined, states: InteractionState[]): Interaction[] {
    return [...interactions.values()].filter((i) => i.channel === "voice" && i.id !== exceptId && states.includes(i.state));
  }

  /** Throws when a new live voice contact isn't allowed (no hold support and
   *  another call is live). `exceptIds` are contacts about to go away. */
  function requireVoiceSlot(action: string, exceptIds: InteractionId[] = []) {
    if (capabilities.hold) return;
    const live = otherLiveVoice(undefined, ["connecting", ...LIVE]).filter((i) => !exceptIds.includes(i.id));
    if (live.length > 0) {
      throw providerError("invalid-state", `${action}: voice contact ${live[0].id} is still live and hold isn't supported`);
    }
  }

  /** Holds every other active voice contact before `id` becomes active. */
  function holdOtherCalls(id: InteractionId) {
    if (!capabilities.hold) return;
    for (const other of otherLiveVoice(id, ["active"])) update(other, { state: "held", heldSince: now() });
  }

  /** Ends the connection now. With wrap-up support the contact stays open in
   *  "wrap-up" and `ended` fires from `completeWrapUp`; otherwise it closes. */
  function disconnect(interaction: Interaction, reason: EndReason) {
    const endedAt = now();
    if (capabilities.wrapUp) {
      endReasons.set(interaction.id, reason);
      update(interaction, { state: "wrap-up", endedAt, heldSince: undefined });
    } else {
      close(interaction, reason, { endedAt });
    }
  }

  /** Closes the contact for good: the final `stateChanged`, then `ended`. */
  function close(interaction: Interaction, reason: EndReason, patch: Partial<Interaction> = {}) {
    endReasons.delete(interaction.id);
    update(interaction, { endedAt: interaction.endedAt ?? now(), ...patch, state: "ended", heldSince: undefined });
    emit({ name: "ended", payload: { interactionId: interaction.id, reason } });
  }

  function pushMessage(message: Message) {
    const transcript = transcripts.get(message.interactionId);
    if (!transcript) return;
    const index = transcript.messages.findIndex((m) => m.id === message.id);
    if (index === -1) transcript.messages.push(message);
    else transcript.messages[index] = message;
    emit({ name: "message", payload: { message } });
  }

  // ── Commands ────────────────────────────────────────────────────────────

  function run(command: SimCommand): unknown {
    const unsupported = unsupportedReason(command, capabilities);
    if (unsupported) throw providerError("not-supported", `${command.name}: ${unsupported}`);

    switch (command.name) {
      case "getSnapshot":
        return {
          agent,
          interactions: [...interactions.values()].filter((i) => i.state !== "ended"),
        } satisfies SimCommandResults["getSnapshot"];

      case "getTranscript": {
        get(command.interactionId);
        const transcript = transcripts.get(command.interactionId) ?? { messages: [], utterances: [] };
        return { messages: [...transcript.messages], utterances: [...transcript.utterances] } satisfies SimCommandResults["getTranscript"];
      }

      case "listPresenceOptions":
        return SIM_PRESENCE_OPTIONS.map((p) => ({ ...p, since: now() })) satisfies SimCommandResults["listPresenceOptions"];

      case "listOutboundSkills":
        return (capabilities.channels.outbound.includes(command.channel) ? SIM_OUTBOUND_SKILLS : []) satisfies SimCommandResults["listOutboundSkills"];

      case "setAgentState": {
        const option = SIM_PRESENCE_OPTIONS.find((p) => p.code === command.code);
        if (!option) throw providerError("not-found", `setAgentState: no presence code "${command.code}"`);
        if (agent.presence.code === command.code && agent.presence.reasonCode === command.reasonCode) return undefined;
        const presence = { ...option, since: now(), ...(command.reasonCode ? { reasonCode: command.reasonCode } : {}) };
        setAgent({ presence });
        return undefined;
      }

      case "connectAgentLeg": {
        if (agent.leg !== "disconnected") return undefined;
        setAgent({ leg: "connecting", legChangedAt: now() });
        schedule(timings.legConnect, () => {
          if (agent.leg === "connecting") setAgent({ leg: "connected", legChangedAt: now() });
        });
        return undefined;
      }

      case "disconnectAgentLeg":
        if (agent.leg !== "disconnected") setAgent({ leg: "disconnected", legChangedAt: now() });
        return undefined;

      case "accept": {
        const interaction = get(command.interactionId);
        requireState(interaction, ["offered"], "accept");
        if (interaction.channel === "voice") {
          requireVoiceSlot("accept");
          holdOtherCalls(interaction.id);
        }
        update(interaction, { state: "active", acceptedAt: now() });
        return undefined;
      }

      case "decline": {
        const interaction = get(command.interactionId);
        requireState(interaction, ["offered"], "decline");
        close(interaction, "declined");
        return undefined;
      }

      case "dial": {
        const { request } = command;
        const skill = SIM_OUTBOUND_SKILLS.find((s) => s.id === request.skillId);
        if (!skill) throw providerError("not-found", `dial: no outbound skill "${request.skillId}"`);
        if (!request.address.trim()) throw providerError("invalid-state", "dial: address is empty");
        const isVoice = request.channel === "voice";
        // The agent leg bridges the outbound call (P0.5a decision).
        if (isVoice && capabilities.agentLeg && agent.leg !== "connected") {
          throw providerError("invalid-state", `dial: agent leg is ${agent.leg}`);
        }
        if (isVoice) requireVoiceSlot("dial");
        const id = simId("int") as InteractionId;
        const journeyId = request.journeyId ?? newJourney();
        const startedAt = now();
        const interaction: Interaction = {
          id,
          externalId: externalRef(startedAt),
          journeyId,
          caseId: journeyCase(journeyId) ?? caseNumber(),
          ...(request.entityId ? { entityId: request.entityId } : {}),
          ...(request.contactName ? { contactName: request.contactName } : {}),
          channel: request.channel,
          direction: "outbound",
          state: isVoice ? "connecting" : "active",
          origin: "agent-initiated",
          address: request.addressLabel !== undefined ? { value: request.address, label: request.addressLabel } : { value: request.address },
          skill: { id: skill.id, name: skill.name },
          startedAt,
        };
        add(interaction);
        emit({ name: "stateChanged", payload: { kind: "interaction", interaction } });
        if (isVoice) {
          schedule(timings.ring, () => {
            const current = interactions.get(id);
            if (current?.state !== "connecting") return;
            holdOtherCalls(id);
            update(current, { state: "active" });
          });
        }
        return id satisfies SimCommandResults["dial"];
      }

      case "reopen": {
        const { request } = command;
        const skill = request.skillId === undefined ? undefined : SIM_OUTBOUND_SKILLS.find((s) => s.id === request.skillId);
        if (request.skillId !== undefined && !skill) throw providerError("not-found", `reopen: no skill "${request.skillId}"`);
        const open = [...interactions.values()].filter((i) => i.state !== "ended");
        const journeyId =
          request.journeyId ??
          (request.caseId !== undefined ? open.find((i) => i.caseId === request.caseId)?.journeyId : undefined) ??
          newJourney();
        const addressValue = request.address ?? "";
        // One live contact per thread: the same channel and address in this journey.
        const superseded = open.filter(
          (i) => i.journeyId === journeyId && i.channel === request.channel && (i.address?.value ?? "") === addressValue,
        );
        const isVoice = request.channel === "voice";
        if (isVoice) requireVoiceSlot("reopen", superseded.map((i) => i.id));
        for (const old of superseded) close(old, "agent");
        const id = simId("int") as InteractionId;
        const startedAt = now();
        if (isVoice) holdOtherCalls(id);
        const interaction: Interaction = {
          id,
          externalId: externalRef(startedAt),
          journeyId,
          caseId: request.caseId ?? journeyCase(journeyId) ?? caseNumber(),
          ...(request.entityId ? { entityId: request.entityId } : {}),
          ...(request.contactName ? { contactName: request.contactName } : {}),
          channel: request.channel,
          direction: request.direction,
          state: "active",
          origin: "reopened",
          ...(request.address !== undefined
            ? { address: request.addressLabel !== undefined ? { value: request.address, label: request.addressLabel } : { value: request.address } }
            : {}),
          ...(skill ? { skill: { id: skill.id, name: skill.name } } : {}),
          ...(request.caseStatus !== undefined ? { caseStatus: request.caseStatus } : {}),
          startedAt,
        };
        add(interaction);
        emit({ name: "stateChanged", payload: { kind: "interaction", interaction } });
        return id satisfies SimCommandResults["reopen"];
      }

      case "end": {
        const interaction = get(command.interactionId);
        if (interaction.state === "wrap-up") return undefined;
        requireState(interaction, ["connecting", ...LIVE], "end");
        disconnect(interaction, "agent");
        return undefined;
      }

      case "completeWrapUp": {
        const interaction = get(command.interactionId);
        if (interaction.state === "wrap-up") {
          close(interaction, endReasons.get(interaction.id) ?? "agent", { outcome: command.outcome });
          return undefined;
        }
        if (interaction.state === "ended" && !capabilities.wrapUp) {
          // Records the outcome only; `ended` already fired once.
          update(interaction, { outcome: command.outcome });
          return undefined;
        }
        throw providerError("invalid-state", `completeWrapUp: interaction ${interaction.id} is ${interaction.state}`);
      }

      case "hold": {
        const interaction = get(command.interactionId);
        requireState(interaction, LIVE, "hold");
        if ((interaction.state === "held") === command.onHold) return undefined;
        if (!command.onHold && interaction.channel === "voice") holdOtherCalls(interaction.id);
        update(interaction, command.onHold ? { state: "held", heldSince: now() } : { state: "active", heldSince: undefined });
        return undefined;
      }

      case "mute":
      case "setRecording":
      case "setMasked": {
        const interaction = get(command.interactionId);
        requireVoice(interaction, command.name);
        requireState(interaction, LIVE, command.name);
        const [field, value] =
          command.name === "mute"
            ? (["muted", command.muted] as const)
            : command.name === "setRecording"
              ? (["recording", command.recording] as const)
              : (["masked", command.masked] as const);
        if ((interaction[field] ?? false) === value) return undefined;
        update(interaction, { [field]: value });
        return undefined;
      }

      case "sendDtmf": {
        const interaction = get(command.interactionId);
        requireVoice(interaction, "sendDtmf");
        requireState(interaction, ["active"], "sendDtmf");
        if (!/^[0-9*#]+$/.test(command.digits)) throw providerError("invalid-state", `sendDtmf: invalid digits "${command.digits}"`);
        return undefined;
      }

      case "transfer": {
        const interaction = get(command.interactionId);
        requireState(interaction, LIVE, "transfer");
        // The agent still handled the contact, so it gets wrap-up like `end`.
        disconnect(interaction, "transfer");
        return undefined;
      }

      case "sendMessage": {
        const interaction = get(command.interactionId);
        requireDigital(interaction, "sendMessage");
        requireState(interaction, LIVE, "sendMessage");
        const author: Participant = { role: "agent", id: SIM_AGENT.id, displayName: SIM_AGENT.displayName };
        const message: Message = {
          id: simId("msg") as MessageId,
          interactionId: interaction.id,
          author,
          kind: "text",
          text: command.text,
          sentAt: now(),
          ...(capabilities.deliveryReceipts ? { delivery: "sent" as const } : {}),
        };
        pushMessage(message);
        if (interaction.awaitingAgentSince !== undefined) update(interaction, { awaitingAgentSince: undefined });
        if (capabilities.deliveryReceipts) {
          schedule(timings.delivery, () => pushMessage({ ...message, delivery: "delivered" }));
        }
        return message.id satisfies SimCommandResults["sendMessage"];
      }

      case "setTyping": {
        const interaction = get(command.interactionId);
        requireDigital(interaction, "setTyping");
        requireState(interaction, ["offered", "connecting", ...LIVE], "setTyping");
        emit({ name: "typing", payload: { interactionId: interaction.id, role: "agent", isTyping: command.isTyping } });
        return undefined;
      }

      case "setCaseStatus": {
        const interaction = get(command.interactionId);
        if (interaction.state === "ended") throw providerError("invalid-state", `setCaseStatus: interaction ${interaction.id} is ended`);
        if (interaction.caseStatus !== command.status) update(interaction, { caseStatus: command.status });
        return undefined;
      }

      case "associateEntity": {
        const interaction = get(command.interactionId);
        if (interaction.entityId !== command.entityId) update(interaction, { entityId: command.entityId });
        return undefined;
      }
    }
  }

  function handleCommand(requestId: string, command: SimCommand) {
    deferred = [];
    try {
      const result = run(command);
      send({ type: "reply", requestId, ok: true, result });
      for (const event of deferred) send({ type: "event", event });
    } catch (err) {
      const error: ProviderError = isProviderError(err)
        ? err
        : providerError("invalid-state", `${command.name}: ${err instanceof Error ? err.message : String(err)}`);
      send({ type: "reply", requestId, ok: false, error });
    } finally {
      deferred = null;
    }
  }

  // ── Customer side ───────────────────────────────────────────────────────
  // Customer actions are fire-and-forget (no reply), so a bad one is only
  // logged in dev.

  function customerAction(action: SimCustomerAction) {
    switch (action.kind) {
      case "startInbound": {
        if (!capabilities.channels.inbound.includes(action.channel)) throw new Error(`inbound ${action.channel} is not supported`);
        if (interactions.has(action.interactionId)) return;
        const startedAt = now();
        const interaction: Interaction = {
          id: action.interactionId,
          externalId: externalRef(startedAt),
          journeyId: newJourney(),
          caseId: caseNumber(),
          ...(action.entityId ? { entityId: action.entityId } : {}),
          contactName: action.displayName,
          channel: action.channel,
          direction: "inbound",
          state: "offered",
          origin: "routed",
          address: { value: action.address },
          startedAt,
        };
        add(interaction);
        customerNames.set(interaction.id, action.displayName);
        emit({ name: "incoming", payload: { interaction } });
        return;
      }
      case "message": {
        const interaction = get(action.interactionId);
        requireDigital(interaction, "customer message");
        requireState(interaction, ["offered", "connecting", ...LIVE], "customer message");
        const author: Participant = {
          role: "customer",
          ...(interaction.entityId ? { id: interaction.entityId } : {}),
          displayName: customerNames.get(interaction.id) ?? interaction.address?.value ?? "Customer",
        };
        const sentAt = now();
        pushMessage({ id: simId("msg") as MessageId, interactionId: interaction.id, author, kind: "text", text: action.text, sentAt });
        if (interaction.awaitingAgentSince === undefined) update(interaction, { awaitingAgentSince: sentAt });
        return;
      }
      case "typing": {
        const interaction = get(action.interactionId);
        requireDigital(interaction, "customer typing");
        if (!capabilities.typing) return;
        emit({ name: "typing", payload: { interactionId: interaction.id, role: "customer", isTyping: action.isTyping } });
        return;
      }
      case "hangUp": {
        const interaction = get(action.interactionId);
        if (interaction.state === "offered") close(interaction, "customer");
        else if (interaction.state === "connecting" || LIVE.includes(interaction.state)) disconnect(interaction, "customer");
        return;
      }
    }
  }

  function handleCustomer(action: SimCustomerAction) {
    try {
      customerAction(action);
    } catch (err) {
      if (import.meta.env.DEV) console.warn(`[sim] customer ${action.kind} ignored:`, isProviderError(err) ? err.message : err);
    }
  }

  // ── Seed ────────────────────────────────────────────────────────────────
  // Loaded once per engine, which lives once per provider-cache key (one per
  // tab), so remounts and tier switches never duplicate it. No events: the
  // agent side picks seeds up through `getSnapshot`. Seeds for one entity
  // share a journey and case.

  const seedJourneys = new Map<string, { journeyId: JourneyId; caseId: string }>();
  for (const seed of options.seed ?? []) {
    if (interactions.has(seed.id)) continue;
    const journeyKey = seed.entityId ?? seed.id;
    let journey = seedJourneys.get(journeyKey);
    if (!journey) {
      journey = { journeyId: newJourney(), caseId: caseNumber() };
      seedJourneys.set(journeyKey, journey);
    }
    const startedAt = now() - seed.ageMinutes * 60_000;
    add({
      id: seed.id,
      externalId: externalRef(startedAt),
      journeyId: journey.journeyId,
      caseId: journey.caseId,
      ...(seed.entityId ? { entityId: seed.entityId } : {}),
      contactName: seed.contactName,
      channel: seed.channel,
      direction: "inbound",
      state: "offered",
      origin: "routed",
      ...(seed.address !== undefined ? { address: { value: seed.address } } : {}),
      startedAt,
    });
    customerNames.set(seed.id, seed.contactName);
  }

  // ── Wiring ──────────────────────────────────────────────────────────────

  const unsubscribe = transport.onMessage((envelope) => {
    if (disposed || envelope.sessionId !== sessionId) return;
    if (envelope.type === "command") handleCommand(envelope.requestId, envelope.command);
    else if (envelope.type === "customer") handleCustomer(envelope.action);
  });

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      unsubscribe();
      transport.close();
    },
  };
}
