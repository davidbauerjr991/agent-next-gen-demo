import type { AgentId, AgentPresence, PresenceCategory } from "../../domain";
import type { InteractionCapabilities, OutboundSkill } from "../../providers";

// Static data the sim engine serves. Plain data on purpose: adapters don't
// import lyra-ui or components. P1 moves the skills (and anything else
// vertical-specific) into the active ContactCenterProfile.

/** Mirrors lyra-ui's `AgentStatus` codes and labels (agent-profile.tsx), so
 *  P0.5a can map them one-to-one. Category per the P0.1 mapping. */
const PRESENCE_LABELS: [code: string, label: string][] = [
  ["available", "Available"],
  ["working", "Working"],
  ["after-call-work", "After Call Work"],
  ["unavailable", "Unavailable"],
  ["lunch", "Lunch"],
  ["break", "Break"],
  ["meeting", "Meeting"],
  ["training", "Training"],
  ["coaching", "Coaching"],
  ["team-huddle", "Team Huddle"],
  ["bio-break", "Bio Break"],
  ["technical-issue", "Technical Issue"],
  ["system-outage", "System Outage"],
  ["administrative-work", "Administrative Work"],
  ["back-office", "Back Office"],
  ["do-not-disturb", "Do Not Disturb"],
  ["end-of-shift", "End of Shift"],
  ["emergency", "Emergency"],
];

function presenceCategory(code: string): PresenceCategory {
  if (code === "available") return "available";
  if (code === "working" || code === "after-call-work") return "working";
  return "unavailable";
}

/** Presence options without `since` (stamped when the agent picks one). */
export const SIM_PRESENCE_OPTIONS: Omit<AgentPresence, "since">[] = PRESENCE_LABELS.map(([code, label]) => ({
  code,
  label,
  category: presenceCategory(code),
}));

/** Mirrors `OUTBOUND_CONFIG.skillOptions` (agent-next-gen-outbound-data.tsx);
 *  offered on every outbound channel. */
export const SIM_OUTBOUND_SKILLS: OutboundSkill[] = [
  { id: "general", name: "General Support" },
  { id: "technical", name: "Technical Support" },
  { id: "billing", name: "Billing" },
  { id: "sales", name: "Sales" },
  { id: "escalations", name: "Escalations" },
  { id: "vip", name: "VIP Support" },
];

export const SIM_AGENT = {
  id: "sim-agent" as AgentId,
  displayName: "John Smith",
};

/** What the sim supports. `transfer.consult` is off — the sim has no consult
 *  flow, so it's the standing "not-supported" example. */
export const SIM_CAPABILITIES: InteractionCapabilities = {
  channels: {
    inbound: ["voice", "chat"],
    outbound: ["voice", "chat", "sms", "whatsapp", "email"],
  },
  decline: true,
  hold: true,
  mute: true,
  record: true,
  mask: true,
  dtmf: true,
  transfer: { blind: true, consult: false },
  typing: true,
  deliveryReceipts: true,
  agentLeg: true,
  wrapUp: true,
  caseStatus: true,
};

/** Scripted delays inside the engine, separate from bus latency. */
export interface SimTimings {
  /** Outbound voice: "connecting" → "active". */
  ring: { minMs: number; maxMs: number };
  /** Agent leg: "connecting" → "connected". */
  legConnect: { minMs: number; maxMs: number };
  /** Agent message: "sent" → "delivered". */
  delivery: { minMs: number; maxMs: number };
}

export const DEFAULT_SIM_TIMINGS: SimTimings = {
  ring: { minMs: 2000, maxMs: 4000 },
  legConnect: { minMs: 1000, maxMs: 2000 },
  delivery: { minMs: 300, maxMs: 900 },
};
