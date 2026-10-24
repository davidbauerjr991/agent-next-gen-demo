import type { AgentId, AgentPresence, ChannelKind, EntityId, InteractionId, PresenceCategory } from "../../domain";
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

/** Skills inbound contacts can be routed to: the outbound ones plus queues
 *  only routing uses (bot-handled reviews, returns). */
export const SIM_INBOUND_SKILLS: OutboundSkill[] = [
  ...SIM_OUTBOUND_SKILLS,
  { id: "ai-review", name: "AI Review" },
  { id: "returns", name: "Returns" },
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
  transfer: { blind: true, consult: false, consultChannels: ["voice", "chat"] },
  typing: true,
  deliveryReceipts: true,
  agentLeg: true,
  wrapUp: true,
  caseStatus: true,
  reopen: true,
  review: true,
};

/** A contact the engine starts with: a routed offer already waiting for the
 *  agent. It arrives through `getSnapshot`, never as an `incoming` event. */
/** The skill an inbound contact is routed to when none is given (General
 *  Support, the same "general" skill New Outbound uses). */
export const DEFAULT_INBOUND_SKILL_ID = "general";

/** The IVR's reason-for-contact line per skill (pre-contact summary). */
export const SIM_CONTACT_REASONS: Readonly<Record<string, string>> = {
  general: "General question about the account",
  technical: "Technical issue with a service or device",
  billing: "Question about a bill or payment",
  sales: "Interested in plans or upgrades",
  escalations: "Escalated issue that needs follow-up",
  vip: "Priority request from a VIP customer",
  "ai-review": "Virtual agent needs a person to review",
  returns: "Return or refund for an order",
};

/** A customer the sim's routing recognizes by an inbound address (the
 *  caller-ID / email match a real ACD does before offering the contact).
 *  P1's generated database replaces it. */
export interface SimDirectoryEntry {
  entityId: EntityId;
  name: string;
  /** In any format; matched digits-only (`normalizePhone`). */
  phones: readonly string[];
  /** Matched case-insensitively. */
  emails: readonly string[];
  /** The customer's most recent contact before this session, if any. */
  lastContact?: { channel: ChannelKind; ageMinutes: number; caseId: string; caseStatus: string; topic: string };
}

export interface SimSeedContact {
  /** Fixed, so the UI can link a notification to it. */
  id: InteractionId;
  channel: ChannelKind;
  /** Display name the contact presented (`Interaction.contactName`). */
  contactName: string;
  entityId?: EntityId;
  address?: string;
  /** How long ago the contact arrived (sets `startedAt`). */
  ageMinutes: number;
  /** The skill it was routed to (default General Support). */
  skillId?: string;
}

/** The demo's waiting assignments, matching the agent UI's notifications
 *  "1", "3" and "4" (INITIAL_NOTIFICATIONS / NOTIFICATION_CHANNEL in
 *  agent-next-gen-interaction-dashboard.tsx). Each `entityId` is the seed
 *  contact's own pseudo-entity (`seed:<name>`, like Contact History's
 *  `history:<caseId>`; NOTIFICATION_ENTITY_ID mirrors it on the UI side).
 *  They used to be linked to `CREATE_NEW_CUSTOMERS[Number(id) % length]`, a
 *  different customer's record, so an outbound to that customer (Sarah
 *  Brown, `customer-2`) joined Noah Patel's card (P-AIFIRST (k5) F). Plain
 *  data on purpose; `demo-seed.test.ts` guards against drift. P1's
 *  generated databases replace this. */
export const SIM_DEMO_SEED: readonly SimSeedContact[] = [
  { id: "seed-notification-1" as InteractionId, channel: "email", contactName: "Noah Patel", entityId: "seed:noah-patel" as EntityId, ageMinutes: 13 },
  { id: "seed-notification-3" as InteractionId, channel: "email", contactName: "Lauren Kim", entityId: "seed:lauren-kim" as EntityId, ageMinutes: 24 },
  { id: "seed-notification-4" as InteractionId, channel: "sms", contactName: "Ethan Zhang", entityId: "seed:ethan-zhang" as EntityId, ageMinutes: 37 },
];

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
