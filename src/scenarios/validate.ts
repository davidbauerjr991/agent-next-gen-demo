import type { ChannelKind, EntityId, InteractionId } from "../domain";
import type { SimCustomerAction } from "../adapters/sim/sim-protocol";
import type { ScenarioScript, ScenarioStep } from "./scenario-script";

// Validation and the helpers that turn a script into engine inputs (P0.7).
// Pure: no React, no providers.

const CHANNELS: readonly ChannelKind[] = ["voice", "chat", "sms", "whatsapp", "email"];
const SPEAKERS = ["customer", "bot", "agent"];
const ANCHORS = ["launch", "answered", "takeover"];
const BEATS = ["instruction", "approval", "wrap-up", "close", "dismiss"];
const NBA_TYPES = ["say", "ask", "do"];
const ANSWERS = ["agent", "auto", "delivered"];
const CONDITIONS = ["note-addresses-customer"];

/** The customer-side actions a step can be (a subset of `SimCustomerAction`). */
export type ScenarioCustomerAction = Extract<SimCustomerAction, { kind: "message" | "speak" | "typing" | "hangUp" }>;

type StartInbound = Extract<SimCustomerAction, { kind: "startInbound" }>;
export type ScenarioStartRequest = Omit<StartInbound, "kind" | "interactionId">;

/** The address the customer arrives from on `channel`: the script's override,
 *  else the entity's phone (voice, SMS, WhatsApp), email, or its key as a chat
 *  handle. Throws when the entity has none. */
export function addressFor(script: ScenarioScript, channel: ChannelKind = script.channel): string {
  const override = script.start.addresses?.[channel];
  if (override) return override;
  const { phone, email, key } = script.entity;
  if (channel === "chat") return key;
  if (channel === "email" && email) return email;
  if ((channel === "voice" || channel === "sms" || channel === "whatsapp") && phone) return phone;
  throw new Error(`${script.id}: no ${channel} address (the entity has none and the script gives none)`);
}

/** The `startInbound` for a launch, as `channel` (default: the script's). */
export function startRequest(script: ScenarioScript, channel: ChannelKind = script.channel): ScenarioStartRequest {
  return {
    channel,
    address: addressFor(script, channel),
    displayName: script.entity.name,
    caseId: script.entity.caseId,
    ...(script.entity.directoryId ? { entityId: script.entity.directoryId as EntityId } : {}),
    ...(script.skill.id ? { skillId: script.skill.id } : {}),
    ...(script.start.summary ? { summary: script.start.summary } : {}),
    ...(script.start.caseStatus ? { caseStatus: script.start.caseStatus } : {}),
  };
}

/** The steps that play on `channel`: typing indicators are dropped on voice,
 *  and a step with `onlyOn` plays only there. */
export function stepsFor(script: ScenarioScript, channel: ChannelKind = script.channel, steps: ScenarioStep[] = script.steps): ScenarioStep[] {
  return steps.filter((step) => {
    if (step.onlyOn && !step.onlyOn.includes(channel)) return false;
    if (step.kind === "typing" && channel === "voice") return false;
    return true;
  });
}

/** The customer-side action a step is, if it is one: a customer `say` is a
 *  `message` (digital) or `speak` (voice); a customer `typing` starts the
 *  indicator (the player ends it after `durationMs`); `hangUp` is the
 *  customer hanging up. Bot and agent lines, events and beats are the
 *  player's to emit, not customer actions. */
export function toCustomerAction(
  script: ScenarioScript,
  step: ScenarioStep,
  interactionId: InteractionId,
  channel: ChannelKind = script.channel,
): ScenarioCustomerAction | undefined {
  if (step.kind === "say" && step.speaker === "customer") {
    return channel === "voice"
      ? { kind: "speak", interactionId, text: step.text }
      : { kind: "message", interactionId, text: step.text };
  }
  if (step.kind === "typing" && step.speaker === "customer" && channel !== "voice") {
    return { kind: "typing", interactionId, isTyping: true };
  }
  if (step.kind === "hangUp") return { kind: "hangUp", interactionId };
  return undefined;
}

export interface CannedLine {
  scenarioId: string;
  label?: string;
  text: string;
}

/** The console's canned lines for an entity: each script's customer lines
 *  (main steps and branches, minus `canned: false` and templated ones) plus
 *  its extra `canned`. A script runs on any channel, so `channel` only drops
 *  lines that don't play there. */
export function cannedLines(
  scripts: readonly ScenarioScript[],
  filter: { entityKey?: string; channel?: ChannelKind } = {},
): CannedLine[] {
  const lines: CannedLine[] = [];
  for (const script of scripts) {
    if (filter.entityKey && script.entity.key !== filter.entityKey) continue;
    const seen = new Set<string>();
    const add = (text: string, label?: string) => {
      if (seen.has(text)) return;
      seen.add(text);
      lines.push({ scenarioId: script.id, ...(label ? { label } : {}), text });
    };
    const allSteps = [script.steps, ...Object.values(script.branches ?? {}).map((b) => b.steps)].flat();
    for (const step of allSteps) {
      if (step.kind !== "say" || step.speaker !== "customer" || step.canned === false) continue;
      if (filter.channel && step.onlyOn && !step.onlyOn.includes(filter.channel)) continue;
      if (/\{\w+\}/.test(step.text)) continue;
      add(step.text);
    }
    for (const extra of script.canned ?? []) add(extra.text, extra.label);
  }
  return lines;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** Checks a script (a TypeScript literal or parsed JSON) and returns every
 *  problem found; an empty list means it's valid. Structure first (so JSON
 *  input is safe to read), then references: unique step ids, timing, `{note}`
 *  placeholders, panel keys, approval cards, and that every decision has its
 *  branch and every branch a way to start. With `channel`, also that the
 *  script can launch as that channel (it has an address for it). The deep
 *  shape of approval cards is TypeScript's to check. */
export function validateScenario(input: unknown, options: { channel?: ChannelKind } = {}): string[] {
  if (!isObj(input)) return ["script is not an object"];
  const errors: string[] = [];
  const id = isStr(input.id) ? input.id : "?";
  const err = (message: string) => errors.push(`${id}: ${message}`);

  if (input.version !== 1) err("version must be 1");
  if (!isStr(input.id)) err("id is required");
  for (const field of ["title", "summary"] as const) if (!isStr(input[field])) err(`${field} is required`);
  const entity = input.entity;
  if (!isObj(entity) || !isStr(entity.key) || !isStr(entity.name) || !isStr(entity.caseId)) err("entity needs key, name and caseId");
  if (!CHANNELS.includes(input.channel as ChannelKind)) err("channel is not a channel");
  if (!isObj(input.skill) || !isStr(input.skill.name)) err("skill.name is required");
  if (!isObj(input.start) || !ANSWERS.includes(input.start.answer as string)) err(`start.answer must be one of ${ANSWERS.join(", ")}`);
  if (!Array.isArray(input.steps) || input.steps.length === 0) err("steps must be a non-empty array");
  const content = input.content;
  if (!isObj(content) || !Array.isArray(content.panelKeys)) err("content.panelKeys is required");
  if (input.branches !== undefined && !isObj(input.branches)) err("branches must be an object");
  if (errors.length > 0) return errors;

  const script = input as unknown as ScenarioScript;
  const panelKeys = new Set(script.content.panelKeys);
  const approvals = script.content.approvals ?? {};
  const wrapUps = script.content.wrapUps ?? {};
  const branches = script.branches ?? {};
  const ids = new Set<string>();

  const checkLink = (link: string | undefined, where: string) => {
    if (link !== undefined && !panelKeys.has(link)) err(`${where}: unknown panel key "${link}"`);
  };

  const checkSteps = (steps: unknown, where: string, branchInputs?: readonly string[]) => {
    if (!Array.isArray(steps)) return err(`${where}: steps must be an array`);
    for (const raw of steps as unknown[]) {
      if (!isObj(raw) || !isStr(raw.id)) {
        err(`${where}: a step has no id`);
        continue;
      }
      const at = `${where} step "${raw.id}"`;
      if (ids.has(raw.id)) err(`${at}: duplicate step id`);
      ids.add(raw.id);
      if (typeof raw.at !== "number" || !Number.isFinite(raw.at)) err(`${at}: at must be a number`);
      if (raw.anchor !== undefined && !ANCHORS.includes(raw.anchor as string)) err(`${at}: unknown anchor`);
      if (raw.anchor !== undefined && branchInputs) err(`${at}: a branch step takes no anchor`);
      if (raw.onlyOn !== undefined && (!Array.isArray(raw.onlyOn) || raw.onlyOn.some((c) => !CHANNELS.includes(c as ChannelKind)))) {
        err(`${at}: onlyOn must list channels`);
      }
      if (raw.onlyIf !== undefined) {
        if (!CONDITIONS.includes(raw.onlyIf as string)) err(`${at}: unknown onlyIf condition`);
        else if (!branchInputs?.includes("note")) err(`${at}: onlyIf "${String(raw.onlyIf)}" needs a branch with a note input`);
      }
      if (raw.unlessTakenOver !== undefined && !(raw.kind === "beat" && (raw.beat === "wrap-up" || raw.beat === "dismiss"))) {
        err(`${at}: unlessTakenOver applies to wrap-up and dismiss beats only`);
      }
      const step = raw as unknown as ScenarioStep;
      if (step.at < 0) {
        if (branchInputs) err(`${at}: a branch step can't be in the past`);
        if (step.anchor && step.anchor !== "launch") err(`${at}: only the launch anchor can be in the past`);
        if (step.kind !== "say" && step.kind !== "event") err(`${at}: only say and event steps can be in the past`);
      }
      switch (step.kind) {
        case "say":
          if (!SPEAKERS.includes(step.speaker)) err(`${at}: unknown speaker`);
          if (!isStr(step.text)) err(`${at}: say needs text`);
          break;
        case "typing":
          if (!SPEAKERS.includes(step.speaker)) err(`${at}: unknown speaker`);
          if (typeof step.durationMs !== "number" || !(step.durationMs > 0)) err(`${at}: typing needs a positive durationMs`);
          break;
        case "event":
          if (!isStr(step.text)) err(`${at}: event needs text`);
          break;
        case "hangUp":
          break;
        case "guide":
          if (!step.nba) err(`${at}: guide needs an nba`);
          break;
        case "beat":
          if (!BEATS.includes(step.beat)) err(`${at}: unknown beat`);
          if (step.beat === "instruction" && !isStr(step.text)) err(`${at}: instruction needs text`);
          if (step.beat === "approval" && !(step.ref && step.ref in approvals)) err(`${at}: approval needs a ref to content.approvals`);
          if (step.beat === "wrap-up" && !(step.ref && step.ref in wrapUps)) err(`${at}: wrap-up needs a ref to content.wrapUps`);
          checkLink(step.link, at);
          break;
        default:
          err(`${at}: unknown kind`);
      }
      if (step.nba) {
        const nba = step.nba;
        if (!NBA_TYPES.includes(nba.type) || !isStr(nba.title) || !isStr(nba.why)) err(`${at}: nba needs a type, title and why`);
        else if (nba.type === "do" ? !isStr(nba.action) : !isStr(nba.text)) err(`${at}: a ${nba.type} nba needs ${nba.type === "do" ? "an action" : "text"}`);
        checkLink(nba.link, `${at} nba`);
        for (const branch of [nba.branch, ...(nba.alt ?? []).map((a) => a.branch)]) {
          if (branch !== undefined && branches[branch]?.trigger !== "action") err(`${at}: nba branch "${branch}" isn't an action branch`);
        }
      }
      const text = "text" in step && typeof step.text === "string" ? step.text : "";
      for (const [, name] of text.matchAll(/\{(\w+)\}/g)) {
        if (!branchInputs?.includes(name)) err(`${at}: placeholder {${name}} isn't an input of this branch`);
      }
    }
  };

  checkSteps(script.steps, "steps");
  for (const [key, branch] of Object.entries(branches)) {
    if (!isStr(branch?.label) || (branch.inputs !== undefined && (!Array.isArray(branch.inputs) || branch.inputs.some((i) => !/^\w+$/.test(String(i)))))) {
      err(`branch "${key}": needs a label, and inputs must be plain names`);
    }
    if (branch?.trigger !== undefined && branch.trigger !== "action") err(`branch "${key}": unknown trigger`);
    checkSteps(branch?.steps, `branch "${key}"`, branch?.inputs ?? []);
  }

  // Approval cards: links, and every decision starts a branch.
  const decisionValues = new Set<string>();
  for (const [ref, card] of Object.entries(approvals)) {
    for (const item of card.checklist ?? []) checkLink(item.link, `approval "${ref}" checklist`);
    for (const decision of card.decisions ?? []) {
      if (decisionValues.has(decision.value)) err(`approval "${ref}": decision value "${decision.value}" is used twice (values must be distinct across cards)`);
      decisionValues.add(decision.value);
      if (!(decision.value in branches)) err(`approval "${ref}": decision "${decision.value}" has no branch`);
      checkLink(decision.panel?.article?.link, `approval "${ref}" decision "${decision.value}"`);
      for (const link of Object.values(decision.suggestionLinks ?? {})) checkLink(link, `approval "${ref}" decision "${decision.value}"`);
    }
  }
  const completeBranches = new Set<string>();
  for (const [ref, wrapUp] of Object.entries(wrapUps)) {
    if (wrapUp.completeBranch === undefined) continue;
    completeBranches.add(wrapUp.completeBranch);
    if (!(wrapUp.completeBranch in branches)) err(`wrap-up "${ref}": completeBranch "${wrapUp.completeBranch}" is not a branch`);
  }
  for (const [key, branch] of Object.entries(branches)) {
    if (!decisionValues.has(key) && !completeBranches.has(key) && branch.trigger !== "action") {
      err(`branch "${key}": nothing starts it (no decision or wrap-up points to it, and it isn't an action branch)`);
    }
  }

  // Copilot chips, and the links inside the overview's snapshot.
  const copilot = script.content.copilot;
  if (copilot) {
    for (const chip of copilot.suggestions) if (!(chip in copilot.links)) err(`copilot chip "${chip}" has no link`);
    for (const [chip, link] of Object.entries(copilot.links)) checkLink(link, `copilot link "${chip}"`);
    for (const [used, next] of Object.entries(copilot.replacements ?? {})) {
      if (!(used in copilot.links) || !(next in copilot.links)) err(`copilot replacement "${used}" → "${next}" names a chip with no link`);
    }
  }
  for (const line of script.content.overview?.snapshot ?? []) {
    for (const [, key] of line.matchAll(/\]\(([^)]+)\)/g)) checkLink(key, "overview snapshot");
  }

  // The script must be launchable as its own channel, and as the override.
  for (const channel of new Set([script.channel, options.channel].filter((c): c is ChannelKind => !!c))) {
    try {
      addressFor(script, channel);
    } catch (error) {
      err(`can't launch as ${channel}: ${(error as Error).message}`);
    }
  }
  return errors;
}

/** Parses JSON text into a script, or reports why it isn't one. */
export function parseScenarioJson(text: string, options: { channel?: ChannelKind } = {}): { script?: ScenarioScript; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { errors: [`not valid JSON: ${(error as Error).message}`] };
  }
  const errors = validateScenario(parsed, options);
  return errors.length === 0 ? { script: parsed as ScenarioScript, errors } : { errors };
}
