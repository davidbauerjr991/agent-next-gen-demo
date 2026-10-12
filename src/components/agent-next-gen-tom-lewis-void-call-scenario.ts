// Tom Lewis — a cold incoming voice call (no AI agent involved) about voiding a duplicate charge.
// Customer and case details come from the Agentic Workspace demo (agentic-workspace-demo.vercel.app/workspace/desktop,
// CASE-30409: charged twice on two cards), reframed as a plain inbound call: "C" in AgentWorkspaceAdvancedPage.tsx rings an
// incoming-call notice; Accept adds this interaction and starts the live call.
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage } from "@/components/agent-next-gen-transcript";

export const TOM_LEWIS_CALL_ID = "tom-lewis-void-call";
export const TOM_LEWIS_CALL_CUSTOMER_NAME = "Tom Lewis";
export const TOM_LEWIS_CALL_CASE_ID = "CASE-30409";
export const TOM_LEWIS_CALL_PHONE = "(312) 555-0187";
export const TOM_LEWIS_CALL_SKILL = "Billing";

const TOM = { sender: "customer" as const, name: TOM_LEWIS_CALL_CUSTOMER_NAME, initials: "TL" };
const AGENT = { sender: "agent" as const, name: "John Smith", initials: "JS" };

/** What the agent hears once they accept: lines appear in the voice transcript `appearMs` after accepting. */
export const TOM_LEWIS_CALL_LIVE_LINES: { appearMs: number; message: TranscriptMessage }[] = [
  {
    appearMs: 1200,
    message: {
      id: "tlc-1",
      ...TOM,
      timestamp: "2:14 PM",
      text: "Hi, this is Tom Lewis. I was charged twice for one order, once on my Visa and once on my Mastercard. I need one of those charges voided.",
    },
  },
  {
    appearMs: 7000,
    message: {
      id: "tlc-2",
      ...AGENT,
      timestamp: "2:14 PM",
      text: "Thanks for calling, Tom, I'm John. Let me pull up your order and both charges.",
    },
  },
  {
    appearMs: 12000,
    message: {
      id: "tlc-3",
      ...TOM,
      timestamp: "2:14 PM",
      text: "It's order NR-50877, $86.40. I only placed it once, and I'd rather keep the Mastercard charge since that's my default card.",
    },
  },
];

export function buildTomLewisCallInteraction(nowTick: number): Interaction {
  const channel: Thread = {
    id: "voice",
    type: "voice",
    startTick: nowTick,
    contactId: `${TOM_LEWIS_CALL_CASE_ID}-CONTACT`,
    value: TOM_LEWIS_CALL_PHONE,
    addressLabel: TOM_LEWIS_CALL_PHONE,
    preview: TOM_LEWIS_CALL_SKILL,
    direction: "inbound",
    // A cold call has no earlier conversation: show only this live session, not the generic mock history.
    startedFresh: true,
  };
  return {
    id: TOM_LEWIS_CALL_ID,
    interactionId: `TLC-INTERACTION-${Date.now()}`,
    customerName: TOM_LEWIS_CALL_CUSTOMER_NAME,
    customerId: TOM_LEWIS_CALL_CASE_ID,
    threads: [channel],
    currentThreadId: channel.id,
    liveMessages: { voice: [] },
    threadStatuses: { voice: "Open" },
  };
}

/** Contact Details content for the call (Autosummary bullets, summaries, next step). */
export const TOM_LEWIS_CALL_OVERVIEW = {
  subtitle: "Member since 2021 · 3 orders",
  tags: ["Member", "Prefers voice", "Mastercard 9031 default"],
  detailedSummary: [
    "Member since 2021 with 3 orders. Prefers voice for support and asked for a person on his last 2 calls. Made Mastercard 9031 his default card on Sep 27.",
    "Today order NR-50877 ($86.40) was charged twice, once on Visa 2210 and once on Mastercard 9031, but only one order was placed. He requested a refund in the app this morning.",
  ],
  realTimeSummary:
    "Tom is calling to void one of two $86.40 charges on order NR-50877, one on Visa 2210 and one on Mastercard 9031. Only one order was placed. A duplicate-charge review is at stage 3 of 5. He sounds annoyed.",
  snapshot: [
    "Calling to void one of two $86.40 charges on [order NR-50877](order).",
    "Charged on Visa 2210 and Mastercard 9031; only one order was placed.",
    "Prefers to keep the charge on his [Mastercard 9031](card) card on file, his default since Sep 27.",
  ],
  nextBestAction:
    "Confirm both $86.40 charges in payments, then void the Visa 2210 charge on NR-50877 and tell Tom how long the refund will take.",
};

/** Copilot footer for the call: chips and the side panel each one opens. */
export const TOM_LEWIS_CALL_COPILOT_SUGGESTIONS = ["Show the charges", "Show the card on file", "How do I void a charge?"];
export const TOM_LEWIS_CALL_COPILOT_LINKS: Record<string, string> = {
  "Show the charges": "order",
  "Show the card on file": "card",
  "How do I void a charge?": "void-steps",
};
