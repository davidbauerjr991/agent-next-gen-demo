import { describe, expect, it } from "vitest";
import { MARCUS_WEBB_CALL_TRANSCRIPT } from "./legacy/marcus-webb-transcript";
import {
  LUCAS_THOMAS_CASE_ID,
  LUCAS_THOMAS_CHAT_TRANSCRIPT,
  LUCAS_THOMAS_CONTEXT,
  LUCAS_THOMAS_COPILOT_SUGGESTIONS,
  LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS,
  LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS,
  LUCAS_THOMAS_CUSTOMER_NAME,
  LUCAS_THOMAS_DECISION_FOLLOWUPS,
  LUCAS_THOMAS_ID,
  LUCAS_THOMAS_INITIAL_COUNT,
  LUCAS_THOMAS_REALTIME_STEPS,
  LUCAS_THOMAS_SHIPPING_APPROVAL_SUMMARY,
  LUCAS_THOMAS_UPSET_APPROVAL_SUMMARY,
  LUCAS_THOMAS_WRAP_UP,
  type LucasThomasFollowUpStep,
} from "@/components/agent-next-gen-lucas-thomas-scenario";
import { MARCUS_WEBB_CUSTOMER_ID, MARCUS_WEBB_CUSTOMER_NAME, MARCUS_WEBB_ID } from "@/components/agent-next-gen-marcus-webb-scenario";
import {
  MAYA_CHEN_CALL_CASE_ID,
  MAYA_CHEN_CALL_COPILOT_LINKS,
  MAYA_CHEN_CALL_COPILOT_SUGGESTIONS,
  MAYA_CHEN_CALL_CUSTOMER_NAME,
  MAYA_CHEN_CALL_ID,
  MAYA_CHEN_CALL_LIVE_LINES,
  MAYA_CHEN_CALL_OVERVIEW,
  MAYA_CHEN_CALL_PHONE,
  MAYA_CHEN_CALL_SKILL,
} from "@/components/agent-next-gen-maya-chen-refund-call-scenario";
import {
  TOM_LEWIS_CALL_CASE_ID,
  TOM_LEWIS_CALL_COPILOT_LINKS,
  TOM_LEWIS_CALL_COPILOT_SUGGESTIONS,
  TOM_LEWIS_CALL_CUSTOMER_NAME,
  TOM_LEWIS_CALL_ID,
  TOM_LEWIS_CALL_LIVE_LINES,
  TOM_LEWIS_CALL_OVERVIEW,
  TOM_LEWIS_CALL_PHONE,
  TOM_LEWIS_CALL_SKILL,
} from "@/components/agent-next-gen-tom-lewis-void-call-scenario";
import type { TranscriptApprovalSummary, TranscriptMessage } from "@/components/agent-next-gen-transcript";
import {
  LUCAS_THOMAS_SCRIPT,
  MARCUS_WEBB_SCRIPT,
  MAYA_CHEN_SCRIPT,
  TOM_LEWIS_SCRIPT,
  type ScenarioScript,
  type ScenarioStep,
} from "./index";

// The ported scripts are copies of content the pages still read (until
// P0.5c moves them onto the engine). This keeps the copies from drifting;
// P0.5c deletes it along with the legacy modules.

// Compile-time: the scripts' approval cards fit the agent UI's card type.
const approvalCardsFitTheUi: TranscriptApprovalSummary[] = Object.values(LUCAS_THOMAS_SCRIPT.content.approvals);
void approvalCardsFitTheUi;

const speakerOf = (sender: TranscriptMessage["sender"]) => (sender === "customer" ? "customer" : "bot");
const stepById = (script: ScenarioScript, id: string): ScenarioStep => {
  const step = script.steps.find((s) => s.id === id);
  if (!step) throw new Error(`${script.id}: no step ${id}`);
  return step;
};

describe("Marcus Webb", () => {
  it("matches the page's call transcript, line for line", () => {
    expect(MARCUS_WEBB_CALL_TRANSCRIPT.length).toBe(MARCUS_WEBB_SCRIPT.steps.length);
    for (const message of MARCUS_WEBB_CALL_TRANSCRIPT) {
      expect(stepById(MARCUS_WEBB_SCRIPT, message.id)).toMatchObject({
        kind: "say",
        speaker: speakerOf(message.sender),
        text: message.text,
      });
      expect(message.name === "Cognigy AI Agent" ? MARCUS_WEBB_SCRIPT.participants?.bot : MARCUS_WEBB_CUSTOMER_NAME).toBe(message.name);
    }
    const times = MARCUS_WEBB_SCRIPT.steps.map((s) => s.at);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(times.every((t) => t < 0)).toBe(true);
  });

  it("keeps the scenario card's identity", () => {
    expect(MARCUS_WEBB_SCRIPT.id).toBe(MARCUS_WEBB_ID);
    expect(MARCUS_WEBB_SCRIPT.entity).toMatchObject({ key: MARCUS_WEBB_ID, directoryId: MARCUS_WEBB_ID, name: MARCUS_WEBB_CUSTOMER_NAME, caseId: MARCUS_WEBB_CUSTOMER_ID });
  });
});

describe.each([
  {
    label: "Tom Lewis",
    script: TOM_LEWIS_SCRIPT,
    lines: TOM_LEWIS_CALL_LIVE_LINES,
    overview: TOM_LEWIS_CALL_OVERVIEW,
    suggestions: TOM_LEWIS_CALL_COPILOT_SUGGESTIONS,
    links: TOM_LEWIS_CALL_COPILOT_LINKS,
    identity: { id: TOM_LEWIS_CALL_ID, name: TOM_LEWIS_CALL_CUSTOMER_NAME, caseId: TOM_LEWIS_CALL_CASE_ID, phone: TOM_LEWIS_CALL_PHONE, skill: TOM_LEWIS_CALL_SKILL },
  },
  {
    label: "Maya Chen",
    script: MAYA_CHEN_SCRIPT,
    lines: MAYA_CHEN_CALL_LIVE_LINES,
    overview: MAYA_CHEN_CALL_OVERVIEW,
    suggestions: MAYA_CHEN_CALL_COPILOT_SUGGESTIONS,
    links: MAYA_CHEN_CALL_COPILOT_LINKS,
    identity: { id: MAYA_CHEN_CALL_ID, name: MAYA_CHEN_CALL_CUSTOMER_NAME, caseId: MAYA_CHEN_CALL_CASE_ID, phone: MAYA_CHEN_CALL_PHONE, skill: MAYA_CHEN_CALL_SKILL },
  },
])("$label", ({ script, lines, overview, suggestions, links, identity }) => {
  it("matches the legacy live lines, timing and speakers", () => {
    expect(script.steps).toHaveLength(lines.length);
    for (const { appearMs, message } of lines) {
      expect(stepById(script, message.id)).toMatchObject({
        kind: "say",
        speaker: message.sender === "customer" ? "customer" : "agent",
        anchor: "answered",
        at: appearMs,
        text: message.text,
      });
    }
  });

  it("matches the legacy overview, Copilot chips and identity", () => {
    expect(script.content.overview).toEqual(overview);
    expect(script.content.copilot).toEqual({ suggestions, links });
    expect(script.id).toBe(identity.id);
    expect(script.entity).toMatchObject({ name: identity.name, caseId: identity.caseId, phone: identity.phone });
    expect(script.skill.name).toBe(identity.skill);
  });
});

describe("Lucas Thomas", () => {
  const script: ScenarioScript = LUCAS_THOMAS_SCRIPT;

  it("matches the legacy chat transcript: lines, events, speakers and the approval row", () => {
    for (const message of LUCAS_THOMAS_CHAT_TRANSCRIPT) {
      const step = stepById(script, message.id);
      if (message.summary) {
        expect(step).toMatchObject({ kind: "beat", beat: "approval", ref: "initial" });
        expect(script.content.approvals!.initial).toEqual(message.summary);
      } else if (message.event) {
        expect(step).toMatchObject({ kind: "event", text: message.text });
      } else {
        expect(step).toMatchObject({ kind: "say", speaker: speakerOf(message.sender), text: message.text });
      }
    }
  });

  it("matches the legacy setup count and live timing (typing included)", () => {
    const ids = LUCAS_THOMAS_CHAT_TRANSCRIPT.map((m) => m.id);
    ids.slice(0, LUCAS_THOMAS_INITIAL_COUNT).forEach((id) => expect(stepById(script, id).at).toBeLessThan(0));
    const live = ids.slice(LUCAS_THOMAS_INITIAL_COUNT);
    expect(live).toHaveLength(LUCAS_THOMAS_REALTIME_STEPS.length);
    live.forEach((id, i) => {
      const timing = LUCAS_THOMAS_REALTIME_STEPS[i];
      expect(stepById(script, id).at).toBe(timing.appearMs);
      const typing = script.steps.find((s) => s.id === `${id}-typing`);
      if (timing.typingStartMs === undefined) {
        expect(typing).toBeUndefined();
      } else {
        expect(typing).toMatchObject({
          kind: "typing",
          speaker: timing.typing === "customer" ? "customer" : "bot",
          at: timing.typingStartMs,
          durationMs: timing.appearMs - timing.typingStartMs,
        });
      }
    });
  });

  it("matches every legacy decision follow-up", () => {
    expect(Object.keys(script.branches!).sort()).toEqual(Object.keys(LUCAS_THOMAS_DECISION_FOLLOWUPS).sort());
    for (const [key, legacy] of Object.entries(LUCAS_THOMAS_DECISION_FOLLOWUPS)) {
      const expected = legacy.map(({ timestamp, ...step }) => {
        void timestamp;
        return step;
      });
      expect(toLegacySteps(script.branches![key].steps), key).toEqual(expected);
    }
  });

  it("matches the legacy approval cards, wrap-up, context and chips", () => {
    expect(script.content.approvals!.shipping).toEqual(LUCAS_THOMAS_SHIPPING_APPROVAL_SUMMARY);
    expect(script.content.approvals!.upset).toEqual(LUCAS_THOMAS_UPSET_APPROVAL_SUMMARY);
    const { completeBranch, ...wrapUp } = script.content.wrapUps!.main;
    expect(completeBranch).toBe("ship-wrapup");
    expect(wrapUp).toEqual(LUCAS_THOMAS_WRAP_UP);
    const { caseId, skill, ...context } = LUCAS_THOMAS_CONTEXT;
    expect(caseId).toBe(script.entity.caseId);
    expect(skill).toBe(script.skill.name);
    expect(script.content.caseContext).toEqual(context);
    expect(script.content.copilot).toEqual({
      suggestions: LUCAS_THOMAS_COPILOT_SUGGESTIONS,
      links: LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS,
      replacements: LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS,
    });
    expect(script).toMatchObject({ id: LUCAS_THOMAS_ID, entity: { name: LUCAS_THOMAS_CUSTOMER_NAME, caseId: LUCAS_THOMAS_CASE_ID } });
  });
});

/** Rebuilds the legacy follow-up shape from a branch's steps: a typing step
 *  folds into the line it leads to. */
function toLegacySteps(steps: ScenarioStep[]): LucasThomasFollowUpStep[] {
  const out: LucasThomasFollowUpStep[] = [];
  for (const step of steps) {
    if (step.kind === "typing") continue;
    const typing = steps.find((s) => s.id === `${step.id}-typing`);
    const typingStartMs = typing ? { typingStartMs: typing.at } : {};
    switch (step.kind) {
      case "say":
        out.push({ kind: step.speaker === "bot" ? "ai" : "customer", ...typingStartMs, appearMs: step.at, text: step.text });
        break;
      case "event":
        out.push({ kind: "event", appearMs: step.at, text: step.text });
        break;
      case "beat":
        if (step.beat === "instruction") {
          out.push({ kind: "instruction", appearMs: step.at, text: step.text, ...(step.by ? { by: step.by } : {}), ...(step.link ? { link: step.link } : {}) });
        } else if (step.beat === "approval") {
          out.push({ kind: "approval", appearMs: step.at, ...(step.ref === "upset" ? { approvalKey: "upset" as const } : {}) });
        } else if (step.beat === "wrap-up") {
          out.push({ kind: "wrapup", appearMs: step.at });
        } else {
          out.push({ kind: step.beat, appearMs: step.at });
        }
        break;
      default:
        throw new Error(`unexpected ${step.kind} in a legacy follow-up`);
    }
  }
  return out;
}
