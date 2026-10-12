// Lucas Thomas — a scripted webchat assignment (CASE-30418) taken from the
// Agentic Workspace demo (agentic-workspace-demo.vercel.app/workspace/desktop).
// Per explicit request ("use the case content for lucas thomas and open the
// assignment when the user presses 'a' on the keyboard in v3"):
// `AgentWorkspaceAdvancedPage.tsx` arms an "A" keydown (same pattern as the
// "L" key / Marcus Webb) that adds this interaction to the left nav and
// opens it. Content only — no scripted Copilot walkthrough.
import type { Interaction, Thread } from "@/components/agent-next-gen-interaction-dashboard";
import type { TranscriptMessage, TranscriptApprovalSummary } from "@/components/agent-next-gen-transcript";

export const LUCAS_THOMAS_ID = "lucas-thomas";
export const LUCAS_THOMAS_CUSTOMER_NAME = "Lucas Thomas";
export const LUCAS_THOMAS_CASE_ID = "CASE-30418";

const AI = { sender: "agent" as const, name: "AI agent · Checkout", initials: "AI" };
const LUCAS = { sender: "customer" as const, name: LUCAS_THOMAS_CUSTOMER_NAME, initials: "LT" };

export const LUCAS_THOMAS_CHAT_TRANSCRIPT: TranscriptMessage[] = [
  {
    id: "lt-chat-started",
    ...AI,
    event: true,
    timestamp: "2:05 PM",
    text: "Chat started",
  },
  {
    id: "lt-1",
    ...LUCAS,
    timestamp: "2:05 PM",
    text: "My card got declined on the Aurora X2 launch order. Is the price gone?",
  },
  {
    id: "lt-2",
    ...AI,
    timestamp: "2:05 PM",
    text: "I found order NR-11056. Your card was declined, so it wasn't placed. I've held the launch price of $189.00 and your unit for 24 hours.",
  },
  {
    id: "lt-2-event",
    ...AI,
    event: true,
    timestamp: "2:05 PM",
    text: "Launch price held for 24 h",
  },
  {
    id: "lt-3",
    ...AI,
    timestamp: "2:06 PM",
    text: "Here's a secure link to pay another way.",
  },
  {
    id: "lt-3-event",
    ...AI,
    event: true,
    timestamp: "2:06 PM",
    text: "Payment link sent",
  },
  {
    id: "lt-4",
    ...LUCAS,
    timestamp: "2:09 PM",
    text: "That failed too. Can someone just place it for me?",
  },
  {
    id: "lt-5",
    ...AI,
    timestamp: "2:09 PM",
    text: "I'm sorry, Lucas. I'm aware of an issue with checkout right now. Card payments are failing for some customers and our payments team is working on it.",
  },
  {
    id: "lt-6",
    ...AI,
    timestamp: "2:09 PM",
    text: "Placing it another way needs a person's approval, so I'm asking a payments specialist now. They'll see everything we've tried.",
  },
  {
    id: "lt-6-event",
    ...AI,
    event: true,
    timestamp: "2:09 PM",
    text: "Approval requested",
  },
  {
    id: "lt-6-summary",
    ...AI,
    timestamp: "2:09 PM",
    text: "",
    summary: {
      title: "Approval request · Checkout AI Agent",
      headline:
        "Checkout AI Agent reached its authorization limit and is requesting an exception: place order NR-11056 with another payment method at the held launch price.",
      description:
        "Lucas tried to buy the Aurora X2 launch edition at $189.00. Checkout failed twice during a payment incident.",
      checklist: [
        { label: "Order not placed", detail: "NR-11056 · card declined by the payment service", status: "done", link: "memory:card-declined" },
        { label: "Launch price held", detail: "$189.00 and his unit held for 24 h", status: "done", link: "memory:order" },
        { label: "Payment link sent", detail: "Pay another way · also failed", status: "done", link: "memory:link-requested" },
        {
          label: "Approve the exception",
          detail: "Outside Checkout AI Agent's limits",
          status: "attention",
          badge: "Needs a person",
          link: "memory:payment-review",
        },
      ],
      memoryTitle: "From Experience Memory",
      memory: [
        "Asked about the Aurora X2 launch on chat Sep 26",
        "Paid by PayPal on 3 of the last 5 orders",
        "Payment review · INC-2207: Waiting on the payment fix · stage 3 of 5",
      ],
      sentimentLabel: "Sentiment",
      sentimentValue: "Frustrated",
      sentimentLevel: 2,
      decisions: [
        {
          value: "accept",
          title: "Approve the Exception",
          panel: {
            headline: "Approve the exception: place the order with PayPal at the held price",
            description: "Card payments are failing on our side and PayPal isn't affected.",
            memory: "Experience Memory: paid by PayPal on 3 of the last 5 orders · order held for INC-2207",
            card: { title: "PayPal on file · $189.00", sub: "lucas.t@... · launch price held until tomorrow 2:05 PM" },
            article: { label: "PAY-3.2 · Launch price holds", link: "article-pay-3-2" },
            confirmLabel: "Authorize and Place Order",
          },
          result: "Exception approved",
        },
        {
          value: "decline",
          title: "Decline the exception",
          description: "The AI agent will let Lucas know the order can't be placed and offer next steps.",
          noteLabel: "Reason",
          notePlaceholder: "Enter a reason for declining…",
          result: "Exception declined",
        },
        {
          value: "other",
          repeatable: true,
          title: "Something else",
          suggestions: [
            "Ask the customer for more time",
            "Apologize to the customer and transfer to a specialist",
            "Ask if they tried a different payment method",
          ],
          notePlaceholder: "Describe what you'd like the AI agent to do instead (e.g. try a different payment method first)...",
          result: "Instruction sent to the AI agent",
        },
      ],
    },
  },
];

/** The first messages (setup) are already on screen at launch; the rest play out live. */
export const LUCAS_THOMAS_INITIAL_COUNT = 6;
/** Live playback of the remaining messages: ms after launch the message appears, and (customer messages) when the typing indicator starts. */
export const LUCAS_THOMAS_REALTIME_STEPS: { appearMs: number; typingStartMs?: number; typing?: "customer" | "ai" }[] = [
  { typing: "customer", typingStartMs: 1500, appearMs: 4500 },
  { typing: "ai", typingStartMs: 5200, appearMs: 8000 },
  { typing: "ai", typingStartMs: 8600, appearMs: 11500 },
  { appearMs: 12300 },
  { appearMs: 13300 },
];

/** Case context from the demo (Experience Memory + pinned insights). */
export const LUCAS_THOMAS_CONTEXT = {
  caseId: LUCAS_THOMAS_CASE_ID,
  priority: "P1",
  status: "Queued",
  skill: "AI Review",
  incident: "Payment review · INC-2207 · stage 3 of 5",
  pinned: ["Escalation · Authorization limit · alternate payment", "Sentiment · Frustrated"],
  profile: "Insider since 2023 · 14 orders · prefers text",
  memory: [
    "Card declined at checkout · 2:01 PM",
    "Pay-another-way link requested · 2:03 PM",
    "Payment review · INC-2207 · stage 3 of 5",
    "Chat started · 2:05 PM",
  ],
} as const;

export function buildLucasThomasInteraction(nowTick: number): Interaction {
  const channel: Thread = {
    id: "chat",
    type: "chat",
    startTick: nowTick - 251,
    contactId: `${LUCAS_THOMAS_CASE_ID}-CONTACT`,
    preview: "AI Review",
    direction: "inbound",
    // No SLA clock until the agent takes over (see the Takeover handler in AgentWorkspaceAdvancedPage).
    awaitingResponse: false,
    lastCustomerMessageTick: nowTick - 251,
  };
  return {
    id: LUCAS_THOMAS_ID,
    interactionId: `LT-INTERACTION-${Date.now()}`,
    customerName: LUCAS_THOMAS_CUSTOMER_NAME,
    customerId: LUCAS_THOMAS_CASE_ID,
    threads: [channel],
    currentThreadId: channel.id,
    liveMessages: { chat: LUCAS_THOMAS_CHAT_TRANSCRIPT.slice(0, LUCAS_THOMAS_INITIAL_COUNT) },
    threadStatuses: { chat: "Open" },
  };
}

/** What plays out in the chat (outside the approval card) once the agent decides. `{note}` is replaced with the agent's typed note. */
export type LucasThomasFollowUpStep = {
  /** ms after the decision at which the item appears */
  appearMs: number;
  /** show the AI typing bubble from this many ms after the decision until the item appears */
  typingStartMs?: number;
  kind: "event" | "ai" | "customer" | "close" | "dismiss" | "instruction" | "approval" | "wrapup";
  text?: string;
  timestamp?: string;
  /** `instruction` rows only: who the row is attributed to (defaults to the human agent, John Smith). */
  by?: string;
  /** `instruction` rows only: side-panel key the row opens (defaults to the instruction panel). */
  link?: string;
  /** `approval` steps only: which approval card to add (defaults to the shipping override card). */
  approvalKey?: "upset";
};
export const LUCAS_THOMAS_DECISION_FOLLOWUPS: Record<string, LucasThomasFollowUpStep[]> = {
  accept: [
    { kind: "instruction", appearMs: 150, text: "Authorize and place order NR-11056", timestamp: "2:10 PM" },
    { kind: "event", appearMs: 900, text: "Exception approved by John Smith", timestamp: "2:10 PM" },
    { kind: "event", appearMs: 2600, text: "Order NR-11056 placed at the held launch price", timestamp: "2:10 PM" },
    { kind: "event", appearMs: 3600, text: 'Disposition updated to "Exception Approved"', timestamp: "2:10 PM" },
    {
      kind: "ai",
      typingStartMs: 4200,
      appearMs: 6800,
      timestamp: "2:10 PM",
      text: "Good news, Lucas — your order NR-11056 has been placed at the launch price of $189.00. You'll receive a confirmation email shortly. Thanks for your patience!",
    },
    {
      kind: "customer",
      typingStartMs: 8200,
      appearMs: 10800,
      timestamp: "2:11 PM",
      text: "Thank you so much — really appreciate the quick help!",
    },
    // Lucas follows up, so the chat stays open (no auto-close/unassign) for the agent to answer.
    {
      kind: "customer",
      typingStartMs: 12400,
      appearMs: 15200,
      timestamp: "2:12 PM",
      text: "Will it still ship today? It's a birthday present for Friday.",
    },
    {
      kind: "ai",
      typingStartMs: 16200,
      appearMs: 18600,
      timestamp: "2:12 PM",
      text: "I understand your concern. Let me check that for you.",
    },
    // The AI agent "works" (spinner), then logs the check as an interstitial row that opens the shipping details.
    {
      kind: "instruction",
      appearMs: 19600,
      timestamp: "2:12 PM",
      text: "Checking order processing, shipping and arrival",
      by: "Checkout AI Agent",
      link: "shipping-check",
    },
    {
      kind: "ai",
      typingStartMs: 21800,
      appearMs: 24800,
      timestamp: "2:13 PM",
      text: "I checked order NR-11056: it has been processed and will ship out today with standard shipping. Unfortunately, standard delivery is estimated to arrive on Monday, so it won't make it by Friday. I can upgrade you to priority shipping for an additional $15, which would get it to you on Thursday. Would you like me to add it?",
    },
    {
      kind: "customer",
      typingStartMs: 27200,
      appearMs: 30400,
      timestamp: "2:13 PM",
      text: "Honestly, this is really frustrating. It was your order system that wasn't working properly, so I think the company should pay for the priority shipping, not me.",
    },
    {
      kind: "ai",
      typingStartMs: 31400,
      appearMs: 34600,
      timestamp: "2:14 PM",
      text: "I completely understand, Lucas, and I'm sorry for the trouble. I'm not able to authorize that override myself, but I'll check with my human supervisor to see if they can approve covering the priority shipping. Please hold on for just a moment.",
    },
    // A second approval request: the AI agent asks a person to waive the $15.00 priority shipping charge.
    { kind: "approval", appearMs: 37000, timestamp: "2:14 PM" },
  ],
  // Second approval request (waive the $15.00 priority shipping). Distinct option values so one handler serves both cards.
  "ship-accept": [
    { kind: "instruction", appearMs: 150, text: "Approve free priority shipping for NR-11056", timestamp: "2:15 PM" },
    { kind: "event", appearMs: 900, text: "Override approved by John Smith", timestamp: "2:15 PM" },
    { kind: "event", appearMs: 2400, text: "Priority shipping added to NR-11056 · $15.00 waived", timestamp: "2:15 PM" },
    {
      kind: "ai",
      typingStartMs: 3000,
      appearMs: 6000,
      timestamp: "2:15 PM",
      text: "Good news, Lucas — my supervisor approved it. I've upgraded order NR-11056 to priority shipping at no cost to you. It ships today and will arrive on Thursday, in time for the birthday.",
    },
    {
      kind: "customer",
      typingStartMs: 7400,
      appearMs: 10000,
      timestamp: "2:15 PM",
      text: "That's wonderful, thank you so much for sorting this out!",
    },
    // The chat has ended: a Wrap up card appears; completing it saves the outcome and then closes the assignment.
    { kind: "wrapup", appearMs: 12000, timestamp: "2:16 PM" },
  ],
  // Plays after the agent clicks "Complete wrap-up".
  "ship-wrapup": [
    { kind: "event", appearMs: 600, text: 'Outcome saved · Disposition "Checkout · payment incident · resolved"', timestamp: "2:16 PM" },
    { kind: "event", appearMs: 2000, text: "Chat closed and unassigned from John Smith", timestamp: "2:16 PM" },
    { kind: "close", appearMs: 2100 },
    // Auto-dismiss only when the agent never took over (the page drops this step if they did, so they remove it with the "X").
    { kind: "dismiss", appearMs: 6000 },
  ],
  "ship-decline": [
    { kind: "instruction", appearMs: 150, text: "Declined: {note}", timestamp: "2:15 PM" },
    { kind: "event", appearMs: 900, text: "Override declined by John Smith: {note}", timestamp: "2:15 PM" },
    {
      kind: "ai",
      typingStartMs: 1500,
      appearMs: 4500,
      timestamp: "2:15 PM",
      text: "I'm sorry, Lucas — my supervisor wasn't able to approve waiving the priority shipping fee. Your order ships today with standard shipping, or I can add priority shipping for $15.00 if you'd like it by Thursday.",
    },
  ],
  "ship-other": [
    { kind: "instruction", appearMs: 150, text: "{note}", timestamp: "2:15 PM" },
    { kind: "event", appearMs: 900, text: "Instruction sent to the AI agent: {note}", timestamp: "2:15 PM" },
    {
      kind: "ai",
      typingStartMs: 1500,
      appearMs: 4500,
      timestamp: "2:15 PM",
      text: "Thanks for your patience, Lucas — I'm following my supervisor's instructions and will update you on the shipping in just a moment.",
    },
  ],
  decline: [
    { kind: "instruction", appearMs: 150, text: "Declined: {note}", timestamp: "2:10 PM" },
    { kind: "event", appearMs: 900, text: "Exception declined by John Smith: {note}", timestamp: "2:10 PM" },
    { kind: "event", appearMs: 2200, text: 'Disposition updated to "Exception Declined"', timestamp: "2:10 PM" },
    {
      kind: "ai",
      typingStartMs: 2800,
      appearMs: 5400,
      timestamp: "2:10 PM",
      text: "I'm sorry, Lucas — we're unable to place order NR-11056 for you right now. Your launch price stays held for 24 hours, so you can complete the purchase once checkout is back to normal.",
    },
    // Lucas gets irate and demands a call; an escalation card asks the agent how to respond.
    {
      kind: "customer",
      typingStartMs: 7000,
      appearMs: 9400,
      timestamp: "2:11 PM",
      text: "This is unacceptable. I've been trying to buy this for hours. I want someone to call me immediately, right now!",
    },
    { kind: "approval", approvalKey: "upset", appearMs: 11800, timestamp: "2:11 PM" },
  ],
  "upset-call": [
    { kind: "event", appearMs: 150, text: "John Smith is calling Lucas Thomas", timestamp: "2:12 PM" },
    {
      kind: "ai",
      typingStartMs: 1200,
      appearMs: 2600,
      timestamp: "2:12 PM",
      text: "I'm sorry for the frustration, Lucas. John Smith is calling you right now, so please keep your phone nearby.",
    },
    { kind: "event", appearMs: 4200, text: "Call connected · Lucas answered", timestamp: "2:12 PM" },
  ],
  "upset-transfer": [
    { kind: "instruction", appearMs: 150, text: "Transfer Lucas to a specialist", timestamp: "2:12 PM" },
    { kind: "event", appearMs: 900, text: "Transferring Lucas to a specialist", timestamp: "2:12 PM" },
    {
      kind: "ai",
      typingStartMs: 1500,
      appearMs: 4300,
      timestamp: "2:12 PM",
      text: "I'm sorry for the frustration, Lucas. I'm transferring you to a specialist now who can help you right away.",
    },
  ],
  "upset-other": [
    { kind: "instruction", appearMs: 150, text: "{note}", timestamp: "2:12 PM" },
    { kind: "event", appearMs: 900, text: "Instruction sent to the AI agent: {note}", timestamp: "2:12 PM" },
    {
      kind: "ai",
      typingStartMs: 1200,
      appearMs: 4000,
      timestamp: "2:12 PM",
      text: "Thanks for your patience, Lucas — I'm working on this with a specialist and will update you here shortly.",
    },
  ],
  other: [
    { kind: "instruction", appearMs: 150, text: "{note}", timestamp: "2:10 PM" },
    { kind: "event", appearMs: 900, text: "Instruction sent to the AI agent: {note}", timestamp: "2:10 PM" },
    {
      kind: "ai",
      typingStartMs: 1200,
      appearMs: 4000,
      timestamp: "2:10 PM",
      text: "Thanks for your patience, Lucas — I'm working on this with a specialist and will update you here shortly.",
    },
  ],
};

/** Copilot-tab suggestion chips for Lucas: same behavior as the approval card's "Something else" chips
 *  (spinner interstitial, then the interior side panel opens; a used chip is swapped for its replacement). */
export const LUCAS_THOMAS_COPILOT_SUGGESTIONS = ["Show purchase history", "Payment preferences", "What did the AI agent try?"];
export const LUCAS_THOMAS_COPILOT_SUGGESTION_LINKS: Record<string, string> = {
  "Show shipping details": "shipping-check",
  "Show purchase history": "purchase-history",
  "Check fraud screening results": "fraud-screening",
  "Payment preferences": "payment-preferences",
  "What did the AI agent try?": "ai-attempts",
};
export const LUCAS_THOMAS_COPILOT_SUGGESTION_REPLACEMENTS: Record<string, string> = {
  "Show purchase history": "Check fraud screening results",
};

/** Second approval request, shown after Lucas asks the company to pay for priority shipping. */
export const LUCAS_THOMAS_SHIPPING_APPROVAL_SUMMARY: TranscriptApprovalSummary = {
  title: "Approval request · Checkout AI Agent",
  headline:
    "Checkout AI Agent can't waive a shipping charge and is requesting an override: ship order NR-11056 with priority shipping at no cost to Lucas.",
  description:
    "Standard shipping would miss Lucas's Friday birthday gift. Priority shipping is $15.00 more, and Lucas believes the company should cover it because the failed checkout was on our side.",
  checklist: [
    { label: "Order processed", detail: "NR-11056 ships today before the 4 PM cutoff", status: "done", link: "shipping-check" },
    { label: "Arrival checked", detail: "Standard arrives Monday · misses Friday", status: "done", link: "shipping-check" },
    { label: "Priority upgrade offered", detail: "$15.00 · arrives Thursday · Lucas declined to pay", status: "done", link: "shipping-check" },
    {
      label: "Approve the override",
      detail: "Waiving a fee is outside Checkout AI Agent's limits",
      status: "attention",
      badge: "Needs a person",
      link: "payments",
    },
  ],
  memoryTitle: "From Experience Memory",
  memory: [
    "Insider since 2023 · 14 orders · no prior fee waivers",
    "Checkout failed twice and the pay-another-way link failed during INC-2207",
    "Said the company should pay because its order system wasn't working",
  ],
  sentimentLabel: "Sentiment",
  sentimentValue: "Frustrated",
  sentimentLevel: 1,
  decisions: [
    {
      value: "ship-accept",
      title: "Approve the Override",
      panel: {
        headline: "Approve the override: waive the $15.00 priority shipping charge",
        description: "The failed attempts came from our payment incident, so the upgrade is covered for Lucas.",
        memory: "Experience Memory: failed checkout during INC-2207 was on our side · no prior fee waivers",
        card: { title: "Priority shipping · $0.00 (was $15.00)", sub: "Ships today · arrives Thursday, in time for Friday" },
        confirmLabel: "Authorize Free Priority Shipping",
      },
      result: "Override approved",
    },
    {
      value: "ship-decline",
      title: "Decline the override",
      description: "The AI agent will let Lucas know the fee can't be waived and offer the paid upgrade.",
      noteLabel: "Reason",
      notePlaceholder: "Enter a reason for declining…",
      result: "Override declined",
    },
    {
      value: "ship-other",
          repeatable: true,
      title: "Something else",
      suggestions: [
        "Ask the customer for more time",
        "Apologize to the customer and transfer to a specialist",
        "Ask if a later delivery date would work",
      ],
      notePlaceholder: "Describe what you'd like the AI agent to do instead (e.g. split the fee)...",
      result: "Instruction sent to the AI agent",
    },
  ],
};

/** Escalation card shown after Lucas gets upset about the declined exception. */
export const LUCAS_THOMAS_UPSET_APPROVAL_SUMMARY: TranscriptApprovalSummary = {
  title: "Escalation · Checkout AI Agent",
  headline: "Lucas is upset and wants a call now",
  description:
    "The exception was declined and Lucas is now frustrated, asking for someone to call him immediately. His sentiment has turned negative.",
  checklist: [],
  memoryTitle: "From Experience Memory",
  memory: ["Insider since 2023 · 14 orders · asked for an immediate call"],
  sentimentLabel: "Sentiment",
  sentimentValue: "Upset",
  sentimentLevel: 1,
  decisions: [
    { value: "upset-call", title: "Call now", callRequest: true, result: "Calling Lucas" },
    { value: "upset-transfer", title: "Transfer", result: "Transferring Lucas" },
    {
      value: "upset-other",
      repeatable: true,
      title: "Something else",
      suggestions: [
        "Ask the customer for more time",
        "Apologize to the customer and transfer to a specialist",
        "Ask if a later call would work",
      ],
      notePlaceholder: "Describe what you'd like the AI agent to do instead...",
      result: "Instruction sent to the AI agent",
    },
  ],
};

/** Wrap up card shown once the chat has ended (before the assignment auto-closes). */
export const LUCAS_THOMAS_WRAP_UP = {
  title: "Wrap up · Checkout AI Agent",
  summary:
    "Aurora X2 launch order failed twice during INC-2207. Approved the exception and placed it with PayPal at the held $189.00 price. Lucas then asked about shipping for a Friday birthday gift: standard would arrive Monday, so priority shipping (arrives Thursday) was offered at $15.00. He felt the company should cover it; the AI agent escalated, John Smith approved waiving the fee, and the upgrade was added at no cost. He thanked us and is satisfied.",
  disposition: "Disposition · Checkout · payment incident · resolved",
  buttonLabel: "Complete wrap-up",
};
