// Maya Chen — a cold incoming voice call that is answered automatically (no accept/decline), about a refund for a damaged espresso
// machine. Customer and case details come from the Agentic Workspace demo (agentic-workspace-demo.vercel.app/workspace/desktop,
// CASE-30402: cracked water tank on NR-10871, $412.00 refund), reframed as a plain inbound call with no AI agent: "B" in
// AgentWorkspaceAdvancedPage.tsx adds this interaction and the call connects immediately.
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";

export const MAYA_CHEN_CALL_ID = "maya-chen-refund-call";
export const MAYA_CHEN_CALL_CUSTOMER_NAME = "Maya Chen";
export const MAYA_CHEN_CALL_CASE_ID = "CASE-30402";
// Placeholder number: the demo shows none for Maya.
export const MAYA_CHEN_CALL_PHONE = "(646) 555-0143";
export const MAYA_CHEN_CALL_SKILL = "Returns";

const MAYA = { sender: "customer" as const, name: MAYA_CHEN_CALL_CUSTOMER_NAME, initials: "MC" };
const AGENT = { sender: "agent" as const, name: "John Smith", initials: "JS" };

/** What the agent hears once the call connects: lines appear in the voice transcript `appearMs` after answering. */
export const MAYA_CHEN_CALL_LIVE_LINES: { appearMs: number; message: TranscriptMessage }[] = [
  {
    appearMs: 1200,
    message: {
      id: "mcc-1",
      ...MAYA,
      timestamp: "2:14 PM",
      text: "Hi, this is Maya Chen. The water tank on my espresso machine arrived cracked. I'd like a refund, not a replacement.",
    },
  },
  {
    appearMs: 7000,
    message: {
      id: "mcc-2",
      ...AGENT,
      timestamp: "2:14 PM",
      text: "I'm sorry about that, Maya, I'm John. Let me pull up your order and the photo you sent.",
    },
  },
  {
    appearMs: 12000,
    message: {
      id: "mcc-3",
      ...MAYA,
      timestamp: "2:14 PM",
      text: "It's order NR-10871, the $412 espresso machine, paid with my Visa. I'll buy a different model instead.",
    },
  },
];

export function buildMayaChenCallInteraction(nowTick: number): Interaction {
  const channel: Thread = {
    id: "voice",
    type: "voice",
    startTick: nowTick,
    contactId: `${MAYA_CHEN_CALL_CASE_ID}-CONTACT`,
    value: MAYA_CHEN_CALL_PHONE,
    addressLabel: MAYA_CHEN_CALL_PHONE,
    preview: MAYA_CHEN_CALL_SKILL,
    direction: "inbound",
    // A cold call has no earlier conversation: show only this live session, not the generic mock history.
    startedFresh: true,
  };
  return {
    id: MAYA_CHEN_CALL_ID,
    interactionId: `MCC-INTERACTION-${Date.now()}`,
    customerName: MAYA_CHEN_CALL_CUSTOMER_NAME,
    customerId: MAYA_CHEN_CALL_CASE_ID,
    threads: [channel],
    currentThreadId: channel.id,
    liveMessages: { voice: [] },
    threadStatuses: { voice: "Open" },
  };
}

/** Contact Details content for the call (Autosummary bullets, summaries, next step). */
export const MAYA_CHEN_CALL_OVERVIEW = {
  subtitle: "Member since 2022 · 6 orders",
  tags: ["Member", "Prefers email", "Rated last 3 contacts 5 of 5"],
  detailedSummary: [
    "Member since 2022 with 6 orders. Prefers email, rated her last 3 contacts 5 of 5, and paid with Visa 4417 on her last 2 orders. This is her first damage claim in 2 years.",
    "Her espresso machine (order NR-10871, $412.00, Sep 25) arrived with a cracked water tank. She submitted a return request in the app and a refund review is at stage 3 of 5.",
  ],
  realTimeSummary:
    "Maya is calling for a refund on the espresso machine from order NR-10871 ($412.00), which arrived with a cracked water tank. She wants a refund, not a replacement. The photo check passed and the refund is within your $500 limit. She sounds disappointed.",
  snapshot: [
    "Calling for a $412.00 refund on [order NR-10871](maya-order), an espresso machine that arrived with a cracked water tank.",
    "Wants a refund, not a replacement; the damage photo check passed.",
    "Paid with [Visa 4417](maya-card); refunds up to $500 with a confirmed photo check are within your limit ([RET-1.3](maya-refund-steps)).",
  ],
  nextBestAction:
    "Refund $412.00 to Visa 4417 under RET-1.3, email the prepaid return label, and tell Maya the refund usually posts in 3 to 5 business days.",
};

/** Copilot footer for the call: chips and the side panel each one opens. */
export const MAYA_CHEN_CALL_COPILOT_SUGGESTIONS = ["Show the order", "Show the card on file", "How do I refund a damaged item?"];
export const MAYA_CHEN_CALL_COPILOT_LINKS: Record<string, string> = {
  "Show the order": "maya-order",
  "Show the card on file": "maya-card",
  "How do I refund a damaged item?": "maya-refund-steps",
};
